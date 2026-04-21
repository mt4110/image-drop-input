import { RecipeCard } from './RecipeCard';
import type { Locale } from './types';

export function CompressionRecipe({ locale }: { locale: Locale }) {
  return (
    <RecipeCard
      locale={locale}
      title={{ en: 'Compression', jp: 'Compression' }}
      body={{
        en: 'Accept a larger source file, then enforce the byte budget after transform.',
        jp: '大きめの source file を受け取り、transform 後に byte budget を満たします。'
      }}
      snippet={`<ImageDropInput
  inputMaxBytes={20 * 1024 * 1024}
  outputMaxBytes={5 * 1024 * 1024}
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>`}
    />
  );
}
