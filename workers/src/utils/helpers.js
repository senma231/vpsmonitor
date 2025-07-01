/**
 * 工具函数
 * 提供通用的辅助功能
 */

/**
 * CORS头部
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建成功响应
 */
export function createResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * 创建错误响应
 */
export function createErrorResponse(message, status = 400, headers = {}) {
  return new Response(JSON.stringify({
    error: true,
    message,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * 验证API认证
 */
export async function validateAuth(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return { valid: false, error: 'No authorization header' };
    }

    // 支持Bearer Token和Basic Auth
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // 验证JWT Token
      const crypto = new (await import('../services/crypto.js')).CryptoService(env?.ENCRYPTION_KEY || 'default-key');
      const result = await crypto.verifyAPIToken(token);
      
      return result;
    } else if (authHeader.startsWith('Basic ')) {
      const credentials = atob(authHeader.substring(6));
      const [username, password] = credentials.split(':');
      
      // 验证基础认证
      if (username === 'admin' && password === env?.ADMIN_PASSWORD) {
        return { valid: true, payload: { username } };
      }
      
      return { valid: false, error: 'Invalid credentials' };
    } else {
      return { valid: false, error: 'Invalid authorization format' };
    }
  } catch (error) {
    console.error('Auth validation error:', error);
    return { valid: false, error: 'Authentication failed' };
  }
}

/**
 * 验证请求参数
 */
export function validateParams(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === null || data[field] === undefined || data[field] === '') {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化百分比
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return value.toFixed(decimals) + '%';
}

/**
 * 格式化时间间隔
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0s';
  
  const units = [
    { name: 'd', value: 86400 },
    { name: 'h', value: 3600 },
    { name: 'm', value: 60 },
    { name: 's', value: 1 }
  ];
  
  let result = '';
  let remaining = Math.floor(seconds);
  
  for (const unit of units) {
    if (remaining >= unit.value) {
      const count = Math.floor(remaining / unit.value);
      result += count + unit.name + ' ';
      remaining %= unit.value;
    }
  }
  
  return result.trim() || '0s';
}

/**
 * 生成随机ID
 */
export function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 重试函数
 */
export async function retry(fn, maxAttempts = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // 指数退避
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}

/**
 * 验证IP地址
 */
export function isValidIP(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 验证端口号
 */
export function isValidPort(port) {
  const portNum = parseInt(port);
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * 验证域名
 */
export function isValidDomain(domain) {
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return domainRegex.test(domain);
}

/**
 * 清理敏感数据
 */
export function sanitizeData(data, sensitiveFields = ['password', 'secret', 'token', 'key']) {
  const cleaned = deepClone(data);
  
  function cleanObject(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '***';
        } else if (typeof obj[key] === 'object') {
          cleanObject(obj[key]);
        }
      }
    }
  }
  
  cleanObject(cleaned);
  return cleaned;
}

/**
 * 计算数组平均值
 */
export function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + (typeof num === 'number' ? num : 0), 0);
  return sum / numbers.length;
}

/**
 * 计算数组中位数
 */
export function median(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  
  const sorted = numbers.filter(n => typeof n === 'number').sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

/**
 * 获取客户端IP
 */
export function getClientIP(request) {
  // Cloudflare提供的真实IP
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) return cfConnectingIP;
  
  // 其他代理头部
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

/**
 * 获取用户代理
 */
export function getUserAgent(request) {
  return request.headers.get('User-Agent') || 'unknown';
}

/**
 * 限制字符串长度
 */
export function truncateString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

/**
 * 转义HTML
 */
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}
