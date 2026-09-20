<template>
  <div ref="rootEl" class="home">
    <!-- collapsing sticky strip (shown once the full week header scrolls away) -->
    <div class="strip" :class="{ show: collapsed }">
      <div class="strip-info">
        <span class="strip-title">{{ weekTitle }} · <span class="green">{{ doneCount }}</span>/{{ totalCount }}</span>
        <span class="strip-range">{{ rangeLabel }}</span>
      </div>
      <div class="strip-nav">
        <button class="icon-btn" @click="shiftWeek(-1)" :aria-label="t('home.prevWeekAria')" :title="t('home.prevWeekAria')"><i class="ti ti-chevron-left"></i></button>
        <button class="icon-btn" @click="shiftWeek(1)" :aria-label="t('home.nextWeekAria')" :title="t('home.nextWeekAria')"><i class="ti ti-chevron-right"></i></button>
      </div>
      <div class="strip-progress"><div :style="{ width: progressPercent + '%' }"></div></div>
    </div>

    <!-- title + week nav -->
    <header class="head">
      <div>
        <div class="title">{{ weekTitle }}</div>
        <div class="range">{{ rangeLabel }}</div>
      </div>
      <div class="wk-nav">
        <button class="icon-btn" @click="shiftWeek(-1)" :aria-label="t('home.prevWeekAria')" :title="t('home.prevWeekAria')"><i class="ti ti-chevron-left"></i></button>
        <button class="icon-btn" @click="shiftWeek(1)" :aria-label="t('home.nextWeekAria')" :title="t('home.nextWeekAria')"><i class="ti ti-chevron-right"></i></button>
        <div class="add-wrap">
          <button
            class="icon-btn accent"
            @click="addMenu = !addMenu"
            :aria-label="t('home.addItemAria')"
            :title="t('home.addItemAria')"
            aria-haspopup="menu"
            :aria-expanded="addMenu"
          ><i class="ti ti-plus"></i></button>
          <template v-if="addMenu">
            <div class="menu-scrim" @click="addMenu = false"></div>
            <div class="add-menu" role="menu">
              <button role="menuitem" @click="addMenu = false; quickAdd()">
                <i class="ti ti-circle-plus"></i>{{ t('home.add') }}
              </button>
              <button role="menuitem" @click="addMenu = false; calSheet = true">
                <i class="ti ti-calendar-plus"></i>{{ t('ics.connect') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </header>

    <!-- week progress -->
    <section class="wk-progress">
      <div class="progress-head">
        <span class="progress-label">{{ t('home.doneThisWeek') }}</span>
        <span class="progress-num"><span class="green">{{ doneCount }}</span> / {{ totalCount }}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </section>

    <!-- mini 7-day bar chart -->
    <section class="chart">
      <div v-for="day in weekDays" :key="day.date" class="chart-col">
        <div class="bar-area">
          <div v-if="day.total === 0" class="bar-empty"></div>
          <div v-else class="bar" :style="{ height: barHeight(day.total) + 'px' }">
            <div
              v-for="seg in barSegments(day.tasks)"
              :key="seg.key"
              class="bar-seg"
              :class="{ todo: !seg.done }"
              :style="{ background: seg.color }"
            ></div>
          </div>
        </div>
        <span class="chart-label" :class="{ red: day.isToday }">{{ fmt.dayLetters()[day.idx] }}</span>
      </div>
    </section>

    <!-- category filter -->
    <section v-if="categoriesStore.categories.length" class="filters">
      <div class="chips" ref="chipsEl" @wheel="onChipsWheel">
        <button class="chip" :class="{ on: selectedCats.size === 0 }" @click="selectedCats = new Set()">{{ t('cat.all') }}</button>
        <button
          v-for="c in categoriesStore.categories"
          :key="c.id"
          class="chip"
          :class="{ on: selectedCats.has(c.id) }"
          @click="toggleCat(c.id)"
        >
          <span class="cat-dot" :style="{ background: c.color }"></span>{{ c.name }}
        </button>
      </div>
      <button class="manage" @click="catSheet = true" :aria-label="t('cat.manage')" :title="t('cat.manage')"><i class="ti ti-adjustments-horizontal"></i></button>
    </section>

    <!-- overdue (incomplete past tasks), only while viewing the current week -->
    <OverdueSection v-if="isThisWeek" />

    <!-- empty state when a category filter matches nothing this week -->
    <div v-if="selectedCats.size > 0 && totalCount === 0 && !eventCount" class="empty-state">
      <i class="ti ti-mood-empty"></i>
      <span>{{ t('empty.noTasksCategory') }}</span>
    </div>

    <!-- agenda Po → Ne -->
    <section v-else class="agenda">
      <template v-for="day in weekDays" :key="day.date">
        <div class="agenda-day">
          <DayList
            v-if="day.full"
            :ref="el => registerDay(day, el)"
            :date="day.date"
            :tasks="day.tasks"
            :events="day.events"
            @deleted="keepDayOpen"
          />
          <button
            v-else-if="day.isFuture"
            type="button"
            class="compact"
            @click="expandDay(day.date)"
          >
            <div class="day-title">
              <span class="day-name">{{ fmt.dayName(day.date) }}</span>
              <span class="day-date">{{ day.label }}</span>
            </div>
            <span class="add-hint"><i class="ti ti-plus"></i>{{ t('home.add') }}</span>
          </button>
          <div v-else class="compact past">
            <div class="day-title">
              <span class="day-name muted">{{ fmt.dayName(day.date) }}</span>
              <span class="day-date">{{ day.label }}</span>
            </div>
          </div>
        </div>
      </template>
    </section>

    <CategoriesSheet v-model="catSheet" />
    <ConnectCalendarSheet v-model="calSheet" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DayList from '@/components/DayList.vue'
import OverdueSection from '@/components/OverdueSection.vue'
import CategoriesSheet from '@/components/CategoriesSheet.vue'
import ConnectCalendarSheet from '@/components/ConnectCalendarSheet.vue'
import { useTasksStore } from '@/stores/tasks'
import { useCategoriesStore } from '@/stores/categories'
import { useCalendarsStore } from '@/stores/calendars'
import { useFmt } from '@/i18n/dates'
import { addDays, getMonday, today } from '@/lib/dates'
import { byDayOrder } from '@/lib/sortTasks'
import { eventOnDay } from '@/lib/calendarEvents'
import { NO_CAT_COLOR } from '@/lib/dayColors'
import type { Task } from '@/types'

const { t } = useI18n()
const fmt = useFmt()
const tasksStore = useTasksStore()
const categoriesStore = useCategoriesStore()
const calendarsStore = useCalendarsStore()

const monday = ref(getMonday(new Date()))
const expanded = ref<Set<string>>(new Set())
const selectedCats = ref<Set<string>>(new Set()) // empty = all categories
function toggleCat(id: string) {
  const s = new Set(selectedCats.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedCats.value = s
}
const isThisWeek = computed(() => monday.value === getMonday(today()))
const catSheet = ref(false)
const calSheet = ref(false)
const addMenu = ref(false)
const dayRefs = new Map<string, InstanceType<typeof DayList>>()

const rangeLabel = computed(() => fmt.weekRange(monday.value))
const weekTitle = computed(() => {
  const cur = getMonday(new Date())
  if (monday.value === cur) return t('home.thisWeek')
  return monday.value < cur ? t('home.lastWeek') : t('home.nextWeek')
})

// tasks for the current category filter (empty selection = all; otherwise OR)
const filteredTasks = computed(() =>
  selectedCats.value.size === 0
    ? tasksStore.tasks
    : tasksStore.tasks.filter(t => t.category_id !== null && selectedCats.value.has(t.category_id)))

// events, same category filter (manual events carry their own category, feed events the feed's)
const filteredEvents = computed(() =>
  selectedCats.value.size === 0
    ? calendarsStore.events
    : calendarsStore.events.filter(e => {
      const c = calendarsStore.categoryOf(e)
      return c !== null && selectedCats.value.has(c)
    }))

const weekDays = computed(() => {
  const t = today()
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday.value, i)
    const tasks = filteredTasks.value
      .filter(task => task.task_date === date)
      .sort(byDayOrder)
    const events = filteredEvents.value.filter(e => eventOnDay(e, date))
    const isToday = date === t
    const isFuture = date > t
    const full = tasks.length > 0 || events.length > 0 || isToday || expanded.value.has(date)
    return {
      idx: i, date, tasks, events, isToday, isFuture,
      label: fmt.dayMonthLabel(date),
      total: tasks.length,
      done: tasks.filter(task => task.status === 'done').length,
      full,
    }
  })
})

const totalCount = computed(() => weekDays.value.reduce((s, d) => s + d.total, 0))
const doneCount = computed(() => weekDays.value.reduce((s, d) => s + d.done, 0))
const eventCount = computed(() => weekDays.value.reduce((s, d) => s + d.events.length, 0))
const progressPercent = computed(() => totalCount.value ? Math.round(doneCount.value / totalCount.value * 100) : 0)

const maxTotal = computed(() => Math.max(1, ...weekDays.value.map(d => d.total)))
const BAR_MAX = 56
function barHeight(total: number) { return Math.max(8, Math.round(total / maxTotal.value * BAR_MAX)) }
// One segment per task, colored by its category (uncategorized = neutral):
// done ones solid at the bottom, the rest dimmed above, so the bar still reads
// as "this much of the day is done". Segments flex evenly, so no rounding drift.
const catRank = (id: string | null) => {
  const i = id ? categoriesStore.categories.findIndex(c => c.id === id) : -1
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

function barSegments(tasks: Task[]) {
  const byCat = (a: Task, b: Task) => catRank(a.category_id) - catRank(b.category_id)
  const part = (done: boolean) =>
    tasks.filter(t => (t.status === 'done') === done).sort(byCat)
      .map(t => ({ key: t.id, done, color: categoriesStore.color(t.category_id) ?? NO_CAT_COLOR }))
  return [...part(false), ...part(true)]
}

function registerDay(day: { date: string; isToday: boolean }, el: unknown) {
  if (el) dayRefs.set(day.date, el as InstanceType<typeof DayList>)
}

function expandDay(date: string) {
  expanded.value.add(date)
  requestAnimationFrame(() => dayRefs.get(date)?.openAdd())
}

// keep a day mounted (e.g. while an undo row shows) without opening the add form
function keepDayOpen(date: string) {
  expanded.value.add(date)
}

function quickAdd() {
  if (monday.value !== getMonday(new Date())) monday.value = getMonday(new Date())
  requestAnimationFrame(() => dayRefs.get(today())?.openAdd())
}

async function load() {
  expanded.value = new Set()
  calendarsStore.fetchRange(monday.value, addDays(monday.value, 6)).catch(e => console.error(e))
  await tasksStore.fetchRange(monday.value, addDays(monday.value, 6))
  // overdue is a side section: a failure (e.g. migration not run) mustn't break the week
  if (isThisWeek.value) tasksStore.fetchOverdue().catch(e => console.error(e))
}

function shiftWeek(dir: number) {
  monday.value = addDays(monday.value, dir * 7)
  load()
}


// desktop: vertical wheel scrolls the category filter row horizontally
const chipsEl = ref<HTMLElement | null>(null)
function onChipsWheel(e: WheelEvent) {
  const el = chipsEl.value
  if (!el || el.scrollWidth <= el.clientWidth || e.deltaY === 0) return
  el.scrollLeft += e.deltaY
  e.preventDefault()
}

// collapsing header: watch the scroll container
const rootEl = ref<HTMLElement | null>(null)
const collapsed = ref(false)
let scroller: HTMLElement | null = null
function onScroll() { if (scroller) collapsed.value = scroller.scrollTop > 150 }

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') addMenu.value = false }

onMounted(() => {
  calendarsStore.init()
  load()
  window.addEventListener('keydown', onKey)
  scroller = rootEl.value?.closest('.app-main') as HTMLElement | null
  scroller?.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  scroller?.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.home { padding-bottom: 16px; }

/* collapsing sticky strip */
.strip {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 46px;
  margin-bottom: -46px; /* cancel flow height so it never pushes content */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
  background: color-mix(in srgb, var(--color-background-primary) 88%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid var(--color-border-tertiary);
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
  transition: transform .2s ease, opacity .2s ease;
}
.strip.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
.strip-info { display: flex; flex-direction: column; gap: 1px; }
.strip-title { font-size: 14px; font-weight: 500; line-height: 1.2; }
.strip-range { font-size: 11px; color: var(--color-text-tertiary); line-height: 1; }
.strip-nav { display: flex; gap: 6px; }
.strip-progress { position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; }
.strip-progress > div { height: 100%; background: var(--color-text-success); }


.head { padding: 12px 18px 10px; display: flex; align-items: flex-start; justify-content: space-between; }
.title { font-size: 22px; font-weight: 500; line-height: 1.1; }
.range { font-size: 13px; color: var(--color-text-secondary); margin-top: 3px; }
.wk-nav { display: flex; gap: 6px; align-items: center; }

/* "+" menu: add activity / connect calendar */
.add-wrap { position: relative; }
.menu-scrim { position: fixed; inset: 0; z-index: 25; }
.add-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 26;
  min-width: 210px; padding: 4px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  transform-origin: top right;
  animation: menu-in .14s ease;
}
.add-menu button {
  width: 100%; display: flex; align-items: center; gap: 10px;
  border: none; background: none; cursor: pointer; text-align: left;
  padding: 9px 10px; border-radius: 8px;
  font-size: 15px; color: var(--color-text-primary);
}
.add-menu button + button { box-shadow: inset 0 0.5px 0 var(--color-border-tertiary); }
.add-menu button:hover, .add-menu button:active { background: var(--color-background-secondary); }
.add-menu i { font-size: 18px; color: var(--color-text-info); }
@keyframes menu-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .add-menu { animation: none; } }

.wk-progress { padding: 0 18px 12px; }
.progress-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 7px; }
.progress-label { font-size: 13px; color: var(--color-text-secondary); }
.progress-num { font-size: 14px; font-weight: 500; }
.green { color: var(--color-text-success); }
.progress-track { height: 8px; border-radius: 6px; background: var(--color-background-tertiary); overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-text-success); transition: width .3s ease; }

.chart { padding: 2px 16px 14px; display: flex; justify-content: space-between; align-items: flex-end; }
.chart-col { display: flex; flex-direction: column; align-items: center; gap: 7px; flex: 1; }
.bar-area { height: 60px; display: flex; align-items: flex-end; }
.bar { width: 16px; border-radius: 5px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.bar-seg { flex: 1; min-height: 0; }
.bar-seg.todo { opacity: .5; }
.bar-empty { width: 4px; height: 4px; border-radius: 50%; background: var(--color-border-tertiary); }
.chart-label { font-size: 12px; color: var(--color-text-tertiary); }
.chart-label.red { color: var(--color-text-danger); font-weight: 500; }

/* category filter */
.filters { display: flex; align-items: center; gap: 8px; padding: 0 18px 12px; }
.chips { display: flex; gap: 6px; overflow-x: auto; flex: 1; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  border: 0.5px solid var(--color-border-secondary);
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  border-radius: 14px; padding: 4px 11px; font-size: 12px; cursor: pointer;
}
.chip.on { background: var(--color-background-info); border-color: transparent; color: var(--color-text-info); }
.cat-dot { width: 8px; height: 8px; border-radius: 50%; }
.manage {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%;
  border: 0.5px solid var(--color-border-tertiary); background: none;
  color: var(--color-text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 48px 24px; text-align: center;
  color: var(--color-text-tertiary); font-size: 14px;
  border-top: 0.5px solid var(--color-border-tertiary);
}
.empty-state i { font-size: 30px; }

.agenda-day { border-top: 0.5px solid var(--color-border-tertiary); }

.compact {
  width: 100%;
  padding: 12px 18px;
  display: flex; align-items: center; justify-content: space-between;
  background: none; border: none; cursor: pointer;
}
.compact.past { cursor: default; }
.day-title { display: flex; align-items: baseline; gap: 8px; }
.day-name { font-size: 16px; font-weight: 500; color: var(--color-text-primary); }
.day-name.muted { color: var(--color-text-secondary); }
.day-date { font-size: 13px; color: var(--color-text-tertiary); }
.add-hint { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--color-text-tertiary); }
</style>
