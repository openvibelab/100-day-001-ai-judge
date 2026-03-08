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

function topParty(result) {
  if (!result?.scores) return null
  return Object.entries(result.scores).sort((a, b) => b[1] - a[1])[0] || null
}
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-5 md:py-8">
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-lg font-bold text-brand-dark">我的记录</h1>
      <router-link to="/" class="text-sm text-brand-orange hover:underline font-medium">去评理 →</router-link>
    </div>

    <div v-if="loading" class="text-center py-20 text-gray-300 text-sm">加载中...</div>

    <div v-else-if="cases.length === 0" class="text-center py-20">
      <div class="text-4xl mb-3 opacity-50">📋</div>
      <p class="text-gray-400 text-sm mb-5">还没有评理记录</p>
      <router-link to="/" class="btn-primary text-sm">去评理 →</router-link>
    </div>

    <div v-else class="space-y-2.5">
      <router-link v-for="c in cases" :key="c.id" :to="`/result/${c.id}`"
        class="card-hover p-4 block group">
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate group-hover:text-brand-orange transition-colors">
              {{ c.result?.summary || '评理记录' }}
            </p>
            <p class="text-[11px] text-gray-300 truncate mt-0.5">{{ c.result?.verdict }}</p>
          </div>
          <div class="text-right shrink-0">
            <template v-if="topParty(c.result)">
              <p class="text-sm font-bold text-gradient">{{ topParty(c.result)[1] }}%</p>
              <p class="text-[10px] text-gray-300">{{ topParty(c.result)[0] }}</p>
            </template>
            <p class="text-[10px] text-gray-200 mt-0.5">{{ formatDate(c.created_at) }}</p>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
