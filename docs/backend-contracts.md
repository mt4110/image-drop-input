# Backend contracts

`image-drop-input` keeps the browser image field small on purpose. It does not include a storage provider SDK, create signed URLs, choose object keys, authorize users, commit product records, or delete old images.

These contracts describe the server shape your app can expose when you want draft uploads, form-submit commits, discard, and previous-image cleanup. The TypeScript snippets are app-side examples, not package code.

## Ownership boundary

The package owns:

- browser preview state
- input and output validation
- optional client-side transform and byte-budget preparation
- upload adapter invocation
- draft lifecycle state when `useImageDraftLifecycle()` is used

Your app server owns:

- authentication and authorization
- object key generation
- signed upload URL creation
- draft metadata and expiry
- product form validation
- commit transactions
- previous image cleanup
- server-side TTL cleanup
- audit logging, malware scanning, and CDN invalidation when your product needs them

Keep provider credentials and provider SDKs on the server side of your app. Do not add S3, R2, GCS, Azure Blob, or similar SDKs to the browser package.

## Terms

| Term | Meaning |
| --- | --- |
| `uploadUrl` | Temporary URL used to upload bytes. It may be private, scoped, and short-lived. |
| `publicUrl` | URL your UI can render. Return it explicitly when one exists. |
| `objectKey` | Storage object key returned by your backend. For draft responses, this is still a draft reference unless the server says otherwise. |
| `draftKey` | App-owned identifier for a temporary draft image. It may be the object key or a database id. |
| `draftToken` | Optional short-lived token authorizing commit or discard for one draft. Treat it as sensitive. |
| `previousKey` | Durable key for the image that may be cleaned up after a successful replacement commit. |

Never infer `publicUrl` from `uploadUrl`. Signed upload URLs often use different hosts, temporary query strings, provider-specific paths, or private buckets.

Do not treat a draft `objectKey` as the durable product `key`. The commit response is the boundary where the app receives the final image reference.

## Contract 1: create draft upload target

Use this endpoint before the browser uploads image bytes.

```http
POST /api/images/drafts/presign
Content-Type: application/json
```

```ts
type ImagePurpose = 'avatar' | 'cover' | 'product' | 'custom';

type CreateImageDraftUploadTargetRequest = {
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  purpose: ImagePurpose;
};

type CreateImageDraftUploadTargetResponse = {
  uploadUrl: string;
  headers?: Record<string, string>;

  draftKey: string;
  draftToken?: string;
  expiresAt: string;

  publicUrl?: string;
  objectKey?: string;
};
```

Server rules:

- Validate the user session and product permission before signing.
- Validate MIME type, byte size, dimensions, and purpose server-side. Client validation is UX, not authority.
- Generate an object key on the server.
- Store draft owner, purpose, size policy, object key, and expiry in server-side metadata.
- Return `publicUrl` only when the draft can safely render immediately.
- Return `objectKey` only when the client needs a storage reference, and make clear whether it is a draft key or a final key.
- Keep `expiresAt` explicit so the UI and docs can reason about draft lifetime.

Security rules:

- Do not expose storage credentials.
- Do not log signed `uploadUrl` values.
- Do not log `draftToken`.
- Keep `draftToken` short-lived, scoped to one draft, and accepted only by commit/discard endpoints that require it.
- Sign the same content type and provider headers the browser will send.

## Contract 2: commit draft

Use this endpoint when a draft should become durable product state.

This can be a standalone endpoint, or it can be folded into the product submit endpoint described below.

```http
POST /api/images/drafts/commit
Content-Type: application/json
```

```ts
type CommitImageDraftRequestBody = {
  draftKey: string;
  draftToken?: string;
  previousKey?: string;
  purpose: ImagePurpose;
};

type CommitImageDraftResponseBody = {
  image: {
    src?: string;
    key: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
  };
};
```

Server behavior:

1. Validate the user session.
2. Validate the user may commit this image for this product record.
3. Validate draft ownership, purpose, token, expiry, MIME type, and object existence.
4. Move/copy the draft object to a final location, or mark the draft object as final.
5. Persist the final key in the product record if this endpoint owns the product update.
6. Return a durable image value with an explicit `key`, plus `src` when the image can be rendered directly.
7. Enqueue previous-image cleanup only after the commit transaction succeeds.

Do not delete the previous image before the new image is committed. A successful upload is not the same thing as a successful product save.

If the browser sends `previousKey`, treat it as a hint only. The server should load the current product record and use that authoritative value when deciding whether previous cleanup is allowed.

## Contract 3: discard draft

Use this endpoint when the user cancels, resets, unmounts, or replaces an uncommitted draft.

```http
POST /api/images/drafts/discard
Content-Type: application/json
```

```ts
type DiscardImageDraftRequestBody = {
  draftKey: string;
  draftToken?: string;
  reason: 'replace' | 'reset' | 'unmount' | 'manual';
};
```

Server behavior:

- Validate the user session and draft ownership.
- Delete only draft objects, never committed objects.
- Make the operation idempotent.
- Return success when the draft is already gone.
- Treat discard as best effort. Browser tabs can close and `keepalive` requests can fail.

Server-side TTL cleanup is still required even when client discard is wired.

## Contract 4: cleanup previous

Previous-image cleanup should run after a new image is durably committed.

```http
POST /api/images/cleanup-previous
Content-Type: application/json
```

```ts
type CleanupPreviousImageRequestBody = {
  previousKey: string;
  nextKey: string;
  reason: 'replace-committed';
};
```

Server behavior:

- Prefer an internal queue or background job over a direct browser-triggered delete.
- Validate that `nextKey` is already committed to the product record.
- Validate that `previousKey` is no longer referenced by that product record.
- Make cleanup idempotent.
- Return success when the previous object is already gone.
- Do not rollback the new image if cleanup fails.

Cleanup can fail independently from commit. Report or retry cleanup separately; the new committed image remains authoritative.

## Recommended atomic form submit

For product records, prefer one submit endpoint that commits the draft and saves the rest of the form together.

```txt
Browser
  ImageDropInput
    -> upload draft bytes with a signed URL
    -> submit form fields plus draft identity

Server
  POST /api/products/:id
    -> validate form fields
    -> validate draft ownership and expiry
    -> commit draft to final image
    -> update product row with final image value
    -> enqueue previous cleanup after the transaction succeeds
    -> return durable image value
```

This avoids the split-brain case where `commitDraft()` succeeds but the product form save fails afterward.

The simpler client sequence is acceptable for low-risk forms:

```ts
const image = await imageDraft.commit();
await saveProduct({ ...fields, image });
```

The caveat is real: if the image commit succeeds and `saveProduct()` fails, your app must decide whether to retry the product save, keep the draft/final image reachable, or run a compensating cleanup. User-facing profile, CMS, and product records usually deserve the atomic server submit.

## TTL cleanup

Client discard is not a cleanup guarantee. Add a server-side lifecycle rule, scheduled job, or queue worker that deletes expired draft metadata and draft objects.

A common policy is:

- signed upload URL lifetime: minutes
- draft commit lifetime: 15 to 60 minutes
- background cleanup cadence: shorter than or equal to the maximum draft lifetime your product tolerates

The exact numbers are app policy. The fallback is mandatory.

## App-side Next.js shape

These routes are app-side examples. Replace the placeholder helpers with your own storage service, database, queue, and auth layer.

```txt
app/api/images/drafts/presign/route.ts
app/api/profile/route.ts
app/api/images/drafts/discard/route.ts
app/api/images/cleanup-previous/route.ts
```

For a complete App Router recipe, see [Next.js draft lifecycle](./recipes/nextjs-draft-lifecycle.md).
For the submit transaction pattern, see [Product submit with image draft](./recipes/product-submit-with-image-draft.md).

## Package defaults stay opt-in

The default `ImageDropInput` behavior does not change for apps that only use local preview or a normal upload adapter. Draft commit/discard/cleanup is an advanced pattern you opt into with `useImageDraftLifecycle()` and your own backend contracts.
