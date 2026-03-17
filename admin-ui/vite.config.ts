import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cloudflare Rocket Loader breaks type="module" scripts.
// This plugin adds data-cfasync="false" to all script tags in the built HTML.
function cfAsyncFix(): Plugin {
  return {
    name: 'cf-async-fix',
    transformIndexHtml(html) {
      return html.replace(/<script /g, '<script data-cfasync="false" ')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cfAsyncFix()],
  base: '/admin/new/',
  server: {
    proxy: {
      '/admin-api': {
        target: 'https://drape-dev.it',
        changeOrigin: true,
      },
    },
  },
})
