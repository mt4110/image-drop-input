# Recipe: Avatar field

Use this for profile photos, workspace logos, account settings, and other square image fields.

## Code

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
      outputMaxBytes={3 * 1024 * 1024}
      messages={{
        placeholderTitle: 'Choose avatar',
        placeholderDescription: 'Drop, browse, or paste a square image'
      }}
    />
  );
}
```

## Notes

`aspectRatio={1}` shapes the default dropzone. It does not crop the image. If your product needs cropping, do that before passing the file into this component or use a dedicated editor.
