import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function WebPRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'WebP transform', jp: 'WebP transform' }}
      body={{
        en: 'Compress and convert before the file reaches upload.',
        jp: 'upload に渡る前に圧縮と変換を行います。'
      }}
      snippet={`transform={async (file) => ({
  file: await compressImage(file, {
    maxWidth: 1600,
    maxHeight: 900,
    outputType: 'image/webp',
    quality: 0.86
  }),
  fileName: file.name.replace(/\\.[^.]+$/, '.webp'),
  mimeType: 'image/webp'
})}`}
    />
  );
}
