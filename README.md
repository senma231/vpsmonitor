# VPS Monitor - 云原生服务器监控系统

基于 Cloudflare 的现代化服务器监控解决方案，采用 Agent+SSH 混合模式，支持实时监控和连通性测试。

## 🚀 特性

- **混合监控模式**: Agent优先 + SSH备用
- **云原生架构**: Cloudflare Workers + D1 数据库 + Pages
- **实时监控**: WebSocket + HTTP API
- **安全存储**: 加密的SSH凭据存储
- **连通性测试**: 多节点网络测速
- **免费部署**: 完全基于Cloudflare免费服务

## 📁 项目结构

```
vpsmonitor/
├── workers/                 # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.js        # 主入口文件
│   │   ├── handlers/       # API处理器
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── wrangler.toml       # Workers配置
│   └── package.json        # 依赖管理
├── src/                    # Vue.js 前端源码 (Cloudflare Pages)
│   ├── components/         # Vue组件
│   ├── views/              # 页面视图
│   ├── utils/              # 工具函数
│   ├── assets/             # 静态资源
│   └── main.js             # 前端入口
├── public/                 # 公共静态文件
├── dist/                   # 构建输出 (Pages部署目录)
├── package.json            # 前端依赖
├── vite.config.js          # 构建配置
├── agent/                  # 监控Agent
│   ├── src/
│   │   ├── main.go         # Agent主程序
│   │   ├── collector/      # 数据收集
│   │   └── config/         # 配置管理
│   ├── go.mod              # Go模块
│   └── Makefile            # 构建脚本
├── database/               # 数据库相关
│   ├── schema.sql          # D1数据库结构
│   └── migrations/         # 数据库迁移
├── .github/
│   └── workflows/
│       └── deploy.yml      # 自动部署
├── scripts/                # 部署脚本
│   ├── setup.sh           # 环境设置
│   └── deploy.sh          # 部署脚本
└── docs/                   # 文档
    ├── api.md              # API文档
    └── deployment.md       # 部署指南
```

## 🛠 技术栈

### 后端
- **Cloudflare Workers**: 无服务器计算平台
- **Cloudflare D1**: SQLite兼容数据库
- **WebSocket**: 实时通信
- **加密存储**: AES-GCM加密

### 前端
- **Cloudflare Pages**: 静态网站托管
- **Vue 3**: 现代化前端框架
- **Vite**: 快速构建工具
- **Arco Design**: UI组件库
- **Highcharts**: 数据可视化

### Agent
- **Go**: 高性能系统语言
- **gopsutil**: 系统信息收集
- **WebSocket**: 实时数据传输

## 🔧 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/senma231/vpsmonitor.git
cd vpsmonitor
```

### 2. 环境配置
```bash
# 安装依赖
npm install

# 配置Cloudflare
cp wrangler.example.toml wrangler.toml
# 编辑wrangler.toml，填入你的Cloudflare信息
```

### 3. 数据库初始化
```bash
# 创建D1数据库
wrangler d1 create vps-monitor

# 执行数据库迁移
wrangler d1 execute vps-monitor --file=database/schema.sql
```

### 4. 本地开发
```bash
# 启动Workers开发服务器
cd workers && npm run dev

# 启动前端开发服务器 (新终端)
npm run dev
```

### 5. 部署
```bash
# 部署Workers后端
cd workers && npm run deploy

# 前端自动部署到Cloudflare Pages (通过Git推送)
git add . && git commit -m "update" && git push origin main
```

## 📊 监控指标

- **系统指标**: CPU、内存、磁盘使用率
- **网络指标**: 带宽使用、连接数
- **性能指标**: 负载均衡、响应时间
- **连通性**: 多节点网络测试

## 🔒 安全特性

- **加密存储**: SSH凭据AES-GCM加密
- **访问控制**: 基于Token的API认证
- **最小权限**: 仅必要的系统权限
- **审计日志**: 完整的操作记录

## 📈 使用限制

基于Cloudflare免费计划：
- **请求限制**: 100,000次/天
- **数据库**: 100,000次读写/天
- **存储**: 1GB数据库存储
- **监控服务器**: 建议50-70台

## 🚀 快速部署指南

### 1. 准备工作

1. **注册Cloudflare账号**并获取API Token
2. **创建GitHub仓库** `vpsmonitor`
3. **推送项目代码**到你的仓库
4. **配置GitHub Secrets**

### 2. GitHub Secrets配置

在GitHub仓库的Settings > Secrets and variables > Actions中添加以下密钥：

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
AUTH_SECRET=your_strong_auth_secret_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars_long
ADMIN_PASSWORD=your_admin_password
VITE_API_URL=https://api.your-domain.workers.dev
VITE_WS_URL=wss://api.your-domain.workers.dev/ws
```

### 3. 创建Cloudflare资源

```bash
# 创建D1数据库
wrangler d1 create vps-monitor

# 创建KV命名空间
wrangler kv:namespace create "CACHE"

# 更新wrangler.toml中的ID
```

### 4. 推送代码并自动部署

```bash
# 初始化Git仓库
git init

# 添加远程仓库
git remote add origin https://github.com/senma231/vpsmonitor.git

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: VPS Monitor云原生监控系统"

# 推送到GitHub（触发自动部署）
git push -u origin main
```

## 📱 Agent安装

### Linux/macOS一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/senma231/vpsmonitor/main/scripts/install-agent.sh | bash
```

### 手动安装

1. 下载Agent程序
2. 配置连接信息
3. 启动服务

```bash
# 下载
wget https://github.com/senma231/vpsmonitor/releases/latest/download/vps-agent-linux

# 配置
./vps-agent-linux config --server=wss://api.your-domain.workers.dev/ws --secret=your_auth_secret

# 启动
./vps-agent-linux start
```

## 🔧 高级配置

### 自定义域名

1. 在Cloudflare中添加域名
2. 配置DNS记录
3. 更新wrangler.toml

### SSL证书

Cloudflare自动提供SSL证书，无需额外配置。

### 监控告警

支持多种告警方式：
- Telegram机器人
- 邮件通知
- Webhook回调

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 开发环境搭建

```bash
# 克隆项目
git clone https://github.com/senma231/vpsmonitor.git
cd vpsmonitor

# 安装依赖
npm install
cd workers && npm install && cd ..

# 启动开发服务器
npm run dev          # 前端
npm run dev:workers  # 后端
```

## 📄 许可证

Apache-2.0 License

## 🙏 致谢

### 开源项目鸣谢

本项目在开发过程中参考和借鉴了以下优秀的开源项目，在此表示诚挚的感谢：

#### 核心灵感来源
- **[Akile Monitor](https://github.com/akile-network/akile_monitor)** - 原始监控系统设计理念
  - 提供了服务器监控的基础架构思路
  - 商业信息管理的数据模型参考
  - Agent通信机制的设计启发

#### 技术栈支持
- **[Vue.js](https://vuejs.org/)** - 现代化前端框架
- **[Arco Design Vue](https://arco.design/vue)** - 企业级UI组件库
- **[ECharts](https://echarts.apache.org/)** - 数据可视化图表库
- **[Cloudflare Workers](https://workers.cloudflare.com/)** - 边缘计算平台
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - 分布式SQLite数据库
- **[Cloudflare Pages](https://pages.cloudflare.com/)** - 静态网站托管

#### 开发工具
- **[Vite](https://vitejs.dev/)** - 现代化构建工具
- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** - Cloudflare开发CLI
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD自动化

### 特别感谢

- **Cloudflare** 提供的免费云服务，让个人开发者也能享受企业级基础设施
- **Vue.js 社区** 提供的丰富生态和技术支持
- **开源社区** 的无私贡献和知识分享

### 声明

本项目是在原有 Akile Monitor 项目启发下的**全新开发**，采用了现代化的云原生架构：
- 🔄 **架构重构**: 从传统部署升级到 Serverless 架构
- 🛡️ **安全增强**: 实现了端到端加密和现代化认证
- 🚀 **性能优化**: 利用全球CDN和边缘计算
- 💰 **成本优化**: 基于免费服务的高性价比方案

我们尊重原项目的贡献，同时为社区带来了技术创新和改进。
