# QairuHub landing v3: build plan

**Inputs**
- `docs/CONTENT-V3.md` and `docs/CONTENT-V3.kk.md`: all copy
- `docs/HANDBOOK.md`: the facts and Q's knowledge
- `docs/AGENT-SPEC.md`: the assistant
- `docs/DESIGN-SPEC.md` and `docs/JOURNEY-SPEC.md`: the v2 design and backdrop laws, still valid unless changed here
- Codebase survey: `scratchpad/research/codebase/landing-map.md`, which has line references

**Baseline:** `main` @ `78bbb5f` (Vite 8 + React 19 + TS strict + Tailwind v4 + three/r3f/drei + Lenis). Deployed to Cloudflare Pages project `qairuhub-landing`.

---

## 1. Decisions

### D1. i18n: path prefix, one locale per page load, a text dictionary per section

- **URLs.** English lives at `/`, Kazakh at `/kk/`. Kazakh URLs always keep the trailing slash on the locale root: `/kk/#offer`, never `/kk#offer`.
- **Locale is fixed per load.**
  - `main.tsx` resolves the route once from `location.pathname`.
  - The switcher is a plain `<a href>`, so switching locale is a full navigation.
  - WebGL, Lenis and the journey stay one-document-per-load, which is how they are built.
- **Dictionaries live next to their section.**
  - Every section owns `src/sections/<Section>.i18n.ts`, which exports `const text = { en: {...}, kk: {...} } satisfies Dict<SectionText>`.
  - `satisfies` makes TypeScript enforce that the Kazakh dictionary is complete.
  - Components call `const t = useT(text)`.
  - **Why this over one big `en.ts` / `kk.ts`:** each work package (WP) owns its copy file, so parallel work never touches the same file.
  - **Cost:** the KK strings ship inside the EN bundle, about 12 KB gzipped (accepted).
- **Headlines.** A headline is a single string with one `*accent*` word. `<Accent text>` renders it with `<i>`.
- **Locale-invariant data** lives in `src/i18n/shared.ts`: brand, external links, section ids, logo and tool names, icon and `visual` keys, select option **values**.
- **Wordmark.** The 3D and DOM wordmark stays Latin `qairuhub` in both locales. Courgette and Dancing Script have no Cyrillic, and the 3D path throws on missing glyphs.
- **Stored preference.**
  - The switcher writes `localStorage['qh.locale']` (inside try/catch).
  - `main.tsx` redirects **only** a bare `/` entry with stored `kk` and no same-origin referrer, to `/kk/` + hash.
  - It never auto-redirects from `/kk/` and never uses `navigator.language`.

### D2. Routing: one SPA bundle, a real HTML file per route, no router library

**Routes**

| URL | page | locale |
|---|---|---|
| `/` | home | en |
| `/kk/` | home | kk |
| `/members` | members | en |
| `/kk/members` | members | kk |
| `/handbook` | book | en |
| `/kk/handbook` | book | kk |
| anything else | notFound | by prefix |

**Route context.** `parseRoute(pathname)` produces `{ locale, page, base }`, which `<RouteProvider>` puts in context and `useRoute()` reads. Header, Footer, SkyScene and the Assistant read `useRoute()` themselves, so no component signature changes across work packages.

**Generated HTML.** `scripts/build-html.mjs` runs after `vite build`. It rewrites `dist/index.html` into:
- `dist/index.html`
- `dist/kk/index.html`
- `dist/members.html`
- `dist/kk/members.html`
- `dist/handbook.html`
- `dist/kk/handbook.html`
- `dist/404.html`

Each file gets its own `lang`, `<title>`, description, canonical, hreflang (`en`, `kk`, `x-default`), `og:*` and per-locale font preloads.

**Serving on Cloudflare Pages.**
- Pages serves `members.html` at `/members` and `kk/index.html` at `/kk/`.
- Because `dist/404.html` exists, unknown paths return a real 404 status rendered by the app's notFound page. The SPA fallback is disabled on purpose.

**`public/_redirects`**

```
/kk              /kk/     301
```

### D3. Backend: Cloudflare Pages Functions + D1 + Turnstile + OpenAI

- **Endpoints.** `functions/api/ask.ts` is specified in AGENT-SPEC. `functions/api/join.ts` handles both the join form and the Accelerator waitlist (`kind: "join" | "waitlist"`).
- **Storage is D1 (`DB`), not KV.**
  - KV's free tier allows only 1,000 writes a day and is eventually consistent, which is bad for counters.
  - D1 allows 100k writes a day, gives exportable rows and has SQL retention.
- **The OpenAI key is a Pages secret, `OPENAI_API_KEY`, by default.** Secrets Store bindings are documented for Workers only. The user already stored the key in the Secrets Store secret `chatgpt-api` and noted that the AI endpoint should use it through a small Worker; that path (proxy Worker + service binding) is AGENT-SPEC §10.4 B, and `functions/_lib/openai.ts` must support both. The user picks one before deploy (§6.1).
- **Spam protection.** Turnstile (managed mode, usually invisible), plus a honeypot, plus per-IP rate limits in D1.

### D4. QairuHub Handbook pipeline

`scripts/build-book.mjs` reads `docs/HANDBOOK.md` and writes three generated files:

| Output | Used by | Loaded |
|---|---|---|
| `functions/_generated/handbook-index.json` | `/api/ask` | bundled |
| `public/handbook-index.json` | client offline fallback | lazy |
| `src/data/handbook.generated.ts` | `/handbook` page: TOC + sanitised HTML with H3 anchors | at build |

- All three files are git-ignored and regenerated by `pnpm build`.
- Markdown is rendered at build time with a tiny purpose-built renderer (headings, paragraphs, lists, tables, bold, links). There is no markdown dependency at runtime.

### D5. File names stay, DOM ids change

- Component files keep their v2 names so imports and ownership stay stable: `AgenticCards.tsx` is the Launchpad, `ProductDemo.tsx` is the Platform showcase, `Features.tsx` is What we offer, `ModelsCTA.tsx` is the CTA card, `Integrations.tsx` is the Tools row, `DemoForm.tsx` is the Join form.
- DOM ids change to match CONTENT-V3 §0: `top`, `launchpad`, `ecosystem`, `accelerator`, `supersize`, `platform`, `offer`, `projects`, `news`, `cta`, `tools`, `story`, `join`, `footer`.

### D6. Kazakh typography

- **Keep:** Inter (UI) and Caveat (cursive accent). Both have full Kazakh coverage.
- **Add Oswald for display text.** It becomes a Cyrillic-only member of the `"Anton"` font family via `unicode-range`, so English keeps Anton pixel-for-pixel and Kazakh display text switches per glyph range.
- **Ship subsets, not raw TTF.**
  - The CSS faces become WOFF2 subsets: Inter latin + cyrillic, Anton latin, Oswald 600 cyrillic, Caveat latin + cyrillic.
  - `Courgette-Regular.ttf` stays TTF, because the 3D parser `ttf.ts` needs `glyf`, and it is only preloaded on home.

---

## 2. Target tree (new or changed)

```
docs/
  HANDBOOK.md  CONTENT-V3.md  CONTENT-V3.kk.md  AGENT-SPEC.md  V3-BUILD-PLAN.md  ORG-PROFILE-README.md
functions/
  _middleware.ts                  security headers for /api/*, JSON-only, body cap, origin check
  api/ask.ts                      POST, SSE
  api/join.ts                     POST, JSON
  _lib/{env.ts,origin.ts,ratelimit.ts,turnstile.ts,session.ts,openai.ts,sse.ts,validate.ts,respond.ts,piiFilter.ts,systemPrompt.ts}
  _generated/handbook-index.json      (generated, git-ignored)
  tsconfig.json
migrations/0001_init.sql
shared/handbookSearch.ts              tokenizer, BM25F, selection, renderOffline (used by functions + client + build)
scripts/build-book.mjs  scripts/build-html.mjs  scripts/eval-ask.mjs  scripts/eval-ask.cases.json
scripts/check-content.mjs  scripts/check-fonts.mjs
public/_headers  public/_redirects  public/handbook-index.json (generated)  public/fonts/*.woff2
src/
  main.tsx  App.tsx
  i18n/{locale.ts,LocaleProvider.tsx,shared.ts,meta.json,Accent.tsx}
  data/{projects.ts,news.ts,members.ts,book.generated.ts (generated)}
  lib/{submit.ts,turnstile.ts}
  assistant/{AssistantLauncher.tsx,Assistant.tsx,AskBar.tsx,store.ts,sseClient.ts,Markdown.tsx,SnailQ.tsx,assistant.i18n.ts,Assistant.css}
  pages/{MembersPage.tsx,MembersPage.css,members.i18n.ts,BookPage.tsx,BookPage.css,book.i18n.ts,NotFoundPage.tsx,notFound.i18n.ts}
  sections/
    Header.tsx Header.css header.i18n.ts         Footer.tsx Footer.css footer.i18n.ts
    AgenticCards.tsx AgenticCards.css launchpad.i18n.ts
    Logos.tsx Logos.css ecosystem.i18n.ts        Waitlist.tsx Waitlist.css waitlist.i18n.ts
    Supersize.tsx supersize.i18n.ts              ProductDemo.tsx ProductDemo.css platform.i18n.ts
    Features.tsx Features.css offer.i18n.ts      Projects.tsx Projects.css projects.i18n.ts
    News.tsx News.css news.i18n.ts               ModelsCTA.tsx ModelsCTA.css cta.i18n.ts
    Integrations.tsx Integrations.css tools.i18n.ts
    Storytelling.tsx Storytelling.css story.i18n.ts
    DemoForm.tsx DemoForm.css form.i18n.ts
    SkyScene.tsx  sky/journey.ts  sky/GlassWordmark.tsx  (+ components/three/GlassText.tsx)
  components/ui/{icons.tsx,Button.tsx,Carousel.tsx(new),AutoCarousel.tsx,LogoMark.tsx,Wordmark.tsx,...}
  styles/global.css  styles/fonts.preload.json
wrangler.toml  .dev.vars.example  .env.production (VITE_TURNSTILE_SITE_KEY only; public)
```

**To delete** (by the owner named in §3):
- `src/content.ts` (WP12, once nothing imports it)
- `src/sections/productDemo.content.ts` (WP6)
- `src/sections/features.content.ts` (WP7)

---

## 3. Work packages and exclusive file ownership

**Ownership rules**
- Each file has exactly one owning work package (WP).
- **Stub handoff.** WP0 may create a *stub* of a file owned by a later WP (a minimal default export plus the agreed types) so the build stays green. After WP0 merges, only the owner edits that file; WP0 never touches it again.
- Nothing may import `src/content.ts` in new code. Existing sections keep using it until their owner migrates them.

### Phase and dependency graph

```
Phase 0 (serial first):   WP0 Foundation ──┐        WP11 Fonts (parallel with WP0)
Phase 1 (parallel):       WP1 Sky & wordmark · WP4 Backend & book · WP9 Story + form + submit lib
Phase 2 (parallel):       WP2 Header/Footer (needs WP1 curve exports) · WP3 Launchpad + Q (needs WP4 contract)
                          WP5 Marquees/simple sections · WP6 Platform showcase · WP7 Offer
                          WP8 Projects + News · WP10 Members/Book/404 pages (needs WP4 book.generated)
Phase 3 (serial last):    WP12 QA, perf, docs, cleanup, deploy
```

---

### WP0: Foundation (i18n, routing, HTML, scaffolding)

**Owns**
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/i18n/locale.ts`, `src/i18n/LocaleProvider.tsx`, `src/i18n/shared.ts`, `src/i18n/meta.json`, `src/i18n/Accent.tsx`
- `scripts/build-html.mjs`
- `public/_redirects`, `public/_headers`
- `package.json`, `pnpm-lock.yaml`
- `tsconfig.json`, `vite.config.ts`, `.gitignore`
- `.env.production`, `.dev.vars.example`
- `src/components/ui/{Button.tsx,Section.tsx,Grid.tsx,Reveal.tsx,Pill.tsx,AnimatedBorder.tsx,icons.tsx}`

**Stubs, then handoff**
- `src/sections/Projects.tsx` and `News.tsx` → WP8
- `src/pages/MembersPage.tsx`, `BookPage.tsx`, `NotFoundPage.tsx` → WP10
- `src/assistant/AssistantLauncher.tsx` → WP3
- `scripts/build-book.mjs`, which writes empty outputs → WP4
- `src/data/handbook.generated.ts` → WP4 (generated)

**Contracts to publish** in `src/i18n/locale.ts` and `LocaleProvider.tsx`

```ts
export type Locale = 'en' | 'kk'
export type Page = 'home' | 'members' | 'book' | 'notFound'
export interface Route { locale: Locale; page: Page; base: '/' | '/kk/' }
export function parseRoute(pathname: string): Route
export function switchLocaleHref(route: Route, to: Locale, hash?: string): string // same page, other locale
export function href(route: Route, to: '/' | 'members' | 'book' | `#${string}` | `book#${string}`): string
export type Dict<T> = { en: T; kk: T }
export function RouteProvider(props: { route: Route; children: React.ReactNode }): JSX.Element
export function useRoute(): Route
export function useT<T>(dict: Dict<T>): T
export function Accent(props: { text: string; as?: 'span' }): JSX.Element // "*word*" → <i>word</i>
```

**Tasks**
1. `App.tsx`:
   - Home keeps today's section tree, with `<Projects/>` and `<News/>` inserted after `<Features/>` and before `<ModelsCTA/>`.
   - `members`, `book` and `notFound` pages render lazily inside `<SmoothScroll>`, `<Header>` and `<Footer>`.
   - `<AssistantLauncher/>` mounts on every page.
   - `<SkyScene/>` mounts on every page; it reads the route itself.
2. `main.tsx`:
   - Call `parseRoute`, set `document.documentElement.lang`, apply the stored-preference redirect rule (D1) and wrap the app in `<RouteProvider>`.
3. `shared.ts`:
   - `brand` (name, wordmark `qairuhub`, tagline)
   - `links`: platform deep links, `t.me/qairuhub`, `instagram.com/qairuhub`, `github.com/qairuhub`, qairuhub-web, the landing source, `hackalem.ai`
   - `sectionIds` (D5)
   - `interestValues`: `build`, `project`, `events`, `media`, `business`, `mentor`, `partner`, `other`
   - `ecosystemItems` and `toolItems`: names + style, from CONTENT-V3 §5 and §13
4. `meta.json`: titles and descriptions per route × locale, from CONTENT-V3(.kk) §1.
5. `build-html.mjs`:
   - Generate the 7 HTML files (D2).
   - Take canonical and hreflang from `SITE_ORIGIN` (default `https://qairuhub-landing.pages.dev`).
   - `og:locale` is `en_US` / `kk_KZ`.
   - Preloads come from `src/styles/fonts.preload.json`, which WP11 owns. Home adds the Courgette TTF; `kk` adds the Oswald cyrillic WOFF2.
   - Replace the inline `style="background:#03040c"` on `<html>` with the same colour for every route.
6. `package.json`:
   - **Scripts:**
     - `build`: `node scripts/build-book.mjs && tsc -p tsconfig.json --noEmit && tsc -p functions/tsconfig.json --noEmit && vite build && node scripts/build-html.mjs`
     - `build:book`
     - `dev:api`: `wrangler pages dev dist --port 8788`
     - `deploy`: `wrangler pages deploy dist --project-name qairuhub-landing --branch main`
     - `eval:ask`: `node scripts/eval-ask.mjs`
     - `check`: `node scripts/check-content.mjs && node scripts/check-fonts.mjs`
   - **devDependencies:** `wrangler`, `@cloudflare/workers-types`.
7. `vite.config.ts`: `server.proxy['/api'] = 'http://127.0.0.1:8788'`.
8. `tsconfig.json`: include `src` and `shared`.
9. `.gitignore`: add `.dev.vars`, `functions/_generated`, `public/handbook-index.json`, `src/data/handbook.generated.ts`, `scripts/private-denylist.txt`.
10. `_headers`:
    - security headers and CSP:
      - `script-src 'self' https://challenges.cloudflare.com`
      - `frame-src https://challenges.cloudflare.com`
      - `connect-src 'self'`
      - `img-src 'self' data: blob:`
      - `style-src 'self' 'unsafe-inline'`
      - `font-src 'self'`
      - `worker-src 'self' blob:`
      - `frame-ancestors 'none'`
    - immutable caching for `/assets/*` and `/fonts/*`
11. `icons.tsx`: add `arrowUpRight`, `globe`, `send`, `stop`, `chevronLeft`, `chevronRight`, `pause`, `play`, `close`, `external`, `telegram`, `instagram`, `github`, and remove `x` and `linkedin`.
12. `Button.tsx`: an `external` prop that adds `target=_blank`, `rel=noopener noreferrer` and an sr-only `a11y.newTab` suffix passed in by the caller.

**Acceptance**
- `pnpm build` is green with stubs. `dist/` holds the 7 HTML files, each with the correct `lang`, title, description, canonical, 3 hreflang links and `og:locale`.
- `parseRoute` handles every one of these as expected: `/`, `/kk`, `/kk/`, `/members`, `/members/`, `/kk/members`, `/handbook`, `/kk/handbook`, `/nope` (notFound, en) and `/kk/nope` (notFound, kk).
- `npx wrangler pages dev dist` returns 200 for all 6 routes and **404 status** for `/nope`, and follows `/kk` → `/kk/` with a 301.
- Home EN renders exactly as before, since sections are not migrated yet.
- The switcher helper keeps the page and hash: `/members#x` ↔ `/kk/members#x`.

---

### WP1: Sky, hero wordmark, journey keyframes, static scene

**Owns**
- `src/sections/SkyScene.tsx`
- `src/sections/sky/journey.ts`, `sky/GlassWordmark.tsx`, `sky/quality.ts`, `sky/CloudSprites.tsx`, `sky/Stars.tsx`, `sky/fallback.ts`
- `src/components/three/GlassText.tsx`
- `src/sections/Hero.tsx`, `src/sections/hero.i18n.ts` (`hero.srTitle`, CONTENT-V3 §3)

**Contract exports** (from `journey.ts`, for WP2)

```ts
export const HERO_EXIT_VH = 1.4
export function heroWordmarkWeight(yVh: number): number        // 1 - smoothstep(0, HERO_EXIT_VH, y)
export function footerWordmarkWeight(yVh: number, endVh: number): number
export function setStaticJourney(preset: 'night' | 'space'): void
```

**A. Thinner, smaller, receding hero wordmark.** The constants:

| Constant | File | v2 | v3 |
|---|---|---|---|
| `BEVEL` | `GlassWordmark.tsx` | `{ thickness: .04, size: .04, segments: 5 }` | `{ thickness: .025, size: .02, offset: -.03, segments: 5 }` |
| net stroke | — | ≈ 0.19 × size | ≈ 0.09 × size (−53%) |
| fallback `BEVEL` if joins self-intersect | — | — | `{ thickness: .022, size: .012, offset: 0, segments: 4 }` (≈ 0.134 × size) |
| extrusion `height` | passed to `getGlassGeometry` and `<GlassText height>` | `GLASS_HEIGHT` 0.14 | `0.08` |
| `CURVE_SEGMENTS` | `GlassWordmark.tsx` | 8 | 8 |
| `HERO.fit` / `fitMobile` | `GlassWordmark.tsx` | 0.70 / 0.78 | **0.60 / 0.66** |
| `HERO.exitDepth` (new) | `GlassWordmark.tsx` | — | **5** (world units toward −z; mid cloud deck sits at z −6) |
| `HERO.exitScale` | `GlassWordmark.tsx` | 0.9 | **1.0** (perspective now does the shrink: 10/15 ≈ 0.67) |
| `HERO.exitLift` | `GlassWordmark.tsx` | 6 | 6, multiplied by `dist / baseDist` so exit timing holds |
| recede curve | `GlassWordmark.tsx` | — | `recede = smoothstep(0.05, 1, 1 - wh)`; `z = HERO.z - recede * HERO.exitDepth` |
| fit distance | `GlassWordmark.tsx` | live `dist` | **fixed `baseDist = cam.z - HERO.z`**, so receding shrinks the run instead of being cancelled |
| material `thickness` | frosted override | 0.6 | **0.3** |
| material `attenuationDistance` | frosted override | 2 | **3** |
| `GlassTextBevel.offset` (new) | `GlassText.tsx` | — | added to the type and the **cache key**; `bevelOffset: (offset ?? 0) * size` |
| `aboveFrame()` | `GlassWordmark.tsx` | uses `dist` | same, but with the receding `dist` |

- **Spin:** stays `(1 - wh) · 2π`, one full turn by 1.4 vh. Reduced motion means no spin, float, parallax or recede.
- **Footer run:** shares the thinner geometry, since it uses the same cache key. Its fit is unchanged (0.42 / 0.70). Check it visually.

**B. Journey keyframes for the v3 page height.**

**Estimated new height.** Desktop `end` goes from 14.7 vh to about 18.2 vh:

| Change | Height |
|---|---|
| Ask bar | +0.3 vh |
| Platform CTA row | +0.2 vh |
| Projects | +1.0 vh |
| News | +1.1 vh |
| Triptych runway 4.5 → 6 × lvh | +1.5 vh |
| Compact form | −0.55 vh |

**Top-anchored phases** move earlier and soften, so the Launchpad Ask bar (≈ 1.1–2.4 vh) is never read through a whiteout. These are starting values; tune them by eye with shots at y = 1.0, 1.3, 1.6, 2.0 vh.

| weight | v2 | v3 start values |
|---|---|---|
| `space` out | 0.9 → 1.7 | 0.85 → 1.6 |
| `descent` bell | in 0.9→1.4, out 1.9→2.4 | in 0.85→1.3, out 1.8→2.3 |
| `whiteout` bell | 1.15→1.6→2.1 (peak 1) | 1.0→1.35→1.75, **peak × 0.8** |
| `day` in | 1.7 → 2.3 | 1.55 → 2.1 |
| `stars` out | 1.2 → 1.8 | 1.15 → 1.7 |
| `clouds` in | 0.9 → 1.6 | 0.85 → 1.5 |
| `pal.t0` / `pal.t1` | 0.9→1.5 / 1.5→2.2 | 0.85→1.4 / 1.4→2.05 |
| `wordmarkHero` | 1 − smoothstep(0, 1.4) | unchanged (`HERO_EXIT_VH`) |

**Bottom-anchored phases** keep their end − k formulas. With a shorter form, `#join` sits at about end − 2.1 → end − 1.5, so it reads in dusk → night, and the triptych's MEET frame lands at dusk start, which is intended ("meet at night").
- Keep the near cloud centre-lane fade, and verify text contrast at MEET.

**C. Static scene for sub-pages.**
- `SkyScene` reads `useRoute()`.
  - For `page !== 'home'` it calls `setStaticJourney('night')`: `night 1`, `stars 1`, `clouds 0.3`, `ground 0`, both wordmark weights 0, `pal = {1,1,1,1}`, constant `vh/end`.
  - It skips `updateJourney` and does not mount `GlassWordmark` (no Courgette fetch, no transmission FBO) or `Field`.
- 404 uses the `space` preset.

**Acceptance**
- **Hero stroke.** At y = 0, stroke thickness at the "h" stem is ≤ 55% of v2 in a same-viewport screenshot.
- **No artefacts.** Shots at y = 0.2, 0.5, 0.8 and 1.1 vh show no self-intersection artefacts through the full 360°.
- **Exit.** The run visibly recedes, since its apparent size falls about 30% before exit. It leaves the frame top by y ≤ 1.4 vh, and the header DOM logo appears after it.
- **Readability.** The Launchpad title, the Ask bar and the chips measure ≥ 4.5:1 contrast at y = 1.2, 1.5 and 1.8 vh (sampled backdrop behind the text).
- **Sub-pages.** `/members` and `/handbook` request no `Courgette-Regular.ttf` and render a steady night sky with no cloud flashes on a short page.
- **FPS** on the user's Intel UHD laptop, medium tier: hero ≥ 55, mid-page ≥ 60, footer ≥ 52 (v2 was 52), none lower than v2.
- `prefers-reduced-motion` gives a static wordmark and no recede.

---

### WP2: Header, Footer, locale switcher

**Owns**
- `src/sections/Header.tsx`, `Header.css`, `header.i18n.ts`
- `src/sections/Footer.tsx`, `Footer.css`, `footer.i18n.ts`
- `src/components/ui/Wordmark.tsx`

**Tasks**
- **Content.** Nav items, mega menus, actions and a11y from CONTENT-V3 §2; Footer from §16. All hrefs go through `href(route, …)`.
- **Switcher.**
  - A segmented `EN | ҚАЗ` control placed first in `.hdr__actions`. It is two `<a>` elements with `hreflang`, `lang` and `aria-current` on the active one, and it keeps the hash.
  - It also appears in the mobile panel's top row and in the footer row.
- **Buttons.** "Open platform" is the primary external button with an ↗ icon. Members is the tertiary button. Join appears in the mobile panel only.
- **Journey curves.** Replace the duplicated curve fallback (`Header.tsx:155-171`) with `heroWordmarkWeight` / `footerWordmarkWeight` imported from `journey.ts`.
- **Logo.** The logo links to `route.base`. On `page !== 'home'` it is always shown, with no journey tick.
- **Footer.** Remove the X and LinkedIn icons. Sub-pages use a compact footer variant with no 150 lvh spacer.

**Acceptance**
- Every link resolves: anchors exist on home, and sub-page anchors navigate to `base#id` and land under the header.
- **Keyboard.** Mega menus still open on focus-visible, close on Esc, and pass keyboard walk-through.
- **No overflow.** No nav overflow at 769, 860, 1024 and 1100 px in **KK**, and in EN.
- The mobile panel lists all items plus the switcher.
- The primary button opens `https://community.qairuhub.com` in a new tab.
- **Screen reader.** VoiceOver/NVDA announce the switcher as "Language, EN, current".

---

### WP3: Launchpad, Ask bar, Q assistant (client)

**Owns**
- `src/sections/AgenticCards.tsx`, `AgenticCards.css`, `launchpad.i18n.ts`
- `src/assistant/*`: `AssistantLauncher.tsx`, `Assistant.tsx`, `AskBar.tsx`, `store.ts`, `sseClient.ts`, `Markdown.tsx`, `SnailQ.tsx`, `assistant.i18n.ts`, `Assistant.css`

**Tasks**
- **Launchpad copy.** CONTENT-V3 §4 and §19. The DOM id becomes `launchpad`. Cards get explicit `visual` keys, and bento labels come from i18n.
- **AskBar.**
  - Input, submit, stop and the six chips, with the typewriter placeholder only while the input is empty and unfocused.
  - The inline answer panel shows sources and "Continue in chat".
  - The card background is a solid `rgba(8,12,32,.72)`, with no blur.
- **SSE client.**
  - `fetch` POST, then a `ReadableStream` line parser.
  - `AbortController`; handling for the `meta`, `delta`, `done` and `error` events.
  - Retries once after `verify_required`.
  - Client-only fallback: lazy `import('../../shared/handbookSearch')` plus `fetch('/handbook-index.json')`.
- **Markdown.** A subset renderer producing DOM nodes, with the link allowlist and locale-based relative links from AGENT-SPEC §6.
- **Launcher.** Fixed bottom-right with safe-area insets. The inline `SnailQ` SVG is under 2 KB. It hides while the mobile nav is open. The panel chunk loads lazily on hover, focus or click.
- **Panel.** Dialog semantics, focus trap, Esc, a live region announcing only the finished answer, greeting, suggestions, disclaimer and reset.
- **Store.** One thread shared by the AskBar and the panel, kept in `sessionStorage` (`qh.ask.thread`, last 12 messages).
- **Turnstile.** Uses `getTurnstileToken('ask')` from `src/lib/turnstile.ts`, owned by WP9. It is lazy on first input focus.

**SnailQ placeholder SVG** (64×64), until Media supplies the real artwork:
- **Shell:** a navy `#091F40` ring, the Q bowl, centred at (27, 29), outer r 17, stroke 8.
- **Body:** the azure `#009FFD` Q tail, drawn as a rounded body from the bowl's lower right (40, 40) to (58, 50), 8 px tall, with a flat foot along y = 52.
- **Antennae:** two lines from (54, 42) to (57, 33) and from (58, 43) to (62, 35), stroke 2, round caps, tips r 2.
- **Eye:** a white dot at (54, 46).
- **Animation:** a subtle 3 s idle bob, disabled under reduced motion.

**Acceptance**
- **Streaming.** Answers stream token by token. Stop cancels within 100 ms. A new question aborts the previous one.
- **Fallback.** With `pnpm dev` alone (no Functions), asking returns an offline Book answer with the intro line; there is no error.
- **Links.** Allowlisted links are clickable; a non-allowlisted URL renders as plain text. `/handbook#x` becomes `/kk/handbook#x` on KK pages.
- **Launcher.** Present on `/`, `/kk/`, `/members` and `/handbook`. It doesn't cover the footer socials at 390 px (an offset is applied when they overlap).
- **Bundle.** The panel chunk is ≤ 20 KB gzip, the launcher adds ≤ 3 KB gzip to the entry, and no request goes to `/api/ask` or `challenges.cloudflare.com` before the user interacts.
- **Accessibility.** axe reports no serious issues. The panel opens with focus in the input, Esc returns focus to the launcher, and screen readers hear the answer once.

---

### WP4: Backend, QairuHub Handbook pipeline, config

**Owns**
- `functions/**`
- `migrations/0001_init.sql`
- `shared/handbookSearch.ts`
- `scripts/build-book.mjs`, `scripts/eval-ask.mjs`, `scripts/eval-ask.cases.json`
- `wrangler.toml`
- `src/data/handbook.generated.ts`, `functions/_generated/handbook-index.json`, `public/handbook-index.json` (all generated)
- `perf/ask-eval-*.json` (written by `eval-ask.mjs`; WP12 commits them)
- Reads `docs/HANDBOOK.md` but does not edit it; the synthesis lead owns it (§4)

**`wrangler.toml`**

```toml
name = "qairuhub-landing"
pages_build_output_dir = "./dist"
compatibility_date = "2026-09-01"

[vars]
OPENAI_MODEL = "gpt-5.6-luna"
OPENAI_REASONING_EFFORT = "low"
OPENAI_MAX_OUTPUT_TOKENS = "700"
OPENAI_BASE_URL = "https://api.openai.com/v1"
ASK_ENABLED = "true"
ASK_DAILY_CAP = "1500"
ASK_PER_IP_PER_MINUTE = "6"
ASK_PER_IP_PER_DAY = "40"
ASK_TOP_K = "5"
ASK_MIN_SCORE = "1.2"
ASK_CONTEXT_CHARS = "9000"
JOIN_PER_IP_PER_10MIN = "5"
SUBMISSION_RETENTION_DAYS = "180"
ALLOWED_ORIGINS = "https://qairuhub-landing.pages.dev"
SITE_ORIGIN = "https://qairuhub-landing.pages.dev"

[[d1_databases]]
binding = "DB"
database_name = "qairuhub-landing"
database_id = "<from: npx wrangler d1 create qairuhub-landing>"
migrations_dir = "migrations"
```

- **Secrets** (never in files): `OPENAI_API_KEY`, `TURNSTILE_SECRET_KEY`, `SESSION_SIGNING_KEY`, `RATE_LIMIT_SALT`.
  - Optional: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, for a new-submission ping to a private team chat. That ping is off unless both are set.
- **KV namespaces:** none (decision D3).
- **Local dev:** `.dev.vars` is git-ignored; `.dev.vars.example` lists the names with empty values.

**`migrations/0001_init.sql`**

```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,                       -- crypto.randomUUID()
  kind TEXT NOT NULL CHECK (kind IN ('join','waitlist')),
  created_at INTEGER NOT NULL,               -- unix seconds
  expires_at INTEGER NOT NULL,               -- created_at + retention
  locale TEXT NOT NULL CHECK (locale IN ('en','kk')),
  name TEXT, email TEXT NOT NULL, telegram TEXT, interest TEXT, message TEXT
);
CREATE INDEX submissions_kind_created ON submissions (kind, created_at);
CREATE UNIQUE INDEX submissions_waitlist_email ON submissions (email) WHERE kind = 'waitlist';
CREATE TABLE counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires_at INTEGER NOT NULL);
```

**`/api/join` contract**

**Request:** `POST` JSON (≤ 8 KB):

```json
{ "kind": "join", "locale": "en", "name": "…", "email": "…", "telegram": "@…", "interest": "build", "message": "…", "company": "", "turnstileToken": "…" }
{ "kind": "waitlist", "locale": "kk", "email": "…", "company": "", "turnstileToken": "…" }
```

**Processing order:**
1. Origin check.
2. JSON + size check.
3. **Honeypot.** If `company` is non-empty, return `200 {"ok":true}` and store nothing.
4. **Rate limit** of 5 per 10 minutes per IP hash, or 429 `rate_limited`.
5. **Turnstile siteverify** with `secret`, `response`, `remoteip` and `idempotency_key`. It requires `success`, `action ∈ {join, waitlist}` and an allowlisted `hostname`; otherwise 403 `verify_failed`.
6. **Validation**, mirroring CONTENT-V3 §15.2. `interest` must be in `interestValues` and `locale ∈ {en, kk}`; failures return 422 `{"error":{"code":"invalid","fields":["email"]}}`.
7. **D1 insert.** A duplicate waitlist email still returns 200 (idempotent).
8. 1% of requests run `DELETE FROM submissions WHERE expires_at < now` and the same purge on `counters`.
9. Optional Telegram ping with kind, interest, locale and the Telegram handle only, never the email or message.
10. `200 {"ok":true}`.

**Response headers:** `Cache-Control: no-store`. No request bodies are logged.

**`/api/ask`:** exactly as AGENT-SPEC §4–§10.

**Book build:** as AGENT-SPEC §4.1. The build fails on a chunk under 40 words, a missing `kw` line, a duplicate anchor, or any email or phone pattern.

**Acceptance**
- **Local.** `pnpm build && npx wrangler pages dev dist` with a real key in `.dev.vars` passes `pnpm eval:ask`: 20/20 on safety and invention rules, ≥ 18/20 overall. Results are saved to `perf/ask-eval-*.json`.
- **Offline modes.** Unsetting the key or setting `ASK_ENABLED=false` returns `meta.mode = offline` with the right `reason` and still gives a useful answer.
- **Rate limits.** The 7th ask within a minute from one IP gets 429 with `Retry-After`. The 6th join within 10 minutes gets 429. A honeypot-filled join returns 200 and inserts no row.
- **Turnstile.** A missing or invalid token gets 403 on join. On ask, a missing session cookie with no token gets 403 `verify_required`, and a valid token sets the `qh_ask` cookie.
- **Origin.** A request from another origin gets 403.
- **Streaming.** SSE first byte arrives in ≤ 2.5 s p50, measured over 10 runs.
- **CPU.** Function CPU time, excluding upstream wait, is ≤ 10 ms per request (`wrangler pages dev` with `--inspect` or Cloudflare dashboard metrics).
- **Logs.** `wrangler pages deployment tail` shows no question text, email or name.
- **Book outputs.** `book-index.json` is ≤ 120 KB raw, and `src/data/handbook.generated.ts` renders all H2s and H3s with anchors that match CONTENT-V3's slugs.

---

### WP5: Ecosystem marquee, Waitlist, Supersize, CTA card, Tools row

**Owns**
- `src/sections/Logos.tsx`, `Logos.css`, `ecosystem.i18n.ts`
- `src/sections/Waitlist.tsx`, `Waitlist.css`, `waitlist.i18n.ts`
- `src/sections/Supersize.tsx`, `Supersize.css`, `SupersizeWipe.css`, `supersize.i18n.ts`
- `src/sections/ModelsCTA.tsx`, `ModelsCTA.css`, `cta.i18n.ts`
- `src/sections/Integrations.tsx`, `Integrations.css`, `tools.i18n.ts`
- `src/components/ui/LogoMark.tsx`, `LogoMark.css`, `AutoCarousel.tsx`

**Tasks**
- **Copy and data.** CONTENT-V3 §5, §6, §7, §12 and §13. DOM ids become `ecosystem`, `accelerator`, `supersize`, `cta` and `tools`.
- **Marquee items.** Only the 7 ecosystem items and 11 tools, as text wordmarks. The aria-label comes from i18n.
- **Tools note.** Render `tools.note` as a small caption ("Tools we use, not partnerships.").
- **Waitlist.**
  - Calls `subscribeWaitlist(email, { signal, locale })` from `src/lib/submit.ts` (WP9 handles Turnstile inside).
  - Maps errors to copy keys.
  - The pill reads "Spring 2027 · planned".
- **CTA card.**
  - The title uses `<Accent>` (one word), not a whole-cursive title.
  - The button goes to `href(route, 'book')`, same tab.

**Acceptance**
- No outdated names (Qairu AI, Qairu Space, Qairu Hackathons, Qairu Accelerator, NURIS, nFactorial, Talent Lab) render anywhere in these sections, in either locale.
- **Waitlist states.** Success, invalid email, rate limited and failure all render localized copy. A duplicate email still shows success.
- **KK Supersize.** Renders in Oswald (Cyrillic) with no glyph fallback and no horizontal overflow at 390 px and 1440 px.
- **Marquees.** Paused offscreen, with reduced motion honoured.

---

### WP6: Platform showcase, "This is the Hub"

**Owns**
- `src/sections/ProductDemo.tsx`, `ProductDemo.css`, `platform.i18n.ts`
- Deletes `src/sections/productDemo.content.ts`

**Tasks**
- **Id and tabs.** The DOM id becomes `platform`. Four tabs, each with its own screen component: Team Finder (`finder`), Projects (`projects`), Events (`events`) and People (`people`). Data and captions come from CONTENT-V3 §8.
- **Module scope.** Remove the module-scope content reads (`ProductDemo.tsx:34,41-42`) and read `useT` inside the components.
- **Sample badge.** A visible "Sample data" badge in the window chrome.
- **Kept behaviour.** The roving tablist, the sliding indicator and the 9 s auto-advance with offscreen pause.
- **CTA row.** A CTA row under the window with the access note.
- **Dates.** Date tiles parse the digits from the date label, which works for "3 қаз." and "Oct 3".
- **Visual rule.** Do not copy the platform's visual design (layout, colours, type). Use the landing's existing light app-window style.

**Acceptance**
- **Tabs.** All 4 tabs render in both locales, with keyboard Left/Right/Home/End.
- **Overflow.** No overflow at 390 px: the table columns collapse to stacked rows.
- **Links.** The CTA buttons open the platform and the showcase in new tabs.
- The Sample data badge is visible on every tab.
- `productDemo.content.ts` is deleted and nothing imports it.

---

### WP7: What we offer

**Owns**
- `src/sections/Features.tsx`, `Features.css`, `offer.i18n.ts`
- Deletes `src/sections/features.content.ts`

**Tasks**
- The DOM id becomes `offer`. Render the 7 cards from CONTENT-V3 §9 in the 7/5 · 5/7 · 4/4/4 grid.
- Visual mocks read their rows from `offer.mock.*`, the real or planned items in §9.2.
- Keep the AnimatedBorder cards paused offscreen, and add `contain: paint`.

**Acceptance**
- Exactly 7 cards in the CONTENT order, with no "at scale", "unblocks" or old program names.
- **Mock rows.** The schedule mock shows "Sep 15 · Hackathon Mentorship" and no invented events.
- **Performance.** Mid-page (50% scroll) FPS on the real GPU is not below v2.

---

### WP8: Highlighted projects carousel and Latest news

**Owns**
- `src/sections/Projects.tsx`, `Projects.css`, `projects.i18n.ts`
- `src/sections/News.tsx`, `News.css`, `news.i18n.ts`
- `src/data/projects.ts`, `src/data/news.ts`
- `src/components/ui/Carousel.tsx`

**Data shapes**

```ts
// src/data/projects.ts
export interface ProjectItem {
  id: string; name: string
  tagline: Dict<string>
  status: 'idea' | 'recruiting' | 'inProgress' | 'demoShown' | 'completed' | 'stopped' | null
  badges: Array<'live' | 'internal' | 'openSource'>
  tags: string[]
  link?: { label: Dict<string>; href: string; external?: boolean }
  slot?: boolean                       // "Your project here" card
}
// src/data/news.ts
export interface NewsItem {
  id: string; date: string | null      // ISO date, Astana
  dateLabel: Dict<string>; tag: Dict<string>; title: Dict<string>; body: Dict<string>
  link: { label: Dict<string>; href: string; external?: boolean }
  expires?: string                     // ISO datetime; after it → "Past" label
  verify?: string                      // note for editors, not rendered
}
```

**Tasks**
- **Projects section** (`#projects`). A horizontal carousel of the 8 items in CONTENT-V3 §10.
  - Scroll-snap track with prev/next buttons and a pause/play control.
  - Autoplay every 6 s, only while in view, and pausing on hover, focus and reduced motion.
  - The slot card is dashed and always last.
- **News section** (`#news`). A 3-up grid on desktop and a snap-scroll row on mobile, with the 6 cards in the CONTENT order.
- **Data source.** All data is build-time (no runtime fetch), so page height is stable (landing-map risk #6).
- Card 1 ships with the verified body ("organiser of HackAlem AI") and carries `verify: 'BAITC title unconfirmed; add only after confirmation'`.

**Acceptance**
- The carousel works with keyboard (buttons and arrow keys when focused), touch swipe and a screen reader (a list with "n of 8").
- No layout shift after load: measure CLS ≤ 0.02 for these sections.
- Past news shows the "Past" label after its `expires` date. Test by mocking the date.
- No project card names an individual person.

---

### WP9: Storytelling MEET, compact Join form, submit and Turnstile client

**Owns**
- `src/sections/Storytelling.tsx`, `Storytelling.css`, `story.i18n.ts`
- `src/sections/DemoForm.tsx`, `DemoForm.css`, `form.i18n.ts`
- `src/lib/submit.ts`, `src/lib/turnstile.ts`

**Contracts**

```ts
// src/lib/turnstile.ts: lazy loads https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit
export function getTurnstileToken(action: 'join' | 'waitlist' | 'ask', opts?: { container?: HTMLElement; signal?: AbortSignal }): Promise<string | null>
// null when VITE_TURNSTILE_SITE_KEY is empty (local dev); the server skips verification only if its secret is also unset
// src/lib/submit.ts
export interface JoinValues { name: string; email: string; telegram: string; interest: InterestValue; message: string; company: string }
export function submitJoin(values: JoinValues, opts: { signal?: AbortSignal; locale: Locale; container?: HTMLElement }): Promise<void>
export function subscribeWaitlist(email: string, opts: { signal?: AbortSignal; locale: Locale }): Promise<void>
export class SubmitError extends Error { code: 'invalid' | 'rate_limited' | 'verify_failed' | 'failed'; fields?: string[] }
```

**Tasks**
- **Storytelling.**
  - Four items (Learn, Build, Launch, Meet).
  - Runway `calc(100lvh * 6)` (was 4.5), so each frame keeps its v2 scroll length.
  - Read `N` from `useT` inside the component, not at module scope.
  - The a11y label comes from i18n.
- **Join form (`#join`).**
  - Fields per CONTENT-V3 §15.
  - Layout: a 6-column card; name and email in one row, telegram and interest in the next, then a 3-row message field.
  - Turnstile container inline under the message. The honeypot is visually hidden with `tabindex=-1`.
  - Submit is disabled until the form is valid.
  - Errors come from i18n, and select options send their values.
  - Success state and focus management carry over from v2.
- **Height.** At least 45% shorter than v2: v2 desktop height was 1.14 vh.

**Acceptance**
- **Height.** The form section is ≤ 0.63 vh tall at 1440×900, and ≤ 0.75 vh at 390×844 (EN), with KK within +10%.
- **Submission.** A valid submission writes a D1 row with locale-neutral `interest`. A bot-style submission (honeypot filled) shows success but writes nothing.
- **Error codes.** Each maps to localized copy (`invalid` with field focus, `rate_limited`, `verify_failed`, `failed`).
- **Triptych.** With 4 items, each frame gets ≥ 1.4 × 100lvh of scroll at desktop. MEET text contrast is ≥ 4.5:1 over dusk.
- **Turnstile loading.** The Turnstile script loads only once the form or waitlist input nears the viewport (IntersectionObserver with a 400 px rootMargin) or on ask focus.

---

### WP10: Members, QairuHub Handbook and 404 pages

**Owns**
- `src/pages/MembersPage.tsx`, `MembersPage.css`, `members.i18n.ts`
- `src/pages/BookPage.tsx`, `BookPage.css`, `book.i18n.ts`
- `src/pages/NotFoundPage.tsx`, `notFound.i18n.ts`
- `src/data/members.ts`

**Tasks**
- **Members** (CONTENT-V3 §17).
  - Executive board cards (name, role, focus), the Who-to-ask table, a contact block and a join CTA.
  - The builders list sits behind `SHOW_BUILDERS = false` in `members.ts`.
  - No emails, phones or personal handles anywhere.
- **Book** (CONTENT-V3 §18).
  - A sticky TOC on desktop and a collapsible TOC on mobile.
  - The body comes from `book.generated.ts`, with H3 anchor links and "Ask Q" / "Open platform" buttons.
  - The KK page shows `book.kkNote` above the English body.
  - Long-form typography: max 70ch, Inter 17/28, tables inside `overflow-x: auto`.
- **404** (CONTENT-V3 §20) on the `space` preset.
- **Scrolling.** Pages use Lenis like home, with deep links landing under the header.

**Acceptance**
- **Members.** `/members` and `/kk/members` show the 5 board members with the correct roles and no contact data. `grep -R "@qairu.edu.kz\|gmail" dist/` finds only the platform sign-up requirement text.
- **Book.** Every H3 anchor in CONTENT-V3 links resolves, for example `/handbook#privacy-on-this-site`. The TOC keyboard walk-through works.
- **Page weight.** Lighthouse mobile on `/handbook` reaches LCP ≤ 2.5 s and CLS ≤ 0.05. The page does not load the three.js chunk until idle, so text renders first.

---

### WP11: Kazakh fonts and global CSS (runs in parallel with WP0)

**Owns**
- `src/styles/global.css`
- `src/styles/fonts.preload.json`
- `public/fonts/**`
- `scripts/check-fonts.mjs`

**Tasks**
- **Build the subsets** with `pyftsubset` / `fonttools varLib.instancer`, keeping the source TTFs for reference under `public/fonts/src/`, which is not deployed. The deployed WOFF2 files are:
  - `Inter-latin.woff2` and `Inter-cyrillic.woff2` (variable)
  - `Anton-latin.woff2`
  - `Oswald-600-cyrillic.woff2` (U+0400–04FF, U+2116, U+20B8)
  - `Caveat-latin.woff2` and `Caveat-cyrillic.woff2`
  - `Courgette-Regular.ttf`, unchanged, for 3D
- **`@font-face` rules.** Declare these with `unicode-range`. Oswald is declared as family `"Anton"` for the Cyrillic range (D6).
- **`:lang(kk)` tweaks.**
  - `u-h1` / `u-h1-small` letter-spacing `+0.01em`.
  - If a measured bleed overflows, scale `u-h1` by `0.92` for `:lang(kk)`.
  - Triptych titles get `hyphens: manual`.
- **Preload manifest.** `fonts.preload.json` has the shape `{ "common": [...], "home": ["/fonts/Courgette-Regular.ttf"], "kk": ["/fonts/Oswald-600-cyrillic.woff2", "/fonts/Inter-cyrillic.woff2"] }`.
- **`check-fonts.mjs`.** Reads the cmap of every CSS face and fails if any Kazakh letter (Ә ә Ғ ғ Қ қ Ң ң Ө ө Ұ ұ Ү ү Һ һ І і plus А–я) is missing from the face that its `unicode-range` claims. Reuse `research/codebase/cmap-check.mjs` logic.

**Acceptance**
- `pnpm check` passes.
- **EN unchanged.** EN screenshots of every section differ from v2 by ≤ 0.5% pixels, from font subsetting only.
- **KK coverage.** The KK pages show no fallback glyphs, checked with a screenshot of a test string in every face.
- **Preload budget.** Total preloaded fonts are ≤ 700 KB on EN home and ≤ 800 KB on KK home (v2: 1.57 MB).

---

### WP12: QA, performance, docs, cleanup, deploy (last)

**Owns**
- `scripts/check-content.mjs`, `scripts/perf.mjs`, `scripts/shots.mjs`
- `perf/**`
- `README.md`, `docs/DESIGN-SPEC.md`, `docs/JOURNEY-SPEC.md`
- Deletes `src/content.ts`

**Tasks**
- **`check-content.mjs`.** Fails if `src/**` or `dist/**/*.html` contains any of:
  - old names: `Qairu AI`, `AI Fridays`, `Qairu Space`, `Qairu Hackathons`, `Qairu Accelerator`
  - slop words: `empower`, `unleash`, `supercharge`, `revolutioni`, `cutting-edge`, `seamless`
  - private data: `gmail.com`, `+7 7`
  - private handles and names: every entry in `scripts/private-denylist.txt`, one per line. This file is **git-ignored and never committed**; build it locally from the private roster kept outside the repo. The check is skipped with a warning if the file is missing.
  - `t.me/+` (private invite links)
- **Screenshots.** `shots.mjs`: EN + KK × desktop 1440 + mobile 390 for every section and page, saved to `shots/v3/`.
- **Performance.** Run `perf.mjs` by section id, not scroll percentage, on the user's real GPU (medium tier), plus a Lighthouse mobile run on `/`, `/kk/`, `/handbook`.
- **Docs.**
  - DESIGN-SPEC section list.
  - JOURNEY-SPEC v3 constants, from the WP1 tables, fixing the old material drift.
  - README "where things live", i18n and deploy.
- **Cleanup.** Delete `src/content.ts` once `grep -R "content'" src` is empty. Keep news card 1 on the verified body unless the BAITC title has been confirmed in writing.
- **Deploy.** Run the checklist in §6.

**Acceptance.** All of §5 (perf budget) and §6 (deploy checklist) pass, and the eval report and shots are committed.

---

## 4. File ownership index

| Path | Owner |
|---|---|
| `index.html`, `src/main.tsx`, `src/App.tsx`, `src/i18n/**`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.production`, `.dev.vars.example`, `public/_headers`, `public/_redirects`, `scripts/build-html.mjs` | WP0 |
| `src/components/ui/{Button,Section,Grid,Reveal,Pill,AnimatedBorder,icons}.tsx` | WP0 |
| `src/sections/SkyScene.tsx`, `src/sections/Hero.tsx`, `src/sections/hero.i18n.ts`, `src/sections/sky/**`, `src/components/three/**` | WP1 |
| `src/sections/{Header,Footer}.{tsx,css}`, `header.i18n.ts`, `footer.i18n.ts`, `src/components/ui/Wordmark.tsx` | WP2 |
| `src/sections/AgenticCards.{tsx,css}`, `launchpad.i18n.ts`, `src/assistant/**` | WP3 |
| `functions/**`, `migrations/**`, `shared/**`, `wrangler.toml`, `scripts/{build-book,eval-ask}.mjs`, `scripts/eval-ask.cases.json`, generated `src/data/handbook.generated.ts` and `public/handbook-index.json`, `perf/ask-eval-*.json` | WP4 |
| `src/sections/{Logos,Waitlist,Supersize,ModelsCTA,Integrations}.*`, `SupersizeWipe.css`, `{ecosystem,waitlist,supersize,cta,tools}.i18n.ts`, `src/components/ui/{LogoMark.tsx,LogoMark.css,AutoCarousel.tsx}` | WP5 |
| `src/sections/ProductDemo.{tsx,css}`, `platform.i18n.ts`, (delete) `productDemo.content.ts` | WP6 |
| `src/sections/Features.{tsx,css}`, `offer.i18n.ts`, (delete) `features.content.ts` | WP7 |
| `src/sections/{Projects,News}.{tsx,css}`, `{projects,news}.i18n.ts`, `src/data/{projects,news}.ts`, `src/components/ui/Carousel.tsx` | WP8 |
| `src/sections/{Storytelling,DemoForm}.{tsx,css}`, `{story,form}.i18n.ts`, `src/lib/{submit,turnstile}.ts` | WP9 |
| `src/pages/**`, `src/data/members.ts` | WP10 |
| `src/styles/**`, `public/fonts/**`, `scripts/check-fonts.mjs` | WP11 |
| `scripts/{check-content,perf,shots}.mjs`, `perf/**` (except `perf/ask-eval-*.json`), `README.md`, `docs/DESIGN-SPEC.md`, `docs/JOURNEY-SPEC.md`, (delete) `src/content.ts` | WP12 |
| `src/lib/{SmoothScroll.tsx,scroll.ts,ticker.ts,ease.ts,media.ts,ttf.ts}` | unchanged; WP1 may edit `ttf.ts`/`ticker.ts` only if strictly needed, and nobody else touches them |
| `docs/{HANDBOOK,CONTENT-V3,CONTENT-V3.kk,AGENT-SPEC,V3-BUILD-PLAN,ORG-PROFILE-README}.md` | synthesis lead (content changes go through the user) |

---

## 5. Performance budget

| Metric | Budget | v2 reference |
|---|---|---|
| FPS hero (y 0–1.4 vh), real GPU, Intel UHD, medium tier | ≥ 55 | 52 |
| FPS mid-page (Offer, Projects, News) | ≥ 60 | 64–69 |
| FPS footer field | ≥ 52 | 52 |
| Long tasks after load | none > 200 ms; total ≤ 2 s over a full scroll | 397–460 ms max (headless) |
| Entry JS (app `index`) | ≤ 45 KB gzip (incl. both locales' strings) | 27 KB gzip |
| Assistant panel chunk | ≤ 20 KB gzip, lazy | — |
| Book page chunk | ≤ 40 KB gzip, lazy | — |
| three / r3f chunks | no growth | 185 / 72 KB gzip |
| Preloaded fonts | ≤ 700 KB EN · ≤ 800 KB KK | 1.57 MB |
| CLS | ≤ 0.05 | — |
| LCP, Lighthouse mobile, `/` | ≤ 3.0 s | — |
| TBT, Lighthouse mobile, `/` | ≤ 300 ms | — |
| New `backdrop-filter` layers | 0 | header menus + tab bar only |
| `/api/ask` first `delta` | ≤ 2.5 s p50 | — |
| Function CPU / request | ≤ 10 ms (excluding upstream wait) | — |

**Rules**
- Every new animated element pauses offscreen and under reduced motion.
- No runtime fetch that changes page height.
- Measure by section id.
- Always re-measure both ends of the page on the real GPU.

---

## 6. Deploy checklist

### 6.1 Needs the user (Claude must not do these)

1. **Rotate the OpenAI key that was pasted in chat.**
   - Revoke it in the OpenAI dashboard and create a new project key.
   - Set a hard **monthly budget**; $20 is suggested.
2. **Choose where the key lives, then set it.**
   - Pages secret: `npx wrangler pages secret put OPENAI_API_KEY --project-name qairuhub-landing` (production). Repeat with `--env preview` if previews should use AI.
   - Or, matching the user's existing setup: update the Secrets Store secret `chatgpt-api` with the rotated key and approve the proxy Worker path (AGENT-SPEC §10.4 B).
3. **Create the Turnstile widget.** Cloudflare dashboard → Turnstile → Add widget.
   - Hostnames: `qairuhub-landing.pages.dev`, plus a custom domain if one is added. Mode: **Managed**.
   - Put the **site key** (public) in `.env.production` as `VITE_TURNSTILE_SITE_KEY`.
   - Set the **secret**: `npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name qairuhub-landing`.
4. **Confirm the open facts** in `open-questions.md`:
   - Sanzhar Madiyev's title
   - builders list consent (`SHOW_BUILDERS`)
   - the snail Q artwork file
   - which registration channel is canonical (Google Form vs `/api/join`)
   - who reads submissions, and how fast
   - when `tairqaldy/qairuhub-landing-clean` goes public
   - whether this landing will serve `qairuhub.com`
   - whether the 56 Club Fair registrations figure may be public (Book timeline)
5. **Kazakh review.** A native speaker (Media & Socials suggested) reviews every `<!-- review -->` line in `CONTENT-V3.kk.md`. Until then `/kk/` can deploy but must not be promoted (open-questions G1).
6. **Publish the org profile README.** Create the public repo `qairuhub/.github` and add `profile/README.md` from `docs/ORG-PROFILE-README.md`. This is a write action on the org.

### 6.2 Claude can run with the user's wrangler login (deploys to `qairuhub-landing` were authorised)

1. `pnpm install && pnpm check && pnpm build`
2. `npx wrangler d1 create qairuhub-landing` → paste the id into `wrangler.toml` → `npx wrangler d1 migrations apply qairuhub-landing --remote` (ask the user once before creating the database)
3. **Generated secrets.** Pipe `openssl rand -base64 32` into `npx wrangler pages secret put SESSION_SIGNING_KEY --project-name qairuhub-landing`, and do the same for `RATE_LIMIT_SALT`. Never print or commit the values.
4. **Local smoke test.** `.dev.vars` (git-ignored) holds the dev key, then `pnpm dev:api` and `pnpm eval:ask`, which must pass §WP4.
5. `pnpm deploy`

### 6.3 Post-deploy smoke test (on `https://qairuhub-landing.pages.dev`)

**Routes and headers**
- `/`, `/kk/`, `/members`, `/kk/members`, `/handbook` and `/kk/handbook` each return 200 with the correct `lang` and hreflang.
- `/nope` returns 404.
- `/kk` returns 301 → `/kk/`.
- Headers include the CSP. The DevTools console shows no CSP violations on any route, including a Turnstile render.

**Ask endpoint**
- One EN question and one KK question stream correctly.
- A 7th question within a minute gets 429.
- Setting `ASK_ENABLED=false` as a Pages var and redeploying gives offline answers; revert it afterwards.

**Forms**
- The join form with Turnstile creates a D1 row: `npx wrangler d1 execute qairuhub-landing --remote --command "select kind, locale, interest, created_at from submissions order by created_at desc limit 3"`. Don't select personal columns in shared terminals.
- The waitlist works, and a duplicate email still shows success.

**Performance and quality**
- FPS on the user's laptop meets §5 targets.
- Lighthouse mobile meets the §5 budgets.
- axe finds no serious issues on `/`, `/kk/`, `/handbook`.

**Rollback**
- Cloudflare dashboard → Pages → `qairuhub-landing` → Deployments → roll back.
- For the assistant alone: set `ASK_ENABLED=false` and redeploy.
