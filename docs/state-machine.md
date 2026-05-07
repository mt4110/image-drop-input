# Draft lifecycle state machine

`useImageDraftLifecycle()` models one product image field where a selected image can be uploaded before the product form is saved.

The model has one central rule:

```txt
Upload success is not product save success.
```

Draft upload creates display state. The app-owned commit flow returns the persistable value the hook can commit. Previous cleanup is allowed only after that value exists.

## Registers

| Register | Meaning |
| --- | --- |
| `committedValue` | Last persistable image value known to the hook. It remains authoritative until commit succeeds. |
| `draft` | Temporary uploaded draft descriptor. It may include `draftKey`, `draftToken`, draft metadata, and browser preview state. |
| `valueForInput` | Display value passed to `ImageDropInput`. It is `draft` display state when a draft exists, otherwise `committedValue`. |
| `previous` | The current `committedValue` while a draft is displayed. It is a client hint for commit, not server authority. |
| `phase` | Current lifecycle phase. It is useful for UI controls, retries, and telemetry. |
| `error` | Last lifecycle error reported by the hook. It does not change the committed value by itself. |

`valueForInput` is intentionally not a persistable register. It can contain a temporary draft key or `previewSrc`.

## Phases

| Phase | Meaning |
| --- | --- |
| `idle` | No draft is active. `committedValue` is the display value. |
| `uploading-draft` | A draft upload is in flight. The previous committed value still owns the product state. |
| `draft-ready` | A draft upload succeeded and can be committed or discarded. |
| `committing` | The draft is being promoted through the app-owned commit flow. |
| `committed` | Commit succeeded. The draft is cleared and the returned persistable value is now committed. |
| `discarding` | The draft is being discarded through the app-owned discard flow. |
| `discarded` | Discard succeeded. The committed value remains unchanged. |
| `failed` | The last lifecycle action failed. The hook keeps recoverable state where possible. |

## Transition table

| From | Event | To | Commit authority |
| --- | --- | --- | --- |
| `idle`, `committed`, `discarded`, `failed` | user selects/replaces image | `uploading-draft` | Previous `committedValue` remains authoritative. |
| `uploading-draft` | draft upload succeeds | `draft-ready` | Upload result is display state only. |
| `uploading-draft` | draft upload fails | `failed` | Previous `committedValue` remains authoritative. |
| `uploading-draft` | upload aborts | `idle` or `draft-ready` | Abort does not mark product state failed. |
| `draft-ready` | commit starts | `committing` | Previous `committedValue` remains authoritative while commit is pending. |
| `committing` | commit succeeds | `committed` | Commit response becomes the new persistable `committedValue`. |
| `committing` | commit fails | `failed` | Previous `committedValue` remains authoritative and the draft remains retryable. |
| `committed` | previous cleanup succeeds | `committed` | New committed value remains authoritative. |
| `committed` | previous cleanup fails | `committed` with `cleanup_previous_failed` | New committed value remains authoritative. |
| `draft-ready`, `uploading-draft` | discard/reset starts | `discarding` or `idle` | Previous `committedValue` remains authoritative. |
| `discarding` | discard succeeds | `discarded` | Previous `committedValue` remains authoritative. |
| `discarding` | discard fails | `failed` | Previous `committedValue` remains authoritative and ready draft remains recoverable. |

## Concurrency guards

| Situation | Behavior |
| --- | --- |
| `commit()` while draft upload is in flight | Rejects with `draft_upload_in_progress`; `commitDraft` is not called. |
| replacement upload while commit is in flight | Rejects with `commit_in_progress`; the in-flight commit keeps ownership. |
| discard while commit is in flight | Rejects with `commit_in_progress`; the draft is not discarded. |
| commit or replacement upload while discard is in flight | Rejects with `discard_in_progress`; discard keeps ownership. |
| duplicate `commit()` calls while commit is in flight | Reuses the same commit promise; `commitDraft` is called once. |
| stale upload resolves after replace/reset/manual discard/unmount | Result is not accepted as current draft; configured discard runs best-effort. |

These guards are covered by the existing `tests/react/use-image-draft-lifecycle.test.tsx` suite.

## Invariants

| ID | Invariant | Evidence |
| --- | --- | --- |
| DL-1 | `committedValue` remains authoritative until commit succeeds. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-2 | Draft upload success updates display draft state, not `committedValue`. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-3 | `draftKey` is temporary and must not be treated as the durable product key before commit response. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-4 | Previous cleanup runs only after `commitDraft` returns a persistable value. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-5 | Cleanup failure does not roll back the new committed value. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-6 | Discard failure keeps the draft recoverable or leaves cleanup to server TTL. | `tests/react/draft-lifecycle-model.test.tsx` |
| DL-7 | Browser-sent previous values are hints; the server must load product state before deleting any previous object. | [backend contracts](./backend-contracts.md) |
| DL-8 | Browser-only `previewSrc` is display state and must not be persisted. | `tests/core/persistable-image-value.test.ts` |

## Server authority

The hook cannot make storage or database state authoritative. App-owned commit endpoints must:

- validate the draft belongs to the current user/session
- reject expired or stale draft tokens
- promote or copy the draft into a durable object/key
- update the product record in the same transaction when product fields and image must change together
- load the current product record before deciding which previous object can be cleaned up

The `previous` value passed by the hook helps the app create an idempotent cleanup request, but it is not enough to authorize deletion.

## Disproof paths

These are bugs or documentation regressions:

- a draft upload directly mutates durable product state
- `commitDraft` is called before a draft upload result exists
- previous cleanup runs before commit success or after a failed commit
- cleanup failure restores the previous committed value
- discard failure clears the only recoverable draft reference
- public docs tell servers to trust browser-sent `previousKey`
- `valueForInput` is documented as safe to persist without `toPersistableImageValue()`

See [Draft lifecycle](./draft-lifecycle.md), [Backend contracts](./backend-contracts.md), and [Product submit with image draft](./recipes/product-submit-with-image-draft.md) for endpoint shapes and product-form wiring.
