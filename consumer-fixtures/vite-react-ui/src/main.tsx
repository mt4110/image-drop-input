import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';
import 'image-drop-input/style.css';

function SmokeApp() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <main>
      <ImageDropInput value={value} onChange={setValue} />
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Expected #root element for the UI consumer smoke fixture.');
}

createRoot(rootElement).render(<SmokeApp />);
