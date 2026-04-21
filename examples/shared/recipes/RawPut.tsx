import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function RawPutRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Raw PUT', jp: 'Raw PUT' }}
      body={{
        en: 'Upload to a direct endpoint and keep the returned object key explicit.',
        jp: 'direct endpoint に upload し、object key を明示的に扱います。'
      }}
      snippet={`const upload = createRawPutUploader({
  endpoint: '/api/avatar',
  objectKey: 'avatars/current-user.webp'
});`}
    />
  );
}
