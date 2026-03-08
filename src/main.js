import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const routes = [
  { path: '/', name: 'Home', component: () => import('./components/InputPage.vue') },
  { path: '/result/:id', name: 'Result', component: () => import('./components/ResultPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

createApp(App).use(router).mount('#app')
