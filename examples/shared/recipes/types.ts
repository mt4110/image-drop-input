export type Locale = 'en' | 'jp';

export type LocalizedText = {
  en: string;
  jp: string;
};

export function copy(locale: Locale, text: LocalizedText): string {
  return text[locale];
}
