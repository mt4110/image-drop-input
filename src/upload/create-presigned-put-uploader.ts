import { sendUploadRequest } from './request';
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
    const target = await options.getTarget(file, context);

    return uploadWithSignedTarget(
      file,
      target,
      context.signal,
      options.request ?? sendUploadRequest,
      context.onProgress
    );
  };
}
