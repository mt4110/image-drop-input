import { getImageExtension } from './mime';

function getImageFileName(file: Blob): string | undefined {
  if (typeof File !== 'undefined' && file instanceof File && file.name) {
    return file.name;
  }

  const name = (file as Blob & { name?: unknown }).name;

  return typeof name === 'string' && name.length > 0 ? name : undefined;
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

export function resolveOriginalFileName(file: Blob, sourceType: string): string {
  const fileName = getImageFileName(file);

  if (fileName) {
    return fileName;
  }

  const extension = getImageExtension(sourceType);

  return extension ? `image${extension}` : 'image';
}

export function resolveOutputFileName(
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
