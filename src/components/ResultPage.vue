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
  const data = await getCase(route.params.id)
  if (data) {
    caseData.value = data
    document.title = `${data.result?.summary || '评理结果'} · AI 吵架评理`
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
const sortedScores = computed(() => Object.entries(scores.value).sort((a, b) => b[1] - a[1]))

const winner = computed(() => {
  if (result.value.winner && result.value.winner !== '难分高下') return result.value.winner
  const s = sortedScores.value
  if (s.length >= 2 && s[0][1] - s[1][1] >= 10) return s[0][0]
  return null
})
const isDraw = computed(() => {
  const s = sortedScores.value
  return s.length >= 2 && Math.abs(s[0][1] - s[1][1]) < 10
})

function shareUrl() { return window.location.href }

async function copyLink() {
  try { await navigator.clipboard.writeText(shareUrl()) } catch {
    const el = document.createElement('input'); el.value = shareUrl()
    document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function nativeShare() {
  const text = `AI 评理：${result.value.summary}｜${sortedScores.value[0]?.[0]} ${sortedScores.value[0]?.[1]}%`
  if (navigator.share) {
    try { await navigator.share({ title: 'AI 吵架评理', text, url: shareUrl() }) } catch {}
  } else { copyLink() }
}

const SCORE_COLORS = ['from-brand-orange to-brand-orange-light', 'from-brand-blue to-blue-400', 'from-brand-teal to-teal-400', 'from-yellow-500 to-amber-400', 'from-purple-500 to-purple-400', 'from-pink-500 to-pink-400']
const BADGE_COLORS = ['bg-brand-orange', 'bg-brand-blue', 'bg-brand-teal', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500']
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-5 md:py-8">

    <!-- Loading -->
    <div v-if="loading" class="text-center py-24">
      <div class="text-5xl mb-4 animate-bounce" style="animation-duration: 1.5s">⚖️</div>
      <p class="text-gray-300 text-sm">加载中...</p>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="text-center py-24">
      <div class="text-5xl mb-4">🤷</div>
      <h2 class="text-lg font-bold mb-1">找不到这条记录</h2>
      <p class="text-gray-400 text-sm mb-6">链接可能不对，或记录已过期</p>
      <router-link to="/" class="btn-primary text-sm">去评理 →</router-link>
    </div>

    <!-- Result -->
    <div v-else>
      <!-- ===== Hero verdict ===== -->
      <div class="text-center mb-6 animate-scale-in">
        <p class="text-[11px] text-gray-300 uppercase tracking-widest mb-3 font-medium">AI 裁定</p>

        <!-- Winner -->
        <div v-if="winner" class="mb-3">
          <div class="inline-block rounded-3xl px-8 py-4" style="background: linear-gradient(135deg, #fff5f0 0%, #ffeee5 100%)">
            <span class="text-3xl md:text-4xl font-black text-gradient">{{ winner }} 更有理</span>
          </div>
        </div>
        <!-- Draw -->
        <div v-else-if="isDraw" class="mb-3">
          <div class="inline-block bg-gray-50 rounded-3xl px-8 py-4">
            <span class="text-3xl md:text-4xl font-black text-gray-500">难分高下</span>
          </div>
        </div>

        <p class="text-gray-400 text-sm mt-2">{{ result.summary }}</p>
      </div>

      <!-- ===== Score battle ===== -->
      <div class="card p-5 mb-3 animate-slide-up" style="animation-delay: 0.15s">
        <div class="space-y-5">
          <div v-for="([name, score], idx) in sortedScores" :key="name">
            <div class="flex justify-between items-end mb-2">
              <div class="flex items-center gap-2">
                <span :class="['w-6 h-6 rounded-lg text-white text-[11px] font-bold flex items-center justify-center', BADGE_COLORS[idx] || 'bg-gray-400']">
                  {{ idx === 0 && !isDraw ? '👑' : idx + 1 }}
                </span>
                <span class="font-bold">{{ name }}</span>
              </div>
              <span class="text-3xl font-black tabular-nums text-gradient">
                {{ score }}<span class="text-base text-gray-300">%</span>
              </span>
            </div>
            <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div :class="['h-full rounded-full bg-gradient-to-r transition-all ease-out', SCORE_COLORS[idx] || 'from-gray-400 to-gray-300']"
                :style="{ width: animateScores ? score + '%' : '0%', transitionDuration: '1.2s', transitionDelay: (0.4 + idx * 0.2) + 's' }">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Verdict ===== -->
      <div class="card p-5 mb-3 animate-slide-up" style="animation-delay: 0.25s; border-left: 3px solid #ff6b35">
        <h3 class="text-[11px] text-gray-300 uppercase tracking-wider font-bold mb-2">裁定</h3>
        <p class="text-base leading-relaxed font-semibold text-gray-800">{{ result.verdict }}</p>
      </div>

      <!-- ===== Analysis ===== -->
      <div class="card p-5 mb-3 animate-slide-up" style="animation-delay: 0.35s">
        <h3 class="text-[11px] text-gray-300 uppercase tracking-wider font-bold mb-2">分析</h3>
        <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ result.analysis }}</p>
      </div>

      <!-- ===== Advice ===== -->
      <div class="card p-5 mb-5 animate-slide-up" style="animation-delay: 0.45s; background: linear-gradient(135deg, #f0fffe 0%, #f8fffe 100%); border: 1px solid rgba(78,205,196,0.15)">
        <h3 class="text-[11px] text-brand-teal uppercase tracking-wider font-bold mb-2">💡 建议</h3>
        <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ result.advice }}</p>
      </div>

      <!-- ===== Share CTA ===== -->
      <div class="card p-5 text-center mb-3 animate-slide-up" style="animation-delay: 0.55s">
        <p class="font-bold text-base mb-0.5">把结果甩给 TA 看</p>
        <p class="text-[11px] text-gray-300 mb-4">让 TA 心服口服 😏</p>
        <div class="flex gap-2.5 justify-center">
          <button @click="nativeShare" class="btn-primary text-sm !py-2.5 flex-1 max-w-[160px]">
            {{ copied ? '✅ 已复制' : '📤 分享结果' }}
          </button>
          <router-link to="/" class="btn-secondary text-sm !py-2.5 flex-1 max-w-[160px]">再来一次</router-link>
        </div>
      </div>

      <!-- ===== Original input ===== -->
      <div class="card overflow-hidden animate-slide-up" style="animation-delay: 0.6s">
        <button @click="showInput = !showInput"
          class="w-full p-4 text-left flex items-center justify-between text-[11px] text-gray-300 hover:text-gray-500 transition-colors">
          <span>📄 原始输入</span>
          <span class="transition-transform duration-200" :class="showInput ? 'rotate-180' : ''">▼</span>
        </button>
        <Transition name="collapse">
          <div v-if="showInput" class="px-5 pb-5 text-sm text-gray-500 leading-relaxed">
            <template v-if="inputData.mode === 'single'">
              <p class="whitespace-pre-line">{{ inputData.content }}</p>
            </template>
            <template v-else>
              <p class="font-medium text-gray-600 mb-3 text-xs">主题：{{ inputData.topic }}</p>
              <div v-for="p in inputData.perspectives" :key="p.name" class="mb-3">
                <p class="font-medium text-gray-600 text-xs">{{ p.name }}：</p>
                <p class="whitespace-pre-line pl-3 border-l-2 border-gray-100 mt-1 text-xs">{{ p.content }}</p>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
