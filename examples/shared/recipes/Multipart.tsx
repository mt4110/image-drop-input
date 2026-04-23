import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function MultipartRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Multipart POST', jp: 'Multipart POST' }}
      body={{
        en: 'Send FormData to an application server and map the response.',
        jp: 'FormData を app server に送り、response を mapping します。'
      }}
      snippet={`const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file',
  mapResponse(body) {
    const result = body as { imageUrl: string; imageKey: string };
    return { src: result.imageUrl, key: result.imageKey };
  }
});`}
    />
  );
}
