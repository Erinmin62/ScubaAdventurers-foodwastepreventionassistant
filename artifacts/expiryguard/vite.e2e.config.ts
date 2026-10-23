import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  base: '/',
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: [
      { find: '@clerk/react', replacement: path.resolve(root, 'e2e/clerk-mock.tsx') },
      { find: '@', replacement: path.resolve(root, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 4179,
    strictPort: true,
  },
});
