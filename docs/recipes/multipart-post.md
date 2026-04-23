# Recipe: Multipart POST

Use this when your application server accepts a `FormData` upload.

## Code

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

## Notes

Use `mapResponse` when your backend response does not already match `UploadResult`.

The mapped `src` and `key` are the values that can become product state.
