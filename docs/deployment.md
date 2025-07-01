# VPS Monitor 部署指南

本文档详细介绍如何将 VPS Monitor 部署到 Cloudflare 平台。

## 📋 部署前准备

### 1. 账号和权限

- **Cloudflare 账号**: 注册并验证 Cloudflare 账号
- **GitHub 账号**: 用于代码托管和自动部署
- **域名** (可选): 自定义域名，也可使用 Cloudflare 提供的免费域名

### 2. 获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "My Profile" > "API Tokens"
3. 点击 "Create Token"
4. 选择 "Custom token" 模板
5. 配置权限:
   - **Account**: Cloudflare Workers:Edit
   - **Zone**: Zone:Read, DNS:Edit
   - **Account**: Cloudflare Pages:Edit
   - **Account**: D1:Edit

### 3. 准备项目代码

由于这是全新开发的项目，你需要：

1. 确保项目代码已在本地目录中
2. 在GitHub上创建新仓库 `vpsmonitor`
3. 将代码推送到你的仓库

## 🚀 自动部署 (推荐)

### 1. 配置 GitHub Secrets

在你的 GitHub 仓库中，进入 Settings > Secrets and variables > Actions，添加以下密钥：

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
AUTH_SECRET=your_strong_auth_secret_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars_long
ADMIN_PASSWORD=your_admin_password
VITE_API_URL=https://api.your-domain.workers.dev
VITE_WS_URL=wss://api.your-domain.workers.dev/ws
```

### 2. 创建 Cloudflare 资源

运行以下命令创建必要的 Cloudflare 资源：

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create vps-monitor

# 创建 KV 命名空间
wrangler kv:namespace create "CACHE"
```

记录返回的 ID，并更新 `workers/wrangler.toml` 文件。

### 3. 触发部署

推送代码到 main 分支即可触发自动部署：

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

## 🔧 手动部署

### 1. 部署 Workers 后端

```bash
cd workers

# 安装依赖
npm install

# 部署到 Cloudflare Workers
npm run deploy

# 初始化数据库
npm run db:migrate

# 设置环境变量
echo "your_auth_secret" | wrangler secret put AUTH_SECRET
echo "your_encryption_key" | wrangler secret put ENCRYPTION_KEY
echo "your_admin_password" | wrangler secret put ADMIN_PASSWORD
```

### 2. 部署前端到 Pages

#### 方法一: 通过 Git 集成 (推荐)

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 "Pages" 页面
3. 点击 "Create a project"
4. 选择 "Connect to Git"
5. 选择你的 GitHub 仓库
6. 配置构建设置:
   - **Framework preset**: Vue
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (留空)

#### 方法二: 直接上传

```bash
# 构建前端
npm run build

# 使用 Wrangler 部署
wrangler pages deploy dist --project-name=vps-monitor
```

### 3. 配置环境变量

在 Cloudflare Pages 项目设置中添加环境变量：

```
VITE_API_URL=https://api.your-domain.workers.dev
VITE_WS_URL=wss://api.your-domain.workers.dev/ws
```

## 🌐 域名配置

### 1. Workers 自定义域名

1. 在 Cloudflare Dashboard 中进入 Workers & Pages
2. 选择你的 Worker
3. 进入 "Settings" > "Triggers"
4. 添加自定义域名: `api.your-domain.com`

### 2. Pages 自定义域名

1. 在 Pages 项目设置中
2. 进入 "Custom domains"
3. 添加域名: `monitor.your-domain.com`
4. 配置 DNS 记录 (自动完成)

## 📊 数据库管理

### 查看数据库

```bash
# 列出所有表
wrangler d1 execute vps-monitor --command="SELECT name FROM sqlite_master WHERE type='table';"

# 查看服务器列表
wrangler d1 execute vps-monitor --command="SELECT * FROM servers;"

# 查看监控数据
wrangler d1 execute vps-monitor --command="SELECT * FROM monitor_data ORDER BY timestamp DESC LIMIT 10;"
```

### 备份数据库

```bash
# 导出数据库
wrangler d1 export vps-monitor --output=backup.sql

# 恢复数据库
wrangler d1 execute vps-monitor --file=backup.sql
```

## 🔍 监控和日志

### 查看 Workers 日志

```bash
# 实时日志
wrangler tail

# 生产环境日志
wrangler tail --env production
```

### 查看 Pages 部署日志

在 Cloudflare Dashboard 的 Pages 项目中查看部署历史和日志。

## 🛠 故障排除

### 常见问题

1. **Workers 部署失败**
   - 检查 `wrangler.toml` 配置
   - 确认 API Token 权限
   - 查看错误日志

2. **Pages 构建失败**
   - 检查 Node.js 版本 (需要 >= 18)
   - 确认环境变量配置
   - 查看构建日志

3. **数据库连接失败**
   - 确认 D1 数据库已创建
   - 检查数据库 ID 配置
   - 运行数据库迁移

4. **WebSocket 连接失败**
   - 检查 Workers 域名配置
   - 确认防火墙设置
   - 验证 SSL 证书

### 调试命令

```bash
# 检查 Workers 状态
wrangler dev

# 测试 API 接口
curl https://api.your-domain.workers.dev/health

# 检查数据库连接
wrangler d1 execute vps-monitor --command="SELECT 1;"
```

## 📈 性能优化

### 1. 缓存配置

- 静态资源缓存: 1年
- API 响应缓存: 5分钟
- 数据库查询优化

### 2. 请求限制

在免费计划下，注意以下限制：
- Workers: 100,000 请求/天
- D1: 100,000 读写/天
- Pages: 无限制

### 3. 监控建议

- 监控服务器数量: 50-70台 (免费计划)
- 数据上报间隔: 60秒
- 历史数据保留: 30天

## 🔒 安全配置

### 1. 密钥管理

- 使用强密码 (32字符以上)
- 定期轮换密钥
- 不要在代码中硬编码密钥

### 2. 访问控制

- 配置 CORS 策略
- 启用 HTTPS
- 设置 CSP 头部

### 3. 监控安全

- 启用访问日志
- 监控异常请求
- 设置告警规则

## 📞 支持

如果遇到问题，可以：

1. 查看 [GitHub Issues](https://github.com/senma231/vpsmonitor/issues)
2. 阅读 [Cloudflare 文档](https://developers.cloudflare.com/)
3. 提交新的 Issue

## 📝 更新日志

部署完成后，可以通过以下方式更新：

1. **自动更新**: 推送代码到 main 分支
2. **手动更新**: 运行 `npm run deploy`
3. **回滚**: 在 Cloudflare Dashboard 中选择历史版本
