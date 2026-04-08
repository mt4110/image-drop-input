import { sendUploadRequest } from './request';
import type { CreateRawPutUploaderOptions, UploadAdapter } from './types';

function withDefaultContentType(
  headers: Record<string, string> | undefined,
  contentType: string
): Record<string, string> {
  if (!headers) {
    return { 'Content-Type': contentType };
  }

  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');

  if (hasContentType) {
    return headers;
  }

  return {
    'Content-Type': contentType,
    ...headers
  };
}

export function createRawPutUploader(options: CreateRawPutUploaderOptions): UploadAdapter {
  return async (file, context) => {
    const response = await (options.request ?? sendUploadRequest)({
      method: 'PUT',
      url: options.endpoint,
      headers: withDefaultContentType(
        options.headers,
        context.mimeType || file.type || 'application/octet-stream'
      ),
      body: file,
      signal: context.signal,
      onProgress: context.onProgress,
      withCredentials: options.withCredentials
    });

    return {
      src: options.publicUrl,
      key: options.objectKey,
      etag: response.headers.get('etag') ?? undefined,
      response: response.body
    };
  };
}
