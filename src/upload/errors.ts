export type ImageUploadErrorCode =
  | 'target_failed'
  | 'request_unavailable'
  | 'network_error'
  | 'http_error'
  | 'response_mapping_failed'
  | 'unknown_upload_error';

export type ImageUploadErrorStage =
  | 'target'
  | 'request'
  | 'response_mapping'
  | 'adapter';

export interface ImageUploadErrorDetails {
  stage: ImageUploadErrorStage;
  method?: 'POST' | 'PUT';
  status?: number;
  statusText?: string;
  body?: unknown;
  rawBody?: string;
}

export interface ImageUploadErrorOptions {
  cause?: unknown;
}

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;
  readonly details: ImageUploadErrorDetails;

  constructor(
    code: ImageUploadErrorCode,
    message: string,
    details: ImageUploadErrorDetails,
    options?: ImageUploadErrorOptions
  ) {
    super(message, options);
    this.name = 'ImageUploadError';
    this.code = code;
    this.details = details;
  }
}

const imageUploadErrorCodes = new Set<ImageUploadErrorCode>([
  'target_failed',
  'request_unavailable',
  'network_error',
  'http_error',
  'response_mapping_failed',
  'unknown_upload_error'
]);

const imageUploadErrorStages = new Set<ImageUploadErrorStage>([
  'target',
  'request',
  'response_mapping',
  'adapter'
]);

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

function isValidMethod(value: unknown): value is 'POST' | 'PUT' {
  return value === 'POST' || value === 'PUT';
}

function hasOptionalString(details: Record<string, unknown>, key: keyof ImageUploadErrorDetails) {
  return typeof details[key] === 'undefined' || typeof details[key] === 'string';
}

function hasOptionalNumber(details: Record<string, unknown>, key: keyof ImageUploadErrorDetails) {
  const value = details[key];

  return typeof value === 'undefined' || (typeof value === 'number' && Number.isFinite(value));
}

export function isImageUploadError(error: unknown): error is ImageUploadError {
  if (!isObjectRecord(error)) {
    return false;
  }

  if (
    error.name !== 'ImageUploadError' ||
    typeof error.message !== 'string' ||
    typeof error.code !== 'string' ||
    !imageUploadErrorCodes.has(error.code as ImageUploadErrorCode) ||
    !isPlainRecord(error.details)
  ) {
    return false;
  }

  const details = error.details;

  return (
    typeof details.stage === 'string' &&
    imageUploadErrorStages.has(details.stage as ImageUploadErrorStage) &&
    (typeof details.method === 'undefined' || isValidMethod(details.method)) &&
    hasOptionalNumber(details, 'status') &&
    hasOptionalString(details, 'statusText') &&
    hasOptionalString(details, 'rawBody')
  );
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
