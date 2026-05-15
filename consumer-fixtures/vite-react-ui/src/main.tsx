import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';
import {
  detectBrowserImagePipelineSupport,
  prepareImageInBrowserPipeline
} from 'image-drop-input/headless';
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

void detectBrowserImagePipelineSupport;
void prepareImageInBrowserPipeline;

if (!rootElement) {
  throw new Error('Expected #root element for the UI consumer smoke fixture.');
}

createRoot(rootElement).render(<SmokeApp />);
