import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vendor code-splitting.
 *
 * Vite 8 bundles with Rolldown, where Rollup's object-form `manualChunks` is not
 * supported — `output.codeSplitting.groups` is the equivalent. The heavy WebGL
 * vendors are split out of the app chunk so they cache independently of page code:
 *   - `react`: react + react-dom + scheduler (the only vendor on the critical path)
 *   - `three`: three.js core
 *   - `r3f`:   @react-three/fiber + @react-three/drei and their helper libraries
 * Priorities matter: a group also captures the dependencies of the modules it
 * matches, so without an explicit `react` group the `r3f` group swallows the shared
 * React runtime, the entry chunk then statically imports `r3f-*.js`, and Vite emits
 * `<link rel="modulepreload">` for three + r3f (~975 kB) ahead of first paint —
 * defeating `lazy(() => import('./sections/SkyScene'))`. `react` therefore wins
 * over `three`, which wins over `r3f`. `[\\/]` matches POSIX and Windows separators.
 */
const REACT_RUNTIME = /node_modules[\\/](react|react-dom|scheduler)[\\/]/
const THREE_CORE = /node_modules[\\/]three[\\/]/
const R3F_AND_HELPERS =
  /node_modules[\\/](@react-three[\\/](fiber|drei)|three-stdlib|three-mesh-bvh|its-fine|suspend-react|maath|zustand|@use-gesture|@monogrid|camera-controls|detect-gpu|stats-gl|stats\.js|troika-|hls\.js|meshline|glsl-noise|tunnel-rat|utility-types|@mediapipe)[\\/]/

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Pages Functions run under `pnpm dev:api` (wrangler pages dev dist --port 8788).
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    cssMinify: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: REACT_RUNTIME, priority: 3 },
            { name: 'three', test: THREE_CORE, priority: 2 },
            { name: 'r3f', test: R3F_AND_HELPERS, priority: 1 },
          ],
        },
      },
    },
  },
})
