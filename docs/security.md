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
