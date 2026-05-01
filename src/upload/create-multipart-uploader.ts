import { sendUploadRequest } from './request';
import { ImageUploadError, isAbortError, isImageUploadError } from './errors';
import type {
  CreateMultipartUploaderOptions,
  UploadAdapter,
  UploadResponse,
  UploadResult
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultMapResponse(body: unknown, response: UploadResponse): UploadResult {
  if (isRecord(body)) {
    const src =
      typeof body.src === 'string'
        ? body.src
        : typeof body.publicUrl === 'string'
          ? body.publicUrl
          : typeof body.url === 'string'
            ? body.url
            : undefined;
    const key =
      typeof body.key === 'string'
        ? body.key
        : typeof body.objectKey === 'string'
          ? body.objectKey
          : undefined;
    const etag =
      typeof body.etag === 'string'
        ? body.etag
        : response.headers.get('etag') ?? undefined;

    return {
      src,
      key,
      etag,
      response: body
    };
  }

  return {
    etag: response.headers.get('etag') ?? undefined,
    response: body
  };
}

function getBlobName(file: Blob, fallback?: string): string {
  if (fallback) {
    return fallback;
  }

  return 'name' in file && typeof file.name === 'string' && file.name.length > 0 ? file.name : 'upload.bin';
}

export function createMultipartUploader(options: CreateMultipartUploaderOptions): UploadAdapter {
  return async (file, context) => {
    const formData = new FormData();
    formData.append(options.fieldName ?? 'file', file, getBlobName(file, context.fileName));

    const response = await (options.request ?? sendUploadRequest)({
      method: 'POST',
      url: options.endpoint,
      headers: options.headers,
      body: formData,
      signal: context.signal,
      onProgress: context.onProgress,
      withCredentials: options.withCredentials
    });

    try {
      return (options.mapResponse ?? defaultMapResponse)(response.body, response);
    } catch (error) {
      if (isImageUploadError(error) || isAbortError(error)) {
        throw error;
      }

      throw new ImageUploadError(
        'response_mapping_failed',
        'Upload response mapping failed.',
        {
          stage: 'response_mapping',
          method: 'POST',
          status: response.status,
          statusText: response.statusText,
          body: response.body,
          rawBody: response.rawBody
        },
        error instanceof Error ? { cause: error } : undefined
      );
    }
  };
}
