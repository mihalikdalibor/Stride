import { ref } from 'vue'

// Whether connected-calendar events count toward Stats. Local-only preference
// (like the weekly goal); on by default. Per-feed/per-event control is later.
const KEY = 'stride-stats-events'

export const countEvents = ref(localStorage.getItem(KEY) !== '0')

export function setCountEvents(v: boolean) {
  countEvents.value = v
  localStorage.setItem(KEY, v ? '1' : '0')
}
