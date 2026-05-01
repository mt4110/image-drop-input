import '../setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMultipartUploader } from '../../src/upload/create-multipart-uploader';
import { createPresignedPutUploader } from '../../src/upload/create-presigned-put-uploader';
import { createRawPutUploader } from '../../src/upload/create-raw-put-uploader';
import { ImageUploadError, isImageUploadError } from '../../src/upload/errors';
import { sendUploadRequest } from '../../src/upload/request';

describe('upload adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uploads to a signed target without inferring the provider', async () => {
    const getTarget = vi.fn(async () => ({
      uploadUrl: 'https://upload.example.com/avatar.png?signature=abc',
      headers: { 'x-ms-blob-type': 'BlockBlob' },
      publicUrl: 'https://cdn.example.com/avatar.png',
      objectKey: 'avatars/avatar.png'
    }));
    const request = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ etag: 'etag-123' }),
      body: { ok: true }
    }));

    const upload = createPresignedPutUploader({
      getTarget,
      request
    });

    const file = new File(['hello'], 'avatar-optimized.png', { type: 'image/png' });
    const context = {
      fileName: 'avatar-optimized.png',
      originalFileName: 'avatar.png',
      mimeType: 'image/png',
      onProgress: vi.fn()
    };

    const result = await upload(file, context);

    expect(getTarget).toHaveBeenCalledWith(file, context);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: 'https://upload.example.com/avatar.png?signature=abc',
        headers: { 'x-ms-blob-type': 'BlockBlob' }
      })
    );
    expect(result).toEqual({
      src: 'https://cdn.example.com/avatar.png',
      key: 'avatars/avatar.png',
      etag: 'etag-123',
      response: { ok: true }
    });
  });

  it('maps multipart responses into the public upload shape', async () => {
    const request = vi.fn(async () => ({
      status: 201,
      statusText: 'Created',
      headers: new Headers({ etag: 'etag-456' }),
      body: {
        publicUrl: 'https://cdn.example.com/avatar-2.png',
        objectKey: 'avatars/avatar-2.png'
      }
    }));

    const upload = createMultipartUploader({
      endpoint: '/api/upload',
      request
    });

    const result = await upload(new File(['hello'], 'avatar.png', { type: 'image/png' }), {});

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/upload'
      })
    );
    expect(result).toEqual({
      src: 'https://cdn.example.com/avatar-2.png',
      key: 'avatars/avatar-2.png',
      etag: 'etag-456',
      response: {
        publicUrl: 'https://cdn.example.com/avatar-2.png',
        objectKey: 'avatars/avatar-2.png'
      }
    });
  });

  it('passes the transformed filename through multipart uploads', async () => {
    const appendSpy = vi.spyOn(FormData.prototype, 'append');
    const request = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: {}
    }));

    const upload = createMultipartUploader({
      endpoint: '/api/upload',
      request
    });

    await upload(new Blob(['hello'], { type: 'image/webp' }), {
      fileName: 'avatar.webp'
    });

    expect(appendSpy).toHaveBeenCalledWith('file', expect.any(Blob), 'avatar.webp');
  });

  it('sets a default Content-Type for raw PUT uploads', async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ etag: 'etag-789' }),
      body: { ok: true }
    }));

    const upload = createRawPutUploader({
      endpoint: 'https://upload.example.com/avatar.png',
      request
    });

    const result = await upload(new Blob(['hello'], { type: 'image/png' }), {});

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: 'https://upload.example.com/avatar.png',
        headers: {
          'Content-Type': 'image/png'
        }
      })
    );
    expect(result).toEqual({
      src: undefined,
      key: undefined,
      etag: 'etag-789',
      response: { ok: true }
    });
  });

  it('reports built-in HTTP request failures as structured upload errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ error: 'too_large' }),
        {
          status: 413,
          statusText: 'Payload Too Large',
          headers: { 'Content-Type': 'application/json' }
        }
      ))
    );

    await expect(
      sendUploadRequest({
        method: 'PUT',
        url: 'https://upload.example.com/private.png?signature=secret',
        body: new Blob(['hello'], { type: 'image/png' })
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'http_error',
      message: 'Upload failed: 413 Payload Too Large',
      details: {
        stage: 'request',
        method: 'PUT',
        status: 413,
        statusText: 'Payload Too Large',
        body: { error: 'too_large' },
        rawBody: '{"error":"too_large"}'
      }
    });
  });

  it('reports unavailable requests and network failures as structured upload errors', async () => {
    vi.stubGlobal('fetch', undefined);

    await expect(
      sendUploadRequest({
        method: 'POST',
        url: '/api/upload',
        body: new FormData()
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'request_unavailable',
      details: {
        stage: 'request',
        method: 'POST'
      }
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      })
    );

    await expect(
      sendUploadRequest({
        method: 'PUT',
        url: '/api/upload',
        body: new Blob(['hello'])
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'network_error',
      details: {
        stage: 'request',
        method: 'PUT'
      }
    });
  });

  it('reports fetch response body read failures as structured upload errors', async () => {
    const bodyFailure = new TypeError('body stream failed');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn(async () => {
          throw bodyFailure;
        })
      }))
    );

    await expect(
      sendUploadRequest({
        method: 'PUT',
        url: '/api/upload',
        body: new Blob(['hello'])
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'network_error',
      message: 'Upload failed due to a network error.',
      details: {
        stage: 'request',
        method: 'PUT',
        status: 200,
        statusText: 'OK'
      },
      cause: bodyFailure
    });

    const errorBodyFailure = new TypeError('error body stream failed');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        headers: new Headers(),
        text: vi.fn(async () => {
          throw errorBodyFailure;
        })
      }))
    );

    await expect(
      sendUploadRequest({
        method: 'POST',
        url: '/api/upload',
        body: new FormData()
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'http_error',
      message: 'Upload failed: 413 Payload Too Large',
      details: {
        stage: 'request',
        method: 'POST',
        status: 413,
        statusText: 'Payload Too Large'
      },
      cause: errorBodyFailure
    });
  });

  it('reports XHR setup failures as structured upload errors', async () => {
    const setupFailure = new Error('invalid upload request');

    class ThrowingXMLHttpRequest {
      upload = {};

      open() {
        throw setupFailure;
      }
    }

    vi.stubGlobal('XMLHttpRequest', ThrowingXMLHttpRequest);

    await expect(
      sendUploadRequest({
        method: 'PUT',
        url: 'https://upload.example.com/avatar.png',
        body: new Blob(['hello']),
        onProgress: vi.fn()
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'network_error',
      message: 'Upload failed due to a network error.',
      details: {
        stage: 'request',
        method: 'PUT'
      },
      cause: setupFailure
    });
  });

  it('reports XHR network events as structured upload errors', async () => {
    class NetworkErrorXMLHttpRequest {
      upload = {};
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      open() {}

      setRequestHeader() {}

      getAllResponseHeaders() {
        return '';
      }

      abort() {}

      send() {
        this.onerror?.();
      }
    }

    vi.stubGlobal('XMLHttpRequest', NetworkErrorXMLHttpRequest);

    await expect(
      sendUploadRequest({
        method: 'PUT',
        url: 'https://upload.example.com/avatar.png',
        body: new Blob(['hello']),
        onProgress: vi.fn()
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'network_error',
      message: 'Upload failed due to a network error.',
      details: {
        stage: 'request',
        method: 'PUT'
      }
    });
  });

  it('reports XHR non-2xx load events as structured upload errors', async () => {
    class HttpErrorXMLHttpRequest {
      upload = {};
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      responseText = '{"error":"forbidden"}';
      status = 403;
      statusText = 'Forbidden';

      open() {}

      setRequestHeader() {}

      getAllResponseHeaders() {
        return 'content-type: application/json\r\n';
      }

      abort() {}

      send() {
        this.onload?.();
      }
    }

    vi.stubGlobal('XMLHttpRequest', HttpErrorXMLHttpRequest);

    await expect(
      sendUploadRequest({
        method: 'POST',
        url: '/api/upload',
        body: new FormData(),
        onProgress: vi.fn()
      })
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'http_error',
      message: 'Upload failed: 403 Forbidden',
      details: {
        stage: 'request',
        method: 'POST',
        status: 403,
        statusText: 'Forbidden',
        body: { error: 'forbidden' },
        rawBody: '{"error":"forbidden"}'
      }
    });
  });

  it('wraps presign and response mapping failures without hiding structured errors', async () => {
    const targetFailure = new Error('presign denied');
    const presignedUpload = createPresignedPutUploader({
      getTarget: vi.fn(async () => {
        throw targetFailure;
      })
    });

    await expect(
      presignedUpload(new Blob(['hello'], { type: 'image/png' }), {})
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'target_failed',
      message: 'Upload target resolution failed.',
      details: {
        stage: 'target'
      },
      cause: targetFailure
    });

    const structuredFailure = new ImageUploadError(
      'target_failed',
      'Custom target failure.',
      { stage: 'target' }
    );
    const passthroughUpload = createPresignedPutUploader({
      getTarget: vi.fn(async () => {
        throw structuredFailure;
      })
    });

    await expect(
      passthroughUpload(new Blob(['hello'], { type: 'image/png' }), {})
    ).rejects.toBe(structuredFailure);

    const multipartUpload = createMultipartUploader({
      endpoint: '/api/upload',
      request: vi.fn(async () => ({
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        body: { ok: true },
        rawBody: '{"ok":true}'
      })),
      mapResponse() {
        throw new Error('bad response shape');
      }
    });

    await expect(
      multipartUpload(new Blob(['hello'], { type: 'image/png' }), {})
    ).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'response_mapping_failed',
      message: 'Upload response mapping failed.',
      details: {
        stage: 'response_mapping',
        method: 'POST',
        status: 201,
        statusText: 'Created',
        body: { ok: true },
        rawBody: '{"ok":true}'
      }
    });
  });

  it('narrows structurally valid upload errors', () => {
    const error = new ImageUploadError(
      'http_error',
      'Upload failed: 500 Server Error',
      {
        stage: 'request',
        method: 'PUT',
        status: 500,
        statusText: 'Server Error',
        rawBody: 'nope'
      }
    );

    expect(isImageUploadError(error)).toBe(true);
    expect(
      isImageUploadError({
        name: 'ImageUploadError',
        message: 'Upload failed.',
        code: 'http_error',
        details: {
          stage: 'request',
          method: 'DELETE',
          status: 500
        }
      })
    ).toBe(false);
  });
});
