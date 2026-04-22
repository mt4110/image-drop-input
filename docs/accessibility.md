# Accessibility

The default component is meant to be usable without custom accessibility wiring.

## Empty state

The empty dropzone is keyboard-focusable and behaves like a button.

Enter and Space open the file dialog.

Paste is supported on the dropzone when the clipboard contains an accepted image file.

## Filled state

The filled state remains focusable and is exposed as a group because it contains explicit preview, replace, and remove buttons.

Enter and Space replace the selected image from the focused surface. The explicit Replace button provides the same action for pointer, keyboard, and assistive technology users.

Delete and Backspace remove the image when `removable` is enabled. During upload, those keys cancel the in-flight upload instead of clearing the last committed value.

When upload is idle, paste can replace the current image with a supported clipboard image.

During upload, click, Enter, Space, paste, and drop do not start a new replacement while the upload is active.

The default surface also sets `aria-keyshortcuts` so keyboard behavior is discoverable to assistive technology.

## Actions and status

Default action buttons use labels from `messages`.

Status text reports idle, uploading, selected file, and error states. Use `messages` to localize UI copy.

```tsx
<ImageDropInput
  messages={{
    placeholderTitle: 'Choose a profile image',
    placeholderDescription: 'Drop, browse, or paste',
    statusUploading: (percent) => `Uploading ${percent}%`
  }}
/>
```

## Preview dialog

The default preview dialog uses:

- `role="dialog"`
- `aria-modal="true"`
- Escape-to-close
- focus trapping
- focus return to the previous element

Use `previewable={false}` to disable the preview dialog.

`zoomable` is still accepted for compatibility, but `previewable` is the clearer name for the current behavior.

## Headless responsibilities

`useImageDropInput()` exposes handlers and state, but custom markup must keep the accessible surface intact.

At minimum, custom UI should wire:

- an input with `ref={imageInput.inputRef}`
- a focusable surface with `role="button"` or equivalent semantics
- `onClick={imageInput.openFileDialog}`
- `onKeyDown={imageInput.handleKeyDown}`
- drag, drop, and paste handlers when those interactions are enabled
- visible status or error text for users

See [recipes/headless-ui.md](./recipes/headless-ui.md) for a compact example.
