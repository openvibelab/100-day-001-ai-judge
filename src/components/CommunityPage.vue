<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getRecentPublicCases, getVotes, voteCase } from '../data/supabase.js'

const loading = ref(true)
const cases = ref([])
const voteMap = reactive({})
const busyMap = reactive({})
const sortBy = ref('latest')
const modeFilter = ref('all')

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

function badgeText(item) {
  if (item.input?.topic) return item.input.topic
  return item.mode === 'multi' ? '多方争议' : '单方描述'
}

function scoreOf(item) {
  const vote = voteMap[item.id]
  return (vote?.up || 0) - (vote?.down || 0)
}

const visibleCases = computed(() =>
  [...cases.value]
    .filter((item) => modeFilter.value === 'all' || item.mode === modeFilter.value)
    .sort((a, b) => {
      if (sortBy.value === 'hot') return scoreOf(b) - scoreOf(a)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
)
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Community</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-brand-dark">社区记录</h1>
          <p class="mt-3 text-slate-600">这里不是单纯存档，而是最近大家最常遇到的争议集合。</p>
        </div>
        <router-link to="/" class="btn-secondary">返回首页</router-link>
      </div>

      <div v-if="loading" class="py-24 text-center text-sm text-slate-500">正在加载社区记录</div>

      <div v-else-if="cases.length === 0" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-brand-dark">还没有社区记录</h2>
        <p class="mt-3 text-slate-600">提交第一条案例后，这里就会出现。</p>
      </div>

      <div v-else>
        <div class="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap gap-2">
            <button :class="['mode-pill', sortBy === 'latest' ? 'mode-pill--active' : '']" @click="sortBy = 'latest'">最新</button>
            <button :class="['mode-pill', sortBy === 'hot' ? 'mode-pill--active' : '']" @click="sortBy = 'hot'">最热</button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button :class="['mode-pill', modeFilter === 'all' ? 'mode-pill--active' : '']" @click="modeFilter = 'all'">全部</button>
            <button :class="['mode-pill', modeFilter === 'single' ? 'mode-pill--active' : '']" @click="modeFilter = 'single'">单方</button>
            <button :class="['mode-pill', modeFilter === 'multi' ? 'mode-pill--active' : '']" @click="modeFilter = 'multi'">多方</button>
          </div>
        </div>

        <div class="grid gap-4">
          <article v-for="item in visibleCases" :key="item.id" class="panel p-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex-1">
                <div class="mb-3 flex flex-wrap items-center gap-2">
                  <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{{ badgeText(item) }}</span>
                  <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{{ item.mode === 'multi' ? '多方' : '单方' }}</span>
                </div>
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
                <p class="mt-3 text-xs text-slate-500">热度分 {{ scoreOf(item) }}</p>
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
  </div>
</template>
