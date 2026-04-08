import '../setup';
import { describe, expect, it } from 'vitest';
import { validateImage } from '../../src/core/validate-image';

const imageFile = new File(['hello'], 'avatar.png', { type: 'image/png' });

describe('validateImage', () => {
  it('rejects files outside the accepted mime types', async () => {
    await expect(validateImage(imageFile, { accept: 'image/jpeg' })).rejects.toThrow(
      'Accepted file types'
    );
  });

  it('rejects files that exceed the byte limit', async () => {
    await expect(validateImage(imageFile, { maxBytes: 2 })).rejects.toThrow('smaller than');
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
