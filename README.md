# image-drop-input

[![npm version](https://img.shields.io/npm/v/image-drop-input.svg)](https://www.npmjs.com/package/image-drop-input)
[![CI](https://github.com/mt4110/image-drop-input/actions/workflows/ci.yml/badge.svg)](https://github.com/mt4110/image-drop-input/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/image-drop-input.svg)](https://www.npmjs.com/package/image-drop-input)
[![license](https://img.shields.io/npm/l/image-drop-input.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/image-drop-input)](https://bundlephobia.com/package/image-drop-input)

Preview, validate, compress, and upload a single image safely before your form ever submits.

**Built for:** avatars, CMS thumbnails, article covers, product images, and admin forms.

[Demo](https://mt4110.github.io/image-drop-input/) · [Docs](./docs/README.md) · [Recipes](#recipes) · [Japanese README](./README.ja.md) · [Issues](https://github.com/mt4110/image-drop-input/issues)

![image-drop-input demo showing preview, prepared metadata, and upload state](./docs/assets/demo-light.png)

## Why this exists

A normal file input gives you a `File`.

A product image field usually needs more:

- show a local preview immediately
- reject unsupported types and unsafe sizes
- compress before upload
- keep temporary `blob:` previews out of saved state
- upload through signed URLs without bundling a cloud SDK
- recover cleanly when upload fails
- stay keyboard-accessible

`image-drop-input` is a small React image input for that pre-upload flow.

## Install

```bash
npm install image-drop-input react
```

Import the default CSS once:

```tsx
import 'image-drop-input/style.css';
```

## Runtime support

The package separates the repo toolchain from the install floor for apps that consume the published tarball.

| Layer | Policy |
| --- | --- |
| Maintainer toolchain | Node 22.x with the npm version pinned by `packageManager`. This is for contributors running the full repo, examples, and release checks. |
| Published package consumers | Node `>=18.18.0` for package install, type resolution, and CJS/ESM subpath loading. React is a peer dependency. |

The library is built to ES2020 and keeps cloud SDKs out of the bundle. CI verifies the packed package in Node 18.18.x, 20.x, and 22.x without running the root repo install in those consumer jobs.

## 30-second quick start

Use it as a local-preview-only image input:

```tsx
import { useState } from 'react';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';
import 'image-drop-input/style.css';

export function AvatarField() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <ImageDropInput
      value={value}
      onChange={setValue}
      accept="image/png,image/jpeg,image/webp"
      aspectRatio={1}
      outputMaxBytes={5 * 1024 * 1024}
    />
  );
}
```

Users can drop an image, browse for one, paste from the clipboard, preview it, and remove or replace it.

## Choose image-drop-input when...

Use it when you need one image field that can be safely stored in product state:

- profile avatar
- workspace logo
- article cover
- CMS thumbnail
- product image
- admin form image

Use a larger uploader when you need queues, resumable uploads, remote file sources, or multi-file orchestration.

## What it handles

| Area | What happens |
| --- | --- |
| Input | drop, browse, paste, replace, remove |
| Preview | local `blob:` preview separated from persisted `src` |
| Validation | type, byte budget, dimensions, pixel budget |
| Transform | compress, resize, convert before upload |
| Upload | presigned PUT, multipart POST, raw PUT, custom adapter |
| Accessibility | keyboard operation, paste support, dialog focus behavior |
| Packaging | React peer dependency only, no cloud SDK, no UI framework |

## The image state model

`image-drop-input` keeps temporary UI state separate from persisted product state.

```ts
type ImageUploadValue = {
  src?: string;        // persisted or shareable image URL
  previewSrc?: string; // temporary local preview, usually blob:
  key?: string;        // object key from your storage layer
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};
```

```txt
selected local file     -> previewSrc
successful upload URL   -> src
storage object key      -> key
failed upload           -> previous committed value remains safe
```

`blob:` URLs are for UI feedback. They are not database values.

Read the full state model in [docs/value-model.md](./docs/value-model.md).

## Validation and byte limits

Validation runs before and after `transform`.

| Prop | Stage | Use case |
| --- | --- | --- |
| `inputMaxBytes` | before transform | reject huge source files |
| `outputMaxBytes` | after transform | enforce upload budget |
| `maxBytes` | both | compatibility shortcut |

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

Dimension and pixel-budget validation also runs after `transform`, so `onChange` receives metadata for the prepared file.

Read the details in [docs/validation.md](./docs/validation.md).

## Upload recipes

Upload wiring is explicit by design. The package does not create signed URLs, bundle provider SDKs, or infer public URLs from upload URLs.

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

Your endpoint should return `publicUrl` or `objectKey` explicitly:

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

See [docs/uploads.md](./docs/uploads.md) for presigned PUT, multipart POST, raw PUT, custom adapters, progress, and abort behavior.

## Transform recipes

Use `transform` when you want to resize, compress, or convert the image before preview and upload.

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  value={value}
  onChange={setValue}
  accept="image/png,image/jpeg,image/webp"
  transform={async (file) => ({
    file: await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      outputType: 'image/webp',
      quality: 0.86
    }),
    fileName: file.name.replace(/\.(png|jpe?g|webp)$/i, '.webp'),
    mimeType: 'image/webp'
  })}
/>
```

Explicit `outputType` requests are checked after canvas encoding. If the browser cannot encode the requested type, `compressImage()` rejects instead of returning mismatched bytes and MIME metadata.

Read more in [docs/transforms.md](./docs/transforms.md).

## Recipes

- [Local preview](./docs/recipes/local-preview.md)
- [Avatar field](./docs/recipes/avatar.md)
- [Compression](./docs/recipes/compression.md)
- [WebP transform](./docs/recipes/webp.md)
- [Presigned PUT](./docs/recipes/presigned-put.md)
- [Multipart POST](./docs/recipes/multipart-post.md)
- [Raw PUT](./docs/recipes/raw-put.md)
- [Headless UI](./docs/recipes/headless-ui.md)

## How it fits with other upload tools

| Need | Good fit |
| --- | --- |
| Build a custom file drop area | `react-dropzone` |
| Full multi-file uploader with queues | Uppy / FilePond / Dropzone |
| One product image field with preview, validation, transform, and explicit signed uploads | `image-drop-input` |

## Accessibility

The default component includes keyboard operation, paste support, action labels, status text, and a focus-managed preview dialog. The headless hook exposes the same behavior when you need custom markup.

Read the checklist in [docs/accessibility.md](./docs/accessibility.md).

## API

| Import | Exports |
| --- | --- |
| `image-drop-input` | `ImageDropInput`, UI props and render types, `ImageUploadValue`, upload types, validation error helpers |
| `image-drop-input/headless` | `useImageDropInput`, `compressImage`, `validateImage`, metadata helpers, upload factories |
| `image-drop-input/style.css` | default component styles |

```ts
import {
  ImageDropInput,
  ImageValidationError,
  isImageValidationError,
  type ImageDropInputProps,
  type ImageUploadValue,
  type UploadAdapter
} from 'image-drop-input';
```

```ts
import {
  compressImage,
  createMultipartUploader,
  createPresignedPutUploader,
  createRawPutUploader,
  useImageDropInput,
  validateImage,
  type UseImageDropInputReturn
} from 'image-drop-input/headless';
```

The root entry stays UI-first. Low-level utilities live under `/headless`.

## When not to use this

Use another tool if you need:

- a generic multi-file uploader
- resumable or chunked uploads
- drag sorting between lists
- full crop, rotate, or annotation editing
- provider-specific SDK wrappers
- Node-side image processing

This package is intentionally single-image first.

## Development

Development uses the maintainer toolchain above, which is intentionally stricter than the consumer install floor.

```bash
npm ci
npm run typecheck
npm test
npm run build:lib
npm run build:examples
npm run check:package
npm pack --dry-run
```

Release planning stays outside the npm package, so this README can stay focused on what works today.

## License

MIT
