<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div class="sheet-title">{{ t('ics.title') }}</div>
          <button class="icon-btn" @click="close" :aria-label="t('cat.closeAria')" :title="t('cat.closeAria')"><i class="ti ti-x"></i></button>
        </div>

        <!-- new feed -->
        <div class="form">
          <p class="hint">{{ t('ics.hint') }}</p>
          <div class="url-row">
            <input
              ref="urlEl"
              v-model="url"
              class="field-input"
              type="url"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :placeholder="t('ics.urlPlaceholder')"
              @input="checked = false; error = ''"
              @keyup.enter="check"
            >
            <button v-if="!checked" class="act-btn brand" :disabled="!url.trim() || busy" @click="check">
              <i v-if="busy" class="ti ti-loader-2 spin"></i>{{ t('ics.check') }}
            </button>
          </div>
          <p v-if="error" class="msg err"><i class="ti ti-alert-circle"></i>{{ error }}</p>

          <template v-if="checked">
            <p class="msg ok"><i class="ti ti-circle-check"></i>{{ t('ics.found', { n: foundCount }) }}</p>
            <label class="label">{{ t('ics.name') }}</label>
            <input v-model="name" class="field-input" :placeholder="t('ics.namePlaceholder')" @keyup.enter="connect">
            <label class="label">{{ t('ics.category') }}</label>
            <CategoryPicker v-model="categoryId" />
            <div class="form-actions">
              <button class="act-btn muted" @click="reset">{{ t('common.cancel') }}</button>
              <button class="act-btn brand" :disabled="!name.trim() || busy" @click="connect">
                <i v-if="busy" class="ti ti-loader-2 spin"></i>{{ t('ics.connectAction') }}
              </button>
            </div>
          </template>
        </div>

        <!-- connected feeds -->
        <div v-if="store.feeds.length" class="list">
          <div class="list-title">{{ t('ics.connected') }}</div>
          <div v-for="f in store.feeds" :key="f.id" class="feed">
            <div class="feed-main">
              <span class="dot" :style="{ background: categoriesStore.color(f.category_id) ?? 'var(--color-border-secondary)' }"></span>
              <button class="feed-text" @click="editingId = editingId === f.id ? null : f.id" :aria-expanded="editingId === f.id">
                <span class="feed-name">{{ f.name }}</span>
                <span class="feed-sub" :class="{ err: f.last_error }">
                  {{ f.last_error ? errorText(f.last_error) : f.last_synced_at ? t('ics.synced', { when: fmtWhen(f.last_synced_at) }) : t('ics.neverSynced') }}
                </span>
              </button>
              <template v-if="confirmId === f.id">
                <button class="act-btn solid-danger small" @click="disconnect(f.id)">{{ t('ics.disconnect') }}</button>
                <button class="icon-btn" @click="confirmId = null" :aria-label="t('common.cancel')" :title="t('common.cancel')"><i class="ti ti-x"></i></button>
              </template>
              <template v-else>
                <button class="icon-btn" :disabled="store.syncing.has(f.id)" @click="store.sync(f)" :aria-label="t('ics.refresh')" :title="t('ics.refresh')">
                  <i class="ti ti-refresh" :class="{ spin: store.syncing.has(f.id) }"></i>
                </button>
                <button class="icon-btn" @click="confirmId = f.id" :aria-label="t('ics.disconnect')" :title="t('ics.disconnect')"><i class="ti ti-trash"></i></button>
              </template>
            </div>
            <div v-if="editingId === f.id" class="feed-edit">
              <CategoryPicker :model-value="f.category_id" @update:model-value="store.updateFeed(f.id, { category_id: $event })" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CategoryPicker from '@/components/CategoryPicker.vue'
import { useCalendarsStore } from '@/stores/calendars'
import { useCategoriesStore } from '@/stores/categories'

const { t, te, locale } = useI18n()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const store = useCalendarsStore()
const categoriesStore = useCategoriesStore()

const url = ref('')
const name = ref('')
const categoryId = ref<string | null>(null)
const checked = ref(false)
const foundCount = ref(0)
const busy = ref(false)
const error = ref('')
const editingId = ref<string | null>(null)
const confirmId = ref<string | null>(null)
const urlEl = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, async open => {
  if (!open) return
  await nextTick()
  if (!store.feeds.length) urlEl.value?.focus()
})

function close() { emit('update:modelValue', false) }

const errorText = (code: string) => t(te(`ics.err.${code}`) ? `ics.err.${code}` : 'ics.err.server_error')

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

function reset() {
  url.value = ''
  name.value = ''
  categoryId.value = null
  checked.value = false
  error.value = ''
}

async function check() {
  if (!url.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await store.preview(url.value)
    foundCount.value = res.count
    if (!name.value.trim()) name.value = res.name ?? ''
    checked.value = true
  } catch (e) {
    error.value = errorText((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function connect() {
  if (!name.value.trim() || busy.value) return
  busy.value = true
  try {
    const syncError = await store.connect(url.value, name.value.trim(), categoryId.value)
    reset()
    if (syncError) error.value = errorText(syncError)
  } catch (e) {
    error.value = errorText((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function disconnect(id: string) {
  confirmId.value = null
  if (editingId.value === id) editingId.value = null
  await store.disconnect(id)
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

.form { padding: 0 18px 12px; display: flex; flex-direction: column; gap: 8px; }
.hint { margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; }
.url-row { display: flex; gap: 8px; align-items: center; }
.url-row .field-input { flex: 1; min-width: 0; }
.field-input {
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  padding: 8px 10px; font-size: 15px; height: 38px;
}
.field-input:focus { outline: none; border-color: var(--color-text-info); }
.label { font-size: 12px; color: var(--color-text-tertiary); margin-top: 4px; }
.msg { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; }
.msg i { font-size: 16px; flex-shrink: 0; }
.msg.err { color: var(--color-text-danger); }
.msg.ok { color: var(--color-text-success); }
.form-actions { display: flex; gap: 10px; margin-top: 6px; }
.form-actions > button { flex: 1; }

.list { padding: 4px 18px 0; border-top: 0.5px solid var(--color-border-tertiary); }
.list-title { font-size: 12px; color: var(--color-text-tertiary); padding: 12px 0 4px; }
.feed { padding: 8px 0; border-top: 0.5px solid var(--color-border-tertiary); }
.list-title + .feed { border-top: none; }
.feed-main { display: flex; align-items: center; gap: 10px; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.feed-text {
  flex: 1; min-width: 0; border: none; background: none; padding: 0; text-align: left; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
}
.feed-name { font-size: 15px; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feed-sub { font-size: 12px; color: var(--color-text-tertiary); }
.feed-sub.err { color: var(--color-text-danger); }
.feed-edit { padding: 8px 0 2px 20px; }
.icon-btn:disabled { opacity: 0.5; cursor: default; }
.act-btn.small { height: 30px; padding: 0 10px; font-size: 13px; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
