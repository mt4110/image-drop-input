import { useEffect, useRef } from 'react';
import type { ImageDropInputClassNames } from './customization';
import { CloseGlyph } from './icons';
import { joinClassNames } from './customization';

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
  );
}

export interface PreviewDialogProps {
  alt?: string;
  ariaLabel?: string;
  classNames?: Partial<ImageDropInputClassNames>;
  closeLabel?: string;
  open: boolean;
  src?: string;
  onClose: () => void;
}

export function PreviewDialog({
  alt = 'Expanded image preview',
  ariaLabel = 'Image preview',
  classNames,
  closeLabel = 'Close preview',
  open,
  src,
  onClose
}: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const focusHandle = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusHandle);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
    };
  }, [onClose, open]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className={joinClassNames('idi-dialogOverlay', classNames?.dialogOverlay)}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={joinClassNames('idi-dialog', classNames?.dialog)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <button
          ref={closeButtonRef}
          className={joinClassNames('idi-iconButton', classNames?.iconButton, 'idi-dialogClose', classNames?.dialogClose)}
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <CloseGlyph width={18} height={18} aria-hidden="true" />
        </button>
        <img className={joinClassNames('idi-dialogImage', classNames?.dialogImage)} src={src} alt={alt} />
      </div>
    </div>
  );
}
