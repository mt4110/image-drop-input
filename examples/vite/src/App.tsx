import { useState } from 'react';
import {
  ImageDropInput,
  type ImageUploadValue,
  type UploadContext
} from 'image-drop-input';
import 'image-drop-input/style.css';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function App() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <main
      style={{
        background: 'linear-gradient(180deg, #f4f6f8 0%, #edf0f3 100%)',
        minHeight: '100vh',
        padding: '56px 20px 72px',
        fontFamily:
          '"SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
      }}
    >
      <section
        style={{
          display: 'grid',
          gap: '24px',
          margin: '0 auto',
          maxWidth: '720px'
        }}
      >
        <header style={{ display: 'grid', gap: '10px' }}>
          <span
            style={{
              color: 'rgba(22, 32, 51, 0.54)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            Vite consumer smoke
          </span>
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              margin: 0
            }}
          >
            Fast preview, explicit uploads.
          </h1>
          <p
            style={{
              color: 'rgba(22, 32, 51, 0.66)',
              fontSize: '16px',
              lineHeight: 1.65,
              margin: 0,
              maxWidth: '36rem'
            }}
          >
            This example consumes the packaged entrypoint instead of reaching into <code>src/</code>.
          </p>
        </header>

        <ImageDropInput
          value={value}
          onChange={setValue}
          aspectRatio="4/3"
          dropzoneStyle={{ minBlockSize: '22rem' }}
          upload={async (file: Blob, context: UploadContext) => {
            context.onProgress?.(20);
            await delay(120);
            context.onProgress?.(72);
            await delay(120);

            return {
              src: URL.createObjectURL(file),
              key: 'example/vite/avatar.png'
            };
          }}
        />

        <pre
          style={{
            background: 'rgba(251, 252, 253, 0.9)',
            border: '1px solid rgba(17, 24, 39, 0.08)',
            borderRadius: '24px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
            color: 'rgba(22, 32, 51, 0.76)',
            fontSize: '13px',
            lineHeight: 1.6,
            margin: 0,
            padding: '18px 20px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      </section>
    </main>
  );
}
