# Security model

`image-drop-input` keeps storage credentials, provider SDKs, object key policy, and product persistence outside the browser package.

The package helps with:

- browser preview state
- input and output validation
- optional browser-side transforms
- explicit upload adapter calls
- draft lifecycle state
- persistable payload guards

The consuming app still owns:

- authentication and authorization
- signed upload URL creation
- object key generation and tenant scoping
- draft metadata, purpose, ownership, and expiry
- product form validation and persistence
- previous-image cleanup and expired-draft TTL cleanup
- malware scanning, CDN invalidation, and audit logging when required

## Practical threat model

These are the product-image risks this package is designed to make visible. The client can help keep state separated, but the server remains the authority for storage, ownership, and product persistence.

| Risk | What can go wrong | Product-safe response |
| --- | --- | --- |
| Temporary URL persistence | A local `blob:`, `data:`, or `filesystem:` URL is saved as product data and later fails to render, or leaks browser-only state into records. | Treat previews as UI state. Use `toPersistableImageValue()` before submit, and reject temporary URL schemes again in the server schema. Persist only durable `src` or `key` values. |
| Signed URL leakage | A signed upload URL appears in analytics, error traces, screenshots, or product records while it can still grant storage access. | Create signed URLs on the app server, keep them short-lived and scoped, never log them, and never infer `publicUrl` from `uploadUrl`. |
| Draft token leakage | A `draftToken` copied into logs, client errors, or rendered markup can be reused against commit or discard while it is valid. | Treat draft tokens as secrets. Send them only to commit/discard endpoints, keep them short-lived and single-purpose, and require a valid user session as well. |
| Unauthorized commit | A client submits another user's `draftKey`, a stale `draftToken`, or a misleading `previousKey`. | Validate session, tenant, product permission, draft ownership, purpose, token, expiry, object existence, and current product state on the server. Treat browser-sent previous values as hints only. |
| Previous cleanup timing | The previous committed image is deleted after upload but before the replacement is saved, leaving the product record without its last good image. | Enqueue previous cleanup only after the new image and product record are durably committed. Make cleanup idempotent, and do not roll back the new image if cleanup fails. |
| Orphan drafts | The user closes the tab, loses network, cancels during navigation, or unmounts before client discard finishes. | Use client discard for a better steady state, but require server-side TTL cleanup for expired uncommitted drafts and draft metadata. |
| Client metadata trust | A malicious or stale client sends incorrect MIME type, size, dimensions, purpose, or object identity. | Use client metadata for UX only. Re-check policy on the server and, before final commit, confirm the uploaded object bytes and server-side metadata match what the product accepts. |

## Sensitive values

Do not log:

- signed upload URLs
- draft tokens
- raw storage request or response headers
- local `blob:` preview URLs
- file contents
- EXIF metadata
- object keys that contain tenant or user identifiers

Use [Telemetry and privacy](./telemetry-and-privacy.md) for safe event shapes and redaction examples.

## Draft cleanup

Client discard is best effort. Browser close, route changes, network drops, and unmount can interrupt cleanup.

Server-side TTL cleanup is required for abandoned drafts even when the UI calls discard on cancel, replace, reset, or unmount.

## Product save boundary

Upload success is not product save success.

For high-value product records, prefer a server submit endpoint that validates the draft, commits the image, saves the form fields in one server-owned transaction, and enqueues previous cleanup only after that transaction succeeds.

See [Backend contracts](./backend-contracts.md) and [Product submit with image draft](./recipes/product-submit-with-image-draft.md).

For repository-level dependency review, static analysis, release gates, and tarball trust checks, see [Supply-chain security](./supply-chain-security.md).
