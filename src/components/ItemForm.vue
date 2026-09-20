<template>
  <div class="add-form" :class="{ 'edit-form': isEdit }">
    <div class="add-input-row">
      <input
        ref="inputEl"
        v-model="title"
        class="add-input"
        :placeholder="t('day.itemName')"
        @keyup.enter="submit"
        @keyup.esc="emit('cancel')"
      >
      <button class="add-confirm" :disabled="!canSubmit" @click="submit" :aria-label="t('common.confirm')" :title="t('common.confirm')"><i class="ti ti-check"></i></button>
      <button class="add-cancel" @click="emit('cancel')" :aria-label="t('common.cancel')" :title="t('common.cancel')"><i class="ti ti-x"></i></button>
    </div>

    <textarea v-model="note" class="note-input" rows="2" :placeholder="t('day.note')"></textarea>

    <div class="meta-row">
      <div class="field">
        <span class="field-label">{{ t('day.from') }}</span>
        <select v-model="hour" :aria-label="t('day.from')">
          <option value="">--</option>
          <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
        </select>
        <span class="colon">:</span>
        <select v-model="min" :aria-label="t('day.from')">
          <option value="">--</option>
          <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <div class="field">
        <span class="field-label">{{ t('day.to') }}</span>
        <select v-model="endHour" :aria-label="t('day.to')">
          <option value="">--</option>
          <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
        </select>
        <span class="colon">:</span>
        <select v-model="endMin" :aria-label="t('day.to')">
          <option value="">--</option>
          <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
        </select>
        <span v-if="endsNextDay(hour, min, endHour, endMin)" class="next-day">+1</span>
      </div>
    </div>

    <!-- activity (checkable task) or event (fixed, no checkbox) -->
    <div class="seg kind-seg">
      <button type="button" :class="{ on: kind === 'task' }" :disabled="!canSwitchKind" @click="kind = 'task'">
        <i class="ti ti-circle-check"></i>{{ t('item.activity') }}
      </button>
      <button type="button" :class="{ on: kind === 'event' }" :disabled="!canSwitchKind" @click="kind = 'event'">
        <i class="ti ti-calendar-event"></i>{{ t('item.event') }}
      </button>
    </div>
    <p v-if="!canSwitchKind" class="form-hint">{{ t('item.seriesNoSwitch') }}</p>
    <p v-else-if="kind === 'event' && !hour" class="form-hint">{{ t('item.allDayHint') }}</p>

    <div class="cat-row">
      <CategoryPicker v-model="categoryId" />
    </div>

    <!-- legacy `repeat`: spawns the next occurrence on complete; can be turned off -->
    <div v-if="legacyRepeat" class="legacy-row">
      <i class="ti ti-repeat"></i>
      <span class="legacy-label">{{ t('item.legacyRepeat') }}</span>
      <button type="button" class="act-btn" @click="stopLegacyRepeat">{{ t('item.stopRepeat') }}</button>
    </div>

    <!-- add: one day, several picked days, or a repeat rule -->
    <template v-if="!isEdit">
      <div class="when-row">
        <span class="when-label">{{ t('item.when') }}</span>
        <div class="seg seg-sm">
          <button type="button" :class="{ on: when === 'one' }" @click="when = 'one'">{{ t('item.oneDay') }}</button>
          <button type="button" :class="{ on: when === 'multi' }" @click="when = 'multi'">{{ t('item.multiDay') }}</button>
          <button type="button" :class="{ on: when === 'repeat' }" @click="when = 'repeat'">{{ t('item.repeat') }}</button>
        </div>
      </div>

      <template v-if="when === 'multi'">
        <MultiDatePicker v-model="multiDates" :min="minDate" />
        <p class="form-hint">{{ t('item.selected', { n: multiDates.length }) }}</p>
      </template>

      <template v-if="when === 'repeat'">
        <div class="seg seg-sm">
          <button type="button" :class="{ on: repeatMode === 'daily' }" @click="repeatMode = 'daily'">{{ t('item.daily') }}</button>
          <button type="button" :class="{ on: repeatMode === 'weekly' }" @click="repeatMode = 'weekly'">{{ t('item.weekly') }}</button>
        </div>
        <div v-if="repeatMode === 'weekly'" class="wd-row">
          <button
            v-for="(w, i) in fmt.weekdayShort()"
            :key="i"
            type="button"
            class="wd-chip"
            :class="{ on: weekdays.includes(i) }"
            @click="toggleWeekday(i)"
          >{{ w }}</button>
        </div>
        <div class="until-row">
          <span class="when-label">{{ t('item.until') }}</span>
          <input type="date" v-model="until" class="date-input" :min="minDate" :max="maxUntil">
        </div>
        <p class="form-hint">{{ t('item.willCreate', { n: dates.length }) }}</p>
      </template>
    </template>

    <!-- edit: series scope, delete, move to another day -->
    <div v-else class="edit-bottom">
      <template v-if="moveOpen">
        <span class="eb-q">{{ t('day.moveTo') }}</span>
        <input type="date" v-model="date" class="date-input">
        <button class="add-confirm" @click="submit" :aria-label="t('common.confirm')" :title="t('common.confirm')"><i class="ti ti-check"></i></button>
        <button class="add-cancel" @click="moveOpen = false" :aria-label="t('common.cancel')" :title="t('common.cancel')"><i class="ti ti-x"></i></button>
      </template>
      <div v-else class="edit-actions">
        <div v-if="isSeries" class="seg seg-sm">
          <button type="button" :class="{ on: scope === 'one' }" @click="scope = 'one'">{{ t('item.onlyThis') }}</button>
          <button type="button" :class="{ on: scope === 'following' }" @click="scope = 'following'">{{ t('item.thisAndFollowing') }}</button>
        </div>
        <div class="action-row">
          <button class="act-btn danger" @click="emit('remove', scope)">
            <i class="ti ti-trash"></i> {{ t('common.delete') }}
          </button>
          <!-- moving applies to one occurrence only, so it's hidden for the series scope -->
          <button v-if="scope === 'one'" class="act-btn" @click="moveOpen = true">
            <i class="ti ti-calendar-event"></i> {{ t('day.moveTo') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CategoryPicker from '@/components/CategoryPicker.vue'
import MultiDatePicker from '@/components/MultiDatePicker.vue'
import { useFmt } from '@/i18n/dates'
import { addDays, parseYmd, today, weekdayIndex, ymd } from '@/lib/dates'
import { expandDates, type RepeatMode } from '@/lib/recurrence'
import { HOURS, MINUTES, composeTime, durFrom, endsNextDay, minToHHMM, toMin } from '@/lib/time'
import { eventFormFields } from '@/lib/calendarEvents'
import type { CalendarEvent, ItemDraft, ItemKind, Task } from '@/types'

const { t } = useI18n()
const fmt = useFmt()

const props = defineProps<{
  date: string                 // the day the form belongs to
  task?: Task | null           // editing an activity
  event?: CalendarEvent | null // editing a manually added event
}>()

const emit = defineEmits<{
  save: [ItemDraft]
  remove: [ItemDraft['scope']]
  cancel: []
}>()

const isEdit = computed(() => !!(props.task || props.event))
// a task from before the series model: it spawns its next occurrence on complete
const legacyRepeat = computed(() => !!props.task && props.task.repeat !== 'none')
const isSeries = computed(() => !!(props.task?.series_id || props.event?.series_id))
// switching activity ↔ event moves the row between tables, so not for a series
const canSwitchKind = computed(() => !isSeries.value)

const edited = props.event ? eventFormFields(props.event) : null

const kind = ref<ItemKind>(props.event ? 'event' : 'task')
const title = ref(props.task?.title ?? props.event?.title ?? '')
const note = ref(props.task?.note ?? props.event?.note ?? '')
const categoryId = ref<string | null>(props.task?.category_id ?? props.event?.category_id ?? null)
const date = ref(props.task?.task_date ?? edited?.date ?? props.date)
const scope = ref<ItemDraft['scope']>('one')
const moveOpen = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

const startTime = props.task?.task_time ?? edited?.task_time ?? null
const durationMin = props.task?.duration_min ?? edited?.duration_min ?? null
const hour = ref(startTime ? startTime.slice(0, 2) : '')
const min = ref(startTime ? startTime.slice(3, 5) : '')
const end = startTime && durationMin ? minToHHMM(toMin(startTime.slice(0, 5)) + durationMin) : null
const endHour = ref(end ? end.slice(0, 2) : '')
const endMin = ref(end ? end.slice(3, 5) : '')

// Minute mirrors the hour: no hour → '--', picking an hour defaults minute to '00'.
watch(hour, h => {
  min.value = h ? (min.value || '00') : ''
  if (!h) { endHour.value = ''; endMin.value = '' }
})
watch(endHour, h => { endMin.value = h ? (endMin.value || '00') : '' })

// --- when (add mode only) ---
const when = ref<'one' | 'multi' | 'repeat'>('one')
const multiDates = ref<string[]>([props.date])
const repeatMode = ref<RepeatMode>('weekly')
const weekdays = ref<number[]>([weekdayIndex(props.date)])
const minDate = computed(() => (props.date < today() ? props.date : today()))
const defaultUntil = () => {
  const d = parseYmd(props.date)
  return ymd(new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()))
}
const until = ref(defaultUntil())
const maxUntil = computed(() => addDays(props.date, 366))

function toggleWeekday(i: number) {
  weekdays.value = weekdays.value.includes(i)
    ? weekdays.value.filter(w => w !== i)
    : [...weekdays.value, i].sort()
}

// every day this submit will create
const dates = computed<string[]>(() => {
  if (isEdit.value) return [date.value]
  if (when.value === 'multi') return [...multiDates.value].sort()
  if (when.value === 'repeat') {
    const cappedUntil = until.value > maxUntil.value ? maxUntil.value : until.value
    return expandDates(repeatMode.value, weekdays.value, props.date, cappedUntil)
  }
  return [props.date]
})

const canSubmit = computed(() => !!title.value.trim() && dates.value.length > 0)

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})

const clearRepeat = ref(false)
function stopLegacyRepeat() {
  clearRepeat.value = true
  submit()
}

function submit() {
  if (!canSubmit.value) return
  const task_time = composeTime(hour.value, min.value)
  emit('save', {
    kind: kind.value,
    title: title.value.trim(),
    note: note.value.trim() || null,
    task_time,
    duration_min: durFrom(task_time, endHour.value, endMin.value),
    category_id: categoryId.value,
    dates: dates.value,
    // only a repeat rule becomes a series; days picked by hand stay independent
    // items (so a missed one still shows up in the overdue section)
    series: !isEdit.value && when.value === 'repeat' && dates.value.length > 1,
    scope: isSeries.value ? scope.value : 'one',
    clearRepeat: clearRepeat.value,
  })
}
</script>

<style scoped>
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
  transition: transform .1s ease, background-color .15s ease, color .15s ease;
}
.add-confirm { background: var(--color-text-success); color: #fff; }
.add-confirm:disabled { opacity: 0.4; cursor: default; }
.add-cancel { background: var(--color-background-tertiary); color: var(--color-text-secondary); }
.add-confirm:active, .add-cancel:active { transform: scale(0.92); }

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

.seg { display: flex; background: var(--color-background-tertiary); border-radius: 10px; padding: 3px; }
.seg button {
  flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 13px; color: var(--color-text-secondary); padding: 6px 0; border-radius: 8px;
}
.seg button.on { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; }
.seg button:disabled { opacity: 0.5; cursor: default; }
.seg button i { font-size: 15px; }
.seg-sm button { font-size: 12px; padding: 5px 0; }
.kind-seg button.on { color: var(--color-text-info); }

.form-hint { margin: -4px 0 0; font-size: 12px; color: var(--color-text-tertiary); }
.legacy-row { display: flex; align-items: center; gap: 8px; }
.legacy-row > i { color: var(--color-text-info); font-size: 16px; }
.legacy-label { flex: 1; min-width: 0; font-size: 12px; color: var(--color-text-tertiary); }
.cat-row { min-width: 0; }
.when-row, .until-row { display: flex; align-items: center; gap: 10px; }
.when-row .seg { flex: 1; min-width: 0; }
.when-label { font-size: 13px; color: var(--color-text-secondary); flex-shrink: 0; }
.wd-row { display: flex; gap: 6px; }
.wd-chip {
  flex: 1; border: 0.5px solid var(--color-border-secondary); background: none;
  color: var(--color-text-secondary); font-family: inherit; font-size: 12px;
  padding: 6px 0; border-radius: 999px; cursor: pointer;
}
.wd-chip.on { background: var(--color-background-info); color: var(--color-text-info); border-color: transparent; font-weight: 500; }

.date-input {
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  height: 34px; padding: 0 10px; font-size: 14px; font-family: inherit;
}
.date-input:focus { outline: none; border-color: var(--color-text-info); }

.edit-bottom { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 0 5px; }
.edit-actions { width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 0 10%; box-sizing: border-box; }
@media (max-width: 600px) { .edit-actions { padding: 0 5%; } }
.action-row { display: flex; gap: 10px; }
.action-row > button { flex: 1; justify-content: center; }
.eb-q { font-size: 14px; color: var(--color-text-secondary); }
</style>
