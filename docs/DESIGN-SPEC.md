# Design spec — "Air" style reference, applied to QairuHub

This is the ground truth for every section. It was derived from the Refero "Air" style page
(tokens, components, do/don't) and from a live inspection of the reference landing at 1440×900
(computed styles, DOM structure, CSS keyframes/transitions, screenshots at every 900px).

## 1. Atmosphere

The backdrop is specified in **`docs/JOURNEY-SPEC.md`** — that document owns the phases, the
palette, the performance budget, the readability rules and the frosted-glass wordmark. This section
is the one-paragraph summary every section author needs; when the two disagree, JOURNEY-SPEC wins.

- The whole page sits on ONE fixed, full-viewport WebGL canvas (`src/sections/SkyScene.tsx`,
  `React.lazy` behind a CSS gradient in the same colour). It renders everything — sky dome, stars,
  cloud sprites, the **frosted-glass 3D cursive wordmark** and the night grass field — from a single
  render loop driven by the scroll-linked `journey` state (`src/sections/sky/journey.ts`). There is
  no second canvas anywhere; sections have transparent backgrounds so the journey shows through.
- The page is one continuous descent. It **starts in space**: near-black (`#03040c` → `#070c24`),
  twinkling stars, a faint nebula haze, the glass wordmark floating in front of you. On scroll you
  fall through the atmosphere — the black turns deep blue, the stars dissolve, a soft whiteout as you
  punch through the cloud deck — and arrive in the bright **day sky** where the whole product story
  lives. The day dome is the reference blue, kept deep for legibility (`#082a64` → `#0a48a6` →
  `#1875d0`; the raw reference gradient `#0c2d6e` → `#0d59c2` → `#2ea3ff` is the source it was
  sampled from, its lower third darkened so white 16px text keeps ≥ 4.5:1 on clear sky).
- Clouds are baked cumulus sprites, never noise: soft edges, bright tops, slightly blue-grey
  bottoms, three depth layers with scroll parallax and a very slow drift. In the day phase they cover
  ≤ 30 % of the viewport and stay out of the central reading column (JOURNEY-SPEC "Readability").
- Towards the end the light drains into **dusk, then night**: the stars return, a moon glow appears
  and a rolling moonlit **grass field** rises from the bottom edge — blades swaying in wind, a few
  flowers and mushrooms, fog — with the glass wordmark descending to hover above the valley. The
  footer (§4.13) is only a DOM spacer laid over this last stretch of the same canvas.

## 2. Tokens

Colors: Whiteout `#ffffff` (text on dark, borders), Haze `#f5f5f5` (cards/inputs on dark),
Ink `#1b1b1b` (text on light), Black Void `#000`, Twilight Blue `#426188` (heading accent on dark,
rare), Signal Blue `#2b7fff` (links only). Translucent whites: `rgba(255,255,255,.1)` fills,
`.3` borders, `.6` secondary text.

Type (substitutes for the proprietary Control family):
| role | font | size / line-height | weight | notes |
|---|---|---|---|---|
| u-h1 (display) | Anton | 259px / 0.85 (clamp 84–259) | 400 | UPPERCASE, bleeds viewport edges |
| u-h1-small | Anton | 200px / 0.85 | 400 | storytelling headlines |
| u-h2-large | Inter | 56 / 1 | 400 | section hero titles |
| u-h2 | Inter | 40 / 1 | 400 | card titles (agentic cards), waitlist title |
| u-h3 | Inter | 32 / 1.1 | 500 | features title, CTA card title |
| u-h4 | Inter | 20 / 1.5 | 500 | logo-bar / integrations titles |
| u-h5 | Inter | 20 / 1.4 | 500 | feature card titles, CTA subtitle |
| body | Inter | 16 / 1.5 | 500 | everything else, nav, footer links |
| u-body-2 | Inter | 14 / 1.5 | 500 | button labels |
| u-body-3 | Inter | 12 / 1.5 | 500 | tab labels, legal, copyright |
| cursive accent | Caveat italic | 1.18em of parent | 600 | ONE word per headline (`<i>`) |
| wordmark | Courgette (fallback Dancing Script) | 28px header/footer; 3D per JOURNEY-SPEC | 400 | lowercase `brand.wordmark` (`qairuhub`), same face for the DOM mark and the 3D glass sculpture (`/fonts/Courgette-Regular.ttf`) |

Layout: 12 columns, 24px gutter, content 1150px, hero/page 1600px, side padding 24px (16 mobile),
header 72px. Section padding 120px top/bottom (60 mobile); gap between blocks 48px (small 24,
large 120). Radii: inputs 4, buttons 8, images 11, cards 12, pills 9999. No shadows. No UI gradients
(only the sky and the CTA card's blurred orbs).

Easing: everything uses `cubic-bezier(0.22, 1, 0.36, 1)` (`var(--ease)`).

## 3. Components (implemented in `src/components/ui` + `global.css`)

- **Button** `.btn--primary` white fill/black label, hover: fill fades + a skewed radial highlight
  rotates 180° and scales ×3 away, label scales 1.05 and turns white (ghost remains). `.btn--secondary`
  ghost; hover: radial fill rotates in, label → black. `.btn--white` haze gradient. `.btn--tertiary`
  text with underline that scales in from the left (nav "Login"). 38px tall, radius 8, 0 16 padding.
- **Reveal**: `opacity:0; translate:0 20px` → visible, 1000ms, 150ms stagger per sibling, fires once
  at ~15% visibility. Apply to headings, paragraphs, CTAs, cards, rows.
- **Section**, **Grid/Col**, **SectionText** (centered 8-col title/body/CTAs block).
- **Pill**: 40px rounded-full, white/10 fill (tag "Coming soon"; typewriter pill).
- **AnimatedBorder**: 1px card stroke with a bright segment travelling around (feature cards, CTA card).
- **AutoCarousel**: seamless linear marquee, 80px gap, edge mask, pauses offscreen.
- **Inputs** `.input-air`: haze bg, 1px rgba(0,0,0,.1), radius 4, 48px, padding 10; `--ghost` variant
  for dark sections.
- **Mega menu** (header): white panel, radius 12, backdrop blur, `opacity 0 / scale .96 / translate -10px`
  → open in 350ms; list items 56px haze icon square + title 16 + description 13 @ 50%, each item
  fades/slides in with an 80ms stagger; right-hand haze CTA card (padding 24, radius 8).

## 4. Page structure (top → bottom) and motion

1. **Header** (fixed, 72px, transparent, z-100). Left: nav labels 16px/500 with chevrons on
   dropdown items (gap 32). Center: cursive wordmark (Courgette, 28px), `opacity 0` while the 3D
   glass lettering is on screen — hidden during the hero run, fading in as `journey.wordmarkHero`
   drops (≈ 1.4vh), hiding again as `journey.wordmarkFooter` rises — so the two never coexist. Right: "Members" (tertiary) · "Join QairuHub" (primary white)
   · "Partner with us" (secondary ghost). Mobile ≤768: primary button + hamburger; menu is a white
   panel dropping from the top (radius 12 bottom corners, 350ms).
2. **Hero** (100vh + 80px). No text — only the frosted-glass 3D wordmark floating in **space**
   (≈ 0.70 × the visible width, never touching the header buttons), stars refracting through the
   letters, slow float, subtle mouse parallax; on scroll it turns one full 360° and drifts up out of
   frame as the descent begins (`journey.wordmarkHero`). sr-only `<h1>`.
3. **Agentic cards** (`u-h2-large` title, 16px subtitle, primary CTA, all revealed with stagger).
   Below: a **typewriter pill** (48px, rounded-full, white/10, sparkle icon) that types prompts one
   after another (width animates 800ms ease-out, blinking caret), and **three cards** (4 cols each,
   radius 12, 1px white/10 border, square media area on top, `p-5` text: title 40px/400 (u-h2),
   body 16 white/60). The card matching the current prompt is active (`opacity 1`, border white/30);
   the others sit at `opacity .4`. Cards cross-fade every ~3.5s in sync with the typing.
4. **Logos** (small spacing): title u-h4 centered; two marquee rows of monochrome wordmarks
   (80px tall items, 80px gap, edge mask), second row reversed/slower.
5. **Waitlist** (Accelerator): Pill "Spring 2027" · title u-h2 two lines, second line cursive ·
   body · row [ghost input 48px ~370px wide + primary "Notify me"] · then a large media card
   (~8–10 cols, radius 20, light haze/grey glass surface) that carries a caption in u-h2-large
   ("Qairu Accelerator can turn your MVP into a company.") and a small animated step row
   (Idea → MVP → Demo Day → Astana Hub) — a stand-in for the reference's product video.
6. **Supersize text**: `u-h1` uppercase, left-aligned, bleeding the viewport, 3–4 lines
   ("BUILDERS OVER TALKERS. SHIP EVERY SEMESTER."). Scroll-linked reveal: each line's opacity/fill
   progresses from 0.15 → 1 as it crosses the middle of the viewport (like a wipe), lines slide
   up a few px. ~950px tall section.
7. **Product demo**: a light "app window" card (10 cols, radius 10, `#fff`, subtle inner UI mock:
   sidebar + header + content) that swaps content with a 500ms cross-fade; below it a **tab bar**
   (8 cols centered, 36px, `rgba(255,255,255,.1)` bg + backdrop blur, radius 10): three tabs
   12px/500 with icons, inactive at opacity .5, a white sliding indicator (radius 8, `--x/--width`,
   500ms ease) behind the active tab, and a 3px timer line at the bottom of the indicator that
   grows over 9s then auto-advances to the next tab. Click = manual select, resets timer.
8. **Features** (large spacing): title u-h3 with cursive "at scale." + body. Grid 7/5 · 5/7 ·
   4/4/4 of **AnimatedBorder cards** (radius 12, `rgba(255,255,255,.06)` fill + `backdrop-blur(4px)`,
   padding 32, title u-h5, body 16 @ 80%; the first four hold a media area at the bottom with
   radius 11 corners — build simple CSS/SVG mock visuals: schedule list, bar chart, link cards,
   timeline). Cards reveal with 200ms stagger.
9. **CTA card** (full width 12 cols, padding 40, radius 12, AnimatedBorder): left column
   cursive u-h3 title, u-h5 subtitle, 16px body (max ~500px); right: secondary button. Background:
   three huge blurred colour orbs (blue, green/yellow, pink) slowly rotating (`rotate 0→1turn`) and
   pulsing (`scale .5→1.5`) inside an `overflow:hidden` card — the ONLY colourful moment on the page.
10. **Integrations** (small spacing, header padding): title u-h4 with cursive "whole"; one marquee
    row of 80×80 wordmark tiles.
11. **Storytelling triptych**: sticky section, height = 100lvh × 4.5, `margin-top:-50vh`. Inner
    sticky 100lvh. Three stacked items (grid-row 1 / grid-column 1) — u-h1-small headline
    (LEARN / BUILD / LAUNCH) + centered 16px paragraph (8 cols). Scroll-driven: item i is fully
    visible in the middle third of its slice; while scrolling it moves up and fades out
    (`translate 0 → -120px`, opacity 1 → 0, scale 1 → .96) as the next one rises in from below
    (`translate 120px → 0`, opacity 0 → 1). Use `scrollState` in a rAF loop, not React state per frame.
12. **Form**: title u-h2-large two lines with cursive "ship." + body; white card (7 cols,
    radius 12, padding 40, `[data-theme=light]`): first/last name row, email, telegram, two selects,
    message, centered primary Submit (disabled until valid), 12px legal text @ 50% with underlined
    Signal Blue links. Submitting shows an in-card success state.
13. **Footer** (150vh, `align-items:flex-end`, `pointer-events:none` on the root): a **150vh DOM
    spacer over the night phase of the single SkyScene canvas** — it draws nothing itself. The
    moonlit field, the stars and the returning glass wordmark are all painted by the fixed canvas as
    `journey.night` / `journey.ground` / `journey.wordmarkFooter` rise over this last stretch of
    scroll. Content row pinned at the bottom (24px margin, pointer events re-enabled): left links
    16px (external ones with ↗), right social icon buttons 38×38 (ghost circles), and the 12px
    copyright at 75% opacity; all text carries the `.on-sky` glow because it sits on the raw night sky.

## 5. Do / Don't

Do: Inter 500 for all UI text · one cursive word per headline · 8px radius on all buttons ·
4px on inputs · haze surfaces on dark · white borders on dark · flat cards.
Don't: coloured filled buttons · shadows · more than one saturated accent · body text < 16px or
> 500 weight · pills outside toggles/tags · new radii · UI gradients · lorem ipsum.

## 6. Accessibility & performance

- `prefers-reduced-motion`: reveals appear instantly, marquees/strokes stop, Lenis smoothing off,
  3D scenes keep a static frame (no float/drift), typewriter shows full text.
- One canvas, one render loop, quality-tiered (`src/sections/sky/quality.ts`: `high` / `medium` /
  `low` scale stars, cloud sprites, grass blades, glass transmission). DPR = min(devicePixelRatio,
  tier cap): 1.5 on narrow viewports, 1.25 (`high`) or 1.0 (`medium`) on desktop ≥ 1280px. The
  frameloop pauses when the tab is hidden; the three.js chunk is `React.lazy` behind the space
  gradient so first paint never waits for it; the night field is only rendered once `journey.ground`
  starts rising. Full budget in JOURNEY-SPEC "Performance budget".
- All interactive elements keyboard reachable with a visible focus ring; icons `aria-hidden`.
