// Streak over days: a day counts when everything judged on it is done, a day
// with something left undone breaks it, a day with nothing to judge is skipped.
// Only items with `streak: true` are judged — events and tasks from a category
// excluded from the streak (Home → categories) leave the day empty, because
// fixed obligations say nothing about discipline.

import { addDays } from '@/lib/dates'
import type { StatItem } from '@/lib/statsItems'

export type DayState = 'done' | 'missed' | 'none'

export function streakTotals(items: StatItem[]): Map<string, { total: number; done: number }> {
  const m = new Map<string, { total: number; done: number }>()
  for (const i of items) {
    if (!i.streak) continue
    const d = m.get(i.date) ?? { total: 0, done: 0 }
    d.total++
    if (i.done) d.done++
    m.set(i.date, d)
  }
  return m
}

export function dayState(totals: Map<string, { total: number; done: number }>, date: string): DayState {
  const d = totals.get(date)
  if (!d) return 'none'
  return d.done === d.total ? 'done' : 'missed'
}

/** Days in a row up to today; today still in progress doesn't break it. */
export function currentStreak(items: StatItem[], todayStr: string): number {
  const totals = streakTotals(items)
  let streak = 0
  let cursor = todayStr
  if (dayState(totals, cursor) !== 'done') cursor = addDays(cursor, -1)
  for (let i = 0; i < 400; i++) {
    const s = dayState(totals, cursor)
    if (s === 'done') streak++
    else if (s === 'missed') break
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Best run from the first tracked day up to today. */
export function longestStreak(items: StatItem[], todayStr: string): number {
  const totals = streakTotals(items)
  const dates = [...totals.keys()].sort()
  if (!dates.length) return 0
  let best = 0, run = 0
  let cursor = dates[0]
  while (cursor <= todayStr) {
    const s = dayState(totals, cursor)
    if (s === 'done') { run++; best = Math.max(best, run) }
    else if (s === 'missed') run = 0
    cursor = addDays(cursor, 1)
  }
  return best
}
