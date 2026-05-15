import {
  ImageBudgetError,
  isImageBudgetError,
  prepareImageToBudget,
  type ImageBudgetErrorCode,
  type ImageBudgetErrorDetails,
  type ImageBudgetPolicy,
  type PreparedImageToBudgetResult
} from './prepare-image-to-budget';
import type { LocalImageDraftFileRef } from './local-image-draft-store';

export type BrowserImagePipelineMode = 'worker' | 'main-thread';
export type BrowserImagePipelinePreferredMode = 'auto' | BrowserImagePipelineMode;
export type BrowserImagePipelineProgressStage =
  | 'queued'
  | 'decode'
  | 'encode'
  | 'finalize';

export type BrowserImagePipelineOutputType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/avif';

export type ImagePipelineErrorCode =
  | 'cancelled'
  | 'file_ref_unavailable'
  | 'timeout'
  | 'worker_failed'
  | 'worker_unavailable';

export interface ImagePipelineErrorDetails {
  draftId?: string;
  mode?: BrowserImagePipelineMode;
  outputType?: string;
  timeoutMs?: number;
  reason?: string;
}

export interface ImagePipelineErrorOptions {
  cause?: unknown;
}

export class ImagePipelineError extends Error {
  readonly code: ImagePipelineErrorCode;
  readonly details: ImagePipelineErrorDetails;

  constructor(
    code: ImagePipelineErrorCode,
    message: string,
    details: ImagePipelineErrorDetails = {},
    options?: ImagePipelineErrorOptions
  ) {
    super(message, options);
    this.name = 'ImagePipelineError';
    this.code = code;
    this.details = details;
  }
}

const imagePipelineErrorCodes = new Set<ImagePipelineErrorCode>([
  'cancelled',
  'file_ref_unavailable',
  'timeout',
  'worker_failed',
  'worker_unavailable'
]);

const imageBudgetErrorCodes = new Set<ImageBudgetErrorCode>([
  'invalid_policy',
  'decode_failed',
  'encode_failed',
  'unsupported_output_type',
  'budget_unreachable'
]);

export function isImagePipelineError(error: unknown): error is ImagePipelineError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ImagePipelineError' &&
    typeof (error as { message?: unknown }).message === 'string' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    imagePipelineErrorCodes.has((error as { code: ImagePipelineErrorCode }).code)
  );
}

export interface BrowserImagePipelineSupport {
  worker: boolean;
  moduleWorker: boolean;
  offscreenCanvas: boolean;
  canvas: boolean;
  imageBitmap: boolean;
  opfs: boolean;
  indexedDB: boolean;
  nativeEncode: Record<BrowserImagePipelineOutputType, boolean>;
  wasmCodec: {
    avif: false;
    reason: 'not_configured';
  };
}

export interface DetectBrowserImagePipelineSupportOptions {
  forceRefresh?: boolean;
}

export interface BrowserImagePipelineProgress {
  draftId: string;
  mode: BrowserImagePipelineMode;
  stage: BrowserImagePipelineProgressStage;
  percent?: number;
}

export interface BrowserImagePipelineStorageOptions {
  databaseName?: string;
}

export type BrowserImagePipelinePrepareInput =
  | {
      draftId?: string;
      file: File | Blob;
      fileRef?: never;
      policy: ImageBudgetPolicy;
      storage?: never;
    }
  | {
      draftId: string;
      file?: never;
      fileRef: LocalImageDraftFileRef;
      policy: ImageBudgetPolicy;
      storage?: BrowserImagePipelineStorageOptions;
    };

export interface BrowserImagePipelineOptions {
  preferredMode?: BrowserImagePipelinePreferredMode;
  signal?: AbortSignal;
  timeoutMs?: number;
  workerUrl?: string | URL;
  workerName?: string;
  support?: BrowserImagePipelineSupport;
  onProgress?: (progress: BrowserImagePipelineProgress) => void;
}

export interface BrowserImagePipelineResult {
  draftId: string;
  mode: BrowserImagePipelineMode;
  durationMs: number;
  result: PreparedImageToBudgetResult;
  support: BrowserImagePipelineSupport;
}

export type BrowserImagePipelineWorkerRequest =
  | {
      type: 'prepare';
      draftId: string;
      file?: File | Blob;
      fileRef?: LocalImageDraftFileRef;
      policy: ImageBudgetPolicy;
      storage?: BrowserImagePipelineStorageOptions;
    }
  | {
      type: 'cancel';
      draftId: string;
    };

export type SerializedImagePipelineError =
  | {
      kind: 'image-budget';
      code: ImageBudgetErrorCode;
      message: string;
      details: ImageBudgetErrorDetails;
    }
  | {
      kind: 'image-pipeline';
      code: ImagePipelineErrorCode;
      message: string;
      details: ImagePipelineErrorDetails;
    }
  | {
      kind: 'error';
      message: string;
      name?: string;
    };

export type BrowserImagePipelineWorkerResponse =
  | {
      type: 'progress';
      draftId: string;
      stage: BrowserImagePipelineProgressStage;
      percent?: number;
    }
  | {
      type: 'prepared';
      draftId: string;
      result: PreparedImageToBudgetResult;
    }
  | {
      type: 'error';
      draftId: string;
      error: SerializedImagePipelineError;
    };

let supportPromise: Promise<BrowserImagePipelineSupport> | null = null;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function isWorkerAvailable(): boolean {
  return typeof Worker === 'function';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createCancelledError(draftId: string, mode: BrowserImagePipelineMode): ImagePipelineError {
  return new ImagePipelineError(
    'cancelled',
    'Image preparation was cancelled.',
    { draftId, mode }
  );
}

function createTimeoutError(
  draftId: string,
  mode: BrowserImagePipelineMode,
  timeoutMs: number
): ImagePipelineError {
  return new ImagePipelineError(
    'timeout',
    'Image preparation exceeded the configured processing timeout.',
    { draftId, mode, timeoutMs }
  );
}

function throwIfAborted(
  signal: AbortSignal | undefined,
  draftId: string,
  mode: BrowserImagePipelineMode
): void {
  if (signal?.aborted) {
    throw createCancelledError(draftId, mode);
  }
}

function createDraftId(): string {
  const random = typeof crypto !== 'undefined' ? crypto : undefined;

  if (typeof random?.randomUUID === 'function') {
    return random.randomUUID();
  }

  return `pipeline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function detectModuleWorkerSupport(): Promise<boolean> {
  if (
    !isWorkerAvailable() ||
    typeof Blob !== 'function' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  let objectUrl: string | undefined;
  let worker: Worker | undefined;

  try {
    objectUrl = URL.createObjectURL(
      new Blob(['self.postMessage("ready");'], { type: 'text/javascript' })
    );

    return await new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => resolve(false), 750);
      const workerUrl = objectUrl;

      if (!workerUrl) {
        clearTimeout(timeoutId);
        resolve(false);
        return;
      }

      try {
        worker = new Worker(workerUrl, { type: 'module' });
      } catch {
        clearTimeout(timeoutId);
        resolve(false);
        return;
      }

      worker.onmessage = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };
      worker.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };
    });
  } catch {
    return false;
  } finally {
    worker?.terminate();

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function createDetectionCanvas(width: number, height: number): {
  toBlob: (type: string, quality?: number) => Promise<Blob>;
} | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    const convertToBlob = canvas.convertToBlob;

    if (context && typeof convertToBlob === 'function') {
      context.fillStyle = '#111827';
      context.fillRect(0, 0, width, height);

      return {
        toBlob(type, quality) {
          return convertToBlob.call(canvas, { type, quality });
        }
      };
    }
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.fillStyle = '#111827';
  context.fillRect(0, 0, width, height);

  return {
    toBlob(type, quality) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
              return;
            }

            reject(new Error('Canvas encode detection failed.'));
          },
          type,
          quality
        );
      });
    }
  };
}

async function canEncodeOutputType(type: BrowserImagePipelineOutputType): Promise<boolean> {
  const canvas = createDetectionCanvas(1, 1);

  if (!canvas) {
    return false;
  }

  try {
    const blob = await canvas.toBlob(type, type === 'image/png' ? undefined : 0.82);

    return blob.type === type;
  } catch {
    return false;
  }
}

async function detectSupport(): Promise<BrowserImagePipelineSupport> {
  const outputTypes: BrowserImagePipelineOutputType[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif'
  ];
  const encodeResults = await Promise.all(outputTypes.map((type) => canEncodeOutputType(type)));
  const nativeEncode = outputTypes.reduce(
    (accumulator, type, index) => ({
      ...accumulator,
      [type]: encodeResults[index]
    }),
    {} as Record<BrowserImagePipelineOutputType, boolean>
  );

  return {
    worker: isWorkerAvailable(),
    moduleWorker: await detectModuleWorkerSupport(),
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    canvas: Boolean(createDetectionCanvas(1, 1)),
    imageBitmap: typeof createImageBitmap === 'function',
    opfs: typeof navigator !== 'undefined' &&
      typeof navigator.storage?.getDirectory === 'function',
    indexedDB: typeof indexedDB !== 'undefined',
    nativeEncode,
    wasmCodec: {
      avif: false,
      reason: 'not_configured'
    }
  };
}

export async function detectBrowserImagePipelineSupport(
  options: DetectBrowserImagePipelineSupportOptions = {}
): Promise<BrowserImagePipelineSupport> {
  if (!supportPromise || options.forceRefresh) {
    supportPromise = detectSupport();
  }

  return supportPromise;
}

function createDefaultWorker(options: BrowserImagePipelineOptions): Worker {
  const workerUrl =
    options.workerUrl ?? new URL('./browser-image-pipeline-worker.js', import.meta.url);

  return new Worker(workerUrl, {
    type: 'module',
    name: options.workerName ?? 'image-pipeline'
  });
}

function isWorkerSetupError(error: unknown): boolean {
  return (
    isImagePipelineError(error) &&
    (error.code === 'worker_failed' || error.code === 'worker_unavailable')
  );
}

function resolveTimeoutMs(
  input: BrowserImagePipelinePrepareInput,
  options: BrowserImagePipelineOptions
): number | undefined {
  const timeoutMs = options.timeoutMs ?? input.policy.maxProcessingMs;

  return typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : undefined;
}

export function serializeImagePipelineError(error: unknown): SerializedImagePipelineError {
  if (isImageBudgetError(error)) {
    return {
      kind: 'image-budget',
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (isImagePipelineError(error)) {
    return {
      kind: 'image-pipeline',
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      kind: 'error',
      name: error.name,
      message: error.message
    };
  }

  return {
    kind: 'error',
    message: 'Image preparation failed.'
  };
}

export function deserializeImagePipelineError(
  error: SerializedImagePipelineError
): Error {
  if (error.kind === 'image-budget' && imageBudgetErrorCodes.has(error.code)) {
    return new ImageBudgetError(error.code, error.message, error.details);
  }

  if (error.kind === 'image-pipeline' && imagePipelineErrorCodes.has(error.code)) {
    return new ImagePipelineError(error.code, error.message, error.details);
  }

  const fallback = new Error(error.message);
  fallback.name = error.kind === 'error' ? error.name ?? 'Error' : 'Error';

  return fallback;
}

async function prepareWithWorker(
  input: BrowserImagePipelinePrepareInput,
  options: BrowserImagePipelineOptions,
  support: BrowserImagePipelineSupport,
  draftId: string
): Promise<BrowserImagePipelineResult> {
  if (!support.moduleWorker && !options.workerUrl) {
    throw new ImagePipelineError(
      'worker_unavailable',
      'Module workers are unavailable in this browser.',
      { draftId, mode: 'worker' }
    );
  }

  throwIfAborted(options.signal, draftId, 'worker');

  const startedAt = now();
  let worker: Worker;

  try {
    worker = createDefaultWorker(options);
  } catch (cause) {
    throw new ImagePipelineError(
      'worker_failed',
      'Unable to start the image pipeline worker.',
      { draftId, mode: 'worker' },
      { cause }
    );
  }

  return new Promise<BrowserImagePipelineResult>((resolve, reject) => {
    let settled = false;
    const timeoutMs = resolveTimeoutMs(input, options);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function finish(
      result: PreparedImageToBudgetResult | undefined,
      error: Error | undefined
    ) {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      options.signal?.removeEventListener('abort', abort);
      worker.terminate();

      if (error) {
        reject(error);
        return;
      }

      if (!result) {
        reject(
          new ImagePipelineError(
            'worker_failed',
            'The image pipeline worker finished without a prepared result.',
            { draftId, mode: 'worker' }
          )
        );
        return;
      }

      resolve({
        draftId,
        mode: 'worker',
        durationMs: now() - startedAt,
        result,
        support
      });
    }

    function abort() {
      try {
        worker.postMessage({ type: 'cancel', draftId } satisfies BrowserImagePipelineWorkerRequest);
      } catch {
        // Termination below is the actual cancellation guarantee.
      }

      finish(undefined, createCancelledError(draftId, 'worker'));
    }

    timeoutId = timeoutMs
      ? setTimeout(() => {
          finish(undefined, createTimeoutError(draftId, 'worker', timeoutMs));
        }, timeoutMs)
      : undefined;

    options.signal?.addEventListener('abort', abort, { once: true });

    worker.onmessage = (event: MessageEvent<BrowserImagePipelineWorkerResponse>) => {
      const message = event.data;

      if (!message || message.draftId !== draftId) {
        return;
      }

      if (message.type === 'progress') {
        options.onProgress?.({
          draftId,
          mode: 'worker',
          stage: message.stage,
          percent: message.percent
        });
        return;
      }

      if (message.type === 'prepared') {
        finish(message.result, undefined);
        return;
      }

      finish(undefined, deserializeImagePipelineError(message.error));
    };

    worker.onerror = (event) => {
      finish(
        undefined,
        new ImagePipelineError(
          'worker_failed',
          'The image pipeline worker failed.',
          { draftId, mode: 'worker', reason: event.message }
        )
      );
    };

    options.onProgress?.({ draftId, mode: 'worker', stage: 'queued', percent: 0 });

    const request: BrowserImagePipelineWorkerRequest = {
      type: 'prepare',
      draftId,
      policy: input.policy,
      ...('file' in input
        ? { file: input.file }
        : { fileRef: input.fileRef, storage: input.storage })
    };

    try {
      worker.postMessage(request);
    } catch (cause) {
      finish(
        undefined,
        new ImagePipelineError(
          'worker_failed',
          'Unable to send the image to the pipeline worker.',
          { draftId, mode: 'worker' },
          { cause }
        )
      );
    }
  });
}

async function prepareOnMainThread(
  input: BrowserImagePipelinePrepareInput,
  options: BrowserImagePipelineOptions,
  support: BrowserImagePipelineSupport,
  draftId: string
): Promise<BrowserImagePipelineResult> {
  if (!input.file) {
    throw new ImagePipelineError(
      'worker_unavailable',
      'File-ref preparation requires the image pipeline worker.',
      { draftId, mode: 'main-thread' }
    );
  }

  const startedAt = now();
  const timeoutMs = resolveTimeoutMs(input, options);
  const preparationController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  let externalAbortListener: (() => void) | undefined;

  const abortAsCancelled = () => {
    if (!preparationController.signal.aborted) {
      preparationController.abort(createCancelledError(draftId, 'main-thread'));
    }
  };

  throwIfAborted(options.signal, draftId, 'main-thread');
  options.onProgress?.({ draftId, mode: 'main-thread', stage: 'queued', percent: 0 });

  if (options.signal) {
    externalAbortListener = abortAsCancelled;

    if (options.signal.aborted) {
      abortAsCancelled();
    } else {
      options.signal.addEventListener('abort', externalAbortListener, { once: true });
    }
  }

  if (timeoutMs) {
    timeoutId = setTimeout(() => {
      if (!preparationController.signal.aborted) {
        preparationController.abort(createTimeoutError(draftId, 'main-thread', timeoutMs));
      }
    }, timeoutMs);
  }

  try {
    const abortPromise = new Promise<never>((_, reject) => {
      abortListener = () => {
        const reason = preparationController.signal.reason;

        reject(reason instanceof Error ? reason : createCancelledError(draftId, 'main-thread'));
      };

      if (preparationController.signal.aborted) {
        abortListener();
        return;
      }

      preparationController.signal.addEventListener('abort', abortListener, { once: true });
    });
    const result = await Promise.race([
      prepareImageToBudget(input.file, input.policy, {
        signal: preparationController.signal
      }),
      abortPromise
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    if (preparationController.signal.aborted) {
      const reason = preparationController.signal.reason;

      throw reason instanceof Error ? reason : createCancelledError(draftId, 'main-thread');
    }

    options.onProgress?.({ draftId, mode: 'main-thread', stage: 'finalize', percent: 100 });

    return {
      draftId,
      mode: 'main-thread',
      durationMs: now() - startedAt,
      result,
      support
    };
  } catch (error) {
    if (isImagePipelineError(error) && (error.code === 'cancelled' || error.code === 'timeout')) {
      throw error;
    }

    if (preparationController.signal.aborted || options.signal?.aborted || isAbortError(error)) {
      throw createCancelledError(draftId, 'main-thread');
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (abortListener) {
      preparationController.signal.removeEventListener('abort', abortListener);
    }

    if (options.signal && externalAbortListener) {
      options.signal.removeEventListener('abort', externalAbortListener);
    }
  }
}

export async function prepareImageInBrowserPipeline(
  input: BrowserImagePipelinePrepareInput,
  options: BrowserImagePipelineOptions = {}
): Promise<BrowserImagePipelineResult> {
  const support = options.support ?? await detectBrowserImagePipelineSupport();
  const preferredMode = options.preferredMode ?? 'auto';
  const draftId = input.draftId ?? createDraftId();

  if (preferredMode !== 'main-thread') {
    try {
      return await prepareWithWorker(input, options, support, draftId);
    } catch (error) {
      if (preferredMode === 'worker' || !isWorkerSetupError(error)) {
        throw error;
      }
    }
  }

  return prepareOnMainThread(input, options, support, draftId);
}
