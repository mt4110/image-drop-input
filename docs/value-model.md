# Value model

The most important design rule is simple:

`src` is persisted or shareable state. `previewSrc` is temporary UI state.

```ts
type ImageUploadValue = {
  src?: string;
  previewSrc?: string;
  key?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};
```

## `src`

Use `src` for an image reference that can safely be stored, shared, or rendered later.

Typical examples:

- a CDN URL returned by your API
- a public object-storage URL returned from a presign endpoint
- an existing image URL loaded from a database

## `previewSrc`

Use `previewSrc` for immediate UI feedback. Local selections usually create a `blob:` URL.

`blob:` URLs should not be stored in a database. They are browser-local, temporary, and usually revoked when the component no longer needs them.

## `key`

Use `key` for the storage object identifier returned by your backend or object-storage workflow.

Some systems do not expose public image URLs immediately. In those cases, an upload adapter may return only a `key`, and the component keeps the local `previewSrc` for display.

## Metadata

`fileName`, `mimeType`, `size`, `width`, and `height` describe the prepared file after transform.

That means a large camera image can be accepted, compressed, and emitted as smaller output metadata.

## Local-only selection

When no `upload` adapter is provided, the component returns a local preview value:

```txt
selected file -> validate -> transform -> previewSrc
```

The emitted value is useful for local form previews, but `previewSrc` is still not persisted state.

## Upload returns `src`

When upload succeeds and the result includes `src`, the component commits the persisted image URL:

```txt
selected file -> previewSrc while uploading -> src after upload
```

Use this when the backend can return a durable public or application URL.

## Upload returns `key` only

When upload succeeds and the result includes only `key`, the component commits the object key and keeps the local preview separate:

```txt
selected file -> previewSrc
upload result -> key
```

This is useful when another API resolves the final public image URL later.

## Failed upload behavior

If upload fails, the draft preview is discarded and the previous committed value remains safe. Retry sends the same prepared file again.

That behavior prevents a product form from accidentally treating an unuploaded local preview as saved image state.

## Common mistakes

Do not save `previewSrc` to your database.

Do not infer a public URL from a signed upload URL.

Do not treat `key` as a browser-renderable image URL unless your application explicitly resolves it.

Do not add multi-image ordering to the component value. Keep arrays and sorting in your product layer.
