<template>
  <div class="dashboard">
    <!-- 统计概览 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalServers }}</div>
        <div class="stat-label">总服务器数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--akile-success)">{{ stats.onlineServers }}</div>
        <div class="stat-label">在线服务器</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--akile-error)">{{ stats.offlineServers }}</div>
        <div class="stat-label">离线服务器</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--akile-warning)">{{ stats.alerts }}</div>
        <div class="stat-label">告警数量</div>
      </div>
    </div>

    <!-- 服务器列表 -->
    <div class="akile-card">
      <div class="akile-card-header">
        <h3 class="akile-card-title">服务器状态</h3>
        <button class="refresh-btn" @click="refreshData" :class="{ loading }">
          <icon-refresh />
        </button>
      </div>
      <div class="akile-card-body">
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
        <div v-else-if="recentServers.length === 0" class="empty-state">
          <p>暂无服务器数据</p>
          <router-link to="/servers">
            <button class="btn-primary">添加服务器</button>
          </router-link>
        </div>
        <div v-else class="server-list">
          <div
            v-for="server in recentServers"
            :key="server.name"
            class="server-item"
            @click="$router.push(`/servers/${server.name}`)"
          >
            <div class="server-header">
              <div class="server-name">{{ server.name }}</div>
              <div class="server-status">
                <span :class="['status-dot', getStatusClass(server.status)]"></span>
                <span>{{ getStatusText(server.status) }}</span>
              </div>
            </div>
            <div class="server-info">
              <span class="server-location">{{ server.location }}</span>
              <span class="server-uptime">运行时间: {{ server.uptime || '未知' }}</span>
            </div>
            <div class="server-metrics">
              <div class="metric">
                <div class="metric-value">{{ server.cpu || 0 }}%</div>
                <div class="metric-label">CPU</div>
              </div>
              <div class="metric">
                <div class="metric-value">{{ server.memory || 0 }}%</div>
                <div class="metric-label">内存</div>
              </div>
              <div class="metric">
                <div class="metric-value">{{ server.disk || 0 }}%</div>
                <div class="metric-label">磁盘</div>
              </div>
              <div class="metric">
                <div class="metric-value">{{ server.ping || 0 }}ms</div>
                <div class="metric-label">延迟</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="akile-card">
      <div class="akile-card-header">
        <h3 class="akile-card-title">系统信息</h3>
      </div>
      <div class="akile-card-body">
        <div class="system-info">
          <div class="info-item">
            <span class="info-label">系统版本:</span>
            <span class="info-value">VPS Monitor v1.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-label">部署环境:</span>
            <span class="info-value">Cloudflare Pages + Workers</span>
          </div>
          <div class="info-item">
            <span class="info-label">数据库:</span>
            <span class="info-value">Cloudflare D1</span>
          </div>
          <div class="info-item">
            <span class="info-label">最后更新:</span>
            <span class="info-value">{{ lastUpdate }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { IconRefresh } from '@arco-design/web-vue/es/icon'
import { apiClient } from '@/utils/api'

export default {
  name: 'Dashboard',
  components: {
    IconRefresh
  },
  setup() {
    const loading = ref(false)
    const stats = ref({
      totalServers: 0,
      onlineServers: 0,
      offlineServers: 0,
      alerts: 0
    })
    
    const recentServers = ref([])
    
    const lastUpdate = computed(() => {
      return new Date().toLocaleString('zh-CN')
    })
    
    const getStatusClass = (status) => {
      switch (status) {
        case 'online': return 'success'
        case 'offline': return 'error'
        case 'error': return 'error'
        default: return ''
      }
    }

    const getStatusText = (status) => {
      switch (status) {
        case 'online': return '在线'
        case 'offline': return '离线'
        case 'error': return '错误'
        default: return '未知'
      }
    }

    const refreshData = async () => {
      loading.value = true
      try {
        // 从API获取真实数据
        const servers = await apiClient.getServers()

        // 计算统计信息
        const totalServers = servers.length
        const onlineServers = servers.filter(s => s.status === 'online').length
        const offlineServers = totalServers - onlineServers

        stats.value = {
          totalServers,
          onlineServers,
          offlineServers,
          alerts: 0 // 暂时设为0，后续可以从API获取
        }

        // 设置服务器列表（最多显示5个）并获取监控数据
        const serverList = servers.slice(0, 5)
        const serversWithData = await Promise.all(
          serverList.map(async (server) => {
            try {
              // 获取最新监控数据
              const monitorData = await apiClient.getServerData(server.name, 1)
              const latestData = monitorData && monitorData.length > 0 ? monitorData[0] : null

              // 获取最新连通性测试数据（用于延迟）
              let latestPing = 0
              try {
                const connectivityData = await apiClient.getConnectivityTests(server.name, 1)
                if (connectivityData && connectivityData.length > 0) {
                  // 找到最近的有延迟数据的测试（不管成功失败）
                  const testsWithLatency = connectivityData.filter(test =>
                    test.latency && test.latency > 0
                  )
                  if (testsWithLatency.length > 0) {
                    // 使用最低延迟
                    const minLatency = Math.min(...testsWithLatency.map(test => test.latency))
                    latestPing = Math.round(minLatency)
                  }
                }
              } catch (pingError) {
                console.warn(`Failed to get ping data for ${server.name}:`, pingError)
              }

              return {
                name: server.name,
                location: server.location || '未知',
                status: server.status || 'unknown',
                uptime: latestData && latestData.uptime ? formatUptime(latestData.uptime) : '未知',
                cpu: latestData ? Math.round(latestData.cpu_usage || 0) : 0,
                memory: latestData ? Math.round(latestData.memory_usage || 0) : 0,
                disk: latestData ? Math.round(latestData.disk_usage || 0) : 0,
                ping: latestPing
              }
            } catch (error) {
              console.error(`Failed to get monitor data for ${server.name}:`, error)
              return {
                name: server.name,
                location: server.location || '未知',
                status: server.status || 'unknown',
                uptime: '未知',
                cpu: 0,
                memory: 0,
                disk: 0,
                ping: 0
              }
            }
          })
        )

        recentServers.value = serversWithData

        console.log('Dashboard data loaded:', { stats: stats.value, servers: recentServers.value })

      } catch (error) {
        console.error('Failed to load dashboard data:', error)

        // 如果API失败，显示空状态
        stats.value = {
          totalServers: 0,
          onlineServers: 0,
          offlineServers: 0,
          alerts: 0
        }
        recentServers.value = []
      } finally {
        loading.value = false
      }
    }
    
    // 格式化运行时间
    const formatUptime = (seconds) => {
      if (!seconds || seconds <= 0) return '未知'

      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)

      if (days > 0) {
        return `${days}天${hours}小时`
      } else if (hours > 0) {
        return `${hours}小时${minutes}分钟`
      } else {
        return `${minutes}分钟`
      }
    }

    onMounted(() => {
      refreshData()
    })

    return {
      loading,
      stats,
      recentServers,
      lastUpdate,
      refreshData,
      getStatusClass,
      getStatusText
    }
  }
}
</script>

<style scoped>
.dashboard {
  /* 使用全局样式 */
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--akile-text-secondary);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--akile-text-secondary);
}

.btn-primary {
  background: var(--akile-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: var(--akile-radius);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #40a9ff;
}

.server-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--akile-text-secondary);
}

.system-info {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  color: var(--akile-text-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--akile-text);
}
</style>
