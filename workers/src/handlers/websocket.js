/**
 * WebSocket处理器
 * 处理实时通信和Agent连接
 */

import { createResponse, createErrorResponse } from '../utils/helpers.js';

/**
 * 处理WebSocket连接
 */
export async function handleWebSocket(request, env, services) {
  try {
    // 检查是否为WebSocket升级请求
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return createErrorResponse('Expected WebSocket upgrade', 400);
    }

    // 创建WebSocket对
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 接受WebSocket连接
    server.accept();

    // 创建会话管理器
    const session = new WebSocketSession(server, env, services);
    await session.initialize();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });

  } catch (error) {
    console.error('WebSocket setup error:', error);
    return createErrorResponse('WebSocket setup failed', 500);
  }
}

/**
 * WebSocket会话管理类
 */
class WebSocketSession {
  constructor(webSocket, env, services) {
    this.webSocket = webSocket;
    this.env = env;
    this.services = services;
    this.authenticated = false;
    this.serverName = null;
    this.sessionId = crypto.randomUUID();
    this.lastPing = Date.now();
    this.isAgent = false;
    this.isFrontend = false;
  }

  /**
   * 初始化会话
   */
  async initialize() {
    console.log(`WebSocket session ${this.sessionId} initialized`);

    // 设置消息处理器
    this.webSocket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });

    // 设置关闭处理器
    this.webSocket.addEventListener('close', (event) => {
      this.handleClose(event);
    });

    // 设置错误处理器
    this.webSocket.addEventListener('error', (error) => {
      this.handleError(error);
    });

    // 发送欢迎消息
    this.send('welcome', {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });

    // 启动心跳检测
    this.startHeartbeat();
  }

  /**
   * 处理接收到的消息
   */
  async handleMessage(message) {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      console.log(`Session ${this.sessionId} received message:`, type);

      switch (type) {
        case 'auth':
          await this.handleAuth(payload);
          break;
        
        case 'monitor_data':
          await this.handleMonitorData(payload);
          break;
        
        case 'ping':
          this.handlePing();
          break;
        
        case 'frontend_connect':
          await this.handleFrontendConnect(payload);
          break;
        
        case 'subscribe':
          await this.handleSubscribe(payload);
          break;
        
        default:
          console.log(`Unknown message type: ${type}`);
      }

    } catch (error) {
      console.error('Message handling error:', error);
      this.send('error', {
        message: 'Invalid message format',
        error: error.message
      });
    }
  }

  /**
   * 处理认证
   */
  async handleAuth(payload) {
    const { auth_secret, server_name, client_type } = payload;

    // 验证认证密钥
    if (auth_secret !== this.env.AUTH_SECRET) {
      this.send('auth_failed', {
        message: 'Invalid authentication credentials'
      });
      this.webSocket.close(1008, 'Authentication failed');
      return;
    }

    this.authenticated = true;
    
    if (client_type === 'agent' && server_name) {
      // Agent连接
      this.isAgent = true;
      this.serverName = server_name;
      
      // 更新服务器状态
      await this.services.db.updateServerStatus(server_name, 'online', 'agent');
      
      console.log(`Agent ${server_name} authenticated`);
    } else if (client_type === 'frontend') {
      // 前端连接
      this.isFrontend = true;
      console.log(`Frontend client authenticated`);
    }

    this.send('auth_success', {
      message: 'Authentication successful',
      client_type: client_type,
      server_name: server_name
    });
  }

  /**
   * 处理监控数据
   */
  async handleMonitorData(payload) {
    if (!this.authenticated || !this.isAgent || !this.serverName) {
      this.send('error', { message: 'Not authorized for monitor data' });
      return;
    }

    try {
      // 保存监控数据
      await this.services.monitor.saveAgentData(this.serverName, payload);

      // 更新服务器状态
      await this.services.db.updateServerStatus(this.serverName, 'online', 'agent');

      // 广播数据到前端客户端
      await this.broadcastToFrontend({
        type: 'monitor_update',
        server_name: this.serverName,
        data: payload,
        timestamp: new Date().toISOString()
      });

      console.log(`Monitor data saved for ${this.serverName}`);

    } catch (error) {
      console.error('Monitor data handling error:', error);
      this.send('error', {
        message: 'Failed to save monitor data',
        error: error.message
      });
    }
  }

  /**
   * 处理心跳
   */
  handlePing() {
    this.lastPing = Date.now();
    this.send('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * 处理前端连接
   */
  async handleFrontendConnect(payload) {
    if (!this.authenticated) {
      this.send('error', { message: 'Authentication required' });
      return;
    }

    this.isFrontend = true;
    
    // 发送当前服务器状态
    try {
      const servers = await this.services.db.getServers();
      this.send('server_list', { servers });
    } catch (error) {
      console.error('Failed to send server list:', error);
    }
  }

  /**
   * 处理订阅
   */
  async handleSubscribe(payload) {
    if (!this.authenticated || !this.isFrontend) {
      this.send('error', { message: 'Not authorized for subscription' });
      return;
    }

    const { server_name } = payload;
    
    if (server_name) {
      // 订阅特定服务器
      this.subscribedServers = this.subscribedServers || new Set();
      this.subscribedServers.add(server_name);
      
      // 发送最新数据
      try {
        const data = await this.services.db.getLatestMonitorData(server_name, 1);
        if (data.length > 0) {
          this.send('monitor_update', {
            server_name: server_name,
            data: data[0],
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Failed to send latest data:', error);
      }
    }
  }

  /**
   * 处理连接关闭
   */
  handleClose(event) {
    console.log(`Session ${this.sessionId} closed:`, event.code, event.reason);
    
    if (this.isAgent && this.serverName) {
      // Agent断开连接，标记服务器为离线
      this.services.db.updateServerStatus(this.serverName, 'offline')
        .catch(error => console.error('Failed to update server status:', error));
    }
    
    this.cleanup();
  }

  /**
   * 处理错误
   */
  handleError(error) {
    console.error(`Session ${this.sessionId} error:`, error);
    this.cleanup();
  }

  /**
   * 发送消息
   */
  send(type, data = {}) {
    if (this.webSocket.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type,
          data,
          timestamp: new Date().toISOString()
        };
        this.webSocket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }

  /**
   * 广播消息到前端客户端
   */
  async broadcastToFrontend(message) {
    // 这里需要实现全局会话管理来广播消息
    // 由于Workers的限制，我们使用Durable Objects来管理全局状态
    
    try {
      // 通过Durable Objects广播
      const durableObjectId = this.env.WEBSOCKET_HANDLER.idFromName('global');
      const durableObject = this.env.WEBSOCKET_HANDLER.get(durableObjectId);
      
      await durableObject.fetch('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Broadcast error:', error);
    }
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      // 检查是否超时
      if (now - this.lastPing > 60000) { // 60秒超时
        console.log(`Session ${this.sessionId} heartbeat timeout`);
        this.webSocket.close(1000, 'Heartbeat timeout');
        return;
      }
      
      // 发送心跳
      this.send('ping', { timestamp: new Date().toISOString() });
    }, 30000); // 30秒间隔
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

/**
 * Durable Object for WebSocket session management
 */
export class WebSocketManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const message = await request.json();
      await this.broadcast(message);
      return new Response('OK');
    }
    
    return new Response('Not Found', { status: 404 });
  }

  async broadcast(message) {
    const promises = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (session.isFrontend && session.webSocket.readyState === WebSocket.OPEN) {
        promises.push(
          session.send(message.type, message.data)
        );
      }
    }
    
    await Promise.allSettled(promises);
  }

  addSession(session) {
    this.sessions.set(session.sessionId, session);
  }

  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}
