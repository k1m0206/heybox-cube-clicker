import vue from '@vitejs/plugin-vue';
import { miniappManifest } from '@heybox/hb-sdk/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
  },
  plugins: [vue(), miniappManifest()],
});
