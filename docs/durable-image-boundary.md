# Durable image boundary

`image-drop-input` is not trying to be the broadest uploader. Its narrow category is a single-image product field that keeps temporary browser state away from product records.

The boundary is:

```txt
browser preview != prepared bytes != draft upload != committed image != saved product payload
```

## Why this category exists

Single-image product forms often look simple:

```txt
profile avatar
workspace logo
article cover
CMS thumbnail
product image
```

The risky part is not file selection. The risky part is mixing states that have different lifetimes:

| State | Lifetime | Owner |
| --- | --- | --- |
| `File` / `Blob` | Browser session | Browser |
| `previewSrc` / object URL | UI feedback | Browser |
| Prepared bytes | Current transform attempt | Browser |
| Draft upload | Temporary object | App server/storage |
| Committed image value | Product image state | App server/database |
| Previous cleanup request | Async cleanup | App server/queue |

When those states blur together, apps can persist `blob:` URLs, delete the previous image too early, treat a draft key as final, or leave orphan drafts without TTL cleanup.

## Package boundary

The package owns:

- input UI and headless state
- local preview
- validation and transform hooks
- `toPersistableImageValue()` for submit-boundary sanitization
- `prepareImageToBudget()` for browser-side byte preparation
- `useImageDraftLifecycle()` for draft, commit, discard, and previous cleanup sequencing

The app owns:

- auth and authorization
- signed URLs
- object key policy
- product transactions
- storage lifecycle
- cleanup queues
- security/compliance controls

## Evidence map

| Boundary | Evidence |
| --- | --- |
| Preview is not persistable state | [Persistable value docs](./persistable-value.md), `tests/core/persistable-image-value.test.ts` |
| Draft upload does not update committed value | [State machine](./state-machine.md), `tests/react/draft-lifecycle-model.test.tsx` |
| Previous cleanup waits for commit | [State machine](./state-machine.md), `tests/react/use-image-draft-lifecycle.test.tsx` |
| Browser budget behavior is engine-tested | [Browser budget lab](./browser-budget-lab.md), `npm run browser:budget-lab` |
| Server authority remains app-owned | [Backend contracts](./backend-contracts.md), [backend reference protocol](./backend-reference-protocol.md) |
| Public claims stay falsifiable | [Claim ledger](./claim-ledger.md) |

## Category positioning

| Tool category | Good at | Not the same as this package |
| --- | --- | --- |
| FilePond / Uppy-style uploaders | queues, plugins, remote sources, dashboards, resumable workflows | They optimize broad upload orchestration. |
| Provider widgets | storage-provider integration and hosted flows | They own more of the storage/product boundary. |
| Headless file upload state machines | file selection and upload UI state | They do not define durable product image state by default. |
| `image-drop-input` | one image field with explicit preview, preparation, draft, commit, and persistable boundaries | It intentionally stays narrow. |

This positioning is not a claim that other tools are worse. It is a scope boundary.

## Non-goals

The package should not grow into:

- multi-file queues
- remote file sources
- crop/edit suites
- resumable upload orchestration
- cloud provider SDK wrappers
- storage-as-a-service
- malware scanning or compliance readiness

Those are valid product needs. They belong in app code, provider tools, or broader upload libraries.

## Release claim rule

Every public release should say exactly what the evidence proves:

- repo-maintained tests and docs can prove package behavior
- browser labs can prove engine-specific behavior
- maintainer-owned external demos can prove repo-external package installation
- third-party reports can prove non-maintainer evaluation
- production-adjacent case studies can prove real workflow fit

Do not collapse these evidence levels into a single adoption claim.
