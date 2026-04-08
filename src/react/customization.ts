import type { ReactNode } from 'react';
import type { ImageUploadValue } from '../core/types';

export interface ImageDropInputMessages {
  chooseFile: string;
  dropzoneLabelEmpty: string;
  dropzoneLabelFilled: string;
  placeholderTitle: string;
  placeholderDescription?: string;
  statusIdle: string;
  statusUploading: (percent: number) => string;
  openPreview: string;
  replaceImage: string;
  removeImage: string;
  cancelUpload: string;
  retryUpload: string;
  previewDialog: string;
  closePreview: string;
  selectedImageAlt: string;
  previewImageAlt: string;
}

export interface ImageDropInputClassNames {
  root?: string;
  input?: string;
  dropzone?: string;
  preview?: string;
  image?: string;
  overlay?: string;
  placeholder?: string;
  placeholderIcon?: string;
  placeholderTitle?: string;
  placeholderDescription?: string;
  actions?: string;
  iconButton?: string;
  previewButton?: string;
  replaceButton?: string;
  cancelButton?: string;
  removeButton?: string;
  footer?: string;
  status?: string;
  errorSurface?: string;
  footerButton?: string;
  progress?: string;
  progressBar?: string;
  spinner?: string;
  dialogOverlay?: string;
  dialog?: string;
  dialogClose?: string;
  dialogImage?: string;
}

export interface ImageDropInputRenderState {
  disabled: boolean;
  displayValue: ImageUploadValue | null;
  displaySrc?: string;
  error: Error | null;
  isDragging: boolean;
  isUploading: boolean;
  messages: ImageDropInputMessages;
  progress: number;
}

export interface ImageDropInputPlaceholderRenderProps extends ImageDropInputRenderState {
  openFileDialog: () => void;
}

export interface ImageDropInputActionsRenderProps extends ImageDropInputRenderState {
  cancelUpload: () => void;
  openFileDialog: () => void;
  openPreview: () => void;
  previewable: boolean;
  removable: boolean;
  removeValue: () => void;
  /**
   * @deprecated Use `previewable` instead. This alias is kept for backwards compatibility.
   */
  zoomable: boolean;
}

export interface ImageDropInputFooterRenderProps extends ImageDropInputRenderState {
  canRetryUpload: boolean;
  retryUpload: () => void;
  statusMessage: string;
}

export interface ImageDropInputRenderers {
  renderActions?: (props: ImageDropInputActionsRenderProps) => ReactNode;
  renderFooter?: (props: ImageDropInputFooterRenderProps) => ReactNode;
  renderPlaceholder?: (props: ImageDropInputPlaceholderRenderProps) => ReactNode;
}

export function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export const defaultImageDropInputMessages: ImageDropInputMessages = {
  cancelUpload: 'Cancel upload',
  chooseFile: 'Choose image file',
  closePreview: 'Close preview',
  dropzoneLabelEmpty: 'Image upload area',
  dropzoneLabelFilled: 'Selected image',
  openPreview: 'Open preview',
  placeholderDescription: 'Paste supported',
  placeholderTitle: 'Drop image or browse',
  previewDialog: 'Image preview',
  previewImageAlt: 'Expanded image preview',
  replaceImage: 'Replace image',
  retryUpload: 'Retry',
  removeImage: 'Remove image',
  selectedImageAlt: 'Selected image preview',
  statusIdle: 'Drop, browse, or paste.',
  statusUploading: (percent) => (percent > 0 ? `Uploading... ${percent}%` : 'Uploading...')
};

export function resolveImageDropInputMessages(
  messages?: Partial<ImageDropInputMessages>
): ImageDropInputMessages {
  return {
    ...defaultImageDropInputMessages,
    ...messages,
    statusUploading: messages?.statusUploading ?? defaultImageDropInputMessages.statusUploading
  };
}
