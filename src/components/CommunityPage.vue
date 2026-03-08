<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getRecentPublicCases, getVotes, voteCase } from '../data/supabase.js'

const loading = ref(true)
const cases = ref([])
const voteMap = reactive({})
const busyMap = reactive({})

onMounted(async () => {
  cases.value = await getRecentPublicCases(20)
  await Promise.all(cases.value.map(async (item) => {
    voteMap[item.id] = await getVotes(item.id)
  }))
  loading.value = false
})

function votedKey(id) {
  return `aj_vote_${id}`
}

function hasVoted(id) {
  try {
    return !!localStorage.getItem(votedKey(id))
  } catch {
    return false
  }
}

async function castVote(id, type) {
  if (busyMap[id] || hasVoted(id)) return
  busyMap[id] = true
  await voteCase(id, type)
  voteMap[id] = await getVotes(id)
  try {
    localStorage.setItem(votedKey(id), type)
  } catch {
    // ignore
  }
  busyMap[id] = false
}

function topParty(result) {
  if (!result?.scores) return null
  return Object.entries(result.scores).sort((a, b) => b[1] - a[1])[0] || null
}
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Community</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-brand-dark">社区记录</h1>
          <p class="mt-3 text-slate-600">这里展示最近公开保存的裁定，你可以直接查看详情并投票。</p>
        </div>
        <router-link to="/" class="btn-secondary">返回首页</router-link>
      </div>

      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">正在加载社区记录</div>

      <div v-else-if="cases.length === 0" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-brand-dark">还没有社区记录</h2>
        <p class="mt-3 text-slate-600">提交第一条案例后，这里就会出现。</p>
      </div>

      <div v-else class="grid gap-4">
        <article v-for="item in cases" :key="item.id" class="panel p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <router-link :to="`/result/${item.id}`" class="block">
                <h2 class="text-2xl font-semibold text-brand-dark hover:underline">{{ item.result?.summary || '评理记录' }}</h2>
              </router-link>
              <p class="mt-2 text-sm leading-7 text-slate-700">{{ item.result?.verdict || '暂无裁定摘要' }}</p>
              <p class="mt-3 text-sm leading-7 text-slate-600">{{ item.result?.analysis || '' }}</p>
              <p class="mt-4 text-xs text-slate-500">生成于 {{ item.created_at ? new Date(item.created_at).toLocaleString() : '' }}</p>
            </div>

            <div class="w-full shrink-0 rounded-2xl bg-slate-50 p-4 lg:w-72">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">概览</p>
              <div v-if="topParty(item.result)" class="mt-3">
                <p class="text-2xl font-semibold text-brand-dark">{{ topParty(item.result)[1] }}%</p>
                <p class="mt-1 text-sm text-slate-600">{{ topParty(item.result)[0] }} 当前占优</p>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <button class="vote-btn" :disabled="busyMap[item.id] || hasVoted(item.id)" @click="castVote(item.id, 'up')">👍 {{ voteMap[item.id]?.up || 0 }}</button>
                <button class="vote-btn" :disabled="busyMap[item.id] || hasVoted(item.id)" @click="castVote(item.id, 'down')">👎 {{ voteMap[item.id]?.down || 0 }}</button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
