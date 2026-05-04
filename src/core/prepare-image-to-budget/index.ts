import { decodeImage, type DecodedImage } from '../decode-image';
import {
  fitWithinMaxDimensions,
  fitsMaxDimensions,
  fitsMinimumDimensions
} from './dimensions';
import {
  createBudgetUnreachableError,
  createInvalidPolicyError,
  ImageBudgetError,
  isImageBudgetError
} from './errors';
import { resolveOriginalFileName, resolveOutputFileName } from './file-name';
import { toMimeType } from './mime';
import { resolvePolicy } from './policy';
import {
  createPreparedImageToBudgetResult,
  createSourceWithinBudgetResult
} from './result';
import { solveLossyBudget, solvePngBudget } from './search';
import type {
  ImageBudgetAttempt,
  ImageBudgetPolicy,
  PreparedImageToBudgetResult
} from './types';

export { ImageBudgetError, isImageBudgetError };
export type {
  ImageBudgetAttempt,
  ImageBudgetErrorCode,
  ImageBudgetErrorDetails,
  ImageBudgetErrorOptions,
  ImageBudgetPolicy,
  ImageBudgetStrategy,
  PreparedImageToBudgetResult
} from './types';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertDecodedImageDimensions(
  decodedImage: DecodedImage,
  policy: ReturnType<typeof resolvePolicy>
): void {
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
        outputMaxBytes: policy.outputMaxBytes,
        minWidth: policy.minWidth,
        minHeight: policy.minHeight
      }
    );
  }
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
  const originalFileName = resolveOriginalFileName(file, sourceType);
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
    assertDecodedImageDimensions(decodedImage, resolvedPolicy);

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

    if (!fitsMinimumDimensions(initialDimensions.width, initialDimensions.height, resolvedPolicy)) {
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
      return createSourceWithinBudgetResult({
        file,
        fileName: outputFileName,
        mimeType: resolvedPolicy.outputType,
        width: decodedImage.width,
        height: decodedImage.height,
        originalFileName,
        outputMaxBytes: resolvedPolicy.outputMaxBytes
      });
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

    return createPreparedImageToBudgetResult({
      file,
      candidate,
      fileName: outputFileName,
      mimeType: resolvedPolicy.outputType,
      originalFileName,
      originalWidth: decodedImage.width,
      originalHeight: decodedImage.height,
      outputMaxBytes: resolvedPolicy.outputMaxBytes,
      attempts
    });
  } finally {
    decodedImage.cleanup();
  }
}
