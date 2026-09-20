// Recurrence for manually added activities/events: the occurrences are
// materialized up front (one row per day, sharing a `series_id`), unlike the
// legacy per-task `repeat` which spawns the next one on complete.

import { addDays, weekdayIndex } from '@/lib/dates'

export type RepeatMode = 'daily' | 'weekly'

// hard cap so a wrong "until" date can't create thousands of rows
export const MAX_OCCURRENCES = 366

/** Every date from `from` to `until` (inclusive) matching the rule.
 *  `weekdays` are Monday-first indexes (0 = Mon … 6 = Sun), used by 'weekly'. */
export function expandDates(mode: RepeatMode, weekdays: number[], from: string, until: string): string[] {
  if (until < from) return []
  const days = mode === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(weekdays)]
  if (!days.length) return []
  const out: string[] = []
  for (let d = from; d <= until && out.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
    if (days.includes(weekdayIndex(d))) out.push(d)
  }
  return out
}
