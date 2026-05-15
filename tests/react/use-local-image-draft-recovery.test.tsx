import '../setup';
import { Blob as NodeBlob } from 'node:buffer';
import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalImageDraftStore,
  type LocalImageDraftManifest,
  type LocalImageDraftStore
} from '../../src/core/local-image-draft-store';
import { useLocalImageDraftRecovery } from '../../src/react/use-local-image-draft-recovery';

function createNavigator(): Navigator {
  return {
    storage: {
      estimate: async () => ({ quota: 10_000_000, usage: 0 })
    }
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

describe('useLocalImageDraftRecovery', () => {
  it('surfaces a recoverable draft and exposes restore/discard actions for a banner UI', async () => {
    const store = createLocalImageDraftStore({
      databaseName: 'recovery-hook-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator(),
      crypto: { randomUUID: () => 'recoverable-draft' }
    });

    await store.saveDraft({
      fieldId: 'profile.avatar',
      productId: 'profile-1',
      raw: {
        blob: createBlob(['recovered image'], { type: 'image/png' }),
        fileName: 'avatar.png'
      }
    });

    const onRestored = vi.fn();
    const onDiscarded = vi.fn();
    const { result } = renderHook(() =>
      useLocalImageDraftRecovery({
        fieldId: 'profile.avatar',
        productId: 'profile-1',
        store,
        onRestored,
        onDiscarded
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    expect(result.current.draft?.draftId).toBe('recoverable-draft');
    expect(result.current.canRestore).toBe(true);
    expect(result.current.canDiscard).toBe(true);

    await act(async () => {
      const restored = await result.current.restore();

      expect(await restored?.recoveredFile.text()).toBe('recovered image');
    });

    expect(result.current.status).toBe('restored');
    expect(onRestored).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveredSlot: 'raw',
        manifest: expect.objectContaining({ draftId: 'recoverable-draft' })
      })
    );

    await act(async () => {
      await result.current.discard('recoverable-draft');
    });

    expect(result.current.status).toBe('discarded');
    expect(result.current.draft).toBeNull();
    expect(onDiscarded).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'recoverable-draft' })
    );
    expect(await store.getDraft('recoverable-draft')).toBeNull();
  });

  it('cleans expired drafts before offering recovery', async () => {
    const store = createLocalImageDraftStore({
      databaseName: 'recovery-hook-expired-test',
      indexedDB: new IDBFactory(),
      navigator: createNavigator(),
      now: () => new Date('2026-05-15T00:00:00.000Z'),
      crypto: { randomUUID: () => 'expired-draft' }
    });

    await store.saveDraft({
      fieldId: 'profile.avatar',
      expiresAt: '2026-05-14T23:59:59.000Z',
      raw: {
        blob: createBlob(['expired image'], { type: 'image/png' }),
        fileName: 'expired.png'
      }
    });

    const { result } = renderHook(() =>
      useLocalImageDraftRecovery({
        fieldId: 'profile.avatar',
        store
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('empty');
    });

    expect(result.current.drafts).toEqual([]);
    expect(await store.getDraft('expired-draft')).toBeNull();
  });

  it('keeps remaining drafts available when a selected restore disappears', async () => {
    const now = '2026-05-15T00:00:00.000Z';
    const later = '2026-05-16T00:00:00.000Z';
    const firstDraft: LocalImageDraftManifest = {
      version: 1,
      draftId: 'first-draft',
      fieldId: 'profile.avatar',
      createdAt: now,
      updatedAt: now,
      expiresAt: later,
      phase: 'raw-captured',
      raw: {
        store: 'indexeddb',
        pathOrKey: 'first',
        fileName: 'first.png',
        mimeType: 'image/png',
        size: 1
      }
    };
    const secondDraft: LocalImageDraftManifest = {
      ...firstDraft,
      draftId: 'second-draft',
      raw: {
        ...firstDraft.raw!,
        pathOrKey: 'second',
        fileName: 'second.png'
      }
    };
    const store: LocalImageDraftStore = {
      getMode: vi.fn(async () => 'indexeddb' as const),
      estimateStorage: vi.fn(async () => null),
      requestPersistentStorage: vi.fn(async () => null),
      saveDraft: vi.fn(async () => firstDraft),
      getDraft: vi.fn(async () => null),
      listDrafts: vi.fn(async () => []),
      cleanupExpired: vi.fn(async () => ({ deletedDraftIds: [], deletedCount: 0 })),
      restoreDraft: vi.fn(async () => null),
      discardDraft: vi.fn(async () => undefined),
      findRecoverableDrafts: vi.fn(async () => [firstDraft, secondDraft])
    };
    const { result } = renderHook(() =>
      useLocalImageDraftRecovery({
        fieldId: 'profile.avatar',
        store
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    await act(async () => {
      await result.current.restore('first-draft');
    });

    expect(result.current.status).toBe('available');
    expect(result.current.drafts.map((draft) => draft.draftId)).toEqual(['second-draft']);
    expect(result.current.canRestore).toBe(true);
    expect(result.current.canDiscard).toBe(true);
  });

  it('ignores stale refresh results when field filters change', async () => {
    const now = '2026-05-15T00:00:00.000Z';
    const later = '2026-05-16T00:00:00.000Z';
    const firstDraft: LocalImageDraftManifest = {
      version: 1,
      draftId: 'first-draft',
      fieldId: 'first.avatar',
      createdAt: now,
      updatedAt: now,
      expiresAt: later,
      phase: 'raw-captured',
      raw: {
        store: 'indexeddb',
        pathOrKey: 'first',
        fileName: 'first.png',
        mimeType: 'image/png',
        size: 1
      }
    };
    const secondDraft: LocalImageDraftManifest = {
      ...firstDraft,
      draftId: 'second-draft',
      fieldId: 'second.avatar',
      raw: {
        ...firstDraft.raw!,
        pathOrKey: 'second',
        fileName: 'second.png'
      }
    };
    const pendingFinds: Array<{
      fieldId?: string;
      resolve: (drafts: LocalImageDraftManifest[]) => void;
    }> = [];
    const store: LocalImageDraftStore = {
      getMode: vi.fn(async () => 'indexeddb' as const),
      estimateStorage: vi.fn(async () => null),
      requestPersistentStorage: vi.fn(async () => null),
      saveDraft: vi.fn(async () => firstDraft),
      getDraft: vi.fn(async () => null),
      listDrafts: vi.fn(async () => []),
      cleanupExpired: vi.fn(async () => ({ deletedDraftIds: [], deletedCount: 0 })),
      restoreDraft: vi.fn(async () => null),
      discardDraft: vi.fn(async () => undefined),
      findRecoverableDrafts: vi.fn(
        (options) =>
          new Promise<LocalImageDraftManifest[]>((resolve) => {
            pendingFinds.push({
              fieldId: options?.fieldId,
              resolve
            });
          })
      )
    };
    const { result, rerender } = renderHook(
      ({ fieldId }) =>
        useLocalImageDraftRecovery({
          fieldId,
          store
        }),
      {
        initialProps: {
          fieldId: 'first.avatar'
        }
      }
    );

    await waitFor(() => {
      expect(pendingFinds).toHaveLength(1);
    });

    rerender({ fieldId: 'second.avatar' });

    await waitFor(() => {
      expect(pendingFinds).toHaveLength(2);
    });

    await act(async () => {
      pendingFinds[1].resolve([secondDraft]);
    });

    await waitFor(() => {
      expect(result.current.draft?.draftId).toBe('second-draft');
    });

    await act(async () => {
      pendingFinds[0].resolve([firstDraft]);
    });

    expect(result.current.draft?.draftId).toBe('second-draft');
  });
});
