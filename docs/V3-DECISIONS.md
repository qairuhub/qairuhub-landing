# v3 decisions (override the build plan)

**Date:** 2026-09-14 · **Decided by:** the President's v3 brief, resolved against the research

This file takes precedence over `V3-BUILD-PLAN.md`, `AGENT-SPEC.md`, `CONTENT-V3*.md` and the scratchpad `open-questions.md` wherever they disagree. Everything not listed here follows the plan.

---

## 1. The knowledge base is the **QairuHub Handbook**, not "The Qairu Book"

- `theqairubook` is an existing public project by Tair Kaldybayev: a 2004-thefacebook-style social network for QAIRU students (profiles, walls, pokes, chat, Reddit-style boards, rep).
  - Live: https://theqairubook-app-production.up.railway.app
  - Source: https://github.com/tairqaldy/theqairubook
- The knowledge base file is `docs/HANDBOOK.md`. Its page lives at `/handbook` and `/kk/handbook`. Components are `HandbookPage.tsx`, `handbook.i18n.ts` and `handbook.generated.ts`, and the index is `handbook-index.json`.
- No `/book`, `/qairu-book` or `/theqairubook` routes or redirects.
- **theqairubook** is a **Highlighted projects** card:
  - name `theqairubook`
  - tagline: "A 2004 thefacebook for QAIRU students: profiles, walls, pokes, chat and Reddit-style boards." (write a KK version)
  - status `live`, badges `live` and `openSource`
  - two links: "Open app" (the live Railway URL) and "Source code" (the GitHub repo)
  - a builder credit "by Tair Kaldybayev" is allowed on this one card
- The Handbook "Links" chunk, the Footer and Q's allowlist include:
  - the landing source code https://github.com/tairqaldy/qairuhub-landing-clean, labelled "Source code of this site" (the repo is private for now; keep the link, add no "private" label on the site)
  - theqairubook live and source links

## 2. Positioning follows the President's words

- **Lead line:** QairuHub is **a Kazakhstan tech community, born at QAIRU**. Everyone is welcome at any skill level.
  - We run events, hackathons, preparation and mentorship.
  - We partner with the ecosystem and build real products.
  - People with domain knowledge share it, create projects and build teams with developers they find inside the university on community.qairuhub.com.
  - **QairuHub Accelerator** and **QairuHub Demo Day**: projects built with the community's resources, mentors and teams get a stage in front of students, faculty, professors, university partners and investors.
- **Honest access note** (Handbook FAQ + platform CTA): events and the Telegram channel are open to everyone. The platform needs a @qairu.edu.kz email for now.
- Demo Day and the Accelerator are described as what QairuHub runs, with dates marked "to be announced". Demo Day stays "planned" in dated contexts.

## 3. News card: Sanzhar Madiyev's title comes from the President

- **Card:** "QairuHub Hackathon Mentorship with Sanzhar Madiyev, Head of Education & Hackathon at BAITC".
  - 15 Sep 2026, 14:00, Shai Cafeteria.
  - Topics: preparation for HackAlem AI, what judges look for, finding a team.
- **Spelling:** Madiyev in EN, Мадиев in KK.
- Allowed in the Handbook and in Q's answers too.
- Remove the `verify` fallback.

## 4. The ecosystem marquee uses the President's list, framed truthfully

- **Section title:** "The ecosystem and tools we build with".
  - KK: natural equivalent, e.g. «Біз бірге құратын экожүйе мен құралдар».
  - This replaces "Where QAIRU builders do their best work".
- **Caption under the rows:** "Tools, platforms and ecosystem around our builders."
- **Items (text wordmarks, no third-party logo files):**
  - Row 1: Alem.ai · Astana Hub · HackAlem AI · QairuHub Accelerator · QairuHub Community
  - Row 2: Anthropic Claude · OpenAI · Google Gemini · Cursor · Lovable · Qaldy AI
- Never write "partner", "sponsor", "backed by" or "in partnership with" next to these names. The Handbook can say "we build with / around".
- Remove "Qairu AI", "Qairu Space", "Qairu Hackathons", "NURIS", "nFactorial", "Talent Lab" everywhere.
- The separate Tools row (Integrations) keeps developer tools only and must not repeat row 2 verbatim: GitHub · Telegram · Figma · Cloudflare · Vercel · Railway · Hugging Face · Python · TypeScript · Codex.

## 5. Assistant key: Secrets Store + edge Worker (the user already created it)

- The OpenAI key lives in Cloudflare Secrets Store:
  - account `aefda65292e1c46cd3d2c93049b66b03`
  - store `c2d5d6fdb950415887cdad3cc7cefd62`
  - secret `chatgpt-api`
- Claude never sees or handles the value.
- **New Worker `qairuhub-edge`** in `edge/`, with its own `edge/wrangler.toml` and `edge/src/index.ts`, owned by WP4:
  - binding config:

    ```toml
    [[secrets_store_secrets]]
    binding = "OPENAI_KEY"
    store_id = "c2d5d6fdb950415887cdad3cc7cefd62"
    secret_name = "chatgpt-api"
    ```

  - `workers_dev = false` and `preview_urls = false`, so it is reachable only through the service binding.
  - It exposes an internal `POST /openai/responses` that adds `Authorization: Bearer ${await env.OPENAI_KEY.get()}`, forwards the JSON body to `https://api.openai.com/v1/responses` and streams the response back unchanged.
  - It rejects everything else.
  - It never logs bodies.
- **Pages project `wrangler.toml`:**

  ```toml
  [[services]]
  binding = "EDGE"
  service = "qairuhub-edge"
  ```

- **`functions/_lib/openai.ts` resolution order:**
  1. `env.EDGE`: fetch `https://edge/openai/responses`
  2. `env.OPENAI_API_KEY` (Pages secret)
  3. offline mode
- **Turnstile** is runtime-configured, with no rebuild:
  - `GET /api/config` returns `{ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }`.
  - The client reads that once, lazily.
  - The server enforces Turnstile only when `TURNSTILE_SECRET_KEY` is set. Until then join, waitlist and ask are protected by honeypot + minimum fill time (≥ 2.5 s) + origin allowlist + per-IP D1 rate limits.
  - The user adds the site key (text var) and the secret (Pages secret) later.
  - Claude does not create the Turnstile widget and never handles its secret.
- **Generated secrets** `SESSION_SIGNING_KEY` and `RATE_LIMIT_SALT` are random values created at deploy time and piped straight into `wrangler pages secret put`, never printed. Creating the D1 database is approved; no need to ask.

## 6. Members page

- **Executive board** (full names + roles as of 10 Sep 2026):
  - Tair Kaldybayev (President)
  - Mustafa Kassym (CTO)
  - Alikhan Altayev (Finance & Partnerships)
  - Tamerlan Shaigali (Media & Socials)
  - Nazar Akanov (Community & Events)
- **Team list** (`SHOW_BUILDERS = true`): only people whose name spelling is consistent across the research sources, shown as first name + last initial where the surname is uncertain, role "Team" unless a public role is confirmed. Leave ambiguous entries out.
- No emails, phones or handles on any public page. The private roster with contacts stays in `private/team-roster-private.md`, which is git-ignored and never imported by code.
- **Contact block:** Telegram channel, Instagram, the join form, and "Open platform".

## 7. Snail Q mascot: drawn from the President's artwork

- **Style:** monochrome, dark navy `#0B1729`. On dark UI, draw the glyph in white, or put the navy glyph on a white disc.
- **Geometry** (viewBox `0 0 424 332`):
  - **Shell:** a ring centred at (166, 166), outer r 166, inner r 106. It is the bowl of the Q.
  - **Body/foot:** leaves the ring's lower right and runs along a flat bottom edge at y 332, from x 166 to x ≈ 360. It rises into a rounded head whose rightmost point is ≈ (424, 273) and top ≈ (394, 229).
  - **Neck:** the upper edge runs from ≈ (296, 270) on the ring to ≈ (372, 234).
  - **Antennae:** two stalks about 10 wide.
    - Left: base (363, 238) to a ball r 13 at (354, 183).
    - Right: base (393, 239) to a ball r 12 at (402, 203).
- A single `<path>` + circles, ≤ 2 KB.
- Render it to PNG with Playwright during the build and check that it reads as a snail-shaped Q.
- **Launcher:** a 56 px round button bottom-right (white disc, navy snail, soft ring on hover, 3 s idle bob, off under reduced motion) with the label "Ask Q".

## 8. Kazakh ships now

- `/kk/` and the switcher are visible from day one, as the President asked.
- Keep `<!-- review -->` markers in docs so a native speaker can polish the text later. Do not block or hide the locale.

## 9. Hero wordmark (the President's top visual request)

- **Thinner:** WP1 constants, verified by eye at y = 0.
  - If Courgette still reads bold after the bevel reduction, drop the bevel to the fallback and cut extrusion to 0.06.
  - Legibility of "qairuhub" must stay perfect.
- **~15% smaller.**
- **While scrolling:** it spins 360°, **recedes into depth** (visibly shrinks as it moves away) and rises out of the frame.

## 10. Everything else

- **Handbook:** English only for now. The `/kk/handbook` page shows the Kazakh note.
- **Registration channel:** the landing join form (D1) is the landing's channel. The Handbook also mentions the Google registration form and platform sign-up.
- **Org profile README:** stays a draft in `docs/ORG-PROFILE-README.md`; the President publishes it later. Add theqairubook and this landing to its projects table.
- **Commits:** end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. This repo has no no-attribution rule; that rule belongs to qairuhub-web.
