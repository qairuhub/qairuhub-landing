# ⚠️ MANDATORY CHECKLIST (v2.1 user requests 2026-09-14, updated for v3 on 2026-09-15). Every reviewer must report each unmet item as a HIGH finding against the named file; every builder/fixer touching these files must implement them

1. **Wordmark text is lowercase `qairuhub`**: the 3D glass lettering AND the DOM wordmark (header/footer) render `brand.wordmark` from `src/i18n/shared.ts` (= `qairuhub`, Latin in both locales), never `brand.name`. (`src/sections/sky/GlassWordmark.tsx`, `src/components/ui/Wordmark.tsx`)
2. **Legible wordmark font: Courgette** (`/fonts/Courgette-Regular.ttf`, fallback `/fonts/DancingScript-Variable.ttf`), for the 3D typeface source in `GlassWordmark.tsx` and for `--font-script: "Courgette", "Dancing Script", cursive` in `src/styles/global.css`. The TTF is preloaded on home only (`fonts.preload.json` `home`); sub-pages never fetch it. Header wordmark ≈ 28px. The thin Mr Dafoe / Sacramento faces are not legible enough.
3. **v3 thinner, smaller 3D wordmark** (DECISIONS §9): the hero run spans 0.60 × the visible width at its start depth (0.66 on ≤ 768 px), the footer run 0.42 × (0.70 on mobile). It must never touch the header buttons. Extrusion 0.08 × size, rounded bevel pulled inside the outline (net stroke ≈ 0.09 × size), readable letters through the full turn. Exact numbers: "v3 constants" below. (`GlassWordmark.tsx`)
4. **360° rotation on scroll**: hero `rotation.y = (1 − journey.wordmarkHero) × 2π`, footer `rotation.y = (1 − journey.wordmarkFooter) × 2π`; mouse parallax (hero ±0.06 / ±0.03, footer ±0.03 / ±0.03) and the slow float on top. **v3:** while the hero run turns and rises it also **recedes into depth** (z 0 → −5) and visibly shrinks before it leaves the frame by 1.4 vh. Reduced motion: no rotation, float, parallax or recede. (`GlassWordmark.tsx`)
5. **Lower scroll sensitivity**: Lenis `wheelMultiplier: 0.65`, `touchMultiplier: 1.3`, `lerp: 0.09`; keyboard/anchor scrolling unchanged. (`src/lib/SmoothScroll.tsx`)
6. **Sub-pages have no journey** (v3): `/members` and `/handbook` freeze the sky on the `night` preset, 404 on `space`, with no wordmark, no field and no Courgette request. (`SkyScene.tsx`, `journey.ts` `setStaticJourney`)
7. Everything else in this document still applies (space start, frosted glass, readability, performance, "everything works").

# v3 constants (source of truth: the code; this table mirrors it)

Read from `src/sections/sky/journey.ts`, `src/sections/sky/GlassWordmark.tsx`, `src/components/three/GlassText.tsx` and `src/sections/sky/quality.ts` on 2026-09-15 (WP1 landed). When a number changes in code, change it here in the same commit. The v2 narrative sections further down keep their rationale; where their numbers differ from this table, **this table wins**.

## Hero wordmark geometry and motion (`GlassWordmark.tsx`)

| Constant | v2 | v3 (in code) | Notes |
|---|---|---|---|
| `BEVEL` | `{ thickness .04, size .04, segments 5 }` | `{ thickness 0.025, size 0.02, offset −0.03, segments 5 }` | `offset` pulls the rounded profile inside the outline; it is part of GlassText's geometry cache key |
| net stroke | ≈ 0.19 × size | ≈ 0.09 × size (−53 %) | Courgette median stroke ≈ 0.11 × size + 2 × (size + offset) |
| fallback bevel (not active) | — | `{ thickness 0.022, size 0.012, offset 0, segments 4 }` with `HEIGHT` 0.06 | only if the run reads bold or shows artefacts again |
| `HEIGHT` (extrusion) | `GLASS_HEIGHT` 0.14 | **0.08** | passed to both `getGlassGeometry` and `<GlassText height>` |
| `CURVE_SEGMENTS` | 8 | 8 | |
| geometry builder | three `TextGeometry` | `components/three/extrudeGlyphs.ts` | clamps inset bevels so thin Courgette exit strokes collapse to a hairline instead of folding |
| `HERO.z` | 0 | 0 | start depth |
| `HERO.fit` / `fitMobile` | 0.70 / 0.78 | **0.60 / 0.66** | share of the visible width at the start depth; mobile = viewport ≤ 768 px |
| fit distance | live `dist` | **fixed `baseDist = cam.z − HERO.z`** (camera z 10, fov 40) | so receding shrinks the run instead of the fit re-growing it |
| `HERO.exitDepth` | — | **5** | world units toward −z (the mid cloud deck sits at z −6) |
| `HERO.recedeFrom` | — | 0.05 | `recede = smoothstep(0.05, 1, 1 − wordmarkHero)`; `z = HERO.z − recede × exitDepth` |
| `HERO.exitScale` | 0.9 | **1** | the perspective does the shrink (10 / 15 ≈ 0.67 apparent size at full recede) |
| `HERO.exitLift` | 6 | 6 × `dist / baseDist` | exit timing holds while the run recedes |
| `HERO.floatAmp` / `floatPeriod` | 0.12 / 6 s | 0.12 / 6 s | |
| `HERO.rotY` / `rotX` / `rotLerp` | 0.06 / 0.03 / 0.05 | same | mouse parallax |
| spin | `(1 − wh) · 2π` | same | one full turn by `HERO_EXIT_VH` |
| `aboveFrame()` | uses `dist` | uses the receding `dist`, nearest yawed point, 1.15 × half height | skips draw + transmission once the run is above the frame |
| `PRESENCE_MIN` | 0.005 | 0.005 | below it: `mesh.visible = material.visible = false` |

## Footer wordmark (`GlassWordmark.tsx`)

Shares the thinner geometry (same cache key). `FOOTER = { z 0.5, fit 0.42, fitMobile 0.70, yStart 4.5 → yEnd 1.15, floatAmp 0.08, floatPeriod 7 s, yawAmp 0.03, yawPeriod 11 s, rotY 0.03, rotX 0.03 }`; spin `(1 − wf) · 2π`.

## Glass material (the drift fix)

The v2 prose below ("Frosted glass wordmark") described an earlier `transmission 0.62` + sheen recipe. The code moved on; these are the values that ship.

**`GLASS_MATERIAL`** (`GlassText.tsx`, frosted mode, high + medium tiers): `transmission 1`, `roughness 0.42`, `thickness 0.6`, `ior 1.4`, `color #f3f7ff`, `attenuationColor #dbe6ff`, `attenuationDistance 2`, `chromaticAberration 0.02`, `anisotropicBlur 0.35`, `distortion 0`, `distortionScale 0.5`, `temporalDistortion 0`, `samples 6`, `resolution 512`, `backside false`, `clearcoat 1`, `clearcoatRoughness 0.15`, `envMapIntensity 1.2`, `emissive #9db4ff` @ `0.08`, `toneMapped true`. **No sheen** (its velvet edge term read as plastic; the rims are specular).

**Wordmark overrides** (`GlassWordmark.tsx`, merged over `GLASS_MATERIAL`):

| Prop | Base | Wordmark v3 | Why |
|---|---|---|---|
| `thickness` | 0.6 | **0.3** | a 0.09 × size tube stays milky and bright |
| `attenuationDistance` | 2 | **3** | same |
| `resolution` / `samples` | 512 / 6 | `QUALITY[tier].glassResolution` / `glassSamples`: high 512 / 6, medium 384 / 3 | |
| `chromaticAberration` | 0.02 | 0.02 on high, **0** on medium | > 0 triples the bicubic taps; invisible under the roughness blur |
| `backsideResolution` | drei default | **32** | the unused backside pass would otherwise allocate a full FBO |

**Why `transmission 1` works over black space:** `GLASS_BACKLIGHT = { top #9db4ff, bottom #1b3a8a, strength 1 }` is a fullscreen additive gradient drawn only inside drei's transmission pass (render order −9, toggled visible by a priority −1 `useFrame`, hidden again in `onAfterRender`), so the strokes always refract something lit while the main render never sees it.

**`GLASS_PHYSICAL`** (low tier, no transmission): `transparent`, `opacity 0.9`, `color #eef3ff`, `roughness 0.5`, `metalness 0`, `clearcoat 1`, `clearcoatRoughness 0.15`, `sheen 0.4` (white, `sheenRoughness 0.6`), `envMapIntensity 1.3`, `emissive #9db4ff` @ `0.12`.

## Journey keyframes (`journey.ts`)

All in viewport heights; `end` = (document height − viewport) / viewport, min 4. Every weight is smoothstep-eased.

| Weight | v2 | v3 (in code) |
|---|---|---|
| `space` | `1 − ss(0.9, 1.7)` | `1 − ss(0.85, 1.6)` |
| `descent` | in 0.9 → 1.4, out 1.9 → 2.4 | `ss(0.85, 1.3) × (1 − ss(1.8, 2.3))` |
| `whiteout` | bell 1.15 → 1.6 → 2.1, peak 1 | **`0.6 × ss(1.0, 1.3) × (1 − ss(1.3, 1.55))`**: peak 0.6 at 1.3 vh, gone by 1.55 (the plan's 0.8 × with a 1.75 tail left white copy at ≈ 3.4 : 1; 0.6 keeps 1.2 / 1.5 / 1.8 vh at ≥ 4.7 : 1) |
| `day` | in 1.7 → 2.3 | `ss(1.55, 2.1) × (1 − ss(duskStart, duskStart + 0.9))` |
| `dusk` | — | `ss(duskStart, duskStart + 0.7) × (1 − ss(duskEnd − 0.3, duskEnd + 0.5))` |
| `night` | — | `ss(duskEnd − 0.5, end − 0.4)` — the last, ground-level phase |
| `sunset` | — | `ss(duskEnd − 1.0, end − 0.55)` on home, **0** on a sub-page's static sky: it is what turns that last phase into the golden hour (docs/GOLDEN-HOUR-BRIEF.md). It deliberately LEADS `night` by about half a viewport — the warmth is in the sky before the ground arrives — because on the same curve the two crossfades dipped through a flat violet frame ≈ 1 vh before the end, exactly where the Join form is read |
| `ground` | — | `ss(end − 1.5, end − 0.05)` |
| `stars` | out 1.2 → 1.8 | `min(1, 1 − ss(1.15, 1.7) + ss(duskStart + 0.3, duskEnd + 0.2))` |
| `clouds` | in 0.9 → 1.6 | `ss(0.85, 1.5) × (1 − 0.6 × night)` |
| `pal.t0` / `t1` | 0.9 → 1.5 / 1.5 → 2.2 | `ss(0.85, 1.4)` / `ss(1.4, 2.05)` |
| `pal.t2` / `t3` | — | `ss(duskStart, duskStart + 0.9)` / `ss(duskEnd − 0.4, duskEnd + 0.5)` |
| `wordmarkHero` | `1 − ss(0, 1.4)` | `heroWordmarkWeight(y) = 1 − ss(0, HERO_EXIT_VH)`, `HERO_EXIT_VH = 1.4` (exported) |
| `wordmarkFooter` | `ss(end − 1.4, end − 0.3)` | `footerWordmarkWeight(y, end)`, same curve (exported) |

with `duskStart = end − 2.5`, `duskEnd = end − 1.2`.

**Palette** (`PALETTE`): space `#03040c / #050818 / #070c24`; descent `#071a4a / #0b3f9a / #1670c8` (v3: bottom darkened from `#1a7be0`, ≈ 5 : 1 for white copy, because the Launchpad is read through the descent); day `#082a64 / #0a48a6 / #1875d0`; dusk `#0d2a66 / #1b4390 / #4d3d74`, glow `#c4735c` (v3.2: the approach into the sunset rather than into night — warmer mid, deeper violet foot, coral glow); **afterglow `#05183f / #8a3a64 / #74495f`** (v3.2); night `#061a3d / #08234d / #0b2c5c`, kept for the sub-pages' static sky.

The afterglow stops are not read literally off the frame, and both departures are load-bearing:

- **`mid` is a warm rose, and the dome pins the mid stop just above the hot band** (`midStopFor`). The
  ladder cobalt → violet → rose above the band is therefore the dome's own two-stop gradient, which
  every phase pays for anyway, and the shader only paints the last stretch into coral and gold.
  The halo used to reach 0.43 of a frame up to do that in the fragment; that was the single most
  expensive thing in the ending (≈ +1.3 ms at the footer). It now reaches 0.28 and the frame costs
  +0.76 ms.
- **`bottom` is lighter and more saturated than the band under the sunset actually reads.** Below
  the hot line the shader MULTIPLIES the sky by `LOW_WARM` → `LOW_COOL` rather than mixing toward a
  dark stop, so `#74495f` has to survive being taken down to ≈ `#311931`. Mixing toward an
  already-dark stop is what made that band a flat dead violet; multiplying a live colour keeps its
  hue, and it is the difference between "land in shadow" and "empty".

`blendPalette`'s last lerp (`t3`) lands on **afterglow** during the home journey and on **night** for `setStaticJourney('night')` — one swappable end stop, so /members and /handbook keep exactly the moonlit sky they have today (and `fallback.ts`'s `NIGHT_FALLBACK_GRADIENT` keeps matching it).

### Why the sub-pages stayed night (v3.2 decision)

The brief asked for this to be decided deliberately rather than inherited, and the honest answer is
that the two pages are different problems:

- **Home ends with a picture.** Its last screens are a field, a silhouette and a footer four rows
  tall at most. A hot horizon is safe there because the land is in front of it and the band is
  placed above the copy by construction (`horizonFor`).
- **`/members` and `/handbook` end with text.** They are read top to bottom on the raw sky, with no
  field and no silhouette to hide a bright horizon behind, and they have no scroll story to move a
  band through. A golden sky on those pages would be a wash behind body copy — exactly the failure
  mode the brief's first rule exists to prevent.

The cost of keeping both is one uniform-controlled branch in `domeFragment` and one extra palette
stop. It is not free, so it is written down here rather than left to be rediscovered:

- `journey.sunset` is **0** on a sub-page and **non-zero whenever `night` is** on home. The moon
  branch is therefore `uNight > 0.002 && uSunset < 0.002` — uniform-controlled, never taken on home,
  and never half-mixed. (The first cut gated it on `uSunset < 0.998`, which drew the moon at 25 %
  through the middle of the home crossfade.)
- `PALETTE.night` and `NIGHT_FALLBACK_GRADIENT` are untouched, so the CSS placeholder on those pages
  is still byte-exact against the dome.
- If a later change makes the sub-pages an evening rather than a night, the moon branch and the
  `night` stop go with it, and `fallback.ts` follows automatically — it is derived from `PALETTE`.

**Page height.** v3 desktop `end` is planned at ≈ 18.2 vh (plan estimate, v2 14.7; re-measure with `perf.mjs`, which reads every section top from the DOM): Ask bar, Platform CTA row, Projects, News and the 6 × lvh storytelling runway add height; the compact form removes some. Top-anchored phases use absolute vh; bottom-anchored phases use `end − k`, so `#join` reads in dusk → afterglow and the triptych's MEET frame lands at dusk start.

### Where the hot band goes (`horizonFor`, v3.2)

Nothing in the ending is positioned by a per-viewport constant. `skyShaders.horizonFor(aspect,
viewportHeight)` takes the smaller (higher on screen) of two **measured** terms and clamps it to
[0.30, 0.62] of the frame:

1. **the field's own visible skyline**, `field/terrain.skylineScreenY(aspect)` — a scan of
   `hillHeight` over the (x, z) this viewport can actually see, grass fringe included — minus 0.03,
   so the strongest saturation sits just above the ridge rather than on it;
2. **the top of the footer's content block**, `sky/copyBox.copyTopFraction(viewportHeight)`, which
   `Footer.tsx` publishes through a ResizeObserver — minus a 0.10 clearance.

The first wins on a laptop and the second on a phone, and the reason is not obvious: the camera's
fov is vertical, so a narrow frame does not see less sky, it sees less *width* — and the ridges live
at x ≈ ±6.5 and ±7. A laptop (aspect 1.60) sees them and its skyline is a crest at **0.561**; a phone
(aspect 0.46) sees only the valley floor between them and its skyline falls to **0.707**, a seventh
of the frame lower, while its footer is four rows tall and reaches to 0.60. Measured, not reasoned
about: a tablet portrait, an ultrawide, a fourth footer row or a longer Kazakh string all land
somewhere that was solved rather than interpolated.

The same two functions give `Field.tsx` the colour the far terrain fades onto, and `skyShaders.BAND`
/ `bandMix` give it the band's strength there — so the sky and the terrain cannot silently disagree
about where the skyline is or what colour it is.

The footer's CSS scrim is tied to the same box: `--footer-scrim-lead` equals the sky's own clearance,
and the scrim's insets are `calc(-1 * var(--footer-scrim-lead))` and the row margin, so the scrim
always covers the block whatever the block turns out to be.

## Static sky for sub-pages (`setStaticJourney`)

| Preset | Used by | Values |
|---|---|---|
| `night` | `/members`, `/handbook` (+ KK) | `vh 4`, `end 4`, `night 1`, **`sunset 0`**, `stars 1`, `clouds 0.3`, `ground 0`, `space 0`, both wordmark weights 0, `pal.t0..t3 = 1` **onto the night stop** |
| `space` | 404 | `vh 0`, `end 4`, `space 1`, `stars 1`, `clouds 0`, everything else 0 |

SkyScene calls it once and never `updateJourney`; it does not mount `GlassWordmark` or `Field` and does not call `preloadGlassWordmark()`. `time` still advances for twinkle and drift.

## Quality tiers (`quality.ts`, unchanged in v3)

| Tier | stars | cloud sprites | cloud texture | blades | transmission | glass res / samples | DPR cap < 1280 px / ≥ 1280 px |
|---|---|---|---|---|---|---|---|
| high | 1800 | 26 | 512 | 14000 | on | 512 / 6 | 1.5 / 1.25 |
| medium | 900 | 20 | 512 | 6000 | on | 384 / 3 | 1.5 / 1.0 |
| low | 500 | 14 | 256 | 3000 | off (`GLASS_PHYSICAL`) | 256 / 2 | 1.25 / 1.25 |

## v3 acceptance (WP1, checked with `scripts/shots.mjs` / `scripts/perf.mjs`)

- Hero stroke at the "h" stem at y = 0 ≤ 55 % of v2 in a same-viewport screenshot.
- No self-intersection artefacts at y = 0.2, 0.5, 0.8, 1.1 vh through the full turn.
- The run's apparent size falls ≈ 30 % before exit; it leaves the frame top by y ≤ 1.4 vh, and the header DOM logo appears after it.
- Launchpad title, Ask bar and chips ≥ 4.5 : 1 at y = 1.2, 1.5, 1.8 vh.
- `/members` and `/handbook` request no `Courgette-Regular.ttf` and show a steady night sky.
- FPS (§5 of the build plan, headed, Intel UHD, medium tier): hero ≥ 55, mid-page (`#offer`, `#projects`, `#news`) ≥ 60, footer ≥ 52.

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
**dusk**, and you land on a grass field at the **golden hour** — a small low sun sits in the notch
between the ridges with a soft bloom, the sky runs cobalt → violet → rose → coral → gold down to
the skyline with a far cloud deck lit along its underside, the land is a cool silhouette with warm
rims on the crests, and the first stars are out high above. The wordmark comes back down, hovers
over the valley and picks up the warm light. Starts under the stars, ends under the first of them.

## One canvas, one render loop

- ONE fixed full-viewport `<Canvas>` (SkyScene) renders everything: sky, stars, nebula haze,
  clouds, the glass wordmark, and the footer grass field. The old separate footer canvas is
  removed; `Footer.tsx` becomes a 150vh DOM spacer with the link row pinned at the bottom.
- The camera never moves through geometry; instead a scroll-driven "altitude" uniform/value
  `alt ∈ [0,1]` (0 = space at the top of the page, 1 = ground at the very bottom) drives every
  layer. `alt` is derived from `scrollState.y` with these keyframes (in viewport heights, vh):

> **v2 table.** The phase order and intent still hold; the v3 boundaries, the softer whiteout (peak 0.6
> at 1.3 vh) and the palette values are in "v3 constants: Journey keyframes" at the top of this file.

| scroll (vh) | phase | sky top → bottom | stars | clouds | wordmark |
|---|---|---|---|---|---|
| 0 – 0.9 | SPACE | `#03040c` → `#070c24`, faint violet/blue nebula haze, thin blue atmosphere limb glowing along the bottom edge | full, twinkling, slight parallax | none | centered, huge, refracting the stars; mouse parallax; slow float |
| 0.9 – 2.2 | DESCENT | lerp to `#0c2d6e` → `#0d59c2` → `#2ea3ff` | fade out by 1.8vh | rise in from below (near layer first) and pass upward past the camera; a soft white "whiteout" flash peaks at ~1.6vh (opacity ≤ .35) as we punch through the cloud deck | drifts up and out of frame by 1.4vh, then unmounts |
| 2.2 – (end − 2.5) | SKY | day gradient (reference), subtle darkening with depth | none | big soft cumulus, 3 depth layers, slow drift + scroll parallax; sparser than the hero deck | unmounted |
| (end − 2.5) – (end − 1.2) | DUSK | `#0d2a66` → `#1b4390` → violet foot `#4d3d74` with a coral wash low — the approach into the sunset | fade in | thin, darker undersides | — |
| (end − 1.2) – end | AFTERGLOW + FIELD | `#05183f` → `#8a3a64` → `#74495f`, plus a coral-into-gold band on the skyline, a small low sun with a soft bloom in the valley notch, and a three-bar far cloud deck lit along its bottom edge | only the first, high up | few, amber-lit from below | re-mounts above the valley, descends into place (y from +6 → 3.2), floats |
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
- Golden hour (v3.2, home): a **small, low sun** with a soft bloom sitting in the notch between the ridges, a
  coral-into-gold band hugging the skyline with the strongest saturation just above it, a far cloud deck of three
  flattened bars lit along their bottom edges and dark on top, and a warm plume hanging under the sun's own column
  so the gap between the band and the land is not empty. The land is a deep cool silhouette with warm rims that are
  gated **per blade** (by how squarely it faces the sun and by its own baked tint) so the lit crests sparkle rather
  than band. Below the hot line the sky is multiplied down, never mixed to a flat stop. The sub-pages keep the moon
  glow (soft radial off-centre, stars a touch warmer, hills lit from the moon side).
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

### Measured at the golden-hour ending (v3.2)

Method: `<scratch>/golden/work/sweep.mjs` hides the measured copy, forces one more canvas frame,
screenshots the plate and samples the **real pixels** behind each text box, every 0.2 vh over the
last 3.2 vh, at 1440×900 and 390×844, EN and KK. `shots.mjs` does the same at the end stop and adds
768×1024, 390×844 at dpr 2, 2560×1080 and 1024×768, plus all three quality tiers.

Everything the ending owns passes with room: footer links **13.8–16.6 : 1**, the quiet row
**8.6–9.9 : 1**, copyright / tagline / language switch **9.9–10.5 : 1**, and the same numbers hold at
dpr 2, at tablet portrait and on an ultrawide.

**The sky carries it, not the scrim.** With the footer's CSS scrim forced to `display: none`, every
row still clears 4.5 : 1 against the raw sky at every viewport (worst 6.0 : 1, 768 KK). The one thing
the scrim does carry is *land*: lit blade tips crossing the quiet link row at tablet portrait, which
measured 4.33 : 1 at scrim 0.28 and 4.61 : 1 at 0.32 (and **1.70 : 1** on the moonlit-night baseline
at the same viewport). That is why the portrait scrim is 0.32 and the desktop one 0.22 — comfort and
foreground, not survival.

### Known pre-existing shortfalls (a separate ticket — NOT the ending's)

These fail against the **untouched day/dusk palette**, were failing before the golden hour, and the
golden hour improves them. They are logged here rather than patched over by restyling the type,
which is what the first attempt did (it raised two `DemoForm.css` alphas; that was reverted):

| where | baseline | golden hour | needs |
|---|---|---|---|
| `#join` 12px note (`.join__signup-note`, `rgba(--fg, .75)`), 1440 + 390, EN + KK, ~end−0.8 to end−2.2 vh | 3.49–3.71 : 1 | 4.05–4.41 : 1 | 4.5 : 1 |
| News / Projects date chips (mid-page, day sky) | 2.7–3.4 : 1 | unchanged | 4.5 : 1 |

Both live on the day sky's foot, not on the sunset. Fixing them means either the day palette or the
type, and either is its own change with its own measurement.

## Frosted glass wordmark (v2 requirement)

The wordmark is **matte / frosted glass, not clear glass**: milky, softly translucent, light scatters
inside it, edges catch a rim highlight; the letters read as bright, legible shapes on space and on the
night sky (never a dark silhouette). Implementation guidance:

- **The recipe lives in `GLASS_MATERIAL` / `GLASS_PHYSICAL` (`src/components/three/GlassText.tsx`)**;
  `GlassWordmark.tsx` layers the tier's `resolution` / `samples`, the chromatic fringe and the v3 thin-tube
  overrides (`thickness 0.3`, `attenuationDistance 3`) on top.
- **Drift note (v3):** the high/medium paragraph below is the v2.1 history (`transmission 0.62` + sheen).
  The shipped recipe is `transmission 1` + the `GLASS_BACKLIGHT` gradient inside the transmission pass,
  `roughness 0.42`, `thickness 0.6`, `attenuationDistance 2`, `clearcoatRoughness 0.15`,
  `envMapIntensity 1.2`, no sheen: see "v3 constants: Glass material" at the top of this file, which wins.
  The low-tier paragraph still matches the code.
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
to the right section ids (v3: `#top #launchpad #ecosystem #accelerator #supersize #platform #offer #projects
#news #cta #tools #story #join #footer`, from `sectionIds` in `src/i18n/shared.ts`; anchors carry the locale
base, `/#offer` or `/kk/#offer`), mega menus open/close with mouse and
keyboard, the mobile menu opens/closes and locks scroll, tabs switch and auto-advance, both forms validate
and show their success states, the waitlist form accepts an email, no console errors or React warnings at
any viewport, and the page never scrolls horizontally.
