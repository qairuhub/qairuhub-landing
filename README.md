# QairuHub landing (v3)

The public landing of **QairuHub**, a Kazakhstan tech community born at QAIRU (Astana). One page tells the story (Launchpad, ecosystem, QairuHub Accelerator, the platform, what we offer, projects, news, join), two sub-pages carry the details (Members, the QairuHub Handbook), and **Q**, a small assistant, answers questions from the Handbook. English and Kazakh ship together.

Design: the "Air" style (one sans at 500, compressed uppercase display, one cursive accent word per headline, ghost/white buttons, flat translucent cards, radii 4/8/11/12, no shadows) over one continuous scroll-driven WebGL **journey**: space, a descent through the clouds, the day sky, dusk, and a moonlit field with the frosted-glass `qairuhub` wordmark.

Live: https://qairuhub-landing.pages.dev (Cloudflare Pages project `qairuhub-landing`).

## Stack

| Layer | Choice |
|---|---|
| App | Vite 8 (Rolldown) + React 19 + TypeScript strict. One SPA bundle, no router library |
| Styling | Tailwind CSS v4 (`@theme` tokens in `src/styles/global.css`) + per-section CSS |
| Scroll + motion | Lenis (`src/lib/SmoothScroll.tsx`), one shared rAF ticker (`src/lib/ticker.ts`) |
| 3D backdrop | three r186 + @react-three/fiber 9 + drei 10: one fixed canvas (`src/sections/SkyScene.tsx`), lazy-loaded after first paint |
| Backend | Cloudflare Pages Functions (`functions/`) + D1 + Turnstile (optional) + the internal Worker `qairuhub-edge` (`edge/`) for OpenAI |
| QA | Playwright scripts in `scripts/` |

## Run

```bash
pnpm install
pnpm dev            # http://localhost:5173 (proxies /api to :8788)
pnpm typecheck      # app; `pnpm typecheck:functions` for functions/
pnpm build          # handbook pipeline → tsc (app + functions) → vite build → per-route HTML
pnpm preview        # http://localhost:4173 (static dist, no /api, no real 404 status)
pnpm dev:api        # wrangler pages dev dist --port 8788: the built site + Functions + local D1
```

### QA scripts

| Command | What it checks |
|---|---|
| `pnpm check` | `check-content.mjs` (below) + `check-fonts.mjs` (every Kazakh letter exists in the face its `unicode-range` claims) |
| `node scripts/check-content.mjs [--dist]` | Fails on old names (Qairu AI, AI Fridays, Qairu Space, Qairu Hackathons, Qairu Accelerator, Qairu Book), slop words, `gmail.com`, `+7 7…` phone numbers, `t.me/+` invite links and every entry of `scripts/private-denylist.txt`, across `src/`, `functions/`, `shared/`, `edge/src/` and `dist/` |
| `pnpm test:routes` | The route contract in `src/i18n/locale.ts` |
| `node scripts/shots.mjs [baseUrl] [outDir]` | EN + KK × 1440×900 + 390×844 screenshots of home (every 900 px and every section id), `/members`, `/handbook`, `/kk/members`, `/kk/handbook`, `/nope`; reports HTTP status, `lang`, console errors and horizontal overflow into `<outDir>/report.json` (default `shots/v3`, git-ignored) |
| `node scripts/perf.mjs [url] --headed [--tier=medium] [--out=perf/<name>.json]` | FPS at the hero, at every section id and at the footer, wheel-scroll FPS, long tasks, CLS, plus the bundle and font-preload budgets from `dist/`. Budgets: `docs/V3-BUILD-PLAN.md` §5. Only `--headed` runs on the real GPU count; headless is software GL. `--bundle-only` skips the browser |
| `pnpm eval:ask [--base url]` | Q's 20-case evaluation against a running `/api/ask`; writes `perf/ask-eval-<date>.json` |

`scripts/private-denylist.txt` is **git-ignored and never committed**. Build it locally from the private roster (Telegram usernames and emails, one per line). Without it, `check-content` prints a warning and skips that rule. Its matches are reported by entry number, never by value.

### Debugging the backdrop

- `?q=high|medium|low` forces a quality tier (`src/sections/sky/quality.ts`).
- In dev the r3f root state is `window.__sky`; `window.__lenis` is the scroll instance.
- `prefers-reduced-motion` renders a static frame that still follows the scroll; a hidden tab pauses the loop.

## Routes

| URL | Page | Locale | Built file |
|---|---|---|---|
| `/` | home | en | `dist/index.html` |
| `/kk/` | home | kk | `dist/kk/index.html` |
| `/members` | members | en | `dist/members.html` |
| `/kk/members` | members | kk | `dist/kk/members.html` |
| `/handbook` | handbook | en | `dist/handbook.html` |
| `/kk/handbook` | handbook | kk | `dist/kk/handbook.html` |
| anything else | notFound (404 status) | by prefix | `dist/404.html`, `dist/kk/404.html` |

- `main.tsx` resolves the route once per load with `parseRoute(location.pathname)` and puts `{ locale, page, base }` in `<RouteProvider>`. Components read it with `useRoute()`.
- Switching page or locale is a plain `<a href>`: a full navigation, so WebGL, Lenis and the journey stay one-document-per-load.
- `scripts/build-html.mjs` runs after `vite build` and writes one HTML file per route with its own `lang`, title, description, canonical, hreflang (`en`, `kk`, `x-default`), `og:*` and font preloads. Titles and descriptions come from `src/i18n/meta.json`; preloads from `src/styles/fonts.preload.json`.
- `public/_redirects` sends `/kk` to `/kk/` (301). `public/_headers` sets the CSP and security headers.
- Sub-pages (`src/pages/`) are lazy chunks. They show a static night sky (404: the space preset) with no wordmark, no field and no Courgette download.

## i18n

- English at `/`, Kazakh at `/kk/`. In-page anchors carry the base: `/#offer`, `/kk/#offer`.
- Every section owns a dictionary next to it: `src/sections/<section>.i18n.ts` exports `text = { en, kk } satisfies Dict<SectionText>`, so TypeScript fails the build if a Kazakh string is missing. Components call `const t = useT(text)`.
- A headline is one string with at most one `*accent*` word; `<Accent text>` (`src/i18n/Accent.tsx`) renders it as the cursive `<i>`.
- Locale-invariant data (brand, external links, section ids, ecosystem and tool wordmarks, form option values) lives in `src/i18n/shared.ts`.
- The wordmark stays Latin `qairuhub` in both locales.
- The switcher stores `localStorage['qh.locale']`. Only a bare `/` entry with stored `kk` and no same-origin referrer redirects to `/kk/`; there is no `navigator.language` sniffing.
- Kazakh display text uses Oswald 600 through `unicode-range` inside the `"Anton"` family, so English keeps Anton. Fonts ship as WOFF2 subsets in `public/fonts/`.
- The Handbook body is English only for now; `/kk/handbook` shows a Kazakh note above it.

## Where copy lives

| What | Where |
|---|---|
| Source of truth for every visible string (EN / KK) | `docs/CONTENT-V3.md`, `docs/CONTENT-V3.kk.md` (the KK file keeps `<!-- review -->` markers for a native-speaker pass) |
| Section strings in code | `src/sections/*.i18n.ts` (header, hero, launchpad, ecosystem, waitlist, supersize, platform, offer, projects, news, cta, tools, story, form, footer) |
| Page strings | `src/pages/*.i18n.ts` (members, handbook, notFound) |
| Assistant UI strings | `src/assistant/assistant.i18n.ts` |
| Projects, news, members data | `src/data/projects.ts`, `src/data/news.ts`, `src/data/members.ts` |
| Titles and meta descriptions | `src/i18n/meta.json` |
| Links, brand, ecosystem and tool names | `src/i18n/shared.ts` |
| Facts, FAQ, Q's knowledge | `docs/HANDBOOK.md` |

Copy rules: verified claims only; banned words (empower, unleash, supercharge, revolutionize, cutting-edge, seamless, …); program names are **QairuHub Demo Day** and **QairuHub Accelerator**; ecosystem names are never labelled partner or sponsor; no emails, phones, personal handles or invite links on any page. `pnpm check` enforces the machine-checkable part.

`src/content.ts` is the v2 copy file. Nothing new may import it; it is deleted once no section does.

## The QairuHub Handbook pipeline

`scripts/build-handbook.mjs` (first step of `pnpm build`, or `pnpm build:handbook`) reads `docs/HANDBOOK.md`:

- every `### H3` is one chunk (its `## H2` kept as the section; a `<!-- kw: … -->` line adds keywords; chunks over 320 words split with a 40-word overlap);
- it renders the markdown with a tiny built-in renderer (headings, paragraphs, lists, tables, bold, code, allowlisted https links, anchors) and escapes all text;
- it **fails** on a chunk under 40 words, a missing `kw` line, a duplicate or missing anchor, any email / phone / personal handle / invite link, or an index over 120 KB.

Outputs (all git-ignored, regenerated by every build):

| File | Used by |
|---|---|
| `src/data/handbook.generated.ts` | `/handbook`: TOC + HTML with H3 anchors (slug = lowercase, strip non letters/digits/spaces/hyphens, spaces → hyphens) |
| `functions/_generated/handbook-index.json` | `/api/ask` retrieval, bundled into the Function |
| `public/handbook-index.json` | Q's client-side offline fallback, fetched lazily |

Search (tokeniser for EN / KK / RU, BM25F-lite ranking, selection, offline rendering) is one module, `shared/handbookSearch.ts`, used by the build, the Function and the client.

## Q, the assistant

- UI: `src/assistant/` (floating 56 px "Ask Q" launcher on every page, the panel, the Launchpad Ask bar, the snail-Q mark). The panel is a lazy chunk.
- Endpoint: `POST /api/ask` (`functions/api/ask.ts`) streams Server-Sent Events. It retrieves Handbook chunks, builds the system prompt (`functions/_lib/systemPrompt.ts`), calls the OpenAI Responses API and filters personal data out of the stream (`piiFilter.ts`). Full contract: `docs/AGENT-SPEC.md`.
- Upstream resolution (`functions/_lib/openai.ts`):
  1. `env.EDGE`, the service binding to the internal Worker **`qairuhub-edge`**;
  2. `env.OPENAI_API_KEY`, a Pages secret;
  3. otherwise offline mode: answers are rendered straight from the Handbook chunks.
- **`qairuhub-edge`** (`edge/wrangler.toml`, `edge/src/index.ts`) reads the OpenAI key from Cloudflare **Secrets Store** (secret `chatgpt-api`, binding `OPENAI_KEY`) at runtime. It has no workers.dev or preview URL, accepts only `POST /openai/responses`, adds the `Authorization` header, forwards to OpenAI and streams the response back unchanged. It never logs bodies. The key never appears in this repo, in `.dev.vars` examples, in logs or in the Pages project.
- Kill switch: set `ASK_ENABLED = "false"` in `wrangler.toml` `[vars]` and redeploy; Q answers offline.
- Limits (plain vars in `wrangler.toml`): `ASK_PER_IP_PER_MINUTE` 6, `ASK_PER_IP_PER_DAY` 40, `ASK_DAILY_CAP` 1500, plus model, reasoning effort, token and retrieval settings.

## Forms, D1 and Turnstile

- `POST /api/join` (`functions/api/join.ts`) takes both the join form and the Accelerator waitlist (`kind: "join" | "waitlist"`). The client seam is `src/lib/submit.ts`.
- **D1** database `qairuhub-landing`, binding `DB`, schema in `migrations/0001_init.sql`:
  - `submissions` (join + waitlist rows; a duplicate waitlist email still returns success; rows expire after `SUBMISSION_RETENTION_DAYS`, 180);
  - `counters` (rate limits and cost caps, keyed by a salted IP hash, never a raw IP).
- Every API route goes through `functions/api/_middleware.ts`: security headers, JSON only, body size cap, origin allowlist (`ALLOWED_ORIGINS`, previews matched by suffix).
- **Turnstile is configured at runtime, no client rebuild:**
  - `GET /api/config` returns `{ "turnstileSiteKey": string | null }` from the `TURNSTILE_SITE_KEY` var; `src/lib/turnstile.ts` reads it once, lazily, and loads the Turnstile script only when a key exists.
  - The server enforces Turnstile only when the `TURNSTILE_SECRET_KEY` secret is set.
  - Until then join, waitlist and ask are protected by a honeypot, a minimum fill time (≥ 2.5 s), the origin allowlist and per-IP D1 rate limits.
  - **To turn it on, in this order** — the site key must reach every browser before the server starts
    demanding a token, because `GET /api/config` is cached in the browser for `max-age=300` +
    `stale-while-revalidate=600`:
    1. create a Managed widget for `qairuhub-landing.pages.dev` in the Cloudflare dashboard, put the
       public site key in `wrangler.toml` `[vars] TURNSTILE_SITE_KEY`, and deploy. (With a
       `wrangler.toml` present, the file is the source of truth for plain vars.)
    2. wait at least 15 minutes, so no tab can still be holding the cached `{"turnstileSiteKey": null}`.
    3. only then set the secret: `npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name qairuhub-landing`.
    Doing 3 before 2 makes every visitor with the cached `null` key send no token while the server
    already enforces one: `/api/join` answers 403 `verify_failed` and `/api/ask` 403 `verify_required`
    until that cache runs out. To turn Turnstile off again, drop the secret first, then the site key.

### Configuration names

| Name | Kind | Set where |
|---|---|---|
| `SESSION_SIGNING_KEY`, `RATE_LIMIT_SALT` | Pages secret, random | generated at deploy and piped into `wrangler pages secret put`, never printed |
| `TURNSTILE_SECRET_KEY` | Pages secret | by the owner, when Turnstile is enabled |
| `OPENAI_API_KEY` | Pages secret, optional | only if the `EDGE` binding is not used |
| `chatgpt-api` | Secrets Store secret | Cloudflare dashboard; read only by `qairuhub-edge` |
| `TURNSTILE_SITE_KEY`, `ASK_*`, `OPENAI_MODEL`, `ALLOWED_ORIGINS`, … | plain vars | `wrangler.toml` `[vars]` |

Local development: copy `.dev.vars.example` to `.dev.vars` (git-ignored) and fill values locally. Never commit secret values.

## Deploy

Cloudflare Pages project `qairuhub-landing`, production branch `main`. Full checklist with the owner-only steps: `docs/V3-BUILD-PLAN.md` §6.

1. **Edge Worker first** (once, and whenever `edge/` changes):
   ```bash
   cd edge && npx wrangler deploy
   ```
2. **D1** (once):
   ```bash
   npx wrangler d1 create qairuhub-landing          # paste database_id into wrangler.toml
   npx wrangler d1 migrations apply qairuhub-landing --remote
   ```
3. **Generated secrets** (once): pipe a random value (for example `openssl rand -base64 32`) straight into `npx wrangler pages secret put SESSION_SIGNING_KEY --project-name qairuhub-landing`, and the same for `RATE_LIMIT_SALT`.
4. **Build and check:**
   ```bash
   pnpm install && pnpm check && pnpm build && node scripts/check-content.mjs --dist
   ```
5. **Deploy:** `pnpm deploy` (`wrangler pages deploy dist --project-name qairuhub-landing --branch main`).
6. **Smoke test** on https://qairuhub-landing.pages.dev:
   - all six routes return 200 with the right `lang` and hreflang; `/nope` returns 404; `/kk` returns 301 to `/kk/`;
   - no CSP violations in the console;
   - one EN and one KK question stream; a 7th question within a minute gets 429;
   - the join form creates a D1 row (query only non-personal columns: `kind, locale, interest, created_at`);
   - `node scripts/shots.mjs https://qairuhub-landing.pages.dev shots/v3-prod` reports no failures;
   - `node scripts/perf.mjs https://qairuhub-landing.pages.dev --headed --tier=medium --out=perf/perf-prod.json` on the Intel UHD laptop meets §5.
7. **Rollback:** Cloudflare dashboard → Pages → `qairuhub-landing` → Deployments → roll back. For Q alone, set `ASK_ENABLED = "false"` and redeploy.

## Where things live

```
docs/                     V3-DECISIONS (wins on conflict) · V3-BUILD-PLAN · CONTENT-V3(.kk) · HANDBOOK · AGENT-SPEC
                          DESIGN-SPEC (sections, type, components) · JOURNEY-SPEC (backdrop, v3 constants)
edge/                     qairuhub-edge Worker (Secrets Store → OpenAI proxy)
functions/                Pages Functions: api/{ask,join,config}.ts, api/_middleware.ts, _lib/*, _generated/ (git-ignored)
migrations/               D1 schema
shared/handbookSearch.ts  Handbook tokeniser, ranking, offline rendering
scripts/                  build-handbook · build-html · check-content · check-fonts · shots · perf · eval-ask · test-routes
public/                   fonts (WOFF2 subsets + Courgette TTF for the 3D wordmark), _headers, _redirects
src/main.tsx, App.tsx     route resolution, page switch, lazy SkyScene / pages / assistant
src/i18n/                 locale.ts (route contract), LocaleProvider (useRoute, useT), Accent, shared.ts, meta.json
src/sections/             one component + CSS + i18n per home section, in page order (see App.tsx)
src/sections/SkyScene.tsx the single WebGL canvas; sky/ holds journey.ts, quality.ts, GlassWordmark, clouds, stars, field
src/components/ui/        Button, Reveal, Section, Grid, Pill, AnimatedBorder, AutoCarousel, Carousel, Wordmark, LogoMark, icons
src/components/three/     GlassText (frosted glass lettering recipe + geometry cache), extrudeGlyphs
src/pages/                MembersPage, HandbookPage, NotFoundPage
src/assistant/            Q: launcher, panel, Ask bar, stream client, markdown, snail-Q mark
src/data/                 projects, news, members, handbook.generated.ts (git-ignored)
src/lib/                  SmoothScroll, scroll state, ticker, easing, media queries, ttf parser, submit, turnstile
src/styles/               global.css (tokens, type scale, buttons, .on-sky), fonts.preload.json
```

Customising:
- Colours, radii, fonts: `@theme` in `src/styles/global.css`.
- Sky colours: `PALETTE` in `src/sections/sky/journey.ts`; phase timings: `updateJourney` there (documented in `docs/JOURNEY-SPEC.md`).
- Wordmark size, thickness and exit motion: `BEVEL`, `HEIGHT`, `HERO`, `FOOTER` in `src/sections/sky/GlassWordmark.tsx`.
- Performance budgets per tier: `QUALITY` in `src/sections/sky/quality.ts`.
