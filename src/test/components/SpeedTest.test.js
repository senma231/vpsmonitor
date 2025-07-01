/**
 * SpeedTest组件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpeedTest from '@/components/SpeedTest.vue'

// 模拟API
vi.mock('@/utils/api', () => ({
  apiClient: {
    runSpeedTest: vi.fn(),
    getConnectivityTests: vi.fn()
  }
}))

// 模拟ECharts
vi.mock('vue-echarts', () => ({
  default: {
    name: 'VChart',
    template: '<div class="mock-chart"></div>'
  }
}))

describe('SpeedTest Component', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(SpeedTest, {
      props: {
        serverName: 'test-server'
      },
      global: {
        stubs: {
          'a-card': true,
          'a-button': true,
          'a-spin': true,
          'a-progress': true,
          'a-row': true,
          'a-col': true,
          'a-statistic': true,
          'a-table': true,
          'a-tag': true,
          'a-empty': true,
          'v-chart': true,
          'icon-thunderbolt': true,
          'icon-loading': true,
          'icon-wifi': true
        }
      }
    })
  })

  it('should render correctly', () => {
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.speed-test').exists()).toBe(true)
  })

  it('should show empty state when no test data', () => {
    expect(wrapper.find('a-empty-stub').exists()).toBe(true)
  })

  it('should disable test button when no server name', async () => {
    await wrapper.setProps({ serverName: '' })
    const button = wrapper.find('a-button-stub')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('should enable test button when server name provided', () => {
    const button = wrapper.find('a-button-stub')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('should show loading state during test', async () => {
    const { apiClient } = await import('@/utils/api')
    apiClient.runSpeedTest.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )

    await wrapper.vm.runSpeedTest()
    expect(wrapper.vm.testing).toBe(true)
  })

  it('should handle test success', async () => {
    const { apiClient } = await import('@/utils/api')
    const mockResult = {
      server_name: 'test-server',
      successful_tests: 3,
      results: [
        {
          test_region: '香港',
          status: 'success',
          latency: 50,
          test_type: 'http'
        }
      ],
      summary: {
        overall_status: 'good',
        success_rate: 100,
        avg_latency: 50
      }
    }

    apiClient.runSpeedTest.mockResolvedValue(mockResult)
    apiClient.getConnectivityTests.mockResolvedValue([])

    await wrapper.vm.runSpeedTest()

    expect(wrapper.vm.lastTestResult).toEqual(mockResult)
    expect(wrapper.vm.testResults).toEqual(mockResult.results)
  })

  it('should handle test failure', async () => {
    const { apiClient } = await import('@/utils/api')
    const error = new Error('Test failed')
    apiClient.runSpeedTest.mockRejectedValue(error)

    // 模拟通知
    window.$notification = {
      error: vi.fn()
    }

    await wrapper.vm.runSpeedTest()

    expect(window.$notification.error).toHaveBeenCalledWith({
      title: '测试失败',
      content: 'Test failed'
    })
  })

  it('should format status correctly', () => {
    expect(wrapper.vm.getStatusText('success')).toBe('成功')
    expect(wrapper.vm.getStatusText('failed')).toBe('失败')
    expect(wrapper.vm.getStatusText('timeout')).toBe('超时')
    expect(wrapper.vm.getStatusText('error')).toBe('错误')
  })

  it('should get correct status colors', () => {
    expect(wrapper.vm.getStatusColor('success')).toBe('green')
    expect(wrapper.vm.getStatusColor('failed')).toBe('red')
    expect(wrapper.vm.getStatusColor('timeout')).toBe('orange')
    expect(wrapper.vm.getStatusColor('error')).toBe('red')
  })

  it('should load history data on mount', async () => {
    const { apiClient } = await import('@/utils/api')
    apiClient.getConnectivityTests.mockResolvedValue([
      {
        test_region: '香港',
        status: 'success',
        latency: 45,
        timestamp: new Date().toISOString()
      }
    ])

    const newWrapper = mount(SpeedTest, {
      props: {
        serverName: 'test-server'
      },
      global: {
        stubs: {
          'a-card': true,
          'a-button': true,
          'v-chart': true
        }
      }
    })

    await newWrapper.vm.$nextTick()
    expect(apiClient.getConnectivityTests).toHaveBeenCalledWith('test-server', 24)
  })

  it('should watch server name changes', async () => {
    const { apiClient } = await import('@/utils/api')
    apiClient.getConnectivityTests.mockResolvedValue([])

    await wrapper.setProps({ serverName: 'new-server' })
    await wrapper.vm.$nextTick()

    expect(apiClient.getConnectivityTests).toHaveBeenCalledWith('new-server', 24)
  })

  it('should generate chart options correctly', async () => {
    wrapper.vm.historyData = [
      {
        test_region: '香港',
        latency: 50,
        timestamp: '2024-01-01T12:00:00Z'
      },
      {
        test_region: '新加坡',
        latency: 60,
        timestamp: '2024-01-01T12:01:00Z'
      }
    ]

    await wrapper.vm.$nextTick()

    const chartOption = wrapper.vm.chartOption
    expect(chartOption.series).toBeDefined()
    expect(chartOption.series.length).toBeGreaterThan(0)
  })
})
