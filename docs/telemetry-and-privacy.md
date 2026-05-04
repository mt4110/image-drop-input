# Telemetry and privacy

Telemetry should explain failure without exposing upload secrets.

Use stable `code` fields from package errors for product copy, retry labels, and analytics tags. Do not parse English error messages.

## Unsafe fields

Do not log:

- signed `uploadUrl` values
- `draftToken`
- raw upload response bodies
- raw request or response headers from storage providers
- full object keys when they include tenant, user, email, or product identifiers
- local `blob:` URLs
- file contents
- EXIF metadata
- pasted image clipboard contents

These values can carry credentials, private paths, temporary tokens, or personal data.

## Safe event shape

This is an app-side pattern, not a package export:

```ts
type SafeImageFieldTelemetry = {
  package: 'image-drop-input';
  event:
    | 'image.validation_failed'
    | 'image.budget_failed'
    | 'image.upload_failed'
    | 'image.draft_commit_failed'
    | 'image.draft_discard_failed'
    | 'image.draft_lifecycle_failed'
    | 'image.previous_cleanup_failed'
    | 'image.persistable_guard_failed';
  code: string;
  stage?: string;
  status?: number;
  mimeType?: string;
  sizeBucket?: '0-100kb' | '100-500kb' | '500kb-2mb' | '2mb-10mb' | '10mb+';
  widthBucket?: string;
  heightBucket?: string;
  attemptsCount?: number;
};
```

Prefer coarse buckets over raw dimensions or byte counts when analytics does not need exact values.

```ts
function bucketBytes(size: number | undefined): SafeImageFieldTelemetry['sizeBucket'] {
  if (typeof size !== 'number') return undefined;
  if (size < 100 * 1024) return '0-100kb';
  if (size < 500 * 1024) return '100-500kb';
  if (size < 2 * 1024 * 1024) return '500kb-2mb';
  if (size < 10 * 1024 * 1024) return '2mb-10mb';
  return '10mb+';
}
```

## Error mapping

```ts
import {
  ImagePersistableValueError,
  isImageUploadError,
  isImageValidationError
} from 'image-drop-input';
import { isImageBudgetError, isImageDraftLifecycleError } from 'image-drop-input/headless';

function toSafeImageTelemetry(error: unknown): SafeImageFieldTelemetry | null {
  if (isImageValidationError(error)) {
    return {
      package: 'image-drop-input',
      event: 'image.validation_failed',
      code: error.code
    };
  }

  if (isImageBudgetError(error)) {
    return {
      package: 'image-drop-input',
      event: 'image.budget_failed',
      code: error.code,
      attemptsCount: error.details.attempts?.length
    };
  }

  if (isImageUploadError(error)) {
    return {
      package: 'image-drop-input',
      event: 'image.upload_failed',
      code: error.code,
      stage: error.details.stage,
      status: error.details.status
    };
  }

  if (isImageDraftLifecycleError(error)) {
    const event =
      error.code === 'discard_failed'
        ? 'image.draft_discard_failed'
        : error.code === 'cleanup_previous_failed'
          ? 'image.previous_cleanup_failed'
          : error.code === 'commit_failed'
            ? 'image.draft_commit_failed'
            : 'image.draft_lifecycle_failed';

    return {
      package: 'image-drop-input',
      event,
      code: error.code
    };
  }

  if (error instanceof ImagePersistableValueError) {
    return {
      package: 'image-drop-input',
      event: 'image.persistable_guard_failed',
      code: error.code
    };
  }

  return null;
}
```

## Product copy

Keep user-facing copy calm and action-oriented:

| Error family | Product copy direction |
| --- | --- |
| validation | Explain the policy: type, size, dimensions, or pixel budget. |
| budget | Say the image could not be prepared under the app's upload budget. |
| upload | Offer retry when the error is network or server-recoverable. |
| draft commit | Tell the user the product was not saved and the previous image is still safe. |
| draft discard | Tell the user the draft will expire if cleanup cannot run now. |
| previous cleanup | Tell the user nothing was rolled back; retry cleanup operationally. |
| draft lifecycle | Explain the draft is not committed yet and the previous image remains safe. |
| persistable guard | Ask the user to upload or choose an already saved image. |

## Redaction helper pattern

When you need to attach context, pass allow-listed fields only:

```ts
function redactImageContext(context: {
  uploadUrl?: string;
  draftToken?: string;
  objectKey?: string;
  mimeType?: string;
  size?: number;
}) {
  return {
    mimeType: context.mimeType,
    sizeBucket: bucketBytes(context.size),
    hasObjectKey: Boolean(context.objectKey)
  };
}
```

Avoid generic object spreading into logs. It is too easy to include signed URLs, draft tokens, or storage headers by accident.
