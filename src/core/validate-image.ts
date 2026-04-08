import { getImageMetadata } from './get-image-metadata';
import type { ImageMetadata, ImageValidationOptions } from './types';

function matchesAcceptRule(file: File, rule: string): boolean {
  const normalizedRule = rule.trim().toLowerCase();

  if (!normalizedRule) {
    return true;
  }

  if (normalizedRule.startsWith('.')) {
    return file.name.toLowerCase().endsWith(normalizedRule);
  }

  if (normalizedRule.endsWith('/*')) {
    const prefix = normalizedRule.slice(0, -1);
    return file.type.toLowerCase().startsWith(prefix);
  }

  return file.type.toLowerCase() === normalizedRule;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPixels(value: number): string {
  if (value >= 1_000_000) {
    const megapixels = Number((value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1));

    return `${megapixels} ${megapixels === 1 ? 'megapixel' : 'megapixels'}`;
  }

  return `${value.toLocaleString('en-US')} pixels`;
}

export async function validateImage(
  file: File,
  options: ImageValidationOptions = {}
): Promise<ImageMetadata | null> {
  const { accept, getMetadata, maxBytes, maxHeight, maxPixels, maxWidth, minHeight, minWidth } =
    options;

  if (accept) {
    const acceptRules = accept
      .split(',')
      .map((rule) => rule.trim())
      .filter(Boolean);

    if (acceptRules.length > 0 && !acceptRules.some((rule) => matchesAcceptRule(file, rule))) {
      throw new Error(`Accepted file types: ${acceptRules.join(', ')}.`);
    }
  }

  if (typeof maxBytes === 'number' && file.size > maxBytes) {
    throw new Error(`Select an image smaller than ${formatBytes(maxBytes)}.`);
  }

  const needsMetadata =
    typeof minWidth === 'number' ||
    typeof minHeight === 'number' ||
    typeof maxWidth === 'number' ||
    typeof maxHeight === 'number' ||
    typeof maxPixels === 'number';

  if (!needsMetadata) {
    return null;
  }

  const metadata = await (getMetadata ?? getImageMetadata)(file);

  if (typeof minWidth === 'number' && metadata.width < minWidth) {
    throw new Error(`Select an image at least ${minWidth}px wide.`);
  }

  if (typeof minHeight === 'number' && metadata.height < minHeight) {
    throw new Error(`Select an image at least ${minHeight}px tall.`);
  }

  if (typeof maxWidth === 'number' && metadata.width > maxWidth) {
    throw new Error(`Select an image no wider than ${maxWidth}px.`);
  }

  if (typeof maxHeight === 'number' && metadata.height > maxHeight) {
    throw new Error(`Select an image no taller than ${maxHeight}px.`);
  }

  if (typeof maxPixels === 'number' && metadata.width * metadata.height > maxPixels) {
    throw new Error(`Select an image no larger than ${formatPixels(maxPixels)}.`);
  }

  return metadata;
}
