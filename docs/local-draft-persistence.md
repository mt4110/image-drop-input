# Local draft persistence

Use local draft persistence when a user selects or prepares an image before the product form is saved, and you want a bounded recovery path after reload or tab crash.

Correct claim:

```txt
Crash-resilient local draft persistence.
```

Do not claim that browser-local data is immortal. A browser may evict origin storage, private browsing modes may shorten storage lifetime, and a user clearing site data removes the draft.

## What is stored

`createLocalImageDraftStore()` stores a small manifest in IndexedDB. Image bytes are stored in OPFS when available, and fall back to IndexedDB when OPFS is unavailable.

```ts
import { createLocalImageDraftStore } from 'image-drop-input/headless';

const localDrafts = createLocalImageDraftStore({
  namespace: 'profile-editor',
  ttlMs: 24 * 60 * 60 * 1000,
  onStoragePressure(pressure) {
    showStorageWarning(pressure);
  }
});

await localDrafts.saveDraft({
  fieldId: 'profile.avatar',
  productId: profile.id,
  raw: {
    blob: originalFile,
    fileName: originalFile.name,
    mimeType: originalFile.type
  },
  prepared: {
    blob: prepared.file,
    fileName: prepared.fileName,
    mimeType: prepared.mimeType,
    width: prepared.width,
    height: prepared.height
  },
  phase: 'prepared'
});
```

The manifest follows this shape:

```ts
type LocalImageDraftManifest = {
  version: 1;
  draftId: string;
  fieldId: string;
  productId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  phase:
    | 'raw-captured'
    | 'preparing'
    | 'prepared'
    | 'uploading'
    | 'uploaded'
    | 'commit-pending'
    | 'committed'
    | 'discarded'
    | 'failed';
  raw?: LocalImageDraftFileRef;
  prepared?: LocalImageDraftFileRef & {
    width?: number;
    height?: number;
  };
};
```

## Recovery flow

Use `useLocalImageDraftRecovery()` to drive a restore/discard banner or inline affordance. The hook does not render UI. It gives your app the state contract so the visual treatment can fit the form.

```tsx
import { useLocalImageDraftRecovery } from 'image-drop-input/headless';

function AvatarDraftBanner({ profileId }: { profileId: string }) {
  const recovery = useLocalImageDraftRecovery({
    fieldId: 'profile.avatar',
    productId: profileId,
    onRestored(result) {
      setPendingAvatarFile(result.recoveredFile);
    }
  });

  if (recovery.status !== 'available' || !recovery.draft) {
    return null;
  }

  return (
    <div role="status">
      <p>An unsaved local image draft is available.</p>
      <button type="button" onClick={() => void recovery.restore()}>
        Restore
      </button>
      <button type="button" onClick={() => void recovery.discard()}>
        Discard
      </button>
    </div>
  );
}
```

On mount, the hook runs TTL cleanup, lists recoverable drafts for the field/product, and exposes the newest one as `draft`.

| State | UI contract |
| --- | --- |
| `checking` | Keep the form quiet or show a subtle loading state. |
| `empty` | No banner. |
| `available` | Show restore and discard choices. |
| `restoring` | Disable duplicate restore clicks. |
| `restored` | Hand the restored `File` to your form flow. |
| `discarding` | Disable duplicate discard clicks. |
| `discarded` | Hide the banner. |
| `failed` | Show an actionable error and keep discard available when a draft is still known. |

## Cleanup and quota

The store runs local TTL cleanup through `cleanupExpired()`, and the recovery hook calls it before listing drafts.

Before writing large drafts, the store uses `navigator.storage.estimate()` when available. If available quota is too small, `saveDraft()` rejects with `LocalImageDraftError` code `quota_exceeded` and calls `onStoragePressure`.

```ts
const localDrafts = createLocalImageDraftStore({
  onStoragePressure(pressure) {
    reportSafeEvent('image_local_draft_storage_pressure', {
      reason: pressure.reason,
      mode: pressure.mode
    });
  }
});
```

You may request persistent browser storage from a user gesture:

```ts
const granted = await localDrafts.requestPersistentStorage();
```

Browsers decide how this behaves. Treat it as a helpful hint, not a guarantee.

## Failure behavior

| Failure | Behavior |
| --- | --- |
| OPFS unavailable | File bytes fall back to IndexedDB. |
| IndexedDB unavailable | The store falls back to memory-only state and reports a warning; reload recovery is unavailable. |
| Quota exceeded | `saveDraft()` rejects with a typed, user-facing error. |
| Manifest corrupt | The corrupt manifest is removed and reported through `onWarning`. |
| Draft expired | `cleanupExpired()` removes manifest and files. |
| User clears site data | Draft is unrecoverable. Do not claim otherwise. |

## Boundary with draft uploads

Local draft persistence is browser recovery state. It does not make an image a product image.

Use it alongside `useImageDraftLifecycle()` when useful:

```txt
local draft file -> prepared bytes -> draft upload -> product submit -> committed image
```

The app still owns signed URLs, remote draft TTLs, commit/discard endpoints, product transactions, and cleanup queues.
