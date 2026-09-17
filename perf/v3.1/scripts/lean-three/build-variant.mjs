// AUDIT 2 prototype (source untouched): builds the app into a temp dir with
//   base  = the current vite.config.ts
//   lean  = + r3f's <Canvas> sees only the THREE classes it needs (three-catalogue.js), so the rest
//           of three.js tree-shakes (r3f 9 does `extend(THREE)` on the whole namespace)
//   lean2 = lean + a portal-only <Environment> (lean-environment.js) instead of drei's, which drags in
//           useEnvironment's RGBE/EXR/gain-map loaders (three-stdlib, @monogrid/gainmap-js, fflate)
//
//   node perf/v3.1/scripts/lean-three/build-variant.mjs base|lean|lean2      (from the repo root)
// Output: $OUT_DIR/out-<variant> (default <os tmp>/qh-lean-three) + a size table.
import { readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const outBase = process.env.OUT_DIR ?? join(tmpdir(), 'qh-lean-three')
const variant = process.argv[2] ?? 'lean2'
const { build } = await import(pathToFileURL(join(root, 'node_modules/vite/dist/node/index.js')).href)

const R3F_CANVAS = /@react-three[\\/]fiber[\\/]dist[\\/]react-three-fiber\.esm\.js$/
const DREI_INDEX = /@react-three[\\/]drei[\\/]index\.js$/
const SHIM = /[\\/](three-catalogue|lean-environment)\.js$/
const plugin = {
  name: 'audit-lean-three',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (!importer) return null
    if (variant === 'lean2' && source === './core/Environment.js' && DREI_INDEX.test(importer)) return join(here, 'lean-environment.js')
    // bare imports of the shims resolve like app code does
    if (SHIM.test(importer) && !source.startsWith('.')) return this.resolve(source, join(root, 'src/sections/SkyScene.tsx'), { skipSelf: true })
    if (source === 'three' && R3F_CANVAS.test(importer)) return join(here, 'three-catalogue.js')
    return null
  },
}

const outDir = join(outBase, `out-${variant}`)
await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  plugins: variant === 'base' ? [] : [plugin],
  build: { outDir, emptyOutDir: true },
})
let raw = 0
let br = 0
for (const f of readdirSync(join(outDir, 'assets')).filter((x) => x.endsWith('.js'))) {
  const b = readFileSync(join(outDir, 'assets', f))
  const c = brotliCompressSync(b).length
  raw += b.length
  br += c
  if (/^(three|r3f|SkyScene|index)-/.test(f)) console.log(variant, f.padEnd(28), 'raw', b.length, 'br', c, 'gzip', gzipSync(b).length)
}
console.log(variant, 'all JS raw', raw, 'br', br, '->', outDir)
