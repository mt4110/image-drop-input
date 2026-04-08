export type MaybePromise<T> = T | Promise<T>;

export type AspectRatioValue = number | `${number}/${number}`;

export interface ImageUploadValue {
  /** Persisted or otherwise shareable image source. */
  src?: string;
  /** Ephemeral local preview source, typically a managed object URL. */
  previewSrc?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  key?: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

export interface TransformedImageFile {
  file: Blob | File;
  fileName?: string;
  mimeType?: string;
}

export type ImageTransformResult = Blob | File | TransformedImageFile;

export interface ImageValidationOptions {
  accept?: string;
  maxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
  getMetadata?: (file: Blob) => Promise<ImageMetadata>;
}

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputType?: 'auto' | 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ManagedObjectUrl {
  url: string;
  revoke: () => void;
}
