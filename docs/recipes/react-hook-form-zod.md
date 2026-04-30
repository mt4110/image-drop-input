# Recipe: React Hook Form and Zod

Use this when a form library owns the field state, validation, and submit payload.

React Hook Form and Zod are application dependencies in this example. `image-drop-input` does not add them for you.

## Code

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';

type PersistedImageValue = Omit<ImageUploadValue, 'previewSrc'>;

const imageFieldSchema = z
  .object({
    src: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    previewSrc: z.string().optional(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })
  .nullable();

const formSchema = z.object({
  avatar: imageFieldSchema
});

type FormValues = z.infer<typeof formSchema>;

function toPersistedImageValue(value: ImageUploadValue | null): PersistedImageValue | null {
  if (!value?.src && !value?.key) {
    return null;
  }

  const { src, key, fileName, mimeType, size, width, height } = value;

  return { src, key, fileName, mimeType, size, width, height };
}

export function ProfileForm({
  defaultAvatar
}: {
  defaultAvatar: PersistedImageValue | null;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      avatar: defaultAvatar
    }
  });

  async function onSubmit(values: FormValues) {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatar: toPersistedImageValue(values.avatar)
      })
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="avatar"
        control={form.control}
        render={({ field, fieldState }) => (
          <>
            <ImageDropInput
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                field.onBlur();
              }}
              accept="image/png,image/jpeg,image/webp"
              outputMaxBytes={3 * 1024 * 1024}
            />

            {fieldState.error ? (
              <p role="alert">{fieldState.error.message}</p>
            ) : null}
          </>
        )}
      />

      <button type="submit">Save</button>
    </form>
  );
}
```

## Notes

Let the field value hold `ImageUploadValue | null` while the user is editing so the component can show local previews and upload progress correctly.

`previewSrc` is optional UI state. It should not be required by your Zod schema, and it should not be copied into the payload that your API persists.

The example keeps `src` as a non-empty string because saved image references may be absolute CDN URLs, relative application paths, or resolved later from `key`. Use stricter URL validation only if your product guarantees that shape.

Use `toPersistedImageValue()` or the same idea in your submit handler to keep only `src`, `key`, and metadata. If an upload fails, the component keeps the previous committed value instead of replacing it with a broken `previewSrc`.
