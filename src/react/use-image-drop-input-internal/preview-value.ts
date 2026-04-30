import type { ImageUploadValue } from '../../core/types';

export interface PreparedUpload {
  file: File;
  originalFileName: string;
  value: Omit<ImageUploadValue, 'key' | 'previewSrc' | 'src'>;
}

export function valueUsesUrl(value: ImageUploadValue | null | undefined, url: string): boolean {
  return value?.src === url || value?.previewSrc === url;
}

export function getValueFingerprint(value: ImageUploadValue | null | undefined): string {
  return JSON.stringify([
    value?.src ?? null,
    value?.previewSrc ?? null,
    value?.key ?? null,
    value?.fileName ?? null,
    value?.mimeType ?? null,
    value?.size ?? null,
    value?.width ?? null,
    value?.height ?? null
  ]);
}

export function valueMatchesPendingCommit(
  value: ImageUploadValue | null | undefined,
  pendingValue: ImageUploadValue | null
): boolean {
  if (!value || !pendingValue) {
    return value === pendingValue;
  }

  return (
    (typeof pendingValue.src === 'string' && value.src === pendingValue.src) ||
    (typeof pendingValue.key === 'string' && value.key === pendingValue.key) ||
    (typeof pendingValue.previewSrc === 'string' && value.previewSrc === pendingValue.previewSrc) ||
    getValueFingerprint(value) === getValueFingerprint(pendingValue)
  );
}

export function createPreviewValue(
  preparedUpload: PreparedUpload,
  previewSrc: string
): ImageUploadValue {
  return {
    ...preparedUpload.value,
    previewSrc
  };
}
