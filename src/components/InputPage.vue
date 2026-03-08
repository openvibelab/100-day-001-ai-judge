<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { requestJudgment } from '../data/ai.js'
import { saveCase } from '../data/supabase.js'

const router = useRouter()

const MAX_SINGLE = 3000
const MAX_PERSPECTIVE = 1500

// ---- Mode toggle ----
const mode = ref('single') // 'single' | 'multi'

// ---- Single mode ----
const singleContent = ref('')
const singlePlaceholder = `完整描述这件事，请包含：

🕐 时间：什么时候发生的
📍 地点：在哪里
👥 人物：用 A、B（或具体称呼，如"男方""女方""室友甲"）明确区分每个人
💥 起因：因为什么事情产生了矛盾
📖 经过：事情怎么发展的，各方分别做了什么、说了什么
🎯 结果：现在是什么情况

⚠️ 提示：人物一定要明确区分（A/B/甲/乙），AI 才能客观评判`

// ---- Multi mode ----
const multiTopic = ref('')
const perspectives = ref([
  { name: '甲方', content: '' },
  { name: '乙方', content: '' },
])

function addPerspective() {
  const labels = ['丙方', '丁方', '戊方', '己方']
  const idx = perspectives.value.length - 2
  const name = idx < labels.length ? labels[idx] : `第${perspectives.value.length + 1}方`
  perspectives.value.push({ name, content: '' })
}

function removePerspective(i) {
  if (perspectives.value.length > 2) {
    perspectives.value.splice(i, 1)
  }
}

// ---- Submit ----
const loading = ref(false)
const loadingText = ref('')
const error = ref('')

const canSubmitSingle = computed(() => singleContent.value.trim().length >= 20)
const canSubmitMulti = computed(() =>
  multiTopic.value.trim().length > 0 &&
  perspectives.value.every(p => p.content.trim().length >= 10)
)
const canSubmit = computed(() => mode.value === 'single' ? canSubmitSingle.value : canSubmitMulti.value)

const loadingMessages = [
  '正在阅读双方陈述...',
  '正在分析事件经过...',
  '正在权衡各方立场...',
  '正在撰写裁定书...',
  '即将出结果...',
]

async function submit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  error.value = ''
  loadingText.value = loadingMessages[0]

  // Cycle through loading messages
  let msgIndex = 0
  const msgTimer = setInterval(() => {
    msgIndex = Math.min(msgIndex + 1, loadingMessages.length - 1)
    loadingText.value = loadingMessages[msgIndex]
  }, 3000)

  try {
    const payload = mode.value === 'single'
      ? { mode: 'single', content: singleContent.value.trim().slice(0, MAX_SINGLE) }
      : {
          mode: 'multi',
          topic: multiTopic.value.trim().slice(0, 200),
          perspectives: perspectives.value.map(p => ({
            name: p.name.slice(0, 20),
            content: p.content.trim().slice(0, MAX_PERSPECTIVE),
          }))
        }

    const result = await requestJudgment(payload)

    const id = await saveCase({
      mode: mode.value,
      input: payload,
      result: typeof result === 'string' ? JSON.parse(result) : result,
    })

    router.push(`/result/${id}`)
  } catch (e) {
    error.value = e.message || '请求失败，请稍后再试'
  } finally {
    clearInterval(msgTimer)
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 md:py-12">
    <!-- hero -->
    <div class="text-center mb-10">
      <h1 class="text-3xl md:text-4xl font-bold mb-3">
        ⚖️ AI 吵架评理
      </h1>
      <p class="text-gray-500 text-lg">
        谁对谁错？让 AI 说了算。
      </p>
    </div>

    <!-- mode toggle -->
    <div class="flex justify-center mb-8">
      <div class="inline-flex bg-gray-100 rounded-xl p-1">
        <button
          @click="mode = 'single'"
          :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'single' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        >
          📝 完整描述
        </button>
        <button
          @click="mode = 'multi'"
          :class="['px-5 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'multi' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        >
          👥 多方视角
        </button>
      </div>
    </div>

    <!-- single mode -->
    <div v-if="mode === 'single'" class="card p-6 md:p-8">
      <h2 class="font-bold text-lg mb-1">完整描述事件</h2>
      <p class="text-sm text-gray-400 mb-4">由一个人描述整件事的来龙去脉，AI 根据你的描述来评理。</p>

      <textarea
        v-model="singleContent"
        :placeholder="singlePlaceholder"
        :maxlength="MAX_SINGLE"
        rows="12"
        class="input-base resize-none leading-relaxed"
      ></textarea>

      <div class="flex items-center justify-between mt-4">
        <span class="text-xs text-gray-400">
          {{ singleContent.length }} / {{ MAX_SINGLE }} 字
          <span v-if="singleContent.length > 0 && singleContent.length < 20" class="text-brand-orange">（至少 20 字）</span>
        </span>
      </div>
    </div>

    <!-- multi mode -->
    <div v-else class="space-y-4">
      <!-- topic -->
      <div class="card p-6">
        <h2 class="font-bold text-lg mb-1">争执主题</h2>
        <p class="text-sm text-gray-400 mb-3">一句话说明在吵什么</p>
        <input
          v-model="multiTopic"
          type="text"
          maxlength="200"
          placeholder="例：关于周末要不要去见对方父母的问题"
          class="input-base"
        />
      </div>

      <!-- perspectives -->
      <div v-for="(p, i) in perspectives" :key="i" class="card p-6 relative">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <input
              v-model="p.name"
              maxlength="20"
              class="font-bold text-lg bg-transparent border-none outline-none w-24 focus:ring-0 p-0"
              :placeholder="'第' + (i+1) + '方'"
            />
            <span class="text-xs text-gray-400">的视角</span>
          </div>
          <button
            v-if="perspectives.length > 2"
            @click="removePerspective(i)"
            class="text-gray-300 hover:text-red-400 transition-colors text-sm"
            title="移除"
          >
            ✕
          </button>
        </div>
        <textarea
          v-model="p.content"
          :maxlength="MAX_PERSPECTIVE"
          :placeholder="'从' + p.name + '的角度描述事件经过、自己的感受和立场...'"
          rows="6"
          class="input-base resize-none leading-relaxed"
        ></textarea>
        <span class="text-xs text-gray-400 mt-2 inline-block">
          {{ p.content.length }} / {{ MAX_PERSPECTIVE }} 字
          <span v-if="p.content.length > 0 && p.content.length < 10" class="text-brand-orange">（至少 10 字）</span>
        </span>
      </div>

      <!-- add perspective -->
      <button
        v-if="perspectives.length < 6"
        @click="addPerspective"
        class="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400
               hover:border-brand-orange hover:text-brand-orange transition-all text-sm font-medium"
      >
        + 添加一方视角
      </button>
    </div>

    <!-- error -->
    <div v-if="error" class="mt-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-start gap-3">
      <span class="shrink-0">⚠️</span>
      <div>
        <p>{{ error }}</p>
        <button @click="error = ''" class="text-red-400 hover:text-red-600 text-xs mt-1 underline">关闭</button>
      </div>
    </div>

    <!-- submit -->
    <button
      @click="submit"
      :disabled="!canSubmit || loading"
      class="btn-primary w-full mt-6 py-4 text-lg"
    >
      <span v-if="loading" class="inline-flex items-center gap-2">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        {{ loadingText }}
      </span>
      <span v-else>⚖️ 让 AI 评理</span>
    </button>

    <!-- tips -->
    <div class="mt-8 p-4 rounded-xl bg-brand-orange/5 text-sm text-gray-500">
      <p class="font-medium text-gray-600 mb-2">💡 小提示</p>
      <ul class="space-y-1">
        <li>· 描述越详细，AI 评理越准确</li>
        <li>· 尽量客观描述事实，避免只写情绪</li>
        <li>· 多方视角模式下，每个人只描述自己看到的</li>
      </ul>
    </div>
  </div>
</template>
