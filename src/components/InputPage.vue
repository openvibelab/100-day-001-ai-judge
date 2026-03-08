<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { requestJudgment, hasUserApiKey, saveUserApiKey, getUserApiKey, getUserProvider } from '../data/ai.js'
import { saveCase, getCaseCount } from '../data/supabase.js'

const router = useRouter()

const MAX_SINGLE = 3000
const MAX_PERSPECTIVE = 1500

// ---- Case count ----
const caseCount = ref(0)
onMounted(async () => {
  caseCount.value = await getCaseCount()
})

// ---- Mode toggle ----
const mode = ref('single')

// ---- Single mode ----
const singleContent = ref('')

// ---- Multi mode ----
const multiTopic = ref('')
const perspectives = ref([])
const PARTY_LABELS = ['甲方', '乙方', '丙方', '丁方', '戊方', '己方']
const MAX_PARTIES = 6

function addPerspective() {
  if (perspectives.value.length >= MAX_PARTIES) return
  const idx = perspectives.value.length
  const name = idx < PARTY_LABELS.length ? PARTY_LABELS[idx] : `第${idx + 1}方`
  perspectives.value.push({ name, content: '' })
  // Auto-focus new textarea
  nextTick(() => {
    const textareas = document.querySelectorAll('.perspective-textarea')
    textareas[textareas.length - 1]?.focus()
  })
}

function removePerspective(i) {
  perspectives.value.splice(i, 1)
}

// ---- Demo ----
const showTips = ref(false)

function loadDemo() {
  mode.value = 'multi'
  multiTopic.value = '男朋友打游戏不接电话'
  perspectives.value = [
    { name: '女方', content: '我给他打了三个电话他都不接，后来发微信也不回。等了一个小时他才说在打游戏。我觉得游戏比我重要，很伤心。而且不是第一次了。' },
    { name: '男方', content: '我就打了一局排位赛，大概40分钟。手机静音了没听到。看到消息马上就回了。她每次都因为这种小事发脾气我觉得很累。我也需要自己的时间。' },
  ]
}

// ---- Submit ----
const loading = ref(false)
const loadingProgress = ref(0)
const loadingText = ref('')
const error = ref('')
const showApiKeyModal = ref(false)
const pendingPayload = ref(null)

const canSubmitSingle = computed(() => singleContent.value.trim().length >= 20)
const canSubmitMulti = computed(() =>
  multiTopic.value.trim().length > 0 &&
  perspectives.value.length >= 2 &&
  perspectives.value.every(p => p.content.trim().length >= 10)
)
const canSubmit = computed(() => mode.value === 'single' ? canSubmitSingle.value : canSubmitMulti.value)

const loadingMessages = [
  '正在阅读各方陈述...',
  '正在分析事件经过...',
  '正在权衡各方立场...',
  '正在撰写裁定书...',
  '马上出结果...',
]

function buildPayload() {
  return mode.value === 'single'
    ? { mode: 'single', content: singleContent.value.trim().slice(0, MAX_SINGLE) }
    : {
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
  const payload = buildPayload()
  await doSubmit(payload)
}

async function doSubmit(payload, useUserKey = false) {
  loading.value = true
  error.value = ''
  loadingProgress.value = 0
  loadingText.value = loadingMessages[0]

  // Fake progress
  let msgIndex = 0
  const progressTimer = setInterval(() => {
    loadingProgress.value = Math.min(loadingProgress.value + 2 + Math.random() * 3, 92)
    const newIdx = Math.floor(loadingProgress.value / 20)
    if (newIdx !== msgIndex && newIdx < loadingMessages.length) {
      msgIndex = newIdx
      loadingText.value = loadingMessages[msgIndex]
    }
  }, 300)

  try {
    const result = await requestJudgment(payload, { useUserKey })

    loadingProgress.value = 100
    loadingText.value = '评理完成！'

    const id = await saveCase({
      mode: mode.value,
      input: payload,
      result: typeof result === 'string' ? JSON.parse(result) : result,
    })

    // Brief pause to show 100%
    await new Promise(r => setTimeout(r, 400))
    router.push(`/result/${id}`)
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') {
      pendingPayload.value = payload
      showApiKeyModal.value = true
    } else {
      error.value = e.message || '请求失败，请稍后再试'
    }
  } finally {
    clearInterval(progressTimer)
    loading.value = false
    loadingProgress.value = 0
  }
}

// ---- API Key Modal ----
const apiKeyInput = ref(getUserApiKey())
const apiKeyProvider = ref(getUserProvider())

async function submitWithUserKey() {
  if (!apiKeyInput.value.trim()) return
  saveUserApiKey(apiKeyInput.value.trim(), apiKeyProvider.value)
  showApiKeyModal.value = false
  if (pendingPayload.value) {
    await doSubmit(pendingPayload.value, true)
    pendingPayload.value = null
  }
}
</script>

<template>
  <!-- Loading overlay -->
  <Transition name="fade">
    <div v-if="loading" class="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6">
      <div class="text-6xl mb-6 animate-bounce">⚖️</div>
      <p class="text-lg font-bold text-brand-dark mb-2">{{ loadingText }}</p>
      <div class="w-64 h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          class="h-full bg-brand-orange rounded-full transition-all duration-300 ease-out"
          :style="{ width: loadingProgress + '%' }"
        ></div>
      </div>
      <p class="text-xs text-gray-400">AI 正在认真思考中，请稍等...</p>
    </div>
  </Transition>

  <!-- API Key Modal -->
  <Transition name="fade">
    <div v-if="showApiKeyModal" class="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center px-4" @click.self="showApiKeyModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
        <h3 class="font-bold text-lg mb-1">🔑 免费额度用完了</h3>
        <p class="text-sm text-gray-500 mb-5">输入你自己的 API Key 即可继续使用，完全免费。</p>

        <!-- Provider select -->
        <div class="flex gap-2 mb-4">
          <button
            v-for="p in [
              { id: 'gemini', label: 'Gemini', hint: '推荐·免费' },
              { id: 'openai', label: 'OpenAI' },
              { id: 'deepseek', label: 'DeepSeek' },
            ]"
            :key="p.id"
            @click="apiKeyProvider = p.id"
            :class="['flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all border-2',
              apiKeyProvider === p.id
                ? 'border-brand-orange bg-brand-orange/5 text-brand-orange'
                : 'border-gray-100 text-gray-400 hover:border-gray-200']"
          >
            {{ p.label }}
            <span v-if="p.hint" class="block text-xs opacity-60">{{ p.hint }}</span>
          </button>
        </div>

        <!-- API Key input -->
        <input
          v-model="apiKeyInput"
          type="password"
          :placeholder="apiKeyProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'"
          class="input-base mb-3"
          autocomplete="off"
        />

        <!-- Help link -->
        <p class="text-xs text-gray-400 mb-5">
          <template v-if="apiKeyProvider === 'gemini'">
            <a href="https://aistudio.google.com/apikey" target="_blank" class="text-brand-orange hover:underline">
              免费获取 Gemini API Key →
            </a>
            （Google 账号即可，无需付费）
          </template>
          <template v-else-if="apiKeyProvider === 'openai'">
            前往 <a href="https://platform.openai.com/api-keys" target="_blank" class="text-brand-orange hover:underline">OpenAI 控制台</a> 创建 Key
          </template>
          <template v-else>
            前往 <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-brand-orange hover:underline">DeepSeek 控制台</a> 创建 Key
          </template>
        </p>

        <div class="flex gap-3">
          <button @click="showApiKeyModal = false" class="btn-secondary flex-1">取消</button>
          <button
            @click="submitWithUserKey"
            :disabled="!apiKeyInput.trim()"
            class="btn-primary flex-1"
          >
            继续评理
          </button>
        </div>

        <p class="text-xs text-gray-300 text-center mt-4">🔒 你的 Key 仅存储在本地浏览器中，不会被我们保存</p>
      </div>
    </div>
  </Transition>

  <div class="max-w-2xl mx-auto px-4 py-6 md:py-10">
    <!-- Hero -->
    <div class="text-center mb-6">
      <h1 class="text-3xl md:text-4xl font-bold mb-2">谁对谁错？</h1>
      <p class="text-gray-500 text-lg mb-3">让 AI 说了算。</p>
      <p v-if="caseCount > 0" class="inline-block text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
        已有 <span class="font-bold text-brand-orange">{{ caseCount }}</span> 人用过
      </p>
    </div>

    <!-- Example card -->
    <div class="card p-4 mb-6 cursor-pointer group hover:border-brand-orange/30 transition-all" @click="loadDemo">
      <div class="flex items-start gap-3">
        <div class="text-2xl shrink-0">💬</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium text-gray-400">示例案例</span>
            <span class="text-xs text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity">点击试一试 →</span>
          </div>
          <p class="text-sm font-medium text-gray-700 mb-1">男朋友打游戏不接电话</p>
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span>女方 65% · 男方 35%</span>
            <span class="text-brand-orange">→ 女方更有理</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mode toggle -->
    <div class="flex justify-center mb-6">
      <div class="inline-flex bg-gray-100 rounded-xl p-1 w-full max-w-xs">
        <button
          @click="mode = 'single'"
          :class="['flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            mode === 'single' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        >
          📝 一人讲述
        </button>
        <button
          @click="mode = 'multi'"
          :class="['flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            mode === 'multi' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        >
          👥 多人各讲
        </button>
      </div>
    </div>

    <!-- Single mode -->
    <div v-if="mode === 'single'" class="card p-5 md:p-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold">描述事件</h2>
        <button @click="showTips = !showTips" class="text-xs text-gray-400 hover:text-brand-orange transition-colors">
          {{ showTips ? '收起提示' : '写作提示 💡' }}
        </button>
      </div>

      <!-- Collapsible tips -->
      <Transition name="collapse">
        <div v-if="showTips" class="mb-4 p-3 rounded-xl bg-brand-orange/5 text-xs text-gray-500 space-y-1">
          <p>· 🕐 时间地点：什么时候、在哪发生的</p>
          <p>· 👥 人物：用 A/B 或具体称呼区分每个人</p>
          <p>· 💥 起因经过：因为什么吵的，各方做了什么</p>
          <p>· 🎯 结果：现在是什么情况</p>
        </div>
      </Transition>

      <textarea
        v-model="singleContent"
        placeholder="描述一下你们在吵什么，越详细越好..."
        :maxlength="MAX_SINGLE"
        rows="8"
        autocomplete="off"
        class="input-base resize-none leading-relaxed"
      ></textarea>

      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-300">
          {{ singleContent.length }} / {{ MAX_SINGLE }}
          <span v-if="singleContent.length > 0 && singleContent.length < 20" class="text-brand-orange">（至少 20 字）</span>
        </span>
      </div>
    </div>

    <!-- Multi mode -->
    <div v-else class="space-y-3">
      <!-- Topic -->
      <div class="card p-5">
        <h2 class="font-bold mb-2">在吵什么？</h2>
        <input
          v-model="multiTopic"
          type="text"
          maxlength="200"
          autocomplete="off"
          placeholder="一句话说明，例：关于周末要不要去见对方父母"
          class="input-base"
        />
      </div>

      <!-- Party count hint -->
      <div class="flex items-center justify-between px-1">
        <p class="text-sm text-gray-400">
          <span v-if="perspectives.length === 0">👇 添加吵架的各方</span>
          <span v-else>已添加 {{ perspectives.length }} 方
            <span v-if="perspectives.length < 2" class="text-brand-orange">（至少 2 方才能评理）</span>
            <span v-else class="text-green-500">✓</span>
          </span>
        </p>
        <span v-if="perspectives.length > 0" class="text-xs text-gray-300">最多 {{ MAX_PARTIES }} 方</span>
      </div>

      <!-- Perspectives -->
      <TransitionGroup name="party">
        <div v-for="(p, i) in perspectives" :key="'p-' + i" class="card p-5 relative">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-brand-orange/10 text-brand-orange text-xs flex items-center justify-center font-bold">
                {{ i + 1 }}
              </span>
              <input
                v-model="p.name"
                maxlength="20"
                class="font-bold bg-transparent border-none outline-none w-20 focus:ring-0 p-0"
                :placeholder="'第' + (i + 1) + '方'"
              />
            </div>
            <button
              @click="removePerspective(i)"
              class="w-6 h-6 rounded-full text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all text-xs flex items-center justify-center"
              title="移除"
            >✕</button>
          </div>
          <textarea
            v-model="p.content"
            :maxlength="MAX_PERSPECTIVE"
            :placeholder="'从' + p.name + '的角度：发生了什么？你的感受和立场是什么？'"
            rows="4"
            autocomplete="off"
            class="input-base resize-none leading-relaxed perspective-textarea"
          ></textarea>
          <div class="flex items-center justify-between mt-1.5">
            <span class="text-xs text-gray-300">
              {{ p.content.length }} / {{ MAX_PERSPECTIVE }}
              <span v-if="p.content.length > 0 && p.content.length < 10" class="text-brand-orange">（至少 10 字）</span>
            </span>
          </div>
        </div>
      </TransitionGroup>

      <!-- Add party button -->
      <button
        v-if="perspectives.length < MAX_PARTIES"
        @click="addPerspective"
        :class="[
          'w-full py-3.5 rounded-xl font-medium transition-all text-sm',
          perspectives.length === 0
            ? 'bg-brand-orange text-white hover:bg-brand-orange-light shadow-md hover:shadow-lg hover:shadow-brand-orange/20'
            : 'border-2 border-dashed border-gray-200 text-gray-400 hover:border-brand-orange hover:text-brand-orange'
        ]"
      >
        + 添加{{ perspectives.length === 0 ? '第一方' : '一方' }}当事人
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="mt-4 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm flex items-start gap-2.5">
      <span class="shrink-0">⚠️</span>
      <div class="flex-1">
        <p>{{ error }}</p>
        <button @click="error = ''" class="text-red-400 hover:text-red-600 text-xs mt-1 underline">关闭</button>
      </div>
    </div>

    <!-- Submit (sticky on mobile) -->
    <div class="sticky bottom-4 z-40 mt-5">
      <button
        @click="submit"
        :disabled="!canSubmit || loading"
        :class="[
          'w-full py-4 text-lg rounded-2xl font-bold transition-all duration-300',
          canSubmit
            ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 hover:shadow-xl hover:shadow-brand-orange/40 hover:bg-brand-orange-light active:scale-[0.98]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        ]"
      >
        ⚖️ 让 AI 评理
      </button>
    </div>

    <!-- Minimal tip -->
    <p class="text-center text-xs text-gray-300 mt-4 mb-2">描述越详细，评理越准确</p>
  </div>
</template>
