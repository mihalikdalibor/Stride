<template>
  <div class="picker" ref="pickerEl" @wheel="onWheel">
    <button type="button" class="chip" :class="{ on: modelValue === null }" @click="select(null)">{{ t('cat.none') }}</button>

    <!-- parents in the user's order, each followed by its subcategories ("› Name") -->
    <button
      v-for="c in store.ordered"
      :key="c.id"
      type="button"
      class="chip"
      :class="{ on: modelValue === c.id, 'is-sub': !!store.parentOf(c.id) }"
      :title="store.label(c.id)"
      @click="select(c.id)"
    >
      <span class="dot" :style="{ background: store.color(c.id) ?? c.color }"></span>
      <span v-if="store.parentOf(c.id)" class="sub-mark" aria-hidden="true">›</span>{{ c.name }}
    </button>

    <template v-if="creating">
      <input
        ref="inputEl"
        v-model="name"
        class="new-input"
        :placeholder="t('cat.name')"
        @keyup.enter="create"
        @keyup.esc="creating = false"
      >
      <button type="button" class="new-ok" @click="create"><i class="ti ti-check"></i></button>
    </template>
    <button v-else type="button" class="chip new" @click="startAdd">
      <i class="ti ti-plus"></i>{{ t('cat.new') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import { PALETTE } from '@/lib/colors'

const { t } = useI18n()

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const store = useCategoriesStore()
const creating = ref(false)
const name = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const pickerEl = ref<HTMLElement | null>(null)

function select(id: string | null) { emit('update:modelValue', id) }

// On desktop, translate vertical mouse-wheel into horizontal scroll over the chips.
function onWheel(e: WheelEvent) {
  const el = pickerEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  if (e.deltaY === 0) return
  el.scrollLeft += e.deltaY
  e.preventDefault()
}

async function startAdd() {
  creating.value = true
  await nextTick()
  inputEl.value?.focus()
}

async function create() {
  const n = name.value.trim()
  if (!n) return
  // auto-assign the next palette color (editable later in the manager)
  const color = PALETTE[store.categories.length % PALETTE.length]
  const cat = await store.addCategory(n, color)
  // close the inline input first, then select the new category
  name.value = ''
  creating.value = false
  if (cat) emit('update:modelValue', cat.id)
}
</script>

<style scoped>
.picker {
  display: flex; flex-wrap: nowrap; gap: 6px; align-items: center;
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  padding-bottom: 2px;
}
.picker::-webkit-scrollbar { display: none; }
.new-input, .new-ok { flex-shrink: 0; }
.chip {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  border: 0.5px solid var(--color-border-secondary);
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.chip.on { background: var(--color-background-info); border-color: transparent; color: var(--color-text-info); }
.chip.new { color: var(--color-text-info); border-style: dashed; border-color: var(--color-border-secondary); }
.chip.new i { font-size: 13px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.sub-mark { color: var(--color-text-tertiary); margin-right: -1px; }
.chip.on .sub-mark { color: inherit; opacity: 0.7; }
.new-input {
  border: 0.5px solid var(--color-text-info);
  border-radius: 14px; padding: 4px 10px; font-size: 12px;
  background: var(--color-background-primary); color: var(--color-text-primary);
  width: 130px;
}
.new-input:focus { outline: none; }
.new-ok {
  width: 26px; height: 26px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--color-text-success); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
</style>
