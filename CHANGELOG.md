# Changelog

Notable changes for `image-drop-input` are tracked here.

## 0.3.3 - 2026-05-07

### Added

- Added server-side persistable image schema recipes and a transaction-focused product submit recipe for draft image replacement flows.
- Added public security, telemetry/privacy, adoption evidence, and maintenance governance docs for product-safe image field usage.
- Added `ImagePersistableValueError` and `isImagePersistableValueError()` for stable persistable payload guard handling.

### Changed

- Hardened the byte-budget solver internals while preserving the public API and deterministic failure reporting.
- Strengthened draft lifecycle docs around commit/save consistency, previous cleanup timing, and orphan draft cleanup.
- Tightened release and package-face verification for packed package metadata and release workflow gates.

## 0.3.2 - 2026-05-03

### Added

- Added the repository-maintained integration report that connects persistable value, byte-budget, draft lifecycle, backend contract, and consumer smoke checks into one single-image product form flow.

## 0.3.1 - 2026-05-01

### Changed

- Documented typed upload error handling patterns for product copy, retry presentation, and telemetry.
- Updated GitHub Actions workflows to official Node 24 runtime action majors.

### Fixed

- Hardened the release workflow so npm publish artifacts are resolved as exactly one tarball before upload and publish.

## 0.3.0 - 2026-05-01

### Added

- Added packed-package consumer smoke checks for the supported Node install floor.
- Added tokenless npm trusted publishing release documentation, provenance verification steps, and a security policy.
- Added `ImageUploadError` and `isImageUploadError()` for structured upload failure handling.

### Changed

- Changed the release workflow to publish through npm Trusted Publishing instead of a long-lived npm token.
- Changed the release PR checklist to include changelog, trusted publisher, provenance, and token revocation checks.
- Split upload session orchestration out of the main React hook internals.

### Fixed

- Fixed GitHub Pages publishing to use the prepared Pages artifact.

## 0.2.0 - 2026-04-24

### Added

- Added the public `image-drop-input` package with React UI, headless utilities, validation, transforms, and upload adapters.
- Added Vite and Rsbuild examples plus package docs and upload recipes.

### Changed

- Positioned the package around a single product image field with explicit pre-upload state boundaries.
- Kept React as a peer dependency and cloud SDKs out of the bundle.

### Fixed

- Hardened upload retry, progress, cancellation, validation guard, and filled dropzone interaction behavior before the release.
