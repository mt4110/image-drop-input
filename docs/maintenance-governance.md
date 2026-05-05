# Maintenance governance

The project should stay a product-safe React image field, not expand into a general uploader, storage service, or image editor.

The goal is clarity, not gatekeeping. Accept work that deepens the single-image product-state boundary. Redirect work that mainly belongs to queue orchestration, storage ownership, source picking, or image editing.

Use this checklist before accepting a feature. A "yes" should describe the direct user-facing boundary the change improves, not just a nearby convenience.

1. Does it protect durable product image state?
2. Does it improve submit-boundary safety?
3. Does it improve byte-policy verification?
4. Does it improve draft, commit, discard, or cleanup correctness?
5. Does it improve explicit upload boundaries without storage lock-in?
6. Does it improve adoption trust without expanding scope?

If the answer is no, reject or redirect the request. A docs-only recipe can still fit when it explains how an app can integrate an outside tool while keeping this package boundary unchanged.

## Non-goals

Redirect these to dedicated tools or app-owned code:

- multi-file queues
- resumable or chunked upload orchestration
- remote file sources
- storage provider SDK wrappers
- storage-as-a-service behavior
- built-in crop, rotate, annotation, or image editing UI
- AI image enhancement
- broad design-system theming
- Node-side image processing

Integration hooks are welcome when they preserve the boundary. For example, a consumer can run a cropper before `transform`, but this package should not become the cropper.

## Suggested labels

- `scope:product-state`
- `scope:submit-boundary`
- `scope:byte-policy`
- `scope:draft-lifecycle`
- `scope:upload-boundary`
- `scope:adoption-trust`
- `scope:docs`
- `scope:ci-release`
- `scope:out-of-scope`
- `integration:nextjs`
- `integration:storage-contract`
- `needs-usage-evidence`

## Response templates

Use these as calm starting points. Add concrete context from the issue when possible, and offer a redirect when the request belongs in app code or a dedicated uploader/editor.

Multi-file queues:

```md
Thanks for the idea. Multi-file queues are intentionally out of scope. This package focuses on one product image field and the durable state boundary around that field. For multi-file orchestration, Uppy/FilePond/Uploady-style tools are a better fit.
```

Built-in cropper:

```md
Thanks. Built-in cropping, rotating, annotation, and editing UI are intentionally out of scope. The package may integrate with a cropper through `transform`, but it should not become an image editor.
```

Provider SDK wrapper:

```md
Thanks. Provider SDK wrappers are intentionally out of scope. The consuming app owns storage, auth, object keys, and signed URLs. This package provides explicit upload and draft lifecycle contracts without storage lock-in.
```

Remote source picker:

```md
Thanks for the use case. Remote file sources are intentionally out of scope. The package works from browser-provided files and durable image values; URL import, media library, and third-party source pickers should live in app code or a dedicated uploader. A recipe can be considered if it shows that handoff without adding source connectors here.
```

Resumable upload:

```md
Thanks for laying this out. Resumable or chunked upload orchestration is intentionally out of scope. This package keeps a small upload adapter contract for one image field; chunk sessions, retry queues, checkpoints, and provider-specific resumable protocols should be owned by the app or a dedicated uploader. A recipe can be considered if it preserves the explicit product-save boundary.
```

## Semver policy

Treat these as public contracts:

- root, `/headless`, and `/style.css` subpaths
- exported component props, hook options, hook return types, render props, message keys, and customization types
- `ImageUploadValue` shape and persistable value helper behavior
- upload adapter types, upload factory inputs and outputs, progress, abort, and upload error contracts
- validation, budget, transform, and metadata helper inputs and outputs
- documented error codes and fields used for product copy, telemetry, retries, or type narrowing

Docs wording, examples, tests, private implementation layout, and non-exported internals are not public contracts as long as documented behavior stays the same.

Patch:

- bug fixes
- docs fixes
- CI hardening
- internal refactors that preserve public behavior

Minor:

- new helpers
- new docs recipes
- new optional public types
- new optional props or hook options that preserve current defaults
- new error codes when existing narrowing remains safe

Major:

- breaking public type changes
- behavior changes in persistable guards
- lifecycle phase changes that affect user code
- removal or rename of public exports
- changed default validation, transform, upload, or cleanup behavior that can alter existing app outcomes
- new required peer, runtime, browser, or framework requirements

Adding an error code is minor only when existing code that handles known codes remains type-compatible and has a safe fallback path. If a new code invalidates exhaustive handling or changes when an existing code appears, treat it as major.

Docs-only recipes can ship in any patch or minor release according to release context. Public runtime behavior changes need changelog notes and tests.
