/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/EvilI/', // repo name
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        methodology: resolve(__dirname, 'methodology.html'),
      },
    },
  },
  test: { environment: 'happy-dom' },
});
