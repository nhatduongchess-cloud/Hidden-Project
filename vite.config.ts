/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces a normal static site in dist/.
// `npm run build:single` inlines everything into one HTML file (dist-single/index.html),
// which is what the private Artifact preview is published from.
export default defineConfig(({ mode }) => ({
  base: './',
  server: { proxy: { '/api': { target: process.env.FLEET_API_TARGET || 'http://127.0.0.1:8000', ws: true } } },
  preview: { proxy: { '/api': { target: process.env.FLEET_API_TARGET || 'http://127.0.0.1:8000', ws: true } } },
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
}));
