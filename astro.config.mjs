import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH also support a temporary github.io/repository preview.
export default defineConfig({
  site: process.env.SITE_URL || 'https://www.serebreniklab.org',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
