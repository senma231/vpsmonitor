#!/bin/bash

# VPS Monitor Agent 一键安装脚本
# 支持 Linux 和 macOS 系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
REPO_URL="https://github.com/senma231/vpsmonitor"
INSTALL_DIR="/opt/vps-monitor"
SERVICE_NAME="vps-monitor-agent"
CONFIG_FILE="/etc/vps-monitor/config.json"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测系统信息
detect_system() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [[ $(uname -m) == "x86_64" ]]; then
            ARCH="amd64"
        elif [[ $(uname -m) == "aarch64" ]]; then
            ARCH="arm64"
        else
            log_error "不支持的架构: $(uname -m)"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="darwin"
        if [[ $(uname -m) == "x86_64" ]]; then
            ARCH="amd64"
        elif [[ $(uname -m) == "arm64" ]]; then
            ARCH="arm64"
        else
            log_error "不支持的架构: $(uname -m)"
            exit 1
        fi
    else
        log_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    
    log_info "检测到系统: $OS-$ARCH"
}

# 检查权限
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要 root 权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 获取最新版本
get_latest_version() {
    log_info "获取最新版本信息..."
    LATEST_VERSION=$(curl -s "https://api.github.com/repos/senma231/vpsmonitor/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [[ -z "$LATEST_VERSION" ]]; then
        log_warning "无法获取最新版本，使用默认版本 v1.0.0"
        LATEST_VERSION="v1.0.0"
    fi
    log_info "最新版本: $LATEST_VERSION"
}

# 下载Agent
download_agent() {
    log_info "下载 VPS Monitor Agent..."
    
    DOWNLOAD_URL="$REPO_URL/releases/download/$LATEST_VERSION/vps-agent-$OS-$ARCH"
    TEMP_FILE="/tmp/vps-agent"
    
    if command -v curl &> /dev/null; then
        curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$TEMP_FILE" "$DOWNLOAD_URL"
    else
        log_error "需要 curl 或 wget 来下载文件"
        exit 1
    fi
    
    if [[ ! -f "$TEMP_FILE" ]]; then
        log_error "下载失败"
        exit 1
    fi
    
    log_success "下载完成"
}

# 安装Agent
install_agent() {
    log_info "安装 VPS Monitor Agent..."
    
    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    # 复制可执行文件
    cp "$TEMP_FILE" "$INSTALL_DIR/vps-agent"
    chmod +x "$INSTALL_DIR/vps-agent"
    
    # 创建符号链接
    ln -sf "$INSTALL_DIR/vps-agent" "/usr/local/bin/vps-agent"
    
    log_success "Agent 安装完成"
}

# 创建配置文件
create_config() {
    log_info "创建配置文件..."
    
    # 获取用户输入
    read -p "请输入监控服务器地址 (例: wss://api.your-domain.workers.dev/ws): " SERVER_URL
    read -p "请输入认证密钥: " AUTH_SECRET
    read -p "请输入服务器名称 [$(hostname)]: " SERVER_NAME
    
    SERVER_NAME=${SERVER_NAME:-$(hostname)}
    
    # 创建配置文件
    cat > "$CONFIG_FILE" << EOF
{
  "server_url": "$SERVER_URL",
  "auth_secret": "$AUTH_SECRET",
  "server_name": "$SERVER_NAME",
  "monitor_interval": 60,
  "retry_interval": 30,
  "max_retries": 5,
  "log_level": "info",
  "log_file": "/var/log/vps-monitor-agent.log"
}
EOF
    
    log_success "配置文件已创建: $CONFIG_FILE"
}

# 创建systemd服务
create_service() {
    if [[ "$OS" != "linux" ]]; then
        log_warning "非Linux系统，跳过systemd服务创建"
        return
    fi
    
    log_info "创建 systemd 服务..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=VPS Monitor Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/vps-agent --config=$CONFIG_FILE
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新加载systemd
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    log_success "systemd 服务已创建"
}

# 创建launchd服务 (macOS)
create_launchd_service() {
    if [[ "$OS" != "darwin" ]]; then
        return
    fi
    
    log_info "创建 launchd 服务..."
    
    PLIST_FILE="/Library/LaunchDaemons/com.vpsmonitor.agent.plist"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vpsmonitor.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/vps-agent</string>
        <string>--config=$CONFIG_FILE</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/vps-monitor-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/vps-monitor-agent.log</string>
</dict>
</plist>
EOF
    
    launchctl load "$PLIST_FILE"
    
    log_success "launchd 服务已创建"
}

# 启动服务
start_service() {
    log_info "启动 VPS Monitor Agent..."
    
    if [[ "$OS" == "linux" ]]; then
        systemctl start "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
    elif [[ "$OS" == "darwin" ]]; then
        launchctl start com.vpsmonitor.agent
    fi
    
    log_success "服务已启动"
}

# 清理临时文件
cleanup() {
    rm -f "$TEMP_FILE"
}

# 显示使用说明
show_usage() {
    echo "VPS Monitor Agent 安装完成！"
    echo ""
    echo "管理命令:"
    if [[ "$OS" == "linux" ]]; then
        echo "  启动服务: systemctl start $SERVICE_NAME"
        echo "  停止服务: systemctl stop $SERVICE_NAME"
        echo "  重启服务: systemctl restart $SERVICE_NAME"
        echo "  查看状态: systemctl status $SERVICE_NAME"
        echo "  查看日志: journalctl -u $SERVICE_NAME -f"
    elif [[ "$OS" == "darwin" ]]; then
        echo "  启动服务: launchctl start com.vpsmonitor.agent"
        echo "  停止服务: launchctl stop com.vpsmonitor.agent"
        echo "  查看日志: tail -f /var/log/vps-monitor-agent.log"
    fi
    echo ""
    echo "配置文件: $CONFIG_FILE"
    echo "可执行文件: $INSTALL_DIR/vps-agent"
    echo ""
    echo "如需卸载，请运行: curl -fsSL $REPO_URL/raw/main/scripts/uninstall-agent.sh | bash"
}

# 主函数
main() {
    log_info "开始安装 VPS Monitor Agent..."
    
    detect_system
    check_permissions
    get_latest_version
    download_agent
    install_agent
    create_config
    
    if [[ "$OS" == "linux" ]]; then
        create_service
    elif [[ "$OS" == "darwin" ]]; then
        create_launchd_service
    fi
    
    start_service
    cleanup
    
    log_success "安装完成！"
    show_usage
}

# 错误处理
trap cleanup EXIT

# 运行主函数
main "$@"
