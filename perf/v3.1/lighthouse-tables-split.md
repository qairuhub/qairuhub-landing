
### Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 91 (91) | 2212 | 3025 | 78 | 0.000 | 2648 | 5275 | 769.3 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| kk | 93 (93) | 1821 | 2871 | 99 | 0.000 | 2889 | 5956 | 880.4 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| members | 77 (77) | 2146 | 3781 | 406 | 0.000 | 2269 | 5146 | 704.1 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 68 (68) | 2199 | 5195 | 431 | 0.000 | 2199 | 5229 | 722.1 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 82 (82) | 504 | 669 | 394 | 0.000 | 886 | 1551 | 769.3 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| kk | 82 (82) | 429 | 629 | 409 | 0.000 | 935 | 1632 | 880.4 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| members | 99 (99) | 468 | 747 | 59 | 0.000 | 744 | 1030 | 704.1 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 99 (99) | 489 | 1041 | 16 | 0.000 | 680 | 1041 | 722.1 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### JS bootup time per script (run 1, ms: total / scripting / parse+compile)


**mobile**

| page | scripts |
|---|---|
| home | index-PNJKSfHc.js 1775/272/0<br>react-D48Lzm2I.js 775/578/0<br>r3f-Bg8020Tw.js 457/453/1<br>Unattributable 363/189/0<br>/ 170/4/0 |
| kk | index-PNJKSfHc.js 1680/263/1<br>react-D48Lzm2I.js 904/565/0<br>r3f-Bg8020Tw.js 463/461/1<br>Unattributable 344/172/0<br>/kk/ 153/6/1 |
| members | index-PNJKSfHc.js 825/205/1<br>r3f-Bg8020Tw.js 772/770/1<br>react-D48Lzm2I.js 401/295/0<br>/members 375/3/1<br>Unattributable 232/31/0 |
| handbook | index-PNJKSfHc.js 845/233/1<br>r3f-Bg8020Tw.js 753/750/1<br>/handbook 443/3/0<br>react-D48Lzm2I.js 418/316/0<br>Unattributable 230/32/0 |

**desktop**

| page | scripts |
|---|---|
| home | r3f-Bg8020Tw.js 677/676/0<br>index-PNJKSfHc.js 316/63/0<br>react-D48Lzm2I.js 200/167/0<br>/ 192/2/0<br>Unattributable 119/47/0 |
| kk | r3f-Bg8020Tw.js 684/683/0<br>index-PNJKSfHc.js 289/60/0<br>react-D48Lzm2I.js 228/160/0<br>/kk/ 155/1/0<br>Unattributable 121/44/0 |
| members | index-PNJKSfHc.js 226/52/0<br>r3f-Bg8020Tw.js 197/197/0<br>react-D48Lzm2I.js 151/125/0<br>/members 89/1/0<br>Unattributable 62/10/0 |
| handbook | index-PNJKSfHc.js 211/61/0<br>r3f-Bg8020Tw.js 164/164/0<br>react-D48Lzm2I.js 108/85/0<br>/handbook 106/1/0<br>Unattributable 59/8/0 |

### Main-thread breakdown (run 1, ms)

| page / preset | Script Evaluation | Other | Style & Layout | Rendering | Garbage Collection | Parse HTML & CSS | Script Parsing & Compilation |
|---|---|---|---|---|---|---|---|
| home mobile | 1557 | 1108 | 689 | 225 | 34 | 6 | 3 |
| kk mobile | 1533 | 1112 | 725 | 220 | 31 | 6 | 5 |
| members mobile | 1316 | 798 | 351 | 144 | 18 | 10 | 4 |
| handbook mobile | 1347 | 755 | 407 | 172 | 16 | 18 | 4 |
| home desktop | 980 | 303 | 176 | 59 | 14 | 2 | 1 |
| kk desktop | 972 | 288 | 176 | 55 | 13 | 3 | 1 |
| members desktop | 389 | 215 | 86 | 36 | 5 | 2 | 1 |
| handbook desktop | 323 | 186 | 97 | 40 | 6 | 4 | 1 |

### Unused JS / CSS, render-blocking (run 1, mobile)

| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |
|---|---|---|---|
| home | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-B3erPo4Y.css 17.2 KiB 612 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 612 ms |
| kk | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-B3erPo4Y.css 17.2 KiB 610 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 610 ms |
| members | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-PNJKSfHc.js: 20.3/40.7<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-B3erPo4Y.css 17.2 KiB 615 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 615 ms |
| handbook | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-PNJKSfHc.js: 20.4/40.7<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-B3erPo4Y.css 17.2 KiB 316 ms<br>/assets/index-B3erPo4Y.css 17.2 KiB 316 ms |

### Long tasks (run 1)

| page / preset | long tasks (url @start: duration ms) |
|---|---|
| home mobile | react-D48Lzm2I.js @4853: 98<br>react-D48Lzm2I.js @2821: 72<br>react-D48Lzm2I.js @5474: 59<br>react-D48Lzm2I.js @4951: 57 |
| kk mobile | react-D48Lzm2I.js @5476: 89<br>react-D48Lzm2I.js @3068: 78<br>react-D48Lzm2I.js @3146: 73<br>react-D48Lzm2I.js @6212: 66<br>react-D48Lzm2I.js @5565: 56 |
| members mobile | index-PNJKSfHc.js @4593: 414<br>react-D48Lzm2I.js @3136: 77<br>react-D48Lzm2I.js @5193: 67<br>react-D48Lzm2I.js @3062: 56<br>/members @620: 50 |
| handbook mobile | index-PNJKSfHc.js @4508: 389<br>index-PNJKSfHc.js @2447: 91<br>react-D48Lzm2I.js @3003: 81<br>react-D48Lzm2I.js @2913: 63<br>react-D48Lzm2I.js @5195: 63 |
| home desktop | index-PNJKSfHc.js @1109: 465<br>index-PNJKSfHc.js @1005: 54 |
| kk desktop | index-PNJKSfHc.js @1190: 459<br>index-PNJKSfHc.js @1086: 68 |
| members desktop | index-PNJKSfHc.js @922: 108<br>react-D48Lzm2I.js @692: 51 |
| handbook desktop | index-PNJKSfHc.js @921: 66 |

### Network requests before load settles (run 1, mobile; transfer bytes, priority)


**home** (22 requests, 769.3 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.9 | / |
| 24 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 26 | Script | High | 43.7 | /assets/index-PNJKSfHc.js |
| 26 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 27 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 28 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 29 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 107 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 107 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 116 | Other | High | 1.3 | /favicon.svg |
| 118 | Script | High | 7.6 | /assets/ProductDemo-kJwshFkp.js |
| 118 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 118 | Script | High | 5.9 | /assets/DemoForm-D0w7c3Ze.js |
| 119 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 192 | Script | High | 3.4 | /assets/wordmarkFont-DvXeB7me.js |
| 193 | Script | High | 23.9 | /assets/SkyScene-C-snhKwu.js |
| 193 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 193 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 214 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 218 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 315 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 698 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**kk** (24 requests, 880.4 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 2.1 | /kk/ |
| 25 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 25 | Font | High | 11.0 | /fonts/Oswald-600-cyrillic.woff2 |
| 25 | Font | High | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 27 | Script | High | 43.7 | /assets/index-PNJKSfHc.js |
| 29 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 29 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 29 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 29 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 114 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 120 | Other | High | 1.3 | /favicon.svg |
| 205 | Script | High | 7.6 | /assets/ProductDemo-kJwshFkp.js |
| 205 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 205 | Script | High | 5.9 | /assets/DemoForm-D0w7c3Ze.js |
| 206 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 296 | Script | High | 3.4 | /assets/wordmarkFont-DvXeB7me.js |
| 297 | Script | High | 23.9 | /assets/SkyScene-C-snhKwu.js |
| 297 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 297 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 316 | Font | VeryHigh | 100.0 | /fonts/Caveat-cyrillic.woff2 |
| 319 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 365 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 365 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 815 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**members** (20 requests, 704.1 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /members |
| 27 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 28 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 28 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 28 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 32 | Script | High | 43.7 | /assets/index-PNJKSfHc.js |
| 33 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 33 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 34 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 34 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 121 | Script | High | 5.2 | /assets/MembersPage-DFDCDE1A.js |
| 121 | Script | High | 1.8 | /assets/pageScroll-BGWIUWGO.js |
| 122 | Stylesheet | VeryHigh | 2.2 | /assets/MembersPage-Cf8tOaP5.css |
| 122 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 153 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 169 | Other | High | 1.3 | /favicon.svg |
| 230 | Script | High | 23.9 | /assets/SkyScene-C-snhKwu.js |
| 230 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 230 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 230 | Script | High | 3.4 | /assets/wordmarkFont-DvXeB7me.js |

**handbook** (20 requests, 722.1 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /handbook |
| 30 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 30 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 30 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 31 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 37 | Script | High | 43.7 | /assets/index-PNJKSfHc.js |
| 39 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 39 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 40 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 41 | Stylesheet | VeryHigh | 17.2 | /assets/index-B3erPo4Y.css |
| 136 | Script | High | 22.6 | /assets/HandbookPage-COrvMAi2.js |
| 136 | Script | High | 1.8 | /assets/pageScroll-BGWIUWGO.js |
| 137 | Stylesheet | VeryHigh | 2.7 | /assets/HandbookPage-DFbqdk19.css |
| 137 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 167 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 184 | Other | High | 1.3 | /favicon.svg |
| 238 | Script | High | 23.9 | /assets/SkyScene-C-snhKwu.js |
| 238 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 238 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 239 | Script | High | 3.4 | /assets/wordmarkFont-DvXeB7me.js |

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

Environment: {"benchmarkIndex":3631,"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36","formFactor":"desktop","throttling":"simulate"}
