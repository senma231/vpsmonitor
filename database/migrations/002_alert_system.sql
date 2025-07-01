-- Migration 002: Alert System
-- 添加告警系统相关表

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT,
    rule_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '==')),
    threshold REAL NOT NULL,
    duration INTEGER DEFAULT 300,
    severity TEXT DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
    enabled BOOLEAN DEFAULT 1,
    notification_channels TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE
);

-- 告警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    rule_id INTEGER NOT NULL,
    alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    threshold REAL NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged')),
    resolved_at DATETIME,
    acknowledged_at DATETIME,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_name) REFERENCES servers(name) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    operation_data TEXT,
    result TEXT,
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_alert_rules_server ON alert_rules(server_name);
CREATE INDEX IF NOT EXISTS idx_alert_history_server_status ON alert_history(server_name, status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp);

-- 插入默认告警规则
INSERT OR IGNORE INTO alert_rules (server_name, rule_name, metric_name, operator, threshold, severity, enabled) VALUES
(NULL, 'CPU使用率过高', 'cpu_usage', '>', 90.0, 'warning', 1),
(NULL, 'CPU使用率严重过高', 'cpu_usage', '>', 95.0, 'critical', 1),
(NULL, '内存使用率过高', 'memory_usage', '>', 90.0, 'warning', 1),
(NULL, '内存使用率严重过高', 'memory_usage', '>', 95.0, 'critical', 1),
(NULL, '磁盘使用率过高', 'disk_usage', '>', 90.0, 'warning', 1),
(NULL, '磁盘使用率严重过高', 'disk_usage', '>', 95.0, 'critical', 1),
(NULL, '服务器离线', 'status', '==', 0, 'critical', 1);
