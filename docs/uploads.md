# Uploads

`image-drop-input` uploads the prepared `Blob` or `File` you give it.

It does not:

- create signed URLs by itself
- bundle a cloud SDK
- derive a public URL from an upload URL
- decide your storage key format

Those boundaries are intentional. They keep provider secrets, auth, and storage policy on your server.

## Adapter contract

An upload adapter receives the prepared file and context.

```ts
type UploadAdapter = (file: Blob, context: UploadContext) => Promise<UploadResult>;

type UploadContext = {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  fileName?: string;
  originalFileName?: string;
  mimeType?: string;
};

type UploadResult = {
  src?: string;
  key?: string;
  etag?: string;
  response?: unknown;
};
```

`src` and `key` become product state. `etag` and `response` are available for custom logic, but are not copied into `ImageUploadValue`.

## Presigned PUT

Use presigned PUT for S3, Cloudflare R2, GCS, Azure Blob, or similar object-storage flows.

```ts
import { createPresignedPutUploader } from 'image-drop-input/headless';

const upload = createPresignedPutUploader({
  async getTarget(file, context) {
    const response = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: context.fileName,
        originalFileName: context.originalFileName,
        mimeType: context.mimeType ?? file.type,
        size: file.size
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create upload URL.');
    }

    return response.json();
  }
});
```

Backend response shape:

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

Return `publicUrl` when the uploaded image can be rendered immediately. Return `objectKey` when your app resolves the image later.

### Header matching

Presigned URLs are sensitive to the exact request shape. If your server signs `Content-Type`, custom metadata, or provider headers such as `x-amz-*`, return those same headers in `headers`.

The built-in presigned uploader sends the prepared file with exactly the `headers` returned by `getTarget`. A common mismatch is signing `Content-Type: image/jpeg` before a WebP transform, then uploading a prepared `image/webp` file. Use `context.mimeType ?? file.type` when creating the presign request, and sign the same value you return in `headers`.

## Multipart POST

Use multipart POST when an application server receives `FormData`.

```ts
import { createMultipartUploader } from 'image-drop-input/headless';

const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file',
  mapResponse(body) {
    const result = body as { imageUrl: string; imageKey: string };

    return {
      src: result.imageUrl,
      key: result.imageKey
    };
  }
});
```

## Raw PUT

Use raw PUT for a direct endpoint that accepts the prepared image bytes.

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: '/api/avatar',
  publicUrl: '/avatars/current-user.jpg',
  objectKey: 'avatars/current-user.jpg'
});
```

## Custom adapter

Use a custom adapter when your upload flow has extra auth, telemetry, or response mapping needs.

```ts
import type { UploadAdapter } from 'image-drop-input';

const upload: UploadAdapter = async (file, context) => {
  const response = await fetch('/api/images', {
    method: 'PUT',
    body: file,
    signal: context.signal
  });

  if (!response.ok) {
    throw new Error('Upload failed.');
  }

  const body = (await response.json()) as { url: string; key: string };

  return {
    src: body.url,
    key: body.key
  };
};
```

## Progress

Adapters may call `context.onProgress(percent)`.

Successful uploads finish with `100`, even if the adapter did not emit `100` itself.

## Abort signal

`context.signal` is passed to built-in request helpers. Custom adapters should pass it to `fetch()` or equivalent request code so cancellation works.

## Why URLs stay explicit

Signed upload URLs are often temporary, private, scoped, or host-specific. A public image URL may be on another domain, require a CDN rewrite, or not exist yet.

That is why the package never guesses public URLs from upload URLs.
