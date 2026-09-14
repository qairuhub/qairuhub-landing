/**
 * All copy for the landing page lives here. Components read from this file only.
 * Structure mirrors the reference landing section-for-section; text is QairuHub's.
 *
 * QairuHub — student-driven builder community at Qazaq AI Research University (QAIRU), Astana.
 * Tagline: "Learn it. Build it. Launch it."  Positioning: the best student-driven org for turning
 * AI ideas into shipped products and startups. No equity, no IP claims. Ships every semester.
 */

export const brand = {
  name: 'QairuHub',
  /** The logo/wordmark spelling (lowercase by design) — used by the 3D glass lettering and the DOM wordmark. Prose uses `name`. */
  wordmark: 'qairuhub',
  short: 'Qairu',
  tagline: 'Learn it. Build it. Launch it.',
  org: 'Qazaq AI Research University (QAIRU), Astana',
  copyright: 'QairuHub ©2026 All rights reserved',
  links: {
    github: 'https://github.com/qairuhub',
    telegram: 'https://t.me/qairuhub',
    instagram: 'https://instagram.com/qairuhub',
    x: 'https://x.com/qairuhub',
    linkedin: 'https://www.linkedin.com/company/qairuhub',
    site: 'https://qairuhub.com',
    /** Governance docs (charter, code of conduct, privacy) live in the open GitHub org until a dedicated page exists. */
    charter: 'https://github.com/qairuhub',
    privacy: 'https://github.com/qairuhub',
  },
} as const

/**
 * Section ids that exist on the page (see src/App.tsx + src/sections/*). Every in-page `href`
 * below MUST resolve to one of these so no nav/footer link is a dead click:
 *   #Hero · #agentic · #logos · #accelerator · #supersize · #demo · #features · #cta
 *   · #integrations · #story · #join · #footer
 */
export const sectionIds = {
  hero: '#Hero',
  agentic: '#agentic',
  logos: '#logos',
  accelerator: '#accelerator',
  supersize: '#supersize',
  demo: '#demo',
  features: '#features',
  cta: '#cta',
  integrations: '#integrations',
  story: '#story',
  join: '#join',
  footer: '#footer',
} as const

/* ------------------------------------------------------------------ Navigation */
export interface NavSubItem {
  title: string
  description: string
  href: string
  /** icon key resolved by the Header (see icons.tsx) */
  icon: 'sparkle' | 'bolt' | 'rocket' | 'users' | 'folder' | 'pencil' | 'calendar' | 'book' | 'grid' | 'search' | 'check'
  external?: boolean
}
export interface NavColumn {
  title?: string
  items: NavSubItem[]
}
export interface NavCta {
  title: string
  description: string
  cta: string
  href: string
}
export interface NavItem {
  label: string
  href: string
  columns?: NavColumn[]
  cta?: NavCta
}

/*
 * Anchor map (top-level nav → section): Programs → #features (programs grid) · Community → #story
 * (Learn/Build/Launch triptych) · Events → #demo (AI Fridays / Hack Days schedule) · Resources → #cta
 * (charter card) · About → #agentic (launchpad intro). "Members" goes to the Telegram community.
 */
export const nav: { items: NavItem[]; login: { label: string; href: string }; primary: { label: string; href: string }; secondary: { label: string; href: string } } = {
  items: [
    {
      label: 'Programs',
      href: sectionIds.features,
      columns: [
        {
          items: [
            { title: 'Qairu AI Fridays', description: 'Weekly AI sessions, every Friday', href: sectionIds.features, icon: 'sparkle' },
            { title: 'Qairu Hackathons', description: '12-hour Hack Days and Demo Nights', href: sectionIds.features, icon: 'bolt' },
            { title: 'Qairu Accelerator', description: '8–10 weeks from idea to Demo Day', href: sectionIds.accelerator, icon: 'rocket' },
            { title: 'Peer Learning', description: 'Study groups and mentor matching', href: sectionIds.features, icon: 'book' },
            { title: 'Qairu Space', description: 'A cowork home for builders', href: sectionIds.features, icon: 'grid' },
          ],
        },
      ],
      cta: {
        title: 'Qairu Accelerator — Cohort 1',
        description: 'Spring 2027. No equity. Idea → MVP → Demo Day inside one semester.',
        cta: 'Learn more',
        href: sectionIds.accelerator,
      },
    },
    {
      label: 'Community',
      href: sectionIds.story,
      columns: [
        {
          title: 'Who it is for',
          items: [
            { title: 'First-year builders', description: 'Turn coursework MVPs into teams', href: sectionIds.story, icon: 'sparkle' },
            { title: 'Founders in progress', description: 'Find co-founders and mentors', href: sectionIds.story, icon: 'rocket' },
            { title: 'Researchers', description: 'Ship what you study', href: sectionIds.story, icon: 'search' },
            { title: 'Designers', description: 'Join a team that needs you', href: sectionIds.story, icon: 'pencil' },
            { title: 'Partners', description: 'Bring wins to QAIRU builders', href: sectionIds.join, icon: 'users' },
          ],
        },
        {
          title: 'Units',
          items: [
            { title: 'Qairu AI', description: 'Weekly AI Fridays', href: sectionIds.features, icon: 'sparkle' },
            { title: 'Qairu Hackathons', description: 'One flagship per semester', href: sectionIds.features, icon: 'bolt' },
            { title: 'Qairu Accelerator', description: 'Planned for Spring 2027', href: sectionIds.accelerator, icon: 'rocket' },
            { title: 'Education & Peer Learning', description: 'Study groups, mentor matching', href: sectionIds.features, icon: 'book' },
            { title: 'Qairu Space', description: 'Cowork and community home', href: sectionIds.features, icon: 'grid' },
          ],
        },
      ],
      cta: {
        title: 'QairuHub for partners',
        description: 'Sponsor a Hack Day, mentor a cohort, or hire straight from Demo Day.',
        cta: 'Learn more',
        href: sectionIds.join,
      },
    },
    { label: 'Events', href: sectionIds.demo },
    {
      label: 'Resources',
      href: sectionIds.cta,
      columns: [
        {
          items: [
            { title: 'Playbooks', description: 'How we run events, units and handovers', href: sectionIds.features, icon: 'book' },
            { title: 'Charter', description: 'How QairuHub is governed', href: sectionIds.cta, icon: 'check' },
            { title: 'GitHub', description: 'Everything we do lives in the open', href: brand.links.github, icon: 'folder', external: true },
            { title: 'Telegram', description: 'Announcements and discussion', href: brand.links.telegram, icon: 'users', external: true },
          ],
        },
      ],
    },
    { label: 'About', href: sectionIds.agentic },
  ],
  login: { label: 'Members', href: brand.links.telegram },
  primary: { label: 'Join QairuHub', href: sectionIds.join },
  secondary: { label: 'Partner with us', href: sectionIds.join },
}

/* ------------------------------------------------------------------ Hero (3D glass wordmark only) */
export const hero = {
  /** rendered as the 3D glass sculpture; also the sr-only h1 */
  wordmark: brand.wordmark,
  srTitle: 'QairuHub — the student-driven builder community at QAIRU',
}

/* ------------------------------------------------------------------ "Agentic cards" section */
export const agentic = {
  title: 'Your launchpad for AI builders',
  subtitle: 'Learn it. Build it. Launch it.',
  cta: { label: 'Join QairuHub', href: sectionIds.join },
  /** typed one after another in the pill above the cards; index i highlights card i % 3 */
  prompts: [
    'Find me a team for the October Hack Day',
    'What is happening at AI Fridays this week?',
    'Apply to Qairu Accelerator Cohort 1',
    'Match me with a mentor for my MVP',
  ],
  cards: [
    {
      title: 'Learn',
      body: 'Weekly AI Fridays, study groups and mentor matching. The more you show up, the faster you level up.',
    },
    {
      title: 'Build',
      body: 'Hack Days, build sprints and a project registry. Every event ends with something made, learned or committed.',
    },
    {
      title: 'Launch',
      body: 'The Qairu Accelerator turns student projects into shipped products and startups — no equity, no IP claims.',
    },
  ],
}

/* ------------------------------------------------------------------ Logo entries (logo bar + integrations) */
/** Typographic hint for a text placeholder wordmark (rendered by src/components/ui/LogoMark.tsx). */
export type LogoStyle = 'caps' | 'sans' | 'mono' | 'serif' | 'script'

/**
 * One entry of `logos.items` / `integrations.items`. Text placeholder by default; to swap in a real
 * logo, drop a white monochrome SVG into /public/logos/<slug>.svg and add `src` to the entry —
 * both sections forward it straight to <LogoMark>, which then renders the image instead of text.
 */
export interface LogoItem {
  name: string
  /** Look of the text placeholder. Ignored (and safe to delete) once `src` is set. */
  style?: LogoStyle
  /** Path to a WHITE monochrome SVG/PNG (e.g. '/logos/qairu.svg'). Omit to keep the text placeholder. */
  src?: string
}

/* ------------------------------------------------------------------ Logo bar */
export const logos: { title: string; items: LogoItem[] } = {
  title: 'Where QAIRU builders do their best work',
  /** Text wordmarks as placeholders until real SVG logos are supplied. `style` hints a look. */
  items: [
    { name: 'QAIRU', style: 'caps' },
    { name: 'Astana Hub', style: 'sans' },
    { name: 'Alem.ai', style: 'mono' },
    { name: 'NURIS', style: 'caps' },
    { name: 'nFactorial', style: 'sans' },
    { name: 'Talent Lab', style: 'serif' },
    { name: 'Qairu AI', style: 'script' },
    { name: 'Qairu Hackathons', style: 'caps' },
    { name: 'Qairu Space', style: 'sans' },
    { name: 'Qairu Accelerator', style: 'serif' },
  ],
}

/* ------------------------------------------------------------------ Waitlist (accelerator) */
export const waitlist = {
  pill: 'Spring 2027',
  titleLine1: 'A student accelerator that',
  /** rendered in cursive */
  titleLine2: 'actually ships',
  body: '8–10 weeks. 6–10 teams. Zero equity. Idea → MVP → Demo Day, inside one semester.',
  placeholder: 'Email address',
  cta: 'Notify me',
  /** big media card under the form */
  demoCaption: 'Qairu Accelerator can turn your MVP into a company.',
  demoSteps: ['Idea', 'MVP', 'Demo Day', 'Astana Hub'],
}

/* ------------------------------------------------------------------ Supersize display text */
export const supersize = {
  /** one sentence pair, uppercase compressed, bleeding to viewport edges */
  text: 'Builders over talkers. Ship every semester.',
}

/* ------------------------------------------------------------------ Product demo (tabbed) */
export const productDemo = {
  tabs: [
    { label: 'AI Fridays', icon: 'sparkle' as const, screen: 'schedule' as const },
    { label: 'Hack Days', icon: 'bolt' as const, screen: 'leaderboard' as const },
    { label: 'Accelerator', icon: 'rocket' as const, screen: 'cohort' as const },
  ],
  /** mock app window content (light UI island on the dark sky) */
  app: {
    name: 'QairuHub Core',
    sidebar: ['Programs', 'Events', 'Members', 'Projects', 'Decisions', 'Playbooks'],
    schedule: {
      title: 'AI Fridays · Fall 2026',
      rows: [
        ['Sep 12', 'Agents that ship: from prompt to product', 'Talk + build slot'],
        ['Sep 19', 'Customer discovery for AI products', 'Workshop'],
        ['Sep 26', 'Teach slot: fine-tuning on a laptop', 'Peer session'],
        ['Oct 3', 'Demo Night prep', 'Open build'],
      ],
    },
    leaderboard: {
      title: 'Hack Day · October',
      rows: [
        ['Team Aral', 'Voice agent for pharmacies', '12h'],
        ['Team Saryarka', 'Campus navigation copilot', '12h'],
        ['Team Tengri', 'Kazakh-language tutor', '12h'],
        ['Team Baiterek', 'Receipt-to-budget parser', '12h'],
      ],
    },
    cohort: {
      title: 'Accelerator · Cohort 1',
      columns: ['Idea', 'MVP', 'Traction', 'Demo Day'],
      counts: [3, 4, 2, 1],
    },
  },
  autoAdvanceMs: 9000,
}

/* ------------------------------------------------------------------ Features grid */
export const features = {
  titleBefore: 'QairuHub unblocks builders ',
  /** cursive */
  titleCursive: 'at scale',
  titleAfter: '.',
  body: 'Learn with peers, ship at Hack Days, and launch through the Accelerator. All in one community.',
  /** `cols` follows the reference layout: 7/5 · 5/7 · 4/4/4 */
  items: [
    {
      title: 'Qairu AI Fridays',
      body: 'Weekly sessions every Friday: a talk, a build slot and a teach slot. Small and consistent beats big and rare.',
      cols: 7,
      visual: 'schedule' as const,
    },
    {
      title: 'Qairu Hackathons',
      body: '12-hour Hack Days and Demo Nights. One flagship per semester, documented so the next team can run it better.',
      cols: 5,
      visual: 'chart' as const,
    },
    {
      title: 'Project Registry',
      body: 'Every project gets one owner, one repo and one page. Open by default, so knowledge never gets trapped in DMs.',
      cols: 5,
      visual: 'links' as const,
    },
    {
      title: 'Qairu Accelerator',
      body: '8–10 weeks from idea to Demo Day with a tracker, weekly workshops and mentors from week one. Teams keep 100% of their IP.',
      cols: 7,
      visual: 'timeline' as const,
    },
    {
      title: 'Peer Learning',
      body: 'Study groups, mentor matching and the teach slot at AI Fridays. Learn from people one step ahead of you.',
      cols: 4,
      visual: null,
    },
    {
      title: 'Qairu Space',
      body: 'A cowork and community home at QAIRU. Show up, sit down, ship.',
      cols: 4,
      visual: null,
    },
    {
      title: 'Open Playbooks',
      body: 'Event, onboarding and handover playbooks live in the open on GitHub. Leave it better than you found it.',
      cols: 4,
      visual: null,
    },
  ],
}

/* ------------------------------------------------------------------ CTA card ("One plan. Every model.") */
export const ctaCard = {
  /** cursive headline */
  title: 'One community. Every builder.',
  subtitle: 'Whatever you want to build, start here.',
  body: 'Attend for free, join a unit when you are ready, apply to the Accelerator when you have a team. No equity, no IP claims, ever.',
  cta: { label: 'Read the charter', href: brand.links.github },
}

/* ------------------------------------------------------------------ Integrations marquee */
export const integrations: { titleBefore: string; titleCursive: string; titleAfter: string; items: LogoItem[] } = {
  titleBefore: 'QairuHub plugs into the ',
  titleCursive: 'whole',
  titleAfter: ' ecosystem',
  items: [
    { name: 'GitHub', style: 'sans' },
    { name: 'Telegram', style: 'sans' },
    { name: 'Astana Hub', style: 'caps' },
    { name: 'Alem.ai', style: 'mono' },
    { name: 'NURIS', style: 'caps' },
    { name: 'Talent Lab', style: 'serif' },
    { name: 'Hugging Face', style: 'sans' },
    { name: 'Cloudflare', style: 'sans' },
    { name: 'Figma', style: 'sans' },
    { name: 'Vercel', style: 'caps' },
  ],
}

/* ------------------------------------------------------------------ Storytelling triptych (sticky) */
export const story = {
  items: [
    {
      title: 'Learn',
      body: 'AI Fridays, study groups and mentors build your context — what good looks like, how real products get made, who to ask.',
    },
    {
      title: 'Build',
      body: 'Hack Days and build sprints turn ideas into working MVPs. One owner per project, one visible result per semester.',
    },
    {
      title: 'Launch',
      body: 'The Accelerator takes a working MVP to Demo Day — and hands strong teams up to Astana Hub, Talent Lab and investors.',
    },
  ],
}

/* ------------------------------------------------------------------ Form */
export const form = {
  titleLine1: 'Give your ideas',
  titleLine2Before: 'a place to ',
  /** cursive */
  titleLine2Cursive: 'ship',
  titleLine2After: '.',
  body: 'Tell us what you want to build. We will match you with a team, a mentor and the next program.',
  fields: {
    firstName: 'First name*',
    lastName: 'Last name*',
    email: 'Email address*',
    telegram: 'Telegram handle*',
    year: { label: 'Year of study*', options: ['1st year', '2nd year', '3rd year', '4th year', "Master's", 'PhD', 'Not a QAIRU student'] },
    source: {
      label: 'How did you hear about us?*',
      options: ['Telegram', 'Instagram', 'A friend', 'AI Fridays', 'Hack Day', 'Faculty', 'Astana Hub', 'Other'],
    },
    message: 'Message',
  },
  submit: 'Submit',
  legalBefore: 'By submitting the form, you agree to our ',
  legalLink1: { label: 'Code of Conduct', href: brand.links.charter },
  legalMiddle: ' and acknowledge our ',
  legalLink2: { label: 'Privacy Policy', href: brand.links.privacy },
  successTitle: 'You are on the list.',
  successBody: 'We will reach out on Telegram within a week.',
  submitFailed: 'Something went wrong. Please try again.',
}

/* ------------------------------------------------------------------ Footer */
export const footer = {
  /** In-page links mirror the header anchor map; the site sets no cookies, so the last slot is the privacy policy. */
  links: [
    { label: 'Programs', href: sectionIds.features },
    { label: 'Events', href: sectionIds.demo },
    { label: 'About', href: sectionIds.agentic },
    { label: 'Join', href: sectionIds.join },
    { label: 'Charter', href: brand.links.charter, external: true },
    { label: 'GitHub', href: brand.links.github, external: true },
    { label: 'Telegram', href: brand.links.telegram, external: true },
    { label: 'Privacy', href: brand.links.privacy, external: true },
  ],
  socials: [
    { label: 'Telegram', href: brand.links.telegram, icon: 'telegram' as const },
    { label: 'Instagram', href: brand.links.instagram, icon: 'instagram' as const },
    { label: 'X', href: brand.links.x, icon: 'x' as const },
    { label: 'LinkedIn', href: brand.links.linkedin, icon: 'linkedin' as const },
    { label: 'GitHub', href: brand.links.github, icon: 'github' as const },
  ],
  copyright: brand.copyright,
}
