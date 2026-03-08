<script setup>
import { onMounted, ref } from 'vue'
import { getMyHistory } from '../data/supabase.js'

const cases = ref([])
const loading = ref(true)

onMounted(async () => {
  cases.value = await getMyHistory()
  loading.value = false
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}

function topParty(result) {
  if (!result?.scores) return null
  return Object.entries(result.scores).sort((a, b) => b[1] - a[1])[0] || null
}
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Personal Archive</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-brand-dark">我的历史记录</h1>
        </div>
        <router-link to="/" class="btn-secondary">返回首页</router-link>
      </div>

      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">正在加载</div>

      <div v-else-if="cases.length === 0" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-brand-dark">还没有记录</h2>
        <p class="mt-3 text-slate-600">你每次提交后的裁定页，都会自动保存在这里。</p>
        <router-link to="/" class="btn-primary mt-6">去评理</router-link>
      </div>

      <div v-else class="space-y-4">
        <router-link
          v-for="item in cases"
          :key="item.id"
          :to="`/result/${item.id}`"
          class="panel block p-5 transition-transform hover:-translate-y-0.5"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-xl font-semibold text-brand-dark">{{ item.result?.summary || '评理记录' }}</p>
              <p class="mt-2 text-sm leading-7 text-slate-700">{{ item.result?.verdict || '暂无裁定摘要' }}</p>
              <p class="mt-3 text-sm leading-7 text-slate-600">{{ item.result?.analysis || '' }}</p>
            </div>
            <div class="w-full shrink-0 rounded-2xl bg-slate-50 p-4 md:w-56">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">顶部结论</p>
              <div v-if="topParty(item.result)" class="mt-3">
                <p class="text-2xl font-semibold text-brand-dark">{{ topParty(item.result)[1] }}%</p>
                <p class="mt-1 text-sm text-slate-600">{{ topParty(item.result)[0] }}</p>
              </div>
              <p class="mt-4 text-xs text-slate-500">{{ formatDate(item.created_at) }}</p>
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
