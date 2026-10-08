import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Long-lived vendor code in its own chunks: an app deploy then re-downloads
 * only our code, and three.js stays out of every route that never renders a
 * canvas. Only node_modules is split here; route chunks are left to Rollup.
 */
const VENDOR_CHUNKS = [
  // zustand and use-sync-external-store ride with React: the entry needs them
  // (prefs store), and left alone Rollup folds them into vendor-three because
  // @react-three/fiber shares them — which made the entry import three.js.
  [
    'vendor-react',
    /[\\/]node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/,
  ],
  ['vendor-router', /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/],
  ['vendor-motion', /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils|motion)[\\/]/],
  ['vendor-i18n', /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/],
  ['vendor-three', /[\\/]node_modules[\\/](three|@react-three)[\\/]/],
]

function manualChunks(id) {
  // Vite's dynamic-import preload helper is shared by every lazy route; pin it
  // to a chunk the entry loads anyway, or it lands in whichever vendor chunk
  // Rollup meets first.
  if (id.includes('vite/preload-helper')) return 'vendor-react'
  if (!id.includes('node_modules')) return undefined
  for (const [name, test] of VENDOR_CHUNKS) {
    if (test.test(id)) return name
  }
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The shared server/client contract (angles.js). Imported, never copied —
      // see docs/API-INVENTORY.md §2.2.
      '@contract': fileURLToPath(new URL('./server', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks },
    },
  },
  server: {
    port: 5180,
    // Fail loudly if the port is taken instead of silently sharing it with
    // another project's dev server.
    strictPort: true,
    // Listen on all interfaces so you can open the app on your phone
    // over the same Wi-Fi (http://<your-laptop-ip>:5180).
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
