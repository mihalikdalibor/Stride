<template>
  <!-- one category in the Categories sheet: drag handle, color (opens the
       settings panel), inline rename, delete (tap or swipe-left) -->
  <div class="cat" :class="{ 'is-sub': sub }">
    <div class="cat-main">
      <div v-if="swiping && dx < 0" class="swipe-bg" :class="{ ready: dx < -SWIPE_TH }">
        <i class="ti ti-trash"></i>
      </div>
      <div
        class="cat-fore"
        :class="{ swiping }"
        :style="swiping ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined"
        @touchstart="onDown"
        @touchmove="onMove"
        @touchend="onUp"
      >
        <span :class="sub ? 'sub-drag' : 'cat-drag'" class="drag" @touchstart.stop :aria-label="t('day.reorder')" :title="t('day.reorder')"><i class="ti ti-grip-vertical"></i></span>
        <button
          class="swatch"
          :style="{ background: store.color(cat.id) ?? cat.color }"
          @click="emit('toggle')"
          :aria-expanded="open"
          :aria-label="t('cat.settingsAria')"
          :title="t('cat.settingsAria')"
        ></button>
        <input
          class="cat-name"
          :value="cat.name"
          @change="rename(($event.target as HTMLInputElement).value)"
        >
        <i
          v-if="!store.countsToStreak(cat.id)"
          class="ti ti-flame-off no-streak"
          :aria-label="t('cat.notInStreak')"
          :title="t('cat.notInStreak')"
        ></i>
        <button class="trash" @click="emit('delete')" :aria-label="t('cat.deleteAria')" :title="t('cat.deleteAria')">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>

    <div v-if="open" class="cat-panel">
      <!-- a subcategory takes its color + streak flag from the parent -->
      <template v-if="!sub">
        <div class="palette">
          <button
            v-for="col in PALETTE"
            :key="col"
            class="chip"
            :class="{ on: col === cat.color }"
            :style="{ background: col }"
            @click="store.updateCategory(cat.id, { color: col })"
          ></button>
          <label class="chip custom" :class="{ on: !PALETTE.includes(cat.color) }" :aria-label="t('cat.customColorAria')" :title="t('cat.customColorAria')">
            <input
              type="color"
              :value="cat.color"
              @change="store.updateCategory(cat.id, { color: ($event.target as HTMLInputElement).value })"
            >
            <i class="ti ti-color-picker"></i>
          </label>
        </div>
        <div class="prop-row">
          <i class="ti" :class="cat.exclude_from_streak ? 'ti-flame-off' : 'ti-flame'"></i>
          <span class="prop-label">{{ t('cat.countStreak') }}</span>
          <button
            class="ac-switch"
            :class="{ on: !cat.exclude_from_streak }"
            role="switch"
            :aria-checked="!cat.exclude_from_streak"
            :aria-label="t('cat.countStreak')"
            @click="store.updateCategory(cat.id, { exclude_from_streak: !cat.exclude_from_streak })"
          ></button>
        </div>
        <p class="prop-hint">{{ t('cat.countStreakHint') }}</p>
      </template>

      <div class="prop-row">
        <i class="ti ti-subtask"></i>
        <label class="prop-label" :for="selectId">{{ t('cat.parent') }}</label>
        <select
          :id="selectId"
          class="parent-select"
          :value="cat.parent_id ?? ''"
          :disabled="hasChildren"
          @change="changeParent($event)"
        >
          <option value="">{{ t('cat.parentNone') }}</option>
          <option v-for="p in parentOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <p v-if="sub || hasChildren" class="prop-hint">{{ sub ? t('cat.inherits') : t('cat.noNesting') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import { PALETTE } from '@/lib/colors'
import type { Category } from '@/types'

const { t } = useI18n()

const props = defineProps<{ cat: Category; open: boolean }>()
const emit = defineEmits<{ toggle: []; delete: [] }>()

const store = useCategoriesStore()
const sub = computed(() => !!store.parentOf(props.cat.id))
const hasChildren = computed(() => store.childrenOf(props.cat.id).length > 0)
// only one level: a subcategory can go under any other top-level category
const parentOptions = computed(() => store.topLevel.filter(p => p.id !== props.cat.id))
const selectId = `cat-parent-${props.cat.id}`

// attach/detach; if the store refuses (or the DB lacks the migration), the
// select goes back to what's actually saved
async function changeParent(e: Event) {
  const select = e.target as HTMLSelectElement
  try {
    await store.setParent(props.cat.id, select.value || null)
  } catch (err) {
    console.error('change parent category failed', err)
    select.value = props.cat.parent_id ?? ''
  }
}

function rename(name: string) {
  const v = name.trim()
  if (v && v !== props.cat.name) store.updateCategory(props.cat.id, { name: v })
}

// swipe-left the row to delete (touch)
const SWIPE_TH = 70
const swiping = ref(false)
const dx = ref(0)
let sx = 0, sy = 0, tracking = false, horizontal = false

function onDown(e: TouchEvent) {
  sx = e.touches[0].clientX; sy = e.touches[0].clientY
  tracking = true; horizontal = false
  swiping.value = true; dx.value = 0
}
function onMove(e: TouchEvent) {
  if (!tracking) return
  const mx = e.touches[0].clientX - sx
  const my = e.touches[0].clientY - sy
  if (!horizontal) {
    if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) horizontal = true
    else if (Math.abs(my) > 10) { tracking = false; swiping.value = false; return }
    else return
  }
  if (mx > 0) { dx.value = 0; return } // delete is left-only
  e.preventDefault()
  dx.value = mx
}
function onUp() {
  const d = dx.value
  tracking = false; horizontal = false
  swiping.value = false; dx.value = 0
  if (d < -SWIPE_TH) emit('delete')
}
</script>

<style scoped>
.cat { padding: 8px 0; border-top: 0.5px solid var(--color-border-tertiary); }
/* subcategories sit indented under their parent */
.cat.is-sub { padding-left: 28px; }
.cat-main { position: relative; overflow: hidden; }
.cat-fore { display: flex; align-items: center; gap: 12px; background: var(--color-background-primary); }
.cat-fore.swiping { transition: transform .2s; }
.swipe-bg {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end;
  padding: 0 16px; background: var(--color-text-danger); color: #fff; font-size: 18px;
  filter: saturate(0.85) brightness(0.85);
}
.swipe-bg.ready { filter: none; }

.swatch { width: 26px; height: 26px; border-radius: 50%; border: 0.5px solid var(--color-border-tertiary); flex-shrink: 0; cursor: pointer; padding: 0; }
.is-sub .swatch { width: 20px; height: 20px; margin: 0 3px; }
.cat-name {
  flex: 1; min-width: 0; border: none; background: none; color: var(--color-text-primary);
  font-size: 15px; padding: 6px 0;
}
.cat-name:focus { outline: none; }
.trash { border: none; background: none; color: var(--color-text-tertiary); cursor: pointer; font-size: 18px; padding: 4px; }
.drag {
  display: flex; align-items: center; flex-shrink: 0;
  color: var(--color-text-tertiary); font-size: 18px;
  cursor: grab; padding: 0 2px; touch-action: none;
}
.drag:active { cursor: grabbing; }
.no-streak { color: var(--color-text-tertiary); font-size: 15px; flex-shrink: 0; }

.cat-panel { padding-bottom: 4px; }
.palette { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 0 4px; }
.prop-row { display: flex; align-items: center; gap: 10px; padding: 10px 0 2px; }
.prop-row > i { color: var(--color-text-tertiary); font-size: 18px; }
.prop-label { flex: 1; font-size: 15px; }
.prop-hint { color: var(--color-text-tertiary); font-size: 12px; margin: 0; }
.parent-select {
  max-width: 55%; min-width: 0;
  border: 0.5px solid var(--color-border-secondary); border-radius: var(--border-radius-md);
  background: var(--color-background-primary); color: var(--color-text-primary);
  font-family: inherit; font-size: 14px; padding: 5px 8px; cursor: pointer;
}
.parent-select:disabled { opacity: 0.5; cursor: default; }
.parent-select:focus-visible { outline: 2px solid var(--color-text-info); outline-offset: 1px; }
.ac-switch {
  position: relative; flex-shrink: 0; width: 44px; height: 26px; padding: 0;
  border: none; border-radius: 13px; cursor: pointer;
  background: var(--color-background-tertiary); transition: background .2s ease;
}
.ac-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform .2s ease;
}
.ac-switch.on { background: var(--color-text-success); }
.ac-switch.on::after { transform: translateX(18px); }
.chip { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.chip.on { border-color: var(--color-text-primary); }
.chip.custom {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 27px; height: 27px;
  background: var(--color-text-tertiary); color: #fff;
}
.chip.custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; padding: 0; border: none; }
.chip.custom i { font-size: 14px; pointer-events: none; }
</style>
