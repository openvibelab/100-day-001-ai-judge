<template>
  <button @click="toggle" class="px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-colors" style="border-color: #e0d5c5; color: #faf7f2; background: transparent;" @mouseenter="$el.style.borderColor='#c85d24'; $el.style.color='#c85d24'" @mouseleave="$el.style.borderColor='rgba(250,247,242,0.3)'; $el.style.color='#faf7f2'">
    {{ locale === 'en' ? '中文' : 'EN' }}
  </button>
</template>

<script setup>
import { locale, setLocale } from '../lib/i18n.js'
function toggle() { setLocale(locale.value === 'en' ? 'zh' : 'en') }
</script>
