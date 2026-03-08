<script setup>
import { ref, onMounted } from 'vue'
import { getMyHistory } from '../data/supabase.js'

const cases = ref([])
const loading = ref(true)

onMounted(async () => {
  cases.value = await getMyHistory()
  loading.value = false
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function topScore(result) {
  if (!result?.scores) return null
  const sorted = Object.entries(result.scores).sort((a, b) => b[1] - a[1])
  return sorted[0] || null
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6 md:py-10">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold">我的评理记录</h1>
      <router-link to="/" class="text-sm text-brand-orange hover:underline">去评理 →</router-link>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">加载中...</div>

    <div v-else-if="cases.length === 0" class="text-center py-16">
      <div class="text-4xl mb-3">📋</div>
      <p class="text-gray-400 mb-4">还没有评理记录</p>
      <router-link to="/" class="btn-primary">去评理 →</router-link>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="c in cases"
        :key="c.id"
        :to="`/result/${c.id}`"
        class="card p-4 block hover:border-brand-orange/30 transition-all group"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm truncate mb-1 group-hover:text-brand-orange transition-colors">
              {{ c.result?.summary || '评理记录' }}
            </p>
            <p class="text-xs text-gray-400 truncate">{{ c.result?.verdict }}</p>
          </div>
          <div class="text-right shrink-0">
            <template v-if="topScore(c.result)">
              <p class="text-sm font-bold text-brand-orange">{{ topScore(c.result)[0] }}</p>
              <p class="text-xs text-gray-400">{{ topScore(c.result)[1] }}%</p>
            </template>
            <p class="text-xs text-gray-300 mt-1">{{ formatDate(c.created_at) }}</p>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
