#!/bin/bash

# VPS Monitor Python Agent 安装脚本
# 使用Python实现的轻量级监控代理

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
REPO_URL="https://raw.githubusercontent.com/senma231/vpsmonitor/main"
INSTALL_DIR="/opt/vps-monitor"
SERVICE_NAME="vps-monitor-agent"
CONFIG_FILE="/etc/vps-monitor/config.json"

# 默认管理端配置
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

# 检查权限
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要 root 权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 检查Python环境
check_python() {
    log_info "检查Python环境..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        log_success "Python3 已安装: $(python3 --version)"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
        log_success "Python 已安装: $(python --version)"
    else
        log_error "Python 未安装，正在安装..."
        
        # 根据系统类型安装Python
        if command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y python3 python3-pip
            PYTHON_CMD="python3"
        elif command -v yum &> /dev/null; then
            yum install -y python3 python3-pip
            PYTHON_CMD="python3"
        elif command -v dnf &> /dev/null; then
            dnf install -y python3 python3-pip
            PYTHON_CMD="python3"
        else
            log_error "无法自动安装Python，请手动安装"
            exit 1
        fi
    fi
}

# 安装Python依赖
install_dependencies() {
    log_info "安装Python依赖..."
    
    # 安装pip（如果没有）
    if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
        log_info "安装pip..."
        if command -v apt-get &> /dev/null; then
            apt-get install -y python3-pip
        elif command -v yum &> /dev/null; then
            yum install -y python3-pip
        elif command -v dnf &> /dev/null; then
            dnf install -y python3-pip
        fi
    fi
    
    # 安装必需的Python包
    log_info "安装Python包: requests psutil..."
    if command -v pip3 &> /dev/null; then
        pip3 install requests psutil
    elif command -v pip &> /dev/null; then
        pip install requests psutil
    else
        log_error "无法找到pip，请手动安装依赖"
        exit 1
    fi
    
    log_success "Python依赖安装完成"
}

# 下载Agent
download_agent() {
    log_info "下载VPS Monitor Python Agent..."
    
    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    
    # 下载Python agent
    AGENT_URL="$REPO_URL/agent/vps-agent.py"
    
    if command -v curl &> /dev/null; then
        curl -4 -fsSL --connect-timeout 30 "$AGENT_URL" -o "$INSTALL_DIR/vps-agent.py"
    elif command -v wget &> /dev/null; then
        wget -4 --timeout=30 -qO "$INSTALL_DIR/vps-agent.py" "$AGENT_URL"
    else
        log_error "需要 curl 或 wget 来下载文件"
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/vps-agent.py" ]]; then
        log_error "下载失败"
        exit 1
    fi
    
    # 设置执行权限
    chmod +x "$INSTALL_DIR/vps-agent.py"
    
    # 创建启动脚本
    cat > "$INSTALL_DIR/vps-agent" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
exec $PYTHON_CMD vps-agent.py "\$@"
EOF
    chmod +x "$INSTALL_DIR/vps-agent"
    
    # 创建符号链接
    ln -sf "$INSTALL_DIR/vps-agent" "/usr/local/bin/vps-agent"
    
    log_success "Agent 下载完成"
}

# 获取公网IP
get_public_ip() {
    local ip=""
    
    # 尝试多个IP检测服务，强制使用IPv4
    for service in "ifconfig.me" "ipinfo.io/ip" "icanhazip.com" "ident.me"; do
        if command -v curl &> /dev/null; then
            ip=$(curl -4 -s --connect-timeout 5 "http://$service" 2>/dev/null | tr -d '\n\r')
        elif command -v wget &> /dev/null; then
            ip=$(wget -4 -qO- --timeout=5 "http://$service" 2>/dev/null | tr -d '\n\r')
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

# 强制重新注册到管理端
force_reregister_server() {
    log_info "强制重新注册服务器到管理端..."

    local public_ip=$(get_public_ip)
    local server_name="${SERVER_NAME:-$(hostname)}"
    local location="${SERVER_LOCATION:-Auto-detected}"

    # 构建注册数据
    local register_data=$(cat << EOF
{
  "name": "$server_name",
  "ip_address": "$public_ip",
  "location": "$location",
  "description": "Python Agent force re-registered"
}
EOF
)

    # 发送注册请求到专用的agent注册端点，强制使用IPv4
    local response=""
    if command -v curl &> /dev/null; then
        response=$(curl -4 -s --connect-timeout 10 -X POST \
            -H "Content-Type: application/json" \
            -d "$register_data" \
            "$DEFAULT_API_URL/api/agent/register" 2>/dev/null)
    elif command -v wget &> /dev/null; then
        response=$(wget -4 -qO- --timeout=10 \
            --header="Content-Type: application/json" \
            --post-data="$register_data" \
            "$DEFAULT_API_URL/api/agent/register" 2>/dev/null)
    fi

    if [[ $? -eq 0 ]] && [[ -n "$response" ]]; then
        log_success "服务器已重新注册到管理端"
        log_info "服务器名称: $server_name"
        log_info "IP地址: $public_ip"
        log_info "管理端地址: $DEFAULT_WEB_URL"

        # 重启Agent服务
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log_info "重启Agent服务..."
            systemctl restart "$SERVICE_NAME"
            log_success "Agent服务已重启"
        fi
    else
        log_error "重新注册失败，请检查网络连接和管理端状态"
    fi
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
  "description": "Python Agent auto-registered"
}
EOF
)
    
    # 发送注册请求到专用的agent注册端点，强制使用IPv4
    local response=""
    if command -v curl &> /dev/null; then
        response=$(curl -4 -s --connect-timeout 10 -X POST \
            -H "Content-Type: application/json" \
            -d "$register_data" \
            "$DEFAULT_API_URL/api/agent/register" 2>/dev/null)
    elif command -v wget &> /dev/null; then
        response=$(wget -4 -qO- --timeout=10 \
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
    
    # 创建配置目录
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    # 使用默认配置
    SERVER_NAME="${VPS_MONITOR_SERVER_NAME:-$(hostname)}"
    AUTH_SECRET="${VPS_MONITOR_AUTH_SECRET:-auto-generated-$(date +%s)}"
    
    # 创建配置文件
    cat > "$CONFIG_FILE" << EOF
{
  "server_url": "$DEFAULT_WS_URL",
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
    log_info "创建 systemd 服务..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=VPS Monitor Python Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
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

# 启动服务
start_service() {
    log_info "启动 VPS Monitor Agent..."
    
    systemctl start "$SERVICE_NAME"
    sleep 2
    systemctl status "$SERVICE_NAME" --no-pager
    
    log_success "服务已启动"
}

# 显示使用说明
show_usage() {
    echo ""
    echo "🎉 VPS Monitor Python Agent 安装完成！"
    echo ""
    echo "📊 管理界面: $DEFAULT_WEB_URL"
    echo "🔧 配置文件: $CONFIG_FILE"
    echo "📁 可执行文件: $INSTALL_DIR/vps-agent.py"
    echo ""
    echo "🛠 管理命令:"
    echo "  启动服务: systemctl start $SERVICE_NAME"
    echo "  停止服务: systemctl stop $SERVICE_NAME"
    echo "  重启服务: systemctl restart $SERVICE_NAME"
    echo "  查看状态: systemctl status $SERVICE_NAME"
    echo "  查看日志: journalctl -u $SERVICE_NAME -f"
    echo ""
    echo "📝 使用说明:"
    echo "  1. Agent已自动启动并连接到管理端"
    echo "  2. 服务器已自动注册到管理端"
    echo "  3. 请访问管理界面查看服务器状态"
    echo ""
}

# 显示帮助信息
show_help() {
    echo "VPS Monitor Python Agent 安装脚本"
    echo ""
    echo "用法:"
    echo "  $0                    # 安装Agent"
    echo "  $0 --reregister      # 重新注册到管理端"
    echo "  $0 --help           # 显示帮助信息"
    echo ""
}

# 主函数
main() {
    case "${1:-}" in
        --reregister)
            log_info "重新注册服务器到管理端..."
            force_reregister_server
            ;;
        --help)
            show_help
            ;;
        *)
            log_info "开始安装 VPS Monitor Python Agent..."

            check_permissions
            check_python
            install_dependencies
            download_agent
            create_config
            create_service
            start_service

            log_success "安装完成！"
            show_usage
            ;;
    esac
}

# 运行主函数
main "$@"
