<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCase, getVotes, voteCase } from '../data/supabase.js'
import { t, locale, evidenceN } from '../lib/i18n.js'

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
  document.title = `${data.result?.summary || t('resultTitle')} · ${t('appTitle')}`
  votes.value = await getVotes(route.params.id)
  loading.value = false
})

const result = computed(() => caseData.value?.result || {})
const inputData = computed(() => caseData.value?.input || {})
const isPartialResult = computed(() => result.value.partial === true)

function looksLikeJsonFragment(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (value.startsWith('{') || value.startsWith('```')) return true
  return /"(summary|winner|verdict|analysis|advice|scores)"\s*:/.test(value)
}

function normalizeVisibleText(text) {
  return String(text || '').trim()
}

const normalizedScores = computed(() => {
  const entries = Object.entries(result.value.scores || {})
  if (entries.length === 0) return []

  const genericKeys = ['A', 'B', 'C', 'D', 'E', 'F']
  const isGeneric = entries.every(([name]) => genericKeys.includes(name))

  if (isGeneric && inputData.value.mode === 'multi' && Array.isArray(inputData.value.perspectives)) {
    return entries.map(([_, score], index) => [inputData.value.perspectives[index]?.name || `${locale.value === 'zh' ? '第' : 'Party '}${index + 1}${locale.value === 'zh' ? '方' : ''}`, score])
  }

  if (isGeneric && inputData.value.mode === 'single') {
    return entries.map(([_, score], index) => [index === 0 ? (locale.value === 'zh' ? '你' : 'You') : (locale.value === 'zh' ? '对方' : 'Other'), score])
  }

  return entries
})
const sortedScores = computed(() => normalizedScores.value.slice().sort((a, b) => b[1] - a[1]))
const hasScores = computed(() => sortedScores.value.length > 0)
const scoreSpread = computed(() => {
  if (sortedScores.value.length < 2) return sortedScores.value[0]?.[1] || 0
  return sortedScores.value[0][1] - sortedScores.value[1][1]
})
const showScoreBoard = computed(() => hasScores.value && scoreSpread.value >= 5)
const summaryText = computed(() => normalizeVisibleText(result.value.summary) || t('verdictGenerated'))
const verdictText = computed(() => {
  const text = normalizeVisibleText(result.value.verdict)
  return looksLikeJsonFragment(text) ? '' : text
})
const analysisText = computed(() => {
  const text = normalizeVisibleText(result.value.analysis)
  return looksLikeJsonFragment(text) ? '' : text
})
const adviceText = computed(() => {
  const text = normalizeVisibleText(result.value.advice)
  return looksLikeJsonFragment(text) ? '' : text
})
const evidencePoints = computed(() => {
  const text = analysisText.value || verdictText.value || summaryText.value
  if (!text) return []

  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？])/))
    .map((line) => line.trim())
    .filter((line) => line && !looksLikeJsonFragment(line) && !/^[{}[\]",:]+$/.test(line))
    .slice(0, 5)
})
const winner = computed(() => {
  if (result.value.winner && result.value.winner !== '难分高下') return result.value.winner
  if (sortedScores.value.length >= 2 && sortedScores.value[0][1] - sortedScores.value[1][1] >= 10) return sortedScores.value[0][0]
  return t('tooClose')
})
const leadParty = computed(() => sortedScores.value[0]?.[0] || (winner.value !== t('tooClose') ? winner.value : t('tooClose')))
const leadMargin = computed(() => {
  if (sortedScores.value.length < 2) return sortedScores.value[0]?.[1] || 0
  return sortedScores.value[0][1] - sortedScores.value[1][1]
})
const modeLabel = computed(() => inputData.value.mode === 'multi' ? t('resultModeMulti') : t('resultModeSingle'))
const createdAtLabel = computed(() => caseData.value?.created_at ? new Date(caseData.value.created_at).toLocaleString() : '')
const isServerSynced = computed(() => caseData.value?._serverSynced !== false)
const analysisDisplay = computed(() => {
  if (analysisText.value) return analysisText.value
  if (isPartialResult.value) return t('incompleteWarning')
  return t('noAnalysis')
})
const adviceDisplay = computed(() => adviceText.value || t('tryMoreDetail'))
const scoreSummary = computed(() => {
  if (!hasScores.value) return t('noScore')
  if (!showScoreBoard.value) return t('evenScore')
  return ''
})
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
  return `${t('appTitle')}：${summaryText.value}${lead ? `｜${lead[0]} ${lead[1]}%` : ''}`
}

async function nativeShare() {
  if (navigator.share) {
    try {
      await navigator.share({ title: t('appTitle'), text: shareText(), url: shareUrl() })
      return
    } catch {
      // ignore
    }
  }
  await copyLink()
}

function formatInputBlock(entry) {
  return entry?.trim?.() || t('notProvided')
}
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div v-if="loading" class="py-24 text-center">
        <div class="loading-mark mx-auto">{{ t('appLogo') }}</div>
        <p class="mt-5 text-sm text-ink-muted">{{ t('loading') }}</p>
      </div>

      <div v-else-if="notFound" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-ink">{{ t('notFound') }}</h2>
        <p class="mt-3 text-ink-secondary">{{ t('notFoundDesc') }}</p>
        <router-link to="/" class="btn-primary mt-6">{{ t('backHome') }}</router-link>
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div class="space-y-5">
          <section class="panel overflow-hidden">
            <div class="sheet-band">
              <div>
                <p class="sheet-kicker">{{ t('resultTitle') }}</p>
                <p class="mt-2 text-sm text-ink-secondary">{{ t('resultId') }} {{ caseNumber }}</p>
              </div>
              <div class="sheet-stamp">{{ isPartialResult ? t('resultIncomplete') : t('resultReady') }}</div>
            </div>

            <div class="p-6 md:p-8">
              <h1 class="font-serif text-3xl font-semibold tracking-tight text-ink md:text-4xl">{{ summaryText }}</h1>
              <p class="mt-4 text-lg leading-8 text-ink">{{ verdictText || t('resultViewHint') }}</p>

              <div v-if="isPartialResult || !isServerSynced" class="mt-5 space-y-3">
                <div v-if="isPartialResult" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {{ t('resultIncompleteHint') }}
                </div>
                <div v-if="!isServerSynced" class="rounded-2xl border border-surface-warm bg-surface px-4 py-3 text-sm leading-6 text-ink">
                  {{ t('resultLocalOnly') }}
                </div>
              </div>

              <div class="sheet-meta-grid mt-6">
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">{{ t('submitMode') }}</p>
                  <p class="sheet-meta-value">{{ modeLabel }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">{{ t('whoRight') }}</p>
                  <p class="sheet-meta-value">{{ winner }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">{{ t('currentLead') }}</p>
                  <p class="sheet-meta-value">{{ leadParty }}</p>
                </div>
                <div class="sheet-meta-card">
                  <p class="sheet-meta-label">{{ t('leadMargin') }}</p>
                  <p class="sheet-meta-value">{{ leadMargin }} {{ t('points') }}</p>
                </div>
              </div>

              <div class="mt-6 border-t border-dashed border-surface-warm pt-4 text-sm text-ink-muted">
                <span v-if="createdAtLabel">{{ t('generatedAt') }} {{ createdAtLabel }}</span>
              </div>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">{{ t('evidence') }}</p>
            <div v-if="evidencePoints.length" class="mt-4 grid gap-3">
              <div v-for="(item, index) in evidencePoints" :key="`${index}-${item}`" class="rounded-2xl border border-surface-warm bg-surface px-4 py-3">
                <p class="text-xs text-ink-muted">{{ evidenceN(index + 1) }}</p>
                <p class="mt-2 text-sm leading-7 text-ink">{{ item }}</p>
              </div>
            </div>
            <p v-else class="mt-4 text-sm leading-7 text-ink-secondary">{{ t('noEvidence') }}</p>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">{{ t('yourContent') }}</p>
            <div class="mt-4 flex items-center justify-between gap-3">
              <p class="text-sm text-ink-secondary">{{ t('yourContentHint') }}</p>
              <button class="text-sm text-ink-muted" @click="showInput = !showInput">{{ showInput ? t('collapse') : t('expand') }}</button>
            </div>

            <div v-if="showInput" class="mt-5 space-y-4">
              <template v-if="inputData.mode === 'single'">
                <div class="rounded-2xl bg-surface p-4 text-sm leading-7 text-ink whitespace-pre-line">
                  {{ formatInputBlock(inputData.content) }}
                </div>
              </template>
              <template v-else>
                <div class="rounded-2xl bg-surface p-4">
                  <p class="text-xs text-ink-muted">{{ t('disputeTopic') }}</p>
                  <p class="mt-2 text-sm leading-7 text-ink">{{ formatInputBlock(inputData.topic) }}</p>
                </div>
                <div v-for="entry in inputData.perspectives || []" :key="entry.name" class="rounded-2xl border border-surface-warm p-4">
                  <p class="text-sm font-semibold text-ink">{{ entry.name }}</p>
                  <p class="mt-2 text-sm leading-7 text-ink whitespace-pre-line">{{ formatInputBlock(entry.content) }}</p>
                </div>
              </template>
            </div>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">{{ t('scoreDistribution') }}</p>
            <div v-if="showScoreBoard" class="mt-5 space-y-5">
              <div v-for="([name, score], index) in sortedScores" :key="name">
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-sm font-semibold text-white">{{ index + 1 }}</span>
                    <span class="text-base font-medium text-ink">{{ name }}</span>
                  </div>
                  <span class="text-2xl font-semibold text-ink">{{ score }}%</span>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-surface-warm">
                  <div class="h-full rounded-full bg-brand-orange" :style="{ width: `${score}%` }"></div>
                </div>
              </div>
            </div>
            <p v-else class="mt-4 text-sm leading-7 text-ink-secondary">{{ scoreSummary }}</p>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">{{ t('detailedAnalysis') }}</p>
            <p class="mt-4 whitespace-pre-line text-sm leading-7 text-ink">{{ analysisDisplay }}</p>
          </section>

          <section class="panel p-6">
            <p class="sheet-kicker">{{ t('advice') }}</p>
            <p class="mt-4 whitespace-pre-line text-sm leading-7 text-ink">{{ adviceDisplay }}</p>
          </section>
        </div>

        <aside class="space-y-4">
          <div class="panel p-5">
            <p class="sheet-kicker">{{ t('shareTitle') }}</p>
            <p class="mt-2 text-sm leading-6 text-ink-secondary">{{ t('shareDesc') }}</p>
            <div class="mt-4 flex gap-3">
              <button class="btn-primary flex-1" @click="nativeShare">{{ copied ? t('copied') : t('shareResult') }}</button>
              <router-link to="/" class="btn-secondary flex-1">{{ t('judgeAgain') }}</router-link>
            </div>
          </div>

          <div class="panel p-5">
            <p class="sheet-kicker">{{ t('voteTitle') }}</p>
            <p class="mt-2 text-sm leading-6 text-ink-secondary">{{ t('voteDesc') }}</p>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <button class="vote-btn" :disabled="hasVoted || voting" @click="castVote('up')">👍 {{ t('voteUp') }} {{ votes.up }}</button>
              <button class="vote-btn" :disabled="hasVoted || voting" @click="castVote('down')">👎 {{ t('voteDown') }} {{ votes.down }}</button>
            </div>
            <p v-if="hasVoted" class="mt-3 text-xs text-ink-muted">{{ t('alreadyVoted') }}</p>
          </div>

          <div class="panel p-5">
            <p class="sheet-kicker">{{ t('communityTitle') }}</p>
            <p class="mt-2 text-sm leading-6 text-ink-secondary">{{ t('communityDesc') }}</p>
            <router-link to="/community" class="btn-secondary mt-4 w-full">{{ t('goToCommunity') }}</router-link>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
