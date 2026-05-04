import '../setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImageBudgetError,
  isImageBudgetError,
  prepareImageToBudget,
  type ImageBudgetAttempt
} from '../../src/core/prepare-image-to-budget';

describe('prepareImageToBudget', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  const originalImage = globalThis.Image;

  let decodedWidth = 1000;
  let decodedHeight = 800;
  let close: ReturnType<typeof vi.fn>;

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
        drawImage
      } as unknown as OffscreenCanvasRenderingContext2D;
    }

    convertToBlob(options?: ImageEncodeOptions) {
      const type = options?.type ?? 'image/png';
      const quality = options?.quality ?? 1;
      const typeFactor = type === 'image/png' ? 0.64 : type === 'image/webp' ? 0.24 : 0.35;
      const qualityFactor = type === 'image/png' ? 1 : Math.max(0.2, quality);
      const size = Math.max(16, Math.ceil(this.width * this.height * typeFactor * qualityFactor));

      return Promise.resolve(new Blob([new Uint8Array(size)], { type }));
    }
  }

  beforeEach(() => {
    decodedWidth = 1000;
    decodedHeight = 800;
    close = vi.fn();
    drawImage.mockReset();

    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn(async () => ({
        width: decodedWidth,
        height: decodedHeight,
        close
      }))
    });
    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: MockOffscreenCanvas
    });
  });

  afterEach(() => {
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

    if (typeof originalImage !== 'undefined') {
      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        value: originalImage
      });
    } else {
      Reflect.deleteProperty(globalThis, 'Image');
    }
  });

  it('returns the source when it already satisfies the byte and dimension budget', async () => {
    decodedWidth = 640;
    decodedHeight = 480;

    const source = new File(['small'], 'avatar.webp', { type: 'image/webp' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 100,
      maxWidth: 800,
      maxHeight: 800
    });

    expect(result.file).toBe(source);
    expect(result.fileName).toBe('avatar.webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.size).toBe(source.size);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.originalFileName).toBe('avatar.webp');
    expect(result.originalMimeType).toBe('image/webp');
    expect(result.compressionRatio).toBe(1);
    expect(result.attempts).toEqual([]);
    expect(result.strategy).toBe('source-within-budget');
    expect(drawImage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('normalizes the output file extension when the source name and MIME type disagree', async () => {
    decodedWidth = 640;
    decodedHeight = 480;

    const source = new File(['small'], 'avatar.png', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 100
    });

    expect(result.file).toBe(source);
    expect(result.fileName).toBe('avatar.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.strategy).toBe('source-within-budget');
  });

  it('keeps an explicit output fileName as-is while reporting the encoded MIME type', async () => {
    const source = new File([new Uint8Array(600_000)], 'avatar.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 300_000,
      outputType: 'image/webp',
      fileName: 'avatar.custom-name'
    });

    expect(result.fileName).toBe('avatar.custom-name');
    expect(result.mimeType).toBe('image/webp');
    expect(result.file.type).toBe('image/webp');
    expect(result.size).toBeLessThanOrEqual(300_000);
  });

  it('converts to WebP and reports matching output metadata', async () => {
    const source = new File([new Uint8Array(600_000)], 'avatar.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 300_000,
      outputType: 'image/webp',
      maxWidth: 800,
      maxHeight: 800
    });

    expect(result.file).toBeInstanceOf(Blob);
    expect(result.file).not.toBe(source);
    expect(result.fileName).toBe('avatar.webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.file.type).toBe('image/webp');
    expect(result.size).toBeLessThanOrEqual(300_000);
    expect(result.width).toBe(800);
    expect(result.height).toBe(640);
    expect(result.strategy).toBe('resize-and-quality-search');
    expect(result.attempts[0]).toMatchObject({
      attempt: 1,
      width: 800,
      height: 640,
      quality: 0.86,
      mimeType: 'image/webp',
      withinBudget: true,
      strategy: 'resize-and-quality-search'
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not upscale when max dimensions are larger than the source', async () => {
    const source = new File([new Uint8Array(600_000)], 'cover.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 300_000,
      outputType: 'image/webp',
      maxWidth: 2000,
      maxHeight: 2000
    });

    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1000, 800);
  });

  it('keeps nameless Blob originalFileName independent from policy fileName', async () => {
    const source = new Blob([new Uint8Array(600_000)], { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 300_000,
      outputType: 'image/webp',
      fileName: 'prepared-avatar.webp'
    });

    expect(result.fileName).toBe('prepared-avatar.webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.originalFileName).toBe('image.jpg');
    expect(result.originalMimeType).toBe('image/jpeg');
  });

  it('searches quality deterministically when the first lossy encode is too large', async () => {
    const source = new File([new Uint8Array(800_000)], 'cover.jpg', { type: 'image/jpeg' });
    const policy = {
      outputMaxBytes: 210_000,
      outputType: 'image/jpeg' as const,
      initialQuality: 0.9,
      minQuality: 0.4,
      maxEncodeAttempts: 7
    };

    const first = await prepareImageToBudget(source, policy);
    const second = await prepareImageToBudget(source, policy);

    expect(first.size).toBeLessThanOrEqual(policy.outputMaxBytes);
    expect(first.size).toBe(second.size);
    expect(first.strategy).toBe(second.strategy);
    expect(first.strategy).toBe('quality-search');
    expect(first.attempts.map(({ height, width, quality, size, withinBudget }) => ({
      height,
      width,
      quality,
      size,
      withinBudget
    }))).toEqual(
      second.attempts.map(({ height, width, quality, size, withinBudget }) => ({
        height,
        width,
        quality,
        size,
        withinBudget
      }))
    );
    expect(first.attempts.length).toBeGreaterThan(2);
    expect(first.attempts[0]).toMatchObject({ quality: 0.9, withinBudget: false });
    expect(first.attempts[1]).toMatchObject({ quality: 0.4, withinBudget: true });
  });

  it('uses WebP quality search before resizing when lower quality can reach the budget', async () => {
    const source = new File([new Uint8Array(800_000)], 'cover.webp', { type: 'image/webp' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 130_000,
      outputType: 'image/webp',
      initialQuality: 0.9,
      minQuality: 0.6,
      maxEncodeAttempts: 8
    });

    expect(result.size).toBeLessThanOrEqual(130_000);
    expect(result.strategy).toBe('quality-search');
    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
    expect(result.attempts[0]).toMatchObject({
      mimeType: 'image/webp',
      quality: 0.9,
      withinBudget: false,
      strategy: 'quality-search'
    });
    expect(result.attempts[1]).toMatchObject({
      mimeType: 'image/webp',
      quality: 0.6,
      withinBudget: true,
      strategy: 'quality-search'
    });
    expect(
      result.attempts.every((attempt) => attempt.width === 1000 && attempt.height === 800)
    ).toBe(true);
  });

  it('resizes when minimum lossy quality cannot reach the budget', async () => {
    const source = new File([new Uint8Array(900_000)], 'cover.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 100_000,
      outputType: 'image/jpeg',
      initialQuality: 0.9,
      minQuality: 0.4,
      maxEncodeAttempts: 8,
      resizeStepRatio: 0.5
    });

    expect(result.size).toBeLessThanOrEqual(100_000);
    expect(result.strategy).toBe('resize-and-quality-search');
    expect(result.width).toBeLessThan(1000);
    expect(result.height).toBeLessThan(800);
    expect(result.attempts.some((attempt) => attempt.width < 1000)).toBe(true);
  });

  it('uses resize-only attempts for PNG output', async () => {
    const source = new File([new Uint8Array(900_000)], 'icon.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 130_000,
      outputType: 'image/png',
      maxEncodeAttempts: 5,
      resizeStepRatio: 0.5
    });

    expect(result.fileName).toBe('icon.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBeLessThanOrEqual(130_000);
    expect(result.strategy).toBe('resize');
    expect(result.attempts.every((attempt) => typeof attempt.quality === 'undefined')).toBe(true);
    expect(result.attempts.every((attempt) => attempt.strategy === 'resize')).toBe(true);
  });

  it('clamps rounded max dimensions so the prepared image does not exceed policy max', async () => {
    decodedWidth = 201;
    decodedHeight = 100;

    const source = new File([new Uint8Array(500_000)], 'wide.jpg', { type: 'image/jpeg' });
    const result = await prepareImageToBudget(source, {
      outputMaxBytes: 250_000,
      outputType: 'image/jpeg',
      maxWidth: 100.6
    });

    expect(result.width).toBe(100);
    expect(result.width).toBeLessThanOrEqual(100.6);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 50);
  });

  it('does not return or encode an image when the minimum dimensions are unreachable', async () => {
    decodedWidth = 300;
    decodedHeight = 200;

    const source = new File(['small'], 'avatar.webp', { type: 'image/webp' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100,
        minWidth: 400
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'budget_unreachable',
      details: {
        attempts: []
      }
    });

    expect(drawImage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects max constraints that force the fitted image below minimum dimensions', async () => {
    decodedWidth = 1000;
    decodedHeight = 100;

    const source = new File([new Uint8Array(500_000)], 'wide.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 250_000,
        maxWidth: 200,
        minHeight: 80
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'budget_unreachable',
      details: {
        minHeight: 80,
        attempts: []
      }
    });

    expect(drawImage).not.toHaveBeenCalled();
  });

  it('throws budget_unreachable with bounded attempts when the budget cannot be reached', async () => {
    const source = new File([new Uint8Array(900_000)], 'cover.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 20,
        outputType: 'image/jpeg',
        initialQuality: 0.9,
        minQuality: 0.4,
        maxEncodeAttempts: 3,
        minWidth: 900,
        minHeight: 700
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'budget_unreachable',
      details: {
        outputMaxBytes: 20,
        minWidth: 900,
        minHeight: 700
      }
    });

    try {
      await prepareImageToBudget(source, {
        outputMaxBytes: 20,
        outputType: 'image/jpeg',
        initialQuality: 0.9,
        minQuality: 0.4,
        maxEncodeAttempts: 3,
        minWidth: 900,
        minHeight: 700
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ImageBudgetError);
      expect(isImageBudgetError(error)).toBe(true);
      expect((error as ImageBudgetError).details.attempts).toHaveLength(3);
      expect(
        (error as ImageBudgetError).details.attempts?.every((attempt: ImageBudgetAttempt) => {
          return attempt.width >= 900 && attempt.height >= 700;
        })
      ).toBe(true);
    }
  });

  it('rejects invalid policies before decoding', async () => {
    const source = new File(['small'], 'avatar.webp', { type: 'image/webp' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100.5
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'invalid_policy'
    });
    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100,
        maxWidth: 0.5
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'invalid_policy'
    });
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects malformed runtime policy values before decoding', async () => {
    const source = new File(['small'], 'avatar.webp', { type: 'image/webp' });

    await expect(prepareImageToBudget(source, null as never)).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'invalid_policy'
    });
    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100,
        outputType: 42 as never
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'invalid_policy'
    });
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects unsupported output MIME types', async () => {
    const source = new File(['small'], 'avatar.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100,
        outputType: 'image/avif' as 'image/webp'
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'unsupported_output_type'
    });
    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 100,
        outputType: '' as 'image/webp'
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'unsupported_output_type',
      message: 'Unsupported image output type: (empty).'
    });
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects browser encoder fallbacks that return a different MIME type', async () => {
    class FallbackOffscreenCanvas extends MockOffscreenCanvas {
      convertToBlob() {
        return Promise.resolve(new Blob(['fallback'], { type: 'image/png' }));
      }
    }

    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: FallbackOffscreenCanvas
    });

    const source = new File([new Uint8Array(500_000)], 'avatar.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 250_000,
        outputType: 'image/webp'
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'unsupported_output_type'
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('wraps canvas encoding failures in ImageBudgetError', async () => {
    class RejectingOffscreenCanvas extends MockOffscreenCanvas {
      convertToBlob() {
        return Promise.reject(new Error('encoder unavailable'));
      }
    }

    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: RejectingOffscreenCanvas
    });

    const source = new File([new Uint8Array(500_000)], 'avatar.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 250_000,
        outputType: 'image/webp'
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'encode_failed',
      details: {
        attempts: []
      }
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('wraps image decoding failures in ImageBudgetError', async () => {
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('not an image');
      })
    });
    Reflect.deleteProperty(globalThis, 'Image');

    const source = new File(['not an image'], 'avatar.jpg', { type: 'image/jpeg' });

    await expect(
      prepareImageToBudget(source, {
        outputMaxBytes: 250_000,
        outputType: 'image/webp'
      })
    ).rejects.toMatchObject({
      name: 'ImageBudgetError',
      code: 'decode_failed'
    });
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('narrows ImageBudgetError-like values without relying on instanceof', () => {
    expect(
      isImageBudgetError({
        name: 'ImageBudgetError',
        message: 'Unable to prepare image.',
        code: 'budget_unreachable',
        details: {
          outputMaxBytes: 100,
          attempts: [
            {
              attempt: 1,
              width: 640,
              height: 480,
              quality: 0.6,
              mimeType: 'image/webp',
              size: 120,
              withinBudget: false,
              strategy: 'quality-search'
            }
          ]
        }
      })
    ).toBe(true);
    expect(
      isImageBudgetError({
        name: 'ImageBudgetError',
        message: 'Unknown code.',
        code: 'unknown',
        details: {}
      })
    ).toBe(false);
  });
});
