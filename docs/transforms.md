# Transforms

Transforms run before preview and upload.

They may return:

```ts
Blob | File | { file: Blob | File; fileName?: string; mimeType?: string }
```

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
