/**
 * Product-demo copy that is not yet declared on `productDemo` in src/content.ts.
 *
 * Shape mirrors the target location one-to-one so the owner of content.ts can fold it in
 * verbatim (`productDemo.heading`, `productDemo.tablistLabel`, `productDemo.app.chrome`) and
 * delete this file; ProductDemo.tsx reads only these three keys.
 */
export const productDemoCopy = {
  /** Screen-reader-only section heading (keeps the h2 outline; the section is visually stage + tab bar only). */
  heading: 'Product demo',
  /** aria-label of the tablist that switches the mock app screens. */
  tablistLabel: 'Product demo screens',
  /** Mock-chrome labels (generic app furniture inside the window mock, not marketing copy). */
  chrome: { search: 'Search or ask…', upload: 'Upload', create: 'Create' },
} as const
