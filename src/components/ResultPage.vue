<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getCase } from '../data/supabase.js'

const route = useRoute()
const caseData = ref(null)
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)
const showInput = ref(false)
const animateScores = ref(false)

onMounted(async () => {
  const id = route.params.id
  const data = await getCase(id)
  if (data) {
    caseData.value = data
    document.title = `${data.result?.summary || 'AI 评理结果'} · AI 吵架评理`
    // Trigger score animation after render
    await nextTick()
    requestAnimationFrame(() => { animateScores.value = true })
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
const winner = computed(() => {
  if (result.value.winner && result.value.winner !== '难分高下') return result.value.winner
  const sorted = sortedScores.value
  if (sorted.length >= 2 && sorted[0][1] - sorted[1][1] >= 10) return sorted[0][0]
  return null
})
const isDraw = computed(() => {
  const sorted = sortedScores.value
  return sorted.length >= 2 && Math.abs(sorted[0][1] - sorted[1][1]) < 10
})

function shareUrl() { return window.location.href }

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

function shareText() {
  const r = result.value
  if (!r.summary) return ''
  const top = sortedScores.value[0]
  return `AI 吵架评理：${r.summary}｜${top ? top[0] + ' ' + top[1] + '%' : ''}｜你觉得评得对吗？`
}

async function nativeShare() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'AI 吵架评理', text: shareText(), url: shareUrl() })
    } catch { /* cancelled */ }
  } else {
    copyLink()
  }
}

function scoreColor(score) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-brand-orange'
  if (score >= 30) return 'bg-yellow-500'
  return 'bg-red-400'
}

function scoreTextColor(score) {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-brand-orange'
  if (score >= 30) return 'text-yellow-600'
  return 'text-red-500'
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6 md:py-10">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-20">
      <div class="text-5xl mb-4 animate-bounce">⚖️</div>
      <p class="text-gray-400">加载中...</p>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="text-center py-20">
      <div class="text-5xl mb-4">🤷</div>
      <h2 class="text-xl font-bold mb-2">找不到这条评理记录</h2>
      <p class="text-gray-400 mb-6">可能链接不对，或者记录已过期</p>
      <router-link to="/" class="btn-primary">去评理 →</router-link>
    </div>

    <!-- Result -->
    <div v-else>
      <!-- Hero verdict -->
      <div class="text-center mb-6 animate-fade-in">
        <!-- Winner announcement -->
        <div v-if="winner" class="mb-4">
          <p class="text-sm text-gray-400 mb-2">AI 裁定</p>
          <div class="inline-block bg-brand-orange/10 rounded-2xl px-6 py-3 mb-2">
            <span class="text-3xl md:text-4xl font-black text-brand-orange">{{ winner }} 更有理!</span>
          </div>
        </div>
        <div v-else-if="isDraw" class="mb-4">
          <p class="text-sm text-gray-400 mb-2">AI 裁定</p>
          <div class="inline-block bg-gray-100 rounded-2xl px-6 py-3 mb-2">
            <span class="text-3xl md:text-4xl font-black text-gray-600">难分高下!</span>
          </div>
        </div>

        <p class="text-gray-500 text-sm">{{ result.summary }}</p>
      </div>

      <!-- Score battle -->
      <div class="card p-5 md:p-6 mb-3 animate-slide-up" style="animation-delay: 0.1s">
        <div class="space-y-5">
          <div v-for="([name, score], idx) in sortedScores" :key="name">
            <div class="flex justify-between items-end mb-2">
              <div class="flex items-center gap-2">
                <span v-if="idx === 0 && !isDraw" class="text-sm">👑</span>
                <span class="font-bold text-lg">{{ name }}</span>
              </div>
              <span class="text-3xl font-black tabular-nums" :class="scoreTextColor(score)">
                {{ score }}<span class="text-lg">%</span>
              </span>
            </div>
            <div class="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all ease-out', scoreColor(score)]"
                :style="{
                  width: animateScores ? score + '%' : '0%',
                  transitionDuration: '1.2s',
                  transitionDelay: (0.3 + idx * 0.2) + 's',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Verdict -->
      <div class="card p-5 md:p-6 mb-3 border-l-4 border-brand-orange animate-slide-up" style="animation-delay: 0.2s">
        <h3 class="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">裁定</h3>
        <p class="text-lg leading-relaxed font-medium">{{ result.verdict }}</p>
      </div>

      <!-- Analysis -->
      <div class="card p-5 md:p-6 mb-3 animate-slide-up" style="animation-delay: 0.3s">
        <h3 class="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">详细分析</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{{ result.analysis }}</p>
      </div>

      <!-- Advice -->
      <div class="card p-5 md:p-6 mb-3 bg-brand-teal/5 border-brand-teal/20 animate-slide-up" style="animation-delay: 0.4s">
        <h3 class="font-bold text-xs text-brand-teal uppercase tracking-wider mb-2">💡 建议</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{{ result.advice }}</p>
      </div>

      <!-- Share CTA -->
      <div class="card p-5 text-center mb-3 animate-slide-up" style="animation-delay: 0.5s">
        <p class="font-bold mb-1">把结果甩给 TA 看看？</p>
        <p class="text-xs text-gray-400 mb-4">复制链接发过去，让 TA 心服口服</p>
        <div class="flex gap-3 justify-center">
          <button @click="nativeShare" class="btn-primary text-sm">
            {{ copied ? '✅ 已复制！' : '📤 分享结果' }}
          </button>
          <router-link to="/" class="btn-secondary text-sm">
            再评一次
          </router-link>
        </div>
      </div>

      <!-- Original input -->
      <div class="card overflow-hidden animate-slide-up" style="animation-delay: 0.55s">
        <button
          @click="showInput = !showInput"
          class="w-full p-4 text-left flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span>📄 查看原始输入</span>
          <span class="transition-transform duration-200" :class="showInput ? 'rotate-180' : ''">▼</span>
        </button>
        <Transition name="collapse">
          <div v-if="showInput" class="px-5 pb-5 text-sm text-gray-500 leading-relaxed">
            <template v-if="inputData.mode === 'single'">
              <p class="whitespace-pre-line">{{ inputData.content }}</p>
            </template>
            <template v-else>
              <p class="font-medium text-gray-600 mb-3">主题：{{ inputData.topic }}</p>
              <div v-for="p in inputData.perspectives" :key="p.name" class="mb-3">
                <p class="font-medium text-gray-600">{{ p.name }}：</p>
                <p class="whitespace-pre-line pl-3 border-l-2 border-gray-200 mt-1">{{ p.content }}</p>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
