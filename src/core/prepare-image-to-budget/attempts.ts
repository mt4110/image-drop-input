import type {
  ImageBudgetAttempt,
  ImageBudgetOutputType,
  ImageBudgetStrategy,
  ImageDimensions
} from './types';

export function cloneImageBudgetAttempts(attempts: ImageBudgetAttempt[]): ImageBudgetAttempt[] {
  return attempts.slice();
}

export function createImageBudgetAttempt(input: {
  attempt: number;
  dimensions: ImageDimensions;
  quality?: number;
  mimeType: ImageBudgetOutputType;
  size: number;
  withinBudget: boolean;
  strategy: ImageBudgetStrategy;
}): ImageBudgetAttempt {
  return {
    attempt: input.attempt,
    width: input.dimensions.width,
    height: input.dimensions.height,
    ...(typeof input.quality === 'number' ? { quality: input.quality } : {}),
    mimeType: input.mimeType,
    size: input.size,
    withinBudget: input.withinBudget,
    strategy: input.strategy
  };
}
