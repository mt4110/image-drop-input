# Recipe: Next.js presign route

Use this when a Next.js App Router route creates a signed object-storage upload target.

The route owns auth, storage policy, key generation, and public URL mapping. The client only asks for a target and then uploads the prepared image bytes.

## Client adapter

```tsx
import { ImageDropInput } from 'image-drop-input';
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

<ImageDropInput
  value={value}
  onChange={setValue}
  upload={upload}
  accept="image/png,image/jpeg,image/webp"
  outputMaxBytes={5 * 1024 * 1024}
/>;
```

## Route shape

```ts
// app/api/uploads/presign/route.ts
import { NextResponse, type NextRequest } from 'next/server';

type PresignRequest = {
  fileName?: string;
  originalFileName?: string;
  mimeType: string;
  size: number;
};

type PresignResponse = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};

export const runtime = 'nodejs';

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const allowedMimeTypes = new Set(Object.keys(extensionByMimeType));
const maxUploadBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<PresignRequest>;

  if (
    !body.mimeType ||
    !allowedMimeTypes.has(body.mimeType) ||
    typeof body.size !== 'number' ||
    body.size <= 0 ||
    body.size > maxUploadBytes
  ) {
    return NextResponse.json({ error: 'Invalid image upload request.' }, { status: 400 });
  }

  const objectKey = createObjectKey(body.mimeType);
  const headers = {
    'Content-Type': body.mimeType
  };
  const target = await createSignedPutTarget({
    objectKey,
    contentType: body.mimeType,
    size: body.size,
    headers
  });

  return NextResponse.json({
    uploadUrl: target.uploadUrl,
    headers,
    publicUrl: target.publicUrl,
    objectKey
  } satisfies PresignResponse);
}

function createObjectKey(mimeType: string) {
  const extension = extensionByMimeType[mimeType] ?? 'bin';

  return `uploads/${crypto.randomUUID()}.${extension}`;
}

async function createSignedPutTarget(options: {
  objectKey: string;
  contentType: string;
  size: number;
  headers: Record<string, string>;
}) {
  // Replace this with your storage SDK or internal upload service.
  // Sign the same headers that the client will send during the PUT.
  return {
    uploadUrl: await signPutUrl(options),
    publicUrl: mapObjectKeyToPublicUrl(options.objectKey)
  };
}

async function signPutUrl(_options: {
  objectKey: string;
  contentType: string;
  size: number;
  headers: Record<string, string>;
}) {
  throw new Error('Connect this route to your storage provider.');
}

function mapObjectKeyToPublicUrl(objectKey: string) {
  return `https://cdn.example.com/${objectKey}`;
}
```

## Response contract

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

Return `publicUrl` when the uploaded image can be rendered immediately. Return `objectKey` when your app resolves the image later.

Do not infer `publicUrl` from `uploadUrl`. Signed upload URLs are often temporary, private, scoped, or on a different host than your CDN.

## Header matching

Presigned URLs are sensitive to the exact request shape. If the route signs `Content-Type`, custom metadata, or provider headers such as `x-amz-*`, return those same headers in `headers`.

The built-in presigned uploader sends the prepared file with exactly the `headers` returned by `getTarget`. A common failure is signing `Content-Type: image/jpeg` before a WebP transform, then uploading a prepared `image/webp` file. Send `context.mimeType ?? file.type` from the client after transform, sign that same value, and return it in `headers`.
