<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  clearUserApiKey,
  getUserApiKey,
  getUserProvider,
  hasUserApiKey,
  requestJudgment,
  saveUserApiKey,
} from '../data/ai.js'
import { getCaseCount, saveCase } from '../data/supabase.js'

const router = useRouter()

const MAX_SINGLE = 8000
const MAX_PERSPECTIVE = 4000
const MAX_TOPIC = 400
const MIN_SINGLE = 6
const MIN_PERSPECTIVE = 6

const caseCount = ref(0)
const mode = ref('single')
const singleContent = ref('')
const multiTopic = ref('')
const perspectives = ref([])
const showGuide = ref(true)
const showApiSetup = ref(false)

const PARTY_LABELS = ['甲方', '乙方', '丙方', '丁方', '戊方', '己方']
const MAX_PARTIES = 6

const apiConfigured = ref(hasUserApiKey())
const apiKeyInput = ref('')
const apiProvider = ref('gemini')
const apiSaveSuccess = ref(false)

const loading = ref(false)
const loadingProgress = ref(0)
const loadingText = ref('')
const error = ref('')
const showQuotaModal = ref(false)
const pendingPayload = ref(null)

const loadingMessages = ['正在整理案情', '正在对齐各方说法', '正在给出裁定', '正在润色结论']

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
const canSubmit = computed(() => mode.value === 'single' ? canSubmitSingle.value : canSubmitMulti.value)

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

async function submit() {
  if (!canSubmit.value || loading.value) return
  await doSubmit(buildPayload())
}

async function doSubmit(payload) {
  loading.value = true
  error.value = ''
  loadingProgress.value = 0
  loadingText.value = loadingMessages[0]

  let msgIndex = 0
  const timer = setInterval(() => {
    loadingProgress.value = Math.min(loadingProgress.value + 4 + Math.random() * 4, 92)
    const nextIndex = Math.min(Math.floor(loadingProgress.value / 28), loadingMessages.length - 1)
    if (nextIndex !== msgIndex) {
      msgIndex = nextIndex
      loadingText.value = loadingMessages[nextIndex]
    }
  }, 350)

  try {
    const result = await requestJudgment(payload)
    loadingProgress.value = 100
    loadingText.value = '裁定完成'
    const id = await saveCase({
      mode: payload.mode,
      input: payload,
      result: typeof result === 'string' ? JSON.parse(result) : result,
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    router.push(`/result/${id}`)
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') {
      pendingPayload.value = payload
      showQuotaModal.value = true
    } else if (e.code === 'INVALID_KEY') {
      error.value = e.message || 'API Key 无效，请检查后重试'
      showApiSetup.value = true
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
    await doSubmit(payload)
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="loading" class="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 page-surface">
      <div class="loading-mark">判</div>
      <p class="mt-6 text-xl font-semibold text-brand-dark">{{ loadingText }}</p>
      <div class="mt-5 h-2 w-64 overflow-hidden rounded-full bg-slate-200">
        <div class="h-full rounded-full bg-brand-orange transition-all duration-300" :style="{ width: `${loadingProgress}%` }"></div>
      </div>
      <p class="mt-4 text-sm text-slate-500">通常需要 5 到 15 秒</p>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="showQuotaModal" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center" @click.self="showQuotaModal = false">
      <div class="panel w-full max-w-md p-6">
        <h3 class="text-xl font-semibold text-brand-dark">默认额度已用完</h3>
        <p class="mt-2 text-sm text-slate-600">填入你自己的模型 Key 后可以继续使用，Key 只保存在你的浏览器。</p>
        <div class="mt-5 grid grid-cols-3 gap-2">
          <button
            v-for="provider in [{ id: 'gemini', label: 'Gemini' }, { id: 'deepseek', label: 'DeepSeek' }, { id: 'openai', label: 'OpenAI' }]"
            :key="provider.id"
            @click="apiProvider = provider.id"
            :class="['rounded-xl border px-3 py-2 text-sm transition-colors', apiProvider === provider.id ? 'border-brand-dark bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600']"
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
    <div class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div class="panel p-6 md:p-8">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div class="max-w-2xl">
              <p class="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">OpenVibeLab</p>
              <h1 class="mt-2 text-3xl font-semibold tracking-tight text-brand-dark md:text-4xl">把事情说清楚，再让 AI 来裁。</h1>
              <p class="mt-3 text-base leading-7 text-slate-600">先把争议写完整，系统会生成可分享的裁定页。这个首页现在只做一件事：让你顺畅输入。</p>
            </div>
            <div class="stats-chip">
              <span class="stats-chip__label">累计裁定</span>
              <span class="stats-chip__value">{{ caseCount.toLocaleString() }}</span>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <button :class="['mode-pill', mode === 'single' ? 'mode-pill--active' : '']" @click="mode = 'single'">单方描述</button>
            <button :class="['mode-pill', mode === 'multi' ? 'mode-pill--active' : '']" @click="mode = 'multi'; if (perspectives.length === 0) { addPerspective(); addPerspective() }">多方陈述</button>
            <button class="text-sm text-brand-dark underline-offset-4 hover:underline" @click="loadDemo">载入示例</button>
          </div>

          <div class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-brand-dark">写作建议</h2>
                <p class="mt-1 text-sm text-slate-600">时间、经过、各方动作、最终结果，按这个顺序写，判断最稳。</p>
              </div>
              <button class="text-sm text-slate-500" @click="showGuide = !showGuide">{{ showGuide ? '收起' : '展开' }}</button>
            </div>
            <div v-if="showGuide" class="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
              <p>别省略关键时间线，AI 很依赖上下文。</p>
              <p>人物称呼要稳定，不要一会“他”一会“对象”。</p>
              <p>如果你也有做错，照实写，结论才可信。</p>
            </div>
          </div>

          <div v-if="mode === 'single'" class="mt-6">
            <label class="field-label">完整描述</label>
            <textarea v-model="singleContent" :maxlength="MAX_SINGLE" rows="12" autocomplete="off" placeholder="把来龙去脉写清楚。谁先说了什么、做了什么、为什么吵、现在卡在哪里，都可以写。" class="input-base mt-2 min-h-[280px] resize-y"></textarea>
            <div class="mt-2 flex items-center justify-between text-sm">
              <span class="text-slate-500">越完整越好，最低 {{ MIN_SINGLE }} 字即可提交。</span>
              <span class="text-slate-400">{{ singleContent.length }}/{{ MAX_SINGLE }}</span>
            </div>
          </div>

          <div v-else class="mt-6 space-y-4">
            <div>
              <label class="field-label">争议主题</label>
              <input v-model="multiTopic" type="text" :maxlength="MAX_TOPIC" autocomplete="off" placeholder="例如：是否应该临时爽约去打游戏" class="input-base mt-2" />
            </div>
            <div class="flex items-center justify-between">
              <p class="text-sm text-slate-500">至少 2 方，最多 {{ MAX_PARTIES }} 方。每一方只要能把观点说明白即可。</p>
              <button v-if="perspectives.length < MAX_PARTIES" class="btn-secondary !px-4 !py-2 text-sm" @click="addPerspective">添加一方</button>
            </div>
            <div class="space-y-4">
              <section v-for="(item, index) in perspectives" :key="`p-${index}`" class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-sm font-semibold text-white">{{ index + 1 }}</span>
                    <input v-model="item.name" maxlength="20" class="border-none bg-transparent p-0 text-base font-semibold text-brand-dark outline-none" :placeholder="`第${index + 1}方`" />
                  </div>
                  <button class="text-sm text-slate-500 hover:text-red-500" @click="removePerspective(index)">删除</button>
                </div>
                <textarea v-model="item.content" :maxlength="MAX_PERSPECTIVE" rows="6" autocomplete="off" :placeholder="`从${item.name || `第${index + 1}方`}的角度，把事实、感受和诉求写完整。`" class="input-base perspective-textarea mt-3 min-h-[180px] resize-y"></textarea>
                <div class="mt-2 flex items-center justify-between text-sm">
                  <span class="text-slate-500">最低 {{ MIN_PERSPECTIVE }} 字。重点是信息完整，不是凑字数。</span>
                  <span class="text-slate-400">{{ item.content.length }}/{{ MAX_PERSPECTIVE }}</span>
                </div>
              </section>
            </div>
          </div>

          <div v-if="error" class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>

          <div class="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-sm font-medium text-brand-dark">准备好了就提交。</p>
              <p class="text-sm text-slate-500">系统会自动保存到你的历史记录，并生成可分享页面。</p>
            </div>
            <button class="btn-primary min-w-[180px]" :disabled="!canSubmit || loading" @click="submit">让 AI 评理</button>
          </div>
        </div>

        <aside class="space-y-4">
          <div class="panel p-5">
            <p class="text-sm font-semibold text-brand-dark">社区入口</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">想看别人最近的案例，或者给结果点踩点顶，直接去社区页。</p>
            <router-link to="/community" class="btn-secondary mt-4 w-full">查看社区记录</router-link>
          </div>

          <div class="panel p-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-semibold text-brand-dark">模型设置</p>
                <p class="mt-2 text-sm leading-6 text-slate-600">默认优先用站点配置的服务端模型。你也可以填自己的 Key 覆盖。</p>
              </div>
              <button class="text-sm text-slate-500" @click="showApiSetup = !showApiSetup">{{ showApiSetup ? '收起' : '展开' }}</button>
            </div>
            <div class="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <template v-if="apiConfigured">当前浏览器已保存 {{ getUserProvider() === 'deepseek' ? 'DeepSeek' : getUserProvider() === 'openai' ? 'OpenAI' : 'Gemini' }} Key</template>
              <template v-else>当前未保存自定义 Key，提交时会先用站点服务端额度。</template>
            </div>
            <p v-if="apiSaveSuccess" class="mt-3 text-sm text-green-600">API Key 已保存。</p>
            <Transition name="collapse">
              <div v-if="showApiSetup" class="mt-4 border-t border-slate-200 pt-4">
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="provider in [{ id: 'gemini', label: 'Gemini' }, { id: 'deepseek', label: 'DeepSeek' }, { id: 'openai', label: 'OpenAI' }]"
                    :key="provider.id"
                    @click="apiProvider = provider.id"
                    :class="['rounded-xl border px-3 py-2 text-sm transition-colors', apiProvider === provider.id ? 'border-brand-dark bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600']"
                  >
                    {{ provider.label }}
                  </button>
                </div>
                <input v-model="apiKeyInput" type="password" :placeholder="apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'" class="input-base mt-4" autocomplete="off" @keyup.enter="handleSaveKey" />
                <div class="mt-4 flex gap-3">
                  <button class="btn-primary flex-1" :disabled="!apiKeyInput.trim()" @click="handleSaveKey">保存 Key</button>
                  <button class="btn-secondary flex-1" :disabled="!apiConfigured" @click="handleClearKey">清除</button>
                </div>
                <p class="mt-3 text-xs leading-5 text-slate-500">你的 Key 只存在本地浏览器，不会写入数据库。推荐先用站点额度，额度耗尽时再填自己的。</p>
              </div>
            </Transition>
          </div>
        </aside>
      </section>
    </div>
  </div>
</template>
