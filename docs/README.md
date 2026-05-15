# image-drop-input docs

`image-drop-input` is a product-safe React image field for single-image forms that need a durable image-state boundary.

Preview locally, prepare to policy, upload explicitly, and persist only durable image state.

**Upload success is not product save success.**

Pick the path that matches your product:

- Local preview only: [Local preview](./recipes/local-preview.md)
- Prepare and upload one image: [Byte budget solver](./byte-budget.md) and [Uploads](./uploads.md)
- Product-safe replacement flow: [Draft lifecycle](./draft-lifecycle.md), [Local draft persistence](./local-draft-persistence.md), [State machine](./state-machine.md), [Backend contracts](./backend-contracts.md), and [Product submit with image draft](./recipes/product-submit-with-image-draft.md)

Core docs:

- [Value model](./value-model.md): how `src`, `previewSrc`, `key`, and metadata fit together
- [Persistable value guard](./persistable-value.md): remove temporary preview state before submit and mirror the rule on the server
- [Byte budget solver](./byte-budget.md): prepare images to fit an output byte budget
- [Browser budget lab](./browser-budget-lab.md): Chromium/Firefox engine evidence for byte-budget behavior
- [Draft lifecycle](./draft-lifecycle.md): upload drafts, commit on form save, discard on cancel, and cleanup previous images
- [Local draft persistence](./local-draft-persistence.md): crash-resilient OPFS/IndexedDB recovery for unsaved local image drafts
- [Draft lifecycle state machine](./state-machine.md): lifecycle phases, transition table, invariants, and disproof paths
- [Backend contracts](./backend-contracts.md): app-owned auth, signed URLs, commit, discard, previous cleanup, and TTL cleanup
- [Backend reference protocol](./backend-reference-protocol.md): atomic submit, idempotency, stale previous defense, and cleanup workers
- [Validation](./validation.md): source limits, output limits, dimensions, pixels, and error codes
- [Error taxonomy](./error-taxonomy.md): stable error codes for product copy, retries, and safe telemetry
- [Uploads](./uploads.md): adapter contracts, signed upload boundaries, progress, typed upload errors, and aborts
- [Transforms](./transforms.md): compression, WebP conversion, return shapes, and MIME consistency
- [Accessibility](./accessibility.md): keyboard, paste, status, dialog, and headless responsibilities
- [ROI model](./roi-model.md): vendor-neutral byte, processing, and cost estimate for Zero Image-Processing Backend pilots

Recipes:

- [Server persistable image schema with Zod](./recipes/server-persistable-image-zod.md)
- [Server persistable image schema without dependencies](./recipes/server-persistable-image-custom.md)
- [Local preview](./recipes/local-preview.md)
- [Avatar field](./recipes/avatar.md)
- [Compression](./recipes/compression.md)
- [WebP transform](./recipes/webp.md)
- [Presigned PUT](./recipes/presigned-put.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Next.js presign route](./recipes/nextjs-presign-route.md)
- [Next.js draft lifecycle](./recipes/nextjs-draft-lifecycle.md)
- [Product submit with image draft](./recipes/product-submit-with-image-draft.md)
- [React Hook Form and Zod](./recipes/react-hook-form-zod.md)
- [Multipart POST](./recipes/multipart-post.md)
- [Raw PUT](./recipes/raw-put.md)
- [Headless UI](./recipes/headless-ui.md)

Security, privacy, and adoption:

- [Security model](./security.md): practical threat model for temporary URLs, signed URLs, drafts, cleanup, and server authority
- [Telemetry and privacy](./telemetry-and-privacy.md): safe error tags, redaction patterns, and product copy mapping
- [Claim ledger](./claim-ledger.md): public claims, evidence levels, disproof paths, and current proof status
- [Durable image boundary](./durable-image-boundary.md): public category narrative, evidence map, and non-goals
- [Integration report](./integration-report.md): repo-maintained report for the single-image product form boundary
- [Adoption evidence](./adoption-evidence.md): what repo-maintained examples, maintainer-owned demos, third-party reports, and production-adjacent case studies prove
- [Release verification](./release-verification.md): packed package, npm metadata, provenance, public release surfaces, and cache checks
- [Supply-chain security](./supply-chain-security.md): dependency review, CodeQL, release gates, scanner score triage, and runtime dependency limits
- [Maintenance governance](./maintenance-governance.md): scope decisions, non-goals, and semver policy

The package stays single-image first. Use Uppy, FilePond, Uploady, or provider widgets when you need queues, remote sources, resumable uploads, image editing, or storage-as-a-service. Use this package when one image field must keep temporary preview state, draft upload state, and persisted product state separate.
