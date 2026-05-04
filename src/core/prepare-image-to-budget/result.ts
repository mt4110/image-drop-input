import type {
  EncodedImageCandidate,
  ImageBudgetAttempt,
  ImageBudgetOutputType,
  PreparedImageToBudgetResult
} from './types';

function getCompressionRatio(size: number, originalSize: number): number {
  return size / originalSize;
}

function getOriginalMimeType(file: Blob): { originalMimeType?: string } {
  return file.type ? { originalMimeType: file.type } : {};
}

export function createSourceWithinBudgetResult(input: {
  file: File | Blob;
  fileName: string;
  mimeType: ImageBudgetOutputType;
  width: number;
  height: number;
  originalFileName: string;
  outputMaxBytes: number;
}): PreparedImageToBudgetResult {
  return {
    file: input.file,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.file.size,
    width: input.width,
    height: input.height,
    originalFileName: input.originalFileName,
    ...getOriginalMimeType(input.file),
    originalSize: input.file.size,
    originalWidth: input.width,
    originalHeight: input.height,
    outputMaxBytes: input.outputMaxBytes,
    compressionRatio: getCompressionRatio(input.file.size, input.file.size),
    attempts: [],
    strategy: 'source-within-budget'
  };
}

export function createPreparedImageToBudgetResult(input: {
  file: File | Blob;
  candidate: EncodedImageCandidate;
  fileName: string;
  mimeType: ImageBudgetOutputType;
  originalFileName: string;
  originalWidth: number;
  originalHeight: number;
  outputMaxBytes: number;
  attempts: ImageBudgetAttempt[];
}): PreparedImageToBudgetResult {
  return {
    file: input.candidate.blob,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.candidate.blob.size,
    width: input.candidate.attempt.width,
    height: input.candidate.attempt.height,
    originalFileName: input.originalFileName,
    ...getOriginalMimeType(input.file),
    originalSize: input.file.size,
    originalWidth: input.originalWidth,
    originalHeight: input.originalHeight,
    outputMaxBytes: input.outputMaxBytes,
    compressionRatio: getCompressionRatio(input.candidate.blob.size, input.file.size),
    attempts: input.attempts,
    strategy: input.candidate.attempt.strategy
  };
}
