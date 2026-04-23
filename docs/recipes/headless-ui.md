# Recipe: Headless UI

Use this when the default component surface is not the right fit, but you still want the image input state machine.

## Code

```tsx
import { useImageDropInput } from 'image-drop-input/headless';

export function CustomImageInput() {
  const imageInput = useImageDropInput({
    accept: 'image/*',
    outputMaxBytes: 5 * 1024 * 1024
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

## Notes

Custom markup owns the accessibility surface. Keep keyboard, paste, status, and disabled behavior wired when replacing the default component.
