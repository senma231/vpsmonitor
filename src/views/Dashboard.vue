<template>
  <div class="dashboard">
    <a-row :gutter="16">
      <a-col :span="24">
        <a-card title="VPS Monitor 仪表板" :bordered="false">
          <template #extra>
            <a-button type="primary" @click="refreshData">
              <icon-refresh />
              刷新
            </a-button>
          </template>
          
          <a-row :gutter="16">
            <a-col :span="6">
              <a-statistic
                title="总服务器数"
                :value="stats.totalServers"
                :value-style="{ color: '#1890ff' }"
              />
            </a-col>
            <a-col :span="6">
              <a-statistic
                title="在线服务器"
                :value="stats.onlineServers"
                :value-style="{ color: '#52c41a' }"
              />
            </a-col>
            <a-col :span="6">
              <a-statistic
                title="离线服务器"
                :value="stats.offlineServers"
                :value-style="{ color: '#ff4d4f' }"
              />
            </a-col>
            <a-col :span="6">
              <a-statistic
                title="告警数量"
                :value="stats.alerts"
                :value-style="{ color: '#fa8c16' }"
              />
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px;">
      <a-col :span="12">
        <a-card title="服务器状态" :bordered="false">
          <a-list :data="recentServers" :loading="loading">
            <template #item="{ item }">
              <a-list-item>
                <a-list-item-meta
                  :title="item.name"
                  :description="item.location"
                >
                  <template #avatar>
                    <a-badge
                      :status="item.status === 'online' ? 'success' : 'error'"
                      :text="item.status === 'online' ? '在线' : '离线'"
                    />
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <router-link :to="`/servers/${item.name}`">
                    <a-button type="text" size="small">
                      查看详情
                    </a-button>
                  </router-link>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
      
      <a-col :span="12">
        <a-card title="系统信息" :bordered="false">
          <a-descriptions :column="1" size="small">
            <a-descriptions-item label="系统版本">
              VPS Monitor v1.0.0
            </a-descriptions-item>
            <a-descriptions-item label="部署环境">
              Cloudflare Pages + Workers
            </a-descriptions-item>
            <a-descriptions-item label="数据库">
              Cloudflare D1
            </a-descriptions-item>
            <a-descriptions-item label="最后更新">
              {{ lastUpdate }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { IconRefresh } from '@arco-design/web-vue/es/icon'

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
    
    const refreshData = async () => {
      loading.value = true
      try {
        // 模拟数据加载
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        stats.value = {
          totalServers: 5,
          onlineServers: 4,
          offlineServers: 1,
          alerts: 2
        }
        
        recentServers.value = [
          {
            name: 'web-server-01',
            location: '香港',
            status: 'online'
          },
          {
            name: 'db-server-01',
            location: '新加坡',
            status: 'online'
          },
          {
            name: 'cache-server-01',
            location: '东京',
            status: 'offline'
          }
        ]
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        loading.value = false
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
      refreshData
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 24px;
}
</style>
