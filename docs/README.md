# image-drop-input docs

`image-drop-input` is a product-safe React image input for preview, validation, compression, paste, and explicit signed uploads.

Start with:

- [Value model](./value-model.md): how `src`, `previewSrc`, `key`, and metadata fit together
- [Persistable value guard](./persistable-value.md): remove temporary preview state before submit
- [Validation](./validation.md): source limits, output limits, dimensions, pixels, and error codes
- [Byte budget solver](./byte-budget.md): prepare images to fit an output byte budget
- [Draft lifecycle](./draft-lifecycle.md): upload drafts, commit on form save, discard on cancel, and cleanup previous images
- [Backend contracts](./backend-contracts.md): app-owned auth, signed URLs, commit, discard, previous cleanup, and TTL cleanup
- [Uploads](./uploads.md): adapter contracts, signed upload boundaries, progress, typed upload errors, and aborts
- [Transforms](./transforms.md): compression, WebP conversion, return shapes, and MIME consistency
- [Accessibility](./accessibility.md): keyboard, paste, status, dialog, and headless responsibilities

Recipes:

- [Local preview](./recipes/local-preview.md)
- [Avatar field](./recipes/avatar.md)
- [Compression](./recipes/compression.md)
- [WebP transform](./recipes/webp.md)
- [Presigned PUT](./recipes/presigned-put.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Next.js presign route](./recipes/nextjs-presign-route.md)
- [Next.js draft lifecycle](./recipes/nextjs-draft-lifecycle.md)
- [React Hook Form and Zod](./recipes/react-hook-form-zod.md)
- [Multipart POST](./recipes/multipart-post.md)
- [Raw PUT](./recipes/raw-put.md)
- [Headless UI](./recipes/headless-ui.md)

The package stays single-image first. Multi-image workflows should keep ordering, deletion, persistence, and upload orchestration in the product layer.
