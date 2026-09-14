# QairuHub landing (design study)

A landing page for **QairuHub** — the student-driven builder community at Qazaq AI Research University (QAIRU), Astana — built as a faithful re-creation of the "Air" style reference (atmospheric sky, frosted-glass 3D lettering, one sans at weight 500, compressed uppercase display type, a single cursive accent word, ghost/haze buttons, flat cards, small radii, no shadows).

The visual system, motion and page structure are copied; the copy, assets and 3D sculpture are QairuHub's own. Everything is meant to be customised on top of.

Behind the content the page is one continuous scroll-driven **journey**: it starts in space under the stars with the glass wordmark floating in front of you, falls through the cloud deck into the day sky where the product story lives, drains into dusk, and lands on a moonlit grass field where the wordmark comes back down over the valley. The concept, budgets and rules are in `docs/JOURNEY-SPEC.md`.

## Stack

| Layer | Choice |
|---|---|
| App | Vite 8 + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` tokens in `src/styles/global.css`) + a few global component classes |
| Smooth scroll | Lenis (`src/lib/SmoothScroll.tsx`), stepped from the shared ticker |
| 3D backdrop | three + @react-three/fiber + @react-three/drei — one fixed full-viewport canvas (`src/sections/SkyScene.tsx`), code-split and loaded after first paint |
| Motion | CSS transitions/keyframes + one shared rAF ticker (`src/lib/ticker.ts`) for every scroll-linked DOM animation; the WebGL scene animates in r3f `useFrame` |
| Quality | Three tiers (`high` / `medium` / `low`) detected once at mount from the GPU, cores and viewport (`src/sections/sky/quality.ts`) |
| Visual QA | Playwright — screenshots (`pnpm shots`), a runtime perf probe and reference captures (`scripts/`) |

## Run

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # tsc --noEmit (strict, noUnusedLocals/Parameters)
pnpm build        # typecheck + vite build (react / three / r3f vendor chunks)
pnpm preview      # http://localhost:4173
pnpm shots        # screenshots of the running site into ./shots (needs `pnpm dev` running)

node scripts/perf.mjs              # fps / p95 frame time / long tasks at several scroll positions
node scripts/reference-shots.mjs   # capture the reference landing into reference/air
```

### Debugging the backdrop

- **Force a quality tier** with `?q=high|medium|low` (e.g. `http://localhost:5173/?q=low`). `detectQuality()` honours it before any device probing — use it for perf profiling and for checking every tier's look on one machine.
- In dev the r3f root state is exposed as `window.__sky` (toggle layers, read `gl.info`); it is stripped from production.
- `prefers-reduced-motion` renders a static frame (`frameloop="demand"`) that still follows the scroll; a hidden tab pauses the loop.

## Where things live

- `src/content.ts` — **all copy**. Edit text here (`brand.wordmark` is the lowercase logo spelling used by the DOM marks and the 3D lettering).
- `src/styles/global.css` — tokens (`@theme`), fonts, type scale (`.u-h1` …), buttons (`.btn--*`), grid, section, reveal, carousel, animated border, inputs, `.on-sky` contrast glow.
- `src/components/ui` — primitives: `Button`, `Reveal` / `RevealGroup`, `Section` / `SectionText`, `Grid` / `Col`, `Pill`, `AnimatedBorder`, `AutoCarousel`, `Wordmark`, `LogoMark`, `icons`.
- `src/components/three/GlassText.tsx` — the one frosted-glass lettering recipe: extruded `TextGeometry` with a rounded (tube-like) bevel, cached per font/text/shape, and the `MeshTransmissionMaterial` (`frosted`) / `MeshPhysicalMaterial` (`physical`, low tier) materials.
- `src/sections` — one file per section, in page order (see `src/App.tsx`). `Footer.tsx` is a 150vh spacer with the link row pinned at the bottom; the field behind it is drawn by the backdrop.
- `src/sections/SkyScene.tsx` — the single fixed WebGL canvas: detects the tier, writes the journey once per frame (`JourneyDriver`, `useFrame` priority −100), mounts the layers, and falls back to a CSS space gradient without WebGL.
- `src/sections/sky` — the backdrop:
  - `journey.ts` — the scroll-driven journey state (`journey.space / descent / whiteout / day / dusk / night / ground / stars / clouds / wordmarkHero / wordmarkFooter / time`), `updateJourney`, the `PALETTE` stops and `blendPalette`. One object, written once per frame, read by every layer — never React state.
  - `quality.ts` — `QualityTier`, `QUALITY[tier]` budgets (stars, cloud sprites, blades, transmission, DPR caps), `detectQuality`, `getDpr`, `getAntialias`.
  - `types.ts` — `LayerProps { tier, reduced }`, the props every layer takes.
  - `pointer.ts` — the shared lerped mouse for parallax.
  - Layers: `SkyDome`, `Stars`, `SceneLights`, `CloudSprites` (+ `cloudBake.ts`, baked once into sprite textures), `GlassWordmark` (hero + footer, one mesh), `Field` (+ `field/` — `Hills`, `Grass`, `Flora`, `terrain.ts`, `grassShaders.ts`); shaders in `shaders.ts` / `skyShaders.ts`.
- `src/lib` — shared infrastructure:
  - `SmoothScroll.tsx` — Lenis provider, in-page anchor handling with the header offset, `useLenis`, `useScrollListener`.
  - `scroll.ts` — `scrollState` (`y`, `progress`, `velocity`, `limit`, `direction`), `onScroll`, `elementProgress`; read it inside loops, no re-renders.
  - `ticker.ts` — the one shared `requestAnimationFrame` loop (`addTick(fn, priority)`); Lenis runs at priority −1 so `scrollState` is fresh before any DOM animation reads it.
  - `ease.ts` — the reference easing curve (`EASE`, `EASE_CSS`), durations, `clamp` / `lerp` / `progress`.
  - `media.ts` — `useMediaQuery`, `useReducedMotion`, `useDocumentVisible` (SSR-safe).
  - `ttf.ts` — minimal TrueType parser → typeface data for three's `TextGeometry` / drei `<Text3D>`; `useTTFFont(urls, chars)` (Suspense, ordered fallbacks) and `preloadTTFFont`. No CDN.
  - `submit.ts` — **the backend seam**: `submitJoin(values, { signal })` and `subscribeWaitlist(email, { signal })` are the only functions the two forms call. They currently resolve after a placeholder delay; replace their bodies with real requests (e.g. a `fetch` POST) and keep the signatures — nothing else changes.
- `docs/DESIGN-SPEC.md` — the reference design system every section follows (type, colour, buttons, cards, motion).
- `docs/JOURNEY-SPEC.md` — the backdrop concept: phases, performance budget, readability rules, the frosted-glass wordmark, and the v2.1 checklist.
- `public/fonts` — self-hosted: Inter (body), Anton (compressed display), Caveat (cursive accent), Courgette (wordmark — the DOM marks via `--font-script` and the 3D glass lettering via `lib/ttf.ts`), Dancing Script (Courgette's fallback, fetched on demand).

## Customising

- Text: `src/content.ts`. Colours, radii, fonts: `@theme` in `src/styles/global.css`.
- Sky colours: `PALETTE` in `src/sections/sky/journey.ts`; phase timings: `updateJourney` in the same file.
- Performance budgets per tier: `QUALITY` in `src/sections/sky/quality.ts`.
- Wire the forms to a backend: `src/lib/submit.ts`.
