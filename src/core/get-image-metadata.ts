import { decodeImage } from './decode-image';
import type { ImageMetadata } from './types';

export async function getImageMetadata(blob: Blob): Promise<ImageMetadata> {
  const decodedImage = await decodeImage(blob);

  try {
    return {
      width: decodedImage.width,
      height: decodedImage.height,
      size: blob.size,
      mimeType: blob.type
    };
  } finally {
    decodedImage.cleanup();
  }
}
