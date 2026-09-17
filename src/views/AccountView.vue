<template>
  <div class="account">
    <!-- brand header (matches home); back arrow on the right -->
    <header class="ac-head">
      <div class="ac-brand">
        <img src="/stride_icon.svg" alt="Stride" class="ac-logo">
        <span class="ac-name">Stride</span>
      </div>
      <button class="icon-btn" @click="goBack" :aria-label="t('account.backAria')" :title="t('account.backAria')">
        <i class="ti ti-arrow-left"></i>
      </button>
    </header>

    <!-- main settings list -->
    <div v-if="view === 'main'" class="ac-body">
      <div class="sec-label">{{ t('account.secGeneral') }}</div>
      <section class="ac-card">
        <div class="ac-row">
          <span class="row-label">{{ t('account.language') }}</span>
          <LanguageSwitch />
        </div>
        <div class="divider"></div>
        <div class="ac-row">
          <span class="row-label">{{ t('account.theme') }}</span>
          <div class="seg">
            <button
              v-for="opt in themeOptions"
              :key="opt"
              :class="{ on: theme === opt }"
              @click="setTheme(opt)"
            >{{ t('account.theme' + cap(opt)) }}</button>
          </div>
        </div>
        <div class="divider"></div>
        <button class="ac-row link" @click="catSheet = true">
          <span class="row-label">{{ t('account.categories') }}</span>
          <span class="row-value">{{ categoriesStore.categories.length }}<i class="ti ti-chevron-right"></i></span>
        </button>
        <div class="divider"></div>
        <div class="ac-row select-row">
          <span class="row-label">{{ t('stats.weeklyGoal') }}</span>
          <span class="row-value">{{ weeklyGoal }}<i class="ti ti-chevron-right"></i></span>
          <select
            class="row-select"
            :value="weeklyGoal"
            @change="setWeeklyGoal(Number(($event.target as HTMLSelectElement).value))"
            :aria-label="t('stats.weeklyGoal')"
          >
            <option v-for="n in goalRange" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="divider"></div>
        <div class="ac-row">
          <span class="row-label">{{ t('stats.countEvents') }}</span>
          <button
            class="ac-switch"
            :class="{ on: countEvents }"
            role="switch"
            :aria-checked="countEvents"
            :aria-label="t('stats.countEvents')"
            @click="setCountEvents(!countEvents)"
          ></button>
        </div>
      </section>

      <div class="sec-label">{{ t('account.secAccount') }}</div>
      <section class="ac-card account-card">
        <div class="avatar">{{ initial }}</div>
        <div class="ac-email">{{ email }}</div>
      </section>

      <div class="sec-label">{{ t('account.secSecurity') }}</div>
      <button class="ac-card link row-card" @click="view = 'password'">
        <span class="row-label">{{ t('account.changePassword') }}</span>
        <i class="ti ti-chevron-right"></i>
      </button>

      <div class="sec-label">{{ t('account.secData') }}</div>
      <section class="ac-card">
        <button class="ac-row link" @click="doExport">
          <span class="row-label">{{ t('account.exportData') }}</span>
          <i class="ti ti-download row-ic"></i>
        </button>
        <div class="divider"></div>
        <button class="ac-row link" @click="fileInput?.click()">
          <span class="row-label">{{ t('account.importData') }}</span>
          <i class="ti ti-upload row-ic"></i>
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden-file" @change="doImport">
      </section>
      <p class="data-note">{{ t('account.importNote') }}</p>
      <p v-if="dataMsg" class="data-msg" :class="{ error: dataErr }">{{ dataMsg }}</p>

      <div class="sec-label">{{ t('account.secAbout') }}</div>
      <section class="ac-card">
        <button class="ac-row link" @click="view = 'privacy'">
          <span class="row-label">{{ t('account.privacy') }}</span>
          <i class="ti ti-chevron-right row-ic"></i>
        </button>
        <div class="divider"></div>
        <button class="ac-row link" @click="view = 'terms'">
          <span class="row-label">{{ t('account.terms') }}</span>
          <i class="ti ti-chevron-right row-ic"></i>
        </button>
        <div class="divider"></div>
        <a class="ac-row link" :href="`mailto:${CONTACT_EMAIL}?subject=Stride feedback`">
          <span class="row-label">{{ t('account.feedback') }}</span>
          <i class="ti ti-external-link row-ic"></i>
        </a>
        <div class="divider"></div>
        <div class="ac-row">
          <span class="row-label">{{ t('account.version') }}</span>
          <span class="row-value">{{ APP_VERSION }}</span>
        </div>
      </section>

      <button class="signout-btn" @click="auth.signOut()">
        <i class="ti ti-logout"></i> {{ t('account.signOut') }}
      </button>

      <!-- danger zone -->
      <template v-if="!confirmDelete">
        <button class="delete-link" @click="confirmDelete = true">{{ t('account.deleteAccount') }}</button>
      </template>
      <section v-else class="ac-card delete-box">
        <p class="delete-warn">{{ t('account.deleteAccountWarn') }}</p>
        <p v-if="deleteError" class="msg error">{{ deleteError }}</p>
        <button class="delete-btn" :disabled="deleting" @click="doDelete">
          {{ t('account.deleteAccountConfirm') }}
        </button>
        <button class="cancel-btn" @click="confirmDelete = false">{{ t('common.cancel') }}</button>
      </section>
    </div>

    <!-- change password sub-view -->
    <div v-else-if="view === 'password'" class="ac-body">
      <h2 class="pw-title">{{ t('account.changePassword') }}</h2>

      <div class="pw-banner">
        <i class="ti ti-lock"></i>
        <span>{{ t('account.securityNote') }}</span>
      </div>

      <label class="field-label">{{ t('account.currentPassword') }}</label>
      <div class="pw-wrap">
        <input
          v-model="currentPassword"
          :type="showPw ? 'text' : 'password'"
          autocomplete="current-password"
          :placeholder="t('account.currentPassword')"
          class="ac-input"
        >
        <button type="button" class="pw-toggle" @click="showPw = !showPw">
          <i :class="showPw ? 'ti ti-eye-off' : 'ti ti-eye'"></i>
        </button>
      </div>

      <label class="field-label">{{ t('account.newPassword') }}</label>
      <div class="pw-wrap">
        <input
          v-model="newPassword"
          :type="showPw ? 'text' : 'password'"
          autocomplete="new-password"
          minlength="6"
          :placeholder="t('account.newPassword')"
          class="ac-input"
        >
        <button type="button" class="pw-toggle" @click="showPw = !showPw">
          <i :class="showPw ? 'ti ti-eye-off' : 'ti ti-eye'"></i>
        </button>
      </div>
      <div v-if="newPassword" class="strength">
        <div class="strength-bars">
          <span v-for="i in 4" :key="i" :class="[{ on: i <= pwStrength }, i <= pwStrength ? strengthClass : '']"></span>
        </div>
        <span class="strength-label" :class="strengthClass">{{ strengthLabel }}</span>
      </div>
      <p class="pw-hint">{{ t('account.pwHint') }}</p>

      <label class="field-label">{{ t('account.confirmPassword') }}</label>
      <div class="pw-wrap">
        <input
          v-model="confirmPassword"
          :type="showPw ? 'text' : 'password'"
          autocomplete="new-password"
          minlength="6"
          :placeholder="t('account.confirmPassword')"
          class="ac-input"
        >
        <button type="button" class="pw-toggle" @click="showPw = !showPw">
          <i :class="showPw ? 'ti ti-eye-off' : 'ti ti-eye'"></i>
        </button>
      </div>

      <p v-if="pwError" class="msg error">{{ pwError }}</p>
      <p v-if="pwOk" class="msg ok">{{ t('account.passwordChanged') }}</p>

      <button class="save-btn" :disabled="!canSave || saving" @click="changePassword">
        {{ t('account.save') }}
      </button>
      <button class="cancel-btn" @click="cancelPw">{{ t('common.cancel') }}</button>
    </div>

    <!-- privacy policy (static) -->
    <div v-else-if="view === 'privacy'" class="ac-body legal">
      <h2 class="pw-title">{{ t('account.privacy') }}</h2>
      <p class="legal-updated">{{ t('account.lastUpdated') }}</p>
      <div class="legal-banner">
        <div class="legal-banner-ic"><i class="ti ti-shield-lock"></i></div>
        <div>
          <div class="legal-banner-title">We respect your privacy.</div>
          <div class="legal-banner-sub">This policy explains what information we collect and how we use it.</div>
        </div>
      </div>

      <div class="legal-sec">
        <i class="ti ti-user legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Information we collect</h3>
          <p class="legal-sub">We collect only what is necessary to provide and improve Stride.</p>
          <ul class="legal-list">
            <li>Email address</li>
            <li>Tasks and categories you create</li>
            <li>Basic usage analytics</li>
          </ul>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-database legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">How we use your information</h3>
          <p class="legal-sub">Your information is used to:</p>
          <ul class="legal-list">
            <li>Provide and sync the service</li>
            <li>Authenticate your account</li>
            <li>Improve Stride and fix issues</li>
          </ul>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-lock legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Your rights</h3>
          <p class="legal-sub">You have full control over your data.</p>
          <ul class="legal-list">
            <li>Export your data at any time</li>
            <li>Delete your account and data</li>
          </ul>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-mail legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Contact</h3>
          <p class="legal-sub">If you have any questions, contact us at:</p>
          <p class="legal-p"><a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a></p>
        </div>
      </div>
    </div>

    <!-- terms of service (static) -->
    <div v-else class="ac-body legal">
      <h2 class="pw-title">{{ t('account.terms') }}</h2>
      <p class="legal-updated">{{ t('account.lastUpdated') }}</p>
      <div class="legal-banner">
        <div class="legal-banner-ic"><i class="ti ti-file-text"></i></div>
        <div>
          <div class="legal-banner-title">By using Stride you agree to these terms.</div>
          <div class="legal-banner-sub">Please read them carefully.</div>
        </div>
      </div>

      <div class="legal-sec">
        <i class="ti ti-circle-check legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Using Stride</h3>
          <p class="legal-sub">Stride is a productivity and task management tool.</p>
          <p class="legal-sub">You agree to use it for personal and lawful purposes only.</p>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-user legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Your content</h3>
          <p class="legal-sub">You are responsible for the tasks, notes and any other content you create in Stride.</p>
          <p class="legal-sub">You keep full ownership of your content.</p>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-shield legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Availability</h3>
          <p class="legal-sub">Stride is provided "as is" without warranties of any kind.</p>
          <p class="legal-sub">We do our best to keep the service reliable and secure.</p>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-circle-x legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Termination</h3>
          <p class="legal-sub">You may stop using Stride and delete your account at any time through the application.</p>
        </div>
      </div>
      <div class="legal-sec">
        <i class="ti ti-mail legal-ic"></i>
        <div class="legal-body">
          <h3 class="legal-h">Contact</h3>
          <p class="legal-sub">If you have any questions, contact us at:</p>
          <p class="legal-p"><a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a></p>
        </div>
      </div>
    </div>

    <CategoriesSheet v-model="catSheet" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import LanguageSwitch from '@/components/LanguageSwitch.vue'
import CategoriesSheet from '@/components/CategoriesSheet.vue'
import { applyTheme, getTheme, type Theme } from '@/lib/theme'
import { isDemo } from '@/lib/demo'
import { exportBackup, importBackup } from '@/lib/backup'
import { weeklyGoal, setWeeklyGoal } from '@/lib/goal'
import { countEvents, setCountEvents } from '@/lib/statsPrefs'

const goalRange = Array.from({ length: 50 }, (_, i) => i + 1)

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const categoriesStore = useCategoriesStore()

const view = ref<'main' | 'password' | 'privacy' | 'terms'>('main')
const CONTACT_EMAIL = 'stridebykeno@gmail.com'
const APP_VERSION = '1.2.0'
const email = computed(() => auth.session?.user.email ?? 'demo@stride.app')
const initial = computed(() => email.value.charAt(0).toUpperCase())

const themeOptions: Theme[] = ['system', 'light', 'dark']
const theme = ref<Theme>(getTheme())
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
function setTheme(t: Theme) {
  theme.value = t
  applyTheme(t)
}

const catSheet = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPw = ref(false)
const saving = ref(false)
const pwError = ref('')
const pwOk = ref(false)
const canSave = computed(() =>
  currentPassword.value.length > 0 && newPassword.value.length >= 6 && confirmPassword.value.length >= 6)

// 0–4 strength score from length + character variety
const pwStrength = computed(() => {
  const p = newPassword.value
  let s = 0
  if (p.length >= 8) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
})
const strengthClass = computed(() => (pwStrength.value <= 1 ? 'weak' : pwStrength.value <= 3 ? 'medium' : 'strong'))
const strengthLabel = computed(() =>
  pwStrength.value <= 1 ? t('account.pwWeak') : pwStrength.value <= 3 ? t('account.pwMedium') : t('account.pwStrong'))

function resetPwForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  pwError.value = ''
}
function cancelPw() {
  resetPwForm()
  pwOk.value = false
  view.value = 'main'
}

async function changePassword() {
  pwError.value = ''
  pwOk.value = false
  if (newPassword.value !== confirmPassword.value) {
    pwError.value = t('auth.passwordsDiffer')
    return
  }
  saving.value = true
  try {
    if (!isDemo) {
      // verify the current password by re-authenticating, then set the new one
      await auth.signIn(email.value, currentPassword.value)
      await auth.updatePassword(newPassword.value)
    }
    pwOk.value = true
    resetPwForm()
  } catch (e) {
    pwError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

// export / import data
const fileInput = ref<HTMLInputElement | null>(null)
const dataMsg = ref('')
const dataErr = ref(false)
async function doExport() {
  dataMsg.value = ''; dataErr.value = false
  try { await exportBackup() } catch (e) { dataErr.value = true; dataMsg.value = (e as Error).message }
}
async function doImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-importing the same file
  if (!file) return
  dataMsg.value = ''; dataErr.value = false
  try {
    const res = await importBackup(file)
    dataMsg.value = t('account.importDone', { n: res.tasks })
  } catch (err) {
    dataErr.value = true; dataMsg.value = (err as Error).message
  }
}

// delete account (irreversible)
const confirmDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')
async function doDelete() {
  deleteError.value = ''
  deleting.value = true
  try {
    if (isDemo) { confirmDelete.value = false; return }
    await auth.deleteAccount() // signs out → app shows login
  } catch (e) {
    deleteError.value = (e as Error).message
  } finally {
    deleting.value = false
  }
}

// back arrow: from the password sub-view return to the list, otherwise leave settings
function goBack() {
  if (view.value !== 'main') { view.value = 'main'; return }
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<style scoped>
.account { min-height: 100%; }

.ac-head {
  flex-shrink: 0;
  background: var(--color-background-primary);
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px 8px;
}
.ac-brand { display: flex; align-items: center; gap: 9px; }
.ac-logo { height: 26px; width: auto; filter: var(--logo-filter); }
.ac-name { font-size: 19px; font-weight: 600; letter-spacing: -0.5px; color: var(--color-text-primary); position: relative; top: -2px; }

.ac-body { padding: 8px 18px 20px; display: flex; flex-direction: column; gap: 8px; }

.sec-label {
  font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px;
  color: var(--color-text-tertiary); padding: 14px 4px 4px;
}

.ac-card {
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
}
.ac-card.compact { padding: 12px 16px; }
.ac-label { font-size: 12px; color: var(--color-text-secondary); }
.ac-email { font-size: 15px; color: var(--color-text-primary); }

.account-card { display: flex; align-items: center; gap: 11px; }
.avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--color-text-info); color: var(--color-text-info);
  font-size: 16px; font-weight: 600;
}
.account-card .ac-email { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ac-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
.ac-row.link { width: 100%; border: none; background: none; cursor: pointer; padding: 0; text-align: left; text-decoration: none; color: inherit; }
.row-label { font-size: 15px; color: var(--color-text-primary); }
.row-value { display: flex; align-items: center; gap: 4px; font-size: 15px; color: var(--color-text-tertiary); }
.row-value i { font-size: 18px; }
.ac-card .divider { height: 0.5px; background: var(--color-border-tertiary); margin: 12px 0; }

.row-card {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; border: none; cursor: pointer;
  font-size: 15px; color: var(--color-text-primary);
}
.row-card i { color: var(--color-text-tertiary); font-size: 18px; }
.row-ic { color: var(--color-text-tertiary); font-size: 18px; }
.hidden-file { display: none; }
.data-note { font-size: 12px; color: var(--color-text-tertiary); margin: 6px 4px 0; line-height: 1.4; }
.data-msg { font-size: 13px; margin: 8px 4px 0; color: var(--color-text-success); }
.data-msg.error { color: var(--color-text-danger); }

.select-row { position: relative; }
.select-row .row-value i { font-size: 18px; }
.row-select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; }

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

.seg { display: flex; background: var(--color-background-tertiary); border-radius: 9px; padding: 2px; }
.seg button {
  border: none; background: none; cursor: pointer;
  font-size: 12px; color: var(--color-text-secondary); padding: 5px 10px; border-radius: 7px;
}
.seg button.on { background: var(--color-background-primary); color: var(--color-text-primary); font-weight: 500; }

.pw-title { font-size: 22px; font-weight: 500; margin: 8px 4px 14px; }
.legal .pw-title { margin-bottom: 4px; }
.legal-updated { font-size: 12px; color: var(--color-text-tertiary); margin: 0 4px 16px; }
.legal-banner {
  display: flex; align-items: center; gap: 14px;
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-lg);
  padding: 16px; margin-bottom: 4px;
}
.legal-banner-ic {
  width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border-secondary);
  color: var(--color-text-info); font-size: 22px;
}
.legal-banner-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); line-height: 1.3; }
.legal-banner-sub { font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; margin-top: 3px; }

.legal-sec { display: flex; gap: 14px; padding: 18px 2px; }
.legal-sec + .legal-sec { border-top: 0.5px solid var(--color-border-tertiary); }
.legal-ic { color: var(--color-text-info); font-size: 22px; flex-shrink: 0; line-height: 1; margin-top: 1px; }
.legal-body { min-width: 0; flex: 1; }
.legal-h { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 5px; }
.legal-sub { font-size: 14px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 6px; }
.legal-sub:last-child { margin-bottom: 0; }
.legal-list { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
.legal-list li { position: relative; padding-left: 16px; font-size: 14px; color: var(--color-text-secondary); line-height: 1.35; }
.legal-list li::before { content: ''; position: absolute; left: 3px; top: 7px; width: 5px; height: 5px; border-radius: 50%; background: var(--color-text-info); }
.legal-p { font-size: 14px; line-height: 1.5; margin: 0; }
.legal-p a { color: var(--color-text-info); text-decoration: none; }
.pw-banner {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-lg);
  padding: 14px 16px; margin-bottom: 18px;
  font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; text-align: center;
}
.pw-banner i { font-size: 22px; color: var(--color-text-info); flex-shrink: 0; }
.field-label { display: block; font-size: 13px; color: var(--color-text-secondary); margin: 14px 2px 6px; }
.strength { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.strength-bars { display: flex; gap: 4px; flex: 1; }
.strength-bars span { flex: 1; height: 4px; border-radius: 2px; background: var(--color-background-tertiary); }
.strength-bars span.weak { background: var(--color-text-danger); }
.strength-bars span.medium { background: var(--color-text-warning, #ff9500); }
.strength-bars span.strong { background: var(--color-text-success); }
.strength-label { font-size: 12px; font-weight: 500; flex-shrink: 0; }
.strength-label.weak { color: var(--color-text-danger); }
.strength-label.medium { color: var(--color-text-warning, #ff9500); }
.strength-label.strong { color: var(--color-text-success); }
.pw-hint { font-size: 12px; color: var(--color-text-tertiary); margin: 8px 2px 0; line-height: 1.4; }
.pw-wrap { position: relative; }
.pw-wrap .ac-input { padding-right: 42px; }
.pw-toggle {
  position: absolute; top: 0; right: 0; height: 100%; width: 40px;
  border: none; background: none; cursor: pointer;
  color: var(--color-text-tertiary); font-size: 18px;
  display: flex; align-items: center; justify-content: center;
}
.ac-input {
  width: 100%;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  padding: 11px 12px; font-size: 15px;
}
.ac-input + .ac-input { margin-top: 8px; }
.ac-input:focus { outline: none; border-color: var(--color-text-info); }
.msg { font-size: 13px; margin: 10px 0 0; }
.msg.error { color: var(--color-text-danger); }
.msg.ok { color: var(--color-text-success); }
.save-btn {
  width: 100%; margin-top: 18px; cursor: pointer; border: none;
  background: var(--color-text-info); color: #fff;
  border-radius: var(--border-radius-md); padding: 13px; font-size: 15px; font-weight: 500;
}
.save-btn:disabled { opacity: 0.5; cursor: default; }
.cancel-btn {
  width: 100%; margin-top: 10px; cursor: pointer;
  background: none; border: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  border-radius: var(--border-radius-md); padding: 13px; font-size: 15px; font-weight: 500;
}

.signout-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; cursor: pointer; margin-top: 16px;
  background: none; border: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-danger);
  border-radius: var(--border-radius-md); padding: 12px; font-size: 15px; font-weight: 500;
}
.signout-btn i { font-size: 18px; }

.delete-link {
  align-self: center; margin-top: 18px;
  background: none; border: none; cursor: pointer;
  color: var(--color-text-tertiary); font-size: 13px; text-decoration: underline;
}
.delete-box { margin-top: 16px; border: 0.5px solid var(--color-text-danger); }
.delete-warn { font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; margin: 0 0 12px; }
.delete-btn {
  width: 100%; cursor: pointer; border: none;
  background: var(--color-text-danger); color: #fff;
  border-radius: var(--border-radius-md); padding: 12px; font-size: 15px; font-weight: 500;
}
.delete-btn:disabled { opacity: 0.5; cursor: default; }
.delete-box .cancel-btn { margin-top: 10px; }
</style>
