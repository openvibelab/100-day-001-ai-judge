<script setup>
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="py-3 px-4 sticky top-0 z-50 bg-brand-cream/80 backdrop-blur-md">
      <div class="max-w-lg mx-auto flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-1.5 group">
          <span class="text-lg">⚖️</span>
          <span class="font-bold text-brand-dark text-sm group-hover:text-brand-orange transition-colors">AI 评理</span>
        </router-link>
        <router-link
          to="/history"
          class="text-xs text-gray-400 hover:text-brand-orange transition-colors px-3 py-1.5 rounded-full hover:bg-brand-orange/5"
        >
          📋 记录
        </router-link>
      </div>
    </header>

    <!-- Main -->
    <main class="flex-1">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="py-5 text-center text-[11px] text-gray-300/80">
      <a href="https://openvibelab.com" target="_blank" class="hover:text-brand-orange transition-colors">OpenVibeLab</a>
      · 开源免费
    </footer>
  </div>
</template>
