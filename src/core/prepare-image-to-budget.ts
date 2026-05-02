import { createImageCanvas } from './canvas-image';
import { decodeImage, type DecodedImage } from './decode-image';

export type ImageBudgetStrategy =
  | 'source-within-budget'
  | 'resize'
  | 'quality-search'
  | 'resize-and-quality-search';

export interface ImageBudgetPolicy {
  outputMaxBytes: number;
  outputType?: 'image/jpeg' | 'image/png' | 'image/webp';
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  initialQuality?: number;
  minQuality?: number;
  maxEncodeAttempts?: number;
  qualitySearch?: 'binary';
  resizeStepRatio?: number;
  fileName?: string;
}

export interface ImageBudgetAttempt {
  attempt: number;
  width: number;
  height: number;
  quality?: number;
  mimeType: string;
  size: number;
  withinBudget: boolean;
  strategy: ImageBudgetStrategy;
}

export interface PreparedImageToBudgetResult {
  file: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  originalFileName: string;
  originalMimeType?: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  outputMaxBytes: number;
  compressionRatio: number;
  attempts: ImageBudgetAttempt[];
  strategy: ImageBudgetStrategy;
}

export type ImageBudgetErrorCode =
  | 'invalid_policy'
  | 'decode_failed'
  | 'encode_failed'
  | 'unsupported_output_type'
  | 'budget_unreachable';

export interface ImageBudgetErrorDetails {
  outputMaxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  attempts?: ImageBudgetAttempt[];
}

export interface ImageBudgetErrorOptions {
  cause?: unknown;
}

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

type ImageBudgetOutputType = NonNullable<ImageBudgetPolicy['outputType']>;

interface ResolvedImageBudgetPolicy {
  outputMaxBytes: number;
  outputType: ImageBudgetOutputType;
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  initialQuality: number;
  minQuality: number;
  maxEncodeAttempts: number;
  qualitySearch: 'binary';
  resizeStepRatio: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface EncodedImageCandidate {
  blob: Blob;
  attempt: ImageBudgetAttempt;
}

const supportedOutputTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const supportedOutputTypeSet = new Set<string>(supportedOutputTypes);

const defaultInitialQuality = 0.86;
const defaultMinQuality = 0.6;
const defaultMaxEncodeAttempts = 12;
const defaultResizeStepRatio = 0.85;
const qualitySearchEpsilon = 0.001;

function isSupportedOutputType(value: string): value is ImageBudgetOutputType {
  return supportedOutputTypeSet.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toMimeType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getImageFileName(file: Blob): string | undefined {
  if (typeof File !== 'undefined' && file instanceof File && file.name) {
    return file.name;
  }

  const name = (file as Blob & { name?: unknown }).name;

  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

function getImageExtension(mimeType: string): string {
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

function replaceImageFileExtension(fileName: string, mimeType: string): string {
  const extension = getImageExtension(mimeType);

  if (!extension) {
    return fileName;
  }

  if (/\.(?:png|jpe?g|webp)$/i.test(fileName)) {
    return fileName.replace(/\.(?:png|jpe?g|webp)$/i, extension);
  }

  if (/\.[^./\\]+$/.test(fileName)) {
    return fileName.replace(/\.[^./\\]+$/, extension);
  }

  return `${fileName}${extension}`;
}

function fileNameMatchesImageMimeType(fileName: string, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return /\.(?:jpg|jpeg)$/i.test(fileName);
    case 'image/png':
      return /\.png$/i.test(fileName);
    case 'image/webp':
      return /\.webp$/i.test(fileName);
    default:
      return false;
  }
}

function resolveOriginalFileName(file: Blob, outputType: string, policyFileName?: string): string {
  const fileName = getImageFileName(file);

  if (fileName) {
    return fileName;
  }

  if (typeof policyFileName === 'string') {
    return policyFileName;
  }

  return `image${getImageExtension(outputType)}`;
}

function resolveOutputFileName(
  file: Blob,
  outputType: string,
  policyFileName?: string
): string {
  if (typeof policyFileName === 'string') {
    return policyFileName;
  }

  const fileName = getImageFileName(file);

  if (!fileName) {
    return `image${getImageExtension(outputType)}`;
  }

  return fileNameMatchesImageMimeType(fileName, outputType)
    ? fileName
    : replaceImageFileExtension(fileName, outputType);
}

function createInvalidPolicyError(
  message: string,
  policy: Partial<ImageBudgetPolicy>
): ImageBudgetError {
  return new ImageBudgetError('invalid_policy', message, {
    outputMaxBytes: policy.outputMaxBytes,
    minWidth: policy.minWidth,
    minHeight: policy.minHeight
  });
}

function validatePositiveOptionalDimension(
  value: number | undefined,
  fieldName: string,
  policy: ImageBudgetPolicy
): void {
  if (typeof value === 'undefined') {
    return;
  }

  if (!isFiniteNumber(value) || value <= 0) {
    throw createInvalidPolicyError(`${fieldName} must be a finite positive number.`, policy);
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

function resolvePolicy(file: Blob, policy: ImageBudgetPolicy): ResolvedImageBudgetPolicy {
  if (!Number.isInteger(policy.outputMaxBytes) || policy.outputMaxBytes <= 0) {
    throw createInvalidPolicyError('outputMaxBytes must be a finite positive integer.', policy);
  }

  if (typeof policy.outputType !== 'undefined' && typeof policy.outputType !== 'string') {
    throw createInvalidPolicyError('outputType must be a supported image MIME type.', policy);
  }

  const hasRequestedOutputType = typeof policy.outputType !== 'undefined';
  const requestedOutputType = toMimeType(policy.outputType);

  if (hasRequestedOutputType && !isSupportedOutputType(requestedOutputType)) {
    throw new ImageBudgetError(
      'unsupported_output_type',
      `Unsupported image output type: ${requestedOutputType}.`,
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

  validatePositiveOptionalDimension(policy.maxWidth, 'maxWidth', policy);
  validatePositiveOptionalDimension(policy.maxHeight, 'maxHeight', policy);
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

function fitWithinMaxDimensions(
  originalWidth: number,
  originalHeight: number,
  policy: ResolvedImageBudgetPolicy
): ImageDimensions {
  const maxWidth = policy.maxWidth ?? originalWidth;
  const maxHeight = policy.maxHeight ?? originalHeight;
  const scale = Math.min(1, maxWidth / originalWidth, maxHeight / originalHeight);

  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale))
  };
}

function fitsMaxDimensions(width: number, height: number, policy: ResolvedImageBudgetPolicy): boolean {
  return (
    (typeof policy.maxWidth === 'undefined' || width <= policy.maxWidth) &&
    (typeof policy.maxHeight === 'undefined' || height <= policy.maxHeight)
  );
}

function fitsMinimumDimensions(
  width: number,
  height: number,
  policy: ResolvedImageBudgetPolicy
): boolean {
  return (
    (typeof policy.minWidth === 'undefined' || width >= policy.minWidth) &&
    (typeof policy.minHeight === 'undefined' || height >= policy.minHeight)
  );
}

function getMinimumDimensions(policy: ResolvedImageBudgetPolicy): ImageDimensions {
  return {
    width: Math.max(1, Math.ceil(policy.minWidth ?? 1)),
    height: Math.max(1, Math.ceil(policy.minHeight ?? 1))
  };
}

function getNextResizeDimensions(
  current: ImageDimensions,
  policy: ResolvedImageBudgetPolicy
): ImageDimensions | null {
  const minimum = getMinimumDimensions(policy);

  if (current.width <= minimum.width && current.height <= minimum.height) {
    return null;
  }

  let scale = policy.resizeStepRatio;

  if (Math.round(current.width * scale) < minimum.width) {
    scale = Math.max(scale, minimum.width / current.width);
  }

  if (Math.round(current.height * scale) < minimum.height) {
    scale = Math.max(scale, minimum.height / current.height);
  }

  if (scale >= 1) {
    return null;
  }

  let width = Math.max(minimum.width, Math.round(current.width * scale));
  let height = Math.max(minimum.height, Math.round(current.height * scale));

  if (width === current.width && height === current.height) {
    const widthScale = current.width > minimum.width ? (current.width - 1) / current.width : 1;
    const heightScale = current.height > minimum.height ? (current.height - 1) / current.height : 1;
    const progressScale = Math.min(widthScale, heightScale);

    if (progressScale >= 1) {
      return null;
    }

    width = Math.max(minimum.width, Math.round(current.width * progressScale));
    height = Math.max(minimum.height, Math.round(current.height * progressScale));
  }

  if (width === current.width && height === current.height) {
    return null;
  }

  return { width, height };
}

function getAttemptStrategy(
  dimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  outputType: ImageBudgetOutputType
): ImageBudgetStrategy {
  if (outputType === 'image/png') {
    return 'resize';
  }

  return dimensions.width === originalDimensions.width && dimensions.height === originalDimensions.height
    ? 'quality-search'
    : 'resize-and-quality-search';
}

function roundQuality(value: number): number {
  return Number(value.toFixed(4));
}

function getCompressionRatio(size: number, originalSize: number): number {
  return size / originalSize;
}

async function encodeImageAttempt(
  decodedImage: DecodedImage,
  dimensions: ImageDimensions,
  outputType: ImageBudgetOutputType,
  quality: number | undefined,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[],
  strategy: ImageBudgetStrategy
): Promise<EncodedImageCandidate> {
  let blob: Blob;

  try {
    const { context, toBlob } = createImageCanvas(dimensions.width, dimensions.height);

    context.drawImage(decodedImage.drawSource, 0, 0, dimensions.width, dimensions.height);
    blob = await toBlob(outputType, quality);
  } catch (error) {
    throw new ImageBudgetError(
      'encode_failed',
      'Unable to encode the prepared image.',
      {
        outputMaxBytes: policy.outputMaxBytes,
        minWidth: policy.minWidth,
        minHeight: policy.minHeight,
        attempts: attempts.slice()
      },
      { cause: error }
    );
  }

  if (blob.type !== outputType) {
    throw new ImageBudgetError(
      'unsupported_output_type',
      `This browser cannot encode ${outputType}.`,
      {
        outputMaxBytes: policy.outputMaxBytes,
        minWidth: policy.minWidth,
        minHeight: policy.minHeight,
        attempts: attempts.slice()
      }
    );
  }

  const attempt: ImageBudgetAttempt = {
    attempt: attempts.length + 1,
    width: dimensions.width,
    height: dimensions.height,
    ...(typeof quality === 'number' ? { quality } : {}),
    mimeType: outputType,
    size: blob.size,
    withinBudget: blob.size <= policy.outputMaxBytes,
    strategy
  };

  attempts.push(attempt);

  return { blob, attempt };
}

async function solvePngBudget(
  decodedImage: DecodedImage,
  initialDimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[]
): Promise<EncodedImageCandidate | null> {
  let dimensions = initialDimensions;

  while (attempts.length < policy.maxEncodeAttempts) {
    const candidate = await encodeImageAttempt(
      decodedImage,
      dimensions,
      policy.outputType,
      undefined,
      policy,
      attempts,
      getAttemptStrategy(dimensions, originalDimensions, policy.outputType)
    );

    if (candidate.attempt.withinBudget) {
      return candidate;
    }

    const nextDimensions = getNextResizeDimensions(dimensions, policy);

    if (!nextDimensions) {
      break;
    }

    dimensions = nextDimensions;
  }

  return null;
}

async function solveLossyBudget(
  decodedImage: DecodedImage,
  initialDimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[]
): Promise<EncodedImageCandidate | null> {
  let dimensions = initialDimensions;

  while (attempts.length < policy.maxEncodeAttempts) {
    const strategy = getAttemptStrategy(dimensions, originalDimensions, policy.outputType);
    const initialCandidate = await encodeImageAttempt(
      decodedImage,
      dimensions,
      policy.outputType,
      policy.initialQuality,
      policy,
      attempts,
      strategy
    );

    if (initialCandidate.attempt.withinBudget) {
      return initialCandidate;
    }

    if (attempts.length >= policy.maxEncodeAttempts) {
      break;
    }

    if (policy.minQuality < policy.initialQuality) {
      const minCandidate = await encodeImageAttempt(
        decodedImage,
        dimensions,
        policy.outputType,
        policy.minQuality,
        policy,
        attempts,
        strategy
      );

      if (minCandidate.attempt.withinBudget) {
        let bestCandidate = minCandidate;
        let lowQuality = policy.minQuality;
        let highQuality = policy.initialQuality;

        while (attempts.length < policy.maxEncodeAttempts && highQuality - lowQuality > qualitySearchEpsilon) {
          const quality = roundQuality((lowQuality + highQuality) / 2);

          if (quality <= lowQuality || quality >= highQuality) {
            break;
          }

          const candidate = await encodeImageAttempt(
            decodedImage,
            dimensions,
            policy.outputType,
            quality,
            policy,
            attempts,
            strategy
          );

          if (candidate.attempt.withinBudget) {
            bestCandidate = candidate;
            lowQuality = quality;
          } else {
            highQuality = quality;
          }
        }

        return bestCandidate;
      }
    }

    const nextDimensions = getNextResizeDimensions(dimensions, policy);

    if (!nextDimensions) {
      break;
    }

    dimensions = nextDimensions;
  }

  return null;
}

function createBudgetUnreachableError(
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
      attempts: attempts.slice()
    }
  );
}

export async function prepareImageToBudget(
  file: File | Blob,
  policy: ImageBudgetPolicy
): Promise<PreparedImageToBudgetResult> {
  if (!isObjectRecord(policy)) {
    throw createInvalidPolicyError('Image budget policy must be an object.', {});
  }

  const resolvedPolicy = resolvePolicy(file, policy);
  const sourceType = toMimeType(file.type);
  const originalFileName = resolveOriginalFileName(file, resolvedPolicy.outputType, policy.fileName);
  let decodedImage: DecodedImage;

  try {
    decodedImage = await decodeImage(file);
  } catch (error) {
    throw new ImageBudgetError(
      'decode_failed',
      'Unable to read image dimensions.',
      {
        outputMaxBytes: resolvedPolicy.outputMaxBytes,
        minWidth: resolvedPolicy.minWidth,
        minHeight: resolvedPolicy.minHeight
      },
      { cause: error }
    );
  }

  try {
    if (
      !Number.isFinite(decodedImage.width) ||
      !Number.isFinite(decodedImage.height) ||
      decodedImage.width <= 0 ||
      decodedImage.height <= 0
    ) {
      throw new ImageBudgetError(
        'decode_failed',
        'Unable to read valid image dimensions.',
        {
          outputMaxBytes: resolvedPolicy.outputMaxBytes,
          minWidth: resolvedPolicy.minWidth,
          minHeight: resolvedPolicy.minHeight
        }
      );
    }

    const originalDimensions = {
      width: decodedImage.width,
      height: decodedImage.height
    };
    const initialDimensions = fitWithinMaxDimensions(
      decodedImage.width,
      decodedImage.height,
      resolvedPolicy
    );
    const outputFileName = resolveOutputFileName(
      file,
      resolvedPolicy.outputType,
      policy.fileName
    );

    if (
      !fitsMinimumDimensions(initialDimensions.width, initialDimensions.height, resolvedPolicy)
    ) {
      throw createBudgetUnreachableError(resolvedPolicy, []);
    }

    const sourceFitsBudget = file.size <= resolvedPolicy.outputMaxBytes;
    const sourceFitsMaxDimensions = fitsMaxDimensions(
      decodedImage.width,
      decodedImage.height,
      resolvedPolicy
    );

    if (
      sourceFitsBudget &&
      sourceType === resolvedPolicy.outputType &&
      sourceFitsMaxDimensions
    ) {
      return {
        file,
        fileName: outputFileName,
        mimeType: resolvedPolicy.outputType,
        size: file.size,
        width: decodedImage.width,
        height: decodedImage.height,
        originalFileName,
        ...(file.type ? { originalMimeType: file.type } : {}),
        originalSize: file.size,
        originalWidth: decodedImage.width,
        originalHeight: decodedImage.height,
        outputMaxBytes: resolvedPolicy.outputMaxBytes,
        compressionRatio: getCompressionRatio(file.size, file.size),
        attempts: [],
        strategy: 'source-within-budget'
      };
    }

    const attempts: ImageBudgetAttempt[] = [];
    const candidate =
      resolvedPolicy.outputType === 'image/png'
        ? await solvePngBudget(
            decodedImage,
            initialDimensions,
            originalDimensions,
            resolvedPolicy,
            attempts
          )
        : await solveLossyBudget(
            decodedImage,
            initialDimensions,
            originalDimensions,
            resolvedPolicy,
            attempts
          );

    if (!candidate) {
      throw createBudgetUnreachableError(resolvedPolicy, attempts);
    }

    return {
      file: candidate.blob,
      fileName: outputFileName,
      mimeType: resolvedPolicy.outputType,
      size: candidate.blob.size,
      width: candidate.attempt.width,
      height: candidate.attempt.height,
      originalFileName,
      ...(file.type ? { originalMimeType: file.type } : {}),
      originalSize: file.size,
      originalWidth: decodedImage.width,
      originalHeight: decodedImage.height,
      outputMaxBytes: resolvedPolicy.outputMaxBytes,
      compressionRatio: getCompressionRatio(candidate.blob.size, file.size),
      attempts,
      strategy: candidate.attempt.strategy
    };
  } finally {
    decodedImage.cleanup();
  }
}
