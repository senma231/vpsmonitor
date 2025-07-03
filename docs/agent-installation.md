# VPS Monitor Agent 安装指南

## 🚀 一键安装（推荐）

### 方法1：完全自动化安装
```bash
# 下载并运行一键安装脚本（推荐使用IPv4）
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash
```

**特性：**
- ✅ 自动检测管理端地址
- ✅ 自动注册服务器到管理端
- ✅ 无需手动配置
- ✅ 自动启动监控服务
- ✅ 强制IPv4连接，避免IPv6问题

### 方法2：指定服务器信息

```bash
# 指定服务器名称（推荐使用IPv4）
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash -s "my-server"

# 指定服务器名称和位置（推荐使用IPv4）
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash -s "my-server" "香港"
```

## 🛠 手动安装

### 网络诊断（推荐先运行）

```bash
# 运行网络诊断脚本，检测IPv4/IPv6连接问题
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/network-test.sh | bash
```

### 下载安装脚本

```bash
# 推荐使用IPv4强制连接
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/install-agent.sh | sudo bash
```

### 环境变量配置
如果需要自定义配置，可以设置环境变量：

```bash
# 设置管理端地址（可选，默认已配置）
export VPS_MONITOR_API_URL="https://vps-monitor-api.gp96123.workers.dev"
export VPS_MONITOR_WS_URL="wss://vps-monitor-api.gp96123.workers.dev/ws"
export VPS_MONITOR_WEB_URL="https://vps.senmago.tech"

# 启用自动注册（可选，默认启用）
export VPS_MONITOR_AUTO_REGISTER="true"

# 跳过交互输入（可选）
export VPS_MONITOR_SKIP_INPUT="true"

# 自定义服务器信息
export VPS_MONITOR_SERVER_NAME="my-custom-server"
export VPS_MONITOR_SERVER_LOCATION="新加坡"

# 运行安装脚本
curl -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/install-agent.sh | sudo bash
```

## 📋 安装前准备

### 系统要求
- **操作系统**: Linux (Ubuntu/Debian/CentOS/RHEL) 或 macOS
- **架构**: x86_64 (amd64) 或 ARM64
- **权限**: root 权限
- **网络**: 能够访问互联网

### 防火墙配置
确保以下端口可以访问：
- **443**: HTTPS API 访问
- **80**: HTTP 重定向（可选）

## 🔧 安装后配置

### 查看服务状态
```bash
# Linux (systemd)
sudo systemctl status vps-monitor-agent
sudo journalctl -u vps-monitor-agent -f

# macOS (launchd)
sudo launchctl list | grep vpsmonitor
tail -f /var/log/vps-monitor-agent.log
```

### 管理服务
```bash
# Linux
sudo systemctl start vps-monitor-agent    # 启动
sudo systemctl stop vps-monitor-agent     # 停止
sudo systemctl restart vps-monitor-agent  # 重启
sudo systemctl enable vps-monitor-agent   # 开机自启

# macOS
sudo launchctl start com.vpsmonitor.agent
sudo launchctl stop com.vpsmonitor.agent
```

### 配置文件位置
- **配置文件**: `/etc/vps-monitor/config.json`
- **日志文件**: `/var/log/vps-monitor-agent.log`
- **可执行文件**: `/opt/vps-monitor/vps-agent`

## 🌐 管理界面

安装完成后，访问管理界面查看服务器状态：
- **管理界面**: https://vps.senmago.tech
- **服务器列表**: 自动注册的服务器会出现在列表中
- **监控数据**: 几分钟后开始显示监控数据

## 🔍 故障排除

### 常见问题

#### 1. IPv6连接问题（最常见）

```bash
# 问题：curl默认尝试IPv6导致连接超时
# 解决：强制使用IPv4连接

# 运行网络诊断
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/network-test.sh | bash

# 使用IPv4安装
curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash
```

#### 2. 安装脚本中断

```bash
# 检查网络连接（使用IPv4）
curl -4 -I https://api.github.com

# 手动下载脚本
wget -4 https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/install-agent.sh
sudo chmod +x install-agent.sh
sudo ./install-agent.sh
```

#### 3. 自动注册失败

```bash
# 检查API连接（使用IPv4）
curl -4 -I https://vps-monitor-api.gp96123.workers.dev/health

# 手动注册服务器（使用IPv4）
curl -4 -X POST https://vps-monitor-api.gp96123.workers.dev/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "ip_address": "YOUR_IP",
    "location": "YOUR_LOCATION"
  }'
```

#### 4. 服务启动失败
```bash
# 检查配置文件
sudo cat /etc/vps-monitor/config.json

# 检查权限
sudo chown root:root /opt/vps-monitor/vps-agent
sudo chmod +x /opt/vps-monitor/vps-agent

# 手动启动测试
sudo /opt/vps-monitor/vps-agent --config=/etc/vps-monitor/config.json
```

## 🗑 卸载

```bash
# 下载并运行卸载脚本
curl -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/uninstall-agent.sh | sudo bash
```

## 📞 技术支持

如果遇到问题，请：
1. 查看日志文件：`/var/log/vps-monitor-agent.log`
2. 检查服务状态：`systemctl status vps-monitor-agent`
3. 访问管理界面确认服务器状态
4. 提交Issue到GitHub仓库
