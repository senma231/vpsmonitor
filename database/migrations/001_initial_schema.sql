-- Migration 001: Initial Schema
-- 创建初始数据库结构

-- 服务器信息表
CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    due_time INTEGER,
    buy_url TEXT,
    seller TEXT,
    price TEXT,
    ip_address TEXT,
    port INTEGER DEFAULT 22,
    encrypted_credentials TEXT,
    monitor_method TEXT DEFAULT 'agent' CHECK (monitor_method IN ('agent', 'ssh', 'both')),
    monitor_interval INTEGER DEFAULT 60,
    status TEXT DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'error', 'unknown')),
    last_seen DATETIME,
    last_agent_seen DATETIME,
    last_ssh_check DATETIME,
    location TEXT,
    region TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 监控数据表
CREATE TABLE IF NOT EXISTS monitor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    platform TEXT,
    platform_version TEXT,
    arch TEXT,
    virtualization TEXT,
    cpu_info TEXT,
    cpu_usage REAL,
    cpu_cores INTEGER,
    memory_total INTEGER,
    memory_used INTEGER,
    memory_usage REAL,
    swap_total INTEGER,
    swap_used INTEGER,
    swap_usage REAL,
    disk_total INTEGER,
    disk_used INTEGER,
    disk_usage REAL,
    network_in_transfer INTEGER,
    network_out_transfer INTEGER,
    network_in_speed INTEGER,
    network_out_speed INTEGER,
    load_1 REAL,
    load_5 REAL,
    load_15 REAL,
    uptime INTEGER,
    boot_time INTEGER,
    process_count INTEGER,
    data_source TEXT DEFAULT 'agent' CHECK (data_source IN ('agent', 'ssh')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
);

-- 连通性测试表
CREATE TABLE IF NOT EXISTS connectivity_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN ('ping', 'http', 'https', 'tcp')),
    test_target TEXT NOT NULL,
    test_port INTEGER,
    test_node TEXT NOT NULL,
    test_region TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'error')),
    latency REAL,
    packet_loss REAL,
    response_code INTEGER,
    error_message TEXT,
    test_duration REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_last_seen ON servers(last_seen);
CREATE INDEX IF NOT EXISTS idx_monitor_data_server_timestamp ON monitor_data(server_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_connectivity_tests_server_timestamp ON connectivity_tests(server_name, timestamp);

-- 插入默认配置
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('monitor_interval', '60', 'number', '默认监控间隔(秒)'),
('ssh_timeout', '10', 'number', 'SSH连接超时时间(秒)'),
('agent_timeout', '120', 'number', 'Agent离线判定时间(秒)'),
('max_history_days', '30', 'number', '历史数据保留天数'),
('enable_alerts', 'true', 'boolean', '是否启用告警'),
('default_test_nodes', '["hkg", "sin", "nrt"]', 'json', '默认测试节点'),
('encryption_algorithm', 'AES-GCM', 'string', '加密算法'),
('api_rate_limit', '1000', 'number', 'API请求限制(每小时)');
