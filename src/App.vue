<script setup>
import { ref } from 'vue'
import { hasUserApiKey, clearUserApiKey } from './data/ai.js'

const showSettings = ref(false)
const hasKey = ref(hasUserApiKey())

function handleClearKey() {
  clearUserApiKey()
  hasKey.value = false
  showSettings.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- header -->
    <header class="py-3 px-4 bg-white/80 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-100/80">
      <div class="max-w-2xl mx-auto flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span class="text-xl">⚖️</span>
          <span class="font-bold text-brand-dark">AI 吵架评理</span>
        </router-link>
        <div class="flex items-center gap-3">
          <router-link to="/history" class="text-xs text-gray-400 hover:text-brand-orange transition-colors">
            我的记录
          </router-link>
          <button
            v-if="hasKey"
            @click="showSettings = !showSettings"
            class="text-xs text-gray-400 hover:text-brand-orange transition-colors"
            title="API Key 设置"
          >
            🔑
          </button>
        </div>
      </div>
      <!-- Settings dropdown -->
      <div v-if="showSettings" class="max-w-2xl mx-auto mt-2 p-3 bg-gray-50 rounded-xl text-sm">
        <div class="flex items-center justify-between">
          <span class="text-gray-500">已配置自定义 API Key</span>
          <button @click="handleClearKey" class="text-red-400 hover:text-red-600 text-xs">清除 Key</button>
        </div>
      </div>
    </header>

    <!-- main -->
    <main class="flex-1">
      <router-view />
    </main>

    <!-- footer -->
    <footer class="py-4 px-4 text-center text-xs text-gray-300">
      <a href="https://openvibelab.com" target="_blank" class="hover:text-brand-orange transition-colors">
        OpenVibeLab
      </a>
      · 开源免费
    </footer>
  </div>
</template>
