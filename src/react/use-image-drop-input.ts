import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from 'react';
import { createObjectUrl } from '../core/create-object-url';
import { getImageMetadata } from '../core/get-image-metadata';
import type { ImageDropInputMessages } from './customization';
import { resolveImageDropInputMessages } from './customization';
import type {
  AspectRatioValue,
  ImageTransformResult,
  ImageUploadValue,
  ManagedObjectUrl
} from '../core/types';
import { validateImage } from '../core/validate-image';
import type { UploadAdapter } from '../upload/types';
import {
  clampProgressPercent,
  isAbortError,
  toError
} from './use-image-drop-input-internal/errors';
import { extractFile } from './use-image-drop-input-internal/file-intake';
import {
  createPreviewValue,
  getValueFingerprint,
  valueUsesUrl,
  valueMatchesPendingCommit,
  type PreparedUpload
} from './use-image-drop-input-internal/preview-value';
import { normalizeTransformedFile } from './use-image-drop-input-internal/transform-result';

export function normalizeAspectRatio(aspectRatio?: AspectRatioValue): string | number | undefined {
  if (typeof aspectRatio === 'undefined') {
    return undefined;
  }

  return aspectRatio;
}

export function resolveDisplaySrc(value: ImageUploadValue | null | undefined): string | undefined {
  return value?.previewSrc ?? value?.src;
}

export interface UseImageDropInputOptions {
  value?: ImageUploadValue | null;
  onChange?: (next: ImageUploadValue | null) => void;
  upload?: UploadAdapter;
  transform?: (file: File) => Promise<ImageTransformResult> | ImageTransformResult;
  accept?: string;
  inputMaxBytes?: number;
  maxBytes?: number;
  outputMaxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
  disabled?: boolean;
  removable?: boolean;
  messages?: Partial<ImageDropInputMessages>;
  onError?: (error: Error) => void;
  onProgress?: (percent: number) => void;
}

export interface UseImageDropInputReturn {
  accept?: string;
  canRetryUpload: boolean;
  cancelUpload: () => void;
  clearError: () => void;
  disabled: boolean;
  displayValue: ImageUploadValue | null;
  displaySrc?: string;
  error: Error | null;
  handleDragLeave: (event: DragEvent<HTMLElement>) => void;
  handleDragOver: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => Promise<void>;
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  handlePaste: (event: ClipboardEvent<HTMLElement>) => Promise<void>;
  inputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isUploading: boolean;
  messages: ImageDropInputMessages;
  openFileDialog: () => void;
  progress: number;
  removeValue: () => void;
  retryUpload: () => void;
  statusMessage: string;
}

export function useImageDropInput({
  accept,
  disabled,
  messages,
  inputMaxBytes,
  maxBytes,
  outputMaxBytes,
  maxHeight,
  maxPixels,
  maxWidth,
  minHeight,
  minWidth,
  onChange,
  onError,
  onProgress,
  removable = true,
  transform,
  upload,
  value
}: UseImageDropInputOptions): UseImageDropInputReturn {
  const [internalValue, setInternalValue] = useState<ImageUploadValue | null>(value ?? null);
  const [draftValue, setDraftValue] = useState<ImageUploadValue | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedObjectUrlRef = useRef<ManagedObjectUrl | null>(null);
  const draftObjectUrlRef = useRef<ManagedObjectUrl | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryableUploadRef = useRef<PreparedUpload | null>(null);
  const runIdRef = useRef(0);
  const controlledValueFingerprintRef = useRef<string | undefined>(getValueFingerprint(value));
  const pendingControlledCommitRef = useRef<ImageUploadValue | null | undefined>(undefined);
  const isControlled = typeof value !== 'undefined';
  const committedValue = isControlled ? value ?? null : internalValue;
  const resolvedMessages = useMemo(() => resolveImageDropInputMessages(messages), [messages]);

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value ?? null);
    }
  }, [isControlled, value]);

  const releaseCommittedObjectUrl = useCallback(() => {
    committedObjectUrlRef.current?.revoke();
    committedObjectUrlRef.current = null;
  }, []);

  const releaseDraftObjectUrl = useCallback(() => {
    draftObjectUrlRef.current?.revoke();
    draftObjectUrlRef.current = null;
  }, []);

  const clearDraft = useCallback(() => {
    setDraftValue(null);
  }, []);

  const clearRetryableUpload = useCallback(() => {
    retryableUploadRef.current = null;
  }, []);

  const discardDraftValue = useCallback(() => {
    clearDraft();
    releaseDraftObjectUrl();
  }, [clearDraft, releaseDraftObjectUrl]);

  useEffect(() => {
    if (!isControlled) {
      return;
    }

    if (
      committedObjectUrlRef.current &&
      !valueUsesUrl(value, committedObjectUrlRef.current.url)
    ) {
      releaseCommittedObjectUrl();
    }
  }, [isControlled, releaseCommittedObjectUrl, value]);

  const setCommittedValue = useCallback(
    (next: ImageUploadValue | null, ownedObjectUrl?: ManagedObjectUrl | null) => {
      if (ownedObjectUrl) {
        if (committedObjectUrlRef.current && committedObjectUrlRef.current.url !== ownedObjectUrl.url) {
          committedObjectUrlRef.current.revoke();
        }

        committedObjectUrlRef.current = ownedObjectUrl;
      } else if (
        !next ||
        (committedObjectUrlRef.current &&
          !valueUsesUrl(next, committedObjectUrlRef.current.url))
      ) {
        releaseCommittedObjectUrl();
      }

      if (!isControlled) {
        setInternalValue(next);
      } else {
        pendingControlledCommitRef.current = next;
        controlledValueFingerprintRef.current = getValueFingerprint(next);
      }

      onChange?.(next);
    },
    [isControlled, onChange, releaseCommittedObjectUrl]
  );

  const reportError = useCallback(
    (nextError: unknown) => {
      const normalizedError = toError(nextError);
      setError(normalizedError);
      onError?.(normalizedError);
    },
    [onError]
  );

  const displayValue = draftValue ?? committedValue;

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      abortControllerRef.current?.abort();
      releaseDraftObjectUrl();
      releaseCommittedObjectUrl();
    };
  }, [releaseCommittedObjectUrl, releaseDraftObjectUrl]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetTransientState = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    discardDraftValue();
    clearError();
    clearRetryableUpload();
  }, [clearError, clearRetryableUpload, discardDraftValue]);

  const cancelActiveUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  useEffect(() => {
    if (!isControlled) {
      controlledValueFingerprintRef.current = undefined;
      pendingControlledCommitRef.current = undefined;
      return;
    }

    const nextValueFingerprint = getValueFingerprint(value);

    if (controlledValueFingerprintRef.current === nextValueFingerprint) {
      pendingControlledCommitRef.current = undefined;
      return;
    }

    const pendingControlledCommit = pendingControlledCommitRef.current;
    pendingControlledCommitRef.current = undefined;

    if (
      typeof pendingControlledCommit !== 'undefined' &&
      valueMatchesPendingCommit(value, pendingControlledCommit)
    ) {
      controlledValueFingerprintRef.current = nextValueFingerprint;
      return;
    }

    controlledValueFingerprintRef.current = nextValueFingerprint;

    runIdRef.current += 1;
    cancelActiveUpload();
    resetTransientState();
  }, [cancelActiveUpload, isControlled, resetTransientState, value]);

  const isCurrentRun = useCallback((runId: number) => runIdRef.current === runId, []);

  const cancelUpload = useCallback(() => {
    if (disabled) {
      return;
    }

    runIdRef.current += 1;
    cancelActiveUpload();
    resetTransientState();
  }, [cancelActiveUpload, disabled, resetTransientState]);

  const removeValue = useCallback(() => {
    if (disabled || !removable) {
      return;
    }

    runIdRef.current += 1;
    cancelActiveUpload();
    resetTransientState();
    releaseCommittedObjectUrl();
    setCommittedValue(null);
  }, [
    cancelActiveUpload,
    disabled,
    releaseCommittedObjectUrl,
    removable,
    resetTransientState,
    setCommittedValue
  ]);

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
          ...(result.src ? { src: result.src } : { previewSrc: previewValue.previewSrc }),
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
          resetTransientState();
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
      resetTransientState,
      setCommittedValue,
      upload
    ]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) {
        return;
      }

      const runId = ++runIdRef.current;
      cancelActiveUpload();
      resetTransientState();

      try {
        await validateImage(file, {
          accept,
          maxBytes: inputMaxBytes ?? maxBytes,
          maxHeight,
          maxPixels,
          maxWidth,
          minWidth,
          minHeight
        });

        const transformed = await (transform ? transform(file) : file);
        const transformedFile = normalizeTransformedFile(file, transformed);

        if (!isCurrentRun(runId)) {
          return;
        }

        const metadata =
          (await validateImage(transformedFile, {
            accept,
            maxBytes: outputMaxBytes ?? maxBytes,
            maxHeight,
            maxPixels,
            maxWidth,
            minWidth,
            minHeight
          })) ?? (await getImageMetadata(transformedFile));

        if (!isCurrentRun(runId)) {
          return;
        }

        const preparedUpload: PreparedUpload = {
          file: transformedFile,
          originalFileName: file.name,
          value: {
            fileName: transformedFile.name,
            mimeType: transformedFile.type || file.type || undefined,
            size: transformedFile.size,
            width: metadata.width,
            height: metadata.height
          }
        };

        if (upload) {
          await uploadPrepared(preparedUpload, runId);
          return;
        }

        const objectUrl = createObjectUrl(transformedFile);

        if (!isCurrentRun(runId)) {
          objectUrl.revoke();
          return;
        }

        // Keep object URLs in previewSrc so src keeps its meaning as a persisted/shareable reference.
        const previewValue = createPreviewValue(preparedUpload, objectUrl.url);

        clearRetryableUpload();
        setCommittedValue(previewValue, objectUrl);
      } catch (nextError) {
        if (!isCurrentRun(runId)) {
          return;
        }

        if (isAbortError(nextError)) {
          abortControllerRef.current = null;
          resetTransientState();
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
      accept,
      cancelActiveUpload,
      clearRetryableUpload,
      disabled,
      isCurrentRun,
      inputMaxBytes,
      maxBytes,
      maxHeight,
      maxPixels,
      maxWidth,
      minHeight,
      minWidth,
      outputMaxBytes,
      reportError,
      resetTransientState,
      setCommittedValue,
      transform,
      upload,
      uploadPrepared
    ]
  );

  const openFileDialog = useCallback(() => {
    if (disabled || isUploading) {
      return;
    }

    inputRef.current?.click();
  }, [disabled, isUploading]);

  const handleInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      event.target.value = '';

      if (nextFile) {
        await handleFile(nextFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();

      if (disabled || isUploading) {
        event.dataTransfer.dropEffect = 'none';
        setIsDragging(false);
        return;
      }

      event.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (disabled || !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }, [disabled]);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) {
        return;
      }

      const nextFile = extractFile(event.dataTransfer, accept);

      if (nextFile) {
        await handleFile(nextFile);
      }
    },
    [accept, disabled, handleFile, isUploading]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLElement>) => {
      if (disabled || isUploading) {
        return;
      }

      const nextFile = extractFile(event.clipboardData, accept);

      if (nextFile) {
        event.preventDefault();
        await handleFile(nextFile);
      }
    },
    [accept, disabled, handleFile, isUploading]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isUploading) {
          openFileDialog();
        }
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && removable && displayValue) {
        event.preventDefault();
        if (isUploading) {
          cancelUpload();
          return;
        }

        removeValue();
      }
    },
    [cancelUpload, disabled, displayValue, isUploading, openFileDialog, removable, removeValue]
  );

  const statusMessage = useMemo(() => {
    if (error) {
      return error.message;
    }

    if (isUploading) {
      return resolvedMessages.statusUploading(progress);
    }

    if (displayValue?.fileName) {
      return displayValue.fileName;
    }

    return resolvedMessages.statusIdle;
  }, [displayValue?.fileName, error, isUploading, progress, resolvedMessages]);
  const canRetryUpload = Boolean(upload && error && retryableUploadRef.current && !isUploading);
  const retryUpload = useCallback(() => {
    const preparedUpload = retryableUploadRef.current;

    if (disabled || isUploading || !preparedUpload) {
      return;
    }

    const runId = ++runIdRef.current;
    cancelActiveUpload();
    discardDraftValue();
    clearError();
    setIsUploading(false);
    setProgress(0);

    void uploadPrepared(preparedUpload, runId);
  }, [cancelActiveUpload, clearError, disabled, discardDraftValue, isUploading, uploadPrepared]);
  const displaySrc = resolveDisplaySrc(displayValue);

  return {
    accept,
    canRetryUpload,
    cancelUpload,
    clearError,
    disabled: disabled ?? false,
    displayValue,
    displaySrc,
    error,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleInputChange,
    handleKeyDown,
    handlePaste,
    inputRef,
    isDragging,
    isUploading,
    messages: resolvedMessages,
    openFileDialog,
    progress,
    removeValue,
    retryUpload,
    statusMessage
  };
}
