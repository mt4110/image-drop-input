import '../setup';
import { Blob as NodeBlob } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalImageDraftStore,
  isLocalImageDraftError,
  LocalImageDraftError,
  type LocalImageDraftFileRef
} from '../../src/core/local-image-draft-store';

class FakeWritableFileStream {
  private readonly chunks: BlobPart[] = [];

  constructor(private readonly fileHandle: FakeFileHandle) {}

  async write(data: BlobPart | { data: BlobPart }) {
    if (data && typeof data === 'object' && 'data' in data) {
      this.chunks.push(data.data);
      return;
    }

    this.chunks.push(data as BlobPart);
  }

  async close() {
    const parts = await Promise.all(
      this.chunks.map(async (chunk) => {
        if (
          chunk &&
          typeof chunk === 'object' &&
          'arrayBuffer' in chunk &&
          typeof chunk.arrayBuffer === 'function'
        ) {
          return chunk.arrayBuffer();
        }

        return chunk;
      })
    );

    this.fileHandle.blob = new Blob(parts);
    this.fileHandle.lastModified = Date.now();
  }
}

class FakeFileHandle {
  readonly kind = 'file';
  blob = new Blob([]);
  lastModified = Date.now();

  constructor(readonly name: string) {}

  async getFile() {
    return new File([this.blob], this.name, {
      type: this.blob.type,
      lastModified: this.lastModified
    });
  }

  async createWritable() {
    return new FakeWritableFileStream(this);
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory';
  private readonly directories = new Map<string, FakeDirectoryHandle>();
  private readonly files = new Map<string, FakeFileHandle>();

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options: FileSystemGetDirectoryOptions = {}) {
    const existing = this.directories.get(name);

    if (existing) {
      return existing as unknown as FileSystemDirectoryHandle;
    }

    if (!options.create) {
      throw new DOMException('Directory not found.', 'NotFoundError');
    }

    const directory = new FakeDirectoryHandle(name);

    this.directories.set(name, directory);

    return directory as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options: FileSystemGetFileOptions = {}) {
    const existing = this.files.get(name);

    if (existing) {
      return existing as unknown as FileSystemFileHandle;
    }

    if (!options.create) {
      throw new DOMException('File not found.', 'NotFoundError');
    }

    const file = new FakeFileHandle(name);

    this.files.set(name, file);

    return file as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string) {
    this.files.delete(name);
    this.directories.delete(name);
  }
}

function createNavigator(storage: Partial<StorageManager>): Navigator {
  return {
    storage
  } as unknown as Navigator;
}

function createBlob(
  parts: Array<string | Uint8Array | ArrayBuffer>,
  options?: BlobPropertyBag
): Blob {
  return new NodeBlob(
    parts as ConstructorParameters<typeof NodeBlob>[0],
    options
  ) as unknown as Blob;
}

async function removeFakeOpfsFile(
  root: FakeDirectoryHandle,
  ref: LocalImageDraftFileRef
): Promise<void> {
  const parts = ref.pathOrKey.split('/').filter(Boolean);
  let directory = root as unknown as FileSystemDirectoryHandle;

  for (const directoryName of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(directoryName);
  }

  await directory.removeEntry(parts[parts.length - 1]);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
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

describe('createLocalImageDraftStore', () => {
  it('stores files in OPFS with an IndexedDB manifest and restores them through a new store instance', async () => {
    const indexedDB = new IDBFactory();
    const opfsRoot = new FakeDirectoryHandle('root');
    const navigator = createNavigator({
      estimate: async () => ({ quota: 10_000_000, usage: 0 }),
      getDirectory: async () => opfsRoot as unknown as FileSystemDirectoryHandle
    });
    const options = {
      databaseName: 'opfs-draft-test',
      indexedDB,
      navigator,
      crypto: { randomUUID: () => 'draft-opfs' }
    };
    const store = createLocalImageDraftStore(options);

    const manifest = await store.saveDraft({
      fieldId: 'profile.avatar',
      productId: 'profile-1',
      raw: {
        blob: createBlob(['raw bytes'], { type: 'image/png' }),
        fileName: 'avatar.png'
      },
      prepared: {
        blob: createBlob(['prepared bytes'], { type: 'image/webp' }),
        fileName: 'avatar.webp',
        width: 128,
        height: 128
      },
      ttlMs: 60_000
    });

    expect(await store.getMode()).toBe('opfs');
    expect(manifest.raw?.store).toBe('opfs');
    expect(manifest.prepared?.store).toBe('opfs');

    const reloadedStore = createLocalImageDraftStore(options);
    const drafts = await reloadedStore.findRecoverableDrafts({
      fieldId: 'profile.avatar',
      productId: 'profile-1'
    });
    const restored = await reloadedStore.restoreDraft('draft-opfs');

    expect(drafts).toHaveLength(1);
    expect(restored?.manifest.draftId).toBe('draft-opfs');
    expect(restored?.recoveredSlot).toBe('prepared');
    expect(await restored?.prepared?.text()).toBe('prepared bytes');
    expect(await restored?.raw?.text()).toBe('raw bytes');
  });

  it('falls back to a surviving OPFS slot when another referenced file is missing', async () => {
    const indexedDB = new IDBFactory();
    const opfsRoot = new FakeDirectoryHandle('root');
    const navigator = createNavigator({
      estimate: async () => ({ quota: 10_000_000, usage: 0 }),
      getDirectory: async () => opfsRoot as unknown as FileSystemDirectoryHandle
    });
    const options = {
      databaseName: 'opfs-partial-loss-test',
      indexedDB,
      navigator,
      crypto: { randomUUID: () => 'draft-opfs-partial' }
    };
    const store = createLocalImageDraftStore(options);

    const manifest = await store.saveDraft({
      fieldId: 'profile.avatar',
      raw: {
        blob: createBlob(['raw bytes'], { type: 'image/png' }),
        fileName: 'avatar.png'
      },
      prepared: {
        blob: createBlob(['prepared bytes'], { type: 'image/webp' }),
        fileName: 'avatar.webp',
        width: 128,
        height: 128
      }
    });

    await removeFakeOpfsFile(opfsRoot, manifest.raw!);

    const reloadedStore = createLocalImageDraftStore(options);
    const restored = await reloadedStore.restoreDraft('draft-opfs-partial');

    expect(restored?.raw).toBeUndefined();
    expect(restored?.recoveredSlot).toBe('prepared');
    expect(await restored?.prepared?.text()).toBe('prepared bytes');
  });

  it('maps fully missing OPFS files to the local draft error taxonomy', async () => {
    const indexedDB = new IDBFactory();
    const opfsRoot = new FakeDirectoryHandle('root');
    const navigator = createNavigator({
      estimate: async () => ({ quota: 10_000_000, usage: 0 }),
      getDirectory: async () => opfsRoot as unknown as FileSystemDirectoryHandle
    });
    const options = {
      databaseName: 'opfs-full-loss-test',
      indexedDB,
      navigator,
      crypto: { randomUUID: () => 'draft-opfs-missing' }
    };
    const store = createLocalImageDraftStore(options);

    const manifest = await store.saveDraft({
      fieldId: 'profile.avatar',
      raw: {
        blob: createBlob(['raw bytes'], { type: 'image/png' }),
        fileName: 'avatar.png'
      },
      prepared: {
        blob: createBlob(['prepared bytes'], { type: 'image/webp' }),
        fileName: 'avatar.webp'
      }
    });

    await removeFakeOpfsFile(opfsRoot, manifest.raw!);
    await removeFakeOpfsFile(opfsRoot, manifest.prepared!);

    const reloadedStore = createLocalImageDraftStore(options);

    await expect(reloadedStore.restoreDraft('draft-opfs-missing')).rejects.toMatchObject({
      name: 'LocalImageDraftError',
      code: 'draft_not_found'
    });
  });

  it('falls back to IndexedDB file storage when OPFS is unavailable', async () => {
    const onWarning = vi.fn();
    const indexedDB = new IDBFactory();
    const navigator = createNavigator({
      estimate: async () => ({ quota: 10_000_000, usage: 0 })
    });
    const options = {
      databaseName: 'indexeddb-fallback-test',
      indexedDB,
      navigator,
      crypto: { randomUUID: () => 'draft-indexeddb' },
      onWarning
    };
    const store = createLocalImageDraftStore(options);

    const manifest = await store.saveDraft({
      fieldId: 'article.cover',
      raw: {
        blob: createBlob(['raw fallback'], { type: 'image/png' }),
        fileName: 'cover.png'
      }
    });

    expect(await store.getMode()).toBe('indexeddb');
    expect(manifest.raw?.store).toBe('indexeddb');
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'opfs_unavailable' })
    );

    const reloadedStore = createLocalImageDraftStore(options);
    const restored = await reloadedStore.restoreDraft('draft-indexeddb');

    expect(await restored?.raw?.text()).toBe('raw fallback');
    expect(restored?.recoveredSlot).toBe('raw');
  });

  it('warns once when OPFS probing throws and then falls back to IndexedDB', async () => {
    const onWarning = vi.fn();
    const store = createLocalImageDraftStore({
      databaseName: 'opfs-warning-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 }),
        getDirectory: async () => {
          throw new DOMException('OPFS disabled.', 'NotAllowedError');
        }
      }),
      onWarning
    });

    expect(await store.getMode()).toBe('indexeddb');
    expect(
      onWarning.mock.calls.filter(([warning]) => warning.code === 'opfs_unavailable')
    ).toHaveLength(1);
  });

  it('cleans expired drafts and removes their recoverable manifest', async () => {
    const indexedDB = new IDBFactory();
    const now = new Date('2026-05-15T00:00:00.000Z');
    const store = createLocalImageDraftStore({
      databaseName: 'ttl-cleanup-test',
      indexedDB,
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      }),
      crypto: { randomUUID: () => 'expired-draft' },
      now: () => now
    });

    await store.saveDraft({
      fieldId: 'profile.avatar',
      expiresAt: '2026-05-14T23:59:59.000Z',
      raw: {
        blob: createBlob(['expired bytes'], { type: 'image/png' }),
        fileName: 'expired.png'
      }
    });

    expect(await store.findRecoverableDrafts({ fieldId: 'profile.avatar' })).toHaveLength(0);

    const cleanup = await store.cleanupExpired(now);

    expect(cleanup).toEqual({
      deletedDraftIds: ['expired-draft'],
      deletedCount: 1
    });
    expect(await store.getDraft('expired-draft')).toBeNull();
    await expect(store.restoreDraft('expired-draft')).resolves.toBeNull();
  });

  it('does not restore expired drafts when restoreDraft is called directly', async () => {
    const indexedDB = new IDBFactory();
    const now = new Date('2026-05-15T00:00:00.000Z');
    const store = createLocalImageDraftStore({
      databaseName: 'direct-expired-restore-test',
      indexedDB,
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      }),
      crypto: { randomUUID: () => 'direct-expired-draft' },
      now: () => now
    });

    await store.saveDraft({
      fieldId: 'profile.avatar',
      expiresAt: '2026-05-14T23:59:59.000Z',
      raw: {
        blob: createBlob(['expired bytes'], { type: 'image/png' }),
        fileName: 'expired.png'
      }
    });

    await expect(store.restoreDraft('direct-expired-draft')).resolves.toBeNull();
    expect(await store.getDraft('direct-expired-draft')).toBeNull();
  });

  it('normalizes invalid caller-provided timestamps instead of storing corrupt manifests', async () => {
    const now = new Date('2026-05-15T00:00:00.000Z');
    const store = createLocalImageDraftStore({
      databaseName: 'invalid-input-date-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      }),
      now: () => now
    });

    const manifest = await store.saveDraft({
      fieldId: 'profile.avatar',
      createdAt: 'not-a-date',
      updatedAt: 'still-not-a-date',
      expiresAt: 'also-not-a-date',
      ttlMs: Number.NaN,
      raw: {
        blob: createBlob(['valid bytes']),
        fileName: 'valid.png'
      }
    });

    expect(manifest.createdAt).toBe('2026-05-15T00:00:00.000Z');
    expect(manifest.updatedAt).toBe('2026-05-15T00:00:00.000Z');
    expect(manifest.expiresAt).toBe('2026-05-16T00:00:00.000Z');
    expect(await store.findRecoverableDrafts({ fieldId: 'profile.avatar' })).toHaveLength(1);
  });

  it('rejects malformed caller input before writing a manifest', async () => {
    const indexedDB = new IDBFactory();
    const store = createLocalImageDraftStore({
      databaseName: 'invalid-input-test',
      indexedDB,
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      })
    });

    await expect(
      store.saveDraft({
        fieldId: '',
        raw: {
          blob: createBlob(['bytes']),
          fileName: 'avatar.png'
        }
      })
    ).rejects.toMatchObject({
      code: 'invalid_input'
    });

    await expect(
      store.saveDraft({
        fieldId: 'profile.avatar',
        phase: 'not-a-phase' as never,
        raw: {
          blob: createBlob(['bytes']),
          fileName: 'avatar.png'
        }
      })
    ).rejects.toMatchObject({
      code: 'invalid_input'
    });

    await expect(
      store.saveDraft({
        fieldId: 'profile.avatar',
        raw: {
          blob: undefined as never,
          fileName: 'avatar.png'
        }
      })
    ).rejects.toMatchObject({
      code: 'invalid_input'
    });

    await expect(
      store.saveDraft({
        fieldId: 'profile.avatar'
      })
    ).rejects.toMatchObject({
      code: 'invalid_input'
    });

    expect(await store.listDrafts({ includeExpired: true })).toEqual([]);
  });

  it('removes corrupt manifests with invalid timestamps while listing drafts', async () => {
    const indexedDB = new IDBFactory();
    const onWarning = vi.fn();
    const store = createLocalImageDraftStore({
      databaseName: 'corrupt-manifest-test',
      indexedDB,
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      }),
      onWarning
    });

    await store.getMode();

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('corrupt-manifest-test', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('manifests', 'readwrite');

    transaction.objectStore('manifests').put({
      version: 1,
      draftId: 'corrupt-draft',
      fieldId: 'profile.avatar',
      createdAt: 'not-a-date',
      updatedAt: '2026-05-15T00:00:00.000Z',
      expiresAt: '2026-05-16T00:00:00.000Z',
      phase: 'raw-captured'
    });
    await transactionDone(transaction);

    const fileTransaction = database.transaction('files', 'readwrite');

    fileTransaction.objectStore('files').put({
      key: 'image-drop-input:corrupt-draft:raw:orphan',
      blob: createBlob(['orphan bytes']),
      fileName: 'orphan.png',
      mimeType: 'image/png',
      size: 12,
      updatedAt: '2026-05-15T00:00:00.000Z'
    });
    await transactionDone(fileTransaction);

    expect(await store.listDrafts({ includeExpired: true })).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'manifest_corrupt' })
    );

    const readTransaction = database.transaction('manifests', 'readonly');
    const removed = await requestToPromise(
      readTransaction.objectStore('manifests').get('corrupt-draft')
    );

    await transactionDone(readTransaction);
    expect(removed).toBeUndefined();

    const fileReadTransaction = database.transaction('files', 'readonly');
    const removedFile = await requestToPromise(
      fileReadTransaction.objectStore('files').get('image-drop-input:corrupt-draft:raw:orphan')
    );

    await transactionDone(fileReadTransaction);
    expect(removedFile).toBeUndefined();
  });

  it('rejects saves with an actionable quota error before writing large drafts', async () => {
    const onStoragePressure = vi.fn();
    const store = createLocalImageDraftStore({
      databaseName: 'quota-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        estimate: async () => ({ quota: 100, usage: 96 })
      }),
      minAvailableBytes: 0,
      onStoragePressure
    });

    await expect(
      store.saveDraft({
        fieldId: 'product.image',
        raw: {
          blob: createBlob(['too large']),
          fileName: 'too-large.png'
        }
      })
    ).rejects.toMatchObject({
      name: 'LocalImageDraftError',
      code: 'quota_exceeded',
      message:
        'Not enough browser storage to keep this local image draft. Remove other site data or choose a smaller image.'
    });

    expect(onStoragePressure).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'quota-exceeded',
        requestedBytes: 9,
        quota: 100,
        usage: 96,
        available: 4
      })
    );
    expect(await store.listDrafts({ includeExpired: true })).toHaveLength(0);
  });

  it('keeps an existing draft manifest when a later save is rejected by quota preflight', async () => {
    let usage = 0;
    const store = createLocalImageDraftStore({
      databaseName: 'quota-existing-draft-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        estimate: async () => ({ quota: 100, usage })
      }),
      minAvailableBytes: 0
    });

    await store.saveDraft({
      draftId: 'existing-draft',
      fieldId: 'profile.avatar',
      raw: {
        blob: createBlob(['old']),
        fileName: 'old.png'
      }
    });

    usage = 99;

    await expect(
      store.saveDraft({
        draftId: 'existing-draft',
        fieldId: 'profile.avatar',
        raw: {
          blob: createBlob(['new']),
          fileName: 'new.png'
        }
      })
    ).rejects.toMatchObject({
      code: 'quota_exceeded'
    });

    const restored = await store.restoreDraft('existing-draft');

    expect(restored?.manifest.raw?.fileName).toBe('old.png');
    expect(await restored?.raw?.text()).toBe('old');
  });

  it('invalidates a prepared file when a draft raw file is replaced without a new prepared file', async () => {
    const store = createLocalImageDraftStore({
      databaseName: 'replace-raw-clears-prepared-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        estimate: async () => ({ quota: 10_000_000, usage: 0 })
      })
    });

    await store.saveDraft({
      draftId: 'replace-draft',
      fieldId: 'profile.avatar',
      productId: 'profile-1',
      raw: {
        blob: createBlob(['old raw']),
        fileName: 'old.png'
      },
      prepared: {
        blob: createBlob(['old prepared']),
        fileName: 'old.webp',
        width: 100,
        height: Number.NaN
      }
    });

    const original = await store.getDraft('replace-draft');

    expect(original?.productId).toBe('profile-1');
    expect(original?.prepared?.width).toBe(100);
    expect(original?.prepared?.height).toBeUndefined();

    const updated = await store.saveDraft({
      draftId: 'replace-draft',
      fieldId: 'profile.avatar',
      raw: {
        blob: createBlob(['new raw']),
        fileName: 'new.png'
      }
    });
    const restored = await store.restoreDraft('replace-draft');

    expect(updated.prepared).toBeUndefined();
    expect(updated.productId).toBe('profile-1');
    expect(restored?.recoveredSlot).toBe('raw');
    expect(restored?.manifest.raw?.fileName).toBe('new.png');
    expect(await restored?.recoveredFile.text()).toBe('new raw');
  });

  it('requests persistent browser storage when the browser exposes that choice', async () => {
    const persist = vi.fn(async () => true);
    const store = createLocalImageDraftStore({
      databaseName: 'persist-request-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator({
        persist
      })
    });

    await expect(store.requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('exposes a typed local draft error', () => {
    const error = new LocalImageDraftError('draft_not_found', 'Missing draft.');

    expect(isLocalImageDraftError(error)).toBe(true);
    expect(error).toMatchObject({
      name: 'LocalImageDraftError',
      code: 'draft_not_found',
      message: 'Missing draft.'
    });
  });
});
