import { createImageCanvas } from '../canvas-image';
import type { DecodedImage } from '../decode-image';
import { ImageBudgetError } from './errors';
import type {
  EncodedImageCandidate,
  ImageBudgetAttempt,
  ImageBudgetOutputType,
  ImageBudgetStrategy,
  ImageDimensions,
  ResolvedImageBudgetPolicy
} from './types';

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

export async function encodeImageAttempt(
  decodedImage: DecodedImage,
  dimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  outputType: ImageBudgetOutputType,
  quality: number | undefined,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[]
): Promise<EncodedImageCandidate> {
  const strategy = getAttemptStrategy(dimensions, originalDimensions, outputType);
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
