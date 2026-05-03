import type { DecodedImage } from '../decode-image';
import { getNextResizeDimensions } from './dimensions';
import { encodeImageAttempt } from './encode';
import type {
  EncodedImageCandidate,
  ImageBudgetAttempt,
  ImageDimensions,
  ResolvedImageBudgetPolicy
} from './types';

const qualitySearchEpsilon = 0.001;

function roundQuality(value: number): number {
  return Number(value.toFixed(4));
}

export async function solvePngBudget(
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
      originalDimensions,
      policy.outputType,
      undefined,
      policy,
      attempts
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

export async function solveLossyBudget(
  decodedImage: DecodedImage,
  initialDimensions: ImageDimensions,
  originalDimensions: ImageDimensions,
  policy: ResolvedImageBudgetPolicy,
  attempts: ImageBudgetAttempt[]
): Promise<EncodedImageCandidate | null> {
  let dimensions = initialDimensions;

  while (attempts.length < policy.maxEncodeAttempts) {
    const initialCandidate = await encodeImageAttempt(
      decodedImage,
      dimensions,
      originalDimensions,
      policy.outputType,
      policy.initialQuality,
      policy,
      attempts
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
        originalDimensions,
        policy.outputType,
        policy.minQuality,
        policy,
        attempts
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
            originalDimensions,
            policy.outputType,
            quality,
            policy,
            attempts
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
