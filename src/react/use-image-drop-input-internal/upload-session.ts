import { useCallback, useRef, useState } from 'react';
import { createObjectUrl } from '../../core/create-object-url';
import type { ImageUploadValue, ManagedObjectUrl } from '../../core/types';
import type { UploadAdapter } from '../../upload/types';
import {
  clampProgressPercent,
  isAbortError
} from './errors';
import {
  createPreviewValue,
  type PreparedUpload
} from './preview-value';

export interface UseUploadSessionOptions {
  upload?: UploadAdapter;
  onProgress?: (percent: number) => void;
  isCurrentRun: (runId: number) => boolean;
  reportError: (error: unknown) => void;
  setCommittedValue: (
    next: ImageUploadValue | null,
    ownedObjectUrl?: ManagedObjectUrl | null
  ) => void;
}

export interface RetryUploadOptions {
  disabled?: boolean;
  clearError: () => void;
}

export interface UseUploadSessionReturn {
  canRetryUpload: (error: Error | null) => boolean;
  cancelActiveUpload: () => void;
  clearRetryableUpload: () => void;
  draftValue: ImageUploadValue | null;
  isUploading: boolean;
  progress: number;
  releaseDraftObjectUrl: () => void;
  reset: () => void;
  retryUpload: (createRunId: () => number, options: RetryUploadOptions) => void;
  uploadPrepared: (preparedUpload: PreparedUpload, runId: number) => Promise<void>;
}

export function useUploadSession({
  upload,
  onProgress,
  isCurrentRun,
  reportError,
  setCommittedValue
}: UseUploadSessionOptions): UseUploadSessionReturn {
  const [draftValue, setDraftValue] = useState<ImageUploadValue | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const draftObjectUrlRef = useRef<ManagedObjectUrl | null>(null);
  const retryableUploadRef = useRef<PreparedUpload | null>(null);

  const releaseDraftObjectUrl = useCallback(() => {
    draftObjectUrlRef.current?.revoke();
    draftObjectUrlRef.current = null;
  }, []);

  const clearRetryableUpload = useCallback(() => {
    retryableUploadRef.current = null;
  }, []);

  const clearDraft = useCallback(() => {
    setDraftValue(null);
  }, []);

  const discardDraftValue = useCallback(() => {
    clearDraft();
    releaseDraftObjectUrl();
  }, [clearDraft, releaseDraftObjectUrl]);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    discardDraftValue();
    clearRetryableUpload();
  }, [clearRetryableUpload, discardDraftValue]);

  const cancelActiveUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const uploadPrepared = useCallback(
    async (preparedUpload: PreparedUpload, runId: number) => {
      if (!upload) {
        return;
      }

      try {
        const objectUrl = createObjectUrl(preparedUpload.file);

        if (!isCurrentRun(runId)) {
          objectUrl.revoke();
          return;
        }

        const previewValue = createPreviewValue(preparedUpload, objectUrl.url);

        retryableUploadRef.current = preparedUpload;
        draftObjectUrlRef.current = objectUrl;
        setDraftValue(previewValue);
        setIsUploading(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        let lastProgressPercent = 0;

        const result = await upload(preparedUpload.file, {
          signal: abortController.signal,
          fileName: preparedUpload.value.fileName,
          originalFileName: preparedUpload.originalFileName,
          mimeType: preparedUpload.value.mimeType,
          onProgress(percent) {
            if (!isCurrentRun(runId)) {
              return;
            }

            const nextPercent = clampProgressPercent(percent);

            lastProgressPercent = nextPercent;
            setProgress(nextPercent);
            onProgress?.(nextPercent);
          }
        });

        if (!isCurrentRun(runId)) {
          return;
        }

        abortControllerRef.current = null;
        setIsUploading(false);
        setProgress(100);
        if (lastProgressPercent < 100) {
          onProgress?.(100);
        }
        clearRetryableUpload();

        const nextValue: ImageUploadValue = {
          ...preparedUpload.value,
          key: result.key,
          ...(result.src ? { src: result.src } : { previewSrc: previewValue.previewSrc })
        };

        clearDraft();

        if (result.src && result.src !== previewValue.previewSrc) {
          releaseDraftObjectUrl();
          setCommittedValue(nextValue);
          return;
        }

        const ownedDraftUrl = draftObjectUrlRef.current;
        draftObjectUrlRef.current = null;
        setCommittedValue(nextValue, ownedDraftUrl);
      } catch (nextError) {
        if (!isCurrentRun(runId)) {
          return;
        }

        if (isAbortError(nextError)) {
          abortControllerRef.current = null;
          reset();
          return;
        }

        abortControllerRef.current = null;
        setIsUploading(false);
        setProgress(0);
        discardDraftValue();
        reportError(nextError);
      }
    },
    [
      clearDraft,
      clearRetryableUpload,
      discardDraftValue,
      isCurrentRun,
      onProgress,
      releaseDraftObjectUrl,
      reportError,
      reset,
      setCommittedValue,
      upload
    ]
  );

  const canRetryUpload = useCallback(
    (error: Error | null) => Boolean(upload && error && retryableUploadRef.current && !isUploading),
    [isUploading, upload]
  );

  const retryUpload = useCallback(
    (createRunId: () => number, { disabled, clearError }: RetryUploadOptions) => {
      const preparedUpload = retryableUploadRef.current;

      if (disabled || isUploading || !preparedUpload) {
        return;
      }

      const runId = createRunId();

      cancelActiveUpload();
      discardDraftValue();
      clearError();
      setIsUploading(false);
      setProgress(0);

      void uploadPrepared(preparedUpload, runId);
    },
    [cancelActiveUpload, discardDraftValue, isUploading, uploadPrepared]
  );

  return {
    canRetryUpload,
    cancelActiveUpload,
    clearRetryableUpload,
    draftValue,
    isUploading,
    progress,
    releaseDraftObjectUrl,
    reset,
    retryUpload,
    uploadPrepared
  };
}
