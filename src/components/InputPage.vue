<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  clearUserApiKey,
  getUserApiKey,
  getUserProvider,
  hasUserApiKey,
  getJudgeStyles,
  requestJudgmentStream,
  saveUserApiKey,
} from '../data/ai.js'
import { getMyHistoryIds, saveCase } from '../data/supabase.js'
import { t, locale, partyLabel, partyCountDesc, partyN, partyPlaceholder, partyHint } from '../lib/i18n.js'

const router = useRouter()

const MAX_SINGLE = 8000
const MAX_PERSPECTIVE = 4000
const MAX_TOPIC = 400
const MIN_SINGLE = 6
const MIN_PERSPECTIVE = 6
const MAX_PARTIES = 6
const PROVIDER_LABELS = {
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
}

const caseCount = ref(0)
const mode = ref('single')
const judgeStyle = ref('sharp')
const singleContent = ref('')
const multiTopic = ref('')
const perspectives = ref([])
const showGuide = ref(false)
const showApiSetup = ref(false)
const showAdvanced = ref(false)

const apiConfigured = ref(hasUserApiKey())
const apiKeyInput = ref('')
const apiProvider = ref('gemini')
const apiSaveSuccess = ref(false)

const loading = ref(false)
const loadingProgress = ref(0)
const loadingText = ref('')
const loadingProvider = ref('')
const loadingTrace = ref([])
const loadingPreview = ref('')
const error = ref('')
const showQuotaModal = ref(false)
const pendingPayload = ref(null)

const judgeStyles = computed(() => getJudgeStyles())
const loadingMessages = computed(() => [t('loading1'), t('loading2'), t('loading3')])
const quickPrompts = computed(() => [t('quickPrompt1'), t('quickPrompt2'), t('quickPrompt3'), t('quickPrompt4')])
const singleSteps = computed(() => [
  { title: t('singleStep1Title'), body: t('singleStep1Desc') },
  { title: t('singleStep2Title'), body: t('singleStep2Desc') },
  { title: t('singleStep3Title'), body: t('singleStep3Desc') },
  { title: t('singleStep4Title'), body: t('singleStep4Desc') },
])
const multiSteps = computed(() => [
  { title: t('multiStep1Title'), body: t('multiStep1Desc') },
  { title: t('multiStep2Title'), body: t('multiStep2Desc') },
  { title: t('multiStep3Title'), body: t('multiStep3Desc') },
  { title: t('multiStep4Title'), body: t('multiStep4Desc') },
])

onMounted(async () => {
  caseCount.value = getMyHistoryIds().length
  if (hasUserApiKey()) {
    apiKeyInput.value = getUserApiKey()
    apiProvider.value = getUserProvider()
  }
})

const canSubmitSingle = computed(() => singleContent.value.trim().length >= MIN_SINGLE)
const canSubmitMulti = computed(() =>
  multiTopic.value.trim().length > 0 &&
  perspectives.value.length >= 2 &&
  perspectives.value.every((item) => item.content.trim().length >= MIN_PERSPECTIVE)
)
const canSubmit = computed(() => (mode.value === 'single' ? canSubmitSingle.value : canSubmitMulti.value))
const browserProviderLabel = computed(() => PROVIDER_LABELS[getUserProvider()] || 'Gemini')

function addPerspective() {
  if (perspectives.value.length >= MAX_PARTIES) return
  const idx = perspectives.value.length
  perspectives.value.push({ name: partyLabel(idx), content: '' })
  nextTick(() => {
    const els = document.querySelectorAll('.perspective-textarea')
    els[els.length - 1]?.focus()
  })
}

function removePerspective(index) {
  perspectives.value.splice(index, 1)
}

function loadDemo() {
  mode.value = 'multi'
  multiTopic.value = t('demoTopic')
  perspectives.value = [
    {
      name: t('demoPartyA'),
      content: t('demoPartyAText'),
    },
    {
      name: t('demoPartyB'),
      content: t('demoPartyBText'),
    },
  ]
}

function buildPayload() {
  if (mode.value === 'single') {
    return { mode: 'single', style: judgeStyle.value, content: singleContent.value.trim().slice(0, MAX_SINGLE) }
  }

  return {
    mode: 'multi',
    style: judgeStyle.value,
    topic: multiTopic.value.trim().slice(0, MAX_TOPIC),
    perspectives: perspectives.value.map((item) => ({
      name: item.name.trim().slice(0, 20) || t('narrator'),
      content: item.content.trim().slice(0, MAX_PERSPECTIVE),
    })),
  }
}

function getProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || 'AI'
}

function pushLoadingStatus(message) {
  if (!message) return
  loadingText.value = message
  loadingTrace.value = [...loadingTrace.value, message].slice(-4)
}

function bumpLoadingProgress(target) {
  loadingProgress.value = Math.max(loadingProgress.value, Math.min(target, 100))
}

function resetLoadingState() {
  loadingProgress.value = 0
  loadingText.value = ''
  loadingProvider.value = ''
  loadingTrace.value = []
  loadingPreview.value = ''
}

async function submit() {
  if (!canSubmit.value || loading.value) return
  await doSubmit(buildPayload())
}

async function doSubmit(payload, options = {}) {
  loading.value = true
  error.value = ''
  resetLoadingState()
  pushLoadingStatus(loadingMessages.value[0])
  bumpLoadingProgress(8)

  const timer = setInterval(() => {
    loadingProgress.value = Math.min(loadingProgress.value + 2 + Math.random() * 3, 90)
  }, 350)

  try {
    const result = await requestJudgmentStream(payload, {
      onMeta(event) {
        if (event.provider) loadingProvider.value = getProviderLabel(event.provider)
        pushLoadingStatus(event.message || `${t('connectedProvider')} ${getProviderLabel(event.provider)}`)
        bumpLoadingProgress(18)
      },
      onStatus(event) {
        pushLoadingStatus(event.message)
        bumpLoadingProgress(loadingProgress.value + 10)
      },
      onChunk(event) {
        if (!event.text) return
        loadingPreview.value = `${loadingPreview.value}${event.text}`.slice(-1200)
        bumpLoadingProgress(loadingProgress.value + 1)
      },
    }, { useUserKey: options.useUserKey === true })

    bumpLoadingProgress(100)
    pushLoadingStatus(t('analysisComplete'))

    const id = await saveCase({
      mode: payload.mode,
      input: payload,
      result: typeof result === 'string' ? JSON.parse(result) : result,
    })
    caseCount.value = getMyHistoryIds().length

    await new Promise((resolve) => setTimeout(resolve, 250))
    router.push(`/result/${id}`)
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') {
      pendingPayload.value = payload
      apiProvider.value = e.provider || apiProvider.value
      showQuotaModal.value = true
    } else if (e.code === 'INVALID_KEY') {
      error.value = e.message || 'API Key invalid'
      showApiSetup.value = true
      showAdvanced.value = true
    } else {
      error.value = e.message || 'Request failed'
    }
  } finally {
    clearInterval(timer)
    loading.value = false
    loadingProgress.value = 0
  }
}

function handleSaveKey() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  saveUserApiKey(key, apiProvider.value)
  apiConfigured.value = true
  apiSaveSuccess.value = true
  showApiSetup.value = false
  setTimeout(() => {
    apiSaveSuccess.value = false
  }, 2500)
}

function handleClearKey() {
  clearUserApiKey()
  apiConfigured.value = false
  apiKeyInput.value = ''
  apiProvider.value = 'gemini'
}

async function retryWithNewKey() {
  handleSaveKey()
  showQuotaModal.value = false
  if (pendingPayload.value) {
    const payload = pendingPayload.value
    pendingPayload.value = null
    await doSubmit(payload, { useUserKey: true })
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="loading" class="fixed inset-0 z-[100] overflow-y-auto px-6 py-10 page-surface">
      <div class="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center">
        <div class="loading-mark">{{ t('appLogo') }}</div>
        <p class="mt-6 text-center text-xl font-semibold text-brand-dark">{{ loadingText }}</p>
        <p v-if="loadingProvider" class="mt-2 text-sm text-slate-500">{{ loadingProvider }} {{ t('analyzing') }}</p>

        <div class="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full bg-brand-orange transition-all duration-300" :style="{ width: `${loadingProgress}%` }"></div>
        </div>

        <div v-if="loadingTrace.length" class="mt-6 w-full rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-soft">
          <p class="text-xs font-semibold text-slate-500">{{ t('processingProgress') }}</p>
          <div class="mt-4 space-y-2">
            <div v-for="(item, index) in loadingTrace" :key="`${index}-${item}`" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {{ item }}
            </div>
          </div>
        </div>

        <div v-if="loadingPreview" class="mt-4 w-full rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-soft">
          <p class="text-xs font-semibold text-slate-500">{{ t('aiWriting') }}</p>
          <pre class="mt-4 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{{ loadingPreview }}</pre>
        </div>

        <p class="mt-4 text-sm text-slate-500">{{ t('analyzingWait') }}</p>
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="showQuotaModal" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center" @click.self="showQuotaModal = false">
      <div class="panel w-full max-w-md p-6">
        <h3 class="text-xl font-semibold text-brand-dark">{{ t('quotaExhausted') }}</h3>
        <p class="mt-2 text-sm text-slate-600">{{ t('quotaDesc') }}</p>
        <div class="mt-5 grid grid-cols-3 gap-2">
          <button
            v-for="provider in [{ id: 'gemini', label: 'Gemini' }, { id: 'deepseek', label: 'DeepSeek' }, { id: 'openai', label: 'OpenAI' }]"
            :key="provider.id"
            :class="['rounded-xl border px-3 py-2 text-sm transition-colors', apiProvider === provider.id ? 'border-brand-dark bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600']"
            @click="apiProvider = provider.id"
          >
            {{ provider.label }}
          </button>
        </div>
        <input v-model="apiKeyInput" type="password" :placeholder="apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'" class="input-base mt-4" autocomplete="off" />
        <div class="mt-5 flex gap-3">
          <button class="btn-secondary flex-1" @click="showQuotaModal = false">{{ t('cancel') }}</button>
          <button class="btn-primary flex-1" :disabled="!apiKeyInput.trim()" @click="retryWithNewKey">{{ t('continueJudging') }}</button>
        </div>
      </div>
    </div>
  </Transition>

  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <section class="panel p-6 md:p-8">
        <div class="border-b border-slate-200 pb-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="max-w-3xl">
              <h1 class="text-3xl font-semibold tracking-tight text-brand-dark md:text-4xl">{{ t('inputTitle') }}</h1>
              <p class="mt-3 max-w-2xl text-base leading-7 text-slate-600">{{ t('inputSubtitle') }}</p>
            </div>
            <div class="stats-chip">
              <span class="stats-chip__label">{{ t('myGenerated') }}</span>
              <span class="stats-chip__value">{{ caseCount.toLocaleString() }}</span>
            </div>
          </div>

          <div class="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p class="text-xs font-medium text-slate-500">{{ t('chooseMode') }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <button :class="['mode-pill', mode === 'single' ? 'mode-pill--active' : '']" @click="mode = 'single'">{{ t('modeSingle') }}</button>
                <button :class="['mode-pill', mode === 'multi' ? 'mode-pill--active' : '']" @click="mode = 'multi'; if (perspectives.length === 0) { addPerspective(); addPerspective() }">{{ t('modeMulti') }}</button>
                <button class="text-sm text-brand-dark underline-offset-4 hover:underline" @click="loadDemo">{{ t('seeExample') }}</button>
              </div>
            </div>
            <div>
              <p class="text-xs font-medium text-slate-500">{{ t('aiStyle') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="s in judgeStyles"
                  :key="s.id"
                  :class="['mode-pill', judgeStyle === s.id ? 'mode-pill--active' : '']"
                  :title="s.desc"
                  @click="judgeStyle = s.id"
                >
                  {{ s.label }}
                </button>
              </div>
              <p class="mt-2 text-xs text-slate-400">{{ judgeStyles.find(s => s.id === judgeStyle)?.desc }}</p>
            </div>
          </div>
        </div>

        <div v-if="mode === 'single'" class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div class="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">{{ t('writeDown') }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ t('chronological') }}</p>
              </div>
              <div class="sheet-stamp">{{ t('editing') }}</div>
            </div>
            <div class="p-5 md:p-6">
              <div class="flex items-center justify-between gap-4">
                <label class="field-label">{{ t('fullDesc') }}</label>
                <span class="text-xs text-slate-500">{{ t('minChars') }} {{ MIN_SINGLE }} {{ t('chars') }}</span>
              </div>
              <textarea
                v-model="singleContent"
                :maxlength="MAX_SINGLE"
                rows="14"
                autocomplete="off"
                :placeholder="t('singlePlaceholder')"
                class="input-base case-textarea mt-3 min-h-[380px] resize-y text-base leading-7"
              ></textarea>
              <div class="mt-3 flex items-center justify-between text-sm">
                <span class="text-slate-500">{{ t('singleHint') }}</span>
                <span class="text-slate-400">{{ singleContent.length }}/{{ MAX_SINGLE }}</span>
              </div>
            </div>
          </div>

          <aside class="space-y-4">
            <div class="intake-card">
              <p class="intake-card__title">{{ t('howToWrite') }}</p>
              <div class="mt-4 space-y-3">
                <div v-for="(item, index) in singleSteps" :key="item.title" class="flex gap-3">
                  <div class="intake-step">{{ String(index + 1).padStart(2, '0') }}</div>
                  <div>
                    <p class="text-sm font-semibold text-brand-dark">{{ item.title }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-600">{{ item.body }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="intake-card">
              <div class="flex items-center justify-between gap-4">
                <p class="intake-card__title">{{ t('dontKnow') }}</p>
                <button class="text-sm text-slate-500" @click="showGuide = !showGuide">{{ showGuide ? t('collapse') : t('expand') }}</button>
              </div>
              <div v-if="showGuide" class="mt-4 flex flex-wrap gap-2">
                <span v-for="item in quickPrompts" :key="item" class="inline-flex rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                  {{ item }}
                </span>
              </div>
              <p class="mt-4 text-sm leading-6 text-slate-600">{{ t('submitHint') }}</p>
            </div>
          </aside>
        </div>

        <div v-else class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div class="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">{{ t('multiTitle') }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ t('multiSubtitle') }}</p>
              </div>
              <div class="sheet-stamp">{{ t('editing') }}</div>
            </div>
            <div class="p-5 md:p-6">
              <div>
                <label class="field-label">{{ t('topicLabel') }}</label>
                <input v-model="multiTopic" type="text" :maxlength="MAX_TOPIC" autocomplete="off" :placeholder="t('topicPlaceholder')" class="input-base mt-3" />
              </div>

              <div class="mt-5 flex items-center justify-between gap-4">
                <p class="text-sm text-slate-500">{{ partyCountDesc(MAX_PARTIES) }}</p>
                <button v-if="perspectives.length < MAX_PARTIES" class="btn-secondary !px-4 !py-2 text-sm" @click="addPerspective">{{ t('addParty') }}</button>
              </div>

              <div class="mt-4 space-y-4">
                <section v-for="(item, index) in perspectives" :key="`p-${index}`" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <div class="intake-step">{{ String(index + 1).padStart(2, '0') }}</div>
                      <div>
                        <p class="text-xs text-slate-500">{{ t('nickname') }}</p>
                        <input v-model="item.name" maxlength="20" class="mt-1 border-none bg-transparent p-0 text-base font-semibold text-brand-dark outline-none" :placeholder="partyN(index + 1)" />
                      </div>
                    </div>
                    <button class="text-sm text-slate-500 hover:text-red-500" @click="removePerspective(index)">{{ t('deleteParty') }}</button>
                  </div>

                  <textarea
                    v-model="item.content"
                    :maxlength="MAX_PERSPECTIVE"
                    rows="6"
                    autocomplete="off"
                    :placeholder="partyPlaceholder(item.name, index)"
                    class="input-base perspective-textarea mt-4 min-h-[180px] resize-y"
                  ></textarea>

                  <div class="mt-2 flex items-center justify-between text-sm">
                    <span class="text-slate-500">{{ partyHint(MIN_PERSPECTIVE) }}</span>
                    <span class="text-slate-400">{{ item.content.length }}/{{ MAX_PERSPECTIVE }}</span>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <aside class="space-y-4">
            <div class="intake-card">
              <p class="intake-card__title">{{ t('multiHowTo') }}</p>
              <div class="mt-4 space-y-3">
                <div v-for="(item, index) in multiSteps" :key="item.title" class="flex gap-3">
                  <div class="intake-step">{{ String(index + 1).padStart(2, '0') }}</div>
                  <div>
                    <p class="text-sm font-semibold text-brand-dark">{{ item.title }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-600">{{ item.body }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="intake-card">
              <p class="intake-card__title">{{ t('howAIJudges') }}</p>
              <p class="mt-4 text-sm leading-6 text-slate-600">{{ t('howAIJudgesDesc') }}</p>
            </div>
          </aside>
        </div>

        <div v-if="error" class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>

        <div class="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-sm font-medium text-brand-dark">{{ t('readySubmit') }}</p>
            <p class="text-sm text-slate-500">{{ t('freeHint') }}</p>
          </div>
          <button class="btn-primary min-w-[220px]" :disabled="!canSubmit || loading" @click="submit">{{ t('submitBtn') }}</button>
        </div>

        <div class="mt-8 border-t border-slate-200 pt-5">
          <button class="text-sm font-medium text-slate-600 underline-offset-4 hover:text-brand-dark hover:underline" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? t('collapseSettings') : t('customModelLabel') }}
          </button>

          <div v-if="showAdvanced" class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="intake-card">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="intake-card__title">{{ t('customApiKey') }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">{{ t('defaultFree') }}</p>
                </div>
                <button class="text-sm text-slate-500" @click="showApiSetup = !showApiSetup">{{ showApiSetup ? t('collapse') : t('expand') }}</button>
              </div>

              <div class="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                <template v-if="apiConfigured">
                  {{ t('keySaved') }} {{ browserProviderLabel }} Key
                </template>
                <template v-else>
                  {{ t('noKeySet') }}
                </template>
              </div>

              <p v-if="apiSaveSuccess" class="mt-3 text-sm text-green-600">{{ t('browserKeySaved') }}</p>

              <Transition name="collapse">
                <div v-if="showApiSetup" class="mt-4 border-t border-slate-200 pt-4">
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="provider in [{ id: 'gemini', label: 'Gemini' }, { id: 'deepseek', label: 'DeepSeek' }, { id: 'openai', label: 'OpenAI' }]"
                      :key="provider.id"
                      :class="['rounded-xl border px-3 py-2 text-sm transition-colors', apiProvider === provider.id ? 'border-brand-dark bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600']"
                      @click="apiProvider = provider.id"
                    >
                      {{ provider.label }}
                    </button>
                  </div>

                  <input v-model="apiKeyInput" type="password" :placeholder="apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'" class="input-base mt-4" autocomplete="off" @keyup.enter="handleSaveKey" />

                  <div class="mt-4 flex gap-3">
                    <button class="btn-primary flex-1" :disabled="!apiKeyInput.trim()" @click="handleSaveKey">{{ t('saveKey') }}</button>
                    <button class="btn-secondary flex-1" :disabled="!apiConfigured" @click="handleClearKey">{{ t('clearKey') }}</button>
                  </div>

                  <p class="mt-3 text-xs leading-5 text-slate-500">{{ t('keyDisclaimer') }}</p>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
