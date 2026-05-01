# P1-08. v0.3 adoption hardening plan

- Priority: **P1**
- Depends on: **v0.2.0 public package baseline**
- Status: **design**
- Release target: **v0.3.x**
- Public API break allowed: **no**
- Runtime dependency additions allowed: **no**

## Summary

Move `image-drop-input` from "well-built package" to "safe package to adopt in another product."

The next release should not chase broader uploader features. The work should harden trust, maintainability, integration failure handling, and adoption proof around the existing single-image pre-upload flow.

## Current Scorecard

The package is already in the 9-point range as a small React library:

| Area | Current read |
| --- | --- |
| Concept | Strong single-image scope |
| README | Clear product-safe positioning |
| API design | Solid value model and explicit upload adapter |
| Docs and recipes | Strong, with Next.js and form recipes present |
| Package design | Root, `/headless`, and `/style.css` entrypoints are clear |
| CI and release | Stronger after consumer smoke and trusted publish work |
| Maintainability | Good, but the main hook is still heavy |
| External trust | The main remaining gap |

The 10-point path is adoption hardening, not feature expansion.

## Already Addressed Locally

The following items from the external review are no longer open in this repository:

- `CHANGELOG.md` exists and carries release-facing notes.
- `docs/README.md` lists the newer Next.js and React Hook Form/Zod recipes.
- `package.json` uses the consumer install floor `node >=18.18.0`.
- CI verifies packed consumer fixtures on Node `18.18.0`, `20.x`, and `22.x`.
- `RELEASING.md` documents npm Trusted Publishing, provenance checks, and token removal.
- `.github/workflows/release.yml` publishes without `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- A usage report issue template exists.
- Upload session orchestration is separated into `src/react/use-image-drop-input-internal/upload-session.ts`.
- `ImageUploadError` and `isImageUploadError()` are implemented, exported, documented, and covered by tests.
- npm registry metadata for `0.2.0` exposes a provenance attestation URL.

## Goals

- Keep the public package narrow: one product-safe image field, not a general uploader.
- Make the release path independently trustworthy through OIDC, provenance, and documented verification.
- Keep Node 18.18 as the consumer floor unless a concrete packaged artifact test proves otherwise.
- Reduce the main hook's operational weight before adding new behavior.
- Make upload failures easier to localize, classify, and observe without changing the `onError(error: Error)` callback shape.
- Collect at least one real usage signal that proves an app can adopt the package outside the local example environment.

## Non-goals

- Add multi-image support.
- Add a crop editor.
- Add resumable or chunked upload orchestration.
- Add provider SDK adapters.
- Add a CLI generator.
- Add UI framework skins.
- Rewrite the component surface for a new design system.

## Workstreams

### 1. Release trust verification

Most of the repository-side work is already in place. The remaining task is to verify the actual npm and GitHub settings during the next publish.

Acceptance criteria:

- npm Trusted Publisher is configured for `mt4110/image-drop-input`.
- The configured workflow filename is `release.yml`.
- The configured environment is `npm-publish`.
- A rehearsal release workflow passes with publish disabled.
- A real publish uses OIDC and succeeds without npm token environment variables.
- npm provenance is visible for the published version and points to the expected GitHub workflow run.
- Any old npm automation token is revoked after the first successful trusted publish.

### 2. Upload session extraction

`src/react/use-image-drop-input.ts` was the central gravity point. Upload orchestration now sits behind a named internal hook.

Module:

- `src/react/use-image-drop-input-internal/upload-session.ts`

Encapsulated:

- `abortControllerRef`
- `retryableUploadRef`
- `runId` checks that are upload-specific
- progress clamping and final `100`
- upload retry eligibility
- upload cancellation behavior
- draft cleanup after upload failure or abort

Keep in the hook:

- public returned shape
- file intake handlers
- validation and transform pipeline until a separate extraction is justified
- controlled value sync until upload extraction proves stable

Acceptance criteria:

- Existing retry, cancel, abort, progress, and failed-upload tests still pass.
- `AbortError` remains silent and does not call `onError`.
- Failed upload preserves the last committed value.
- Successful upload still commits `src` when present and keeps object URLs out of persisted state.
- The hook becomes easier to scan because upload side effects sit behind a named boundary.

### 3. Structured upload error model

Use `meta/design/P2-07-upload-error-model.md` as the detailed record. The initial model has been implemented without changing the `onError(error: Error)` callback shape.

Acceptance criteria:

- Add `ImageUploadError` and `isImageUploadError()`.
- Preserve `onError?: (error: Error) => void`.
- Export the type and guard from both root and `/headless` entrypoints.
- Package-owned request failures include a stable code and safe details.
- Signed URLs, request headers, and auth material are not included in error details.
- Documentation shows narrowing validation errors and upload errors separately.

### 4. Adoption proof

The project already has a usage report template. The missing layer is at least one concrete report from a real integration.

Acceptance criteria:

- Open one self-authored usage report from a real app or integration test repo.
- Confirm at least one path from the docs works outside this repository, preferably Next.js App Router or React Hook Form/Zod.
- Link the report in release notes or maintainer notes only if it is useful and the report grants public quotation permission.
- Treat pain points from the first report as docs or compatibility fixes before adding new features.

## Sequencing

1. Keep release trust verification on the next release checklist.
2. Keep upload session internals covered before adding hook behavior.
3. Iterate structured upload errors only from concrete integration feedback.
4. Collect usage proof and feed any concrete blockers back into docs or tests.

## Definition of Done

The v0.3 adoption hardening pass is done when:

- packed package consumer smoke passes on Node `18.18.0`, `20.x`, and `22.x`
- a tokenless trusted publish path has been verified end to end
- the main hook has a smaller upload orchestration boundary
- upload failures can be classified without parsing English messages
- at least one real usage report or equivalent integration proof exists

That is the bridge from "good package" to "safe dependency."
