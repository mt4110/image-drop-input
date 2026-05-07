import '../setup';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistableImageValue } from '../../src/core/persistable-image-value';
import {
  useImageDraftLifecycle,
  type UseImageDraftLifecycleOptions,
  type UseImageDraftLifecycleReturn
} from '../../src/react/use-image-draft-lifecycle';

const previousImage: PersistableImageValue = {
  src: 'https://cdn.example.com/products/previous.webp',
  key: 'products/previous.webp',
  fileName: 'previous.webp',
  mimeType: 'image/webp',
  size: 128,
  width: 64,
  height: 64
};

const nextImage: PersistableImageValue = {
  src: 'https://cdn.example.com/products/next.webp',
  key: 'products/next.webp',
  fileName: 'next.webp',
  mimeType: 'image/webp',
  size: 256,
  width: 128,
  height: 128
};

function createFile(name = 'next.webp') {
  return new File(['image bytes'], name, { type: 'image/webp' });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createOptions(
  overrides: Partial<UseImageDraftLifecycleOptions> = {}
): UseImageDraftLifecycleOptions {
  return {
    committedValue: previousImage,
    uploadDraft: vi.fn(async () => ({
      draftKey: 'drafts/next.webp',
      fileName: 'next.webp',
      mimeType: 'image/webp',
      width: 128,
      height: 128
    })),
    commitDraft: vi.fn(async () => nextImage),
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

describe('draft lifecycle model invariants', () => {
  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockReset();
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:model-draft-preview');
    vi.mocked(URL.revokeObjectURL).mockReset();
  });

  it('keeps the committed value authoritative through draft upload and failed commit', async () => {
    const commitError = new Error('product transaction failed');
    const cleanupPrevious = vi.fn();
    const options = createOptions({
      commitDraft: vi.fn(async () => {
        throw commitError;
      }),
      cleanupPrevious
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    expect(result.current.phase).toBe('draft-ready');
    expect(result.current.committedValue).toEqual(previousImage);
    expect(result.current.previous).toEqual(previousImage);
    expect(result.current.valueForInput).toEqual(
      expect.objectContaining({
        key: 'drafts/next.webp',
        previewSrc: 'blob:model-draft-preview'
      })
    );

    await act(async () => {
      await result.current.commit().catch(() => undefined);
    });

    expect(options.commitDraft).toHaveBeenCalledWith({
      draft: expect.objectContaining({ draftKey: 'drafts/next.webp' }),
      previous: previousImage
    });
    expect(result.current.phase).toBe('failed');
    expect(result.current.committedValue).toEqual(previousImage);
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/next.webp' }));
    expect(result.current.canCommit).toBe(true);
    expect(result.current.canDiscard).toBe(true);
    expect(cleanupPrevious).not.toHaveBeenCalled();
  });

  it('runs previous cleanup only after the commit response becomes persistable', async () => {
    const commit = createDeferred<PersistableImageValue>();
    const cleanupPrevious = vi.fn(async () => undefined);
    const options = createOptions({
      commitDraft: vi.fn(() => commit.promise),
      cleanupPrevious
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

    expect(result.current.committedValue).toEqual(previousImage);
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/next.webp' }));
    expect(cleanupPrevious).not.toHaveBeenCalled();

    await act(async () => {
      commit.resolve(nextImage);
      await commitPromise;
    });

    expect(result.current.phase).toBe('committed');
    expect(result.current.committedValue).toEqual(nextImage);
    expect(result.current.draft).toBeNull();
    expect(cleanupPrevious).toHaveBeenCalledWith({
      previous: previousImage,
      next: nextImage
    });
  });

  it('treats draft keys as temporary until the commit response returns a durable key', async () => {
    const durableImage: PersistableImageValue = {
      ...nextImage,
      key: 'products/final.webp',
      src: 'https://cdn.example.com/products/final.webp'
    };
    const options = createOptions({
      commitDraft: vi.fn(async () => durableImage)
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    expect(result.current.valueForInput).toEqual(
      expect.objectContaining({
        key: 'drafts/next.webp'
      })
    );
    expect(result.current.committedValue).toEqual(previousImage);

    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.valueForInput).toEqual(durableImage);
    expect(result.current.committedValue).toEqual(durableImage);
    expect(result.current.committedValue?.key).toBe('products/final.webp');
  });

  it('does not roll back the new committed value when previous cleanup fails', async () => {
    const cleanupError = new Error('cleanup queue unavailable');
    const onError = vi.fn();
    const options = createOptions({
      cleanupPrevious: vi.fn(async () => {
        throw cleanupError;
      }),
      onError
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.phase).toBe('committed');
    expect(result.current.committedValue).toEqual(nextImage);
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toMatchObject({
      code: 'cleanup_previous_failed'
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'cleanup_previous_failed'
      })
    );
  });

  it('keeps a failed discard recoverable and leaves committed value unchanged', async () => {
    const options = createOptions({
      discardDraft: vi.fn(async () => {
        throw new Error('discard failed');
      })
    });
    const { result } = renderHook(() => useImageDraftLifecycle(options));

    await uploadDraft(result);

    await act(async () => {
      await result.current.discard('manual').catch(() => undefined);
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.committedValue).toEqual(previousImage);
    expect(result.current.valueForInput).toEqual(
      expect.objectContaining({
        key: 'drafts/next.webp'
      })
    );
    expect(result.current.draft).toEqual(expect.objectContaining({ draftKey: 'drafts/next.webp' }));
    expect(result.current.canCommit).toBe(true);
    expect(result.current.canDiscard).toBe(true);
    expect(result.current.error).toMatchObject({
      code: 'discard_failed'
    });
  });
});
