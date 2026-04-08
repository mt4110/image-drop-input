import type { ImageUploadValue, UploadContext } from 'image-drop-input';

export const acceptedTypes = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
export const maxFileBytes = 8 * 1024 * 1024;
export const maxGalleryItems = 6;

export type GalleryItem = {
  id: string;
  fileName: string;
  previewSrc: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};

export type PreviewState = {
  src: string;
  alt: string;
  title: string;
  facts: string | null;
};

let nextGalleryItemId = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatImageFacts(
  value: Pick<ImageUploadValue, 'mimeType' | 'size' | 'width' | 'height'> | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const facts: string[] = [];

  if (value.mimeType) {
    facts.push(value.mimeType.replace('image/', '').toUpperCase());
  }

  if (typeof value.size === 'number') {
    facts.push(formatBytes(value.size));
  }

  if (typeof value.width === 'number' && typeof value.height === 'number') {
    facts.push(`${value.width}x${value.height}`);
  }

  return facts.length > 0 ? facts.join(' · ') : null;
}

export function createUploadAdapter(uploadKey: string, progressStops: readonly [number, number]) {
  return async (file: Blob, context: UploadContext) => {
    context.onProgress?.(progressStops[0]);
    await delay(140);
    context.onProgress?.(progressStops[1]);
    await delay(140);

    return {
      src: URL.createObjectURL(file),
      key: uploadKey
    };
  };
}

export function createGalleryItem(
  file: File,
  metadata?: { width: number; height: number }
): GalleryItem {
  nextGalleryItemId += 1;

  return {
    id: `gallery-item-${nextGalleryItemId}`,
    fileName: file.name,
    previewSrc: URL.createObjectURL(file),
    mimeType: file.type,
    size: file.size,
    width: metadata?.width,
    height: metadata?.height
  };
}

export function joinClasses(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export function CodeDisclosure({ code, title }: { code: string; title: string }) {
  return (
    <details className="exampleCode">
      <summary>{title}</summary>
      <pre>{code}</pre>
    </details>
  );
}
