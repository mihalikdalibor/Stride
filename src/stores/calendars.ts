import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { demoEventsForRange, isDemo } from '@/lib/demo'
import { addDays, parseYmd, ymd } from '@/lib/dates'
import { eventTimes } from '@/lib/calendarEvents'
import type { CalendarEvent, CalendarFeed } from '@/types'

// Connected iCal feeds + their events, plus the manually added events
// (`feed_id === null`), which are ordinary editable rows in the same table.
// Fetching/parsing a feed happens in the `calendar-sync` Edge Function; for
// feed events this store only writes feed settings and the `hidden` flag.

const STALE_MS = 30 * 60 * 1000
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// error code returned by the function ('invalid_url', 'fetch_failed', 'not_ical', 'too_large', …)
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('calendar-sync', { body: { ...body, tz: tz() } })
  if (error) {
    let code = 'server_error'
    try { code = (await (error as { context: Response }).context.json()).error ?? code } catch { /* not a JSON response */ }
    throw new Error(code)
  }
  return data as T
}

export const useCalendarsStore = defineStore('calendars', () => {
  const feeds = ref<CalendarFeed[]>([])
  const events = ref<CalendarEvent[]>([]) // visible (non-hidden) events for the loaded range
  const statsEvents = ref<CalendarEvent[]>([]) // long range for Stats; separate so Home's week isn't replaced
  const gridEvents = ref<CalendarEvent[]>([]) // long range for the Calendar grid dots; separate for the same reason
  const syncing = ref<Set<string>>(new Set())
  let range: { from: string; to: string } | null = null
  let statsRange: { from: string; to: string } | null = null
  let gridRange: { from: string; to: string } | null = null
  let initialized = false
  let feedsLoad: Promise<void> | null = null
  const demoHidden = new Set<string>()
  const demoManual = ref<CalendarEvent[]>([]) // manually added events in demo mode

  // the long-range copies kept beside `events` (Stats + the Calendar grid); a
  // local fixup has to touch each of them, so they're patched as one list
  const longLists = [statsEvents, gridEvents]

  const feedById = computed(() => new Map(feeds.value.map(f => [f.id, f])))

  // every event object currently in memory (loaded range, Stats range, demo);
  // the same row can appear as separate objects, so fixups touch all copies
  const allLoadedEvents = computed(() =>
    [...events.value, ...statsEvents.value, ...gridEvents.value, ...demoManual.value])

  // a manual event carries its own category; a feed event inherits the feed's
  function categoryOf(ev: CalendarEvent): string | null {
    if (ev.category_id) return ev.category_id
    return (ev.feed_id ? feedById.value.get(ev.feed_id)?.category_id : null) ?? null
  }

  // shared first load, so a view opened while init() is still running awaits the same feeds
  function loadFeeds(): Promise<void> {
    feedsLoad ??= fetchFeeds().catch(e => { feedsLoad = null; throw e })
    return feedsLoad
  }

  async function fetchFeeds() {
    if (isDemo) return
    const { data, error } = await supabase
      .from('calendar_feeds').select('*').order('created_at', { ascending: true })
    if (error) throw error
    feeds.value = data ?? []
  }

  // the occurrence's local day (what "this and following" compares against)
  const dayOf = (e: CalendarEvent) => (e.all_day ? e.starts_at.slice(0, 10) : ymd(new Date(e.starts_at)))

  // demo mode: generated feed events + the manual ones added this session
  function demoRange(from: string, to: string): CalendarEvent[] {
    return [
      ...feeds.value.flatMap(f => demoEventsForRange(f.id, f.name, from, to)),
      ...demoManual.value.filter(e => dayOf(e) >= from && dayOf(e) <= to),
    ].filter(e => !demoHidden.has(e.id))
  }

  async function fetchRange(from: string, to: string) {
    range = { from, to }
    if (isDemo) {
      events.value = demoRange(from, to)
      return
    }
    // ±1–2 day margin covers any timezone; DayList narrows to exact local days
    const { data, error } = await supabase
      .from('calendar_events').select('*')
      .eq('hidden', false)
      .lt('starts_at', `${addDays(to, 2)}T00:00:00Z`)
      .gt('ends_at', `${addDays(from, -1)}T00:00:00Z`)
      .order('starts_at', { ascending: true })
    if (error) throw error
    events.value = data ?? []
  }

  // a long range (a year or more): paged, since PostgREST caps a response at 1000 rows
  async function fetchPaged(from: string, to: string): Promise<CalendarEvent[]> {
    const PAGE = 1000
    const out: CalendarEvent[] = []
    for (let i = 0; ; i += PAGE) {
      const { data, error } = await supabase
        .from('calendar_events').select('*')
        .eq('hidden', false)
        // overlap, not just start: a multi-day all-day event beginning before
        // the span still colors its days inside it (same predicate as fetchRange)
        .lt('starts_at', `${addDays(to, 2)}T00:00:00Z`)
        .gt('ends_at', `${addDays(from, -1)}T00:00:00Z`)
        .order('starts_at', { ascending: true })
        .order('id', { ascending: true })
        .range(i, i + PAGE - 1)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    return out
  }

  // Stats range (e.g. a year)
  async function fetchStatsRange(from: string, to: string) {
    statsRange = { from, to }
    statsEvents.value = isDemo ? demoRange(from, to) : await fetchPaged(from, to)
  }

  // the Calendar grid's cumulative span — feeds the day dots' category colors.
  // Scrolling fires this repeatedly and a paged fetch takes several round trips,
  // so a superseded call must not overwrite a wider result that landed first.
  async function fetchGridRange(from: string, to: string) {
    const mine = { from, to }
    gridRange = mine
    const rows = isDemo ? demoRange(from, to) : await fetchPaged(from, to)
    if (gridRange !== mine) return
    gridEvents.value = rows
  }

  const refetch = () => (range ? fetchRange(range.from, range.to) : Promise.resolve())

  // validate a URL before connecting: feed name (if it has one) + event count
  async function preview(url: string): Promise<{ name: string | null; count: number }> {
    if (isDemo) return { name: null, count: 42 }
    return invoke({ action: 'preview', url })
  }

  // download the feed again; returns the error code on failure (also stored on the feed)
  async function sync(feed: CalendarFeed, reload = true): Promise<string | null> {
    if (isDemo) return null
    syncing.value = new Set(syncing.value).add(feed.id)
    try {
      const res = await invoke<{ last_synced_at: string }>({ action: 'sync', feed_id: feed.id })
      feed.last_synced_at = res.last_synced_at
      feed.last_error = null
      if (reload) await refetch()
      return null
    } catch (e) {
      feed.last_error = (e as Error).message
      return feed.last_error
    } finally {
      const s = new Set(syncing.value)
      s.delete(feed.id)
      syncing.value = s
    }
  }

  async function connect(url: string, name: string, category_id: string | null): Promise<string | null> {
    if (isDemo) {
      feeds.value.push({
        id: `demo-feed-${crypto.randomUUID()}`, name, url, category_id,
        last_synced_at: new Date().toISOString(), last_error: null, created_at: new Date().toISOString(),
      })
      await refetch()
      return null
    }
    const { data, error } = await supabase
      .from('calendar_feeds').insert({ name, url: url.trim(), category_id }).select().single()
    if (error) throw error
    feeds.value.push(data)
    return sync(feeds.value[feeds.value.length - 1])
  }

  // once per session: load feeds, re-sync the stale ones in the background
  async function init() {
    if (initialized) return
    initialized = true
    try {
      await loadFeeds()
      await refetch()
      const stale = feeds.value.filter(f => !f.last_synced_at || Date.now() - Date.parse(f.last_synced_at) > STALE_MS)
      if (!stale.length) return
      for (const f of stale) await sync(f, false)
      await refetch()
      if (statsRange) await fetchStatsRange(statsRange.from, statsRange.to)
      if (gridRange) await fetchGridRange(gridRange.from, gridRange.to)
    } catch (e) {
      console.error('calendars init failed', e) // e.g. migration not run yet — tasks keep working
    }
  }

  // --- manually added events (feed_id null): full CRUD, like tasks ---

  // the item form's fields, shared by every occurrence created in one go
  type NewEvent = {
    title: string
    note: string | null
    category_id: string | null
    task_time: string | null
    duration_min: number | null
  }

  const inRange = (date: string) => !range || (date >= range.from && date <= range.to)
  const inStatsRange = (date: string) =>
    !!statsRange && date >= statsRange.from && date <= statsRange.to
  const inGridRange = (date: string) =>
    !!gridRange && date >= gridRange.from && date <= gridRange.to
  // the long-range list(s) a given day belongs to
  const longListsFor = (date: string) =>
    [...(inStatsRange(date) ? [statsEvents] : []), ...(inGridRange(date) ? [gridEvents] : [])]

  function eventRow(fields: NewEvent, date: string, series_id: string | null) {
    return {
      uid: crypto.randomUUID(),
      feed_id: null,
      title: fields.title,
      location: null,
      note: fields.note,
      category_id: fields.category_id,
      series_id,
      ...eventTimes(date, fields.task_time, fields.duration_min),
    }
  }

  /** Create the event on each of `dates`; `series_id` groups a repeat rule. */
  async function addEvents(fields: NewEvent, dates: string[], series_id: string | null = null): Promise<CalendarEvent[]> {
    if (!dates.length) return []
    const rows = dates.map(d => eventRow(fields, d, series_id))
    if (isDemo) {
      const made = rows.map(r => ({ ...r, id: `demo-ev-${crypto.randomUUID()}`, hidden: false }) as CalendarEvent)
      made.forEach(ev => {
        demoManual.value.push(ev)
        if (inRange(dayOf(ev))) events.value.push(ev)
        for (const l of longListsFor(dayOf(ev))) l.value.push(ev)
      })
      return made
    }
    const { data, error } = await supabase.from('calendar_events').insert(rows).select()
    if (error) throw error
    for (const row of data ?? []) {
      if (inRange(dayOf(row))) events.value.push(row)
      for (const l of longListsFor(dayOf(row))) l.value.push(row)
    }
    return data ?? []
  }

  /** Update one manual event (its day may change). */
  async function updateEvent(ev: CalendarEvent, fields: NewEvent, date: string) {
    const updates = {
      title: fields.title, note: fields.note, category_id: fields.category_id,
      ...eventTimes(date, fields.task_time, fields.duration_min),
    }
    if (!isDemo) {
      const { error } = await supabase.from('calendar_events').update(updates).eq('id', ev.id)
      if (error) throw error
    }
    for (const list of [events, ...longLists, demoManual]) {
      const row = list.value.find(e => e.id === ev.id)
      if (row) Object.assign(row, updates)
    }
    // moved out of a loaded range → drop it from that list
    const moved = { ...ev, ...updates }
    const newDay = dayOf(moved)
    if (!inRange(newDay)) events.value = events.value.filter(e => e.id !== ev.id)
    for (const [list, inside] of [[statsEvents, inStatsRange(newDay)], [gridEvents, inGridRange(newDay)]] as const) {
      if (!inside) list.value = list.value.filter(e => e.id !== ev.id)
      else if (!list.value.some(e => e.id === ev.id)) list.value.push(moved)
    }
  }

  // Occurrences of a series from `fromDate` on. The column is a timestamp, so
  // the query takes a ±1-day margin (any timezone) and the exact local day is
  // compared here — otherwise an early-morning occurrence could be missed.
  async function seriesRows(series_id: string, fromDate: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events').select('*')
      .eq('series_id', series_id).gte('starts_at', `${addDays(fromDate, -1)}T00:00:00Z`)
    if (error) throw error
    return (data ?? []).filter(row => dayOf(row) >= fromDate)
  }

  /** Update a series from `fromDate` on; each occurrence keeps its own day. */
  async function updateEventSeries(series_id: string, fromDate: string, fields: NewEvent) {
    const patch = (e: CalendarEvent) => ({
      title: fields.title, note: fields.note, category_id: fields.category_id,
      ...eventTimes(dayOf(e), fields.task_time, fields.duration_min),
    })
    if (!isDemo) {
      // the timestamps differ per occurrence, so the rows are read back, patched
      // on their own day and written in bulk (batched, and before local state)
      const rows = (await seriesRows(series_id, fromDate)).map(row => ({ ...row, ...patch(row) }))
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('calendar_events').upsert(rows.slice(i, i + 500))
        if (error) throw error
      }
    }
    for (const list of [events, ...longLists, demoManual]) {
      for (const row of list.value) {
        if (row.series_id === series_id && dayOf(row) >= fromDate) Object.assign(row, patch(row))
      }
    }
  }

  /** Delete one manual event for good (undo re-inserts it). */
  async function deleteEvent(ev: CalendarEvent) {
    if (isDemo) demoManual.value = demoManual.value.filter(e => e.id !== ev.id)
    else {
      const { error } = await supabase.from('calendar_events').delete().eq('id', ev.id)
      if (error) throw error
    }
    events.value = events.value.filter(e => e.id !== ev.id)
    for (const l of longLists) l.value = l.value.filter(e => e.id !== ev.id)
  }

  /** Delete a manual series from `fromDate` on. */
  async function deleteEventSeries(series_id: string, fromDate: string) {
    if (!isDemo) {
      // `starts_at` is a timestamp: timed occurrences are cut at the exact local
      // midnight instant, all-day ones (stored at 00:00Z) at that same date
      const timed = supabase
        .from('calendar_events').delete()
        .eq('series_id', series_id).eq('all_day', false)
        .gte('starts_at', parseYmd(fromDate).toISOString())
      const allDay = supabase
        .from('calendar_events').delete()
        .eq('series_id', series_id).eq('all_day', true)
        .gte('starts_at', `${fromDate}T00:00:00Z`)
      for (const { error } of await Promise.all([timed, allDay])) if (error) throw error
    }
    const gone = (e: CalendarEvent) => e.series_id === series_id && dayOf(e) >= fromDate
    demoManual.value = demoManual.value.filter(e => !gone(e))
    events.value = events.value.filter(e => !gone(e))
    for (const l of longLists) l.value = l.value.filter(e => !gone(e))
  }

  /** Re-insert a deleted manual event (undo). It gets a fresh id; `id` is
   *  never referenced elsewhere. */
  async function restoreManualEvent(ev: CalendarEvent) {
    let row = { ...ev }
    if (isDemo) {
      demoManual.value.push(row)
    } else {
      // `user_id` defaults to auth.uid() and `synced_at` to now() (see CLAUDE.md)
      const { id: _id, user_id: _uid, synced_at: _synced, ...fields } = ev as CalendarEvent & { user_id?: string; synced_at?: string }
      const { data, error } = await supabase.from('calendar_events').insert(fields).select().single()
      if (error) throw error
      row = data
    }
    if (inRange(dayOf(row)) && !events.value.some(e => e.id === row.id)) events.value.push(row)
    for (const l of longListsFor(dayOf(row))) if (!l.value.some(e => e.id === row.id)) l.value.push(row)
  }

  /** All manual events, for the JSON backup (feed events are re-synced). */
  async function getAllManualEvents(): Promise<CalendarEvent[]> {
    if (isDemo) return demoManual.value.map(e => ({ ...e }))
    const { data, error } = await supabase
      .from('calendar_events').select('*').is('feed_id', null)
      .order('starts_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  /** Bulk-insert manual events from a backup (rows already remapped). */
  async function importManualEvents(rows: Partial<CalendarEvent>[]) {
    if (!rows.length) return
    if (isDemo) {
      rows.forEach(r => {
        const ev = { ...r, id: `demo-ev-${crypto.randomUUID()}`, hidden: false } as CalendarEvent
        demoManual.value.push(ev)
        if (inRange(dayOf(ev))) events.value.push(ev)
        for (const l of longListsFor(dayOf(ev))) l.value.push(ev)
      })
      return
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('calendar_events').insert(rows.slice(i, i + 500))
      if (error) throw error
    }
    await refetch()
    if (statsRange) await fetchStatsRange(statsRange.from, statsRange.to)
    if (gridRange) await fetchGridRange(gridRange.from, gridRange.to)
  }

  async function updateFeed(id: string, updates: Partial<Pick<CalendarFeed, 'name' | 'category_id'>>) {
    if (!isDemo) {
      const { error } = await supabase.from('calendar_feeds').update(updates).eq('id', id)
      if (error) throw error
    }
    const f = feeds.value.find(x => x.id === id)
    if (f) Object.assign(f, updates)
  }

  // events cascade away with the feed
  async function disconnect(id: string) {
    if (!isDemo) {
      const { error } = await supabase.from('calendar_feeds').delete().eq('id', id)
      if (error) throw error
    }
    feeds.value = feeds.value.filter(f => f.id !== id)
    events.value = events.value.filter(e => e.feed_id !== id)
    for (const l of longLists) l.value = l.value.filter(e => e.feed_id !== id)
  }

  // "remove" a single event: hidden stays set across future syncs
  async function hideEvent(ev: CalendarEvent) {
    if (isDemo) demoHidden.add(ev.id)
    else {
      const { error } = await supabase.from('calendar_events').update({ hidden: true }).eq('id', ev.id)
      if (error) throw error
    }
    events.value = events.value.filter(e => e.id !== ev.id)
    for (const l of longLists) l.value = l.value.filter(e => e.id !== ev.id)
  }

  async function restoreEvent(ev: CalendarEvent) {
    if (isDemo) demoHidden.delete(ev.id)
    else {
      const { error } = await supabase.from('calendar_events').update({ hidden: false }).eq('id', ev.id)
      if (error) throw error
    }
    events.value.push({ ...ev, hidden: false })
    for (const l of longListsFor(dayOf(ev))) if (!l.value.some(e => e.id === ev.id)) l.value.push({ ...ev, hidden: false })
  }

  return {
    feeds, events, statsEvents, gridEvents, syncing, categoryOf, allLoadedEvents,
    init, loadFeeds, fetchFeeds, fetchRange, fetchStatsRange, fetchGridRange, preview, connect, sync, updateFeed, disconnect, hideEvent, restoreEvent,
    addEvents, updateEvent, updateEventSeries, deleteEvent, deleteEventSeries, restoreManualEvent,
    getAllManualEvents, importManualEvents,
  }
})
