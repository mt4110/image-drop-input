# Recipe: Next.js App Router

Use this when an App Router page needs a product image field.

`ImageDropInput` belongs in a Client Component. Server Components can fetch the saved image and pass plain serializable state such as `src`, `key`, and metadata.

## CSS import

Import the package CSS once from your app shell.

```tsx
// app/layout.tsx
import type { ReactNode } from 'react';
import 'image-drop-input/style.css';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Server page

```tsx
// app/settings/avatar/page.tsx
import { AvatarImageField } from './AvatarImageField';

export default async function AvatarSettingsPage() {
  const user = await getCurrentUser();

  return (
    <AvatarImageField
      initialValue={
        user.avatar
          ? {
              src: user.avatar.url,
              key: user.avatar.key,
              fileName: user.avatar.fileName,
              mimeType: user.avatar.mimeType,
              size: user.avatar.size,
              width: user.avatar.width,
              height: user.avatar.height
            }
          : null
      }
    />
  );
}
```

## Client field

```tsx
// app/settings/avatar/AvatarImageField.tsx
'use client';

import { type FormEvent, useState } from 'react';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';

type PersistedImageValue = Pick<
  ImageUploadValue,
  'src' | 'key' | 'fileName' | 'mimeType' | 'size' | 'width' | 'height'
>;

function toPersistedImageValue(value: ImageUploadValue | null): PersistedImageValue | null {
  if (!value?.src && !value?.key) {
    return null;
  }

  const { src, key, fileName, mimeType, size, width, height } = value;

  return { src, key, fileName, mimeType, size, width, height };
}

export function AvatarImageField({
  initialValue
}: {
  initialValue: PersistedImageValue | null;
}) {
  const [value, setValue] = useState<ImageUploadValue | null>(initialValue);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatar: toPersistedImageValue(value)
      })
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <ImageDropInput
        value={value}
        onChange={setValue}
        accept="image/png,image/jpeg,image/webp"
        aspectRatio={1}
        outputMaxBytes={3 * 1024 * 1024}
      />

      <button type="submit">Save</button>
    </form>
  );
}
```

## Notes

Do not render `ImageDropInput` directly in a Server Component. The component handles file dialogs, drag and drop, paste, object URLs, and browser-side image work.

`previewSrc` is for immediate UI feedback, usually a `blob:` URL. Keep it out of database writes and API payloads. Persist `src`, `key`, and metadata after your upload flow has committed.

If you attach an upload adapter, the submitted value should come from the upload result. If you use local-preview-only mode, upload the selected file through your own flow before treating the form as saved.
