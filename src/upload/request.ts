import type { UploadRequest, UploadRequestFn, UploadResponse } from './types';
import { ImageUploadError, isAbortError } from './errors';

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The upload was aborted.', 'AbortError');
  }

  const error = new Error('The upload was aborted.');
  error.name = 'AbortError';
  return error;
}

function createNetworkError(
  request: UploadRequest,
  cause?: unknown,
  response?: Pick<UploadResponse, 'status' | 'statusText'>
): ImageUploadError {
  return new ImageUploadError(
    'network_error',
    'Upload failed due to a network error.',
    {
      stage: 'request',
      method: request.method,
      ...(response
        ? {
            status: response.status,
            statusText: response.statusText
          }
        : {})
    },
    cause instanceof Error ? { cause } : undefined
  );
}

function createHttpError(
  request: UploadRequest,
  response: Pick<UploadResponse, 'status' | 'statusText'>,
  body?: unknown,
  rawBody?: string,
  cause?: unknown
): ImageUploadError {
  return new ImageUploadError(
    'http_error',
    `Upload failed: ${response.status} ${response.statusText}`,
    {
      stage: 'request',
      method: request.method,
      status: response.status,
      statusText: response.statusText,
      ...(typeof body === 'undefined' ? {} : { body }),
      ...(typeof rawBody === 'undefined' ? {} : { rawBody })
    },
    cause instanceof Error ? { cause } : undefined
  );
}

function parseResponseBody(rawBody: string, headers: Headers): unknown {
  if (!rawBody) {
    return undefined;
  }

  const contentType = headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  return rawBody;
}

function parseHeaders(rawHeaders: string): Headers {
  const headers = new Headers();

  rawHeaders
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(':');

      if (separatorIndex <= 0) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      headers.append(key, value);
    });

  return headers;
}

async function readFetchResponseBody(response: Response, request: UploadRequest): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (!response.ok) {
      throw createHttpError(request, response, undefined, undefined, error);
    }

    throw createNetworkError(request, error, response);
  }
}

async function sendWithFetch(request: UploadRequest): Promise<UploadResponse> {
  if (typeof fetch !== 'function') {
    throw new ImageUploadError(
      'request_unavailable',
      'Upload request is unavailable in this environment.',
      {
        stage: 'request',
        method: request.method
      }
    );
  }

  let response: Response;

  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: request.signal,
      credentials: request.withCredentials ? 'include' : 'same-origin'
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw createNetworkError(request, error);
  }

  const rawBody = await readFetchResponseBody(response, request);
  const body = parseResponseBody(rawBody, response.headers);

  if (!response.ok) {
    throw createHttpError(request, response, body, rawBody);
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body,
    rawBody
  };
}

async function sendWithXhr(request: UploadRequest): Promise<UploadResponse> {
  if (typeof XMLHttpRequest === 'undefined') {
    return sendWithFetch(request);
  }

  if (request.signal?.aborted) {
    throw createAbortError();
  }

  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    try {
      xhr.open(request.method, request.url, true);

      if (request.withCredentials) {
        xhr.withCredentials = true;
      }

      Object.entries(request.headers ?? {}).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    } catch (error) {
      reject(createNetworkError(request, error));
      return;
    }

    const cleanup = () => {
      request.signal?.removeEventListener('abort', handleAbort);
      xhr.upload.onprogress = null;
      xhr.onerror = null;
      xhr.onabort = null;
      xhr.onload = null;
    };

    const handleAbort = () => {
      cleanup();
      xhr.abort();
      reject(createAbortError());
    };

    request.signal?.addEventListener('abort', handleAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (!request.onProgress || !event.lengthComputable || event.total === 0) {
        return;
      }

      request.onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => {
      cleanup();
      reject(createNetworkError(request));
    };

    xhr.onabort = () => {
      cleanup();
      reject(createAbortError());
    };

    xhr.onload = () => {
      cleanup();

      const headers = parseHeaders(xhr.getAllResponseHeaders());
      const rawBody = xhr.responseText ?? '';
      const body = parseResponseBody(rawBody, headers);

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(createHttpError(request, xhr, body, rawBody));
        return;
      }

      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        headers,
        body,
        rawBody
      });
    };

    try {
      xhr.send(request.body);
    } catch (error) {
      cleanup();
      reject(createNetworkError(request, error));
    }
  });
}

export const sendUploadRequest: UploadRequestFn = async (request) => {
  if (request.onProgress) {
    return sendWithXhr(request);
  }

  return sendWithFetch(request);
};
