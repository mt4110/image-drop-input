# Persistable value guard

`ImageUploadValue` can contain browser-only preview state. Product payloads should not.

Use `toPersistableImageValue()` at the submit boundary to keep temporary fields out of your API request or database row.

```tsx
import { toPersistableImageValue, type ImageUploadValue } from 'image-drop-input';

async function submitProfile(value: ImageUploadValue | null) {
  const image = toPersistableImageValue(value);

  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image })
  });
}
```

## What it keeps

`toPersistableImageValue()` copies only durable image fields:

```ts
type PersistableImageValue = {
  src?: string;
  key?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};
```

It never returns `previewSrc`.

## What it rejects

By default, the helper rejects values that cannot safely represent product state:

- values with only `previewSrc`
- `src` values using `blob:`
- `src` values using `filesystem:`
- `src` values using `data:`
- values with neither `src` nor `key`
- invalid metadata such as negative `size` or `width: 0`

```tsx
import { ImagePersistableValueError, toPersistableImageValue } from 'image-drop-input';

try {
  const image = toPersistableImageValue(value);
  await save({ image });
} catch (error) {
  if (error instanceof ImagePersistableValueError) {
    // Show product-specific copy or log error.code.
  }
}
```

## Runtime guards

Use `isPersistableImageValue()` when you only need a boolean check.

```ts
if (!isPersistableImageValue(value)) {
  throw new Error('Image is not ready to save.');
}
```

Use `assertPersistableImageValue()` when a caller already owns sanitization and only needs validation. It does not remove `previewSrc`; `toPersistableImageValue()` is the safer submit helper.

```ts
assertPersistableImageValue(payload.image);
```

## React Hook Form example

```tsx
import { toPersistableImageValue, type ImageUploadValue } from 'image-drop-input';

async function onSubmit(form: { name: string; image: ImageUploadValue | null }) {
  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name,
      image: toPersistableImageValue(form.image)
    })
  });
}
```

## Next.js server payload

Your route should receive a persistable image value, not a browser preview.

```ts
type ProfilePayload = {
  name: string;
  image: {
    src?: string;
    key?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
  } | null;
};
```

Validate the payload again on the server with your own schema. This package keeps browser state out of the client payload, but the server still owns authorization, storage policy, and persistence.

## Common mistakes

Do not save `previewSrc`. It is usually a local `blob:` URL.

Do not save a `blob:` URL in `src`.

Do not infer a public image URL from a signed upload URL. Return the durable `src` or `key` from your backend.

Do not treat a draft object key as final product state unless your backend contract says it is final. Draft commit and cleanup belong to the draft lifecycle layer.
