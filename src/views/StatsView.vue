<template>
  <div class="stats">
    <div class="top">
      <div class="seg">
        <button v-for="p in periods" :key="p" :class="{ on: period === p }" @click="period = p">
          {{ t('stats.' + p) }}
        </button>
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
        <div v-for="c in catBreakdown" :key="c.name" class="cat-row">
          <span class="cat-name">{{ c.name }}</span>
          <div class="cat-track"><div class="cat-fill" :style="{ width: c.pct + '%', background: c.color }"></div></div>
          <span class="cat-val">{{ c.label }}</span>
        </div>
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
import { computed, nextTick, onMounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import { useI18n } from 'vue-i18n'
import { useTasksStore } from '@/stores/tasks'
import { useCategoriesStore } from '@/stores/categories'
import { useCalendarsStore } from '@/stores/calendars'
import { useFmt } from '@/i18n/dates'
import { addDays, getMonday, parseYmd, today, weekdayIndex, ymd } from '@/lib/dates'
import { weeklyGoal } from '@/lib/goal'
import { countEvents } from '@/lib/statsPrefs'
import { eventToItem, taskToItem, type StatItem } from '@/lib/statsItems'
import { currentStreak as streakOfCurrent, longestStreak as streakOfLongest } from '@/lib/streak'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

const { t } = useI18n()
const fmt = useFmt()
const tasksStore = useTasksStore()
const categoriesStore = useCategoriesStore()
const calendarsStore = useCalendarsStore()
const todayStr = today()

const periods = ['week', 'month', 'year'] as const
const period = ref<'week' | 'month' | 'year'>('week')
const chartMode = ref<'count' | 'percent'>('count')
const catMode = ref<'count' | 'hours'>('count')

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// --- period range (inclusive) ---
const periodRange = computed(() => {
  const d = parseYmd(todayStr)
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
  if (period.value === 'week') return t('stats.thisWeek')
  if (period.value === 'month') return fmt.monthName(d.getMonth())
  return String(d.getFullYear())
})

// tasks + (optionally) connected-calendar events: an event is done once it
// has ended, planned before; it takes its feed's category
const items = computed<StatItem[]>(() => {
  const list = tasksStore.tasks.map(t => taskToItem(t, categoriesStore.countsToStreak(t.category_id)))
  if (!countEvents.value) return list
  const now = Date.now()
  for (const ev of calendarsStore.statsEvents) {
    const item = eventToItem(ev, calendarsStore.categoryOf(ev), now)
    if (item) list.push(item)
  }
  return list
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
  if (period.value === 'week') {
    // current week, day by day (Po–Ne)
    const mon = getMonday(todayStr)
    const letters = fmt.dayLetters()
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i)
      push(letters[i], d, d, d === todayStr)
    }
  } else if (period.value === 'month') {
    // last 6 weeks
    const mondayThis = getMonday(todayStr)
    for (let i = 5; i >= 0; i--) {
      const mon = addDays(mondayThis, -7 * i)
      const md = parseYmd(mon)
      push(`${md.getDate()}.${md.getMonth() + 1}`, mon, addDays(mon, 6), i === 0)
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
// week, year → strongest month
const insight = computed(() => {
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
    for (const task of tasks) {
      const mon = getMonday(task.date)
      counts.set(mon, (counts.get(mon) ?? 0) + 1)
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

function catMeta(id: string) {
  if (id === NO_CAT) return { name: t('stats.noCategory'), color: 'var(--color-text-tertiary)' }
  return {
    name: categoriesStore.byId.get(id)?.name ?? t('stats.deletedCategory'),
    color: categoriesStore.byId.get(id)?.color ?? 'var(--color-text-info)',
  }
}
function fmtH(min: number) {
  return Math.round(min / 60 * 10) / 10
}

// per category within the selected period (incl. "Bez kategórie"), sorted desc:
// count mode = done count; hours mode = done h / planned h (items with a duration set)
const NO_CAT = '__none__'
const catBreakdown = computed(() => {
  if (catMode.value === 'hours') {
    const done = new Map<string, number>()
    const total = new Map<string, number>()
    for (const i of periodItems.value) {
      if (i.minutes == null) continue
      const key = i.category_id ?? NO_CAT
      total.set(key, (total.get(key) ?? 0) + i.minutes)
      if (i.done) done.set(key, (done.get(key) ?? 0) + i.minutes)
    }
    return [...total.entries()].map(([id, totalMin]) => {
      const doneMin = done.get(id) ?? 0
      return {
        ...catMeta(id),
        val: totalMin,
        label: `${fmtH(doneMin)}h / ${fmtH(totalMin)}h`,
        pct: Math.round(doneMin / totalMin * 100),
      }
    }).sort((a, b) => b.val - a.val || b.pct - a.pct)
  }

  const counts = new Map<string, number>()
  for (const i of periodItems.value) {
    if (!i.done) continue
    const key = i.category_id ?? NO_CAT
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const rows = [...counts.entries()].map(([id, val]) => ({ ...catMeta(id), val, label: String(val) }))
    .sort((a, b) => b.val - a.val)
  const max = Math.max(1, ...rows.map(r => r.val))
  return rows.map(r => ({ ...r, pct: Math.round(r.val / max * 100) }))
})

onMounted(async () => {
  const d = parseYmd(todayStr)
  // a year of history (periods, 6-week chart, streaks) up to the end of the
  // current year / week, so planned future items count too
  const from = ymd(new Date(d.getFullYear() - 1, d.getMonth(), 1))
  const yearEnd = ymd(new Date(d.getFullYear(), 11, 31))
  const weekEnd = addDays(getMonday(todayStr), 6)
  const to = weekEnd > yearEnd ? weekEnd : yearEnd
  calendarsStore.init()
  await Promise.all([
    tasksStore.fetchRange(from, to),
    calendarsStore.loadFeeds()
      .then(() => calendarsStore.fetchStatsRange(from, to))
      .catch(e => console.error('stats events failed', e)), // tasks-only stats still work
  ])
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

.cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
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
