import { addDays, parseYmd, ymd } from '@/lib/dates'
import { minToHHMM } from '@/lib/time'
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

// the same days as `eventOnDay`, as a list — for indexing events by day
export function eventDays(ev: CalendarEvent): string[] {
  if (!ev.all_day) return [ymd(new Date(ev.starts_at))]
  const start = ev.starts_at.slice(0, 10)
  let end = ev.ends_at.slice(0, 10)
  if (end <= start) end = addDays(start, 1)
  const days: string[] = []
  // capped: a corrupt feed row must not spin the loop for centuries
  for (let d = start; d < end && days.length < 366; d = addDays(d, 1)) days.push(d)
  return days
}

// local start 'HH:MM' (null for all-day) — used to order events among timed tasks
export function eventStart(ev: CalendarEvent): string | null {
  return ev.all_day ? null : hhmm(new Date(ev.starts_at))
}

// "08:00–16:00" (or just "08:00" for zero-length events); an end on a later
// local day gets a "+1" suffix ("22:00–06:00 +1"); '' for all-day
export function eventTimeLabel(ev: CalendarEvent): string {
  if (ev.all_day) return ''
  const startDate = new Date(ev.starts_at)
  const endDate = new Date(ev.ends_at)
  const start = hhmm(startDate)
  if (ev.ends_at <= ev.starts_at) return start
  const suffix = ymd(endDate) > ymd(startDate) ? ' +1' : ''
  return `${start}–${hhmm(endDate)}${suffix}`
}

// manually added event (not synced from a feed) — editable like a task
export const isManual = (ev: CalendarEvent) => ev.feed_id === null

// local day + 'HH:MM' start + duration → the stored timestamps. No time = an
// all-day event: the date at 00:00Z with an exclusive end on the next day.
export function eventTimes(date: string, time: string | null, duration: number | null) {
  if (!time) {
    return { starts_at: `${date}T00:00:00.000Z`, ends_at: `${addDays(date, 1)}T00:00:00.000Z`, all_day: true }
  }
  const d = parseYmd(date)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(time.slice(0, 2)), Number(time.slice(3, 5)))
  const end = new Date(start.getTime() + (duration ?? 0) * 60000)
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: false }
}

// the inverse: timestamps → the form's day/start/duration
export function eventFormFields(ev: CalendarEvent): { date: string; task_time: string | null; duration_min: number | null } {
  if (ev.all_day) return { date: ev.starts_at.slice(0, 10), task_time: null, duration_min: null }
  const start = new Date(ev.starts_at)
  const minutes = Math.round((Date.parse(ev.ends_at) - start.getTime()) / 60000)
  return {
    date: ymd(start),
    task_time: minToHHMM(start.getHours() * 60 + start.getMinutes()),
    duration_min: minutes > 0 ? minutes : null,
  }
}
