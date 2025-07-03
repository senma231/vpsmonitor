#!/bin/bash

# VPS Monitor Agent 一键安装脚本
# 自动配置管理端地址，支持自动注册

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 显示安装信息
show_install_info() {
    echo ""
    echo "🚀 VPS Monitor Agent 一键安装"
    echo "================================"
    echo ""
    echo "📡 管理端配置:"
    echo "  API地址: https://vps-monitor-api.gp96123.workers.dev"
    echo "  管理界面: https://vps.senmago.tech"
    echo "  WebSocket: wss://vps-monitor-api.gp96123.workers.dev/ws"
    echo ""
    echo "✨ 功能特性:"
    echo "  ✅ 自动检测管理端地址"
    echo "  ✅ 自动注册服务器到管理端"
    echo "  ✅ 自动启动监控服务"
    echo "  ✅ 无需手动配置"
    echo ""
    
    # 检查是否为非交互模式
    if [[ "$VPS_MONITOR_AUTO_INSTALL" == "true" ]] || [[ ! -t 0 ]]; then
        log_info "自动安装模式，跳过确认"
        confirm="Y"
    else
        # 交互模式，带超时的确认
        echo -n "是否继续安装? [Y/n] (10秒后自动继续): "
        if read -t 10 confirm; then
            confirm=${confirm:-Y}
        else
            echo ""
            log_info "超时，自动继续安装"
            confirm="Y"
        fi
    fi

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "安装已取消"
        exit 0
    fi
}

# 检查权限
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要 root 权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 设置环境变量
setup_environment() {
    log_info "设置安装环境..."
    
    # 设置管理端地址
    export VPS_MONITOR_API_URL="https://vps-monitor-api.gp96123.workers.dev"
    export VPS_MONITOR_WS_URL="wss://vps-monitor-api.gp96123.workers.dev/ws"
    export VPS_MONITOR_WEB_URL="https://vps.senmago.tech"
    
    # 启用自动注册
    export VPS_MONITOR_AUTO_REGISTER="true"
    
    # 跳过交互输入
    export VPS_MONITOR_SKIP_INPUT="true"
    
    # 自动生成认证密钥
    export VPS_MONITOR_AUTH_SECRET="auto-$(date +%s)-$(hostname)"
    
    # 设置服务器名称（用户可以通过参数覆盖）
    if [[ -n "$1" ]]; then
        export VPS_MONITOR_SERVER_NAME="$1"
    else
        export VPS_MONITOR_SERVER_NAME="$(hostname)"
    fi
    
    # 设置服务器位置（用户可以通过参数覆盖）
    if [[ -n "$2" ]]; then
        export VPS_MONITOR_SERVER_LOCATION="$2"
    else
        export VPS_MONITOR_SERVER_LOCATION="Auto-detected"
    fi
    
    log_success "环境配置完成"
}

# 下载并执行安装脚本
run_installer() {
    log_info "下载并执行安装脚本..."
    
    local install_script_url="https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/install-agent.sh"
    local temp_script="/tmp/vps-monitor-install.sh"
    
    # 下载安装脚本，强制使用IPv4
    if command -v curl &> /dev/null; then
        curl -4 -fsSL --connect-timeout 30 "$install_script_url" -o "$temp_script"
    elif command -v wget &> /dev/null; then
        wget -4 --timeout=30 -qO "$temp_script" "$install_script_url"
    else
        log_error "需要 curl 或 wget 来下载安装脚本"
        exit 1
    fi
    
    # 检查下载是否成功
    if [[ ! -f "$temp_script" ]]; then
        log_error "下载安装脚本失败"
        exit 1
    fi
    
    # 执行安装脚本
    chmod +x "$temp_script"
    "$temp_script"
    
    # 清理临时文件
    rm -f "$temp_script"
}

# 显示完成信息
show_completion() {
    echo ""
    echo "🎉 安装完成！"
    echo "=============="
    echo ""
    echo "📊 管理界面: https://vps.senmago.tech"
    echo "🔧 服务器已自动注册并开始监控"
    echo ""
    echo "💡 提示:"
    echo "  - 请访问管理界面查看服务器状态"
    echo "  - 服务器信息可能需要几分钟才能显示"
    echo "  - 如有问题，请检查服务状态: systemctl status vps-monitor-agent"
    echo ""
}

# 主函数
main() {
    show_install_info
    check_permissions
    setup_environment "$@"
    run_installer
    show_completion
}

# 使用说明
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "VPS Monitor Agent 一键安装脚本"
    echo ""
    echo "用法:"
    echo "  $0 [服务器名称] [服务器位置]"
    echo ""
    echo "示例:"
    echo "  $0                          # 使用默认配置"
    echo "  $0 my-server               # 指定服务器名称"
    echo "  $0 my-server 香港          # 指定服务器名称和位置"
    echo ""
    echo "环境变量:"
    echo "  VPS_MONITOR_SERVER_NAME     # 服务器名称"
    echo "  VPS_MONITOR_SERVER_LOCATION # 服务器位置"
    echo ""
    exit 0
fi

# 运行主函数
main "$@"
