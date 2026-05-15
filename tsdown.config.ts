import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  deps: {
    neverBundle: [
      'react',
      'react-dom'
    ]
  },
  dts: true,
  entry: [
    'src/index.ts',
    'src/headless.ts',
    'src/browser-image-pipeline-worker.ts'
  ],
  format: [
    'esm',
    'cjs'
  ],
  outDir: 'dist',
  platform: 'neutral',
  sourcemap: false,
  target: 'es2020'
});
