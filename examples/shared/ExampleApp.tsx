import { useEffect, useState } from 'react';
import 'image-drop-input/style.css';
import './example-app.css';
import { GalleryExample } from './GalleryExample';
import { SingleImageExample } from './SingleImageExample';
import type { PreviewState } from './example-shared';

type ExampleAppProps = {
  consumerName: string;
  uploadKey: string;
  progressStops: readonly [number, number];
};

function PreviewLightbox({
  preview,
  onClose
}: {
  preview: PreviewState;
  onClose: () => void;
}) {
  return (
    <div
      className="exampleLightbox"
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
      onClick={onClose}
    >
      <div className="exampleLightboxChrome" onClick={(event) => event.stopPropagation()}>
        <div className="exampleLightboxHeader">
          <div className="exampleLightboxMeta">
            <p className="exampleLightboxTitle">{preview.title}</p>
            <p className="exampleLightboxFacts">{preview.facts ?? 'Image preview'}</p>
          </div>
          <button
            type="button"
            className="exampleButton exampleButton--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="exampleLightboxStage">
          <img className="exampleLightboxImage" src={preview.src} alt={preview.alt} />
        </div>
      </div>
    </div>
  );
}

export function ExampleApp({ consumerName, progressStops, uploadKey }: ExampleAppProps) {
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!previewState) {
      return;
    }

    const { overflow } = document.body.style;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewState]);

  return (
    <main className="examplePage">
      <section className="exampleShell">
        <header className="exampleIntro">
          <p className="exampleEyebrow">{consumerName}</p>
          <h1 className="exampleTitle">Image upload</h1>
          <p className="exampleDescription">
            A single-image flow and a gallery dropzone, shaped like product UI instead of a showcase page.
          </p>
        </header>

        <SingleImageExample
          progressStops={progressStops}
          uploadKey={uploadKey}
          onOpenPreview={setPreviewState}
        />
        <GalleryExample onOpenPreview={setPreviewState} />
      </section>

      {previewState ? (
        <PreviewLightbox preview={previewState} onClose={() => setPreviewState(null)} />
      ) : null}
    </main>
  );
}
