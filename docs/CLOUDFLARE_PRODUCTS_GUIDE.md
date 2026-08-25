# Cloudflare 产品完全使用指南

> 本文档详细介绍 Cloudflare 各产品的功能、使用方法和最佳实践，不仅仅是 CLI 命令用法。

## 目录

1. [Cloudflare 概述](#1-cloudflare-概述)
2. [DNS 管理](#2-dns-管理)
3. [SSL/TLS 证书](#3-ssltls-证书)
4. [防火墙与安全](#4-防火墙与安全)
5. [DDoS 防护](#5-ddos-防护)
6. [Bot 管理](#6-bot-管理)
7. [负载均衡 (Load Balancing)](#7-负载均衡-load-balancing)
8. [Workers (边缘计算)](#8-workers-边缘计算)
9. [KV 存储](#9-kv-存储)
10. [R2 存储](#10-r2-存储)
11. [Pages (静态网站托管)](#11-pages-静态网站托管)
12. [Waiting Room (等候室)](#12-waiting-room-等候室)
13. [Cloudflare Tunnel](#13-cloudflare-tunnel)
14. [Cloudflare Access (零信任访问)](#14-cloudflare-access-零信任访问)
15. [API Shield](#15-api-shield)
16. [Spectrum (TCP/UDP 代理)](#16-spectrum-tcpudp-代理)
17. [Stream (视频流)](#17-stream-视频流)
18. [Registrar (域名注册)](#18-registrar-域名注册)
19. [最佳实践](#19-最佳实践)
20. [套餐对比](#20-套餐对比)

---

## 1. Cloudflare 概述

### 什么是 Cloudflare？

Cloudflare 是全球最大的**连接云平台**，提供：
- **CDN**：全球内容分发网络
- **安全防护**：DDoS、WAF、Bot 管理
- **边缘计算**：Workers、Pages
- **网络服务**：DNS、Load Balancing、Spectrum
- **零信任安全**：Access、Gateway

### Cloudflare 架构

```
                        全球网络
                         ┌─────────────────────────────────────┐
                         │         Cloudflare Edge           │
                         │  ┌─────┐ ┌─────┐ ┌─────┐        │
                         │  │PoP 1│ │PoP 2│ │PoP 3│ ...    │
                         │  └─────┘ └─────┘ └─────┘        │
                         └─────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     ┌────┴────┐         ┌────┴────┐
                     │ 源站服务器 │         │ 源站服务器 │
                     └─────────┘         └─────────┘
```

### 核心概念

| 概念 | 说明 |
|------|------|
| **Zone** | 管理的域名单位 |
| **PoP** | 存在点 (Point of Presence)，Cloudflare 的全球节点 |
| **Anycast** | 任播，同一 IP 由最近节点响应 |
| **Proxy** | 代理，流量经过 Cloudflare |
| **Origin** | 源站服务器 |

---

## 2. DNS 管理

### 什么是 Cloudflare DNS？

Cloudflare DNS 是**权威 DNS 服务**，特点：
- **快速**：全球 Anycast 网络，平均查询时间 < 5ms
- **可靠**：99.999% 可用性
- **安全**：内置 DDoS 防护、DNSSEC 支持
- **免费**：所有套餐免费使用

### DNS 记录类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **A** | IPv4 地址 | `example.com` → `1.2.3.4` |
| **AAAA** | IPv6 地址 | `example.com` → `2001:db8::1` |
| **CNAME** | 别名 | `www` → `example.com` |
| **MX** | 邮件服务器 | `example.com` → `mail.example.com` |
| **TXT** | 文本记录 | SPF、DKIM、验证记录 |
| **SRV** | 服务记录 | SIP、XMPP |
| **NS** | 名称服务器 | 委派子域名 |
| **CAA** | 证书授权 | 限制可签发证书的 CA |
| **PTR** | 反向解析 | IP → 域名 |

### 代理状态 (Proxy Status)

| 状态 | 图标 | 流量路径 | 说明 |
|------|------|---------|------|
| **Proxied** | 🟠 橙色云 | 访客 → Cloudflare → 源站 | 享受保护和优化 |
| **DNS Only** | ⚪ 灰色云 | 访客 → 源站 | 仅 DNS 解析 |

### CNAME Flattening

Cloudflare 支持在**根域名**使用 CNAME：
- 自动将 CNAME 解析为 A/AAAA 记录
- 对访客透明，符合 DNS 规范
- 付费套餐可选择完全扁平化

### DNSSEC (DNS 安全扩展)

DNSSEC 为 DNS 记录添加**数字签名**，防止：
- DNS 缓存投毒
- DNS 劫持
- 中间人攻击

**启用步骤**：
1. 在 Cloudflare Dashboard → DNS → Settings → Enable DNSSEC
2. 获取 DS 记录
3. 在域名注册商添加 DS 记录
4. 等待生效（通常 24-48 小时）

### 最佳实践

```bash
# 1. 使用 Cloudflare DNS 保护源站 IP
#    将 A 记录设为 Proxied (橙色云)

# 2. 启用 DNSSEC 防止 DNS 劫持
#    在 Dashboard 中启用

# 3. 设置 CAA 记录限制证书颁发
cfcli dns add --type CAA --name @ --content "0 issue \"letsencrypt.org\""

# 4. 使用 CNAME 而非 IP（便于维护）
cfcli dns add --type CNAME --name api --content target.example.com --proxied

# 5. 设置合理的 TTL
#    动态记录用较低 TTL (如 5 分钟)，静态记录用较高 TTL
```

---

## 3. SSL/TLS 证书

### Cloudflare 的两种证书

```
访客浏览器 ←──[边缘证书]──→ Cloudflare ←──[源站证书]──→ 源站服务器
         Connection 1              Connection 2
```

### 边缘证书 (Edge Certificate)

**保护访客到 Cloudflare 的连接**：

| 类型 | 说明 | 价格 |
|------|------|------|
| **Universal SSL** | 自动签发，覆盖根域名+一级子域名 | 免费 |
| **Total TLS** | 自动覆盖所有代理主机名 | 免费 (需 ACM) |
| **Advanced Certificate** | 可自定义 CA、主机名、有效期 | 付费 |
| **Custom Certificate** | 上传自己的证书 | Business+ |

### 源站证书 (Origin Certificate)

**保护 Cloudflare 到源站的连接**：

| 类型 | 说明 | 价格 |
|------|------|------|
| **Origin CA** | Cloudflare 签发，仅 Cloudflare 信任 | 免费 |
| **Let's Encrypt** | 公共信任 | 免费 |
| **商业证书** | DigiCert、GlobalSign 等 | 付费 |

### SSL/TLS 模式

| 模式 | 访客-Cloudflare | Cloudflare-源站 | 安全级别 |
|------|----------------|-----------------|---------|
| **Off** | 不加密 | 不加密 | ❌ 不安全 |
| **Flexible** | HTTPS | HTTP | ⚠️ 中等 |
| **Full** | HTTPS | HTTPS (不验证证书) | ✅ 安全 |
| **Full (strict)** | HTTPS | HTTPS (验证证书) | ✅✅ 最安全 |

### 证书生命周期

```
域名激活 → DCV 验证 → 证书签发 → 部署到边缘 → 使用 → 自动续期
```

**DCV (域名控制验证)**：
- HTTP 验证：放置验证文件
- TXT 验证：添加 DNS TXT 记录
- Email 验证：发送验证邮件

### 最佳实践

```bash
# 1. 设置 SSL 模式为 Full (strict)
cfcli ssl set --mode full-strict

# 2. 启用 Authenticated Origin Pulls
#    确保只有 Cloudflare 能连接源站

# 3. 设置最低 TLS 版本为 1.2 或更高
cfcli ssl tls set-version --version 1.2

# 4. 启用 HTTPS 重定向
cfcli ssl https redirect-enable

# 5. 启用 Automatic HTTPS Rewrites
#    自动将 HTTP 链接改为 HTTPS

# 6. 启用 HSTS (HTTP Strict Transport Security)
#    强制浏览器使用 HTTPS
```

---

## 4. 防火墙与安全

### Cloudflare WAF (Web 应用防火墙)

WAF 检查请求并根据规则过滤：

| 功能 | 说明 | 套餐 |
|------|------|------|
| **Managed Rules** | 预定义规则集，自动更新 | Pro+ |
| **Custom Rules** | 自定义规则 | Free+ |
| **Rate Limiting** | 速率限制 | Free+ (1条) |
| **Bot Fight Mode** | 机器人检测 | Free+ |
| **Security Level** | 整体安全级别设置 | Free+ |

### 防火墙规则 vs WAF

| 特性 | Firewall (访问规则) | WAF |
|------|---------------------|-----|
| 层级 | L3/L4 (网络层) | L7 (应用层) |
| 匹配条件 | IP、ASN、国家 | URL、Header、Body、Cookie |
| 动作 | block, allow, challenge | block, challenge, js_challenge, log |

### 安全级别

| 级别 | 说明 |
|------|------|
| **Essentially Off** | 几乎不拦截 |
| **Low** | 仅拦截最明显威胁 |
| **Medium** | 平衡安全和误报 |
| **High** | 更严格拦截 |
| **Under Attack!** | 最高级别，可能出现误报 |

### 速率限制 (Rate Limiting)

保护 API 和登录页面免受暴力破解：

```bash
# 添加速率限制规则
cfcli waf rate-limits add \
  --description "Login rate limit" \
  --action block \
  --period 60 \
  --requests 100
```

### 最佳实践

```bash
# 1. 设置适当的安全级别
#    Dashboard → Security → Settings → Medium

# 2. 阻止恶意国家
cfcli firewall add --description "Block CN" --action block --filter "ip.geoip.country eq CN"

# 3. 限制登录尝试
cfcli waf rate-limits add \
  --description "Login protection" \
  --action block \
  --period 300 \
  --requests 5

# 4. 启用 Bot Fight Mode
#    Security → Bots → Bot Fight Mode

# 5. 创建自定义规则阻止恶意 User-Agent
cfcli firewall add \
  --description "Block bad bots" \
  --action block \
  --filter "(http.user_agent contains \"BadBot\")"
```

---

## 5. DDoS 防护

### 什么是 DDoS？

**分布式拒绝服务攻击**：通过大量请求使服务器不可用。

### Cloudflare DDoS 防护

| 层级 | 防护范围 | 说明 |
|------|---------|------|
| **L3 (网络层)** | SYN flood, UDP flood | 自动检测 |
| **L4 (传输层)** | ACK flood, DNS amplification | 自动检测 |
| **L7 (应用层)** | HTTP flood, CC 攻击 | WAF + 速率限制 |

### 防护机制

1. **流量分析**：实时分析流量模式
2. **自动缓解**：检测到攻击时自动启动
3. **Anycast 分散**：流量分散到全球节点
4. **速率限制**：限制请求频率

### 配置

```bash
# 查看 DDoS 设置
cfcli enterprise ddos get

# 启用 DDoS 防护
cfcli enterprise ddos enable

# 设置 DDoS 灵敏度
#    Dashboard → Security → DDoS → HTTP DDoS
```

---

## 6. Bot 管理

### Bot 类型

| 类型 | 说明 | 影响 |
|------|------|------|
| **Good Bots** | Googlebot, Bingbot | 搜索引擎索引 |
| **Bad Bots** | 爬虫、扫描器 | 内容窃取、暴力破解 |
| **API Bots** | 合法 API 客户端 | 需允许 |

### Bot 管理功能

| 功能 | 说明 | 套餐 |
|------|------|------|
| **Bot Fight Mode** | 自动检测 Bad Bot | Free |
| **Super Bot Fight Mode** | 更严格检测 | Pro+ |
| **Bot Analytics** | 分析 Bot 流量 | Business+ |
| **Bot Management** | 企业级 Bot 管理 | Enterprise |

---

## 7. Load Balancing (负载均衡)

### 什么是负载均衡？

将流量**智能分配**到多个源站服务器，提高可用性和性能。

### 架构

```
                          Load Balancer
                         (负载均衡器)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
        ┌───┴───┐        ┌───┴───┐        ┌───┴───┐
        │ Pool 1 │        │ Pool 2 │        │ Pool 3 │
        │ 美国   │        │ 欧洲   │        │ 亚洲   │
        └───┬───┘        └───┬───┘        └───┬───┘
            │                 │                 │
        ┌───┴───┐        ┌───┴───┐        ┌───┴───┐
        │Origin1│        │Origin1│        │Origin1│
        │Origin2│        │Origin2│        │Origin2│
        └───────┘        └───────┘        └───────┘
```

### 流量引导 (Traffic Steering)

| 策略 | 说明 |
|------|------|
| **Random** | 随机分配 |
| **Least Connections** | 最少连接 |
| **Least Time** | 最快响应 |
| **Geographic** | 地理就近 |
| **Proximity** | 最近节点 |

### 健康检查

```bash
# 创建健康检查
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health \
  --interval 60

# 检查类型
# HTTP - 检查 HTTP 状态码
# TCP - 检查端口连通性
# Ping - ICMP ping
```

### 故障转移 (Failover)

当 Pool 中所有源站不可用时：
1. 尝试备用 Pool (Fallback Pool)
2. 如果所有 Pool 都不可用，返回错误

### 最佳实践

```bash
# 1. 创建多个 Pool，按地理分布
cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

# 2. 设置健康检查
cfcli health-checks create \
  --name us-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# 3. 创建负载均衡器
cfcli load-balancer create \
  --name my-lb \
  --pool-id <us-pool-id> \
  --default-pool-ids <us-pool-id> \
  --fallback-pool-id <eu-pool-id>

# 4. 启用会话保持 (Session Affinity)
#    确保同一用户请求到同一源站
```

---

## 8. Workers (边缘计算)

### 什么是 Workers？

Cloudflare Workers 是**无服务器边缘计算平台**：
- 在 Cloudflare 全球 300+ 节点运行代码
- 冷启动时间 < 1ms
- 每天 100,000 次免费请求

### 运行时

| 运行时 | 说明 |
|--------|------|
| **JavaScript/TypeScript** | 原生支持 |
| **WebAssembly (Wasm)** | Rust, C, C++ 编译 |
| **Python** | 通过 Pyodide |

### 组件

| 组件 | 说明 |
|------|------|
| **Service** | Worker 脚本 |
| **Route** | URL 路由规则 |
| **Namespace** | KV 命名空间 |
| **D1** | 边缘数据库 |
| **R2** | 对象存储 |
| **Environment Variables** | 环境变量 |

### 示例

```javascript
// API 代理
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // API 路由
  if (url.pathname.startsWith('/api/')) {
    const response = await fetch('https://api.backend.com' + url.pathname, {
      headers: request.headers,
    })
    
    // 添加 CORS 头
    const modified = new Response(response.body, response)
    modified.headers.set('Access-Control-Allow-Origin', '*')
    return modified
  }
  
  // 静态内容
  return fetch(request)
}
```

### 最佳实践

```bash
# 1. 使用 KV 存储配置
cfcli kv namespaces create --title "App Config"
cfcli kv keys put --namespace-id <id> --key API_KEY --value "secret"

# 2. 使用 D1 存储数据
#    边缘 SQLite 数据库

# 3. 使用 R2 存储文件
#    无需 egress 费用

# 4. 设置合理的路由
cfcli workers routes add --pattern "example.com/api/*" --script api-worker
```

---

## 9. KV 存储

### 什么是 KV？

Cloudflare KV 是**全局分布式键值存储**：
- 最终一致性 (Eventually Consistent)
- 强一致性 (Strong Consistency) - 付费
- 低延迟读取
- 适合配置、会话、特征标志

### 使用场景

| 场景 | 说明 |
|------|------|
| **应用配置** | 存储 API 密钥、功能标志 |
| **会话存储** | 用户会话数据 |
| **速率限制** | 计数器存储 |
| **A/B 测试** | 实验分组 |

### 最佳实践

```bash
# 1. 使用合理的命名空间组织
cfcli kv namespaces create --title "App Config"
cfcli kv namespaces create --title "User Sessions"

# 2. 批量操作减少请求
#    使用 API 批量写入

# 3. 设置 TTL (通过 API)
#    自动过期旧数据

# 4. 使用强一致性（需要时）
#    读取最新写入的数据
```

---

## 10. R2 存储

### 什么是 R2？

Cloudflare R2 是**兼容 S3 的对象存储**：
- 无 egress 费用 (区别于 S3)
- 全球边缘缓存
- 99.999999999% 持久性

### 与 S3 对比

| 特性 | Cloudflare R2 | AWS S3 |
|------|-------------|--------|
| **Egress 费用** | 免费 | $0.09/GB |
| **请求费用** | 较低 | 标准 |
| **S3 兼容** | ✅ | ✅ |
| **CDN 集成** | 内置 | 需配置 CloudFront |

### 最佳实践

```bash
# 1. 创建 Bucket
cfcli r2 buckets create --name my-data

# 2. 配置公共访问
#    用于托管静态资源

# 3. 绑定自定义域名
#    通过 CDN 加速访问

# 4. 使用生命周期规则
#    自动删除旧文件
```

---

## 11. Pages (静态网站托管)

### 是什么？

Cloudflare Pages 是**静态网站和 JAMstack 托管平台**：
- 自动 Git 集成
- 全球 CDN 分发
- 自动 SSL
- 无限带宽 (免费套餐)

### 支持框架

| 框架 | 命令 |
|------|------|
| **Next.js** | `npx create-next-app` |
| **Nuxt** | `npx create-nuxt-app` |
| **Gatsby** | `npx create-gatsby` |
| **Hugo** | `hugo new site` |
| **Vue** | `npm create vue` |
| **React** | `npm create vite` |

### 最佳实践

```bash
# 1. 使用 Git 集成
#    自动构建部署

# 2. 配置环境变量
#    Dashboard → Pages → Settings → Environment variables

# 3. 使用 Preview Deployments
#    每个 PR 自动预览

# 4. 设置自定义域名
cfcli pages domains add --name my-app --domain example.com

# 5. 配置 Headers 和 Redirects
#    使用 _headers 和 _redirects 文件
```

---

## 12. Waiting Room (等候室)

### 是什么？

Waiting Room 在**流量高峰时排队访客**：
- 防止源站过载
- 自定义等候室页面
- 按事件或常开模式

### 使用场景

| 场景 | 说明 |
|------|------|
| **产品发布** | 新品发布时流量激增 |
| **限时抢购** | 电商秒杀活动 |
| **票务销售** | 演唱会门票开售 |

### 配置

```bash
# 创建等候室
cfcli waiting-room create \
  --name "Product Launch" \
  --host example.com \
  --path /launch \
  --total_active_users 1000 \
  --new_users_per_minute 100

# 创建事件
cfcli waiting-room events create \
  --room-id <room_id> \
  --name "Flash Sale" \
  --start 2026-01-01T00:00:00Z \
  --end 2026-01-01T01:00:00Z
```

---

## 13. Cloudflare Tunnel

### 是什么？

Cloudflare Tunnel 通过**出站连接**将源站暴露到 Cloudflare：
- 无需暴露源站公网 IP
- 无需开放入站端口
- 自动 DDoS 防护

### 架构

```
源站服务器 ←── 出站连接 ──→ Cloudflare ←── 访客
   (无公网 IP)    (cloudflared)
```

### 使用

```bash
# 1. 安装 cloudflared
#    下载并安装 cloudflared 守护进程

# 2. 认证
cloudflared tunnel login

# 3. 创建 Tunnel
cloudflared tunnel create my-tunnel

# 4. 配置路由
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: my-tunnel
credentials-file: /home/user/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: app.example.com
    service: http://localhost:8080
  - hostname: api.example.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# 5. 运行 Tunnel
cloudflared tunnel run my-tunnel
```

---

## 14. Cloudflare Access (零信任访问)

### 是什么？

Cloudflare Access 提供**零信任访问控制**：
- 无需 VPN
- 基于身份验证
- 细粒度策略
- 审计日志

### 组件

```
Access Application (应用)
  ├── Policy (策略) - 谁可以访问
  ├── Group (用户组) - 用户分组
  └── Identity Provider (身份提供者) - Google, GitHub, SAML, OIDC
```

### 使用场景

| 场景 | 说明 |
|------|------|
| **内部工具** | Jira, Confluence, Grafana |
| **SSH 访问** | 堡垒机替代 |
| **Kubernetes Dashboard** | 保护 k8s API |
| **CI/CD 系统** | Jenkins, GitLab |

### 配置

```bash
# 1. 创建应用
cfcli access apps create \
  --name "Internal Wiki" \
  --domain wiki.internal.com \
  --app_type self_hosted

# 2. 创建策略
cfcli access policies create \
  --app-id <app_id> \
  --name "Allow Employees" \
  --decision allow \
  --include-email "@company.com"

# 3. 创建用户组
cfcli access groups create \
  --name "Engineering" \
  --include-email "@engineering.company.com"
```

---

## 15. API Shield

### 是什么？

API Shield 提供**多层 API 安全**：
- **mTLS**：客户端证书验证
- **Schema 验证**：请求体验证
- **API 发现**：自动发现 API 端点

### 配置

```bash
# 1. 发现 API 端点
cfcli api-shield endpoints list

# 2. 添加 Schema 验证
cfcli api-shield schemas create \
  --name "User Schema" \
  --file ./user-schema.json

# 3. 启用 mTLS
#    Dashboard → API Shield → mTLS Settings
```

---

## 16. Spectrum (TCP/UDP 代理)

### 是什么？

Spectrum 为**非 HTTP 流量**提供：
- TCP/UDP 代理
- DDoS 防护
- 性能优化

### 使用场景

| 场景 | 说明 |
|------|------|
| **游戏服务器** | Minecraft, Counter-Strike |
| **SSH 访问** | 安全 SSH 代理 |
| **数据库** | MySQL, PostgreSQL |
| **IoT 设备** | MQTT, CoAP |

### 配置

```bash
# 创建 Spectrum 应用
cfcli spectrum create \
  --name "Game Server" \
  --dns-type custom \
  --origin 1.2.3.4:25565 \
  --protocol tcp
```

---

## 17. Stream (视频流)

### 是什么？

Cloudflare Stream 是**视频流媒体平台**：
- 视频上传和存储
- 自动转码
- 全球 CDN 分发
- 内置播放器

### 使用

```bash
# 上传视频
cfcli stream upload --name "My Video" --file ./video.mp4

# 查看视频
cfcli stream get --id <video_id>

# 获取播放 URL
#    Dashboard → Stream → Videos
```

---

## 18. Registrar (域名注册)

### 是什么？

Cloudflare Registrar 提供**成本价域名注册**：
- 无加价 (At Cost)
- 自动续费
- 免费 DNSSEC
- WHOIS 隐私保护

### 支持的 TLD

| TLD | 价格 |
|-----|------|
| .com | ~$10/年 |
| .net | ~$12/年 |
| .org | ~$12/年 |
| .io | ~$40/年 |
| .dev | ~$15/年 |

### 使用

```bash
# 通过 Dashboard 注册域名
# Dashboard → Registrar → Register Domain
```

---

## 19. 最佳实践

### 安全最佳实践

1. **启用 MFA**：所有账户启用多因素认证
2. **使用 API Token**：避免使用全局 API Key
3. **最小权限原则**：Token 只授予必要权限
4. **启用 Authenticated Origin Pulls**：防止绕过 Cloudflare
5. **定期轮换密钥**：定期更新 API Token

### 性能最佳实践

1. **启用缓存**：合理设置 Cache-Control
2. **使用 Workers**：边缘计算减少延迟
3. **启用 Argo**：智能路由优化
4. **使用 Polish**：图片自动优化
5. **启用 Brotli**：更好的压缩

### DNS 最佳实践

1. **使用 CNAME**：便于维护，避免硬编码 IP
2. **启用 DNSSEC**：防止 DNS 劫持
3. **设置合理 TTL**：平衡性能和灵活性
4. **使用 CAA 记录**：限制证书颁发

---

## 20. 套餐对比

### 功能对比

| 功能 | Free | Pro | Business | Enterprise |
|------|------|-----|----------|------------|
| **CDN** | ✅ | ✅ | ✅ | ✅ |
| **Universal SSL** | ✅ | ✅ | ✅ | ✅ |
| **WAF (Managed Rules)** | 基础 | ✅ | ✅ | ✅ |
| **DDoS 防护** | ✅ | ✅ | ✅ | ✅ |
| **Workers (免费额度)** | 10万/天 | 10万/天 | 10万/天 | 10万/天 |
| **Custom SSL** | ❌ | ❌ | ✅ | ✅ |
| **Advanced Certificate** | ❌ | ❌ | ❌ | ✅ |
| **Load Balancing** | ❌ | ❌ | ❌ | 附加组件 |
| **Access** | 50 用户 | ❌ | ❌ | 附加组件 |
| **SLA** | 无 | 无 | 无 | 100% |

### 选择建议

| 场景 | 推荐套餐 |
|------|---------|
| **个人博客** | Free |
| **小型企业** | Pro |
| **中型企业** | Business |
| **大型企业/高流量** | Enterprise |

---

> **文档版本**: v1.0  
> **最后更新**: 2026-08-14  
> **适用 CLI 版本**: cfcli v1.0.0
