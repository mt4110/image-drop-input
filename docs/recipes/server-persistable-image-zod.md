# Server persistable image schema with Zod

Use this recipe in your app server when a form submits a value that came from `ImageDropInput` or `toPersistableImageValue()`.

`image-drop-input` does not depend on Zod. This schema is an app-side example contract. Client sanitization is UX; server validation is authority.

## Schema

```ts
import { z } from 'zod';

const temporaryImageSrcSchemePattern = /^\s*(blob|filesystem|data):/i;

const persistableImageObjectSchema = z
  .object({
    src: z
      .string()
      .refine((src) => src.trim().length > 0, {
        message: 'src must be a non-empty string.'
      })
      .optional(),
    key: z.string().trim().min(1).optional(),
    fileName: z.string().trim().min(1).optional(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
    size: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })
  .strict()
  .refine((image) => image.src || image.key, {
    message: 'Image must include src or key.'
  })
  .refine((image) => !image.src || !temporaryImageSrcSchemePattern.test(image.src), {
    message: 'Temporary image URLs are not persistable.'
  });

export const persistableImageSchema = persistableImageObjectSchema.nullable();

export type PersistableImagePayload = z.infer<typeof persistableImageSchema>;
```

`strict()` rejects browser-only fields such as `previewSrc`. Keep it strict so accidental UI state cannot silently enter a product record.

`src` is intentionally not `z.string().url()`: `toPersistableImageValue()` accepts durable app-relative paths such as `/images/avatar.webp` as well as absolute CDN URLs. Add an absolute-URL rule only when your product storage policy requires one.

## Private bucket variant

If your product renders images through authenticated routes or signed read URLs, require `key` and treat `src` as optional display metadata.

```ts
export const privateBucketImageSchema = persistableImageObjectSchema
  .refine((image) => Boolean(image.key), {
    message: 'Private images must include a durable storage key.'
  })
  .nullable();
```

## Submit endpoint shape

```ts
export async function updateProfile(request: Request) {
  const body = await request.json();
  const image = persistableImageSchema.parse(body.image);

  await saveProfile({
    displayName: String(body.displayName ?? ''),
    image
  });

  return Response.json({ image });
}
```

## Server responsibilities

The schema only validates payload shape. Your server still owns:

- authenticated user and product permissions
- storage key ownership and tenant boundary checks
- MIME type and byte policy for the product field
- draft ownership, purpose, expiry, and object existence
- final persistence and previous-image cleanup
- malware scanning, CDN invalidation, and audit logging when your product needs them

Never trust `previousKey` from the browser as authority. Load the current product record on the server before deciding what previous image can be cleaned up.

Do not log signed upload URLs, draft tokens, raw storage headers, local `blob:` URLs, or full object keys that contain tenant or user identifiers.
