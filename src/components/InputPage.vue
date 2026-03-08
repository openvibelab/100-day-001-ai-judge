<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { requestJudgment, hasUserApiKey, saveUserApiKey, clearUserApiKey, getUserApiKey, getUserProvider } from '../data/ai.js'
import { saveCase, getCaseCount } from '../data/supabase.js'

const router = useRouter()

const MAX_SINGLE = 3000
const MAX_PERSPECTIVE = 1500

// ---- State ----
const caseCount = ref(0)
const mode = ref('single')
const showTips = ref(false)
const showApiSetup = ref(false)

// Single mode
const singleContent = ref('')

// Multi mode
const multiTopic = ref('')
const perspectives = ref([])
const PARTY_LABELS = ['甲方', '乙方', '丙方', '丁方', '戊方', '己方']
const MAX_PARTIES = 6

// API Key
const apiConfigured = ref(hasUserApiKey())
const apiKeyInput = ref('')
const apiProvider = ref('deepseek')
const apiSaveSuccess = ref(false)

// Submit state
const loading = ref(false)
const loadingProgress = ref(0)
const loadingText = ref('')
const error = ref('')
const showQuotaModal = ref(false)
const pendingPayload = ref(null)

onMounted(async () => {
  caseCount.value = await getCaseCount()
  // Pre-fill from saved key
  if (hasUserApiKey()) {
    apiKeyInput.value = getUserApiKey()
    apiProvider.value = getUserProvider()
  }
})

// ---- Multi mode ----
function addPerspective() {
  if (perspectives.value.length >= MAX_PARTIES) return
  const idx = perspectives.value.length
  perspectives.value.push({ name: PARTY_LABELS[idx] || `第${idx + 1}方`, content: '' })
  nextTick(() => {
    const els = document.querySelectorAll('.p-textarea')
    els[els.length - 1]?.focus()
  })
}
function removePerspective(i) { perspectives.value.splice(i, 1) }

// ---- Demo ----
function loadDemo() {
  mode.value = 'multi'
  multiTopic.value = '男朋友打游戏不接电话'
  perspectives.value = [
    { name: '女方', content: '我给他打了三个电话他都不接，后来发微信也不回。等了一个小时他才说在打游戏。我觉得游戏比我重要，很伤心。而且不是第一次了，说过很多次了。' },
    { name: '男方', content: '我就打了一局排位赛，大概40分钟。手机静音了没听到。看到消息马上就回了啊。她每次都因为这种小事发脾气我真的很累。我也需要有自己的放松时间吧。' },
  ]
}

// ---- API Key ----
function handleSaveKey() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  saveUserApiKey(key, apiProvider.value)
  apiConfigured.value = true
  apiSaveSuccess.value = true
  showApiSetup.value = false
  setTimeout(() => (apiSaveSuccess.value = false), 3000)
}

function handleClearKey() {
  clearUserApiKey()
  apiConfigured.value = false
  apiKeyInput.value = ''
  apiProvider.value = 'deepseek'
}

// ---- Submit ----
const canSubmitSingle = computed(() => singleContent.value.trim().length >= 20)
const canSubmitMulti = computed(() =>
  multiTopic.value.trim().length > 0 &&
  perspectives.value.length >= 2 &&
  perspectives.value.every(p => p.content.trim().length >= 10)
)
const canSubmit = computed(() => mode.value === 'single' ? canSubmitSingle.value : canSubmitMulti.value)

const loadingMessages = ['正在阅读各方陈述...', '正在分析事件经过...', '正在权衡各方立场...', '正在撰写裁定书...', '马上出结果...']

function buildPayload() {
  if (mode.value === 'single') {
    return { mode: 'single', content: singleContent.value.trim().slice(0, MAX_SINGLE) }
  }
  return {
    mode: 'multi',
    topic: multiTopic.value.trim().slice(0, 200),
    perspectives: perspectives.value.map(p => ({
      name: p.name.slice(0, 20),
      content: p.content.trim().slice(0, MAX_PERSPECTIVE),
    }))
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
    loadingProgress.value = Math.min(loadingProgress.value + 1.5 + Math.random() * 2.5, 92)
    const i = Math.floor(loadingProgress.value / 20)
    if (i !== msgIndex && i < loadingMessages.length) { msgIndex = i; loadingText.value = loadingMessages[i] }
  }, 300)

  try {
    const result = await requestJudgment(payload)
    loadingProgress.value = 100
    loadingText.value = '评理完成！'
    const id = await saveCase({ mode: mode.value, input: payload, result: typeof result === 'string' ? JSON.parse(result) : result })
    await new Promise(r => setTimeout(r, 500))
    router.push(`/result/${id}`)
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') {
      pendingPayload.value = payload
      showQuotaModal.value = true
    } else if (e.code === 'INVALID_KEY') {
      error.value = 'API Key 无效，请检查后重试'
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

// Retry after setting key from quota modal
async function retryWithNewKey() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  saveUserApiKey(key, apiProvider.value)
  apiConfigured.value = true
  showQuotaModal.value = false
  if (pendingPayload.value) {
    await doSubmit(pendingPayload.value)
    pendingPayload.value = null
  }
}
</script>

<template>
  <!-- ===== Loading overlay ===== -->
  <Transition name="fade">
    <div v-if="loading" class="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
         style="background: linear-gradient(165deg, #fef9f4 0%, #fff 100%)">
      <div class="relative mb-8">
        <div class="text-7xl animate-bounce" style="animation-duration: 1.5s">⚖️</div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/5 rounded-full blur-sm"></div>
      </div>
      <p class="text-lg font-bold text-brand-dark mb-4">{{ loadingText }}</p>
      <div class="w-56 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-light transition-all duration-500 ease-out"
             :style="{ width: loadingProgress + '%' }"></div>
      </div>
      <p class="text-[11px] text-gray-300 mt-6">通常需要 5-15 秒</p>
    </div>
  </Transition>

  <!-- ===== Quota exceeded modal ===== -->
  <Transition name="fade">
    <div v-if="showQuotaModal" class="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" @click.self="showQuotaModal = false">
      <div class="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up safe-bottom">
        <div class="text-center mb-5">
          <div class="text-3xl mb-2">😅</div>
          <h3 class="font-bold text-lg">免费额度用完了</h3>
          <p class="text-sm text-gray-400 mt-1">配置自己的 API Key 即可继续，永久免费</p>
        </div>

        <!-- Provider pills -->
        <div class="flex gap-2 mb-4">
          <button v-for="p in [
            { id: 'deepseek', label: 'DeepSeek', tag: '推荐' },
            { id: 'gemini', label: 'Gemini' },
            { id: 'openai', label: 'OpenAI' },
          ]" :key="p.id" @click="apiProvider = p.id"
            :class="['flex-1 py-2 rounded-xl text-sm font-medium transition-all border-2',
              apiProvider === p.id ? 'border-brand-orange bg-brand-orange/5 text-brand-orange' : 'border-gray-100 text-gray-400']">
            {{ p.label }}
            <span v-if="p.tag" class="text-[10px] block opacity-60">{{ p.tag }}</span>
          </button>
        </div>

        <input v-model="apiKeyInput" type="password" :placeholder="apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'"
          class="input-base mb-3" autocomplete="off" />

        <p class="text-[11px] text-gray-400 mb-5">
          <template v-if="apiProvider === 'deepseek'">
            前往 <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-brand-orange hover:underline">DeepSeek 开放平台</a> 获取 Key · 注册即送额度
          </template>
          <template v-else-if="apiProvider === 'gemini'">
            前往 <a href="https://aistudio.google.com/apikey" target="_blank" class="text-brand-orange hover:underline">Google AI Studio</a> 免费获取
          </template>
          <template v-else>
            前往 <a href="https://platform.openai.com/api-keys" target="_blank" class="text-brand-orange hover:underline">OpenAI</a> 获取
          </template>
        </p>

        <div class="flex gap-3">
          <button @click="showQuotaModal = false" class="btn-secondary flex-1 text-sm !py-2.5">算了</button>
          <button @click="retryWithNewKey" :disabled="!apiKeyInput.trim()" class="btn-primary flex-1 text-sm !py-2.5">继续评理 →</button>
        </div>
        <p class="text-[10px] text-gray-300 text-center mt-3">🔒 Key 仅存于你的浏览器本地</p>
      </div>
    </div>
  </Transition>

  <!-- ===== Main content ===== -->
  <div class="max-w-lg mx-auto px-4 py-5 md:py-8 pb-28">

    <!-- Hero -->
    <div class="text-center mb-5">
      <h1 class="text-[28px] md:text-4xl font-black text-brand-dark leading-tight mb-1.5">
        谁对谁错？
      </h1>
      <p class="text-gray-400">让 AI 帮你评理</p>
      <p v-if="caseCount > 0" class="text-[11px] text-gray-300 mt-2">
        已有 <span class="text-brand-orange font-bold">{{ caseCount.toLocaleString() }}</span> 次评理
      </p>
    </div>

    <!-- API Key banner -->
    <div class="mb-5">
      <!-- Not configured -->
      <div v-if="!apiConfigured" class="card p-3.5 cursor-pointer group" @click="showApiSetup = !showApiSetup">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-full bg-brand-orange/10 flex items-center justify-center text-sm">🔑</span>
            <div>
              <p class="text-sm font-medium text-gray-700">配置 API Key <span class="text-brand-orange text-xs font-normal">推荐</span></p>
              <p class="text-[11px] text-gray-400">免费额度有限 · 用自己的 Key 更稳定</p>
            </div>
          </div>
          <span class="text-gray-300 text-xs transition-transform duration-200" :class="showApiSetup ? 'rotate-180' : ''">▼</span>
        </div>
      </div>

      <!-- Configured -->
      <div v-else class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class="w-5 h-5 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center text-[10px]">✓</span>
          <span>已配置 {{ getUserProvider() === 'deepseek' ? 'DeepSeek' : getUserProvider() === 'gemini' ? 'Gemini' : 'OpenAI' }}</span>
        </div>
        <div class="flex items-center gap-3">
          <button @click="showApiSetup = !showApiSetup" class="text-[11px] text-gray-300 hover:text-gray-500 transition-colors">修改</button>
          <button @click="handleClearKey" class="text-[11px] text-gray-300 hover:text-red-400 transition-colors">清除</button>
        </div>
      </div>

      <!-- Success toast -->
      <Transition name="fade">
        <p v-if="apiSaveSuccess" class="text-xs text-green-500 text-center mt-2 animate-fade-in">✓ API Key 已保存</p>
      </Transition>

      <!-- API setup panel -->
      <Transition name="collapse">
        <div v-if="showApiSetup && !apiConfigured" class="mt-3 card p-4">
          <!-- Provider -->
          <div class="flex gap-2 mb-3">
            <button v-for="p in [
              { id: 'deepseek', label: 'DeepSeek', sub: '国内推荐' },
              { id: 'gemini', label: 'Gemini', sub: '免费额度多' },
              { id: 'openai', label: 'OpenAI', sub: '' },
            ]" :key="p.id" @click="apiProvider = p.id"
              :class="['flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-all border-2 text-center',
                apiProvider === p.id ? 'border-brand-orange bg-brand-orange/5 text-brand-orange' : 'border-gray-100 text-gray-400 hover:border-gray-200']">
              {{ p.label }}
              <span v-if="p.sub" class="block text-[10px] opacity-50 mt-0.5">{{ p.sub }}</span>
            </button>
          </div>
          <!-- Key input -->
          <div class="flex gap-2">
            <input v-model="apiKeyInput" type="password" :placeholder="apiProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'"
              class="input-base flex-1 !py-2 text-sm" autocomplete="off" @keyup.enter="handleSaveKey" />
            <button @click="handleSaveKey" :disabled="!apiKeyInput.trim()"
              class="btn-primary !py-2 !px-4 text-sm shrink-0">保存</button>
          </div>
          <!-- Help -->
          <p class="text-[11px] text-gray-300 mt-2.5">
            <template v-if="apiProvider === 'deepseek'">
              <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-brand-orange hover:underline">获取 DeepSeek Key →</a> 注册即送额度
            </template>
            <template v-else-if="apiProvider === 'gemini'">
              <a href="https://aistudio.google.com/apikey" target="_blank" class="text-brand-orange hover:underline">获取 Gemini Key →</a> Google 账号即可
            </template>
            <template v-else>
              <a href="https://platform.openai.com/api-keys" target="_blank" class="text-brand-orange hover:underline">获取 OpenAI Key →</a>
            </template>
            <span class="ml-1">· Key 仅存在你的浏览器中</span>
          </p>
        </div>
      </Transition>
    </div>

    <!-- Demo card -->
    <div class="card-hover p-4 mb-5 cursor-pointer group" @click="loadDemo">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-orange/10 to-brand-orange/5 flex items-center justify-center text-lg shrink-0">💬</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[11px] text-gray-300 font-medium">示例</span>
            <span class="text-[11px] text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity">点击试试 →</span>
          </div>
          <p class="text-sm font-semibold text-gray-700 mb-0.5">男朋友打游戏不接电话</p>
          <p class="text-xs text-gray-400">
            <span class="text-brand-orange font-medium">女方 65%</span>
            <span class="mx-1 text-gray-200">·</span>
            <span>男方 35%</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Mode toggle -->
    <div class="flex mb-5">
      <div class="inline-flex bg-white/80 rounded-2xl p-1 shadow-soft w-full">
        <button @click="mode = 'single'"
          :class="['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300',
            mode === 'single' ? 'bg-brand-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600']">
          📝 一人讲述
        </button>
        <button @click="mode = 'multi'"
          :class="['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300',
            mode === 'multi' ? 'bg-brand-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600']">
          👥 多人各讲
        </button>
      </div>
    </div>

    <!-- ===== Single mode ===== -->
    <div v-if="mode === 'single'" class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-gray-700">描述事件</h2>
        <button @click="showTips = !showTips" class="text-[11px] text-gray-300 hover:text-brand-orange transition-colors">
          {{ showTips ? '收起' : '写作提示 💡' }}
        </button>
      </div>

      <Transition name="collapse">
        <div v-if="showTips" class="mb-3 p-3 rounded-2xl bg-brand-cream text-[12px] text-gray-400 space-y-1 leading-relaxed">
          <p>· 👥 人物要区分清楚（甲/乙/男方/女方）</p>
          <p>· 💥 写清楚起因、经过、各方做了什么</p>
          <p>· 🎯 描述越详细，AI 判断越准</p>
        </div>
      </Transition>

      <textarea v-model="singleContent" placeholder="描述一下你们在吵什么，越详细越好..."
        :maxlength="MAX_SINGLE" rows="7" autocomplete="off"
        class="input-base resize-none leading-relaxed"></textarea>
      <p class="text-[11px] text-gray-300 text-right mt-1.5">
        {{ singleContent.length }}<span class="text-gray-200">/{{ MAX_SINGLE }}</span>
        <span v-if="singleContent.length > 0 && singleContent.length < 20" class="text-brand-orange ml-1">至少 20 字</span>
      </p>
    </div>

    <!-- ===== Multi mode ===== -->
    <div v-else class="space-y-3">
      <!-- Topic -->
      <div class="card p-5">
        <h2 class="font-bold text-gray-700 mb-2">在吵什么？</h2>
        <input v-model="multiTopic" type="text" maxlength="200" autocomplete="off"
          placeholder="一句话说明，例：关于周末要不要去见对方父母"
          class="input-base" />
      </div>

      <!-- Hint -->
      <div class="flex items-center justify-between px-1">
        <p class="text-xs text-gray-400">
          <template v-if="perspectives.length === 0">👇 添加吵架的各方</template>
          <template v-else>
            已添加 <span class="font-bold">{{ perspectives.length }}</span> 方
            <span v-if="perspectives.length < 2" class="text-brand-orange">· 至少 2 方</span>
            <span v-else class="text-green-500">✓</span>
          </template>
        </p>
      </div>

      <!-- Perspective cards -->
      <TransitionGroup name="party">
        <div v-for="(p, i) in perspectives" :key="'p-' + i" class="card p-4 relative">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span :class="['w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white',
                i === 0 ? 'bg-brand-orange' : i === 1 ? 'bg-brand-blue' : 'bg-brand-teal']">
                {{ i + 1 }}
              </span>
              <input v-model="p.name" maxlength="20"
                class="font-bold text-sm bg-transparent outline-none w-20 p-0"
                :placeholder="'第' + (i + 1) + '方'" />
            </div>
            <button @click="removePerspective(i)"
              class="w-6 h-6 rounded-lg text-gray-200 hover:bg-red-50 hover:text-red-400 transition-all text-xs flex items-center justify-center">✕</button>
          </div>
          <textarea v-model="p.content" :maxlength="MAX_PERSPECTIVE"
            :placeholder="'从' + p.name + '的角度：发生了什么？你的感受和立场是？'"
            rows="3" autocomplete="off"
            class="input-base resize-none leading-relaxed text-sm p-textarea"></textarea>
          <p class="text-[11px] text-gray-300 text-right mt-1">
            {{ p.content.length }}<span class="text-gray-200">/{{ MAX_PERSPECTIVE }}</span>
            <span v-if="p.content.length > 0 && p.content.length < 10" class="text-brand-orange ml-1">至少 10 字</span>
          </p>
        </div>
      </TransitionGroup>

      <!-- Add button -->
      <button v-if="perspectives.length < MAX_PARTIES" @click="addPerspective"
        :class="[
          'w-full py-3 rounded-2xl font-semibold transition-all text-sm',
          perspectives.length === 0
            ? 'bg-gradient-to-r from-brand-orange to-brand-orange-light text-white shadow-glow-orange hover:shadow-glow-orange-lg'
            : 'bg-white border-2 border-dashed border-gray-200 text-gray-400 hover:border-brand-orange hover:text-brand-orange'
        ]">
        + 添加{{ perspectives.length === 0 ? '第一方' : '一方' }}当事人
      </button>
    </div>

    <!-- Error -->
    <Transition name="fade">
      <div v-if="error" class="mt-4 p-3 rounded-2xl bg-red-50/80 text-red-500 text-sm flex items-start gap-2">
        <span class="shrink-0 text-xs mt-0.5">⚠️</span>
        <div class="flex-1">
          <p class="text-sm">{{ error }}</p>
          <button @click="error = ''" class="text-red-300 text-[11px] mt-0.5 hover:underline">关闭</button>
        </div>
      </div>
    </Transition>

    <p class="text-center text-[11px] text-gray-300 mt-5 mb-2">描述越详细 · 评理越准确</p>
  </div>

  <!-- ===== Sticky submit ===== -->
  <div class="fixed bottom-0 left-0 right-0 z-40 p-4 pb-5"
       style="background: linear-gradient(to top, rgba(254,249,244,1) 60%, rgba(254,249,244,0))">
    <div class="max-w-lg mx-auto">
      <button @click="submit" :disabled="!canSubmit || loading"
        :class="[
          'w-full py-4 rounded-2xl text-[16px] font-bold transition-all duration-300',
          canSubmit
            ? 'bg-gradient-to-r from-brand-orange to-brand-orange-light text-white shadow-glow-orange hover:shadow-glow-orange-lg active:scale-[0.98]'
            : 'bg-gray-200/80 text-gray-400 cursor-not-allowed'
        ]">
        ⚖️ 让 AI 评理
      </button>
    </div>
  </div>
</template>
