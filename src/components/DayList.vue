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
        <!-- connected-calendar event: fixed (no checkbox/edit), tap for details, swipe ← to remove -->
        <div v-if="item.kind === 'event'" class="day-item">
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
              <button type="button" class="row-text-btn ev-btn" :aria-expanded="openEventId === item.ev.id" @click="toggleEvent(item.ev)">
                <span class="row-text">{{ item.ev.title }}</span>
                <span class="row-sub">
                  <span class="row-sub-time">{{ item.ev.all_day ? t('ics.allDay') : eventTimeLabel(item.ev) }}</span>
                  <template v-if="item.ev.location">
                    <span class="row-sub-sep">·</span>
                    <span class="row-sub-note">{{ item.ev.location }}</span>
                  </template>
                </span>
              </button>
              <span
                v-if="catColor(calendarsStore.categoryOf(item.ev))"
                class="cat-dot"
                :style="{ background: catColor(calendarsStore.categoryOf(item.ev))! }"
              ></span>
            </div>
          </div>
          <div v-if="openEventId === item.ev.id" class="ev-detail">
            <span class="ev-source"><i class="ti ti-calendar-share"></i>{{ feedName(item.ev) }}</span>
            <button class="act-btn danger" @click="removeEvent(item.ev)">
              <i class="ti ti-trash"></i> {{ t('ics.removeEvent') }}
            </button>
          </div>
        </div>

        <div v-else class="day-item">
          <!-- edit mode -->
          <div v-if="editingId === item.task.id" class="add-form edit-form">
            <div class="add-input-row">
              <input
                ref="editEl"
                v-model="editTitle"
                class="add-input"
                :placeholder="t('day.itemName')"
                @keyup.enter="saveEdit(item.task)"
                @keyup.esc="cancelEdit"
              >
              <button class="add-confirm" @click="saveEdit(item.task)"><i class="ti ti-check"></i></button>
              <button class="add-cancel" @click="cancelEdit"><i class="ti ti-x"></i></button>
            </div>
            <textarea
              v-model="editNote"
              class="note-input"
              rows="2"
              :placeholder="t('day.note')"
            ></textarea>
            <div class="cat-repeat-row">
              <CategoryPicker v-model="editCat" />
              <label class="repeat-icon" :class="{ on: editRepeat !== 'none' }" :aria-label="t('day.repeat')" :title="t('day.repeat')">
                <i class="ti ti-repeat"></i>
                <select v-model="editRepeat">
                  <option value="none">{{ t('day.repeatNone') }}</option>
                  <option value="daily">{{ t('day.repeatDaily') }}</option>
                  <option value="weekly">{{ t('day.repeatWeekly') }}</option>
                  <option value="monthly">{{ t('day.repeatMonthly') }}</option>
                </select>
              </label>
            </div>
            <div class="edit-bottom">
              <template v-if="moveOpen">
                <span class="eb-q">{{ t('day.moveTo') }}</span>
                <input type="date" v-model="editDate" class="date-input">
                <button class="add-confirm" @click="applyMove(item.task)" :aria-label="t('common.confirm')" :title="t('common.confirm')"><i class="ti ti-check"></i></button>
                <button class="add-cancel" @click="moveOpen = false" :aria-label="t('common.cancel')" :title="t('common.cancel')"><i class="ti ti-x"></i></button>
              </template>
              <template v-else>
                <div class="edit-actions">
                  <div class="meta-row">
                    <div class="field">
                      <span class="field-label">{{ t('day.from') }}</span>
                      <select v-model="editHour" :aria-label="t('day.from')">
                        <option value="">--</option>
                        <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
                      </select>
                      <span class="colon">:</span>
                      <select v-model="editMin" :aria-label="t('day.from')">
                        <option value="">--</option>
                        <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
                      </select>
                    </div>
                    <div class="field">
                      <span class="field-label">{{ t('day.to') }}</span>
                      <select v-model="editEndHour" :aria-label="t('day.to')">
                        <option value="">--</option>
                        <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
                      </select>
                      <span class="colon">:</span>
                      <select v-model="editEndMin" :aria-label="t('day.to')">
                        <option value="">--</option>
                        <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
                      </select>
                      <span v-if="endsNextDay(editHour, editMin, editEndHour, editEndMin)" class="next-day">+1</span>
                    </div>
                  </div>
                  <div class="action-row">
                    <button class="act-btn danger" @click="removeTask(item.task)">
                      <i class="ti ti-trash"></i> {{ t('common.delete') }}
                    </button>
                    <button class="act-btn" @click="moveOpen = true">
                      <i class="ti ti-calendar-event"></i> {{ t('day.moveTo') }}
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

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
              <i v-if="item.task.repeat !== 'none'" class="ti ti-repeat row-repeat" :class="{ done: item.task.status === 'done' }"></i>
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

    <div v-for="tomb in evTombstones" :key="'evtomb-' + tomb.id" class="trow tomb-row">
      <span class="tomb-icon"><i class="ti ti-trash"></i></span>
      <span class="tomb-text">{{ tomb.title }}</span>
      <button type="button" class="tomb-undo" @click="undoEventTomb(tomb)">
        <i class="ti ti-arrow-back-up"></i> {{ t('undo.action') }}
      </button>
    </div>

    <template v-if="canAdd">
      <div v-if="adding" class="add-form">
        <div class="add-input-row">
          <input
            ref="inputEl"
            v-model="newTitle"
            class="add-input"
            :placeholder="t('day.itemName')"
            @keyup.enter="submit"
            @keyup.esc="cancel"
          >
          <button class="add-confirm" @click="submit" :aria-label="t('common.confirm')" :title="t('common.confirm')"><i class="ti ti-check"></i></button>
          <button class="add-cancel" @click="cancel" :aria-label="t('common.cancel')" :title="t('common.cancel')"><i class="ti ti-x"></i></button>
        </div>
        <textarea
          v-model="newNote"
          class="note-input"
          rows="2"
          :placeholder="t('day.note')"
        ></textarea>
        <div class="meta-row">
          <div class="field">
            <span class="field-label">{{ t('day.from') }}</span>
            <select v-model="newHour" :aria-label="t('day.from')">
              <option value="">--</option>
              <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
            </select>
            <span class="colon">:</span>
            <select v-model="newMin" :aria-label="t('day.from')">
              <option value="">--</option>
              <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="field">
            <span class="field-label">{{ t('day.to') }}</span>
            <select v-model="newEndHour" :aria-label="t('day.to')">
              <option value="">--</option>
              <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
            </select>
            <span class="colon">:</span>
            <select v-model="newEndMin" :aria-label="t('day.to')">
              <option value="">--</option>
              <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
            </select>
            <span v-if="endsNextDay(newHour, newMin, newEndHour, newEndMin)" class="next-day">+1</span>
          </div>
        </div>
        <div class="cat-repeat-row">
          <CategoryPicker v-model="selectedCat" />
          <label class="repeat-icon" :class="{ on: newRepeat !== 'none' }" :aria-label="t('day.repeat')" :title="t('day.repeat')">
            <i class="ti ti-repeat"></i>
            <select v-model="newRepeat">
              <option value="none">{{ t('day.repeatNone') }}</option>
              <option value="daily">{{ t('day.repeatDaily') }}</option>
              <option value="weekly">{{ t('day.repeatWeekly') }}</option>
              <option value="monthly">{{ t('day.repeatMonthly') }}</option>
            </select>
          </label>
        </div>
      </div>
      <button v-else type="button" class="trow trow-add" @click="openAdd">
        <span class="check dashed"><i class="ti ti-plus"></i></span>
        <span class="row-text muted">{{ t('day.addItem') }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTasksStore } from '@/stores/tasks'
import { useCategoriesStore } from '@/stores/categories'
import { useCalendarsStore } from '@/stores/calendars'
import CategoryPicker from '@/components/CategoryPicker.vue'
import { useFmt } from '@/i18n/dates'
import { today } from '@/lib/dates'
import { eventStart, eventTimeLabel } from '@/lib/calendarEvents'
import type { CalendarEvent, Task, TaskRepeat } from '@/types'

const { t } = useI18n()
const fmt = useFmt()

const props = withDefaults(defineProps<{
  date: string
  tasks: Task[]
  events?: CalendarEvent[]   // connected-calendar events on this day (not counted in done/total)
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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const DAY_MIN = 24 * 60
// wraps past midnight: 27:00 → 03:00
const minToHHMM = (m: number) => { m %= DAY_MIN; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

// task_time = start 'HH:MM', duration_min = (end - start) minutes → render "14:00–15:30";
// an end past midnight gets a "+1" suffix: "22:00–03:00 +1"
function timeLabel(task: Task): string {
  if (!task.task_time) return ''
  const start = task.task_time.slice(0, 5)
  if (!task.duration_min) return start
  const endMin = toMin(start) + task.duration_min
  return `${start}–${minToHHMM(endMin)}${endMin >= DAY_MIN ? ' +1' : ''}`
}

const adding = ref(false)
const newTitle = ref('')
const newNote = ref('')
const newHour = ref('')
const newMin = ref('')
const newEndHour = ref('')
const newEndMin = ref('')
const newRepeat = ref<TaskRepeat>('none')
const selectedCat = ref<string | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

const editingId = ref<string | null>(null)
const editTitle = ref('')
const editCat = ref<string | null>(null)
const editDate = ref('')
const editNote = ref('')
const editHour = ref('')
const editMin = ref('')
const editEndHour = ref('')
const editEndMin = ref('')
const editRepeat = ref<TaskRepeat>('none')

// Minute mirrors the hour: no hour → '--', picking an hour defaults minute to '00'.
watch(newHour, h => { newMin.value = h ? (newMin.value || '00') : '' })
watch(editHour, h => { editMin.value = h ? (editMin.value || '00') : '' })
watch(newEndHour, h => { newEndMin.value = h ? (newEndMin.value || '00') : '' })
watch(editEndHour, h => { editEndMin.value = h ? (editEndMin.value || '00') : '' })
// clearing the start also clears the end
watch(newHour, h => { if (!h) { newEndHour.value = ''; newEndMin.value = '' } })
watch(editHour, h => { if (!h) { editEndHour.value = ''; editEndMin.value = '' } })

// 'HH'+'MM' selects → 'HH:MM' or null when no hour picked
const composeTime = (hour: string, min: string) => (hour ? `${hour}:${min || '00'}` : null)
// minutes between start and end (both 'HH'+'MM'); an end before the start means
// it ends the next day (+24h); equal times → null
function durFrom(start: string | null, endH: string, endM: string): number | null {
  if (!start || !endH) return null
  const diff = toMin(`${endH}:${endM || '00'}`) - toMin(start)
  if (diff === 0) return null
  return diff > 0 ? diff : diff + DAY_MIN
}
// form hint: the picked end is before the start → show "+1" next to "To"
const endsNextDay = (hour: string, min: string, endH: string, endM: string) =>
  !!hour && !!endH && toMin(`${endH}:${endM || '00'}`) < toMin(`${hour}:${min || '00'}`)
const moveOpen = ref(false)
const editEl = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

const catColor = (id: string | null) => categoriesStore.color(id)

function toggleFlag(task: Task) {
  tasksStore.updateTask(task.id, { priority: !task.priority })
}

async function openEdit(task: Task) {
  editingId.value = task.id
  editTitle.value = task.title
  editCat.value = task.category_id
  editDate.value = task.task_date
  editNote.value = task.note ?? ''
  editHour.value = task.task_time ? task.task_time.slice(0, 2) : ''
  editMin.value = task.task_time ? task.task_time.slice(3, 5) : ''
  // end = start + duration
  if (task.task_time && task.duration_min) {
    const end = minToHHMM(toMin(task.task_time.slice(0, 5)) + task.duration_min)
    editEndHour.value = end.slice(0, 2)
    editEndMin.value = end.slice(3, 5)
  } else {
    editEndHour.value = ''
    editEndMin.value = ''
  }
  editRepeat.value = task.repeat ?? 'none'
  moveOpen.value = false
  await nextTick()
  const el = Array.isArray(editEl.value) ? editEl.value[0] : editEl.value
  el?.focus()
}

async function saveEdit(task: Task) {
  const title = editTitle.value.trim()
  if (!title) return
  const start = composeTime(editHour.value, editMin.value)
  const dateChanged = editDate.value && editDate.value !== task.task_date
  await tasksStore.updateTask(task.id, {
    title, category_id: editCat.value, note: editNote.value.trim() || null,
    task_time: start,
    duration_min: durFrom(start, editEndHour.value, editEndMin.value),
    repeat: editRepeat.value,
    ...(dateChanged ? { task_date: editDate.value } : {}),
  })
  editingId.value = null // dateChanged: task moved, leaves this list; otherwise just closes edit form
}

async function applyMove(task: Task) {
  if (editDate.value && editDate.value !== task.task_date) {
    await tasksStore.updateTask(task.id, { task_date: editDate.value })
    editingId.value = null // task moved to another day, leaves this list
  } else {
    moveOpen.value = false
  }
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

// Calendar events: tap shows the source + remove; removing hides the event
// (kept hidden across syncs) with the same inline undo row as tasks.
const openEventId = ref<string | null>(null)
const evTombstones = ref<CalendarEvent[]>([])

const evColor = (ev: CalendarEvent) => catColor(calendarsStore.categoryOf(ev)) ?? 'var(--color-text-tertiary)'
const feedName = (ev: CalendarEvent) => calendarsStore.feeds.find(f => f.id === ev.feed_id)?.name ?? ''

function toggleEvent(ev: CalendarEvent) {
  openEventId.value = openEventId.value === ev.id ? null : ev.id
}

async function removeEvent(ev: CalendarEvent) {
  openEventId.value = null
  const snapshot = { ...ev }
  await calendarsStore.hideEvent(ev)
  emit('deleted', props.date)
  evTombstones.value.push(snapshot)
  tombTimers.set(`ev-${snapshot.id}`, setTimeout(() => {
    evTombstones.value = evTombstones.value.filter(x => x.id !== snapshot.id)
    tombTimers.delete(`ev-${snapshot.id}`)
  }, 5000))
}

async function undoEventTomb(tomb: CalendarEvent) {
  const tmr = tombTimers.get(`ev-${tomb.id}`)
  if (tmr) { clearTimeout(tmr); tombTimers.delete(`ev-${tomb.id}`) }
  evTombstones.value = evTombstones.value.filter(x => x.id !== tomb.id)
  await calendarsStore.restoreEvent(tomb)
}

function cancelEdit() {
  editingId.value = null
}

async function removeTask(task: Task) {
  editingId.value = null
  await deleteWithUndo(task)
}

const isToday = computed(() => props.date === today())
// Add is allowed on today + future days only (past days have no add affordance).
const canAdd = computed(() => props.date >= today())
const dayName = computed(() => fmt.dayName(props.date))
const dateLabel = computed(() => fmt.dayMonthLabel(props.date))
const doneCount = computed(() => props.tasks.filter(t => t.status === 'done').length)
const allDone = computed(() => props.tasks.length > 0 && doneCount.value === props.tasks.length)

async function openAdd() {
  adding.value = true
  await nextTick()
  inputEl.value?.focus()
}

async function submit() {
  const title = newTitle.value.trim()
  if (!title) return
  const start = composeTime(newHour.value, newMin.value)
  await tasksStore.addTask(
    title, props.date, selectedCat.value,
    start,
    durFrom(start, newEndHour.value, newEndMin.value),
    newNote.value.trim() || null,
    newRepeat.value,
  )
  newTitle.value = ''
  newNote.value = ''
  newHour.value = ''
  newMin.value = ''
  newEndHour.value = ''
  newEndMin.value = ''
  newRepeat.value = 'none'
  selectedCat.value = null
  adding.value = false
}

function cancel() {
  newTitle.value = ''
  newNote.value = ''
  newHour.value = ''
  newMin.value = ''
  newEndHour.value = ''
  newEndMin.value = ''
  newRepeat.value = 'none'
  adding.value = false
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

.cat-repeat-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cat-repeat-row > :first-child { flex: 1; min-width: 0; }
.repeat-icon {
  position: relative; flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-tertiary); font-size: 15px; cursor: pointer;
}
.repeat-icon.on { color: var(--color-text-info); background: var(--color-background-info); border-color: transparent; }
.repeat-icon select { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: none; }
.row-text.muted { font-size: 14px; color: var(--color-text-tertiary); }
.trow-add { background: none; border: none; width: 100%; text-align: left; }

.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* connected-calendar event row: calendar glyph in the category color instead of a checkbox */
.ev-mark { width: 22px; height: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; }
.ev-btn { cursor: pointer; }
.ev-detail {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 2px 0 8px 33px;
}
.ev-source { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: 12px; color: var(--color-text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-source i { font-size: 14px; }


.edit-bottom { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 0 5px; }
.edit-actions { width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 0 10%; box-sizing: border-box; }
@media (max-width: 600px) { .edit-actions { padding: 0 5%; } }
.meta-row { display: flex; gap: 10px; }
.field {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 4px;
  height: 38px; padding: 0 10px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
}
.field-label { font-size: 12px; color: var(--color-text-tertiary); flex-shrink: 0; margin-right: 2px; }
.field select {
  border: none; background: var(--color-background-primary); color: var(--color-text-primary);
  font-size: 15px; padding: 0; cursor: pointer; font-family: inherit;
  flex: 1; min-width: 0; text-align: center;
}
.field select:focus { outline: none; }
.field .colon { color: var(--color-text-tertiary); }
.field .next-day { flex-shrink: 0; font-size: 12px; font-weight: 500; color: var(--color-text-info); }
.action-row { display: flex; gap: 10px; }
.action-row > button { flex: 1; justify-content: center; }
.eb-q { font-size: 14px; color: var(--color-text-secondary); }
.date-input {
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  height: 34px; padding: 0 10px; font-size: 14px;
}
.date-input:focus { outline: none; border-color: var(--color-text-info); }

.add-form { display: flex; flex-direction: column; gap: 8px; padding: 6px 0; }
.edit-form {
  border-top: 0.5px solid var(--color-border-secondary);
  border-bottom: 0.5px solid var(--color-border-secondary);
  margin: 4px 0;
  padding: 12px 0 8px;
}
.add-input-row { display: flex; align-items: center; gap: 8px; }
.add-input {
  flex: 1;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  padding: 8px 10px;
  font-size: 15px;
}
.add-input:focus { outline: none; border-color: var(--color-text-info); }
.note-input {
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  padding: 8px 10px; font-size: 14px; font-family: inherit; resize: vertical;
}
.note-input:focus { outline: none; border-color: var(--color-text-info); }
.add-confirm, .add-cancel {
  width: 34px; height: 34px; border-radius: var(--border-radius-md);
  border: none; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.add-confirm { background: var(--color-text-success); color: #fff; }
.add-cancel { background: var(--color-background-tertiary); color: var(--color-text-secondary); }

/* subtle press feedback on tap */
.flag-dot, .add-confirm, .add-cancel, .tomb-undo {
  transition: transform .1s ease, background-color .15s ease, color .15s ease;
}
.flag-dot:active, .add-confirm:active, .add-cancel:active, .tomb-undo:active { transform: scale(0.92); }

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
  .flag-dot, .add-confirm, .add-cancel, .act-btn, .tomb-undo {
    transition: none !important; animation: none !important;
  }
  .row-text.done { text-decoration: line-through; }
  .row-text.done::after { display: none; }
}
</style>
