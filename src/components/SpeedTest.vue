<template>
  <div class="speed-test">
    <a-card title="连通性测试" :bordered="false">
      <template #extra>
        <a-button
          type="primary"
          :loading="testing"
          @click="runSpeedTest"
          :disabled="!serverName"
        >
          <icon-thunderbolt />
          开始测试
        </a-button>
      </template>

      <!-- 测试状态 -->
      <div v-if="testing" class="test-status">
        <a-spin :loading="testing">
          <div class="test-progress">
            <icon-loading />
            <span>正在测试连通性...</span>
            <a-progress
              :percent="testProgress"
              :show-text="false"
              size="small"
            />
          </div>
        </a-spin>
      </div>

      <!-- 测试结果概览 -->
      <div v-if="lastTestResult" class="test-summary">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-statistic
              title="总体状态"
              :value="lastTestResult.summary?.overall_status || 'unknown'"
              :value-style="getStatusStyle(lastTestResult.summary?.overall_status)"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="成功率"
              :value="lastTestResult.summary?.success_rate || 0"
              suffix="%"
              :precision="1"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="平均延迟"
              :value="lastTestResult.summary?.avg_latency || 0"
              suffix="ms"
              :precision="0"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="最佳节点"
              :value="lastTestResult.summary?.best_node || '-'"
            />
          </a-col>
        </a-row>
      </div>

      <!-- 节点测试结果 -->
      <div v-if="testResults.length > 0" class="test-results">
        <h4>节点测试详情</h4>
        <a-table
          :columns="columns"
          :data="testResults"
          :pagination="false"
          size="small"
        >
          <template #status="{ record }">
            <a-tag
              :color="getStatusColor(record.status)"
              size="small"
            >
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          
          <template #latency="{ record }">
            <span v-if="record.latency">
              {{ record.latency }}ms
            </span>
            <span v-else class="text-muted">-</span>
          </template>
          
          <template #test_type="{ record }">
            <a-tag size="small">{{ record.test_type?.toUpperCase() }}</a-tag>
          </template>
        </a-table>
      </div>

      <!-- 历史测试图表 -->
      <div v-if="historyData.length > 0" class="test-history">
        <h4>连通性历史</h4>
        <div class="chart-container">
          <v-chart
            :option="chartOption"
            :style="{ height: '300px' }"
            autoresize
          />
        </div>
      </div>

      <!-- 空状态 -->
      <a-empty
        v-if="!testing && !lastTestResult && testResults.length === 0"
        description="暂无测试数据"
      >
        <template #image>
          <icon-wifi />
        </template>
        <a-button type="primary" @click="runSpeedTest">
          开始第一次测试
        </a-button>
      </a-empty>
    </a-card>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { apiClient } from '@/utils/api'
import { formatTime } from '@/utils/helpers'

// 注册ECharts组件
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

export default {
  name: 'SpeedTest',
  components: {
    VChart
  },
  props: {
    serverName: {
      type: String,
      required: true
    }
  },
  setup(props) {
    // 响应式数据
    const testing = ref(false)
    const testProgress = ref(0)
    const lastTestResult = ref(null)
    const testResults = ref([])
    const historyData = ref([])

    // 表格列定义
    const columns = [
      {
        title: '测试节点',
        dataIndex: 'test_region',
        key: 'test_region'
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        slotName: 'status'
      },
      {
        title: '延迟',
        dataIndex: 'latency',
        key: 'latency',
        slotName: 'latency'
      },
      {
        title: '测试类型',
        dataIndex: 'test_type',
        key: 'test_type',
        slotName: 'test_type'
      },
      {
        title: '测试时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: ({ record }) => formatTime(record.timestamp)
      }
    ]

    // 图表配置
    const chartOption = computed(() => {
      if (historyData.value.length === 0) return {}

      // 按节点分组数据
      const nodeData = {}
      historyData.value.forEach(item => {
        if (!nodeData[item.test_region]) {
          nodeData[item.test_region] = []
        }
        nodeData[item.test_region].push({
          time: new Date(item.timestamp),
          latency: item.latency || null
        })
      })

      const series = Object.entries(nodeData).map(([region, data]) => ({
        name: region,
        type: 'line',
        data: data.map(d => [d.time, d.latency]),
        smooth: true,
        connectNulls: false
      }))

      return {
        title: {
          text: '延迟趋势',
          left: 'center',
          textStyle: { fontSize: 14 }
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            let result = `${formatTime(params[0].value[0])}<br/>`
            params.forEach(param => {
              if (param.value[1] !== null) {
                result += `${param.seriesName}: ${param.value[1]}ms<br/>`
              }
            })
            return result
          }
        },
        legend: {
          bottom: 0
        },
        grid: {
          top: 40,
          bottom: 60,
          left: 60,
          right: 20
        },
        xAxis: {
          type: 'time',
          axisLabel: {
            formatter: (value) => formatTime(value, 'HH:mm')
          }
        },
        yAxis: {
          type: 'value',
          name: '延迟 (ms)',
          min: 0
        },
        series
      }
    })

    // 方法
    const runSpeedTest = async () => {
      if (!props.serverName) return

      testing.value = true
      testProgress.value = 0

      try {
        // 模拟进度更新
        const progressInterval = setInterval(() => {
          if (testProgress.value < 90) {
            testProgress.value += 10
          }
        }, 1000)

        // 运行测试
        const result = await apiClient.runSpeedTest(props.serverName)
        
        clearInterval(progressInterval)
        testProgress.value = 100

        // 更新结果
        lastTestResult.value = result
        testResults.value = result.results || []

        // 刷新历史数据
        await loadHistoryData()

        // 显示成功通知
        window.$notification?.success({
          title: '测试完成',
          content: `成功测试 ${result.successful_tests || 0} 个节点`
        })

      } catch (error) {
        console.error('Speed test failed:', error)
        window.$notification?.error({
          title: '测试失败',
          content: error.message || '连通性测试失败'
        })
      } finally {
        testing.value = false
        testProgress.value = 0
      }
    }

    const loadHistoryData = async () => {
      if (!props.serverName) return

      try {
        const data = await apiClient.getConnectivityTests(props.serverName, 24)
        historyData.value = data || []
      } catch (error) {
        console.error('Failed to load history data:', error)
      }
    }

    const getStatusColor = (status) => {
      switch (status) {
        case 'success': return 'green'
        case 'failed': return 'red'
        case 'timeout': return 'orange'
        case 'error': return 'red'
        default: return 'gray'
      }
    }

    const getStatusText = (status) => {
      switch (status) {
        case 'success': return '成功'
        case 'failed': return '失败'
        case 'timeout': return '超时'
        case 'error': return '错误'
        default: return '未知'
      }
    }

    const getStatusStyle = (status) => {
      switch (status) {
        case 'good': return { color: '#52c41a' }
        case 'poor': return { color: '#ff4d4f' }
        case 'failed': return { color: '#ff4d4f' }
        default: return { color: '#8c8c8c' }
      }
    }

    // 监听服务器名称变化
    watch(() => props.serverName, (newName) => {
      if (newName) {
        loadHistoryData()
      }
    })

    // 生命周期
    onMounted(() => {
      if (props.serverName) {
        loadHistoryData()
      }
    })

    return {
      // 数据
      testing,
      testProgress,
      lastTestResult,
      testResults,
      historyData,
      columns,
      chartOption,

      // 方法
      runSpeedTest,
      getStatusColor,
      getStatusText,
      getStatusStyle,
      formatTime
    }
  }
}
</script>

<style scoped>
.speed-test {
  width: 100%;
}

.test-status {
  margin-bottom: 24px;
  text-align: center;
}

.test-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.test-summary {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.test-results {
  margin-bottom: 24px;
}

.test-history {
  margin-bottom: 24px;
}

.chart-container {
  margin-top: 16px;
}

.text-muted {
  color: #8c8c8c;
}

h4 {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}
</style>
