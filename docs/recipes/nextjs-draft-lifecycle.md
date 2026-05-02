# Recipe: Next.js draft lifecycle

Use this pattern when a profile, product, or CMS form needs image replacement to stay consistent with the saved record.

The client uploads a draft object first. The form submit route then commits that draft and updates the product record in one server-owned operation. The snippets below are app-side examples. They intentionally use placeholder storage, auth, database, and queue helpers instead of provider SDK code.

Read the contract details in [Backend contracts](../backend-contracts.md).

## Client component

```tsx
'use client';

import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { ImageDropInput } from 'image-drop-input';
import {
  useImageDraftLifecycle,
  type CommitImageDraftRequest,
  type DiscardImageDraftRequest,
  type PersistableImageValue,
  type UploadContext
} from 'image-drop-input/headless';

type ProfileForm = {
  displayName: string;
  image: PersistableImageValue | null;
};

type ImageDraftPayload = {
  draftKey: string;
  draftToken?: string;
  purpose: 'avatar';
};

export function ProfileEditor({ initialProfile }: { initialProfile: ProfileForm }) {
  const [fields, setFields] = useState(initialProfile);
  const latestFields = useRef(fields);
  latestFields.current = fields;

  const image = useImageDraftLifecycle({
    committedValue: fields.image,
    onCommittedValueChange(next) {
      setFields((current) => ({ ...current, image: next }));
    },
    uploadDraft,
    async commitDraft(request) {
      const body = await submitProfile(toImageDraftPayload(request));
      if (!body.image) {
        throw new Error('Profile API did not return a committed image.');
      }

      return body.image;
    },
    discardDraft,
    autoDiscard: {
      onReplace: true,
      onReset: true,
      onUnmount: true
    }
  });

  async function submitProfile(imageDraft?: ImageDraftPayload) {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: latestFields.current.displayName,
        ...(imageDraft ? { imageDraft } : {})
      })
    });

    if (!response.ok) {
      throw new Error('Profile save failed.');
    }

    return (await response.json()) as { image: PersistableImageValue | null };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (image.hasDraft) {
      await image.commit();
      return;
    }

    const body = await submitProfile();
    setFields((current) => ({ ...current, image: body.image }));
  }

  function handleResetImage() {
    image.resetToCommitted();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={fields.displayName}
        onChange={(event) => {
          setFields((current) => ({
            ...current,
            displayName: event.target.value
          }));
        }}
      />

      <ImageDropInput
        value={image.valueForInput}
        onChange={() => {
          // The lifecycle tracks draft state. The profile API returns the durable value.
        }}
        upload={image.uploadForInput}
        accept="image/png,image/jpeg,image/webp"
        outputMaxBytes={5 * 1024 * 1024}
        disabled={image.phase === 'committing'}
      />

      <button
        type="submit"
        disabled={image.phase === 'uploading-draft' || image.phase === 'committing'}
      >
        Save
      </button>

      <button
        type="button"
        onClick={handleResetImage}
        disabled={image.phase === 'committing' || image.phase === 'discarding'}
      >
        Reset image
      </button>
    </form>
  );
}

async function uploadDraft(file: Blob, context: UploadContext) {
  const fileName = context.fileName ?? context.originalFileName ?? 'image';
  const mimeType = context.mimeType || file.type;

  if (!mimeType) {
    throw new Error('Image MIME type is required before creating a draft.');
  }

  const presign = await fetch('/api/images/drafts/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName,
      originalFileName: context.originalFileName,
      mimeType,
      size: file.size,
      purpose: 'avatar'
    }),
    signal: context.signal
  });

  if (!presign.ok) {
    throw new Error('Could not create draft upload target.');
  }

  const target = (await presign.json()) as {
    uploadUrl: string;
    headers?: Record<string, string>;
    draftKey: string;
    draftToken?: string;
    expiresAt: string;
    publicUrl?: string;
    objectKey?: string;
  };

  const upload = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: target.headers,
    body: file,
    signal: context.signal
  });

  if (!upload.ok) {
    throw new Error('Draft upload failed.');
  }

  return {
    draftKey: target.draftKey,
    draftToken: target.draftToken,
    src: target.publicUrl,
    expiresAt: target.expiresAt,
    fileName,
    mimeType,
    size: file.size
  };
}

function toImageDraftPayload(request: CommitImageDraftRequest): ImageDraftPayload {
  return {
    draftKey: request.draft.draftKey,
    draftToken: request.draft.draftToken,
    purpose: 'avatar'
  };
}

async function discardDraft(request: DiscardImageDraftRequest) {
  const response = await fetch('/api/images/drafts/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftKey: request.draft.draftKey,
      draftToken: request.draft.draftToken,
      reason: request.reason
    }),
    keepalive: request.reason === 'unmount'
  });

  if (!response.ok) {
    throw new Error('Draft discard failed.');
  }
}
```

Do not write `target.uploadUrl` or `target.draftToken` to browser logs, analytics, or user-facing error messages. If `publicUrl` is not returned, the hook keeps a local preview for display. Do not derive a render URL from `uploadUrl`, and do not save `image.valueForInput` as product data before the commit response returns a durable image value.

`image.resetToCommitted()` clears the local draft state. With `autoDiscard.onReset` enabled, it also calls the discard route for the draft when one exists.

## `/api/images/drafts/presign`

```ts
// app/api/images/drafts/presign/route.ts
import { NextResponse, type NextRequest } from 'next/server';

type ImagePurpose = 'avatar' | 'cover' | 'product' | 'custom';

type PresignDraftRequest = {
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  size: number;
  purpose: ImagePurpose;
};

type PresignDraftResponse = {
  uploadUrl: string;
  headers?: Record<string, string>;
  draftKey: string;
  draftToken?: string;
  expiresAt: string;
  publicUrl?: string;
  objectKey?: string;
};

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedPurposes = new Set<ImagePurpose>(['avatar', 'cover', 'product', 'custom']);
const maxUploadBytes = 5 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as Partial<PresignDraftRequest>;

  if (
    typeof body.fileName !== 'string' ||
    body.fileName.length === 0 ||
    !body.mimeType ||
    !allowedMimeTypes.has(body.mimeType) ||
    typeof body.size !== 'number' ||
    body.size <= 0 ||
    body.size > maxUploadBytes ||
    !body.purpose ||
    !allowedPurposes.has(body.purpose)
  ) {
    return NextResponse.json({ error: 'Invalid draft upload request.' }, { status: 400 });
  }

  const draft = await createDraftUploadTarget({
    userId: user.id,
    fileName: body.fileName,
    originalFileName: body.originalFileName,
    mimeType: body.mimeType,
    size: body.size,
    purpose: body.purpose
  });

  return NextResponse.json({
    uploadUrl: draft.uploadUrl,
    headers: draft.headers,
    draftKey: draft.draftKey,
    draftToken: draft.draftToken,
    expiresAt: draft.expiresAt,
    publicUrl: draft.publicUrl,
    objectKey: draft.objectKey
  } satisfies PresignDraftResponse);
}

async function requireUser(_request: NextRequest) {
  return { id: 'user_123' };
}

async function createDraftUploadTarget(_input: {
  userId: string;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  size: number;
  purpose: ImagePurpose;
}): Promise<PresignDraftResponse> {
  // App-side code: connect this to your storage service or internal upload service.
  // Store draft ownership, purpose, MIME type, size, object key, and expiry server-side.
  throw new Error('Connect this route to your storage layer.');
}
```

`objectKey` in this response is still a draft storage reference. Keep the durable product `key` for the submit response after commit.

## `/api/profile` submit with image draft

```ts
// app/api/profile/route.ts
import { NextResponse, type NextRequest } from 'next/server';

type ImagePurpose = 'avatar' | 'cover' | 'product' | 'custom';

type PersistableImageValue = {
  src?: string;
  key?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};

type ProfileSubmitRequest = {
  displayName: string;
  imageDraft?: {
    draftKey: string;
    draftToken?: string;
    purpose: ImagePurpose;
  };
};

type PreviousCleanupJob = {
  previous: PersistableImageValue;
  next: PersistableImageValue;
};

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as ProfileSubmitRequest;
  let cleanupAfterCommit: PreviousCleanupJob | null = null;

  const result = await runTransaction(async () => {
    const currentProfile = await getProfileForUpdate(user.id);
    const nextImage = body.imageDraft
      ? await commitProfileImageDraft({
          userId: user.id,
          draftKey: body.imageDraft.draftKey,
          draftToken: body.imageDraft.draftToken,
          purpose: body.imageDraft.purpose,
          previous: currentProfile.image
        })
      : currentProfile.image;

    const profile = await updateProfile({
      userId: user.id,
      displayName: body.displayName,
      image: nextImage
    });

    if (currentProfile.image && nextImage && !sameImageReference(currentProfile.image, nextImage)) {
      cleanupAfterCommit = {
        previous: currentProfile.image,
        next: nextImage
      };
    }

    return profile;
  });

  const cleanupJob = cleanupAfterCommit;

  if (cleanupJob) {
    await enqueuePreviousImageCleanup(cleanupJob).catch((error) => {
      reportCleanupFailure(error, cleanupJob);
    });
  }

  return NextResponse.json({
    image: result.image
  });
}

async function requireUser(_request: NextRequest) {
  return { id: 'user_123' };
}

async function runTransaction<T>(callback: () => Promise<T>) {
  // Replace with your database transaction helper.
  return callback();
}

async function getProfileForUpdate(_userId: string) {
  return {
    image: null as PersistableImageValue | null
  };
}

async function commitProfileImageDraft(_input: {
  userId: string;
  draftKey: string;
  draftToken?: string;
  purpose: ImagePurpose;
  previous: PersistableImageValue | null;
}): Promise<PersistableImageValue> {
  // Validate owner, expiry, token, purpose, MIME type, object existence, and product permissions.
  // Move/copy the draft object to a final key or mark it final.
  // Return a durable value with explicit src and/or key.
  throw new Error('Connect this route to your image commit service.');
}

async function updateProfile(_input: {
  userId: string;
  displayName: string;
  image: PersistableImageValue | null;
}): Promise<{ image: PersistableImageValue | null }> {
  throw new Error('Connect this route to your database.');
}

async function enqueuePreviousImageCleanup(_input: PreviousCleanupJob) {
  // Prefer a queue or idempotent background job.
}

function reportCleanupFailure(_error: unknown, _job: PreviousCleanupJob) {
  // Record enough context to retry by key, but do not log signed URLs or draft tokens.
}

function sameImageReference(previous: PersistableImageValue, next: PersistableImageValue) {
  if (previous.key && next.key) {
    return previous.key === next.key;
  }

  if (previous.src && next.src) {
    return previous.src === next.src;
  }

  return previous.key === next.key && previous.src === next.src;
}
```

This submit route is the safer shape because it commits the draft and updates the product record together. The current profile row, not the browser payload, decides which previous image is eligible for cleanup.

## Best-effort discard route

```ts
// app/api/images/drafts/discard/route.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as {
    draftKey?: string;
    draftToken?: string;
    reason?: 'replace' | 'reset' | 'unmount' | 'manual';
  };

  if (!body.draftKey) {
    return NextResponse.json({ error: 'Missing draft key.' }, { status: 400 });
  }

  await discardImageDraft({
    userId: user.id,
    draftKey: body.draftKey,
    draftToken: body.draftToken,
    reason: body.reason ?? 'manual'
  });

  return new Response(null, { status: 204 });
}

async function requireUser(_request: NextRequest) {
  return { id: 'user_123' };
}

async function discardImageDraft(_input: {
  userId: string;
  draftKey: string;
  draftToken?: string;
  reason: 'replace' | 'reset' | 'unmount' | 'manual';
}) {
  // App-side code: delete only drafts owned by this user and still in draft storage.
  // Make this idempotent. Returning success for an already-deleted draft is fine.
}
```

Discard must not delete committed objects. It is also not a guarantee: requests sent during unmount can be interrupted.

## Optional previous cleanup route or worker

Prefer an internal queue worker for previous cleanup. If you expose a route, keep it server-to-server or otherwise protected, and make it idempotent.

```ts
// app/api/images/cleanup-previous/route.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  await requireInternalCaller(request);
  const body = (await request.json()) as {
    previousKey?: string;
    nextKey?: string;
    reason?: 'replace-committed';
  };

  if (!body.previousKey || !body.nextKey || body.reason !== 'replace-committed') {
    return NextResponse.json({ error: 'Invalid cleanup request.' }, { status: 400 });
  }

  await cleanupPreviousImage({
    previousKey: body.previousKey,
    nextKey: body.nextKey
  });

  return new Response(null, { status: 204 });
}

async function requireInternalCaller(_request: NextRequest) {
  // Verify a queue signature, service token, or job runner identity.
}

async function cleanupPreviousImage(_input: { previousKey: string; nextKey: string }) {
  // Confirm nextKey is committed and previousKey is no longer referenced before deleting.
  // Return success if previousKey is already gone.
}
```

Run previous cleanup only after the new image is committed. A cleanup failure should be retried or reported separately; it should not rollback the profile update.

## TTL reminder

Client discard is a convenience, not a guarantee. Add a server-side lifecycle rule or scheduled cleanup that removes expired draft objects and draft metadata. A good default is a short expiry, such as 15 to 60 minutes, depending on how long your form can reasonably stay open.

Never delete the previous committed image before the new image has been committed with the product record.
