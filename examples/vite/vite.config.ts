import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^image-drop-input\/headless$/,
        replacement: path.join(packageRoot, 'dist/headless.js')
      },
      {
        find: /^image-drop-input\/style\.css$/,
        replacement: path.join(packageRoot, 'dist/style.css')
      },
      {
        find: /^image-drop-input$/,
        replacement: path.join(packageRoot, 'dist/index.js')
      }
    ],
    preserveSymlinks: true
  },
  server: {
    fs: {
      allow: [packageRoot]
    }
  }
});
