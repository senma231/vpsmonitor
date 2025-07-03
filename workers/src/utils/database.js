/**
 * Cloudflare D1 数据库操作工具类
 * 提供统一的数据库访问接口
 */

export class Database {
  constructor(db) {
    this.db = db;
  }

  /**
   * 执行查询并返回所有结果
   */
  async query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * 执行查询并返回第一个结果
   */
  async queryFirst(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).first();
      return result;
    } catch (error) {
      console.error('Database queryFirst error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * 执行插入/更新/删除操作
   */
  async execute(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).run();
      return result;
    } catch (error) {
      console.error('Database execute error:', error);
      throw new Error(`Database execute failed: ${error.message}`);
    }
  }

  /**
   * 批量执行操作
   */
  async batch(operations) {
    try {
      const statements = operations.map(op => {
        const stmt = this.db.prepare(op.sql);
        return stmt.bind(...(op.params || []));
      });
      const results = await this.db.batch(statements);
      return results;
    } catch (error) {
      console.error('Database batch error:', error);
      throw new Error(`Database batch failed: ${error.message}`);
    }
  }

  // ==================== 服务器相关操作 ====================

  /**
   * 获取所有服务器
   */
  async getServers() {
    return await this.query(`
      SELECT * FROM servers 
      ORDER BY name ASC
    `);
  }

  /**
   * 根据名称获取服务器
   */
  async getServerByName(name) {
    return await this.queryFirst(`
      SELECT * FROM servers 
      WHERE name = ?
    `, [name]);
  }

  /**
   * 创建或更新服务器
   */
  async upsertServer(serverData) {
    const {
      name, due_time, buy_url, seller, price,
      ip_address, port, encrypted_credentials,
      monitor_method, monitor_interval, location, region,
      description, expiry_date, purchase_url
    } = serverData;

    // 处理字段映射，确保没有undefined值
    const finalRegion = description || region || '';
    const finalDueTime = expiry_date || due_time || null;
    const finalBuyUrl = purchase_url || buy_url || null;
    const finalSeller = seller || null;
    const finalPrice = price || null;
    const finalIpAddress = ip_address || null;
    const finalPort = port || 22;
    const finalEncryptedCredentials = encrypted_credentials || null;
    const finalMonitorMethod = monitor_method || 'both';
    const finalMonitorInterval = monitor_interval || 300;
    const finalLocation = location || null;

    return await this.execute(`
      INSERT INTO servers (
        name, due_time, buy_url, seller, price,
        ip_address, port, encrypted_credentials,
        monitor_method, monitor_interval, location, region,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        due_time = excluded.due_time,
        buy_url = excluded.buy_url,
        seller = excluded.seller,
        price = excluded.price,
        ip_address = excluded.ip_address,
        port = excluded.port,
        encrypted_credentials = excluded.encrypted_credentials,
        monitor_method = excluded.monitor_method,
        monitor_interval = excluded.monitor_interval,
        location = excluded.location,
        region = excluded.region,
        updated_at = CURRENT_TIMESTAMP
    `, [
      name, finalDueTime, finalBuyUrl, finalSeller, finalPrice,
      finalIpAddress, finalPort, finalEncryptedCredentials,
      finalMonitorMethod, finalMonitorInterval, finalLocation, finalRegion
    ]);
  }

  /**
   * 更新服务器（只更新提供的字段）
   */
  async updateServer(serverName, updateData) {
    // 构建动态更新SQL
    const updateFields = [];
    const updateValues = [];

    // 字段映射
    const fieldMapping = {
      location: 'location',
      description: 'region',
      expiry_date: 'due_time',
      purchase_url: 'buy_url',
      seller: 'seller',
      price: 'price',
      monitor_method: 'monitor_method',
      monitor_interval: 'monitor_interval'
    };

    // 处理每个提供的字段
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'name') continue; // 跳过name字段

      const dbField = fieldMapping[key] || key;
      updateFields.push(`${dbField} = ?`);
      updateValues.push(value);
    }

    if (updateFields.length === 0) {
      return; // 没有字段需要更新
    }

    // 添加updated_at字段
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(serverName);

    const sql = `UPDATE servers SET ${updateFields.join(', ')} WHERE name = ?`;

    return await this.execute(sql, updateValues);
  }

  /**
   * 更新服务器状态
   */
  async updateServerStatus(name, status, dataSource = 'agent') {
    const lastSeenField = dataSource === 'agent' ? 'last_agent_seen' : 'last_ssh_check';
    
    return await this.execute(`
      UPDATE servers 
      SET status = ?, last_seen = CURRENT_TIMESTAMP, ${lastSeenField} = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [status, name]);
  }

  /**
   * 删除服务器
   */
  async deleteServer(name) {
    return await this.execute(`
      DELETE FROM servers WHERE name = ?
    `, [name]);
  }

  // ==================== 监控数据相关操作 ====================

  /**
   * 保存监控数据
   */
  async saveMonitorData(data) {
    const {
      server_name, platform, platform_version, arch, virtualization,
      cpu_info, cpu_usage, cpu_cores,
      memory_total, memory_used, memory_usage,
      swap_total, swap_used, swap_usage,
      disk_total, disk_used, disk_usage,
      network_in_transfer, network_out_transfer,
      network_in_speed, network_out_speed,
      load_1, load_5, load_15, uptime, boot_time,
      process_count, data_source
    } = data;

    return await this.execute(`
      INSERT INTO monitor_data (
        server_name, platform, platform_version, arch, virtualization,
        cpu_info, cpu_usage, cpu_cores,
        memory_total, memory_used, memory_usage,
        swap_total, swap_used, swap_usage,
        disk_total, disk_used, disk_usage,
        network_in_transfer, network_out_transfer,
        network_in_speed, network_out_speed,
        load_1, load_5, load_15, uptime, boot_time,
        process_count, data_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      server_name, platform, platform_version, arch, virtualization,
      JSON.stringify(cpu_info), cpu_usage, cpu_cores,
      memory_total, memory_used, memory_usage,
      swap_total, swap_used, swap_usage,
      disk_total, disk_used, disk_usage,
      network_in_transfer, network_out_transfer,
      network_in_speed, network_out_speed,
      load_1, load_5, load_15, uptime, boot_time,
      process_count, data_source
    ]);
  }

  /**
   * 获取最新监控数据
   */
  async getLatestMonitorData(serverName = null, limit = 100) {
    let sql = `
      SELECT * FROM monitor_data 
      ${serverName ? 'WHERE server_name = ?' : ''}
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    const params = serverName ? [serverName, limit] : [limit];
    return await this.query(sql, params);
  }

  /**
   * 获取服务器历史数据
   */
  async getServerHistory(serverName, hours = 24) {
    return await this.query(`
      SELECT * FROM monitor_data 
      WHERE server_name = ? 
        AND timestamp > datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `, [serverName]);
  }

  // ==================== 连通性测试相关操作 ====================

  /**
   * 保存连通性测试结果
   */
  async saveConnectivityTest(testData) {
    const {
      server_name, test_type, test_target, test_port,
      test_node, test_region, status, latency,
      packet_loss, response_code, error_message, test_duration
    } = testData;

    // 处理undefined值
    const safeValues = [
      server_name || null,
      test_type || null,
      test_target || null,
      test_port || null,
      test_node || null,
      test_region || null,
      status || null,
      latency || null,
      packet_loss || null,
      response_code || null,
      error_message || null,
      test_duration || null
    ];

    return await this.execute(`
      INSERT INTO connectivity_tests (
        server_name, test_type, test_target, test_port,
        test_node, test_region, status, latency,
        packet_loss, response_code, error_message, test_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, safeValues);
  }

  /**
   * 获取连通性测试结果
   */
  async getConnectivityTests(serverName = null, hours = 24) {
    let sql = `
      SELECT * FROM connectivity_tests 
      WHERE timestamp > datetime('now', '-${hours} hours')
      ${serverName ? 'AND server_name = ?' : ''}
      ORDER BY timestamp DESC
    `;
    
    const params = serverName ? [serverName] : [];
    return await this.query(sql, params);
  }

  // ==================== 系统配置相关操作 ====================

  /**
   * 获取配置值
   */
  async getConfig(key) {
    const result = await this.queryFirst(`
      SELECT config_value, config_type FROM system_config 
      WHERE config_key = ?
    `, [key]);
    
    if (!result) return null;
    
    // 根据类型转换值
    switch (result.config_type) {
      case 'number':
        return parseFloat(result.config_value);
      case 'boolean':
        return result.config_value === 'true';
      case 'json':
        return JSON.parse(result.config_value);
      default:
        return result.config_value;
    }
  }

  /**
   * 设置配置值
   */
  async setConfig(key, value, type = 'string') {
    const configValue = type === 'json' ? JSON.stringify(value) : String(value);
    
    return await this.execute(`
      INSERT INTO system_config (config_key, config_value, config_type, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        config_type = excluded.config_type,
        updated_at = CURRENT_TIMESTAMP
    `, [key, configValue, type]);
  }

  // ==================== 数据清理相关操作 ====================

  /**
   * 清理过期数据
   */
  async cleanupOldData(days = 30) {
    const operations = [
      {
        sql: `DELETE FROM monitor_data WHERE timestamp < datetime('now', '-${days} days')`,
        params: []
      },
      {
        sql: `DELETE FROM connectivity_tests WHERE timestamp < datetime('now', '-${days} days')`,
        params: []
      },
      {
        sql: `DELETE FROM operation_logs WHERE timestamp < datetime('now', '-${days} days')`,
        params: []
      }
    ];

    return await this.batch(operations);
  }

  /**
   * 记录操作日志
   */
  async logOperation(operationType, targetType, targetId, operationData, result, errorMessage, ipAddress, userAgent) {
    return await this.execute(`
      INSERT INTO operation_logs (
        operation_type, target_type, target_id, operation_data,
        result, error_message, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      operationType, targetType, targetId, 
      JSON.stringify(operationData), result, errorMessage,
      ipAddress, userAgent
    ]);
  }
}
