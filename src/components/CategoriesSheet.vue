<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div class="sheet-title">{{ t('cat.title') }}</div>
          <button class="icon-btn" @click="close" :aria-label="t('cat.closeAria')" :title="t('cat.closeAria')"><i class="ti ti-x"></i></button>
        </div>

        <div class="seg">
          <button :class="{ on: tab === 'manage' }" @click="tab = 'manage'">{{ t('cat.manage') }}</button>
          <button :class="{ on: tab === 'time' }" @click="tab = 'time'">{{ t('cat.time') }}</button>
        </div>

        <div v-if="tab === 'time'" class="list time-list">
          <div v-for="c in catTime" :key="c.id" class="cat">
            <div class="cat-fore">
              <span class="swatch static" :style="{ background: c.color }"></span>
              <span class="cat-name">{{ c.name }}</span>
              <span class="cat-time-val">{{ fmtHours(c.doneMin) }} / {{ fmtHours(c.totalMin) }}</span>
            </div>
          </div>
          <p v-if="!catTime.length" class="empty">{{ t('cat.timeEmpty') }}</p>
        </div>

        <div v-else class="list">
          <!-- top-level categories; each carries its own list of subcategories.
               Separate groups + handles, so a row can only move within its group. -->
          <draggable
            :model-value="store.topLevel"
            item-key="id"
            handle=".cat-drag"
            :group="{ name: 'cat-top', pull: false, put: false }"
            :animation="150"
            @update:model-value="store.reorderGroup"
          >
            <template #item="{ element: c }">
              <div class="cat-group">
                <CategoryRow :cat="c" :open="editing === c.id" @toggle="toggleEdit(c.id)" @delete="deleteCat(c)" />
                <draggable
                  :model-value="store.childrenOf(c.id)"
                  item-key="id"
                  handle=".sub-drag"
                  :group="{ name: 'cat-sub-' + c.id, pull: false, put: false }"
                  :animation="150"
                  @update:model-value="store.reorderGroup"
                >
                  <template #item="{ element: sc }">
                    <div class="cat-sub-item">
                      <CategoryRow :cat="sc" :open="editing === sc.id" @toggle="toggleEdit(sc.id)" @delete="deleteCat(sc)" />
                    </div>
                  </template>
                </draggable>
              </div>
            </template>
          </draggable>

          <div v-for="tomb in tombstones" :key="'tomb-' + tomb.cat.id" class="cat-tomb">
            <span class="tomb-icon"><i class="ti ti-trash"></i></span>
            <span class="tomb-text">{{ tomb.cat.name }}<template v-if="tomb.tomb.cats.length > 1"> + {{ tomb.tomb.cats.length - 1 }}</template></span>
            <button class="tomb-undo" @click="undoTomb(tomb)">
              <i class="ti ti-arrow-back-up"></i> {{ t('undo.action') }}
            </button>
          </div>

          <p v-if="!store.categories.length && !tombstones.length" class="empty">{{ t('cat.empty') }}</p>
        </div>

        <!-- new category -->
        <div v-if="tab === 'manage'" class="new">
          <div class="new-row">
            <button class="swatch" :style="{ background: newParent ? store.color(newParent) ?? newColor : newColor }" :disabled="!!newParent" @click="cyclePalette"></button>
            <input
              v-model="newName"
              class="cat-name"
              :placeholder="t('cat.newCategory')"
              @keyup.enter="add"
            >
            <button class="add-btn" :disabled="!newName.trim()" @click="add">{{ t('cat.add') }}</button>
          </div>
          <div class="new-parent">
            <i class="ti ti-subtask"></i>
            <label class="new-parent-label" for="cat-new-parent">{{ t('cat.parent') }}</label>
            <select id="cat-new-parent" v-model="newParent" class="parent-select">
              <option :value="null">{{ t('cat.parentNone') }}</option>
              <option v-for="p in store.topLevel" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <p v-if="newParent" class="new-hint">{{ t('cat.inherits') }}</p>
          <div v-else class="palette">
            <button
              v-for="col in PALETTE"
              :key="col"
              class="chip"
              :class="{ on: col === newColor }"
              :style="{ background: col }"
              @click="newColor = col"
            ></button>
            <label class="chip custom" :class="{ on: !PALETTE.includes(newColor) }" :aria-label="t('cat.customColorAria')" :title="t('cat.customColorAria')">
              <input type="color" :value="newColor" @input="newColor = ($event.target as HTMLInputElement).value">
              <i class="ti ti-color-picker"></i>
            </label>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- deleting a category that has subcategories deletes them too: confirm first -->
  <ConfirmDialog
    :open="!!pendingDelete"
    danger
    :title="t('cat.deleteParentTitle', { name: pendingDelete?.name ?? '' })"
    :confirm-label="t('common.delete')"
    :cancel-label="t('common.cancel')"
    @confirm="confirmDelete"
    @cancel="pendingDelete = null"
  >
    <p class="cd-text">{{ t('cat.deleteParentBody') }}</p>
    <ul class="cd-subs">
      <li v-for="sc in pendingChildren" :key="sc.id">
        <span class="cd-dot" :style="{ background: store.color(sc.id) ?? sc.color }"></span><span class="cd-sub-name">{{ sc.name }}</span>
      </li>
    </ul>
    <p class="cd-note">{{ t('cat.deleteParentNote') }}</p>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import CategoryRow from '@/components/CategoryRow.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useCategoriesStore, type CategoryTomb } from '@/stores/categories'
import { useTasksStore } from '@/stores/tasks'
import { PALETTE } from '@/lib/colors'
import type { Category } from '@/types'

const { t } = useI18n()

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const store = useCategoriesStore()
const tasksStore = useTasksStore()
const editing = ref<string | null>(null)
const newName = ref('')
const newColor = ref(PALETTE[5])
const newParent = ref<string | null>(null) // create as a subcategory of this one
// the chosen parent was deleted (or became a subcategory itself) → back to none
watch(() => store.topLevel, top => {
  if (newParent.value && !top.some(c => c.id === newParent.value)) newParent.value = null
})
const tab = ref<'manage' | 'time'>('manage')

// hours tracked per category for the currently viewed week (done / planned), categories without any timed task hidden
const catTime = computed(() => {
  const rows = store.ordered.map(c => {
    let doneMin = 0, totalMin = 0
    for (const task of tasksStore.tasks) {
      if (task.category_id !== c.id || task.duration_min == null) continue
      totalMin += task.duration_min
      if (task.status === 'done') doneMin += task.duration_min
    }
    return { id: c.id, name: store.label(c.id), color: store.color(c.id) ?? c.color, doneMin, totalMin }
  })
  return rows.filter(r => r.totalMin > 0).sort((a, b) => b.totalMin - a.totalMin)
})
function fmtHours(min: number) {
  const h = Math.round(min / 60 * 10) / 10
  return `${h}h`
}

function close() { emit('update:modelValue', false) }

function toggleEdit(id: string) {
  editing.value = editing.value === id ? null : id
}

// delete (via trash tap or swipe-left) leaves an inline "undo" row for ~5s; a
// category with subcategories takes them along, so it asks first
type Tomb = { cat: Category; tomb: CategoryTomb }
const tombstones = ref<Tomb[]>([])
const tombTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingDelete = ref<Category | null>(null)
const pendingChildren = computed(() => (pendingDelete.value ? store.childrenOf(pendingDelete.value.id) : []))

function deleteCat(c: Category) {
  if (deleting.has(c.id)) return
  if (store.childrenOf(c.id).length) pendingDelete.value = c
  else doDelete(c)
}

function confirmDelete() {
  const c = pendingDelete.value
  pendingDelete.value = null
  if (c) doDelete(c)
}

// a delete looks up the category's links first, so guard against a second tap meanwhile
const deleting = new Set<string>()
async function doDelete(c: Category) {
  if (deleting.has(c.id)) return
  deleting.add(c.id)
  editing.value = null
  let tomb: CategoryTomb
  try {
    tomb = await store.deleteCategory(c.id)
  } catch (e) {
    console.error('delete category failed', e)
    return
  } finally {
    deleting.delete(c.id)
  }
  tombstones.value.push({ cat: { ...c }, tomb })
  tombTimers.set(c.id, setTimeout(() => {
    tombstones.value = tombstones.value.filter(x => x.cat.id !== c.id)
    tombTimers.delete(c.id)
  }, 5000))
}

async function undoTomb(tomb: Tomb) {
  const tmr = tombTimers.get(tomb.cat.id)
  if (tmr) { clearTimeout(tmr); tombTimers.delete(tomb.cat.id) }
  tombstones.value = tombstones.value.filter(x => x.cat.id !== tomb.cat.id)
  await store.restoreCategory(tomb.tomb)
}

function cyclePalette() {
  const i = PALETTE.indexOf(newColor.value)
  newColor.value = PALETTE[(i + 1) % PALETTE.length]
}

async function add() {
  const name = newName.value.trim()
  if (!name) return
  await store.addCategory(name, newColor.value, newParent.value)
  newName.value = ''
}
</script>

<style scoped>
.sheet-backdrop {
  position: absolute; inset: 0; z-index: 30;
  background: rgba(0,0,0,0.35);
  display: flex; align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--color-background-primary);
  border-radius: 18px 18px 0 0;
  padding: 8px 0 max(16px, env(safe-area-inset-bottom));
  max-height: 85%; overflow-y: auto;
}
.sheet-grip { width: 36px; height: 5px; border-radius: 3px; background: var(--color-border-secondary); margin: 6px auto 4px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px 8px; }
.sheet-title { font-size: 17px; font-weight: 500; }

.seg { display: flex; background: var(--color-background-tertiary); border-radius: 10px; padding: 3px; margin: 0 18px 8px; }
.seg button {
  flex: 1; border: none; background: none; cursor: pointer;
  font-size: 13px; color: var(--color-text-secondary); padding: 6px 0; border-radius: 8px;
}
.seg button.on { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; }

.time-list { min-height: 220px; }
.time-list .empty { padding-top: 24px; }
.swatch.static { cursor: default; }
.cat-time-val { font-size: 13px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.list { padding: 0 18px; }
.cat { padding: 8px 0; border-top: 0.5px solid var(--color-border-tertiary); }
.cat-fore { display: flex; align-items: center; gap: 12px; background: var(--color-background-primary); }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 0.5px solid var(--color-border-tertiary); flex-shrink: 0; cursor: pointer; padding: 0; }
.swatch:disabled { cursor: default; }
.cat-name {
  flex: 1; min-width: 0; border: none; background: none; color: var(--color-text-primary);
  font-size: 15px; padding: 6px 0;
}
.cat-name:focus { outline: none; }
.empty { color: var(--color-text-tertiary); font-size: 14px; padding: 12px 0; }

.cat-tomb {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 0; border-top: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-tertiary); animation: tomb-in .2s ease;
}
.cat-tomb .tomb-icon { display: flex; align-items: center; font-size: 18px; }
.cat-tomb .tomb-text { flex: 1; min-width: 0; font-size: 15px; text-decoration: line-through; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tomb-undo {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  border: none; cursor: pointer; padding: 5px 12px; border-radius: 999px;
  background: var(--color-background-info); color: var(--color-text-info);
  font-size: 13px; font-weight: 500;
}
.tomb-undo i { font-size: 15px; }
@keyframes tomb-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

.palette { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 0 4px; }
.chip { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.chip.on { border-color: var(--color-text-primary); }
.chip.custom {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 27px; height: 27px;
  background: var(--color-text-tertiary); color: #fff;
}
.chip.custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; padding: 0; border: none; }
.chip.custom i { font-size: 14px; pointer-events: none; }

.new-parent { display: flex; align-items: center; gap: 10px; padding: 10px 0 0; }
.new-parent > i { color: var(--color-text-tertiary); font-size: 18px; }
.new-parent-label { flex: 1; font-size: 14px; color: var(--color-text-secondary); }
.parent-select {
  max-width: 55%; min-width: 0;
  border: 0.5px solid var(--color-border-secondary); border-radius: var(--border-radius-md);
  background: var(--color-background-primary); color: var(--color-text-primary);
  font-family: inherit; font-size: 14px; padding: 5px 8px; cursor: pointer;
}
.parent-select:focus-visible { outline: 2px solid var(--color-text-info); outline-offset: 1px; }
.new-hint { color: var(--color-text-tertiary); font-size: 12px; margin: 6px 0 0; }

/* confirmation dialog body (slot content — compiled with this component's scope) */
.cd-text { margin: 0 0 8px; }
.cd-subs {
  list-style: none; margin: 0 0 8px; padding: 0;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;
}
.cd-subs li {
  display: flex; align-items: center; gap: 6px; max-width: 100%;
  padding: 4px 10px; border-radius: 999px;
  background: var(--color-background-secondary); color: var(--color-text-primary);
  font-size: 13px;
}
.cd-sub-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cd-note { margin: 0; font-size: 12px; color: var(--color-text-tertiary); }

.new { padding: 12px 18px 4px; border-top: 0.5px solid var(--color-border-tertiary); margin-top: 6px; }
.new-row { display: flex; align-items: center; gap: 12px; }
.add-btn {
  border: none; background: var(--color-background-info); color: var(--color-text-info);
  border-radius: 14px; padding: 6px 14px; font-size: 13px; font-weight: 500; cursor: pointer;
}
.add-btn:disabled { opacity: 0.4; cursor: default; }

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
