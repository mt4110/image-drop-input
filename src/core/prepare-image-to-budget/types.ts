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

export type ImageBudgetOutputType = NonNullable<ImageBudgetPolicy['outputType']>;

export interface ResolvedImageBudgetPolicy {
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

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface EncodedImageCandidate {
  blob: Blob;
  attempt: ImageBudgetAttempt;
}

export const imageBudgetStrategyList = [
  'source-within-budget',
  'resize',
  'quality-search',
  'resize-and-quality-search'
] as const satisfies readonly ImageBudgetStrategy[];
