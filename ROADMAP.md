# Roadmap

This project is strongest when it stays focused on one job: a product-safe React image input for the pre-upload image flow.

## v0.2 Focus

- Make `README.md` the primary English adoption page.
- Keep the Japanese README as `README.ja.md`.
- Keep the package positioned around pre-upload preview, validation, transform, upload, and commit.
- Improve examples around local preview, WebP transform, compression, presigned upload, multipart upload, and headless UI.
- Keep multi-image usage as an app-owned state pattern rather than a new primary component API.
- Keep package metadata aligned with npm and GitHub discovery.

## Not For v0.2

- `multiple` prop
- crop editor
- chunked or resumable upload
- provider SDK adapters
- CLI generator
- UI framework skins

## Design Guardrails

- React peer dependency only at runtime.
- No cloud SDKs in the client bundle.
- No UI framework dependency.
- Single-image input first.
- Explicit upload wiring instead of provider URL guessing.
- `src` remains persisted or shareable state.
- `previewSrc` remains temporary UI state.
