import '../setup';
import { describe, expect, it } from 'vitest';
import {
  ImageValidationError,
  isImageValidationError,
  validateImage
} from '../../src/core/validate-image';

const imageFile = new File(['hello'], 'avatar.png', { type: 'image/png' });
const webpFile = new File(['hello'], 'avatar.webp', { type: 'image/webp' });
const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });

describe('validateImage', () => {
  it('rejects files outside the accepted mime types', async () => {
    await expect(validateImage(imageFile, { accept: 'image/jpeg' })).rejects.toThrow(
      'Accepted file types'
    );
  });

  it('adds a stable code and details for invalid file types', async () => {
    await expect(validateImage(imageFile, { accept: 'image/jpeg,.webp' })).rejects.toMatchObject({
      code: 'invalid_type',
      details: {
        accept: 'image/jpeg,.webp',
        acceptRules: ['image/jpeg', '.webp'],
        formattedAccept: 'JPEG, WebP',
        mimeType: 'image/png'
      }
    });
  });

  it('accepts WebP files when WebP is listed in the accept rules', async () => {
    await expect(
      validateImage(webpFile, { accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp' })
    ).resolves.toBeNull();
  });

  it('keeps mixed accept labels readable when image wildcards are combined with extensions', async () => {
    await expect(validateImage(textFile, { accept: 'image/*,.heic' })).rejects.toThrow(
      'Accepted file types: image files, HEIC.'
    );
  });

  it('rejects files that exceed the byte limit', async () => {
    await expect(validateImage(imageFile, { maxBytes: 2 })).rejects.toThrow('smaller than');
  });

  it('adds a stable code and details for byte-limit failures', async () => {
    await expect(validateImage(imageFile, { maxBytes: 2 })).rejects.toMatchObject({
      code: 'file_too_large',
      details: {
        actualBytes: imageFile.size,
        maxBytes: 2,
        mimeType: 'image/png'
      }
    });
  });

  it('rejects files that are smaller than the required dimensions', async () => {
    await expect(
      validateImage(imageFile, {
        minWidth: 800,
        minHeight: 600,
        getMetadata: async () => ({
          width: 640,
          height: 480,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toThrow('at least 800px wide');
  });

  it('adds a stable code and details for minimum dimension failures', async () => {
    await expect(
      validateImage(imageFile, {
        minHeight: 600,
        getMetadata: async () => ({
          width: 640,
          height: 480,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toMatchObject({
      code: 'image_too_small',
      details: {
        actualHeight: 480,
        actualWidth: 640,
        minHeight: 600,
        mimeType: 'image/png'
      }
    });
  });

  it('rejects files that exceed the maximum dimensions', async () => {
    await expect(
      validateImage(imageFile, {
        maxWidth: 1000,
        maxHeight: 800,
        getMetadata: async () => ({
          width: 1200,
          height: 900,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toThrow('no wider than 1000px');
  });

  it('adds a stable code and details for maximum dimension failures', async () => {
    await expect(
      validateImage(imageFile, {
        maxHeight: 800,
        getMetadata: async () => ({
          width: 1200,
          height: 900,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toMatchObject({
      code: 'image_too_large',
      details: {
        actualHeight: 900,
        actualWidth: 1200,
        maxHeight: 800,
        mimeType: 'image/png'
      }
    });
  });

  it('rejects files that exceed the maximum pixel budget', async () => {
    await expect(
      validateImage(imageFile, {
        maxPixels: 1_000_000,
        getMetadata: async () => ({
          width: 1400,
          height: 900,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toThrow('no larger than 1 megapixel');
  });

  it('adds a stable code and details for pixel budget failures', async () => {
    await expect(
      validateImage(imageFile, {
        maxPixels: 1_000_000,
        getMetadata: async () => ({
          width: 1400,
          height: 900,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).rejects.toMatchObject({
      code: 'too_many_pixels',
      details: {
        actualHeight: 900,
        actualPixels: 1_260_000,
        actualWidth: 1400,
        maxPixels: 1_000_000,
        mimeType: 'image/png'
      }
    });
  });

  it('wraps metadata decode failures in a localizable validation error', async () => {
    const cause = new Error('decode exploded');

    await expect(
      validateImage(imageFile, {
        minWidth: 1,
        getMetadata: async () => {
          throw cause;
        }
      })
    ).rejects.toMatchObject({
      code: 'decode_failed',
      details: {
        actualBytes: imageFile.size,
        mimeType: 'image/png'
      },
      message: 'Unable to read image dimensions.'
    });
  });

  it('exposes a runtime guard for validation errors', async () => {
    try {
      await validateImage(imageFile, { maxBytes: 2 });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageValidationError);
      expect(isImageValidationError(error)).toBe(true);

      if (!isImageValidationError(error)) {
        throw new Error('Expected image validation error.');
      }

      expect(error.code).toBe('file_too_large');
      expect(error.details.maxBytes).toBe(2);
    }
  });

  it('recognizes structurally equivalent validation errors from another module copy', () => {
    expect(
      isImageValidationError({
        name: 'ImageValidationError',
        code: 'file_too_large',
        details: {
          actualBytes: 12,
          maxBytes: 2
        },
        message: 'File is too large.'
      })
    ).toBe(true);

    expect(
      isImageValidationError({
        name: 'ImageValidationError',
        code: 'unknown_error',
        message: 'Unknown.',
        details: {}
      })
    ).toBe(false);

    expect(
      isImageValidationError({
        name: 'ImageValidationError',
        code: 'file_too_large',
        details: {}
      })
    ).toBe(false);

    expect(
      isImageValidationError({
        name: 'ImageValidationError',
        code: 'file_too_large',
        details: [],
        message: 'File is too large.'
      })
    ).toBe(false);
  });

  it('returns image metadata when the file passes validation', async () => {
    await expect(
      validateImage(imageFile, {
        accept: 'image/*',
        maxBytes: 12,
        maxWidth: 1400,
        maxHeight: 1200,
        maxPixels: 2_000_000,
        minWidth: 200,
        minHeight: 200,
        getMetadata: async () => ({
          width: 1200,
          height: 900,
          size: imageFile.size,
          mimeType: imageFile.type
        })
      })
    ).resolves.toEqual({
      width: 1200,
      height: 900,
      size: imageFile.size,
      mimeType: imageFile.type
    });
  });
});
