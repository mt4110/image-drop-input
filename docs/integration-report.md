# Integration report: single-image product form

Report date: 2026-05-02

This is a repo-maintained integration report for the public docs. It records how the shipped APIs fit together in one product-form shape. It is not an independent customer endorsement, a benchmark, or a claim that this package should replace queue-based upload tools.

The target integration is deliberately narrow: one image field in a profile, workspace, CMS, or product form where the saved record must not confuse browser preview state, draft upload state, and durable product state.

## Evidence classification

| Field | Value |
| --- | --- |
| Evidence label | Repo-maintained integration report |
| Maintainer-owned | Yes |
| Third-party usage | No |
| Production-adjacent | No |
| Package surface | Public APIs and packaged docs |

This report supports one modest claim: the documented single-image product form boundary can be assembled from shipped APIs without adding provider SDKs or changing the public API.

It does not prove production adoption, storage security, malware scanning, CDN invalidation, customer endorsement, or suitability for multi-file upload products.

## Scenario

A React product form starts with an existing image value from the server:

```ts
type ProductForm = {
  name: string;
  image: {
    src?: string;
    key?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
  } | null;
};
```

The form requirements are:

- show a local preview as soon as the user selects, drops, or pastes an image
- prepare JPEG, PNG, or WebP input to the app's byte policy before upload
- upload image bytes through an app-owned signed URL or internal upload service
- treat upload success as a draft, not as a saved product image
- commit the draft as part of the form save
- discard uncommitted drafts on cancel, reset, or replace
- rely on server-side TTL cleanup for abandoned or expired drafts
- clean up the previous image only after the new image is durable
- persist only `src`, `key`, and prepared metadata

## Integration path

The path uses existing APIs and docs. It does not require new component props, provider SDKs, or a change to the default `ImageDropInput` behavior.

1. Render `ImageDropInput` as the browser field.
2. Use `prepareImageToBudget()` inside `transform` when the app needs the browser to actively produce bytes under `outputMaxBytes`.
3. Keep `outputMaxBytes` on `ImageDropInput` as the final validation guard after transform.
4. Use `useImageDraftLifecycle()` when the form needs upload-draft, commit, discard, and previous-cleanup state.
5. Let the app server own presign, auth, object keys, draft TTLs, commit transactions, and cleanup policy.
6. Return the durable image value from the product submit endpoint after the draft has been committed.
7. Use `toPersistableImageValue()` at submit boundaries that receive raw component values, especially local-preview-only or non-draft flows.

The draft lifecycle recipe demonstrates this shape with a Next.js App Router profile form:

```txt
browser selects image
  -> ImageDropInput creates previewSrc for UI feedback
  -> transform prepares bytes to policy
  -> outputMaxBytes validates the prepared file
  -> uploadDraft stores a temporary draft object
  -> form submit sends fields plus draft identity
  -> server validates form and draft ownership together
  -> server commits draft to a final image value
  -> server updates the product row
  -> server enqueues previous-image cleanup
  -> client receives durable image state
```

## Boundary checks

| Boundary | Library or doc surface | Product result |
| --- | --- | --- |
| Browser preview vs saved data | `previewSrc`, `toPersistableImageValue()` | Browser-only previews are stripped or rejected before persistence. |
| Prepared bytes vs source file | `prepareImageToBudget()`, `outputMaxBytes` | The app can target an upload budget, then still validate the final prepared file. |
| Upload success vs form save success | `useImageDraftLifecycle()` | A successful upload can remain a retryable or discardable draft until the app commits it during form save. |
| Draft key vs durable key | `ImageDraftDescriptor`, backend contracts | The app decides when a draft object becomes a final product image. |
| Previous cleanup vs replacement commit | `cleanupPrevious`, backend contracts | Cleanup failures are reported or retried without rolling back the new committed image. |
| Storage service vs browser package | upload adapters, backend contracts | Provider credentials, SDKs, auth, and object lifecycle stay in the app server. |

## Evidence links

- [Value model](./value-model.md) defines `src`, `previewSrc`, `key`, and prepared metadata.
- [Persistable value guard](./persistable-value.md) shows the submit-boundary guard for durable payloads.
- [Byte budget solver](./byte-budget.md) shows active preparation to an output byte budget.
- [Browser budget lab](./browser-budget-lab.md) verifies the byte-budget helper in Chromium and Firefox.
- [Draft lifecycle](./draft-lifecycle.md) describes upload draft, commit, discard, and cleanup behavior.
- [Backend contracts](./backend-contracts.md) describes app-owned presign, commit, discard, previous cleanup, and TTL cleanup.
- [Backend reference protocol](./backend-reference-protocol.md) documents atomic submit, idempotency, stale previous defense, and cleanup workers.
- [Next.js draft lifecycle recipe](./recipes/nextjs-draft-lifecycle.md) wires the pieces into one product-form flow.
- The repository's consumer smoke checks exercise the packed package from root, headless CommonJS, and Vite React consumer shapes.

## Observed checks

For this report date, the repository verification was run against the current package shape:

- `npm run verify` covers typecheck, unit tests, example builds, package linting, and type resolution checks.
- `npm run smoke:consumer` packs the package, installs it into consumer fixtures, and verifies root TypeScript, headless CommonJS, and Vite React UI consumption.
- `npm run publish:check` and `npm pack --dry-run` confirm the publish manifest and packaged docs include this report.

These checks are not a storage-provider integration. They verify that the shipped package surfaces used by this boundary are consumable, and that the docs and recipes describe the product-form flow without adding provider SDKs or changing the default component behavior.

## Result

This integration shape supplies a modest public integration signal: it is repo-maintained, traceable to shipped APIs, and backed by docs, recipes, and consumer smoke checks.

It also keeps the category boundary intact. Use Uppy, FilePond, Uploady, or a provider widget when the product needs multi-file queues, remote sources, resumable uploads, image editing, or storage-as-a-service. This package is focused on one image field whose temporary browser state, draft upload state, and persisted product state must stay separate.

## Caveats

The app server still owns authorization, object key policy, draft expiry, final persistence, cleanup idempotency, malware scanning, CDN invalidation, and any product-specific compliance checks.

Client discard remains best effort. A server-side TTL cleanup is still required for abandoned drafts.

For high-value product records, prefer the atomic submit shape from [Backend contracts](./backend-contracts.md): validate the form, commit the draft, update the record, and enqueue previous cleanup in one server-owned operation.
