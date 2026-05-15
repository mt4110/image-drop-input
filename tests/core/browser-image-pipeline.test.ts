import '../setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deserializeImagePipelineError,
  ImageBudgetError,
  isImageBudgetError,
  ImagePipelineError,
  prepareImageInBrowserPipeline,
  serializeImagePipelineError,
  type BrowserImagePipelineSupport,
  type BrowserImagePipelineWorkerRequest,
  type BrowserImagePipelineWorkerResponse,
  type PreparedImageToBudgetResult
} from '../../src/headless';
import {
  inferIndexedDbDraftDatabaseName,
  resolveIndexedDbDraftDatabaseName
} from '../../src/browser-image-pipeline-worker';

const workerSupport: BrowserImagePipelineSupport = {
  worker: true,
  moduleWorker: true,
  offscreenCanvas: true,
  canvas: true,
  imageBitmap: true,
  opfs: false,
  indexedDB: true,
  nativeEncode: {
    'image/png': true,
    'image/jpeg': true,
    'image/webp': true,
    'image/avif': false
  },
  wasmCodec: {
    avif: false,
    reason: 'not_configured'
  }
};

const mainThreadOnlySupport: BrowserImagePipelineSupport = {
  ...workerSupport,
  worker: false,
  moduleWorker: false
};

const workerWithoutBlobModuleProbeSupport: BrowserImagePipelineSupport = {
  ...workerSupport,
  moduleWorker: false
};

function createPreparedResult(source: Blob): PreparedImageToBudgetResult {
  const file = new Blob([new Uint8Array(512)], { type: 'image/webp' });

  return {
    file,
    fileName: 'prepared.webp',
    mimeType: 'image/webp',
    size: file.size,
    width: 320,
    height: 240,
    originalFileName: 'source.png',
    originalMimeType: source.type,
    originalSize: source.size,
    originalWidth: 640,
    originalHeight: 480,
    outputMaxBytes: 10_000,
    compressionRatio: file.size / source.size,
    attempts: [],
    strategy: 'resize'
  };
}

describe('browser image pipeline', () => {
  const originalWorker = globalThis.Worker;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;

  const drawImage = vi.fn();

  class MockOffscreenCanvas {
    constructor(
      public width: number,
      public height: number
    ) {}

    getContext(contextId: string) {
      if (contextId !== '2d') {
        return null;
      }

      return {
        drawImage,
        fillRect: vi.fn()
      } as unknown as OffscreenCanvasRenderingContext2D;
    }

    convertToBlob(options?: ImageEncodeOptions) {
      const type = options?.type ?? 'image/png';
      const size = Math.max(16, Math.ceil(this.width * this.height * 0.2));

      return Promise.resolve(new Blob([new Uint8Array(size)], { type }));
    }
  }

  beforeEach(() => {
    drawImage.mockReset();

    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn(async () => ({
        width: 640,
        height: 480,
        close: vi.fn()
      }))
    });
    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: MockOffscreenCanvas
    });
  });

  afterEach(() => {
    if (originalWorker) {
      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        value: originalWorker
      });
    } else {
      Reflect.deleteProperty(globalThis, 'Worker');
    }

    if (originalCreateImageBitmap) {
      Object.defineProperty(globalThis, 'createImageBitmap', {
        configurable: true,
        value: originalCreateImageBitmap
      });
    } else {
      Reflect.deleteProperty(globalThis, 'createImageBitmap');
    }

    if (originalOffscreenCanvas) {
      Object.defineProperty(globalThis, 'OffscreenCanvas', {
        configurable: true,
        value: originalOffscreenCanvas
      });
    } else {
      Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
    }
  });

  it('falls back to the main thread when module workers are unavailable', async () => {
    const progress: string[] = [];
    const source = new File([new Uint8Array(120_000)], 'source.png', { type: 'image/png' });
    const result = await prepareImageInBrowserPipeline(
      {
        draftId: 'fallback-draft',
        file: source,
        policy: {
          outputMaxBytes: 80_000,
          outputType: 'image/webp',
          maxWidth: 500,
          maxHeight: 500
        }
      },
      {
        support: mainThreadOnlySupport,
        onProgress(event) {
          progress.push(`${event.mode}:${event.stage}`);
        }
      }
    );

    expect(result.mode).toBe('main-thread');
    expect(result.result.file.type).toBe('image/webp');
    expect(result.result.size).toBeLessThanOrEqual(80_000);
    expect(progress).toContain('main-thread:queued');
    expect(progress).toContain('main-thread:finalize');
  });

  it('rejects the main-thread fallback when the processing timeout is reached', async () => {
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn(() => new Promise(() => {}))
    });

    const source = new File([new Uint8Array(120_000)], 'source.png', { type: 'image/png' });

    await expect(
      prepareImageInBrowserPipeline(
        {
          draftId: 'main-thread-timeout-draft',
          file: source,
          policy: {
            outputMaxBytes: 80_000,
            outputType: 'image/webp'
          }
        },
        {
          support: mainThreadOnlySupport,
          timeoutMs: 1
        }
      )
    ).rejects.toMatchObject({
      name: 'ImagePipelineError',
      code: 'timeout',
      details: {
        draftId: 'main-thread-timeout-draft',
        mode: 'main-thread',
        timeoutMs: 1
      }
    });
  });

  it('uses the worker path by default when module workers are supported', async () => {
    const progress: string[] = [];
    const source = new File([new Uint8Array(40_000)], 'source.png', { type: 'image/png' });

    class MockWorker {
      static instances: MockWorker[] = [];

      onmessage: ((event: MessageEvent<BrowserImagePipelineWorkerResponse>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: BrowserImagePipelineWorkerRequest) => {
        if (message.type !== 'prepare') {
          return;
        }

        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: 'progress',
              draftId: message.draftId,
              stage: 'encode',
              percent: 60
            }
          } as MessageEvent<BrowserImagePipelineWorkerResponse>);
          this.onmessage?.({
            data: {
              type: 'prepared',
              draftId: message.draftId,
              result: createPreparedResult(source)
            }
          } as MessageEvent<BrowserImagePipelineWorkerResponse>);
        });
      });
      terminate = vi.fn();

      constructor() {
        MockWorker.instances.push(this);
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: MockWorker
    });

    const result = await prepareImageInBrowserPipeline(
      {
        draftId: 'worker-draft',
        file: source,
        policy: {
          outputMaxBytes: 10_000,
          outputType: 'image/webp'
        }
      },
      {
        support: workerSupport,
        onProgress(event) {
          progress.push(`${event.mode}:${event.stage}:${event.percent ?? ''}`);
        }
      }
    );

    expect(result.mode).toBe('worker');
    expect(result.result.fileName).toBe('prepared.webp');
    expect(MockWorker.instances[0].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'prepare',
        draftId: 'worker-draft'
      })
    );
    expect(MockWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
    expect(progress).toContain('worker:queued:0');
    expect(progress).toContain('worker:encode:60');
  });

  it('tries an explicit worker URL even when blob-based module worker probing is unavailable', async () => {
    const source = new File([new Uint8Array(40_000)], 'source.png', { type: 'image/png' });

    class MockWorker {
      static constructorArgs: unknown[][] = [];

      onmessage: ((event: MessageEvent<BrowserImagePipelineWorkerResponse>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: BrowserImagePipelineWorkerRequest) => {
        if (message.type !== 'prepare') {
          return;
        }

        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: 'prepared',
              draftId: message.draftId,
              result: createPreparedResult(source)
            }
          } as MessageEvent<BrowserImagePipelineWorkerResponse>);
        });
      });
      terminate = vi.fn();

      constructor(...args: unknown[]) {
        MockWorker.constructorArgs.push(args);
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: MockWorker
    });

    const result = await prepareImageInBrowserPipeline(
      {
        draftId: 'custom-worker-draft',
        file: source,
        policy: {
          outputMaxBytes: 10_000,
          outputType: 'image/webp'
        }
      },
      {
        support: workerWithoutBlobModuleProbeSupport,
        workerUrl: '/assets/image-pipeline-worker.js'
      }
    );

    expect(result.mode).toBe('worker');
    expect(MockWorker.constructorArgs[0]).toEqual([
      '/assets/image-pipeline-worker.js',
      { type: 'module', name: 'image-pipeline' }
    ]);
  });

  it('terminates the worker on cancellation', async () => {
    const controller = new AbortController();
    const source = new File([new Uint8Array(40_000)], 'source.png', { type: 'image/png' });

    class HangingWorker {
      static instances: HangingWorker[] = [];

      onmessage: ((event: MessageEvent<BrowserImagePipelineWorkerResponse>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        HangingWorker.instances.push(this);
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: HangingWorker
    });

    const promise = prepareImageInBrowserPipeline(
      {
        draftId: 'cancel-draft',
        file: source,
        policy: {
          outputMaxBytes: 10_000,
          outputType: 'image/webp'
        }
      },
      {
        support: workerSupport,
        signal: controller.signal
      }
    );

    controller.abort();

    await expect(promise).rejects.toMatchObject({
      name: 'ImagePipelineError',
      code: 'cancelled'
    });
    expect(HangingWorker.instances[0].postMessage).toHaveBeenCalledWith({
      type: 'cancel',
      draftId: 'cancel-draft'
    });
    expect(HangingWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates the worker when the processing timeout is reached', async () => {
    const source = new File([new Uint8Array(40_000)], 'source.png', { type: 'image/png' });

    class HangingWorker {
      static instances: HangingWorker[] = [];

      onmessage: ((event: MessageEvent<BrowserImagePipelineWorkerResponse>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        HangingWorker.instances.push(this);
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: HangingWorker
    });

    await expect(
      prepareImageInBrowserPipeline(
        {
          draftId: 'timeout-draft',
          file: source,
          policy: {
            outputMaxBytes: 10_000,
            outputType: 'image/webp'
          }
        },
        {
          support: workerSupport,
          timeoutMs: 1
        }
      )
    ).rejects.toMatchObject({
      name: 'ImagePipelineError',
      code: 'timeout',
      details: {
        draftId: 'timeout-draft',
        mode: 'worker',
        timeoutMs: 1
      }
    });
    expect(HangingWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('round-trips stable pipeline and budget errors across the worker protocol', () => {
    const budgetError = new ImageBudgetError(
      'budget_unreachable',
      'Unable to fit.',
      { outputMaxBytes: 1, attempts: [] }
    );
    const pipelineError = new ImagePipelineError(
      'worker_unavailable',
      'Worker unavailable.',
      { draftId: 'draft-1', mode: 'worker' }
    );

    expect(isImageBudgetError(deserializeImagePipelineError(
      serializeImagePipelineError(budgetError)
    ))).toBe(true);
    expect(deserializeImagePipelineError(
      serializeImagePipelineError(pipelineError)
    )).toMatchObject({
      name: 'ImagePipelineError',
      code: 'worker_unavailable',
      details: { draftId: 'draft-1', mode: 'worker' }
    });
  });

  it('infers IndexedDB draft databases from namespaced worker file keys', () => {
    expect(inferIndexedDbDraftDatabaseName({
      pathOrKey: 'image-drop-input:draft-1:raw:file-1'
    })).toBe('image-drop-input:local-image-drafts');
    expect(inferIndexedDbDraftDatabaseName({
      pathOrKey: 'team:prod:session:42:prepared:file-2'
    })).toBeUndefined();
    expect(inferIndexedDbDraftDatabaseName({
      pathOrKey: 'malformed-key'
    })).toBeUndefined();
  });

  it('prefers the explicit IndexedDB database name on worker file refs', () => {
    expect(resolveIndexedDbDraftDatabaseName(
      {
        pathOrKey: 'team:prod:session:42:raw:file-1',
        databaseName: 'team:prod:local-image-drafts'
      },
      undefined
    )).toBe('team:prod:local-image-drafts');
    expect(resolveIndexedDbDraftDatabaseName(
      {
        pathOrKey: 'team:prod:session:42:raw:file-1',
        databaseName: 'team:prod:local-image-drafts'
      },
      { databaseName: 'app-owned-drafts' }
    )).toBe('app-owned-drafts');
  });
});
