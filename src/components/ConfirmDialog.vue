<template>
  <!-- Blocking confirmation: covers the whole viewport (header, tab bar and the
       desktop margins too) and can only be closed with one of its two buttons —
       no backdrop tap, no Esc. -->
  <Teleport to="body">
    <transition name="cd">
      <div v-if="open" class="cd-scrim" @click.stop @mousedown="keepFocus">
        <div
          class="cd-card"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
        >
          <span class="cd-icon" :class="{ danger }"><i class="ti" :class="icon"></i></span>
          <h2 :id="titleId" class="cd-title">{{ title }}</h2>
          <div :id="bodyId" class="cd-body"><slot /></div>
          <div class="cd-actions">
            <button ref="cancelEl" type="button" class="cd-btn cd-cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button ref="confirmEl" type="button" class="cd-btn cd-confirm" :class="{ danger }" @click="emit('confirm')">{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  icon?: string
}>(), { danger: false, icon: 'ti-trash' })

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `cd-title-${uid}`
const bodyId = `cd-body-${uid}`
const cancelEl = ref<HTMLButtonElement | null>(null)
const confirmEl = ref<HTMLButtonElement | null>(null)

// While open, the app behind is `inert` (no focus, no clicks, hidden from
// screen readers) and keys are caught at document level. Focus starts on the
// safe choice and goes back where it was on close.
let returnFocus: HTMLElement | null = null
const appRoot = () => document.getElementById('app')

function lock() {
  returnFocus = document.activeElement as HTMLElement | null
  appRoot()?.setAttribute('inert', '')
  document.addEventListener('keydown', onKey, true)
}
function unlock() {
  appRoot()?.removeAttribute('inert')
  document.removeEventListener('keydown', onKey, true)
  returnFocus?.focus?.()
  returnFocus = null
}

watch(() => props.open, async open => {
  if (open) {
    lock()
    await nextTick()
    cancelEl.value?.focus()
  } else if (returnFocus !== null || appRoot()?.hasAttribute('inert')) {
    unlock()
  }
}, { immediate: true })
onBeforeUnmount(() => { if (props.open) unlock() })

// Esc never closes it; Tab cycles between the two buttons only
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return }
  if (e.key !== 'Tab') return
  e.preventDefault()
  e.stopPropagation()
  const next = document.activeElement === cancelEl.value ? confirmEl.value : cancelEl.value
  next?.focus()
}

// a press on the scrim/card (not a button) must not pull focus out of the dialog
function keepFocus(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('button')) e.preventDefault()
}
</script>

<style scoped>
.cd-scrim {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  /* strong enough to isolate the card on both the light and the dark palette */
  background: rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  overscroll-behavior: contain;
  touch-action: none;
}

.cd-card {
  width: 100%; max-width: 320px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 22px 18px 16px;
  border-radius: 14px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  text-align: center;
}
.cd-icon {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; margin-bottom: 2px;
  background: var(--color-background-tertiary); color: var(--color-text-secondary);
}
.cd-icon.danger {
  background: color-mix(in srgb, var(--color-text-danger) 14%, transparent);
  color: var(--color-text-danger);
}
.cd-title {
  margin: 0; font-size: 17px; font-weight: 500; line-height: 1.3;
  color: var(--color-text-primary); text-wrap: balance;
}
.cd-body {
  width: 100%; font-size: 14px; line-height: 1.45;
  color: var(--color-text-secondary); text-wrap: pretty;
}
.cd-actions { width: 100%; display: flex; gap: 10px; margin-top: 10px; }
.cd-btn {
  flex: 1; min-height: 44px; border: none; cursor: pointer;
  border-radius: var(--border-radius-lg);
  font-family: inherit; font-size: 15px; font-weight: 500;
  transition: transform .1s ease, filter .15s ease;
}
.cd-btn:active { transform: scale(0.97); }
.cd-btn:focus-visible { outline: 2px solid var(--color-text-info); outline-offset: 2px; }
.cd-cancel { background: var(--color-background-tertiary); color: var(--color-text-primary); }
.cd-confirm { background: var(--color-text-info); color: #fff; }
.cd-confirm.danger { background: var(--color-text-danger); }
.cd-confirm:hover, .cd-cancel:hover { filter: brightness(0.96); }

/* enter: fade + slight scale; exit a bit faster */
.cd-enter-active { transition: opacity .18s ease; }
.cd-leave-active { transition: opacity .12s ease; }
.cd-enter-active .cd-card { transition: transform .18s cubic-bezier(.2, .9, .3, 1.2), opacity .18s ease; }
.cd-leave-active .cd-card { transition: transform .12s ease, opacity .12s ease; }
.cd-enter-from, .cd-leave-to { opacity: 0; }
.cd-enter-from .cd-card, .cd-leave-to .cd-card { transform: scale(0.96); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .cd-enter-active, .cd-leave-active, .cd-enter-active .cd-card, .cd-leave-active .cd-card, .cd-btn {
    transition: none !important;
  }
}
</style>
