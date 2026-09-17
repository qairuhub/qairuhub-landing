# Frontend loading: what shipped (audit 1 implementation)

Implements `perf/v3.1/audit-loading.md` on top of `f1e323a`. The reference patch
(`audit-loading-prototype.patch`, L1–L9 + part of L10) was applied and then extended, corrected and
re-measured. Design, copy, EN/KK parity and the scroll journey are unchanged: the only visible
difference is that the canvas now fades in instead of appearing after a frozen frame.

## 1. Measured result (this machine, Intel UHD / ANGLE D3D11, real GPU)

Lighthouse 12, local `wrangler pages dev` (compressed, same method as the baseline runs).
`pbase` = `f1e323a`, `v31new` = this build. JSONs: `perf/v3.1/lighthouse/*-v31new-r1.json`.

| Page | Score | FCP (ms) | LCP (ms) | TBT (ms) |
|---|---|---|---|---|
| home mobile | 41 → **94** | 3096 → **1893** | 5852 → **2493** | 2989 → **131** |
| home desktop | 67 → **99** | 665 → **542** | 1135 → **697** | 968 → **0** |
| kk mobile | 38 → **90** | 3370 → **1894** | 6680 → **2944** | 3300 → **152** |
| kk desktop | 68 → **100** | 693 → **532** | 1293 → **770** | 750 → **0** |
| members mobile | 45 → **75** | 3075 → **2230** | 5283 → **3837** | 3235 → **426** |
| members desktop | 71 → **99** | 706 → **568** | 1061 → **855** | 761 → **44** |

Traces (`perf/v3.1/scripts/trace-load.mjs` + `analyze-trace.mjs`, probes and analyses in
`perf/v3.1/traces/*-base-*` and `*-new-*`):

| | laptop 1440 | phone 390, CPU 4× |
|---|---|---|
| Blocked shader links | 1002 ms → **4 ms** (22 programs) | 1012 ms → **7 ms** (19 programs) |
| Longest main-thread task | 1043 ms → **77 ms** | 1218 ms → **199 ms** |
| Long tasks (10 s) | 3 (1487 ms) → **2 (136 ms)** | 9 (3406 ms) → 17 (1713 ms, none > 199 ms) |
| FCP | 416 → **220 ms** | 1288 → **580 ms** |
| First on-screen draw | 998 ms, presented at ≈1863 ms (end of the 1043 ms task) → **2189 ms, presented immediately** | 3129 ms, presented at ≈3877 ms → **2479 ms** |

No program is prepared twice for the same variant (the per-program table lists each name once per
pass: main pass + render-target pass, different fragment sizes).

Scripted full-page scroll at 1440 (`scrollhitch.mjs`): frame gaps > 50 ms 4 → **1** (max 104 →
78 ms), long tasks during the scroll 2 → **0**.

## 2. Items

Shipped: **L1, L2, L3 (except the AskBar edit), L4, L5, L6, L7, L8, L9, L10 (preloads), L12, L17
(memoisation part), L19 (sub-page skeleton), L22**.

- **L1** shader warm-up + fade-in — `sky/warmup.ts` (new), `SkyScene.tsx`, `cloudBake.ts`,
  `CloudSprites.tsx`, `SkyDome.tsx`, `GlassWordmark.tsx`. Canvas holds `frameloop="never"` until
  every program of the first frames reports `COMPLETION_STATUS_KHR`, then fades in over 700 ms.
  Added on top of the prototype: `<FirstFrame>` calls `invalidate()` itself, because in `demand`
  mode (reduced motion) the store's own invalidate can be spent before the subscriber exists.
- **L2** sky requested after FCP; home preloads Inter only — `App.tsx`, `lib/schedule.ts` (new),
  `sky/wordmarkFont.ts` (new), `fonts.preload.json`, `build-html.mjs`. Corrected against the
  prototype: sub-pages now wait for `load` **and** the paint, because on `/members` `load` fires
  before the first paint (285 vs 357 ms) and the sky chunk was an LCP dependency again.
  Verified in the Lighthouse network log: no three / r3f / SkyScene / wordmarkFont / Courgette
  request starts before `observedFirstContentfulPaint` on home, kk or members.
- **L3** staged section mounting + the ProductDemo forced layout. `documentElement.scrollHeight`
  3.5 s after load is 17627 at 1440 and 17611 at 390 — the baseline values. `/#join`,
  `/#platform`, `/#news`, `/#launchpad` land at top = 72 px with the baseline's scroll positions;
  reload restoration is unchanged (scrollY 4012 on both). **The AskBar `useLayoutEffect` → `useEffect`
  change was NOT made** (that file belongs to the other agent this run); with staged mounting the
  AskBar's forced layout now runs in batch 1 over header + hero + one section instead of the whole
  page, so most of the 431 ms (4×) is gone anyway. Worth doing as a follow-up.
- **L4** sub-page placeholder palette. Measured on `/members` at 390 (`colorstrip.mjs`): baseline
  rgb(6,11,32) → rgb(10,41,86) at 452 ms (a visible step); now the night gradient from the first
  sample, then a smooth fade to the canvas.
- **L5** wordmark geometry one glyph per task. Buffer uploads stay 353,232 B (position) and
  352,416 B (index) at every tier, so the geometry is byte-identical.
- **L6/L7/L8** staged canvas layers, field after the reveal, cloud bake after the reveal. The
  first frame issues no `readRenderTargetPixels` (measured 0). Field programs link at 2290 ms
  (1440) and 4154 ms (phone), i.e. after the reveal.
- **L9** GPU class cached in `localStorage`. Second desktop page view creates 1 WebGL context
  instead of 2.
- **L10** per-page preloads incl. `/fonts/Courgette-wordmark.woff2` on members / handbook / 404
  (their LCP element is the header wordmark; it now starts at 36 ms). `check-fonts.mjs` was left
  alone (not in this run's file scope), so the `pages.*` validation it proposes is still open.
- **L12** `gl.debug.checkShaderErrors = import.meta.env.DEV`.
- **L17** only the cheap half: `SceneLights` is memoised and its Lightformers hoisted, so a
  SkyScene re-render (reveal, visibility, profile) no longer re-renders the environment cube and
  re-runs the PMREM conversion. drei `<Environment>` itself was kept.
- **L19** sub-page Suspense fallback is now a skeleton of the heading block
  (`components/ui/PageSkeleton.tsx`), bars only, revealed after 300 ms so a fast chunk never
  flashes it. The assistant-panel and ProductDemo/DemoForm parts were not done (see below).
- **L22** one shared `IntersectionObserver` per option set in `Reveal.tsx`, with unobserve after a
  one-shot reveal. Measured `computeIntersections` over 10 s at 4× on the phone: 737 → 586 ms
  (−20 %), short of the audit's "at least half" — the remaining cost is per-target geometry.

### Not done, and why

| Item | Why |
|---|---|
| L3 AskBar `useLayoutEffect` → `useEffect` | `src/assistant/**` is owned by the other agent this run. |
| L10 `check-fonts.mjs` extension | Outside this run's file scope. |
| L11 (Inter-kazlabel for "ҚАЗ", −52 KB per EN view) | Needs `fonts-src/build-fonts.py` + `check-fonts.mjs`; building the subset outside the build script would break the "ranges must match build-fonts.py" invariant. Still worth doing: EN home still fetches Inter-cyrillic (52 KB) at 118 ms. |
| L13 stars as instanced quads | Needs a visual re-tune of star size/twinkle; the look must not change this run. |
| L14 warm-up draw for late layers | Measured first: the scripted scroll now has one 78 ms gap (baseline: four, up to 104 ms) and no long tasks, so the remaining ANGLE draw-time variants are cheaper than the extra pre-reveal GPU work would be worth. |
| L15 split reveal (sky first, wordmark faded) | Needs design sign-off. |
| L16 transmission compile parallel to PMREM | Measured on this machine the PMREM programs are ready 15 ms before the transmission compile starts (probe: PMREM ready@1222, transmission link@1237), so the gain here is ~15–50 ms, not the 0.6 s the audit saw. Not worth depending on three's cache-key internals. |
| L18 CSS-only night sky on phone sub-pages | Design decision, and it needs `src/pages/**`. |
| L20 scope Tailwind sources | Verified unnecessary: probe classes placed in `perf/` and in a tracked `docs/` file never reach the CSS, with or without `@source not`, and every class selector in the built CSS traces back to `src/`. tailwindcss 4.3.3 as configured here does not scan those folders. |
| L21 handbook `content-visibility` | Needs `src/pages/HandbookPage.css`. |

## 3. Gates

- `npm run build`, `npm run check` (EN home preload budget 116.6 KB / 700 KB, was ~287 KB) and
  `npm run test:routes` (26 checks) pass.
- `macbug/verify.mjs` with the Mac corruption model, `TIERS=low,medium,high` at 1440×900 and
  `TIERS=low` at 390×844: max upload 512,000 B (≤ 524,288), wordmark 353,232 / 352,416 B, wordmark
  visible in every hero and footer shot, no page errors.
- Reduced motion: canvas opacity 1, `transition-duration: 0s`.
- Visual: reduced-motion screenshots of hero, descent, mid page, footer and `/members` at 1440 and
  390 are pixel-identical to the baseline (0.000 % differing pixels) except the 1440 descent, where
  the AgenticCards highlight sits on a different step of the Ask-bar prompt cycle (a timer phase,
  not a layout change).

## 4. Re-running

```
node perf/v3.1/scripts/trace-load.mjs <url> --only=laptop-1440,phone-390 --tag=-x
node perf/v3.1/scripts/analyze-trace.mjs <raw>/laptop-1440-x.json --maps=<build>-maps/assets
node perf/v3.1/scripts/run-lighthouse.mjs --base=<url> --tag=-x --runs=1
```

Lighthouse must run against a **compressing** server (`wrangler pages dev`): with the plain static
server in `perf/v3.1/scripts/mac-static-server.mjs` the simulated FCP/LCP are inflated by about
1.5 s because Lantern sees uncompressed transfer sizes.
