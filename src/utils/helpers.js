/**
 * 工具函数集合
 */

import dayjs from 'dayjs'

/**
 * 格式化时间
 * @param {string|Date} time - 时间
 * @param {string} format - 格式
 * @returns {string} 格式化后的时间
 */
export function formatTime(time, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!time) return '-'
  return dayjs(time).format(format)
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化百分比
 * @param {number} value - 数值
 * @param {number} total - 总数
 * @param {number} precision - 精度
 * @returns {string} 百分比字符串
 */
export function formatPercentage(value, total, precision = 1) {
  if (!total || total === 0) return '0%'
  return ((value / total) * 100).toFixed(precision) + '%'
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * 生成随机字符串
 * @param {number} length - 长度
 * @returns {string} 随机字符串
 */
export function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 检查是否为移动设备
 * @returns {boolean} 是否为移动设备
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @returns {string|null} 参数值
 */
export function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(name)
}

/**
 * 设置URL参数
 * @param {string} name - 参数名
 * @param {string} value - 参数值
 */
export function setUrlParam(name, value) {
  const url = new URL(window.location)
  url.searchParams.set(name, value)
  window.history.replaceState({}, '', url)
}

/**
 * 下载文件
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} contentType - 内容类型
 */
export function downloadFile(content, filename, contentType = 'text/plain') {
  const blob = new Blob([content], { type: contentType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textArea)
      return result
    }
  } catch (error) {
    console.error('Failed to copy text:', error)
    return false
  }
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证IP地址格式
 * @param {string} ip - IP地址
 * @returns {boolean} 是否有效
 */
export function isValidIP(ip) {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(ip)
}

/**
 * 获取状态颜色
 * @param {string} status - 状态
 * @returns {string} 颜色
 */
export function getStatusColor(status) {
  const colors = {
    online: '#52c41a',
    offline: '#ff4d4f',
    warning: '#fa8c16',
    unknown: '#8c8c8c'
  }
  return colors[status] || colors.unknown
}

/**
 * 格式化延迟时间
 * @param {number} latency - 延迟时间(ms)
 * @returns {string} 格式化后的延迟
 */
export function formatLatency(latency) {
  if (latency < 0) return '-'
  if (latency < 50) return `${latency}ms (优秀)`
  if (latency < 100) return `${latency}ms (良好)`
  if (latency < 200) return `${latency}ms (一般)`
  return `${latency}ms (较差)`
}

/**
 * 计算时间差
 * @param {string|Date} startTime - 开始时间
 * @param {string|Date} endTime - 结束时间
 * @returns {string} 时间差描述
 */
export function getTimeDiff(startTime, endTime = new Date()) {
  const start = dayjs(startTime)
  const end = dayjs(endTime)
  const diff = end.diff(start, 'second')
  
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}
