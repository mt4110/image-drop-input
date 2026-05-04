# Draft lifecycle

`useImageDraftLifecycle()` is an optional headless hook for product forms that upload an image before the form itself is saved.

It keeps this boundary explicit:

```txt
Upload success is not product save success.
```

Use it when replacing an existing image would otherwise create orphan draft objects or delete the previous image too early.

## Flow

```txt
committed image A
  -> user selects image B
  -> upload B as a draft object
  -> keep A as the authoritative committed value
  -> form submit commits B
  -> cleanup A only after B is committed
```

Cancel/reset does the opposite:

```txt
committed image A
  -> user selects image B
  -> upload B as a draft object
  -> discard B
  -> keep A
```

The package does not include an object-storage SDK. Your app owns signed URLs, auth, object keys, draft TTLs, transactions, and cleanup policy.

For the app-side endpoint shapes, security rules, and atomic submit caveat, read [Backend contracts](./backend-contracts.md). For a transaction-focused server recipe, read [Product submit with image draft](./recipes/product-submit-with-image-draft.md).

## Hook

```tsx
import { ImageDropInput } from 'image-drop-input';
import { useImageDraftLifecycle } from 'image-drop-input/headless';

const image = useImageDraftLifecycle({
  committedValue: profile.image,
  onCommittedValueChange: setProfileImage,
  uploadDraft,
  commitDraft,
  discardDraft,
  cleanupPrevious,
  autoDiscard: {
    onReplace: true,
    onReset: true,
    onUnmount: true
  },
  onError(error) {
    reportImageError(error);
  }
});

<ImageDropInput
  value={image.valueForInput}
  onChange={() => {
    // The lifecycle owns draft state. Persist only after image.commit().
  }}
  upload={image.uploadForInput}
/>;
```

`valueForInput` is display state for the input. Do not save it directly as your form payload.

## Draft upload result

`uploadDraft` receives the prepared `Blob` and the normal upload context. It must return either `draftKey` or `key`.

```ts
type ImageDraftUploadResult = {
  draftKey?: string;
  key?: string;
  src?: string;
  previewSrc?: string;
  expiresAt?: string;
};
```

`src` is optional. If the draft object is not publicly renderable, the hook keeps a local `previewSrc` for display. The package never infers a public URL from a signed upload URL.

`draftKey` is a temporary reference. If your upload adapter returns `key` instead of `draftKey`, the hook treats that `key` as the draft identifier for lifecycle operations. Do not persist it as the product image key. The durable `key` comes from the commit response.

## Backend contracts

Draft upload creates a temporary object:

```ts
type DraftUploadResponse = {
  uploadUrl: string;
  headers?: Record<string, string>;
  draftKey: string;
  expiresAt: string;
};
```

Commit validates ownership and promotes the draft into durable product state:

```ts
type CommitImageDraftRequest = {
  draft: ImageDraftDescriptor;
  previous: PersistableImageValue | null;
};
```

`previous` is the hook's last committed value. Treat it as a client hint only. A server transaction should load the current product record before deciding which previous image can be cleaned up.

Discard deletes a temporary draft when the user cancels, replaces it, resets the form, or unmounts:

```ts
type DiscardImageDraftRequest = {
  draft: ImageDraftDescriptor;
  reason: 'replace' | 'reset' | 'unmount' | 'manual';
};
```

`discardDraft` is optional because some products rely on short draft TTLs only. If it is omitted, `discard()` and `autoDiscard` still clear the local draft state, but no backend delete request is sent. Provide `discardDraft` when your backend can safely delete draft objects before their TTL expires.

Previous cleanup runs only after commit success:

```ts
type CleanupPreviousImageRequest = {
  previous: PersistableImageValue;
  next: PersistableImageValue;
};
```

Make cleanup idempotent. A cleanup failure must not rollback the new committed image.

## Recommended server transaction

For serious product forms, commit the image draft and save the form in the same server transaction whenever possible.

```txt
POST /api/profile
  fields
  image draft reference

server transaction:
  validate user can use draft
  move/copy draft to final object
  update profile row with final image value
  record previous cleanup request
  return final image value

after transaction success:
  enqueue previous cleanup
```

The simpler client sequence is:

```ts
const committedImage = await image.commit();
await saveProfile({ ...fields, image: committedImage });
```

That is easier to wire, but it can split consistency if `image.commit()` succeeds and `saveProfile()` fails. Prefer a product submit endpoint for user-facing records where image and fields must change together.

## Failure matrix

| Case | Expected behavior |
|---|---|
| Draft upload succeeds but form save never happens | draft remains temporary; server TTL cleanup eventually deletes it |
| Draft upload succeeds | `draft` is stored, `phase` becomes `draft-ready` |
| Draft upload fails | previous committed value remains authoritative; user can retry upload |
| Draft upload has no `draftKey` or `key` | `ImageDraftLifecycleError` with `missing_draft_key` |
| Commit succeeds | committed value changes, draft clears |
| Commit fails | previous committed value remains, draft stays retryable/discardable |
| Commit succeeds but product save fails in client-only sequence | app must retry product save or run compensating cleanup; prefer server transaction |
| Cleanup previous fails | new committed value remains, error is reported |
| Previous cleanup is retried | cleanup stays idempotent and returns success if the previous object is already gone |
| Discard succeeds | draft clears, committed value remains |
| Discard fails | draft remains so the user can retry or leave it to TTL cleanup |
| Replace draft | old draft is discarded when `autoDiscard.onReplace` is enabled |
| Unmount | draft discard is best-effort when `autoDiscard.onUnmount` is enabled |
| Double commit | the in-flight commit is reused; backend commit or product submit must not create a second final object |
| Stale draft token | server rejects commit/discard; current product image stays unchanged |
| Expired draft | server rejects commit; user uploads again |
| Browser sends stale `previousKey` | server loads the current product record before cleanup |

## Security notes

Draft objects should be short-lived and scoped to the authenticated user/session.

If your backend returns a draft authorization token, treat it as sensitive:

- send it only to commit/discard endpoints that need it
- do not write it to browser logs, analytics, or error messages
- keep it short-lived and single-purpose

Client discard is best-effort. Browser tabs close, networks fail, and unmount handlers do not always finish. Server-side TTL cleanup is required.
