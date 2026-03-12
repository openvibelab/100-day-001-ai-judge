<script setup>
import { computed, onMounted, ref } from 'vue'
import { getMyHistory, getVotes } from '../data/supabase.js'
import { t } from '../lib/i18n.js'

const cases = ref([])
const loading = ref(true)
const modeFilter = ref('all')
const voteMap = ref({})

onMounted(async () => {
  cases.value = await getMyHistory()
  const entries = {}
  await Promise.all(cases.value.map(async (item) => {
    entries[item.id] = await getVotes(item.id)
  }))
  voteMap.value = entries
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

const visibleCases = computed(() => cases.value.filter((item) => modeFilter.value === 'all' || item.mode === modeFilter.value))
</script>

<template>
  <div class="page-surface min-h-full">
    <div class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight font-serif text-ink">{{ t('historyTitle') }}</h1>
        </div>
        <router-link to="/" class="btn-secondary">{{ t('backHome') }}</router-link>
      </div>

      <div v-if="loading" class="py-24 text-center text-sm text-ink-muted">{{ t('historyLoading') }}</div>

      <div v-else-if="cases.length === 0" class="panel py-20 text-center">
        <h2 class="text-2xl font-semibold text-ink">{{ t('historyEmpty') }}</h2>
        <p class="mt-3 text-ink-secondary">{{ t('historyEmptyDesc') }}</p>
        <router-link to="/" class="btn-primary mt-6">{{ t('goJudge') }}</router-link>
      </div>

      <div v-else>
        <div class="mb-5 flex flex-wrap gap-2">
          <button :class="['mode-pill', modeFilter === 'all' ? 'mode-pill--active' : '']" @click="modeFilter = 'all'">{{ t('filterAll') }}</button>
          <button :class="['mode-pill', modeFilter === 'single' ? 'mode-pill--active' : '']" @click="modeFilter = 'single'">{{ t('filterSingle') }}</button>
          <button :class="['mode-pill', modeFilter === 'multi' ? 'mode-pill--active' : '']" @click="modeFilter = 'multi'">{{ t('filterMulti') }}</button>
        </div>

        <div class="space-y-4">
          <router-link
            v-for="item in visibleCases"
            :key="item.id"
            :to="`/result/${item.id}`"
            class="panel block p-5 transition-transform hover:-translate-y-0.5"
          >
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0 flex-1">
                <div class="mb-3 flex flex-wrap items-center gap-2">
                  <span class="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-secondary">{{ item.mode === 'multi' ? t('filterMulti') : t('filterSingle') }}</span>
                  <span class="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-secondary">👍 {{ voteMap[item.id]?.up || 0 }} / 👎 {{ voteMap[item.id]?.down || 0 }}</span>
                </div>
                <p class="text-xl font-semibold text-ink">{{ item.result?.summary || t('caseRecord') }}</p>
                <p class="mt-2 text-sm leading-7 text-ink">{{ item.result?.verdict || t('noSummary') }}</p>
                <p class="mt-3 text-sm leading-7 text-ink-secondary">{{ item.result?.analysis || '' }}</p>
              </div>
              <div class="w-full shrink-0 rounded-2xl bg-surface p-4 md:w-56">
                <p class="text-xs text-ink-muted">{{ t('topScore') }}</p>
                <div v-if="topParty(item.result)" class="mt-3">
                  <p class="text-2xl font-semibold text-ink">{{ topParty(item.result)[1] }}%</p>
                  <p class="mt-1 text-sm text-ink-secondary">{{ topParty(item.result)[0] }}</p>
                </div>
                <p class="mt-4 text-xs text-ink-muted">{{ formatDate(item.created_at) }}</p>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
