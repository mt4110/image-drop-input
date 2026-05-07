# Claim ledger

This page keeps public claims tied to evidence and disproof paths.

It is deliberately conservative. A claim can be useful without being fully proven, but the docs should make the evidence level clear.

## Status meanings

| Status | Meaning |
| --- | --- |
| Proven | Covered by shipped API behavior, tests, and public docs inside the stated package boundary. |
| Partially proven | Supported by repo-maintained docs or tests, but missing broader evidence such as browser matrix, model tests, or external usage. |
| Not proven | No qualifying evidence yet. The project should not market this as true. |
| Not claimed | The checked claim is deliberately outside the package scope. |

## Evidence levels

| Level | Meaning |
| --- | --- |
| Unit test | Covered by repository tests for a public helper or component behavior. |
| Public docs | Documented behavior or boundary in repository docs. |
| Package metadata | Verified from `package.json` or the published package face. |
| Consumer smoke | Verified through packed-package consumer fixtures. |
| Repo-maintained report | A maintainer-authored report tying shipped APIs together. |
| Maintainer-owned external demo | Separate maintainer-owned repo installing the published npm package. |
| Third-party report | Usage report from someone outside the maintainer workflow. |
| Production-adjacent case study | Real app or internal tool report with workflow, constraints, and evidence limits. |
| None yet | No qualifying evidence exists yet. |

## Claims

Each entry checks a claim or boundary statement. Entries marked "Not claimed" document claims the project explicitly does not make.

### Product-safe image field category

- Claim checked: The package is a product-safe React image field for single-image forms.
- Evidence level: Public docs
- Evidence: [README](../README.md), [docs index](./README.md), [maintenance governance](./maintenance-governance.md).
- Disproof path: Public docs or defaults reposition it as a generic queue, editor, provider SDK, or multi-file uploader.
- Status: Proven

### Preview state boundary

- Claim checked: Browser-only preview state is separate from durable product image state.
- Evidence level: Unit test, Public docs
- Evidence: [value model](./value-model.md), [persistable value guard](./persistable-value.md), `tests/core/persistable-image-value.test.ts`.
- Disproof path: `previewSrc` is treated as a durable `src` or accepted by submit-boundary helpers.
- Status: Proven

### Persistable guard output

- Claim checked: `toPersistableImageValue()` does not return `previewSrc`.
- Evidence level: Unit test, Public docs
- Evidence: [persistable value guard](./persistable-value.md), `tests/core/persistable-image-value.test.ts`.
- Disproof path: The helper returns `previewSrc`, or accepts preview-only values as persistable.
- Status: Proven

### Temporary URL rejection

- Claim checked: Temporary `blob:`, `filesystem:`, and `data:` URLs are rejected by the default persistable guard.
- Evidence level: Unit test, Public docs
- Evidence: [persistable value guard](./persistable-value.md), `tests/core/persistable-image-value.test.ts`.
- Disproof path: The default guard accepts temporary URL schemes as durable `src` values.
- Status: Proven

### Server authority boundary

- Claim checked: Client submit-boundary sanitization is not server authority.
- Evidence level: Public docs
- Evidence: [persistable value guard](./persistable-value.md), [backend contracts](./backend-contracts.md), [security model](./security.md).
- Disproof path: Docs imply client validation replaces server authorization, storage checks, or product persistence rules.
- Status: Proven

### Provider SDK boundary

- Claim checked: The package does not bundle cloud provider SDKs or storage credentials.
- Evidence level: Package metadata, Public docs
- Evidence: [package metadata](../package.json), [backend contracts](./backend-contracts.md), [security model](./security.md).
- Disproof path: A runtime dependency or public API adds provider SDK or credential handling to the browser package.
- Status: Proven

### Explicit upload wiring

- Claim checked: Upload wiring is explicit and app-owned.
- Evidence level: Public docs
- Evidence: [uploads](./uploads.md), [backend contracts](./backend-contracts.md), [presigned PUT recipe](./recipes/presigned-put.md).
- Disproof path: The package starts creating signed URLs, choosing object keys, or inferring public URLs from upload URLs.
- Status: Proven

### Byte-budget helper

- Claim checked: `prepareImageToBudget()` targets `outputMaxBytes` when it succeeds.
- Evidence level: Unit test, Public docs
- Evidence: [byte budget solver](./byte-budget.md), [browser budget lab](./browser-budget-lab.md), `tests/core/prepare-image-to-budget.test.ts`.
- Disproof path: A successful result reports `size > outputMaxBytes` for a supported policy.
- Status: Proven

### Byte-identical browser output

- Claim checked: Byte-budget output is byte-identical across browser engines.
- Evidence level: None yet
- Evidence: [byte budget solver](./byte-budget.md) explicitly warns that browser encoders can differ.
- Disproof path: Any public docs, tests, or release notes claim byte-identical output across engines.
- Status: Not claimed

### Chromium and Firefox browser budget matrix

- Claim checked: Browser byte-budget behavior has been verified across Chromium and Firefox.
- Evidence level: Public docs
- Evidence: [browser budget lab](./browser-budget-lab.md), `npm run browser:budget-lab`.
- Disproof path: The browser lab is removed, or Chromium/Firefox fail the documented success/error expectations.
- Status: Proven

### WebKit browser budget matrix

- Claim checked: Browser byte-budget behavior has been verified across WebKit.
- Evidence level: None yet
- Evidence: WebKit is available as an exploratory `--browsers=webkit` target but is not part of the current documented pass matrix.
- Disproof path: No stable WebKit lab run exists, or WebKit fails the documented success/error expectations.
- Status: Not proven

### Upload and durable state boundary

- Claim checked: Draft upload success does not update the hook's committed value; durable image state comes from the app-owned commit response.
- Evidence level: Unit test, Public docs, Repo-maintained report
- Evidence: [draft lifecycle](./draft-lifecycle.md), [state machine](./state-machine.md), [backend contracts](./backend-contracts.md), [integration report](./integration-report.md), `tests/react/draft-lifecycle-model.test.tsx`, `tests/react/use-image-draft-lifecycle.test.tsx`.
- Disproof path: A draft upload mutates `committedValue`, or the hook treats a draft key as the durable product key before commit succeeds.
- Status: Proven

### Previous cleanup timing

- Claim checked: Previous image cleanup runs only after `commitDraft` returns a persistable value.
- Evidence level: Unit test, Public docs
- Evidence: [draft lifecycle](./draft-lifecycle.md), [state machine](./state-machine.md), [backend contracts](./backend-contracts.md), `tests/react/draft-lifecycle-model.test.tsx`, `tests/react/use-image-draft-lifecycle.test.tsx`.
- Disproof path: Cleanup runs after upload success but before `commitDraft` resolves, or runs after failed commit.
- Status: Proven

### Cleanup failure behavior

- Claim checked: Cleanup failure does not roll back the newly committed image.
- Evidence level: Unit test, Public docs
- Evidence: [draft lifecycle](./draft-lifecycle.md), [state machine](./state-machine.md), [backend contracts](./backend-contracts.md), `tests/react/draft-lifecycle-model.test.tsx`, `tests/react/use-image-draft-lifecycle.test.tsx`.
- Disproof path: A cleanup error restores the previous committed value or clears the new committed value.
- Status: Proven

### Discard and TTL cleanup

- Claim checked: Discard is best effort and server TTL cleanup is still required.
- Evidence level: Unit test, Public docs
- Evidence: [draft lifecycle](./draft-lifecycle.md), [state machine](./state-machine.md), [backend contracts](./backend-contracts.md), [security model](./security.md), `tests/react/draft-lifecycle-model.test.tsx`.
- Disproof path: Docs describe client discard as a guaranteed cleanup mechanism.
- Status: Proven

### Previous value authority

- Claim checked: Browser-sent previous image values are hints, not server authority.
- Evidence level: Public docs
- Evidence: [draft lifecycle](./draft-lifecycle.md), [backend contracts](./backend-contracts.md), [security model](./security.md), [persistable value guard](./persistable-value.md).
- Disproof path: Docs instruct servers to trust `previousKey` or browser state for deletion decisions.
- Status: Proven

### Backend reference protocol

- Claim checked: Atomic submit, idempotency, stale previous defense, duplicate commit, discard, and TTL cleanup are documented as app-owned backend responsibilities.
- Evidence level: Public docs
- Evidence: [backend contracts](./backend-contracts.md), [backend reference protocol](./backend-reference-protocol.md), [durable image boundary](./durable-image-boundary.md).
- Disproof path: Docs imply the browser package owns final persistence, cleanup authority, storage security, or provider lifecycle.
- Status: Proven

### Packed consumer behavior

- Claim checked: The packed package resolves for supported consumer shapes.
- Evidence level: Consumer smoke
- Evidence: [release verification](./release-verification.md), consumer fixtures in `consumer-fixtures/`.
- Disproof path: Packed install, root types, headless CommonJS, or Vite React UI consumer smoke fails for supported lanes.
- Status: Proven

### Peer dependency and export surface

- Claim checked: React is a peer dependency and the package keeps a narrow export surface.
- Evidence level: Package metadata, Consumer smoke
- Evidence: [package metadata](../package.json), [release verification](./release-verification.md), `tests/entrypoints.test.ts`.
- Disproof path: React becomes bundled as a runtime dependency, or exports broaden without release intent.
- Status: Proven

### Release surface process

- Claim checked: The release process treats GitHub Releases, npm, package metadata, tags, and changelog as release surfaces that must stay synchronized.
- Evidence level: Public docs
- Evidence: [release verification](./release-verification.md), `RELEASING.md`, `.github/PULL_REQUEST_TEMPLATE/release.md`.
- Disproof path: Release docs drop these checks, or release notes stop requiring the verification summary.
- Status: Proven

### Release trust snapshot

- Claim checked: Release notes can include a reproducible tarball summary with file count, tarball filename, packed size, and unpacked size.
- Evidence level: Public docs
- Evidence: [release verification](./release-verification.md), `RELEASING.md`, `scripts/verify-pack-manifest.mjs`.
- Disproof path: `npm run publish:check` stops printing tarball summary details, or release docs stop requiring them.
- Status: Proven

### Product-form integration shape

- Claim checked: The documented single-image product form boundary can be assembled from shipped APIs.
- Evidence level: Repo-maintained report
- Evidence: [integration report](./integration-report.md), [Next.js draft lifecycle recipe](./recipes/nextjs-draft-lifecycle.md), [product submit recipe](./recipes/product-submit-with-image-draft.md).
- Disproof path: The flow requires unshipped APIs, provider SDKs, or undocumented behavior.
- Status: Partially proven

### Maintainer-owned external demo

- Claim checked: A maintainer-owned external demo installs the published npm package outside this repository.
- Evidence level: None yet
- Evidence: [adoption evidence](./adoption-evidence.md) describes the target evidence.
- Disproof path: No separate public repo exists, or it uses a local workspace link instead of npm.
- Status: Not proven

### Third-party adoption

- Claim checked: Third-party adoption exists.
- Evidence level: None yet
- Evidence: [usage report template](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml), [adoption evidence](./adoption-evidence.md).
- Disproof path: No non-maintainer usage report or downstream integration evidence exists.
- Status: Not proven

### Production-adjacent usage

- Claim checked: Production-adjacent usage exists.
- Evidence level: None yet
- Evidence: [adoption evidence](./adoption-evidence.md) defines the evidence level.
- Disproof path: No real app or internal tool report describes version, workflow, constraints, and evidence limits.
- Status: Not proven

### Storage and compliance ownership

- Claim checked: The package provides storage security, malware scanning, CDN invalidation, or compliance readiness.
- Evidence level: Public docs
- Evidence: [backend contracts](./backend-contracts.md), [security model](./security.md), [integration report](./integration-report.md) explicitly assign these to the app/server.
- Disproof path: Public docs imply the browser package owns storage security or product compliance.
- Status: Not claimed

### Static security checks

- Claim checked: Repository-level dependency review exists in the repository, and CodeQL is handled by GitHub default setup rather than a duplicate advanced workflow.
- Evidence level: Public docs + repository settings
- Evidence: [supply-chain security](./supply-chain-security.md), `.github/workflows/security.yml`, `scripts/verify-pack-manifest.mjs`, GitHub CodeQL default setup.
- Disproof path: Security tooling adds runtime browser dependencies, the dependency-review workflow is removed, or GitHub default CodeQL setup is disabled without updating docs.
- Status: Partially proven

## Maintenance rule

Update this ledger when a public claim changes, when new tests prove a boundary, or when external evidence arrives.

Do not upgrade an adoption claim from "not proven" without a linked maintainer-owned external demo, third-party report, or production-adjacent case study.
