# Maintenance governance

The project should stay a product-safe React image field, not expand into a general uploader, storage service, or image editor.

Use this checklist before accepting a feature:

1. Does it protect durable product image state?
2. Does it improve submit-boundary safety?
3. Does it improve byte-policy verification?
4. Does it improve draft, commit, discard, or cleanup correctness?
5. Does it improve explicit upload boundaries without storage lock-in?
6. Does it improve adoption trust without expanding scope?

If the answer is no, reject or redirect the request.

## Non-goals

Keep these out of scope:

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
- `scope:byte-policy`
- `scope:draft-lifecycle`
- `scope:docs`
- `scope:ci-release`
- `scope:out-of-scope`
- `integration:nextjs`
- `integration:storage-contract`
- `needs-usage-evidence`

## Response templates

Multi-file queues:

```md
Thanks for the idea. Multi-file queues are intentionally out of scope. This package focuses on one product image field and the durable state boundary around that field. For multi-file orchestration, Uppy/FilePond/Uploady-style tools are a better fit.
```

Built-in cropper:

```md
Thanks. Built-in cropping/editing is intentionally out of scope. The package may integrate with a cropper through `transform`, but it should not become an image editor.
```

Provider SDK wrapper:

```md
Thanks. Provider SDK wrappers are intentionally out of scope. The consuming app owns storage, auth, object keys, and signed URLs. This package provides explicit upload and draft lifecycle contracts without storage lock-in.
```

## Semver policy

Patch:

- bug fixes
- docs fixes
- CI hardening
- internal refactors that preserve public behavior

Minor:

- new helpers
- new docs recipes
- new optional public types
- new error codes when existing narrowing remains safe

Major:

- breaking public type changes
- behavior changes in persistable guards
- lifecycle phase changes that affect user code
- removal or rename of public exports
- stricter runtime requirements

Docs-only recipes can ship in any patch or minor release according to release context. Public runtime behavior changes need changelog notes and tests.
