#!/bin/bash

# VPS Monitor 环境设置脚本
# 用于快速设置开发和生产环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 生成随机密钥
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# 主函数
main() {
    log_info "开始设置 VPS Monitor 环境..."

    # 检查必需的命令
    log_info "检查依赖..."
    check_command "node"
    check_command "npm"
    check_command "git"
    check_command "openssl"

    # 检查Node.js版本
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js版本需要 >= $REQUIRED_VERSION，当前版本: $NODE_VERSION"
        exit 1
    fi

    log_success "依赖检查通过"

    # 安装Wrangler CLI
    log_info "安装 Wrangler CLI..."
    if ! command -v wrangler &> /dev/null; then
        npm install -g wrangler
        log_success "Wrangler CLI 安装完成"
    else
        log_info "Wrangler CLI 已安装"
    fi

    # 安装项目依赖
    log_info "安装项目依赖..."
    
    # 前端依赖
    log_info "安装前端依赖..."
    npm install
    
    # 后端依赖
    log_info "安装后端依赖..."
    cd workers
    npm install
    cd ..
    
    log_success "依赖安装完成"

    # 创建环境配置文件
    if [ ! -f .env ]; then
        log_info "创建环境配置文件..."
        cp .env.example .env
        
        # 生成密钥
        AUTH_SECRET=$(generate_secret)
        ENCRYPTION_KEY=$(generate_secret)
        ADMIN_PASSWORD=$(generate_secret)
        
        # 更新.env文件
        sed -i "s/your_strong_auth_secret/$AUTH_SECRET/g" .env
        sed -i "s/your_encryption_key_32_chars_long/$ENCRYPTION_KEY/g" .env
        sed -i "s/your_admin_password/$ADMIN_PASSWORD/g" .env
        
        log_success "环境配置文件已创建"
        log_warning "请编辑 .env 文件，填入你的 Cloudflare 配置信息"
    else
        log_info "环境配置文件已存在"
    fi

    # Cloudflare登录检查
    log_info "检查 Cloudflare 登录状态..."
    if ! wrangler whoami &> /dev/null; then
        log_warning "请先登录 Cloudflare:"
        echo "wrangler login"
        echo "或者设置 API Token:"
        echo "export CLOUDFLARE_API_TOKEN=your_token"
    else
        log_success "Cloudflare 已登录"
    fi

    # 创建Cloudflare资源
    read -p "是否创建 Cloudflare 资源? (D1数据库, KV存储) [y/N]: " create_resources
    if [[ $create_resources =~ ^[Yy]$ ]]; then
        log_info "创建 Cloudflare 资源..."
        
        # 创建D1数据库
        log_info "创建 D1 数据库..."
        cd workers
        DB_OUTPUT=$(wrangler d1 create vps-monitor 2>&1 || true)
        if echo "$DB_OUTPUT" | grep -q "database_id"; then
            DATABASE_ID=$(echo "$DB_OUTPUT" | grep "database_id" | cut -d'"' -f4)
            log_success "D1 数据库创建成功: $DATABASE_ID"
            
            # 更新wrangler.toml
            sed -i "s/your-database-id/$DATABASE_ID/g" wrangler.toml
        else
            log_warning "D1 数据库创建失败或已存在"
        fi
        
        # 创建KV命名空间
        log_info "创建 KV 命名空间..."
        KV_OUTPUT=$(wrangler kv:namespace create "CACHE" 2>&1 || true)
        if echo "$KV_OUTPUT" | grep -q "id"; then
            KV_ID=$(echo "$KV_OUTPUT" | grep "id" | cut -d'"' -f4)
            log_success "KV 命名空间创建成功: $KV_ID"
            
            # 更新wrangler.toml
            sed -i "s/your-kv-namespace-id/$KV_ID/g" wrangler.toml
        else
            log_warning "KV 命名空间创建失败或已存在"
        fi
        
        cd ..
    fi

    # 数据库初始化
    read -p "是否初始化数据库? [y/N]: " init_db
    if [[ $init_db =~ ^[Yy]$ ]]; then
        log_info "初始化数据库..."
        cd workers
        wrangler d1 execute vps-monitor --file=../database/schema.sql
        log_success "数据库初始化完成"
        cd ..
    fi

    # 设置Git hooks
    log_info "设置 Git hooks..."
    if [ -d .git ]; then
        # 创建pre-commit hook
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# 运行代码检查
npm run lint
if [ $? -ne 0 ]; then
    echo "代码检查失败，请修复后再提交"
    exit 1
fi
EOF
        chmod +x .git/hooks/pre-commit
        log_success "Git hooks 设置完成"
    fi

    # 完成设置
    log_success "环境设置完成！"
    echo ""
    echo "下一步操作:"
    echo "1. 编辑 .env 文件，填入你的配置信息"
    echo "2. 运行开发服务器:"
    echo "   npm run dev          # 前端开发服务器"
    echo "   npm run dev:workers  # 后端开发服务器"
    echo "3. 部署到生产环境:"
    echo "   git add . && git commit -m 'Initial setup' && git push"
    echo ""
    echo "更多信息请查看 README.md"
}

# 运行主函数
main "$@"
