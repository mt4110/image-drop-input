# P2-07. Structured upload error model

- Priority: **P2**
- Depends on: **v0.2.0 P0/P1 hardening pack**
- Status: **design**
- PR target size: **small to medium**
- Public API break allowed: **no**
- Runtime dependency additions allowed: **no**

## Summary

Design a structured upload error model around `ImageUploadError` and `isImageUploadError()` without implementing it yet.

The goal is to make `onError` easier to use for localization, telemetry, and retry UI while keeping the existing public callback shape.

## Background

Validation errors already have `ImageValidationError`, stable codes, structured details, and `isImageValidationError()`.

Upload failures are currently generic `Error` objects in the important built-in paths:

- HTTP non-2xx: `Upload failed: <status> <statusText>`
- network failure: `Upload failed due to a network error.`
- fetch unavailable: `fetch is unavailable in this environment.`
- custom adapter failure: the `Error` thrown by the adapter

This is workable, but product integrations cannot reliably tell whether an upload failed during presign, request transport, response mapping, or custom adapter logic.

## Goals

- Add a stable upload error class and type guard.
- Preserve `onError?: (error: Error) => void`.
- Attach enough details for localization and telemetry: stage, HTTP status, status text, parsed body, and raw body.
- Structure package-owned upload failures from built-in helpers.
- Let custom adapter authors opt into the same model.
- Avoid leaking signed upload URLs or request headers through error details.

## Non-goals

- Redesign `onError`.
- Add automatic retry policy.
- Normalize provider-specific errors.
- Infer public URLs from signed upload URLs.
- Add runtime dependencies.
- Change validation error behavior.
- Surface abort/cancel as a user-facing upload error.

## Proposed API

```ts
export type ImageUploadErrorCode =
  | 'target_failed'
  | 'request_unavailable'
  | 'network_error'
  | 'http_error'
  | 'response_mapping_failed'
  | 'unknown_upload_error';

export type ImageUploadErrorStage =
  | 'target'
  | 'request'
  | 'response_mapping'
  | 'adapter';

export interface ImageUploadErrorDetails {
  stage: ImageUploadErrorStage;
  method?: 'POST' | 'PUT';
  status?: number;
  statusText?: string;
  body?: unknown;
  rawBody?: string;
}

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;
  readonly details: ImageUploadErrorDetails;
}

export function isImageUploadError(error: unknown): error is ImageUploadError;
```

Export from both:

- `image-drop-input`
- `image-drop-input/headless`

React users receive upload failures through `onError`; headless users and custom adapter authors should be able to construct or narrow the same error type without importing React-facing code.

## Stage Model

| Stage | Meaning | Package-owned? |
| --- | --- | --- |
| `target` | Presign or upload target acquisition failed. | Partly |
| `request` | HTTP upload request failed or could not run. | Yes |
| `response_mapping` | Built-in helper response mapping failed. | Partly |
| `adapter` | Custom adapter failed outside built-in helpers. | No |

The initial implementation should focus on package-owned request failures first. Custom adapter failures should not be wrapped globally by the hook because that may change consumer expectations around error identity and custom subclasses.

## Details Policy

Include:

- `stage`
- HTTP `method`
- HTTP `status`
- HTTP `statusText`
- parsed response `body`
- `rawBody` when useful for debugging

Do not include by default:

- signed upload URL
- request headers
- authorization tokens
- provider-specific metadata headers

Signed upload URLs often act like temporary credentials. They should not accidentally appear in `onError`, screenshots, logs, or telemetry payloads.

## Error Messages

Structured errors still need useful `message` values.

Recommended messages:

- `Upload failed: 413 Payload Too Large`
- `Upload failed due to a network error.`
- `Upload request is unavailable in this environment.`
- `Upload response mapping failed.`
- `Upload target resolution failed.`

Do not force consumers to inspect details for basic visible copy.

## Abort Behavior

Keep abort silent.

- `AbortError` should not call `onError`.
- `cancelUpload()` should not emit `ImageUploadError`.
- unmount cleanup should not emit `ImageUploadError`.

Cancellation is a user or lifecycle action, not a failed upload from the product's point of view.

## Implementation Sketch

### 1. Add upload error module

Suggested file:

- `src/upload/errors.ts`

Own:

- `ImageUploadError`
- `isImageUploadError()`
- small internal construction helpers if needed

### 2. Update request helper

`src/upload/request.ts` should produce `ImageUploadError` for:

- fetch unavailable -> `request_unavailable`, stage `request`
- fetch network rejection -> `network_error`, stage `request`
- XHR `onerror` -> `network_error`, stage `request`
- non-2xx response -> `http_error`, stage `request`, with status/body details

Abort remains `AbortError`.

### 3. Update built-in uploaders

`createPresignedPutUploader`:

- if `getTarget` throws `ImageUploadError`, rethrow it
- otherwise consider wrapping target acquisition failure as `target_failed`

`createMultipartUploader`:

- if `mapResponse` throws `ImageUploadError`, rethrow it
- otherwise consider wrapping response mapping failure as `response_mapping_failed`

`createRawPutUploader`:

- rely on the request helper unless a new mapping step is added later

### 4. Export from entrypoints

Update:

- `src/index.ts`
- `src/headless.ts`

### 5. Document usage

Add upload error narrowing guidance to `docs/uploads.md`.

Example:

```ts
import { isImageUploadError, isImageValidationError } from 'image-drop-input';

function toUserMessage(error: Error) {
  if (isImageValidationError(error)) {
    return localizeValidation(error.code, error.details);
  }

  if (isImageUploadError(error)) {
    return localizeUpload(error.code, error.details);
  }

  return 'Could not prepare this image.';
}
```

## Semver Analysis

This should be a minor release if implemented carefully.

Safe changes:

- add `ImageUploadError`
- add `isImageUploadError()`
- export new types
- make built-in upload helper failures use an `Error` subclass
- keep `onError` as `(error: Error) => void`

Risky changes:

- wrapping every custom adapter error in the hook
- changing `onError` signature
- exposing signed URLs or raw headers
- surfacing abort as a normal error
- removing or heavily changing existing error messages

Recommended stance:

- structure package-owned upload failures
- preserve unknown custom adapter errors unless the adapter already throws `ImageUploadError`
- preserve current message strings where practical

## Acceptance Criteria

- The need for `ImageUploadError` / `isImageUploadError()` is documented.
- The code / stage / details shape is documented.
- HTTP status / body details are covered.
- signed URL leakage risk is explicitly handled.
- semver risks and compatibility constraints are documented.
- No runtime implementation is included in this design PR.

## Future Implementation Checks

When implementation starts, require:

- unit tests for `ImageUploadError` and `isImageUploadError()`
- request helper tests for HTTP body/status details
- fetch and XHR network failure tests
- built-in uploader tests for target and response mapping wrappers
- React hook test proving `onError` receives structured upload errors from built-in helpers
- entrypoint tests for root and headless exports
- docs update showing localization and telemetry narrowing

## Open Questions

- Should `target_failed` wrapping be automatic for `getTarget`, or should examples teach consumers to throw `ImageUploadError` themselves?
- Should `rawBody` be included by default, or is parsed `body` enough for safer telemetry?
- Should `ImageUploadErrorDetails` include a redacted request label in the future?
- Should `unknown_upload_error` exist, or is preserving unknown custom adapter errors better?
