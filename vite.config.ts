import { defineConfig } from 'vite';

export default defineConfig(() => ({
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
  },
}));
