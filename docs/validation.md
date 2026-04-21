# Validation

Validation can happen before and after `transform`.

| Prop | Stage | Use case |
| --- | --- | --- |
| `inputMaxBytes` | before transform | reject huge source files |
| `outputMaxBytes` | after transform | enforce upload budget |
| `maxBytes` | both | compatibility shortcut |

## Before vs after transform

The source file is checked first:

```txt
input file -> validate input -> transform -> validate output -> preview/upload
```

Use `inputMaxBytes` when the browser should reject source files that are too large to safely decode or transform.

Use `outputMaxBytes` when product storage, upload, or API limits apply to the prepared image.

`maxBytes` applies to both stages when the stage-specific prop is not set.

## MIME and extension rules

`accept` uses normal file input accept syntax:

```tsx
<ImageDropInput accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" />
```

The package checks MIME and extension rules before transform and again after transform. That second check matters when you convert formats.

## Dimension validation

Use dimension props when product layout requires a minimum or maximum image size:

```tsx
<ImageDropInput
  minWidth={800}
  minHeight={600}
  maxWidth={4000}
  maxHeight={4000}
/>
```

Dimension validation runs on decoded image metadata.

## Pixel budget

Use `maxPixels` to reject images that are not just large in bytes, but expensive to decode:

```tsx
<ImageDropInput maxPixels={12_000_000} />
```

## Structured errors

Validation errors are `Error` objects with stable codes and details.

```ts
import { isImageValidationError } from 'image-drop-input';

function toMessage(error: Error) {
  if (!isImageValidationError(error)) {
    return error.message;
  }

  switch (error.code) {
    case 'file_too_large':
      return `Choose an image under ${error.details.maxBytes} bytes.`;
    case 'invalid_type':
      return 'Choose a supported image type.';
    default:
      return error.message;
  }
}
```

## Error codes

| Code | Meaning | Details |
| --- | --- | --- |
| `invalid_type` | unsupported MIME or extension | `accept`, `acceptRules`, `mimeType` |
| `file_too_large` | byte budget exceeded | `actualBytes`, `maxBytes` |
| `image_too_small` | min dimensions missed | `actualWidth`, `actualHeight`, `minWidth`, `minHeight` |
| `image_too_large` | max dimensions exceeded | `actualWidth`, `actualHeight`, `maxWidth`, `maxHeight` |
| `too_many_pixels` | pixel budget exceeded | `actualPixels`, `maxPixels` |
| `decode_failed` | metadata read failed | `actualBytes`, `mimeType` |

## Localization

Use `onError` and `isImageValidationError()` when you need product-specific or localized copy. Do not parse the default English error messages.
