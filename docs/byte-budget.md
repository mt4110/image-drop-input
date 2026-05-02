# Byte Budget Solver

`outputMaxBytes` is still the final validation guard. Use `prepareImageToBudget()` when you want the browser transform step to actively produce an image at or below the same byte budget.

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

Keep `outputMaxBytes` on `ImageDropInput`. The helper targets the budget, then the component validates the prepared file before preview or upload.

## What it does

For JPEG and WebP output, the helper tries quality search first, then deterministic resize steps if quality alone cannot reach the budget.

For PNG output, browser canvas quality settings are not reliable, so the helper uses resize-only attempts.

The helper does not upscale. If the source image or the fitted `maxWidth` / `maxHeight` dimensions cannot satisfy `minWidth` / `minHeight`, it throws `budget_unreachable` before encoding.

The result describes the prepared output, not the source image:

```ts
const prepared = await prepareImageToBudget(file, {
  outputMaxBytes: 500_000,
  outputType: 'image/webp'
});

prepared.size <= 500_000;
prepared.fileName;        // derived extension matches output MIME
prepared.mimeType;        // image/webp
prepared.width;           // prepared width
prepared.height;          // prepared height
prepared.attempts;        // deterministic encode history
prepared.strategy;        // source-within-budget, quality-search, resize, ...
```

## Policy

```ts
type ImageBudgetPolicy = {
  outputMaxBytes: number;
  outputType?: 'image/jpeg' | 'image/png' | 'image/webp';
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  initialQuality?: number;      // default: 0.86
  minQuality?: number;          // default: 0.6
  maxEncodeAttempts?: number;   // default: 12
  qualitySearch?: 'binary';
  resizeStepRatio?: number;     // default: 0.85
  fileName?: string;
};
```

If `outputType` is omitted, supported source types are preserved. Unsupported source types default to WebP output.

If `fileName` is provided, the helper uses it as-is. Otherwise it derives an extension from the output MIME type.

## Errors

`prepareImageToBudget()` throws `ImageBudgetError` with a stable `code`:

| Code | Meaning |
| --- | --- |
| `invalid_policy` | budget, quality, attempt, or dimension options are invalid |
| `decode_failed` | browser image decoding failed |
| `encode_failed` | canvas encoding failed |
| `unsupported_output_type` | requested output type is not supported or the browser cannot encode it |
| `budget_unreachable` | all bounded attempts failed to fit the byte budget |

`budget_unreachable` includes the attempted encodes in `error.details.attempts`, which is useful for logs and tuning product defaults.

## Browser boundary

The solver uses browser image decoding and canvas encoding. Do not run it in a Server Component, route handler, or Node image pipeline. Keep server work focused on presign, auth, persistence, and storage policy.
