# Error taxonomy

Product UIs should map errors by stable `code` fields. Do not parse English messages.

## Validation errors

Import from the root or `/headless` entry:

```ts
import { isImageValidationError } from 'image-drop-input';
```

| Code | Meaning |
| --- | --- |
| `invalid_type` | File MIME type or extension does not match `accept`. |
| `file_too_large` | Source or prepared file exceeds the configured byte limit. |
| `image_too_small` | Decoded dimensions are below the configured minimum. |
| `image_too_large` | Decoded dimensions exceed the configured maximum. |
| `too_many_pixels` | Decoded pixel count exceeds the configured pixel budget. |
| `decode_failed` | Browser image metadata could not be decoded. |

## Persistable value errors

Import the guard from the root or `/headless` entry:

```ts
import { isImagePersistableValueError } from 'image-drop-input';
```

| Code | Meaning |
| --- | --- |
| `preview_src_not_persistable` | `previewSrc` reached the submit boundary. |
| `src_is_temporary` | `src` uses `blob:`, `filesystem:`, or `data:` without an explicit allow option. |
| `empty_reference` | The value has neither durable `src` nor durable `key`. |
| `invalid_metadata` | Metadata shape is invalid, such as a non-string `key` or non-positive `width`. |

## Byte-budget errors

Import from `/headless`:

```ts
import { isImageBudgetError } from 'image-drop-input/headless';
```

| Code | Meaning |
| --- | --- |
| `invalid_policy` | Budget policy values are malformed or contradictory. |
| `decode_failed` | The browser could not decode valid image dimensions. |
| `encode_failed` | Canvas encoding failed. |
| `unsupported_output_type` | Requested output MIME type is unsupported or the browser fell back to another type. |
| `budget_unreachable` | The image cannot fit `outputMaxBytes` within the configured dimensions and quality floor. |

`budget_unreachable` may include attempt history. Use counts and coarse diagnostics for telemetry; do not dump full app context into logs.

## Upload errors

Import from the root or `/headless` entry:

```ts
import { isImageUploadError } from 'image-drop-input';
```

| Code | Meaning |
| --- | --- |
| `target_failed` | App-owned target creation failed before upload. |
| `request_unavailable` | No usable request transport was available. |
| `network_error` | Browser request failed before a response completed. |
| `http_error` | Upload endpoint returned a non-2xx status. |
| `response_mapping_failed` | App-owned response mapping threw or returned invalid output. |
| `unknown_upload_error` | An unexpected adapter error was wrapped. |

Upload details include safe helper fields such as `stage`, `method`, and `status`. `body`, `rawBody`, and `cause` can contain endpoint-specific diagnostics and should be treated as sensitive.

## Draft lifecycle errors

Import from `/headless`:

```ts
import { isImageDraftLifecycleError } from 'image-drop-input/headless';
```

| Code | Meaning |
| --- | --- |
| `missing_draft_key` | Draft upload returned neither `draftKey` nor `key`. |
| `draft_upload_in_progress` | Commit was requested while draft upload was still pending. |
| `commit_in_progress` | Replacement or discard was requested while commit was pending. |
| `discard_in_progress` | Commit or replacement was requested while discard was pending. |
| `commit_failed` | App-owned commit function rejected. |
| `discard_failed` | App-owned discard function rejected. |
| `cleanup_previous_failed` | Previous cleanup failed after the new image was committed. |

Draft error details may include `draftKey`. If your keys contain tenant or user identifiers, redact or hash them before telemetry.

## Local draft persistence errors

Import from `/headless`:

```ts
import { isLocalImageDraftError } from 'image-drop-input/headless';
```

| Code | Meaning |
| --- | --- |
| `draft_not_found` | A manifest or referenced local draft file could not be restored. |
| `invalid_input` | A caller provided malformed local draft input, such as an empty `fieldId` or invalid phase. |
| `quota_exceeded` | Browser storage did not have enough available quota for the draft bytes. |

For `quota_exceeded`, show user-facing copy that asks the user to free browser storage or choose a smaller image. Do not treat this as a server upload failure.

## Privacy rules

Use [Telemetry and privacy](./telemetry-and-privacy.md) for logging patterns. The short version:

- log code, stage, status, and coarse buckets
- avoid signed URLs, draft tokens, raw headers, local preview URLs, file contents, and EXIF metadata
- avoid object keys when they reveal tenant or user identifiers
