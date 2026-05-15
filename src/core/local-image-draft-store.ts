export type LocalImageDraftPhase =
  | 'raw-captured'
  | 'preparing'
  | 'prepared'
  | 'uploading'
  | 'uploaded'
  | 'commit-pending'
  | 'committed'
  | 'discarded'
  | 'failed';

export type LocalImageDraftFileStore = 'opfs' | 'indexeddb';

export interface LocalImageDraftFileRef {
  store: LocalImageDraftFileStore;
  pathOrKey: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface LocalImageDraftPreparedMetadata {
  width?: number;
  height?: number;
}

export type LocalImageDraftPreparedFileRef =
  LocalImageDraftFileRef & LocalImageDraftPreparedMetadata;

export interface LocalImageDraftManifest {
  version: 1;
  draftId: string;
  fieldId: string;
  productId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  phase: LocalImageDraftPhase;
  raw?: LocalImageDraftFileRef;
  prepared?: LocalImageDraftPreparedFileRef;
  remote?: {
    draftKey?: string;
    uploadedAt?: string;
    uploadExpiresAt?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export type LocalImageDraftStorageMode = 'opfs' | 'indexeddb' | 'memory';

export type LocalImageDraftErrorCode =
  | 'draft_not_found'
  | 'invalid_input'
  | 'quota_exceeded';

export interface LocalImageDraftErrorDetails {
  draftId?: string;
  fieldId?: string;
  requestedBytes?: number;
  quota?: number;
  usage?: number;
  available?: number;
  mode?: LocalImageDraftStorageMode;
}

export interface LocalImageDraftErrorOptions {
  cause?: unknown;
}

export class LocalImageDraftError extends Error {
  readonly code: LocalImageDraftErrorCode;
  readonly details: LocalImageDraftErrorDetails;

  constructor(
    code: LocalImageDraftErrorCode,
    message: string,
    details: LocalImageDraftErrorDetails = {},
    options?: LocalImageDraftErrorOptions
  ) {
    super(message, options);
    this.name = 'LocalImageDraftError';
    this.code = code;
    this.details = details;
  }
}

const localImageDraftErrorCodes = new Set<LocalImageDraftErrorCode>([
  'draft_not_found',
  'invalid_input',
  'quota_exceeded'
]);

export function isLocalImageDraftError(error: unknown): error is LocalImageDraftError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'LocalImageDraftError' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    localImageDraftErrorCodes.has((error as { code: LocalImageDraftErrorCode }).code) &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export type LocalImageDraftStoragePressureReason =
  | 'quota-exceeded'
  | 'storage-pressure';

export interface LocalImageDraftStoragePressure {
  reason: LocalImageDraftStoragePressureReason;
  requestedBytes: number;
  quota?: number;
  usage?: number;
  available?: number;
  mode: LocalImageDraftStorageMode;
}

export type LocalImageDraftStoreWarningCode =
  | 'opfs_unavailable'
  | 'indexeddb_unavailable'
  | 'memory_only'
  | 'manifest_corrupt';

export interface LocalImageDraftStoreWarning {
  code: LocalImageDraftStoreWarningCode;
  message: string;
  cause?: unknown;
}

export interface LocalImageDraftBlobInput {
  blob: Blob;
  fileName?: string;
  mimeType?: string;
  lastModified?: number;
}

export interface LocalImageDraftPreparedBlobInput
  extends LocalImageDraftBlobInput,
    LocalImageDraftPreparedMetadata {}

export interface SaveLocalImageDraftInput {
  draftId?: string;
  fieldId: string;
  productId?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  ttlMs?: number;
  phase?: LocalImageDraftPhase;
  raw?: LocalImageDraftBlobInput;
  prepared?: LocalImageDraftPreparedBlobInput;
  remote?: LocalImageDraftManifest['remote'];
  error?: LocalImageDraftManifest['error'];
}

export interface LocalImageDraftListOptions {
  fieldId?: string;
  productId?: string;
  includeExpired?: boolean;
  phases?: readonly LocalImageDraftPhase[];
  now?: Date;
}

export interface LocalImageDraftCleanupResult {
  deletedDraftIds: string[];
  deletedCount: number;
}

export interface LocalImageDraftRestoreResult {
  manifest: LocalImageDraftManifest;
  raw?: File;
  prepared?: File;
  recoveredFile: File;
  recoveredSlot: 'prepared' | 'raw';
}

export interface LocalImageDraftStorageEstimate {
  quota?: number;
  usage?: number;
  available?: number;
}

export interface LocalImageDraftStore {
  getMode: () => Promise<LocalImageDraftStorageMode>;
  estimateStorage: () => Promise<LocalImageDraftStorageEstimate | null>;
  requestPersistentStorage: () => Promise<boolean | null>;
  saveDraft: (input: SaveLocalImageDraftInput) => Promise<LocalImageDraftManifest>;
  getDraft: (draftId: string) => Promise<LocalImageDraftManifest | null>;
  listDrafts: (options?: LocalImageDraftListOptions) => Promise<LocalImageDraftManifest[]>;
  findRecoverableDrafts: (
    options?: LocalImageDraftListOptions
  ) => Promise<LocalImageDraftManifest[]>;
  restoreDraft: (draftId: string) => Promise<LocalImageDraftRestoreResult | null>;
  discardDraft: (draftId: string) => Promise<void>;
  cleanupExpired: (now?: Date) => Promise<LocalImageDraftCleanupResult>;
}

export interface LocalImageDraftStoreOptions {
  namespace?: string;
  databaseName?: string;
  rootDirectoryName?: string;
  ttlMs?: number;
  storagePressureRatio?: number;
  minAvailableBytes?: number;
  navigator?: Navigator;
  indexedDB?: IDBFactory | null;
  crypto?: {
    randomUUID: () => string;
  };
  now?: () => Date;
  onStoragePressure?: (pressure: LocalImageDraftStoragePressure) => void;
  onWarning?: (warning: LocalImageDraftStoreWarning) => void;
}

type IndexedDbFileRecord = {
  key: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: string;
};

type StorageBackend = {
  mode: LocalImageDraftStorageMode;
  database?: IDBDatabase;
  opfsRoot?: FileSystemDirectoryHandle;
};

const manifestStoreName = 'manifests';
const fileStoreName = 'files';
const databaseVersion = 1;
const defaultNamespace = 'image-drop-input';
const defaultRootDirectoryName = 'image-drop-input-drafts';
const defaultTtlMs = 24 * 60 * 60 * 1000;
const defaultMinAvailableBytes = 1024 * 1024;
const defaultStoragePressureRatio = 0.9;

const terminalPhases = new Set<LocalImageDraftPhase>(['committed', 'discarded']);

function getDefaultNavigator(): Navigator | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

function getDefaultIndexedDB(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

function getDefaultCrypto(): { randomUUID: () => string } | undefined {
  return typeof crypto === 'undefined' ? undefined : crypto;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalText(value: unknown): value is string | undefined {
  return typeof value === 'undefined' || typeof value === 'string';
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidDateString(value: unknown): value is string {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function isBlobLike(value: unknown): value is Blob {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === 'function' &&
    isNonNegativeNumber(value.size) &&
    typeof value.type === 'string'
  );
}

function isLocalImageDraftBlobInput(value: unknown): value is LocalImageDraftBlobInput {
  return isRecord(value) && isBlobLike(value.blob);
}

function isLocalImageDraftFileRef(value: unknown): value is LocalImageDraftFileRef {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.store === 'opfs' || value.store === 'indexeddb') &&
    hasText(value.pathOrKey) &&
    hasText(value.fileName) &&
    typeof value.mimeType === 'string' &&
    isNonNegativeNumber(value.size)
  );
}

function isLocalImageDraftPreparedFileRef(
  value: unknown
): value is LocalImageDraftPreparedFileRef {
  if (!isLocalImageDraftFileRef(value)) {
    return false;
  }

  const record = value as unknown as Record<string, unknown>;

  return (
    (typeof record.width === 'undefined' || isPositiveNumber(record.width)) &&
    (typeof record.height === 'undefined' || isPositiveNumber(record.height))
  );
}

export function isLocalImageDraftManifest(value: unknown): value is LocalImageDraftManifest {
  if (!isRecord(value)) {
    return false;
  }

  const remote = value.remote;
  const error = value.error;

  return (
    value.version === 1 &&
    hasText(value.draftId) &&
    hasText(value.fieldId) &&
    isOptionalText(value.productId) &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt) &&
    isValidDateString(value.expiresAt) &&
    isLocalImageDraftPhase(value.phase) &&
    (typeof value.raw === 'undefined' || isLocalImageDraftFileRef(value.raw)) &&
    (typeof value.prepared === 'undefined' ||
      isLocalImageDraftPreparedFileRef(value.prepared)) &&
    (typeof remote === 'undefined' ||
      (isRecord(remote) &&
        isOptionalText(remote.draftKey) &&
        isOptionalText(remote.uploadedAt) &&
        isOptionalText(remote.uploadExpiresAt))) &&
    (typeof error === 'undefined' ||
      (isRecord(error) && hasText(error.code) && hasText(error.message)))
  );
}

function isLocalImageDraftPhase(value: unknown): value is LocalImageDraftPhase {
  return (
    value === 'raw-captured' ||
    value === 'preparing' ||
    value === 'prepared' ||
    value === 'uploading' ||
    value === 'uploaded' ||
    value === 'commit-pending' ||
    value === 'committed' ||
    value === 'discarded' ||
    value === 'failed'
  );
}

function createDraftId(random?: { randomUUID: () => string }): string {
  if (typeof random?.randomUUID === 'function') {
    const draftId = random.randomUUID();

    if (hasText(draftId)) {
      return draftId;
    }
  }

  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createDraftFileToken(fileCounter: number): string {
  return `${Date.now().toString(36)}-${fileCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');

  return sanitized.length > 0 ? sanitized : 'draft';
}

function getFileName(input: LocalImageDraftBlobInput, fallback: string): string {
  if (hasText(input.fileName)) {
    return input.fileName;
  }

  const namedBlob = input.blob as Blob & { name?: unknown };

  return hasText(namedBlob.name) ? namedBlob.name : fallback;
}

function getMimeType(input: LocalImageDraftBlobInput): string {
  return typeof input.mimeType === 'string' ? input.mimeType : input.blob.type ?? '';
}

function getInputSize(input: LocalImageDraftBlobInput | undefined): number {
  return input?.blob.size ?? 0;
}

function getTotalInputSize(input: SaveLocalImageDraftInput): number {
  return getInputSize(input.raw) + getInputSize(input.prepared);
}

function cleanOptionalString(value: string | undefined): string | undefined {
  return hasText(value) ? value : undefined;
}

function cleanOptionalDraftFileMetadata(value: number | undefined): number | undefined {
  return isPositiveNumber(value) ? value : undefined;
}

function cleanOptionalRemote(
  value: LocalImageDraftManifest['remote'] | undefined
): LocalImageDraftManifest['remote'] | undefined {
  if (!value) {
    return undefined;
  }

  const remote = {
    ...(hasText(value.draftKey) ? { draftKey: value.draftKey } : {}),
    ...(isValidDateString(value.uploadedAt) ? { uploadedAt: value.uploadedAt } : {}),
    ...(isValidDateString(value.uploadExpiresAt)
      ? { uploadExpiresAt: value.uploadExpiresAt }
      : {})
  };

  return Object.keys(remote).length > 0 ? remote : undefined;
}

function cleanOptionalError(
  value: LocalImageDraftManifest['error'] | undefined
): LocalImageDraftManifest['error'] | undefined {
  if (!value || !hasText(value.code) || !hasText(value.message)) {
    return undefined;
  }

  return {
    code: value.code,
    message: value.message
  };
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function isExpired(manifest: LocalImageDraftManifest, now: Date): boolean {
  const time = Date.parse(manifest.expiresAt);

  return !Number.isFinite(time) || time <= now.getTime();
}

function isQuotaExceededError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(manifestStoreName)) {
        const store = database.createObjectStore(manifestStoreName, {
          keyPath: 'draftId'
        });

        store.createIndex('fieldId', 'fieldId');
        store.createIndex('productId', 'productId');
        store.createIndex('expiresAt', 'expiresAt');
      }

      if (!database.objectStoreNames.contains(fileStoreName)) {
        database.createObjectStore(fileStoreName, {
          keyPath: 'key'
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function putManifest(database: IDBDatabase, manifest: LocalImageDraftManifest) {
  const transaction = database.transaction(manifestStoreName, 'readwrite');
  const store = transaction.objectStore(manifestStoreName);

  store.put(manifest);

  await transactionDone(transaction);
}

async function getManifestFromIdb(
  database: IDBDatabase,
  draftId: string
): Promise<LocalImageDraftManifest | null> {
  const transaction = database.transaction(manifestStoreName, 'readonly');
  const store = transaction.objectStore(manifestStoreName);
  const value = await requestToPromise(store.get(draftId));

  await transactionDone(transaction);

  return isLocalImageDraftManifest(value) ? value : null;
}

async function deleteManifestFromIdb(database: IDBDatabase, draftId: string) {
  const transaction = database.transaction(manifestStoreName, 'readwrite');
  const store = transaction.objectStore(manifestStoreName);

  store.delete(draftId);

  await transactionDone(transaction);
}

async function listManifestRecords(database: IDBDatabase): Promise<unknown[]> {
  const transaction = database.transaction(manifestStoreName, 'readonly');
  const store = transaction.objectStore(manifestStoreName);
  const values = await requestToPromise(store.getAll());

  await transactionDone(transaction);

  return values;
}

async function putIndexedDbFile(database: IDBDatabase, record: IndexedDbFileRecord) {
  const transaction = database.transaction(fileStoreName, 'readwrite');
  const store = transaction.objectStore(fileStoreName);

  store.put(record);

  await transactionDone(transaction);
}

async function getIndexedDbFile(
  database: IDBDatabase,
  key: string
): Promise<IndexedDbFileRecord | null> {
  const transaction = database.transaction(fileStoreName, 'readonly');
  const store = transaction.objectStore(fileStoreName);
  const value = await requestToPromise(store.get(key));

  await transactionDone(transaction);

  if (!isRecord(value) || !isBlobLike(value.blob) || !hasText(value.key)) {
    return null;
  }

  return value as IndexedDbFileRecord;
}

async function deleteIndexedDbFile(database: IDBDatabase, key: string) {
  const transaction = database.transaction(fileStoreName, 'readwrite');
  const store = transaction.objectStore(fileStoreName);

  store.delete(key);

  await transactionDone(transaction);
}

async function deleteIndexedDbFilesByPrefix(database: IDBDatabase, keyPrefix: string) {
  const transaction = database.transaction(fileStoreName, 'readwrite');
  const store = transaction.objectStore(fileStoreName);

  await new Promise<void>((resolve, reject) => {
    const request = store.openCursor();

    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB cursor cleanup failed.'));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve();
        return;
      }

      if (typeof cursor.key === 'string' && cursor.key.startsWith(keyPrefix)) {
        cursor.delete();
      }

      cursor.continue();
    };
  });

  await transactionDone(transaction);
}

async function blobToFile(
  blob: Blob,
  fileName: string,
  mimeType: string,
  lastModified?: number
): Promise<File> {
  const normalizedBlob = blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
  const bytes = await normalizedBlob.arrayBuffer();

  if (typeof File === 'function') {
    return new File([bytes], fileName, {
      type: mimeType,
      lastModified
    });
  }

  return Object.assign(new Blob([bytes], { type: mimeType }), {
    name: fileName,
    lastModified: lastModified ?? Date.now()
  }) as File;
}

async function writeOpfsFile(
  root: FileSystemDirectoryHandle,
  rootDirectoryName: string,
  draftId: string,
  slot: 'raw' | 'prepared',
  fileToken: string,
  input: LocalImageDraftBlobInput
): Promise<LocalImageDraftFileRef> {
  const directory = await root.getDirectoryHandle(rootDirectoryName, { create: true });
  const draftDirectory = await directory.getDirectoryHandle(sanitizePathSegment(draftId), {
    create: true
  });
  const fileName = getFileName(input, `${slot}-draft`);
  const opfsFileName = `${slot}-${sanitizePathSegment(fileToken)}-${sanitizePathSegment(fileName)}`;
  const fileHandle = await draftDirectory.getFileHandle(opfsFileName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(input.blob);
  await writable.close();

  return {
    store: 'opfs',
    pathOrKey: `${rootDirectoryName}/${sanitizePathSegment(draftId)}/${opfsFileName}`,
    fileName,
    mimeType: getMimeType(input),
    size: input.blob.size
  };
}

async function readOpfsFile(
  root: FileSystemDirectoryHandle,
  ref: LocalImageDraftFileRef
): Promise<File | null> {
  const parts = ref.pathOrKey.split('/').filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  let currentDirectory = root;

  for (const directoryName of parts.slice(0, -1)) {
    currentDirectory = await currentDirectory.getDirectoryHandle(directoryName);
  }

  const handle = await currentDirectory.getFileHandle(parts[parts.length - 1]);
  const file = await handle.getFile();

  return blobToFile(file, ref.fileName, ref.mimeType || file.type, file.lastModified);
}

async function removeOpfsDraftDirectory(
  root: FileSystemDirectoryHandle,
  rootDirectoryName: string,
  draftId: string
) {
  try {
    const directory = await root.getDirectoryHandle(rootDirectoryName);

    await directory.removeEntry(sanitizePathSegment(draftId), { recursive: true });
  } catch {
    // Missing OPFS entries are already discarded.
  }
}

async function removeOpfsFile(root: FileSystemDirectoryHandle, ref: LocalImageDraftFileRef) {
  const parts = ref.pathOrKey.split('/').filter(Boolean);

  if (parts.length < 3) {
    return;
  }

  try {
    let currentDirectory = root;

    for (const directoryName of parts.slice(0, -1)) {
      currentDirectory = await currentDirectory.getDirectoryHandle(directoryName);
    }

    await currentDirectory.removeEntry(parts[parts.length - 1]);
  } catch {
    // Missing OPFS files are already discarded.
  }
}

function isSameFileRef(
  left: LocalImageDraftFileRef | undefined,
  right: LocalImageDraftFileRef | undefined
): boolean {
  return Boolean(left && right && left.store === right.store && left.pathOrKey === right.pathOrKey);
}

export function createLocalImageDraftStore(
  options: LocalImageDraftStoreOptions = {}
): LocalImageDraftStore {
  const namespace = options.namespace ?? defaultNamespace;
  const databaseName = options.databaseName ?? `${namespace}:local-image-drafts`;
  const rootDirectoryName = options.rootDirectoryName ?? defaultRootDirectoryName;
  const ttlMs = isPositiveNumber(options.ttlMs) ? options.ttlMs : defaultTtlMs;
  const storagePressureRatio =
    typeof options.storagePressureRatio === 'number' &&
    Number.isFinite(options.storagePressureRatio) &&
    options.storagePressureRatio >= 0 &&
    options.storagePressureRatio <= 1
      ? options.storagePressureRatio
      : defaultStoragePressureRatio;
  const minAvailableBytes = isNonNegativeNumber(options.minAvailableBytes)
    ? options.minAvailableBytes
    : defaultMinAvailableBytes;
  const getNow = options.now ?? (() => new Date());
  const random = options.crypto ?? getDefaultCrypto();
  const browserNavigator = options.navigator ?? getDefaultNavigator();
  const idbFactory =
    typeof options.indexedDB === 'undefined' ? getDefaultIndexedDB() : options.indexedDB;
  const memoryManifests = new Map<string, LocalImageDraftManifest>();
  const memoryFiles = new Map<string, IndexedDbFileRecord>();

  let backendPromise: Promise<StorageBackend> | null = null;
  let fileCounter = 0;

  const warn = (warning: LocalImageDraftStoreWarning) => {
    options.onWarning?.(warning);
  };

  const ensureBackend = async (): Promise<StorageBackend> => {
    if (backendPromise) {
      return backendPromise;
    }

    backendPromise = (async () => {
      if (!idbFactory) {
        warn({
          code: 'indexeddb_unavailable',
          message:
            'IndexedDB is unavailable. Local image drafts will be kept in memory only for this page session.'
        });
        warn({
          code: 'memory_only',
          message:
            'Crash-resilient local draft recovery is unavailable without browser storage.'
        });

        return { mode: 'memory' };
      }

      const database = await openDatabase(idbFactory, databaseName);

      let didWarnOpfsUnavailable = false;

      try {
        const opfsRoot = await browserNavigator?.storage?.getDirectory?.();

        if (opfsRoot) {
          return {
            mode: 'opfs',
            database,
            opfsRoot
          };
        }
      } catch (cause) {
        didWarnOpfsUnavailable = true;
        warn({
          code: 'opfs_unavailable',
          message:
            'OPFS is unavailable. Local image draft files will fall back to IndexedDB.',
          cause
        });
      }

      if (!didWarnOpfsUnavailable) {
        warn({
          code: 'opfs_unavailable',
          message: 'OPFS is unavailable. Local image draft files will fall back to IndexedDB.'
        });
      }

      return {
        mode: 'indexeddb',
        database
      };
    })();

    try {
      return await backendPromise;
    } catch (cause) {
      warn({
        code: 'indexeddb_unavailable',
        message:
          'IndexedDB could not be opened. Local image drafts will be kept in memory only for this page session.',
        cause
      });

      const memoryBackend: StorageBackend = { mode: 'memory' };

      backendPromise = Promise.resolve(memoryBackend);

      return memoryBackend;
    }
  };

  const estimateStorage = async (): Promise<LocalImageDraftStorageEstimate | null> => {
    const estimate = await browserNavigator?.storage?.estimate?.();

    if (!estimate) {
      return null;
    }

    const quota = typeof estimate.quota === 'number' ? estimate.quota : undefined;
    const usage = typeof estimate.usage === 'number' ? estimate.usage : undefined;
    const available =
      typeof quota === 'number' && typeof usage === 'number'
        ? Math.max(0, quota - usage)
        : undefined;

    return {
      quota,
      usage,
      available
    };
  };

  const checkStorageCapacity = async (requestedBytes: number, mode: LocalImageDraftStorageMode) => {
    if (requestedBytes <= 0) {
      return;
    }

    const estimate = await estimateStorage();

    if (!estimate || typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number') {
      return;
    }

    const available = Math.max(0, estimate.quota - estimate.usage);
    const isQuotaExceeded = available < requestedBytes + minAvailableBytes;
    const isUnderStoragePressure = estimate.usage / estimate.quota >= storagePressureRatio;
    const pressure: LocalImageDraftStoragePressure = {
      reason: isQuotaExceeded ? 'quota-exceeded' : 'storage-pressure',
      requestedBytes,
      quota: estimate.quota,
      usage: estimate.usage,
      available,
      mode
    };

    if (isQuotaExceeded || isUnderStoragePressure) {
      options.onStoragePressure?.(pressure);
    }

    if (isQuotaExceeded) {
      throw new LocalImageDraftError(
        'quota_exceeded',
        'Not enough browser storage to keep this local image draft. Remove other site data or choose a smaller image.',
        {
          requestedBytes,
          quota: estimate.quota,
          usage: estimate.usage,
          available,
          mode
        }
      );
    }
  };

  const saveManifest = async (backend: StorageBackend, manifest: LocalImageDraftManifest) => {
    if (backend.database) {
      await putManifest(backend.database, manifest);
      return;
    }

    memoryManifests.set(manifest.draftId, manifest);
  };

  const getManifest = async (draftId: string): Promise<LocalImageDraftManifest | null> => {
    const backend = await ensureBackend();

    if (backend.database) {
      return getManifestFromIdb(backend.database, draftId);
    }

    return memoryManifests.get(draftId) ?? null;
  };

  const deleteManifest = async (backend: StorageBackend, draftId: string) => {
    if (backend.database) {
      await deleteManifestFromIdb(backend.database, draftId);
      return;
    }

    memoryManifests.delete(draftId);
  };

  const putFile = async (
    backend: StorageBackend,
    draftId: string,
    slot: 'raw' | 'prepared',
    input: LocalImageDraftBlobInput
  ): Promise<LocalImageDraftFileRef> => {
    const fileToken = createDraftFileToken(++fileCounter);

    if (backend.mode === 'opfs' && backend.opfsRoot) {
      return writeOpfsFile(
        backend.opfsRoot,
        rootDirectoryName,
        draftId,
        slot,
        fileToken,
        input
      );
    }

    const key = `${namespace}:${draftId}:${slot}:${fileToken}`;
    const fileName = getFileName(input, `${slot}-draft`);
    const record: IndexedDbFileRecord = {
      key,
      blob: input.blob,
      fileName,
      mimeType: getMimeType(input),
      size: input.blob.size,
      updatedAt: getNow().toISOString()
    };

    if (backend.database) {
      await putIndexedDbFile(backend.database, record);
    } else {
      memoryFiles.set(key, record);
    }

    return {
      store: 'indexeddb',
      pathOrKey: key,
      fileName,
      mimeType: record.mimeType,
      size: record.size
    };
  };

  const getFile = async (
    backend: StorageBackend,
    ref: LocalImageDraftFileRef
  ): Promise<File | null> => {
    if (ref.store === 'opfs') {
      if (!backend.opfsRoot) {
        return null;
      }

      return readOpfsFile(backend.opfsRoot, ref);
    }

    const record = backend.database
      ? await getIndexedDbFile(backend.database, ref.pathOrKey)
      : memoryFiles.get(ref.pathOrKey) ?? null;

    if (!record) {
      return null;
    }

    return blobToFile(record.blob, record.fileName, record.mimeType);
  };

  const deleteFile = async (backend: StorageBackend, ref: LocalImageDraftFileRef) => {
    if (ref.store === 'opfs') {
      if (backend.opfsRoot) {
        await removeOpfsFile(backend.opfsRoot, ref);
      }

      return;
    }

    if (ref.store === 'indexeddb') {
      if (backend.database) {
        await deleteIndexedDbFile(backend.database, ref.pathOrKey);
      } else {
        memoryFiles.delete(ref.pathOrKey);
      }
    }
  };

  const deleteDraftFiles = async (
    backend: StorageBackend,
    manifest: LocalImageDraftManifest
  ) => {
    if (manifest.raw) {
      await deleteFile(backend, manifest.raw);
    }

    if (manifest.prepared) {
      await deleteFile(backend, manifest.prepared);
    }

    if (backend.opfsRoot) {
      await removeOpfsDraftDirectory(backend.opfsRoot, rootDirectoryName, manifest.draftId);
    }
  };

  const deleteDraftFilesByDraftId = async (backend: StorageBackend, draftId: string) => {
    if (backend.database) {
      await deleteIndexedDbFilesByPrefix(backend.database, `${namespace}:${draftId}:`);
    }

    if (backend.opfsRoot) {
      await removeOpfsDraftDirectory(backend.opfsRoot, rootDirectoryName, draftId);
    }

    for (const key of Array.from(memoryFiles.keys())) {
      if (key.startsWith(`${namespace}:${draftId}:`)) {
        memoryFiles.delete(key);
      }
    }
  };

  const listDrafts = async (
    listOptions: LocalImageDraftListOptions = {}
  ): Promise<LocalImageDraftManifest[]> => {
    const backend = await ensureBackend();
    const now = listOptions.now ?? getNow();
    const phaseSet = listOptions.phases ? new Set(listOptions.phases) : null;
    const records = backend.database
      ? await listManifestRecords(backend.database)
      : Array.from(memoryManifests.values());
    const valid: LocalImageDraftManifest[] = [];

    for (const record of records) {
      if (!isLocalImageDraftManifest(record)) {
        if (isRecord(record) && hasText(record.draftId)) {
          await deleteDraftFilesByDraftId(backend, record.draftId);
          await deleteManifest(backend, record.draftId);
          warn({
            code: 'manifest_corrupt',
            message: 'A corrupt local image draft manifest was removed.'
          });
        }

        continue;
      }

      if (!listOptions.includeExpired && isExpired(record, now)) {
        continue;
      }

      if (listOptions.fieldId && record.fieldId !== listOptions.fieldId) {
        continue;
      }

      if (
        typeof listOptions.productId !== 'undefined' &&
        record.productId !== listOptions.productId
      ) {
        continue;
      }

      if (phaseSet && !phaseSet.has(record.phase)) {
        continue;
      }

      valid.push(record);
    }

    return valid.sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
  };

  const discardDraft = async (draftId: string): Promise<void> => {
    const backend = await ensureBackend();
    const manifest = await getManifest(draftId);

    if (manifest) {
      await deleteDraftFiles(backend, manifest);
    }

    await deleteManifest(backend, draftId);
  };

  return {
    async getMode() {
      const backend = await ensureBackend();

      return backend.mode;
    },

    estimateStorage,

    async requestPersistentStorage() {
      const storage = browserNavigator?.storage;
      const persist = storage?.persist;

      if (typeof persist !== 'function') {
        return null;
      }

      return persist.call(storage);
    },

    async saveDraft(input) {
      if (!hasText(input.fieldId)) {
        throw new LocalImageDraftError(
          'invalid_input',
          'Local image drafts require a non-empty fieldId.'
        );
      }

      if (typeof input.draftId !== 'undefined' && !hasText(input.draftId)) {
        throw new LocalImageDraftError(
          'invalid_input',
          'Local image draft IDs must be non-empty when provided.',
          { fieldId: input.fieldId }
        );
      }

      if (typeof input.phase !== 'undefined' && !isLocalImageDraftPhase(input.phase)) {
        throw new LocalImageDraftError(
          'invalid_input',
          'Local image draft phase is invalid.',
          {
            draftId: input.draftId,
            fieldId: input.fieldId
          }
        );
      }

      if (typeof input.raw !== 'undefined' && !isLocalImageDraftBlobInput(input.raw)) {
        throw new LocalImageDraftError(
          'invalid_input',
          'Local image draft raw input must include a Blob.',
          {
            draftId: input.draftId,
            fieldId: input.fieldId
          }
        );
      }

      if (
        typeof input.prepared !== 'undefined' &&
        !isLocalImageDraftBlobInput(input.prepared)
      ) {
        throw new LocalImageDraftError(
          'invalid_input',
          'Local image draft prepared input must include a Blob.',
          {
            draftId: input.draftId,
            fieldId: input.fieldId
          }
        );
      }

      const backend = await ensureBackend();
      const requestedBytes = getTotalInputSize(input);

      await checkStorageCapacity(requestedBytes, backend.mode);

      const now = getNow();
      const nowIso = now.toISOString();
      const draftId = input.draftId ?? createDraftId(random);
      const existing = await getManifest(draftId);
      let writtenRaw: LocalImageDraftFileRef | undefined;
      let writtenPrepared: LocalImageDraftFileRef | undefined;

      if (!existing && !input.raw && !input.prepared) {
        throw new LocalImageDraftError(
          'invalid_input',
          'A new local image draft requires raw or prepared image bytes.',
          {
            draftId,
            fieldId: input.fieldId
          }
        );
      }

      try {
        const raw = input.raw
          ? (writtenRaw = await putFile(backend, draftId, 'raw', input.raw))
          : existing?.raw;
        const preparedRef = input.prepared
          ? (writtenPrepared = await putFile(backend, draftId, 'prepared', input.prepared))
          : input.raw
            ? undefined
            : existing?.prepared;
        const preparedWidth = cleanOptionalDraftFileMetadata(input.prepared?.width);
        const preparedHeight = cleanOptionalDraftFileMetadata(input.prepared?.height);
        const prepared = input.prepared && preparedRef
          ? {
              ...preparedRef,
              ...(typeof preparedWidth !== 'undefined' ? { width: preparedWidth } : {}),
              ...(typeof preparedHeight !== 'undefined' ? { height: preparedHeight } : {})
            }
          : preparedRef;
        const expiresAt =
          (isValidDateString(input.expiresAt)
            ? input.expiresAt
            : undefined) ??
          (isPositiveNumber(input.ttlMs)
            ? addMs(now, input.ttlMs).toISOString()
            : existing?.expiresAt ?? addMs(now, ttlMs).toISOString());
        const phase =
          input.phase ??
          (prepared ? 'prepared' : raw ? 'raw-captured' : existing?.phase ?? 'raw-captured');
        const productId = cleanOptionalString(input.productId) ?? existing?.productId;
        const remote = cleanOptionalRemote(input.remote) ?? existing?.remote;
        const error = cleanOptionalError(input.error);
        const manifest: LocalImageDraftManifest = {
          version: 1,
          draftId,
          fieldId: input.fieldId,
          ...(typeof productId !== 'undefined' ? { productId } : {}),
          createdAt: isValidDateString(input.createdAt)
            ? input.createdAt
            : existing?.createdAt ?? nowIso,
          updatedAt: isValidDateString(input.updatedAt) ? input.updatedAt : nowIso,
          expiresAt,
          phase,
          ...(raw ? { raw } : {}),
          ...(prepared ? { prepared } : {}),
          ...(remote ? { remote } : {}),
          ...(error ? { error } : {})
        };

        await saveManifest(backend, manifest);

        if (existing?.raw && !isSameFileRef(existing.raw, raw)) {
          await deleteFile(backend, existing.raw).catch(() => undefined);
        }

        if (existing?.prepared && !isSameFileRef(existing.prepared, prepared)) {
          await deleteFile(backend, existing.prepared).catch(() => undefined);
        }

        return manifest;
      } catch (cause) {
        if (writtenRaw && !isSameFileRef(writtenRaw, existing?.raw)) {
          await deleteFile(backend, writtenRaw).catch(() => undefined);
        }

        if (writtenPrepared && !isSameFileRef(writtenPrepared, existing?.prepared)) {
          await deleteFile(backend, writtenPrepared).catch(() => undefined);
        }

        if (!existing && backend.opfsRoot) {
          await removeOpfsDraftDirectory(backend.opfsRoot, rootDirectoryName, draftId);
        }

        if (isQuotaExceededError(cause)) {
          throw new LocalImageDraftError(
            'quota_exceeded',
            'Not enough browser storage to keep this local image draft. Remove other site data or choose a smaller image.',
            {
              draftId,
              fieldId: input.fieldId,
              requestedBytes,
              mode: backend.mode
            },
            { cause }
          );
        }

        throw cause;
      }
    },

    getDraft: getManifest,

    listDrafts,

    async findRecoverableDrafts(listOptions = {}) {
      const manifests = await listDrafts(listOptions);

      return manifests.filter(
        (manifest) =>
          !terminalPhases.has(manifest.phase) &&
          Boolean(manifest.prepared ?? manifest.raw)
      );
    },

    async restoreDraft(draftId) {
      const backend = await ensureBackend();
      const manifest = await getManifest(draftId);

      if (!manifest) {
        return null;
      }

      if (isExpired(manifest, getNow()) || terminalPhases.has(manifest.phase)) {
        await discardDraft(draftId);
        return null;
      }

      if (!manifest.raw && !manifest.prepared) {
        throw new LocalImageDraftError(
          'draft_not_found',
          'The local image draft manifest does not reference recoverable image bytes.',
          { draftId }
        );
      }

      const raw = manifest.raw ? await getFile(backend, manifest.raw) : undefined;
      const prepared = manifest.prepared
        ? await getFile(backend, manifest.prepared)
        : undefined;
      const recoveredFile = prepared ?? raw;

      if (!recoveredFile) {
        throw new LocalImageDraftError(
          'draft_not_found',
          'The local image draft file could not be restored. It may have been removed by the browser.',
          { draftId }
        );
      }

      return {
        manifest,
        ...(raw ? { raw } : {}),
        ...(prepared ? { prepared } : {}),
        recoveredFile,
        recoveredSlot: prepared ? 'prepared' : 'raw'
      };
    },

    discardDraft,

    async cleanupExpired(now = getNow()) {
      const drafts = await listDrafts({ includeExpired: true, now });
      const expired = drafts.filter(
        (manifest) => isExpired(manifest, now) || terminalPhases.has(manifest.phase)
      );
      const deletedDraftIds: string[] = [];

      for (const manifest of expired) {
        await discardDraft(manifest.draftId);
        deletedDraftIds.push(manifest.draftId);
      }

      return {
        deletedDraftIds,
        deletedCount: deletedDraftIds.length
      };
    }
  };
}
