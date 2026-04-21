import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function LocalPreviewRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Local preview', jp: 'Local preview' }}
      body={{
        en: 'No uploader. The component emits a temporary preview value.',
        jp: 'uploader なし。一時 preview value を返します。'
      }}
      snippet={`<ImageDropInput
  value={value}
  onChange={setValue}
/>`}
    />
  );
}
