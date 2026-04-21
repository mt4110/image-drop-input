import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent
} from 'react';
import { useCallback, useEffect } from 'react';
import { PreviewDialog } from './PreviewDialog';
import type {
  ImageDropInputActionsRenderProps,
  ImageDropInputClassNames,
  ImageDropInputFooterRenderProps,
  ImageDropInputMessages,
  ImageDropInputPlaceholderRenderProps,
  ImageDropInputRenderers
} from './customization';
import { BrowseGlyph, CloseGlyph, ExpandGlyph, ImageGlyph, RemoveGlyph, SpinnerGlyph } from './icons';
import { joinClassNames } from './customization';
import { normalizeAspectRatio, useImageDropInput } from './use-image-drop-input';
import { usePreviewDialog } from './use-preview-dialog';
import type { AspectRatioValue, ImageTransformResult, ImageUploadValue } from '../core/types';
import type { UploadAdapter } from '../upload/types';

export type {
  ImageDropInputActionsRenderProps,
  ImageDropInputClassNames,
  ImageDropInputFooterRenderProps,
  ImageDropInputMessages,
  ImageDropInputPlaceholderRenderProps
} from './customization';

export interface ImageDropInputProps extends ImageDropInputRenderers {
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
  previewable?: boolean;
  /**
   * @deprecated Use `previewable` instead. The current behavior opens a preview dialog rather than a true zoom surface.
   */
  zoomable?: boolean;
  capture?: 'user' | 'environment';
  aspectRatio?: AspectRatioValue;
  className?: string;
  classNames?: Partial<ImageDropInputClassNames>;
  messages?: Partial<ImageDropInputMessages>;
  style?: CSSProperties;
  rootStyle?: CSSProperties;
  dropzoneStyle?: CSSProperties;
  onError?: (error: Error) => void;
  onProgress?: (percent: number) => void;
}

function splitStyleByCustomProperties(style?: CSSProperties): {
  customProperties: CSSProperties;
  otherStyles: CSSProperties;
} {
  if (!style) {
    return {
      customProperties: {},
      otherStyles: {}
    };
  }

  const customProperties: CSSProperties = {};
  const otherStyles: CSSProperties = {};
  const customPropertiesRecord = customProperties as Record<string, unknown>;
  const otherStylesRecord = otherStyles as Record<string, unknown>;

  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith('--')) {
      customPropertiesRecord[key] = value;
      continue;
    }

    otherStylesRecord[key] = value;
  }

  return {
    customProperties,
    otherStyles
  };
}

function stopSurfaceEventPropagation(
  event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
) {
  event.stopPropagation();
}

export function ImageDropInput({
  accept = 'image/*',
  aspectRatio,
  capture,
  className,
  classNames,
  disabled,
  inputMaxBytes,
  maxBytes,
  outputMaxBytes,
  maxHeight,
  maxPixels,
  maxWidth,
  messages,
  minHeight,
  minWidth,
  onChange,
  onError,
  onProgress,
  previewable,
  removable = true,
  renderActions,
  renderFooter,
  renderPlaceholder,
  dropzoneStyle,
  rootStyle,
  style,
  transform,
  upload,
  value,
  zoomable = true
}: ImageDropInputProps) {
  const previewDialog = usePreviewDialog();
  const {
    cancelUpload,
    canRetryUpload,
    disabled: isDisabled,
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
  } = useImageDropInput({
    accept,
    disabled,
    inputMaxBytes,
    messages,
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
    removable,
    transform,
    upload,
    value
  });

  const { customProperties: inheritedRootCustomProperties, otherStyles: legacyDropzoneStyle } =
    splitStyleByCustomProperties(style);
  const resolvedPreviewable = previewable ?? zoomable;
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
  const mergedRootStyle: CSSProperties = {
    ...inheritedRootCustomProperties,
    ...rootStyle
  };
  const mergedDropzoneStyle: CSSProperties = {
    ...legacyDropzoneStyle,
    ...dropzoneStyle
  };
  const hasImage = Boolean(displaySrc);

  if (typeof normalizedAspectRatio !== 'undefined') {
    mergedDropzoneStyle.aspectRatio = normalizedAspectRatio;
  }

  const openPreview = useCallback(() => {
    if (!resolvedPreviewable || !displaySrc) {
      return;
    }

    previewDialog.open();
  }, [displaySrc, previewDialog.open, resolvedPreviewable]);

  useEffect(() => {
    if (resolvedPreviewable && displaySrc) {
      return;
    }

    previewDialog.close();
  }, [displaySrc, previewDialog.close, resolvedPreviewable]);

  const renderState = {
    disabled: isDisabled,
    displayValue,
    displaySrc,
    error,
    isDragging,
    isUploading,
    messages: resolvedMessages,
    progress
  };
  const hasDeterminateProgress = isUploading && progress > 0;

  const placeholderContent = hasImage
    ? null
    : renderPlaceholder?.({
        ...renderState,
        openFileDialog
      }) ?? (
        <div className={joinClassNames('idi-placeholder', classNames?.placeholder)}>
          <span className={joinClassNames('idi-placeholderIcon', classNames?.placeholderIcon)} aria-hidden="true">
            <ImageGlyph width={26} height={26} />
          </span>
          <span className={joinClassNames('idi-placeholderTitle', classNames?.placeholderTitle)}>
            {resolvedMessages.placeholderTitle}
          </span>
          {resolvedMessages.placeholderDescription ? (
            <span
              className={joinClassNames(
                'idi-placeholderCopy',
                classNames?.placeholderDescription
              )}
            >
              {resolvedMessages.placeholderDescription}
            </span>
          ) : null}
        </div>
      );

  const actionsContent = renderActions?.({
    ...renderState,
    cancelUpload,
    openFileDialog,
    openPreview,
    previewable: resolvedPreviewable,
    removable,
    removeValue,
    zoomable: resolvedPreviewable
  }) ?? (
    <>
      {resolvedPreviewable && hasImage && !isUploading ? (
        <button
          className={joinClassNames(
            'idi-iconButton',
            classNames?.iconButton,
            classNames?.previewButton
          )}
          type="button"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            openPreview();
          }}
          aria-label={resolvedMessages.openPreview}
        >
          <ExpandGlyph width={18} height={18} aria-hidden="true" />
        </button>
      ) : null}

      {hasImage && !isUploading ? (
        <button
          className={joinClassNames(
            'idi-iconButton',
            classNames?.iconButton,
            classNames?.replaceButton
          )}
          type="button"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            openFileDialog();
          }}
          aria-label={resolvedMessages.replaceImage}
        >
          <BrowseGlyph width={18} height={18} aria-hidden="true" />
        </button>
      ) : null}

      {isUploading ? (
        <button
          className={joinClassNames(
            'idi-iconButton',
            classNames?.iconButton,
            classNames?.cancelButton
          )}
          type="button"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            cancelUpload();
          }}
          aria-label={resolvedMessages.cancelUpload}
        >
          {hasDeterminateProgress ? (
            <CloseGlyph width={18} height={18} aria-hidden="true" />
          ) : (
            <SpinnerGlyph
              className={joinClassNames('idi-spinner', classNames?.spinner)}
              width={18}
              height={18}
              aria-hidden="true"
            />
          )}
        </button>
      ) : removable && hasImage ? (
        <button
          className={joinClassNames(
            'idi-iconButton',
            classNames?.iconButton,
            classNames?.removeButton
          )}
          type="button"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            removeValue();
          }}
          aria-label={resolvedMessages.removeImage}
        >
          <RemoveGlyph width={18} height={18} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );

  const shouldShowDefaultFooter = isUploading || Boolean(error);
  const footerContent = renderFooter?.({
    ...renderState,
    canRetryUpload,
    retryUpload,
    statusMessage
  }) ??
    (shouldShowDefaultFooter ? (
      error ? (
        <div className={joinClassNames('idi-errorSurface', classNames?.errorSurface)} role="alert">
          <span>{statusMessage}</span>
          {canRetryUpload ? (
            <button
              className={joinClassNames('idi-footerButton', classNames?.footerButton)}
              type="button"
              onClick={retryUpload}
            >
              {resolvedMessages.retryUpload}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className={joinClassNames('idi-status', classNames?.status)} role="status">
            {statusMessage}
          </div>
          {hasDeterminateProgress ? (
            <div className={joinClassNames('idi-progress', classNames?.progress)} aria-hidden="true">
              <div
                className={joinClassNames('idi-progressBar', classNames?.progressBar)}
                style={{ width: `${Math.max(progress, 8)}%` }}
              />
            </div>
          ) : null}
        </>
      )
    ) : null);

  return (
    <div className={joinClassNames('idi-root', classNames?.root, className)} style={mergedRootStyle}>
      <input
        ref={inputRef}
        className={joinClassNames('idi-input', classNames?.input)}
        type="file"
        accept={accept}
        capture={capture}
        tabIndex={-1}
        disabled={isDisabled}
        onChange={handleInputChange}
        aria-hidden="true"
        aria-label={resolvedMessages.chooseFile}
      />
      <div
        className={joinClassNames('idi-dropzone', classNames?.dropzone)}
        data-disabled={isDisabled}
        data-dragging={isDragging}
        data-has-image={hasImage}
        role="button"
        tabIndex={!isDisabled ? 0 : undefined}
        aria-keyshortcuts={hasImage && removable ? 'Enter Space Delete Backspace' : 'Enter Space'}
        aria-label={
          hasImage ? resolvedMessages.dropzoneLabelFilled : resolvedMessages.dropzoneLabelEmpty
        }
        aria-disabled={isDisabled}
        onClick={!hasImage ? openFileDialog : undefined}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        style={mergedDropzoneStyle}
      >
        {hasImage && displaySrc ? (
          <figure className={joinClassNames('idi-preview', classNames?.preview)}>
            <img
              className={joinClassNames('idi-image', classNames?.image)}
              src={displaySrc}
              alt={resolvedMessages.selectedImageAlt}
              draggable={false}
            />
            <div className={joinClassNames('idi-overlay', classNames?.overlay)} aria-hidden="true" />
          </figure>
        ) : (
          placeholderContent
        )}

        <div
          className={joinClassNames('idi-actions', classNames?.actions)}
          onClick={stopSurfaceEventPropagation}
          onKeyDown={stopSurfaceEventPropagation}
        >
          {actionsContent}
        </div>

        {footerContent ? (
          <div
            className={joinClassNames('idi-footer', classNames?.footer)}
            onClick={stopSurfaceEventPropagation}
            onKeyDown={stopSurfaceEventPropagation}
          >
            {footerContent}
          </div>
        ) : null}
      </div>

      <PreviewDialog
        alt={resolvedMessages.previewImageAlt}
        ariaLabel={resolvedMessages.previewDialog}
        classNames={classNames}
        closeLabel={resolvedMessages.closePreview}
        open={resolvedPreviewable && previewDialog.isOpen}
        src={displaySrc}
        onClose={previewDialog.close}
      />
    </div>
  );
}
