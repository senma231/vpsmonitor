#!/bin/bash

# 修复当前服务器的agent问题
# 下载Python agent并替换无效的二进制文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查权限
if [[ $EUID -ne 0 ]]; then
    log_error "此脚本需要 root 权限运行"
    exit 1
fi

log_info "修复VPS Monitor Agent..."

# 停止现有服务
log_info "停止现有服务..."
systemctl stop vps-monitor-agent || true

# 检查Python
if ! command -v python3 &> /dev/null; then
    log_info "安装Python3..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y python3 python3-pip
    elif command -v yum &> /dev/null; then
        yum install -y python3 python3-pip
    fi
fi

# 安装Python依赖
log_info "安装Python依赖..."
pip3 install requests psutil || pip install requests psutil

# 下载Python agent
log_info "下载Python agent..."
mkdir -p /opt/vps-monitor

# 创建Python agent文件
cat > /opt/vps-monitor/vps-agent.py << 'EOF'
#!/usr/bin/env python3
"""
VPS Monitor Agent - 简单版本
"""

import json
import time
import sys
import os
import argparse
import logging
import requests
import psutil
import socket
from datetime import datetime

class VPSAgent:
    def __init__(self, config_file):
        self.config = self.load_config(config_file)
        self.setup_logging()
        self.server_name = self.config.get('server_name', socket.gethostname())
        self.api_url = self.config.get('api_url', 'https://vps-monitor-api.gp96123.workers.dev')
        self.monitor_interval = self.config.get('monitor_interval', 60)
        
    def load_config(self, config_file):
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            sys.exit(1)
    
    def setup_logging(self):
        log_file = self.config.get('log_file', '/var/log/vps-monitor-agent.log')
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def get_system_info(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'timestamp': datetime.now().isoformat(),
                'server_name': self.server_name,
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'disk_percent': (disk.used / disk.total) * 100,
                'status': 'online'
            }
        except Exception as e:
            self.logger.error(f"Error collecting system info: {e}")
            return None
    
    def send_data(self, data):
        try:
            url = f"{self.api_url}/api/servers/{self.server_name}/data"
            response = requests.post(url, json=data, timeout=30)
            
            if response.status_code == 200:
                self.logger.info("Data sent successfully")
                return True
            else:
                self.logger.warning(f"Failed to send data: {response.status_code}")
                return False
        except Exception as e:
            self.logger.error(f"Error sending data: {e}")
            return False
    
    def register_server(self):
        try:
            # 获取公网IP
            try:
                response = requests.get('http://ipinfo.io/ip', timeout=10)
                public_ip = response.text.strip()
            except:
                public_ip = socket.gethostbyname(socket.gethostname())
            
            register_data = {
                'name': self.server_name,
                'ip_address': public_ip,
                'location': 'Auto-detected',
                'description': 'Python Agent Auto-registered'
            }
            
            url = f"{self.api_url}/api/agent/register"
            response = requests.post(url, json=register_data, timeout=30)
            
            if response.status_code == 200:
                self.logger.info(f"Server registered: {self.server_name}")
                return True
            else:
                self.logger.warning(f"Registration failed: {response.status_code}")
                return False
        except Exception as e:
            self.logger.error(f"Error registering: {e}")
            return False
    
    def run(self):
        self.logger.info(f"Starting VPS Monitor Agent for {self.server_name}")
        
        # 注册服务器
        self.register_server()
        
        while True:
            try:
                system_info = self.get_system_info()
                if system_info:
                    self.send_data(system_info)
                
                time.sleep(self.monitor_interval)
                
            except KeyboardInterrupt:
                self.logger.info("Agent stopped")
                break
            except Exception as e:
                self.logger.error(f"Error: {e}")
                time.sleep(30)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    
    agent = VPSAgent(args.config)
    agent.run()

if __name__ == '__main__':
    main()
EOF

# 设置权限
chmod +x /opt/vps-monitor/vps-agent.py

# 创建启动脚本
cat > /opt/vps-monitor/vps-agent << 'EOF'
#!/bin/bash
cd /opt/vps-monitor
exec python3 vps-agent.py "$@"
EOF
chmod +x /opt/vps-monitor/vps-agent

# 更新systemd服务
cat > /etc/systemd/system/vps-monitor-agent.service << 'EOF'
[Unit]
Description=VPS Monitor Python Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vps-monitor
ExecStart=/opt/vps-monitor/vps-agent --config=/etc/vps-monitor/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 重新加载并启动服务
systemctl daemon-reload
systemctl enable vps-monitor-agent
systemctl start vps-monitor-agent

log_success "Agent修复完成！"

# 显示状态
sleep 2
systemctl status vps-monitor-agent --no-pager

log_info "查看日志: journalctl -u vps-monitor-agent -f"
log_info "管理界面: https://vps.senmago.tech"
