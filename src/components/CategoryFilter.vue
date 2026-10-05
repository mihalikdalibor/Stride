<template>
  <!-- category filter chips (Home + Stats): several at once (OR), "All" = empty
       selection; a parent chip also matches its subcategories -->
  <div class="cf-chips" ref="chipsEl" @wheel="onWheel">
    <button type="button" class="cf-chip" :class="{ on: modelValue.size === 0 }" :aria-pressed="modelValue.size === 0" @click="emit('update:modelValue', new Set())">{{ t('cat.all') }}</button>
    <button
      v-for="c in store.ordered"
      :key="c.id"
      type="button"
      class="cf-chip"
      :class="{ on: modelValue.has(c.id), 'is-sub': !!store.parentOf(c.id) }"
      :aria-pressed="modelValue.has(c.id)"
      :title="store.label(c.id)"
      @click="toggle(c.id)"
    >
      <span class="cf-dot" :style="{ background: store.color(c.id) ?? c.color }"></span>
      <span v-if="store.parentOf(c.id)" class="cf-sub" aria-hidden="true">›</span>{{ c.name }}
    </button>
    <button
      v-if="withNone"
      type="button"
      class="cf-chip"
      :class="{ on: modelValue.has(NO_CAT) }"
      :aria-pressed="modelValue.has(NO_CAT)"
      @click="toggle(NO_CAT)"
    >
      <span class="cf-dot none"></span>{{ t('stats.noCategory') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NO_CAT, useCategoriesStore } from '@/stores/categories'

const { t } = useI18n()

const props = defineProps<{
  modelValue: Set<string>  // selected category ids (+ NO_CAT); empty = all
  withNone?: boolean       // offer "Bez kategórie"
}>()
const emit = defineEmits<{ 'update:modelValue': [Set<string>] }>()

const store = useCategoriesStore()

function toggle(id: string) {
  const s = new Set(props.modelValue)
  s.has(id) ? s.delete(id) : s.add(id)
  emit('update:modelValue', s)
}

// a deleted category drops out of the selection (NO_CAT stays)
function prune() {
  if (!store.loaded) return
  const kept = [...props.modelValue].filter(id => id === NO_CAT || store.byId.has(id))
  if (kept.length !== props.modelValue.size) emit('update:modelValue', new Set(kept))
}
onMounted(prune)
watch(() => store.categories.length, prune)

// desktop: vertical wheel scrolls the chip row horizontally
const chipsEl = ref<HTMLElement | null>(null)
function onWheel(e: WheelEvent) {
  const el = chipsEl.value
  if (!el || el.scrollWidth <= el.clientWidth || e.deltaY === 0) return
  el.scrollLeft += e.deltaY
  e.preventDefault()
}
</script>

<style scoped>
.cf-chips { display: flex; gap: 6px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: none; }
.cf-chips::-webkit-scrollbar { display: none; }
.cf-chip {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  border: 0.5px solid var(--color-border-secondary);
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  border-radius: 14px; padding: 4px 11px; font-size: 12px; cursor: pointer;
  font-family: inherit;
}
.cf-chip.on { background: var(--color-background-info); border-color: transparent; color: var(--color-text-info); }
.cf-chip:focus-visible { outline: 2px solid var(--color-text-info); outline-offset: 1px; }
.cf-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cf-dot.none { background: var(--color-text-tertiary); }
.cf-sub { color: var(--color-text-tertiary); margin-right: -1px; }
.cf-chip.on .cf-sub { color: inherit; opacity: 0.7; }
</style>
