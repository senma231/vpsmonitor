#!/bin/bash

# VPS Monitor 网络连接诊断脚本
# 用于检测IPv4/IPv6连接问题和网络状态

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

# 测试目标
API_DOMAIN="vps-monitor-api.gp96123.workers.dev"
WEB_DOMAIN="vps.senmago.tech"
GITHUB_DOMAIN="api.github.com"

echo "🔍 VPS Monitor 网络连接诊断"
echo "================================"
echo ""

# 1. 检查基本网络工具
log_info "检查网络工具..."
if command -v curl &> /dev/null; then
    log_success "curl 已安装: $(curl --version | head -1)"
else
    log_error "curl 未安装"
fi

if command -v wget &> /dev/null; then
    log_success "wget 已安装: $(wget --version | head -1)"
else
    log_warning "wget 未安装"
fi

if command -v nslookup &> /dev/null; then
    log_success "nslookup 已安装"
else
    log_warning "nslookup 未安装"
fi

echo ""

# 2. 检查IPv4/IPv6支持
log_info "检查IP协议支持..."

# 测试IPv4连接
if curl -4 -s --connect-timeout 5 "http://ipv4.google.com" > /dev/null 2>&1; then
    log_success "IPv4 连接正常"
    IPV4_SUPPORT=true
else
    log_error "IPv4 连接失败"
    IPV4_SUPPORT=false
fi

# 测试IPv6连接
if curl -6 -s --connect-timeout 5 "http://ipv6.google.com" > /dev/null 2>&1; then
    log_success "IPv6 连接正常"
    IPV6_SUPPORT=true
else
    log_warning "IPv6 连接失败或不支持"
    IPV6_SUPPORT=false
fi

echo ""

# 3. DNS解析测试
log_info "DNS解析测试..."

for domain in "$API_DOMAIN" "$WEB_DOMAIN" "$GITHUB_DOMAIN"; do
    log_info "解析 $domain..."
    
    if nslookup "$domain" > /dev/null 2>&1; then
        # 获取IPv4地址
        ipv4=$(nslookup "$domain" | grep -A 10 "非权威应答\|Non-authoritative answer" | grep "Address:" | grep -v ":" | head -1 | awk '{print $2}')
        if [[ -z "$ipv4" ]]; then
            ipv4=$(nslookup "$domain" | grep -E "^Address: [0-9]" | head -1 | awk '{print $2}')
        fi
        
        if [[ -n "$ipv4" ]]; then
            log_success "  IPv4: $ipv4"
        else
            log_warning "  IPv4: 未找到"
        fi
        
        # 获取IPv6地址
        ipv6=$(nslookup "$domain" | grep -E "Address.*:" | grep ":" | head -1 | awk '{print $2}')
        if [[ -n "$ipv6" ]]; then
            log_info "  IPv6: $ipv6"
        fi
    else
        log_error "  DNS解析失败"
    fi
done

echo ""

# 4. 连接测试
log_info "连接测试..."

test_connection() {
    local url="$1"
    local name="$2"
    local force_ipv="$3"
    
    log_info "测试 $name ($url)..."
    
    local curl_opts="-s --connect-timeout 10"
    if [[ "$force_ipv" == "4" ]]; then
        curl_opts="$curl_opts -4"
    elif [[ "$force_ipv" == "6" ]]; then
        curl_opts="$curl_opts -6"
    fi
    
    if curl $curl_opts "$url" > /dev/null 2>&1; then
        log_success "  连接成功"
        return 0
    else
        log_error "  连接失败"
        return 1
    fi
}

# 测试API连接
test_connection "https://$API_DOMAIN/health" "API健康检查" ""
if [[ "$IPV4_SUPPORT" == "true" ]]; then
    test_connection "https://$API_DOMAIN/health" "API健康检查 (IPv4)" "4"
fi
if [[ "$IPV6_SUPPORT" == "true" ]]; then
    test_connection "https://$API_DOMAIN/health" "API健康检查 (IPv6)" "6"
fi

# 测试Web界面
test_connection "https://$WEB_DOMAIN" "Web管理界面" ""
if [[ "$IPV4_SUPPORT" == "true" ]]; then
    test_connection "https://$WEB_DOMAIN" "Web管理界面 (IPv4)" "4"
fi

# 测试GitHub API
test_connection "https://$GITHUB_DOMAIN" "GitHub API" ""
if [[ "$IPV4_SUPPORT" == "true" ]]; then
    test_connection "https://$GITHUB_DOMAIN" "GitHub API (IPv4)" "4"
fi

echo ""

# 5. 公网IP检测
log_info "公网IP检测..."

get_public_ip() {
    local force_ipv="$1"
    local ip=""
    
    for service in "ifconfig.me" "ipinfo.io/ip" "icanhazip.com"; do
        local curl_opts="-s --connect-timeout 5"
        if [[ "$force_ipv" == "4" ]]; then
            curl_opts="$curl_opts -4"
        elif [[ "$force_ipv" == "6" ]]; then
            curl_opts="$curl_opts -6"
        fi
        
        ip=$(curl $curl_opts "http://$service" 2>/dev/null | tr -d '\n\r')
        
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return 0
        fi
    done
    
    return 1
}

if public_ipv4=$(get_public_ip "4"); then
    log_success "公网IPv4: $public_ipv4"
else
    log_warning "无法获取公网IPv4"
fi

if [[ "$IPV6_SUPPORT" == "true" ]]; then
    if public_ipv6=$(get_public_ip "6"); then
        log_success "公网IPv6: $public_ipv6"
    else
        log_warning "无法获取公网IPv6"
    fi
fi

echo ""

# 6. 建议
log_info "诊断建议..."

if [[ "$IPV4_SUPPORT" == "false" ]]; then
    log_error "IPv4连接不可用，请检查网络配置"
fi

if [[ "$IPV6_SUPPORT" == "false" ]]; then
    log_warning "IPv6不可用，建议使用IPv4安装脚本"
    echo "  使用命令: curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash"
fi

if [[ "$IPV4_SUPPORT" == "true" ]]; then
    log_success "网络环境正常，可以使用安装脚本"
    echo "  推荐命令: curl -4 -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/quick-install.sh | sudo bash"
fi

echo ""
echo "🎯 诊断完成！"
