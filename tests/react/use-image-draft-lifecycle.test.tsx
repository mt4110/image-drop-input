import '../setup';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistableImageValue } from '../../src/core/persistable-image-value';
import {
  ImageDraftLifecycleError,
  isImageDraftLifecycleError,
  useImageDraftLifecycle,
  type UseImageDraftLifecycleReturn,
  type UseImageDraftLifecycleOptions
} from '../../src/react/use-image-draft-lifecycle';

const committedImage: PersistableImageValue = {
  src: 'https://cdn.example.com/avatars/current.webp',
  key: 'avatars/current.webp',
  fileName: 'current.webp',
  mimeType: 'image/webp',
  size: 128,
  width: 64,
  height: 64
};

const nextCommittedImage: PersistableImageValue = {
  src: 'https://cdn.example.com/avatars/next.webp',
  key: 'avatars/next.webp',
  fileName: 'next.webp',
  mimeType: 'image/webp',
  size: 256,
  width: 128,
  height: 128
};

function createFile(name = 'next.webp') {
  return new File(['image bytes'], name, { type: 'image/webp' });
}

function createAbortError() {
  const error = new Error('Upload aborted.');

  error.name = 'AbortError';

  return error;
}

function createOptions(
  overrides: Partial<UseImageDraftLifecycleOptions> = {}
): UseImageDraftLifecycleOptions {
  return {
    committedValue: committedImage,
    uploadDraft: vi.fn(async () => ({
      draftKey: 'drafts/next.webp',
      fileName: 'next.webp',
      mimeType: 'image/webp',
      width: 128,
      height: 128
    })),
    commitDraft: vi.fn(async () => nextCommittedImage),
    ...overrides
  };
}

async function uploadDraft(result: { current: UseImageDraftLifecycleReturn }) {
  await act(async () => {
    await result.current.uploadForInput(createFile(), {
      fileName: 'next.webp',
      mimeType: 'image/webp'
    });
  });
}

describe('useImageDraftLifecycle', () => {
  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockReset();
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:draft-preview');
    vi.mocked(URL.revokeObjectURL).mockReset();
  });

  it('stores a draft descriptor and valueForInput after draft upload succeeds', async () => {
    const options = createOptions();
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    expect(options.uploadDraft).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        fileName: 'next.webp',
        mimeType: 'image/webp'
      })
    );
    expect(result.current.phase).toBe('draft-ready');
    expect(result.current.draft).toEqual(
      expect.objectContaining({
        draftKey: 'drafts/next.webp',
        previewSrc: 'blob:draft-preview',
        fileName: 'next.webp',
        mimeType: 'image/webp',
        size: createFile().size,
        width: 128,
        height: 128
      })
    );
    expect(result.current.valueForInput).toEqual(
      expect.objectContaining({
        key: 'drafts/next.webp',
        previewSrc: 'blob:draft-preview',
        fileName: 'next.webp'
      })
    );
    expect(result.current.previous).toEqual(committedImage);
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.canCommit).toBe(true);
    expect(result.current.canDiscard).toBe(true);
  });

  it('throws a typed error when a draft upload does not return draftKey or key', async () => {
    const onError = vi.fn();
    const options = createOptions({
      uploadDraft: vi.fn(async () => ({
        src: 'https://cdn.example.com/drafts/preview.webp'
      })),
      onError
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.uploadForInput(createFile(), {});
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(ImageDraftLifecycleError);
    expect(isImageDraftLifecycleError(caught)).toBe(true);
    expect(caught).toMatchObject({
      code: 'missing_draft_key'
    });
    expect(result.current.phase).toBe('failed');
    expect(result.current.error).toMatchObject({
      code: 'missing_draft_key'
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'missing_draft_key' }));
  });

  it('returns the current committed value when commit is called without a draft', async () => {
    const options = createOptions();
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let committed: PersistableImageValue | null = null;

    await act(async () => {
      committed = await result.current.commit();
    });

    expect(committed).toEqual(committedImage);
    expect(options.commitDraft).not.toHaveBeenCalled();
    expect(result.current.committedValue).toEqual(committedImage);
  });

  it('commits a draft with the previous committed value and clears preview-only state', async () => {
    const onCommittedValueChange = vi.fn();
    const commitDraft = vi.fn(async () => ({
      ...nextCommittedImage,
      previewSrc: 'blob:must-not-persist'
    } as PersistableImageValue));
    const options = createOptions({
      commitDraft,
      onCommittedValueChange
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let committed: PersistableImageValue | null = null;

    await uploadDraft(result);

    await act(async () => {
      committed = await result.current.commit();
    });

    expect(commitDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/next.webp'
      }),
      previous: committedImage
    });
    expect(committed).toEqual(nextCommittedImage);
    expect(committed).not.toHaveProperty('previewSrc');
    expect(onCommittedValueChange).toHaveBeenCalledWith(nextCommittedImage);
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.phase).toBe('committed');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:draft-preview');
  });

  it('keeps the previous committed value and draft when commit fails', async () => {
    const cleanupPrevious = vi.fn();
    const commitError = new Error('database transaction failed');
    const options = createOptions({
      commitDraft: vi.fn(async () => {
        throw commitError;
      }),
      cleanupPrevious
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let caught: unknown;

    await uploadDraft(result);

    await act(async () => {
      try {
        await result.current.commit();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toMatchObject({
      name: 'ImageDraftLifecycleError',
      code: 'commit_failed'
    });
    expect(result.current.committedValue).toEqual(committedImage);
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/next.webp' }));
    expect(result.current.canCommit).toBe(true);
    expect(cleanupPrevious).not.toHaveBeenCalled();
  });

  it('cleans up the previous image only after commit succeeds and does not rollback on cleanup failure', async () => {
    const cleanupError = new Error('cleanup queue unavailable');
    const onError = vi.fn();
    const cleanupPrevious = vi.fn(async () => {
      throw cleanupError;
    });
    const options = createOptions({
      cleanupPrevious,
      onError
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let committed: PersistableImageValue | null = null;

    await uploadDraft(result);

    await act(async () => {
      committed = await result.current.commit();
    });

    expect(committed).toEqual(nextCommittedImage);
    expect(cleanupPrevious).toHaveBeenCalledWith({
      previous: committedImage,
      next: nextCommittedImage
    });
    expect(result.current.committedValue).toEqual(nextCommittedImage);
    expect(result.current.phase).toBe('committed');
    expect(result.current.error).toMatchObject({
      code: 'cleanup_previous_failed'
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'cleanup_previous_failed'
      })
    );
  });

  it('does not clean up the previous image when the durable src is unchanged', async () => {
    const cleanupPrevious = vi.fn();
    const options = createOptions({
      commitDraft: vi.fn(async () => ({
        src: committedImage.src,
        fileName: 'current.webp',
        mimeType: 'image/webp'
      })),
      cleanupPrevious
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.commit();
    });

    expect(cleanupPrevious).not.toHaveBeenCalled();
    expect(result.current.committedValue).toEqual({
      src: committedImage.src,
      fileName: 'current.webp',
      mimeType: 'image/webp'
    });
  });

  it('does not call cleanupPrevious when commit fails', async () => {
    const cleanupPrevious = vi.fn();
    const options = createOptions({
      commitDraft: vi.fn(async () => {
        throw new Error('commit failed');
      }),
      cleanupPrevious
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.commit().catch(() => undefined);
    });

    expect(cleanupPrevious).not.toHaveBeenCalled();
    expect(result.current.committedValue).toEqual(committedImage);
  });

  it('deduplicates double commit calls while a commit is in flight', async () => {
    let resolveCommit: ((value: PersistableImageValue) => void) | undefined;
    const commitDraft = vi.fn(
      () =>
        new Promise<PersistableImageValue>((resolve) => {
          resolveCommit = resolve;
        })
    );
    const options = createOptions({ commitDraft });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    let firstCommit: Promise<PersistableImageValue | null>;
    let secondCommit: Promise<PersistableImageValue | null>;

    act(() => {
      firstCommit = result.current.commit();
      secondCommit = result.current.commit();
    });

    expect(commitDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommit?.(nextCommittedImage);
      await Promise.all([firstCommit, secondCommit]);
    });

    expect(result.current.committedValue).toEqual(nextCommittedImage);
    expect(result.current.draft).toBeNull();
  });

  it('rejects draft replacement and discard while commit is in flight', async () => {
    let resolveCommit: ((value: PersistableImageValue) => void) | undefined;
    const discardDraft = vi.fn(async () => undefined);
    const uploadDraftMock = vi.fn(createOptions().uploadDraft);
    const commitDraft = vi.fn(
      () =>
        new Promise<PersistableImageValue>((resolve) => {
          resolveCommit = resolve;
        })
    );
    const options = createOptions({
      uploadDraft: uploadDraftMock,
      commitDraft,
      discardDraft
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let commitPromise: Promise<PersistableImageValue | null>;

    await uploadDraft(result);

    act(() => {
      commitPromise = result.current.commit();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('committing');
    });

    await act(async () => {
      await expect(result.current.uploadForInput(createFile('blocked.webp'), {})).rejects.toMatchObject({
        code: 'commit_in_progress'
      });
      await expect(result.current.discard('manual')).rejects.toMatchObject({
        code: 'commit_in_progress'
      });
    });

    expect(uploadDraftMock).toHaveBeenCalledTimes(1);
    expect(discardDraft).not.toHaveBeenCalled();

    await act(async () => {
      resolveCommit?.(nextCommittedImage);
      await commitPromise;
    });

    expect(result.current.committedValue).toEqual(nextCommittedImage);
    expect(result.current.error).toBeNull();
  });

  it('does not discard the draft on unmount while commit is in flight', async () => {
    let resolveCommit: ((value: PersistableImageValue) => void) | undefined;
    const discardDraft = vi.fn(async () => undefined);
    const commitDraft = vi.fn(
      () =>
        new Promise<PersistableImageValue>((resolve) => {
          resolveCommit = resolve;
        })
    );
    const options = createOptions({
      commitDraft,
      discardDraft,
      autoDiscard: {
        onUnmount: true
      }
    });
    const { result, unmount } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    let commitPromise: Promise<PersistableImageValue | null>;

    act(() => {
      commitPromise = result.current.commit();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('committing');
    });

    unmount();

    await act(async () => {
      resolveCommit?.(nextCommittedImage);
      await commitPromise;
    });

    expect(discardDraft).not.toHaveBeenCalled();
  });

  it('rejects commit and draft replacement while discard is in flight', async () => {
    let resolveDiscard: (() => void) | undefined;
    const discardDraft = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDiscard = resolve;
        })
    );
    const options = createOptions({ discardDraft });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let discardPromise: Promise<void>;

    await uploadDraft(result);

    act(() => {
      discardPromise = result.current.discard('manual');
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('discarding');
    });

    await act(async () => {
      await expect(result.current.commit()).rejects.toMatchObject({
        code: 'discard_in_progress'
      });
      await expect(result.current.uploadForInput(createFile('blocked.webp'), {})).rejects.toMatchObject({
        code: 'discard_in_progress'
      });
    });

    await act(async () => {
      resolveDiscard?.();
      await discardPromise;
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.valueForInput).toEqual(committedImage);
  });

  it('rejects commit while a draft upload is still in flight', async () => {
    const options = createOptions({
      uploadDraft: vi.fn(
        () =>
          new Promise<never>(() => {
            // keep the draft upload pending
          })
      )
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    act(() => {
      void result.current.uploadForInput(createFile(), {});
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('uploading-draft');
    });

    await act(async () => {
      await expect(result.current.commit()).rejects.toMatchObject({
        code: 'draft_upload_in_progress'
      });
    });
  });

  it('rethrows upload AbortError without marking the lifecycle as failed', async () => {
    const abortError = createAbortError();
    const onError = vi.fn();
    const options = createOptions({
      uploadDraft: vi.fn(async () => {
        throw abortError;
      }),
      onError
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.uploadForInput(createFile(), {});
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBe(abortError);
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('clears a transient commit error when an in-flight draft upload later succeeds', async () => {
    let resolveUpload: ((value: { draftKey: string }) => void) | undefined;
    const options = createOptions({
      uploadDraft: vi.fn(
        () =>
          new Promise<{ draftKey: string }>((resolve) => {
            resolveUpload = resolve;
          })
      )
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadForInput(createFile(), {});
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('uploading-draft');
    });

    await act(async () => {
      await result.current.commit().catch(() => undefined);
    });

    expect(result.current.error).toMatchObject({
      code: 'draft_upload_in_progress'
    });

    await act(async () => {
      resolveUpload?.({ draftKey: 'drafts/next.webp' });
      await uploadPromise;
    });

    expect(result.current.phase).toBe('draft-ready');
    expect(result.current.error).toBeNull();
  });

  it('discards a draft with the requested reason and leaves the committed value intact', async () => {
    const discardDraft = vi.fn(async () => undefined);
    const options = createOptions({ discardDraft });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.discard('manual');
    });

    expect(discardDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/next.webp'
      }),
      reason: 'manual'
    });
    expect(result.current.draft).toBeNull();
    expect(result.current.valueForInput).toEqual(committedImage);
    expect(result.current.committedValue).toEqual(committedImage);
    expect(result.current.phase).toBe('discarded');
  });

  it('keeps a draft when user-triggered discard fails', async () => {
    const discardDraft = vi.fn(async () => {
      throw new Error('discard endpoint failed');
    });
    const options = createOptions({ discardDraft });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.discard('manual').catch(() => undefined);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/next.webp' }));
    expect(result.current.error).toMatchObject({
      code: 'discard_failed'
    });
  });

  it('discards the old draft on replace when autoDiscard.onReplace is enabled', async () => {
    const discardDraft = vi.fn(async () => undefined);
    const uploadDraftMock = vi
      .fn<UseImageDraftLifecycleOptions['uploadDraft']>()
      .mockResolvedValueOnce({ draftKey: 'drafts/first.webp' })
      .mockResolvedValueOnce({ draftKey: 'drafts/second.webp' });
    const options = createOptions({
      uploadDraft: uploadDraftMock,
      discardDraft,
      autoDiscard: {
        onReplace: true
      }
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await act(async () => {
      await result.current.uploadForInput(createFile('first.webp'), {});
      await result.current.uploadForInput(createFile('second.webp'), {});
    });

    expect(discardDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/first.webp'
      }),
      reason: 'replace'
    });
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/second.webp' }));
  });

  it('ignores stale upload results and discards them best-effort during replacement', async () => {
    let resolveFirst: ((value: { draftKey: string }) => void) | undefined;
    let resolveSecond: ((value: { draftKey: string }) => void) | undefined;
    const discardDraft = vi.fn(async () => undefined);
    const uploadDraftMock = vi
      .fn<UseImageDraftLifecycleOptions['uploadDraft']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );
    const options = createOptions({
      uploadDraft: uploadDraftMock,
      discardDraft,
      autoDiscard: {
        onReplace: true
      }
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let firstUpload: Promise<unknown>;
    let secondUpload: Promise<unknown>;

    act(() => {
      firstUpload = result.current.uploadForInput(createFile('first.webp'), {});
      secondUpload = result.current.uploadForInput(createFile('second.webp'), {});
    });

    await act(async () => {
      resolveSecond?.({ draftKey: 'drafts/second.webp' });
      await secondUpload;
    });

    await act(async () => {
      resolveFirst?.({ draftKey: 'drafts/first.webp' });
      await firstUpload;
    });

    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/second.webp' }));
    expect(discardDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/first.webp'
      }),
      reason: 'replace'
    });
  });

  it('discards a draft on reset when autoDiscard.onReset is enabled', async () => {
    const discardDraft = vi.fn(async () => undefined);
    const options = createOptions({
      discardDraft,
      autoDiscard: {
        onReset: true
      }
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    act(() => {
      result.current.resetToCommitted();
    });

    await waitFor(() => {
      expect(discardDraft).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          draftKey: 'drafts/next.webp'
        }),
        reason: 'reset'
      });
      expect(result.current.draft).toBeNull();
    });
  });

  it('keeps reset from accepting a stale in-flight draft upload', async () => {
    let resolveUpload: ((value: { draftKey: string }) => void) | undefined;
    const options = createOptions({
      uploadDraft: vi.fn(
        () =>
          new Promise<{ draftKey: string }>((resolve) => {
            resolveUpload = resolve;
          })
      )
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadForInput(createFile(), {});
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('uploading-draft');
    });

    act(() => {
      result.current.resetToCommitted();
    });

    await act(async () => {
      resolveUpload?.({ draftKey: 'drafts/stale.webp' });
      await uploadPromise;
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.draft).toBeNull();
    expect(result.current.valueForInput).toEqual(committedImage);
  });

  it('best-effort discards a stale in-flight upload after reset when configured', async () => {
    let resolveUpload: ((value: { draftKey: string }) => void) | undefined;
    const discardDraft = vi.fn(async () => undefined);
    const options = createOptions({
      uploadDraft: vi.fn(
        () =>
          new Promise<{ draftKey: string }>((resolve) => {
            resolveUpload = resolve;
          })
      ),
      discardDraft,
      autoDiscard: {
        onReset: true
      }
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));
    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadForInput(createFile(), {});
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('uploading-draft');
    });

    act(() => {
      result.current.resetToCommitted();
    });

    await act(async () => {
      resolveUpload?.({ draftKey: 'drafts/stale-reset.webp' });
      await uploadPromise;
    });

    expect(discardDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/stale-reset.webp'
      }),
      reason: 'reset'
    });
    expect(result.current.draft).toBeNull();
  });

  it('best-effort discards a stale in-flight upload on unmount when configured', async () => {
    let resolveUpload: ((value: { draftKey: string }) => void) | undefined;
    const discardDraft = vi.fn(async () => undefined);
    const options = createOptions({
      uploadDraft: vi.fn(
        () =>
          new Promise<{ draftKey: string }>((resolve) => {
            resolveUpload = resolve;
          })
      ),
      discardDraft,
      autoDiscard: {
        onUnmount: true
      }
    });
    const { result, unmount } = renderHook(() => useImageDraftLifecycle(options));
    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadForInput(createFile(), {});
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('uploading-draft');
    });

    unmount();

    await act(async () => {
      resolveUpload?.({ draftKey: 'drafts/stale-unmount.webp' });
      await uploadPromise;
    });

    expect(discardDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        draftKey: 'drafts/stale-unmount.webp'
      }),
      reason: 'unmount'
    });
  });

  it('best-effort discards a ready draft on unmount when autoDiscard.onUnmount is enabled', async () => {
    const discardDraft = vi.fn(async () => undefined);
    const options = createOptions({
      discardDraft,
      autoDiscard: {
        onUnmount: true
      }
    });
    const { result, unmount } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    unmount();

    await waitFor(() => {
      expect(discardDraft).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          draftKey: 'drafts/next.webp'
        }),
        reason: 'unmount'
      });
    });
  });
});
