# Recipe: WebP transform

Use this when your product wants a prepared WebP image before upload.

## Code

```tsx
import { ImageDropInput } from 'image-drop-input';
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
/>;
```

## Notes

Keep `fileName` and `mimeType` aligned with the encoded output.

If the browser cannot encode WebP through canvas, `compressImage()` rejects instead of returning mismatched bytes.
