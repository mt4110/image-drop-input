import { sendUploadRequest } from './request';
import { ImageUploadError, isAbortError, isImageUploadError } from './errors';
import type {
  CreatePresignedPutUploaderOptions,
  PresignedPutTarget,
  UploadAdapter,
  UploadRequestFn,
  UploadResult
} from './types';

export async function uploadWithSignedTarget(
  file: Blob,
  target: PresignedPutTarget,
  signal?: AbortSignal,
  request: UploadRequestFn = sendUploadRequest,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const response = await request({
    method: 'PUT',
    url: target.uploadUrl,
    headers: target.headers,
    body: file,
    signal,
    onProgress
  });

  return {
    src: target.publicUrl,
    key: target.objectKey,
    etag: response.headers.get('etag') ?? undefined,
    response: response.body
  };
}

export function createPresignedPutUploader(
  options: CreatePresignedPutUploaderOptions
): UploadAdapter {
  return async (file, context) => {
    let target: PresignedPutTarget;

    try {
      target = await options.getTarget(file, context);
    } catch (error) {
      if (isImageUploadError(error) || isAbortError(error)) {
        throw error;
      }

      throw new ImageUploadError(
        'target_failed',
        'Upload target resolution failed.',
        { stage: 'target' },
        error instanceof Error ? { cause: error } : undefined
      );
    }

    return uploadWithSignedTarget(
      file,
      target,
      context.signal,
      options.request ?? sendUploadRequest,
      context.onProgress
    );
  };
}
