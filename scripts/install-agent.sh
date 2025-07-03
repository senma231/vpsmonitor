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

# 默认管理端配置 - 用户可以通过环境变量覆盖
DEFAULT_API_URL="${VPS_MONITOR_API_URL:-https://vps-monitor-api.gp96123.workers.dev}"
DEFAULT_WS_URL="${VPS_MONITOR_WS_URL:-wss://vps-monitor-api.gp96123.workers.dev/ws}"
DEFAULT_WEB_URL="${VPS_MONITOR_WEB_URL:-https://vps.senmago.tech}"
AUTO_REGISTER="${VPS_MONITOR_AUTO_REGISTER:-true}"

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

# 获取公网IP
get_public_ip() {
    local ip=""

    # 尝试多个IP检测服务
    for service in "ifconfig.me" "ipinfo.io/ip" "icanhazip.com" "ident.me"; do
        if command -v curl &> /dev/null; then
            ip=$(curl -s --connect-timeout 5 "http://$service" 2>/dev/null | tr -d '\n\r')
        elif command -v wget &> /dev/null; then
            ip=$(wget -qO- --timeout=5 "http://$service" 2>/dev/null | tr -d '\n\r')
        fi

        # 验证IP格式
        if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$ip"
            return 0
        fi
    done

    log_warning "无法获取公网IP，将使用本地IP"
    hostname -I | awk '{print $1}'
}

# 自动注册到管理端
auto_register_server() {
    if [[ "$AUTO_REGISTER" != "true" ]]; then
        return 0
    fi

    log_info "自动注册服务器到管理端..."

    local public_ip=$(get_public_ip)
    local server_name="${SERVER_NAME:-$(hostname)}"
    local location="${SERVER_LOCATION:-Auto-detected}"

    # 构建注册数据
    local register_data=$(cat << EOF
{
  "name": "$server_name",
  "ip_address": "$public_ip",
  "location": "$location",
  "description": "Auto-registered by agent installer",
  "monitor_method": "both",
  "status": "unknown"
}
EOF
)

    # 发送注册请求到专用的agent注册端点
    local response=""
    if command -v curl &> /dev/null; then
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$register_data" \
            "$DEFAULT_API_URL/api/agent/register" 2>/dev/null)
    elif command -v wget &> /dev/null; then
        response=$(wget -qO- \
            --header="Content-Type: application/json" \
            --post-data="$register_data" \
            "$DEFAULT_API_URL/api/agent/register" 2>/dev/null)
    fi

    if [[ $? -eq 0 ]] && [[ -n "$response" ]]; then
        log_success "服务器已自动注册到管理端"
        log_info "服务器名称: $server_name"
        log_info "IP地址: $public_ip"
        log_info "管理端地址: $DEFAULT_WEB_URL"
    else
        log_warning "自动注册失败，请手动在管理端添加服务器"
        log_info "服务器信息:"
        log_info "  名称: $server_name"
        log_info "  IP: $public_ip"
        log_info "  管理端: $DEFAULT_WEB_URL"
    fi
}

# 创建配置文件
create_config() {
    log_info "创建配置文件..."

    # 检查是否有环境变量配置
    if [[ -n "$VPS_MONITOR_API_URL" ]] && [[ "$VPS_MONITOR_SKIP_INPUT" == "true" ]]; then
        log_info "使用环境变量配置，跳过交互输入"
        SERVER_URL="$DEFAULT_WS_URL"
        AUTH_SECRET="${VPS_MONITOR_AUTH_SECRET:-auto-generated-$(date +%s)}"
        SERVER_NAME="${VPS_MONITOR_SERVER_NAME:-$(hostname)}"
    else
        # 显示默认配置信息
        log_info "检测到默认管理端配置:"
        log_info "  API地址: $DEFAULT_API_URL"
        log_info "  WebSocket: $DEFAULT_WS_URL"
        log_info "  管理界面: $DEFAULT_WEB_URL"
        echo ""

        # 询问是否使用默认配置
        read -p "是否使用默认配置? [Y/n]: " use_default
        use_default=${use_default:-Y}

        if [[ "$use_default" =~ ^[Yy]$ ]]; then
            SERVER_URL="$DEFAULT_WS_URL"
            AUTH_SECRET="auto-generated-$(date +%s)"
            read -p "请输入服务器名称 [$(hostname)]: " SERVER_NAME
            SERVER_NAME=${SERVER_NAME:-$(hostname)}

            # 询问服务器位置（可选）
            read -p "请输入服务器位置 (可选，如: 香港/新加坡/美国): " SERVER_LOCATION
        else
            # 手动配置
            read -p "请输入监控服务器WebSocket地址: " SERVER_URL
            read -p "请输入认证密钥 (可选): " AUTH_SECRET
            read -p "请输入服务器名称 [$(hostname)]: " SERVER_NAME
            read -p "请输入服务器位置 (可选): " SERVER_LOCATION

            SERVER_NAME=${SERVER_NAME:-$(hostname)}
            AUTH_SECRET=${AUTH_SECRET:-"auto-generated-$(date +%s)"}
        fi
    fi

    # 创建配置文件
    cat > "$CONFIG_FILE" << EOF
{
  "server_url": "$SERVER_URL",
  "auth_secret": "$AUTH_SECRET",
  "server_name": "$SERVER_NAME",
  "api_url": "$DEFAULT_API_URL",
  "monitor_interval": 60,
  "retry_interval": 30,
  "max_retries": 5,
  "log_level": "info",
  "log_file": "/var/log/vps-monitor-agent.log"
}
EOF

    log_success "配置文件已创建: $CONFIG_FILE"

    # 尝试自动注册
    auto_register_server
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
    echo ""
    echo "🎉 VPS Monitor Agent 安装完成！"
    echo ""
    echo "📊 管理界面: $DEFAULT_WEB_URL"
    echo "🔧 配置文件: $CONFIG_FILE"
    echo "📁 可执行文件: $INSTALL_DIR/vps-agent"
    echo ""
    echo "🛠 管理命令:"
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
    echo "📝 使用说明:"
    echo "  1. Agent已自动启动并连接到管理端"
    if [[ "$AUTO_REGISTER" == "true" ]]; then
        echo "  2. 服务器已自动注册到管理端"
        echo "  3. 请访问管理界面查看服务器状态"
    else
        echo "  2. 请手动在管理端添加此服务器"
        echo "  3. 服务器名称: ${SERVER_NAME:-$(hostname)}"
        echo "  4. 服务器IP: $(get_public_ip)"
    fi
    echo ""
    echo "🗑 如需卸载: curl -fsSL $REPO_URL/raw/main/scripts/uninstall-agent.sh | bash"
    echo ""
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
