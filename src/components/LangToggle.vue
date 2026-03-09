<template>
  <button @click="toggle" class="px-2 py-1 text-sm rounded border border-slate-300 hover:bg-slate-100 transition-colors">
    {{ locale === 'en' ? '中文' : 'EN' }}
  </button>
</template>

<script setup>
import { locale, setLocale } from '../lib/i18n.js'
function toggle() { setLocale(locale.value === 'en' ? 'zh' : 'en') }
</script>
