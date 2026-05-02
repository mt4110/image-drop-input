import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createObjectUrl } from '../core/create-object-url';
import {
  toPersistableImageValue,
  type PersistableImageValue
} from '../core/persistable-image-value';
import type { ImageUploadValue, ManagedObjectUrl } from '../core/types';
import type { UploadAdapter, UploadContext, UploadResult } from '../upload/types';

export interface ImageDraftDescriptor {
  draftKey: string;
  draftToken?: string;
  previewSrc?: string;
  src?: string;
  key?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  expiresAt?: string;
}

export type ImageDraftLifecyclePhase =
  | 'idle'
  | 'uploading-draft'
  | 'draft-ready'
  | 'committing'
  | 'committed'
  | 'discarding'
  | 'discarded'
  | 'failed';

export type ImageDraftLifecycleErrorCode =
  | 'missing_draft_key'
  | 'draft_upload_in_progress'
  | 'commit_in_progress'
  | 'discard_in_progress'
  | 'commit_failed'
  | 'discard_failed'
  | 'cleanup_previous_failed';

export interface ImageDraftLifecycleErrorDetails {
  phase?: ImageDraftLifecyclePhase;
  reason?: DiscardImageDraftRequest['reason'];
  draftKey?: string;
}

export interface ImageDraftLifecycleErrorOptions {
  cause?: unknown;
}

export class ImageDraftLifecycleError extends Error {
  readonly code: ImageDraftLifecycleErrorCode;
  readonly details: ImageDraftLifecycleErrorDetails;

  constructor(
    code: ImageDraftLifecycleErrorCode,
    message: string,
    details: ImageDraftLifecycleErrorDetails = {},
    options?: ImageDraftLifecycleErrorOptions
  ) {
    super(message, options);
    this.name = 'ImageDraftLifecycleError';
    this.code = code;
    this.details = details;
  }
}

export type ImageDraftUploadResult = UploadResult & {
  draftKey?: string;
  draftToken?: string;
  previewSrc?: string;
  expiresAt?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};

export type DraftUploadAdapterResult = ImageDraftUploadResult;

export type ImageDraftUploadAdapter = (
  file: Blob,
  context: UploadContext
) => Promise<ImageDraftUploadResult>;

export interface CommitImageDraftRequest {
  draft: ImageDraftDescriptor;
  previous: PersistableImageValue | null;
}

export interface DiscardImageDraftRequest {
  draft: ImageDraftDescriptor;
  reason: 'replace' | 'reset' | 'unmount' | 'manual';
}

export interface CleanupPreviousImageRequest {
  previous: PersistableImageValue;
  next: PersistableImageValue;
}

export interface UseImageDraftLifecycleOptions {
  committedValue: PersistableImageValue | null;
  onCommittedValueChange?: (next: PersistableImageValue | null) => void;
  uploadDraft: ImageDraftUploadAdapter;
  commitDraft: (request: CommitImageDraftRequest) => Promise<PersistableImageValue>;
  discardDraft?: (request: DiscardImageDraftRequest) => Promise<void>;
  cleanupPrevious?: (request: CleanupPreviousImageRequest) => Promise<void>;
  autoDiscard?: {
    onReplace?: boolean;
    onReset?: boolean;
    onUnmount?: boolean;
  };
  onError?: (error: Error) => void;
}

export interface UseImageDraftLifecycleReturn {
  valueForInput: ImageUploadValue | null;
  uploadForInput: UploadAdapter;
  phase: ImageDraftLifecyclePhase;
  draft: ImageDraftDescriptor | null;
  previous: PersistableImageValue | null;
  committedValue: PersistableImageValue | null;
  error: Error | null;
  clearError: () => void;
  commit: () => Promise<PersistableImageValue | null>;
  discard: (reason?: DiscardImageDraftRequest['reason']) => Promise<void>;
  resetToCommitted: () => void;
  hasDraft: boolean;
  canCommit: boolean;
  canDiscard: boolean;
}

const imageDraftLifecycleErrorCodes = new Set<ImageDraftLifecycleErrorCode>([
  'missing_draft_key',
  'draft_upload_in_progress',
  'commit_in_progress',
  'discard_in_progress',
  'commit_failed',
  'discard_failed',
  'cleanup_previous_failed'
]);

const imageDraftLifecyclePhases = new Set<ImageDraftLifecyclePhase>([
  'idle',
  'uploading-draft',
  'draft-ready',
  'committing',
  'committed',
  'discarding',
  'discarded',
  'failed'
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isObjectRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === 'undefined' || typeof value === 'string';
}

export function isImageDraftLifecycleError(
  error: unknown
): error is ImageDraftLifecycleError {
  if (!isObjectRecord(error)) {
    return false;
  }

  if (
    error.name !== 'ImageDraftLifecycleError' ||
    typeof error.message !== 'string' ||
    typeof error.code !== 'string' ||
    !imageDraftLifecycleErrorCodes.has(error.code as ImageDraftLifecycleErrorCode) ||
    !isPlainRecord(error.details)
  ) {
    return false;
  }

  const details = error.details;

  return (
    (typeof details.phase === 'undefined' ||
      imageDraftLifecyclePhases.has(details.phase as ImageDraftLifecyclePhase)) &&
    (typeof details.reason === 'undefined' ||
      details.reason === 'replace' ||
      details.reason === 'reset' ||
      details.reason === 'unmount' ||
      details.reason === 'manual') &&
    isOptionalString(details.draftKey)
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown image draft lifecycle error.');
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validOptionalNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function validOptionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function cleanImageDraftDescriptor(value: ImageDraftDescriptor): ImageDraftDescriptor {
  return {
    draftKey: value.draftKey,
    ...(typeof value.draftToken !== 'undefined' ? { draftToken: value.draftToken } : {}),
    ...(typeof value.previewSrc !== 'undefined' ? { previewSrc: value.previewSrc } : {}),
    ...(typeof value.src !== 'undefined' ? { src: value.src } : {}),
    ...(typeof value.key !== 'undefined' ? { key: value.key } : {}),
    ...(typeof value.fileName !== 'undefined' ? { fileName: value.fileName } : {}),
    ...(typeof value.mimeType !== 'undefined' ? { mimeType: value.mimeType } : {}),
    ...(typeof value.size !== 'undefined' ? { size: value.size } : {}),
    ...(typeof value.width !== 'undefined' ? { width: value.width } : {}),
    ...(typeof value.height !== 'undefined' ? { height: value.height } : {}),
    ...(typeof value.expiresAt !== 'undefined' ? { expiresAt: value.expiresAt } : {})
  };
}

function createDraftDescriptor(
  result: ImageDraftUploadResult,
  file: Blob,
  context: UploadContext,
  previewSrc?: string
): ImageDraftDescriptor {
  const draftKey = result.draftKey ?? result.key;

  if (!hasText(draftKey)) {
    throw new ImageDraftLifecycleError(
      'missing_draft_key',
      'Draft uploads must return draftKey or key.',
      { phase: 'uploading-draft' }
    );
  }

  return cleanImageDraftDescriptor({
    draftKey,
    draftToken: hasText(result.draftToken) ? result.draftToken : undefined,
    previewSrc,
    src: hasText(result.src) ? result.src : undefined,
    key: hasText(result.key) ? result.key : undefined,
    fileName: hasText(result.fileName) ? result.fileName : context.fileName,
    mimeType: hasText(result.mimeType)
      ? result.mimeType
      : context.mimeType || file.type || undefined,
    size: validOptionalNonNegativeNumber(result.size) ?? file.size,
    width: validOptionalPositiveNumber(result.width),
    height: validOptionalPositiveNumber(result.height),
    expiresAt: hasText(result.expiresAt) ? result.expiresAt : undefined
  });
}

function draftToInputValue(draft: ImageDraftDescriptor): ImageUploadValue {
  return {
    ...(typeof draft.src !== 'undefined' ? { src: draft.src } : {}),
    ...(typeof draft.previewSrc !== 'undefined' ? { previewSrc: draft.previewSrc } : {}),
    key: draft.key ?? draft.draftKey,
    ...(typeof draft.fileName !== 'undefined' ? { fileName: draft.fileName } : {}),
    ...(typeof draft.mimeType !== 'undefined' ? { mimeType: draft.mimeType } : {}),
    ...(typeof draft.size !== 'undefined' ? { size: draft.size } : {}),
    ...(typeof draft.width !== 'undefined' ? { width: draft.width } : {}),
    ...(typeof draft.height !== 'undefined' ? { height: draft.height } : {})
  };
}

function sameImageReference(
  previous: PersistableImageValue,
  next: PersistableImageValue
): boolean {
  if (previous.key && next.key) {
    return previous.key === next.key;
  }

  if (previous.src && next.src) {
    return previous.src === next.src;
  }

  return previous.key === next.key && previous.src === next.src;
}

function createCommitInProgressError(): ImageDraftLifecycleError {
  return new ImageDraftLifecycleError(
    'commit_in_progress',
    'Cannot change an image draft while commit is in progress.',
    { phase: 'committing' }
  );
}

function createDiscardInProgressError(): ImageDraftLifecycleError {
  return new ImageDraftLifecycleError(
    'discard_in_progress',
    'Cannot change an image draft while discard is in progress.',
    { phase: 'discarding' }
  );
}

export function useImageDraftLifecycle(
  options: UseImageDraftLifecycleOptions
): UseImageDraftLifecycleReturn {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isMountedRef = useRef(true);
  const uploadRunIdRef = useRef(0);
  const draftPreviewObjectUrlRef = useRef<ManagedObjectUrl | null>(null);
  const commitPromiseRef = useRef<Promise<PersistableImageValue | null> | null>(null);

  const [phase, setPhaseState] = useState<ImageDraftLifecyclePhase>('idle');
  const phaseRef = useRef<ImageDraftLifecyclePhase>('idle');
  const [draft, setDraftState] = useState<ImageDraftDescriptor | null>(null);
  const draftRef = useRef<ImageDraftDescriptor | null>(null);
  const [committedValue, setCommittedValueState] = useState<PersistableImageValue | null>(
    options.committedValue
  );
  const committedValueRef = useRef<PersistableImageValue | null>(options.committedValue);
  const [error, setErrorState] = useState<Error | null>(null);

  const setPhase = useCallback((nextPhase: ImageDraftLifecyclePhase) => {
    phaseRef.current = nextPhase;

    if (isMountedRef.current) {
      setPhaseState(nextPhase);
    }
  }, []);

  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      setErrorState(null);
    }
  }, []);

  const reportError = useCallback(
    (nextError: Error, nextPhase?: ImageDraftLifecyclePhase) => {
      if (isMountedRef.current) {
        setErrorState(nextError);

        if (nextPhase) {
          setPhase(nextPhase);
        }
      }

      optionsRef.current.onError?.(nextError);
    },
    [setPhase]
  );

  const releaseDraftPreviewObjectUrl = useCallback(() => {
    draftPreviewObjectUrlRef.current?.revoke();
    draftPreviewObjectUrlRef.current = null;
  }, []);

  const setDraftDescriptor = useCallback(
    (nextDraft: ImageDraftDescriptor | null, ownedPreview?: ManagedObjectUrl | null) => {
      if (draftPreviewObjectUrlRef.current?.url !== ownedPreview?.url) {
        releaseDraftPreviewObjectUrl();
      }

      draftPreviewObjectUrlRef.current = ownedPreview ?? null;
      draftRef.current = nextDraft;

      if (isMountedRef.current) {
        setDraftState(nextDraft);
      }
    },
    [releaseDraftPreviewObjectUrl]
  );

  const discardDescriptorBestEffort = useCallback(
    async (
      nextDraft: ImageDraftDescriptor,
      reason: DiscardImageDraftRequest['reason'],
      notify = true
    ) => {
      try {
        await optionsRef.current.discardDraft?.({ draft: nextDraft, reason });
      } catch (nextError) {
        if (!notify) {
          return;
        }

        const lifecycleError = new ImageDraftLifecycleError(
          'discard_failed',
          'Draft discard failed.',
          {
            draftKey: nextDraft.draftKey,
            reason
          },
          { cause: nextError }
        );

        optionsRef.current.onError?.(lifecycleError);
      }
    },
    []
  );

  useEffect(() => {
    committedValueRef.current = options.committedValue;
    setCommittedValueState(options.committedValue);
  }, [options.committedValue]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      uploadRunIdRef.current += 1;

      const currentDraft = draftRef.current;
      releaseDraftPreviewObjectUrl();

      if (currentDraft && optionsRef.current.autoDiscard?.onUnmount) {
        void discardDescriptorBestEffort(currentDraft, 'unmount', false);
      }
    };
  }, [discardDescriptorBestEffort, releaseDraftPreviewObjectUrl]);

  const uploadForInput = useCallback<UploadAdapter>(async (file, context) => {
    if (phaseRef.current === 'committing') {
      const lifecycleError = createCommitInProgressError();

      reportError(lifecycleError);

      throw lifecycleError;
    }

    if (phaseRef.current === 'discarding') {
      const lifecycleError = createDiscardInProgressError();

      reportError(lifecycleError);

      throw lifecycleError;
    }

    const runId = ++uploadRunIdRef.current;
    const previousDraft = draftRef.current;

    clearError();
    setPhase('uploading-draft');

    if (previousDraft && optionsRef.current.autoDiscard?.onReplace) {
      setDraftDescriptor(null);
      void discardDescriptorBestEffort(previousDraft, 'replace');
    }

    try {
      const result = await optionsRef.current.uploadDraft(file, context);

      if (runId !== uploadRunIdRef.current) {
        if (optionsRef.current.autoDiscard?.onReplace) {
          try {
            const staleDraft = createDraftDescriptor(result, file, context);
            void discardDescriptorBestEffort(staleDraft, 'replace', false);
          } catch {
            // If a stale upload cannot be identified, there is nothing useful to discard.
          }
        }

        return result;
      }

      if (!isMountedRef.current) {
        if (optionsRef.current.autoDiscard?.onUnmount) {
          try {
            const unmountedDraft = createDraftDescriptor(result, file, context);
            void discardDescriptorBestEffort(unmountedDraft, 'unmount', false);
          } catch {
            // Server-side TTL remains the fallback for unidentifiable stale draft uploads.
          }
        }

        return result;
      }

      const resultPreviewSrc = hasText(result.previewSrc) ? result.previewSrc : undefined;
      let nextDraft = createDraftDescriptor(result, file, context, resultPreviewSrc);
      let ownedPreviewObjectUrl: ManagedObjectUrl | null = null;

      if (!nextDraft.src && !nextDraft.previewSrc) {
        ownedPreviewObjectUrl = createObjectUrl(file);
        nextDraft = {
          ...nextDraft,
          previewSrc: ownedPreviewObjectUrl.url
        };
      }

      clearError();
      setDraftDescriptor(nextDraft, ownedPreviewObjectUrl);
      setPhase('draft-ready');

      return result;
    } catch (nextError) {
      if (runId !== uploadRunIdRef.current || !isMountedRef.current) {
        throw nextError;
      }

      const normalizedError = toError(nextError);

      reportError(normalizedError, 'failed');

      throw normalizedError;
    }
  }, [
    clearError,
    discardDescriptorBestEffort,
    reportError,
    setDraftDescriptor,
    setPhase
  ]);

  const discard = useCallback<UseImageDraftLifecycleReturn['discard']>(
    async (reason = 'manual') => {
      if (phaseRef.current === 'committing') {
        const lifecycleError = createCommitInProgressError();

        reportError(lifecycleError);

        throw lifecycleError;
      }

      const currentDraft = draftRef.current;

      if (!currentDraft) {
        return;
      }

      clearError();
      setPhase('discarding');

      try {
        await optionsRef.current.discardDraft?.({
          draft: currentDraft,
          reason
        });

        if (!isMountedRef.current) {
          return;
        }

        if (draftRef.current?.draftKey === currentDraft.draftKey) {
          setDraftDescriptor(null);
        }

        setPhase('discarded');
      } catch (nextError) {
        if (!isMountedRef.current) {
          return;
        }

        const lifecycleError = new ImageDraftLifecycleError(
          'discard_failed',
          'Draft discard failed.',
          {
            draftKey: currentDraft.draftKey,
            phase: 'discarding',
            reason
          },
          { cause: nextError }
        );

        reportError(lifecycleError, 'failed');

        throw lifecycleError;
      }
    },
    [clearError, reportError, setDraftDescriptor, setPhase]
  );

  const commit = useCallback<UseImageDraftLifecycleReturn['commit']>(async () => {
    if (commitPromiseRef.current) {
      return commitPromiseRef.current;
    }

    if (phaseRef.current === 'uploading-draft') {
      const lifecycleError = new ImageDraftLifecycleError(
        'draft_upload_in_progress',
        'Cannot commit an image draft while its upload is still in progress.',
        { phase: 'uploading-draft' }
      );

      reportError(lifecycleError, 'failed');

      throw lifecycleError;
    }

    if (phaseRef.current === 'discarding') {
      const lifecycleError = createDiscardInProgressError();

      reportError(lifecycleError);

      throw lifecycleError;
    }

    const currentDraft = draftRef.current;

    if (!currentDraft) {
      return committedValueRef.current;
    }

    const promise = (async () => {
      clearError();
      setPhase('committing');

      let previousValue: PersistableImageValue | null;
      let nextValue: PersistableImageValue;

      try {
        previousValue = toPersistableImageValue(committedValueRef.current);
        const commitResult = await optionsRef.current.commitDraft({
          draft: currentDraft,
          previous: previousValue
        });
        const persistableValue = toPersistableImageValue(commitResult);

        if (!persistableValue) {
          throw new ImageDraftLifecycleError(
            'commit_failed',
            'commitDraft must return a persistable image value.',
            { phase: 'committing' }
          );
        }

        nextValue = persistableValue;
      } catch (nextError) {
        const lifecycleError = isImageDraftLifecycleError(nextError)
          ? nextError
          : new ImageDraftLifecycleError(
              'commit_failed',
              'Image draft commit failed.',
              {
                draftKey: currentDraft.draftKey,
                phase: 'committing'
              },
              { cause: nextError }
            );

        reportError(lifecycleError, 'failed');

        throw lifecycleError;
      }

      if (!isMountedRef.current) {
        return nextValue;
      }

      clearError();
      committedValueRef.current = nextValue;
      setCommittedValueState(nextValue);
      optionsRef.current.onCommittedValueChange?.(nextValue);
      setDraftDescriptor(null);
      setPhase('committed');

      if (
        previousValue &&
        !sameImageReference(previousValue, nextValue) &&
        optionsRef.current.cleanupPrevious
      ) {
        try {
          await optionsRef.current.cleanupPrevious({
            previous: previousValue,
            next: nextValue
          });
        } catch (nextError) {
          const cleanupError = new ImageDraftLifecycleError(
            'cleanup_previous_failed',
            'Previous image cleanup failed after the new image was committed.',
            { phase: 'committed' },
            { cause: nextError }
          );

          reportError(cleanupError);
        }
      }

      return nextValue;
    })();

    commitPromiseRef.current = promise;

    try {
      return await promise;
    } finally {
      if (commitPromiseRef.current === promise) {
        commitPromiseRef.current = null;
      }
    }
  }, [clearError, reportError, setDraftDescriptor, setPhase]);

  const resetToCommitted = useCallback(() => {
    if (phaseRef.current === 'committing') {
      reportError(createCommitInProgressError());
      return;
    }

    if (phaseRef.current === 'discarding') {
      reportError(createDiscardInProgressError());
      return;
    }

    uploadRunIdRef.current += 1;

    if (!draftRef.current) {
      clearError();
      setPhase('idle');
      return;
    }

    if (optionsRef.current.autoDiscard?.onReset) {
      void discard('reset').catch(() => undefined);
      return;
    }

    clearError();
    setDraftDescriptor(null);
    setPhase('idle');
  }, [clearError, discard, setDraftDescriptor, setPhase]);

  const valueForInput = useMemo<ImageUploadValue | null>(() => {
    if (draft) {
      return draftToInputValue(draft);
    }

    return committedValue;
  }, [committedValue, draft]);

  const previous = draft ? committedValue : null;
  const hasDraft = Boolean(draft);
  const isBusy =
    phase === 'uploading-draft' || phase === 'committing' || phase === 'discarding';
  const canCommit = hasDraft && !isBusy;
  const canDiscard = hasDraft && phase !== 'committing' && phase !== 'discarding';

  return {
    valueForInput,
    uploadForInput,
    phase,
    draft,
    previous,
    committedValue,
    error,
    clearError,
    commit,
    discard,
    resetToCommitted,
    hasDraft,
    canCommit,
    canDiscard
  };
}
