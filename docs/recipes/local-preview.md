# Recipe: Local preview

Use this when the form only needs image selection and immediate preview. No upload adapter is attached.

## Code

```tsx
import { useState } from 'react';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';
import 'image-drop-input/style.css';

export function LocalPreviewField() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <ImageDropInput
      value={value}
      onChange={setValue}
      accept="image/png,image/jpeg,image/webp"
    />
  );
}
```

## Notes

The emitted value uses `previewSrc`, usually a `blob:` URL. Use it for UI feedback only.

Do not store `previewSrc` as your final image value.
