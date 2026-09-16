# CLAUDE.md — Stride

Weekly task-management PWA. Apple-clean, mobile-first, cloud-synced. Personal app (single user uses it, but multi-user via auth). Branded **Stride** (logos in `public/stride_*.svg`); the repo/folder is historically named "CheckList"/"Tracker".

> The app is largely built. See **`TODO.md`** for the backlog/ideas and what's done. This file is the durable spec + conventions; keep it accurate when behaviour changes.

## Stack

- Vue 3 + Vite + TypeScript
- Pinia (state) + Vue Router
- **Bootstrap** for styling (NOT Tailwind). Avoid default Bootstrap component look — lean on utilities + small custom CSS to keep the Apple-clean aesthetic.
- `vite-plugin-pwa` (installable, offline app shell)
- Supabase (Postgres + Auth + auto REST API) — this is the entire backend, no custom server
- Chart.js via `vue-chartjs` (Stats screen only)
- `vue-i18n` (EN, SK, DE, ES, FR, IT, PT; default = browser language, else EN) — all UI strings go through it; adding a locale = add a block in `src/i18n/messages.ts` (dates/day/month names come from `Intl`, no per-locale arrays needed)
- `vuedraggable` (SortableJS) — drag & drop task reorder

## Dev setup (new machine)

1. `npm install`
2. Create `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). `.env.local` is gitignored.
3. `npm run dev` → http://localhost:5173
4. **Demo mode**: in dev the app shows generated demo data without login (`src/lib/demo.ts`, `isDemo = DEV && VITE_DEMO !== 'false'`). To use real Supabase data in dev, set `VITE_DEMO=false` in `.env.local`. Production build always uses real data.
5. `npm run build` runs `vue-tsc` (v2) + `vite build`; must stay green.
6. DB: run the SQL in `README.md` (incl. the `position` migration) on a fresh Supabase project.

## Architecture

- The Pinia `tasks` store is the **only layer that talks to the DB** (via `supabase-js`). Components never call Supabase directly.
- Auth: Supabase Auth, **Google OAuth** (+ magic link optional) → issues JWT/session.
- **RLS** enforces isolation at the DB level: `auth.uid() = user_id`. Every request carries the JWT; only the user's own rows come back.
- `user_id` is **never sent from the client** — it defaults to `auth.uid()` on insert, and `with check` blocks spoofing.
- Data flow: `Vue PWA → Supabase Auth (JWT) → supabase.from('tasks') + JWT → PostgREST → RLS → Postgres → data back`.
- **Connected calendars (iCal)**: `calendar-sync` Edge Function downloads + parses a feed with the caller's JWT (browsers can't fetch feeds — no CORS), expands recurrences (−60/+365 days) and upserts into `calendar_events`. The `calendars` store only reads events and writes feed settings + the per-event `hidden` flag; it re-syncs feeds older than 30 min once per session (`init()`). See README for deploy.
- **Account deletion** runs server-side via the `delete-account` Edge Function (service-role) — the browser can't delete an auth user. Deleting the auth user cascades to `tasks`/`categories` (`on delete cascade`). `auth.deleteAccount()` invokes it, then signs out. See README for deploy.
- Offline: service worker caches the app shell so the app opens offline. Full offline-first writes (IndexedDB + sync) are explicitly deferred to a later version — do not add now.

## Data model (already created in Supabase, see README.md for SQL)

- `tasks`: `id, user_id, title, task_date (date), task_time (time, nullable), duration_min (int, nullable), priority (bool), repeat ('none'|'daily'|'weekly'|'monthly'), status ('todo'|'done'), category_id (nullable FK), note, position (int), created_at, completed_at`
- `categories`: `id, user_id, name, color, position (int), created_at`. `position` orders the chips/filter and the categories sheet (drag & drop reorder via `vuedraggable`); new DBs run the `position` migration in `README.md`.
- `note_folders`: `id, user_id, name, position (int), created_at`. Apple Notes-style folders for the Notes tab; `position` orders the folder list (drag & drop via `vuedraggable`).
- `notes`: `id, user_id, title, body, pinned (bool), folder_id (nullable FK, on delete set null), position (int), created_at, updated_at`. `folder_id` null = unfiled (still shown in "All Notes"). Sort is **pinned desc, then `updated_at` desc** (matches Apple Notes' default "Date Edited" sort) — no manual drag reorder for notes (would fight that sort), so `position` exists for schema parity but isn't currently used to order the list.
- `calendar_feeds`: `id, user_id, name, url, category_id (nullable FK, on delete set null), last_synced_at, last_error, created_at`. A subscribed iCal/ICS URL ("Connect calendar" in the Home `+` menu); `category_id` applies to all its events. `last_error` holds an error code (`invalid_url|fetch_failed|not_ical|too_large|…`, translated under `ics.err`).
- `calendar_events`: `id, user_id, feed_id (FK, on delete cascade), uid, title, location, starts_at, ends_at (timestamptz), all_day, hidden, synced_at`, unique `(feed_id, uid)`. One occurrence per row (`uid` = `UID|RECURRENCE-ID` for recurring). All-day events store the date at `00:00Z` with an exclusive end date. **Events are fixed, not tasks:** no checkbox/edit, they're interleaved into `DayList` by start time (all-day first) but **don't count** toward done/total, day status colors, the week chart or stats (open for later). "Remove" sets `hidden = true` (swipe ← or tap → remove, with undo); sync never sends `hidden`, so it survives re-syncs.
- Notes:
  - Column is `task_date`, NOT `date` (reserved word).
  - `category_id` is nullable. Categories are **active** (CRUD + colors + filter implemented).
  - `position` orders tasks within a day (drag & drop); store sets it on add and on reorder. New DBs: run the `position` migration in `README.md`.
  - `task_time` is the optional **start** time of day ('HH:MM'). Within a day, timed tasks sort first ascending by time, untimed tasks keep `position` order below them (`src/lib/sortTasks.ts` `byDayOrder`, used by Home + Calendar day detail). Nullable; run the `task_time` migration in `README.md` on existing DBs.
  - `duration_min` stores the **end** time as minutes after the start (the edit/add form has "From"/"To" hour:minute selects; `DayList.vue` saves `duration_min = end − start` when both are set, only if end > start). It is meaningless without `task_time`. The row renders the range, e.g. `14:00–15:30` (start + duration), or just `14:00` when no end. Nullable; same migration block in `README.md`.
  - `priority` is a boolean "important" flag, toggled directly on the row via the flag icon in `DayList.vue` (grey = off, brand-red filled = on). Default false; same migration block in `README.md`.
  - `repeat` is recurrence (`none|daily|weekly|monthly`), set via the repeat-icon select in the edit/add form. **Spawn-on-complete model:** when a task with `repeat≠none` is toggled **done**, the store (`toggleTask` → `spawnNextOccurrence`) inserts the next occurrence (`src/lib/dates.ts` `nextRepeatDate`: +1d/+7d/+1 month clamped) carrying time/duration/category/note/priority/repeat, and **clears `repeat` on the completed one** so re-toggling never spawns a duplicate. No series_id / occurrence editing — deliberately simple. Row shows a 🔁 (`ti-repeat`) indicator. Default `'none'`; same migration block in `README.md`.
  - `completed_at` is set **app-side** on toggle (store sets `new Date().toISOString()` when status → done, `null` when → todo). No DB trigger.
  - Weeks are NOT stored. Group by ISO week over `task_date`; charts aggregate over the same column. Index `(user_id, task_date)` covers week/month range queries.

## Conventions

- **i18n:** all UI strings go through `vue-i18n` (`src/i18n/messages.ts`; EN, SK, DE, ES, FR, IT, PT; default = browser language else EN, persisted in `localStorage`). Never hardcode user-facing text — add a key. Dates/day/month names are localized via the `useFmt()` composable (`src/i18n/dates.ts`) using `Intl` (works for any locale). Language switch is a dropdown (`LanguageSwitch.vue`). Category/task names are user data, not translated.
- Week starts **Monday** (po ut st št pi so ne).
- **Bootstrap class-name collisions:** `bootstrap.css` is global, so DO NOT use these as custom class names — they break layout (`.row > *` forces full-width, `.card/.progress/.nav` add styles): `.row .col .nav .card .progress .container .badge .btn .form-control`. Use prefixed names (`.trow`, `.ac-card`, `.metric`, `.wk-progress`…). If a flex row mysteriously stacks vertically, suspect this first.
- **Theme:** light/dark via `data-theme` on `<html>` + `localStorage` (`src/lib/theme.ts`); default follows system. Palettes + `--logo-filter` + `color-scheme` live in `src/styles/app.css` (dark block duplicated for system-dark and `[data-theme=dark]`).
- **Brand accent:** `--color-text-info` is the logo red (`#ff2d20`), used for primary actions/active tab (not blue).
- Prefer targeted, incremental edits over rewrites.
- Keep code/answers concise.
- Date strings are `'YYYY-MM-DD'` throughout (local, via `src/lib/dates.ts`).

## Design system (Apple-clean)

- System font stack (`-apple-system, SF Pro, Inter, system-ui`). Lots of whitespace, subtle grays, hairline `0.5px` borders, generous corner radii.
- Persistent top header (`AppHeader.vue`, **outside** the scroll area) = Stride logo + name, language switch, settings/account gear. Bottom tab bar with 4 tabs: Domov, Štatistiky, Kalendár, Poznámky. Active tab = brand red (`--color-text-info`).
- Full-screen sub-pages draw their **own** back-header and hide the global `AppHeader`/`TabBar` (see `App.vue`'s `showChrome`): `/account` and everything under `/notes/` (folder contents, note editor) — mirrors how Account's sub-views work. The Notes root (`/notes`, the folder list) is a normal tab and keeps the global chrome.
- Icons: Tabler outline webfont (`<i class="ti ti-...">`).
- Two font weights only: 400 and 500. Sentence case. No emoji.
- Color tokens + light/dark are defined in `src/styles/app.css` (imported in `main.ts`). `design/*.html` are the original static mockups for reference.
- Desktop (≥600px): the app shows as a centered ~480px boxed column (side hairlines + soft shadow), gray background around.

### Color logic (THE important rule — same across all screens)

| State | Meaning | Visual |
|---|---|---|
| green (`success`) | day fully done / completed task | green dot / green checkbox / strikethrough item |
| red (`danger`) | **two uses:** (a) past day that had tasks but wasn't finished = "missed"; (b) the "today" marker | red dot (missed) vs red filled circle / red number (today) — different channels so they don't clash |
| gray (`tertiary`) | planned (today/future, not yet judged) | gray dot |
| none | day had no tasks | no dot |

To avoid the today/missed red clash: **today** = red filled circle around the number; **status** = a small dot *under* the number.

## Design reference pages

`design/*.html` are faithful static reproductions of the approved mockups — open them in a browser and match layout, spacing, colors, components when building the views. They share `design/app.css`.

- `design/home.html` → `HomeView.vue`
- `design/calendar-month.html` → month view
- `design/calendar-year.html` → year view
- `design/stats.html` → `StatsView.vue`

## Screen specs

### Domov (HomeView) — main / default landing

- Top: reserved slot for app name/logo (placeholder for now).
- Title "Tento týždeň" + date range. Right: `‹ ›` (prev/next week) + `+` (quick add). Swipe left/right also switches weeks.
- Week summary: "X / Y" done + thin progress bar.
- Mini 7-day bar chart (Po→Ne): bar height = total tasks that day, green portion = done. Today's letter is red. Empty days show only a baseline dot.
- Agenda list Po→Ne (each day = header with name + date + "done/total", then task rows).
  - Task row: circle checkbox (green filled + check when done, empty outline when todo). Done items: gray + strikethrough.
  - **"Pridať položku" row shows ONLY on today + future days.** Past days have no add affordance.
  - Future days with no tasks collapse to a compact single line: "Deň 13. jún … + Pridať".
  - Today's section is subtly tinted + its name/date is red.
- **Collapsing sticky header** (build as a layer on top once the rest works, scroll-driven, no data changes): at top of scroll the full header (title + summary + chart) is shown; on scroll it collapses to a thin sticky strip = "Tento týždeň · X/Y" + thin progress + `‹ ›`.

### Kalendár — 3 zoom levels, vertical infinite scroll (Apple model)

- **Year**: 12 mini-month grids (3 columns), vertical infinite scroll across years. Each day with activity gets a small **colored** dot by status (green done / red missed / gray planned). Today = red filled circle. Current month name = red. Tap a month → zoom to month view.
- **Month**: full grid, weekday header `po ut st št pi so ne` (Monday-start). Each day = number + status dot + small task count. Today = red filled circle. Vertical infinite scroll between months. Tap a day → day detail.
- **Day detail**: bottom sheet that **reuses the `DayList` day component from Domov** (same checkboxes + "Pridať"). No new design.

### Štatistiky (StatsView)

- Period segmented control: Týždeň / Mesiac / Rok.
- Metric cards (2×2): "Hotové · <obdobie>", "Completion %", "Aktuálny streak" (flame icon), "Najdlhší streak".
- Bar chart that buckets by the selected period (week→days, month→last 6 weeks, year→12 months); current/partial bucket label highlighted red. Build with Chart.js / vue-chartjs. A small `Count ↔ %` toggle in the chart header switches the bars between done **count** and **completion %** (`done/total`, y-axis 0–100) over the same buckets. Value labels are drawn above each non-zero bar via a tiny inline plugin (`valueLabels`).
- Small insight line ("Najsilnejší deň v týždni: …").
- "Podľa kategórie" breakdown (horizontal bars). Currently placeholder data; activates when categories are turned on. Per-category colors are TBD — bars are neutral blue for now.

### Poznámky (Notes) — 4th tab, Apple Notes-style

- **Root (`/notes`, `NotesHomeView.vue`)**: "All Notes" row (total count) + folder list (name, note count, drag handle, rename/delete). `+` in the header creates a folder (inline name input, autofocus). Swipe-left or trash-tap deletes with the same swipe/tombstone-undo pattern as tasks/categories; deleting a folder clears `folder_id` on its notes (mirrors the DB's `on delete set null`) and undo relinks them back.
- **Folder contents (`/notes/folder/:id`, `NotesListView.vue`; `:id = 'all'` for All Notes)**: back arrow + folder name + `+` new note. Search bar filters title+body client-side. Pinned section above the regular list (`NoteRow.vue`: title, single-line preview, localized date via `useFmt`-style `Intl` formatting, pin toggle). Swipe-left deletes with tombstone-undo.
- **Editor (`/notes/note/:id`)**: full-screen, own back-header (pin toggle + delete, no confirm dialog — matches the task edit-form's direct-delete convention). Borderless bold title + plain-text body textarea, debounced autosave (600ms) + flush on blur/unmount, no save button. Small folder `<select>` to move the note between folders. New notes auto-focus the title.
- **Scope (v1, deliberate cuts)**: plain text only (no rich formatting/checklists — no editor library in the stack), no note↔task linking (tasks already have their own per-task note field).

## Build order (suggested)

1. `HomeView` — wire to `tasks` store `fetchRange(monday, sunday)`, render agenda + checkboxes (`toggleTask`) + add (`addTask`).
2. Extract the day block into reusable `DayList.vue` (used by Home + Calendar day detail).
3. Calendar month view, then year view (compute first-weekday offset + length per month, Monday-start), then day-detail sheet.
4. Stats: aggregations over `task_date` + Chart.js bars.
5. Collapsing sticky header on Home (polish).
6. Categories: CRUD + colors + filters (the deferred feature).
