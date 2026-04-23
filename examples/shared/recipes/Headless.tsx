import { useState } from 'react';
import type { ImageUploadValue } from 'image-drop-input';
import { compressImage, useImageDropInput } from 'image-drop-input/headless';
import { RecipeCard } from './RecipeCard';
import { copy, type Locale } from './types';

const TEXT = {
  eyebrow: { en: 'Headless UI', jp: 'Headless UI' },
  title: { en: 'Own the markup, keep the pipeline.', jp: 'markup は自前で、pipeline はそのまま。' },
  body: {
    en: '`useImageDropInput()` exposes the state machine when the default surface is not the right fit.',
    jp: 'default surface が合わない場合は、`useImageDropInput()` で state machine だけを使えます。'
  },
  placeholder: { en: 'Drop, browse, or paste', jp: 'drop / browse / paste' },
  browse: { en: 'Browse', jp: 'Browse' },
  remove: { en: 'Remove', jp: 'Remove' },
  idleStatus: {
    en: 'Drop, browse, or paste. No upload is attached.',
    jp: 'drop / browse / paste。upload はまだ付いていません。'
  }
} as const;

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function summarizeUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith('blob:') ? 'blob:<local-object-url>' : url;
}

function summarizeValue(value: ImageUploadValue | null, locale: Locale): Record<string, unknown> {
  if (!value) {
    return {
      status: locale === 'en' ? 'idle' : '待機中'
    };
  }

  return {
    src: summarizeUrl(value.src),
    previewSrc: summarizeUrl(value.previewSrc),
    fileName: value.fileName,
    mimeType: value.mimeType,
    size: value.size,
    width: value.width,
    height: value.height,
    key: value.key
  };
}

export function HeadlessRecipeCard({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Headless UI', jp: 'Headless UI' }}
      body={{
        en: 'Bring your own markup while reusing the image input state machine.',
        jp: 'markup は自前で、image input の state machine を再利用します。'
      }}
      snippet={`const imageInput = useImageDropInput({
  accept: 'image/*',
  outputMaxBytes: 5 * 1024 * 1024
});`}
    />
  );
}

export function HeadlessRecipe({ locale }: { locale: Locale }) {
  const [value, setValue] = useState<ImageUploadValue | null>(null);
  const imageInput = useImageDropInput({
    accept: 'image/png,image/jpeg,image/webp',
    outputMaxBytes: 5 * 1024 * 1024,
    messages: {
      placeholderTitle: copy(locale, TEXT.placeholder),
      statusIdle: copy(locale, TEXT.idleStatus)
    },
    onChange: setValue,
    transform: async (file) => {
      const prepared = await compressImage(file, {
        maxWidth: 960,
        maxHeight: 960,
        outputType: 'image/webp',
        quality: 0.84
      });

      return {
        file: prepared,
        fileName: `${slugify(stripExtension(file.name)) || 'image'}-headless.webp`,
        mimeType: prepared.type || 'image/webp'
      };
    },
    value
  });

  return (
    <section className="demo-headless">
      <div className="demo-sectionHeader">
        <p className="demo-eyebrow">{copy(locale, TEXT.eyebrow)}</p>
        <h2 className="demo-sectionTitle">{copy(locale, TEXT.title)}</h2>
        <p className="demo-sectionBody">{copy(locale, TEXT.body)}</p>
      </div>

      <div className="demo-headlessGrid">
        <div>
          <input
            ref={imageInput.inputRef}
            className="demo-headlessInput"
            type="file"
            accept={imageInput.accept}
            onChange={imageInput.handleInputChange}
            hidden
          />
          <div
            className="demo-headlessSurface"
            data-dragging={imageInput.isDragging}
            role="button"
            tabIndex={0}
            aria-disabled={imageInput.disabled}
            onClick={imageInput.openFileDialog}
            onKeyDown={imageInput.handleKeyDown}
            onDragLeave={imageInput.handleDragLeave}
            onDragOver={imageInput.handleDragOver}
            onDrop={imageInput.handleDrop}
            onPaste={imageInput.handlePaste}
          >
            {imageInput.displaySrc ? (
              <img
                className="demo-headlessImage"
                src={imageInput.displaySrc}
                alt={imageInput.messages.selectedImageAlt}
                draggable={false}
              />
            ) : (
              <span className="demo-headlessPlaceholder">
                {imageInput.messages.placeholderTitle}
              </span>
            )}
          </div>
          <div className="demo-headlessControls">
            <button type="button" onClick={imageInput.openFileDialog}>
              {copy(locale, TEXT.browse)}
            </button>
            <button
              type="button"
              disabled={!imageInput.displayValue}
              onClick={imageInput.removeValue}
            >
              {copy(locale, TEXT.remove)}
            </button>
            <span>{imageInput.statusMessage}</span>
          </div>
        </div>

        <pre className="demo-json">
          {JSON.stringify(summarizeValue(imageInput.displayValue, locale), null, 2)}
        </pre>
      </div>
    </section>
  );
}
