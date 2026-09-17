import { ymd } from '@/lib/dates'
import type { CalendarEvent, Task } from '@/types'

// Common shape Stats aggregates over, so tasks and connected-calendar events
// combine per category/day. An event counts as done once it has ended and as
// planned before that; all-day events (holidays, vacation) are skipped.
export interface StatItem {
  date: string              // 'YYYY-MM-DD' local
  done: boolean
  category_id: string | null
  minutes: number | null    // duration, null = unknown (hours mode skips it)
}

const MAX_EVENT_MIN = 24 * 60

export function taskToItem(t: Task): StatItem {
  return { date: t.task_date, done: t.status === 'done', category_id: t.category_id, minutes: t.duration_min }
}

export function eventToItem(ev: CalendarEvent, category_id: string | null, now: number): StatItem | null {
  if (ev.all_day) return null
  const start = Date.parse(ev.starts_at)
  const end = Date.parse(ev.ends_at)
  const minutes = end > start ? Math.min(MAX_EVENT_MIN, Math.round((end - start) / 60000)) : null
  return { date: ymd(new Date(start)), done: Math.max(start, end) <= now, category_id, minutes }
}
