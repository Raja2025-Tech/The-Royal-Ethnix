import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// base './' lets the built app run from any folder, including GitHub Pages (/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { target: 'esnext' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
