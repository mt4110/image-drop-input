import { copy, type Locale, type LocalizedText } from './types';

interface RecipeCardProps {
  locale: Locale;
  title: LocalizedText;
  body: LocalizedText;
  snippet: string;
}

export function RecipeCard({ body, locale, snippet, title }: RecipeCardProps) {
  return (
    <article className="demo-recipeCard">
      <div>
        <h3>{copy(locale, title)}</h3>
        <p>{copy(locale, body)}</p>
      </div>
      <pre className="demo-code">{snippet}</pre>
    </article>
  );
}
