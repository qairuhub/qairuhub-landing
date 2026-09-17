# Audit 1: load timeline and lazy loading (frontend)

HEAD `f1e323a`, `dist/` = HEAD (byte-identical JS to the sourcemapped build in `perf/v3.1/tmp-dist-maps`).
Source was not modified. All changes below are proposals. A measured reference implementation is in
`perf/v3.1/audit-loading-prototype.patch`. It was not applied, and `git apply --check` passes on `f1e323a`.

## 1. Summary

**What blocks the main thread today, from worst to least (cold load, real GPU):**

1. **Shaders link synchronously in the first frame: 0.8–1.7 s in one task.** three's `onFirstUse` asks
   for the program info log before the first draw, and that call waits for the driver link, even
   though `KHR_parallel_shader_compile` is on (the probe confirmed it). The worst programs on the Intel
   UHD (ANGLE D3D11) are:
   - the drei `MeshTransmissionMaterial` (0.50–0.80 s);
   - three's PMREM `PMREMGGXConvolution` (0.34–0.70 s), which converts the Lightformer environment;
   - the cloud-atlas bake (0.18–0.37 s), plus a 65 ms pixel read-back.

   Result: one frame task of **1.49–1.92 s** at 1440 and 1024, and **1.03–1.77 s** on the 4×
   phone. The canvas and the wordmark only appear when that task ends.
2. **The home page's first React commit renders all 17 sections at once.** A `useLayoutEffect` in
   `AskBar` (Typewriter, `offsetWidth`) forces a layout of the whole page inside the commit. The task
   takes **676–878 ms** on the phone (Layout 312 + style 107 ms of it) and 175–214 ms at 1440. FCP and
   LCP (the header CTA text) wait for it, so phone FCP is 1.12–1.56 s.
3. **The WebGL scene is built in one commit: 515–1031 ms on the phone, 143–287 ms on laptops.**
   - glyph extrusion 121–310 ms (`contractionLimits`, earcut);
   - drei `<Environment>` cube render in a layout effect: 79–202 ms;
   - flora merge 67–159 ms, hills 25–35 ms, grass 24–52 ms;
   - r3f reconciler 57–99 ms.

   Smaller tasks:
   - a throwaway WebGL context for the GPU probe: 50–194 ms on every desktop visit;
   - r3f context creation: 57–100 ms;
   - a `react-use-measure` forced layout when `<Canvas>` mounts in the same task as the ProductDemo
     commit: 66–155 ms;
   - the three/r3f module evaluation: 65–74 ms at 4×.
4. **Lighthouse's mobile LCP of 5.7 s is mostly a network-simulation effect.** The observed LCP is
   the header text at ~0.25–0.36 s. The page requests these files *before* that paint:
   - three (187 KB), r3f (73 KB) and SkyScene;
   - the Courgette TTF (56 KB), plus Caveat and Anton through HTML preloads.

   Lantern counts every request that starts before the observed LCP as an LCP dependency, so under
   Slow 4G the "render delay" becomes 5.1–5.4 s.
5. **Sub-pages carry the same costs.** Members, handbook and 404 load three + r3f and pay context
   creation, a 1.1 s first frame (cloud bake 270–336 ms, nebula bake 101–123 ms, program links) and
   the GPU probe, all for a static night sky. They also show a visible **colour jump**: the Suspense
   placeholder uses the *space* gradient, SkyScene paints the *night* gradient, and the swap happens
   at ~1.1–1.5 s on the phone.
6. **Fonts.**
   - The EN pages always fetch `Inter-cyrillic.woff2` (52 KB) because of the "ҚАЗ" locale label.
   - The home page preloads Caveat (82 KB) and Anton (27 KB), but neither is above the fold. The
     fold probe lists only Inter and the header Courgette wordmark.
   - The Courgette TTF preload competes with the critical JS.
   - `font-display: swap` is already set everywhere, so fonts never block FCP.

**The 3D wordmark appears (end of the first-frame task):**

| Viewport | Now | Prototype |
|---|---|---|
| 1440, unthrottled | 2.17–2.55 s | 2.81–3.07 s |
| 1024, CPU 2× | 2.98–3.30 s | 3.40 s |
| Phone, CPU 4× | 3.13–4.83 s | 2.40–2.71 s |

The canvas fades in over 0.7 s with no hard cut.

**Prototype results.** Same sources, same session, real GPU, cold caches. "pbase" is the unmodified
scratch build and "proto6" is the patched one.

| Config | FCP (ms) | Canvas + wordmark visible (ms) | TBT from FCP, trace (ms) | Longest task (ms) | Blocked shader links (ms) |
|---|---|---|---|---|---|
| Phone 390, 4× CPU | 1328–1436 → **588–676** | 3689–4091 → **2398–2711** | 1743–1992 → **501–928** | 993–1419 → **213–236** | 819–1154 → **11–15** |
| Laptop 1440 | 436–444 → 348–448 | 2172–2546 → 2812–3065 | 1441–1813 → **141–307** | 1401–1729 → **156–163** | 1283–1541 → **91–143** |
| Laptop 1024, 2× CPU | 716–720 → 552 | 3023–3214 → 3397 | 1950–2169 → **603** | 1645–1744 → **244** | 1380–1514 → **159** |
| KK phone, 4× CPU | 1204 → **792** | 4343 → **3159** | 2497 → 1362 | 1459 → **291** | 1227 → 20 |
| Members phone, 4× CPU | 700–704 → 828 | 1854–1962 → 2717 (sky deferred on purpose) | 645–778 → 480 | 501–509 → **224** | 301–311 → 6 |

Lighthouse 12, local wrangler, same builds:

| Page | Before | After (proto6) | Before → after detail |
|---|---|---|---|
| Home, mobile | 41, 43 | **81, 81, 91** | LCP 5.71–5.85 → **2.74–3.02 s**; TBT 2679–2989 → **68–452 ms**; FCP 3.02–3.10 → 2.03–2.14 s |
| Home, desktop | 67 | **99** | TBT 968 → 20 ms; LCP 1.14 → 0.62 s |
| KK home, mobile | 38 | **93, 93** | LCP 6.68 → 2.87 s; TBT 3300 → 74–102 ms |
| KK home, desktop | 68 | **99** | |
| Members, mobile | 45, 47 | **65, 77** | TBT 1918–3235 → 439 ms; LCP 5.2 → 3.6–5.2 s (P1 L10/L11 target the rest) |
| Members, desktop | 71 | **98** | |

JSON files: `perf/v3.1/lighthouse/*-pbase-*.json` and `*-proto6-*.json`. The earlier baseline runs
(`home-mobile-r1/r2`, 41 and 41) match pbase.

## 2. Method

- **Machine.** This PC: 20 logical cores, `ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11)`.
  It is the Intel UHD reference laptop of the quality tiers. Installed Chrome, headed, real GPU,
  one fresh profile per run, so the GPU program cache starts cold every time.
- **Server.** `npx wrangler pages dev dist --port 8801` for the repo build. The prototype comparison
  used a scratch copy of `src/` built twice: 8803 = unmodified, 8804 = patched.
- **Configurations.**
  - `phone-390`: 390×844, DPR 3, `isMobile`, touch, `Emulation.setCPUThrottlingRate 4`. The tier
    resolves to low (coarse pointer).
  - `laptop-1440`: 1440×900, DPR 1, no throttling. The tier resolves to medium (integrated GPU).
  - `laptop-1024-cpu2`: 1024×768, CPU 2×. This is the "in-app browser on a 1024 laptop" case.
  - Sub-pages and `/kk/` were also traced on the phone and at 1440.
- **Recording (`perf/v3.1/scripts/trace-load.mjs`).** It records 10 s from navigation. The trace
  includes timeline events, the V8 CPU profiler and screenshots. It also injects probes
  (`trace-init.js`):
  - FCP/LCP and their elements, and long tasks;
  - WebGL context creation, the first draw into the default framebuffer, and the first wordmark draw
    (the only non-instanced indexed draw with more than 3000 indices, 176,208 of them);
  - **per program:** its name/owner, link time, the first blocking query and how long it blocked,
    and when `COMPLETION_STATUS_KHR` turned true;
  - fonts actually loaded, text above the fold, and resource timing.
- **Attribution (`perf/v3.1/scripts/analyze-trace.mjs`).**
  - Long task = a top-level `RunTask` over 50 ms on the renderer main thread. t0 = `navigationStart`.
  - Every V8 sample inside a long task is mapped through the source maps to file, line and function.
    It is then classified by **owner** (the first feature frame from leaf to root, such as "cloud atlas
    bake", "wordmark: glyph extrusion" or "Environment / PMREM") and by **operation**.
  - Native `(program)` samples are resolved to the deepest trace event (Layout, UpdateLayoutTree,
    compile and so on).
- **Summary.** `perf/v3.1/scripts/summarize-traces.mjs` writes `perf/v3.1/traces/summary.md` and
  `summary.json`.
  - "Canvas visible" = the end of the task that issued the first default-framebuffer draw. The frame
    cannot be presented before that task returns. The filmstrips in `perf/v3.1/traces/frames/`
    confirm this.
  - "TBT from FCP" = Σ(long task − 50 ms) for long tasks that start after FCP. There is no TTI cut-off.
- **Other files.** Per-run reports: `perf/v3.1/traces/<run>-report.txt`, `-analysis.json` and
  `-probe.json`. Raw traces (~50 MB each) stayed in the session scratchpad.

Caveats:
- The "phone" run uses the laptop GPU with a CPU throttle. Real Adreno, Mali and Apple drivers compile
  at different speeds, but the synchronous-link mechanism is the same.
- Runs are noisy (antivirus, a single machine), so ranges are shown. One outlier run per config was
  re-run.
- Lighthouse runs headless with SwiftShader and simulated throttling.

## 3. Baseline load timeline (repo `dist/`)

### 3.1 Phone 390, 4× CPU (`phone-390-r2`; r1 has the same shape with larger numbers)

| Start (ms) | Duration (ms) | What (sampled owners) |
|---:|---:|---|
| 27 | 86 | HTML parse and preload scan |
| 276 | **676** | First React commit of the whole home page: **forced full-page layout from `src/assistant/AskBar.tsx:63`** (Typewriter `useLayoutEffect` → `offsetWidth`) 431 ms; React render 183; section components 37 |
| — | — | **FCP / LCP 1120** (header "Open platform") |
| 960 | 103 | Ticker frame: `Header.tsx:221` reads `window.innerHeight`, which forces the web-font swap relayout (65 ms) |
| 1284 | 131 | ProductDemo / DemoForm lazy commit, plus `react-use-measure` (r3f `<Canvas>`) forcing layout (119) |
| 1508 | 67 | r3f `createRoot` / `WebGLRenderer` (context creation) |
| 1585 | **515** | Scene commit: drei `<Environment>` cube render 145; **glyph shapes + extrusion 121** (`extrudeGlyphs.ts:125 contractionLimits`); Flora 67; r3f 62; Hills 26; Grass 24; GlassText 24 |
| 2101 | **1029** | **First frame: synchronous program links 657** (PMREMGGXConvolution 373, low-tier physical wordmark 152, dome/stars…); **cloud atlas bake 283** (link 208 + `readRenderTargetPixels` 65); nebula bake 60 |
| ≈3130 | — | **Canvas and wordmark visible** (filmstrip: fallback gradient until 3.0 s, then the full scene in one cut) |
| 3432 | 73 | Field warm-up (`Field.tsx` `compileAsync`: source generation for 6 programs) |

Long tasks total 2680 ms. TBT from FCP is 1564 ms (r1: 4246 and 2646).

### 3.2 Laptop 1440 (`laptop-1440-r1`) and 1024 with 2× CPU (`laptop-1024-cpu2-r1`)

| 1440: start + duration (ms) | 1024 ×2: start + duration (ms) | What |
|---|---|---|
| 147 + 175 | 188 + 489 | First commit; the AskBar forced layout alone is 125 / 331 |
| — | — | FCP / LCP 444 / 828 (nav link "Programs") |
| 386 + **81** | 803 + 53 | `quality.ts probeGpu` → throwaway `getContext('webgl2')` 74 / 45 (**175–194 ms** on the sub-page runs) |
| 587 + 57 | — | r3f context creation |
| — | 912 + 79 | ProductDemo commit + `react-use-measure` forced layout 67 |
| 648 + 143 | 1106 + 287 | Scene commit: extrusion 36 / 88, Environment 28 / 45, flora 16 / 32 … |
| 791 + **1498** | 1393 + **1589** | **First frame: 1383 / 1406 ms blocked in program links** (MeshTransmissionMaterial 576 / 573, PMREMGGXConvolution 357 / 428, cloud bake 213 / 196); cloud read-back ~70 |
| ≈2290 | ≈2980 | **Canvas and wordmark visible**; nothing drawn in between (filmstrip 1561 ms = fallback) |

### 3.3 Shader programs on the Intel UHD, cold (blocked ms at first use)

| Program | 1440 | 1024 ×2 | Phone (low tier) |
|---|---:|---:|---:|
| drei MeshTransmissionMaterial (86 KB fragment) | 497–677 | 573–797 | – |
| three PMREMGGXConvolution (Environment → CubeUV) | 337–403 | 371–492 | 366–698 |
| Cloud atlas bake (`cloudBake.ts`) | 194–214 | 183–220 | 191–368 |
| MeshPhysicalMaterial (low-tier wordmark) | – | – | 152–308 |
| Dome, stars, nebula, backlight, Lightformer basic | 3–31 each | 5–46 each | 5–45 each |
| **Total** | **1283–1541** | **1380–1711** | **819–1522** |

A program already linked by an earlier page in the same browser process blocked for only 1–6 ms.
Example: `PMREMGGXConvolution` took 3 ms when the phone run had loaded first. So first visits pay the
full cost, and repeat visits (Chrome's GPU program cache) mostly do not. A tier-specific program such
as the MeshTransmissionMaterial is still cold the first time that tier is shown.

Sub-pages: 283–425 ms blocked, mostly the cloud bake. Cloud sprites are invisible at the top of home,
so today their program links **mid-scroll at the start of the descent** (9–38 ms). The field programs
are warmed, but still paid 7–25 ms at the footer.

### 3.4 Network and fonts (EN home; the same pattern shows in all Lighthouse runs)

- At parse time (~30–45 ms), the HTML preloads **Inter-latin 121 KB, Anton 28 KB, Caveat-latin 83 KB,
  and Courgette-Regular.ttf 56 KB** (the latter as `fetch`). These requests compete with
  `index.css` (17 KB), `index.js` (43 KB), `react.js` (60 KB) and `icons` (3 KB).
- During the first React render (~160–200 ms), `lazy(SkyScene)` requests
  **three 187 KB + r3f 73 KB + SkyScene 24 KB**, and the idle warm-up requests ProductDemo and
  DemoForm.
- After the first layout (~160–330 ms), the page requests **Inter-cyrillic 52 KB** (the "ҚАЗ" label
  in the header) and Courgette-wordmark 7 KB.
- Text above the fold at 1440 is Inter everywhere, plus the header Courgette wordmark. On the phone
  it is only the header CTA and the wordmark. Neither Anton nor Caveat is used above the fold on
  home, so their preloads only compete with the critical path. On `/members`, `/handbook` and `/404`,
  the H1 (Anton + a Caveat accent) *is* above the fold.

### 3.5 Sub-pages

- **`/members` on the phone.** The LCP element is the header wordmark at 700–740 ms. The canvas
  appears at 1.76–1.96 s. The sky costs:
  - context creation 101 ms and layer build 62 ms;
  - a first frame of 469 ms: cloud bake 270, nebula bake 103, links 84.

  The page also pays two full layouts (143 and 96 ms at 4×) and a `lenis onWrapperResize` read
  (40 ms).
- **`/handbook` on the phone.** The LCP element is the H1 at 1324 ms, behind a **375 ms layout** of
  the article HTML. The first sky frame is 544 ms. **At 1440, the GPU probe alone takes 175–194 ms.**
- **Colour jump.** `App.tsx` `SPACE_FALLBACK` is always the space gradient, but `SkyScene` paints
  `NIGHT_FALLBACK_GRADIENT` on `/members` and `/handbook`. The filmstrip shows the lower third
  changing from rgb(6,11,31) to rgb(30,59,101) when the chunk arrives (~1.0–1.5 s), and then again to
  the canvas (33,71,120).
- **What the backdrop needs there.** `setStaticJourney('night' | 'space')`: dome, twinkling stars and
  clouds at 0.3 (faint far-layer edges). There is no wordmark, field or lights. It looks static apart
  from the twinkle.

## 4. Why the scene is late and blocking: code facts that shape the fixes

- **Canvas.** `SkyScene.tsx` renders every layer in one `<Canvas>` commit with `frameloop` 'always'.
  The first `useFrame` pass is also the first draw of every program. `compileAsync` is used only for
  the Field, and only after mount.
- **PMREM.** `SceneLights.tsx` uses drei `EnvironmentPortal` with `frames={1}`, which renders the
  cube in a **layout effect** during the commit. three converts `scene.environment` with its internal
  `PMREMGenerator` inside the **first `getProgram` of a lit material** (the wordmark, and the Lambert
  hills), and links PMREM programs synchronously there.
- **Environment code.** `@react-three/drei/core/Environment.js` imports `useEnvironment` →
  EXRLoader, RGBELoader, gainmap-js and fflate. That is ~40 KB minified in `r3f-*.js`, used only for
  `files` / `preset`, which this site never passes.
- **Clouds.** `CloudSprites.tsx` bakes the atlas from the first frame, one cell per frame, with a
  `readRenderTargetPixels` probe on cell 0. That probe forces a GPU sync. The sprites are invisible
  until the descent at 0.85 vh.
- **Wordmark.** `GlassWordmark.tsx` + `GlassText.getGlassGeometry` build the whole 58,736-triangle
  run synchronously **during render** as soon as the TTF resolves. `extrudeGlyphs` already works
  shape by shape, which makes slicing per glyph straightforward. The shapes are exact, so the output
  can stay identical.
- **GPU probe.** `quality.ts detectQuality` → `probeGpu` creates a WebGL context in a `useState`
  initialiser. Phones and ≤ 4-core devices skip it.
- **Journey height.** `journey.ts` reads only `scrollState.y` and `scrollState.limit`. At `y ≈ 0` every
  weight is independent of `end`: `space` / `stars` / `wordmarkHero` depend on `y`, and the dusk and
  night phases start at `end − 2.5 ≥ 1.5`. A page that is short for the first second therefore
  renders the same top of the journey. `SmoothScroll` resyncs `limit` through a ResizeObserver on
  `body`, and the deep-link placement re-runs on `fonts.ready` and `load`.
- **three r186 program cache-key traps** (both found while prototyping, both invisible without the
  per-program probe):
  1. `hasPositionAttribute` is part of the key. A warm-up mesh with an empty `BufferGeometry`
     prepares a program nobody draws. three's own `PMREMGenerator.compileCubemapShader()` has this
     bug.
  2. drei `MeshTransmissionMaterial.onBeforeCompile` writes `USE_TRANSMISSION` into
     `material.defines` on the first compile. The key of that first program then differs from every
     later key. A naive `compileAsync` warms a program that is never used, and the real one still
     links synchronously (669 ms measured).
  3. `compileAsync` polls only `properties.currentProgram`. Compiling the render-target variant right
     after the main variant hides the main variant's readiness.

## 5. Changes

Priorities:
- **P0**: the large, measured wins.
- **P1**: clear wins with small risk.
- **P2**: optional or design-dependent.

"Proto" means the change is in `audit-loading-prototype.patch` and was measured.

### L1 (P0): Link shaders in the background before the first frame; fade the canvas in (proto)

**Files:**
- `src/sections/SkyScene.tsx`
- new `src/sections/sky/warmup.ts`
- `src/sections/sky/cloudBake.ts`, `CloudSprites.tsx`, `SkyDome.tsx`, `GlassWordmark.tsx`

**Instruction:**

1. **Hold rendering.** Render `<Canvas frameloop={hidden || !live ? 'never' : reduced ? 'demand' : 'always'}>`.
   Keep `live` and `shown` per `canvasKey` (the `tier:antialias` key), so a context remount warms up
   again.
2. **Add a `<Warmup>` child** after all layers. In one `useEffect` it:
   1. Starts `warmPMREM(gl, 64)` (64 = `<Environment resolution>`). It uses
      `new PMREMGenerator(gl)`, `_setSize(64)`, `_allocateTargets()`, and replaces
      `_compileMaterial` with a no-op before `compileCubemapShader()`. It then compiles
      `_ggxMaterial` and `_cubemapMaterial` on meshes whose geometry **has a position attribute**,
      with a scratch render target bound, and disposes everything 5 s later. Guard every private
      member with `typeof … === 'function'`.
   2. Calls every registered warmer. `cloudBake` gets
      `compile(gl) { setRenderTarget(target); return gl.compileAsync(mesh, camera) }`, and `SkyDome`
      does the same for its nebula bake scene. Each layer registers through
      `registerWarmer()` in an effect.
   3. For each `scene.children` except the wordmark group, calls
      `compileTracked(gl, child, camera, scene, false)` and then `compileTracked(…, true)`, with
      `await nextTask()` between calls. `compileTracked` does
      `gl.compile(…)` → `gl.properties.get(m).currentProgram` for every material, with a scratch
      `WebGLRenderTarget(1, 1)` bound for the `true` variant. That variant covers the drei
      transmission FBO pass and any render-to-texture pass, because every bound target keys the same
      way.
   4. Awaits `glassWordmarkSettled()` (resolved from `Letters`' layout effect, from the error
      boundary fallback, or after 6 s) **and** the PMREM warm-up.
   5. On the wordmark group (`name='qh-glass-wordmark'`), sets `defines.USE_TRANSMISSION = ''` on any
      material with `uniforms._transmission`, then compiles both variants.
   6. Waits until every tracked program's `isReady()` is true (poll every 16 ms), racing an 8 s
      timeout. It then calls `onReady` → `live = true`.
3. **Fade in.** `<FirstFrame>` runs `useFrame` once → `requestAnimationFrame` → `shown = true`. The
   Canvas `style` gets
   `opacity: shown ? 1 : 0; transition: reduced ? 'none' : 'opacity 700ms ease-out'`. The gradient
   div underneath stays.
4. **Later (L12):** set `gl.debug.checkShaderErrors = import.meta.env.DEV` in `onCreated`.

**Acceptance:**
- `node perf/v3.1/scripts/trace-load.mjs <url> --only=laptop-1440,phone-390`, then
  `analyze-trace.mjs`: "total blocked" ≤ 200 ms on both. No program appears twice with the same name
  and size.
- No long task over 250 ms at 1440.
- Canvas visible ≤ baseline + 0.6 s at 1440, and earlier than baseline on the phone.
- `macbug/verify.mjs` with `TIERS=low,medium,high`: uploads ≤ 512 KiB, the wordmark visible in every
  hero shot, and no new page errors.
- Hero, descent and footer screenshots at 1440 and 390 look identical to the baseline.
- Reduced motion: the canvas is visible and the transition is none.

**Expected gain (measured):**
- Blocked links: 1.28–1.71 s → 0.09–0.16 s (laptops) and 0.82–1.52 s → ≈ 0.02 s (phone).
- Longest task: 1.4–1.9 s → < 0.25 s.
- Lighthouse home desktop TBT: 968 → 20–87 ms.
- Nothing links mid-scroll any more, except ANGLE draw-time variants (L14).

**Risk:**
- Private PMREM members: after a three upgrade the PMREM warm-up may silently stop matching. That
  only costs performance, and the per-program probe shows it.
- Browsers without `KHR_parallel_shader_compile` block inside the warm-up instead of the first frame:
  same total, with a later reveal.
- The reveal is ~0.3–0.6 s later on the Intel UHD laptop. It is now a fade rather than a 1.5 s freeze.
- With the prototype's ordering, the MeshTransmissionMaterial compile waits for PMREM (see L16).

### L2 (P0): Request the sky after the first contentful paint; no TTF / Caveat / Anton preload on home (proto)

**Files:**
- `src/App.tsx`
- new `src/lib/schedule.ts`
- new `src/sections/sky/wordmarkFont.ts` (move `FONTS` there; `GlassWordmark` imports it)
- `src/styles/fonts.preload.json`, `scripts/build-html.mjs` (and `scripts/check-fonts.mjs`, see L10)

**Instruction:**

1. **`useAfterFirstPaint(page)`.** Render `{skyOn ? <SkyScene/> : <div style={skyFallback(page)}/>}`
   inside the existing Suspense.
   - **Home:** `afterFirstContentfulPaint(start, 'user-visible')`. It waits for the `paint`
     PerformanceObserver entry `first-contentful-paint`, then one frame, then
     `scheduler.postTask` (fallback `setTimeout`). The rAF step **must race a timer** (300 ms): with
     rAF alone, the hero stayed blank in an occluded window (caught by `verify.mjs`). There is a 3 s
     cap when paint timing is unavailable. `start` also runs
     `import('./sections/sky/wordmarkFont').then(m => m.preloadWordmarkFont())`, so the TTF download
     does not wait for three.
   - **Sub-pages:** after `load`, then `requestIdleCallback` with a 1.5 s timeout (fallback
     `setTimeout` 300).
2. **Preloads.** In `fonts.preload.json`: `common` = Inter-latin only, `home` = `[]`, and a new
   `pages: { members, handbook, notFound: [Anton-latin, Caveat-latin] }`. Update `preloadsFor` in
   build-html to add `preloads.pages[page]`. The Courgette TTF `as=fetch` preload goes away.

**Acceptance:**
- In the Lighthouse home mobile `network-requests` audit, no three / r3f / SkyScene /
  Courgette-Regular / Caveat / Anton request starts before `observedFirstContentfulPaint`.
- Simulated LCP ≤ 3.2 s.
- `dist/index.html` preloads only Inter. `dist/members.html` preloads Inter, Anton and Caveat.
- In a background tab (`page.bringToFront` omitted), the sky still mounts within ~1 s of becoming
  visible.

**Expected gain (measured):**
- Home mobile LCP: 5.7–5.85 s → 2.74–3.02 s. FCP: 3.0–3.1 → 2.0–2.1 s.
- KK mobile LCP: 6.68 → 2.87 s.
- Score: 41–43 → 81–91 (together with L1 and L3).

**Risk:**
- Desktop reveal +0.3–0.5 s: the three request moves from ~0.19 s to ~0.5–0.75 s.
- On a very slow network the wordmark TTF starts later. It is fetched in parallel with three, so the
  chunk still gates the reveal.

### L3 (P0): First paint = header + hero; mount the sections below the fold in background batches; remove two forced layouts (proto)

**Files:** `src/App.tsx`, `src/lib/schedule.ts`, `src/assistant/AskBar.tsx`, `src/sections/ProductDemo.tsx`

**Instruction:**

1. **`useStagedMount(8)` in `HomeSections`.** Batches:
   1. `[AgenticCards]`
   2. `[Logos, Waitlist]`
   3. `[Supersize]`
   4. `[ProductDemo]` (Suspense placeholder kept)
   5. `[Features]`
   6. `[Projects, News]`
   7. `[ModelsCTA, Integrations]`
   8. `[Storytelling, DemoForm]`
2. **Scheduling.**
   - Batch 1 starts with `afterFirstContentfulPaint(go, priority)`.
   - The next batches use `postTask(go, priority)`, where `priority` starts as `'background'`. The
     sky's user-visible work always runs first, and batches fill the gaps while the GPU links.
   - `onFirstIntent` (wheel, touchstart, keydown, pointerdown, scroll; capture, passive) switches
     the priority to `'user-blocking'`.
   - Fallback timers: 4 s for batch 1, 1 s for the others.
3. **Render everything at once** when `location.hash` is set, or when
   `performance.getEntriesByType('navigation')[0].type !== 'navigate'` (reload or back/forward
   restoration).
4. **AskBar Typewriter:** `useLayoutEffect` → `useEffect` for the `offsetWidth` read.
5. **ProductDemo tab indicator:** remove the synchronous `measure()` from the layout effect. The
   ResizeObserver's first callback runs after layout and before paint, so there is no flash.

**Acceptance:**
- `document.documentElement.scrollHeight` 3.5 s after load equals the baseline (measured 17611 at
  390 and 17627 at 1440).
- `/#join` and `/#platform` land at 72 px, as on the baseline (`nav-check`).
- Reload behaviour unchanged (baseline and proto both end at `scrollY` 0).
- A touch within 600 ms mounts the rest (height 2190 → 17611).
- Journey screenshots unchanged. `npm run check` and `npm run test:routes` pass (both ran green on
  the prototype copy).

**Expected gain (measured):**
- Phone FCP: 1.33–1.44 s → 0.59–0.68 s. KK: 1.20 → 0.79 s.
- The 676–878 ms first commit becomes a ~120 ms commit plus batches of 50–220 ms at 4×.
- Lighthouse home mobile FCP: −0.9 s.

**Risk:**
- The home page is short for ~0.5–1.5 s on slow phones. The intent listener covers early scrolling.
- `Header`'s rAF tick reads `window.innerHeight`, so each batch's layout shows up as "Header" in
  traces. The work is the same either way; caching `innerHeight` on resize is optional.
- Sections are still client-rendered (no SEO change).

### L4 (P0): Sub-page placeholder in the right palette (proto)

**Files:** `src/App.tsx`, `src/sections/sky/fallback.ts`, `src/sections/SkyScene.tsx`

**Instruction:**
- Move `presetFor` from SkyScene into `fallback.ts` as `presetForPage(page)` (entry-safe).
- Use `background: fallbackGradientFor(presetForPage(page) ?? 'space')` for App's Suspense fallback
  and the pre-sky placeholder.

**Acceptance:** the `/members` filmstrip shows no space-to-night colour step. The lower-third
colour stays in the night palette from the first paint.

**Gain / risk:** removes a visible flash. No risk.

### L5 (P1): Build the wordmark geometry one glyph per task (proto)

**Files:**
- `src/components/three/extrudeGlyphs.ts`: `extrudeGlyphShapesAsync(shapes, options, yieldTask)`,
  plus a shared `finish()` that keeps the `MAX_BUFFER_BYTES` throw.
- `src/components/three/GlassText.tsx`: `glassKey` / `shapesOf` / `store` helpers and
  `prebuildGlassGeometry(font, text, opts, yieldTask)`, cached with the same key.
- `src/lib/ttf.ts`: `loadTTFFont(urls, chars): Promise<TypefaceData>`.
- `src/sections/sky/GlassWordmark.tsx`

**Instruction:**
- `preloadGlassWordmark()` also runs `loadTTFFont(...).then(font => prebuiltEntry(font).promise)`.
- `Letters` calls `usePrebuiltGeometry(font)`, which throws the prebuild promise until it is done.
- `getGlassGeometry` then becomes a cache hit.

**Acceptance:**
- No task over ~65 ms at 4× owned by "glyph shapes + extrusion" or GlassText.
- The index count stays 176,208, and the position and index uploads stay 353,232 and 352,416 bytes
  (`verify.mjs`).
- Screenshots identical through the 360° turn.

**Gain:** 121–310 ms (4×) and 36–88 ms (laptops) move out of the scene commit, into ~9 slices plus one
`store` task (~50–65 ms at 4×).

**Risk:** low. The output order is identical because `addShape` is unchanged.

### L6 (P1): Mount the Canvas layers across tasks (proto)

**File:** `SkyScene.tsx`

**Instruction:** add `layerStage` 0→3, advanced with `nextTask()` after each commit:
- stage 0: JourneyDriver, SkyDome, Stars;
- stage 1: CloudSprites;
- stage 2: SceneLights (the Environment cube render);
- stage 3: GlassWordmark and `<Warmup>`.

**Acceptance:** the scene commit's long tasks are each ≤ ~250 ms at 4× (measured 153–244).

**Gain:** the 515–1031 ms (4×) commit is split.

**Risk:** none visible, because nothing is shown before L1's reveal.

### L7 (P1): Mount the night field after the reveal; split its build and warm-up (proto)

**Files:** `SkyScene.tsx`, `src/sections/sky/Field.tsx`

**Instruction:**
- In SkyScene, set `fieldOn` after `shown`, using `requestIdleCallback` with a 2.5 s timeout
  (fallback 1.5 s), or when `scrollState.y > 0.3 × innerHeight`, whichever comes first.
- In Field, mount Hills, then Grass, then Flora in three commits (`stage` state plus `nextTask`).
  `warmFieldPrograms` compiles one child per task (main and render-target variants) once stage 3 is
  committed.

**Acceptance:**
- No Field work before the reveal.
- The footer is reached with 0 ms blocked for field programs, apart from ANGLE draw-time variants
  (L14).
- Footer screenshot identical.

**Gain:** 107–245 ms (4×) leave the startup commit: flora 67–159, hills 25–35, grass 24–52.

**Risk:** a user who jumps to the footer within ~1 s triggers the mount through the scroll hook. The
field needs ≥ 1.5 vh of scroll to appear, which gives ~3 tasks of margin.

### L8 (P1): Pre-link the cloud-atlas bake and start it after the reveal (proto)

**Files:** `cloudBake.ts`, `CloudSprites.tsx`

**Instruction:**
- The atlas gets `compile(gl)` (L1).
- `atlas.step(gl)` only runs when `bakeAllowed || journey.clouds > 0`. `allowCloudBake()` is called
  by SkyScene 1.2 s after the reveal on home, and immediately after the reveal on sub-pages (where
  clouds are 0.3).

**Acceptance:**
- The first frame contains no `readRenderTargetPixels`.
- Descent screenshot identical (the atlas is complete long before 0.85 vh).

**Gain:** 270–494 ms leave the first frame (link 190–370 ms plus a 65 ms GPU sync).

**Risk:** on sub-pages the far-layer clouds fill in over the first 8 frames after the reveal, as
they do today.

**Optional:** replace the read-back probe with a link-status check to remove the GPU sync entirely.

### L9 (P1): Cache the GPU class (proto)

**File:** `src/sections/sky/quality.ts`

**Instruction:**
- `probeGpu()` first reads `localStorage['qh.gpu'] = {ua, gpu}`. On a hit with the same
  `navigator.userAgent`, it skips the probe.
- Otherwise it runs the existing probe (`probeGpuNow`) and stores the result (not `'unknown'`).
- Every storage access is wrapped in try/catch.

**Acceptance:** on a second desktop visit, no `getContext` in the tasks before r3f's context.

**Gain:** 50–194 ms per desktop page view after the first. The first visit still pays.

**Optional (P2):** probe in a module Worker with `OffscreenCanvas` so the first visit is free too.

**Risk:** a GPU or driver change under the same UA string keeps the old class until storage is
cleared. Acceptable: the tier is a performance budget, not a correctness input.

### L10 (P1): Per-page font preloads, and preload the sub-page LCP font

**Files:** `src/styles/fonts.preload.json`, `scripts/build-html.mjs`, `scripts/check-fonts.mjs`

**Instruction:**
- Keep L2's `pages` map and add `/fonts/Courgette-wordmark.woff2` (6.6 KB) to members, handbook and
  notFound. On sub-pages the header wordmark *is* the LCP element, and its font request started at
  ~170 ms, as an LCP dependency.
- Extend check-fonts to validate every `pages.*` href: it exists and is used by an @font-face. Also
  budget-check the largest page.
- The prototype contains the `pages` map and build-html support. It does **not** contain the
  Courgette-wordmark preload or the check-fonts extension.

**Acceptance:**
- `npm run check` passes and reports the pages budget.
- In Lighthouse members mobile, Courgette-wordmark starts at < 50 ms.

**Gain:** members mobile LCP 3.6–5.2 s should settle at the low end, as for home.

**Risk:** none.

### L11 (P1): Stop "ҚАЗ" from loading Inter-cyrillic (52 KB) on every EN page

**Files:** `fonts-src/build-fonts.py`, `public/fonts/`, `src/styles/global.css`, `scripts/check-fonts.mjs`

A DOM scan of `/`, `/members`, `/handbook` and a 404 found exactly three Cyrillic characters, all
in `.lsw__opt`: Қ U+049A, А U+0410, З U+0417. The `title="Қазақша"` tooltip is browser UI and uses no
web font.

**Instruction:**
1. Build `Inter-kazlabel.woff2`: a pyftsubset of Inter with U+0410, U+0417 and U+049A.
2. Give those three code points **only** to the new face, so the ranges do not overlap. In the
   Inter-cyrillic face, change `unicode-range` to
   `U+0400-040F, U+0411-0416, U+0418-0499, U+049B-04FF, U+2116, U+20B8`.
3. Declare the new face with the same family and weight range and
   `unicode-range: U+0410, U+0417, U+049A`.
4. On KK pages, both files load, and Inter-cyrillic is already preloaded there. Consider preloading
   the small file on KK as well.
5. Update `LATIN` / `CYRILLIC` in `fonts-src/build-fonts.py` and the check-fonts coverage: every
   Kazakh letter must still be covered by some Inter face.

**Acceptance:**
- An EN home network log has no `Inter-cyrillic.woff2`; the label renders identically (pixel diff
  of the header).
- The KK page still preloads and uses Inter-cyrillic.

**Gain:** −52 KB at VeryHigh priority on every EN page view. It also removes an LCP dependency on
sub-pages.

**Risk:** glyph metrics must come from the same Inter version (build both files from the same source
TTF).

### L12 (P1): `renderer.debug.checkShaderErrors = import.meta.env.DEV`

**File:** `SkyScene.tsx` (`onCreated`)

**Why:** on ANGLE-D3D11, `onFirstUse`'s three info-log calls are synchronous GPU-process round trips.
After warm-up they still cost 5–25 ms per program at first use (seen at the descent and the footer).

**Acceptance:** fewer `getShaderInfoLog` / `getProgramInfoLog` waits in `trace-init` `linkWaits`.
Shader errors still reported in dev.

**Risk:** a broken shader in production renders nothing instead of logging. The build already runs in
dev and in the macbug checker.

### L13 (P2): Stars as instanced quads instead of `GL_POINTS` on ANGLE-D3D11

Even after warm-up, the stars program blocks **55–127 ms** at its first draw at 1440. ANGLE emulates
point sprites with a draw-time geometry-shader variant.

**Option:** a `PlaneGeometry` in an `InstancedBufferGeometry`, sized in clip space.

**Risk:** a visual re-tune of star size and twinkle.

### L14 (P2): Warm-up draw for layers that first appear later

ANGLE-D3D11 compiles input-layout variants at the first draw:
- cloud sprites at the start of the descent: ~40–57 ms blocked;
- field at the footer: ~40–70 ms blocked.

**Option:** before the reveal, render each late layer once into a 1×1 target of the same format,
with `material.visible` forced on.

### L15 (P2): Split the reveal: sky first, wordmark faded in

Show the dome and stars once linked (~0.3–0.5 s after mount). Keep the wordmark group invisible until
the MeshTransmissionMaterial is linked, then ramp `GLASS_BACKLIGHT.strength` 0→1 and
`envMapIntensity` 0→1.2 over 600 ms. At 0 the transmission glass shows only the blurred backdrop, so
it reads as invisible.

**Gain:** the hero sky appears ~1 s earlier on desktop.

**Risk:** design sign-off for the fade.

### L16 (P2): Compile the MeshTransmissionMaterial in parallel with PMREM

Use a proxy scene with `environment` = a CubeUV-mapped `DataTexture` (image height 256) and the same
light types (one hemisphere, one directional). The key then matches without triggering the
conversion.

**Gain:** ~0.6 s earlier reveal on the Intel UHD.

**Risk:** depends on key internals. Verify with the per-program probe.

### L17 (P2): Drop drei `<Environment>`; memoise the Lightformers

**Option:** a ~60-line cube-camera environment with the same three Lightformers (or a pre-baked
CubeUV texture) removes EXRLoader, RGBELoader, gainmap-js and fflate (~40 KB minified, ~15 KB gzip)
from `r3f-*.js`, and lets the 6-face render happen one face per task.

**Also:** `SceneLights` re-renders with SkyScene (visibility change, profile change). The portal's
layout-effect dependencies include `children`, so every re-render re-renders the cube and bumps
`pmremVersion`. Memoise the Lightformer children.

### L18 (P2, design decision): CSS-only night backdrop for sub-pages on phones

Use a night gradient (already exists), a static star layer (a CSS radial-gradient tile or a tiny
SVG) and the moon glow. On `pointer: coarse` or `max-width: 767px`, mount no WebGL on
`/members` and `/handbook`.

**Gain:** ~260 KB gzip and ~0.8–1.1 s of 4× main thread per sub-page view.

**Risk:** no twinkle and no faint clouds on phone sub-pages. With L2's load+idle deferral, Lighthouse
members mobile was already 65–77.

### L19 (P2): Skeletons for lazy chunks

- **Sub-page Suspense fallback** (blank `100lvh` div today): an `aria-hidden` block with the
  `subpage__head` metrics (eyebrow, title and lede bars; no text, so it can never become the LCP
  element).
- **Assistant panel** (`fallback={null}`): on touch devices there is no hover warm-up, so the first
  tap waits for the chunk with nothing on screen. Render the panel frame with a spinner.
- **ProductDemo / DemoForm placeholders:** already keep `min-height`. Add a subtle card outline.
- **AskBar answer:** already shows "thinking…". No change.

### L20 (P2): Scope Tailwind sources

The repo build scans untracked folders (`perf/`, `docs/`…). A `src`-only build produced 12 fewer
utilities (80.3 vs 81.5 KB raw CSS). In `global.css`, add `@source not "../../perf";` (and `docs`),
or use `@import "tailwindcss" source("../")` with explicit `@source` entries.
`perf/v3.1/tmp-dist*` now contains built JS, so delete it or exclude it before the next
`npm run build`.

### L21 (P2): Handbook `content-visibility`

Handbook only; there is no journey on sub-pages.

**Option:** `.hb-section { content-visibility: auto; contain-intrinsic-size: auto 900px; }`.

**Why:** the article's layout is a 375 ms task at 4×.

**Check:** the TOC scroll-spy and `useDeepLinkLanding` (it re-places for ~3 s as the page grows).

### L22 (P2): One shared IntersectionObserver for `Reveal` / `RevealGroup`

`IntersectionObserverController::computeIntersections` costs 181–557 ms per 10 s at 4× on the phone
(steady state, not load).

### Rejected

- **`content-visibility` or placeholder-height lazy sections on home.** Estimated heights would move
  `scrollState.limit`, and with it the journey's end-anchored dusk and night and the anchor offsets.
  L3 keeps the final DOM and heights exact instead.
- **Mounting the scene only on first input.** The 3D wordmark *is* the hero, so the first screen
  would stay empty.
- **Critical inline CSS plus async `index.css`.** It is 16.5 KB gzip, and the header needs the tokens
  and base layer. The measured cost is one simulated RTT (476 ms in Lighthouse), and splitting it
  risks a flash of unstyled content and layout shift. Not worth it now.
- **Build-time baked wordmark geometry.** 704 KB raw (positions plus indices) versus a 56 KB TTF.
  L5 removes the CPU cost instead.
- **`font-display: optional` for Inter.** The brand font would be lost on first visits.
- **Server-rendered or prerendered HTML.** It is the next lever for mobile FCP (the page is CSR, and
  FCP ≈ JS download + React), but it is an architecture change outside this audit.

## 6. Owner's checklist

| Item | Status | Reason |
|---|---|---|
| Cache API responses | N/A | Loading audit; no API call on the critical path |
| Load balancer | N/A | Cloudflare Pages |
| Index the database | N/A | Frontend audit |
| Compress images | N/A | No raster images on any page. Fonts are WOFF2 subsets; the one TTF is served compressed (56 KB) |
| Loading skeletons | Proposed (L19) | Blank sub-page and assistant fallbacks today |
| Cache expensive queries | N/A | Frontend |
| Avoid N+1 | N/A | Frontend |
| Debounce input handlers | Already done | Scroll work runs in one shared rAF ticker. L3's intent listener is passive and fires once |
| Split code into chunks | Mostly done; L2 adds one | three / r3f / react / SkyScene / pages / ProductDemo / DemoForm / assistant are already split. L2 adds `wordmarkFont`; L17 trims `r3f` |
| CDN | Already done | Pages with `immutable` assets |
| Server-side caching | N/A | Static HTML at the edge |
| Paginate large lists | N/A | No large lists |
| Lighthouse audit | Done | Baseline and prototype numbers in §1 |
| Compress API payloads | N/A | Frontend |
| Avoid unnecessary re-renders | Proposed (L3, L6, L17) | Commit splitting; Environment re-bake on SkyScene re-render |
| Minify JS/CSS | Already done | Rolldown + `cssMinify` |
| Lazy loading, mobile and laptop | Proposed (L2, L3, L7, L8, L18) | Sky after FCP, staged sections, field and clouds after reveal |
| Defer non-critical scripts | Proposed (L2, L10) | three / r3f after FCP; preload cleanup |
| Remove unused dependencies | Proposed (L17) | drei Environment loaders |
| Database connection pooling | N/A | Frontend |

## 7. Files and how to re-run

- `perf/v3.1/scripts/trace-load.mjs`: the recorder. Uses installed Chrome, headed, 10 s.
  - `--only=phone-390,laptop-1440,laptop-1024-cpu2`, `--path=members` (no leading slash; Git Bash
    rewrites it), `--tag=`.
  - Set `TRACE_RAW_DIR` to keep the ~50 MB raw traces out of the repo.
- `perf/v3.1/scripts/trace-init.js`: page probes (paint, LCP, long tasks, GL draws, per-program link
  timing and blocked time).
- `perf/v3.1/scripts/analyze-trace.mjs <raw.json> [--maps=<dir>] [--frames]`: source-mapped
  long-task attribution. It writes `perf/v3.1/traces/<run>-analysis.json`, and `--frames` also writes
  the filmstrip.
- `perf/v3.1/scripts/summarize-traces.mjs`: writes `perf/v3.1/traces/summary.md` / `summary.json`.
- `perf/v3.1/traces/`: per-run `-probe.json`, `-analysis.json`, `-report.txt`, and `frames/*.jpg`.
  - Baseline runs: `phone-390-r1/r2`, `laptop-1440-r1/r2`, `laptop-1024-cpu2-r1/r2`, and the
    sub-page / kk runs.
  - Prototype comparison: `*-pbase-*` and `*-proto3-*` / `*-proto6-*`. proto3 = L1 + L3 + L5 + L6 +
    L7 + L8 + L9 without L2. proto6 = the patch.
- `perf/v3.1/lighthouse/*-pbase-*.json` and `*-proto6-*.json`, plus earlier iterations (`-proto3`,
  `-proto4`, `-proto5`).
- `perf/v3.1/audit-loading-prototype.patch`: the reference implementation of L1–L9 and part of L10,
  measured as proto6.
  - `tsc` clean; `check-content`, `check-fonts` and `test-routes` green on the patched copy.
  - `verify.mjs`: max upload 512,000 B (grass chunk); the wordmark is still 353,232 / 352,416 B at
    all tiers.
  - Not included: L10's Courgette-wordmark preload and check-fonts extension, L11, L12, and the P2
    items.
