import type { ImageUploadValue } from './types';

export interface PersistableImageValue {
  src?: string;
  key?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface PersistableImageValueOptions {
  allowEmptyReference?: boolean;
  allowDataUrl?: boolean;
  allowBlobUrl?: boolean;
  allowFilesystemUrl?: boolean;
  stripUndefined?: boolean;
}

export type ImagePersistableValueErrorCode =
  | 'preview_src_not_persistable'
  | 'src_is_temporary'
  | 'empty_reference'
  | 'invalid_metadata';

export interface ImagePersistableValueErrorDetails {
  field?: string;
  srcProtocol?: string;
}

export interface ImagePersistableValueErrorOptions {
  cause?: unknown;
}

export class ImagePersistableValueError extends Error {
  readonly code: ImagePersistableValueErrorCode;
  readonly details: ImagePersistableValueErrorDetails;

  constructor(
    code: ImagePersistableValueErrorCode,
    message: string,
    details: ImagePersistableValueErrorDetails = {},
    options?: ImagePersistableValueErrorOptions
  ) {
    super(message, options);
    this.name = 'ImagePersistableValueError';
    this.code = code;
    this.details = details;
  }
}

const temporarySrcSchemes = new Set(['blob', 'filesystem', 'data']);

function getLowercaseScheme(src: string): string | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(src.trim());

  return match ? match[1].toLowerCase() : null;
}

function hasReference(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPreviewSrc(value: unknown): value is { previewSrc: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'previewSrc' in value &&
    typeof (value as { previewSrc?: unknown }).previewSrc !== 'undefined'
  );
}

function assertNoPreviewSrc(value: unknown): void {
  if (!hasPreviewSrc(value)) {
    return;
  }

  throw new ImagePersistableValueError(
    'preview_src_not_persistable',
    'Image previewSrc is browser-only state and must not be persisted.',
    { field: 'previewSrc' }
  );
}

function isValidOptionalString(value: unknown): boolean {
  return typeof value === 'undefined' || typeof value === 'string';
}

function isValidOptionalNonNegativeNumber(value: unknown): boolean {
  return (
    typeof value === 'undefined' ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0)
  );
}

function isValidOptionalPositiveNumber(value: unknown): boolean {
  return (
    typeof value === 'undefined' ||
    (typeof value === 'number' && Number.isFinite(value) && value > 0)
  );
}

function validateMetadata(value: PersistableImageValue): void {
  if (!isValidOptionalString(value.src)) {
    throw new ImagePersistableValueError('invalid_metadata', 'Image src must be a string.', {
      field: 'src'
    });
  }

  if (!isValidOptionalString(value.key)) {
    throw new ImagePersistableValueError('invalid_metadata', 'Image key must be a string.', {
      field: 'key'
    });
  }

  if (!isValidOptionalString(value.fileName)) {
    throw new ImagePersistableValueError(
      'invalid_metadata',
      'Image fileName must be a string.',
      {
        field: 'fileName'
      }
    );
  }

  if (!isValidOptionalString(value.mimeType)) {
    throw new ImagePersistableValueError(
      'invalid_metadata',
      'Image mimeType must be a string.',
      {
        field: 'mimeType'
      }
    );
  }

  if (!isValidOptionalNonNegativeNumber(value.size)) {
    throw new ImagePersistableValueError(
      'invalid_metadata',
      'Image size must be a finite non-negative number.',
      {
        field: 'size'
      }
    );
  }

  if (!isValidOptionalPositiveNumber(value.width)) {
    throw new ImagePersistableValueError(
      'invalid_metadata',
      'Image width must be a finite positive number.',
      {
        field: 'width'
      }
    );
  }

  if (!isValidOptionalPositiveNumber(value.height)) {
    throw new ImagePersistableValueError(
      'invalid_metadata',
      'Image height must be a finite positive number.',
      {
        field: 'height'
      }
    );
  }
}

function stripUndefinedProperties(value: PersistableImageValue): PersistableImageValue {
  return {
    ...(typeof value.src !== 'undefined' ? { src: value.src } : {}),
    ...(typeof value.key !== 'undefined' ? { key: value.key } : {}),
    ...(typeof value.fileName !== 'undefined' ? { fileName: value.fileName } : {}),
    ...(typeof value.mimeType !== 'undefined' ? { mimeType: value.mimeType } : {}),
    ...(typeof value.size !== 'undefined' ? { size: value.size } : {}),
    ...(typeof value.width !== 'undefined' ? { width: value.width } : {}),
    ...(typeof value.height !== 'undefined' ? { height: value.height } : {})
  };
}

export function isTemporaryImageSrc(src: string): boolean {
  const scheme = getLowercaseScheme(src);

  return scheme !== null && temporarySrcSchemes.has(scheme);
}

export function toPersistableImageValue(
  value: ImageUploadValue | PersistableImageValue | null | undefined,
  options: PersistableImageValueOptions = {}
): PersistableImageValue | null {
  if (value == null) {
    return null;
  }

  const persistable: PersistableImageValue = {
    src: value.src,
    key: value.key,
    fileName: value.fileName,
    mimeType: value.mimeType,
    size: value.size,
    width: value.width,
    height: value.height
  };

  validateMetadata(persistable);

  if (hasReference(persistable.src)) {
    const scheme = getLowercaseScheme(persistable.src);

    if (scheme === 'blob' && options.allowBlobUrl !== true) {
      throw new ImagePersistableValueError(
        'src_is_temporary',
        'Image src is a temporary browser URL and must not be persisted.',
        { field: 'src', srcProtocol: 'blob:' }
      );
    }

    if (scheme === 'filesystem' && options.allowFilesystemUrl !== true) {
      throw new ImagePersistableValueError(
        'src_is_temporary',
        'Image src is a filesystem URL and must not be persisted unless explicitly allowed.',
        { field: 'src', srcProtocol: 'filesystem:' }
      );
    }

    if (scheme === 'data' && options.allowDataUrl !== true) {
      throw new ImagePersistableValueError(
        'src_is_temporary',
        'Image src is a data URL and must not be persisted unless explicitly allowed.',
        { field: 'src', srcProtocol: 'data:' }
      );
    }
  }

  if (
    !options.allowEmptyReference &&
    !hasReference(persistable.src) &&
    !hasReference(persistable.key)
  ) {
    throw new ImagePersistableValueError(
      'empty_reference',
      'Persistable image values need a durable src or key.'
    );
  }

  return options.stripUndefined === false
    ? persistable
    : stripUndefinedProperties(persistable);
}

export function assertPersistableImageValue(
  value: ImageUploadValue | PersistableImageValue | null | undefined,
  options?: PersistableImageValueOptions
): asserts value is PersistableImageValue | null {
  if (typeof value === 'undefined') {
    throw new ImagePersistableValueError(
      'empty_reference',
      'Persistable image values cannot be undefined.'
    );
  }

  assertNoPreviewSrc(value);
  toPersistableImageValue(value, options);
}

export function isPersistableImageValue(
  value: ImageUploadValue | PersistableImageValue | null | undefined,
  options?: PersistableImageValueOptions
): value is PersistableImageValue | null {
  if (typeof value === 'undefined' || hasPreviewSrc(value)) {
    return false;
  }

  try {
    toPersistableImageValue(value, options);

    return true;
  } catch (error) {
    if (error instanceof ImagePersistableValueError) {
      return false;
    }

    throw error;
  }
}
