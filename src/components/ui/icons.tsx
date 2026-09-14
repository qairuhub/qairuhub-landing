import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

/* ---- UI glyphs ------------------------------------------------------------- */
export const ChevronDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const ChevronRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const ArrowUpRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
)
export const ArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const Sparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" />
  </svg>
)
export const Search = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
)
export const Check = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const CheckCircle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </svg>
)
export const Bolt = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13 3L5 14h6l-1 7 9-12h-6l1-6z" />
  </svg>
)
export const Rocket = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4c3 0 6 3 6 6-2 2-5 5-7 6l-3-3c1-2 4-5 4-9z" />
    <path d="M10 13l-4 1 2-4 2 3zM11 14l1 4-4-2 3-2z" />
    <circle cx="15.5" cy="8.5" r="1" />
  </svg>
)
export const Users = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M15 5.5a3 3 0 010 5.5M17 14c2 .6 3.5 2.3 3.5 5" />
  </svg>
)
export const Folder = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2v-10z" />
  </svg>
)
export const Pencil = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20l4-1 10-10-3-3L5 16l-1 4zM13 8l3 3" />
  </svg>
)
export const Calendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="5.5" width="16" height="14" rx="2" />
    <path d="M4 10h16M8 3.5v4M16 3.5v4" />
  </svg>
)
export const Book = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5.5a2 2 0 012-2h13v15H6a2 2 0 00-2 2v-15z" />
    <path d="M4 18.5a2 2 0 012-2h13" />
  </svg>
)
export const Grid2 = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
)
export const Menu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const Close = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const Play = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5-11-6.5z" />
  </svg>
)

/* ---- Social glyphs (generic placeholders — swap for official assets later) ---- */
export const SocialTelegram = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M21 4L3.5 11l6 2 2.5 6 3-4.5 4.5 3L21 4z" />
    <path d="M9.5 13l9-7" />
  </svg>
)
export const SocialInstagram = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="17" cy="7" r="0.8" fill="currentColor" />
  </svg>
)
export const SocialX = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 4l14 16M19 4L5 20" />
  </svg>
)
export const SocialLinkedIn = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 10.5v6M8 7.8v.2M12 16.5v-6M12 13c0-1.5 1-2.5 2.3-2.5S16.5 11.5 16.5 13v3.5" />
  </svg>
)
export const SocialGitHub = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 20c-4 1.2-4-2-5.5-2.4M15 20v-3.3a2.8 2.8 0 00-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1-.3-3.3 1.2a11.4 11.4 0 00-6 0C6.7 1.8 5.7 2.1 5.7 2.1a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 004.3 8.5c0 4.7 2.8 5.7 5.5 6a2.8 2.8 0 00-.8 2.2V20" />
  </svg>
)
export const SocialYouTube = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="6" width="17" height="12" rx="3.5" />
    <path d="M10.5 9.5v5l4-2.5-4-2.5z" fill="currentColor" stroke="none" />
  </svg>
)
