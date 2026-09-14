# ⚠️ MANDATORY v2.1 CHECKLIST (user requests, 2026-09-14 02:50) — every reviewer must report each unmet item as a HIGH finding against the named file; every builder/fixer touching these files must implement them

1. **Wordmark text is lowercase `qairuhub`** — the 3D glass lettering AND the DOM wordmark (header/footer) render `brand.wordmark` from `src/content.ts` (= `qairuhub`), never `brand.name`. (`src/sections/sky/GlassWordmark.tsx`, `src/components/ui/Wordmark.tsx`)
2. **Legible wordmark font: Courgette** (`/fonts/Courgette-Regular.ttf`, medium-weight friendly script; fallback `/fonts/DancingScript-Variable.ttf`). The thin Mr Dafoe / Sacramento faces are NOT legible enough — replace them everywhere: the 3D typeface source in `GlassWordmark.tsx` (`useTTFFont('/fonts/Courgette-Regular.ttf', …)`), the `@font-face` + `--font-script: "Courgette", "Dancing Script", cursive` in `src/styles/global.css`, the preload in `index.html`. Header wordmark ≈ 28px.
3. **Smaller 3D wordmark**: the hero run spans ≈ 0.70 × the visible width at z 0 (≤ 0.78 on mobile), the footer run ≈ 0.42 × (0.7 on mobile). It must never touch the header buttons; extrusion height ≈ 0.14 × size, bevel rounded (tube-like), readable letters. (`GlassWordmark.tsx`)
4. **360° rotation on scroll**: in the hero `rotation.y = (1 − journey.wordmarkHero) × 2π` (one full turn as the user scrolls it away, tied to scroll, eased by the journey smoothstep), in the footer `rotation.y = (1 − journey.wordmarkFooter) × 2π` (a full turn as it descends into place); the mouse parallax (±0.06 / ±0.03) and the slow float are added on top. Under reduced motion: no rotation. (`GlassWordmark.tsx`)
5. **Lower scroll sensitivity**: Lenis `wheelMultiplier: 0.65`, `touchMultiplier: 1.3`, `lerp: 0.09` so a small wheel tick moves less and sections do not fly past; keyboard/anchor scrolling unchanged. (`src/lib/SmoothScroll.tsx`)
6. Everything else in this document still applies (space start, frosted glass, readability, performance, "everything works").

# The Journey — space → sky → night (backdrop concept v2)

> **STATUS: implemented — `src/sections/SkyScene.tsx` + `src/sections/sky/journey.ts`.**
>
> One fixed canvas renders the whole journey (space → descent → sky → dusk → night + field);
> `journey.ts` derives the scroll-driven phase weights from `scrollState` and every backdrop layer
> (`SkyDome`, `Stars`, `CloudSprites`, `GlassWordmark`, `Field`) reads them. `Footer.tsx` is the
> 150vh DOM spacer described below. This document is the source of truth for the backdrop;
> `docs/DESIGN-SPEC.md` remains the source of truth for the sections, typography and components.

## Narrative

The page is one continuous descent. You start **in space**, among the stars, with the glass
QairuHub wordmark floating in front of you. As you scroll you **fall through the atmosphere**:
the black turns deep blue, the stars dissolve, you punch through a layer of clouds and arrive in
the bright **day sky** where the whole product story lives. Towards the end the light drains into
**dusk and night**, the stars return, and you land on a **moonlit grass field** — the wordmark
comes back down and hovers above the valley. Starts under the stars, ends under the stars.

## One canvas, one render loop

- ONE fixed full-viewport `<Canvas>` (SkyScene) renders everything: sky, stars, nebula haze,
  clouds, the glass wordmark, and the footer grass field. The old separate footer canvas is
  removed; `Footer.tsx` becomes a 150vh DOM spacer with the link row pinned at the bottom.
- The camera never moves through geometry; instead a scroll-driven "altitude" uniform/value
  `alt ∈ [0,1]` (0 = space at the top of the page, 1 = ground at the very bottom) drives every
  layer. `alt` is derived from `scrollState.y` with these keyframes (in viewport heights, vh):

| scroll (vh) | phase | sky top → bottom | stars | clouds | wordmark |
|---|---|---|---|---|---|
| 0 – 0.9 | SPACE | `#03040c` → `#070c24`, faint violet/blue nebula haze, thin blue atmosphere limb glowing along the bottom edge | full, twinkling, slight parallax | none | centered, huge, refracting the stars; mouse parallax; slow float |
| 0.9 – 2.2 | DESCENT | lerp to `#0c2d6e` → `#0d59c2` → `#2ea3ff` | fade out by 1.8vh | rise in from below (near layer first) and pass upward past the camera; a soft white "whiteout" flash peaks at ~1.6vh (opacity ≤ .35) as we punch through the cloud deck | drifts up and out of frame by 1.4vh, then unmounts |
| 2.2 – (end − 2.5) | SKY | day gradient (reference), subtle darkening with depth | none | big soft cumulus, 3 depth layers, slow drift + scroll parallax; sparser than the hero deck | unmounted |
| (end − 2.5) – (end − 1.2) | DUSK | `#0d2a66` → `#164a9c` → a hint of warm horizon `#5d5f9c` low | fade in | thin, darker undersides | — |
| (end − 1.2) – end | NIGHT + FIELD | `#061a3d` → `#0b2c5c`; stars full; moon glow | full | few, dark | re-mounts above the valley, descends into place (y from +6 → 3.2), floats |
| footer area | GROUND | hills rise from the bottom edge as `alt → 1` (group translateY from −6 → 0), grass sways, flowers/mushrooms, fog | | | |

`end` = document height − viewport. Use `scrollState.y` and `scrollState.limit` (px) — convert vh
via `window.innerHeight`. Ease each transition with smoothstep; nothing snaps.

## Performance budget (must-haves)

Target: 60 fps on a 2020 laptop with integrated graphics at 1440×900, ≤ 6 ms GPU per frame,
no long tasks > 50 ms after load, Lighthouse-style TBT < 200 ms, first paint with the CSS
gradient fallback < 1 s, three.js loaded lazily after first paint.

- **Source of truth for every number in this list is `src/sections/sky/quality.ts`** (`QUALITY[tier]`,
  `detectQuality`, `getDpr`, `getAntialias`); the values below mirror it and are updated together with it.
- DPR = max(1, min(devicePixelRatio, tier cap)), with two caps per tier: `dprCap` for viewports < 1280 px
  (1.5 high / 1.5 medium / 1.25 low) and `desktopDprCap` at ≥ 1280 px (1.25 high / **1.0 medium** / 1.25 low).
  The sky is soft gradients and sprites, so on the Intel UHD reference laptop 1.0 instead of 1.25 at
  1440×900 is +5 fps at the hero and the footer; MSAA (`getAntialias`) is turned on only when the tier
  renders at exactly 1× so the extruded wordmark keeps clean edges on a DPR-2 display.
- Quality tiers (`detectQuality`, once at mount; `?q=high|medium|low` pins it for QA): `low` = phones /
  coarse pointer / < 768 px / ≤ 4 cores / Save-Data / ≤ 2 GB / software or mobile GPU; `medium` = an
  integrated desktop GPU (Intel UHD / Iris, AMD APU) whatever the core count — a WebGL renderer-string
  probe decides this, core count alone misled; `high` = discrete (or unknown) GPU with ≥ 8 cores; the
  rest `medium`. Tiers scale star count, cloud sprite count and texture size, blade count, the
  transmission FBO `resolution` / `samples`, and on `low` disable transmission (fall back to the frosted
  MeshPhysicalMaterial with envMap only).
- Clouds: **baked sprites, not per-pixel fbm every frame.** On start, render 6–8 cloud textures
  (512×256, RGBA, soft cumulus shapes with lit tops / blue-grey bottoms) once with the fbm shader into
  small render targets (512 px textures on high/medium, 256 on low), then draw 26 / 20 / 14 sprites
  (high / medium / low; three depth layers, `depthWrite:false`, premultiplied alpha) that drift and
  parallax by moving their positions. Per-frame cost ≈ 25 quads.
- Stars: one `<points>` (1800 on high, 900 medium, 500 low) with a tiny shader: size attenuation,
  twinkle from `time + seed`, alpha by `alt` phase. Nebula: one full-screen quad with a 3-octave fbm
  tint, rendered at quarter resolution into a render target once (static) and composited.
- Glass wordmark: ONE mesh that **stays mounted for the life of the scene**; `mesh.visible` and
  `material.visible` are toggled per frame from `journey.wordmarkHero` / `journey.wordmarkFooter`
  (below 0.005, or once the run has drifted above the frame top, both go false — drei then skips
  the transmission pass and three skips the draw, so the day phase costs nothing). Unmounting between
  the two appearances was tried and rejected: it disposed the MeshTransmissionMaterial, so the footer
  re-linked its large shader on the main thread mid-scroll (≈ 50 ms) and reallocated the FBOs.
  Geometry (extruded TextGeometry from the runtime-parsed Courgette TTF, `src/lib/ttf.ts`) is built
  once and kept in a module-level cache (`getGlassGeometry`, `src/components/three/GlassText.tsx`).
  Transmission FBO `resolution` 512 / `samples` 6 on high, 384 / 3 on medium, transmission off on low;
  `backside` false; `distortion` 0 (the noise wobble cost ≈ 10 ms/frame on an Intel UHD for an
  invisible effect). Material recipe = `GLASS_MATERIAL` in `GlassText.tsx` — ior 1.4, attenuation tint
  `#dbe6ff` — see "Frosted glass wordmark" below for the full set of values.
- Grass: `InstancedMesh` 14000 blades high / 6000 medium / 3000 low (medium was 8000; at 1440×900 on
  the Intel UHD laptop the footer was the one journey position under the 55 fps target, and 3000 already
  reads as a full meadow, so 6000 keeps the density and buys the margin), one ShaderMaterial, wind in
  the vertex shader. The whole field group is `visible` only while `journey.ground > 0.01`, i.e. once
  the hills start rising in the footer phase. Hills: one displaced plane, 120×60 segments.
- Single `useFrame`; no per-frame allocations; no `setState` per frame; scroll read from `scrollState`.
  Pause the loop on `document.hidden`. Reduced motion: static frame (`frameloop="demand"`), no drift.
- DOM side: one shared ticker (`src/lib/ticker.ts`) for every scroll-linked DOM animation (Supersize
  words, storytelling triptych) instead of multiple rAF loops. Keep `backdrop-filter` to the header
  menus and tab bar only; feature cards use a translucent fill without blur. `contain: paint` on
  heavy sections. `React.lazy` + `Suspense` for SkyScene so the three.js chunk loads after first paint
  (CSS gradient placeholder underneath is the same colour as the space phase). `manualChunks` for three.

## Beauty checklist

- Space phase reads as space: not just black — a slow nebula haze, a few brighter stars with soft
  glow, a razor-thin atmosphere limb at the bottom edge (blue → transparent, ~12% of the viewport).
- The cloud deck is *cumulus*: large soft shapes, bright tops, cooler grey-blue undersides, never
  noise mush; the punch-through moment feels like flying through cloud (near sprites scale up past the
  camera, brief soft whiteout).
- Day sky is the saturated reference blue; no banding (dither the gradient in the shader).
- Night: moon glow (soft radial off-center), stars a touch warmer, hills lit from the moon side, fog.
- The wordmark is unmistakably glass: refractions of stars/clouds visible through the letters,
  crisp rim highlights, slight chromatic fringe, never opaque plastic.
- Motion is slow and calm (drift ≈ 6–12 px/s), everything eased with `var(--ease)`.

## Readability (v2 requirement — text must be effortlessly readable everywhere)

The first pass failed here: white text over dense white clouds. Rules for v2:

- **Cloud coverage in the day phase ≤ 30 % of the viewport**, never a wall of white. Big soft shapes with
  lots of clear saturated blue between them, like the reference. Keep the densest deck only in the
  descent moment (whiteout) where there is no text.
- **Keep clouds away from the reading column.** Bias sprite positions so the central 50 % of the
  viewport width holds at most one cloud at a time; the rest live at the edges / corners.
- **Clouds behind content are dimmed**: in the day phase render cloud sprites at ~82 % brightness with a
  faint blue tint and alpha ≤ .9 (clean white only in the descent whiteout). The sky mid tone stays deep
  (`#0d59c2` → allow `#0b4fb0`) so white 16px/500 text keeps ≥ 4.5:1 on the clear sky.
- **Text on the sky gets a soft contrast glow** (not a drop shadow): `text-shadow: 0 2px 24px rgba(6, 18, 58, .45)`
  on headings and body copy placed directly on the sky (section titles, storytelling, supersize,
  agentic subtitle, waitlist, form title, footer links). Add a `.on-sky` utility in global.css and use it.
  Cards with a fill do not need it.
- **Secondary text opacity** ≥ .75 (was .6); inactive tab labels ≥ .7; agentic inactive cards ≥ .55;
  card fills `rgba(255,255,255,.08)` with `rgba(255,255,255,.18)` borders; the tab bar fill `.14`.
- Body copy max-width ≤ 62ch; line-height 1.5; never below 16px. Footer links 16px.
- In the space and night phases, text sits on near-black — verify the header/nav and footer links are
  white, not the light-theme black.

## Frosted glass wordmark (v2 requirement)

The wordmark is **matte / frosted glass, not clear glass**: milky, softly translucent, light scatters
inside it, edges catch a rim highlight; the letters read as bright, legible shapes on space and on the
night sky (never a dark silhouette). Implementation guidance:

- **The recipe lives in `GLASS_MATERIAL` / `GLASS_PHYSICAL` (`src/components/three/GlassText.tsx`)**;
  `GlassWordmark.tsx` only layers the tier's `resolution` / `samples` and the chromatic fringe on top.
  The values below mirror the code and are updated together with it.
- High/medium tiers: `MeshTransmissionMaterial` with `transmission 0.62` — not 1: three mixes the body
  as `mix(diffuse, transmitted, transmission)`, and at 1 the body IS the blurred backdrop, which over
  the near-black space / night sky is a dark glass silhouette (measured on the Intel UHD laptop: navy
  on navy); 0.62 keeps ≈ 40 % of the `#f3f7ff` diffuse body lit by the Lightformer environment (the
  milky scatter, bright even when the sky is not) while ≈ 60 % of the stroke is still the blurred,
  attenuated backdrop with the stars / limb / clouds showing through. `roughness 0.5` (the blurred
  transmission is what makes it frosted), `thickness 0.35` and `attenuationDistance 3` in local units
  (drei scales both by the mesh's world scale, so they track `size`; thin + long keeps the transmitted
  share translucent rather than tinted), `ior 1.4`, `color #f3f7ff`, `attenuationColor #dbe6ff`,
  `chromaticAberration 0.02` on high only (0 on medium — > 0 triples the bicubic taps per sample and
  is invisible under the roughness blur), `anisotropicBlur 0.35`, `distortion 0`, `samples 6` (3 on
  medium), `resolution 512` (384 on medium), `backside false` with `backsideResolution 32` (drei would
  otherwise allocate a full second FBO for the unused pass), `clearcoat 1`, `clearcoatRoughness 0.1`,
  `sheen 0.25` (white, `sheenRoughness 0.45`) for the velvet rim, `envMapIntensity 1.4`. Plus a very
  soft self-illumination (`emissive #9db4ff`, `emissiveIntensity 0.08`) as a floor against a black
  silhouette at grazing angles. Earlier attempts are on record so they are not repeated: `transmission
  0.7` + `emissive 0.12` + `envMapIntensity 1.8` + `sheen 0.6` read as flat lavender plastic.
- Low tier: `MeshPhysicalMaterial` transparent, `opacity 0.9`, `color #eef3ff`, `roughness 0.5`,
  `clearcoat 1`, `clearcoatRoughness 0.15`, `sheen 0.4` (white, `sheenRoughness 0.6`), `envMapIntensity 1.3`,
  `emissive #9db4ff` at `0.12` — a convincing frosted look with no transmission pass.
- Procedural `<Environment>` from `<Lightformer>`s: a big soft white top light, a cool blue rim from the
  left, a faint warm fill from below-right — this is what makes frosted glass read as glass.
- Verify visually at scroll 0 on the space background and in the footer on the night sky: letters must
  be clearly readable from 2 m away.

## "Everything must work" (v2 requirement)

Every link, menu, tab, form, button and hover state must function: header anchors scroll (through Lenis)
to the right section ids (`#agentic #logos #accelerator #supersize #demo #features #cta #integrations
#story #join #footer` — align content.ts hrefs and section ids), mega menus open/close with mouse and
keyboard, the mobile menu opens/closes and locks scroll, tabs switch and auto-advance, both forms validate
and show their success states, the waitlist form accepts an email, no console errors or React warnings at
any viewport, and the page never scrolls horizontally.
