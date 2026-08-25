// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://cajorapos.com',
  base: '/',
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://192.168.0.10:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
