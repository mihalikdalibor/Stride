<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/stride_by_keno-dark.svg">
    <img src="assets/stride_by_keno.svg" alt="Stride by Keno" width="520">
  </picture>
</p>

<p align="center">
  A weekly task manager as a PWA — plan Mon–Sun, drag tasks around, keep notes, track streaks and stats, on any device, synced through Supabase.
</p>

<p align="center">
  <a href="https://stride-by-keno.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-stride--by--keno.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.1.4-2b2e33?style=flat-square">
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vuedotjs&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-5a0fc8?style=flat-square&logo=pwa&logoColor=white">
  <a href="./LICENSE"><img alt="License: All rights reserved" src="https://img.shields.io/badge/license-all%20rights%20reserved-b3261e?style=flat-square"></a>
</p>

<p align="center">
  <b>→ Try it live: <a href="https://stride-by-keno.vercel.app">stride-by-keno.vercel.app</a></b>
</p>

---

## What is this

Stride is a weekly task-management app built as an installable PWA. The design
is deliberately Apple-clean and **mobile-first**: a week runs Monday to Sunday,
tasks are tapped, dragged and checked off, notes live in Apple Notes-style
folders, and everything you complete feeds a statistics screen with streaks and
a GitHub-style activity heatmap.

There is **no custom server**. Supabase is the entire backend — Postgres, Auth
and the auto-generated REST API. Per-user isolation is enforced in the database
by **Row Level Security** (`auth.uid() = user_id`), and `user_id` is never sent
from the client: it defaults to `auth.uid()` on insert and `with check` blocks
spoofing. The service worker caches the app shell, so the app installs to the
home screen and still opens offline.

## Screenshots

<p align="center">
  <img src="public/screens/Home.png" alt="Home — weekly overview" width="260">
  <img src="public/screens/Calendar.png" alt="Calendar — month view" width="260">
  <img src="public/screens/Stats_Month.png" alt="Statistics — month view" width="260">
</p>

<p align="center">
  <em>Home — the Mon–Sun week, progress and a collapsing header</em> ·
  <em>Calendar — month &amp; year, color-coded day status</em> ·
  <em>Statistics — metrics, streaks, category breakdown and heatmap</em>
</p>

<table align="center">
  <tr>
    <td width="33%" align="center">
      <img src="public/screens/Notes.png" alt="Notes" width="220"><br>
      <em>Notes — folders, pin, search, autosave</em>
    </td>
    <td width="33%" align="center">
      <img src="public/screens/Category.png" alt="Categories sheet" width="220"><br>
      <em>Categories — CRUD, colors, drag &amp; drop order</em>
    </td>
    <td width="33%" align="center">
      <img src="public/screens/Settings.png" alt="Account and settings" width="220"><br>
      <em>Account — language, theme, password, deletion</em>
    </td>
  </tr>
</table>

## Features

- 🗓️ **Home** — the whole week (Mon–Sun) on one screen: add and check off
  tasks, per-day progress bar, mini chart, and a header that collapses as you
  scroll
- ✅ **Tasks** — edit title/note/category, **drag & drop reorder** within a day,
  **move a task to another day**, start time + duration (rendered as
  `14:00–15:30`, or `22:00–03:00 +1` when it runs past midnight), a priority flag, and **repeat** (daily/weekly/monthly) with a
  spawn-on-complete model — completing a repeating task creates the next
  occurrence
- 📆 **Calendar** — month and year views with infinite scroll, color-coded day
  status, and a day detail sheet
- 📊 **Statistics** — Week / Month / Year, metrics and streaks, a bar chart with
  a **Count ↔ %** toggle, category breakdown, and a GitHub-style **activity
  heatmap**
- 🗒️ **Notes** — Apple Notes-style folders and notes with pinning, search,
  autosave and auto-linkified URLs/emails
- 🏷️ **Categories** — full CRUD with colors, filtering, reorderable, and
  creatable inline while adding a task
- 👤 **Account** — email/password + **Google OAuth**, password reset, and
  account deletion via a service-role Edge Function
- 🌍 **7 languages** — EN / SK / DE / ES / FR / IT / PT, picked automatically
  from the browser language; dates and month/day names come from `Intl`
- 🌗 **Theme** — system / light / dark
- 📱 **PWA** — installable on iOS and Android, service worker caches the app
  shell so it opens offline

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # vue-tsc + vite build
```

Create `.env.local` with your Supabase credentials (Project Settings → API):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Demo mode:** in dev the app shows generated data **without login**
(`src/lib/demo.ts`). To hit real Supabase data in dev, set `VITE_DEMO=false` in
`.env.local`. Production builds always use real data.

For a fresh Supabase project, run the SQL from the **Supabase setup & DB
schema** section below (plus the migrations if you are upgrading an existing
database).

## Tech stack

- **Frontend:** Vue 3 + Vite + TypeScript, Pinia, Vue Router
- **Styling:** **Bootstrap utilities** (not Tailwind) + custom CSS, design
  tokens and light/dark palettes in `src/styles/app.css`
- **UI extras:** `vue-i18n`, `vuedraggable` (SortableJS), Chart.js via
  `vue-chartjs` (Stats screen only)
- **Backend:** **Supabase** — Postgres + Auth + auto REST API, RLS-enforced. No
  custom server
- **PWA:** `vite-plugin-pwa` (installable, offline app shell)
- **Hosting:** Vercel

## Project structure

- `src/views/` — `HomeView`, `CalendarView`, `StatsView`, `AccountView`,
  `AuthView`, `LandingView`, `NotesHomeView`, `NotesListView`,
  `NoteEditorView`, `LegalPage` / `TermsView` / `PrivacyView`
- `src/components/` — `AppHeader`, `TabBar`, `DayList`, `OverdueSection`,
  `CategoryPicker`, `CategoriesSheet`, `NoteRow`, `LanguageSwitch`
- `src/stores/` — Pinia: `tasks`, `categories`, `notes`, `noteFolders`, `auth`
  (the stores are the only layer that talks to the DB)
- `src/lib/` — `supabase`, `dates`, `status`, `colors`, `theme`, `sortTasks`,
  `goal`, `backup`, `demo`
- `src/i18n/` — `messages` (EN/SK/DE/ES/FR/IT/PT), `dates` (localized formats)
- `src/styles/app.css` — design tokens + light/dark
- `supabase/functions/delete-account/` — account-deletion Edge Function
- `supabase/functions/calendar-sync/` — iCal feed fetch + parse (connected calendars)

---

<details>
<summary><b>Supabase setup &amp; DB schema</b></summary>

1. Create a project at https://supabase.com
2. Copy the URL and ANON_KEY from Project Settings → API
3. Add to `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

Then run in the Supabase SQL Editor:

```sql
create table categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  color       text not null default '#8E8E93',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title        text not null,
  task_date    date not null,
  task_time    time,
  duration_min int,
  priority     boolean not null default false,
  repeat       text not null default 'none' check (repeat in ('none','daily','weekly','monthly')),
  status       text not null default 'todo' check (status in ('todo','done')),
  category_id  uuid references categories (id) on delete set null,
  note         text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_user_date_idx on tasks (user_id, task_date);

create table note_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title       text not null default '',
  body        text not null default '',
  pinned      boolean not null default false,
  folder_id   uuid references note_folders (id) on delete set null,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notes_user_updated_idx on notes (user_id, updated_at);

create table calendar_feeds (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name           text not null,
  url            text not null,
  category_id    uuid references categories (id) on delete set null,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now()
);

create table calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  feed_id     uuid not null references calendar_feeds (id) on delete cascade,
  uid         text not null,
  title       text not null,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  all_day     boolean not null default false,
  hidden      boolean not null default false,
  synced_at   timestamptz not null default now(),
  unique (feed_id, uid)
);

create index calendar_events_user_start_idx on calendar_events (user_id, starts_at);

alter table tasks        enable row level security;
alter table categories   enable row level security;
alter table note_folders enable row level security;
alter table notes        enable row level security;
alter table calendar_feeds  enable row level security;
alter table calendar_events enable row level security;

create policy "tasks owner only" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories owner only" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "note_folders owner only" on note_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes owner only" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "calendar_feeds owner only" on calendar_feeds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "calendar_events owner only" on calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

</details>

<details>
<summary><b>Migrations (existing databases)</b></summary>

### Migration — drag & drop order

If your `tasks` table is missing the `position` column:

```sql
alter table tasks add column if not exists position int not null default 0;

with ordered as (
  select id, row_number() over (partition by user_id, task_date order by created_at) - 1 as rn
  from tasks
)
update tasks t set position = o.rn from ordered o where o.id = t.id;
```

### Migration — time, duration, priority, repeat

```sql
alter table tasks add column if not exists task_time time;
alter table tasks add column if not exists duration_min int;
alter table tasks add column if not exists priority boolean not null default false;
alter table tasks add column if not exists repeat text not null default 'none'
  check (repeat in ('none','daily','weekly','monthly'));
```

### Migration — category order

```sql
alter table categories add column if not exists position int not null default 0;

with ordered as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from categories
)
update categories c set position = o.rn from ordered o where o.id = c.id;
```

### Migration — notes

If your database was created before the Notes feature, run the `note_folders`/`notes` `create table` + RLS blocks above (they're additive — safe to run once on an existing project; skip if the tables already exist).

### Migration — connected calendars (iCal)

If your database was created before connected calendars, run the `calendar_feeds`/`calendar_events` `create table` + index + RLS blocks above (additive), then deploy the `calendar-sync` Edge Function (below).

</details>

<details>
<summary><b>Account deletion (Edge Function)</b></summary>

Deleting an auth user can't be done from the browser — it runs via the
`supabase/functions/delete-account` Edge Function (service-role). Deleting the
user **cascades** to their `tasks`, `categories`, `notes`, and `note_folders`.

Deploy (Supabase CLI, logged in and linked):

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. The client calls it via
`supabase.functions.invoke('delete-account')`.

</details>

<details>
<summary><b>Connected calendars (Edge Function)</b></summary>

"Connect calendar" subscribes to an iCal/ICS URL (Humanity, Google Calendar
"secret address in iCal format", Outlook "Publish calendar", school timetables…).
Browsers can't fetch those feeds (no CORS), so `supabase/functions/calendar-sync`
downloads + parses them server-side with the caller's JWT (RLS applies) and
upserts the expanded occurrences (−60 / +365 days) into `calendar_events`.
Removing an event sets `hidden = true`; sync never overwrites that flag.
The app re-syncs a feed on open when it's older than 30 minutes.

```bash
supabase functions deploy calendar-sync
```

</details>

<details>
<summary><b>Auth &amp; PWA notes</b></summary>

**Auth.** Email/password + **Google OAuth** via Supabase Auth. Enable Google in
Authentication → Providers → Google. After deploying, add the production domain
to Authentication → URL Configuration (Site URL + Redirect URLs).

**PWA.** Installable, service worker caches the app shell. Icon:
`public/stride_icon.svg`; PWA PNG icons: `pwa-192.png` / `pwa-512.png`.

</details>

---

## Project docs

Changelog: [CHANGELOG.md](./CHANGELOG.md) · Backlog and ideas:
[TODO.md](./TODO.md) · License: [All rights reserved](./LICENSE)

The source is available for viewing and reference only — this is **not** open
source. Use, copying, modification or distribution requires prior written
permission.
