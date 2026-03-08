<script setup>
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- header -->
    <header class="py-4 px-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-3xl mx-auto flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span class="text-2xl">⚖️</span>
          <span class="font-bold text-lg text-brand-dark">AI 吵架评理</span>
        </router-link>
        <a href="https://github.com/openvibelab/100-day-001-ai-judge" target="_blank"
          class="text-sm text-gray-400 hover:text-brand-orange transition-colors">
          GitHub ↗
        </a>
      </div>
    </header>

    <!-- main -->
    <main class="flex-1">
      <router-view />
    </main>

    <!-- footer -->
    <footer class="py-6 px-6 text-center text-xs text-gray-400 border-t border-gray-100">
      <a href="https://openvibelab.com" target="_blank" class="hover:text-brand-orange transition-colors">
        OpenVibeLab
      </a>
      · 100天 Vibe Coding · Day 1
    </footer>
  </div>
</template>
