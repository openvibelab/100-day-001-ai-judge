<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
        <router-link to="/" class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark text-sm font-semibold text-white">判</span>
          <div>
            <p class="text-sm font-semibold text-brand-dark">AI 吵架评理</p>
            <p class="text-xs text-slate-500">把事情说清楚，再让系统裁</p>
          </div>
        </router-link>
        <nav class="flex items-center gap-2 text-sm">
          <router-link to="/community" class="nav-link">社区</router-link>
          <router-link to="/history" class="nav-link">历史</router-link>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <router-view />
    </main>

    <footer class="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
      <a href="https://openvibelab.com" target="_blank" class="hover:text-brand-dark transition-colors">OpenVibeLab</a>
      · 开源免费
    </footer>
  </div>
</template>
