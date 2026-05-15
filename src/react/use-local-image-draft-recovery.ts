import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLocalImageDraftStore,
  type LocalImageDraftManifest,
  type LocalImageDraftRestoreResult,
  type LocalImageDraftStore,
  type LocalImageDraftStoreOptions
} from '../core/local-image-draft-store';

export type LocalImageDraftRecoveryStatus =
  | 'checking'
  | 'empty'
  | 'available'
  | 'restoring'
  | 'restored'
  | 'discarding'
  | 'discarded'
  | 'failed';

export interface UseLocalImageDraftRecoveryOptions {
  fieldId: string;
  productId?: string;
  store?: LocalImageDraftStore;
  storeOptions?: LocalImageDraftStoreOptions;
  autoCheck?: boolean;
  onRestored?: (result: LocalImageDraftRestoreResult) => void;
  onDiscarded?: (draft: LocalImageDraftManifest) => void;
  onError?: (error: Error) => void;
}

export interface UseLocalImageDraftRecoveryReturn {
  status: LocalImageDraftRecoveryStatus;
  drafts: LocalImageDraftManifest[];
  draft: LocalImageDraftManifest | null;
  error: Error | null;
  refresh: () => Promise<LocalImageDraftManifest[]>;
  restore: (draftId?: string) => Promise<LocalImageDraftRestoreResult | null>;
  discard: (draftId?: string) => Promise<void>;
  canRestore: boolean;
  canDiscard: boolean;
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : 'Unknown local image draft recovery error.');
}

export function useLocalImageDraftRecovery({
  autoCheck = true,
  fieldId,
  onDiscarded,
  onError,
  onRestored,
  productId,
  store,
  storeOptions
}: UseLocalImageDraftRecoveryOptions): UseLocalImageDraftRecoveryReturn {
  const ownedStoreRef = useRef<LocalImageDraftStore | null>(null);

  if (!store && !ownedStoreRef.current) {
    ownedStoreRef.current = createLocalImageDraftStore(storeOptions);
  }

  const createdStore = store ?? ownedStoreRef.current!;
  const isMountedRef = useRef(true);
  const refreshRunIdRef = useRef(0);
  const optionsRef = useRef({ onDiscarded, onError, onRestored });
  optionsRef.current = { onDiscarded, onError, onRestored };

  const [status, setStatus] = useState<LocalImageDraftRecoveryStatus>(
    autoCheck ? 'checking' : 'empty'
  );
  const [drafts, setDraftsState] = useState<LocalImageDraftManifest[]>([]);
  const draftsRef = useRef<LocalImageDraftManifest[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const setDrafts = useCallback((nextDrafts: LocalImageDraftManifest[]) => {
    draftsRef.current = nextDrafts;
    setDraftsState(nextDrafts);
  }, []);

  const removeDraft = useCallback((draftId: string) => {
    const remainingDrafts = draftsRef.current.filter((draft) => draft.draftId !== draftId);

    draftsRef.current = remainingDrafts;
    setDraftsState(remainingDrafts);

    return remainingDrafts;
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reportError = useCallback((nextError: unknown) => {
    const normalizedError = toError(nextError);

    if (isMountedRef.current) {
      setError(normalizedError);
      setStatus('failed');
    }

    optionsRef.current.onError?.(normalizedError);
  }, []);

  const refresh = useCallback(async () => {
    const runId = ++refreshRunIdRef.current;

    if (isMountedRef.current) {
      setError(null);
      setStatus('checking');
    }

    try {
      await createdStore.cleanupExpired();
      const recoverableDrafts = await createdStore.findRecoverableDrafts({
        fieldId,
        productId
      });

      if (isMountedRef.current && runId === refreshRunIdRef.current) {
        setDrafts(recoverableDrafts);
        setStatus(recoverableDrafts.length > 0 ? 'available' : 'empty');
      }

      return recoverableDrafts;
    } catch (nextError) {
      if (runId === refreshRunIdRef.current) {
        reportError(nextError);
      }

      return [];
    }
  }, [createdStore, fieldId, productId, reportError]);

  useEffect(() => {
    if (!autoCheck) {
      return;
    }

    void refresh();
  }, [autoCheck, refresh]);

  const restore = useCallback(
    async (draftId?: string) => {
      const targetDraftId = draftId ?? draftsRef.current[0]?.draftId;

      if (!targetDraftId) {
        return null;
      }

      if (isMountedRef.current) {
        setError(null);
        setStatus('restoring');
      }

      try {
        const result = await createdStore.restoreDraft(targetDraftId);

        if (result && isMountedRef.current) {
          setStatus('restored');
        } else if (isMountedRef.current) {
          const remainingDrafts = removeDraft(targetDraftId);

          setStatus(remainingDrafts.length > 0 ? 'available' : 'empty');
        }

        if (result) {
          optionsRef.current.onRestored?.(result);
        }

        return result;
      } catch (nextError) {
        reportError(nextError);
        return null;
      }
    },
    [createdStore, removeDraft, reportError]
  );

  const discard = useCallback(
    async (draftId?: string) => {
      const targetDraftId = draftId ?? draftsRef.current[0]?.draftId;

      if (!targetDraftId) {
        return;
      }

      const currentDraft =
        draftsRef.current.find((draft) => draft.draftId === targetDraftId) ?? null;

      if (isMountedRef.current) {
        setError(null);
        setStatus('discarding');
      }

      try {
        await createdStore.discardDraft(targetDraftId);

        if (currentDraft) {
          optionsRef.current.onDiscarded?.(currentDraft);
        }

        if (isMountedRef.current) {
          const remainingDrafts = removeDraft(targetDraftId);

          setStatus(remainingDrafts.length > 0 ? 'available' : 'discarded');
        }
      } catch (nextError) {
        reportError(nextError);
      }
    },
    [createdStore, removeDraft, reportError]
  );

  const draft = drafts[0] ?? null;
  const canRestore = status === 'available' && Boolean(draft);
  const canDiscard = (status === 'available' || status === 'failed') && Boolean(draft);

  return {
    status,
    drafts,
    draft,
    error,
    refresh,
    restore,
    discard,
    canRestore,
    canDiscard
  };
}
