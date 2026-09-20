<template>
  <div class="mdp">
    <div class="mdp-head">
      <button type="button" class="mdp-nav" @click="shiftMonth(-1)" :aria-label="t('item.prevMonth')" :title="t('item.prevMonth')">
        <i class="ti ti-chevron-left"></i>
      </button>
      <span class="mdp-title">{{ monthTitle }}</span>
      <button type="button" class="mdp-nav" @click="shiftMonth(1)" :aria-label="t('item.nextMonth')" :title="t('item.nextMonth')">
        <i class="ti ti-chevron-right"></i>
      </button>
    </div>
    <div class="mdp-wd">
      <span v-for="(w, i) in fmt.weekdayShort()" :key="i">{{ w }}</span>
    </div>
    <div class="mdp-grid">
      <span v-for="n in offset" :key="'pad-' + n" class="mdp-pad"></span>
      <button
        v-for="cell in cells"
        :key="cell.date"
        type="button"
        class="mdp-day"
        :class="{ on: modelValue.includes(cell.date), today: cell.date === todayStr }"
        :disabled="cell.date < min"
        @click="toggle(cell.date)"
      >{{ cell.day }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFmt } from '@/i18n/dates'
import { parseYmd, today, weekdayIndex, ymd } from '@/lib/dates'

const { t } = useI18n()
const fmt = useFmt()

const props = defineProps<{
  modelValue: string[]   // selected dates, 'YYYY-MM-DD'
  min: string            // earliest selectable date
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const todayStr = today()
const start = parseYmd(props.modelValue[0] ?? props.min)
const month = ref({ year: start.getFullYear(), month: start.getMonth() })

const monthTitle = computed(() => `${fmt.monthName(month.value.month)} ${month.value.year}`)

const cells = computed(() => {
  const { year, month: m } = month.value
  const days = new Date(year, m + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => ({ day: i + 1, date: ymd(new Date(year, m, i + 1)) }))
})

// leading blanks so the 1st lands under its weekday (Monday-start grid)
const offset = computed(() => weekdayIndex(cells.value[0].date))

function shiftMonth(dir: number) {
  const d = new Date(month.value.year, month.value.month + dir, 1)
  month.value = { year: d.getFullYear(), month: d.getMonth() }
}

function toggle(date: string) {
  const next = props.modelValue.includes(date)
    ? props.modelValue.filter(d => d !== date)
    : [...props.modelValue, date].sort()
  emit('update:modelValue', next)
}
</script>

<style scoped>
.mdp {
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: 8px 10px 10px;
}
.mdp-head { display: flex; align-items: center; justify-content: space-between; }
.mdp-title { font-size: 14px; font-weight: 500; }
.mdp-nav {
  border: none; background: none; cursor: pointer; padding: 2px 6px;
  color: var(--color-text-info); font-size: 17px; display: flex; align-items: center;
}
.mdp-wd, .mdp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.mdp-wd { margin: 6px 0 2px; }
.mdp-wd span { text-align: center; font-size: 11px; color: var(--color-text-tertiary); }
.mdp-day {
  aspect-ratio: 1; border: none; background: none; cursor: pointer; padding: 0;
  border-radius: 50%; font-size: 13px; font-family: inherit;
  color: var(--color-text-primary);
}
.mdp-day:disabled { color: var(--color-text-tertiary); opacity: 0.45; cursor: default; }
.mdp-day.today { color: var(--color-text-danger); font-weight: 500; }
.mdp-day.on { background: var(--color-text-info); color: #fff; font-weight: 500; }
.mdp-day.on.today { color: #fff; }
</style>
