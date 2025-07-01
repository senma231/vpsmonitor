# 自定义域名配置指南

## 🌐 域名配置概览

VPS Monitor 需要配置两个域名：
- **API域名**: `api.your-domain.com` (Workers)
- **前端域名**: `monitor.your-domain.com` (Pages)

## 📋 配置步骤

### 1. Workers API 域名配置

#### 方法一：通过 Cloudflare Dashboard
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 选择你的 Worker (`vps-monitor-api`)
4. 进入 **Settings** > **Triggers**
5. 点击 **Add Custom Domain**
6. 输入域名：`api.your-domain.com`
7. Cloudflare 会自动创建 DNS 记录

#### 方法二：通过 wrangler.toml 配置
```toml
# workers/wrangler.toml
name = "vps-monitor-api"

# 自定义域名
[[routes]]
pattern = "api.your-domain.com/*"
zone_name = "your-domain.com"

# 或者使用 custom_domains (推荐)
[env.production]
routes = [
  { pattern = "api.your-domain.com/*", zone_name = "your-domain.com" }
]
```

### 2. Pages 前端域名配置

#### 通过 Cloudflare Dashboard
1. 进入 **Pages**
2. 选择你的项目 (`vps-monitor`)
3. 进入 **Custom domains**
4. 点击 **Set up a custom domain**
5. 输入域名：`monitor.your-domain.com`
6. Cloudflare 会自动配置 DNS

### 3. DNS 记录验证

配置完成后，检查 DNS 记录：

```bash
# 检查 API 域名
dig api.your-domain.com

# 检查前端域名  
dig monitor.your-domain.com

# 应该看到 CNAME 记录指向 Cloudflare
```

## 🔧 更新项目配置

### 1. 更新环境变量

```bash
# GitHub Secrets 中更新
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com/ws
```

### 2. 更新前端配置

```javascript
// public/config.json
{
  "api": {
    "baseURL": "https://api.your-domain.com",
    "wsURL": "wss://api.your-domain.com/ws"
  }
}
```

### 3. 更新 _redirects 文件

```bash
# _redirects
/api/* https://api.your-domain.com/:splat 200
/ws https://api.your-domain.com/ws 200
```

## 🚀 自动化域名配置

创建域名配置脚本：

```bash
#!/bin/bash
# scripts/setup-domains.sh

DOMAIN="your-domain.com"
API_DOMAIN="api.$DOMAIN"
FRONTEND_DOMAIN="monitor.$DOMAIN"

echo "配置域名: $DOMAIN"

# 1. 更新 wrangler.toml
sed -i "s/api.your-domain.com/$API_DOMAIN/g" workers/wrangler.toml
sed -i "s/your-domain.com/$DOMAIN/g" workers/wrangler.toml

# 2. 更新环境变量文件
sed -i "s/api.your-domain.workers.dev/$API_DOMAIN/g" .env.example
sed -i "s/api.your-domain.workers.dev/$API_DOMAIN/g" .env.production

# 3. 更新配置文件
sed -i "s/api.your-domain.workers.dev/$API_DOMAIN/g" public/config.json

# 4. 更新重定向文件
sed -i "s/api.your-domain.workers.dev/$API_DOMAIN/g" _redirects

echo "域名配置完成！"
echo "API: https://$API_DOMAIN"
echo "前端: https://$FRONTEND_DOMAIN"
```

## 📝 配置检查清单

### 部署前检查
- [ ] 域名已添加到 Cloudflare
- [ ] DNS 记录已生效
- [ ] SSL 证书已签发
- [ ] Workers 域名已配置
- [ ] Pages 域名已配置

### 部署后检查
- [ ] API 接口可访问
- [ ] WebSocket 连接正常
- [ ] 前端页面加载正常
- [ ] 跨域配置正确
- [ ] HTTPS 重定向正常

## 🔍 故障排除

### 常见问题

1. **域名解析失败**
   ```bash
   # 检查 DNS 传播
   dig +trace api.your-domain.com
   
   # 清除 DNS 缓存
   sudo dscacheutil -flushcache  # macOS
   sudo systemctl restart systemd-resolved  # Linux
   ```

2. **SSL 证书问题**
   - 等待 15 分钟让证书生效
   - 检查 Cloudflare SSL/TLS 设置
   - 确保使用 "Full" 或 "Full (strict)" 模式

3. **CORS 错误**
   ```javascript
   // workers/src/utils/helpers.js
   export const corsHeaders = {
     'Access-Control-Allow-Origin': 'https://monitor.your-domain.com',
     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type, Authorization'
   };
   ```

4. **WebSocket 连接失败**
   - 确保使用 `wss://` 协议
   - 检查防火墙设置
   - 验证 Workers 路由配置

## 🎯 最佳实践

1. **域名选择**
   - 使用子域名分离前后端
   - 保持域名简短易记
   - 考虑 SEO 友好性

2. **安全配置**
   - 启用 HSTS
   - 配置 CSP 头部
   - 使用最新 TLS 版本

3. **性能优化**
   - 启用 Cloudflare 缓存
   - 配置 CDN 加速
   - 使用 HTTP/2 和 HTTP/3

## 📞 需要帮助？

如果遇到域名配置问题：
1. 检查 Cloudflare 文档
2. 查看 DNS 传播状态
3. 联系 Cloudflare 支持
4. 提交 GitHub Issue
