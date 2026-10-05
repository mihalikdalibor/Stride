import { useI18n } from 'vue-i18n'
import { addDays, parseYmd } from '@/lib/dates'

// Build Monday-first weekday labels from any locale (2024-01-01 was a Monday).
function mondayFirst<T>(fn: (d: Date) => T): T[] {
  return Array.from({ length: 7 }, (_, i) => fn(new Date(2024, 0, 1 + i)))
}

/** Locale-aware date formatters (via Intl), reactive to the current language. */
export function useFmt() {
  const { locale } = useI18n()
  const loc = () => locale.value
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const dayName = (ds: string) =>
    cap(new Intl.DateTimeFormat(loc(), { weekday: 'long' }).format(parseYmd(ds)))
  const monthName = (m: number) =>
    cap(new Intl.DateTimeFormat(loc(), { month: 'long' }).format(new Date(2020, m, 1)))
  const monthShort = (m: number) =>
    new Intl.DateTimeFormat(loc(), { month: 'short' }).format(new Date(2020, m, 1))
  const dayMonthLabel = (ds: string) =>
    new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(parseYmd(ds))
  const fullDate = (ds: string) =>
    new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(parseYmd(ds))
  function weekRange(monday: string) {
    const a = parseYmd(monday)
    const b = parseYmd(addDays(monday, 6))
    const f = new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' })
    return `${f.format(a)} – ${f.format(b)} ${b.getFullYear()}`
  }
  // "1. 9. – 23. 9." (a custom Stats period); the years show when either end
  // isn't in the current year
  function dateRange(from: string, to: string) {
    const a = parseYmd(from)
    const b = parseYmd(to)
    const thisYear = new Date().getFullYear()
    const withYear = a.getFullYear() !== thisYear || b.getFullYear() !== thisYear
    const f = new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    return from === to ? f.format(a) : `${f.format(a)} – ${f.format(b)}`
  }
  const dayLetters = () =>
    mondayFirst(d => new Intl.DateTimeFormat(loc(), { weekday: 'narrow' }).format(d).toUpperCase())
  const weekdayShort = () =>
    mondayFirst(d => new Intl.DateTimeFormat(loc(), { weekday: 'short' }).format(d))

  return { locale, dayName, monthName, monthShort, dayMonthLabel, fullDate, weekRange, dateRange, dayLetters, weekdayShort }
}
