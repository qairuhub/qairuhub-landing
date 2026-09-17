# AUDIT 2: API, data, dependencies, re-renders, input handlers (v3.1)

HEAD `f1e323a`. I didn't change any source files. Everything below was measured on the committed build: `dist/` matches a fresh build of HEAD byte for byte (`three-0YaG8gSa.js`, `r3f-sDVfOiCS.js`, `index-DJ_SRp8d.js`). Production was probed with GET/HEAD only, through `curl --resolve qairuhub.com:443:188.114.97.1`, which reached the NQZ (Astana) colo. `/api/ask` was never called against production.

## 0. Summary

| # | Finding | Evidence | Change |
|---|---|---|---|
| 1 | **If one lazy chunk fails to load, the whole page goes blank.** None of the lazy islands has an error boundary. If `three`, `r3f` or `SkyScene` fails on a flaky mobile connection (the KZ ISP drops TLS intermittently), or a deploy removes `Assistant-*.js` while a tab is open, React unmounts the root. | `scripts/audit-chunk-failure.mjs`: all three blocked-chunk cases end with `#root` holding 0 children and 0 characters of text. The control case is fine. | **A2-01 (P0)** |
| 2 | **The r3f `<Canvas>` calls `extend(THREE)`**, which keeps the whole three.js namespace in the bundle. The app and r3f use about 80 classes. | Prototype build (`lean-three/`): `three` shrinks from 738,232 to 572,427 B raw (−22%), and from 150.2 to 116.1 KB at brotli 11. Screenshots are pixel-identical (md5) at low, medium and high tiers, hero and footer. No page errors. The largest GPU upload stays at 512,000 B. | **A2-02 (P1)** |
| 3 | **drei `<Environment>` pulls in `useEnvironment`'s HDR loaders**: three-stdlib EXR/RGBE, `@monogrid/gainmap-js`, `fflate` and GroundProjectedEnv. That is about 44 KB of dead code in `r3f`, which every page loads. | Prototype with a portal-only environment: `r3f` shrinks from 225,142 to 172,874 B (63.2 → 47.5 KB br). Screenshots are identical. | **A2-03 (P1)** |
| 4 | **The assistant panel re-renders every `Answer`, including a full Markdown re-parse, on every 40 ms stream flush and every keystroke.** `Answer` isn't memoized, and `onInternalLink={() => close(false)}` is a new function on every render. | `scripts/audit-md-bench.mjs`: about 0.2 ms per answer per render on this desktop, so roughly 1 ms per answer on a phone. A 6-answer thread costs about 6 ms at 25 Hz while streaming, plus the same on every keystroke (hurts INP). | **A2-04 (P1)** |
| 5 | `/api/ask` in AI mode makes **2 sequential D1 round trips** (per-IP batch, then the global cap) before any SSE bytes go out. D1 is in EEUR. | `scripts/d1-rows.mjs` / `d1-worker`: one batch of 3 with a guarded global upsert behaves the same, including not counting when the IP is rate-limited. | A2-05 (P2) |
| 6 | `/api/config` sends `public, max-age=300`, but the client fetches it with `cache: 'no-store'`, so the header has no effect. In production the edge doesn't cache it either (`cf-cache-status: DYNAMIC`, about 50 ms). | `scripts/audit-api-probe-prod.json` | A2-06 (P2) |
| 7 | SSE framing: each PII-filter release becomes its own `delta` event, and Cloudflare doesn't compress `text/event-stream`. | `scripts/audit-sse-framing.mjs`: a 2.4 KB answer takes 379 events and 13.4 KB. Coalescing to about 50 ms gives 120 events and 5.9 KB. | A2-07 (P2) |
| 8 | Rows written to the D1 `counters` table: 2–3 per upsert, because of the rowid table plus the `counters_expires` index. | d1-worker: an AI ask writes 6–9 rows today, 3 with `WITHOUT ROWID` and no expires index. This is cost headroom only; users won't notice. | A2-08 (P2, optional) |
| 9 | Resize handling calls `Lenis.resize()` twice per resize event (window `resize` plus the body ResizeObserver). On phones the URL bar fires `resize` while scrolling. | Code read (`src/lib/SmoothScroll.tsx`) | A2-09 (P2) |
| 10 | `AgenticCards` re-renders the Ask bar and all 3 card visuals on every typewriter step (about every 3.8 s) and every card hover. | Code read | A2-10 (P2) |

If A2-02 and A2-03 are both applied, the measured total JS is **1,508,743 → 1,291,366 B raw (−217 KB, −14.4%)** and **367.2 → 317.6 KB br (−49.6 KB)**. The savings fall on the 3D path that every page loads.
- **In production**, the edge compresses on the fly at a lower brotli level: `three` is 184.7 KB on the wire against 150.2 KB at br 11. So the real saving should be about 42 KB for `three` and about 18 KB for `r3f` (estimated).
- Pages can't serve pre-compressed files, so shipping less input is the only way to cut these bytes.

The **backend is otherwise in good shape**:
- Every D1 statement uses an index.
- There is no N+1 and no per-request sweep: the purge runs on 1% of requests and uses an index.
- Retrieval costs 0.01–0.13 ms per request.
- The OpenAI path has a 12 s first-byte timeout and a 30 s total timeout, and aborts on client disconnect or leak.
- Hashed assets and fonts are immutable, and HTML revalidates.

A general answer cache for `/api/ask` is **rejected** (§1.6).

## 1. Backend (`functions/**`, `edge/**`)

### 1.1 Endpoints: what each request costs

| Route | Work per request | D1 | Cache-Control (local = prod) | Wire size |
|---|---|---|---|---|
| `GET /api/config` | middleware: origin check + salted IP SHA-256; returns 1 env var | none | `public, max-age=300` (prod: `cf-cache-status: DYNAMIC`, not edge-cached) | 25 B, not compressed (below the 50 B brotli minimum). TTFB 50–55 ms from NQZ |
| `GET /api/join` | IP hash + 1 HMAC (form token) | none | `no-store` (correct: every token is signed at issue) | 75 B br |
| `POST /api/join` | body cap/parse, then honeypot → 1 counter upsert → Turnstile (only if the secret is set) → HMAC check → validation → `INSERT OR IGNORE` → purge on 1% of requests → Telegram ping via `waitUntil` | 1 batch + 1 insert | `no-store` | 11–67 B |
| `POST /api/ask` | validation → session/Turnstile (only if the secret is set) → **batch 1**: 2 per-IP upserts → BM25F search + context (0.01–0.07 ms) → **batch 2**: global AI counter (AI mode only) → SSE stream via `waitUntil` | 2 batches (AI) / 1 (offline) | `no-store`, `text/event-stream`, not compressed | offline answer 1.1–1.4 KB. AI answer ≈ 5.6× the answer text in SSE framing |
| edge `POST /openai/responses` | buffers the body (≤ 64 KB), reads the key from Secrets Store, streams upstream through unchanged with `signal: request.signal` | none | `no-store` | pass-through |

Local numbers come from `wrangler pages dev dist --port 8802 --binding ASK_ENABLED=false`, with the EDGE binding not connected and no key, so nothing could reach OpenAI.
- Offline `/api/ask`: 45 ms cold, 7–8 ms warm.
- `/api/config`: 3–12 ms.

The Handbook index is a 112 KB JSON bundled into the Function. Parsing it takes about 2.8 ms per isolate in Node.

### 1.2 Cache headers (`public/_headers` + Pages defaults, checked locally and in production)

| Path | Header | Prod edge | Verdict |
|---|---|---|---|
| `/assets/*` (hashed) | `public, max-age=31536000, immutable` | MISS → HIT (zone cache), weak ETag | correct |
| `/fonts/*` | same | HIT (`age: 7348` on Courgette) | correct for speed. **Caveat:** the font file names aren't content-hashed, so if a font file ever changes it needs a new name, or returning visitors keep the old file for a year |
| HTML (`/`, `/kk/`, `/members`, `/handbook`) | `public, max-age=0, must-revalidate` | DYNAMIC, **no ETag/Last-Modified in production** (local has a strong ETag and returns 304) | fine. Each navigation re-downloads the 0.6–1.1 KB br shell, which is cheaper than a 304 round trip would save. Needs no change |
| `/handbook-index.json` | `public, max-age=300, must-revalidate` | DYNAMIC, weak ETag, 304 works (47 ms) | fine. Only used by the browser's offline fallback |
| `/sitemap.xml` | Pages default `max-age=0, must-revalidate` | DYNAMIC | fine: only crawlers read it |
| `/robots.txt`, `/favicon.svg` | Pages default `max-age=0` locally | **`max-age=14400` in production** (the zone's Browser Cache TTL overrides it) | fine, but note the difference between local and production |
| 404 / missing asset | `no-store` HTML 404 | BYPASS | correct. Note that a **removed chunk URL returns HTML with status 404**, which feeds finding 1 |
| `/api/config` | `public, max-age=300` | DYNAMIC | the header has no effect in the browser because the client uses `cache: 'no-store'`. Edge caching doesn't help either: a Pages Function runs anyway, and its handler does trivial work (A2-06) |

**Compression.** Cloudflare compresses JS, CSS, JSON, HTML, XML, SVG and TTF, but only above 48–50 B. `woff2` is correctly passed through with `content-length`. Clients that only accept gzip get gzip (index.js is 41.9 KB gzip vs 42.9 KB br at the edge).

`text/event-stream` is not on Cloudflare's list of compressible content types (developers.cloudflare.com/speed/optimization/content/compression), so SSE goes out uncompressed. **Don't add a Compression Rule for SSE**, because compressing a stream risks buffering it. Cut the framing instead (A2-07).

### 1.3 D1 queries vs `migrations/0001_init.sql`

| Statement | Where | Index used | rows read / written (local D1 meta) |
|---|---|---|---|
| counter UPSERT … `RETURNING` | `ratelimit.hit` (`ask`, `join`) | `counters` PK (`sqlite_autoindex`) | insert 1/3 · increment 2/2 · reset 2/2. With `WITHOUT ROWID`: 1/2. Without the expires index as well: **1/1** |
| `SELECT n … WHERE key=? AND expires_at>?` | `peek` (unused) | PK | not called anywhere |
| `DELETE FROM counters WHERE expires_at <= ?` | `maybePurge` (1% of requests, `waitUntil`) | `counters_expires` | 1001 read / 1000 written per 1000 expired rows. Without the index it is a full scan (2008 read for 2000 rows), which is fine because the table only holds keys created since the last purge |
| `DELETE FROM submissions WHERE expires_at <= ?` | `maybePurge` | `submissions_expires` | 1/0 when nothing has expired |
| `INSERT OR IGNORE INTO submissions` | `/api/join` | PK + `submissions_waitlist_email` (partial unique) | join 0/4, waitlist 0/5, duplicate waitlist 0/0 |

- **N+1:** none. The counters are written in one `db.batch` (an implicit transaction).
- **Sweeps on every request:** none. The purge runs on 1% of requests and uses an index.
- **Missing indexes:** none.
- **Unused index:** `submissions_kind_created`. No query reads it; it is kept for manual exports. Cost: 1 extra write per submission, which is fine.
- **Counter writes per request:**
  - `/api/ask` AI mode: 3 upserts in 2 round trips (6–9 rows).
  - `/api/ask` offline: 2 upserts in 1 round trip.
  - `POST /api/join`: 1 upsert plus the insert.
  - GET routes: 0.

  The worst case is about 1,500 AI asks a day × 9 = 13.5k writes a day, well below D1's included limits. So A2-08 buys cost headroom, not speed.
- **Latency:** the second batch in AI mode (`functions/api/ask.ts:117-120`) is a separate round trip to the EEUR primary. The response headers are only sent after it returns (A2-05). I didn't measure D1 RTT from the edge, because doing so needs a production POST.

### 1.4 OpenAI call path

- **Timeouts:** 12 s to the first upstream event (the timer is cleared on the first parsed event) and 30 s in total, both on one `AbortController` (`ask.ts:171-177`). On timeout, fetch failure or a non-OK status, it falls back to the offline answer if nothing has been forwarded yet. The one-time parameter retry (`withoutRejectedParams`) re-POSTs only on a 400 that names an optional parameter.
- **Abort on client disconnect:** `sse.send` returns `false` once the write side errors. The loop then sets `outcome='aborted'` and calls `controller.abort()`, which cancels the service-binding fetch, which cancels upstream (edge: `signal: request.signal` + `new Response(upstream.body)`).
  - Gap: a disconnect is only noticed on the next write. While the model is reasoning before its first token, the request runs until the first delta or the 12 s timer.
  - That is acceptable. If the runtime exposes `request.signal` for client disconnect (check before relying on it), `AbortSignal.any([controller.signal, request.signal])` would close the gap. I haven't listed this as a change because it's unverified.
- **Streaming:** the Responses API runs with `stream: true, store: false`. Each output delta passes through `LeakGuard` and `PiiFilter`, which holds back 32 characters and releases at whitespace. Then it goes out as one SSE `delta`. Result: about 1 event per upstream token (A2-07). There's backpressure (a `TransformStream` writer is awaited), and the stream work runs in `waitUntil`.
- **CPU per request** (`audit-search-bench.mjs`): BM25F plus context selection takes 0.01–0.07 ms; the offline answer takes 0.05–0.13 ms. Neither is worth caching.
- **Safety identifier:** the full 32-hex salted IP hash is sent to OpenAI as `safety_identifier`, never logged in full. This isn't a performance issue.

### 1.5 Should `/api/config` be cached?

Yes, but in the browser, not at the edge (A2-06):
- At the edge, a Pages Function runs on every request whether or not its response is cached, and the handler itself is trivial.
- In the browser, dropping `cache: 'no-store'` lets `max-age=300` work. Add `stale-while-revalidate=600`.

**Rollout order for Turnstile:** set `TURNSTILE_SITE_KEY` first, wait at least 15 minutes (max-age + SWR), then set `TURNSTILE_SECRET_KEY`. Otherwise a browser holding a cached `null` key sends no token and gets `verify_required` for up to 15 minutes. The same problem already exists today for any tab that was open when the key changed.

### 1.6 Caching `/api/ask` answers: **rejected** (general cache); a narrow cache stays optional and should be measured first

Reasons to reject an exact-match cache keyed on the question:
1. **Input PII can't be detected reliably.** `functions/_lib/piiFilter.ts` only redacts model *output*, and only emails and phone-like digit runs. Names, addresses, IIN-like numbers written with spaces, and personal situations in a question can't be classified with certainty. A cache keyed on user text therefore stores user text, or a hash that can be matched against it, next to an answer.
2. **It breaks a stated guarantee.** `ask.ts` says "Questions and answers are never stored or logged". A cache stores answers, so the owner would have to change the spec.
3. **The hit rate on free text is close to zero.** Typed questions rarely match exactly. Real history varies (`history` ≤ 6 turns), so only first-turn questions could be cached at all.
4. **Stale answers.** The developer message contains today's date (Astana) and the index version. Answers can mention dates.
5. **`caches.default` is per colo.** Hits would be split across colos, and a hallucinated answer would be served to everyone until the TTL expires.

**The only acceptable variant**, and only if the numbers justify it: an allowlist cache for the **panel suggestion chips**. These are fixed strings from `panel.i18n.ts`, so no user text ever becomes a key.
- Key: `sha256(locale | chip | INDEX.version | model | astanaDate)`.
- Only when `history` is empty.
- TTL 10–30 min, in `caches.default`.
- Still counted against the per-IP limits, but not the global AI cap.
- Replayed as one `delta` with `mode: 'ai'`. The client reveal already smooths a single delta.

Measure first. Add a non-PII `chip: true` flag:
- Client: the chip `onClick` in `Assistant.tsx` passes `suggestion: true`, and `sseClient` forwards it.
- Server: `ask.ts` logs `chip: body.suggestion === true`. No text is logged.

Build the cache only if chips make up more than about 20% of AI requests over a week. Gain on a hit: time to first token drops from about 1.5–3 s to under 100 ms, and there is no OpenAI cost.

## 2. Dependencies

`package.json` → the imports that actually exist (`grep` over `src`, `shared`, `functions`, `edge`, `scripts`):

| Package | Used by | Verdict |
|---|---|---|
| `react`, `react-dom` | app (45 files) | used |
| `three` | 16 files + `three/examples/jsm/loaders/FontLoader.js` (`Font` only, 1.7 KB) | used. **The whole namespace is kept** (see below) |
| `@react-three/fiber` | 8 files | used |
| `@react-three/drei` | `MeshTransmissionMaterial` (GlassText), `Environment` + `Lightformer` (SceneLights) | used. Tree-shaking works (`sideEffects: false`, 5 drei modules end up in the bundle), but `Environment` drags in dead loaders |
| `lenis` | `SmoothScroll.tsx` (18.6 KB raw in the entry chunk) | used |
| `clsx` | 24 files (~0.3 KB) | used, and too small to be worth replacing |
| devDeps `@cloudflare/workers-types` | `functions/tsconfig.json`, `edge/` | used |
| `@tailwindcss/vite`, `tailwindcss` | `vite.config.ts`, `global.css` `@import "tailwindcss"` | used |
| `@types/*`, `typescript`, `vite`, `@vitejs/plugin-react` | build / type checking | used |
| `playwright` | `scripts/shots.mjs`, `scripts/perf.mjs`, `scripts/reference-shots.mjs` | used |
| `wrangler` | `dev:api`, `deploy`, `eval:ask` | used |

**No declared dependency is unused.** The stray files `scripts/tmp-*.ts|mjs` are git-ignored and never shipped.

Dead code *inside* dependencies. Module sizes are bytes in the r3f chunk, from `bundle-modules.json`:
- `@react-three/fiber` `Canvas` → `React.useMemo(() => extend(THREE), [])` (`react-three-fiber.esm.js:40`). Handing the whole namespace to `extend` defeats tree-shaking of `three`.
  - A standalone Vite build of `import * as THREE` versus named imports of the ~80 classes the app, r3f and the used drei modules reference: 736.6 KB vs 572.1 KB raw (149.9 vs 115.9 KB br).
  - The full-app prototype confirms it: 738.2 → 572.4 KB (A2-02).
- `@react-three/drei` `core/Environment.js` → `useEnvironment.js` → `three-stdlib` EXRLoader (18.0 KB) + RGBELoader (3.3 KB) + GroundProjectedEnv (0.8 KB), `@monogrid/gainmap-js` (15.4 KB), `fflate` (3.7 KB), `environment-assets` (0.3 KB). The scene only uses `<Environment resolution={64} frames={1}>` with 3 Lightformers, so none of this runs (A2-03).
- Unavoidable: `react-use-measure` (3.1 KB, Canvas sizing), the `use-sync-external-store` shim (1.5 KB, zustand/traditional), `its-fine`, `suspend-react`.

## 3. Re-renders and input handlers

Checked `src/sections/**`, `src/assistant/**`, `src/components/ui/**`, `src/lib/**` and `src/pages/**`.

| Place | Trigger | What happens | Verdict |
|---|---|---|---|
| `Header` `useTick` (home) | every frame | math only; `setShowLogo` only when the value changes | OK |
| `SmoothScroll` | Lenis scroll | writes to the `scrollState` store, no React state; `setLenis` once | OK. The context value changes only once |
| `SmoothScroll` resize | window `resize` **and** body ResizeObserver | `instance.resize()` + `setScroll` twice per event (forced layout) | **A2-09** |
| `SkyScene` / sky layers | `useFrame`, `mousemove` | refs and plain objects only; `useCanvasProfile` only on media-query thresholds | OK |
| `Storytelling`, `Supersize` | shared ticker, gated by IntersectionObserver; `resize` → dirty flag | no React state | OK |
| `AssistantLauncher` | scroll/resize, only while the footer is in view, rAF-throttled | CSS variable write | OK |
| `Carousel` | track scroll, rAF-throttled | `setIndex`/`setEdges` only on change | OK |
| `HandbookPage` scroll spy | Lenis scroll → binary search | `setActive` only on change; measures only on resize or font load | OK |
| `Header` mega menu | `pointermove` only while a menu is open | ref write | OK |
| `ProductDemo` | tab timer, ResizeObserver | `setActive` once per tab period; indicator via CSS variables | OK |
| **`store.ts` flush (40 ms) → `useAssistant()`** | streaming | `AskBar` and `Assistant` re-render. `Assistant` re-renders **every** `Answer` (not memoized, inline `onInternalLink`), and each one re-parses its Markdown | **A2-04** |
| **`Answer.useReveal`** | shared ticker, 60 Hz while revealing | `setShown` every frame re-renders the whole Markdown tree of the live answer | A2-04 (b) |
| **`Assistant` textarea** | every keystroke | `setValue` re-renders all `Answer`s (same cause) + `resize()` reads `scrollHeight` | **A2-04** |
| `AgenticCards` | typewriter index (~3.8 s), card hover/focus | re-renders `AskBar` and 3 `CardVisual`s | A2-10 |
| `Typewriter` | 400–2200 ms timers | local state | OK |
| Context churn | `RouteProvider` (constant), `LenisContext` (null → instance once) | none | OK |

**Debouncing input handlers: not needed here.**
- **Ask bar and panel inputs** are controlled and do no network or search work per keystroke. Retrieval only runs on submit, on the server (0.01–0.13 ms), and in the browser only for the offline fallback. Debouncing a controlled input would make typing lag.
- **"Handbook search"** has no input on `/handbook`: the page only has a table of contents plus a scroll spy.
- **`DemoForm` and `Waitlist`** validate 5 regexes per keystroke (microseconds) and only fetch the form token on first interaction.
- **Resize handlers** are already flag- or rAF-based, except `SmoothScroll` (A2-09).

## 4. Lists: is pagination needed? No

| List | Size | Rendered |
|---|---|---|
| `src/data/members.ts` | board ≈ 7 + builders ≈ 9 (+ ask rows) | `/members`, static |
| `src/data/news.ts` | 6 items (7 KB source) | home carousel |
| `src/data/projects.ts` | 9 items | home |
| Handbook | 50 chunks / 64 TOC ids, one HTML string (78 KB source, 22 KB gzip chunk) | `/handbook`, one article |
| Assistant thread | capped at 40 in memory, 12 stored (`store.ts`) | panel |

All lists are small, fixed at build time and bundled; none has more than a few dozen rows. Pagination would add requests and layout shift without any gain. The only list that can grow at runtime is the chat thread, and it is already capped.

## 5. Changes

Each change lists priority, files, instruction, acceptance, expected gain and risk. Common acceptance for every change:
- `npm run check`, `npm run test:routes`, `npm run build` stay green.
- The design, copy and EN/KK parity stay the same.
- The `prefers-reduced-motion` paths stay the same.
- The Mac buffer check (`verify.mjs <base> <tag> corrupt 1024 768`, `TIERS=low,medium,high`) still reports max upload ≤ 512 KiB.

### A2-01 (P0): a lazy chunk that fails must never blank the page
- **Files:** new `src/components/ui/ChunkBoundary.tsx`, plus `src/App.tsx`, `src/assistant/AskBar.tsx`, `src/assistant/AssistantLauncher.tsx`, `src/main.tsx`.
- **Instruction.**
  1. **`ChunkBoundary`:** a class error boundary with props `{ fallback?: ReactNode; onError?: (e: unknown) => void; children }`. `getDerivedStateFromError` sets `failed`; `componentDidCatch` calls `onError`; when failed it renders `fallback ?? null`. It logs nothing.
  2. **`App.tsx`:**
     - Wrap the SkyScene `<Suspense>` in `<ChunkBoundary fallback={<div aria-hidden="true" style={SPACE_FALLBACK} />}>`.
     - Wrap the `ProductDemo` and `DemoForm` Suspenses in boundaries whose fallback is the same placeholder `<section>` (this keeps the `#platform` / `#join` ids and the heights).
     - Wrap the sub-page Suspense in a boundary with fallback `<div style={PAGE_FALLBACK} />` and `onError={reloadOnceForChunkError}`.
  3. **`AskBar.tsx`:** wrap `<Suspense><Answer/></Suspense>` in a boundary whose fallback is `<p className="qa-md">{answer.text}</p>`. That is the plain answer text, with no new copy.
  4. **`AssistantLauncher.tsx`:**
     - Wrap the panel Suspense in a boundary with `onError={() => { closePanel(); reloadOnceForChunkError() }}`, keyed so it resets when `panelOpen` toggles.
     - Wrap the `Announcer` Suspense in a boundary with fallback `null`.
  5. **`main.tsx`:**
     - Add `reloadOnceForChunkError()`, exported from a small `src/lib/chunkReload.ts`. It does nothing if `performance.now() < 30_000`, because failures at startup are network failures and the boundary fallback is enough. It also does nothing if `sessionStorage['qh.chunkReload']` is less than 5 minutes old (every access in try/catch). Otherwise it stores `Date.now()` and calls `location.reload()`.
     - Register `window.addEventListener('vite:preloadError', () => reloadOnceForChunkError())`, without `preventDefault`. The built preload helper already dispatches this event for failed dynamic imports.
- **Acceptance.**
  - `node perf/v3.1/scripts/mac-static-server.mjs dist 4821` plus `node perf/v3.1/scripts/audit-chunk-failure.mjs http://127.0.0.1:4821` reports `blank: false` in every case.
  - With `three` blocked, the hero text is still there over the CSS gradient.
  - With `r3f` blocked, `/members` content is still there.
  - With `Assistant` blocked, a launcher click leaves the page intact, no dialog opens, and the launcher still works.
  - The control case is unchanged.
  - With a permanently missing chunk, at most one reload happens per 5 minutes.
- **Gain.** Turns "blank page" into "same page without the 3D, or without the panel" on flaky networks (the documented KZ TLS drops) and for tabs that stay open across a deploy.
- **Risk.** Low. A reload loses unsent panel input; the thread survives in sessionStorage. The loop guard prevents repeated reloads.

### A2-02 (P1): give r3f's `<Canvas>` a lean THREE catalogue so `three` tree-shakes
- **Files:** new `src/sections/sky/threeCatalogue.ts`, `vite.config.ts`. Reference prototype: `perf/v3.1/scripts/lean-three/three-catalogue.js` and `build-variant.mjs`.
- **Instruction.**
  1. **`threeCatalogue.ts`:** export only the classes used as r3f JSX intrinsics:
     `export { Mesh, Group, Points, DirectionalLight, HemisphereLight, MeshPhysicalMaterial, MeshBasicMaterial, PlaneGeometry, CubeCamera } from 'three'`
     - App intrinsics: `mesh`, `group`, `points`, `directionalLight`, `hemisphereLight`, `meshPhysicalMaterial`; `primitive` is built in.
     - drei Lightformer: `mesh`, `planeGeometry`, `meshBasicMaterial`.
     - Environment portal: `cubeCamera`.
     - `meshTransmissionMaterial` registers itself with `extend`.

     Add a header comment: "every new lowercase JSX tag inside <Canvas> must be added here".
  2. **`vite.config.ts`:** add a build-only plugin, `{ name: 'r3f-lean-catalogue', apply: 'build', enforce: 'pre', resolveId(source, importer) { ... } }`. When `source === 'three'` and `importer` matches `/@react-three[\\/]fiber[\\/]dist[\\/]react-three-fiber\.esm\.js$/`, it returns the absolute path of `src/sections/sky/threeCatalogue.ts`; otherwise it returns `null`.
     - Only the Canvas module is redirected. The r3f events module and drei use static `THREE.X` accesses, which rolldown tree-shakes.
     - The shim's own `from 'three'` resolves normally.
     - It is build-only because dev uses pre-bundled deps, so a missing intrinsic only shows up in a build. That is why the acceptance below runs on built output.
  3. Update the vite.config comment block. Keep the `react`/`three`/`r3f` code-splitting groups unchanged. The shim lands in the `r3f` chunk as a dependency of the group.
- **Acceptance.**
  - `three-*.js` is ≤ 590 KB raw, down from 738 KB.
  - `node perf/v3.1/scripts/lean-three/check-variants.mjs` (base vs the new build) reports `identical: true` for hero and footer at `?q=low|medium|high`, with no page errors on `/`, `/kk/`, `/members`, `/handbook` or the 404 page.
  - Real-GPU `verify.mjs` shows unchanged uploads. Prototype result: max 512,000 B.
  - No console error containing "is not part of the THREE namespace".
- **Gain** (measured on the prototype, whole app):
  - `three` 738.2 → 572.4 KB raw (−166 KB) and 150.2 → 116.1 KB br11 (−34 KB).
  - About −42 KB on the production wire (estimated from the edge compression ratio).
  - Every page loads this chunk, so parse and compile time drop in proportion. The baseline measured 5.9 s of `r3f` scripting on mobile home and 2.5 s on sub-pages.
- **Risk.** Medium-low. A future intrinsic that isn't in the catalogue throws at runtime, in builds only. The acceptance check and the header comment guard against that. Upgrading r3f requires re-checking the importer regex (the file name is stable in 9.x).

### A2-03 (P1): replace drei `<Environment>` with a portal-only local component
- **Files:** new `src/sections/sky/ProceduralEnvironment.tsx` (port of `perf/v3.1/scripts/lean-three/lean-environment.js`), `src/sections/sky/SceneLights.tsx`.
- **Instruction.**
  1. **`ProceduralEnvironment.tsx`** implements drei 10.7.8 `EnvironmentPortal` semantics for `children`, `resolution`, `frames`, `near` (0.1) and `far` (1000):
     - one `new Scene()` in `useState`;
     - `WebGLCubeRenderTarget(resolution)` with `texture.type = HalfFloatType` in `useMemo`, disposed on unmount;
     - in `useLayoutEffect`: if `frames === 1`, render once through `cubeCamera.update(gl, virtualScene)` with `gl.autoClear` forced to true, set `scene.environment = fbo.texture`, and restore the previous value on cleanup;
     - a `useFrame` that re-renders while `count < frames`;
     - return `createPortal(<>{children}<cubeCamera ref args={[near, far, fbo]} /></>, virtualScene)`.

     `environmentIntensity`, `environmentRotation`, `backgroundBlurriness` and `backgroundIntensity` are left at three's defaults, which is exactly what drei sets.
  2. **`SceneLights.tsx`:** `import { Lightformer } from '@react-three/drei'` and `import ProceduralEnvironment from './ProceduralEnvironment'`. Replace `<Environment resolution={64} frames={1}>` with `<ProceduralEnvironment resolution={64} frames={1}>`, keeping the same children. Update the file comment.
- **Acceptance.**
  - The `r3f` chunk no longer contains `EXRLoader`, `RGBELoader`, `gainmap` or `fflate` (`grep -c` = 0) and is ≤ 180 KB raw, down from 225 KB.
  - `check-variants.mjs` reports `identical: true` (the prototype `lean2` was pixel-identical at all three tiers).
  - The Mac buffer check is unchanged.
  - Sub-pages still don't mount SceneLights.
- **Gain** (measured, prototype `lean2` vs `lean`):
  - `r3f` 225.1 → 172.9 KB raw (−52 KB) and 63.2 → 47.5 KB br (−15.7 KB).
  - `SkyScene` +0.7 KB.
  - With A2-02: total JS −217 KB raw and −49.6 KB br.
- **Risk.** Low-medium. This is a visual regression risk on the glass wordmark. The md5 parity check covers it; also compare real-GPU screenshots. drei stays a dependency because of `MeshTransmissionMaterial`.

### A2-04 (P1): stop the assistant from re-rendering the whole thread on every flush and keystroke
- **Files:** `src/assistant/Answer.tsx`, `src/assistant/Assistant.tsx`, `src/assistant/Markdown.tsx`, and optionally `src/assistant/store.ts` + `AskBar.tsx`.
- **Instruction.**
  - **(a)** `Answer.tsx`: `export default memo(Answer)`.
  - **(a)** `Assistant.tsx`: `const onInternalLink = useCallback(() => close(false), [close])` and pass `onInternalLink={onInternalLink}` to every `<Answer>`. `patchMessage` already keeps object identity for untouched messages, so settled answers stop re-rendering.
  - **(b)** `Markdown.tsx`: render each parsed block through a memoized `MarkdownBlock` whose props are primitives: `kind`, `content` (lines joined with `\n`, or items joined with ` `), `locale`, `newTabLabel`, `onInternalLink`. Split `content` again inside the block. Keep `key={i}`. During the 60 Hz reveal, only the growing last block re-renders. The HTML output must stay byte-identical.
  - **(c, optional)** Add `useAssistantSelect<T>(select)` to `store.ts`, a `useSyncExternalStore` hook that allows objects and relies on stable identities. Use it in `AskBar` to select only `activeId`, the inline answer (by id) and the message before it, so the Ask bar stops re-rendering while the panel streams.
- **Acceptance.**
  - React Profiler (dev): while a second answer streams in the panel, earlier `Answer`s commit 0 times.
  - Typing in the panel textarea commits no `Answer`.
  - `renderToStaticMarkup(<Markdown text=…>)` is identical before and after for the samples in `perf/v3.1/scripts/audit-md-bench.mjs`.
  - Reveal pacing looks the same (τ 0.16 s, ≥ 90 chars/s).
- **Gain.**
  - Measured (desktop, Node): 0.1–0.2 ms per answer to parse and render. That is about 0.5–1 ms per answer on a mid phone.
  - Panel flushes (25 Hz) and keystrokes go from O(thread) to O(1). For a 6-answer thread, that removes about 5–7 ms of main-thread work per flush and keystroke on phones: better INP and smoother streaming.
  - (b) reduces the per-frame work of the live answer to the last paragraph.
- **Risk.** Low. The only risk is a stale-closure bug if `onInternalLink` isn't stable; `useCallback` covers it.

### A2-05 (P2): one D1 round trip for `/api/ask`'s counters
- **Files:** `functions/_lib/ratelimit.ts`, `functions/api/ask.ts`. Reference: `perf/v3.1/scripts/d1-rows.mjs` (`GUARDED_GLOBAL`).
- **Instruction.**
  1. In `ratelimit.ts`, add `hitAsk(db, { minuteKey, dayKey, dayExpiresAt, minuteLimit, dayLimit, globalKey?, globalExpiresAt? }, nowSec)`. It runs **one** `db.batch` with the minute UPSERT, the day UPSERT and, only when `globalKey` is set, the guarded global statement:
     ```sql
     INSERT INTO counters (key, n, expires_at)
     SELECT ?1, 1, ?2
      WHERE (SELECT n FROM counters WHERE key = ?4) <= ?5
        AND (SELECT n FROM counters WHERE key = ?6) <= ?7
     ON CONFLICT(key) DO UPDATE SET …   -- same SET as UPSERT
     RETURNING n, expires_at
     ```
     It returns `{ minute, day, global: CounterResult | null }`. `global` is `null` when the guard skipped the insert.
  2. In `ask.ts`:
     - compute `wantAi = boolVar(env.ASK_ENABLED, true) && upstreamKind(env) !== null` before the limits;
     - call `hitAsk` with `globalKey` only when `wantAi`, using the same numeric limits as the 429 checks;
     - keep the 429 checks as they are;
     - set the mode from `wantAi` plus `global.n > cap`.
  3. Add `d1Ms` (duration of the batch) to the existing log lines. This contains no PII.
- **Acceptance.**
  - Local `wrangler pages dev`: a normal ask increments all three keys.
  - The 7th ask within a minute returns 429 with `Retry-After`, and `ask:ai:<date>` doesn't increase.
  - Offline or disabled mode never creates `ask:ai:*`.
  - `npm run eval:ask` behaves the same.
  - `wrangler tail` shows one D1 batch per ask.
- **Gain.** One fewer round trip to the EEUR primary before the SSE response headers, which moves time to first token earlier. Measure the size with `d1Ms` before and after; I estimate tens of ms from NQZ/ALA.
- **Risk.** Low. The semantics are preserved and the guard is proven in the D1 model (`guardedWhenLimited.written = 0`).

### A2-06 (P2): make `/api/config` actually cacheable in the browser
- **Files:** `src/lib/turnstile.ts`, `functions/api/config.ts` (+ one line in README / `wrangler.toml` about the rollout order).
- **Instruction.**
  - In `getTurnstileSiteKey()`, remove `cache: 'no-store'`. Keep `no-store` for `/api/join` and `/api/ask`.
  - In `config.ts`, send `Cache-Control: public, max-age=300, stale-while-revalidate=600` and update the doc comment.
  - Document the order: site key → wait ≥ 15 min → secret.
- **Acceptance.**
  - Load `/`, scroll to `#join`, reload within 5 minutes, scroll again: `performance.getEntriesByName(location.origin + '/api/config')[0].transferSize === 0`.
  - The Turnstile flow still works when the key is empty (the current state).
- **Gain.** One fewer ~50 ms request and one fewer Function invocation per repeat page view within 5–15 minutes. The request is lazy and outside LCP/TBT, so the gain is small.
- **Risk.** Low, covered by the documented rollout order.

### A2-07 (P2): coalesce SSE deltas on the server
- **Files:** `functions/api/ask.ts`.
- **Instruction.** In `streamAi`, buffer the text returned by `pii.push(...)` and forward it:
  - when at least 50 ms have passed since the last forward, **or** the buffer holds ≥ 160 characters;
  - the first non-empty chunk goes out immediately, so time to first token doesn't change.

  Before any finalization (`forward(rest)`, the partial-error `forward(pii.flush())`, and the leak path), flush the buffer, except on a leak, where it is dropped like the rest. Keep `LeakGuard` running on the raw deltas before the PII filter, as today.
- **Acceptance.**
  - `npm run eval:ask` passes.
  - A long local AI answer (with a key in `.dev.vars`, not production) produces about 3× fewer `delta` events.
  - `firstDeltaMs` is unchanged within noise.
- **Gain** (modelled with `audit-sse-framing.mjs`): a 2.4 KB answer goes from 379 events / 13.4 KB to 120 events / 5.9 KB (−56% bytes). There are also about 68% fewer `JSON.parse` calls, `appendDelta` calls and reader wake-ups on the client.
- **Risk.** Low. The worst case is about one inter-token gap of extra delay, which the client's 40 ms flush and 0.16 s reveal already hide.

### A2-08 (P2, optional): leaner `counters` table
- **Files:** new `migrations/0002_counters_without_rowid.sql`.
- **Instruction.**
  ```sql
  DROP TABLE counters;
  CREATE TABLE counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires_at INTEGER NOT NULL) WITHOUT ROWID;
  ```
  Dropping the table also drops `counters_expires`. Add a comment: "rate-limit windows are ephemeral; recreating the table only resets current windows; the 1% purge scans a small table". Apply it with `wrangler d1 migrations apply qairuhub-landing --remote` at deploy time (orchestrator).
- **Acceptance.** Local D1 model (`d1-worker`, variant `withoutRowidNoExpiresIndex`): an upsert writes 1 row, the purge still deletes expired rows, and the rate-limit tests from A2-05 still pass.
- **Gain.** Rows written per AI ask drop from 6–9 to 3, and per join from 3 to 1. This is cost headroom only; users won't notice.
- **Risk.** Low. The migration resets live windows once, and remote D1 must be migrated together with the deploy.

### A2-09 (P2): coalesce `SmoothScroll` limit syncs
- **Files:** `src/lib/SmoothScroll.tsx`.
- **Instruction.** Replace the direct `syncLimit` calls from the ResizeObserver and from window `resize` with `scheduleLimit`:
  ```ts
  let limitRaf = 0
  const scheduleLimit = () => {
    if (!limitRaf) limitRaf = requestAnimationFrame(() => { limitRaf = 0; syncLimit() })
  }
  ```
  Cancel `limitRaf` in the cleanup. Keep the initial `setScroll` seed as it is.
- **Acceptance.**
  - The DevTools performance panel shows at most one `Lenis.resize` per frame during a window drag and during mobile URL-bar collapse.
  - `/#features`, `/handbook#…` deep links still land below the header.
  - `test:routes` passes.
- **Gain.** Removes duplicate forced layouts during resize and while phones scroll. Small.
- **Risk.** Very low: the limit can be one frame late.

### A2-10 (P2): memo the Launchpad's heavy children
- **Files:** `src/assistant/AskBar.tsx` (`export default memo(AskBar)`), `src/sections/AgenticCards.tsx` (`const CardVisual = memo(function CardVisual …)`).
- **Instruction.** Apply the two `memo` wrappers. `onPromptChange` is already a stable `useCallback`, and `t.bentoLabels` is a stable module constant.
- **Acceptance.** React Profiler: a typewriter step or a card hover commits only `AgenticCards` and the `article` class changes, not `AskBar` or `CardVisual`. The active-card highlight behaves as before.
- **Gain.** A few ms per step on low-end phones while the Launchpad is in view.
- **Risk.** Very low.

## 6. Owner's checklist: full mapping

| Item | Status | Where / why |
|---|---|---|
| Cache API responses | **Partly: A2-06** | `/api/config` is the only cacheable response. `/api/join` GET is a signed token issued per request (must be `no-store`). `/api/ask` is SSE with per-user limits: general caching is rejected (§1.6), and the chip-only cache is optional and should be measured first |
| Load balancer | N/A | Cloudflare anycast + Pages/Workers; there are no origin servers to balance |
| Index the database | Done | Every statement uses the PK, the partial unique index or an `expires_at` index (§1.3). A2-08 optionally drops one index to save writes |
| Compress images | N/A | No raster images ship (favicon SVG only; textures are procedural). Fonts: Cloudflare serves br for TTF (Courgette 122 → 48.7 KB wire); woff2 is passed through as is (correct). Font subsetting is Audit 1's area |
| Loading skeletons | Done / A2-01 | Suspense placeholders keep section ids and heights; there's a CSS gradient behind the 3D and a "thinking" state in the assistant. A2-01 adds fallbacks for failed chunks |
| Cache expensive queries | N/A | No expensive query: retrieval takes 0.01–0.13 ms in memory, the index is parsed once per isolate (~3 ms), and D1 statements are single-row upserts |
| Avoid N+1 | Done / A2-05 | Counters are written in a `db.batch`; A2-05 folds the second batch into the first |
| Debounce input handlers | N/A (reasons in §3) / A2-09 | Controlled inputs with no network or search per keystroke; scroll/pointer handlers are already rAF- or flag-based; resize is coalesced in A2-09 |
| Split code into chunks | Done / A2-02, A2-03 | Vendor groups plus lazy 3D, sub-pages, assistant, ProductDemo and DemoForm. A2-02/03 shrink the 3D vendor chunks; A2-01 makes the splitting safe. Sub-pages loading SkyScene and the >5 s wordmark are Audit 1's area |
| CDN | Done | Cloudflare: hashed assets immutable with zone cache HIT; HTML revalidates; `/api/*` isn't edge-cached (correct). Prod differences: no HTML ETag; robots/favicon get 4 h from the zone TTL |
| Server-side caching | N/A (§1.5, §1.6) | Function responses are dynamic or tiny; nothing expensive to cache |
| Paginate large lists | N/A (§4) | All lists hold ≤ 64 entries, static, bundled |
| Lighthouse audit | Done (baseline, Audit 1) | This audit adds measured JS byte deltas: −217 KB raw / −49.6 KB br on the 3D path |
| Compress API payloads | Done / A2-07 | JSON above 50 B is compressed automatically; tiny JSON correctly isn't; SSE isn't on Cloudflare's list, so A2-07 cuts bytes by 56% instead. Don't add a compression rule for SSE |
| Avoid unnecessary re-renders | A2-04, A2-10 | Everything else is fine (§3 table) |
| Minify JS/CSS | Done | `vite build` (rolldown minify) + `cssMinify: true`; the built chunks are minified |
| Lazy loading (mobile and laptop) | Done / A2-01 | 3D, sub-pages, assistant panel, answer view, network client, Turnstile, Handbook index and below-the-fold sections are all lazy. A2-01 fixes the failure mode. How long the laptop wordmark takes to appear is Audit 1's area |
| Defer non-critical scripts | Done | Module scripts are deferred by default; the Turnstile script loads only when a site key exists and a form or ask is near. No third-party scripts load at page load (the CSP allows the Web Analytics beacon, but none was injected in the production HTML) |
| Remove unused dependencies | Done / A2-02, A2-03 | No unused package (§2). The dead code inside `three` and drei's Environment is removed by A2-02/03 |
| Database connection pooling | N/A | D1 is a binding with no client connections; OpenAI is reached through a service binding or `fetch`, and the Workers runtime pools those |

## 7. Evidence and how to reproduce

All paths are under `perf/v3.1/scripts/`.

- **Local API and CDN probe:** `audit-api-probe.mjs` → `audit-api-probe-local.json`. Server:
  ```
  npx wrangler pages dev dist --port 8802 --persist-to perf/v3.1/scripts/.wrangler --binding ASK_ENABLED=false
  ```
  The server log is `wrangler-8802.log`; the server was stopped afterwards.
- **Production probe:** `audit-api-probe.mjs prod` → `audit-api-probe-prod.json`. GET/HEAD of static files and `GET /api/config` only.
- **D1 model:** `d1-rows.mjs` / `d1-worker/` (local `wrangler dev --port 8803`, stopped afterwards) → `d1-rows-3variants.json`.
- **Chunk failure test:** `audit-chunk-failure.mjs`, against `mac-static-server.mjs dist 4821`.
- **Lean-three prototype:** `lean-three/build-variant.mjs base|lean|lean2` (writes to `%TEMP%/qh-lean-three`) and `lean-three/check-variants.mjs base lean2` → `lean-three/check-lean2.json` (`identical: true`). The real-GPU Mac check on `out-lean2` (1024×768, low/medium/high) found no upload larger than 512,000 B.
- **Micro-benchmarks:**
  - `audit-md-bench.mjs`: Markdown takes 0.105–0.111 ms to parse and create elements, and 0.20–0.22 ms with renderToString, per 1.4–2.6 KB answer; 200 reveal frames take about 12 ms to parse.
  - `audit-search-bench.mjs`
  - `audit-sse-framing.mjs`
- **Bundle composition:** `bundle-modules.json` (from `analyze-sourcemaps.mjs`).
