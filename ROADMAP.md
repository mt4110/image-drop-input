# Roadmap

This project is strongest when it stays focused on one job: a product-safe React image input for the pre-upload image flow.

## v0.2 Focus

- Keep validation and transform semantics explicit, especially source vs output byte limits.
- Keep validation errors localizable with stable codes and structured details.
- Keep selected-state keyboard and paste behavior aligned with the empty-state dropzone.
- Keep upload progress deterministic, including a guaranteed final `100` on success.
- Keep examples split into small adoption recipes around local preview, avatar, compression, WebP transform, presigned upload, multipart upload, raw PUT, and headless UI.
- Keep multi-image usage as an app-owned state pattern rather than a new primary component API.
- Keep package metadata aligned with npm and GitHub discovery without raising unnecessary consumer engine requirements.

## Completed Baseline

- `README.md` is the primary English adoption page.
- `README.ja.md` is the Japanese README.
- The package is positioned around pre-upload preview, validation, transform, upload, and commit.
- The package exposes root, `/headless`, and `/style.css` entrypoints.

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
