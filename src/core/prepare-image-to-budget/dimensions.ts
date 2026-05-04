import type { ImageDimensions, ResolvedImageBudgetPolicy } from './types';

export function fitWithinMaxDimensions(
  originalWidth: number,
  originalHeight: number,
  policy: ResolvedImageBudgetPolicy
): ImageDimensions {
  const maxWidth = policy.maxWidth ?? originalWidth;
  const maxHeight = policy.maxHeight ?? originalHeight;
  const scale = Math.min(1, maxWidth / originalWidth, maxHeight / originalHeight);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  return {
    width: typeof policy.maxWidth === 'number'
      ? Math.min(width, Math.floor(policy.maxWidth))
      : width,
    height: typeof policy.maxHeight === 'number'
      ? Math.min(height, Math.floor(policy.maxHeight))
      : height
  };
}

export function fitsMaxDimensions(
  width: number,
  height: number,
  policy: ResolvedImageBudgetPolicy
): boolean {
  return (
    (typeof policy.maxWidth === 'undefined' || width <= policy.maxWidth) &&
    (typeof policy.maxHeight === 'undefined' || height <= policy.maxHeight)
  );
}

export function fitsMinimumDimensions(
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

export function getNextResizeDimensions(
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
