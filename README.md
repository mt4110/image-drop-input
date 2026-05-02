# image-drop-input

[![npm version](https://img.shields.io/npm/v/image-drop-input.svg)](https://www.npmjs.com/package/image-drop-input)
[![CI](https://github.com/mt4110/image-drop-input/actions/workflows/ci.yml/badge.svg)](https://github.com/mt4110/image-drop-input/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/image-drop-input.svg)](https://www.npmjs.com/package/image-drop-input)
[![license](https://img.shields.io/npm/l/image-drop-input.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/image-drop-input)](https://bundlephobia.com/package/image-drop-input)

Preview, validate, compress, and upload a single image safely before your form ever submits.

**Built for:** avatars, CMS thumbnails, article covers, product images, and admin forms.

[Demo](https://mt4110.github.io/image-drop-input/) · [Docs](./docs/README.md) · [Recipes](#recipes) · [Usage reports](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml) · [Japanese README](./README.ja.md) · [Issues](https://github.com/mt4110/image-drop-input/issues)

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

## Native input vs image-drop-input

| Need | Native `<input type="file">` | `image-drop-input` |
| --- | --- | --- |
| Local preview | Manual object URL handling | Built-in `previewSrc` pattern |
| Validation before and after compression | Manual | Built-in |
| `src` vs `previewSrc` separation | Manual convention | Explicit value model |
| Signed upload wiring | Manual | Upload adapter contract |
| Paste support | Manual | Included |
| Keyboard and dialog behavior | Browser default only | Included in the default surface |

## Install

```bash
npm install image-drop-input react
```

Import the default CSS once:

```tsx
import 'image-drop-input/style.css';
```

## Browser/client boundary

`ImageDropInput` is a browser component. In Next.js App Router, render it from a Client Component with `'use client'`; keep server work in routes, server actions, or loaders.

The built-in transform helpers use browser image decoding and canvas encoding. Run presign, auth, persistence, and storage policy on the server, but keep `transform` and `previewSrc` handling in the browser. Persist `src`, `key`, and metadata after upload; do not save `previewSrc`.

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

## Persist only durable image state

Before a form payload reaches your API, strip browser-only preview fields and reject temporary image URLs:

```tsx
import { toPersistableImageValue } from 'image-drop-input';

async function submitProfile() {
  const image = toPersistableImageValue(value);

  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image })
  });
}
```

`toPersistableImageValue()` never returns `previewSrc`, rejects `blob:` / `filesystem:` / `data:` `src` values by default, and accepts durable `src` or `key` references.

Read the submit-boundary guide in [docs/persistable-value.md](./docs/persistable-value.md).

## Validation and byte limits

Validation runs before and after `transform`.

| Prop | Stage | Use case |
| --- | --- | --- |
| `inputMaxBytes` | before transform | reject huge source files |
| `outputMaxBytes` | after transform | enforce upload budget |
| `maxBytes` | both | compatibility shortcut |

```tsx
import { ImageDropInput } from 'image-drop-input';
import { prepareImageToBudget } from 'image-drop-input/headless';

<ImageDropInput
  inputMaxBytes={20 * 1024 * 1024}
  outputMaxBytes={500_000}
  transform={async (file) => {
    const prepared = await prepareImageToBudget(file, {
      outputMaxBytes: 500_000,
      outputType: 'image/webp',
      maxWidth: 1600,
      maxHeight: 1600
    });

    return {
      file: prepared.file,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType
    };
  }}
/>
```

Dimension and pixel-budget validation also runs after `transform`, so `onChange` receives metadata for the prepared file.

Read the details in [docs/validation.md](./docs/validation.md) and the deterministic byte-budget guide in [docs/byte-budget.md](./docs/byte-budget.md).

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

## Upload error handling

Built-in upload helpers throw `ImageUploadError` with stable `code` and `details` fields. Use `isImageUploadError()` for product copy, retry labels, and telemetry instead of parsing English messages.

```tsx
import { ImageDropInput, isImageUploadError } from 'image-drop-input';

function toUploadMessage(error: Error) {
  if (!isImageUploadError(error)) {
    return 'Could not prepare this image.';
  }

  if (error.code === 'http_error' && error.details.status === 413) {
    return 'This image is too large for the upload endpoint.';
  }

  if (error.code === 'network_error') {
    return 'The network dropped the upload. Please try again.';
  }

  return 'Image upload failed. Please try again.';
}

<ImageDropInput
  value={value}
  onChange={setValue}
  upload={upload}
  onError={(error) => {
    if (isImageUploadError(error)) {
      reportUploadFailure({
        code: error.code,
        stage: error.details.stage,
        status: error.details.status
      });
    }
  }}
/>;
```

The default UI can retry failed uploads without rerunning `transform`. Headless UIs get the same flow through `canRetryUpload` and `retryUpload()`.

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
- [Next.js App Router](./docs/recipes/nextjs-app-router.md)
- [Next.js presign route](./docs/recipes/nextjs-presign-route.md)
- [React Hook Form and Zod](./docs/recipes/react-hook-form-zod.md)
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
| `image-drop-input` | `ImageDropInput`, UI props and render types, `ImageUploadValue`, upload types, validation and upload error helpers |
| `image-drop-input/headless` | `useImageDropInput`, `compressImage`, `prepareImageToBudget`, `validateImage`, metadata helpers, upload factories, budget/validation/upload error helpers |
| `image-drop-input/style.css` | default component styles |

```ts
import {
  ImageDropInput,
  ImageValidationError,
  isImageUploadError,
  isImageValidationError,
  type ImageDropInputProps,
  type ImageUploadValue,
  type UploadAdapter
} from 'image-drop-input';
```

```ts
import {
  ImageBudgetError,
  compressImage,
  createMultipartUploader,
  createPresignedPutUploader,
  createRawPutUploader,
  isImageBudgetError,
  prepareImageToBudget,
  useImageDropInput,
  validateImage,
  type UseImageDropInputReturn
} from 'image-drop-input/headless';
```

The root entry stays UI-first. Low-level utilities live under `/headless`.

## Usage reports welcome

Using this package in a real product? Open a [usage report](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml) so docs, compatibility, and release polish can be prioritized from real integrations.

Useful reports include the use case, framework or bundler, upload pattern, and anything that slowed adoption. Public quotation is opt-in.

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
npm run publish:check
```

Release planning stays outside the npm package, so this README can stay focused on what works today.

## License

MIT
