# Design spec — "Air" style reference, applied to QairuHub

This is the ground truth for every section. It was derived from the Refero "Air" style page
(tokens, components, do/don't) and from a live inspection of the reference landing at 1440×900
(computed styles, DOM structure, CSS keyframes/transitions, screenshots at every 900px).

**v3 (2026-09-15):** §4 is the v3 section list (ids, components, copy sources, sub-pages, Q). Where
this file and `docs/V3-DECISIONS.md` / `docs/V3-BUILD-PLAN.md` disagree, those win; the backdrop
numbers live in `docs/JOURNEY-SPEC.md` "v3 constants".

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
| display, Kazakh | Oswald 600 (Cyrillic subset inside the `"Anton"` family via `unicode-range`) | as u-h1 / u-h1-small | 600 | EN keeps Anton pixel-for-pixel; Kazakh display glyphs switch per range |
| cursive accent | Caveat italic | 1.18em of parent | 600 | ONE word per headline (`<i>`, rendered by `<Accent>` from a `*word*` marker); Caveat covers Kazakh |
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

## 4. Page structure (v3, top → bottom) and motion

Copy for every block below lives in `docs/CONTENT-V3.md` / `CONTENT-V3.kk.md` (section numbers in
the table) and in code in the section's `*.i18n.ts`; `docs/V3-DECISIONS.md` wins where they differ.
Component file names are kept from v2 (V3-BUILD-PLAN D5); the DOM ids are the v3 ones, listed in
`sectionIds` (`src/i18n/shared.ts`). Every headline carries at most one cursive `*accent*` word,
rendered by `<Accent>`.

| # | Section | DOM id | Component | i18n | Copy |
|---|---|---|---|---|---|
| — | Header (fixed) | — | `Header.tsx` | `header.i18n.ts` | §2 |
| 1 | Hero, 3D glass wordmark | `top` | `Hero.tsx` | `hero.i18n.ts` | §3 |
| 2 | Launchpad + Ask bar | `launchpad` | `AgenticCards.tsx` + `assistant/AskBar.tsx` | `launchpad.i18n.ts` | §4 |
| 3 | Ecosystem marquee | `ecosystem` | `Logos.tsx` | `ecosystem.i18n.ts` | §5 + DECISIONS §4 |
| 4 | QairuHub Accelerator waitlist | `accelerator` | `Waitlist.tsx` | `waitlist.i18n.ts` | §6 |
| 5 | Supersize line | `supersize` | `Supersize.tsx` | `supersize.i18n.ts` | §7 |
| 6 | Platform showcase, "This is the Hub" | `platform` | `ProductDemo.tsx` | `platform.i18n.ts` | §8 |
| 7 | What we offer | `offer` | `Features.tsx` | `offer.i18n.ts` | §9 |
| 8 | Highlighted projects | `projects` | `Projects.tsx` | `projects.i18n.ts` | §10 + DECISIONS §1 |
| 9 | Latest news | `news` | `News.tsx` | `news.i18n.ts` | §11 + DECISIONS §3 |
| 10 | CTA card | `cta` | `ModelsCTA.tsx` | `cta.i18n.ts` | §12 |
| 11 | Tools row | `tools` | `Integrations.tsx` | `tools.i18n.ts` | §13 + DECISIONS §4 |
| 12 | Storytelling LEARN · BUILD · LAUNCH · MEET | `story` | `Storytelling.tsx` | `story.i18n.ts` | §14 |
| 13 | Compact join form | `join` | `DemoForm.tsx` | `form.i18n.ts` | §15 |
| — | Footer | `footer` | `Footer.tsx` | `footer.i18n.ts` | §16 |
| — | Q launcher (every page) | — | `assistant/AssistantLauncher.tsx` | `assistant.i18n.ts` | §19 |

Sub-pages (`src/pages/`, lazy chunks, static sky, compact footer): `/members` (§17),
`/handbook` (§18), 404 (§20). Details at the end of this section.

1. **Header** (fixed, 72px, transparent, z-100). Left: nav labels 16px/500: Programs (mega),
   Platform (mega), Projects, News, About (mega), with chevrons on the mega items (gap 32).
   Center: cursive wordmark (Courgette, 28px), `opacity 0` while the 3D glass lettering is on screen:
   hidden during the hero run, fading in as `heroWordmarkWeight` drops (gone by `HERO_EXIT_VH` 1.4),
   hiding again as `footerWordmarkWeight` rises, so the two never coexist. Both curves are imported
   from `sky/journey.ts`; on sub-pages the logo is always shown and links to `route.base`.
   Right: the segmented **EN | ҚАЗ** switcher (two `<a hreflang lang>`, `aria-current` on the active
   one, keeps the hash) · "Members" (tertiary) · "Open platform" (primary white, external, small ↗).
   Mega menus: white panel as in §3, each with a right-hand CTA card (Programs: the next dated news
   item; Platform: "This is the Hub"; About: "Ask Q", which also opens the assistant).
   Mobile ≤ 768: primary button + hamburger; the drop-down panel lists every item, "Join" and the
   switcher. The nav must not overflow at 769 / 860 / 1024 / 1100 px in KK (the longer locale) or EN.
2. **Hero** (100vh + 80px, `#top`). No text, sr-only `<h1>` (`hero.srTitle`). The frosted-glass
   `qairuhub` wordmark (Latin in both locales) floats in **space**: v3 thinner tube (net stroke
   ≈ 0.09 × size) and ~15 % smaller (0.60 × the visible width, 0.66 on ≤ 768 px), stars refracting
   through the letters, slow float, subtle mouse parallax. On scroll it turns one full 360°,
   **recedes into depth** (visibly shrinks, ≈ −30 % apparent size) and rises out of the frame by
   1.4 vh. Constants: JOURNEY-SPEC "v3 constants".
3. **Launchpad** (`#launchpad`): `u-h2-large` title with one accent ("Your launchpad for AI
   *builders*"), 16px subtitle, primary "Join QairuHub". Below it the **Ask bar** replaces the v2
   typewriter pill: a 48px rounded input on a solid `rgba(8,12,32,.72)` card (no blur), submit /
   stop button, six suggestion chips; the placeholder types the suggestions only while the input is
   empty and unfocused. An answer streams inline under the bar with its sources and "Continue in
   chat". Then the **three cards** (4 cols each, radius 12, 1px white/10 border, square media on
   top with explicit `visual` keys `learn` / `build` / `launch`, `p-5` text: title u-h2, body 16
   white/75); the active card is `opacity 1` with border white/30, the others ≥ .55, cross-fading
   every ~3.5 s. The Launchpad is read through the descent: see JOURNEY-SPEC (whiteout peak 0.6).
4. **Ecosystem** (`#ecosystem`, small spacing): title u-h4 "The ecosystem and tools we build with"
   (KK equivalent); two marquee rows of text wordmarks (80px tall, 80px gap, edge mask, row 2
   reversed and slower), then a small caption "Tools, platforms and ecosystem around our builders."
   Row 1: Alem.ai · Astana Hub · HackAlem AI · QairuHub Accelerator · QairuHub Community.
   Row 2: Anthropic Claude · OpenAI · Google Gemini · Cursor · Lovable · Qaldy AI.
   No logo files, and never "partner", "sponsor" or "backed by" next to these names.
5. **Waitlist** (`#accelerator`): Pill "Spring 2027 · planned" · title u-h2 two lines, second line
   the cursive accent · body · row [ghost input 48px ~370px + primary "Notify me"] · consent line ·
   then the large haze media card (radius 20) with the caption and the animated step row
   Idea → Team → Demo Day → Accelerator. States: success, invalid email, rate limited, failed; a
   duplicate email still shows success.
6. **Supersize** (`#supersize`): `u-h1` uppercase, left-aligned, bleeding the viewport
   ("Builders over talkers. Projects over lectures."). Scroll-linked wipe per line from 0.15 → 1
   as it crosses the middle of the viewport. KK renders in Oswald through `unicode-range` and must
   not overflow at 390 px.
7. **Platform showcase** (`#platform`): pill `community.qairuhub.com`, title "This is the *Hub*",
   body. The light "app window" card (10 cols, radius 10, `#fff`, sidebar + header chrome, a visible
   **Sample data** badge) with **four tabs** (Team Finder, Projects, Events, People), each its own
   screen; tables collapse to stacked rows at 390 px. Tab bar (centered, 36px, `rgba(255,255,255,.14)`
   + backdrop blur, radius 10), sliding white indicator (500ms ease) with a 3px timer line that
   auto-advances every 9 s (paused offscreen); roving tablist with Left/Right/Home/End. A caption
   under the window per tab, then the CTA row: primary "Open the platform" and secondary "See public
   projects" (both external) and the access note (@qairu.edu.kz email, admin approval). Our own
   design, not a copy of the platform's.
8. **What we offer** (`#offer`, large spacing): title u-h3 "What we *offer*." + body. **Seven**
   AnimatedBorder cards in the 7/5 · 5/7 · 4/4/4 grid (radius 12, `rgba(255,255,255,.08)` fill, no
   blur, padding 32, title u-h5, body 16 @ 80 %): Events & masterclasses (`schedule` mock),
   Hackathons & preparation (`chart`), Teams on the platform (`links`), QairuHub Demo Day
   (`timeline`), Mentorship, QairuHub Accelerator, Partnerships. Mock rows are real or planned items
   only. Borders pause offscreen; `contain: paint`.
9. **Highlighted projects** (`#projects`, new): title "What we're *building*" + body. A horizontal
   scroll-snap carousel of cards (name, tagline, status pill, badges Live / Internal / Open source,
   tags, one or two links) with prev / next and pause / play buttons; autoplay every 6 s only while
   in view, paused on hover, focus and reduced motion; a list with "n of N" for screen readers. The
   cards include `theqairubook` (live + open source, "Open app" and "Source code", the one card
   allowed a builder credit). The last card is the dashed **"Your project here"** slot with no status
   pill. All data is build-time (`src/data/projects.ts`), so the height never shifts.
10. **Latest news** (`#news`, new): title "Latest *news*" + body + "All updates on Telegram" link.
    Six cards (date label, tag, title, body, one link) in a 3-up grid on desktop and a snap-scroll row
    on mobile; after its `expires` date a card shows the "Past" label. Card 1: "QairuHub Hackathon
    Mentorship with Sanzhar Madiyev, Head of Education & Hackathon at BAITC" (Мадиев in KK), 15 Sep
    2026, 14:00, Shai Cafeteria. Data: `src/data/news.ts`.
11. **CTA card** (`#cta`, full width 12 cols, padding 40, radius 12, AnimatedBorder): left column
    u-h3 title with ONE accent word ("Start where you *are*."), u-h5 subtitle, 16px body (max
    ~500px); right: secondary button "Read the QairuHub Handbook" → `/handbook` (same tab).
    Background: the three blurred colour orbs slowly rotating and pulsing, still the ONLY
    colourful moment on the page.
12. **Tools row** (`#tools`, small spacing): title u-h4 "The *tools* our teams build with"; one
    marquee row of 80×80 text tiles: GitHub · Telegram · Figma · Cloudflare · Vercel · Railway ·
    Hugging Face · Python · TypeScript · Codex (developer tools only, never repeating ecosystem
    row 2), and the small caption "Tools we use, not partnerships."
13. **Storytelling** (`#story`): sticky section, runway `calc(100lvh * 6)` (1.5 × 100lvh per item),
    `margin-top: -50vh`, inner sticky 100lvh. **Four** stacked items (LEARN / BUILD / LAUNCH /
    MEET): u-h1-small headline + centered 16px paragraph (8 cols). Item i is fully visible in the
    middle third of its slice; outgoing `translate 0 → -120px`, opacity 1 → 0, scale 1 → .96;
    incoming `translate 120px → 0`, opacity 0 → 1. Driven by `scrollState` on the shared ticker.
    MEET lands at dusk start ("meet at night"); its text keeps ≥ 4.5:1.
14. **Join form** (`#join`, compact, ≤ 0.63 vh tall at 1440×900): title u-h2-large two lines with
    the cursive "*ship*" + body; white card (6 cols, radius 12, padding 40, `[data-theme=light]`):
    rows name | email, telegram | interest (select, locale-neutral values), a 3-row message, an
    inline Turnstile container (only when a site key is configured), a visually hidden honeypot,
    centered primary Submit (disabled until valid), 12px legal text @ 50 % with underlined links to
    `/handbook#platform-rules` and `/handbook#privacy-on-this-site`. In-card success state; error
    codes `invalid` (focus the field), `rate_limited`, `verify_failed`, `failed`.
15. **Footer** (`#footer`; home: 150vh, `align-items:flex-end`, `pointer-events:none` on the
    root): a DOM spacer over the night phase of the single SkyScene canvas; the field, the stars and
    the returning glass wordmark are painted by the canvas. Content row pinned at the bottom (24px
    margin, pointer events re-enabled): links (Programs, Platform, Projects, News, Join, Members, The
    QairuHub Handbook, Privacy, community.qairuhub.com ↗, plus the theqairubook and "Source code of
    this site" links from DECISIONS §1), the locale switcher, social icon buttons 38×38 (Telegram,
    Instagram, GitHub; no X or LinkedIn), the 12px copyright at 75 % opacity; all text `.on-sky`.
    Sub-pages use a compact footer without the spacer.
16. **Q launcher** (every page): a 56px round button bottom-right with safe-area insets: white
    disc, navy `#0B1729` snail-Q mark (DECISIONS §7 geometry), soft ring on hover, 3 s idle bob (off
    under reduced motion), label "Ask Q". Hidden while the mobile nav is open; offset so it never
    covers the footer socials at 390 px. The panel (dialog, focus trap, Esc returns focus, live region
    for the finished answer) is a lazy chunk loaded on hover, focus or click.

**Sub-pages**

- **Members** (`/members`, `/kk/members`): heading; **Executive board** cards (name, role, what
  they look after) for the five board members; the team list (DECISIONS §6); **Who to ask** table;
  **Contact** block (Telegram channel, Instagram, the join form, "Open platform"); a join CTA. No
  emails, phones or personal handles anywhere.
- **The QairuHub Handbook** (`/handbook`, `/kk/handbook`): sticky TOC on desktop, collapsible TOC on
  mobile (keyboard walkable); body from `src/data/handbook.generated.ts` with H3 anchor links that
  land under the header; "Ask Q" and "Open platform" buttons; long-form type max 70ch, Inter 17/28,
  tables inside `overflow-x: auto`. The KK page shows the Kazakh note above the English body.
- **404**: CONTENT-V3 §20 on the `space` sky preset, with a real 404 status from `dist/404.html`.

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
