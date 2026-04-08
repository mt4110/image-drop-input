import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { validateImage } from 'image-drop-input/headless';
import {
  CodeDisclosure,
  acceptedTypes,
  createGalleryItem,
  formatImageFacts,
  joinClasses,
  maxFileBytes,
  maxGalleryItems
} from './example-shared';
import type { GalleryItem, PreviewState } from './example-shared';

const galleryImplementationCode = [
  'async function appendGalleryFiles(files: File[]) {',
  '  for (const file of files) {',
  '    const metadata = await validateImage(file, {',
  "      accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',",
  '      maxBytes: 8 * 1024 * 1024,',
  '    });',
  '',
  '    setGalleryItems((current) => [',
  '      ...current,',
  '      {',
  '        id: crypto.randomUUID(),',
  '        fileName: file.name,',
  '        previewSrc: URL.createObjectURL(file),',
  '        mimeType: file.type,',
  '        width: metadata?.width,',
  '        height: metadata?.height,',
  '      },',
  '    ]);',
  '  }',
  '}',
  '',
  '<button type="button" onDrop={handleGalleryDrop}>Drop several images</button>',
  '<div>',
  '  {galleryItems.map((item) => (',
  '    <button key={item.id} type="button" onClick={() => openPreview(item)}>',
  '      <img src={item.previewSrc} alt={item.fileName} />',
  '    </button>',
  '  ))}',
  '</div>'
].join('\n');

type GalleryExampleProps = {
  onOpenPreview: (preview: PreviewState) => void;
};

export function GalleryExample({ onOpenPreview }: GalleryExampleProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryUrlMapRef = useRef(new Map<string, string>());
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);

  useEffect(() => {
    return () => {
      for (const previewSrc of galleryUrlMapRef.current.values()) {
        URL.revokeObjectURL(previewSrc);
      }

      galleryUrlMapRef.current.clear();
    };
  }, []);

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const appendGalleryFiles = async (files: File[]) => {
    const remainingSlots = maxGalleryItems - galleryItems.length;

    if (remainingSlots <= 0) {
      setGalleryError(`Up to ${maxGalleryItems} images can be previewed in this example.`);
      return;
    }

    const nextItems: GalleryItem[] = [];
    const nextErrors: string[] = [];
    let availableSlots = remainingSlots;

    for (const file of files) {
      if (availableSlots <= 0) {
        nextErrors.push(`Only the first ${remainingSlots} image${remainingSlots === 1 ? '' : 's'} were added.`);
        break;
      }

      try {
        const metadata = await validateImage(file, {
          accept: acceptedTypes,
          maxBytes: maxFileBytes
        });
        const galleryItem = createGalleryItem(file, metadata ?? undefined);

        galleryUrlMapRef.current.set(galleryItem.id, galleryItem.previewSrc);
        nextItems.push(galleryItem);
        availableSlots -= 1;
      } catch (error) {
        nextErrors.push(
          error instanceof Error ? error.message : 'Something went wrong while preparing the preview.'
        );
      }
    }

    setGalleryItems((current) => [...current, ...nextItems]);
    setGalleryError(nextErrors[0] ?? null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];

    void appendGalleryFiles(files);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsGalleryDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsGalleryDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsGalleryDragging(false);

    void appendGalleryFiles(Array.from(event.dataTransfer.files));
  };

  const removeGalleryItem = (id: string) => {
    const previewSrc = galleryUrlMapRef.current.get(id);

    if (previewSrc) {
      URL.revokeObjectURL(previewSrc);
      galleryUrlMapRef.current.delete(id);
    }

    setGalleryItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <section className="exampleSection">
      <header className="exampleSectionHeader">
        <p className="exampleLabel">Gallery</p>
        <h2 className="exampleHeading">One dropzone, many previews.</h2>
        <p className="exampleSubcopy">
          The common product pattern: one place to add files, with accepted images collected below.
        </p>
        <ul className="exampleMeta" aria-label="Gallery constraints">
          <li>PNG, JPEG, WebP</li>
          <li>Up to 6 previews</li>
          <li>Same validation rules</li>
          <li>Invalid files error explicitly</li>
        </ul>
      </header>

      <div className="exampleGalleryToolbar">
        <p className="exampleToolbarHint">Drop several images at once, or add more later.</p>
        {galleryItems.length > 0 ? (
          <button
            type="button"
            className="exampleButton exampleButton--secondary"
            onClick={openFileDialog}
          >
            Add images
          </button>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        className="exampleInput"
        type="file"
        accept={acceptedTypes}
        multiple
        onChange={handleInputChange}
      />

      <button
        type="button"
        className={joinClasses(
          'exampleSurface',
          'exampleSurface--gallery',
          isGalleryDragging && 'is-dragging',
          galleryError && 'is-error'
        )}
        aria-label="Add gallery images"
        onClick={openFileDialog}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="exampleSurfaceLabel">Gallery upload</span>
        <strong className="exampleSurfaceTitle">
          {galleryItems.length > 0
            ? `${galleryItems.length} image${galleryItems.length === 1 ? '' : 's'} selected`
            : 'Drop several images or browse'}
        </strong>
        <span className="exampleSurfaceHint">
          PNG, JPEG, or WebP. Invalid archives or unsupported files show an error.
        </span>
      </button>

      {galleryError ? (
        <p className="exampleNotice exampleNotice--error" role="alert">
          {galleryError}
        </p>
      ) : null}

      {galleryItems.length > 0 ? (
        <div className="exampleGalleryGrid">
          {galleryItems.map((item) => (
            <article className="exampleGalleryItem" key={item.id}>
              <div className="exampleGalleryThumb">
                <button
                  type="button"
                  className="exampleImageButton"
                  onClick={() =>
                    onOpenPreview({
                      src: item.previewSrc,
                      alt: item.fileName,
                      title: item.fileName,
                      facts: formatImageFacts(item)
                    })
                  }
                  aria-label={`Open preview for ${item.fileName}`}
                >
                  <img className="exampleGalleryImage" src={item.previewSrc} alt={item.fileName} />
                </button>
              </div>
              <div className="exampleFileMeta">
                <p className="exampleFileName">{item.fileName}</p>
                <p className="exampleFileHint">{formatImageFacts(item)}</p>
              </div>
              <button
                type="button"
                className="exampleButton exampleButton--secondary"
                onClick={() => removeGalleryItem(item.id)}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="exampleGalleryEmpty">
          <strong>Accepted images will collect here.</strong>
          <span>Keep the dropzone focused on input and let previews sit below.</span>
        </div>
      )}

      <CodeDisclosure code={galleryImplementationCode} title="Show wiring" />
    </section>
  );
}
