import { createImageCanvas } from './canvas-image';
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

    const { context, toBlob } = createImageCanvas(width, height);

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
