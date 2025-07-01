-- VPS Monitor Database Schema for Cloudflare D1
-- 基于原有Akile Monitor结构，扩展支持SSH凭据和混合监控

-- 服务器信息表 (扩展原有Host表)
CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    
    -- 原有商业信息字段 (保持兼容)
    due_time INTEGER,           -- 到期时间 (Unix时间戳)
    buy_url TEXT,              -- 购买链接
    seller TEXT,               -- 卖家
    price TEXT,                -- 价格
    
    -- 新增技术信息字段
    ip_address TEXT,           -- 服务器IP地址
    port INTEGER DEFAULT 22,   -- SSH端口
    encrypted_credentials TEXT, -- 加密的SSH凭据 (JSON格式)
    
    -- 监控配置
    monitor_method TEXT DEFAULT 'agent' CHECK (monitor_method IN ('agent', 'ssh', 'both')),
    monitor_interval INTEGER DEFAULT 60, -- 监控间隔(秒)
    
    -- 状态信息
    status TEXT DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'error', 'unknown')),
    last_seen DATETIME,        -- 最后在线时间
    last_agent_seen DATETIME,  -- 最后Agent上报时间
    last_ssh_check DATETIME,   -- 最后SSH检查时间
    
    -- 地理位置信息
    location TEXT,             -- 服务器位置
    region TEXT,               -- 地区
    
    -- 元数据
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    UNIQUE(name)
);

-- 监控数据表 (实时数据)
CREATE TABLE IF NOT EXISTS monitor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    
    -- 系统信息
    platform TEXT,             -- 操作系统
    platform_version TEXT,     -- 系统版本
    arch TEXT,                 -- 架构
    virtualization TEXT,       -- 虚拟化类型
    
    -- CPU信息
    cpu_info TEXT,             -- CPU型号信息 (JSON数组)
    cpu_usage REAL,            -- CPU使用率 (0-100)
    cpu_cores INTEGER,         -- CPU核心数
    
    -- 内存信息
    memory_total INTEGER,      -- 总内存 (字节)
    memory_used INTEGER,       -- 已用内存 (字节)
    memory_usage REAL,         -- 内存使用率 (0-100)
    
    -- 交换分区
    swap_total INTEGER,        -- 总交换分区 (字节)
    swap_used INTEGER,         -- 已用交换分区 (字节)
    swap_usage REAL,           -- 交换分区使用率 (0-100)
    
    -- 磁盘信息
    disk_total INTEGER,        -- 总磁盘空间 (字节)
    disk_used INTEGER,         -- 已用磁盘空间 (字节)
    disk_usage REAL,           -- 磁盘使用率 (0-100)
    
    -- 网络信息
    network_in_transfer INTEGER,  -- 入站总流量 (字节)
    network_out_transfer INTEGER, -- 出站总流量 (字节)
    network_in_speed INTEGER,     -- 入站速度 (字节/秒)
    network_out_speed INTEGER,    -- 出站速度 (字节/秒)
    
    -- 系统负载
    load_1 REAL,               -- 1分钟负载
    load_5 REAL,               -- 5分钟负载
    load_15 REAL,              -- 15分钟负载
    uptime INTEGER,            -- 运行时间 (秒)
    boot_time INTEGER,         -- 启动时间 (Unix时间戳)
    
    -- 进程信息
    process_count INTEGER,     -- 进程数量
    
    -- 数据来源和时间
    data_source TEXT DEFAULT 'agent' CHECK (data_source IN ('agent', 'ssh')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
);

-- 连通性测试结果表
CREATE TABLE IF NOT EXISTS connectivity_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    
    -- 测试配置
    test_type TEXT NOT NULL CHECK (test_type IN ('ping', 'http', 'https', 'tcp')),
    test_target TEXT NOT NULL,  -- 测试目标 (IP或域名)
    test_port INTEGER,          -- 测试端口
    
    -- 测试节点
    test_node TEXT NOT NULL,    -- 测试节点 (hkg, sin, nrt等)
    test_region TEXT,           -- 测试地区名称
    
    -- 测试结果
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'error')),
    latency REAL,              -- 延迟 (毫秒)
    packet_loss REAL,          -- 丢包率 (0-100)
    response_code INTEGER,     -- HTTP响应码
    error_message TEXT,        -- 错误信息
    
    -- 时间信息
    test_duration REAL,        -- 测试耗时 (毫秒)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
);

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT,          -- 服务器名称 (NULL表示全局规则)
    
    -- 规则配置
    rule_name TEXT NOT NULL,
    metric_name TEXT NOT NULL, -- 监控指标名称
    operator TEXT NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '==')),
    threshold REAL NOT NULL,   -- 阈值
    duration INTEGER DEFAULT 300, -- 持续时间 (秒)
    
    -- 告警配置
    severity TEXT DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
    enabled BOOLEAN DEFAULT 1,
    
    -- 通知配置
    notification_channels TEXT, -- 通知渠道 (JSON数组)
    
    -- 时间信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
);

-- 告警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    rule_id INTEGER NOT NULL,
    
    -- 告警信息
    alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    threshold REAL NOT NULL,
    message TEXT NOT NULL,
    
    -- 状态信息
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged')),
    resolved_at DATETIME,
    acknowledged_at DATETIME,
    
    -- 时间信息
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- 操作类型
    target_type TEXT,             -- 目标类型 (server, rule等)
    target_id TEXT,               -- 目标ID
    operation_data TEXT,          -- 操作数据 (JSON)
    result TEXT,                  -- 操作结果
    error_message TEXT,           -- 错误信息
    ip_address TEXT,              -- 操作IP
    user_agent TEXT,              -- 用户代理
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_last_seen ON servers(last_seen);
CREATE INDEX IF NOT EXISTS idx_monitor_data_server_timestamp ON monitor_data(server_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_monitor_data_timestamp ON monitor_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_connectivity_tests_server_timestamp ON connectivity_tests(server_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_history_server_status ON alert_history(server_name, status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('monitor_interval', '60', 'number', '默认监控间隔(秒)'),
('ssh_timeout', '10', 'number', 'SSH连接超时时间(秒)'),
('agent_timeout', '120', 'number', 'Agent离线判定时间(秒)'),
('max_history_days', '30', 'number', '历史数据保留天数'),
('enable_alerts', 'true', 'boolean', '是否启用告警'),
('default_test_nodes', '["hkg", "sin", "nrt"]', 'json', '默认测试节点'),
('encryption_algorithm', 'AES-GCM', 'string', '加密算法'),
('api_rate_limit', '1000', 'number', 'API请求限制(每小时)');
