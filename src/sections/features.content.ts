/**
 * Decorative copy for the Features-grid card mocks that is not yet declared on `features` in
 * src/content.ts.
 *
 * Shape mirrors the target location one-to-one (`features.mock.schedule`, `features.mock.milestones`)
 * so the owner of content.ts can fold it in verbatim and delete this file. Features.tsx reads only
 * these two keys; the mocks are aria-hidden illustrations, so this copy is never read aloud.
 *
 * Previously the mocks borrowed `productDemo.app.schedule.rows` / `productDemo.app.cohort.columns`,
 * which meant editing the product-demo copy silently changed the Features cards. Owning the rows
 * here keeps the two sections independent.
 */
export const featuresMock = {
  /** "Qairu AI Fridays" card: 4 rows of [date, title, kind] — time @48px, title (ellipsis), chip. */
  schedule: [
    ['Oct 9', 'Shipping an AI agent in a weekend', 'Talk'],
    ['Oct 16', 'Build slot: evals for your MVP', 'Build slot'],
    ['Oct 23', 'Teach slot: RAG without the hype', 'Teach slot'],
    ['Oct 30', 'Demo Night rehearsals', 'Open build'],
  ],
  /** "Qairu Accelerator" card: 4 milestone labels on the 10-week track (weeks 1 / 4 / 7 / 10). */
  milestones: ['Idea', 'MVP', 'Demo Day', 'Astana Hub'],
} as const
