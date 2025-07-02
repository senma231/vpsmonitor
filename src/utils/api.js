/**
 * API工具类
 * 封装所有与后端API的交互
 */

import axios from 'axios'

/**
 * 自动检测API地址
 */
function getApiBaseURL() {
  // 优先使用环境变量
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (envApiUrl && !envApiUrl.includes('placeholder')) {
    return envApiUrl;
  }

  // 自动检测：假设Workers和Pages在同一个账户下
  const currentHost = window.location.hostname;

  if (currentHost.includes('.pages.dev')) {
    // 从Pages域名推导Workers域名
    const projectName = currentHost.split('.')[0];
    const workersDomain = `${projectName}-api.workers.dev`;
    return `https://${workersDomain}`;
  }

  // 本地开发环境
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:8787';
  }

  // 默认使用相对路径
  return '/api';
}

// 创建axios实例
const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 添加认证token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加请求时间戳
    config.metadata = { startTime: new Date() }
    
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  error => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 计算请求耗时
    const endTime = new Date()
    const duration = endTime - response.config.metadata.startTime
    console.log(`API Response: ${response.config.url} (${duration}ms)`)
    
    return response.data
  },
  error => {
    console.error('API Error:', error)
    
    // 处理不同类型的错误
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          // 未授权，清除token并跳转登录
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
          break
        case 403:
          // 禁止访问
          console.error('Access forbidden')
          break
        case 404:
          // 资源不存在
          console.error('Resource not found')
          break
        case 500:
          // 服务器内部错误
          console.error('Server internal error')
          break
        default:
          console.error(`HTTP Error ${status}:`, data?.message || error.message)
      }
      
      return Promise.reject(new Error(data?.message || `HTTP ${status} Error`))
    } else if (error.request) {
      // 网络错误
      console.error('Network error:', error.request)
      return Promise.reject(new Error('网络连接失败，请检查网络设置'))
    } else {
      // 其他错误
      console.error('Request setup error:', error.message)
      return Promise.reject(error)
    }
  }
)

// API方法封装
export const apiClient = {
  // ==================== 服务器管理 ====================
  
  /**
   * 获取所有服务器
   */
  async getServers() {
    return await api.get('/servers')
  },
  
  /**
   * 获取单个服务器信息
   */
  async getServer(name) {
    return await api.get(`/servers/${encodeURIComponent(name)}`)
  },
  
  /**
   * 创建服务器
   */
  async createServer(serverData) {
    return await api.post('/servers', serverData)
  },
  
  /**
   * 更新服务器
   */
  async updateServer(name, serverData) {
    return await api.put(`/servers/${encodeURIComponent(name)}`, serverData)
  },
  
  /**
   * 删除服务器
   */
  async deleteServer(name) {
    return await api.delete(`/servers/${encodeURIComponent(name)}`)
  },
  
  // ==================== 监控数据 ====================
  
  /**
   * 获取服务器监控数据
   */
  async getServerData(name, limit = 100) {
    return await api.get(`/servers/${encodeURIComponent(name)}/data`, {
      params: { limit }
    })
  },
  
  /**
   * 获取服务器历史数据
   */
  async getServerHistory(name, hours = 24) {
    return await api.get(`/servers/${encodeURIComponent(name)}/history`, {
      params: { hours }
    })
  },
  
  /**
   * 触发服务器监控
   */
  async triggerMonitor(name) {
    return await api.post(`/servers/${encodeURIComponent(name)}/monitor`)
  },
  
  // ==================== 连通性测试 ====================
  
  /**
   * 运行速度测试
   */
  async runSpeedTest(name) {
    return await api.post(`/servers/${encodeURIComponent(name)}/speedtest`)
  },
  
  /**
   * 获取连通性测试结果
   */
  async getConnectivityTests(name, hours = 24) {
    return await api.get(`/servers/${encodeURIComponent(name)}/connectivity`, {
      params: { hours }
    })
  },
  
  // ==================== 系统配置 ====================
  
  /**
   * 获取系统配置
   */
  async getConfig(key = null) {
    return await api.get('/config', {
      params: key ? { key } : {}
    })
  },
  
  /**
   * 设置系统配置
   */
  async setConfig(configData) {
    return await api.post('/config', configData)
  },
  
  // ==================== 统计信息 ====================
  
  /**
   * 获取系统统计信息
   */
  async getStats() {
    return await api.get('/stats')
  },
  
  /**
   * 获取仪表板数据
   */
  async getDashboard() {
    return await api.get('/dashboard')
  }
}

// 工具函数
export const apiUtils = {
  /**
   * 设置认证token
   */
  setAuthToken(token) {
    localStorage.setItem('auth_token', token)
  },
  
  /**
   * 清除认证token
   */
  clearAuthToken() {
    localStorage.removeItem('auth_token')
  },
  
  /**
   * 获取认证token
   */
  getAuthToken() {
    return localStorage.getItem('auth_token')
  },
  
  /**
   * 检查是否已认证
   */
  isAuthenticated() {
    return !!this.getAuthToken()
  },
  
  /**
   * 格式化API错误
   */
  formatError(error) {
    if (error.response?.data?.message) {
      return error.response.data.message
    } else if (error.message) {
      return error.message
    } else {
      return '未知错误'
    }
  },
  
  /**
   * 重试API请求
   */
  async retry(apiCall, maxAttempts = 3, delay = 1000) {
    let lastError
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await apiCall()
      } catch (error) {
        lastError = error
        
        if (attempt === maxAttempts) {
          throw lastError
        }
        
        // 指数退避
        const waitTime = delay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  },
  
  /**
   * 批量API请求
   */
  async batch(apiCalls, concurrency = 5) {
    const results = []
    
    for (let i = 0; i < apiCalls.length; i += concurrency) {
      const batch = apiCalls.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(
        batch.map(call => call())
      )
      results.push(...batchResults)
    }
    
    return results
  }
}

// 导出默认实例
export default api
