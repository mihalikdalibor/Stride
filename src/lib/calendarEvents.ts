import { addDays, ymd } from '@/lib/dates'
import type { CalendarEvent } from '@/types'

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// Local days an event covers: timed → its (local) start day only; all-day →
// every date in [start, end) (all-day dates carry no timezone).
export function eventOnDay(ev: CalendarEvent, date: string): boolean {
  if (!ev.all_day) return ymd(new Date(ev.starts_at)) === date
  const start = ev.starts_at.slice(0, 10)
  let end = ev.ends_at.slice(0, 10)
  if (end <= start) end = addDays(start, 1)
  return date >= start && date < end
}

// local start 'HH:MM' (null for all-day) — used to order events among timed tasks
export function eventStart(ev: CalendarEvent): string | null {
  return ev.all_day ? null : hhmm(new Date(ev.starts_at))
}

// "08:00–16:00" (or just "08:00" for zero-length events); '' for all-day
export function eventTimeLabel(ev: CalendarEvent): string {
  if (ev.all_day) return ''
  const start = hhmm(new Date(ev.starts_at))
  const end = hhmm(new Date(ev.ends_at))
  return ev.ends_at > ev.starts_at ? `${start}–${end}` : start
}
