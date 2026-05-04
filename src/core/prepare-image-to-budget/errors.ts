import { cloneImageBudgetAttempts } from './attempts';
import { isSupportedOutputType } from './mime';
import {
  imageBudgetStrategyList,
  type ImageBudgetAttempt,
  type ImageBudgetErrorCode,
  type ImageBudgetErrorDetails,
  type ImageBudgetErrorOptions,
  type ImageBudgetPolicy,
  type ImageBudgetStrategy,
  type ResolvedImageBudgetPolicy
} from './types';

export class ImageBudgetError extends Error {
  readonly code: ImageBudgetErrorCode;
  readonly details: ImageBudgetErrorDetails;

  constructor(
    code: ImageBudgetErrorCode,
    message: string,
    details: ImageBudgetErrorDetails = {},
    options?: ImageBudgetErrorOptions
  ) {
    super(message, options);
    this.name = 'ImageBudgetError';
    this.code = code;
    this.details = details;
  }
}

const imageBudgetErrorCodeList = [
  'invalid_policy',
  'decode_failed',
  'encode_failed',
  'unsupported_output_type',
  'budget_unreachable'
] as const satisfies readonly ImageBudgetErrorCode[];

const imageBudgetErrorCodes = new Set<ImageBudgetErrorCode>(imageBudgetErrorCodeList);
const imageBudgetStrategies = new Set<ImageBudgetStrategy>(imageBudgetStrategyList);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum;
}

function hasOptionalFiniteNumber(
  details: Record<string, unknown>,
  key: keyof ImageBudgetErrorDetails
): boolean {
  const value = details[key];

  return typeof value === 'undefined' || (typeof value === 'number' && Number.isFinite(value));
}

function isImageBudgetAttempt(value: unknown): value is ImageBudgetAttempt {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    isIntegerAtLeast(value.attempt, 1) &&
    isIntegerAtLeast(value.width, 1) &&
    isIntegerAtLeast(value.height, 1) &&
    typeof value.mimeType === 'string' &&
    isSupportedOutputType(value.mimeType) &&
    isIntegerAtLeast(value.size, 0) &&
    typeof value.withinBudget === 'boolean' &&
    typeof value.strategy === 'string' &&
    imageBudgetStrategies.has(value.strategy as ImageBudgetStrategy) &&
    (typeof value.quality === 'undefined' ||
      (typeof value.quality === 'number' &&
        Number.isFinite(value.quality) &&
        value.quality > 0 &&
        value.quality <= 1))
  );
}

function hasOptionalAttempts(details: Record<string, unknown>): boolean {
  const attempts = details.attempts;

  return (
    typeof attempts === 'undefined' ||
    (Array.isArray(attempts) && attempts.every(isImageBudgetAttempt))
  );
}

export function isImageBudgetError(error: unknown): error is ImageBudgetError {
  if (!isObjectRecord(error)) {
    return false;
  }

  if (
    error.name !== 'ImageBudgetError' ||
    typeof error.message !== 'string' ||
    typeof error.code !== 'string' ||
    !imageBudgetErrorCodes.has(error.code as ImageBudgetErrorCode) ||
    !isObjectRecord(error.details)
  ) {
    return false;
  }

  return (
    hasOptionalFiniteNumber(error.details, 'outputMaxBytes') &&
    hasOptionalFiniteNumber(error.details, 'minWidth') &&
    hasOptionalFiniteNumber(error.details, 'minHeight') &&
    hasOptionalAttempts(error.details)
  );
}

export function createInvalidPolicyError(
  message: string,
  policy: Partial<ImageBudgetPolicy>
): ImageBudgetError {
  return new ImageBudgetError('invalid_policy', message, {
    outputMaxBytes: policy.outputMaxBytes,
    minWidth: policy.minWidth,
    minHeight: policy.minHeight
  });
}

export function createBudgetUnreachableError(
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[]
): ImageBudgetError {
  return new ImageBudgetError(
    'budget_unreachable',
    'Unable to prepare an image within the byte budget and dimension limits.',
    {
      outputMaxBytes: policy.outputMaxBytes,
      minWidth: policy.minWidth,
      minHeight: policy.minHeight,
      attempts: cloneImageBudgetAttempts(attempts)
    }
  );
}
