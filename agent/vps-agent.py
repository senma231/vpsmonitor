#!/usr/bin/env python3
"""
VPS Monitor Agent
简单的Python监控代理，用于收集系统信息并上报到管理端
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
from pathlib import Path

class VPSAgent:
    def __init__(self, config_file):
        self.config = self.load_config(config_file)
        self.setup_logging()
        self.server_name = self.config.get('server_name', socket.gethostname())
        self.api_url = self.config.get('api_url', 'https://vps-monitor-api.gp96123.workers.dev')
        self.monitor_interval = self.config.get('monitor_interval', 60)
        
    def load_config(self, config_file):
        """加载配置文件"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            sys.exit(1)
    
    def setup_logging(self):
        """设置日志"""
        log_file = self.config.get('log_file', '/var/log/vps-monitor-agent.log')
        log_level = self.config.get('log_level', 'info').upper()
        
        # 确保日志目录存在
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, log_level),
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def get_system_info(self):
        """获取系统信息"""
        try:
            # CPU信息
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # 内存信息
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_total = memory.total
            memory_used = memory.used
            
            # 磁盘信息
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            disk_total = disk.total
            disk_used = disk.used
            
            # 网络信息
            network = psutil.net_io_counters()
            
            # 负载信息
            try:
                load_avg = os.getloadavg()
            except:
                load_avg = [0, 0, 0]
            
            # 运行时间
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            return {
                'timestamp': datetime.now().isoformat(),
                'server_name': self.server_name,
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'load_avg': load_avg
                },
                'memory': {
                    'percent': memory_percent,
                    'total': memory_total,
                    'used': memory_used,
                    'available': memory.available
                },
                'disk': {
                    'percent': disk_percent,
                    'total': disk_total,
                    'used': disk_used,
                    'free': disk.free
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                },
                'uptime': uptime,
                'status': 'online'
            }
        except Exception as e:
            self.logger.error(f"Error collecting system info: {e}")
            return None
    
    def send_data(self, data):
        """发送数据到管理端"""
        try:
            url = f"{self.api_url}/api/servers/{self.server_name}/data"
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'VPS-Monitor-Agent/1.0'
            }
            
            response = requests.post(url, json=data, headers=headers, timeout=30)
            
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
        """注册服务器到管理端"""
        try:
            # 获取本机IP
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            
            # 尝试获取公网IP
            try:
                response = requests.get('http://ipinfo.io/ip', timeout=10)
                public_ip = response.text.strip()
            except:
                public_ip = local_ip
            
            register_data = {
                'name': self.server_name,
                'ip_address': public_ip,
                'location': 'Auto-detected',
                'description': 'Python Agent Auto-registered'
            }
            
            url = f"{self.api_url}/api/agent/register"
            response = requests.post(url, json=register_data, timeout=30)
            
            if response.status_code == 200:
                self.logger.info(f"Server registered successfully: {self.server_name}")
                return True
            else:
                self.logger.warning(f"Failed to register server: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error registering server: {e}")
            return False
    
    def run(self):
        """运行监控循环"""
        self.logger.info(f"Starting VPS Monitor Agent for {self.server_name}")
        
        # 首次启动时注册服务器
        self.register_server()
        
        while True:
            try:
                # 收集系统信息
                system_info = self.get_system_info()
                
                if system_info:
                    # 发送数据
                    success = self.send_data(system_info)
                    
                    if success:
                        self.logger.debug("Monitoring data sent successfully")
                    else:
                        self.logger.warning("Failed to send monitoring data")
                
                # 等待下次监控
                time.sleep(self.monitor_interval)
                
            except KeyboardInterrupt:
                self.logger.info("Agent stopped by user")
                break
            except Exception as e:
                self.logger.error(f"Unexpected error: {e}")
                time.sleep(30)  # 出错时等待30秒再重试

def main():
    parser = argparse.ArgumentParser(description='VPS Monitor Agent')
    parser.add_argument('--config', required=True, help='Configuration file path')
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        print(f"Config file not found: {args.config}")
        sys.exit(1)
    
    agent = VPSAgent(args.config)
    agent.run()

if __name__ == '__main__':
    main()
