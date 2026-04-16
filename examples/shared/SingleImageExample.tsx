import { useId } from 'react';
import type { CSSProperties } from 'react';
import { useImageDropInput } from 'image-drop-input/headless';
import {
  CodeDisclosure,
  acceptedTypes,
  createUploadAdapter,
  formatImageFacts,
  joinClasses
} from './example-shared';
import type { PreviewState } from './example-shared';

const singleImplementationCode = [
  "const imageInput = useImageDropInput({",
  "  accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',",
  '  maxBytes: 8 * 1024 * 1024,',
  '  upload,',
  '});',
  '',
  '<button type="button" onClick={imageInput.openFileDialog}>',
  "  {imageInput.displayValue?.fileName ?? 'Drop image or browse'}",
  '</button>',
  '',
  '<aside>',
  '  <button type="button" onClick={openPreview}>',
  "    {imageInput.displaySrc ? <img src={imageInput.displaySrc} alt='' /> : null}",
  '  </button>',
  '</aside>'
].join('\n');

type SingleImageExampleProps = {
  onOpenPreview: (preview: PreviewState) => void;
  progressStops: readonly [number, number];
  uploadKey: string;
};

export function SingleImageExample({
  onOpenPreview,
  progressStops,
  uploadKey
}: SingleImageExampleProps) {
  const inputId = useId();
  const singleImage = useImageDropInput({
    accept: acceptedTypes,
    maxBytes: 8 * 1024 * 1024,
    messages: {
      placeholderTitle: 'Drop image or browse',
      placeholderDescription: 'PNG, JPEG, or WebP up to 8 MB.',
      statusIdle: 'PNG, JPEG, or WebP, up to 8 MB.'
    },
    onError: () => undefined,
    upload: createUploadAdapter(uploadKey, progressStops)
  });

  const singleFacts = formatImageFacts(singleImage.displayValue);
  const progressStyle = {
    '--example-progress': `${Math.max(singleImage.progress, 8)}%`
  } as CSSProperties;

  const openPreview = () => {
    if (!singleImage.displaySrc) {
      return;
    }

    onOpenPreview({
      src: singleImage.displaySrc,
      alt: singleImage.messages.selectedImageAlt,
      title: singleImage.displayValue?.fileName ?? 'Selected image',
      facts: singleFacts
    });
  };

  return (
    <section className="exampleSection">
      <header className="exampleSectionHeader">
        <p className="exampleLabel">Single image</p>
        <h2 className="exampleHeading">Upload first, preview beside it.</h2>
        <p className="exampleSubcopy">
          Keep the selection surface quiet. Let preview, progress, and errors live in their own places.
        </p>
        <ul className="exampleMeta" aria-label="Single image constraints">
          <li>PNG, JPEG, WebP</li>
          <li>Paste supported</li>
          <li>8 MB max</li>
          <li>Archives rejected</li>
        </ul>
      </header>

      <div className="exampleSingleLayout">
        <div className="exampleStack">
          <label className="exampleInputLabel" htmlFor={inputId}>
            Choose image
          </label>
          <input
            id={inputId}
            ref={singleImage.inputRef}
            className="exampleInput"
            type="file"
            accept={singleImage.accept}
            onChange={singleImage.handleInputChange}
          />

          <button
            type="button"
            className={joinClasses(
              'exampleSurface',
              singleImage.isDragging && 'is-dragging',
              singleImage.error && 'is-error',
              singleImage.isUploading && 'is-uploading'
            )}
            aria-label={singleImage.displayValue ? 'Replace selected image' : 'Choose image'}
            onClick={singleImage.openFileDialog}
            onDragOver={singleImage.handleDragOver}
            onDragLeave={singleImage.handleDragLeave}
            onDrop={singleImage.handleDrop}
            onPaste={singleImage.handlePaste}
          >
            <span className="exampleSurfaceLabel">Upload</span>
            <strong className="exampleSurfaceTitle">
              {singleImage.displayValue?.fileName ?? 'Drop image or browse'}
            </strong>
            <span className="exampleSurfaceHint">
              {singleImage.displayValue
                ? 'Browse again to replace the current asset.'
                : 'PNG, JPEG, or WebP. Click, drop, or paste.'}
            </span>
          </button>

          {singleImage.isUploading ? (
            <div className="exampleProgress" style={progressStyle}>
              <div className="exampleProgressBar" aria-hidden="true">
                <span className="exampleProgressFill" />
              </div>
              <p className="exampleStatus">{singleImage.statusMessage}</p>
            </div>
          ) : null}

          {singleImage.error ? (
            <p className="exampleNotice exampleNotice--error" role="alert">
              {singleImage.statusMessage}
            </p>
          ) : null}

          <div className="exampleActions">
            <button
              type="button"
              className="exampleButton exampleButton--primary"
              onClick={singleImage.openFileDialog}
            >
              Browse files
            </button>
            {singleImage.displayValue ? (
              <button
                type="button"
                className="exampleButton exampleButton--secondary"
                onClick={singleImage.removeValue}
              >
                Clear image
              </button>
            ) : null}
          </div>
        </div>

        <aside className="examplePreviewPanel" aria-label="Selected image preview">
          <div className="examplePreviewFrame">
            {singleImage.displaySrc ? (
              <button
                type="button"
                className="exampleImageButton"
                onClick={openPreview}
                aria-label="Open image preview"
              >
                <img
                  src={singleImage.displaySrc}
                  alt={singleImage.messages.selectedImageAlt}
                  className="examplePreviewImage"
                />
              </button>
            ) : (
              <div className="examplePreviewEmpty">
                <strong>Preview appears here.</strong>
                <span>Separate surface, same value model.</span>
              </div>
            )}
          </div>

          <div className="exampleFileMeta">
            <p className="exampleFileName">{singleImage.displayValue?.fileName ?? 'No file selected'}</p>
            <p className="exampleFileHint">
              {singleFacts ?? 'The upload surface does not need to own the preview.'}
            </p>
            {singleImage.displaySrc ? <p className="exampleTapHint">Tap the image to inspect it.</p> : null}
          </div>
        </aside>
      </div>

      <CodeDisclosure code={singleImplementationCode} title="Show wiring" />
    </section>
  );
}
