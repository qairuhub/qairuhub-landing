
### Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 92 (91, 92, 92) | 2207 | 3023 | 62 | 0.000 | 2768 | 5272 | 774.5 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |

### Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 100 (100, 100, 100) | 504 | 669 | 0 | 0.000 | 876 | 669 | 774.5 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |

### JS bootup time per script (run 1, ms: total / scripting / parse+compile)


**mobile**

| page | scripts |
|---|---|
| home | index-Dfr_rmi3.js 2069/286/1<br>react-D48Lzm2I.js 864/638/0<br>r3f-Bg8020Tw.js 502/499/1<br>Unattributable 447/193/0<br>/ 205/6/1 |

**desktop**

| page | scripts |
|---|---|
| home | index-Dfr_rmi3.js 272/49/0<br>react-D48Lzm2I.js 222/171/0<br>r3f-Bg8020Tw.js 183/182/0<br>/ 172/1/0<br>Unattributable 108/48/0 |

### Main-thread breakdown (run 1, ms)

| page / preset | Script Evaluation | Other | Style & Layout | Rendering | Garbage Collection | Parse HTML & CSS | Script Parsing & Compilation |
|---|---|---|---|---|---|---|---|
| home mobile | 1697 | 1422 | 742 | 270 | 41 | 9 | 5 |
| home desktop | 477 | 265 | 173 | 54 | 16 | 2 | 1 |

### Unused JS / CSS, render-blocking (run 1, mobile)

| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |
|---|---|---|---|
| home | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-B9bGiZVF.css 17.4 KiB 611 ms<br>/assets/index-B9bGiZVF.css 17.4 KiB 611 ms |

### Long tasks (run 1)

| page / preset | long tasks (url @start: duration ms) |
|---|---|
| home mobile | react-D48Lzm2I.js @4998: 98<br>react-D48Lzm2I.js @2810: 82<br>react-D48Lzm2I.js @5464: 69<br>react-D48Lzm2I.js @5096: 56 |
| home desktop | none |

### Network requests before load settles (run 1, mobile; transfer bytes, priority)


**home** (22 requests, 774.5 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.9 | / |
| 25 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 27 | Script | High | 44.2 | /assets/index-Dfr_rmi3.js |
| 27 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 27 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 29 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 29 | Stylesheet | VeryHigh | 17.4 | /assets/index-B9bGiZVF.css |
| 109 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 109 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 120 | Other | High | 1.3 | /favicon.svg |
| 120 | Script | High | 7.6 | /assets/ProductDemo-B_OxFZRs.js |
| 121 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 121 | Script | High | 5.9 | /assets/DemoForm-CYbLecst.js |
| 121 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 203 | Script | High | 3.4 | /assets/wordmarkFont-B88K5Qa4.js |
| 204 | Script | High | 28.6 | /assets/SkyScene-Bt1wXtDM.js |
| 204 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 205 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 229 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 235 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 332 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 723 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

### Other audits (run 1)

| page / preset | font-display | image audits (score/items) | DOM nodes | layout shifts | non-composited anims | cache TTL | text compression | legacy JS | console errors |
|---|---|---|---|---|---|---|---|---|---|
| home mobile | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |
| home desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |

Environment: {"benchmarkIndex":3308.5,"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36","formFactor":"desktop","throttling":"simulate"}
