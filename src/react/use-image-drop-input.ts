import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { createObjectUrl } from '../core/create-object-url';
import { getImageMetadata } from '../core/get-image-metadata';
import type { ImageDropInputMessages } from './customization';
import { resolveImageDropInputMessages } from './customization';
import type {
  AspectRatioValue,
  ImageTransformResult,
  ImageUploadValue,
  ManagedObjectUrl,
  TransformedImageFile
} from '../core/types';
import { matchesAcceptRule, splitAcceptRules, validateImage } from '../core/validate-image';
import type { UploadAdapter } from '../upload/types';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Something went wrong while processing the image.');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function extractFileName(file: Blob, fallback: string): string {
  return 'name' in file && typeof file.name === 'string' && file.name.length > 0 ? file.name : fallback;
}

function isTransformedImageFile(value: ImageTransformResult): value is TransformedImageFile {
  return typeof value === 'object' && value !== null && 'file' in value && value.file instanceof Blob;
}

function normalizeTransformedFile(originalFile: File, transformed: ImageTransformResult): File {
  const normalized = isTransformedImageFile(transformed) ? transformed : { file: transformed };
  const nextFile = normalized.file;

  if (!(nextFile instanceof Blob)) {
    throw new Error('transform must return a Blob, File, or { file, fileName?, mimeType? }.');
  }

  const fileName = normalized.fileName ?? extractFileName(nextFile, originalFile.name);
  const mimeType =
    normalized.mimeType || nextFile.type || originalFile.type || 'application/octet-stream';

  if (nextFile instanceof File && nextFile.name === fileName && nextFile.type === mimeType) {
    return nextFile;
  }

  return new File([nextFile], fileName, {
    lastModified: originalFile.lastModified,
    type: mimeType
  });
}

function extractFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  const files: File[] = [];

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();

      if (file) {
        files.push(file);
      }
    }
  }

  return files.length > 0 ? files : Array.from(dataTransfer.files);
}

function extractFile(dataTransfer: DataTransfer | null, accept?: string): File | null {
  const files = extractFiles(dataTransfer);

  if (files.length === 0) {
    return null;
  }

  const acceptRules = accept ? splitAcceptRules(accept) : [];

  if (acceptRules.length > 0) {
    const acceptedFile = files.find((file) =>
      acceptRules.some((rule) => matchesAcceptRule(file, rule))
    );

    if (acceptedFile) {
      return acceptedFile;
    }

    const imageFile = files.find((file) => file.type.startsWith('image/'));

    return imageFile ?? files[0] ?? null;
  }

  const imageFile = files.find((file) => file.type.startsWith('image/'));

  return imageFile ?? null;
}

function valueUsesUrl(value: ImageUploadValue | null | undefined, url: string): boolean {
  return value?.src === url || value?.previewSrc === url;
}

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
  maxBytes?: number;
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

export function useImageDropInput({
  accept,
  disabled,
  messages,
  maxBytes,
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
}: UseImageDropInputOptions) {
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
  const retryableFileRef = useRef<File | null>(null);
  const runIdRef = useRef(0);
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
    retryableFileRef.current = null;
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
          maxBytes,
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
            maxBytes,
            maxHeight,
            maxPixels,
            maxWidth,
            minWidth,
            minHeight
          })) ?? (await getImageMetadata(transformedFile));

        if (!isCurrentRun(runId)) {
          return;
        }

        const objectUrl = createObjectUrl(transformedFile);

        if (!isCurrentRun(runId)) {
          objectUrl.revoke();
          return;
        }

        // Keep object URLs in previewSrc so src keeps its meaning as a persisted/shareable reference.
        const previewValue: ImageUploadValue = {
          previewSrc: objectUrl.url,
          fileName: transformedFile.name,
          mimeType: transformedFile.type || file.type || undefined,
          size: transformedFile.size,
          width: metadata.width,
          height: metadata.height
        };

        if (!upload) {
          clearRetryableUpload();
          setCommittedValue(previewValue, objectUrl);
          return;
        }

        retryableFileRef.current = file;
        draftObjectUrlRef.current = objectUrl;
        setDraftValue(previewValue);
        setIsUploading(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const result = await upload(transformedFile, {
          signal: abortController.signal,
          fileName: transformedFile.name,
          originalFileName: file.name,
          mimeType: transformedFile.type || file.type || undefined,
          onProgress(percent) {
            if (!isCurrentRun(runId)) {
              return;
            }

            setProgress(percent);
            onProgress?.(percent);
          }
        });

        if (!isCurrentRun(runId)) {
          return;
        }

        abortControllerRef.current = null;
        setIsUploading(false);
        setProgress(100);
        clearRetryableUpload();

        const nextValue: ImageUploadValue = {
          fileName: previewValue.fileName,
          height: previewValue.height,
          key: result.key,
          mimeType: previewValue.mimeType,
          size: previewValue.size,
          width: previewValue.width,
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
      accept,
      cancelActiveUpload,
      clearRetryableUpload,
      discardDraftValue,
      disabled,
      isCurrentRun,
      maxBytes,
      maxHeight,
      maxPixels,
      maxWidth,
      minHeight,
      minWidth,
      onProgress,
      reportError,
      resetTransientState,
      setCommittedValue,
      transform,
      upload
    ]
  );

  const openFileDialog = useCallback(() => {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  }, [disabled]);

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

      if (disabled) {
        event.dataTransfer.dropEffect = 'none';
        setIsDragging(false);
        return;
      }

      event.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    },
    [disabled]
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

      if (disabled) {
        return;
      }

      const nextFile = extractFile(event.dataTransfer, accept);

      if (nextFile) {
        await handleFile(nextFile);
      }
    },
    [accept, disabled, handleFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      const nextFile = extractFile(event.clipboardData, accept);

      if (nextFile) {
        event.preventDefault();
        await handleFile(nextFile);
      }
    },
    [accept, disabled, handleFile]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFileDialog();
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && removable && displayValue) {
        event.preventDefault();
        removeValue();
      }
    },
    [disabled, displayValue, openFileDialog, removable, removeValue]
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
  const canRetryUpload = Boolean(upload && error && retryableFileRef.current && !isUploading);
  const retryUpload = useCallback(() => {
    const file = retryableFileRef.current;

    if (disabled || isUploading || !file) {
      return;
    }

    void handleFile(file);
  }, [disabled, handleFile, isUploading]);
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
