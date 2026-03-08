<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getCase } from '../data/supabase.js'

const route = useRoute()
const caseData = ref(null)
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)
const showInput = ref(false)

onMounted(async () => {
  const id = route.params.id
  const data = await getCase(id)
  if (data) {
    caseData.value = data
    // Update page title for shared links
    document.title = `${data.result?.summary || 'AI 评理结果'} · AI 吵架评理`
  } else {
    notFound.value = true
  }
  loading.value = false
})

const result = computed(() => caseData.value?.result || {})
const inputData = computed(() => caseData.value?.input || {})
const scores = computed(() => result.value.scores || {})
const sortedScores = computed(() =>
  Object.entries(scores.value).sort((a, b) => b[1] - a[1])
)

function shareUrl() {
  return window.location.href
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl())
  } catch {
    const input = document.createElement('input')
    input.value = shareUrl()
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function scoreColor(score) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-brand-orange'
  if (score >= 30) return 'bg-yellow-500'
  return 'bg-red-400'
}

function scoreEmoji(score) {
  if (score >= 70) return '✅'
  if (score >= 50) return '🤔'
  if (score >= 30) return '⚠️'
  return '❌'
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 md:py-12">
    <!-- loading -->
    <div v-if="loading" class="text-center py-20">
      <div class="text-4xl mb-4 animate-bounce">⚖️</div>
      <p class="text-gray-400">加载中...</p>
    </div>

    <!-- not found -->
    <div v-else-if="notFound" class="text-center py-20">
      <div class="text-4xl mb-4">🤷</div>
      <h2 class="text-xl font-bold mb-2">找不到这条评理记录</h2>
      <p class="text-gray-400 mb-6">可能链接不对，或者记录已过期</p>
      <router-link to="/" class="btn-primary">回去评理 →</router-link>
    </div>

    <!-- result -->
    <div v-else class="space-y-4">
      <!-- header -->
      <div class="text-center mb-6 animate-fade-in">
        <div class="text-4xl mb-3">⚖️</div>
        <h1 class="text-2xl md:text-3xl font-bold mb-2">AI 评理结果</h1>
        <p class="text-gray-500">{{ result.summary }}</p>
      </div>

      <!-- scores -->
      <div class="card p-6 md:p-8 animate-slide-up" style="animation-delay: 0.1s">
        <h3 class="font-bold text-sm text-gray-400 uppercase tracking-wider mb-4">有理程度</h3>
        <div class="space-y-4">
          <div v-for="([name, score], idx) in sortedScores" :key="name"
               :style="{ animationDelay: (0.2 + idx * 0.1) + 's' }"
               class="animate-slide-up">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold flex items-center gap-2">
                {{ scoreEmoji(score) }} {{ name }}
              </span>
              <span class="text-2xl font-bold" :class="score >= 50 ? 'text-green-600' : 'text-gray-400'">
                {{ score }}%
              </span>
            </div>
            <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all duration-1000 ease-out', scoreColor(score)]"
                :style="{ width: score + '%', transitionDelay: (0.5 + idx * 0.15) + 's' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- verdict -->
      <div class="card p-6 md:p-8 border-l-4 border-brand-orange animate-slide-up" style="animation-delay: 0.3s">
        <h3 class="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">裁定</h3>
        <p class="text-lg leading-relaxed">{{ result.verdict }}</p>
      </div>

      <!-- analysis -->
      <div class="card p-6 md:p-8 animate-slide-up" style="animation-delay: 0.4s">
        <h3 class="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">详细分析</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line">{{ result.analysis }}</p>
      </div>

      <!-- advice -->
      <div class="card p-6 md:p-8 bg-brand-teal/5 border-brand-teal/20 animate-slide-up" style="animation-delay: 0.5s">
        <h3 class="font-bold text-sm text-brand-teal uppercase tracking-wider mb-3">💡 建议</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line">{{ result.advice }}</p>
      </div>

      <!-- original input (collapsible) -->
      <div class="card overflow-hidden animate-slide-up" style="animation-delay: 0.55s">
        <button
          @click="showInput = !showInput"
          class="w-full p-4 text-left flex items-center justify-between text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span>📄 查看原始输入</span>
          <span class="transition-transform duration-200" :class="showInput ? 'rotate-180' : ''">▼</span>
        </button>
        <div v-if="showInput" class="px-6 pb-6 text-sm text-gray-500 leading-relaxed">
          <template v-if="inputData.mode === 'single'">
            <p class="whitespace-pre-line">{{ inputData.content }}</p>
          </template>
          <template v-else>
            <p class="font-medium text-gray-600 mb-3">主题：{{ inputData.topic }}</p>
            <div v-for="p in inputData.perspectives" :key="p.name" class="mb-3">
              <p class="font-medium text-gray-600">{{ p.name }}：</p>
              <p class="whitespace-pre-line pl-4 border-l-2 border-gray-200 mt-1">{{ p.content }}</p>
            </div>
          </template>
        </div>
      </div>

      <!-- voting placeholder -->
      <div class="card p-6 text-center opacity-60 animate-slide-up" style="animation-delay: 0.6s">
        <p class="text-sm text-gray-400 mb-3">你觉得 AI 评得怎么样？</p>
        <div class="flex justify-center gap-4">
          <button disabled class="px-6 py-2 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed">
            👍 有道理
          </button>
          <button disabled class="px-6 py-2 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed">
            👎 不同意
          </button>
        </div>
        <p class="text-xs text-gray-300 mt-2">投票功能即将上线</p>
      </div>

      <!-- share -->
      <div class="card p-6 text-center animate-slide-up" style="animation-delay: 0.65s">
        <p class="text-sm text-gray-500 mb-3">分享给当事人看看？</p>
        <div class="flex gap-3 justify-center">
          <button @click="copyLink" class="btn-primary">
            {{ copied ? '✅ 已复制' : '📋 复制链接' }}
          </button>
          <router-link to="/" class="btn-secondary">
            再评一次
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
