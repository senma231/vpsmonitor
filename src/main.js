/**
 * VPS Monitor 前端主入口文件
 * 基于Vue 3 + Vite，适配Cloudflare Pages部署
 */

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
import '@arco-design/web-vue/dist/arco.css'

import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import ServerList from './views/ServerList.vue'
import ServerDetail from './views/ServerDetail.vue'
import Settings from './views/Settings.vue'

// 路由配置
const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板' }
  },
  {
    path: '/servers',
    name: 'ServerList',
    component: ServerList,
    meta: { title: '服务器列表' }
  },
  {
    path: '/servers/:name',
    name: 'ServerDetail',
    component: ServerDetail,
    meta: { title: '服务器详情' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { title: '设置' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - VPS Monitor` : 'VPS Monitor'
  next()
})

// 创建应用实例
const app = createApp(App)

// 使用插件
app.use(createPinia())
app.use(router)
app.use(ArcoVue)
app.use(ArcoVueIcon)

// 全局配置
app.config.globalProperties.$apiUrl = import.meta.env.VITE_API_URL || 'https://api.your-domain.workers.dev'
app.config.globalProperties.$wsUrl = import.meta.env.VITE_WS_URL || 'wss://api.your-domain.workers.dev/ws'

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err, info)
  // 这里可以集成错误报告服务
}

// 挂载应用
app.mount('#app')

// 开发环境调试
if (import.meta.env.DEV) {
  console.log('VPS Monitor started in development mode')
  console.log('API URL:', app.config.globalProperties.$apiUrl)
  console.log('WebSocket URL:', app.config.globalProperties.$wsUrl)
}
