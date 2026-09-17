// AUDIT 2: cost of src/assistant/Markdown.tsx per render (the answer reveal re-renders it every frame).
//   node perf/v3.1/scripts/audit-md-bench.mjs
import { dirname as __dn, resolve as __rs } from 'node:path'
import { fileURLToPath as __fu } from 'node:url'
const __root = __rs(__dn(__fu(import.meta.url)), '../../..').split(String.fromCharCode(92)).join('/')
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
const root = __root
const sp = (await import('node:os')).tmpdir().split(String.fromCharCode(92)).join('/')
const require = createRequire(root + '/package.json')
const ts = require('typescript')
const url = (p) => pathToFileURL(p).href
const src = readFileSync(root + '/src/assistant/Markdown.tsx', 'utf8')
let js = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
js = js
  .replace(`from '../i18n/locale'`, `from '${url(root + '/src/i18n/locale.ts')}'`)
  .replace(`from "react/jsx-runtime"`, `from '${url(require.resolve('react/jsx-runtime'))}'`)
  .replace(`from 'react'`, `from '${url(require.resolve('react'))}'`)
writeFileSync(sp + '/Markdown.bench.mjs', js)
const md = await import(url(sp + '/Markdown.bench.mjs'))
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')
const para =
  'QairuHub runs **free** events in Astana: hackathons, workshops and *Demo Day*. See /handbook#join or t.me/qairuhub for details, and https://community.qairuhub.com for the platform. '
const text = [para, para, '- Join the community on the platform\n- Pick a project\n- Ship it with a team', para, '1. Sign up\n2. Say hi\n3. Build', para, para, para]
  .join('\n\n')
  .slice(0, 2600)
const ctx = { locale: 'en', newTabLabel: '(opens in a new tab)' }
for (let i = 0; i < 200; i++) renderToStaticMarkup(React.createElement(md.default, { text, ...ctx }))
const out = {}
for (const len of [300, 800, 1400, 2000, 2600]) {
  const t = text.slice(0, len)
  const N = 400
  let a = performance.now()
  for (let i = 0; i < N; i++) md.default({ text: t, ...ctx })
  const elementsMs = (performance.now() - a) / N
  a = performance.now()
  for (let i = 0; i < N; i++) renderToStaticMarkup(React.createElement(md.default, { text: t, ...ctx }))
  const ssrMs = (performance.now() - a) / N
  out[len] = { parseAndElementsMs: +elementsMs.toFixed(3), renderToStringMs: +ssrMs.toFixed(3) }
}
// reveal: a 2600-char answer revealed over ~200 frames (60 Hz, ~3.3 s) => 200 renders of a growing prefix
const frames = 200
const a = performance.now()
for (let f = 1; f <= frames; f++) md.default({ text: text.slice(0, Math.round((f / frames) * text.length)), ...ctx })
const revealMs = performance.now() - a
console.log(JSON.stringify({ desktopNode: out, reveal200FramesParseMs: +revealMs.toFixed(1) }, null, 1))
