# Performance

How the landing page loads, what the v3.1 loading work changed, and how to measure it again.

The audits this came from are `perf/v3.1/audit-loading.md` (front end) and
`perf/v3.1/audit-api-deps.md` (Functions, dependencies); the implementation notes are in
`perf/v3.1/loading-implementation.md`. Everything below was measured on the Windows reference
machine (Intel UHD Graphics, ANGLE/D3D11) against a local `wrangler pages dev` server.

---

## What changed

| # | Change | Where |
|---|---|---|
| L1 | Shader warm-up: the canvas stays on `frameloop="never"` until every program of the first frames reports `COMPLETION_STATUS_KHR`, then fades in over 700 ms. three otherwise links each program synchronously on first use, which blocked the main thread for ~1 s. | `src/sections/sky/warmup.ts`, `src/sections/SkyScene.tsx` |
| L2 | The sky chunk (three + r3f, ~260 KB) is requested only after the first contentful paint, so it is no longer an LCP dependency. Sub-pages wait for `load` **and** the paint. The wordmark TTF moved to its own chunk. | `src/App.tsx`, `src/lib/schedule.ts`, `src/sections/sky/wordmarkFont.ts` |
| L3 | Sections below the fold mount in 8 batches, one task each, at `background` priority until the reader shows intent to move. A deep link or a reload renders everything at once so the anchor target exists immediately. | `src/App.tsx`, `src/lib/schedule.ts` |
| L4 | The sub-page backdrop placeholder uses the night palette, so there is no light→dark step before the canvas appears. | `src/sections/sky/fallback.ts` |
| L5–L8 | The wordmark geometry is built one glyph per task; canvas layers mount one task at a time; the night field and the cloud atlas bake only after the reveal. | `src/sections/sky/*` |
| L9 | The GPU class probe result is cached in `localStorage` (`qh.gpu`), so a second page view creates one WebGL context instead of two. | `src/sections/sky/quality.ts` |
| L10 | Per-page font preloads. The EN home preload budget went from 287 KB to 116.6 KB; `members` / `handbook` / `404` now preload the Courgette wordmark face, which is their LCP element. | `src/styles/fonts.preload.json`, `scripts/build-html.mjs` |
| L19 | The sub-page Suspense fallback is a heading-block skeleton, revealed only after 300 ms so a fast chunk never flashes it. | `src/components/ui/PageSkeleton.tsx` |
| L22 | One shared `IntersectionObserver` per option set instead of one per revealed element. | `src/components/ui/Reveal.tsx` |
| A2-01 | Every lazy island — the sky canvas, the sub-page, `ProductDemo`, the join form and the assistant panel — sits in a `ChunkBoundary`, so a chunk that fails to load replaces only that island instead of blanking the page. Verified with `perf/v3.1/scripts/audit-chunk-failure.mjs`: blocking the `three`, `r3f`, `MembersPage`, `HandbookPage`, `ProductDemo` or `Assistant` chunk leaves the header, footer and launcher alive in every case. A sub-page chunk error can reload the tab at most once per 5 minutes and never in the first 30 s. | `src/App.tsx`, `src/components/ui/ChunkBoundary.tsx`, `src/components/ui/chunkReload.ts` |
| A2-04/10 | `Answer`, `AskBar` and each Markdown block are memoised, and the store exposes a selector hook, so a streaming answer no longer re-renders the whole panel. | `src/assistant/*` |
| A2-05 | `/api/ask` does the per-IP and global rate-limit counters in **one** D1 batch instead of two round trips. | `functions/_lib/ratelimit.ts`, `functions/api/ask.ts` |
| A2-06 | `GET /api/config` is cacheable (`max-age=300, stale-while-revalidate=600`). **Rollout order matters** — see the doc comment in `functions/api/config.ts`. | `functions/api/config.ts` |
| A2-07 | SSE deltas are coalesced (flush after 50 ms or 160 chars), which cut a 2400-character answer from 379 events / 13.9 KB to 97 events / 5.7 KB. | `functions/api/ask.ts` |
| A2-08 | `counters` is `WITHOUT ROWID`. Apply with the deploy: `npx wrangler d1 migrations apply qairuhub-landing --remote`. | `migrations/0002_counters_without_rowid.sql` |

---

## Lighthouse: before / after

Lighthouse 12, two runs per cell, medians. "Before" is the build deployed at `f1e323a`
(`perf/v3.1/lighthouse/<page>-<preset>-r<n>.json`), "after" is this build
(`…-<preset>-after-r<n>.json`). Both were served by `wrangler pages dev` so the responses are
brotli-compressed — see the warning under *Re-measuring*.

### Mobile (Lighthouse default: Moto G Power, simulated Slow 4G, 4× CPU)

| page | score | FCP ms | LCP ms | TBT ms | Speed Index ms | TTI ms | transfer KiB |
|---|---|---|---|---|---|---|---|
| home | **41 → 92** | 3129 → 2182 | 5750 → 3030 | 3270 → 73 | 4643 → 2878 | 8431 → 5328 | 763 → 769 |
| kk | **38 → 93** | 3332 → 1825 | 6642 → 2875 | 3609 → 104 | 5129 → 3056 | 9542 → 5973 | 874 → 880 |
| members | **51 → 77** | 2769 → 2099 | 4675 → 3709 | 2053 → 442 | 2780 → 2309 | 6618 → 5205 | 697 → 704 |
| handbook | **48 → 65** | 2566 → 2191 | 5197 → 5277 | 2358 → 511 | 2566 → 2210 | 6892 → 5316 | 715 → 722 |

### Desktop (`--preset=desktop`: 1350×940, simulated 10 Mbps / 40 ms, 1× CPU)

| page | score | FCP ms | LCP ms | TBT ms | Speed Index ms | TTI ms |
|---|---|---|---|---|---|---|
| home | **65 → 99** | 713 → 506 | 1162 → 671 | 1204 → 0 | 1840 → 1039 | 2368 → 671 |
| kk | **64 → 99** | 710 → 426 | 1323 → 624 | 1125 → 0 | 1881 → 1060 | 2431 → 624 |
| members | **72 → 99** | 556 → 471 | 815 → 748 | 769 → 76 | 976 → 762 | 1830 → 1041 |
| handbook | **78 → 98** | 687 → 498 | 1071 → 1058 | 453 → 18 | 899 → 724 | 1476 → 1058 |

CLS stays 0.000 everywhere. Transfer grows by ~6 KiB per page (the wordmark font chunk and the
skeleton). The mobile home LCP is now the header's "Open platform" label with a 2566 ms render
delay, down from 5285 ms.

Still open: **handbook mobile is the weakest page** (65). Its LCP element is the page `<h1>`,
which waits for the 81 KB `HandbookPage` chunk, and the chunk's own mount is a ~450 ms long
task. `content-visibility` on the handbook sections (audit item L21) was measured and rejected —
see *Measured and rejected* below.

### Independently re-measured

The whole matrix was run a second time, from a clean build, by a different pass
(`--tag=-verify`, `perf/v3.1/lighthouse/<page>-<preset>-verify-r<n>.json`). Every cell reproduced
within run-to-run noise, so the numbers above are not a one-off:

| page | mobile score (after / verify) | desktop score (after / verify) |
|---|---|---|
| home | 92 / **91** (LCP 3030 / 2887, TBT 73 / 139) | 99 / **99** |
| kk | 93 / **90** (LCP 2875 / 2893, TBT 104 / 202) | 99 / **99** |
| members | 77 / **77** (LCP 3709 / 3777) | 99 / **99** |
| handbook | 65 / **66** (LCP 5277 / 5345) | 98 / **98** |

CLS is 0.000 in all 16 verification runs.

## Wordmark reveal

Real Chrome, real GPU (Intel UHD / ANGLE D3D11), a **fresh browser profile per run** so the shader
cache and `qh.gpu` are cold, medians of 3 runs, `node perf/v3.1/scripts/measure-reveal.mjs`.

Both builds are served the same way here — `wrangler pages dev` on this machine, the old build
from a copy of its `dist/` — so this is a like-for-like A/B. (An earlier version of this table
compared the local new build against production **over the network**, which flattered the new
build; those numbers are superseded.)

| | before (`f1e323a` build, local) | after (this build, local) |
|---|---|---|
| laptop 1440×900 — FCP | 536 ms | 484 ms |
| laptop 1440×900 — canvas in the DOM | 550 ms | 1027 ms |
| laptop 1440×900 — first on-screen frame | 1174 ms | 2361 ms |
| laptop 1440×900 — scene readable (opacity ≥ 0.5) | 1174 ms (hard pop) | 2625 ms |
| laptop 1440×900 — fully opaque | 1174 ms | 3046 ms (700 ms fade) |
| phone 390×844, 4× CPU — FCP | 1396 ms | 644 ms |
| phone 390×844, 4× CPU — first on-screen frame | 2993 ms | 2458 ms |
| phone 390×844, 4× CPU — scene readable | 2993 ms (hard pop) | 2851 ms |
| phone 390×844, 4× CPU — fully opaque | 2993 ms | 3212 ms |

Reading it: **on the phone the new build wins outright** — first paint at 0.6 s instead of 1.4 s,
and the sky appears a little sooner too. **On a fast laptop the hero appears about 1.4 s later
than before.** Two independent causes, both deliberate:

- ~480 ms because the sky chunk is only requested after the first contentful paint (L2). That is
  what buys the LCP and TBT wins above.
- ~700 ms because `<Warmup>` holds `frameloop="never"` until *every* program of the first frames
  is linked, including the wordmark's transmission variant and the PMREM programs
  (`SkyScene.tsx`, the `<Warmup … onReady>` gate). Measured split: the unlit layers alone are
  ready ~720–910 ms after the canvas mounts (`/members`, no wordmark); with the wordmark it is
  ~1120 ms.

Nothing is blank in the meantime — the CSS gradient in the page's own first palette is painted
from the first frame — but the 3D wordmark is the hero of the home page, so this is a visible
trade, not a free win. Audit item **L15** (reveal the dome/stars/clouds as soon as their programs
link, fade the wordmark in separately) would give roughly the second 700 ms back and is still
open; it needs design sign-off because it changes the choreography of the reveal.

## GPU buffer budget (the Intel Mac bug)

Every WebGL vertex/index buffer must stay **≤ 512 KiB** — an Intel iMac corrupted the wordmark
past 1 MiB uploads. Measured on this build, with the failure model active (every byte past 1 MiB
of an upload dropped), largest upload per tier:

| viewport | `q=low` | `q=medium` | `q=high` |
|---|---|---|---|
| 1440×900 | 353,232 B | 384,000 B | **512,000 B** |
| 390×844 | 353,232 B | — | — |

No page errors at any tier, and the wordmark is intact in every hero and footer screenshot.

## Verified unchanged

- Document height 17627 px at 1440 and 17611 px at 390, identical to the deployed build.
- `/#platform`, `/#join`, `/#news`, `/#launchpad` all land with the target at exactly 72 px, at
  both viewports, with the same scroll positions as the deployed build.
- Hero, mid page, footer, `/members` and `/kk/` are **pixel-identical** to production at 1440×900
  and 390×844 (reduced motion, so the diff measures the design and not the animation phase):
  0.000 % differing pixels in all ten cases, 0 page errors on either side.
- A lazy chunk that fails to load never blanks the page. `audit-chunk-failure.mjs` blocks
  `three`, `r3f`, `MembersPage`, `HandbookPage`, `ProductDemo` and `Assistant` in turn: in every
  case `#root` keeps 5 children and the header, footer and Ask Q launcher stay alive, with no
  uncaught page error.
- `GET /api/config` is served from the browser cache on a second view (transfer 345 B → 0 B), and
  the chunk-error reload guard fires exactly once: no reload at t≈4 s, one at t≈36 s, none for the
  two failures after it.

---

## Measured and rejected

- **L21, `content-visibility: auto` on the handbook's article sections.** The idea was that the
  handbook's ~50 000 px article is laid out in one 448 ms task, which delays the page's own `<h1>`
  (its LCP element). Measured as a same-session A/B, 3 Lighthouse mobile runs per build against two
  local servers: median score 67 → 68, **LCP 5329 → 5330 ms**, TBT 431 → 394 ms (run spread
  424–451 vs 367–451), TTI and CLS unchanged. The LCP is dominated by downloading and mounting the
  81 KB `HandbookPage` chunk, not by laying the article out, so skipping the layout buys nothing.
  The cost is real: the document height starts at 41 406 px and grows to 50 810 px as the reader
  scrolls through it for the first time, so the scrollbar shrinks under a Lenis-smoothed read.
  Reverted. The lever that would actually move this number is getting the intro block (with the
  `<h1>`) to paint without the article — a separate chunk for `handbook.generated`, or the intro in
  the HTML shell that `scripts/build-html.mjs` already writes.

---

## Re-measuring

Everything runs against a local server. Start one first — and it **must compress**:

```sh
npm run build
npx wrangler pages dev dist --port 8805
```

`perf/v3.1/scripts/mac-static-server.mjs` does *not* compress, and Lighthouse's Lantern model then
inflates simulated FCP/LCP by roughly 1.5 s (that alone scored home mobile 72 instead of 92).

| What | Command |
|---|---|
| Lighthouse matrix (4 pages × mobile/desktop × 2 runs) | `node perf/v3.1/scripts/run-lighthouse.mjs --runs=2 --base=http://127.0.0.1:8805 --tag=-after` |
| Tables + JSON summary for a tag | `node perf/v3.1/scripts/summarize-lighthouse.mjs --tag=-after` (omit `--tag` for the baseline) |
| Wordmark reveal milestones | `node perf/v3.1/scripts/measure-reveal.mjs http://127.0.0.1:8805 laptop-1440 1440 900 1 3` and `… phone-390 390 844 4 3` |
| Same, pixel-based (build-agnostic, for production) | `node perf/v3.1/scripts/measure-wordmark.mjs https://qairuhub.com prod 1440 900 1 3` |
| One screenshot at a fixed delay (no capture before it) | `node perf/v3.1/scripts/filmstrip.mjs http://127.0.0.1:8805 film 1440 900 1 800,1500,2000,3000` |
| Visual parity against production | `node perf/v3.1/scripts/compare-visual.mjs http://127.0.0.1:8805 v31` |
| Deep-link landing + document height | `node perf/v3.1/scripts/check-deeplinks.mjs http://127.0.0.1:8805 1440 900` |
| Behaviour when a lazy chunk 404s | `node perf/v3.1/scripts/audit-chunk-failure.mjs http://127.0.0.1:8805` |
| Assistant chunk boundaries / reload guard | `node perf/v3.1/scripts/audit-assistant-chunk.mjs`, `audit-chunk-reload.mjs` (~75 s: it waits out the 30 s guard) |
| `/api/config` browser caching | `node perf/v3.1/scripts/audit-config-cache.mjs` |

Notes for whoever runs these:

- Headed Playwright must use the installed Chrome — `chromium.launch({ channel: 'chrome',
  headless: false })`. The bundled Chromium fails to spawn here, and headless falls back to
  software GL, which is not what the sky runs on.
- Force a quality tier with `?q=low|medium|high`; phones and machines with ≤ 4 cores get `low`.
- Chrome caches linked shader programs per profile, so repeat runs on one machine are optimistic.
  The reveal scripts launch a fresh profile per run for exactly that reason.
- From Kazakhstan this ISP intermittently drops TLS to some Cloudflare anycast addresses. Every
  script here passes `--host-resolver-rules=MAP qairuhub.com 188.114.97.1` so production runs work.
- Lighthouse on Windows exits `1` with an `EPERM` while deleting its temp profile *after* the
  report has been written. The JSON is complete; ignore the exit code.
- **Check the matrix before you believe it.** `wrangler pages dev` can die part-way through a
  16-run matrix; Lighthouse then writes a report whose only content is
  `runtimeError.code = "CHROME_INTERSTITIAL_ERROR"`. `run-lighthouse.mjs` skips any output file
  that already exists, so a re-run will not replace it, and `summarize-lighthouse.mjs` folds it
  into the medians as a 0. After a matrix, run:

  ```sh
  node -e "for(const p of['home','kk','members','handbook'])for(const f of['mobile','desktop'])for(const r of[1,2]){const n='perf/v3.1/lighthouse/'+p+'-'+f+'-<tag>-r'+r+'.json';const j=require('./'+n);if(j.runtimeError)console.log('BROKEN',n,j.runtimeError.code)}"
  ```

  and delete whatever it names before re-running.
- Kill the server when you are done (`npx wrangler pages dev` holds the port).
