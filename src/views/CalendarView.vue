<template>
  <div class="cal">
    <!-- header -->
    <header class="head">
      <div class="title">
        <template v-if="mode === 'month'">
          {{ fmt.monthName(anchor.month) }} <span class="year">{{ anchor.year }}</span>
        </template>
        <template v-else>{{ yearAnchor }}</template>
      </div>
      <div class="actions">
        <div class="seg">
          <button :class="{ on: mode === 'month' }" @click="setMode('month')">{{ t('cal.month') }}</button>
          <button :class="{ on: mode === 'year' }" @click="setMode('year')">{{ t('cal.year') }}</button>
        </div>
        <button class="today-btn" @click="goToday">{{ t('cal.today') }}</button>
      </div>
    </header>

    <!-- MONTH MODE -->
    <template v-if="mode === 'month'">
      <div class="calm-wd">
        <span v-for="(w, i) in fmt.weekdayShort()" :key="i">{{ w }}</span>
      </div>
      <div ref="scroller" class="scroll" @scroll.passive="onMonthScroll">
        <div ref="topSentM" class="sentinel"></div>
        <section
          v-for="m in monthList"
          :key="m.key"
          :ref="el => registerMonth(m.key, el)"
          class="month"
        >
          <div class="month-label" :class="{ cur: m.isCurrent }">{{ fmt.monthName(m.month) }} {{ m.year }}</div>
          <div class="calm-grid">
            <div v-for="(cell, i) in monthCells(m.year, m.month)" :key="i" class="calm-cell-wrap">
              <button v-if="cell" class="calm-cell" @click="openDay(cell.date)">
                <div class="calm-num" :class="{ t: cell.isToday }">{{ cell.day }}</div>
                <div class="calm-meta">
                  <span v-if="cell.status !== 'none'" class="calm-dot" :style="{ background: STATUS_COLOR[cell.status] }"></span>
                  <span v-if="cell.count" class="calm-cnt">{{ cell.count }}</span>
                </div>
              </button>
              <div v-else class="calm-cell"></div>
            </div>
          </div>
        </section>
        <div ref="botSentM" class="sentinel"></div>
      </div>
    </template>

    <!-- YEAR MODE -->
    <div v-else ref="yearScroller" class="scroll year-scroll" @scroll.passive="onYearScroll">
      <div ref="topSentY" class="sentinel"></div>
      <section v-for="y in yearList" :key="y" :ref="el => registerYear(y, el)" class="year-block">
        <div class="year-heading" :class="{ cur: y === todayY }">{{ y }}</div>
        <div class="yr2">
          <div v-for="(mo, mi) in 12" :key="mi" :ref="el => registerCur(y, mi, el)">
            <button class="yr2-lab" :class="{ cur: y === todayY && mi === todayM }" @click="openMonth(y, mi)">
              {{ fmt.monthName(mi) }}
            </button>
            <div class="yr2-g">
              <div v-for="(cell, i) in monthCells(y, mi)" :key="i" class="yr2-c">
                <template v-if="cell">
                  <span class="yr2-n" :class="{ t: cell.isToday }">{{ cell.day }}</span>
                  <span v-if="cell.status !== 'none'" class="yr2-d" :style="{ background: STATUS_COLOR[cell.status] }"></span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div ref="botSentY" class="sentinel"></div>
    </div>

    <!-- DAY DETAIL SHEET -->
    <transition name="sheet">
      <div v-if="sheetDate" class="sheet-backdrop" @click.self="sheetDate = null">
        <div class="sheet">
          <div class="sheet-grip"></div>
          <div class="sheet-head">
            <div class="sheet-title">{{ sheetTitle }}</div>
            <button class="icon-btn" @click="sheetDate = null" :aria-label="t('cat.closeAria')" :title="t('cat.closeAria')"><i class="ti ti-x"></i></button>
          </div>
          <DayList v-if="sheetDate" :date="sheetDate" :tasks="sheetTasks" :events="sheetEvents" :show-header="false" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DayList from '@/components/DayList.vue'
import { useTasksStore } from '@/stores/tasks'
import { useCalendarsStore } from '@/stores/calendars'
import { useFmt } from '@/i18n/dates'
import { parseYmd, today, ymd } from '@/lib/dates'
import { STATUS_COLOR, dayStatus, type DayStatus } from '@/lib/status'
import { byDayOrder } from '@/lib/sortTasks'
import { eventOnDay } from '@/lib/calendarEvents'

const { t } = useI18n()
const fmt = useFmt()
const tasksStore = useTasksStore()
const calendarsStore = useCalendarsStore()

const mode = ref<'month' | 'year'>('month')
const todayStr = today()
const todayDate = parseYmd(todayStr)
const todayY = todayDate.getFullYear()
const todayM = todayDate.getMonth()

const anchor = ref({ year: todayY, month: todayM })
const yearAnchor = ref(todayY)

const sheetDate = ref<string | null>(null)

// ─── Cell builder ─────────────────────────────────────────────────────────

interface Cell { day: number; date: string; isToday: boolean; status: DayStatus; count: number }

function monthCells(year: number, month: number): (Cell | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const len = new Date(year, month + 1, 0).getDate()
  const cells: (Cell | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= len; d++) {
    const date = ymd(new Date(year, month, d))
    const dayTasks = tasksStore.tasks.filter(t => t.task_date === date)
    cells.push({ day: d, date, isToday: date === todayStr, status: dayStatus(dayTasks, date, todayStr), count: dayTasks.length })
  }
  return cells
}

// ─── Month infinite scroll ────────────────────────────────────────────────

interface MonthItem { key: string; year: number; month: number; isCurrent: boolean }

const CHUNK = 3

function makeMonth(off: number): MonthItem {
  const d = new Date(todayY, todayM + off, 1)
  const year = d.getFullYear(), month = d.getMonth()
  return { key: `${year}-${month}`, year, month, isCurrent: year === todayY && month === todayM }
}

function monthOff(item: MonthItem): number {
  return (item.year - todayY) * 12 + (item.month - todayM)
}

const monthList = ref<MonthItem[]>(Array.from({ length: 13 }, (_, i) => makeMonth(i - 6)))

// Track the loaded DB range so we always fetch the cumulative span.
let loadedFrom = ymd(new Date(todayY, todayM - 6, 1))
let loadedTo = ymd(new Date(todayY, todayM + 7, 0))

async function extendFetch(from: string, to: string) {
  const newFrom = from < loadedFrom ? from : loadedFrom
  const newTo   = to   > loadedTo   ? to   : loadedTo
  if (newFrom !== loadedFrom || newTo !== loadedTo) {
    loadedFrom = newFrom
    loadedTo   = newTo
    await tasksStore.fetchRange(loadedFrom, loadedTo)
  }
}

const scroller    = ref<HTMLElement | null>(null)
const topSentM    = ref<HTMLElement | null>(null)
const botSentM    = ref<HTMLElement | null>(null)
const monthEls    = new Map<string, HTMLElement>()

function registerMonth(key: string, el: unknown) {
  if (el) monthEls.set(key, (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement))
}

function prependMonths() {
  mObs?.disconnect()
  const off = monthOff(monthList.value[0])
  const items = Array.from({ length: CHUNK }, (_, i) => makeMonth(off - CHUNK + i))
  const sh = scroller.value?.scrollHeight ?? 0
  const st = scroller.value?.scrollTop ?? 0
  monthList.value.unshift(...items)
  nextTick(() => requestAnimationFrame(() => {
    if (scroller.value) scroller.value.scrollTop = st + (scroller.value.scrollHeight - sh)
    setupObservers()
  }))
  const first = items[0]
  extendFetch(ymd(new Date(first.year, first.month, 1)), ymd(new Date(items[CHUNK - 1].year, items[CHUNK - 1].month + 1, 0)))
}

function appendMonths() {
  const off = monthOff(monthList.value[monthList.value.length - 1])
  const items = Array.from({ length: CHUNK }, (_, i) => makeMonth(off + 1 + i))
  monthList.value.push(...items)
  const last = items[CHUNK - 1]
  extendFetch(ymd(new Date(items[0].year, items[0].month, 1)), ymd(new Date(last.year, last.month + 1, 0)))
}

function onMonthScroll() {
  if (!scroller.value) return
  const scrollerRect = scroller.value.getBoundingClientRect()
  for (const item of monthList.value) {
    const el = monthEls.get(item.key)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.bottom > scrollerRect.top + 1) {
      anchor.value = { year: item.year, month: item.month }
      break
    }
  }
}

// ─── Year infinite scroll ─────────────────────────────────────────────────

const yearList    = ref<number[]>([todayY - 2, todayY - 1, todayY, todayY + 1, todayY + 2])
const yearScroller = ref<HTMLElement | null>(null)
const topSentY    = ref<HTMLElement | null>(null)
const botSentY    = ref<HTMLElement | null>(null)
const yearEls     = new Map<number, HTMLElement>()
const curMonthEl  = ref<HTMLElement | null>(null)

function registerYear(y: number, el: unknown) {
  if (el) yearEls.set(y, (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement))
}

function registerCur(year: number, month: number, el: unknown) {
  if (el && year === todayY && month === todayM) curMonthEl.value = el as HTMLElement
}

function prependYears() {
  yObs?.disconnect()
  const first = yearList.value[0]
  const sh = yearScroller.value?.scrollHeight ?? 0
  const st = yearScroller.value?.scrollTop ?? 0
  yearList.value.unshift(first - 1)
  nextTick(() => requestAnimationFrame(() => {
    if (yearScroller.value) yearScroller.value.scrollTop = st + (yearScroller.value.scrollHeight - sh)
    setupObservers()
  }))
  extendFetch(ymd(new Date(first - 1, 0, 1)), ymd(new Date(first - 1, 11, 31)))
}

function appendYears() {
  const last = yearList.value[yearList.value.length - 1]
  yearList.value.push(last + 1)
  extendFetch(ymd(new Date(last + 1, 0, 1)), ymd(new Date(last + 1, 11, 31)))
}

function onYearScroll() {
  if (!yearScroller.value) return
  const scrollerRect = yearScroller.value.getBoundingClientRect()
  for (const y of yearList.value) {
    const el = yearEls.get(y)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.bottom > scrollerRect.top + 1) {
      yearAnchor.value = y
      break
    }
  }
}

// ─── IntersectionObservers ────────────────────────────────────────────────

let mObs: IntersectionObserver | null = null
let yObs: IntersectionObserver | null = null

function setupObservers() {
  mObs?.disconnect()
  yObs?.disconnect()

  if (mode.value === 'month' && scroller.value && topSentM.value && botSentM.value) {
    mObs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        if (e.target === topSentM.value) prependMonths()
        else appendMonths()
      }
    }, { root: scroller.value, rootMargin: '400px' })
    mObs.observe(topSentM.value)
    mObs.observe(botSentM.value)
  }

  if (mode.value === 'year' && yearScroller.value && topSentY.value && botSentY.value) {
    yObs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        if (e.target === topSentY.value) prependYears()
        else appendYears()
      }
    }, { root: yearScroller.value, rootMargin: '400px' })
    yObs.observe(topSentY.value)
    yObs.observe(botSentY.value)
  }
}

onUnmounted(() => { mObs?.disconnect(); yObs?.disconnect() })

// ─── Navigation ───────────────────────────────────────────────────────────

function scrollToMonth(key: string) {
  monthEls.get(key)?.scrollIntoView({ block: 'start' })
}

function scrollToCurrentInYear() {
  nextTick(() => curMonthEl.value?.scrollIntoView({ block: 'center' }))
}

function openDay(date: string) { sheetDate.value = date }

function openMonth(year: number, month: number) {
  anchor.value = { year, month }
  mode.value = 'month'
  nextTick(() => scrollToMonth(`${year}-${month}`))
}

function setMode(m: 'month' | 'year') {
  mode.value = m
  nextTick(() => {
    setupObservers()
    if (m === 'year') scrollToCurrentInYear()
  })
}

function goToday() {
  if (mode.value === 'month') {
    anchor.value = { year: todayY, month: todayM }
    // ensure today's month is in the list
    const key = `${todayY}-${todayM}`
    if (!monthList.value.find(m => m.key === key)) {
      monthList.value = Array.from({ length: 13 }, (_, i) => makeMonth(i - 6))
    }
    nextTick(() => scrollToMonth(key))
  } else {
    yearAnchor.value = todayY
    if (!yearList.value.includes(todayY)) {
      yearList.value = [todayY - 2, todayY - 1, todayY, todayY + 1, todayY + 2]
    }
    scrollToCurrentInYear()
  }
}

// ─── Sheet ────────────────────────────────────────────────────────────────

const sheetTasks = computed(() =>
  sheetDate.value
    ? tasksStore.tasks.filter(t => t.task_date === sheetDate.value).sort(byDayOrder)
    : [])
// connected-calendar events are loaded per opened day (they don't affect grid dots/counts)
const sheetEvents = computed(() =>
  sheetDate.value ? calendarsStore.events.filter(e => eventOnDay(e, sheetDate.value!)) : [])
watch(sheetDate, d => { if (d) calendarsStore.fetchRange(d, d).catch(e => console.error(e)) })
const sheetTitle = computed(() => (sheetDate.value ? fmt.fullDate(sheetDate.value) : ''))

// ─── Init ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  calendarsStore.init()
  await tasksStore.fetchRange(loadedFrom, loadedTo)
  nextTick(() => {
    scrollToMonth(`${todayY}-${todayM}`)
    setupObservers()
  })
})
</script>

<style scoped>
.cal { display: flex; flex-direction: column; height: 100%; }
.head { padding: 6px 18px 10px; display: flex; align-items: flex-end; justify-content: space-between; }
.title { font-size: 24px; font-weight: 500; }
.title .year { color: var(--color-text-secondary); font-weight: 400; }
.actions { display: flex; gap: 8px; align-items: center; }
.seg { display: flex; background: var(--color-background-tertiary); border-radius: 9px; padding: 2px; }
.seg button {
  border: none; background: none; font-size: 12px; color: var(--color-text-secondary);
  padding: 4px 9px; border-radius: 7px; cursor: pointer;
}
.seg button.on { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; }
.today-btn {
  font-size: 13px; color: var(--color-text-info);
  padding: 6px 12px; border: 0.5px solid var(--color-border-tertiary);
  border-radius: 9px; background: none; cursor: pointer;
}

.scroll { flex: 1; overflow-y: auto; overflow-anchor: none; }
.sentinel { height: 1px; }

.month { padding: 0 4px; }
.month-label {
  padding: 12px 14px 6px; font-size: 15px; color: var(--color-text-tertiary);
  border-top: 0.5px solid var(--color-border-tertiary);
}
.month:first-child .month-label { border-top: none; }
.month-label.cur { color: var(--color-text-danger); }
.calm-cell-wrap { display: flex; }
.calm-cell-wrap > .calm-cell { width: 100%; }

.year-scroll { padding: 0 16px 16px; }
.year-heading { font-size: 26px; font-weight: 500; padding: 16px 2px 12px; }
.year-heading.cur { color: var(--color-text-danger); }
.year-block + .year-block .year-heading { border-top: 0.5px solid var(--color-border-tertiary); margin-top: 8px; }

/* day sheet */
.sheet-backdrop {
  position: absolute; inset: 0; z-index: 20;
  background: rgba(0,0,0,0.35);
  display: flex; align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--color-background-primary);
  border-radius: 18px 18px 0 0;
  padding: 8px 0 max(16px, env(safe-area-inset-bottom));
  max-height: 80%; overflow-y: auto;
}
.sheet-grip { width: 36px; height: 5px; border-radius: 3px; background: var(--color-border-secondary); margin: 6px auto 4px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px 4px; }
.sheet-title { font-size: 17px; font-weight: 500; text-transform: capitalize; }

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
