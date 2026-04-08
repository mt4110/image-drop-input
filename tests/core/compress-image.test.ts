import '../setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '../../src/core/compress-image';

describe('compressImage', () => {
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
        drawImage
      } as unknown as OffscreenCanvasRenderingContext2D;
    }

    convertToBlob(options?: ImageEncodeOptions) {
      return Promise.resolve(
        new Blob([`${this.width}x${this.height}`], { type: options?.type ?? 'image/png' })
      );
    }
  }

  beforeEach(() => {
    drawImage.mockReset();
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
  });

  it('decodes only once before resizing and encoding the image', async () => {
    const close = vi.fn();
    const bitmap = {
      width: 1200,
      height: 900,
      close
    } as ImageBitmap;
    const createImageBitmap = vi.fn(async () => bitmap);

    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: createImageBitmap
    });

    const source = new File(['hello'], 'avatar.png', { type: 'image/png' });
    const result = await compressImage(source, { maxWidth: 600 });

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(createImageBitmap).toHaveBeenCalledWith(source, { imageOrientation: 'from-image' });
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 600, 450);
    expect(close).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Blob);
    expect(result).not.toBe(source);
    expect(result.type).toBe('image/png');
  });

  it('returns the original blob for no-op transforms while still cleaning up the decode handle', async () => {
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({
      width: 640,
      height: 480,
      close
    })) as typeof globalThis.createImageBitmap;

    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: createImageBitmap
    });

    const source = new File(['hello'], 'avatar.png', { type: 'image/png' });
    const result = await compressImage(source);

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(drawImage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(result).toBe(source);
  });
});
