import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { demoEventsForRange, isDemo } from '@/lib/demo'
import { addDays } from '@/lib/dates'
import type { CalendarEvent, CalendarFeed } from '@/types'

// Connected iCal feeds + their events. Fetching/parsing a feed happens in the
// `calendar-sync` Edge Function; this store reads the results and only ever
// writes feed settings and the per-event `hidden` flag.

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
  const syncing = ref<Set<string>>(new Set())
  let range: { from: string; to: string } | null = null
  let initialized = false
  const demoHidden = new Set<string>()

  const feedById = computed(() => new Map(feeds.value.map(f => [f.id, f])))

  // events inherit the category chosen for their feed
  function categoryOf(ev: CalendarEvent): string | null {
    return feedById.value.get(ev.feed_id)?.category_id ?? null
  }

  async function fetchFeeds() {
    if (isDemo) return
    const { data, error } = await supabase
      .from('calendar_feeds').select('*').order('created_at', { ascending: true })
    if (error) throw error
    feeds.value = data ?? []
  }

  async function fetchRange(from: string, to: string) {
    range = { from, to }
    if (isDemo) {
      events.value = feeds.value
        .flatMap(f => demoEventsForRange(f.id, f.name, from, to))
        .filter(e => !demoHidden.has(e.id))
      return
    }
    if (!feeds.value.length) { events.value = []; return }
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
      await fetchFeeds()
      if (feeds.value.length) await refetch()
      const stale = feeds.value.filter(f => !f.last_synced_at || Date.now() - Date.parse(f.last_synced_at) > STALE_MS)
      if (!stale.length) return
      for (const f of stale) await sync(f, false)
      await refetch()
    } catch (e) {
      console.error('calendars init failed', e) // e.g. migration not run yet — tasks keep working
    }
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
  }

  // "remove" a single event: hidden stays set across future syncs
  async function hideEvent(ev: CalendarEvent) {
    if (isDemo) demoHidden.add(ev.id)
    else {
      const { error } = await supabase.from('calendar_events').update({ hidden: true }).eq('id', ev.id)
      if (error) throw error
    }
    events.value = events.value.filter(e => e.id !== ev.id)
  }

  async function restoreEvent(ev: CalendarEvent) {
    if (isDemo) demoHidden.delete(ev.id)
    else {
      const { error } = await supabase.from('calendar_events').update({ hidden: false }).eq('id', ev.id)
      if (error) throw error
    }
    events.value.push({ ...ev, hidden: false })
  }

  return {
    feeds, events, syncing, categoryOf,
    init, fetchFeeds, fetchRange, preview, connect, sync, updateFeed, disconnect, hideEvent, restoreEvent,
  }
})
