import type { MaybePromise } from '../core/types';

export interface UploadResult {
  src?: string;
  key?: string;
  etag?: string;
  response?: unknown;
}

export interface UploadContext {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  fileName?: string;
  originalFileName?: string;
  mimeType?: string;
}

export type UploadAdapter = (file: Blob, context: UploadContext) => Promise<UploadResult>;

export interface UploadRequest {
  method: 'POST' | 'PUT';
  url: string;
  headers?: Record<string, string>;
  body: Blob | FormData;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  withCredentials?: boolean;
}

export interface UploadResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body?: unknown;
  rawBody?: string;
}

export type UploadRequestFn = (request: UploadRequest) => Promise<UploadResponse>;

export interface PresignedPutTarget {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
}

export interface CreatePresignedPutUploaderOptions {
  getTarget: (file: Blob, context: UploadContext) => MaybePromise<PresignedPutTarget>;
  request?: UploadRequestFn;
}

export interface CreateRawPutUploaderOptions {
  endpoint: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
  request?: UploadRequestFn;
  withCredentials?: boolean;
}

export interface CreateMultipartUploaderOptions {
  endpoint: string;
  fieldName?: string;
  headers?: Record<string, string>;
  request?: UploadRequestFn;
  withCredentials?: boolean;
  mapResponse?: (body: unknown, response: UploadResponse) => UploadResult;
}
