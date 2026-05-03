import { createInvalidPolicyError, ImageBudgetError } from './errors';
import { isSupportedOutputType, toMimeType } from './mime';
import type {
  ImageBudgetOutputType,
  ImageBudgetPolicy,
  ResolvedImageBudgetPolicy
} from './types';

const defaultInitialQuality = 0.86;
const defaultMinQuality = 0.6;
const defaultMaxEncodeAttempts = 12;
const defaultResizeStepRatio = 0.85;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateMaxDimension(
  value: number | undefined,
  fieldName: string,
  policy: ImageBudgetPolicy
): void {
  if (typeof value === 'undefined') {
    return;
  }

  if (!isFiniteNumber(value) || value < 1) {
    throw createInvalidPolicyError(
      `${fieldName} must be a finite number greater than or equal to 1.`,
      policy
    );
  }
}

function validateNonNegativeOptionalDimension(
  value: number | undefined,
  fieldName: string,
  policy: ImageBudgetPolicy
): void {
  if (typeof value === 'undefined') {
    return;
  }

  if (!isFiniteNumber(value) || value < 0) {
    throw createInvalidPolicyError(`${fieldName} must be a finite non-negative number.`, policy);
  }
}

export function resolvePolicy(file: Blob, policy: ImageBudgetPolicy): ResolvedImageBudgetPolicy {
  if (!Number.isInteger(policy.outputMaxBytes) || policy.outputMaxBytes <= 0) {
    throw createInvalidPolicyError('outputMaxBytes must be a finite positive integer.', policy);
  }

  if (typeof policy.outputType !== 'undefined' && typeof policy.outputType !== 'string') {
    throw createInvalidPolicyError('outputType must be a supported image MIME type.', policy);
  }

  const hasRequestedOutputType = typeof policy.outputType !== 'undefined';
  const requestedOutputType = toMimeType(policy.outputType);

  if (hasRequestedOutputType && !isSupportedOutputType(requestedOutputType)) {
    const unsupportedOutputType = requestedOutputType || '(empty)';

    throw new ImageBudgetError(
      'unsupported_output_type',
      `Unsupported image output type: ${unsupportedOutputType}.`,
      { outputMaxBytes: policy.outputMaxBytes }
    );
  }

  const sourceType = toMimeType(file.type);
  const outputType: ImageBudgetOutputType = requestedOutputType
    ? (requestedOutputType as ImageBudgetOutputType)
    : isSupportedOutputType(sourceType)
      ? sourceType
      : 'image/webp';

  const initialQuality = policy.initialQuality ?? defaultInitialQuality;
  const minQuality = policy.minQuality ?? defaultMinQuality;
  const maxEncodeAttempts = policy.maxEncodeAttempts ?? defaultMaxEncodeAttempts;
  const qualitySearch = policy.qualitySearch ?? 'binary';
  const resizeStepRatio = policy.resizeStepRatio ?? defaultResizeStepRatio;

  if (!isFiniteNumber(initialQuality) || initialQuality <= 0 || initialQuality > 1) {
    throw createInvalidPolicyError('initialQuality must be in the range (0, 1].', policy);
  }

  if (!isFiniteNumber(minQuality) || minQuality <= 0 || minQuality > 1) {
    throw createInvalidPolicyError('minQuality must be in the range (0, 1].', policy);
  }

  if (minQuality > initialQuality) {
    throw createInvalidPolicyError('minQuality must not be greater than initialQuality.', policy);
  }

  if (!Number.isInteger(maxEncodeAttempts) || maxEncodeAttempts < 1) {
    throw createInvalidPolicyError('maxEncodeAttempts must be a positive integer.', policy);
  }

  if (qualitySearch !== 'binary') {
    throw createInvalidPolicyError('qualitySearch must be "binary".', policy);
  }

  if (!isFiniteNumber(resizeStepRatio) || resizeStepRatio <= 0 || resizeStepRatio >= 1) {
    throw createInvalidPolicyError('resizeStepRatio must be greater than 0 and less than 1.', policy);
  }

  validateMaxDimension(policy.maxWidth, 'maxWidth', policy);
  validateMaxDimension(policy.maxHeight, 'maxHeight', policy);
  validateNonNegativeOptionalDimension(policy.minWidth, 'minWidth', policy);
  validateNonNegativeOptionalDimension(policy.minHeight, 'minHeight', policy);

  if (
    typeof policy.maxWidth === 'number' &&
    typeof policy.minWidth === 'number' &&
    policy.maxWidth < policy.minWidth
  ) {
    throw createInvalidPolicyError('maxWidth must not be smaller than minWidth.', policy);
  }

  if (
    typeof policy.maxHeight === 'number' &&
    typeof policy.minHeight === 'number' &&
    policy.maxHeight < policy.minHeight
  ) {
    throw createInvalidPolicyError('maxHeight must not be smaller than minHeight.', policy);
  }

  return {
    outputMaxBytes: policy.outputMaxBytes,
    outputType,
    maxWidth: policy.maxWidth,
    maxHeight: policy.maxHeight,
    minWidth: policy.minWidth,
    minHeight: policy.minHeight,
    initialQuality,
    minQuality,
    maxEncodeAttempts,
    qualitySearch,
    resizeStepRatio
  };
}
