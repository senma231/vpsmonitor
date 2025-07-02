<template>
  <div id="app">
    <!-- 主布局 - Akile风格 -->
    <div class="akile-layout">
      <!-- 顶部导航栏 -->
      <header class="akile-header">
        <div class="container">
          <div class="header-left">
            <div class="logo">
              <icon-desktop />
              <span class="logo-text">VPS Monitor</span>
            </div>
          </div>

          <nav class="header-nav">
            <a
              v-for="item in navItems"
              :key="item.path"
              :class="['nav-item', { active: currentRoute === item.path }]"
              @click="handleMenuClick(item.path)"
            >
              <component :is="item.icon" />
              {{ item.title }}
            </a>
          </nav>

          <div class="header-right">
            <div class="status-indicator">
              <span :class="['status-dot', connectionStatus]"></span>
              <span class="status-text">{{ connectionText }}</span>
            </div>
            <button
              class="refresh-btn"
              :class="{ loading: refreshing }"
              @click="handleRefresh"
            >
              <icon-refresh />
            </button>
          </div>
        </div>
      </header>

      <!-- 主内容区 -->
      <main class="akile-main">
        <div class="container">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>

      <!-- 底部信息 -->
      <footer class="akile-footer">
        <div class="container">
          <div class="footer-stats">
            <span class="stat-item">
              <strong>{{ totalServers }}</strong> 台服务器
            </span>
            <span class="stat-item">
              <strong>{{ onlineServers }}</strong> 在线
            </span>
            <span class="stat-item">
              最后更新: {{ formatTime(lastUpdateTime, 'HH:mm:ss') }}
            </span>
          </div>
          <div class="footer-info">
            <span>VPS Monitor v1.0.0</span>
            <span>•</span>
            <a href="https://github.com/senma231/vpsmonitor" target="_blank">
              GitHub
            </a>
            <span>•</span>
            <span>基于 Cloudflare 构建</span>
          </div>
        </div>
      </footer>
    </div>

    <!-- 全局加载遮罩 -->
    <a-spin
      v-if="globalLoading"
      :loading="globalLoading"
      class="global-loading"
    >
      <div class="loading-content">
        <icon-loading />
        <p>{{ loadingText }}</p>
      </div>
    </a-spin>

    <!-- 通知容器 -->
    <div id="notification-container"></div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  IconDesktop,
  IconDashboard,
  IconComputer,
  IconSettings,
  IconRefresh,
  IconLoading
} from '@arco-design/web-vue/es/icon'

export default {
  name: 'App',
  components: {
    IconDesktop,
    IconDashboard,
    IconComputer,
    IconSettings,
    IconRefresh,
    IconLoading
  },
  setup() {
    const router = useRouter()
    const route = useRoute()

    // 响应式数据
    const globalLoading = ref(false)
    const loadingText = ref('加载中...')
    const refreshing = ref(false)
    const lastUpdateTime = ref(new Date())
    const connectionStatus = ref('default')
    const connectionText = ref('未连接')

    // 导航菜单项
    const navItems = [
      {
        path: '/',
        title: '仪表板',
        icon: 'IconDashboard'
      },
      {
        path: '/servers',
        title: '服务器',
        icon: 'IconComputer'
      },
      {
        path: '/settings',
        title: '设置',
        icon: 'IconSettings'
      }
    ]

    // 计算属性
    const currentRoute = computed(() => route.path)
    const totalServers = ref(0)
    const onlineServers = ref(0)

    // 格式化时间函数
    const formatTime = (time, format = 'YYYY-MM-DD HH:mm:ss') => {
      if (!time) return '-'
      return new Date(time).toLocaleString('zh-CN')
    }

    // 方法
    const handleMenuClick = (path) => {
      if (path !== route.path) {
        router.push(path)
      }
    }

    const handleRefresh = async () => {
      refreshing.value = true
      try {
        // 模拟数据刷新
        await new Promise(resolve => setTimeout(resolve, 1000))
        lastUpdateTime.value = new Date()

        // 显示成功通知
        showNotification('数据已刷新', 'success')
      } catch (error) {
        console.error('Refresh failed:', error)
        showNotification('刷新失败', 'error')
      } finally {
        refreshing.value = false
      }
    }

    const showNotification = (message, type = 'info') => {
      // 使用Arco Design的通知组件
      const notification = window.$notification || console.log
      notification({
        title: type === 'error' ? '错误' : type === 'success' ? '成功' : '提示',
        content: message,
        type: type
      })
    }

    const initializeApp = async () => {
      globalLoading.value = true
      loadingText.value = '初始化应用...'

      try {
        // 模拟加载服务器数据
        loadingText.value = '加载服务器数据...'
        await new Promise(resolve => setTimeout(resolve, 1000))
        totalServers.value = 5
        onlineServers.value = 4

        // 模拟建立WebSocket连接
        loadingText.value = '建立实时连接...'
        await new Promise(resolve => setTimeout(resolve, 500))
        connectionStatus.value = 'success'
        connectionText.value = '已连接'

        lastUpdateTime.value = new Date()
      } catch (error) {
        console.error('App initialization failed:', error)
        showNotification('应用初始化失败', 'error')
      } finally {
        globalLoading.value = false
      }
    }

    // 生命周期
    onMounted(() => {
      initializeApp()
      
      // 定期刷新数据
      const refreshInterval = setInterval(() => {
        if (!refreshing.value) {
          handleRefresh()
        }
      }, 60000) // 每分钟刷新一次

      // 清理定时器
      onUnmounted(() => {
        clearInterval(refreshInterval)
      })
    })

    return {
      // 数据
      globalLoading,
      loadingText,
      refreshing,
      lastUpdateTime,
      currentRoute,
      totalServers,
      onlineServers,
      connectionStatus,
      connectionText,
      navItems,

      // 方法
      handleMenuClick,
      handleRefresh,
      formatTime
    }
  }
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
  padding: 0;
  height: 64px;
  line-height: 64px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 600;
  color: #1d2129;
}

.logo svg {
  margin-right: 8px;
  font-size: 24px;
  color: #165dff;
}

.nav-menu {
  flex: 1;
  margin: 0 40px;
  border-bottom: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.content {
  background: #f7f8fa;
  min-height: calc(100vh - 128px);
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.footer {
  background: #fff;
  border-top: 1px solid #e5e6eb;
  text-align: center;
  padding: 16px 24px;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  color: #86909c;
  font-size: 14px;
}

.global-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
}

.loading-content svg {
  font-size: 32px;
  color: #165dff;
  margin-bottom: 16px;
}

.loading-content p {
  color: #4e5969;
  margin: 0;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .nav-menu {
    margin: 0 20px;
  }
  
  .content-wrapper {
    padding: 16px;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
