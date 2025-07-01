/**
 * API路由处理器
 * 处理所有REST API请求
 */

import { createResponse, createErrorResponse, validateAuth } from '../utils/helpers.js';

/**
 * 主API路由处理器
 */
export async function handleAPI(request, env, services) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // API路由映射
    const routes = {
      // 服务器管理
      'GET /api/servers': () => getServers(request, services),
      'POST /api/servers': () => createServer(request, services),
      'PUT /api/servers/:name': () => updateServer(request, services),
      'DELETE /api/servers/:name': () => deleteServer(request, services),
      'GET /api/servers/:name': () => getServer(request, services),
      
      // 监控数据
      'GET /api/servers/:name/data': () => getServerData(request, services),
      'GET /api/servers/:name/history': () => getServerHistory(request, services),
      'POST /api/servers/:name/monitor': () => triggerMonitor(request, services),
      
      // 连通性测试
      'POST /api/servers/:name/speedtest': () => runSpeedTest(request, services),
      'GET /api/servers/:name/connectivity': () => getConnectivityTests(request, services),
      
      // 系统配置
      'GET /api/config': () => getConfig(request, services),
      'POST /api/config': () => setConfig(request, services),
      
      // 统计信息
      'GET /api/stats': () => getStats(request, services),
      'GET /api/dashboard': () => getDashboard(request, services),
    };

    // 匹配路由
    const routeKey = `${method} ${path}`;
    const handler = routes[routeKey] || matchDynamicRoute(method, path, routes);

    if (handler) {
      return await handler();
    } else {
      return createErrorResponse('API endpoint not found', 404);
    }

  } catch (error) {
    console.error('API error:', error);
    return createErrorResponse(error.message, 500);
  }
}

/**
 * 匹配动态路由
 */
function matchDynamicRoute(method, path, routes) {
  for (const [routePattern, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = routePattern.split(' ');
    
    if (routeMethod !== method) continue;
    
    const pathRegex = routePath.replace(/:([^/]+)/g, '([^/]+)');
    const regex = new RegExp(`^${pathRegex}$`);
    const match = path.match(regex);
    
    if (match) {
      return handler;
    }
  }
  return null;
}

/**
 * 从URL路径中提取参数
 */
function extractParams(path, pattern) {
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');
  const params = {};
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].substring(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

// ==================== 服务器管理API ====================

/**
 * 获取所有服务器
 */
async function getServers(request, { db }) {
  const servers = await db.getServers();
  
  // 移除敏感信息
  const safeServers = servers.map(server => ({
    ...server,
    encrypted_credentials: server.encrypted_credentials ? '***' : null
  }));
  
  return createResponse(safeServers);
}

/**
 * 创建服务器
 */
async function createServer(request, { db, crypto }) {
  // 验证认证
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const serverData = await request.json();
  
  // 验证必需字段
  if (!serverData.name) {
    return createErrorResponse('Server name is required', 400);
  }

  // 加密SSH凭据
  if (serverData.ssh_credentials) {
    serverData.encrypted_credentials = await crypto.encrypt(
      JSON.stringify(serverData.ssh_credentials)
    );
    delete serverData.ssh_credentials;
  }

  try {
    await db.upsertServer(serverData);
    return createResponse({ message: 'Server created successfully' });
  } catch (error) {
    return createErrorResponse(`Failed to create server: ${error.message}`, 500);
  }
}

/**
 * 更新服务器
 */
async function updateServer(request, { db, crypto }) {
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name').name;
  const updateData = await request.json();

  // 加密SSH凭据
  if (updateData.ssh_credentials) {
    updateData.encrypted_credentials = await crypto.encrypt(
      JSON.stringify(updateData.ssh_credentials)
    );
    delete updateData.ssh_credentials;
  }

  try {
    updateData.name = serverName;
    await db.upsertServer(updateData);
    return createResponse({ message: 'Server updated successfully' });
  } catch (error) {
    return createErrorResponse(`Failed to update server: ${error.message}`, 500);
  }
}

/**
 * 删除服务器
 */
async function deleteServer(request, { db }) {
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name').name;

  try {
    await db.deleteServer(serverName);
    return createResponse({ message: 'Server deleted successfully' });
  } catch (error) {
    return createErrorResponse(`Failed to delete server: ${error.message}`, 500);
  }
}

/**
 * 获取单个服务器信息
 */
async function getServer(request, { db }) {
  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name').name;

  try {
    const server = await db.getServerByName(serverName);
    if (!server) {
      return createErrorResponse('Server not found', 404);
    }

    // 移除敏感信息
    if (server.encrypted_credentials) {
      server.encrypted_credentials = '***';
    }

    return createResponse(server);
  } catch (error) {
    return createErrorResponse(`Failed to get server: ${error.message}`, 500);
  }
}

// ==================== 监控数据API ====================

/**
 * 获取服务器监控数据
 */
async function getServerData(request, { db }) {
  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name/data').name;
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    const data = await db.getLatestMonitorData(serverName, limit);
    return createResponse(data);
  } catch (error) {
    return createErrorResponse(`Failed to get server data: ${error.message}`, 500);
  }
}

/**
 * 获取服务器历史数据
 */
async function getServerHistory(request, { db }) {
  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name/history').name;
  const hours = parseInt(url.searchParams.get('hours') || '24');

  try {
    const history = await db.getServerHistory(serverName, hours);
    return createResponse(history);
  } catch (error) {
    return createErrorResponse(`Failed to get server history: ${error.message}`, 500);
  }
}

/**
 * 触发服务器监控
 */
async function triggerMonitor(request, { monitor }) {
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name/monitor').name;

  try {
    const result = await monitor.collectServerData(serverName);
    return createResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to monitor server: ${error.message}`, 500);
  }
}

// ==================== 连通性测试API ====================

/**
 * 运行速度测试
 */
async function runSpeedTest(request, { speedTest }) {
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name/speedtest').name;

  try {
    const result = await speedTest.runTest(serverName);
    return createResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to run speed test: ${error.message}`, 500);
  }
}

/**
 * 获取连通性测试结果
 */
async function getConnectivityTests(request, { db }) {
  const url = new URL(request.url);
  const serverName = extractParams(url.pathname, '/api/servers/:name/connectivity').name;
  const hours = parseInt(url.searchParams.get('hours') || '24');

  try {
    const tests = await db.getConnectivityTests(serverName, hours);
    return createResponse(tests);
  } catch (error) {
    return createErrorResponse(`Failed to get connectivity tests: ${error.message}`, 500);
  }
}

// ==================== 系统配置API ====================

/**
 * 获取系统配置
 */
async function getConfig(request, { db }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  try {
    if (key) {
      const value = await db.getConfig(key);
      return createResponse({ [key]: value });
    } else {
      // 返回所有配置
      const configs = await db.query('SELECT config_key, config_value, config_type FROM system_config');
      const configObj = {};
      
      for (const config of configs) {
        let value = config.config_value;
        switch (config.config_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
          case 'json':
            value = JSON.parse(value);
            break;
        }
        configObj[config.config_key] = value;
      }
      
      return createResponse(configObj);
    }
  } catch (error) {
    return createErrorResponse(`Failed to get config: ${error.message}`, 500);
  }
}

/**
 * 设置系统配置
 */
async function setConfig(request, { db }) {
  const authResult = await validateAuth(request);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  const configData = await request.json();

  try {
    for (const [key, value] of Object.entries(configData)) {
      let type = 'string';
      if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else if (typeof value === 'object') type = 'json';

      await db.setConfig(key, value, type);
    }

    return createResponse({ message: 'Configuration updated successfully' });
  } catch (error) {
    return createErrorResponse(`Failed to set config: ${error.message}`, 500);
  }
}

// ==================== 统计信息API ====================

/**
 * 获取系统统计信息
 */
async function getStats(request, { db }) {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_servers,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_servers,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_servers
      FROM servers
    `);

    const monitorStats = await db.query(`
      SELECT COUNT(*) as total_records
      FROM monitor_data 
      WHERE timestamp > datetime('now', '-24 hours')
    `);

    return createResponse({
      servers: stats[0],
      monitoring: monitorStats[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return createErrorResponse(`Failed to get stats: ${error.message}`, 500);
  }
}

/**
 * 获取仪表板数据
 */
async function getDashboard(request, { db }) {
  try {
    // 获取所有服务器及其最新数据
    const servers = await db.query(`
      SELECT 
        s.*,
        md.cpu_usage,
        md.memory_usage,
        md.disk_usage,
        md.network_in_speed,
        md.network_out_speed,
        md.timestamp as last_data_time
      FROM servers s
      LEFT JOIN (
        SELECT DISTINCT server_name, 
               FIRST_VALUE(cpu_usage) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as cpu_usage,
               FIRST_VALUE(memory_usage) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as memory_usage,
               FIRST_VALUE(disk_usage) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as disk_usage,
               FIRST_VALUE(network_in_speed) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as network_in_speed,
               FIRST_VALUE(network_out_speed) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as network_out_speed,
               FIRST_VALUE(timestamp) OVER (PARTITION BY server_name ORDER BY timestamp DESC) as timestamp
        FROM monitor_data 
        WHERE timestamp > datetime('now', '-1 hour')
      ) md ON s.name = md.server_name
      ORDER BY s.name
    `);

    // 移除敏感信息
    const safeServers = servers.map(server => ({
      ...server,
      encrypted_credentials: server.encrypted_credentials ? '***' : null
    }));

    return createResponse({
      servers: safeServers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return createErrorResponse(`Failed to get dashboard: ${error.message}`, 500);
  }
}
