<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCase, getVotes, voteCase } from '../data/supabase.js'

const route = useRoute()
const caseData = ref(null)
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)
const showInput = ref(true)
const votes = ref({ up: 0, down: 0 })
const voting = ref(false)

const votedKey = computed(() => `aj_vote_${route.params.id}`)

onMounted(async () => {
  const data = await getCase(route.params.id)
  if (!data) {
    notFound.value = true
    loading.value = false
    return
  }

  caseData.value = data
  document.title = `${data.result?.summary || '评理结果'} · AI 吵架评理`
  votes.value = await getVotes(route.params.id)
  loading.value = false
})

const result = computed(() => caseData.value?.result || {})
const inputData = computed(() => caseData.value?.input || {})
const normalizedScores = computed(() => {
  const entries = Object.entries(result.value.scores || {})
  if (entries.length === 0) return []

  const genericKeys = ['A', 'B', 'C', 'D', 'E', 'F']
  const isGeneric = entries.every(([name]) => genericKeys.includes(name))

  if (isGeneric && inputData.value.mode === 'multi' && Array.isArray(inputData.value.perspectives)) {
    return entries.map(([_, score], index) => [inputData.value.perspectives[index]?.name || `第${index + 1}方`, score])
  }

  if (isGeneric && inputData.value.mode === 'single') {
    return entries.map(([_, score], index) => [index === 0 ? '你' : '对方', score])
  }

  return entries
})
const sortedScores = computed(() => normalizedScores.value.slice().sort((a, b) => b[1] - a[1]))
const evidencePoints = computed(() => {
  const text = result.value.analysis || ''
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？])/))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
})
const winner = computed(() => {
  if (result.value.winner && result.value.winner !== '难分高下') return result.value.winner
  if (sortedScores.value.length >= 2 && sortedScores.value[0][1] - sortedScores.value[1][1] >= 10) return sortedScores.value[0][0]
  return '难分高下'
})
const leadParty = computed(() => sortedScores.value[0]?.[0] || '待定')
const leadMargin = computed(() => {
  if (sortedScores.value.length < 2) return sortedScores.value[0]?.[1] || 0
  return sortedScores.value[0][1] - sortedScores.value[1][1]
})
const modeLabel = computed(() => inputData.value.mode === 'multi' ? '多方' : '单方')
const createdAtLabel = computed(() => caseData.value?.created_at ? new Date(caseData.value.created_at).toLocaleString() : '')
const isServerSynced = computed(() => caseData.value?._serverSynced !== false)
const caseNumber = computed(() => {
  const rawId = String(route.params.id || '')
  const slug = rawId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'PENDING'
  const date = caseData.value?.created_at ? new Date(caseData.value.created_at) : new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `AJ-${y}${m}${d}-${slug}`
})
const hasVoted = computed(() => {
  try {
    return !!localStorage.getItem(votedKey.value)
  } catch {
    return false
  }
})

function shareUrl() {
  return window.location.href
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl())
  } catch {
    const el = document.createElement('input')
    el.value = shareUrl()
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

async function castVote(type) {
  if (hasVoted.value || voting.value) return
  voting.value = true
  await voteCase(route.params.id, type)
  votes.value = await getVotes(route.params.id)
  try {
    localStorage.setItem(votedKey.value, type)
  } catch {
    // ignore
  }
  voting.value = false
}

function shareText() {
  const lead = sortedScores.value[0]
  return `AI评理：${result.value.summary || '已出结果'}｜${lead ? `${lead[0]} ${lead[1]}%` : ''}`
}

async function nativeShare() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'AI 吵架评理', text: shareText(), url: shareUrl() })
      return
    } catch {
      // ignore
    }
  }
  await copyLink()
}

function formatInputBlock(entry) {
  return entry?.trim?.() || '未提供'
}
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div v-if="loading" class="py-24 text-center">
        <div class="loading-mark mx-auto">判</div>
        <p class="mt-5 text-sm text-slate-500">正在加载结果</p>
      </div>

      <div v-else-if="notFound" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-brand-dark">找不到这条记录</h2>
        <p class="mt-3 text-slate-600">链接可能有误，或者数据没有成功保存。</p>
        <router-link to="/" class="btn-primary mt-6">返回首页</router-link>
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div class="space-y-5">
          <section class="panel overflow-hidden">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">评理结果</p>
                <p class="mt-2 text-sm text-slate-600">编号 {{ caseNumber }}</p>
              </div>
              <div class="sheet-stamp">已出结果</div>
            </div>

            <div class="p-6 md:p-8">
              <h1 class="text-3xl font-semibold tracking-tight text-brand-dark md:text-4xl">{{ result.summary || '评理完成' }}</h1>
              <p class="mt-4 text-lg leading-8 text-slate-700">{{ result.verdict }}</p>

              <div class="sheet-meta-grid mt-6">
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">提交方式</p>
                  <p class="sheet-meta-value">{{ modeLabel }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">谁更有理</p>
                  <p class="sheet-meta-value">{{ winner }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">当前占优</p>
                  <p class="sheet-meta-value">{{ leadParty }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">领先幅度</p>
                  <p class="sheet-meta-value">{{ leadMargin }} 分</p>
                </div>
              </div>

              <div class="mt-6 border-t border-dashed border-slate-200 pt-4 text-sm text-slate-500">
                <span v-if="createdAtLabel">生成于 {{ createdAtLabel }}</span>
              </div>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">判断依据</p>
            <div class="mt-4 grid gap-3">
              <div v-for="(item, index) in evidencePoints" :key="`${index}-${item}`" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="text-xs text-slate-500">第 {{ index + 1 }} 点</p>
                <p class="mt-2 text-sm leading-7 text-slate-700">{{ item }}</p>
              </div>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">你提交的内容</p>
            <div class="mt-4 flex items-center justify-between gap-3">
              <p class="text-sm text-slate-600">确认一下 AI 看到的是不是你写的那些。</p>
              <button class="text-sm text-slate-500" @click="showInput = !showInput">{{ showInput ? '收起' : '展开' }}</button>
            </div>

            <div v-if="showInput" class="mt-5 space-y-4">
              <template v-if="inputData.mode === 'single'">
                <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-line">
                  {{ formatInputBlock(inputData.content) }}
                </div>
              </template>
              <template v-else>
                <div class="rounded-2xl bg-slate-50 p-4">
                  <p class="text-xs text-slate-500">争议主题</p>
                  <p class="mt-2 text-sm leading-7 text-slate-700">{{ formatInputBlock(inputData.topic) }}</p>
                </div>
                <div v-for="entry in inputData.perspectives || []" :key="entry.name" class="rounded-2xl border border-slate-200 p-4">
                  <p class="text-sm font-semibold text-brand-dark">{{ entry.name }}</p>
                  <p class="mt-2 text-sm leading-7 text-slate-700 whitespace-pre-line">{{ formatInputBlock(entry.content) }}</p>
                </div>
              </template>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">各方得分</p>
            <div class="mt-5 space-y-5">
              <div v-for="([name, score], index) in sortedScores" :key="name">
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-sm font-semibold text-white">{{ index + 1 }}</span>
                    <span class="text-base font-medium text-slate-800">{{ name }}</span>
                  </div>
                  <span class="text-2xl font-semibold text-brand-dark">{{ score }}%</span>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div class="h-full rounded-full bg-brand-orange" :style="{ width: `${score}%` }"></div>
                </div>
              </div>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">详细分析</p>
            <p class="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{{ result.analysis }}</p>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">给你们的建议</p>
            <p class="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{{ result.advice }}</p>
          </section>
        </div>

        <aside class="space-y-4">
          <div class="panel p-5">
            <p class="sheet-kicker">发给对方看</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">复制链接发过去，让对方也看看 AI 怎么说。</p>
            <div class="mt-4 flex gap-3">
              <button class="btn-primary flex-1" @click="nativeShare">{{ copied ? '已复制' : '分享结果' }}</button>
              <router-link to="/" class="btn-secondary flex-1">再评一次</router-link>
            </div>
          </div>

          <div class="panel p-5">
            <p class="sheet-kicker">你觉得判得怎样？</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">点赞或点踩，每条只能投一次。</p>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <button class="vote-btn" :disabled="hasVoted || voting" @click="castVote('up')">👍 有帮助 {{ votes.up }}</button>
              <button class="vote-btn" :disabled="hasVoted || voting" @click="castVote('down')">👎 不认可 {{ votes.down }}</button>
            </div>
            <p v-if="hasVoted" class="mt-3 text-xs text-slate-500">你已经投过票了。</p>
          </div>

          <div class="panel p-5">
            <p class="sheet-kicker">看看别人的</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">去社区看看别人都在吵什么，AI 又是怎么判的。</p>
            <router-link to="/community" class="btn-secondary mt-4 w-full">去社区看看</router-link>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
