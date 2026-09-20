<template>
  <div class="day" :class="{ today: isToday }">
    <div v-if="showHeader" class="day-head">
      <div class="day-title">
        <span class="day-name" :class="{ red: isToday }">{{ dayName }}</span>
        <span class="day-date" :class="{ red: isToday }">
          {{ dateLabel }}<template v-if="isToday"> · {{ t('day.today') }}</template>
        </span>
      </div>
      <span class="day-count" :class="{ done: allDone }">{{ doneCount }} / {{ tasks.length }}</span>
    </div>

    <template v-for="item in items" :key="item.key">
        <!-- event: fixed (no checkbox). A manual one opens the edit form on tap,
             a feed one only shows its source + remove. Swipe ← removes both. -->
        <div v-if="item.kind === 'event'" class="day-item">
          <ItemForm
            v-if="editingEventId === item.ev.id"
            :date="date"
            :event="item.ev"
            @save="saveEventEdit(item.ev, $event)"
            @remove="removeManualEvent(item.ev, $event)"
            @cancel="editingEventId = null"
          />
          <template v-else>
            <div class="swipe-wrap">
              <div v-if="swipeId === item.key && swipeDx < 0" class="swipe-bg right" :class="{ ready: swipeDx < -SWIPE_TH }">
                <i class="ti ti-trash"></i>
              </div>
              <div
                class="trow"
                :class="{ swiping: swipeId === item.key, today: isToday }"
                :style="swipeStyle(item.key)"
                @touchstart="onRowDown($event, item)"
                @touchmove="onRowMove($event, item)"
                @touchend="onRowUp($event, item)"
              >
                <span class="ev-mark" :style="{ color: evColor(item.ev) }"><i class="ti ti-calendar-event"></i></span>
                <button
                  type="button"
                  class="row-text-btn ev-btn"
                  :aria-expanded="openEventId === item.ev.id"
                  @click="tapEvent(item.ev)"
                >
                  <span class="row-text">{{ item.ev.title }}</span>
                  <span class="row-sub">
                    <span class="row-sub-time">{{ item.ev.all_day ? t('ics.allDay') : eventTimeLabel(item.ev) }}</span>
                    <template v-if="evSubNote(item.ev)">
                      <span class="row-sub-sep">·</span>
                      <span class="row-sub-note">{{ evSubNote(item.ev) }}</span>
                    </template>
                  </span>
                </button>
                <span
                  v-if="catColor(calendarsStore.categoryOf(item.ev))"
                  class="cat-dot"
                  :style="{ background: catColor(calendarsStore.categoryOf(item.ev))! }"
                ></span>
                <i v-if="item.ev.series_id" class="ti ti-repeat row-repeat"></i>
              </div>
            </div>
            <div v-if="openEventId === item.ev.id" class="ev-detail">
              <span class="ev-source"><i class="ti ti-calendar-share"></i>{{ feedName(item.ev) }}</span>
              <button class="act-btn danger" @click="removeEvent(item.ev)">
                <i class="ti ti-trash"></i> {{ t('ics.removeEvent') }}
              </button>
            </div>
          </template>
        </div>

        <div v-else class="day-item">
          <!-- edit mode -->
          <ItemForm
            v-if="editingId === item.task.id"
            :date="date"
            :task="item.task"
            @save="saveEdit(item.task, $event)"
            @remove="removeTask(item.task, $event)"
            @cancel="editingId = null"
          />

          <!-- normal row (swipe: → done, ← delete) -->
          <div v-else class="swipe-wrap">
            <template v-if="swipeId === item.key">
              <div v-if="swipeDx > 0" class="swipe-bg left" :class="{ ready: swipeDx > SWIPE_TH }">
                <i class="ti" :class="item.task.status === 'done' ? 'ti-rotate-2' : 'ti-check'"></i>
              </div>
              <div v-else-if="swipeDx < 0" class="swipe-bg right" :class="{ ready: swipeDx < -SWIPE_TH }">
                <i class="ti ti-trash"></i>
              </div>
            </template>
            <div
              class="trow"
              :class="{ swiping: swipeId === item.key, today: isToday }"
              :style="swipeStyle(item.key)"
              @touchstart="onRowDown($event, item)"
              @touchmove="onRowMove($event, item)"
              @touchend="onRowUp($event, item)"
            >
              <button
                type="button"
                class="check"
                :class="{ checked: item.task.status === 'done' }"
                @click="tasksStore.toggleTask(item.task)"
                :aria-label="item.task.status === 'done' ? t('day.markUndone') : t('day.markDone')"
                :title="item.task.status === 'done' ? t('day.markUndone') : t('day.markDone')"
              >
                <i v-if="item.task.status === 'done'" class="ti ti-check"></i>
              </button>
              <button type="button" class="row-text-btn" @click="openEdit(item.task)">
                <span class="row-text" :class="{ done: item.task.status === 'done' }">{{ item.task.title }}</span>
                <span v-if="item.task.task_time || item.task.note" class="row-sub">
                  <span v-if="item.task.task_time" class="row-sub-time">{{ timeLabel(item.task) }}</span>
                  <span v-if="item.task.task_time && item.task.note" class="row-sub-sep">·</span>
                  <span v-if="item.task.note" class="row-sub-note">{{ item.task.note }}</span>
                </span>
              </button>
              <span
                v-if="catColor(item.task.category_id)"
                class="cat-dot"
                :style="{ background: catColor(item.task.category_id)! }"
              ></span>
              <i
                v-if="item.task.repeat !== 'none' || item.task.series_id"
                class="ti ti-repeat row-repeat"
                :class="{ done: item.task.status === 'done' }"
              ></i>
              <button
                type="button"
                class="flag-dot"
                :class="{ on: item.task.priority }"
                @click.stop="toggleFlag(item.task)"
                :aria-label="t('day.priority')"
                :title="t('day.priority')"
              ><i class="ti ti-flag"></i></button>
            </div>
          </div>
        </div>
    </template>

    <div v-for="tomb in tombstones" :key="'tomb-' + tomb.id" class="trow tomb-row">
      <span class="tomb-icon"><i class="ti ti-trash"></i></span>
      <span class="tomb-text">{{ tomb.title }}</span>
      <button type="button" class="tomb-undo" @click="undoTomb(tomb)">
        <i class="ti ti-arrow-back-up"></i> {{ t('undo.action') }}
      </button>
    </div>

    <div v-for="tomb in evTombstones" :key="'evtomb-' + tomb.ev.id" class="trow tomb-row">
      <span class="tomb-icon"><i class="ti ti-trash"></i></span>
      <span class="tomb-text">{{ tomb.ev.title }}</span>
      <button type="button" class="tomb-undo" @click="undoEventTomb(tomb)">
        <i class="ti ti-arrow-back-up"></i> {{ t('undo.action') }}
      </button>
    </div>

    <template v-if="canAdd">
      <ItemForm v-if="adding" :date="date" @save="submitAdd" @cancel="adding = false" />
      <button v-else type="button" class="trow trow-add" @click="openAdd">
        <span class="check dashed"><i class="ti ti-plus"></i></span>
        <span class="row-text muted">{{ t('day.addItem') }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTasksStore } from '@/stores/tasks'
import { useCategoriesStore } from '@/stores/categories'
import { useCalendarsStore } from '@/stores/calendars'
import ItemForm from '@/components/ItemForm.vue'
import { useFmt } from '@/i18n/dates'
import { today } from '@/lib/dates'
import { eventFormFields, eventStart, eventTimeLabel, isManual } from '@/lib/calendarEvents'
import { rangeLabel } from '@/lib/time'
import type { CalendarEvent, ItemDraft, Task, TaskRepeat } from '@/types'

const { t } = useI18n()
const fmt = useFmt()

const props = withDefaults(defineProps<{
  date: string
  tasks: Task[]
  events?: CalendarEvent[]   // events on this day (not counted in done/total)
  showHeader?: boolean
}>(), { showHeader: true, events: () => [] })

// notify parent (Home) so it can keep this day open while the undo row shows
const emit = defineEmits<{ deleted: [string] }>()

const tasksStore = useTasksStore()
const categoriesStore = useCategoriesStore()
const calendarsStore = useCalendarsStore()

// Tasks + calendar events in one list: all-day events first, then timed tasks
// and events by start time (event first on a tie), then untimed tasks in their
// given order (props.tasks arrives already sorted by byDayOrder).
type Item = { kind: 'task'; key: string; task: Task } | { kind: 'event'; key: string; ev: CalendarEvent }
const items = computed<Item[]>(() => {
  const rows = [
    ...props.events.map(ev => ({
      item: { kind: 'event', key: `ev-${ev.id}`, ev } as Item,
      group: ev.all_day ? 0 : 1, time: eventStart(ev) ?? '', order: -1,
    })),
    ...props.tasks.map((task, i) => ({
      item: { kind: 'task', key: task.id, task } as Item,
      group: task.task_time ? 1 : 2, time: task.task_time?.slice(0, 5) ?? '', order: i,
    })),
  ]
  rows.sort((a, b) => a.group - b.group || a.time.localeCompare(b.time) || a.order - b.order)
  return rows.map(r => r.item)
})

// "14:00–15:30" (start + duration); an end past midnight gets a "+1" suffix
const timeLabel = (task: Task) => rangeLabel(task.task_time, task.duration_min)

const adding = ref(false)
const editingId = ref<string | null>(null)
const editingEventId = ref<string | null>(null)

const catColor = (id: string | null) => categoriesStore.color(id)

function toggleFlag(task: Task) {
  tasksStore.updateTask(task.id, { priority: !task.priority })
}

function openEdit(task: Task) {
  editingEventId.value = null
  editingId.value = task.id
}

// --- add: one day, several picked days, or an expanded repeat rule ---
async function submitAdd(draft: ItemDraft) {
  const series_id = draft.series ? crypto.randomUUID() : null
  if (draft.kind === 'task') await tasksStore.addTasks(taskFields(draft), draft.dates, series_id)
  else await calendarsStore.addEvents(eventFields(draft), draft.dates, series_id)
  adding.value = false
}

const taskFields = (d: ItemDraft) => ({
  title: d.title, note: d.note, task_time: d.task_time,
  duration_min: d.duration_min, category_id: d.category_id,
})
const eventFields = (d: ItemDraft) => ({
  title: d.title, note: d.note, category_id: d.category_id,
  task_time: d.task_time, duration_min: d.duration_min,
})

// --- edit an activity (may turn it into an event) ---
async function saveEdit(task: Task, draft: ItemDraft) {
  const date = draft.dates[0] ?? task.task_date
  editingId.value = null
  if (draft.kind === 'event') {
    // convert: insert first, and undo that insert if the delete fails, so the
    // item never ends up in both tables
    const made = await calendarsStore.addEvents(eventFields(draft), [date], null)
    try {
      await tasksStore.deleteTask(task.id)
    } catch (e) {
      for (const ev of made) await calendarsStore.deleteEvent(ev)
      throw e
    }
    emit('deleted', props.date)
    return
  }
  if (task.series_id && draft.scope === 'following') {
    await tasksStore.updateSeries(task.series_id, task.task_date, taskFields(draft))
    return
  }
  const dateChanged = date !== task.task_date
  await tasksStore.updateTask(task.id, {
    ...taskFields(draft),
    ...(dateChanged ? { task_date: date } : {}),
    // "turn off" on a legacy repeat (new repeats use series_id)
    ...(draft.clearRepeat ? { repeat: 'none' as TaskRepeat } : {}),
  })
}

// --- edit a manual event (may turn it back into an activity) ---
async function saveEventEdit(ev: CalendarEvent, draft: ItemDraft) {
  const date = draft.dates[0] ?? eventFormFields(ev).date
  editingEventId.value = null
  if (draft.kind === 'task') {
    const made = await tasksStore.addTasks(taskFields(draft), [date], null)
    try {
      await calendarsStore.deleteEvent(ev)
    } catch (e) {
      for (const t of made) await tasksStore.deleteTask(t.id)
      throw e
    }
    emit('deleted', props.date)
    return
  }
  if (ev.series_id && draft.scope === 'following') {
    await calendarsStore.updateEventSeries(ev.series_id, eventFormFields(ev).date, eventFields(draft))
    return
  }
  await calendarsStore.updateEvent(ev, eventFields(draft), date)
}

// Swipe a task row: → mark done/undone, ← delete. (touch only)
const SWIPE_TH = 80
const swipeId = ref<string | null>(null)
const swipeDx = ref(0)
let sx = 0, sy = 0, swiping = false, horizontal = false

function swipeStyle(id: string) {
  if (swipeId.value !== id) return undefined
  return { transform: `translateX(${swipeDx.value}px)`, transition: 'none' }
}

function onRowDown(e: TouchEvent, item: Item) {
  sx = e.touches[0].clientX; sy = e.touches[0].clientY
  swiping = true; horizontal = false
  swipeId.value = item.key; swipeDx.value = 0
}

function onRowMove(e: TouchEvent, item: Item) {
  if (!swiping) return
  const dx = e.touches[0].clientX - sx
  const dy = e.touches[0].clientY - sy
  if (!horizontal) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) horizontal = true
    else if (Math.abs(dy) > 10) { swiping = false; swipeId.value = null; return } // vertical scroll
    else return
  }
  e.preventDefault()        // lock to horizontal, stop the list scrolling
  e.stopPropagation()       // don't trigger week-swipe on the home root
  swipeDx.value = item.kind === 'event' ? Math.min(0, dx) : dx // events: ← remove only
}

function onRowUp(e: TouchEvent, item: Item) {
  if (horizontal) e.stopPropagation()
  const dx = swipeDx.value
  swiping = false; horizontal = false
  swipeId.value = null; swipeDx.value = 0
  if (item.kind === 'event') {
    if (dx < -SWIPE_TH) removeEvent(item.ev)
  } else if (dx > SWIPE_TH) tasksStore.toggleTask(item.task)
  else if (dx < -SWIPE_TH) deleteWithUndo(item.task)
}

// Delete, leaving an inline "deleted · undo" tombstone row in its place for ~5s.
const tombstones = ref<Task[]>([])
const tombTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function deleteWithUndo(task: Task) {
  const snapshot = { ...task }
  await tasksStore.deleteTask(task.id)
  emit('deleted', props.date)
  tombstones.value.push(snapshot)
  tombTimers.set(snapshot.id, setTimeout(() => {
    tombstones.value = tombstones.value.filter(x => x.id !== snapshot.id)
    tombTimers.delete(snapshot.id)
  }, 5000))
}

async function undoTomb(tomb: Task) {
  const tmr = tombTimers.get(tomb.id)
  if (tmr) { clearTimeout(tmr); tombTimers.delete(tomb.id) }
  tombstones.value = tombstones.value.filter(x => x.id !== tomb.id)
  await tasksStore.restoreTask(tomb)
}

// Events: a manual one is edited on tap and really deleted; a feed one shows
// its source and is only hidden (kept hidden across syncs). Both get the same
// inline undo row as tasks.
const openEventId = ref<string | null>(null)
const evTombstones = ref<{ ev: CalendarEvent; manual: boolean }[]>([])

const evColor = (ev: CalendarEvent) => catColor(calendarsStore.categoryOf(ev)) ?? 'var(--color-text-tertiary)'
const feedName = (ev: CalendarEvent) => calendarsStore.feeds.find(f => f.id === ev.feed_id)?.name ?? ''
// feed events show their location, manual ones their note
const evSubNote = (ev: CalendarEvent) => (isManual(ev) ? ev.note : ev.location)

function tapEvent(ev: CalendarEvent) {
  if (isManual(ev)) {
    editingId.value = null
    openEventId.value = null
    editingEventId.value = ev.id
    return
  }
  openEventId.value = openEventId.value === ev.id ? null : ev.id
}

async function removeEvent(ev: CalendarEvent) {
  openEventId.value = null
  const snapshot = { ...ev }
  const manual = isManual(ev)
  if (manual) await calendarsStore.deleteEvent(ev)
  else await calendarsStore.hideEvent(ev)
  emit('deleted', props.date)
  evTombstones.value.push({ ev: snapshot, manual })
  tombTimers.set(`ev-${snapshot.id}`, setTimeout(() => {
    evTombstones.value = evTombstones.value.filter(x => x.ev.id !== snapshot.id)
    tombTimers.delete(`ev-${snapshot.id}`)
  }, 5000))
}

async function undoEventTomb(tomb: { ev: CalendarEvent; manual: boolean }) {
  const tmr = tombTimers.get(`ev-${tomb.ev.id}`)
  if (tmr) { clearTimeout(tmr); tombTimers.delete(`ev-${tomb.ev.id}`) }
  evTombstones.value = evTombstones.value.filter(x => x.ev.id !== tomb.ev.id)
  if (tomb.manual) await calendarsStore.restoreManualEvent(tomb.ev)
  else await calendarsStore.restoreEvent(tomb.ev)
}

// delete from the edit form: a series item can take its following occurrences with it
async function removeTask(task: Task, scope: ItemDraft['scope']) {
  editingId.value = null
  if (task.series_id && scope === 'following') {
    await tasksStore.deleteSeries(task.series_id, task.task_date)
    emit('deleted', props.date)
    return
  }
  await deleteWithUndo(task)
}

async function removeManualEvent(ev: CalendarEvent, scope: ItemDraft['scope']) {
  editingEventId.value = null
  if (ev.series_id && scope === 'following') {
    await calendarsStore.deleteEventSeries(ev.series_id, eventFormFields(ev).date)
    emit('deleted', props.date)
    return
  }
  await removeEvent(ev)
}

const isToday = computed(() => props.date === today())
// Add is allowed on today + future days only (past days have no add affordance).
const canAdd = computed(() => props.date >= today())
const dayName = computed(() => fmt.dayName(props.date))
const dateLabel = computed(() => fmt.dayMonthLabel(props.date))
const doneCount = computed(() => props.tasks.filter(t => t.status === 'done').length)
const allDone = computed(() => props.tasks.length > 0 && doneCount.value === props.tasks.length)

function openAdd() {
  editingId.value = null
  editingEventId.value = null
  adding.value = true
}

defineExpose({ openAdd })
</script>

<style scoped>
.day { padding: 13px 18px; }
.day.today { background: var(--color-background-secondary); }

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.day-title { display: flex; align-items: baseline; gap: 8px; }
.day-name { font-size: 16px; font-weight: 500; color: var(--color-text-primary); }
.day-date { font-size: 13px; color: var(--color-text-tertiary); }
.day-name.red, .day-date.red { color: var(--color-text-danger); }
.day-count { font-size: 12px; color: var(--color-text-secondary); }
.day-count.done { color: var(--color-text-success); }

.trow {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 6px 0;
  cursor: pointer;
}

/* swipe: → done, ← delete (mobile) */
.swipe-wrap { position: relative; overflow: hidden; }
.swipe-bg {
  position: absolute; inset: 0;
  display: flex; align-items: center;
  padding: 0 18px; color: #fff; font-size: 18px;
  filter: saturate(0.85) brightness(0.85); transition: filter .1s;
}
.swipe-bg.ready { filter: none; }
.swipe-bg.left { justify-content: flex-start; background: var(--color-text-success); }
.swipe-bg.right { justify-content: flex-end; background: var(--color-text-danger); }
.swipe-wrap .trow.swiping { position: relative; background: var(--color-background-primary); transition: transform .2s; }
.swipe-wrap .trow.swiping.today { background: var(--color-background-secondary); }

/* inline undo row left where a deleted task was */
.tomb-row { gap: 11px; color: var(--color-text-tertiary); cursor: default; }
.tomb-icon { display: flex; align-items: center; font-size: 16px; }
.tomb-text { flex: 1; min-width: 0; font-size: 15px; text-decoration: line-through; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tomb-undo {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  border: none; cursor: pointer; padding: 5px 12px; border-radius: 999px;
  background: var(--color-background-info); color: var(--color-text-info);
  font-size: 13px; font-weight: 500;
}
.tomb-undo i { font-size: 15px; }
.check {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border-secondary);
  background: transparent;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  padding: 0; cursor: pointer;
  color: #fff;
  transition: background-color .2s ease, border-color .2s ease, transform .1s ease;
}
.check:active { transform: scale(0.88); }
.check.checked { background: var(--color-text-success); border-color: var(--color-text-success); }
.check.checked i { font-size: 14px; animation: check-pop .25s ease; }
.check.dashed {
  border-style: dashed;
  border-color: var(--color-border-tertiary);
  color: var(--color-text-tertiary);
}
.check.dashed i { font-size: 13px; }

.row-text-btn { flex: 1; min-width: 0; border: none; background: none; text-align: left; padding: 0; cursor: text; display: flex; flex-direction: column; gap: 2px; }
/* small sub-line under the title: time then note */
.row-sub { display: flex; align-items: baseline; gap: 5px; min-width: 0; font-size: 12px; }
.row-sub-time { flex-shrink: 0; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.row-sub-sep { flex-shrink: 0; color: var(--color-text-tertiary); }
.row-sub-note { min-width: 0; color: var(--color-text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-text {
  font-size: 15px; color: var(--color-text-primary);
  position: relative; align-self: flex-start; max-width: 100%;
  transition: color .25s ease;
}
.row-text::after {
  content: ''; position: absolute; left: 0; top: 52%;
  width: 100%; height: 1.5px; background: currentColor; border-radius: 1px;
  transform: scaleX(0); transform-origin: left; transition: transform .25s ease;
}
.row-text.done { color: var(--color-text-tertiary); }
.row-text.done::after { transform: scaleX(1); }
.flag-dot {
  border: none; background: none; cursor: pointer; padding: 2px; flex-shrink: 0;
  display: flex; align-items: center; font-size: 16px; color: var(--color-text-tertiary);
}
.flag-dot.on { color: var(--color-text-info); }
.row-repeat { font-size: 14px; color: var(--color-text-info); flex-shrink: 0; }
.row-repeat.done { opacity: 0.5; }

.row-text.muted { font-size: 14px; color: var(--color-text-tertiary); }
.trow-add { background: none; border: none; width: 100%; text-align: left; }

.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* event row: calendar glyph in the category color instead of a checkbox */
.ev-mark { width: 22px; height: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; }
.ev-btn { cursor: pointer; }
.ev-detail {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 2px 0 8px 33px;
}
.ev-source { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: 12px; color: var(--color-text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-source i { font-size: 14px; }

/* subtle press feedback on tap */
.flag-dot, .tomb-undo {
  transition: transform .1s ease, background-color .15s ease, color .15s ease;
}
.flag-dot:active, .tomb-undo:active { transform: scale(0.92); }

@keyframes check-pop {
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(1); }
}

.tomb-row { animation: tomb-in .2s ease; }
@keyframes tomb-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .check, .check.checked i, .row-text, .row-text::after, .tomb-row,
  .flag-dot, .act-btn, .tomb-undo {
    transition: none !important; animation: none !important;
  }
  .row-text.done { text-decoration: line-through; }
  .row-text.done::after { display: none; }
}
</style>
