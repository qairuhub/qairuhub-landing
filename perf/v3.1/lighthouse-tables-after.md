
### Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 91.5 (92, 91) | 2182 | 3030 | 73 | 0.000 | 2878 | 5328 | 769.1 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| kk | 92.5 (93, 92) | 1825 | 2875 | 104 | 0.000 | 3056 | 5973 | 880.2 | `div.grid-air > div.hdr__actions > a.btn > span.u-body-2` |
| members | 76.5 (75, 78) | 2099 | 3709 | 442 | 0.000 | 2309 | 5205 | 703.9 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 65 (65, 65) | 2191 | 5277 | 511 | 0.000 | 2210 | 5316 | 721.9 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)

| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| home | 99 (99, 99) | 506 | 671 | 0 | 0.000 | 1039 | 671 | 769.1 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| kk | 99 (99, 99) | 426 | 624 | 0 | 0.000 | 1060 | 624 | 880.2 | `nav.hdr__nav > ul.hdr__list > li.hdr__item > a.hdr__link` |
| members | 99 (99, 99) | 471 | 748 | 76 | 0.000 | 762 | 1041 | 703.9 | `header.hdr > div.grid-air > a.hdr__logo > span.wordmark` |
| handbook | 98 (98, 98) | 498 | 1058 | 18 | 0.000 | 724 | 1058 | 721.9 | `div.subpage > div.subpage__head > div.subpage__intro > h1.u-` |

### JS bootup time per script (run 1, ms: total / scripting / parse+compile)


**mobile**

| page | scripts |
|---|---|
| home | index-C3_ps3Vm.js 1868/282/1<br>react-D48Lzm2I.js 817/598/0<br>r3f-Bg8020Tw.js 436/433/1<br>Unattributable 382/181/0<br>/ 194/5/1 |
| kk | index-C3_ps3Vm.js 1603/261/0<br>react-D48Lzm2I.js 923/565/0<br>Unattributable 408/207/0<br>r3f-Bg8020Tw.js 370/368/1<br>/kk/ 176/4/0 |
| members | index-C3_ps3Vm.js 973/216/1<br>r3f-Bg8020Tw.js 781/778/1<br>react-D48Lzm2I.js 460/347/0<br>/members 393/3/0<br>Unattributable 251/42/0 |
| handbook | index-C3_ps3Vm.js 903/238/1<br>r3f-Bg8020Tw.js 825/823/1<br>/handbook 467/3/1<br>react-D48Lzm2I.js 428/316/0<br>Unattributable 214/31/0 |

**desktop**

| page | scripts |
|---|---|
| home | index-C3_ps3Vm.js 269/51/0<br>react-D48Lzm2I.js 235/187/0<br>/ 176/1/0<br>Unattributable 97/45/0<br>r3f-Bg8020Tw.js 83/82/0 |
| kk | index-C3_ps3Vm.js 282/52/0<br>react-D48Lzm2I.js 256/165/0<br>/kk/ 140/1/0<br>Unattributable 115/47/0<br>r3f-Bg8020Tw.js 72/72/0 |
| members | index-C3_ps3Vm.js 222/53/0<br>r3f-Bg8020Tw.js 200/199/0<br>react-D48Lzm2I.js 156/129/0<br>/members 94/1/0<br>Unattributable 51/11/0 |
| handbook | index-C3_ps3Vm.js 213/57/0<br>r3f-Bg8020Tw.js 166/166/0<br>react-D48Lzm2I.js 127/95/0<br>/handbook 116/1/0<br>Unattributable 73/9/0 |

### Main-thread breakdown (run 1, ms)

| page / preset | Script Evaluation | Other | Style & Layout | Rendering | Garbage Collection | Parse HTML & CSS | Script Parsing & Compilation |
|---|---|---|---|---|---|---|---|
| home mobile | 1571 | 1211 | 722 | 242 | 32 | 9 | 4 |
| kk mobile | 1472 | 1114 | 716 | 227 | 29 | 10 | 4 |
| members mobile | 1403 | 927 | 368 | 169 | 15 | 9 | 4 |
| handbook mobile | 1427 | 812 | 426 | 172 | 16 | 14 | 5 |
| home desktop | 389 | 256 | 173 | 54 | 14 | 2 | 1 |
| kk desktop | 364 | 282 | 184 | 52 | 15 | 3 | 1 |
| members desktop | 399 | 204 | 86 | 39 | 5 | 2 | 1 |
| handbook desktop | 333 | 210 | 107 | 40 | 9 | 4 | 1 |

### Unused JS / CSS, render-blocking (run 1, mobile)

| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |
|---|---|---|---|
| home | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-BNbzZmq5.css 17.3 KiB 616 ms<br>/assets/index-BNbzZmq5.css 17.3 KiB 616 ms |
| kk | three-rAcLmdm5.js: 83.1/182.1<br>r3f-Bg8020Tw.js: 36.7/70.5 | none | /assets/index-BNbzZmq5.css 17.3 KiB 611 ms<br>/assets/index-BNbzZmq5.css 17.3 KiB 611 ms |
| members | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-C3_ps3Vm.js: 20.3/40.6<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-BNbzZmq5.css 17.3 KiB 617 ms<br>/assets/index-BNbzZmq5.css 17.3 KiB 617 ms |
| handbook | three-rAcLmdm5.js: 98.6/182.1<br>r3f-Bg8020Tw.js: 39.9/70.5<br>index-C3_ps3Vm.js: 20.4/40.6<br>react-D48Lzm2I.js: 20.1/57.7 | none | /assets/index-BNbzZmq5.css 17.3 KiB 467 ms<br>/assets/index-BNbzZmq5.css 17.3 KiB 467 ms |

### Long tasks (run 1)

| page / preset | long tasks (url @start: duration ms) |
|---|---|
| home mobile | react-D48Lzm2I.js @5015: 100<br>react-D48Lzm2I.js @3017: 76<br>react-D48Lzm2I.js @5612: 64<br>react-D48Lzm2I.js @2926: 50 |
| kk mobile | react-D48Lzm2I.js @5504: 92<br>react-D48Lzm2I.js @3172: 72<br>react-D48Lzm2I.js @6218: 63<br>react-D48Lzm2I.js @3115: 57<br>index-C3_ps3Vm.js @3244: 56 |
| members mobile | index-C3_ps3Vm.js @4603: 418<br>react-D48Lzm2I.js @3153: 90<br>react-D48Lzm2I.js @5203: 89<br>react-D48Lzm2I.js @3068: 67 |
| handbook mobile | index-C3_ps3Vm.js @4604: 448<br>react-D48Lzm2I.js @3154: 93<br>index-C3_ps3Vm.js @2435: 92<br>react-D48Lzm2I.js @5354: 66<br>react-D48Lzm2I.js @3069: 60<br>/handbook @627: 54 |
| home desktop | none |
| kk desktop | none |
| members desktop | index-C3_ps3Vm.js @933: 111<br>react-D48Lzm2I.js @695: 53 |
| handbook desktop | index-C3_ps3Vm.js @948: 74 |

### Network requests before load settles (run 1, mobile; transfer bytes, priority)


**home** (22 requests, 769.1 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.9 | / |
| 31 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 35 | Script | High | 43.7 | /assets/index-C3_ps3Vm.js |
| 36 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 36 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 37 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 38 | Stylesheet | VeryHigh | 17.3 | /assets/index-BNbzZmq5.css |
| 131 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 131 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 143 | Other | High | 1.3 | /favicon.svg |
| 144 | Script | High | 7.6 | /assets/ProductDemo-BpuTiddf.js |
| 144 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 144 | Script | High | 5.9 | /assets/DemoForm-8E0lqTZh.js |
| 144 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 232 | Script | High | 3.4 | /assets/wordmarkFont-D8br0Rc7.js |
| 233 | Script | High | 23.7 | /assets/SkyScene-BZ_nlMIB.js |
| 234 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 234 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 253 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 260 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 360 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 744 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**kk** (24 requests, 880.2 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 2.1 | /kk/ |
| 30 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 30 | Font | High | 11.0 | /fonts/Oswald-600-cyrillic.woff2 |
| 30 | Font | High | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 34 | Script | High | 43.7 | /assets/index-C3_ps3Vm.js |
| 35 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 36 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 36 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 36 | Stylesheet | VeryHigh | 17.3 | /assets/index-BNbzZmq5.css |
| 131 | Font | VeryHigh | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 140 | Other | High | 1.3 | /favicon.svg |
| 205 | Script | High | 7.6 | /assets/ProductDemo-BpuTiddf.js |
| 205 | Stylesheet | VeryHigh | 4.2 | /assets/ProductDemo-BeL7NzAZ.css |
| 206 | Script | High | 5.9 | /assets/DemoForm-8E0lqTZh.js |
| 206 | Stylesheet | VeryHigh | 2.9 | /assets/DemoForm-C0qAN6Yn.css |
| 245 | Script | High | 3.4 | /assets/wordmarkFont-D8br0Rc7.js |
| 245 | Script | High | 23.7 | /assets/SkyScene-BZ_nlMIB.js |
| 245 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 246 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 266 | Font | VeryHigh | 100.0 | /fonts/Caveat-cyrillic.woff2 |
| 269 | Fetch | High | 55.0 | /fonts/Courgette-Regular.ttf |
| 305 | Font | VeryHigh | 81.3 | /fonts/Caveat-latin.woff2 |
| 305 | Font | VeryHigh | 27.3 | /fonts/Anton-latin.woff2 |
| 763 | Image | Low | 0.0 | data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://w… |

**members** (20 requests, 703.9 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /members |
| 27 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 28 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 28 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 28 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 33 | Script | High | 43.7 | /assets/index-C3_ps3Vm.js |
| 33 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 33 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 33 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 35 | Stylesheet | VeryHigh | 17.3 | /assets/index-BNbzZmq5.css |
| 124 | Script | High | 5.2 | /assets/MembersPage-BIMHBA0T.js |
| 125 | Script | High | 1.8 | /assets/pageScroll-CgN8Uguu.js |
| 125 | Stylesheet | VeryHigh | 2.2 | /assets/MembersPage-Cf8tOaP5.css |
| 125 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 154 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 162 | Other | High | 1.3 | /favicon.svg |
| 225 | Script | High | 23.7 | /assets/SkyScene-BZ_nlMIB.js |
| 225 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 225 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 225 | Script | High | 3.4 | /assets/wordmarkFont-D8br0Rc7.js |

**handbook** (20 requests, 721.9 KiB transferred)

| start ms | type | prio | transfer KiB | url |
|---|---|---|---|---|
| 1 | Document | VeryHigh | 1.7 | /handbook |
| 32 | Font | High | 117.9 | /fonts/Inter-latin.woff2 |
| 32 | Font | High | 6.5 | /fonts/Courgette-wordmark.woff2 |
| 32 | Font | High | 27.3 | /fonts/Anton-latin.woff2 |
| 32 | Font | High | 81.3 | /fonts/Caveat-latin.woff2 |
| 37 | Script | High | 43.7 | /assets/index-C3_ps3Vm.js |
| 39 | Script | High | 1.4 | /assets/rolldown-runtime-hePW80VL.js |
| 39 | Script | High | 58.7 | /assets/react-D48Lzm2I.js |
| 39 | Script | High | 2.7 | /assets/icons-BtZ7qFfY.js |
| 41 | Stylesheet | VeryHigh | 17.3 | /assets/index-BNbzZmq5.css |
| 122 | Script | High | 22.6 | /assets/HandbookPage-CbRMfOQ1.js |
| 122 | Script | High | 1.8 | /assets/pageScroll-CgN8Uguu.js |
| 123 | Stylesheet | VeryHigh | 2.7 | /assets/HandbookPage-DFbqdk19.css |
| 123 | Stylesheet | VeryHigh | 1.5 | /assets/subpage-Cc-b23WF.css |
| 155 | Font | VeryHigh | 51.8 | /fonts/Inter-cyrillic.woff2 |
| 172 | Other | High | 1.3 | /favicon.svg |
| 230 | Script | High | 23.7 | /assets/SkyScene-BZ_nlMIB.js |
| 230 | Script | High | 183.1 | /assets/three-rAcLmdm5.js |
| 230 | Script | High | 71.5 | /assets/r3f-Bg8020Tw.js |
| 230 | Script | High | 3.4 | /assets/wordmarkFont-D8br0Rc7.js |

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

Environment: {"benchmarkIndex":3265.5,"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36","formFactor":"desktop","throttling":"simulate"}
