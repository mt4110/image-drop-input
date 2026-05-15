import type { DecodedImage } from '../decode-image';
import { getNextResizeDimensions } from './dimensions';
import { encodeImageAttempt } from './encode';
import type {
  EncodedImageCandidate,
  ImageBudgetAttempt,
  ImageDimensions,
  ImageBudgetPreparationOptions,
  ResolvedImageBudgetPolicy
} from './types';

const qualitySearchEpsilon = 0.001;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }

  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Image preparation was cancelled.', 'AbortError');
}

function roundQuality(value: number): number {
  return Number(value.toFixed(4));
}

export async function solvePngBudget(
  decodedImage: DecodedImage,
  initialDimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[],
  options: ImageBudgetPreparationOptions = {}
): Promise<EncodedImageCandidate | null> {
  let dimensions = initialDimensions;

  while (attempts.length < policy.maxEncodeAttempts) {
    throwIfAborted(options.signal);

    const candidate = await encodeImageAttempt(
      decodedImage,
      dimensions,
      originalDimensions,
      policy.outputType,
      undefined,
      policy,
      attempts
    );

    throwIfAborted(options.signal);

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

export async function solveLossyBudget(
  decodedImage: DecodedImage,
  initialDimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[],
  options: ImageBudgetPreparationOptions = {}
): Promise<EncodedImageCandidate | null> {
  let dimensions = initialDimensions;

  while (attempts.length < policy.maxEncodeAttempts) {
    throwIfAborted(options.signal);

    const initialCandidate = await encodeImageAttempt(
      decodedImage,
      dimensions,
      originalDimensions,
      policy.outputType,
      policy.initialQuality,
      policy,
      attempts
    );

    throwIfAborted(options.signal);

    if (initialCandidate.attempt.withinBudget) {
      return initialCandidate;
    }

    if (attempts.length >= policy.maxEncodeAttempts) {
      break;
    }

    if (policy.minQuality < policy.initialQuality) {
      throwIfAborted(options.signal);

      const minCandidate = await encodeImageAttempt(
        decodedImage,
        dimensions,
        originalDimensions,
        policy.outputType,
        policy.minQuality,
        policy,
        attempts
      );

      throwIfAborted(options.signal);

      if (minCandidate.attempt.withinBudget) {
        let bestCandidate = minCandidate;
        let lowQuality = policy.minQuality;
        let highQuality = policy.initialQuality;

        while (attempts.length < policy.maxEncodeAttempts && highQuality - lowQuality > qualitySearchEpsilon) {
          const quality = roundQuality((lowQuality + highQuality) / 2);

          if (quality <= lowQuality || quality >= highQuality) {
            break;
          }

          throwIfAborted(options.signal);

          const candidate = await encodeImageAttempt(
            decodedImage,
            dimensions,
            originalDimensions,
            policy.outputType,
            quality,
            policy,
            attempts
          );

          throwIfAborted(options.signal);

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
