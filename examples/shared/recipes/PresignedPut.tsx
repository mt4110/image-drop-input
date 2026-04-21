import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function PresignedPutRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Presigned PUT', jp: 'Presigned PUT' }}
      body={{
        en: 'Use signed object-storage targets without bundling a provider SDK.',
        jp: 'provider SDK を bundle せずに signed target へ PUT します。'
      }}
      snippet={`const upload = createPresignedPutUploader({
  async getTarget(file, context) {
    return fetch('/api/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        fileName: context.fileName,
        mimeType: context.mimeType
      })
    }).then((response) => response.json());
  }
});`}
    />
  );
}
