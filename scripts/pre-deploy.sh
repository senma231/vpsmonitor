#!/bin/bash

# VPS Monitor 预部署脚本
# 创建必要的Cloudflare资源

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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Wrangler是否已安装
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI 未安装"
        log_info "请运行: npm install -g wrangler"
        exit 1
    fi
    log_success "Wrangler CLI 已安装"
}

# 检查登录状态
check_login() {
    if ! wrangler whoami &> /dev/null; then
        log_error "未登录Cloudflare"
        log_info "请运行: wrangler login"
        exit 1
    fi
    log_success "Cloudflare 已登录"
}

# 创建D1数据库
create_d1_database() {
    log_info "创建 D1 数据库..."
    
    # 检查数据库是否已存在
    if wrangler d1 list | grep -q "vps-monitor"; then
        log_warning "D1 数据库 'vps-monitor' 已存在"
        DATABASE_ID=$(wrangler d1 list | grep "vps-monitor" | awk '{print $2}')
    else
        # 创建新数据库
        DB_OUTPUT=$(wrangler d1 create vps-monitor 2>&1)
        if echo "$DB_OUTPUT" | grep -q "database_id"; then
            DATABASE_ID=$(echo "$DB_OUTPUT" | grep "database_id" | cut -d'"' -f4)
            log_success "D1 数据库创建成功: $DATABASE_ID"
        else
            log_error "D1 数据库创建失败"
            echo "$DB_OUTPUT"
            exit 1
        fi
    fi
    
    echo "DATABASE_ID=$DATABASE_ID"
}

# 创建KV命名空间
create_kv_namespace() {
    log_info "创建 KV 命名空间..."
    
    # 检查KV命名空间是否已存在
    if wrangler kv:namespace list | grep -q "CACHE"; then
        log_warning "KV 命名空间 'CACHE' 已存在"
        KV_ID=$(wrangler kv:namespace list | grep "CACHE" | jq -r '.id')
    else
        # 创建新KV命名空间
        KV_OUTPUT=$(wrangler kv:namespace create "CACHE" 2>&1)
        if echo "$KV_OUTPUT" | grep -q "id"; then
            KV_ID=$(echo "$KV_OUTPUT" | grep "id" | cut -d'"' -f4)
            log_success "KV 命名空间创建成功: $KV_ID"
        else
            log_error "KV 命名空间创建失败"
            echo "$KV_OUTPUT"
            exit 1
        fi
    fi
    
    echo "KV_NAMESPACE_ID=$KV_ID"
}

# 更新wrangler.toml配置
update_wrangler_config() {
    log_info "更新 wrangler.toml 配置..."
    
    cd workers
    
    # 备份原配置
    cp wrangler.toml wrangler.toml.backup
    
    # 更新数据库ID
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-database-id/$DATABASE_ID/g" wrangler.toml
        sed -i '' "s/your-kv-namespace-id/$KV_ID/g" wrangler.toml
    else
        # Linux
        sed -i "s/your-database-id/$DATABASE_ID/g" wrangler.toml
        sed -i "s/your-kv-namespace-id/$KV_ID/g" wrangler.toml
    fi
    
    log_success "wrangler.toml 配置已更新"
    cd ..
}

# 初始化数据库
init_database() {
    log_info "初始化数据库结构..."
    
    cd workers
    
    # 执行数据库迁移
    if wrangler d1 execute vps-monitor --file=../database/schema.sql; then
        log_success "数据库初始化完成"
    else
        log_error "数据库初始化失败"
        exit 1
    fi
    
    cd ..
}

# 创建Pages项目（可选）
create_pages_project() {
    log_info "检查 Pages 项目..."
    
    # 这里只是提示，实际创建通过Dashboard或Git集成
    log_warning "请手动在 Cloudflare Dashboard 中创建 Pages 项目："
    echo "1. 访问 https://dash.cloudflare.com/"
    echo "2. 进入 Pages > Create a project"
    echo "3. 选择 Connect to Git"
    echo "4. 选择你的 GitHub 仓库"
    echo "5. 配置构建设置："
    echo "   - Framework: Vue"
    echo "   - Build command: npm run build"
    echo "   - Build output directory: dist"
}

# 生成环境变量模板
generate_env_template() {
    log_info "生成环境变量模板..."
    
    cat > .env.production << EOF
# 生产环境配置
# 请将这些值添加到 GitHub Secrets

CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
DATABASE_ID=$DATABASE_ID
KV_NAMESPACE_ID=$KV_ID

# 安全密钥（请生成随机值）
AUTH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

# API地址（替换为你的域名）
VITE_API_URL=https://api.your-domain.workers.dev
VITE_WS_URL=wss://api.your-domain.workers.dev/ws
EOF

    log_success "环境变量模板已生成: .env.production"
}

# 主函数
main() {
    log_info "开始预部署设置..."
    
    check_wrangler
    check_login
    create_d1_database
    create_kv_namespace
    update_wrangler_config
    init_database
    create_pages_project
    generate_env_template
    
    log_success "预部署设置完成！"
    echo ""
    echo "下一步："
    echo "1. 查看 .env.production 文件中的环境变量"
    echo "2. 将这些变量添加到 GitHub Secrets"
    echo "3. 在 Cloudflare Dashboard 中创建 Pages 项目"
    echo "4. 推送代码触发部署"
}

# 运行主函数
main "$@"
