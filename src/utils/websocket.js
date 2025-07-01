/**
 * WebSocket工具类
 * 处理与后端的实时通信
 */

import { ref, computed } from 'vue'

// 全局WebSocket状态
const ws = ref(null)
const connected = ref(false)
const connecting = ref(false)
const lastError = ref(null)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5
const reconnectDelay = ref(1000)

// 消息处理器
const messageHandlers = new Map()
const eventListeners = new Map()

/**
 * WebSocket连接管理
 */
export function useWebSocket() {
  const wsUrl = computed(() => {
    return import.meta.env.VITE_WS_URL || 'wss://api.your-domain.workers.dev/ws'
  })

  const connectionStatus = computed(() => {
    if (connecting.value) return 'processing'
    if (connected.value) return 'success'
    if (lastError.value) return 'error'
    return 'default'
  })

  const connectionText = computed(() => {
    if (connecting.value) return '连接中...'
    if (connected.value) return '已连接'
    if (lastError.value) return '连接失败'
    return '未连接'
  })

  /**
   * 建立WebSocket连接
   */
  const connect = async () => {
    if (connected.value || connecting.value) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        connecting.value = true
        lastError.value = null

        console.log('Connecting to WebSocket:', wsUrl.value)
        
        const websocket = new WebSocket(wsUrl.value)

        websocket.onopen = () => {
          console.log('WebSocket connected')
          ws.value = websocket
          connected.value = true
          connecting.value = false
          reconnectAttempts.value = 0
          reconnectDelay.value = 1000

          // 发送认证消息（如果需要）
          const authToken = localStorage.getItem('auth_token')
          if (authToken) {
            send('auth', { token: authToken })
          }

          // 触发连接事件
          emit('connected')
          resolve()
        }

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            handleMessage(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        websocket.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          cleanup()
          
          // 触发断开连接事件
          emit('disconnected', { code: event.code, reason: event.reason })

          // 自动重连
          if (reconnectAttempts.value < maxReconnectAttempts) {
            scheduleReconnect()
          }
        }

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          lastError.value = error
          connecting.value = false
          
          // 触发错误事件
          emit('error', error)
          reject(error)
        }

      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        connecting.value = false
        lastError.value = error
        reject(error)
      }
    })
  }

  /**
   * 断开WebSocket连接
   */
  const disconnect = () => {
    if (ws.value) {
      ws.value.close()
    }
    cleanup()
  }

  /**
   * 发送消息
   */
  const send = (type, data = {}) => {
    if (!connected.value || !ws.value) {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }

    try {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString()
      }
      
      ws.value.send(JSON.stringify(message))
      console.log('Sent WebSocket message:', type, data)
      return true
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      return false
    }
  }

  /**
   * 处理接收到的消息
   */
  const handleMessage = (message) => {
    const { type, data } = message

    console.log('Received WebSocket message:', type, data)

    // 调用注册的消息处理器
    const handler = messageHandlers.get(type)
    if (handler) {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in message handler for ${type}:`, error)
      }
    }

    // 触发消息事件
    emit('message', message)
    emit(`message:${type}`, data)
  }

  /**
   * 注册消息处理器
   */
  const onMessage = (type, handler) => {
    messageHandlers.set(type, handler)
    
    // 返回取消注册的函数
    return () => {
      messageHandlers.delete(type)
    }
  }

  /**
   * 注册事件监听器
   */
  const on = (event, listener) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set())
    }
    eventListeners.get(event).add(listener)

    // 返回取消监听的函数
    return () => {
      const listeners = eventListeners.get(event)
      if (listeners) {
        listeners.delete(listener)
      }
    }
  }

  /**
   * 触发事件
   */
  const emit = (event, data) => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * 清理连接状态
   */
  const cleanup = () => {
    ws.value = null
    connected.value = false
    connecting.value = false
  }

  /**
   * 安排重连
   */
  const scheduleReconnect = () => {
    reconnectAttempts.value++
    
    console.log(`Scheduling reconnect attempt ${reconnectAttempts.value}/${maxReconnectAttempts} in ${reconnectDelay.value}ms`)
    
    setTimeout(() => {
      if (reconnectAttempts.value <= maxReconnectAttempts) {
        connect().catch(() => {
          // 指数退避
          reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000)
        })
      }
    }, reconnectDelay.value)
  }

  /**
   * 心跳检测
   */
  const startHeartbeat = () => {
    const heartbeatInterval = setInterval(() => {
      if (connected.value) {
        send('ping')
      } else {
        clearInterval(heartbeatInterval)
      }
    }, 30000) // 30秒心跳

    // 监听pong响应
    onMessage('pong', () => {
      console.log('Received pong')
    })

    return heartbeatInterval
  }

  return {
    // 状态
    connected: computed(() => connected.value),
    connecting: computed(() => connecting.value),
    connectionStatus,
    connectionText,
    lastError: computed(() => lastError.value),
    
    // 方法
    connect,
    disconnect,
    send,
    onMessage,
    on,
    emit,
    startHeartbeat
  }
}

/**
 * 监控数据WebSocket处理
 */
export function useMonitorWebSocket() {
  const { connect, disconnect, onMessage, on } = useWebSocket()
  
  // 监控数据更新处理器
  const monitorDataHandlers = new Set()
  
  /**
   * 注册监控数据处理器
   */
  const onMonitorData = (handler) => {
    monitorDataHandlers.add(handler)
    
    return () => {
      monitorDataHandlers.delete(handler)
    }
  }

  /**
   * 处理监控数据更新
   */
  onMessage('monitor_update', (data) => {
    monitorDataHandlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('Error in monitor data handler:', error)
      }
    })
  })

  /**
   * 处理服务器状态变化
   */
  onMessage('server_status', (data) => {
    console.log('Server status update:', data)
    
    // 可以在这里触发全局状态更新
    window.$eventBus?.emit('server-status-changed', data)
  })

  /**
   * 处理告警消息
   */
  onMessage('alert', (data) => {
    console.log('Alert received:', data)
    
    // 显示告警通知
    window.$notification?.warning({
      title: '监控告警',
      content: data.message,
      duration: 0 // 不自动关闭
    })
  })

  return {
    connect,
    disconnect,
    onMonitorData,
    on
  }
}

/**
 * 全局WebSocket实例
 */
export const globalWebSocket = useWebSocket()

// 在应用启动时自动连接
if (typeof window !== 'undefined') {
  // 页面可见性变化时重连
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !globalWebSocket.connected.value) {
      globalWebSocket.connect().catch(console.error)
    }
  })

  // 网络状态变化时重连
  window.addEventListener('online', () => {
    if (!globalWebSocket.connected.value) {
      globalWebSocket.connect().catch(console.error)
    }
  })
}
