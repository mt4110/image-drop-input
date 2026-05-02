# Recipe: Next.js draft lifecycle

Use this pattern when a profile, product, or CMS form needs image replacement to stay consistent with the saved record.

The client uploads a draft object first. The profile submit route then commits that draft and updates the profile in one server-owned operation.

## Client component

```tsx
'use client';

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
  previous: PersistableImageValue | null;
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

    return (await response.json()) as { image: PersistableImageValue };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (image.hasDraft) {
      await image.commit();
      return;
    }

    const body = await submitProfile();
    setFields((current) => ({ ...current, image: body.image }));
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
    </form>
  );
}

async function uploadDraft(file: Blob, context: UploadContext) {
  const presign = await fetch('/api/images/drafts/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: context.fileName,
      mimeType: context.mimeType ?? file.type,
      size: file.size
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
    expiresAt: string;
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
    expiresAt: target.expiresAt,
    fileName: context.fileName,
    mimeType: context.mimeType ?? file.type,
    size: file.size
  };
}

function toImageDraftPayload(request: CommitImageDraftRequest): ImageDraftPayload {
  return {
    draftKey: request.draft.draftKey,
    previous: request.previous
  };
}

async function discardDraft(request: DiscardImageDraftRequest) {
  const response = await fetch('/api/images/drafts/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftKey: request.draft.draftKey,
      reason: request.reason
    }),
    keepalive: request.reason === 'unmount'
  });

  if (!response.ok) {
    throw new Error('Draft discard failed.');
  }
}
```

## `/api/images/drafts/presign`

```ts
// app/api/images/drafts/presign/route.ts
import { NextResponse, type NextRequest } from 'next/server';

type PresignDraftRequest = {
  fileName?: string;
  mimeType: string;
  size: number;
};

type PresignDraftResponse = {
  uploadUrl: string;
  headers?: Record<string, string>;
  draftKey: string;
  expiresAt: string;
};

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxUploadBytes = 5 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as Partial<PresignDraftRequest>;

  if (
    !body.mimeType ||
    !allowedMimeTypes.has(body.mimeType) ||
    typeof body.size !== 'number' ||
    body.size <= 0 ||
    body.size > maxUploadBytes
  ) {
    return NextResponse.json({ error: 'Invalid draft upload request.' }, { status: 400 });
  }

  const draft = await createDraftUploadTarget({
    userId: user.id,
    mimeType: body.mimeType,
    size: body.size
  });

  return NextResponse.json({
    uploadUrl: draft.uploadUrl,
    headers: draft.headers,
    draftKey: draft.draftKey,
    expiresAt: draft.expiresAt
  } satisfies PresignDraftResponse);
}

async function requireUser(_request: NextRequest) {
  return { id: 'user_123' };
}

async function createDraftUploadTarget(_input: {
  userId: string;
  mimeType: string;
  size: number;
}) {
  // Replace with your storage service or internal upload service.
  // Store draft ownership, MIME type, size, and expiry server-side.
  throw new Error('Connect this route to your storage layer.');
}
```

## `/api/profile` submit with image draft

```ts
// app/api/profile/route.ts
import { NextResponse, type NextRequest } from 'next/server';

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
    previous: PersistableImageValue | null;
  };
};

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as ProfileSubmitRequest;

  const result = await runTransaction(async () => {
    const currentProfile = await getProfileForUpdate(user.id);
    const nextImage = body.imageDraft
      ? await commitProfileImageDraft({
          userId: user.id,
          draftKey: body.imageDraft.draftKey,
          previous: currentProfile.image
        })
      : currentProfile.image;

    const profile = await updateProfile({
      userId: user.id,
      displayName: body.displayName,
      image: nextImage
    });

    if (currentProfile.image && nextImage && !sameImageReference(currentProfile.image, nextImage)) {
      await enqueuePreviousImageCleanup({
        previous: currentProfile.image,
        next: nextImage
      });
    }

    return profile;
  });

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
  previous: PersistableImageValue | null;
}) {
  // Validate owner, expiry, MIME type, object existence, and product permissions.
  // Move/copy the draft object to a final key and return the durable image value.
  throw new Error('Connect this route to your image commit service.');
}

async function updateProfile(_input: {
  userId: string;
  displayName: string;
  image: PersistableImageValue | null;
}) {
  throw new Error('Connect this route to your database.');
}

async function enqueuePreviousImageCleanup(_input: {
  previous: PersistableImageValue;
  next: PersistableImageValue;
}) {
  // Prefer a queue or idempotent background job.
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

## Best-effort discard route

```ts
// app/api/images/drafts/discard/route.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  const body = (await request.json()) as {
    draftKey?: string;
    reason?: 'replace' | 'reset' | 'unmount' | 'manual';
  };

  if (!body.draftKey) {
    return NextResponse.json({ error: 'Missing draft key.' }, { status: 400 });
  }

  await discardImageDraft({
    userId: user.id,
    draftKey: body.draftKey,
    reason: body.reason ?? 'manual'
  });

  return NextResponse.json({ ok: true });
}

async function requireUser(_request: NextRequest) {
  return { id: 'user_123' };
}

async function discardImageDraft(_input: {
  userId: string;
  draftKey: string;
  reason: 'replace' | 'reset' | 'unmount' | 'manual';
}) {
  // Delete only drafts owned by this user and still in draft storage.
}
```

## TTL reminder

Client discard is a convenience, not a guarantee. Add a server-side lifecycle rule or scheduled cleanup that removes expired draft objects and draft metadata. A good default is a short expiry, such as 15 to 60 minutes, depending on how long your form can reasonably stay open.

Never delete the previous committed image before the new image has been committed with the product record.
