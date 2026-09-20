import type { CalendarEvent, Task } from '@/types'

// The single source of truth for the app-wide color logic (see CLAUDE.md).
// The day dot's *hue* now comes from the categories on that day
// (src/lib/dayColors.ts); this status picks its *treatment*:
//   done    → solid   (all tasks that day are done)
//   missed  → ring    (past day that had tasks but wasn't finished)
//   planned → dimmed  (today/future, not yet judged)
//   none    → nothing (day had neither tasks nor events)
export type DayStatus = 'done' | 'missed' | 'planned' | 'none'

// Events are fixed, not tasks: they can make a day show a dot and can be
// past-tense, but they never judge it — only tasks can mark a day missed.
export function dayStatus(
  tasks: Task[],
  events: CalendarEvent[],
  dateStr: string,
  todayStr: string,
): DayStatus {
  if (tasks.length === 0) {
    if (events.length === 0) return 'none'
    return dateStr < todayStr ? 'done' : 'planned'
  }
  if (tasks.every(t => t.status === 'done')) return 'done'
  if (dateStr < todayStr) return 'missed'
  return 'planned'
}
