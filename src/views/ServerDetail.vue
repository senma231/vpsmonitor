<template>
  <div class="server-detail">
    <a-card :title="`服务器详情 - ${serverName}`" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="refreshData">
            <icon-refresh />
            刷新
          </a-button>
          <router-link to="/servers">
            <a-button>
              <icon-left />
              返回列表
            </a-button>
          </router-link>
        </a-space>
      </template>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-card title="基本信息" size="small">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="服务器名称">
                {{ serverInfo.name }}
              </a-descriptions-item>
              <a-descriptions-item label="IP地址">
                {{ serverInfo.ip }}
              </a-descriptions-item>
              <a-descriptions-item label="位置">
                {{ serverInfo.location }}
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-badge
                  :status="serverInfo.status === 'online' ? 'success' : 'error'"
                  :text="serverInfo.status === 'online' ? '在线' : '离线'"
                />
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
        
        <a-col :span="16">
          <a-card title="实时监控" size="small">
            <a-row :gutter="16">
              <a-col :span="6">
                <a-statistic
                  title="CPU使用率"
                  :value="monitorData.cpu"
                  suffix="%"
                  :value-style="{ color: getCpuColor(monitorData.cpu) }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="内存使用率"
                  :value="monitorData.memory"
                  suffix="%"
                  :value-style="{ color: getMemoryColor(monitorData.memory) }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="磁盘使用率"
                  :value="monitorData.disk"
                  suffix="%"
                  :value-style="{ color: getDiskColor(monitorData.disk) }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="网络延迟"
                  :value="monitorData.ping"
                  suffix="ms"
                />
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px;">
        <a-col :span="24">
          <SpeedTest :server-name="serverName" />
        </a-col>
      </a-row>
    </a-card>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { IconRefresh, IconLeft } from '@arco-design/web-vue/es/icon'
import SpeedTest from '@/components/SpeedTest.vue'
import { apiClient } from '@/utils/api'

export default {
  name: 'ServerDetail',
  components: {
    IconRefresh,
    IconLeft,
    SpeedTest
  },
  setup() {
    const route = useRoute()
    const serverName = computed(() => route.params.name)
    
    const serverInfo = ref({
      name: '',
      ip: '',
      location: '',
      status: 'unknown'
    })
    
    const monitorData = ref({
      cpu: 0,
      memory: 0,
      disk: 0,
      ping: 0
    })
    
    const getCpuColor = (value) => {
      if (value > 80) return '#ff4d4f'
      if (value > 60) return '#fa8c16'
      return '#52c41a'
    }
    
    const getMemoryColor = (value) => {
      if (value > 85) return '#ff4d4f'
      if (value > 70) return '#fa8c16'
      return '#52c41a'
    }
    
    const getDiskColor = (value) => {
      if (value > 90) return '#ff4d4f'
      if (value > 75) return '#fa8c16'
      return '#52c41a'
    }
    
    const refreshData = async () => {
      try {
        // 获取服务器信息
        const server = await apiClient.getServer(serverName.value)

        serverInfo.value = {
          name: server.name,
          ip: server.ip_address,
          location: server.location,
          status: server.status
        }
        
        // 获取最新监控数据
        try {
          const latestData = await apiClient.getServerData(serverName.value, 1)
          if (latestData && latestData.length > 0) {
            const latest = latestData[0]
            monitorData.value = {
              cpu: Math.round(latest.cpu_usage || 0),
              memory: Math.round(latest.memory_usage || 0),
              disk: Math.round(latest.disk_usage || 0),
              ping: Math.round(latest.network_latency || 0)
            }
          } else {
            // 如果没有监控数据，显示0
            monitorData.value = {
              cpu: 0,
              memory: 0,
              disk: 0,
              ping: 0
            }
          }
        } catch (dataError) {
          console.error('Failed to load monitor data:', dataError)
          // 保持默认值
        }
      } catch (error) {
        console.error('Failed to load server data:', error)
      }
    }
    
    onMounted(() => {
      refreshData()
    })
    
    return {
      serverName,
      serverInfo,
      monitorData,
      getCpuColor,
      getMemoryColor,
      getDiskColor,
      refreshData
    }
  }
}
</script>

<style scoped>
.server-detail {
  padding: 24px;
}
</style>
