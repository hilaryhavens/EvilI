/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/EvilI/', // repo name
  build: { target: 'es2022' },
  test: { environment: 'happy-dom' },
});
