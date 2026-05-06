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

`null` and `undefined` inputs return `null` from this submit helper so optional image fields can be normalized before serialization.

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
import {
  isImagePersistableValueError,
  toPersistableImageValue
} from 'image-drop-input';

try {
  const image = toPersistableImageValue(value);
  await save({ image });
} catch (error) {
  if (isImagePersistableValueError(error)) {
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

Because this assertion does not mutate the original object, it rejects values that still contain `previewSrc`. Use `toPersistableImageValue()` for raw component values.

`null` is accepted by the guard helpers as an already-normalized empty image value. `undefined` is rejected by the assertion/type guard path so TypeScript narrowing cannot hide an unnormalized variable.

## Temporary URL escape hatches

Temporary URL schemes are rejected by default. If your product intentionally persists one of these schemes, opt in explicitly:

```ts
toPersistableImageValue(value, {
  allowDataUrl: true,
  allowBlobUrl: true,
  allowFilesystemUrl: true
});
```

`allowBlobUrl` only affects `blob:` URLs. `filesystem:` requires `allowFilesystemUrl`.

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

## Server schema handoff

The client guard keeps browser state out of the request. The server schema decides whether the durable reference is allowed.

Use the [Zod schema recipe](./recipes/server-persistable-image-zod.md) or the [custom validator recipe](./recipes/server-persistable-image-custom.md) to mirror the submit-boundary rules without adding a runtime schema dependency to this package.

At minimum, the server-side contract should:

- accept `null` for optional image fields
- reject `previewSrc`
- reject `blob:`, `filesystem:`, and `data:` `src` values
- require at least one durable reference: `src` or `key`
- validate `size`, `width`, and `height` metadata
- restrict MIME types to the product field policy
- optionally require `key` for private buckets

Shape validation is still not product authority. After parsing, the server must verify user authorization, record ownership, storage object existence, draft/final state, and storage policy. Never trust `previousKey` from the browser as authority for cleanup; load the current product record first.

## Common mistakes

Do not save `previewSrc`. It is usually a local `blob:` URL.

Do not save a `blob:` URL in `src`.

Do not infer a public image URL from a signed upload URL. Return the durable `src` or `key` from your backend.

Do not treat a draft object key as final product state unless your backend contract says it is final. Draft commit and cleanup belong to the draft lifecycle layer.
