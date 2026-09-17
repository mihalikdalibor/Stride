import type { CalendarEvent, Category, Note, NoteFolder, Task } from '@/types'
import { parseYmd, today, weekdayIndex } from '@/lib/dates'

// Demo mode lets the app render realistic data during `npm run dev` without a
// Google login. Production builds (`npm run build`) use real Supabase data.
// Set VITE_DEMO=false to use live data in dev.
//
// The data here is *curated* (not random) so the app looks its best for
// marketing screenshots: a clean, intentional current week for Home/hero, plus
// a tuned history so Calendar shows nice status dots and Stats shows a strong
// streak + high completion. Titles/categories are English to match the landing
// — switch the app language to English before taking screenshots.
export const isDemo =
  (import.meta.env.DEV && import.meta.env.VITE_DEMO !== 'false') ||
  localStorage.getItem('stride-demo') === 'true'

export function activateDemo() {
  localStorage.setItem('stride-demo', 'true')
  window.location.href = '/'
}

export function exitDemo() {
  localStorage.removeItem('stride-demo')
  window.location.href = '/?auth=1'
}

export const DEMO_CATEGORIES: Category[] = [
  { id: 'demo-cat-1', name: 'Work', color: '#007aff', position: 0 },
  { id: 'demo-cat-2', name: 'Study', color: '#af52de', position: 1 },
  { id: 'demo-cat-3', name: 'Fitness', color: '#34c759', position: 2 },
  { id: 'demo-cat-4', name: 'Personal', color: '#ff9500', position: 3 },
]
const CAT = DEMO_CATEGORIES.map(c => c.id)

type Plan = { title: string; cat?: number; time?: string; dur?: number; priority?: boolean; repeat?: Task['repeat']; note?: string }

// Hand-crafted current week (index 0 = Monday … 6 = Sunday). Tuned to give a
// productive-but-believable week: a couple of timed blocks per day, a few
// categories, one or two flags, a daily-repeating standup.
const WEEK_PLAN: Plan[][] = [
  // Monday
  [
    { title: 'Plan the week', cat: 3, time: '08:30', dur: 30, priority: true },
    { title: 'Team standup', cat: 0, time: '09:30', dur: 15, repeat: 'daily' },
    { title: 'Gym — push day', cat: 2, time: '18:00', dur: 60 },
  ],
  // Tuesday
  [
    { title: 'Team standup', cat: 0, time: '09:30', dur: 15, repeat: 'daily' },
    { title: 'Review pull requests', cat: 0, time: '10:30', dur: 45 },
    { title: 'Evening walk', cat: 3, time: '19:00', dur: 30 },
  ],
  // Wednesday
  [
    { title: 'Morning run', cat: 2, time: '07:00', dur: 30 },
    { title: 'Deep work block', cat: 0, time: '09:00', dur: 120, priority: true },
    { title: 'Call mom', cat: 3, time: '20:00' },
  ],
  // Thursday
  [
    { title: 'Team standup', cat: 0, time: '09:30', dur: 15, repeat: 'daily' },
    { title: 'Design review', cat: 0, time: '13:00', dur: 60 },
    { title: 'Yoga session', cat: 2, time: '18:30', dur: 45 },
  ],
  // Friday
  [
    { title: 'Finish slides', cat: 0, time: '10:00', dur: 90, priority: true },
    { title: 'Gym — pull day', cat: 2, time: '18:30', dur: 60 },
  ],
  // Saturday
  [
    { title: 'Long run', cat: 2, time: '09:00', dur: 75 },
    { title: 'Meal prep', cat: 3, time: '11:30', dur: 60 },
    { title: 'Night out', cat: 3, time: '22:00', dur: 240 },
  ],
  // Sunday
  [
    { title: 'Plan next week', cat: 3, time: '19:00', dur: 30 },
    { title: 'Stretch & mobility', cat: 2 },
  ],
]

// Pool used for other (past/future) weeks — keeps Calendar/Stats looking varied.
const POOL: { title: string; cat: number }[] = [
  { title: 'Team standup', cat: 0 },
  { title: 'Review pull requests', cat: 0 },
  { title: 'Deep work block', cat: 0 },
  { title: 'Answer emails', cat: 0 },
  { title: 'Design review', cat: 0 },
  { title: 'Write thesis intro', cat: 1 },
  { title: 'Read 20 pages', cat: 1 },
  { title: 'Research sources', cat: 1 },
  { title: 'Gym — push day', cat: 2 },
  { title: 'Morning run', cat: 2 },
  { title: 'Yoga session', cat: 2 },
  { title: 'Long run', cat: 2 },
  { title: 'Grocery shopping', cat: 3 },
  { title: 'Meal prep', cat: 3 },
  { title: 'Call mom', cat: 3 },
  { title: 'Evening walk', cat: 3 },
  { title: 'Plan the week', cat: 3 },
]

// Deterministic hash so the same date always yields the same tasks.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0)
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monday (ISO week start) for a given date string.
function mondayOf(dateStr: string): string {
  const d = parseYmd(dateStr)
  d.setDate(d.getDate() - weekdayIndex(dateStr))
  return ymd(d)
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000)
}

function makeTask(dateStr: string, i: number, p: Plan, status: Task['status']): Task {
  return {
    id: `demo-${dateStr}-${i}`,
    title: p.title,
    task_date: dateStr,
    task_time: p.time ?? null,
    duration_min: p.dur ?? null,
    priority: p.priority ?? false,
    repeat: p.repeat ?? 'none',
    status,
    category_id: p.cat != null ? CAT[p.cat] : null,
    note: p.note ?? null,
    position: i,
    created_at: dateStr + 'T08:00:00.000Z',
    completed_at: status === 'done' ? dateStr + 'T18:00:00.000Z' : null,
  }
}

// Curated current week: past days fully done, today ~60% done, future planned.
function currentWeekTasks(dateStr: string, todayStr: string): Task[] {
  const plans = WEEK_PLAN[weekdayIndex(dateStr)]
  if (!plans?.length) return []
  const doneToday = Math.ceil(plans.length * 0.6)
  return plans.map((p, i) => {
    let status: Task['status'] = 'todo'
    if (dateStr < todayStr) status = 'done'
    else if (dateStr === todayStr) status = i < doneToday ? 'done' : 'todo'
    return makeTask(dateStr, i, p, status)
  })
}

// Other weeks: deterministic, mostly-done past (strong streak), the odd older
// "missed" day for Calendar colour, planned future.
function otherWeekTasks(dateStr: string, todayStr: string): Task[] {
  const h = hash(dateStr)
  const wd = weekdayIndex(dateStr)
  let count = wd === 6 ? 1 : 1 + (h % 2) // Sun 1, else 1–2
  if (wd < 5 && (h >> 4) % 9 === 0) return [] // a few empty weekdays for variety
  if (count === 0) return []

  const isPast = dateStr < todayStr
  const agoDays = daysBetween(dateStr, todayStr)
  // Older-than-2-weeks days occasionally leave one task unfinished ("missed").
  const missed = isPast && agoDays > 14 && (h % 6 === 0)

  const out: Task[] = []
  for (let i = 0; i < count; i++) {
    const hi = hash(dateStr + ':' + i)
    const pick = POOL[(hi >>> 2) % POOL.length]
    const th = hash(dateStr + ':t:' + i)
    const time = th % 3 === 0 ? `${String(8 + (th >> 3) % 12).padStart(2, '0')}:${(th >> 6) % 2 ? '30' : '00'}` : undefined
    const dur = time && th % 2 === 0 ? [30, 45, 60, 90][(th >> 8) % 4] : undefined
    let status: Task['status'] = 'todo'
    if (isPast) status = missed && i === count - 1 ? 'todo' : 'done'
    out.push(makeTask(dateStr, i, { title: pick.title, cat: pick.cat, time, dur }, status))
  }
  return out
}

function tasksForDate(dateStr: string, todayStr: string, currentMonday: string): Task[] {
  return mondayOf(dateStr) === currentMonday
    ? currentWeekTasks(dateStr, todayStr)
    : otherWeekTasks(dateStr, todayStr)
}

export function demoTasksForRange(from: string, to: string): Task[] {
  const todayStr = today()
  const currentMonday = mondayOf(todayStr)
  const cutoff = ymd(new Date(parseYmd(todayStr).getFullYear() - 1, parseYmd(todayStr).getMonth(), parseYmd(todayStr).getDate()))
  const clampedFrom = from < cutoff ? cutoff : from
  const out: Task[] = []
  const end = parseYmd(to)
  for (let d = parseYmd(clampedFrom); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(...tasksForDate(ymd(d), todayStr, currentMonday))
  }
  return out
}

// Events for a calendar connected in demo mode (no network): a Mon–Fri 08:00–16:00
// shift titled after the feed, so "Connect calendar" can be tried out.
export function demoEventsForRange(feedId: string, title: string, from: string, to: string): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const end = parseYmd(to)
  for (let d = parseYmd(from); d <= end; d.setDate(d.getDate() + 1)) {
    const date = ymd(d)
    if (weekdayIndex(date) > 4) continue
    const at = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).toISOString()
    out.push({
      id: `${feedId}-${date}`, feed_id: feedId, uid: date, title, location: null,
      starts_at: at(8), ends_at: at(16), all_day: false, hidden: false,
    })
  }
  return out
}

export const DEMO_NOTE_FOLDERS: NoteFolder[] = [
  { id: 'demo-folder-1', name: 'Work', position: 0, created_at: new Date().toISOString() },
  { id: 'demo-folder-2', name: 'Personal', position: 1, created_at: new Date().toISOString() },
]

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export const DEMO_NOTES: Note[] = [
  {
    id: 'demo-note-1', title: 'Project kickoff notes', pinned: true, folder_id: 'demo-folder-1',
    body: 'Attendees: Alex, Priya, Sam.\n\n- Scope: v1 covers web only, mobile later\n- Deadline target: end of quarter\n- Next sync Thursday 10am',
    position: 0, created_at: daysAgo(6), updated_at: daysAgo(0),
  },
  {
    id: 'demo-note-2', title: 'Grocery list', pinned: false, folder_id: 'demo-folder-2',
    body: 'Oat milk\nEggs\nSpinach\nCoffee beans\nOlive oil',
    position: 0, created_at: daysAgo(3), updated_at: daysAgo(1),
  },
  {
    id: 'demo-note-3', title: 'Book recommendations', pinned: false, folder_id: 'demo-folder-2',
    body: 'Deep Work — Cal Newport\nThe Pragmatic Programmer\nAtomic Habits',
    position: 0, created_at: daysAgo(20), updated_at: daysAgo(5),
  },
  {
    id: 'demo-note-4', title: 'Standup talking points', pinned: false, folder_id: 'demo-folder-1',
    body: 'Yesterday: finished the API integration\nToday: start on the settings screen\nBlockers: none',
    position: 0, created_at: daysAgo(1), updated_at: daysAgo(1),
  },
  {
    id: 'demo-note-5', title: 'Trip ideas', pinned: false, folder_id: null,
    body: 'Somewhere with good hiking, not too far, long weekend works best.',
    position: 0, created_at: daysAgo(45), updated_at: daysAgo(30),
  },
]
