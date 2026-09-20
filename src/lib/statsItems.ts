import { ymd } from '@/lib/dates'
import type { CalendarEvent, Task } from '@/types'

// Common shape Stats aggregates over, so tasks and events combine per
// category/day. An event counts as done once it has ended and as planned
// before that; all-day events (holidays, vacation) are skipped.
export interface StatItem {
  date: string              // 'YYYY-MM-DD' local
  done: boolean
  category_id: string | null
  minutes: number | null    // duration, null = unknown (hours mode skips it)
  streak: boolean           // counts toward the streak (events never do)
}

const MAX_EVENT_MIN = 24 * 60

// `streak`: fixed obligations don't measure discipline, so a category can be
// excluded from the streak (Home → categories) and events never count.
export function taskToItem(t: Task, streak = true): StatItem {
  return { date: t.task_date, done: t.status === 'done', category_id: t.category_id, minutes: t.duration_min, streak }
}

export function eventToItem(ev: CalendarEvent, category_id: string | null, now: number): StatItem | null {
  if (ev.all_day) return null
  const start = Date.parse(ev.starts_at)
  const end = Date.parse(ev.ends_at)
  const minutes = end > start ? Math.min(MAX_EVENT_MIN, Math.round((end - start) / 60000)) : null
  return { date: ymd(new Date(start)), done: Math.max(start, end) <= now, category_id, minutes, streak: false }
}
