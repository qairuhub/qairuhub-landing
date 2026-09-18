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
| L1 | Shader warm-up: the canvas stays on `frameloop="never"` until the programs of the first frames report `COMPLETION_STATUS_KHR` (since L15, the sky's programs — the wordmark has its own gate), then fades in over 700 ms. three otherwise links each program synchronously on first use, which blocked the main thread for ~1 s. | `src/sections/sky/warmup.ts`, `src/sections/SkyScene.tsx` |
| L2 | The sky chunk (three + r3f, ~260 KB) is requested only after the first contentful paint, so it is no longer an LCP dependency. Sub-pages wait for `load` **and** the paint. The wordmark TTF moved to its own chunk. | `src/App.tsx`, `src/lib/schedule.ts`, `src/sections/sky/wordmarkFont.ts` |
| L3 | Sections below the fold mount in 8 batches, one task each, at `background` priority until the reader shows intent to move. A deep link or a reload renders everything at once so the anchor target exists immediately. | `src/App.tsx`, `src/lib/schedule.ts` |
| L4 | The sub-page backdrop placeholder uses the night palette, so there is no light→dark step before the canvas appears. | `src/sections/sky/fallback.ts` |
| L5–L8 | The wordmark geometry is built one glyph per task; canvas layers mount one task at a time; the night field and the cloud atlas bake only after the reveal. | `src/sections/sky/*` |
| L9 | The GPU class probe result is cached in `localStorage` (`qh.gpu`), so a second page view creates one WebGL context instead of two. | `src/sections/sky/quality.ts` |
| L10 | Per-page font preloads. The EN home preload budget went from 287 KB to 116.6 KB; `members` / `handbook` / `404` now preload the Courgette wordmark face, which is their LCP element. | `src/styles/fonts.preload.json`, `scripts/build-html.mjs` |
| L19 | The sub-page Suspense fallback is a heading-block skeleton, revealed only after 300 ms so a fast chunk never flashes it. | `src/components/ui/PageSkeleton.tsx` |
| L22 | One shared `IntersectionObserver` per option set instead of one per revealed element. | `src/components/ui/Reveal.tsx` |
| L15 | The reveal is split in two: the sky (dome, stars, clouds) is revealed as soon as its programs are linked, and the glass wordmark switches on when its transmission + PMREM programs are. Two user-timing marks, `qh-sky-ready` and `qh-wordmark-ready`, make both stages readable in DevTools and in RUM. | `src/sections/SkyScene.tsx`, `src/sections/sky/warmup.ts`, `src/sections/sky/GlassWordmark.tsx` |
| A2-01b | If a sub-page chunk never arrives, the boundary now shows a sentence and a Reload button instead of the loading skeleton, which was indistinguishable from "still loading". EN/KK. | `src/components/ui/PageLoadFailed.tsx`, `src/components/ui/pageError.i18n.ts`, `src/App.tsx` |
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

Spot-checked again after the L15 split reveal (`--tag=-split`, then `--tag=-guard` for the two
desktop cells that changed): mobile 91 / 93 / 77 / 68 and desktop 100 / 99 / 99 / 99 — no cell moved
outside run-to-run noise. The first spot check *did* show desktop home and kk at 82; that is what
led to the software-renderer guard described under *Wordmark reveal*. CLS stays 0.000 everywhere. Transfer grows by ~6 KiB per page (the wordmark font chunk and the
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

| | before (`f1e323a`, local) | one-gate v3.1 (local) | split gate, shipped (local) |
|---|---|---|---|
| laptop 1440×900 — FCP | 536 ms | 484 ms | 376–424 ms |
| laptop 1440×900 — canvas in the DOM | 550 ms | 1027 ms | 979–1056 ms |
| laptop 1440×900 — sky programs linked (`qh-sky-ready`) | — | — | 1502–1658 ms |
| laptop 1440×900 — first on-screen frame | 1174 ms | 2361 ms | **1563–1731 ms** |
| laptop 1440×900 — canvas fully opaque | 1174 ms (hard pop) | 3046 ms | 2224–2393 ms |
| laptop 1440×900 — wordmark on screen (`qh-wordmark-ready`) | 1174 ms | ~2625 ms (at 50 % opacity) | **2328–2569 ms** |
| laptop 1440×900 — long tasks / total blocking | — | 60–76 ms / 18 ms | 51–101 ms / 40–58 ms |
| phone 390×844, 4× CPU — FCP | 1396 ms | 644 ms | |
| phone 390×844, 4× CPU — first on-screen frame | 2993 ms | 2458 ms | |

Medians of 3 runs, real GPU (Intel UHD / ANGLE D3D11), a **fresh browser profile per run** so the
shader cache and `qh.gpu` are cold, both builds served by `wrangler pages dev` on this machine —
`node perf/v3.1/scripts/verify-reveal-cold.mjs http://127.0.0.1:8805 1440x900 3`. (An earlier
version of this table compared the local new build against production **over the network**, which
flattered the new build; those numbers are superseded.) The two reveal stages are user-timing
marks, so they can also be read in DevTools or from RUM: `qh-sky-ready`, `qh-wordmark-ready`.

Reading it: **on the phone the new build wins outright** — first paint at 0.6 s instead of 1.4 s,
and the sky appears sooner too. On a fast laptop the sky is ~0.4 s later than the old build and the
wordmark ~1.2 s later; that is what the L2 trade (the sky chunk is requested only after the first
contentful paint) buys, and it is why the same page went from a mobile Lighthouse score of 41 to 91.
Nothing is blank in the meantime: the CSS gradient in the page's own first palette is painted from
the first frame.

**L15, the split reveal, is now implemented** (`src/sections/SkyScene.tsx` `<Warmup>`,
`src/sections/sky/warmup.ts` `openWordmarkGate`). The single gate used to hold `frameloop="never"`
until *every* program was linked, including drei's transmission material — the slowest by far. Now:

1. the dome, the stars and the clouds link → the canvas starts drawing and fades in over 700 ms;
2. the wordmark's transmission program (plus the PMREM programs its first compile needs) link →
   the run switches on, right as that fade ends.

That recovered **~700 ms on the sky and ~100–300 ms on the wordmark itself** (the five medians
above span 1502–1731 ms and 2328–2569 ms across separate 3-run rounds, so read the ranges, not a
single figure), measured same-machine.
Two deliberate details:

- The split only applies where the driver links off the main thread *and* draws on a GPU
  (`canSplitReveal`, below). Everywhere else the canvas keeps waiting for the single gate.
- PMREM stays inside the *sky* gate even though only the wordmark needs it. Dropping it was measured:
  the sky then draws 247 ms sooner (1448 ms) but the wordmark lands 338 ms **later** (2739 ms),
  because its link then polls against a running render loop. The wordmark is the hero, so it wins.

**Where the split is switched off, and why.** Lighthouse runs Chrome headless, i.e. on
SwiftShader, where every sky frame is rasterised on the CPU. SwiftShader *does* advertise
`KHR_parallel_shader_compile`, so the extension check alone let the split through, and drawing the
sky 0.7 s sooner moved one ~465 ms software frame inside the measured window: desktop **home and kk
fell from 99 to 82** (TBT 0 → ~400 ms). It was not new work — the same frame happened in the old
build 0.7 s later, after the trace had ended — but it is not a win either, because a software frame
does not get cheaper by being drawn earlier. `canSplitReveal()` in `<Warmup>` therefore also rejects
a software renderer (`swiftshader`, `llvmpipe`, `software rasteriz…`, `basic render`, `warp`), which restores
desktop home to **100** and kk to **99** and leaves those machines with exactly the pre-L15
behaviour. Phones are unaffected: they have a real GPU, and mobile scores are 91 / 93 / 77 / 68,
within noise of 92 / 93 / 77 / 65.

On a real GPU the split costs one 53–75 ms frame — total main-thread blocking 18 ms → ~42 ms —
for ~0.7 s of hero. `verify-reveal-cold.mjs` reports `longtasks` and `blockingMs` alongside the
milestones, so that stays measurable.

The wordmark switches on in one frame rather than fading. `material.transparent` is part of three's
program cache key (`#define OPAQUE` pins the fragment alpha to 1), so an opacity fade on the frosted
material would either do nothing or link a second program on the main thread mid-reveal — the exact
stall the gate exists to remove. The low tier's `MeshPhysicalMaterial` stand-in is already
transparent, so there it does fade, over 500 ms.

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

## The golden-hour ending (v3.2)

The night ending became a sunset (docs/GOLDEN-HOUR-BRIEF.md, docs/JOURNEY-SPEC.md). What that costs,
measured at the footer at 1440x900 on the Intel UHD reference, as the **paired per-round delta**
between two `wrangler pages dev` servers alternated inside one browser launch
(`<scratch>/golden/work/cost3.mjs <baselineUrl> <newUrl> 8`):

| build | footer frame | vs baseline |
|---|---|---|
| 36c076a (moonlit night) | 15.65 ms median | — |
| golden hour | 16.41 ms median | **+0.76 ms** (per-round deltas 0.43–1.65) |

Inside that, isolated by building a variant whose afterglow branch early-outs everywhere:

- **everything except the sky branch is free**: +0.09 ms. The field's valley haze and the grass
  shader changes are paid for by dropping the stars' draw once their surviving alpha is negligible,
  and by the dome now drawing **after** the opaque field (renderOrder 20, depth test on) so early-Z
  can discard the sky under the land. That reorder measured **neutral** on this GPU/driver (−0.08 ms,
  inside the noise) rather than the win it is on paper — it is kept because it is free here and
  should pay on a tile-based mobile GPU, not because it was measured to help.
- **the afterglow branch is the whole cost.** Two things brought it from +1.3 ms to +0.76 ms:
  1. every glow in it is a **compact-support cubic** (`falloff`, three multiplies and a max) instead
     of `exp()`. Being exactly zero outside its support is the point: the branch can then be bounded
     instead of trailing off across the frame.
  2. the halo above the hot line was shortened from 0.43 to **0.28** of a frame and the hue ladder
     above it moved into the **gradient's own mid stop**, which the dome pins just above the band
     (`midStopFor`) and every phase pays for anyway.

Two measurement traps, both of which produced wrong numbers here before they were spotted:

- **Serve the two builds the same way.** The first comparison served the new build from the project
  `dist/` (so wrangler loaded `wrangler.toml`, its D1 binding and the `functions/` routes) and the
  baseline from a plain copy. That alone read as +1.2 ms. Copy both into scratch directories and
  serve them identically.
- **This laptop throttles.** In an 8-round run the paired delta grew from 0.6 ms (rounds 1–3) to
  2.1 ms (round 7) as the GPU heated, because the more expensive build degrades faster. Read the
  early rounds and the median, and re-run with nothing else on the machine.

Lighthouse home on the final build (`--runs=1`, local `wrangler pages dev`): **mobile 94**
(FCP 2.0 s, LCP 2.7 s, TBT 60 ms, CLS 0), **desktop 100** (FCP 0.5 s, LCP 0.6 s, TBT 0 ms, CLS 0) —
against 92 / 100 before. Every GPU buffer is
unchanged at <= 500 KiB (the Mac-corruption check, all three tiers), and no draw call, render pass,
FBO or texture was added.

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
- **A crashed Lighthouse run can no longer poison the numbers.** `wrangler pages dev` can die
  part-way through a 16-run matrix; Lighthouse then still writes a report whose only content is
  `runtimeError.code = "CHROME_INTERSTITIAL_ERROR"` and a null score. That used to be kept (the
  runner skipped any output path that already existed) and averaged into the medians as a 0 — a
  home-mobile median of 45.5 for a build that actually scored 91. Both scripts now handle it:
  `run-lighthouse.mjs` re-runs any report that carries a `runtimeError` or no performance score and
  says `rerun (runtimeError …)`, and `summarize-lighthouse.mjs` prints `skipping failed run …` and
  leaves it out of the median. A cell with no usable run comes out **empty**, never 0 — if a row is
  blank, the matrix did not finish; re-run it rather than reading the blank as a result.
- Kill the server when you are done (`npx wrangler pages dev` holds the port).
