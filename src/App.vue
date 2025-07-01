<template>
  <div id="app">
    <a-layout class="layout">
      <!-- 顶部导航 -->
      <a-layout-header class="header">
        <div class="header-content">
          <div class="logo">
            <icon-monitor />
            <span>VPS Monitor</span>
          </div>
          
          <a-menu
            mode="horizontal"
            :selected-keys="[currentRoute]"
            class="nav-menu"
            @menu-item-click="handleMenuClick"
          >
            <a-menu-item key="/">
              <icon-dashboard />
              仪表板
            </a-menu-item>
            <a-menu-item key="/servers">
              <icon-computer />
              服务器
            </a-menu-item>
            <a-menu-item key="/settings">
              <icon-settings />
              设置
            </a-menu-item>
          </a-menu>

          <div class="header-actions">
            <!-- 连接状态 -->
            <a-badge :status="connectionStatus" :text="connectionText" />
            
            <!-- 刷新按钮 -->
            <a-button
              type="text"
              :loading="refreshing"
              @click="handleRefresh"
            >
              <icon-refresh />
            </a-button>
          </div>
        </div>
      </a-layout-header>

      <!-- 主内容区域 -->
      <a-layout-content class="content">
        <div class="content-wrapper">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </a-layout-content>

      <!-- 底部 -->
      <a-layout-footer class="footer">
        <div class="footer-content">
          <span>VPS Monitor © 2024</span>
          <span>
            在线服务器: {{ onlineServers }} / {{ totalServers }}
          </span>
          <span>
            最后更新: {{ lastUpdateTime }}
          </span>
        </div>
      </a-layout-footer>
    </a-layout>

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
import { useServerStore } from './stores/server'
import { useWebSocket } from './utils/websocket'
import { formatTime } from './utils/helpers'

export default {
  name: 'App',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const serverStore = useServerStore()
    
    // 响应式数据
    const globalLoading = ref(false)
    const loadingText = ref('加载中...')
    const refreshing = ref(false)
    const lastUpdateTime = ref(new Date())

    // WebSocket连接
    const { 
      connectionStatus, 
      connectionText, 
      connect, 
      disconnect 
    } = useWebSocket()

    // 计算属性
    const currentRoute = computed(() => route.path)
    const totalServers = computed(() => serverStore.servers.length)
    const onlineServers = computed(() => 
      serverStore.servers.filter(s => s.status === 'online').length
    )

    // 方法
    const handleMenuClick = (key) => {
      if (key !== route.path) {
        router.push(key)
      }
    }

    const handleRefresh = async () => {
      refreshing.value = true
      try {
        await serverStore.fetchServers()
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
        // 加载服务器数据
        loadingText.value = '加载服务器数据...'
        await serverStore.fetchServers()

        // 建立WebSocket连接
        loadingText.value = '建立实时连接...'
        await connect()

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
        disconnect()
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
