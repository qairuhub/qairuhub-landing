# Golden hour ending — brief

**Owner's request (2026-09-17, voice):** "внизу страницы была не ночь, а переход в golden hour, типа закат. Супер классно." — the journey must no longer end in night; the last screens become a golden-hour sunset. It has to look genuinely beautiful, not merely orange.

## What exists today

The one fixed WebGL canvas renders a scroll-driven journey (`src/sections/sky/journey.ts`):

```
space → descent → day sky → dusk → NIGHT + field (grass, hills, flora, moon)
```

- `PALETTE` (journey.ts): `space`, `descent`, `day`, `dusk { top #0d2a66, mid #164a9c, bottom #5d5f9c, glow #b7707a }`, `night { top #061a3d, mid #08234d, bottom #0b2c5c }`; `blendPalette()` lerps them by `pal.t0..t3`.
- `journey` flags per frame: `day`, `dusk` (bell), `night`, `stars`, `clouds`, `ground`, `wordmarkHero`, `wordmarkFooter`.
- `skyShaders.ts` `skyFragment`: a DUSK branch (warm horizon in the bottom third, `uDuskGlow`) and a NIGHT branch (moon glow at `vec2(uAspect * 0.74, 0.20)` + a brighter horizon band).
- `SceneLights.tsx`: hemisphere light + one directional "sun" lerped between day (`#fff3e2`, from `(-6, 8, 6)`) and night (`#9fb7ff`, from `(6, 7, 4)`), plus a drei `<Environment>` with three Lightformers (white top, cool blue rim, warm fill) that also lights the glass wordmark through its transmission pass.
- `field/terrain.ts`: `FIELD_COLORS` (grassBase `#163d1c`, grassMid `#2e7a34`, grassTip `#8fd07a`, soil, stalk, flower colours) and `MOON_DIR = (6, 7, 4)`, used by `grassShaders.ts` for the moonlit rim on every blade.
- `Stars.tsx` fades in again from dusk (`journey.stars`).
- The glass wordmark descends into the footer frame and turns 360° (`GlassWordmark.tsx`, FOOTER block).

## The target

The final phase becomes **golden hour**: the sun sits low and warm, the sky runs from a deep blue zenith through amber to a bright horizon, the hills read as near-silhouettes with rim-lit crests, the grass catches warm light on its tips with long shadows in the valley, and the glass wordmark picks up the warm light. Stars mostly disappear (a few may survive high in the zenith). The moon glow is replaced by the sun; the dusk phase before it becomes the approach to the sunset rather than a step toward night.

## Hard constraints

1. **Readability wins.** The footer and the last DOM sections sit on this sky with cream/white text (`.on-sky` glow in `src/styles/global.css`). Body text must keep **≥ 4.5:1** and large display text **≥ 3:1** against whatever is behind it, at 1440×900 and 390×844, EN and KK. Measure it, do not eyeball it: sample the real pixels behind the text. A bright horizon behind white copy is the main risk — keep the band behind the footer deep (silhouette foreground, glow above the text) or darken locally.
2. **Performance must not regress.** The loading pass just took mobile home from 41 to 92 (Lighthouse) and TBT from 3.3 s to 0.07 s. No new render passes, no extra full-screen blurs, no new textures over 256 KB, and **every GPU buffer stays ≤ 512 KiB** (`node <scratch>/macbug/verify.mjs`, the Mac corruption model). Frame cost at the footer must stay within ~1 ms of today on the Intel UHD reference.
3. **No new dependencies, no CDNs.** Shader and palette work only.
4. `prefers-reduced-motion` keeps working (no new motion that ignores it); the `?q=low|medium|high` tiers all look right; the sub-page static sky (`setStaticJourney('night')`, used by /members and /handbook) must keep matching its CSS fallback gradient (`sky/fallback.ts`) — decide deliberately whether those pages stay night or also become golden, and make the fallback gradient match whichever you choose.
5. Everything else about the journey (timings, the wordmark's descent and turn, the field layout) stays as it is.

## Craft notes

- Real golden hour is a *gradient of hue*, not a wash: cool blue zenith → violet → peach → amber → a hot, narrow band at the horizon, with the strongest saturation just above the skyline.
- The sun should be small and low, with a soft bloom and a subtle horizon haze — not a lens-flare sticker.
- Warm key light from the sun direction, cool sky fill from the opposite side; that contrast is what makes the hour read as golden.
- Long, soft shadows across the valley; rim light on grass tips facing the sun; flowers catch the warm light.
- Clouds near the horizon can glow amber from below.
- Restraint: no orange-tinted everything, no neon. If one element must be loud, it is the horizon band.
