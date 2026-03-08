<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  clearUserApiKey,
  getUserApiKey,
  getUserProvider,
  hasUserApiKey,
  requestJudgmentStream,
  saveUserApiKey,
} from '../data/ai.js'
import { getCaseCount, saveCase } from '../data/supabase.js'

const router = useRouter()

const MAX_SINGLE = 8000
const MAX_PERSPECTIVE = 4000
const MAX_TOPIC = 400
const MIN_SINGLE = 6
const MIN_PERSPECTIVE = 6
const MAX_PARTIES = 6
const PARTY_LABELS = ['甲方', '乙方', '丙方', '丁方', '戊方', '己方']
const PROVIDER_LABELS = {
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
}

const caseCount = ref(0)
const mode = ref('single')
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

const loadingMessages = ['正在整理案情', '正在分配模型', '正在生成裁定']
const quickPrompts = ['什么时候开始吵的？', '谁先说了什么？', '对方怎么回应的？', '你最介意的点是什么？']
const singleSteps = [
  { title: '先写起因', body: '因为什么吵起来，先把导火索交代清楚。' },
  { title: '再写经过', body: '谁先说了什么、做了什么，尽量按时间顺序写。' },
  { title: '点出分歧', body: '你觉得哪里不对，对方可能又会怎么想。' },
  { title: '写明现状', body: '现在卡在哪里，想让 AI 重点判断什么。' },
]
const multiSteps = [
  { title: '先定主题', body: '用一句话写清争议核心，别把主题写散。' },
  { title: '各自陈述', body: '每个人只写自己看到的事实和自己的感受。' },
  { title: '避免代写', body: '不要替对方总结，不要帮对方润色。' },
  { title: '补足诉求', body: '除了谁对谁错，也写清楚各自希望怎么解决。' },
]

onMounted(async () => {
  caseCount.value = await getCaseCount()
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
  perspectives.value.push({ name: PARTY_LABELS[idx] || `第${idx + 1}方`, content: '' })
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
  multiTopic.value = '对象打游戏不接电话，该不该生气'
  perspectives.value = [
    {
      name: '女方',
      content: '我连续打了三个电话都没接，微信也没回。一个多小时后他才说在打游戏。我不是不让他玩，而是至少该告诉我一声，不然我会担心，也会觉得自己被排在很后面。',
    },
    {
      name: '男方',
      content: '我开了一局排位，手机静音没看到。结束后第一时间回了消息。我觉得她把每次没及时回都上升到“不重视”，压力很大，我也需要一点不被打断的时间。',
    },
  ]
}

function buildPayload() {
  if (mode.value === 'single') {
    return { mode: 'single', content: singleContent.value.trim().slice(0, MAX_SINGLE) }
  }

  return {
    mode: 'multi',
    topic: multiTopic.value.trim().slice(0, MAX_TOPIC),
    perspectives: perspectives.value.map((item) => ({
      name: item.name.trim().slice(0, 20) || '当事人',
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
  pushLoadingStatus(loadingMessages[0])
  bumpLoadingProgress(8)

  const timer = setInterval(() => {
    loadingProgress.value = Math.min(loadingProgress.value + 2 + Math.random() * 3, 90)
  }, 350)

  try {
    const result = await requestJudgmentStream(payload, {
      onMeta(event) {
        if (event.provider) loadingProvider.value = getProviderLabel(event.provider)
        pushLoadingStatus(event.message || `已连接 ${getProviderLabel(event.provider)}`)
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
    pushLoadingStatus('裁定完成')

    const id = await saveCase({
      mode: payload.mode,
      input: payload,
      result: typeof result === 'string' ? JSON.parse(result) : result,
    })

    await new Promise((resolve) => setTimeout(resolve, 250))
    router.push(`/result/${id}`)
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') {
      pendingPayload.value = payload
      apiProvider.value = e.provider || apiProvider.value
      showQuotaModal.value = true
    } else if (e.code === 'INVALID_KEY') {
      error.value = e.message || 'API Key 无效，请检查后重试'
      showApiSetup.value = true
      showAdvanced.value = true
    } else {
      error.value = e.message || '请求失败，请稍后再试'
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
        <div class="loading-mark">判</div>
        <p class="mt-6 text-center text-xl font-semibold text-brand-dark">{{ loadingText }}</p>
        <p v-if="loadingProvider" class="mt-2 text-sm text-slate-500">当前模型：{{ loadingProvider }}</p>

        <div class="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full bg-brand-orange transition-all duration-300" :style="{ width: `${loadingProgress}%` }"></div>
        </div>

        <div v-if="loadingTrace.length" class="mt-6 w-full rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-soft">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">实时过程</p>
          <div class="mt-4 space-y-2">
            <div v-for="(item, index) in loadingTrace" :key="`${index}-${item}`" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {{ item }}
            </div>
          </div>
        </div>

        <div v-if="loadingPreview" class="mt-4 w-full rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-soft">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">流式输出</p>
          <pre class="mt-4 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{{ loadingPreview }}</pre>
        </div>

        <p class="mt-4 text-sm text-slate-500">流式模式已开启，首段输出会尽快显示。</p>
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="showQuotaModal" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center" @click.self="showQuotaModal = false">
      <div class="panel w-full max-w-md p-6">
        <h3 class="text-xl font-semibold text-brand-dark">默认额度已用完</h3>
        <p class="mt-2 text-sm text-slate-600">填入你自己的模型 Key 后，这一次会改用浏览器本地 Key 继续。Key 只保存在你的浏览器里。</p>
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
          <button class="btn-secondary flex-1" @click="showQuotaModal = false">取消</button>
          <button class="btn-primary flex-1" :disabled="!apiKeyInput.trim()" @click="retryWithNewKey">继续评理</button>
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
              <div class="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                案卷录入 · Day 001
              </div>
              <h1 class="mt-2 text-3xl font-semibold tracking-tight text-brand-dark md:text-4xl">先把案情录进去，再生成裁决页。</h1>
              <p class="mt-3 max-w-2xl text-base leading-7 text-slate-600">你只需要把冲突过程写清楚。系统会按案卷处理，默认先走站点服务端模型，再输出一页可分享的裁决结果。</p>
            </div>
            <div class="stats-chip">
              <span class="stats-chip__label">已受理案例</span>
              <span class="stats-chip__value">{{ caseCount.toLocaleString() }}</span>
            </div>
          </div>

          <div class="mt-5">
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">录入方式</p>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <button :class="['mode-pill', mode === 'single' ? 'mode-pill--active' : '']" @click="mode = 'single'">单方案情陈述</button>
              <button :class="['mode-pill', mode === 'multi' ? 'mode-pill--active' : '']" @click="mode = 'multi'; if (perspectives.length === 0) { addPerspective(); addPerspective() }">多方分别陈述</button>
              <button class="text-sm text-brand-dark underline-offset-4 hover:underline" @click="loadDemo">看一个示例</button>
            </div>
          </div>
        </div>

        <div v-if="mode === 'single'" class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div class="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">案情陈述表</p>
                <p class="mt-2 text-sm text-slate-600">单方录入 · 建议按时间顺序写</p>
              </div>
              <div class="sheet-stamp">录入中</div>
            </div>
            <div class="p-5 md:p-6">
              <div class="flex items-center justify-between gap-4">
                <label class="field-label">完整描述</label>
                <span class="text-xs text-slate-500">最低 {{ MIN_SINGLE }} 字</span>
              </div>
              <textarea
                v-model="singleContent"
                :maxlength="MAX_SINGLE"
                rows="14"
                autocomplete="off"
                placeholder="例如：昨天晚上 10 点，我们因为周末安排吵起来。我想去见父母，对方临时说想和朋友打游戏。后面我说了什么、对方怎么回、最后怎么僵住了，都可以继续写。"
                class="input-base case-textarea mt-3 min-h-[380px] resize-y text-base leading-7"
              ></textarea>
              <div class="mt-3 flex items-center justify-between text-sm">
                <span class="text-slate-500">写清时间线、行为、分歧和现在卡住的地方。</span>
                <span class="text-slate-400">{{ singleContent.length }}/{{ MAX_SINGLE }}</span>
              </div>
            </div>
          </div>

          <aside class="space-y-4">
            <div class="intake-card">
              <p class="intake-card__title">录入顺序</p>
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
                <p class="intake-card__title">即时提示</p>
                <button class="text-sm text-slate-500" @click="showGuide = !showGuide">{{ showGuide ? '收起' : '展开' }}</button>
              </div>
              <div v-if="showGuide" class="mt-4 flex flex-wrap gap-2">
                <span v-for="item in quickPrompts" :key="item" class="inline-flex rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                  {{ item }}
                </span>
              </div>
              <p class="mt-4 text-sm leading-6 text-slate-600">提交后会直接进入流式生成。你能看到当前模型、处理阶段和实时输出，而不是一直干等。</p>
            </div>
          </aside>
        </div>

        <div v-else class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div class="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">多方陈述表</p>
                <p class="mt-2 text-sm text-slate-600">分别录入每个人的版本，再交给系统综合判断</p>
              </div>
              <div class="sheet-stamp">待汇总</div>
            </div>
            <div class="p-5 md:p-6">
              <div>
                <label class="field-label">争议主题</label>
                <input v-model="multiTopic" type="text" :maxlength="MAX_TOPIC" autocomplete="off" placeholder="例如：是否应该临时爽约去打游戏" class="input-base mt-3" />
              </div>

              <div class="mt-5 flex items-center justify-between gap-4">
                <p class="text-sm text-slate-500">至少 2 方，最多 {{ MAX_PARTIES }} 方。每个人只写自己的版本。</p>
                <button v-if="perspectives.length < MAX_PARTIES" class="btn-secondary !px-4 !py-2 text-sm" @click="addPerspective">添加一方</button>
              </div>

              <div class="mt-4 space-y-4">
                <section v-for="(item, index) in perspectives" :key="`p-${index}`" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <div class="intake-step">{{ String(index + 1).padStart(2, '0') }}</div>
                      <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">陈述人</p>
                        <input v-model="item.name" maxlength="20" class="mt-1 border-none bg-transparent p-0 text-base font-semibold text-brand-dark outline-none" :placeholder="`第${index + 1}方`" />
                      </div>
                    </div>
                    <button class="text-sm text-slate-500 hover:text-red-500" @click="removePerspective(index)">删除</button>
                  </div>

                  <textarea
                    v-model="item.content"
                    :maxlength="MAX_PERSPECTIVE"
                    rows="6"
                    autocomplete="off"
                    :placeholder="`从${item.name || `第${index + 1}方`}的角度，把事实、感受和诉求写完整。`"
                    class="input-base perspective-textarea mt-4 min-h-[180px] resize-y"
                  ></textarea>

                  <div class="mt-2 flex items-center justify-between text-sm">
                    <span class="text-slate-500">最低 {{ MIN_PERSPECTIVE }} 字，不要替对方总结。</span>
                    <span class="text-slate-400">{{ item.content.length }}/{{ MAX_PERSPECTIVE }}</span>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <aside class="space-y-4">
            <div class="intake-card">
              <p class="intake-card__title">多人录入规则</p>
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
              <p class="intake-card__title">系统会怎么处理</p>
              <p class="mt-4 text-sm leading-6 text-slate-600">系统会把所有陈述汇总后统一判断，不会只偏向谁写得更长，而是优先看事实链是否完整。生成时会显示当前使用的模型和流式输出进度。</p>
            </div>
          </aside>
        </div>

        <div v-if="error" class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>

        <div class="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-sm font-medium text-brand-dark">录入完成后即可生成裁决页。</p>
            <p class="text-sm text-slate-500">默认优先走站点服务端模型。只有服务端额度受限时，才会提示你切换浏览器里保存的 Key。</p>
          </div>
          <button class="btn-primary min-w-[220px]" :disabled="!canSubmit || loading" @click="submit">生成这次判断</button>
        </div>

        <div class="mt-8 border-t border-slate-200 pt-5">
          <button class="text-sm font-medium text-slate-600 underline-offset-4 hover:text-brand-dark hover:underline" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? '收起其他入口' : '展开社区和模型设置' }}
          </button>

          <div v-if="showAdvanced" class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="intake-card">
              <p class="intake-card__title">社区入口</p>
              <p class="mt-3 text-sm leading-6 text-slate-600">想看别人最近的案例，或者给结果点赞点踩，可以去社区页。</p>
              <router-link to="/community" class="btn-secondary mt-4 w-full">查看社区记录</router-link>
            </div>

            <div class="intake-card">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="intake-card__title">模型设置</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">默认优先使用站点服务端模型。浏览器里保存的 Key 只在服务端额度受限时，或者你手动重试时才会接管。</p>
                </div>
                <button class="text-sm text-slate-500" @click="showApiSetup = !showApiSetup">{{ showApiSetup ? '收起' : '展开' }}</button>
              </div>

              <div class="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                <template v-if="apiConfigured">
                  当前浏览器已保存 {{ browserProviderLabel }} Key。默认仍先走站点服务端模型。
                </template>
                <template v-else>
                  当前未保存自定义 Key。提交时会直接先用站点服务端模型。
                </template>
              </div>

              <p v-if="apiSaveSuccess" class="mt-3 text-sm text-green-600">浏览器 Key 已保存。</p>

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
                    <button class="btn-primary flex-1" :disabled="!apiKeyInput.trim()" @click="handleSaveKey">保存 Key</button>
                    <button class="btn-secondary flex-1" :disabled="!apiConfigured" @click="handleClearKey">清除</button>
                  </div>

                  <p class="mt-3 text-xs leading-5 text-slate-500">你的 Key 只保存在本地浏览器，不会写入数据库。推荐先用站点服务端模型；只有服务端受限时再切到你自己的 Key。</p>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
