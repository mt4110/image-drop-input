# Recipe: Presigned PUT

Use this when your backend returns a signed object-storage URL.

## Code

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
        mimeType: context.mimeType,
        size: file.size
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create upload URL.');
    }

    return response.json();
  }
});

<ImageDropInput value={value} onChange={setValue} upload={upload} />;
```

## Backend response shape

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

## Notes

The package does not infer public URLs.

Return `publicUrl` when the image can be rendered after upload. Return `objectKey` when your application resolves the final URL later.
