# TODO — Stride

Nápady a vylepšenia na premyslenie. Legenda námahy: **S** = malé, **M** = stredné, **L** = veľké. 🔥 = odporúčané (dobrý pomer hodnota/námaha).


## Veľké / neskôr (L)
- [ ] **Pripomienky / push notifikácie** — „nezabudni na úlohu" (potrebuje riešenie pre push).
- [ ] **Offline-first** — IndexedDB + sync (CLAUDE.md to vedome odkladá).

## Pripojené kalendáre (iCal) — ďalšie kroky
- [ ] 🔥 **Otestovať s reálnymi feedmi** (S) — Humanity rozvrh, školský rozvrh, Google „tajná adresa iCal", Outlook publikovaný kalendár; skontrolovať časy (časové zóny), opakovania a zrušené/presunuté udalosti. Chyby hľadať v Supabase → Edge Functions → calendar-sync → Logs.
- [ ] 🔥 **Udalosti v štatistikách** (M) — zatiaľ sa nerátajú nikam. Rozhodnúť ako: napr. „odpracované hodiny" podľa kategórie (Categories sheet → Čas, Štatistiky → Hodiny), prípadne voliteľne započítať do done/total. Nemiešať s farbami dní (smena bez checkboxu nesmie spraviť deň „missed").
- [ ] **Úprava pripojeného kalendára** (S) — premenovanie a zmena URL (teraz sa dá len zmeniť kategória, obnoviť alebo odpojiť).
- [ ] **Udalosti v mesačnom/ročnom kalendári** (S) — malý farebný indikátor v mriežke (dnes sa zobrazia až v detaile dňa); stavová bodka ostáva len pre úlohy.
- [ ] **Filter „Kalendáre" na Domove** (S) — chip na rýchle skrytie/zobrazenie všetkých udalostí.
- [ ] **Obnoviť skryté udalosti** (S) — odstránená udalosť sa dá vrátiť len cez „Späť" (~5 s); pridať v nastaveniach kalendára „Zobraziť odstránené".
- [ ] **Udalosť → úloha** (S) — akcia v detaile udalosti „Vytvoriť úlohu" (napr. príprava na skúšku), predvyplní názov/čas/kategóriu.
- [ ] **Pravidelná synchronizácia na serveri** (M) — `pg_cron` volá `calendar-sync` pre všetky feedy (dnes sa synchronizuje len pri otvorení appky, ak je feed starší ako 30 min, alebo ručne).
- [ ] **Staršia história** (S) — sync drží okno −60 / +365 dní; ak chceme v ročnom pohľade vidieť staršie udalosti, rozšíriť okno.

## Dev / databáza
- [ ] 🔥 **SQL migrácia na skopírovanie** (S) — v `README.md` pri „Migration — connected calendars" dať kompletný SQL blok (tabuľky + index + RLS), nie len odkaz na schému vyššie.
- [ ] **Supabase migrácie** (M) — zaviesť `supabase/migrations/*.sql`, aby stačilo `npx supabase db push` namiesto ručného kopírovania SQL; existujúcu schému označiť ako aplikovanú.
- [ ] **Návod pre nový Supabase projekt** (S) — do README: použiť **publishable/anon** kľúč (nie `sb_secret_…` → chyba „Forbidden use of secret API key in browser"), vypnúť *Confirm email* pre vývoj (Authentication → Sign In / Providers → Email) alebo vytvoriť používateľa cez Authentication → Users, nasadiť funkcie `calendar-sync` + `delete-account`.
- [ ] **Commit / PR** (S) — kalendárovú funkciu dať do vetvy a PR pre kamaráta; `.supabase.pass` necommitovať (pridať do `.gitignore`).

## Todo
- [ ] **Haptika** (S) — vibrácia pri akcii (Android cez Vibration API; iOS Safari nepodporuje).
- [ ] **Jemné animácie** (S) — plynulý expand úlohy + prechod do Settings (fade/slide); 150–200 ms.
- [ ] **Onboarding / help** (M) — 3 slidy pri prvom otvorení (čo je týždeň, ako pridať úlohu, čo sú kategórie). Zvážiť či to stojí za to — landing page už vysvetľuje app, UI je intuitívne; reálna hodnota by bola len pre nových používateľov bez kontextu z landingu.

---

## Hotovo
- [x] **Pripojenie kalendára cez URL (iCal)** — `+` na Domove otvorí menu „Pridať aktivitu / Pripojiť kalendár“; sheet: URL (https/webcal) → overenie (počet udalostí) → názov + kategória → pripojiť; zoznam pripojených (obnoviť, zmena kategórie, odpojiť). Udalosti sú fixné, zobrazené medzi úlohami podľa času (Domov + detail dňa v Kalendári), dajú sa odstrániť (skryť, so Späť). `calendar-sync` Edge Function (ical.js, RRULE/výnimky/časové zóny), tabuľky `calendar_feeds` + `calendar_events`. *(Neskôr: započítanie udalostí do štatistík.)*
- [x] **Landing page i18n** — všetky texty landingu (`LandingView.vue`) prešli cez `vue-i18n` (nový `landing` namespace vo všetkých 7 jazykoch v `messages.ts`); pridaný `LanguageSwitch` (compact/glóbus) do nav-u landingu, štylizovaný pod tmavú `.lp` paletu cez `:deep()`. Viacriadkový hero/why nadpis rieši `white-space: pre-line` namiesto natvrdo written `<br>`, aby si každý jazyk mohol zvoliť vlastné zalomenie.
- [x] **Hover tooltips na ikonových tlačidlách** — natívny `:title` (mirror existujúceho `:aria-label`) na všetkých ikonových tlačidlách bez viditeľného textu naprieč appkou (`DayList.vue`, `NoteRow.vue`, `NoteEditorView.vue`, `NotesHomeView.vue`, `NotesListView.vue`, `AppHeader.vue`, `LanguageSwitch.vue`, `OverdueSection.vue`, `CategoriesSheet.vue`, `HomeView.vue`, `AuthView.vue`, `AccountView.vue`, `CalendarView.vue`, `LegalPage.vue`); po ceste opravený aj natvrdo napísaný neprekladaný aria-label (`CalendarView.vue` "Zavrieť" → `t('cat.closeAria')`).
- [x] **Poznámky na landing page** — 4. karta „Notes" vo feature-showcase sekcii v `LandingView.vue`, + screenshot `public/screens/Notes.png` (rovnaký phone-portrait rámček ako ostatné, kurátorované demo dáta).
- [x] **Poznámky (Notes)** — nový tab v spodnej navigácii, Apple Notes štýl. Priečinky (CRUD, drag & drop poradie, „All Notes"), poznámky (názov + text, autosave, pripnutie, vyhľadávanie, presun medzi priečinkami), swipe/undo mazanie zhodné s existujúcim vzorom pre úlohy/kategórie. `notes` + `note_folders` tabuľky (RLS, `on delete set null` pre priečinok), demo dáta.
- [x] **Čas podľa kategórie** — Categories sheet má tab „Čas" (hotové/naplánované hodiny za týždeň na kategóriu, `duration_min`); Štatistiky → rozpad podľa kategórie má prepínač Počet ↔ Hodiny.
- [x] **Analytics** — Vercel Web Analytics (`@vercel/analytics/vue`); page views, unikátni návštevníci, zdroje; zadarmo, bez cookies, GDPR ok.
- [x] **Nasadenie na Vercel** — `vercel.json`, env vars, Supabase Auth URLs, OG domain, Edge Function, Confirm email vypnuté. Live: https://stride-by-keno.vercel.app

- [x] **Demo účet** — „Try Demo" tlačidlo na landing; demo mód cez localStorage aj v prode; banner „Demo mode" s Back + Sign up free; auto-exit pri prihlásení. Demo generuje max 1 rok dozadu, menej úloh/deň.
- [x] **Kalendár — infinite scroll** — mesačný aj ročný pohľad: nekonečný scroll hore/dole (IntersectionObserver + sentinely), scroll pozícia stabilná pri prepend, header sa aktualizuje pri scrolle.
- [x] **Favicon + OG meta** — OG + Twitter tagy v `index.html`; screenshoty centrované na tablete. ⚠️ Pred nasadením nahradiť `YOUR_DOMAIN` (4 miesta v `index.html`).
- [x] Landing page (wide) — full-width uvítacia stránka pre odhlásených (aj `/welcome`): nav, hero, tagline diferenciátor, Why Stride, A simple view, Devices + Roadmap, CTA, footer (logo by Keno). Placeholder rámčeky zatiaľ namiesto screenshotov.
- [x] Landing — narrow / responsive (mobil): jednostĺpcový vycentrovaný hero, menšie fonty/rozostupy, 2 karty na tablete, footer pod seba (odkazy ako menu + logo dole), scroll-to-top pri navigácii.
- [x] Landing — reálne screenshoty: hero + 3 karty (Home/Calendar/Stats) z `public/screens/` (phone-portrait rámčeky, object-fit cover); kurátorované demo dáta pre pekné zábery.
- [x] Privacy / Terms ako samostatné tmavé stránky (`/privacy`, `/terms`) — zdieľaný `LegalPage` komponent zladený s landingom (rovnaký nav + footer), prepojené z footer linkov; back → welcome (resp. home pri prihlásení).
- [x] Settings „About" — Privacy Policy + Terms of Service ako vlastné pod-stránky (banner s ikonou + sekcie s ikonami/odrážkami), Send Feedback (`mailto:stridebykeno@gmail.com`), Version 1.0.0. Kontaktný email vybavený.
- [x] Tablet layout — na dotykových zariadeniach (≥600px, `pointer:coarse`) full-screen namiesto úzkeho stĺpca; desktop (myš) ostáva boxovaný.
- [x] Filter podľa viacerých kategórií naraz — chipy na Domove sú toggle (viac aktívnych naraz, OR), „All" = prázdny výber. Len frontend (`selectedCats` Set).
- [x] Týždenný cieľ — full-width karta v Štatistikách (progres hotové/cieľ za aktuálny týždeň, zelená pri dosiahnutí); cieľ sa nastavuje v Settings (roller) — `lib/goal.ts` + localStorage.
- [x] Preradenie poradia kategórií — drag (`⋮⋮` handle) v Categories sheet cez `vuedraggable`; `categories.position` stĺpec, premieta sa do filter-chipov. (migrácia v README)
- [x] Export / Import JSON — Settings → DATA: export všetkých úloh+kategórií do `stride-backup-<dátum>.json`; import (nedeštruktívny, pridáva) s premapovaním category_id. (`src/lib/backup.ts`)
- [x] Overdue úlohy — zbaliteľná sekcia „Po termíne (N)" hore na Domove (len aktuálny týždeň); checkbox/swipe → hotovo, „Today" → presun na dnes, ✕/swipe → zmazať; inline „Späť" pri zmazaní aj dokončení. Store `overdue` + `fetchOverdue` (všetko nedokončené v minulosti).
- [x] Opakujúce sa úlohy (jednoduché) — `repeat` None/Daily/Weekly/Monthly (ikona-select vedľa kategórií); pri *hotovo* sa spawne ďalší výskyt (+1d/+7d/+1m), repeat sa na dokončenom zmaže (žiadne duplikáty/série). 🔁 indikátor v riadku.
- [x] Zmazať účet + dáta — „Delete account" v Settings (dvojkrokové potvrdenie) → `delete-account` Edge Function (service-role) zmaže auth usera, dáta odídu cascade. *(treba nasadiť funkciu: `supabase functions deploy delete-account`)*
- [x] Animácie — checkbox pop + plynulé vyfarbenie, animované prečiarknutie textu, press efekt na tlačidlách, vsunutie „Späť" riadku; pod `prefers-reduced-motion`.
- [x] Trend completion % v čase — prepínač Počet ↔ % v hlavičke grafu (rovnaké obdobia), hodnoty nad stĺpcami.
- [x] Priorita / vlajka — klikateľná vlajka v riadku (sivá = bežná, červená = dôležitá), prepína sa priamo; `priority` bool stĺpec.
- [x] PWA PNG ikony — pwa-192/512 + maskable-512 v `public/`, zapojené do manifestu (`vite.config.ts`) + apple-touch-icon v `index.html`.
- [x] Swipe na úlohe (mobil) — → hotovo/nehotovo, ← zmazať (prah 80px, farebný podklad, nekoliduje s prepínaním týždňov).
- [x] Undo po zmazaní — inline riadok „Späť" (~5 s) na mieste zmazanej úlohy (swipe aj tlačidlo Delete); vráti úlohu vrátane poradia.
- [x] Čas úlohy — voliteľný čas dňa (hodina:minúta select, 24h) + odhad trvania (15m–12h); riadok ukazuje „14:00 · 2h", zoradenie podľa času.
- [x] Color picker pre kategóriu — vlastná farba (natívny `color` input s kvapkadlom) popri preset palete.
- [x] Štatistiky — heatmapa aktivity (GitHub-style) + insight podľa obdobia (najsilnejší deň/týždeň/mesiac).
- [x] Poznámka k úlohe — textarea v úprave, zobrazená pod názvom.
- [x] Prehadzovanie poradia (drag & drop, `position`) + presun úlohy na iný deň.
- [x] Potvrdenie pred zmazaním (kategórie aj úlohy) + add form sa po pridaní zatvorí.
- [x] Prázdne stavy (filter bez úloh, žiadne dáta v grafe, prázdne kategórie).
- [x] Kalendár — „Dnes" v ročnom zobrazení skočí na aktuálny mesiac.
- [x] Účet / Nastavenia stránka — email, jazyk, téma (Systém/Svetlý/Tmavý), kategórie, zmena hesla, odhlásenie.
- [x] Manuálny prepínač svetlý/tmavý režim (`data-theme` + localStorage) + dark date-picker (`color-scheme`).
- [x] Viacjazyčnosť (i18n) — EN/SK, predvolene EN, lokalizované dátumy, voľba v localStorage.
- [x] Auth — email/heslo, registrácia, reset hesla, Google OAuth (funguje aj naživo).
- [x] Apple-clean redesign (Domov, Kalendár, Štatistiky, jednotná hlavička, branding Stride).
- [x] Kalendár — mesiac + rok + day-detail sheet.
- [x] Štatistiky — metriky, streaky, graf podľa obdobia, rozpad podľa kategórie (vrátane „Bez kategórie").
- [x] Kategórie — CRUD + farby, filter, tvorba pri pridávaní úlohy, horizontálny scroll.
- [x] Úprava úlohy (premenovať / kategória / poznámka / presun / zmazať).
- [x] Širší layout na webe.
