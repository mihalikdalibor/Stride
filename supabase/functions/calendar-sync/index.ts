// Supabase Edge Function: fetch + parse an iCal (.ics) feed for the caller.
// Browsers can't fetch most feeds directly (no CORS headers), so this proxies it.
//
//   { action: 'preview', url }          → { name, count }  (validates, stores nothing)
//   { action: 'sync', feed_id, tz? }    → { last_synced_at, count }
//
// Sync upserts occurrences into `calendar_events` keyed by (feed_id, uid) and
// never sends `hidden`, so events the user removed stay removed across syncs.
// Runs with the caller's JWT → RLS applies to every read/write.
//
// Deploy:  supabase functions deploy calendar-sync

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseIcs } from './parse.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAST_DAYS = 60
const FUTURE_DAYS = 365
const MAX_BYTES = 5 * 1024 * 1024
const DAY = 86400000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// error codes are mapped to translated messages on the client
class FeedError extends Error {}

function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

function normalizeUrl(raw: string): URL {
  let s = String(raw ?? '').trim()
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcal(s?):\/\//i, 'https://')
  let url: URL
  try { url = new URL(s) } catch { throw new FeedError('invalid_url') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FeedError('invalid_url')
  if (isPrivateHost(url.hostname)) throw new FeedError('invalid_url')
  return url
}

async function download(url: URL): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'text/calendar, */*' },
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new FeedError('fetch_failed')
  }
  // a redirect must not land on an internal host either
  if (isPrivateHost(new URL(res.url || url.href).hostname)) throw new FeedError('invalid_url')
  if (!res.ok || !res.body) throw new FeedError('fetch_failed')
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new FeedError('too_large')

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BYTES) { reader.cancel(); throw new FeedError('too_large') }
    chunks.push(value)
  }
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.length }
  const text = new TextDecoder().decode(buf)
  if (!text.includes('BEGIN:VCALENDAR')) throw new FeedError('not_ical')
  return text
}

function parse(text: string, tz: string) {
  const now = Date.now()
  try {
    return parseIcs(text, new Date(now - PAST_DAYS * DAY), new Date(now + FUTURE_DAYS * DAY), tz)
  } catch {
    throw new FeedError('not_ical')
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  let feedId: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    const tz = typeof body.tz === 'string' ? body.tz : 'UTC'

    if (body.action === 'preview') {
      const cal = parse(await download(normalizeUrl(body.url)), tz)
      return json({ name: cal.name, count: cal.events.length })
    }

    if (body.action === 'sync') {
      feedId = String(body.feed_id ?? '')
      const { data: feed } = await supabase.from('calendar_feeds').select('id, url').eq('id', feedId).maybeSingle()
      if (!feed) return json({ error: 'not_found' }, 404)

      const cal = parse(await download(normalizeUrl(feed.url)), tz)
      const syncedAt = new Date().toISOString()

      // dedupe (a malformed feed can repeat a UID) — last one wins
      const rows = [...new Map(cal.events.map(e => [e.uid, { ...e, feed_id: feed.id, synced_at: syncedAt }])).values()]
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase
          .from('calendar_events')
          .upsert(rows.slice(i, i + 500), { onConflict: 'feed_id,uid' })
        if (error) throw error
      }
      // drop occurrences that vanished from the feed (only inside the synced
      // window — older history outside it is kept)
      const { error: delErr } = await supabase
        .from('calendar_events').delete()
        .eq('feed_id', feed.id)
        .lt('synced_at', syncedAt)
        .gte('ends_at', new Date(Date.now() - PAST_DAYS * DAY).toISOString())
      if (delErr) throw delErr

      await supabase.from('calendar_feeds')
        .update({ last_synced_at: syncedAt, last_error: null }).eq('id', feed.id)
      return json({ last_synced_at: syncedAt, count: rows.length })
    }

    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    const code = e instanceof FeedError ? e.message : 'server_error'
    if (feedId) await supabase.from('calendar_feeds').update({ last_error: code }).eq('id', feedId)
    if (!(e instanceof FeedError)) console.error(e instanceof Error ? e.message : e) // never log feed URLs
    return json({ error: code }, e instanceof FeedError ? 422 : 500)
  }
})
