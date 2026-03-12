<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-50 border-b border-brand-dark/10 bg-brand-dark">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <router-link to="/" class="flex min-w-0 items-center gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange font-serif text-sm font-semibold text-white">{{ t('appLogo') }}</span>
          <div class="min-w-0">
            <p class="truncate font-serif text-base font-semibold text-brand-cream">{{ t('appTitle') }}</p>
            <p class="truncate text-xs text-brand-cream/60">{{ t('appSubtitle') }}</p>
          </div>
        </router-link>
        <nav class="flex items-center gap-2 text-sm">
          <a href="https://openvibelab.com" target="_blank" rel="noreferrer" class="nav-link hidden lg:inline-flex">OpenVibeLab</a>
          <router-link to="/community" class="nav-link">{{ t('navCommunity') }}</router-link>
          <router-link to="/history" class="nav-link">{{ t('navHistory') }}</router-link>
          <LangToggle />
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <router-view />
    </main>

    <footer class="border-t border-surface-warm py-6 text-center text-sm text-ink-secondary">
      <a href="https://openvibelab.com" target="_blank" class="hover:text-brand-orange transition-colors">OpenVibeLab</a>
      · {{ t('footerOpenSource') }}
    </footer>
  </div>
</template>

<script setup>
import { t } from './lib/i18n.js'
import LangToggle from './components/LangToggle.vue'
</script>
