// iCalendar (.ics) → flat list of event occurrences inside a time window.
// Recurring events (RRULE/RDATE/EXDATE + moved/cancelled exceptions) are
// expanded here, so the client only ever sees concrete occurrences.

import ICAL from 'npm:ical.js@2.2.1'

export interface ParsedEvent {
  uid: string            // stable per occurrence: `${UID}` or `${UID}|${RECURRENCE-ID}`
  title: string
  location: string | null
  starts_at: string      // ISO; all-day → 'YYYY-MM-DDT00:00:00Z' (date only, no zone)
  ends_at: string        // ISO; all-day → exclusive end date at 00:00Z
  all_day: boolean
}

export interface ParsedCalendar {
  name: string | null
  events: ParsedEvent[]
}

const MAX_ITERATIONS = 20000 // per recurring series (guards against runaway RRULEs)

// deno-lint-ignore no-explicit-any
type IcalTime = any

const dtf = new Map<string, Intl.DateTimeFormat>()
function isZone(tz: string | undefined): tz is string {
  if (!tz) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}
// wall-clock time in an IANA zone → UTC ISO (two passes settle DST edges)
function zonedToIso(t: IcalTime, tz: string): string {
  let f = dtf.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    dtf.set(tz, f)
  }
  const offset = (ms: number) => {
    const p = Object.fromEntries(f!.formatToParts(new Date(ms)).map(x => [x.type, Number(x.value)]))
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms
  }
  const wall = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  let ms = wall - offset(wall)
  ms = wall - offset(ms)
  return new Date(ms).toISOString()
}

function toIso(t: IcalTime, tzHint: string): string {
  // all-day: keep the calendar date, independent of any timezone
  if (t.isDate) return `${t.toString()}T00:00:00Z`
  if (t.zone && t.zone.tzid !== 'floating') return t.toJSDate().toISOString()
  // floating or TZID without a VTIMEZONE block: use the TZID if it's a known
  // IANA zone, else the user's own zone
  return zonedToIso(t, isZone(t.timezone) ? t.timezone : tzHint)
}

export function parseIcs(text: string, windowStart: Date, windowEnd: Date, tzHint = 'UTC'): ParsedCalendar {
  if (!isZone(tzHint)) tzHint = 'UTC'
  const root = new ICAL.Component(ICAL.parse(text))
  const name = (root.getFirstPropertyValue('x-wr-calname') as string | null) ?? null

  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz) } catch { /* ignore malformed zones */ }
  }

  const from = ICAL.Time.fromJSDate(windowStart, true)
  const to = ICAL.Time.fromJSDate(windowEnd, true)

  const masters = new Map<string, InstanceType<typeof ICAL.Event>>()
  const exceptions: InstanceType<typeof ICAL.Event>[] = []
  for (const v of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(v)
    if (!ev.uid || !ev.startDate) continue
    if (ev.isRecurrenceException()) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid)
    if (master) master.relateException(ex)
    else masters.set(`${ex.uid}|${ex.recurrenceId.toString()}`, ex) // orphan exception = standalone event
  }

  const out: ParsedEvent[] = []
  const push = (key: string, item: InstanceType<typeof ICAL.Event>, start: IcalTime, end: IcalTime | null) => {
    if (item.component.getFirstPropertyValue('status')?.toString().toUpperCase() === 'CANCELLED') return
    let endT = end
    if (!endT || endT.compare(start) < 0) {
      endT = start.clone()
      if (start.isDate) endT.day += 1 // all-day without DTEND lasts one day
    }
    if (endT.compare(from) < 0 || start.compare(to) > 0) return
    out.push({
      uid: key,
      title: (item.summary || '').trim() || '—',
      location: (item.location || '').trim() || null,
      starts_at: toIso(start, tzHint),
      ends_at: toIso(endT, tzHint),
      all_day: !!start.isDate,
    })
  }

  for (const [key, ev] of masters) {
    if (!ev.isRecurring()) {
      push(key, ev, ev.startDate, ev.endDate)
      continue
    }
    const it = ev.iterator()
    for (let i = 0, next = it.next(); next && i < MAX_ITERATIONS; i++, next = it.next()) {
      if (next.compare(to) > 0) break
      const d = ev.getOccurrenceDetails(next)
      push(`${ev.uid}|${d.recurrenceId.toString()}`, d.item, d.startDate, d.endDate)
    }
  }

  return { name, events: out }
}
