import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function AvatarRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Avatar field', jp: 'Avatar field' }}
      body={{
        en: 'A square single-image field for profiles, teams, and settings screens.',
        jp: 'profile、team、settings 画面向けの正方形 single-image field。'
      }}
      snippet={`<ImageDropInput
  value={value}
  onChange={setValue}
  accept="image/png,image/jpeg,image/webp"
  aspectRatio={1}
  outputMaxBytes={3 * 1024 * 1024}
/>`}
    />
  );
}
