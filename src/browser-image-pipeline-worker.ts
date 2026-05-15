import {
  ImagePipelineError,
  serializeImagePipelineError,
  type BrowserImagePipelineStorageOptions,
  type BrowserImagePipelineWorkerRequest,
  type BrowserImagePipelineWorkerResponse
} from './core/browser-image-pipeline';
import { prepareImageToBudget } from './core/prepare-image-to-budget';
import type { LocalImageDraftFileRef } from './core/local-image-draft-store';

const fileStoreName = 'files';
const databaseVersion = 1;
const cancelledDrafts = new Set<string>();
const activeControllers = new Map<string, AbortController>();

function postMessageToClient(message: BrowserImagePipelineWorkerResponse): void {
  self.postMessage(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlobLike(value: unknown): value is Blob {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string'
  );
}

function assertNotCancelled(draftId: string): void {
  if (cancelledDrafts.has(draftId)) {
    throw new ImagePipelineError(
      'cancelled',
      'Image preparation was cancelled.',
      { draftId, mode: 'worker' }
    );
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function cancelDraft(draftId: string): void {
  cancelledDrafts.add(draftId);
  activeControllers.get(draftId)?.abort(
    new DOMException('Image preparation was cancelled.', 'AbortError')
  );
}

async function blobToFile(blob: Blob, fileName: string, mimeType: string): Promise<File> {
  const normalizedBlob = blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
  const bytes = await normalizedBlob.arrayBuffer();

  if (typeof File === 'function') {
    return new File([bytes], fileName, { type: mimeType });
  }

  return Object.assign(new Blob([bytes], { type: mimeType }), {
    name: fileName,
    lastModified: Date.now()
  }) as File;
}

async function readOpfsFileRef(ref: LocalImageDraftFileRef): Promise<File> {
  const root = await navigator.storage?.getDirectory?.();

  if (!root) {
    throw new ImagePipelineError(
      'file_ref_unavailable',
      'OPFS is unavailable in the image pipeline worker.',
      { mode: 'worker' }
    );
  }

  const parts = ref.pathOrKey.split('/').filter(Boolean);

  if (parts.length < 3) {
    throw new ImagePipelineError(
      'file_ref_unavailable',
      'The OPFS draft file reference is malformed.',
      { mode: 'worker' }
    );
  }

  let directory = root;

  for (const directoryName of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(directoryName);
  }

  const handle = await directory.getFileHandle(parts[parts.length - 1]);
  const file = await handle.getFile();

  return blobToFile(file, ref.fileName, ref.mimeType || file.type);
}

export function inferIndexedDbDraftDatabaseName(
  ref: Pick<LocalImageDraftFileRef, 'pathOrKey'>
): string | undefined {
  const slotIndex = Math.max(
    ref.pathOrKey.lastIndexOf(':raw:'),
    ref.pathOrKey.lastIndexOf(':prepared:')
  );

  if (slotIndex <= 0) {
    return undefined;
  }

  const namespaceAndDraftId = ref.pathOrKey.slice(0, slotIndex);
  const draftIdSeparator = namespaceAndDraftId.lastIndexOf(':');

  if (draftIdSeparator <= 0) {
    return undefined;
  }

  return `${namespaceAndDraftId.slice(0, draftIdSeparator)}:local-image-drafts`;
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(fileStoreName)) {
        database.createObjectStore(fileStoreName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function readIndexedDbFileRef(
  ref: LocalImageDraftFileRef,
  storage: BrowserImagePipelineStorageOptions | undefined
): Promise<File> {
  if (typeof indexedDB === 'undefined') {
    throw new ImagePipelineError(
      'file_ref_unavailable',
      'IndexedDB is unavailable in the image pipeline worker.',
      { mode: 'worker' }
    );
  }

  const databaseName = storage?.databaseName ?? inferIndexedDbDraftDatabaseName(ref);

  if (!databaseName) {
    throw new ImagePipelineError(
      'file_ref_unavailable',
      'IndexedDB draft file references require a database name.',
      { mode: 'worker' }
    );
  }

  const database = await openDatabase(databaseName);

  try {
    if (!database.objectStoreNames.contains(fileStoreName)) {
      throw new ImagePipelineError(
        'file_ref_unavailable',
        'The local draft file store is unavailable.',
        { mode: 'worker' }
      );
    }

    const transaction = database.transaction(fileStoreName, 'readonly');
    const value = await requestToPromise(transaction.objectStore(fileStoreName).get(ref.pathOrKey));

    if (!isRecord(value) || !isBlobLike(value.blob)) {
      throw new ImagePipelineError(
        'file_ref_unavailable',
        'The local draft file could not be restored in the worker.',
        { mode: 'worker' }
      );
    }

    return blobToFile(value.blob, ref.fileName, ref.mimeType || value.blob.type);
  } finally {
    database.close();
  }
}

async function readFileRef(
  ref: LocalImageDraftFileRef,
  storage: BrowserImagePipelineStorageOptions | undefined
): Promise<File> {
  if (ref.store === 'opfs') {
    return readOpfsFileRef(ref);
  }

  return readIndexedDbFileRef(ref, storage);
}

async function prepare(request: Extract<BrowserImagePipelineWorkerRequest, { type: 'prepare' }>) {
  const { draftId } = request;
  const controller = new AbortController();

  cancelledDrafts.delete(draftId);
  activeControllers.set(draftId, controller);
  assertNotCancelled(draftId);
  postMessageToClient({ type: 'progress', draftId, stage: 'decode', percent: 20 });

  let file: File | Blob;

  if (request.file) {
    file = request.file;
  } else if (request.fileRef) {
    file = await readFileRef(request.fileRef, request.storage);
  } else {
    throw new ImagePipelineError(
      'file_ref_unavailable',
      'The image pipeline worker requires a File, Blob, or local draft file reference.',
      { draftId, mode: 'worker' }
    );
  }

  assertNotCancelled(draftId);
  postMessageToClient({ type: 'progress', draftId, stage: 'encode', percent: 60 });

  const result = await prepareImageToBudget(file, request.policy, {
    signal: controller.signal
  });

  assertNotCancelled(draftId);
  postMessageToClient({ type: 'progress', draftId, stage: 'finalize', percent: 95 });
  postMessageToClient({ type: 'prepared', draftId, result });
}

self.onmessage = (event: MessageEvent<BrowserImagePipelineWorkerRequest>) => {
  const request = event.data;

  if (!request || typeof request.draftId !== 'string') {
    return;
  }

  if (request.type === 'cancel') {
    cancelDraft(request.draftId);
    return;
  }

  prepare(request)
    .catch((error) => {
      const serializedError = isAbortError(error)
        ? new ImagePipelineError(
            'cancelled',
            'Image preparation was cancelled.',
            { draftId: request.draftId, mode: 'worker' },
            { cause: error }
          )
        : error;

      postMessageToClient({
        type: 'error',
        draftId: request.draftId,
        error: serializeImagePipelineError(serializedError)
      });
    })
    .finally(() => {
      activeControllers.delete(request.draftId);
      cancelledDrafts.delete(request.draftId);
    });
};
