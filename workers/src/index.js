/**
 * VPS Monitor Cloudflare Workers 主入口
 * 处理所有API请求和WebSocket连接
 */

import { Database } from './utils/database.js';
import { CryptoService } from './services/crypto.js';
import { MonitorService } from './services/monitor.js';
import { SpeedTestService } from './services/speedtest.js';
import { SSHService } from './services/ssh.js';
import { handleAPI } from './handlers/api.js';
import { handleWebSocket } from './handlers/websocket.js';
import { corsHeaders, createResponse, createErrorResponse } from './utils/helpers.js';

/**
 * 主要的请求处理器
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // 处理CORS预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: corsHeaders
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // 初始化服务
      const db = new Database(env.DB);
      const crypto = new CryptoService(env.ENCRYPTION_KEY);
      const monitor = new MonitorService(db, crypto);
      const speedTest = new SpeedTestService(db);
      const ssh = new SSHService(crypto);

      const services = { db, crypto, monitor, speedTest, ssh };

      // 路由处理
      if (path.startsWith('/api/')) {
        return await handleAPI(request, env, services);
      } else if (path === '/ws' || path === '/websocket') {
        return await handleWebSocket(request, env, services);
      } else if (path === '/health') {
        return createResponse({ status: 'ok', timestamp: new Date().toISOString() });
      } else {
        return createErrorResponse('Not Found', 404);
      }

    } catch (error) {
      console.error('Worker error:', error);
      return createErrorResponse('Internal Server Error', 500);
    }
  },

  /**
   * 定时任务处理器
   */
  async scheduled(event, env, ctx) {
    try {
      const db = new Database(env.DB);
      const crypto = new CryptoService(env.ENCRYPTION_KEY);
      const monitor = new MonitorService(db, crypto);
      const speedTest = new SpeedTestService(db);

      // 根据cron表达式执行不同任务
      switch (event.cron) {
        case '*/5 * * * *': // 每5分钟
          await monitor.checkOfflineServers();
          break;
        
        case '*/10 * * * *': // 每10分钟
          await speedTest.runConnectivityTests();
          break;
        
        case '0 */6 * * *': // 每6小时
          await db.cleanupOldData();
          break;
        
        default:
          console.log('Unknown cron schedule:', event.cron);
      }

    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  }
};

/**
 * WebSocket处理器 (Durable Objects)
 */
export class WebSocketHandler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    try {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // 接受WebSocket连接
      server.accept();

      // 生成会话ID
      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, {
        webSocket: server,
        authenticated: false,
        serverName: null,
        lastPing: Date.now()
      });

      // 设置消息处理器
      server.addEventListener('message', async (event) => {
        await this.handleMessage(sessionId, event.data);
      });

      // 设置关闭处理器
      server.addEventListener('close', () => {
        this.sessions.delete(sessionId);
      });

      // 设置错误处理器
      server.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        this.sessions.delete(sessionId);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });

    } catch (error) {
      console.error('WebSocket setup error:', error);
      return new Response('WebSocket setup failed', { status: 500 });
    }
  }

  async handleMessage(sessionId, message) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      const data = JSON.parse(message);

      switch (data.type) {
        case 'auth':
          await this.handleAuth(sessionId, data);
          break;
        
        case 'monitor_data':
          await this.handleMonitorData(sessionId, data);
          break;
        
        case 'ping':
          session.lastPing = Date.now();
          session.webSocket.send(JSON.stringify({ type: 'pong' }));
          break;
        
        default:
          console.log('Unknown message type:', data.type);
      }

    } catch (error) {
      console.error('Message handling error:', error);
    }
  }

  async handleAuth(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // 验证认证密钥
    if (data.auth_secret === this.env.AUTH_SECRET) {
      session.authenticated = true;
      session.serverName = data.server_name;
      
      session.webSocket.send(JSON.stringify({
        type: 'auth_success',
        message: 'Authentication successful'
      }));

      console.log(`Server ${data.server_name} authenticated`);
    } else {
      session.webSocket.send(JSON.stringify({
        type: 'auth_failed',
        message: 'Invalid authentication'
      }));
      
      // 关闭连接
      session.webSocket.close();
      this.sessions.delete(sessionId);
    }
  }

  async handleMonitorData(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.authenticated) return;

    try {
      const db = new Database(this.env.DB);
      const monitor = new MonitorService(db);

      // 保存监控数据
      await monitor.saveAgentData(session.serverName, data.payload);

      // 更新服务器状态
      await db.updateServerStatus(session.serverName, 'online', 'agent');

      // 广播数据到前端客户端
      await this.broadcastToFrontend({
        type: 'monitor_update',
        server_name: session.serverName,
        data: data.payload,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Monitor data handling error:', error);
    }
  }

  async broadcastToFrontend(message) {
    // 向所有前端客户端广播消息
    for (const [sessionId, session] of this.sessions) {
      if (session.authenticated && !session.serverName) {
        // 这是前端客户端连接
        try {
          session.webSocket.send(JSON.stringify(message));
        } catch (error) {
          console.error('Broadcast error:', error);
          this.sessions.delete(sessionId);
        }
      }
    }
  }
}

/**
 * 导出Durable Object类
 */
export { WebSocketHandler as DurableObjectExample };
