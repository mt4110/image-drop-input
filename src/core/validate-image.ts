import { getImageMetadata } from './get-image-metadata';
import type {
  ImageMetadata,
  ImageValidationErrorCode,
  ImageValidationErrorDetails,
  ImageValidationOptions
} from './types';

export interface ImageValidationErrorOptions {
  cause?: unknown;
}

export class ImageValidationError extends Error {
  readonly code: ImageValidationErrorCode;
  readonly details: ImageValidationErrorDetails;

  constructor(
    code: ImageValidationErrorCode,
    message: string,
    details: ImageValidationErrorDetails = {},
    options?: ImageValidationErrorOptions
  ) {
    super(message, options);
    this.name = 'ImageValidationError';
    this.code = code;
    this.details = details;
  }
}

const imageValidationErrorCodeList = [
  'invalid_type',
  'file_too_large',
  'image_too_small',
  'image_too_large',
  'too_many_pixels',
  'decode_failed'
] as const satisfies readonly ImageValidationErrorCode[];

const imageValidationErrorCodes = new Set<ImageValidationErrorCode>(imageValidationErrorCodeList);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isObjectRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function hasNumber(details: Record<string, unknown>, key: keyof ImageValidationErrorDetails) {
  const value = details[key];

  return typeof value === 'number' && Number.isFinite(value);
}

function hasString(details: Record<string, unknown>, key: keyof ImageValidationErrorDetails) {
  return typeof details[key] === 'string';
}

function hasStringList(details: Record<string, unknown>, key: keyof ImageValidationErrorDetails) {
  const value = details[key];

  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasDimensionDetails(details: Record<string, unknown>) {
  return (
    hasNumber(details, 'actualHeight') &&
    hasNumber(details, 'actualWidth') &&
    hasString(details, 'mimeType')
  );
}

function hasExpectedDetails(
  code: ImageValidationErrorCode,
  details: Record<string, unknown>
): boolean {
  switch (code) {
    case 'invalid_type':
      return (
        hasString(details, 'accept') &&
        hasStringList(details, 'acceptRules') &&
        hasString(details, 'formattedAccept') &&
        hasString(details, 'mimeType')
      );
    case 'file_too_large':
      return (
        hasNumber(details, 'actualBytes') &&
        hasNumber(details, 'maxBytes') &&
        hasString(details, 'mimeType')
      );
    case 'image_too_small':
      return (
        hasDimensionDetails(details) &&
        (hasNumber(details, 'minHeight') || hasNumber(details, 'minWidth'))
      );
    case 'image_too_large':
      return (
        hasDimensionDetails(details) &&
        (hasNumber(details, 'maxHeight') || hasNumber(details, 'maxWidth'))
      );
    case 'too_many_pixels':
      return (
        hasDimensionDetails(details) &&
        hasNumber(details, 'actualPixels') &&
        hasNumber(details, 'maxPixels')
      );
    case 'decode_failed':
      return hasNumber(details, 'actualBytes') && hasString(details, 'mimeType');
    default:
      return false;
  }
}

export function isImageValidationError(error: unknown): error is ImageValidationError {
  if (!isObjectRecord(error)) {
    return false;
  }

  if (
    error.name !== 'ImageValidationError' ||
    typeof error.message !== 'string' ||
    typeof error.code !== 'string'
  ) {
    return false;
  }

  const code = error.code as ImageValidationErrorCode;

  return (
    imageValidationErrorCodes.has(code) &&
    isPlainRecord(error.details) &&
    hasExpectedDetails(code, error.details)
  );
}

export function matchesAcceptRule(file: File, rule: string): boolean {
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

export function splitAcceptRules(accept: string): string[] {
  return accept
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function formatAcceptRules(rules: string[]): string {
  const labels = new Set<string>();

  for (const rule of rules) {
    const normalizedRule = rule.trim().toLowerCase();

    if (normalizedRule === 'image/*') {
      labels.add('image files');
      continue;
    }

    if (normalizedRule === 'image/png' || normalizedRule === '.png') {
      labels.add('PNG');
      continue;
    }

    if (
      normalizedRule === 'image/jpeg' ||
      normalizedRule === '.jpg' ||
      normalizedRule === '.jpeg'
    ) {
      labels.add('JPEG');
      continue;
    }

    if (normalizedRule === 'image/webp' || normalizedRule === '.webp') {
      labels.add('WebP');
      continue;
    }

    if (normalizedRule.startsWith('.')) {
      labels.add(normalizedRule.slice(1).toUpperCase());
      continue;
    }

    labels.add(normalizedRule);
  }

  return Array.from(labels).join(', ');
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
    const acceptRules = splitAcceptRules(accept);

    if (acceptRules.length > 0 && !acceptRules.some((rule) => matchesAcceptRule(file, rule))) {
      const formattedAccept = formatAcceptRules(acceptRules);

      throw new ImageValidationError('invalid_type', `Accepted file types: ${formattedAccept}.`, {
        accept,
        acceptRules,
        formattedAccept,
        mimeType: file.type
      });
    }
  }

  if (typeof maxBytes === 'number' && file.size > maxBytes) {
    throw new ImageValidationError(
      'file_too_large',
      `Select an image smaller than ${formatBytes(maxBytes)}.`,
      {
        actualBytes: file.size,
        maxBytes,
        mimeType: file.type
      }
    );
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

  let metadata: ImageMetadata;

  try {
    metadata = await (getMetadata ?? getImageMetadata)(file);
  } catch (error) {
    throw new ImageValidationError(
      'decode_failed',
      'Unable to read image dimensions.',
      {
        actualBytes: file.size,
        mimeType: file.type
      },
      { cause: error }
    );
  }

  if (typeof minWidth === 'number' && metadata.width < minWidth) {
    throw new ImageValidationError(
      'image_too_small',
      `Select an image at least ${minWidth}px wide.`,
      {
        actualHeight: metadata.height,
        actualWidth: metadata.width,
        minWidth,
        mimeType: metadata.mimeType
      }
    );
  }

  if (typeof minHeight === 'number' && metadata.height < minHeight) {
    throw new ImageValidationError(
      'image_too_small',
      `Select an image at least ${minHeight}px tall.`,
      {
        actualHeight: metadata.height,
        actualWidth: metadata.width,
        minHeight,
        mimeType: metadata.mimeType
      }
    );
  }

  if (typeof maxWidth === 'number' && metadata.width > maxWidth) {
    throw new ImageValidationError(
      'image_too_large',
      `Select an image no wider than ${maxWidth}px.`,
      {
        actualHeight: metadata.height,
        actualWidth: metadata.width,
        maxWidth,
        mimeType: metadata.mimeType
      }
    );
  }

  if (typeof maxHeight === 'number' && metadata.height > maxHeight) {
    throw new ImageValidationError(
      'image_too_large',
      `Select an image no taller than ${maxHeight}px.`,
      {
        actualHeight: metadata.height,
        actualWidth: metadata.width,
        maxHeight,
        mimeType: metadata.mimeType
      }
    );
  }

  if (typeof maxPixels === 'number' && metadata.width * metadata.height > maxPixels) {
    throw new ImageValidationError(
      'too_many_pixels',
      `Select an image no larger than ${formatPixels(maxPixels)}.`,
      {
        actualHeight: metadata.height,
        actualPixels: metadata.width * metadata.height,
        actualWidth: metadata.width,
        maxPixels,
        mimeType: metadata.mimeType
      }
    );
  }

  return metadata;
}
