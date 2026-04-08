# image-drop-input

[日本語 README](./README.md)

A lightweight **React image upload input** for real-world product use.

It handles drag and drop, click-to-select, clipboard paste, local preview, a preview dialog,
image compression, and **pluggable uploads through presigned URLs or custom APIs**
without bringing in heavy UI dependencies or cloud SDKs.

The default skin is intentionally quiet, and it is designed to hold together under dark mode,
high contrast, reduced transparency, and compact container widths.

## Highlights

- No runtime dependencies beyond the React peer dependency
- Built for the full single-image upload flow
- Keeps `src` and `previewSrc` separate so persisted state does not blur into local preview state
- Uses explicit uploader APIs instead of guessing providers from URL strings
- Keeps the root entry UI-first and lower-level APIs under `/headless`
- Verified in both Vite and Rsbuild consumers

## Install

```bash
npm install image-drop-input react
```

```tsx
import 'image-drop-input/style.css';
```

> `react-dom` is already present in most React web apps. If your app does not have it yet, install it alongside the package.

## Quick Start

If you omit `upload`, the component works as a local-preview-only image input.

```tsx
import { useState } from 'react';
import {
  ImageDropInput,
  type ImageUploadValue
} from 'image-drop-input';
import 'image-drop-input/style.css';

export function AvatarField() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <ImageDropInput
      value={value}
      onChange={setValue}
      aspectRatio={1}
      dropzoneStyle={{ minBlockSize: '20rem' }}
    />
  );
}
```

The `onChange` value shape looks like this:

```ts
type ImageUploadValue = {
  src?: string;
  previewSrc?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  key?: string;
};
```

## Handling multiple images

This package is currently **focused on a single-image input**. It does not expose a built-in `multiple` prop or an array-shaped value model.

When you need several images, the natural shape is `one dropzone + parent-owned array state + detached preview gallery` built with the helpers from `image-drop-input/headless`.

```tsx
import { useRef, useState } from 'react';
import { validateImage } from 'image-drop-input/headless';

const accept = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

type GalleryItem = {
  id: string;
  fileName: string;
  previewSrc: string;
};

export function GalleryDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryItem[]>([]);

  async function appendFiles(files: File[]) {
    for (const file of files) {
      await validateImage(file, { accept, maxBytes: 8 * 1024 * 1024 });

      setImages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          fileName: file.name,
          previewSrc: URL.createObjectURL(file)
        }
      ]);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} multiple hidden />
      <button type="button" onClick={() => inputRef.current?.click()}>
        Drop or browse PNG, JPEG, or WebP files
      </button>
      <div>{images.map((image) => <img key={image.id} src={image.previewSrc} alt={image.fileName} />)}</div>
    </>
  );
}
```

The consumer examples now show the actual wiring for both a detached single-image preview and a one-dropzone / many-files gallery flow.

## The value model

- `src`: persisted or otherwise shareable image reference
- `previewSrc`: ephemeral local preview URL

That distinction matters:

- when the upload returns `src`, the component uses it as the primary display source
- when the upload only returns `key`, the temporary `blob:` URL stays in `previewSrc`
- when an upload fails, the component discards the draft preview and returns to the last committed value

This keeps the visible state aligned with what is actually persisted.

## Common props

| prop | purpose |
| --- | --- |
| `accept` | accepted MIME types, defaults to `image/*` |
| `maxBytes` | maximum file size |
| `minWidth` / `minHeight` | minimum image dimensions |
| `maxWidth` / `maxHeight` | maximum image dimensions |
| `maxPixels` | maximum pixel budget |
| `aspectRatio` | dropzone aspect ratio |
| `disabled` | disables the whole input |
| `removable` | enables remove actions, defaults to `true` |
| `previewable` | enables the preview dialog |
| `onError` | receives validation and upload errors |
| `onProgress` | receives upload progress |

Prefer `previewable` going forward while keeping `zoomable` for backward compatibility.
The current behavior is a preview dialog, not a full wheel / pinch / pan zoom surface.

## Wiring uploads

### 1. Presigned PUT

For S3, R2, GCS, and Azure-style flows, the `/headless` uploader factory is the cleanest fit.

```tsx
import { useState } from 'react';
import {
  ImageDropInput,
  type ImageUploadValue
} from 'image-drop-input';
import {
  createPresignedPutUploader
} from 'image-drop-input/headless';
import 'image-drop-input/style.css';

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
      throw new Error('Failed to get upload target.');
    }

    return response.json();
  }
});

export function AvatarUploader() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return <ImageDropInput value={value} onChange={setValue} upload={upload} />;
}
```

`getTarget()` is expected to return:

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

The package deliberately does only one thing here:
**PUT the Blob to the given URL with the given headers.**

### 2. Multipart POST

For classic application server uploads:

```ts
import { createMultipartUploader } from 'image-drop-input/headless';

const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file'
});
```

By default it loosely reads `src` / `publicUrl` / `url` and `key` / `objectKey`.
Use `mapResponse` when your server shape differs.

### 3. Raw PUT

For simple PUT endpoints:

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: 'https://upload.example.com/files/avatar.jpg',
  publicUrl: 'https://cdn.example.com/avatar.jpg',
  objectKey: 'avatars/avatar.jpg'
});
```

## Transforms and compression

`transform` may return `Blob | File | { file, fileName?, mimeType? }`.
For compression or format conversion, `compressImage()` from `/headless` is the natural tool.

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>
```

If you need to control the filename or MIME type explicitly:

```ts
transform={async (file) => ({
  file: await compressImage(file, { maxWidth: 1600, outputType: 'image/webp', quality: 0.86 }),
  fileName: file.name.replace(/\.(png|jpe?g|webp)$/i, '.webp'),
  mimeType: 'image/webp'
})}
```

Validation runs both before and after the transform, so the transformed image is checked too.

## Customization

### `messages` and `classNames`

Use `messages` for copy and aria labels, and `classNames` for part-level styling hooks.

```tsx
<ImageDropInput
  messages={{
    placeholderTitle: 'Choose a profile image',
    placeholderDescription: 'Drop, browse, or paste',
    statusUploading: (percent) => `Uploading ${percent}%`
  }}
  classNames={{
    root: 'profileImageInput',
    dropzone: 'profileImageInput__surface',
    actions: 'profileImageInput__actions',
    status: 'profileImageInput__status',
    dialog: 'profileImageInput__dialog'
  }}
/>
```

### Partial renderer overrides

`renderPlaceholder`, `renderActions`, and `renderFooter` let you replace only the parts you need
without forking the whole component.

```tsx
<ImageDropInput
  renderFooter={({ statusMessage, canRetryUpload, retryUpload }) => (
    <div className="profileImageInput__footer">
      <span>{statusMessage}</span>
      {canRetryUpload ? (
        <button type="button" onClick={retryUpload}>
          Retry
        </button>
      ) : null}
    </div>
  )}
/>
```

The default action and footer wrappers absorb click and keydown propagation,
so custom buttons do not need repeated `stopPropagation()` just to avoid reopening the file picker.

## The headless API

If you want to replace the UI entirely, use `useImageDropInput()` from
`image-drop-input/headless`.

```tsx
import { useImageDropInput } from 'image-drop-input/headless';

export function CustomImageField() {
  const imageInput = useImageDropInput({
    accept: 'image/*',
    maxBytes: 5 * 1024 * 1024
  });

  return (
    <>
      <input
        ref={imageInput.inputRef}
        type="file"
        accept={imageInput.accept}
        onChange={imageInput.handleInputChange}
        hidden
      />

      <div
        role="button"
        tabIndex={0}
        onClick={imageInput.openFileDialog}
        onKeyDown={imageInput.handleKeyDown}
        onDragOver={imageInput.handleDragOver}
        onDragLeave={imageInput.handleDragLeave}
        onDrop={imageInput.handleDrop}
        onPaste={imageInput.handlePaste}
      >
        {imageInput.displaySrc ? (
          <img src={imageInput.displaySrc} alt={imageInput.messages.selectedImageAlt} />
        ) : (
          <span>{imageInput.messages.placeholderTitle}</span>
        )}
      </div>

      <p>{imageInput.statusMessage}</p>
    </>
  );
}
```

## Root entry vs `/headless`

The root entry stays UI-first:

```ts
import {
  ImageDropInput,
  type ImageDropInputProps,
  type ImageUploadValue,
  type UploadAdapter,
  type UploadContext,
  type UploadResult
} from 'image-drop-input';
```

Lower-level APIs live under `/headless`:

```ts
import {
  compressImage,
  createMultipartUploader,
  createPresignedPutUploader,
  createRawPutUploader,
  getImageMetadata,
  useImageDropInput,
  validateImage
} from 'image-drop-input/headless';
```

That split is intentional. It keeps the public surface quieter.

## Accessibility and behavior notes

- the empty state uses a `button` role and opens the picker with `Enter` / `Space`
- the filled state becomes a `group` so a normal click does not unexpectedly reopen the picker
- `Delete` / `Backspace` removes the image when `removable` is enabled
- image paste is supported
- the preview dialog closes on `Escape` and keeps focus inside while open
- the preview dialog is intentionally inline, not portal-based, to keep the runtime surface smaller
- if an ancestor creates a stacking context with `transform` or `filter`, mount closer to the app root or replace the dialog through the headless API

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build:lib
npm run build:examples
npm run check:package
```

- consumer examples live in `examples/vite` and `examples/rsbuild`
- `npm run clean:share` removes `node_modules` and generated artifacts
- Node `22.18+`, or a newer active LTS, is recommended

## Pre-publish notes

- if you move the package to a different owner or GitHub repository, update `name`, `homepage`, `bugs`, and `repository` together in `package.json`
- run `npm pack --dry-run` and `npm run check:package` as the last gate

## One sentence

This package is meant to be a **fast, quiet, dependable single-image input**,
not an everything-and-the-kitchen-sink uploader.
