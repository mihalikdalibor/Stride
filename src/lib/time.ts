// Time-of-day helpers shared by the item form and the day rows. Times are
// local 'HH:MM' strings; a duration is minutes after the start, so an end
// earlier than the start means the item ends the next day (see CLAUDE.md).

export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
export const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export const DAY_MIN = 24 * 60

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** minutes → 'HH:MM', wrapping past midnight: 27:00 → 03:00 */
export const minToHHMM = (m: number) => {
  const wrapped = m % DAY_MIN
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/** 'HH'+'MM' selects → 'HH:MM' or null when no hour is picked */
export const composeTime = (hour: string, min: string) => (hour ? `${hour}:${min || '00'}` : null)

/** minutes between start and end; an end before the start means it ends the
 *  next day (+24h); equal times → null (no end) */
export function durFrom(start: string | null, endH: string, endM: string): number | null {
  if (!start || !endH) return null
  const diff = toMin(`${endH}:${endM || '00'}`) - toMin(start)
  if (diff === 0) return null
  return diff > 0 ? diff : diff + DAY_MIN
}

/** form hint: the picked end is before the start → show "+1" next to "To" */
export const endsNextDay = (hour: string, min: string, endH: string, endM: string) =>
  !!hour && !!endH && toMin(`${endH}:${endM || '00'}`) < toMin(`${hour}:${min || '00'}`)

/** "14:00–15:30" from a start + duration; an end past midnight gets "+1" */
export function rangeLabel(start: string | null, duration: number | null): string {
  if (!start) return ''
  const from = start.slice(0, 5)
  if (!duration) return from
  const endMin = toMin(from) + duration
  return `${from}–${minToHHMM(endMin)}${endMin >= DAY_MIN ? ' +1' : ''}`
}
