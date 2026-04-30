import type { ImageTransformResult, TransformedImageFile } from '../../core/types';

function extractFileName(file: Blob, fallback: string): string {
  return 'name' in file && typeof file.name === 'string' && file.name.length > 0
    ? file.name
    : fallback;
}

function isTransformedImageFile(value: ImageTransformResult): value is TransformedImageFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'file' in value &&
    value.file instanceof Blob
  );
}

export function normalizeTransformedFile(
  originalFile: File,
  transformed: ImageTransformResult
): File {
  const normalized = isTransformedImageFile(transformed) ? transformed : { file: transformed };
  const nextFile = normalized.file;

  if (!(nextFile instanceof Blob)) {
    throw new Error('transform must return a Blob, File, or { file, fileName?, mimeType? }.');
  }

  const fileName = normalized.fileName ?? extractFileName(nextFile, originalFile.name);
  const mimeType =
    normalized.mimeType || nextFile.type || originalFile.type || 'application/octet-stream';

  if (nextFile instanceof File && nextFile.name === fileName && nextFile.type === mimeType) {
    return nextFile;
  }

  return new File([nextFile], fileName, {
    lastModified: originalFile.lastModified,
    type: mimeType
  });
}
