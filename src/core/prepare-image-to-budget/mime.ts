import type { ImageBudgetOutputType } from './types';

const supportedOutputTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const supportedOutputTypeSet = new Set<string>(supportedOutputTypes);

export function isSupportedOutputType(value: string): value is ImageBudgetOutputType {
  return supportedOutputTypeSet.has(value);
}

export function toMimeType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getImageExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}
