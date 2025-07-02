<template>
  <div class="server-list">
    <a-card title="服务器列表" :bordered="false">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="showAddModal = true">
            <icon-plus />
            添加服务器
          </a-button>
          <a-button @click="refreshList">
            <icon-refresh />
            刷新
          </a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data="servers"
        :loading="loading"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <template #status="{ record }">
          <a-badge
            :status="record.status === 'online' ? 'success' : 'error'"
            :text="record.status === 'online' ? '在线' : '离线'"
          />
        </template>
        
        <template #actions="{ record }">
          <a-space>
            <router-link :to="`/servers/${record.name}`">
              <a-button type="text" size="small">
                详情
              </a-button>
            </router-link>
            <a-button type="text" size="small" @click="editServer(record)">
              编辑
            </a-button>
            <a-button type="text" size="small" status="danger" @click="deleteServer(record)">
              删除
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 添加服务器模态框 -->
    <a-modal
      v-model:visible="showAddModal"
      title="添加服务器"
      @ok="handleAddServer"
      @cancel="showAddModal = false"
    >
      <a-form :model="newServer" layout="vertical">
        <a-form-item label="服务器名称" required>
          <a-input v-model="newServer.name" placeholder="请输入服务器名称" />
        </a-form-item>
        <a-form-item label="IP地址" required>
          <a-input v-model="newServer.ip" placeholder="请输入IP地址" />
        </a-form-item>
        <a-form-item label="位置">
          <a-input v-model="newServer.location" placeholder="请输入服务器位置" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="newServer.description" placeholder="请输入备注信息" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { IconPlus, IconRefresh } from '@arco-design/web-vue/es/icon'
import { apiClient } from '@/utils/api'

export default {
  name: 'ServerList',
  components: {
    IconPlus,
    IconRefresh
  },
  setup() {
    const loading = ref(false)
    const showAddModal = ref(false)
    const servers = ref([])
    const newServer = ref({
      name: '',
      ip: '',
      location: '',
      description: ''
    })
    
    const pagination = ref({
      current: 1,
      pageSize: 10,
      total: 0
    })
    
    const columns = [
      {
        title: '服务器名称',
        dataIndex: 'name',
        key: 'name'
      },
      {
        title: 'IP地址',
        dataIndex: 'ip',
        key: 'ip'
      },
      {
        title: '位置',
        dataIndex: 'location',
        key: 'location'
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        slotName: 'status'
      },
      {
        title: '最后更新',
        dataIndex: 'lastUpdate',
        key: 'lastUpdate'
      },
      {
        title: '操作',
        key: 'actions',
        slotName: 'actions'
      }
    ]
    
    const refreshList = async () => {
      loading.value = true
      try {
        // 从API获取真实数据
        const serverData = await apiClient.getServers()

        servers.value = serverData.map(server => ({
          name: server.name,
          ip: server.ip_address || '未知',
          location: server.location || '未知',
          status: server.status || 'unknown',
          lastUpdate: server.last_update || server.created_at || '未知'
        }))

        pagination.value.total = servers.value.length
        console.log('Server list loaded:', servers.value.length, 'servers')
      } catch (error) {
        console.error('Failed to load servers:', error)
        servers.value = []
        pagination.value.total = 0
      } finally {
        loading.value = false
      }
    }
    
    const handlePageChange = (page) => {
      pagination.value.current = page
      refreshList()
    }
    
    const handleAddServer = () => {
      console.log('Adding server:', newServer.value)
      showAddModal.value = false
      // 重置表单
      newServer.value = {
        name: '',
        ip: '',
        location: '',
        description: ''
      }
      refreshList()
    }
    
    const editServer = (server) => {
      console.log('Editing server:', server)
    }
    
    const deleteServer = (server) => {
      console.log('Deleting server:', server)
    }
    
    onMounted(() => {
      refreshList()
    })
    
    return {
      loading,
      showAddModal,
      servers,
      newServer,
      pagination,
      columns,
      refreshList,
      handlePageChange,
      handleAddServer,
      editServer,
      deleteServer
    }
  }
}
</script>

<style scoped>
.server-list {
  padding: 24px;
}
</style>
