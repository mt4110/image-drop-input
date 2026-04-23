import { decodeImage } from './decode-image';
import type { CompressImageOptions } from './types';

function pickOutputType(sourceType: string, requestedType: CompressImageOptions['outputType']): string {
  if (requestedType && requestedType !== 'auto') {
    return requestedType;
  }

  if (sourceType === 'image/png' || sourceType === 'image/webp') {
    return sourceType;
  }

  if (sourceType === 'image/avif' || sourceType === 'image/gif') {
    return 'image/png';
  }

  return 'image/jpeg';
}


function createCanvas(width: number, height: number): {
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  toBlob: (type: string, quality?: number) => Promise<Blob>;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('2D canvas is unavailable in this environment.');
    }

    return {
      context,
      toBlob(type, quality) {
        return canvas.convertToBlob({ type, quality });
      }
    };
  }

  if (typeof document === 'undefined') {
    throw new Error('Canvas-based image transforms are unavailable in this environment.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('2D canvas is unavailable in this environment.');
  }

  return {
    context,
    toBlob(type, quality) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
              return;
            }

            reject(new Error('Unable to encode the transformed image.'));
          },
          type,
          quality
        );
      });
    }
  };
}

export async function compressImage(source: Blob, options: CompressImageOptions = {}): Promise<Blob> {
  if (!source.type.startsWith('image/')) {
    throw new Error('Only image blobs can be transformed.');
  }

  const decodedImage = await decodeImage(source);

  try {
    const maxWidth = options.maxWidth ?? decodedImage.width;
    const maxHeight = options.maxHeight ?? decodedImage.height;
    const scale = Math.min(1, maxWidth / decodedImage.width, maxHeight / decodedImage.height);
    const width = Math.max(1, Math.round(decodedImage.width * scale));
    const height = Math.max(1, Math.round(decodedImage.height * scale));
    const requestedOutputType = options.outputType ?? 'auto';
    const outputType = pickOutputType(source.type, requestedOutputType);
    const quality = outputType === 'image/png' ? undefined : options.quality ?? 0.86;

    if (scale === 1 && outputType === source.type && typeof options.quality !== 'number') {
      return source;
    }

    const { context, toBlob } = createCanvas(width, height);

    context.drawImage(decodedImage.drawSource, 0, 0, width, height);
    const blob = await toBlob(outputType, quality);

    if (requestedOutputType !== 'auto' && blob.type !== outputType) {
      throw new Error(`Unable to encode ${outputType} in this environment.`);
    }

    return blob;
  } finally {
    decodedImage.cleanup();
  }
}
