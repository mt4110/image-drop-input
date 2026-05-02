export interface ImageCanvas {
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  toBlob: (type: string, quality?: number) => Promise<Blob>;
}

export function createImageCanvas(width: number, height: number): ImageCanvas {
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
