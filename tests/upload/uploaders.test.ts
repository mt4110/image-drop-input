import '../setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMultipartUploader } from '../../src/upload/create-multipart-uploader';
import { createPresignedPutUploader } from '../../src/upload/create-presigned-put-uploader';
import { createRawPutUploader } from '../../src/upload/create-raw-put-uploader';

describe('upload adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
