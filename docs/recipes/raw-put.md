# Recipe: Raw PUT

Use this when your endpoint accepts the prepared image bytes directly.

## Code

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: '/api/avatar',
  publicUrl: '/avatars/current-user.jpg',
  objectKey: 'avatars/current-user.jpg'
});
```

## Notes

Use `publicUrl` only when the final URL is known.

Use `objectKey` when your backend or product state needs a storage identifier.
