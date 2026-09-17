
### Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 41 (41, 41) | 3129 | 5750 | 3270 | 0.000 | 4643 | 8431 | 762.6 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| kk | 37.5 (37, 38) | 3332 | 6642 | 3609 | 0.000 | 5129 | 9542 | 873.7 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| members | 51 (55, 47) | 2769 | 4675 | 2053 | 0.000 | 2780 | 6618 | 697.5 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 48 (48) | 2566 | 5197 | 2358 | 0.000 | 2566 | 6892 | 715.5 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 65 (65, 65) | 713 | 1162 | 1204 | 0.000 | 1840 | 2368 | 762.6 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| kk | 64 (65, 63) | 710 | 1323 | 1125 | 0.000 | 1881 | 2431 | 873.7 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| members | 72 (72) | 556 | 815 | 769 | 0.000 | 976 | 1830 | 697.5 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 78 (78) | 687 | 1071 | 453 | 0.000 | 899 | 1476 | 715.5 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### JS bootup time per script (run 1, ms: total / scripting / parse+compile)


**mobile**

| page | scripts |
|---|---|
| home | r3f-UhlMeCFy.js 5946/5944/1<br>react-D48Lzm2I.js 1692/1011/0<br>index-DI_7TtS3.js 1002/175/1<br>Unattributable 283/12/0<br>/ 54/5/1 |
| kk | r3f-UhlMeCFy.js 6031/6029/1<br>react-D48Lzm2I.js 1707/1013/0<br>index-DI_7TtS3.js 1078/285/1<br>Unattributable 259/12/0<br>/kk/ 74/5/1 |
| members | r3f-UhlMeCFy.js 2532/2524/1<br>index-DI_7TtS3.js 554/131/1<br>react-D48Lzm2I.js 368/263/0<br>/members 270/3/0<br>Unattributable 164/4/0 |
| handbook | r3f-UhlMeCFy.js 2673/2663/2<br>index-DI_7TtS3.js 593/158/1<br>react-D48Lzm2I.js 557/308/0<br>/handbook 258/3/0<br>Unattributable 239/6/0 |

**desktop**

| page | scripts |
|---|---|
| home | r3f-UhlMeCFy.js 2386/2386/0<br>react-D48Lzm2I.js 473/317/0<br>index-DI_7TtS3.js 164/34/0<br>Unattributable 60/2/0<br>/ 56/2/1 |
| kk | r3f-UhlMeCFy.js 1603/1603/0<br>react-D48Lzm2I.js 636/423/0<br>index-DI_7TtS3.js 136/31/0 |
| members | r3f-UhlMeCFy.js 871/870/0<br>react-D48Lzm2I.js 220/187/0<br>index-DI_7TtS3.js 212/53/0<br>/members 96/2/0 |
| handbook | r3f-UhlMeCFy.js 615/614/0<br>index-DI_7TtS3.js 177/46/0<br>react-D48Lzm2I.js 177/112/0<br>/handbook 69/1/0<br>Unattributable 61/2/0 |

### Main-thread breakdown (run 1, ms)

| page / preset | Script Evaluation | Other | Style & Layout | Rendering | Garbage Collection | Parse HTML & CSS | Script Parsing & Compilation |
|---|---|---|---|---|---|---|---|
| home mobile | 7194 | 955 | 653 | 159 | 75 | 8 | 4 |
| kk mobile | 7397 | 910 | 674 | 148 | 78 | 9 | 4 |
| members mobile | 2928 | 587 | 251 | 104 | 25 | 6 | 4 |
| handbook mobile | 3141 | 679 | 348 | 125 | 25 | 18 | 5 |
| home desktop | 2779 | 196 | 150 | 36 | 18 | 3 | 2 |
| kk desktop | 2072 | 171 | 177 | 30 | 22 | 3 | 1 |
| members desktop | 1114 | 205 | 87 | 37 | 7 | 3 | 1 |
| handbook desktop | 776 | 179 | 96 | 37 | 10 | 5 | 1 |

### Unused JS / CSS, render-blocking (run 1, mobile)

| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |
|---|---|---|---|
| home | three-BncCDUPi.js: 83.3/182.1<br>r3f-UhlMeCFy.js: 40.3/70.5 | none | /assets/index-DagKm4TW.css 16.9 KiB 474 ms<br>/assets/index-DagKm4TW.css 16.9 KiB 474 ms |
| kk | three-BncCDUPi.js: 83.3/182.1<br>r3f-UhlMeCFy.js: 40.3/70.5 | none | /assets/index-DagKm4TW.css 16.9 KiB 474 ms<br>/assets/index-DagKm4TW.css 16.9 KiB 474 ms |
| members | three-BncCDUPi.js: 99.4/182.1<br>r3f-UhlMeCFy.js: 41.9/70.5<br>react-D48Lzm2I.js: 20.4/57.7 | none | /assets/index-DagKm4TW.css 16.9 KiB 472 ms<br>/assets/index-DagKm4TW.css 16.9 KiB 472 ms |
| handbook | three-BncCDUPi.js: 99.4/182.1<br>r3f-UhlMeCFy.js: 41.9/70.5<br>react-D48Lzm2I.js: 20.4/57.7 | none | /assets/index-DagKm4TW.css 16.9 KiB 469 ms<br>/assets/index-DagKm4TW.css 16.9 KiB 469 ms |

### Long tasks (run 1)

| page / preset | long tasks (url @start: duration ms) |
|---|---|
| home mobile | index-DI_7TtS3.js @5746: 2737<br>react-D48Lzm2I.js @5074: 672<br>react-D48Lzm2I.js @3522: 263<br>index-DI_7TtS3.js @8649: 101<br>react-D48Lzm2I.js @3822: 99<br>react-D48Lzm2I.js @8483: 86 |
| kk mobile | index-DI_7TtS3.js @6798: 2777<br>react-D48Lzm2I.js @6030: 691<br>react-D48Lzm2I.js @4445: 293<br>index-DI_7TtS3.js @9665: 109<br>react-D48Lzm2I.js @4779: 91<br>react-D48Lzm2I.js @6721: 77<br>react-D48Lzm2I.js @5962: 52 |
| members mobile | index-DI_7TtS3.js @4468: 2229<br>react-D48Lzm2I.js @2816: 95<br>react-D48Lzm2I.js @6697: 69 |
| handbook mobile | index-DI_7TtS3.js @4473: 2344<br>react-D48Lzm2I.js @2823: 100<br>react-D48Lzm2I.js @6817: 87<br>react-D48Lzm2I.js @2758: 65<br>react-D48Lzm2I.js @2923: 64<br>Unattributable @620: 56 |
| home desktop | index-DI_7TtS3.js @1267: 1127<br>react-D48Lzm2I.js @1052: 196<br>react-D48Lzm2I.js @753: 64 |
| kk desktop | index-DI_7TtS3.js @1520: 741<br>react-D48Lzm2I.js @1234: 259<br>react-D48Lzm2I.js @870: 88<br>react-D48Lzm2I.js @1001: 77 |
| members desktop | index-DI_7TtS3.js @961: 757<br>react-D48Lzm2I.js @1718: 118 |
| handbook desktop | index-DI_7TtS3.js @972: 511 |

### Network requests before load settles (run 1, mobile; transfer bytes, priority)


**home** (21 requests, 762.6 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.9 | / |
| 38 | Font | High | 117.8 | /fonts/Inter-latin.woff2 |
| 38 | Font | High | 27.2 | /fonts/Anton-latin.woff2 |
| 38 | Font | High | 81.2 | /fonts/Caveat-latin.woff2 |
| 40 | Other | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 43 | Script | High | 42.0 | /assets/index-DI_7TtS3.js |
| 44 | Script | High | 1.3 | /assets/rolldown-runtime-hePW80VL.js |
| 45 | Script | High | 58.6 | /assets/react-D48Lzm2I.js |
| 45 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 45 | Stylesheet | VeryHigh | 16.9 | /assets/index-DagKm4TW.css |
| 196 | Script | High | 23.9 | /assets/SkyScene-BHDdzEhX.js |
| 196 | Script | High | 183.0 | /assets/three-BncCDUPi.js |
| 197 | Script | High | 71.4 | /assets/r3f-UhlMeCFy.js |
| 211 | Script | High | 7.5 | /assets/ProductDemo-BYQbYKZd.js |
| 211 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 223 | Script | High | 5.9 | /assets/DemoForm-DE2FMPj9.js |
| 223 | Stylesheet | VeryHigh | 2.8 | /assets/DemoForm-C0qAN6Yn.css |
| 325 | Font | VeryHigh | 51.7 | /fonts/Inter-cyrillic.woff2 |
| 325 | Font | VeryHigh | 6.4 | /fonts/Courgette-wordmark.woff2 |
| 339 | Other | High | 1.2 | /favicon.svg |
| 530 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**kk** (23 requests, 873.7 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 2.0 | /kk/ |
| 35 | Font | High | 117.8 | /fonts/Inter-latin.woff2 |
| 35 | Font | High | 27.2 | /fonts/Anton-latin.woff2 |
| 35 | Font | High | 81.2 | /fonts/Caveat-latin.woff2 |
| 35 | Other | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 38 | Font | High | 11.0 | /fonts/Oswald-600-cyrillic.woff2 |
| 40 | Font | High | 51.7 | /fonts/Inter-cyrillic.woff2 |
| 45 | Script | High | 42.0 | /assets/index-DI_7TtS3.js |
| 47 | Script | High | 1.3 | /assets/rolldown-runtime-hePW80VL.js |
| 47 | Script | High | 58.6 | /assets/react-D48Lzm2I.js |
| 47 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 48 | Stylesheet | VeryHigh | 16.9 | /assets/index-DagKm4TW.css |
| 183 | Script | High | 23.9 | /assets/SkyScene-BHDdzEhX.js |
| 183 | Script | High | 183.0 | /assets/three-BncCDUPi.js |
| 183 | Script | High | 71.4 | /assets/r3f-UhlMeCFy.js |
| 199 | Script | High | 7.5 | /assets/ProductDemo-BYQbYKZd.js |
| 199 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 208 | Script | High | 5.9 | /assets/DemoForm-DE2FMPj9.js |
| 208 | Stylesheet | VeryHigh | 2.8 | /assets/DemoForm-C0qAN6Yn.css |
| 326 | Font | VeryHigh | 99.9 | /fonts/Caveat-cyrillic.woff2 |
| 327 | Font | VeryHigh | 6.4 | /fonts/Courgette-wordmark.woff2 |
| 350 | Other | High | 1.2 | /favicon.svg |
| 533 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**members** (19 requests, 697.5 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.6 | /members |
| 25 | Font | High | 117.8 | /fonts/Inter-latin.woff2 |
| 25 | Font | High | 27.2 | /fonts/Anton-latin.woff2 |
| 25 | Font | High | 81.2 | /fonts/Caveat-latin.woff2 |
| 28 | Script | High | 42.0 | /assets/index-DI_7TtS3.js |
| 29 | Script | High | 1.3 | /assets/rolldown-runtime-hePW80VL.js |
| 29 | Script | High | 58.6 | /assets/react-D48Lzm2I.js |
| 29 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 30 | Stylesheet | VeryHigh | 16.9 | /assets/index-DagKm4TW.css |
| 123 | Script | High | 23.9 | /assets/SkyScene-BHDdzEhX.js |
| 123 | Script | High | 183.0 | /assets/three-BncCDUPi.js |
| 123 | Script | High | 71.4 | /assets/r3f-UhlMeCFy.js |
| 128 | Script | High | 5.1 | /assets/MembersPage-BWVXHBYP.js |
| 128 | Script | High | 1.7 | /assets/pageScroll-CjrnWOJZ.js |
| 128 | Stylesheet | VeryHigh | 2.2 | /assets/MembersPage-Cf8tOaP5.css |
| 129 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 155 | Font | VeryHigh | 6.4 | /fonts/Courgette-wordmark.woff2 |
| 155 | Font | VeryHigh | 51.7 | /fonts/Inter-cyrillic.woff2 |
| 165 | Other | High | 1.2 | /favicon.svg |

**handbook** (19 requests, 715.5 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.6 | /handbook |
| 34 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 34 | Font | High | 27.2 | /fonts/Anton-latin.woff2 |
| 34 | Font | High | 81.2 | /fonts/Caveat-latin.woff2 |
| 37 | Script | High | 42.0 | /assets/index-DI_7TtS3.js |
| 39 | Script | High | 1.3 | /assets/rolldown-runtime-hePW80VL.js |
| 39 | Script | High | 58.6 | /assets/react-D48Lzm2I.js |
| 39 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 39 | Stylesheet | VeryHigh | 16.9 | /assets/index-DagKm4TW.css |
| 147 | Script | High | 23.9 | /assets/SkyScene-BHDdzEhX.js |
| 147 | Script | High | 183.0 | /assets/three-BncCDUPi.js |
| 147 | Script | High | 71.4 | /assets/r3f-UhlMeCFy.js |
| 155 | Script | High | 22.6 | /assets/HandbookPage-Do4KQi9e.js |
| 155 | Script | High | 1.7 | /assets/pageScroll-CjrnWOJZ.js |
| 155 | Stylesheet | VeryHigh | 2.6 | /assets/HandbookPage-DFbqdk19.css |
| 156 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 185 | Font | VeryHigh | 6.4 | /fonts/Courgette-wordmark.woff2 |
| 185 | Font | VeryHigh | 51.7 | /fonts/Inter-cyrillic.woff2 |
| 199 | Other | High | 1.2 | /favicon.svg |

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
| handbook desktop | 1 | optimized-images:1/0 modern-image-formats:1/0 offscreen-images:1/0 unsized-images:1/0 responsive-images:1/0 image-size-responsive:1/0 | 1618 | 0 | 0 | 1 | 1 | 0 | none |

Environment: {"benchmarkIndex":2917,"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36","formFactor":"desktop","throttling":"simulate"}
