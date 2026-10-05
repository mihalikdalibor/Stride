<template>
  <div class="stats">
    <div class="top">
      <div class="seg">
        <button v-for="p in periods" :key="p" :class="{ on: period === p }" @click="setPeriod(p)">
          {{ t('stats.' + p) }}
        </button>
      </div>
      <!-- custom period: applied on change (not per keystroke), normalized -->
      <div v-if="period === 'custom'" class="range-row">
        <input
          type="date"
          class="range-input"
          :value="customRange.from"
          :min="bounds.from"
          :max="bounds.to"
          :aria-label="t('stats.rangeFrom')"
          :title="t('stats.rangeFrom')"
          @change="onRangeChange('from', $event)"
        >
        <span class="range-sep">–</span>
        <input
          type="date"
          class="range-input"
          :value="customRange.to"
          :min="bounds.from"
          :max="bounds.to"
          :aria-label="t('stats.rangeTo')"
          :title="t('stats.rangeTo')"
          @change="onRangeChange('to', $event)"
        >
      </div>
      <!-- category filter: applies to everything below (incl. streaks + goal) -->
      <div v-if="categoriesStore.categories.length" class="stats-filter">
        <CategoryFilter v-model="statsSelectedCats" with-none />
      </div>
    </div>

    <!-- metric cards -->
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">{{ t('stats.doneIn', { label: periodLabel }) }}</div>
        <div class="metric-value">{{ periodDone }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">{{ t('stats.completion') }}</div>
        <div class="metric-value green">{{ completion }} %</div>
      </div>
      <div class="metric">
        <div class="metric-label">{{ t('stats.currentStreak') }}</div>
        <div class="metric-value flame"><i class="ti ti-flame"></i>{{ t('stats.days', { n: currentStreak }) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">{{ t('stats.longestStreak') }}</div>
        <div class="metric-value">{{ t('stats.days', { n: longestStreak }) }}</div>
      </div>
    </div>

    <!-- weekly goal (set in Settings; progress over the current ISO week) -->
    <div class="goal-card">
      <div class="goal-head">
        <span class="goal-label">{{ t('stats.weeklyGoal') }}</span>
        <span class="goal-num" :class="{ reached: weekDone >= weeklyGoal }">{{ weekDone }} / {{ weeklyGoal }}</span>
      </div>
      <div class="goal-track">
        <div class="goal-fill" :class="{ reached: weekDone >= weeklyGoal }" :style="{ width: goalPct + '%' }"></div>
      </div>
    </div>

    <!-- period bar chart (count ↔ completion %) -->
    <section class="block">
      <div class="block-head">
        <span class="block-title">{{ chartTitle }}</span>
        <div class="seg seg-sm">
          <button :class="{ on: chartMode === 'count' }" @click="chartMode = 'count'">{{ t('stats.count') }}</button>
          <button :class="{ on: chartMode === 'percent' }" @click="chartMode = 'percent'">%</button>
        </div>
      </div>
      <template v-if="hasChartData">
        <div class="chart-wrap">
          <Bar :data="chartData" :options="chartOptions" :plugins="[valueLabels]" />
        </div>
        <div v-if="insight" class="insight">{{ insight }}</div>
      </template>
      <div v-else class="empty-state">
        <i class="ti ti-chart-bar-off"></i>
        <span>{{ t('empty.noStats') }}</span>
      </div>
    </section>

    <!-- category breakdown -->
    <section class="block bordered">
      <div class="block-head">
        <span class="block-title">{{ t('stats.byCategory') }}</span>
        <div class="seg seg-sm">
          <button :class="{ on: catMode === 'count' }" @click="catMode = 'count'">{{ t('stats.count') }}</button>
          <button :class="{ on: catMode === 'hours' }" @click="catMode = 'hours'">{{ t('stats.hours') }}</button>
        </div>
      </div>
      <template v-if="catBreakdown.length">
        <!-- one row per top-level category (subcategories summed in); a row
             with subcategories expands to show them -->
        <template v-for="c in catBreakdown" :key="c.id">
          <div class="cat-row">
            <button
              v-if="c.children.length"
              type="button"
              class="cat-name cat-expand"
              :aria-expanded="expandedCats.has(c.id)"
              @click="toggleExpand(c.id)"
              :title="c.name"
            ><i class="ti" :class="expandedCats.has(c.id) ? 'ti-chevron-down' : 'ti-chevron-right'"></i><span class="cat-expand-text">{{ c.name }}</span></button>
            <span v-else class="cat-name" :title="c.name">{{ c.name }}</span>
            <div class="cat-track"><div class="cat-fill" :style="{ width: c.pct + '%', background: c.color }"></div></div>
            <span class="cat-val">{{ c.label }}</span>
          </div>
          <template v-if="c.children.length && expandedCats.has(c.id)">
            <div v-for="sc in c.children" :key="sc.id" class="cat-row sub">
              <span class="cat-name" :title="sc.name">{{ sc.name }}</span>
              <div class="cat-track"><div class="cat-fill" :style="{ width: sc.pct + '%', background: sc.color }"></div></div>
              <span class="cat-val">{{ sc.label }}</span>
            </div>
          </template>
        </template>
      </template>
      <p v-else class="block-note">{{ t('stats.noneDone') }}</p>
    </section>
    <!-- (category management lives on Home) -->

    <!-- activity heatmap (long-range, period-independent) -->
    <section class="block bordered">
      <div class="block-title">{{ t('stats.activity') }}</div>
      <div class="heat-wrap">
        <div class="heat-days">
          <span class="heat-days-spacer"></span>
          <span v-for="i in 7" :key="i">{{ [1, 3, 5].includes(i) ? dayLabels[i - 1] : '' }}</span>
        </div>
        <div ref="heatEl" class="heat-scroll">
          <div class="heat-months">
            <span v-for="(w, wi) in heatWeeks" :key="wi" class="heat-month">{{ heatMonthLabel(wi) }}</span>
          </div>
          <div class="heat-grid">
            <div v-for="(week, wi) in heatWeeks" :key="wi" class="heat-col">
              <div
                v-for="(day, di) in week"
                :key="di"
                class="heat-cell"
                :style="{ background: heatColor(day.level) }"
                :title="day.future ? '' : `${day.date}: ${day.count}`"
              ></div>
            </div>
          </div>
        </div>
      </div>
      <div class="heat-legend">
        <span>{{ t('stats.less') }}</span>
        <span class="heat-cell" :style="{ background: heatColor(0) }"></span>
        <span class="heat-cell" :style="{ background: heatColor(1) }"></span>
        <span class="heat-cell" :style="{ background: heatColor(2) }"></span>
        <span class="heat-cell" :style="{ background: heatColor(3) }"></span>
        <span class="heat-cell" :style="{ background: heatColor(4) }"></span>
        <span>{{ t('stats.more') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import { useI18n } from 'vue-i18n'
import CategoryFilter from '@/components/CategoryFilter.vue'
import { useTasksStore } from '@/stores/tasks'
import { NO_CAT, useCategoriesStore } from '@/stores/categories'
import { useCalendarsStore } from '@/stores/calendars'
import { useFmt } from '@/i18n/dates'
import { addDays, getMonday, parseYmd, today, weekdayIndex, ymd } from '@/lib/dates'
import { weeklyGoal } from '@/lib/goal'
import { countEvents } from '@/lib/statsPrefs'
import { eventToItem, taskToItem, type StatItem } from '@/lib/statsItems'
import { currentStreak as streakOfCurrent, longestStreak as streakOfLongest } from '@/lib/streak'
import {
  customRange, granularity, normalizeRange, rangeBounds, rangeBuckets, statsPeriod, statsSelectedCats,
  type Range, type StatsPeriod,
} from '@/lib/statsRange'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

const { t } = useI18n()
const fmt = useFmt()
const tasksStore = useTasksStore()
const categoriesStore = useCategoriesStore()
const calendarsStore = useCalendarsStore()
const todayStr = today()

// the period, custom range and category filter are session state (statsRange.ts)
const periods: StatsPeriod[] = ['week', 'month', 'year', 'custom']
const period = statsPeriod
function setPeriod(p: StatsPeriod) { period.value = p }
const bounds = rangeBounds()

// a date input changed: normalize (swap / clamp) or, if invalid, show the old value again
function onRangeChange(end: 'from' | 'to', e: Event) {
  const input = e.target as HTMLInputElement
  const cur = customRange.value
  const next = normalizeRange(end === 'from' ? input.value : cur.from, end === 'to' ? input.value : cur.to)
  if (next) customRange.value = next
  input.value = (next ?? cur)[end]
}
// how the custom period's chart is bucketed (≤ 31 days → days, ≤ 26 weeks → weeks, else months)
const gran = computed(() => granularity(customRange.value.from, customRange.value.to))
const customSpansYears = computed(() =>
  parseYmd(customRange.value.from).getFullYear() !== parseYmd(customRange.value.to).getFullYear())
const chartMode = ref<'count' | 'percent'>('count')
const catMode = ref<'count' | 'hours'>('count')

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// --- period range (inclusive) ---
const periodRange = computed<Range>(() => {
  const d = parseYmd(todayStr)
  if (period.value === 'custom') return customRange.value
  if (period.value === 'week') return { from: getMonday(todayStr), to: addDays(getMonday(todayStr), 6) }
  if (period.value === 'month') {
    return {
      from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    }
  }
  return { from: ymd(new Date(d.getFullYear(), 0, 1)), to: ymd(new Date(d.getFullYear(), 11, 31)) }
})

const periodLabel = computed(() => {
  const d = parseYmd(todayStr)
  if (period.value === 'custom') return fmt.dateRange(customRange.value.from, customRange.value.to)
  if (period.value === 'week') return t('stats.thisWeek')
  if (period.value === 'month') return fmt.monthName(d.getMonth())
  return String(d.getFullYear())
})

// tasks + (optionally) connected-calendar events: an event is done once it
// has ended, planned before; it takes its feed's category. The category filter
// is applied here, so everything below (streaks and goal included) follows it.
const items = computed<StatItem[]>(() => {
  const list = tasksStore.tasks.map(t => taskToItem(t, categoriesStore.countsToStreak(t.category_id)))
  if (countEvents.value) {
    const now = Date.now()
    for (const ev of calendarsStore.statsEvents) {
      const item = eventToItem(ev, calendarsStore.categoryOf(ev), now)
      if (item) list.push(item)
    }
  }
  return list.filter(i => categoriesStore.matchesFilter(i.category_id, statsSelectedCats.value))
})
const doneItems = computed(() => items.value.filter(i => i.done))

const periodItems = computed(() => {
  const { from, to } = periodRange.value
  return items.value.filter(i => i.date >= from && i.date <= to)
})
const periodDone = computed(() => periodItems.value.filter(i => i.done).length)
// completion is judged up to today (future items only feed planned hours)
const completion = computed(() => {
  const total = periodItems.value.filter(i => i.date <= todayStr).length
  return total ? Math.round(periodDone.value / total * 100) : 0
})

// --- weekly goal (personal target; set in Settings, progress over current week) ---
const weekDone = computed(() => {
  const mon = getMonday(todayStr), sun = addDays(mon, 6)
  return doneItems.value.filter(i => i.date >= mon && i.date <= sun).length
})
const goalPct = computed(() => Math.min(100, Math.round(weekDone.value / weeklyGoal.value * 100)))

// --- streaks (src/lib/streak.ts): events and excluded categories are skipped ---
const currentStreak = computed(() => streakOfCurrent(items.value, todayStr))
const longestStreak = computed(() => streakOfLongest(items.value, todayStr))

// --- chart adapts to the selected period ---
const chartTitle = computed(() => {
  if (chartMode.value === 'percent') return t('stats.completion')
  if (period.value === 'custom') {
    return gran.value === 'day' ? t('stats.byDay') : gran.value === 'week' ? t('stats.byWeek') : t('stats.byMonth')
  }
  return period.value === 'week' ? t('stats.byDay')
    : period.value === 'month' ? t('stats.byWeek')
      : t('stats.byMonth')
})

function doneBetween(from: string, to: string) {
  return doneItems.value.filter(i => i.date >= from && i.date <= to).length
}
function totalBetween(from: string, to: string) {
  return items.value.filter(i => i.date >= from && i.date <= to && i.date <= todayStr).length
}

const buckets = computed(() => {
  const list: { label: string; done: number; total: number; isCurrent: boolean }[] = []
  const push = (label: string, from: string, to: string, isCurrent: boolean) =>
    list.push({ label, done: doneBetween(from, to), total: totalBetween(from, to), isCurrent })
  if (period.value === 'custom') {
    // the chosen range, clipped buckets (days / Monday-start weeks / months)
    const { from, to } = customRange.value
    for (const b of rangeBuckets(from, to, gran.value)) {
      const d = parseYmd(b.from)
      const label = gran.value === 'month'
        ? fmt.monthShort(d.getMonth()) + (customSpansYears.value ? ` '${String(d.getFullYear()).slice(2)}` : '')
        : `${d.getDate()}.${d.getMonth() + 1}`
      push(label, b.from, b.to, b.from <= todayStr && todayStr <= b.to)
    }
  } else if (period.value === 'week') {
    // current week, day by day (Po–Ne)
    const mon = getMonday(todayStr)
    const letters = fmt.dayLetters()
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i)
      push(letters[i], d, d, d === todayStr)
    }
  } else if (period.value === 'month') {
    // Monday-start weeks of the current month, first/last clipped to it
    const { from, to } = periodRange.value
    for (const b of rangeBuckets(from, to, 'week')) {
      const bd = parseYmd(b.from)
      push(`${bd.getDate()}.${bd.getMonth() + 1}`, b.from, b.to, b.from <= todayStr && todayStr <= b.to)
    }
  } else {
    // 12 months of the current year
    const d = parseYmd(todayStr)
    const y = d.getFullYear(), curM = d.getMonth()
    for (let m = 0; m < 12; m++) {
      push(fmt.monthShort(m), ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0)), m === curM)
    }
  }
  return list
})

// completion % per bucket (0 when the bucket has no tasks)
const bucketPct = (b: { done: number; total: number }) => (b.total ? Math.round(b.done / b.total * 100) : 0)

const hasChartData = computed(() =>
  chartMode.value === 'percent'
    ? buckets.value.some(b => b.total > 0)
    : buckets.value.some(b => b.done > 0))

const chartData = computed(() => {
  const success = cssVar('--color-text-success') || '#34c759'
  const danger = cssVar('--color-text-danger') || '#ff3b30'
  const percent = chartMode.value === 'percent'
  return {
    labels: buckets.value.map(b => b.label),
    datasets: [{
      data: buckets.value.map(b => percent ? bucketPct(b) : b.done),
      backgroundColor: buckets.value.map(b => b.isCurrent ? danger : success),
      borderRadius: 5,
      borderSkipped: false,
      barPercentage: 0.6,
    }],
  }
})

// small value labels drawn above each non-zero bar (count or "%")
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart: any) {
    if (chart.data.labels.length > 14) return // too many bars — labels would overlap
    const ctx = chart.ctx
    const meta = chart.getDatasetMeta(0)
    const percent = chartMode.value === 'percent'
    const color = cssVar('--color-text-tertiary') || '#aeaeb2'
    chart.data.datasets[0].data.forEach((v: number, i: number) => {
      if (!v) return
      const bar = meta.data[i]
      ctx.save()
      ctx.fillStyle = color
      ctx.font = '600 10px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(percent ? `${v}%` : `${v}`, bar.x, bar.y - 4)
      ctx.restore()
    })
  },
}

const chartOptions = computed<any>(() => {
  const tertiary = cssVar('--color-text-tertiary') || '#aeaeb2'
  const danger = cssVar('--color-text-danger') || '#ff3b30'
  const percent = chartMode.value === 'percent'
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 16 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: percent
          ? { label: (ctx: { raw: number }) => `${ctx.raw} %` }
          : {},
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: buckets.value.map(b => b.isCurrent ? danger : tertiary),
          font: { size: 11 },
        },
      },
      y: { display: false, beginAtZero: true, max: percent ? 100 : undefined },
    },
  }
})

// insight adapts to the period: week → strongest weekday, month → strongest
// week, year → strongest month; a custom period uses its chart unit, over the range
const insight = computed(() => {
  if (period.value === 'custom') return customInsight()
  const tasks = doneItems.value
  if (!tasks.length) return null

  if (period.value === 'week') {
    const counts = new Array(7).fill(0)
    for (const t of tasks) counts[weekdayIndex(t.date)]++
    const max = Math.max(...counts)
    if (!max) return null
    return t('stats.strongestDay', { day: fmt.dayName(addDays(getMonday(todayStr), counts.indexOf(max))) })
  }

  if (period.value === 'month') {
    const counts = new Map<string, number>()
    const { from, to } = periodRange.value
    for (const task of tasks) {
      if (task.date < from || task.date > to) continue
      const mon = getMonday(task.date)
      const key = mon < from ? from : mon // clipped week, same label as the chart
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    let best = '', bestN = 0
    for (const [mon, n] of counts) if (n > bestN) { bestN = n; best = mon }
    if (!best) return null
    const md = parseYmd(best)
    return t('stats.strongestWeek', { week: `${md.getDate()}.${md.getMonth() + 1}` })
  }

  // year
  const counts = new Array(12).fill(0)
  for (const task of tasks) counts[parseYmd(task.date).getMonth()]++
  const max = Math.max(...counts)
  if (!max) return null
  return t('stats.strongestMonth', { month: fmt.monthName(counts.indexOf(max)) })
})

function customInsight(): string | null {
  const done = periodItems.value.filter(i => i.done)
  if (!done.length) return null
  const best = (key: (date: string) => string) => {
    const counts = new Map<string, number>()
    for (const i of done) counts.set(key(i.date), (counts.get(key(i.date)) ?? 0) + 1)
    let top = '', n = 0
    for (const [k, c] of counts) if (c > n) { n = c; top = k }
    return top
  }
  if (gran.value === 'day') {
    const wd = Number(best(d => String(weekdayIndex(d))))
    return t('stats.strongestDay', { day: fmt.dayName(addDays(getMonday(todayStr), wd)) })
  }
  if (gran.value === 'week') {
    // the bucket's start, as on the chart (the first week is clipped to the range)
    const from = customRange.value.from
    const md = parseYmd(best(d => (getMonday(d) < from ? from : getMonday(d))))
    return t('stats.strongestWeek', { week: `${md.getDate()}.${md.getMonth() + 1}` })
  }
  const md = parseYmd(best(d => d.slice(0, 7) + '-01'))
  const month = fmt.monthName(md.getMonth()) + (customSpansYears.value ? ` ${md.getFullYear()}` : '')
  return t('stats.strongestMonth', { month })
}

// GitHub-style activity heatmap (last ~26 weeks, columns = weeks, rows = Mon–Sun)
const HEAT_WEEKS = 26
const heatEl = ref<HTMLElement | null>(null)
const heatWeeks = computed(() => {
  const counts = new Map<string, number>()
  for (const i of doneItems.value) counts.set(i.date, (counts.get(i.date) ?? 0) + 1)
  const startMon = addDays(getMonday(todayStr), -7 * (HEAT_WEEKS - 1))
  const weeks: { date: string; count: number; future: boolean; level: number }[][] = []
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(startMon, w * 7 + d)
      const future = date > todayStr
      const count = counts.get(date) ?? 0
      days.push({ date, count, future, level: future ? -1 : Math.min(4, count) })
    }
    weeks.push(days)
  }
  return weeks
})
function heatColor(level: number) {
  if (level < 0) return 'transparent'
  if (level === 0) return 'var(--color-background-tertiary)'
  const pct = [0, 32, 55, 80, 100][level]
  return `color-mix(in srgb, var(--color-text-success) ${pct}%, var(--color-background-tertiary))`
}
const dayLabels = computed(() => fmt.weekdayShort())
// month short label above a week column when the month changes from the previous week
function heatMonthLabel(wi: number): string {
  const m = parseYmd(heatWeeks.value[wi][0].date).getMonth()
  const prev = wi > 0 ? parseYmd(heatWeeks.value[wi - 1][0].date).getMonth() : -1
  return m !== prev ? fmt.monthShort(m) : ''
}

function catName(id: string) {
  if (id === NO_CAT) return t('stats.noCategory')
  return categoriesStore.byId.get(id)?.name ?? t('stats.deletedCategory')
}
function catColor(id: string) {
  if (id === NO_CAT) return 'var(--color-text-tertiary)'
  return categoriesStore.color(id) ?? 'var(--color-text-info)'
}
function fmtH(min: number) {
  return Math.round(min / 60 * 10) / 10
}

// per category within the selected period (incl. "Bez kategórie"), sorted desc,
// grouped by top-level category (a subcategory's items count toward its parent;
// the row expands to show them). Count mode = done count; hours mode = done h /
// planned h (items with a duration set).
type Agg = { val: number; done: number }
type CatRow = { id: string; name: string; color: string; val: number; done: number; label: string; pct: number }
const expandedCats = ref(new Set<string>())
function toggleExpand(id: string) {
  const s = new Set(expandedCats.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expandedCats.value = s
}
// a deleted category keeps its own row (it's no longer anyone's child)
const groupKey = (key: string) =>
  (key === NO_CAT || !categoriesStore.byId.has(key) ? key : categoriesStore.rootId(key))

const catBreakdown = computed(() => {
  const hours = catMode.value === 'hours'
  const agg = new Map<string, Agg>()
  for (const i of periodItems.value) {
    if (hours ? i.minutes == null : !i.done) continue
    const key = i.category_id ?? NO_CAT
    const amount = hours ? i.minutes! : 1
    const a = agg.get(key) ?? { val: 0, done: 0 }
    a.val += amount
    if (i.done) a.done += amount
    agg.set(key, a)
  }
  const groups = new Map<string, Map<string, Agg>>()
  for (const [key, a] of agg) {
    const g = groupKey(key)
    if (!groups.has(g)) groups.set(g, new Map())
    groups.get(g)!.set(key, a)
  }

  const row = (id: string, a: Agg, name: string, colorOf = id): CatRow => ({
    id, name, color: catColor(colorOf), val: a.val, done: a.done, pct: 0,
    label: hours ? `${fmtH(a.done)}h / ${fmtH(a.val)}h` : String(a.val),
  })
  const bySize = (x: CatRow, y: CatRow) => y.val - x.val || y.done - x.done
  const rows = [...groups].map(([root, members]) => {
    let total: Agg = { val: 0, done: 0 }
    for (const a of members.values()) total = { val: total.val + a.val, done: total.done + a.done }
    const subs = [...members].filter(([k]) => k !== root)
    const own = members.get(root)
    const children = subs.length
      ? [
        ...subs.map(([k, a]) => row(k, a, catName(k))),
        ...(own ? [row(`${root}:direct`, own, t('stats.directly'), root)] : []),
      ].sort(bySize)
      : []
    return { ...row(root, total, catName(root)), children }
  }).sort(bySize)

  // hours: share of planned time done; count: relative to the biggest row
  const max = Math.max(1, ...rows.map(r => r.val))
  const pct = (r: CatRow) => (hours ? Math.round(r.done / r.val * 100) : Math.round(r.val / max * 100))
  return rows.map(r => ({ ...r, pct: pct(r), children: r.children.map(c => ({ ...c, pct: pct(c) })) }))
})

// --- data window ---
// A year of history (periods, charts, streaks) up to the end of the
// current year / week, so planned future items count too; widened to cover a
// custom period that reaches outside it.
function neededRange(): Range {
  const d = parseYmd(todayStr)
  const yearEnd = ymd(new Date(d.getFullYear(), 11, 31))
  const weekEnd = addDays(getMonday(todayStr), 6)
  let from = ymd(new Date(d.getFullYear() - 1, d.getMonth(), 1))
  let to = weekEnd > yearEnd ? weekEnd : yearEnd
  if (period.value === 'custom') {
    if (customRange.value.from < from) from = customRange.value.from
    if (customRange.value.to > to) to = customRange.value.to
  }
  return { from, to }
}

let loaded: Range | null = null
async function loadRange(r: Range) {
  // the stores drop a response that a newer call has superseded; the window
  // only counts as loaded once the tasks arrived (a failure is retried later)
  const prev = loaded
  loaded = r
  try {
    await Promise.all([
      tasksStore.fetchRange(r.from, r.to),
      calendarsStore.loadFeeds()
        .then(() => calendarsStore.fetchStatsRange(r.from, r.to))
        .catch(e => console.error('stats events failed', e)), // tasks-only stats still work
    ])
  } catch (e) {
    if (loaded === r) loaded = prev
    throw e
  }
}

// picking "Vlastné" or a new range outside the loaded window fetches the
// union (debounced, so quick edits cause one load)
let reloadTimer: ReturnType<typeof setTimeout> | undefined
watch([period, customRange], () => {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    const need = neededRange()
    if (loaded && need.from >= loaded.from && need.to <= loaded.to) return
    loadRange(need).catch(e => console.error('stats load failed', e))
  }, 300)
})
onBeforeUnmount(() => clearTimeout(reloadTimer))

onMounted(async () => {
  calendarsStore.init()
  await loadRange(neededRange())
  // show the most recent weeks first
  await nextTick()
  if (heatEl.value) heatEl.value.scrollLeft = heatEl.value.scrollWidth
})
</script>

<style scoped>
.stats { padding-bottom: 16px; }
.top { padding: 12px 18px 12px; }
.title { font-size: 24px; font-weight: 500; margin-bottom: 12px; }
.seg { display: flex; background: var(--color-background-tertiary); border-radius: 10px; padding: 3px; }
.seg button {
  flex: 1; border: none; background: none; cursor: pointer;
  font-size: 13px; color: var(--color-text-secondary); padding: 6px 0; border-radius: 8px;
}
.seg button.on { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; }
.seg-sm { width: auto; padding: 2px; border-radius: 8px; flex-shrink: 0; }
.seg-sm button { flex: 0 0 auto; font-size: 12px; padding: 4px 11px; }

.metrics { padding: 0 18px 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.metric { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 14px; }
.metric-label { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; }
.metric-value { font-size: 24px; font-weight: 500; display: flex; align-items: center; gap: 5px; }
.metric-value.green { color: var(--color-text-success); }
.metric-value.flame i { font-size: 20px; color: var(--color-text-danger); }

.goal-card { margin: 5px 18px 6px; background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 14px; }
.goal-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
.goal-label { font-size: 13px; color: var(--color-text-secondary); }
.goal-num { font-size: 16px; font-weight: 500; font-variant-numeric: tabular-nums; }
.goal-num.reached { color: var(--color-text-success); }
.goal-track { height: 8px; border-radius: 5px; background: var(--color-background-tertiary); overflow: hidden; }
.goal-fill { height: 100%; background: var(--color-text-info); transition: width .3s ease; }
.goal-fill.reached { background: var(--color-text-success); }

.block { padding: 14px 18px 6px; }
.block.bordered { border-top: 0.5px solid var(--color-border-tertiary); margin-top: 8px; padding-bottom: 16px; }
.block-title { font-size: 15px; font-weight: 500; }
.block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.block > .block-title { margin-bottom: 12px; }
.block-note { font-size: 12px; color: var(--color-text-tertiary); }
.chart-wrap { height: 120px; margin: 14px 0 10px; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 28px 16px; text-align: center;
  color: var(--color-text-tertiary); font-size: 14px;
}
.empty-state i { font-size: 28px; }
.insight { font-size: 12px; color: var(--color-text-tertiary); }
.insight span { color: var(--color-text-secondary); }

.heat-wrap { display: flex; align-items: flex-start; justify-content: center; padding: 6px 0 4px; }
.heat-days { display: flex; flex-direction: column; gap: 3px; margin-right: 6px; flex-shrink: 0; }
.heat-days span { height: 13px; line-height: 13px; font-size: 9px; color: var(--color-text-tertiary); }
.heat-days-spacer { height: 18px !important; }
.heat-scroll { min-width: 0; overflow-x: auto; scrollbar-width: none; }
.heat-scroll::-webkit-scrollbar { display: none; }
.heat-months { display: flex; height: 15px; }
.heat-month { width: 16px; flex-shrink: 0; font-size: 10px; line-height: 1; color: var(--color-text-tertiary); white-space: nowrap; }
.heat-grid { display: flex; gap: 3px; }
.heat-col { display: flex; flex-direction: column; gap: 3px; }
.heat-cell { width: 13px; height: 13px; border-radius: 3px; flex-shrink: 0; }
.heat-legend { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 10px; font-size: 11px; color: var(--color-text-tertiary); }
.heat-legend .heat-cell { width: 11px; height: 11px; }

.stats-filter { display: flex; margin-top: 10px; }
.range-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.range-input {
  flex: 1; min-width: 0; height: 34px; padding: 0 10px;
  border: 0.5px solid var(--color-border-secondary); border-radius: var(--border-radius-md);
  background: var(--color-background-primary); color: var(--color-text-primary);
  font-size: 14px; font-family: inherit;
}
.range-input:focus { outline: none; border-color: var(--color-text-info); }
.range-sep { color: var(--color-text-tertiary); flex-shrink: 0; }
.cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
/* expanded subcategory rows sit indented under their parent */
.cat-row.sub .cat-name { padding-left: 16px; width: 96px; box-sizing: border-box; }
.cat-row.sub .cat-track { height: 6px; }
.cat-expand {
  display: flex; align-items: center; gap: 2px; text-align: left;
  border: none; background: none; padding: 0; cursor: pointer; font-family: inherit;
}
.cat-expand i { font-size: 13px; flex-shrink: 0; margin-left: -2px; }
.cat-expand-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.cat-expand:focus-visible { outline: 2px solid var(--color-text-info); outline-offset: 2px; border-radius: 4px; }
.cat-row:last-child { margin-bottom: 0; }
.cat-name {
  font-size: 13px; color: var(--color-text-secondary);
  width: 96px; flex-shrink: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cat-track { flex: 1; height: 8px; border-radius: 5px; background: var(--color-background-tertiary); overflow: hidden; }
.cat-fill { height: 100%; background: var(--color-text-info); }
.cat-val { font-size: 12px; color: var(--color-text-secondary); text-align: right; white-space: nowrap; flex-shrink: 0; }
</style>
