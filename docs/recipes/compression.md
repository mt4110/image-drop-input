# Recipe: Compression

Use this when users may select large camera images, but your product needs a smaller prepared image.

## Code

```tsx
import { ImageDropInput } from 'image-drop-input';
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  inputMaxBytes={20 * 1024 * 1024}
  outputMaxBytes={5 * 1024 * 1024}
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>;
```

## Notes

`inputMaxBytes` protects the source stage. `outputMaxBytes` protects the prepared file that will be previewed or uploaded.

The output metadata returned through `onChange` describes the transformed file.
