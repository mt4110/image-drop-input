import '../setup';
import { describe, expect, it } from 'vitest';
import {
  assertPersistableImageValue,
  ImagePersistableValueError,
  isPersistableImageValue,
  isTemporaryImageSrc,
  toPersistableImageValue
} from '../../src/core/persistable-image-value';

describe('persistable image value guards', () => {
  it('drops previewSrc from values with a durable src', () => {
    expect(
      toPersistableImageValue({
        src: 'https://cdn.example.com/avatar.webp',
        previewSrc: 'blob:local-preview',
        fileName: 'avatar.webp',
        mimeType: 'image/webp',
        size: 123,
        width: 256,
        height: 256
      })
    ).toEqual({
      src: 'https://cdn.example.com/avatar.webp',
      fileName: 'avatar.webp',
      mimeType: 'image/webp',
      size: 123,
      width: 256,
      height: 256
    });
  });

  it('returns null for null and undefined values', () => {
    expect(toPersistableImageValue(null)).toBeNull();
    expect(toPersistableImageValue(undefined)).toBeNull();
  });

  it('treats null as an already-normalized empty persistable value', () => {
    expect(isPersistableImageValue(null)).toBe(true);
    expect(() => assertPersistableImageValue(null)).not.toThrow();
  });

  it('accepts durable src values', () => {
    expect(toPersistableImageValue({ src: '/images/avatar.webp' })).toEqual({
      src: '/images/avatar.webp'
    });
  });

  it('accepts key-only values', () => {
    expect(toPersistableImageValue({ key: 'avatars/user-1.webp' })).toEqual({
      key: 'avatars/user-1.webp'
    });
  });

  it('rejects previewSrc-only values', () => {
    expect(() => toPersistableImageValue({ previewSrc: 'blob:local-preview' })).toThrow(
      ImagePersistableValueError
    );

    expect(() => toPersistableImageValue({ previewSrc: 'blob:local-preview' })).toThrowError(
      expect.objectContaining({
        code: 'empty_reference'
      })
    );
  });

  it('rejects blob src values by default', () => {
    expect(() => toPersistableImageValue({ src: 'blob:https://example.com/123' })).toThrowError(
      expect.objectContaining({
        code: 'src_is_temporary',
        details: {
          field: 'src',
          srcProtocol: 'blob:'
        }
      })
    );
  });

  it('rejects filesystem src values by default', () => {
    expect(() =>
      toPersistableImageValue({ src: 'filesystem:https://example.com/temporary/avatar.png' })
    ).toThrowError(
      expect.objectContaining({
        code: 'src_is_temporary',
        details: {
          field: 'src',
          srcProtocol: 'filesystem:'
        }
      })
    );
  });

  it('rejects data src values by default', () => {
    expect(() => toPersistableImageValue({ src: 'data:image/png;base64,abc' })).toThrowError(
      expect.objectContaining({
        code: 'src_is_temporary',
        details: {
          field: 'src',
          srcProtocol: 'data:'
        }
      })
    );
  });

  it('allows data URLs when explicitly requested', () => {
    expect(
      toPersistableImageValue(
        { src: 'data:image/png;base64,abc' },
        { allowDataUrl: true }
      )
    ).toEqual({
      src: 'data:image/png;base64,abc'
    });
  });

  it('allows blob URLs when explicitly requested', () => {
    expect(
      toPersistableImageValue(
        { src: 'blob:https://example.com/123' },
        { allowBlobUrl: true }
      )
    ).toEqual({
      src: 'blob:https://example.com/123'
    });
  });

  it('does not allow filesystem URLs through the blob URL option', () => {
    expect(() =>
      toPersistableImageValue(
        { src: 'filesystem:https://example.com/temporary/avatar.png' },
        { allowBlobUrl: true }
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'src_is_temporary',
        details: {
          field: 'src',
          srcProtocol: 'filesystem:'
        }
      })
    );
  });

  it('allows filesystem URLs only when explicitly requested', () => {
    expect(
      toPersistableImageValue(
        { src: 'filesystem:https://example.com/temporary/avatar.png' },
        { allowFilesystemUrl: true }
      )
    ).toEqual({
      src: 'filesystem:https://example.com/temporary/avatar.png'
    });
  });

  it('rejects negative size metadata', () => {
    expect(() => toPersistableImageValue({ key: 'avatars/user-1.webp', size: -1 })).toThrowError(
      expect.objectContaining({
        code: 'invalid_metadata',
        details: {
          field: 'size'
        }
      })
    );
  });

  it('rejects zero width metadata', () => {
    expect(() => toPersistableImageValue({ key: 'avatars/user-1.webp', width: 0 })).toThrowError(
      expect.objectContaining({
        code: 'invalid_metadata',
        details: {
          field: 'width'
        }
      })
    );
  });

  it('strips undefined properties by default', () => {
    expect(
      toPersistableImageValue({
        src: 'https://cdn.example.com/avatar.webp',
        key: undefined,
        fileName: undefined
      })
    ).toEqual({
      src: 'https://cdn.example.com/avatar.webp'
    });
  });

  it('keeps undefined properties when stripUndefined is false', () => {
    const value = toPersistableImageValue(
      {
        src: 'https://cdn.example.com/avatar.webp',
        key: undefined,
        fileName: undefined
      },
      { stripUndefined: false }
    );

    expect(value).toHaveProperty('src', 'https://cdn.example.com/avatar.webp');
    expect(value).toHaveProperty('key', undefined);
    expect(value).toHaveProperty('fileName', undefined);
  });

  it('returns false for invalid persistable values', () => {
    expect(isPersistableImageValue({ src: 'blob:local-preview' })).toBe(false);
    expect(isPersistableImageValue(undefined)).toBe(false);
    expect(
      isPersistableImageValue({
        src: 'https://cdn.example.com/avatar.webp',
        previewSrc: 'blob:local-preview'
      })
    ).toBe(false);
    expect(isPersistableImageValue({ key: 'avatars/user-1.webp' })).toBe(true);
  });

  it('throws a typed error from assertPersistableImageValue', () => {
    expect(() => assertPersistableImageValue({ src: 'data:image/png;base64,abc' })).toThrow(
      ImagePersistableValueError
    );
  });

  it('rejects undefined from assertPersistableImageValue before narrowing', () => {
    expect(() => assertPersistableImageValue(undefined)).toThrowError(
      expect.objectContaining({
        code: 'empty_reference'
      })
    );
  });

  it('rejects previewSrc from assertPersistableImageValue because it does not sanitize', () => {
    expect(() =>
      assertPersistableImageValue({
        src: 'https://cdn.example.com/avatar.webp',
        previewSrc: 'blob:local-preview'
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'preview_src_not_persistable',
        details: {
          field: 'previewSrc'
        }
      })
    );
  });

  it('identifies temporary image sources without requiring URL parsing', () => {
    expect(isTemporaryImageSrc('blob:https://example.com/123')).toBe(true);
    expect(isTemporaryImageSrc('filesystem:https://example.com/temporary/avatar.png')).toBe(true);
    expect(isTemporaryImageSrc('data:image/png;base64,abc')).toBe(true);
    expect(isTemporaryImageSrc('https://cdn.example.com/avatar.webp')).toBe(false);
    expect(isTemporaryImageSrc('/images/avatar.webp')).toBe(false);
    expect(isTemporaryImageSrc('//cdn.example.com/avatar.webp')).toBe(false);
    expect(isTemporaryImageSrc('')).toBe(false);
  });
});
