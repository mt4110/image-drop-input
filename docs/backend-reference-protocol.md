# Backend reference protocol

This protocol is an app-side reference for product forms that use `useImageDraftLifecycle()`. It is not package runtime code and it does not add a storage SDK.

The package can keep browser state honest. The server must make product state authoritative.

## Atomic submit

Prefer one product submit endpoint when image and fields must change together:

```txt
POST /api/products/:id
  validate user/session
  validate product ownership
  validate form fields
  validate draft ownership, purpose, expiry, and token
  commit draft to final object/key
  update product row with final image value
  record previous cleanup request after transaction success
  return durable product row
```

The browser sends draft identity. The server returns the persistable image value after the transaction commits.

## Transaction outline

```ts
type ProductSubmitRequest = {
  name: string;
  imageDraft?: {
    draftKey: string;
    draftToken?: string;
  };
  image?: {
    src?: string;
    key?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
  } | null;
};

type ProductSubmitResponse = {
  product: {
    id: string;
    name: string;
    image: {
      src?: string;
      key: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
      width?: number;
      height?: number;
    } | null;
  };
};
```

Reference sequence:

```txt
transaction:
  product = load product for update
  assert current user can edit product
  validate non-image fields

  if imageDraft exists:
    draft = load draft for update
    assert draft.owner == current user
    assert draft.product_id == product.id or draft.purpose is compatible
    assert draft.expires_at > now
    assert draft.token matches when token is required
    finalImage = promote draft into final object/key
    product.image = finalImage
    mark draft as committed

  else:
    product.image = validate persistable image payload or null

  save product
  enqueue cleanup for previous image only after save succeeds
commit transaction
return product
```

## Idempotency options

Choose one strategy before exposing retries:

| Strategy | Use when | Behavior |
| --- | --- | --- |
| Draft state transition | Drafts have database rows. | `uploaded -> committing -> committed`; duplicate commit returns the committed image or a safe conflict. |
| Unique finalization constraint | Final object rows are persisted. | Unique `(draft_id, product_id)` prevents duplicate final images. |
| Idempotency key | Client or server can attach a stable request id. | Replays return the original result while the key is valid. |
| Deterministic final key | Storage key can derive from draft id. | Duplicate copy/move overwrites or no-ops to the same final key. |

The hook deduplicates duplicate `commit()` calls in one mounted client. The server still needs idempotency because users can retry requests, open multiple tabs, or reconnect after network failure.

## Stale previous defense

Treat browser-sent previous values as hints only.

Unsafe:

```txt
delete previousKey from request body
```

Safe:

```txt
product = load current product record
previous = product.image before this transaction
next = committed image after this transaction
enqueue cleanup(previous, next) only after product.image == next
```

Cleanup must re-check that `previous.key` is no longer referenced by the current product record before deleting the object.

## Failure matrix

| Failure | Server behavior | Client result |
| --- | --- | --- |
| Product validation fails before draft commit | Do not commit draft. Return field errors. | Draft remains retryable or discardable until TTL. |
| Draft expired | Reject commit. | User uploads again. |
| Draft belongs to another user | Reject commit and audit. | Previous committed image remains authoritative. |
| Draft token is stale | Reject commit. | Previous committed image remains authoritative. |
| Storage object missing | Reject commit. | User uploads again. |
| Duplicate commit | Return existing committed image or safe conflict. | Do not create multiple final objects. |
| Commit succeeds, cleanup enqueue fails | Keep new product image. Record cleanup retry failure. | New committed image remains authoritative. |
| Cleanup worker fails | Retry idempotently. | Product image is not rolled back. |
| Browser sends stale previous key | Ignore it for authority; load product record. | No unrelated object is deleted. |

## Cleanup job

Previous cleanup should be a queue or scheduled worker:

```txt
cleanup(previousKey, nextKey, productId):
  product = load product
  if product.image.key != nextKey:
    return safe conflict or no-op
  if product.image.key == previousKey:
    return no-op
  delete previous object if no other record references it
  mark cleanup complete
```

Draft TTL cleanup should be separate:

```txt
delete expired draft metadata and objects
where draft.state != committed
and draft.expires_at < now
```

Client discard is useful, but server TTL cleanup is the guarantee.

## What belongs outside this package

Keep these in the app/server:

- storage provider SDKs
- malware scanning
- CDN invalidation
- object lifecycle policies
- audit logs
- product authorization
- database transactions
- cleanup queues

The browser package should keep exposing the boundary, not owning the backend.
