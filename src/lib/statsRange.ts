// Stats period helpers + the Stats screen's session state (kept at module
// level so it survives switching tabs, but not a reload).
import { ref } from 'vue'
import { addDays, getMonday, parseYmd, today, ymd } from '@/lib/dates'

export type StatsPeriod = 'week' | 'month' | 'year' | 'custom'
export type Granularity = 'day' | 'week' | 'month'
export type Range = { from: string; to: string }

export const statsPeriod = ref<StatsPeriod>('week')
export const customRange = ref<Range>({ from: addDays(today(), -29), to: today() })
export const statsSelectedCats = ref<Set<string>>(new Set()) // empty = all categories

export const MAX_RANGE_YEARS = 3

// same calendar day `years` later/earlier ('YYYY-MM-DD')
function shiftYears(date: string, years: number) {
  const d = parseYmd(date)
  return ymd(new Date(d.getFullYear() + years, d.getMonth(), d.getDate()))
}

// what the date inputs allow: 5 years back, 2 years ahead
export function rangeBounds(): Range {
  return { from: shiftYears(today(), -5), to: shiftYears(today(), 2) }
}

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseYmd(s).getTime())

// A valid custom range: swapped when from > to, kept inside `rangeBounds`, and
// at most MAX_RANGE_YEARS long (the start moves up). null for empty/invalid input.
export function normalizeRange(from: string, to: string): Range | null {
  if (!isYmd(from) || !isYmd(to)) return null
  if (from > to) [from, to] = [to, from]
  const b = rangeBounds()
  if (from < b.from) from = b.from
  if (to > b.to) to = b.to
  if (from > to) return null
  const earliest = addDays(shiftYears(to, -MAX_RANGE_YEARS), 1)
  if (from < earliest) from = earliest
  return { from, to }
}

// inclusive number of days in a range
export function rangeDays(from: string, to: string) {
  return Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 86_400_000) + 1
}

// how a custom range's chart is bucketed
export function granularity(from: string, to: string): Granularity {
  const n = rangeDays(from, to)
  return n <= 31 ? 'day' : n <= 182 ? 'week' : 'month'
}

// consecutive buckets covering [from, to]; weeks are Monday-start and months
// calendar months, the first and last clipped to the range
export function rangeBuckets(from: string, to: string, gran: Granularity): Range[] {
  const out: Range[] = []
  let start = from
  while (start <= to) {
    let end: string
    if (gran === 'day') end = start
    else if (gran === 'week') end = addDays(getMonday(start), 6)
    else {
      const d = parseYmd(start)
      end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    }
    if (end > to) end = to
    out.push({ from: start, to: end })
    start = addDays(end, 1)
  }
  return out
}
