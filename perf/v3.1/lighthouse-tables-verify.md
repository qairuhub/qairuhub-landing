
### Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 45.5 (91, 0) | 2215 | 3027 | 81 | 0.000 | 2830 | 5284 | 769.0 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| kk | 46.5 (93, 0) | 1823 | 2873 | 90 | 0.000 | 2887 | 5952 | 880.2 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| members | 38.5 (77, 0) | 2012 | 3775 | 407 | 0.000 | 2249 | 5137 | 703.9 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 33 (66, 0) | 2178 | 5345 | 484 | 0.000 | 2178 | 5382 | 721.9 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 49.5 (99, 0) | 518 | 678 | 0 | 0.000 | 1115 | 678 | 769.0 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| kk | 49.5 (99, 0) | 425 | 625 | 0 | 0.000 | 1063 | 625 | 880.2 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| members | 49.5 (99, 0) | 472 | 749 | 62 | 0.000 | 765 | 1029 | 703.9 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 49 (98, 0) | 526 | 1061 | 9 | 0.000 | 734 | 1061 | 721.9 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### JS bootup time per script (run 1, ms: total / scripting / parse+compile)


**mobile**

| page | scripts |
|---|---|
| home | index-DEf7J7Q8.js 1874/271/1<br>react-D48Lzm2I.js 823/624/0<br>Unattributable 409/176/0<br>r3f-Bg8020Tw.js 399/397/1<br>/ 189/3/0 |
| kk | index-DEf7J7Q8.js 1932/277/1<br>react-D48Lzm2I.js 746/589/0<br>r3f-Bg8020Tw.js 408/405/1<br>Unattributable 373/179/0<br>/kk/ 170/4/0 |
| members | index-DEf7J7Q8.js 1034/227/1<br>r3f-Bg8020Tw.js 822/820/1<br>react-D48Lzm2I.js 442/322/0<br>/members 395/4/0<br>Unattributable 268/34/0 |
| handbook | index-DEf7J7Q8.js 829/222/1<br>r3f-Bg8020Tw.js 777/776/1<br>/handbook 448/4/0<br>react-D48Lzm2I.js 443/334/0<br>Unattributable 241/40/0 |

**desktop**

| page | scripts |
|---|---|
| home | index-DEf7J7Q8.js 346/64/0<br>react-D48Lzm2I.js 256/206/0<br>/ 224/2/0<br>Unattributable 135/58/0<br>r3f-Bg8020Tw.js 57/56/0 |
| kk | index-DEf7J7Q8.js 259/48/0<br>react-D48Lzm2I.js 221/169/0<br>/kk/ 182/1/0<br>Unattributable 110/51/0<br>r3f-Bg8020Tw.js 69/69/0 |
| members | index-DEf7J7Q8.js 212/51/0<br>r3f-Bg8020Tw.js 193/192/0<br>react-D48Lzm2I.js 164/136/0<br>/members 97/2/0<br>Unattributable 57/11/0 |
| handbook | index-DEf7J7Q8.js 211/56/0<br>r3f-Bg8020Tw.js 155/154/0<br>react-D48Lzm2I.js 136/109/0<br>/handbook 132/1/0<br>Unattributable 62/8/0 |

### Main-thread breakdown (run 1, ms)

| page / preset | Script Evaluation | Other | Style & Layout | Rendering | Garbage Collection | Parse HTML & CSS | Script Parsing & Compilation |
|---|---|---|---|---|---|---|---|
| home mobile | 1533 | 1267 | 694 | 239 | 33 | 11 | 3 |
| kk mobile | 1517 | 1149 | 759 | 243 | 35 | 7 | 4 |
| members mobile | 1426 | 1002 | 368 | 168 | 23 | 8 | 4 |
| handbook mobile | 1391 | 775 | 410 | 162 | 18 | 20 | 4 |
| home desktop | 425 | 336 | 215 | 68 | 18 | 3 | 1 |
| kk desktop | 365 | 258 | 185 | 52 | 12 | 2 | 1 |
| members desktop | 396 | 204 | 87 | 38 | 4 | 3 | 1 |
| handbook desktop | 334 | 197 | 119 | 44 | 8 | 5 | 1 |

### Unused JS / CSS, render-blocking (run 1, mobile)

| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |
|---|---|---|---|
| home | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-B3erPo4Y.css 17.2 KiB 613 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 613 ms |
| kk | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-B3erPo4Y.css 17.2 KiB 612 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 612 ms |
| members | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-DEf7J7Q8.js: 20.3/40.7<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-B3erPo4Y.css 17.2 KiB 462 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 462 ms |
| handbook | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-DEf7J7Q8.js: 20.4/40.7<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-B3erPo4Y.css 17.2 KiB 616 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 616 ms |

### Long tasks (run 1)

| page / preset | long tasks (url @start: duration ms) |
|---|---|
| home mobile | react-D48Lzm2I.js @4857: 93<br>react-D48Lzm2I.js @2833: 76<br>react-D48Lzm2I.js @5480: 70<br>react-D48Lzm2I.js @4950: 54<br>Unattributable @614: 53 |
| kk mobile | react-D48Lzm2I.js @5461: 92<br>react-D48Lzm2I.js @3092: 74<br>index-DEf7J7Q8.js @2468: 65<br>react-D48Lzm2I.js @6219: 61<br>index-DEf7J7Q8.js @3166: 55 |
| members mobile | index-DEf7J7Q8.js @4621: 428<br>react-D48Lzm2I.js @3116: 89<br>react-D48Lzm2I.js @5174: 75<br>Unattributable @613: 64<br>react-D48Lzm2I.js @3049: 51 |
| handbook mobile | index-DEf7J7Q8.js @4595: 438<br>index-DEf7J7Q8.js @2432: 94<br>react-D48Lzm2I.js @3155: 81<br>react-D48Lzm2I.js @5345: 68<br>react-D48Lzm2I.js @3063: 62 |
| home desktop | none |
| kk desktop | none |
| members desktop | index-DEf7J7Q8.js @926: 103<br>react-D48Lzm2I.js @700: 59 |
| handbook desktop | index-DEf7J7Q8.js @941: 59 |

### Network requests before load settles (run 1, mobile; transfer bytes, priority)


**home** (22 requests, 769.0 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.9 | / |
| 28 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 31 | Script | High | 43.7 | /assets/index-DEf7J7Q8.js |
| 31 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 34 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 34 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 36 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 135 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 135 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 149 | Other | High | 1.3 | /favicon.svg |
| 150 | Script | High | 7.6 | /assets/ProductDemo-B1Zf0FBH.js |
| 150 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 150 | Script | High | 5.9 | /assets/DemoForm-DKKn3q7I.js |
| 150 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 232 | Script | High | 3.4 | /assets/wordmarkFont-CVOrvAOe.js |
| 233 | Script | High | 23.7 | /assets/SkyScene-CPK7kB0h.js |
| 233 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 233 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 255 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 259 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 355 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 738 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**kk** (24 requests, 880.2 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 2.1 | /kk/ |
| 31 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 32 | Font | High | 11.0 | /fonts/Oswald-600-cyrillic.woff2 |
| 32 | Font | High | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 34 | Script | High | 43.7 | /assets/index-DEf7J7Q8.js |
| 36 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 38 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 38 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 38 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 134 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 145 | Other | High | 1.3 | /favicon.svg |
| 236 | Script | High | 7.6 | /assets/ProductDemo-B1Zf0FBH.js |
| 236 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 236 | Script | High | 5.9 | /assets/DemoForm-DKKn3q7I.js |
| 236 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 255 | Script | High | 3.4 | /assets/wordmarkFont-CVOrvAOe.js |
| 257 | Script | High | 23.7 | /assets/SkyScene-CPK7kB0h.js |
| 257 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 257 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 286 | Font | VeryHigh | 100.0 | /fonts/Caveat-cyrillic.woff2 |
| 291 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 328 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 401 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 794 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**members** (20 requests, 703.9 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /members |
| 23 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 23 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 23 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 23 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 27 | Script | High | 43.7 | /assets/index-DEf7J7Q8.js |
| 28 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 28 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 29 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 30 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 114 | Script | High | 5.2 | /assets/MembersPage-DMkGnMH1.js |
| 115 | Script | High | 1.8 | /assets/pageScroll-kxH7voKT.js |
| 115 | Stylesheet | VeryHigh | 2.2 | /assets/MembersPage-Cf8tOaP5.css |
| 115 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 140 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 147 | Other | High | 1.3 | /favicon.svg |
| 218 | Script | High | 23.7 | /assets/SkyScene-CPK7kB0h.js |
| 218 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 218 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 219 | Script | High | 3.4 | /assets/wordmarkFont-CVOrvAOe.js |

**handbook** (20 requests, 721.9 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /handbook |
| 33 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 33 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 33 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 34 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 39 | Script | High | 43.7 | /assets/index-DEf7J7Q8.js |
| 39 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 39 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 39 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 39 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 131 | Script | High | 22.6 | /assets/HandbookPage-rbJbNqBo.js |
| 131 | Script | High | 1.8 | /assets/pageScroll-kxH7voKT.js |
| 131 | Stylesheet | VeryHigh | 2.7 | /assets/HandbookPage-DFbqdk19.css |
| 131 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 158 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 175 | Other | High | 1.3 | /favicon.svg |
| 240 | Script | High | 23.7 | /assets/SkyScene-CPK7kB0h.js |
| 240 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 240 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 240 | Script | High | 3.4 | /assets/wordmarkFont-CVOrvAOe.js |

### Other audits (run 1)

| page / preset | font-display | image audits (score/items) | DOM nodes | layout shifts | non-composited anims | cache TTL | text compression | legacy JS | console errors |
|---|---|---|---|---|---|---|---|---|---|
| home mobile | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |
| kk mobile | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |
| members mobile | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 508 | 0 | 0 | 1 | 1 | 0 | none |
| handbook mobile | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1617 | 0 | 0 | 1 | 1 | 0 | none |
| home desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |
| kk desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1967 | 0 | 1 | 1 | 1 | 0 | none |
| members desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 508 | 0 | 0 | 1 | 1 | 0 | none |
| handbook desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1617 | 0 | 0 | 1 | 1 | 0 | none |

Environment: {"benchmarkIndex":3523,"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36","formFactor":"desktop","throttling":"simulate"}
