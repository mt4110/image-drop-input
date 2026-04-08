import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [pluginReact()],
  resolve: {
    alias: {
      'image-drop-input': path.join(packageRoot, 'dist/index.js'),
      'image-drop-input/headless': path.join(packageRoot, 'dist/headless.js'),
      'image-drop-input/style.css': path.join(packageRoot, 'dist/style.css')
    }
  },
  html: {
    title: 'image-drop-input / Rsbuild'
  }
});
