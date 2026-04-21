# image-drop-input

[Japanese README](./README.ja.md) · [Demo](https://mt4110.github.io/image-drop-input/) · [Issues](https://github.com/mt4110/image-drop-input/issues)

The image input for everything that happens before upload.

A lightweight React image input for the messy part before upload: drop, browse, paste, preview, validate, compress, and upload images without UI-framework or cloud-SDK lock-in.

## Why

Most upload components stop at "give me a file".

Real product forms usually need more:

- show a local preview immediately
- reject images that are too large, too small, or the wrong type
- compress or convert before upload
- keep temporary preview state separate from persisted state
- upload to S3, R2, GCS, Azure Blob, or your own API
- avoid bundling a cloud SDK into the client
- keep the UI accessible and replaceable

`image-drop-input` is built around that full pre-upload flow.

Despite the name, this is not only about drag and drop. It is about preparing an image safely before upload.

It is not a generic file uploader. It is not a cloud provider SDK. It is not a full image editor.

It is the product-safe image input you add to avatar fields, CMS thumbnails, article covers, product images, and admin screens.

## Install

```bash
npm install image-drop-input react
```

Import the default CSS once:

```tsx
import 'image-drop-input/style.css';
```

## Quick Start

Use it as a local-preview-only image input:

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
      accept="image/png,image/jpeg,image/webp"
      maxBytes={5 * 1024 * 1024}
      aspectRatio={1}
    />
  );
}
```

Users can drag and drop an image, click to select one, paste from the clipboard, preview the selected image, and remove or replace it.

## What You Get

| Feature | Included |
| --- | --- |
| Drag and drop | Yes |
| Click-to-select | Yes |
| Clipboard paste | Yes |
| Local preview | Yes |
| Preview dialog | Yes |
| Validation | MIME, size, dimensions, pixel budget |
| Transform hook | Yes |
| Compression helper | Yes |
| WebP conversion | Yes |
| Presigned PUT upload | Yes |
| Multipart POST upload | Yes |
| Raw PUT upload | Yes |
| Headless hook | Yes |
| Runtime dependencies | React peer dependency only |

## The Image Lifecycle

`image-drop-input` keeps the image flow explicit:

```txt
pick / drop / paste
  -> validate
  -> transform
  -> validate again
  -> preview
  -> upload
  -> commit
```

This matters because a user-visible preview is not always the same thing as a persisted image.

## Value Model

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

### `src`

A persisted or otherwise shareable image URL.

Use this for values that can safely be stored in your database or sent back from your API.

### `previewSrc`

A temporary local preview URL, usually a `blob:` URL.

Use this only for immediate UI feedback. Do not store it as your final image value.

This separation keeps the UI honest:

- if upload returns `src`, the component displays the persisted image
- if upload returns only `key`, the temporary preview remains separate
- if upload fails, the component returns to the last committed value and retry uploads the same prepared file

## Upload Examples

### Local Preview Only

Omit `upload` when you only need selection and preview:

```tsx
<ImageDropInput
  value={value}
  onChange={setValue}
/>
```

### Presigned PUT

For S3, R2, GCS, Azure Blob, or similar object storage flows:

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
      throw new Error('Failed to create upload URL.');
    }

    return response.json();
  }
});

export function AvatarUploader() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <ImageDropInput
      value={value}
      onChange={setValue}
      upload={upload}
      maxBytes={5 * 1024 * 1024}
    />
  );
}
```

Your presign endpoint should return:

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

The package does not guess public URLs from upload URLs. Pass `publicUrl` or `objectKey` explicitly.

### Multipart POST

For classic application-server uploads:

```ts
import { createMultipartUploader } from 'image-drop-input/headless';

const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file'
});
```

If your response shape is custom, map it:

```ts
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

### Raw PUT

For a direct `PUT` endpoint:

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: '/api/avatar',
  publicUrl: '/avatars/current-user.jpg',
  objectKey: 'avatars/current-user.jpg'
});
```

## Transform And Compress Before Upload

Use `transform` when you want to modify the image before upload.

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  value={value}
  onChange={setValue}
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>
```

Convert to WebP and update the file name:

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

Validation runs before and after `transform`, so transformed files are checked too.

## Common Props

| Prop | Purpose |
| --- | --- |
| `value` | Current image value |
| `onChange` | Receives the next image value |
| `upload` | Optional upload adapter |
| `transform` | Optional pre-upload image transform |
| `accept` | Accepted MIME types or extensions |
| `maxBytes` | Maximum file size |
| `minWidth` / `minHeight` | Minimum image dimensions |
| `maxWidth` / `maxHeight` | Maximum image dimensions |
| `maxPixels` | Maximum pixel budget |
| `disabled` | Disable the input |
| `removable` | Enable remove actions |
| `previewable` | Enable the preview dialog |
| `capture` | Forward camera capture hints to the file input |
| `aspectRatio` | Dropzone aspect ratio |
| `className` | Root class name |
| `classNames` | Part-level class names |
| `style` / `rootStyle` / `dropzoneStyle` | Inline style hooks |
| `messages` | Override UI copy and aria labels |
| `renderPlaceholder` | Replace placeholder rendering |
| `renderActions` | Replace action rendering |
| `renderFooter` | Replace footer rendering |
| `onError` | Receive validation and upload errors |
| `onProgress` | Receive upload progress |

`zoomable` is still accepted for compatibility, but `previewable` is the clearer name for the current preview-dialog behavior.

## Headless Usage

Use `useImageDropInput()` when you want to build your own UI.

```tsx
import { useImageDropInput } from 'image-drop-input/headless';

export function CustomImageInput() {
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
        aria-disabled={imageInput.disabled}
        onClick={imageInput.openFileDialog}
        onKeyDown={imageInput.handleKeyDown}
        onDragOver={imageInput.handleDragOver}
        onDragLeave={imageInput.handleDragLeave}
        onDrop={imageInput.handleDrop}
        onPaste={imageInput.handlePaste}
      >
        {imageInput.displaySrc ? (
          <img
            src={imageInput.displaySrc}
            alt={imageInput.messages.selectedImageAlt}
          />
        ) : (
          <span>{imageInput.messages.placeholderTitle}</span>
        )}
      </div>

      <p>{imageInput.statusMessage}</p>
    </>
  );
}
```

The hook gives you the input ref, drag-and-drop handlers, paste handler, keyboard handler, display state, upload state, progress, retry, cancel, remove, and status message.

`UseImageDropInputReturn` is exported when you want to type a wrapper around the headless API.

## Customization

### Messages

```tsx
<ImageDropInput
  messages={{
    placeholderTitle: 'Choose a profile image',
    placeholderDescription: 'Drop, browse, or paste',
    statusUploading: (percent) => `Uploading ${percent}%`
  }}
/>
```

### Class Names

```tsx
<ImageDropInput
  classNames={{
    root: 'profileImageInput',
    dropzone: 'profileImageInput__surface',
    actions: 'profileImageInput__actions',
    status: 'profileImageInput__status',
    dialog: 'profileImageInput__dialog'
  }}
/>
```

### Partial Rendering

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

## Multiple Images

This package is intentionally single-image first.

For multiple images, keep array state in your app and render one `ImageDropInput` or one headless instance per item. That keeps ordering, deletion, persistence, and upload orchestration in the product layer where those decisions belong.

## Accessibility Notes

- The empty state is exposed as a keyboard-focusable button.
- Enter and Space open the file dialog from the empty state.
- Paste is supported on the dropzone.
- Default action buttons have aria labels from `messages`.
- The preview dialog uses `role="dialog"`, `aria-modal="true"`, Escape-to-close, focus trapping, and focus return.
- The default UI stays intentionally quiet, and the headless API is available when you need a fully custom accessible surface.

## Public Entrypoints

| Import | Role |
| --- | --- |
| `image-drop-input` | UI component and UI-facing types |
| `image-drop-input/headless` | Uploader factories, image processing, hooks, and validation helpers |
| `image-drop-input/style.css` | Default CSS |

```ts
import {
  ImageDropInput,
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

## When Not To Use This

Use another tool if you need:

- a generic multi-file uploader
- resumable or chunked uploads
- drag sorting between lists
- a full crop, rotate, or annotation editor
- provider-specific SDK wrappers
- Node-side image processing

Use `image-drop-input` when you want one product-safe image input with validation, preview, transform, and explicit upload wiring.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build:lib
npm run build:examples
npm run check:package
npm pack --dry-run
```

Release planning lives in [ROADMAP.md](./ROADMAP.md), so this README can stay focused on what works today.

## License

MIT
