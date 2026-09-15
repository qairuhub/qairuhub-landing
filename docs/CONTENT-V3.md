# QairuHub landing v3: information architecture and final copy (EN)

This file is the source of truth for every visible string on the v3 landing, the Members page, the QairuHub Handbook page and Q, the assistant. The Kazakh version is `docs/CONTENT-V3.kk.md`, with the same keys in the same order. The facts behind the copy are in `docs/HANDBOOK.md`.

**Copy rules**

1. **Cursive accents.** A headline gets at most one cursive (Caveat) accent word, marked here with `*asterisks*`. Components render it as `<i>`. Headlines with no asterisks have no accent.
2. **Only verified claims.** Never add numbers, partners, dates or people that aren't in HANDBOOK.md. Anything planned is labelled "planned", "soon" or "TBA" in the copy itself.
3. **Banned words:** empower, unleash, supercharge, revolutionize, cutting-edge, seamless, synergy, next-level, game-changer.
4. **Names.**
   - Keep the brand name `QairuHub` in Latin letters in every language.
   - Keep the 3D and DOM wordmark as lowercase `qairuhub`.
   - Program names are `QairuHub Demo Day` and `QairuHub Accelerator`.
   - Never use Qairu AI, Qairu AI Fridays, Qairu Hackathons, Qairu Space or Qairu Accelerator.
5. **Links.**
   - Every `href` below is final.
   - Links marked **ext** open in a new tab with `rel="noopener"`.
   - In-page anchors must carry the locale base: `/#offer` on EN pages, `/kk/#offer` on KK pages.
6. **Tags in this file.** `[a11y]` marks screen-reader-only text. `[build]` marks a note for engineers, not visible copy.

---

## 0. Page map and section ids

| # | Section | Component file (name unchanged, see V3-BUILD-PLAN D5) | DOM id (v3) | Replaces id |
|---|---|---|---|---|
| — | Header | `Header` | (fixed) | — |
| 1 | Hero (3D glass wordmark) | `Hero` | `top` | `Hero` |
| 2 | Launchpad + Ask bar | `AgenticCards.tsx` + `src/assistant/AskBar.tsx` | `launchpad` | `agentic` |
| 3 | Ecosystem marquee | `Logos` | `ecosystem` | `logos` |
| 4 | QairuHub Accelerator waitlist | `Waitlist` | `accelerator` | same |
| 5 | Supersize line | `Supersize` | `supersize` | same |
| 6 | Platform showcase, "This is the Hub" | `ProductDemo.tsx` | `platform` | `demo` |
| 7 | What we offer | `Features.tsx` | `offer` | `features` |
| 8 | Highlighted projects (new) | `Projects.tsx` | `projects` | — |
| 9 | Latest news (new) | `News.tsx` | `news` | — |
| 10 | CTA card | `ModelsCTA.tsx` | `cta` | same |
| 11 | Tools row | `Integrations.tsx` | `tools` | `integrations` |
| 12 | Storytelling LEARN · BUILD · LAUNCH · MEET | `Storytelling` | `story` | same |
| 13 | Compact join form | `DemoForm.tsx` | `join` | same |
| — | Footer | `Footer` | `footer` | same |
| — | Q assistant (floating, every page) | `src/assistant/AssistantLauncher.tsx` | — | — |

Routes: `/`, `/kk/`, `/members`, `/kk/members`, `/handbook`, `/kk/handbook`.

[build] QairuHub Handbook anchors are slugs of the H3 headings in HANDBOOK.md: lowercase, drop every character that isn't a letter, digit, space or hyphen, then turn spaces into hyphens. The slugs this file links to:

- `#getting-your-project-featured-on-this-site`
- `#platform-rules`
- `#privacy-on-this-site`
- `#qairuhubs-principles`
- `#who-to-ask-about-what`
- `#join-qairuhub-in-four-steps`

---

## 1. Meta

| Route | `<title>` | `meta description` |
|---|---|---|
| `/` | QairuHub — Learn it. Build it. Launch it. | A student tech community from QAIRU in Astana. Events, hackathons, mentorship, teams on our platform, QairuHub Demo Day and Accelerator. |
| `/members` | Members — QairuHub | The students who run QairuHub: the executive board, the builders behind our projects, and how to reach the team. |
| `/handbook` | The QairuHub Handbook — QairuHub | Everything about QairuHub in one place: what we are, how to join, programs, the platform, values, roadmap and FAQ. |
| 404 | Page not found — QairuHub | — |

- `og:site_name`: QairuHub
- `og:locale`: `en_US`
- [build] The `og:image` is still to be designed. Until then, don't point it at a third-party asset.

---

## 2. Header

### 2.1 Top-level items

| key | label | href | menu |
|---|---|---|---|
| `programs` | Programs | `/#offer` | mega (2.2) |
| `platform` | Platform | `/#platform` | mega (2.3) |
| `projects` | Projects | `/#projects` | — |
| `news` | News | `/#news` | — |
| `about` | About | `/handbook` | mega (2.4) |

### 2.2 Programs mega menu

| title | description | href | icon |
|---|---|---|---|
| Events & masterclasses | Workshops, meetups and hands-on sessions | `/#offer` | `calendar` |
| Hackathons & prep | Get hackathon-ready and find a team | `/#offer` | `bolt` |
| Mentorship | Learn from people one step ahead | `/#offer` | `users` |
| QairuHub Demo Day | A stage for what you built · planned Nov 2026 | `/#offer` | `sparkle` |
| QairuHub Accelerator | For teams past the demo · spring 2027 | `/#accelerator` | `rocket` |

**CTA card**
- **title:** Hackathon Mentorship · Sep 15
- **description:** Meet the HackAlem AI organiser, get registered and find your team.
- **cta:** See the news
- **href:** `/#news`

[build] After 2026-09-15, swap this card for the next dated news item, or for the "Your project could be featured here" card.

### 2.3 Platform mega menu

All links are **ext**.

| title | description | href | icon |
|---|---|---|---|
| Team Finder | Open roles and people by skill | `https://community.qairuhub.com/sign-in?next=/find` | `search` |
| Projects showcase | Public student projects, no login needed | `https://community.qairuhub.com/showcase` | `folder` |
| Events | Sign up and get a Telegram reminder | `https://community.qairuhub.com/sign-in?next=/events` | `calendar` |
| Clubs | Every student club, straight into Telegram | `https://community.qairuhub.com/clubs` | `grid` |
| Create an account | With your @qairu.edu.kz email | `https://community.qairuhub.com/sign-up` | `check` |

**CTA card**
- **title:** This is the Hub
- **description:** See how the platform works before you sign up.
- **cta:** Take the tour
- **href:** `/#platform`

### 2.4 About mega menu

| title | description | href | icon |
|---|---|---|---|
| The QairuHub Handbook | Everything about QairuHub, in one place | `/handbook` | `book` |
| Members | The people who run QairuHub | `/members` | `users` |
| Our principles | Builders over talkers, and five more | `/handbook#qairuhubs-principles` | `check` |
| GitHub | Our code, in the open | `https://github.com/qairuhub` **ext** | `folder` |
| Telegram channel | News lands here first | `https://t.me/qairuhub` **ext** | `pencil` |

**CTA card**
- **title:** Ask Q
- **description:** Got a question about QairuHub? Our snail answers.
- **cta:** Ask now
- **href:** `/#launchpad`. It also opens the assistant panel.

### 2.5 Actions (right side)

| key | label | href | notes |
|---|---|---|---|
| `locale` | EN · ҚАЗ | same page in the other locale | segmented control; see 2.6 |
| `login` (tertiary) | Members | `/members` | |
| `secondary` | Join | `/#join` | mobile panel only |
| `primary` | Open platform | `https://community.qairuhub.com` **ext** | white primary button with a small ↗ icon |

### 2.6 Locale switcher and header a11y

| key | EN |
|---|---|
| `localeSwitch.label` [a11y] | Language |
| `localeSwitch.en` | EN |
| `localeSwitch.kk` | ҚАЗ |
| `localeSwitch.enTitle` | English |
| `localeSwitch.kkTitle` | Қазақша |
| `a11y.primaryNav` | Primary |
| `a11y.openMenu` | Open menu |
| `a11y.closeMenu` | Close menu |
| `a11y.newTab` | (opens in a new tab) |
| `a11y.home` | QairuHub home |

---

## 3. Hero

| key | EN |
|---|---|
| `hero.wordmark` | qairuhub |
| `hero.srTitle` [a11y, h1] | QairuHub — a student tech community from QAIRU, Astana. Learn it. Build it. Launch it. |

[build] The wordmark is lowercase Latin in both locales. The 3D glass renderer has no Cyrillic glyphs.

---

## 4. Launchpad + Ask bar (`#launchpad`)

### 4.1 Heading

| key | EN |
|---|---|
| `launchpad.title` | Your launchpad for AI *builders* |
| `launchpad.subtitle` | Learn it. Build it. Launch it. Ask Q anything about QairuHub and get a straight answer. |
| `launchpad.cta.label` | Join QairuHub |
| `launchpad.cta.href` | `/#join` |

### 4.2 Ask bar

| key | EN |
|---|---|
| `ask.label` [a11y] | Ask Q about QairuHub |
| `ask.placeholder` | Ask anything about QairuHub… |
| `ask.submit` [a11y] | Send question |
| `ask.suggestionsLabel` [a11y] | Suggested questions |
| `ask.note` | Q answers from the QairuHub Handbook and can be wrong. Dates live on t.me/qairuhub. |
| `ask.thinking` | Q is thinking… |
| `ask.sources` | From the QairuHub Handbook |
| `ask.continue` | Continue in chat |
| `ask.again` | Ask something else |
| `ask.stop` [a11y] | Stop answering |

[build] While the input is empty and not focused, the typewriter pill cycles through the six suggestions below. Clicking a chip sends that question.

### 4.3 Suggested questions (6 chips)

1. How do I join QairuHub?
2. What happens at the Hackathon Mentorship?
3. I have an idea but no team. Where do I start?
4. When does QairuHub Accelerator open?
5. How can my project get featured?
6. Can I join if I've never coded?

### 4.4 Cards (3)

[build] The `visual` key is explicit on every card; don't derive it from the title.

| visual | title | body |
|---|---|---|
| `learn` | New here? | Come to an event or a mentorship session. No experience needed, and nobody expects a project on day one. |
| `build` | Have an idea? | Publish it on community.qairuhub.com, open roles with skills and hours, and invite developers from your university. |
| `launch` | Have a demo? | Take it to QairuHub Demo Day, then on to hackathons and QairuHub Accelerator. It stays 100% yours. |

`launchpad.bentoLabels` (decorative, aria-hidden): Team · Repo · Demo · Stage

---

## 5. Ecosystem marquee (`#ecosystem`)

[build] Follows V3-DECISIONS §4. Items are locale-invariant Latin names in `ecosystemRows` (`src/i18n/shared.ts`); the copy lives in `src/sections/ecosystem.i18n.ts`.

| key | EN |
|---|---|
| `ecosystem.title` | The *ecosystem* and tools we build with |
| `ecosystem.caption` | Tools, platforms and ecosystem around our builders. |
| `a11y.marqueeRow` | {title}, row {n} |

### 5.1 Items

[build] Two marquee rows of text wordmarks.
- Items are text wordmarks only. Don't add third-party logo files without written permission.
- Never write "partner", "sponsor", "backed by" or "in partnership with" next to these names, on the landing or anywhere else. The Handbook may say "we build with" or "we build around".
- The copy, the rows and the item order are final.

| row | # | name | style |
|---|---|---|---|
| 1 | 1 | Alem.ai | mono |
| 1 | 2 | Astana Hub | sans |
| 1 | 3 | HackAlem AI | caps |
| 1 | 4 | QairuHub Accelerator | serif |
| 1 | 5 | QairuHub Community | sans |
| 2 | 1 | Anthropic Claude | serif |
| 2 | 2 | OpenAI | sans |
| 2 | 3 | Google Gemini | sans |
| 2 | 4 | Cursor | mono |
| 2 | 5 | Lovable | script |
| 2 | 6 | Qaldy AI | caps |

### 5.2 Removed

| name | reason |
|---|---|
| Qairu AI, Qairu Hackathons, Qairu Space, Qairu Accelerator | Outdated names; remove them everywhere (V3-DECISIONS §4) |
| NURIS, nFactorial, Talent Lab | Named in docs only as benchmarks or intended next steps; remove them everywhere (V3-DECISIONS §4) |

[build] The Tools row (§13) keeps developer tools only and must not repeat row 2 verbatim.

---

## 6. QairuHub Accelerator waitlist (`#accelerator`)

| key | EN |
|---|---|
| `waitlist.pill` | Spring 2027 · planned |
| `waitlist.titleLine1` | An accelerator for projects that |
| `waitlist.titleLine2` | *ship* |
| `waitlist.body` | QairuHub Accelerator is for teams whose project already reached a demo. The draft plan: 8–10 weeks, 6–10 teams, mentors from week one, zero equity. Leave your email to hear first when applications open. |
| `waitlist.placeholder` | Email address |
| `waitlist.cta` | Notify me |
| `waitlist.sending` | Saving… |
| `waitlist.consent` | One email when applications open. No spam. |
| `waitlist.success` | You're on the list. We'll email you when applications open. |
| `waitlist.errorEmail` | Enter a valid email address. |
| `waitlist.errorFailed` | Something went wrong. Please try again. |
| `waitlist.demoCaption` | From idea to Demo Day to QairuHub Accelerator. |
| `waitlist.demoSteps` | Idea · Team · Demo Day · Accelerator |

---

## 7. Supersize line (`#supersize`)

| key | EN |
|---|---|
| `supersize.text` | Builders over talkers. Projects over lectures. |

---

## 8. Platform showcase, "This is the Hub" (`#platform`)

The concept comes from the platform's own "This is the Hub. Try it" section, rebuilt in our design with our copy.

### 8.1 Heading and chrome

| key | EN |
|---|---|
| `platform.pill` | community.qairuhub.com |
| `platform.title` | This is the *Hub* |
| `platform.body` | Our community platform puts people, projects and events at QAIRU in one place. Switch the tabs to see what you can do there. |
| `platform.tablistLabel` [a11y] | Platform features |
| `platform.sampleBadge` | Sample data |
| `platform.app.name` | QairuHub Community |
| `platform.app.sidebar` | Home · Team Finder · Projects · Events · People · Clubs · Resources |
| `platform.chrome.search` | Search the campus… |
| `platform.chrome.secondary` | Share |
| `platform.chrome.primary` | New project |
| `platform.autoAdvanceMs` | 9000 |

### 8.2 Tabs

[build] The mock data is fictional, taken from the platform's own public demo, and has to show the **Sample data** badge. Field shapes follow the real platform's data models.

**Tab 1: Team Finder**
- `icon: search`, `screen: finder`
- **Screen title:** Team Finder · Open roles
- **Subtitle:** Pick a role that fits your skills and your hours.
- **Columns:** Role · Project · Skill · Hours · Deadline
- **Rows:**
  - ML engineer · Kazakh NLP Datasets · Python · 8 h/week · Oct 3
  - Frontend developer · Open Campus Map · JavaScript · 6 h/week · Sep 30
  - Product designer · Campus Buddy · UI/UX · 4 h/week · Oct 10
  - Researcher · Kazakh NLP Datasets · Research · 5 h/week · Oct 17
- **Row action:** Apply
- **Caption under the window:** Every role names the skill, the hours and the deadline. No "are you still looking?" chats.

**Tab 2: Projects**
- `icon: folder`, `screen: projects`
- **Screen title:** Student projects
- **Filter chips:** All statuses · Recruiting · In progress · Idea
- **Rows** (name · promise · status · team):
  - Open Campus Map · A living map of rooms and campus services · Recruiting · 4 on the team
  - Kazakh NLP Datasets · A catalogue of open Kazakh-language datasets · In progress · 6 on the team
  - QAIRU Radio · A podcast about student projects · Idea · 2 on the team
  - Campus Buddy · Mentors for first-year students · Recruiting · 3 on the team
- **Caption:** Every project shows an honest status: idea, recruiting, in progress, demo shown.

**Tab 3: Events**
- `icon: calendar`, `screen: events`
- **Screen title:** Campus calendar
- **Filter chips:** All types · Demo Friday · Hack Day · Meetup · Workshop
- **Rows** (date · title · type, time and place · seats):
  - Oct 2 · AI Build Night · Hack Day · 18:30 · Lab 3.12 · 24 / 40 going
  - Oct 9 · Founder Stories · Meetup · 17:00 · Atrium · 31 / 60 going
  - Oct 16 · Open Design Critique · Workshop · 16:00 · Studio 2.04 · 12 / 20 going
  - Oct 23 · Demo Friday · Demo Friday · 17:00 · Atrium · 18 / 50 going
- **Row action:** Going
- **Caption:** Seats are limited. Telegram reminds you a day and an hour before.

**Tab 4: People**
- `icon: users`, `screen: people`
- **Screen title:** People at QAIRU
- **Cards** (name · program and year · skills · availability):
  - Aruzhan S. · Computer Science · Year 1 · Python, ML · Open to projects
  - Daniyar A. · Computer Science · Year 3 · Backend, ML · Open to collaboration
  - Aigerim N. · Artificial Intelligence · Year 2 · UI/UX, Research · Open to projects
- **Card action:** Follow
- **Caption:** Find people by skill, program and free hours, then message them on Telegram.

### 8.3 CTA row under the showcase

| key | EN | href |
|---|---|---|
| `platform.ctaPrimary` | Open the platform | `https://community.qairuhub.com` **ext** |
| `platform.ctaSecondary` | See public projects | `https://community.qairuhub.com/showcase` **ext** |
| `platform.accessNote` | Sign-up needs an @qairu.edu.kz email. An admin approves each account. | — |

---

## 9. What we offer (`#offer`)

| key | EN |
|---|---|
| `offer.titleBefore` | What we |
| `offer.titleCursive` | *offer* |
| `offer.titleAfter` | . |
| `offer.body` | Everything here is free, open to every skill level and built around one goal: getting you from an idea to something real. |

### 9.1 Cards (7)

The grid layout stays 7/5 · 5/7 · 4/4/4.

| # | cols | visual | title | body |
|---|---|---|---|---|
| 1 | 7 | `schedule` | Events & masterclasses | Workshops, meetups and hands-on masterclasses where people who know a domain show what actually works. Next up: the Vibe-coding Masterclass, announcement soon. |
| 2 | 5 | `chart` | Hackathons & preparation | We help you register, find teammates and get ready for hackathons like HackAlem AI. A QairuHub Hack Day on a real Kazakhstan problem is planned. |
| 3 | 5 | `links` | Teams on the platform | Publish an idea on community.qairuhub.com, open roles with skills, hours and a deadline, and build with developers from your own university. |
| 4 | 7 | `timeline` | QairuHub Demo Day | A planned stage for projects built with QairuHub teams and mentors, meant for students, faculty, university partners and investors. First edition planned for November 2026. |
| 5 | 4 | — | Mentorship | Peer-to-peer: learn from people one step ahead, then teach the next semester. Mentors by track are on the way. |
| 6 | 4 | — | QairuHub Accelerator | For teams that already have a demo. Draft plan: 8–10 weeks, mentors from week one, zero equity. Planned for spring 2027. |
| 7 | 4 | — | Partnerships | Companies and organisations can host an event, mentor a team, bring a real problem or meet teams at Demo Day. Write to us. |

### 9.2 Card mock data

[build] These rows are real or explicitly planned items, not samples.

**`offer.mock.schedule`** (card 1, rows of date · title · detail)
- Sep 15 · Hackathon Mentorship · Shai Cafeteria · 14:00
- Soon · Vibe-coding Masterclass · Announcement soon
- Oct · First big QairuHub event · Date TBA
- Nov · QairuHub Demo Day · Planned

**`offer.mock.chart`** (card 2)
- **Label:** HackAlem AI · Sep 23
- **Bars:** Register · Find a team · Build · Demo

**`offer.mock.links`** (card 3): Team Finder · Open roles · Projects showcase

**`offer.mock.milestones`** (card 4): Idea · Team · Demo · Demo Day

---

## 10. Highlighted projects (`#projects`)

| key | EN |
|---|---|
| `projects.titleBefore` | What we're |
| `projects.titleCursive` | *building* |
| `projects.titleAfter` | |
| `projects.body` | Real projects from the QairuHub community, with honest statuses. Yours can be next. |
| `projects.carouselLabel` [a11y] | Highlighted projects |
| `projects.prev` [a11y] | Previous project |
| `projects.next` [a11y] | Next project |
| `projects.pause` [a11y] | Pause carousel |
| `projects.play` [a11y] | Play carousel |

**Status labels.** These match the platform's statuses:

| key | EN |
|---|---|
| `status.idea` | Idea |
| `status.recruiting` | Recruiting |
| `status.inProgress` | In progress |
| `status.demoShown` | Demo shown |
| `status.completed` | Completed |
| `status.stopped` | Stopped |
| `badge.live` | Live |
| `badge.internal` | Internal |
| `badge.openSource` | Open source |

### 10.1 Items

[build] Each item's data lives in `src/data/projects.ts`. Only publish team member names after they confirm (see Members).

| # | name | tagline | status | badges | tags | link label → href |
|---|---|---|---|---|---|---|
| 1 | QairuHub Community | The platform for people, projects and events at QAIRU. | In progress | Live | Next.js · Supabase · Telegram | Open → `https://community.qairuhub.com` **ext** |
| 2 | qairuhub.com | QairuHub's open-source website. | In progress | Live · Open source | Astro · Cloudflare | Source → `https://github.com/qairuhub/qairuhub-web` **ext** |
| 3 | core.qairuhub.com | Internal tools for the core team: tasks, progress and a visual schedule. | In progress | Internal | TypeScript | — |
| 4 | This landing + Q | A WebGL journey from space to night, with Q, an assistant that answers from the QairuHub Handbook. | In progress | Live | React · three.js · OpenAI | Read the QairuHub Handbook → `/handbook` |
| 5 | QairuHub iOS app | QairuHub's community on your phone. | Idea | — | iOS | — |
| 6 | Team ideas bot | A Telegram bot that collects the team's ideas and sends a daily digest. | In progress | Internal | Telegram · Gemini | — |
| 7 | QairuHub Cowork | A cowork-time and schedule tool, built by new contributors with a mentor. | In progress | Internal | TypeScript | — |
| 8 | **Your project here** | Publish it on community.qairuhub.com, show a demo, and we'll feature it here. | — | — | — | How to get featured → `/handbook#getting-your-project-featured-on-this-site` |

[build] Item 8 is a distinct "slot" card: dashed border, no status pill. It always sits last in the loop.

---

## 11. Latest news (`#news`)

| key | EN |
|---|---|
| `news.titleBefore` | Latest |
| `news.titleCursive` | *news* |
| `news.body` | What's happening in QairuHub right now. The full feed is on t.me/qairuhub. |
| `news.allLink` | All updates on Telegram → `https://t.me/qairuhub` **ext** |
| `news.pastLabel` | Past |

### 11.1 Cards

[build] News data lives in `src/data/news.ts` as `{ id, date: ISO | null, dateLabel, tag, title, body, link, expires?: ISO }`.
- When today is after `expires`, show the `Past` label.
- Keep this order: the first three render above the fold on desktop.

| # | dateLabel | tag | title | body | link → href | expires |
|---|---|---|---|---|---|---|
| 1 | Sep 15, 2026 | Event | QairuHub Hackathon Mentorship with Sanzhar Madiyev, Head of Education & Hackathon at BAITC | Our first offline session, with the organiser of HackAlem AI: how to prepare for HackAlem AI, what judges look for, and help finding a team. 14:00, Shai Cafeteria. | Details on Telegram → `https://t.me/qairuhub` **ext** | 2026-09-15T23:59+05:00 |
| 2 | Coming soon | Masterclass | Vibe-coding Masterclass | A hands-on session on building faster with AI coding tools. We're preparing it now; the date and place will be announced on the channel. | Follow the channel → `https://t.me/qairuhub` **ext** | — |
| 3 | Open to everyone | Your project | Your project could be featured here | News and the projects carousel aren't just for the core team. Publish your project on community.qairuhub.com, show a demo, and tell us. The media team picks projects to share here, on Telegram and on Instagram. | How to get featured → `/handbook#getting-your-project-featured-on-this-site` | — |
| 4 | Sep 19, 2026 | Hackathon | HackAlem AI registration closes Sep 19 | The agentic-AI hackathon by Alem with OpenAI runs on Sep 23 at Astana EXPO. Teams of up to three, 18+. Register as a QAIRU student. | hackalem.ai → `https://hackalem.ai` **ext** | 2026-09-19T23:59+05:00 |
| 5 | Sep 2026 | Platform | community.qairuhub.com: first version online | An early version of our platform is online: Team Finder, projects, events and people. Sign up with your @qairu.edu.kz email; an admin approves each account. | Open the platform → `https://community.qairuhub.com` **ext** | — |
| 6 | Sep 9, 2026 | Community | QairuHub met the campus at the Club Fair | Two days after our founding session, we opened registration at the QAIRU Club Fair. Missed it? The form is at the bottom of this page. | Join → `/#join` | — |

---

## 12. CTA card (`#cta`)

| key | EN |
|---|---|
| `cta.title` | Start where you *are*. |
| `cta.subtitle` | Beginner or already shipping, there's a place for you. |
| `cta.body` | Never written code? Come and learn. Already building? Come and lead. It's free, and whatever you build stays 100% yours. |
| `cta.button.label` | Read the QairuHub Handbook |
| `cta.button.href` | `/handbook` |

---

## 13. Tools row (`#tools`)

| key | EN |
|---|---|
| `tools.titleBefore` | The |
| `tools.titleCursive` | *tools* |
| `tools.titleAfter` | our teams build with |
| `tools.note` | Tools we use, not partnerships. |
| `tools.a11yLabel` [a11y] | Tools our teams use |

Every item is **tool-only**; none of them is a partner.

| name | style | evidence of use |
|---|---|---|
| GitHub | sans | org `qairuhub`, all repos |
| Telegram | sans | channel, team group, bots |
| Cloudflare | sans | Pages/Workers hosting, DNS |
| Supabase | mono | community platform auth + DB |
| Next.js | sans | community platform |
| Astro | sans | qairuhub.com |
| three.js | mono | this landing |
| OpenAI | sans | Q's API; Codex in the dev team |
| Claude | serif | dev team coding tool |
| Gemini | sans | ideas bot model; frontend work |
| Canva | script | decks, cards, posts |

---

## 14. Storytelling triptych (`#story`)

`story.a11yLabel` [a11y]: How QairuHub works

[build] Titles render uppercase through CSS. There are now four items, so the runway grows accordingly (see V3-BUILD-PLAN).

| # | title | body |
|---|---|---|
| 1 | Learn | Workshops, masterclasses and peer mentorship. People with domain knowledge teach the people who want in, and next semester that's you. |
| 2 | Build | Publish an idea on community.qairuhub.com, open roles and build with developers from your own university. Idea, in progress, demo: the status stays honest. |
| 3 | Launch | Show your project at QairuHub Demo Day (planned) to students, faculty, partners and investors. Strong teams move on to QairuHub Accelerator. |
| 4 | Meet | Events, hackathons and Demo Days are where teams are born. Show up, meet people, get back to building. |

---

## 15. Compact join form (`#join`)

[build] Target about 50% of the v2 height.
- Layout: one card; two-column rows for name/email and telegram/interest; the message field is 3 rows tall.
- Turnstile runs in managed mode (usually invisible), plus a honeypot field.
- Select `value`s are locale-neutral and are what gets sent to `/api/join`.

### 15.1 Heading

| key | EN |
|---|---|
| `form.titleLine1` | Give your ideas |
| `form.titleLine2Before` | a place to |
| `form.titleLine2Cursive` | *ship* |
| `form.titleLine2After` | . |
| `form.body` | Tell us who you are and what you want to build. We'll get back to you on Telegram. |

### 15.2 Fields

| key | label | placeholder | rules |
|---|---|---|---|
| `form.fields.name` | Full name* | — | required, 2–80 chars |
| `form.fields.email` | Email* | — | required, valid email, ≤ 120 chars |
| `form.fields.telegram` | Telegram username* | @username | required, `^@?[A-Za-z0-9_]{5,32}$` |
| `form.fields.interest` | I'm interested in* | Choose one | required, one value from 15.3 |
| `form.fields.message` | Message | What do you want to build? | optional, ≤ 1000 chars |
| `form.fields.honeypot` [a11y, hidden] | Leave this field empty | — | name `company`, `tabindex=-1`, `autocomplete=off`, visually hidden |

### 15.3 Interest options

| value | label |
|---|---|
| `build` | Building projects (AI, software, hardware) |
| `project` | I have a project to feature |
| `events` | Events and community |
| `media` | Media and content |
| `business` | Business and entrepreneurship |
| `mentor` | Mentor or speaker |
| `partner` | Partner or sponsor |
| `other` | Something else |

### 15.4 Actions, legal, states and errors

| key | EN |
|---|---|
| `form.submit` | Send |
| `form.sending` | Sending… |
| `form.turnstileNote` | Protected by Cloudflare Turnstile. |
| `form.legalBefore` | By sending, you agree to our |
| `form.legalLink1` | Code of Conduct → `/handbook#platform-rules` |
| `form.legalMiddle` | and |
| `form.legalLink2` | Privacy note → `/handbook#privacy-on-this-site` |
| `form.legalAfter` | . |
| `form.successTitle` | Got it. Welcome aboard. |
| `form.successBody` | We'll reach out on Telegram. Meanwhile, follow t.me/qairuhub for events. |
| `form.sendAnother` | Send another |
| `form.errors.required` | This field is required |
| `form.errors.choose` | Please choose an option |
| `form.errors.email` | Enter a valid email address |
| `form.errors.telegram` | Use your Telegram username, like @qairuhub |
| `form.errors.tooLong` | Keep it under {max} characters |
| `form.errors.verify` | Please confirm you're human and try again. |
| `form.errors.rateLimited` | Too many attempts. Try again in a few minutes. |
| `form.errors.failed` | Something went wrong. Please try again. |

---

## 16. Footer

`a11y.footerNav`: Footer

### 16.1 Links

| label | href |
|---|---|
| Programs | `/#offer` |
| Platform | `/#platform` |
| Projects | `/#projects` |
| News | `/#news` |
| Join | `/#join` |
| Members | `/members` |
| The QairuHub Handbook | `/handbook` |
| Privacy | `/handbook#privacy-on-this-site` |
| community.qairuhub.com | `https://community.qairuhub.com` **ext** |

### 16.2 Socials

Icon buttons; the label is the accessible name.

| label | href | icon |
|---|---|---|
| Telegram | `https://t.me/qairuhub` | telegram |
| Instagram | `https://instagram.com/qairuhub` | instagram |
| GitHub | `https://github.com/qairuhub` | github |

[build] Remove X and LinkedIn from the v2 footer: no QairuHub accounts on those networks were found in the research.

| key | EN |
|---|---|
| `footer.copyright` | © 2026 QairuHub. A Kazakhstan tech community, born at QAIRU. |
| `footer.tagline` | Learn it. Build it. Launch it. |

---

## 17. Members page (`/members`)

### 17.1 Heading

| key | EN |
|---|---|
| `members.eyebrow` | Members |
| `members.title` | The people who *run* QairuHub |
| `members.intro` | QairuHub is run by students. Nobody owns it, seats rotate by vote, and anyone can be replaced, including the President. These are the people doing the work right now. |

### 17.2 Executive board

- **Section title:** Executive board
- **Section note:** Elected at the Founding Session on 7 September 2026; role names as confirmed on 10 September 2026.

| name | role | what they look after |
|---|---|---|
| Tair Kaldybayev | President | The organisation, the university and the big picture. |
| Mustafa Kassym | CTO | The platform, QairuHub's products and operations. |
| Alikhan Altayev | Finance & Partnerships Leader | Partners, sponsors and anything involving money. |
| Tamerlan Shaigali | Media & Socials Leader | Instagram, Telegram and how QairuHub shows up. |
| Nazar Akanov | Community & Events Leader | Events, onboarding and where new members start. |

### 17.3 Builders

- **Section title:** Builders
- **Section note:** Active members leading QairuHub's projects, media and events.

[build] This block ships behind `SHOW_BUILDERS = false` until each person confirms how their name is spelled and agrees to be listed. The source uses first names only, and two members are both called Yernur. Roles are taken from the research.

| name | role |
|---|---|
| Nurik | Lead developer, community.qairuhub.com |
| Aidos | Developer, community.qairuhub.com |
| Miras | Team bots · mentor to new contributors |
| Tair Khanapin | Registration and forms · contributor |
| Yernur | Brand, design and channel copy |
| Yernur | Media · contributor |
| Artem | Presentations · contributor |
| Nurkhan | Media and presentations |
| Ibragim | Team |

### 17.4 Who to ask

- **Section title:** Who to ask
- **Rows:** reuse the "Who to ask about what" table from HANDBOOK.md.

### 17.5 Contact

| key | EN |
|---|---|
| `members.contactTitle` | Contact the team |
| `members.contactBody` | We don't publish personal emails or phone numbers. The fastest ways to reach QairuHub: |
| `members.contactTelegram` | Telegram channel · t.me/qairuhub → `https://t.me/qairuhub` **ext** |
| `members.contactInstagram` | Instagram · @qairuhub → `https://instagram.com/qairuhub` **ext** |
| `members.contactForm` | The join form → `/#join` |

### 17.6 Join CTA

| key | EN |
|---|---|
| `members.joinTitle` | Want your name here? |
| `members.joinBody` | Active members join through intake waves. Start by showing up and building; the next wave will be announced on the channel. |
| `members.joinCta` | Join QairuHub → `/#join` |

---

## 18. The QairuHub Handbook page (`/handbook`)

| key | EN |
|---|---|
| `book.eyebrow` | Knowledge base |
| `book.title` | The Qairu *Book* |
| `book.intro` | What QairuHub is, how to join, what's coming and how we work, in one place. Q, our assistant, answers from this page, so if it isn't here, Q won't make it up. |
| `book.updated` | Last updated 14 September 2026 |
| `book.legend` | Status labels: Confirmed · Planned · To be announced |
| `book.tocLabel` | Contents |
| `book.askCta` | Ask Q |
| `book.platformCta` | Open platform → `https://community.qairuhub.com` **ext** |
| `book.linksTitle` | Links |
| `book.linkSite` | Website · qairuhub.com → `https://qairuhub.com` **ext** |
| `book.linkPlatform` | Platform · community.qairuhub.com → `https://community.qairuhub.com` **ext** |
| `book.linkTelegram` | Telegram · t.me/qairuhub → `https://t.me/qairuhub` **ext** |
| `book.linkSource` | Source code of this site · github.com/tairqaldy/qairuhub-landing-clean (private for now) → `https://github.com/tairqaldy/qairuhub-landing-clean` **ext** |
| `book.feedback` | Something wrong or out of date? Tell us through the form or on t.me/qairuhub. |
| `book.kkNote` (KK page only) | (see the kk file) |

[build]
- The body is rendered from `docs/HANDBOOK.md` at build time.
- Strip the `<!-- kw: … -->` comments from the HTML, but keep them in the search index.
- Every H3 gets an anchor link.

---

## 19. Q, the assistant (floating, bottom-right, every page)

### 19.1 Panel strings

| key | EN |
|---|---|
| `assistant.launcher` [a11y] | Ask Q, the QairuHub assistant |
| `assistant.hint` | Questions? Ask Q. |
| `assistant.title` | Q · QairuHub assistant |
| `assistant.greeting` | Hi, I'm Q, the QairuHub snail. Slow on legs, quick with answers. Ask me about joining, events, projects or the Accelerator. |
| `assistant.placeholder` | Ask Q… |
| `assistant.send` [a11y] | Send |
| `assistant.close` [a11y] | Close assistant |
| `assistant.reset` | New chat |
| `assistant.disclaimer` | Q answers from the QairuHub Handbook and can make mistakes. Don't share passwords or personal data. |
| `assistant.thinking` | Q is thinking… |
| `assistant.sources` | From the QairuHub Handbook |

[build] `assistant.hint` shows once per visitor, after 8 seconds, and never on mobile.

### 19.2 Suggestions (3)

1. How do I join?
2. What's happening this week?
3. How do I get my project featured?

### 19.3 States

| key | EN |
|---|---|
| `assistant.fallbackIntro` | I can't reach my AI brain right now, so here's what the QairuHub Handbook says: |
| `assistant.fallbackNone` | I couldn't find that in the QairuHub Handbook. Try rephrasing, or check t.me/qairuhub. |
| `assistant.notAnnounced` | That hasn't been announced yet. Follow t.me/qairuhub for the news. |
| `assistant.offTopic` | I only know about QairuHub, so ask me anything about that! |
| `assistant.rateLimited` | I need a short break. Try again in a minute, or read the QairuHub Handbook. |
| `assistant.dailyCap` | I've answered a lot of questions today and I'm resting until tomorrow. The QairuHub Handbook has most answers. |
| `assistant.tooLong` | That's a long one. Please keep questions under 500 characters. |
| `assistant.error` | Something went wrong on my side. Please try again. |
| `assistant.readMore` | Read more in the QairuHub Handbook |

---

## 20. 404

| key | EN |
|---|---|
| `notFound.title` | Nothing *here*. |
| `notFound.body` | The page may have moved, or the link is out of date. |
| `notFound.cta` | Back home → `/` |
