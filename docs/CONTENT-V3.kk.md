# QairuHub landing v3: қазақша мәтін (kk)

The Kazakh copy for the v3 landing. The keys and order match `docs/CONTENT-V3.md` exactly, and anything not repeated here (hrefs, icons, `visual` keys, statuses, evidence columns) comes from the EN file. Notes for engineers and reviewers stay in English. Every line a native speaker should check is marked `<!-- review -->`.

## Translation decisions

1. **Register.** Informal *сен*, as on the community platform's own KK landing ("Байқап көр", "Келдің, таныстың, жобаға оралдың"). Text addressed to companies (the Partnerships card) uses *сіз*.
2. **Brand and program names stay in Latin.** This covers QairuHub, qairuhub (wordmark), QairuHub Demo Day, QairuHub Accelerator, Hackathon Mentorship, Vibe-coding Masterclass, HackAlem AI, The QairuHub Handbook and Q.
   - **Evidence:** the platform's KK UI keeps event types "Demo Friday / Hack Day" in Latin, and the org's own KZ channel post says «QairuHub ұйымдастыратын офлайн Hackathon Mentorship сессиясы».
   - Generic words are still translated: акселератор, хакатон, мастер-класс.
3. **Suffixes on Latin names take a hyphen**, the way QAIRU writes it (draft proposal 024): QairuHub-қа, QairuHub-тың, QairuHub-ты, QairuHub-та, QairuHub-пен; Demo Day-ге; Accelerator-ға; The QairuHub Handbook-тан / Book-ты; QAIRU-да.
4. **Platform terminology is reused verbatim** from `kk-glossary.md`: Жобалар, Іс-шаралар, Адамдар, Клубтар, Ресурстар, Команда табу, Тимфайндер, Ашық рөлдер, Аккаунт ашу, Кіру, Жобаларға ашық, Ынтымақтастыққа ашық, «{cap} ішінен {x} барады», Үйрен / Құр / Кездес, and the statuses Идея / Қабылдау / Жұмыста.
5. **"Stage" is сахна**, not *кезең*. The registration form's machine translation used кезең, which is wrong here.
6. **People's names stay in Latin on both locales**, so no Cyrillic spelling is invented. The one exception is Sanzhar, whom the org's own channel already wrote as «Санжар Мадиев».
7. **Tagline:** Learn it. Build it. Launch it. → **Үйрен. Құр. Іске қос.**

---

## 1. Meta

| Route | `<title>` | `meta description` |
|---|---|---|
| `/kk/` | QairuHub — Үйрен. Құр. Іске қос. | Астанадағы QAIRU-да құрылған студенттік технологиялық қауымдастық. Іс-шаралар, хакатондар, менторлық, платформадағы командалар, QairuHub Demo Day және Accelerator. |
| `/kk/members` | Мүшелер — QairuHub | QairuHub-ты жүргізетін студенттер: атқарушы кеңес, жобаларымызды құрып жүргендер және командамен байланыс. <!-- review: "атқарушы кеңес" for executive board --> |
| `/kk/handbook` | The QairuHub Handbook — QairuHub | QairuHub туралы бәрі бір жерде: біз кімбіз, қалай қосылуға болады, бағдарламалар, платформа, құндылықтар, жоспарлар және жиі қойылатын сұрақтар. |
| 404 | Бет табылмады — QairuHub | — |

`og:locale`: `kk_KZ`

---

## 2. Header

### 2.1 Top-level items

| key | label |
|---|---|
| `programs` | Бағдарламалар |
| `platform` | Платформа |
| `projects` | Жобалар |
| `news` | Жаңалықтар |
| `about` | Біз туралы |

### 2.2 Programs mega menu

| title | description |
|---|---|
| Іс-шаралар мен мастер-кластар | Воркшоптар, митаптар және практикалық сессиялар |
| Хакатондар және дайындық | Хакатонға дайындал, команда тап |
| Менторлық | Сенен бір қадам алда жүргендерден үйрен |
| QairuHub Demo Day | Жобаңа арналған сахна · 2026 жылғы қараша, жоспарда |
| QairuHub Accelerator | Демоға жеткен командаларға · 2027 жылдың көктемі, жоспарда |

**CTA card**
- **title:** Hackathon Mentorship · 15 қыркүйек
- **description:** HackAlem AI ұйымдастырушысымен кездес, тіркел және командаңды тап.
- **cta:** Жаңалықтарды көру

### 2.3 Platform mega menu

| title | description |
|---|---|
| Команда табу | Ашық рөлдер және дағды бойынша адамдар |
| Жобалар витринасы | Студенттердің ашық жобалары, кірусіз көруге болады <!-- review: "витрина" --> |
| Іс-шаралар | Тіркел, Telegram өзі еске салады |
| Клубтар | Студенттік клубтардың бәрі, Telegram-ға тікелей өту |
| Аккаунт ашу | @qairu.edu.kz поштасымен |

**CTA card**
- **title:** Міне, Hub
- **description:** Тіркелмей тұрып, платформаның қалай жұмыс істейтінін көр.
- **cta:** Көріп шығу

### 2.4 About mega menu

| title | description |
|---|---|
| The QairuHub Handbook | QairuHub туралы бәрі бір жерде |
| Мүшелер | QairuHub-ты жүргізетін адамдар |
| Қағидаттарымыз | «Сөз емес, іс» және тағы бес қағидат |
| GitHub | Кодымыз ашық |
| Telegram арнасы | Жаңалықтар алдымен осында шығады |

**CTA card**
- **title:** Q-дан сұра
- **description:** QairuHub туралы сұрағың бар ма? Ұлу жауап береді.
- **cta:** Сұрау

### 2.5 Actions

| key | label |
|---|---|
| `locale` | EN · ҚАЗ |
| `login` | Мүшелер |
| `secondary` | Қосылу |
| `primary` | Платформаны ашу |

### 2.6 Locale switcher and header a11y

| key | KK |
|---|---|
| `localeSwitch.label` | Тіл |
| `localeSwitch.en` | EN |
| `localeSwitch.kk` | ҚАЗ |
| `localeSwitch.enTitle` | English |
| `localeSwitch.kkTitle` | Қазақша |
| `a11y.primaryNav` | Негізгі мәзір |
| `a11y.openMenu` | Мәзірді ашу |
| `a11y.closeMenu` | Мәзірді жабу |
| `a11y.newTab` | (жаңа бетте ашылады) |
| `a11y.home` | QairuHub басты беті |

---

## 3. Hero

| key | KK |
|---|---|
| `hero.wordmark` | qairuhub |
| `hero.srTitle` | QairuHub — Астанадағы QAIRU-да құрылған студенттік технологиялық қауымдастық. Үйрен. Құр. Іске қос. |

---

## 4. Launchpad + Ask bar

### 4.1 Heading

| key | KK |
|---|---|
| `launchpad.title` | AI-мен жоба құратындарға арналған *старт* алаңы <!-- review: literal EN "Your launchpad for AI builders"; alternative "AI құрушыларының *старт* алаңы" --> |
| `launchpad.subtitle` | Үйрен. Құр. Іске қос. QairuHub туралы кез келген сұрағыңды Q-ға қой, нақты жауап ал. |
| `launchpad.cta.label` | QairuHub-қа қосылу |

### 4.2 Ask bar

| key | KK |
|---|---|
| `ask.label` | QairuHub туралы Q-дан сұра |
| `ask.placeholder` | QairuHub туралы кез келген сұрақ қой… |
| `ask.submit` | Сұрақты жіберу |
| `ask.suggestionsLabel` | Ұсынылған сұрақтар |
| `ask.note` | Q The QairuHub Handbook бойынша жауап береді және қателесуі мүмкін. Нақты күндер t.me/qairuhub арнасында. |
| `ask.thinking` | Q ойланып жатыр… |
| `ask.sources` | The QairuHub Handbook-тан |
| `ask.continue` | Чатта жалғастыру |
| `ask.again` | Басқа сұрақ қою |
| `ask.stop` | Жауапты тоқтату |

### 4.3 Suggested questions (6)

1. QairuHub-қа қалай қосылуға болады?
2. Hackathon Mentorship-те не болады?
3. Идеям бар, бірақ командам жоқ. Неден бастаймын?
4. QairuHub Accelerator қашан ашылады?
5. Жобамды сайтта қалай көрсетуге болады?
6. Бұрын код жазбасам да қосыла аламын ба?

### 4.4 Cards (3)

| visual | title | body |
|---|---|---|
| `learn` | Жаңадан келдің бе? | Іс-шараға немесе менторлық сессияға кел. Тәжірибе керек емес, бірінші күннен-ақ сенен ешкім жоба күтпейді. |
| `build` | Идеяң бар ма? | Оны community.qairuhub.com-да жарияла, дағды мен сағатын көрсетіп рөлдер аш және университетіңдегі әзірлеушілерді шақыр. |
| `launch` | Демоң дайын ба? | Оны QairuHub Demo Day-ге апар, кейін хакатондарға және QairuHub Accelerator-ға. Жоба 100% сенікі болып қалады. |

`launchpad.bentoLabels`: Команда · Репо · Демо · Сахна

---

## 5. Ecosystem marquee

| key | KK |
|---|---|
| `ecosystem.title` | Біз бірге құратын *экожүйе* мен құралдар |
| `ecosystem.caption` | Жоба құрушыларымызды қоршаған құралдар, платформалар мен экожүйе. |
| `a11y.marqueeRow` | {title}, {n}-қатар |

Items are the same as the EN list (all Latin proper names, V3-DECISIONS §4): row 1 Alem.ai · Astana Hub · HackAlem AI · QairuHub Accelerator · QairuHub Community; row 2 Anthropic Claude · OpenAI · Google Gemini · Cursor · Lovable · Qaldy AI. Never write «серіктес», «демеуші» or similar next to these names.

---

## 6. QairuHub Accelerator waitlist

| key | KK |
|---|---|
| `waitlist.pill` | 2027 жылдың көктемі · жоспарда |
| `waitlist.titleLine1` | Демоға жеткен жобаларға арналған |
| `waitlist.titleLine2` | *акселератор* |
| `waitlist.body` | QairuHub Accelerator — демоға жеткен командаларға арналған бағдарлама. Алдын ала жоспар: 8–10 апта, 6–10 команда, бірінші аптадан менторлар, үлес алынбайды. Өтінім қабылдау басталғанда бірінші болып білу үшін поштаңды қалдыр. |
| `waitlist.placeholder` | Электрондық пошта |
| `waitlist.cta` | Маған хабарла |
| `waitlist.sending` | Сақталып жатыр… |
| `waitlist.consent` | Өтінім ашылғанда бір ғана хат жібереміз. Спам жоқ. |
| `waitlist.success` | Сен тізімдесің. Өтінім қабылдау басталғанда хат жібереміз. |
| `waitlist.errorEmail` | Дұрыс электрондық пошта енгіз. |
| `waitlist.errorFailed` | Бірдеңе дұрыс болмады. Қайталап көр. |
| `waitlist.demoCaption` | Идеядан Demo Day-ге, одан QairuHub Accelerator-ға. |
| `waitlist.demoSteps` | Идея · Команда · Demo Day · Accelerator |

---

## 7. Supersize line

| key | KK |
|---|---|
| `supersize.text` | Сөз емес, іс. Лекция емес, жоба. |

[build] Display text uses Oswald for Cyrillic. Check the bleed at `u-h1` sizes.

---

## 8. Platform showcase

### 8.1 Heading and chrome

| key | KK |
|---|---|
| `platform.pill` | community.qairuhub.com |
| `platform.title` | Міне, *Hub* |
| `platform.body` | Біздің қауымдастық платформамыз QAIRU адамдарын, жобалары мен іс-шараларын бір жерге жинайды. Онда не істеуге болатынын көру үшін қойындыларды ауыстыр. |
| `platform.tablistLabel` | Платформа мүмкіндіктері |
| `platform.sampleBadge` | Үлгі деректер |
| `platform.app.name` | QairuHub Community |
| `platform.app.sidebar` | Басты бет · Команда табу · Жобалар · Іс-шаралар · Адамдар · Клубтар · Ресурстар |
| `platform.chrome.search` | Кампус бойынша іздеу… |
| `platform.chrome.secondary` | Бөлісу |
| `platform.chrome.primary` | Жаңа жоба |

### 8.2 Tabs

[build] Sample project and event titles stay in Latin, as in the platform's own KK demo. Descriptions reuse the glossary's KK strings.

**Tab 1: Команда табу**
- **Screen title:** Команда табу · Ашық рөлдер
- **Subtitle:** Дағдың мен уақытыңа сай рөлді таңда.
- **Columns:** Рөл · Жоба · Дағды · Сағат · Дедлайн
- **Rows:**
  - ML инженері · Kazakh NLP Datasets · Python · аптасына 8 сағ · 3 қаз.
  - Frontend әзірлеуші · Open Campus Map · JavaScript · аптасына 6 сағ · 30 қыр.
  - Өнім дизайнері · Campus Buddy · UI/UX · аптасына 4 сағ · 10 қаз.
  - Зерттеуші · Kazakh NLP Datasets · Зерттеу · аптасына 5 сағ · 17 қаз.
- **Row action:** Өтінім беру
- **Caption:** Әр рөлде дағды, сағат және дедлайн жазылған. «Сізге әлі адам керек пе?» деген хат алмасу жоқ.

**Tab 2: Жобалар**
- **Screen title:** Студенттер жобалары
- **Filter chips:** Барлық статустар · Қабылдау · Жұмыста · Идея
- **Rows:**
  - Open Campus Map · Аудиториялар мен кампус сервистерінің тірі картасы · Қабылдау · командада 4
  - Kazakh NLP Datasets · Ашық қазақтілді деректер жиынтықтарының каталогы · Жұмыста · командада 6
  - QAIRU Radio · Студенттік жобалар туралы подкаст · Идея · командада 2
  - Campus Buddy · Бірінші курс студенттеріне менторлар · Қабылдау · командада 3
- **Caption:** Әр жобаның шынайы статусы көрінеді: идея, қабылдау, жұмыста, демо көрсетілді. <!-- review: "демо көрсетілді" has no KK string in the platform yet -->

**Tab 3: Іс-шаралар**
- **Screen title:** Кампус күнтізбесі
- **Filter chips:** Барлық түрлері · Demo Friday · Hack Day · Митап · Воркшоп
- **Rows:**
  - 2 қаз. · AI Build Night · Hack Day · 18:30 · 3.12 зертхана · 40 ішінен 24 барады
  - 9 қаз. · Founder Stories · Митап · 17:00 · Атриум · 60 ішінен 31 барады
  - 16 қаз. · Open Design Critique · Воркшоп · 16:00 · 2.04 студия · 20 ішінен 12 барады
  - 23 қаз. · Demo Friday · Demo Friday · 17:00 · Атриум · 50 ішінен 18 барады
- **Row action:** Барамын
- **Caption:** Орын саны шектеулі. Telegram бір күн және бір сағат бұрын еске салады.

**Tab 4: Адамдар**
- **Screen title:** QAIRU адамдары
- **Cards:**
  - Аружан С. · Компьютерлік ғылымдар · 1 курс · Python, ML · Жобаларға ашық
  - Данияр А. · Компьютерлік ғылымдар · 3 курс · Backend, ML · Ынтымақтастыққа ашық
  - Айгерім Н. · Жасанды интеллект · 2 курс · UI/UX, Зерттеу · Жобаларға ашық
- **Card action:** Жазылу
- **Caption:** Адамдарды дағды, бағдарлама және бос сағат бойынша тап, сосын Telegram-да жаз.

[build] The sample people are fictional, so they may take Cyrillic spellings (Аружан, Данияр, Айгерім).

### 8.3 CTA row

| key | KK |
|---|---|
| `platform.ctaPrimary` | Платформаны ашу |
| `platform.ctaSecondary` | Ашық жобаларды көру |
| `platform.accessNote` | Тіркелу үшін @qairu.edu.kz поштасы керек. Әр аккаунтты әкімші растайды. |

---

## 9. What we offer

| key | KK |
|---|---|
| `offer.titleBefore` | Біз не |
| `offer.titleCursive` | *ұсынамыз* |
| `offer.titleAfter` | ? |
| `offer.body` | Мұндағының бәрі тегін, кез келген деңгейге ашық және бір мақсатқа құрылған: сені идеядан нақты нәтижеге жеткізу. |

[build] The KK heading reads as a question («Біз не ұсынамыз?»), which is more natural than a statement with a full stop.

### 9.1 Cards (7)

| # | title | body |
|---|---|---|
| 1 | Іс-шаралар мен мастер-кластар | Воркшоптар, митаптар және практикалық мастер-кластар: саланы жақсы білетіндер шынымен жұмыс істейтін тәсілдерді көрсетеді. Келесісі — Vibe-coding Masterclass, жақында хабарлаймыз. |
| 2 | Хакатондар және дайындық | HackAlem AI сияқты хакатондарға тіркелуге, командалас табуға және дайындалуға көмектесеміз. Қазақстанның нақты мәселесіне арналған QairuHub Hack Day жоспарда. |
| 3 | Платформадағы командалар | Идеяңды community.qairuhub.com-да жарияла, дағды, сағат және дедлайн көрсетілген рөлдер аш, өз университетіңдегі әзірлеушілермен бірге құр. |
| 4 | QairuHub Demo Day | QairuHub командалары мен менторларының көмегімен жасалған жобаларға арналған, жоспарланып отырған сахна: студенттерге, оқытушыларға, университет серіктестері мен инвесторларға арналған. Алғашқысы 2026 жылдың қарашасына жоспарланған. |
| 5 | Менторлық | Peer-to-peer форматы: сенен бір қадам алда жүргендерден үйрен, келесі семестрде өзің үйрет. Бағыттар бойынша менторлар да жақында. |
| 6 | QairuHub Accelerator | Демосы бар командаларға. Алдын ала жоспар: 8–10 апта, бірінші аптадан менторлар, үлес алынбайды. 2027 жылдың көктеміне жоспарланған. |
| 7 | Серіктестік | Компаниялар мен ұйымдар іс-шара өткізе алады, командаға менторлық ете алады, нақты мәселе ұсына алады немесе Demo Day-де командалармен таныса алады. Бізге жазыңыз. |

### 9.2 Card mock data

**`offer.mock.schedule`**
- 15 қыр. · Hackathon Mentorship · Shai кафетерийі · 14:00 <!-- review: the venue's KK name; the team calls it «Шай Кофе» -->
- Жақында · Vibe-coding Masterclass · Жақында хабарланады
- Қаз. · QairuHub-тың алғашқы үлкен іс-шарасы · Күні кейін хабарланады
- Қар. · QairuHub Demo Day · Жоспарда

**`offer.mock.chart`**
- **Label:** HackAlem AI · 23 қыр.
- **Bars:** Тіркелу · Команда табу · Құру · Демо

**`offer.mock.links`**: Команда табу · Ашық рөлдер · Жобалар витринасы

**`offer.mock.milestones`**: Идея · Команда · Демо · Demo Day

---

## 10. Highlighted projects

| key | KK |
|---|---|
| `projects.titleBefore` | Біз не |
| `projects.titleCursive` | *құрып* |
| `projects.titleAfter` | жатырмыз |
| `projects.body` | QairuHub қауымдастығының нақты жобалары, шынайы статустарымен. Келесісі сенікі болуы мүмкін. |
| `projects.carouselLabel` | Таңдаулы жобалар |
| `projects.prev` | Алдыңғы жоба |
| `projects.next` | Келесі жоба |
| `projects.pause` | Карусельді тоқтату |
| `projects.play` | Карусельді қосу |

**Status labels**

| key | KK |
|---|---|
| `status.idea` | Идея |
| `status.recruiting` | Қабылдау |
| `status.inProgress` | Жұмыста |
| `status.demoShown` | Демо көрсетілді <!-- review --> |
| `status.completed` | Аяқталды <!-- review --> |
| `status.stopped` | Тоқтатылды <!-- review --> |
| `badge.live` | Іске қосылған <!-- review --> |
| `badge.internal` | Ішкі құрал |
| `badge.openSource` | Ашық код |

### 10.1 Items

| # | name | tagline | link label |
|---|---|---|---|
| 1 | QairuHub Community | QAIRU адамдарына, жобалары мен іс-шараларына арналған платформа. | Ашу |
| 2 | qairuhub.com | QairuHub-тың ашық кодты сайты. | Бастапқы код |
| 3 | core.qairuhub.com | Негізгі командаға арналған ішкі құралдар: тапсырмалар, прогресс және көрнекі кесте. | — |
| 4 | Осы сайт + Q | Ғарыштан түнге дейінгі WebGL сапар және The QairuHub Handbook бойынша жауап беретін Q көмекшісі. | The QairuHub Handbook-ты оқу |
| 5 | QairuHub iOS қосымшасы | QairuHub қауымдастығы телефоныңда. | — |
| 6 | Идеялар боты | Команданың идеяларын жинап, күн сайын қорытынды жіберетін Telegram бот. | — |
| 7 | QairuHub Cowork | Жаңа контрибьюторлар ментормен бірге жасап жатқан коворкинг уақыты мен кесте құралы. <!-- review --> | — |
| 8 | **Мұнда сенің жобаң** | Оны community.qairuhub.com-да жарияла, демо көрсет — біз оны осында жариялаймыз. | Қалай көрсетуге болады |

---

## 11. Latest news

| key | KK |
|---|---|
| `news.titleBefore` | Соңғы |
| `news.titleCursive` | *жаңалықтар* |
| `news.body` | QairuHub-та дәл қазір не болып жатыр. Толық лента t.me/qairuhub арнасында. |
| `news.allLink` | Барлық жаңалық Telegram-да |
| `news.pastLabel` | Өтті |

### 11.1 Cards

| # | dateLabel | tag | title | body | link label |
|---|---|---|---|---|---|
| 1 | 15 қыркүйек 2026 | Іс-шара | BAITC-тің білім беру және хакатондар жөніндегі жетекшісі Санжар Мадиевпен QairuHub Hackathon Mentorship | HackAlem AI ұйымдастырушысымен алғашқы офлайн сессиямыз: HackAlem AI-ға қалай дайындалу керек, қазылар нені бағалайды және команда табуға көмек. Сағат 14:00, Shai кафетерийі. | Толығырақ Telegram-да |
| 2 | Жақында | Мастер-класс | Vibe-coding Masterclass | AI кодинг құралдарымен жылдамырақ жасауды үйрететін практикалық сессия. Қазір дайындап жатырмыз, күні мен орны арнада жарияланады. | Арнаға жазылу |
| 3 | Барлығына ашық | Сенің жобаң | Сенің жобаң да осында шығуы мүмкін | Жаңалықтар мен жобалар каруселі тек негізгі командаға арналмаған. Жобаңды community.qairuhub.com-да жарияла, демо көрсет және бізге айт. Біз оны осында, Telegram-да және Instagram-да бөлісеміз. | Қалай көрсетуге болады |
| 4 | 19 қыркүйек 2026 | Хакатон | HackAlem AI-ға тіркелу 19 қыркүйекте жабылады | Alem OpenAI-мен бірге өткізетін AI-агенттер хакатоны 23 қыркүйекте Astana EXPO-да өтеді. Командада үш адамға дейін, 18+. QAIRU студенті ретінде тіркел. <!-- review: "AI-агенттер хакатоны" --> | hackalem.ai |
| 5 | Қыркүйек 2026 | Платформа | community.qairuhub.com: алғашқы нұсқасы онлайн | Платформамыздың алғашқы нұсқасы жұмыс істеп тұр: команда табу, жобалар, іс-шаралар және адамдар. @qairu.edu.kz поштаңмен тіркел, әр аккаунтты әкімші растайды. | Платформаны ашу |
| 6 | 9 қыркүйек 2026 | Қауымдастық | QairuHub клубтар жәрмеңкесінде кампуспен танысты | Құрылтай сессиямыздан екі күн өткен соң QAIRU клубтар жәрмеңкесінде тіркеуді аштық. Үлгермей қалдың ба? Форма осы беттің төменгі жағында. <!-- review: "құрылтай сессиясы" for Founding Session --> | Қосылу |


---

## 12. CTA card

| key | KK |
|---|---|
| `cta.title` | Қазіргі деңгейіңнен *баста*. <!-- review --> |
| `cta.subtitle` | Жаңадан бастасаң да, әлдеқашан жоба шығарып жүрсең де, мұнда саған орын бар. |
| `cta.body` | Код жазып көрмедің бе? Келіп үйрен. Жоба құрып жүрсің бе? Келіп басқалардың жетекшісі бол. Бәрі тегін, ал жасағаның 100% сенікі болып қалады. |
| `cta.button.label` | The QairuHub Handbook-ты оқу |

---

## 13. Tools row

| key | KK |
|---|---|
| `tools.titleBefore` | Командаларымыз қолданатын |
| `tools.titleCursive` | *құралдар* |
| `tools.titleAfter` | |
| `tools.note` | Бұл біз қолданатын құралдар, серіктестік емес. |
| `tools.a11yLabel` | Командаларымыз қолданатын құралдар |

The items are the same Latin names as in EN.

---

## 14. Storytelling triptych

`story.a11yLabel`: QairuHub қалай жұмыс істейді

| # | title | body |
|---|---|---|
| 1 | Үйрен | Воркшоптар, мастер-кластар және peer-to-peer менторлық. Саланы білетіндер оған кіргісі келетіндерге үйретеді, ал келесі семестрде үйрететін сен боласың. |
| 2 | Құр | Идеяңды community.qairuhub.com-да жарияла, рөлдер аш және өз университетіңдегі әзірлеушілермен бірге құр. Идея, жұмыста, демо: статус әрқашан шынайы. |
| 3 | Іске қос | Жобаңды QairuHub Demo Day-де (жоспарда) студенттерге, оқытушыларға, серіктестерге және инвесторларға көрсет. Мықты командалар QairuHub Accelerator-ға өтеді. |
| 4 | Кездес | Командалар іс-шараларда, хакатондарда және Demo Day-де пайда болады. Келдің, таныстың, жобаға оралдың. |

[build] «ІСКЕ ҚОС» is two words. Check the triptych title width with Oswald at the display size.

---

## 15. Compact join form

### 15.1 Heading

| key | KK |
|---|---|
| `form.titleLine1` | Идеяң |
| `form.titleLine2Before` | іске асатын |
| `form.titleLine2Cursive` | *орын* |
| `form.titleLine2After` | осында. |
| `form.body` | Өзің туралы және не құрғың келетінін айт. Telegram арқылы хабарласамыз. |

### 15.2 Fields

| key | label | placeholder |
|---|---|---|
| `form.fields.name` | Толық аты* | — |
| `form.fields.email` | Электрондық пошта* | — |
| `form.fields.telegram` | Telegram пайдаланушы аты* | @username |
| `form.fields.interest` | Мені қызықтырады* | Біреуін таңда |
| `form.fields.message` | Хабарлама | Не құрғың келеді? |
| `form.fields.honeypot` | Бұл өрісті бос қалдыр | — |

### 15.3 Interest options

The values are identical to EN.

| value | label |
|---|---|
| `build` | Жоба құру (AI, бағдарламалық жасақтама, құрылғылар) <!-- review --> |
| `project` | Көрсеткім келетін жобам бар |
| `events` | Іс-шаралар және қауымдастық |
| `media` | Медиа және контент |
| `business` | Бизнес және кәсіпкерлік |
| `mentor` | Ментор немесе спикер |
| `partner` | Серіктес немесе демеуші |
| `other` | Басқа |

### 15.4 Actions, legal, states and errors

| key | KK |
|---|---|
| `form.submit` | Жіберу |
| `form.sending` | Жіберіліп жатыр… |
| `form.turnstileNote` | Cloudflare Turnstile арқылы қорғалған. |
| `form.legalBefore` | Жіберу арқылы сен |
| `form.legalLink1` | Әдеп кодексіне |
| `form.legalMiddle` | және |
| `form.legalLink2` | құпиялылық туралы ескертпеге |
| `form.legalAfter` | келісесің. |
| `form.successTitle` | Қабылдадық. Қош келдің! |
| `form.successBody` | Telegram арқылы хабарласамыз. Әзірге іс-шаралардан хабардар болу үшін t.me/qairuhub арнасына жазыл. |
| `form.sendAnother` | Тағы жіберу |
| `form.errors.required` | Бұл өрісті толтыру міндетті |
| `form.errors.choose` | Біреуін таңда |
| `form.errors.email` | Дұрыс электрондық пошта енгіз |
| `form.errors.telegram` | Telegram пайдаланушы атыңды жаз, мысалы @qairuhub |
| `form.errors.tooLong` | {max} таңбадан аспасын |
| `form.errors.verify` | Адам екеніңді растап, қайталап көр. |
| `form.errors.rateLimited` | Әрекет тым көп болды. Бірнеше минуттан кейін қайталап көр. |
| `form.errors.failed` | Бірдеңе дұрыс болмады. Қайталап көр. |

---

## 16. Footer

`a11y.footerNav`: Төменгі мәзір

| EN label | KK label |
|---|---|
| Programs | Бағдарламалар |
| Platform | Платформа |
| Projects | Жобалар |
| News | Жаңалықтар |
| Join | Қосылу |
| Members | Мүшелер |
| The QairuHub Handbook | The QairuHub Handbook |
| Privacy | Құпиялылық |
| community.qairuhub.com | community.qairuhub.com |

Social labels stay as they are: Telegram · Instagram · GitHub.

| key | KK |
|---|---|
| `footer.copyright` | © 2026 QairuHub. QAIRU-да дүниеге келген қазақстандық технологиялық қауымдастық. <!-- review --> |
| `footer.tagline` | Үйрен. Құр. Іске қос. |

---

## 17. Members page

### 17.1 Heading

| key | KK |
|---|---|
| `members.eyebrow` | Мүшелер |
| `members.title` | QairuHub-ты *жүргізетін* адамдар |
| `members.intro` | QairuHub-ты студенттер жүргізеді. Оның иесі жоқ, орындар дауыс беру арқылы ауысады, ал кез келген адамды, тіпті президентті де ауыстыруға болады. Қазір бұл жұмысты атқарып жүргендер — осылар. |

### 17.2 Executive board

- **Section title:** Атқарушы кеңес <!-- review -->
- **Section note:** 2026 жылғы 7 қыркүйектегі құрылтай сессиясында сайланды; рөл атаулары 10 қыркүйекте бекітілді.

| name (Latin) | role | what they look after |
|---|---|---|
| Tair Kaldybayev | Президент | Ұйым, университетпен байланыс және жалпы бағыт. |
| Mustafa Kassym | CTO | Платформа, QairuHub өнімдері және операциялық жұмыс. |
| Alikhan Altayev | Қаржы және серіктестік жетекшісі | Серіктестер, демеушілер және қаржыға қатысты бәрі. |
| Tamerlan Shaigali | Медиа және әлеуметтік желілер жетекшісі | Instagram, Telegram және QairuHub-тың жұртшылық алдындағы бейнесі. <!-- review --> |
| Nazar Akanov | Қауымдастық және іс-шаралар жетекшісі | Іс-шаралар, жаңа мүшелерді қабылдау және олардың алғашқы қадамдары. |

### 17.3 Builders

- **Section title:** Жобаларды құрушылар
- **Section note:** QairuHub жобаларын, медиасын және іс-шараларын жүргізіп жүрген белсенді мүшелер.

[build] Behind `SHOW_BUILDERS = false` until confirmed, same as EN.

| name | role |
|---|---|
| Nurik | community.qairuhub.com жетекші әзірлеушісі |
| Aidos | community.qairuhub.com әзірлеушісі |
| Miras | Команда боттары · жаңа контрибьюторлардың менторы |
| Tair Khanapin | Тіркеу және формалар · контрибьютор |
| Yernur | Бренд, дизайн және арна мәтіндері |
| Yernur | Медиа · контрибьютор |
| Artem | Презентациялар · контрибьютор |
| Nurkhan | Медиа және презентациялар |
| Ibragim | Команда |

### 17.4 Who to ask

- **Section title:** Кімге жүгіну керек

| If you want to… (KK) | Talk to (KK) |
|---|---|
| неден бастау керегін немесе қай жобаға қосылу керегін білу | Қауымдастық және іс-шаралар |
| іс-шара өткізу немесе демо слотын алу | Қауымдастық және іс-шаралар |
| платформадағы қате, қолжетімділік немесе техникалық сұрақ | Платформа және операциялық жұмыс (CTO) |
| демеушілік, серіктестік немесе қаржы | Қаржы және серіктестік |
| Instagram не Telegram үшін жазба ұсыну немесе жоба жаңалығымен бөлісу | Медиа және әлеуметтік желілер |
| ұйым, университет немесе маңызды мәселе | Президент |

### 17.5 Contact

| key | KK |
|---|---|
| `members.contactTitle` | Командамен байланыс |
| `members.contactBody` | Жеке пошта мен телефон нөмірлерін жарияламаймыз. QairuHub-пен байланысудың ең жылдам жолдары: |
| `members.contactTelegram` | Telegram арнасы · t.me/qairuhub |
| `members.contactInstagram` | Instagram · @qairuhub |
| `members.contactForm` | Қосылу формасы |

### 17.6 Join CTA

| key | KK |
|---|---|
| `members.joinTitle` | Атың осында болғанын қалайсың ба? |
| `members.joinBody` | Белсенді мүшелер қабылдау толқындары арқылы қосылады. Іс-шараларға келіп, жоба құрудан баста. Келесі толқын арнада жарияланады. |
| `members.joinCta` | QairuHub-қа қосылу |

---

## 18. The QairuHub Handbook page

| key | KK |
|---|---|
| `book.eyebrow` | Білім базасы |
| `book.title` | The Qairu *Book* |
| `book.intro` | QairuHub деген не, қалай қосылуға болады, алда не бар және біз қалай жұмыс істейміз — бәрі бір жерде. Көмекшіміз Q осы бет бойынша жауап береді, сондықтан мұнда жоқ нәрсені Q ойдан шығармайды. |
| `book.updated` | Соңғы жаңарту: 2026 жылғы 14 қыркүйек |
| `book.legend` | Статустар: Расталған · Жоспарда · Кейін хабарланады |
| `book.tocLabel` | Мазмұны |
| `book.askCta` | Q-дан сұра |
| `book.platformCta` | Платформаны ашу |
| `book.linksTitle` | Сілтемелер |
| `book.linkSite` | Сайт · qairuhub.com |
| `book.linkPlatform` | Платформа · community.qairuhub.com |
| `book.linkTelegram` | Telegram · t.me/qairuhub |
| `book.linkSource` | Осы сайттың бастапқы коды · github.com/tairqaldy/qairuhub-landing-clean (әзірге жабық) |
| `book.feedback` | Қате немесе ескірген ақпарат көрдің бе? Форма немесе t.me/qairuhub арқылы айт. |
| `book.kkNote` | The QairuHub Handbook әзірге ағылшын тілінде. Q сұрақтарыңа қазақша жауап бере алады. |

---

## 19. Q, the assistant

### 19.1 Panel strings

| key | KK |
|---|---|
| `assistant.launcher` | QairuHub көмекшісі Q-дан сұра |
| `assistant.hint` | Сұрағың бар ма? Q-дан сұра. |
| `assistant.title` | Q · QairuHub көмекшісі |
| `assistant.greeting` | Сәлем, мен Q, QairuHub ұлуымын. Жүрісім баяу болса да, жауабым жылдам. QairuHub-қа қосылу, іс-шаралар, жобалар немесе Accelerator туралы сұра. <!-- review: the joke --> |
| `assistant.placeholder` | Q-ға сұрақ қой… |
| `assistant.send` | Жіберу |
| `assistant.close` | Көмекшіні жабу |
| `assistant.reset` | Жаңа чат |
| `assistant.disclaimer` | Q The QairuHub Handbook бойынша жауап береді және қателесуі мүмкін. Құпиясөзіңді және жеке деректеріңді жазба. |
| `assistant.thinking` | Q ойланып жатыр… |
| `assistant.sources` | The QairuHub Handbook-тан |

### 19.2 Suggestions (3)

1. Қалай қосыламын?
2. Осы аптада не болады?
3. Жобамды қалай көрсетуге болады?

### 19.3 States

| key | KK |
|---|---|
| `assistant.fallbackIntro` | Қазір AI миыма қосыла алмай тұрмын, сондықтан The QairuHub Handbook-та жазылғанын көрсетемін: |
| `assistant.fallbackNone` | Бұл The QairuHub Handbook-тан табылмады. Сұрақты басқаша қойып көр немесе t.me/qairuhub арнасын қара. |
| `assistant.notAnnounced` | Бұл әлі жарияланған жоқ. Жаңалықтарды t.me/qairuhub арнасынан қадағала. |
| `assistant.offTopic` | Мен тек QairuHub туралы білемін, сол туралы кез келген сұрақ қой! |
| `assistant.rateLimited` | Маған сәл демалыс керек. Бір минуттан кейін қайталап көр немесе The QairuHub Handbook-ты оқы. |
| `assistant.dailyCap` | Бүгін көп сұраққа жауап бердім, ертеңге дейін демаламын. Жауаптардың көбі The QairuHub Handbook-та бар. |
| `assistant.tooLong` | Сұрақ тым ұзын. 500 таңбадан аспасын. |
| `assistant.error` | Менің жағымда бірдеңе дұрыс болмады. Қайталап көр. |
| `assistant.readMore` | The QairuHub Handbook-тан толығырақ оқу |

---

## 20. 404

| key | KK |
|---|---|
| `notFound.title` | Мұнда *ештеңе* жоқ. |
| `notFound.body` | Бет басқа жерге көшкен немесе сілтеме ескірген болуы мүмкін. |
| `notFound.cta` | Басты бетке |
