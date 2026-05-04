# Product submit with image draft

Use this recipe when a product form uploads image bytes before the form itself is saved.

Core rule:

```txt
Upload success is not product save success.
```

The safest product flow commits the image draft and saves the surrounding form in one server-owned operation.

## Preferred server transaction

```txt
POST /api/products/:id
  fields
  imageDraft

server transaction:
  validate user session
  validate product permission
  validate form fields
  validate draft ownership
  validate draft purpose
  validate draft expiry
  validate draft object exists
  promote draft to final object or mark it final
  update product row with final image value
  enqueue previous cleanup after transaction success
  return final persistable image value
```

This avoids the split case where the image is committed but the product name, price, profile text, or other fields fail to save.

## Client shape

The browser can still use `useImageDraftLifecycle()` for draft state, preview state, replacement, reset, and best-effort discard.

On submit, send draft identity rather than treating the draft preview as durable product state:

```tsx
async function submitProduct(fields: ProductFields) {
  const response = await fetch(`/api/products/${fields.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fields.name,
      imageDraft: image.draft
        ? {
            draftKey: image.draft.draftKey,
            draftToken: image.draft.draftToken
          }
        : null
    })
  });

  if (!response.ok) {
    throw new Error('Product save failed.');
  }

  const saved = await response.json();
  setProduct(saved.product);
}
```

Do not send `previewSrc` to the server. If the form is local-preview-only, use `toPersistableImageValue()` before submit. If the form uses drafts, let the server return the final durable image after commit.

`imageDraft.draftKey` is temporary. The saved product response, not the draft upload response, is where the client receives the durable image `key`.

## Weaker client-only sequence

This is easier to wire:

```ts
const committedImage = await image.commit();
await saveProduct({ ...fields, image: committedImage });
```

The caveat is real. If `image.commit()` succeeds and `saveProduct()` fails, the image and product fields can diverge. That may be acceptable for low-risk internal tools. User-facing product records usually deserve the server transaction above.

## Failure matrix

| Case | Expected product behavior |
| --- | --- |
| Draft upload succeeds but form save never happens | Draft remains temporary; server TTL cleanup eventually deletes it. |
| Draft upload fails | Previous committed image remains authoritative; user may retry upload. |
| Commit succeeds but product save fails in a client-only sequence | App must retry the product save or run compensating cleanup; prefer atomic server submit. |
| Product save succeeds but previous cleanup fails | New image remains committed; cleanup is retried or reported separately. |
| Discard fails | Draft remains retryable or expires by TTL; committed value remains safe. |
| Unmount auto-discard does not complete | Server TTL cleanup is the fallback. |
| Duplicate commit or submit retry | Client hook should reuse the in-flight commit; server commit/submit should not create a second final object. |
| Stale draft token | Server rejects commit/discard and leaves current product image unchanged. |
| Expired draft | Server rejects commit; client should ask the user to upload again. |
| Browser sends `previousKey` that is no longer authoritative | Server loads the current product row and ignores the stale hint. |

## Endpoint outline

```ts
type ProductImageDraftInput = {
  draftKey: string;
  draftToken?: string;
};

type ProductSubmitBody = {
  name: string;
  imageDraft: ProductImageDraftInput | null;
};

type PreviousCleanupJob = {
  previousKey: string;
  nextKey: string;
  reason: 'replace-committed';
};

export async function updateProduct(request: Request, productId: string) {
  const user = await requireUser(request);
  const body = (await request.json()) as ProductSubmitBody;

  const { saved, cleanupPrevious } = await database.transaction(async (tx) => {
    const product = await tx.products.findForUpdate(productId);

    await assertCanEditProduct(user, product);
    const fields = validateProductFields(body);

    const nextImage = body.imageDraft
      ? await commitDraftForProduct(tx, {
          user,
          product,
          draftKey: body.imageDraft.draftKey,
          draftToken: body.imageDraft.draftToken,
          purpose: 'product'
        })
      : product.image;

    // The locked product row owns previous-image cleanup decisions.
    // Do not trust a browser-sent previousKey for deletion.
    const saved = await tx.products.update(product.id, {
      ...fields,
      image: nextImage
    });

    const cleanupPrevious =
      product.image?.key && nextImage?.key && product.image.key !== nextImage.key
        ? ({
            previousKey: product.image.key,
            nextKey: nextImage.key,
            reason: 'replace-committed'
          } satisfies PreviousCleanupJob)
        : null;

    return { saved, cleanupPrevious };
  });

  if (cleanupPrevious) {
    try {
      await enqueuePreviousImageCleanup(cleanupPrevious);
    } catch (error) {
      reportPreviousCleanupFailure(error, cleanupPrevious);
    }
  }

  return Response.json({ product: saved });
}
```

The helpers in this outline are intentionally app-owned. Keep storage SDKs, credentials, object key policy, and database transactions in your server application, not in the browser package.

If cleanup enqueueing fails, report and retry it separately. Do not roll back or hide the committed product update after the transaction has already succeeded.
