# Changelog — Stride

All notable changes to this project are tracked here. Version numbers refer to `APP_VERSION` in `src/views/AccountView.vue`.

## [Unreleased]

## [1.2.0]
- Add connected-calendar events to Statistics: a finished event counts as done, a future one as planned, under its feed's category (count, %, streaks, chart, goal, heatmap, category hours). All-day events are skipped. Toggle "Count calendar events" in Settings.
- Fix: a task whose end time was earlier than its start (e.g. work 18:00–03:00) silently lost its end time. It now counts as ending the next day and shows as `18:00–03:00 +1`.

## [1.1.4]
- Fix: bottom tab bar disappeared while browsing a notes folder — it now only hides inside the note editor itself.
- Fix: creating a new notes folder relied on Enter or losing focus to save; it now has explicit confirm/cancel buttons like the task add-row.

## [1.1.3]
- Fix: moving a task to a new date via the edit form's top confirm checkmark did nothing — only the move panel's own checkmark applied the date change. Both now move the task.

## [1.1.2]
- Fix category hours progress bar to reflect completion %.

## [1.1.1]
- Fix category hours breakdown to show done/planned.

## [1.1.0]
- Add time tracked per category.
