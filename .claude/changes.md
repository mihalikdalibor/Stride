# Changes log

Written by `/implement` and `/fix`, one entry per run. Reviewed by `/review-changes`, which sets each entry's status.

## C-001 — Adding items to past days
- **Status:** reviewed (2026-09-23)
- **Date:** 2026-09-23
- **Type:** feature
- **Source:** `.claude/plans/2026-09-23-add-to-past-days.md` · TODO.md → "Ručné udalosti / série — ďalšie kroky" → "Pridávanie do minulosti"
- **Base:** b8bc6ea2a8e9980056d1511cf9ab1fff21179ee2; files already dirty before the run: `.gitignore`, `TODO.md`, `add_to_TODO.md` (untracked) — backlog/planning edits from `/next`
- **Files:** `src/stores/tasks.ts`, `src/components/DayList.vue`, `src/components/ItemForm.vue`, `src/views/HomeView.vue`, `src/i18n/messages.ts`
- **Requirements:**
  - [ ] A past day that has items (Home agenda and Calendar day sheet) shows the "Pridať položku" row at the bottom; tapping it opens `ItemForm`.
  - [ ] An empty past day on Home is a tappable compact row with "+ Pridať" (same look as an empty future day, day name stays muted); tapping expands it and opens the add form.
  - [ ] Adding an **event** to a past day stores it on that day; it appears immediately in the day list, colors the Calendar month/year dot (reads as done, since events are never "missed"), and counts in Stats as done (timed; all-day skipped as today). *(Stats can only be checked against Supabase — in demo mode opening Stats or loading more Calendar months regenerates demo data and drops just-added items; that is existing demo behavior, not a bug.)*
  - [ ] Adding an **activity** to a past day creates it with `status = 'done'` and `completed_at` set to the current time; the row shows a green checked checkbox, the day's `done/total` counts it, and it does **not** show in the "Po termíne" section.
  - [ ] Multi-day / repeat from any day: every created date `< today()` is stored done, today and future dates are stored `todo`.
  - [ ] Converting a manual event to an activity on a past day (edit form, Aktivita segment) also yields a done activity (same store rule).
  - [ ] When the form will create at least one past-dated activity, it shows a short hint (new i18n key `item.pastDone`, all 7 locales).
  - [ ] Today/future behavior is unchanged (activities added there are `todo`).
  - [ ] Unchecking such a past activity later works as for any task (becomes todo → the day reads "missed"; like today, it enters "Po termíne" only after the next Home reload/week change, and never if it's a series occurrence). Toggling is not changed by this plan.
  - [ ] Works in demo mode (`npm run dev`, no login) and against Supabase.
  - [ ] `npm run build` is green.
  - [ ] CLAUDE.md no longer says past days have no add affordance.
- **Summary:** `addTasks` now creates past-dated activities as done (`status`, `completed_at` = now), per date; this also covers multi-day/repeat and event → activity conversion. The past-day gate in `DayList` is gone, so Home and the Calendar sheet show the add row on every day. Empty past days on Home are tappable compact rows. `ItemForm` shows an `item.pastDone` hint (7 locales) when a past-dated activity will be created.
- **Grade / mode:** M — solo (downgraded from "solo + test writer": no test runner in the repo)
- **Verification:** `npm run build` green (baseline green; the chunk > 500 kB warning also appears on untouched HEAD). Headless Chromium (Playwright) in demo mode (`VITE_DEMO=true vite`) checked these: add rows on past days; a past activity was checked on save and counted in done/total; a past event rendered as an event; today's add stayed todo with no hint; multi-day Tue + Thu gave Tue done and Thu todo; the overdue section didn't list the new items; converting an event to an activity on a past day gave a done activity; editing an existing activity showed no hint; the previous week's empty past compact row opened the form; a past day in the Calendar sheet added a done activity and its grid dot updated. Screenshots were reviewed. An independent review found no high or medium issues. **Not verified:** against real Supabase (Stats count, insert with `status`/`completed_at`), and Stats in demo mode (demo regenerates data); dark mode wasn't looked at (no CSS added).
- **Deviations:** Plan iteration 3 (CLAUDE.md update) was not done because `/implement` doesn't write docs. It's deferred to `/release`, so the last requirement is still open.
- **Review:** 11/12 criteria met, and the reviewer re-tested in demo mode with headless Chromium: the happy path, a repeat rule spanning past→future, conversion, unchecking, the compact row and the Calendar sheet; `npm run build` passes. Must be done in `/release`: `CLAUDE.md:55,112,113` are out of date (the docs update was deferred because `/implement` doesn't edit docs). Minor follow-ups: the hint's `today()` isn't reactive across midnight; "Move to" a past date keeps the item todo (out of scope). Not verified against real Supabase.

## C-002 — Subcategories, Stats category filter, custom Stats period
- **Status:** reviewed (2026-10-05)
- **Date:** 2026-09-23
- **Type:** feature
- **Source:** `.claude/plans/2026-09-23-stats-filter-custom-period-subcategories.md` · TODO.md → "Štatistiky / kategórie" → "Vlastné obdobie v Štatistikách", "Filter Štatistík podľa kategórií", "Podkategórie"
- **Base:** b8bc6ea2a8e9980056d1511cf9ab1fff21179ee2; files already dirty before the run: the uncommitted, reviewed C-001 change (`src/stores/tasks.ts`, `src/components/DayList.vue`, `src/components/ItemForm.vue`, `src/views/HomeView.vue`, `src/i18n/messages.ts`) plus `.gitignore`, `TODO.md`, `.claude/changes.md`, `add_to_TODO.md` — review this run against C-001's state, not HEAD
- **Files:** created `src/components/ConfirmDialog.vue`, `src/components/CategoryRow.vue`, `src/components/CategoryFilter.vue`, `src/lib/statsRange.ts`; modified `src/stores/categories.ts`, `src/stores/tasks.ts`, `src/stores/calendars.ts`, `src/types/index.ts`, `src/components/CategoriesSheet.vue`, `src/components/CategoryPicker.vue`, `src/views/HomeView.vue`, `src/views/StatsView.vue`, `src/views/CalendarView.vue`, `src/lib/backup.ts`, `src/lib/demo.ts`, `src/i18n/dates.ts`, `src/i18n/messages.ts`, `README.md` (schema + migration SQL). Also added by `/uidesign` at the user's request (untracked, not app code): `.agents/skills/*`, `.claude/skills/*` (symlinks), `skills-lock.json`
- **Requirements:**
  ### Subcategories
  - [ ] README has a "Migration — subcategories" SQL block (`parent_id uuid references categories (id) on delete cascade` + index) and the base `create table categories` includes `parent_id`.
  - [ ] `Category` type has `parent_id?: string | null`; a database **without** the migration still loads and creates top-level categories (no `parent_id` key is sent unless it's set).
  - [ ] Categories sheet: subcategories render indented directly under their parent; a new category can pick a parent ("Nadradená"); a category's panel has a "Nadradená" select to attach/detach it.
  - [ ] Only one level: the parent select lists top-level categories only (never itself); a category that has subcategories can't be attached (select disabled + hint `cat.noNesting`).
  - [ ] A subcategory has no color palette and no streak switch in its panel (hint `cat.inherits`); everywhere (day dots incl. `CalendarView` `catOrder`, Home week bars, chips, picker, DayList cat-dot, Stats breakdown bars via `catMeta`, CategoriesSheet Time tab swatch + `ti-flame-off` indicator) it shows the parent's color / flag — all reads go through `store.color(id)` / `store.countsToStreak(id)`, never `c.color` / `c.exclude_from_streak` directly.
  - [ ] Detaching a subcategory (parent → "Žiadna") makes it a top-level category that keeps the parent's color and streak flag as its own.
  - [ ] Drag & drop reorders top-level categories among themselves and subcategories only within their own parent; order persists (`position`).
  - [ ] `CategoryPicker` (item form + connect-calendar sheet) and the filter chips list every category, parents in order with each parent's subcategories right after it, labelled "› Firma A".
  - [ ] Deleting a category **with** subcategories (trash tap or swipe) first shows the confirmation dialog listing the subcategory names; "Zrušiť" does nothing; "Zmazať" deletes the parent and all its subcategories, clears the category on their tasks/events/feeds locally (DB does it via `on delete set null`), and leaves one "Späť" tombstone that restores parent + subcategories (same names, color, flag, order, parent link) and re-links **all** their tasks, manual events and calendar feeds — including rows that aren't loaded (ids are queried from the DB before the delete).
  - [ ] Deleting a category **without** subcategories behaves exactly as today (immediate delete + undo, no dialog).
  - [ ] The dialog covers the whole viewport (incl. `AppHeader`, `TabBar` and the desktop gray margins), blocks every click outside its two buttons, ignores Esc and backdrop taps, traps Tab focus between its buttons, the content behind can't be scrolled (the fixed overlay captures wheel/touch), and matches the app design (tokens, radii, 400/500 weights, light + dark).
  - [ ] JSON export includes `parent_id` and `position` (categories exported in `ordered` order); import recreates parents first, then subcategories linked to the new parent ids; older backups (no `parent_id`) import as top-level.
  - [ ] Demo mode has at least two subcategories (e.g. Work › Client A, Work › Client B) with a few demo tasks in them.

  ### Stats category filter
  - [ ] Štatistiky shows a chip row (same look as Home): "Všetky" (empty selection), one chip per category in picker order (subcategories after their parent), and "Bez kategórie".
  - [ ] Multi-select with OR; a parent chip matches the parent and all its subcategories; a subcategory chip matches only it; "Bez kategórie" matches items with no category.
  - [ ] The filter applies to **everything** on the Stats page: metric cards (done, %, current + longest streak), weekly goal, bar chart, insight, heatmap and category breakdown.
  - [ ] Selection is session-only (module-level state, survives tab switches, not a reload) and independent of Home's filter; a selected category that gets deleted drops out of the selection (pruned on mount and on category changes; `NO_CAT` kept).
  - [ ] Home's filter chips use the same shared component and the same parent-includes-children matching (tasks and events).

  ### Stats breakdown with subcategories
  - [ ] "Podľa kategórie" groups by top-level category: a parent row sums the parent's own items + all its subcategories (count and hours modes); a parent that has subcategory data shows a chevron and expands to per-subcategory rows (plus a row `stats.directly` "{name} (directly)" for items filed directly on the parent, if any). Rows are keyed by category id, not name.

  ### Custom period
  - [ ] The period segment has a 4th option "Vlastné" (short label in every locale so 4 buttons fit a phone); selecting it shows two date inputs (od, do), default the last 30 days (today−29 → today), `min` = today − 5 years, `max` = today + 2 years. The selected period is session-level too.
  - [ ] Normalization runs on `change` (not per keystroke) and ignores empty/invalid values: from > to is swapped; ranges longer than 3 years are clamped (from moved to to − 3 years + 1 day).
  - [ ] Buckets: ≤ 31 days → one per day (label `d.m`), ≤ 182 days → Monday-start weeks (label = bucket start `d.m`, first/last clipped to the range), otherwise calendar months (label `monthShort`, plus `'yy` when the range spans years), clipped to the range; the bucket containing today is red.
  - [ ] Chart title follows the granularity (byDay / byWeek / byMonth); insight uses the same unit over the selected range; the done-metric label reads "Hotové · <od – do>" via a new `fmt.rangeLabel(from, to)`.
  - [ ] Choosing a range outside the loaded data (including when Stats is reopened with "Vlastné" and a remembered range) fetches tasks and events for the union range (debounced ~300 ms); a stale response never overwrites a newer one — guarded **inside the stores** (`tasks.fetchRange`, `calendars.fetchStatsRange`) like `fetchGridRange`.
  - [ ] With more than 14 bars the per-bar value labels are skipped (no overlap).
  - [ ] `tasks.fetchRange` pages through results (1000 per page) so long ranges aren't truncated.
  - [ ] The custom range survives switching tabs within the session (module-level state), not a reload.

  ### General
  - [ ] All new UI strings are i18n keys in all 7 locales (EN, SK, DE, ES, FR, IT, PT).
  - [ ] No Bootstrap class-name collisions (notably not `.modal`, `.alert`, `.badge`, `.card`, `.row`, `.col`, `.nav`, `.btn`).
  - [ ] `npm run build` is green; demo mode (`VITE_DEMO=true`) exercises every flow above.
- **Summary:** Categories get one level of subcategories (`parent_id`, cascade delete; color + streak flag inherited through `color()`/`countsToStreak()`), shown nested in the Categories sheet (new `CategoryRow`, nested per-group drag & drop, parent select), the picker and a shared `CategoryFilter` chip row (Home + Stats, parent includes children). Deleting a parent goes through a new full-screen, blocking `ConfirmDialog` (app `inert`, Esc/backdrop ignored, focus trap) and undo restores the whole tree and re-links tasks/events/feeds looked up from the DB. Stats gains a category filter applied to everything (incl. streaks + goal), a breakdown grouped by parent with expandable subcategory rows, and a "Vlastné" from–to period (auto day/week/month buckets, session state, union refetch). `tasks.fetchRange` is paged and, like `fetchStatsRange`, drops superseded responses.
- **Grade / mode:** L — solo (no disjoint slices: all three features share `StatsView.vue`/`messages.ts`; user chose one assignment; no test runner → no test writer)
- **Verification:** `npm run build` green after every iteration (only the pre-existing chunk > 500 kB warning). `npx tsx` scratch script: 16 boundary assertions on `statsRange.ts` (31/32 and 182/183-day granularity, swap, 3-year + 5y/2y bound clamps, clipped week/month buckets across years) — pass. Headless Chromium (playwright-core) in demo mode: sheet nesting, create-with-parent, detach/attach, one-level rule, per-group drag (top-level and within a parent; cross-group refused), leaf delete/undo without dialog, parent delete dialog (covers header + tab bar + desktop margins, app inert, Esc/outside clicks ignored, Tab cycles, focus on Cancel, Cancel keeps, Delete removes tree, undo restores tree + task colors), double-tap delete → one tombstone, flame-off inherited, picker/chips order; Home filter incl. children; Stats filter (All/Fitness/No category change metrics, goal, heatmap, streaks, breakdown), breakdown expand in count + hours, filter/period survive tab switch; custom period 30 days/3 months/13 months (titles, labels incl. 'yy, insight, no value labels > 14 bars), swap, clamp, custom + filter. Screenshots reviewed (dialog light/dark/desktop, charts, breakdown, stats). Independent review: no critical/high; 9 findings fixed, 2 kept as documented deviations, 1 accepted. **Not verified:** against real Supabase (migration, cascade delete, DB link lookups + re-link on undo, `parent_id` inserts, paged task fetch > 1000 rows, 2–3-year ranges — demo data only spans ~1 year and never pages); touch swipe/drag on a real phone (mouse drag only); a DB without the migration (code path reviewed, not run).
- **Deviations:** new `CategoryRow.vue`; `fmt.dateRange` instead of `rangeLabel`; `stats.directly` = "Directly" (no name — it was clipped); `reorderGroup(group)` without parent id; `ti-flame-off` also on subcategory rows (inherited); `statsRange.ts` written in iteration 3; CLAUDE.md not updated (left to `/release`). Plus review fixes listed in the plan's Implementation notes.
- **Review:** plan-auditor all criteria met (static), bug-hunter no CRIT/HIGH, app-tester demo run all pass. Non-blocking follow-ups: [MEDIUM] Week/Year insight + longest streak use all loaded data, so a wide custom range changes them (`StatsView.vue` ~l.423/282); [MEDIUM] stale selected category ids aren't pruned when `CategoryFilter` isn't mounted (no categories) → Stats shows zeros; [LOW] undo can restore a child under a parent that was since nested; child delete during parent delete in flight; failed re-link on undo ignored; `parent_id` FK has no same-user check; CLAUDE.md not yet documenting C-002 (`/release`). Not verified: real Supabase.

## C-003 — Stats Month chart = current calendar month
- **Status:** reviewed (2026-10-05)
- **Date:** 2026-10-04
- **Type:** feature (`/implement`)
- **Source:** `.claude/plans/2026-10-04-2346-stats-month-current.md` — user request "stats using month shows statistic not for last month but for current month"
- **Base:** b8bc6ea2a8e9980056d1511cf9ab1fff21179ee2; files already dirty before the run: many uncommitted changes incl. `src/views/StatsView.vue`, `CLAUDE.md` (earlier unreviewed C-002 work) — review this run's hunks only (Month branches of `buckets` and `insight`)
- **Files:** `src/views/StatsView.vue`, `CLAUDE.md`
- **Requirements:**
  - Month chart buckets = Monday-start weeks covering the 1st..last day of the current month, first/last clipped (4–6 bars); label = bucket start `d.m`.
  - The bucket containing today is red; future buckets show 0 done / total (planned) as before.
  - Insight in Month = strongest week within the current month (label = clipped bucket start); null when nothing done this month.
  - Metric cards, week/year/custom periods unchanged; chart title still "by week".
  - `npm run build` green.
- **Summary:** Month branch of `buckets` now uses `rangeBuckets(periodRange, 'week')` instead of the last 6 weeks; the month insight only counts items inside the month with the week key clipped to the month start. Comment and CLAUDE.md Stats bullet updated.
- **Grade / mode:** S — solo
- **Agents:** solo (user's choice); bug-hunter (no findings); app-tester skipped (small computed-only change, not run); 0 fix rounds
- **Verification:** `npm run build` green before and after; bug-hunter ran `vue-tsc --noEmit` clean and traced Oct 2026 buckets by hand. **Not verified:** rendering in the browser/demo mode; month with 6 week-rows; no test runner so no tests.
- **Deviations:** none
- **Review:** plan-auditor 5/5 met, bug-hunter no CRIT/HIGH, app-tester verified 8 faked-date month shapes + other periods in demo. Follow-ups: [LOW] future done tasks give done>0,total=0 in % mode (`doneBetween` vs `totalBetween`); README screenshot `public/screens/Stats_Month.png` likely shows old 6-week chart; Week insight is all-time (pre-existing).
