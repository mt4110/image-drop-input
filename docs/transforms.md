# Transforms

Transforms run before preview and upload.

They may return:

```ts
Blob | File | { file: Blob | File; fileName?: string; mimeType?: string }
```

## Browser-only boundary

Transforms run from the browser image input flow. The built-in `compressImage()` helper uses browser image decoding and canvas encoding, so it is not a Node, Server Component, or route-handler image pipeline.

Keep server work focused on presign, auth, persistence, and storage policy. If your product needs server-side image processing, run that as a separate upload pipeline after the browser has submitted the file.

## Basic compression

```tsx
import { ImageDropInput } from 'image-drop-input';
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  inputMaxBytes={20 * 1024 * 1024}
  outputMaxBytes={5 * 1024 * 1024}
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>
```

When you need the prepared image to fit a byte budget instead of guessing a quality value, use [`prepareImageToBudget()`](./byte-budget.md).

## WebP conversion

When changing the output format, keep the file name and MIME metadata consistent.

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  accept="image/png,image/jpeg,image/webp"
  transform={async (file) => ({
    file: await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 900,
      outputType: 'image/webp',
      quality: 0.86
    }),
    fileName: file.name.replace(/\.(png|jpe?g|webp)$/i, '.webp'),
    mimeType: 'image/webp'
  })}
/>
```

## Browser encoding caveat

`compressImage()` uses browser canvas encoding.

Explicit output types are checked after encoding. If the browser cannot encode the requested type, `compressImage()` rejects instead of returning a blob whose bytes and MIME metadata disagree.

## File name and MIME consistency

If `transform` returns a plain `Blob`, the component keeps the original file name and uses the blob type when available.

Return `{ file, fileName, mimeType }` when format conversion should be visible in emitted metadata and upload context.

## Validation after transform

The prepared file is validated after transform. This is where `outputMaxBytes`, final dimensions, MIME type, and pixel budget are enforced.

That means `onChange` describes the exact file that was previewed or uploaded.

`previewSrc` remains temporary UI state even after transform. Persist upload results such as `src`, `key`, and metadata instead of storing a local `blob:` URL.
