import { createObjectUrl } from './create-object-url';
import type { ImageMetadata } from './types';

export interface DecodedImage extends ImageMetadata {
  drawSource: CanvasImageSource;
  cleanup: () => void;
}

async function decodeWithImageBitmap(blob: Blob): Promise<DecodedImage | null> {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });

    return {
      width: bitmap.width,
      height: bitmap.height,
      size: blob.size,
      mimeType: blob.type,
      drawSource: bitmap,
      cleanup: () => {
        bitmap.close?.();
      }
    };
  } catch {
    try {
      const bitmap = await createImageBitmap(blob);

      return {
        width: bitmap.width,
        height: bitmap.height,
        size: blob.size,
        mimeType: blob.type,
        drawSource: bitmap,
        cleanup: () => {
          bitmap.close?.();
        }
      };
    } catch {
      return null;
    }
  }
}

async function decodeWithImageElement(blob: Blob): Promise<DecodedImage> {
  if (typeof Image === 'undefined') {
    throw new Error('Image decoding is unavailable in this environment.');
  }

  const objectUrl = createObjectUrl(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();

      nextImage.decoding = 'async';
      nextImage.onload = () => {
        resolve(nextImage);
      };
      nextImage.onerror = () => {
        reject(new Error('Failed to decode the selected image.'));
      };
      nextImage.src = objectUrl.url;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      size: blob.size,
      mimeType: blob.type,
      drawSource: image,
      cleanup: () => {
        objectUrl.revoke();
      }
    };
  } catch (error) {
    objectUrl.revoke();
    throw error;
  }
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const bitmapImage = await decodeWithImageBitmap(blob);

  if (bitmapImage) {
    return bitmapImage;
  }

  return decodeWithImageElement(blob);
}
