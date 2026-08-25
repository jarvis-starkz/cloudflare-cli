# Cloudflare 完整 FAQ  FAQ

> 本文档收集了 Cloudflare 使用中最常见的问题，按类别整理。

## 目录

- [SSL/TLS 证书 FAQ](#ssltls-证书-faq)
- [域名与 DNS FAQ](#域名与-dns-faq)
- [防火墙与安全 FAQ](#防火墙与安全-faq)
- [Workers 与计算 FAQ](#workers-与计算-faq)
- [缓存与性能 FAQ](#缓存与性能-faq)
- [Enterprise 功能 FAQ](#enterprise-功能-faq)
- [账单与账户 FAQ](#账单与账户-faq)
- [故障排查 FAQ](#故障排查-faq)

---

## SSL/TLS 证书 FAQ

### Q1: Cloudflare 提供的证书是免费的吗？

**是的**。以下证书完全免费：
- **Universal SSL** - 自动签发，覆盖根域名和一级子域名
- **Origin CA** - 源站证书，有效期 15 年
- **Total TLS** - 需要 Advanced Certificate Manager，但证书本身免费

### Q2: Universal SSL 和 Total TLS 有什么区别？

| 特性 | Universal SSL | Total TLS |
|------|-------------|-----------|
| 覆盖范围 | 根域名 + 一级子域名 | **所有代理主机名** |
| 适用场景 | 完整 DNS 设置 | 完整 DNS 设置 |
| 免费 | ✅ | ✅ (需要 ACM) |
| 多级子域名 | ❌ | ✅ |
| 自定义 CA | ❌ | ❌ |

### Q3: 证书会自动更新吗？会影响网站吗？

**会自动更新，且不影响网站**：
- Universal SSL：每 90 天自动续期，提前 30 天开始续期
- Total TLS：每 90 天自动续期
- 更新过程完全无缝，用户无感知

### Q4: 证书更新时会重新生成私钥吗？

**是的**。每次自动更新：
1. 生成新的私钥对
2. 用新私钥签发新证书
3. 部署新证书到所有节点
4. 替换旧证书

### Q5: 如何获取公钥和私钥？

**方法一**：Cloudflare 自动管理（推荐）
- 使用 Universal SSL/Total SSL，Cloudflare 自动处理

**方法二**：自己生成
```bash
# RSA 私钥
openssl genrsa -out private.key 2048

# ECDSA 私钥（推荐，更快更安全）
openssl ecparam -genkey -name prime256v1 -out private.key

# 从私钥提取公钥
openssl rsa -in private.key -pubout -out public.key
```

**方法三**：使用 Cloudflare Origin CA
- 在 Dashboard SSL/TLS → Origin Server 创建证书
- Cloudflare 生成私钥和证书，私钥只显示一次

### Q6: 什么是加密套件 (Cipher Suite)？

加密套件是 SSL/TLS 握手时使用的**算法组合**：
```
ECDHE-RSA-AES128-GCM-SHA256
│      │      │       │      │
│      │      │       │      └─ 消息认证：SHA256
│      │      │       └──────── 加密：AES128-GCM
│      │      └──────────────── 认证：RSA
│      └─────────────────────── 密钥交换：ECDHE (前向保密)
└────────────────────────────── 椭圆曲线：ECDHE
```

### Q7: 加密套件和证书有什么关系？

| 证书类型 | 支持的密钥交换 | 说明 |
|---------|--------------|------|
| RSA 证书 | ECDHE-RSA, RSA | 支持前向保密，兼容性好 |
| ECDSA 证书 | ECDHE-ECDSA | 更快的前向保密，性能更好 |

**关键点**：证书类型决定了可用的加密套件。RSA 证书支持更多套件，ECDSA 证书更安全更快。

### Q8: 如何设置加密套件？

**注意**：自定义加密套件需要 **Advanced Certificate Manager** 订阅。

通过 API 设置：
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/ciphers" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"value":["ECDHE-ECDSA-AES128-GCM-SHA256","ECDHE-RSA-AES128-GCM-SHA256","TLS_AES_128_GCM_SHA256"]}'
```

源站 Nginx 配置：
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ecdh_curve X25519:P-256:P-384;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
```

### Q9: 不同供应商的证书有限制吗？

**主要限制**：

| 限制项 | 说明 |
|--------|------|
| 密钥类型 | RSA (2048/4096 位) 或 ECDSA (P-256/P-384) |
| 证书格式 | PEM 格式 (Base64 编码) |
| 中间证书 | 必须包含完整证书链 |
| 私钥 | 必须提供对应的私键 |
| 有效期 | 通常 1-2 年 |
| 通配符 | `*.example.com` 仅覆盖一级子域名 |

**支持的 CA**：Let's Encrypt、Google Trust Services、SSL.com、Sectigo、DigiCert、GlobalSign 等

### Q10: 如何使用 ACM (高级证书管理器)？

ACM 是付费功能，提供：
- 自定义证书颁发机构
- 多级子域名覆盖
- Total TLS 自动覆盖
- 自定义加密套件

```bash
# 查看 ACM 配置
cfcli certificate acm config

# 启用 ACM
cfcli certificate acm update --enabled --ca lets_encrypt --hostnames example.com

# 启用 Total TLS
cfcli certificate total-tls enable --ca lets_encrypt
```

### Q11: 如何使用 mTLS (双向 TLS)？

**Authenticated Origin Pulls**（验证来自 Cloudflare 的请求）：
```bash
# 1. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. Nginx 配置
ssl_client_certificate /path/to/cloudflare_ca.pem;
ssl_verify_client on;
```

**API Shield mTLS**（验证客户端身份）：
- 在 Dashboard SSL/TLS → Client Certificates 创建客户端证书
- 为 API 启用 mTLS 规则

### Q12: 除了 IP Lists，还有什么方法限制来源到源站？

| 方法 | 安全性 | 复杂度 | 说明 |
|------|--------|--------|------|
| Authenticated Origin Pulls | ⭐⭐⭐⭐⭐ | 中 | 验证请求来自 Cloudflare |
| IP 白名单 | ⭐⭐⭐ | 低 | 仅允许 Cloudflare IP |
| Cloudflare Tunnel | ⭐⭐⭐⭐⭐ | 中 | 源站不暴露公网 IP |
| API Shield mTLS | ⭐⭐⭐⭐⭐ | 高 | 验证客户端证书 |

### Q13: 什么是 Keyless SSL？

Keyless SSL 允许你**将私钥保留在自己的服务器上**，Cloudflare 不存储私钥：
```bash
# 创建 Keyless 证书
cfcli certificate keyless create --name my-keyless --host keystore.example.com --port 3443
```

### Q14: 证书有效期是多久？

| 证书类型 | 有效期 | 自动续期时间 |
|---------|--------|-------------|
| Universal SSL | 90 天 | 提前 30 天 |
| Total TLS | 90 天 | 提前 30 天 |
| Advanced (1年) | 1 年 | 提前 30 天 |
| Advanced (3月) | 3 月 | 提前 30 天 |
| Advanced (14天) | 14 天 | 提前 3 天 |
| Origin CA | 15 年 | 提前 90 天 |
| Custom | 自定义 | 手动 |

### Q15: 如何解决 "NET::ERR_CERT_AUTHORITY_INVALID" 错误？

| 原因 | 解决方案 |
|------|---------|
| 证书链不完整 | 上传完整证书链（证书 + 中间证书） |
| 使用了 Origin CA 但 SSL 模式不是 Full (strict) | 设置 SSL 模式为 Full (strict) |
| 证书已过期 | 更新证书 |
| 主机名不匹配 | 确保证书覆盖正确的主机名 |

---

## 域名与 DNS FAQ

### Q1: 如何将域名添加到 Cloudflare？

1. 在 Cloudflare Dashboard 点击 "Add a Site"
2. 输入域名，选择套餐
3. 按照提示修改域名 NS 记录到 Cloudflare 提供的 NS 地址
4. 等待 NS 生效（通常几分钟到几小时）

### Q2: NS 更改后多久生效？

- **通常**：几分钟到几小时
- **最长**：72 小时（取决于 DNS 缓存）
- **全球传播**：可通过 `dig NS example.com` 检查

### Q3: 什么是 CNAME Setup 和 Full Setup？

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| **Full Setup** | 使用 Cloudflare 的 NS 服务器 | 新注册域名或完全迁移 |
| **CNAME Setup (Partial)** | 仅 CNAME 到 Cloudflare，保留原 NS | 已有 DNS 提供商 |

### Q4: 如何设置子域名？

```bash
# 添加 A 记录
cfcli dns add --type A --name api --content 1.2.3.4 --proxied

# 添加 CNAME 记录
cfcli dns add --type CNAME --name www --content example.com --proxied
```

### Q5: 什么是代理状态 (Proxy Status)？

| 状态 | 图标 | 说明 |
|------|------|------|
| **Proxied** | 🟠 橙色云 | 流量经过 Cloudflare，享受保护和性能优化 |
| **DNS Only** | ⚪ 灰色云 | 仅 DNS 解析，不经过 Cloudflare |

### Q6: 如何设置邮件 (MX) 记录？

```bash
cfcli dns add --type MX --name @ --content mail.example.com --priority 10
cfcli dns add --type MX --name @ --content mail2.example.com --priority 20

# 注意：邮件记录通常设为 DNS Only (灰色云)
```

### Q7: 如何验证域名所有权？

Cloudflare 通常通过以下方式验证：
1. **NS 记录验证**：修改 NS 到 Cloudflare
2. **TXT 记录验证**：添加指定的 TXT 记录
3. **文件验证**：上传验证文件到网站根目录

---

## 防火墙与安全 FAQ

### Q1: WAF 和 Firewall 有什么区别？

| 特性 | Firewall (防火墙规则) | WAF |
|------|----------------------|-----|
| 层级 | L3/L4 (网络层) | L7 (应用层) |
| 保护范围 | IP、端口、国家 | SQL 注入、XSS 等 |
| 规则类型 | 简单过滤 | 复杂规则包 |

### Q2: 如何阻止特定国家访问？

```bash
# 阻止国家
cfcli firewall add --description "Block CN" --action block --filter "ip.geoip.country eq CN"

# 允许特定国家
cfcli firewall add --description "Allow US" --action allow --filter "ip.geoip.country eq US"
```

### Q3: 如何阻止恶意 IP？

```bash
# 阻止 IP
cfcli firewall access block --target 1.2.3.4

# 或在 WAF 中阻止
cfcli firewall add --description "Block attacker" --action block --filter "ip.src eq 1.2.3.4"
```

### Q4: 速率限制 (Rate Limiting) 是什么？

速率限制用于限制 API 或页面的请求频率，防止滥用：
```bash
# 添加速率限制
cfcli waf rate-limits add \
  --description "API rate limit" \
  --action block \
  --period 60 \
  --requests 100
```

### Q5: 什么是 DDoS 防护？

Cloudflare 提供自动 DDoS 防护：
- **L3/L4 DDoS**：自动检测和缓解
- **L7 DDoS**：通过 WAF 和速率限制
- **Enterprise**：高级 DDoS 防护设置

### Q6: 如何启用 Authenticated Origin Pulls？

```bash
# 1. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. 在源站 Nginx 配置
ssl_client_certificate /path/to/cloudflare_ca.pem;
ssl_verify_client on;

# 3. 在 Cloudflare Dashboard 启用
# SSL/TLS → Origin Server → Authenticated Origin Pulls
```

---

## Workers 与计算 FAQ

### Q1: 什么是 Cloudflare Workers？

Workers 是边缘计算平台，在 Cloudflare 全球节点运行代码：
- **无服务器**：无需管理服务器
- **全球部署**：自动部署到 300+ 节点
- **低延迟**：靠近用户执行
- **免费额度**：每天 100,000 次请求

### Q2: 如何创建 Worker？

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  if (url.pathname === '/api/hello') {
    return new Response('Hello World!', {
      headers: { 'content-type': 'text/plain' }
    })
  }
  
  return fetch(request)
}
```

```bash
# 上传 Worker
cfcli workers upload --name my-api --file ./worker.js

# 添加路由
cfcli workers routes add --pattern "example.com/api/*" --script my-api
```

### Q3: Workers 支持哪些运行时？

- **JavaScript** / **TypeScript**
- **WebAssembly (Wasm)**
- **Rust** (编译为 Wasm)

### Q4: Workers 可以访问数据库吗？

**可以**，通过以下方式：
- **KV**：键值存储
- **D1**：SQLite 数据库
- **R2**：对象存储
- **外部 API**：通过 fetch 调用

### Q5: 什么是 Pages？

Pages 是静态网站托管平台：
- 自动构建部署
- 支持 React、Vue、Next.js 等框架
- 自动 SSL
- 全球 CDN

### Q6: Workers 和 Pages 有什么区别？

| 特性 | Workers | Pages |
|------|--------|-------|
| 用途 | 边缘计算/API | 静态网站 |
| 运行时 | V8 Isolates | 构建产物 |
| 部署方式 | 上传 JS 文件 | Git 集成 |
| 路由 | 自定义路由 | 自动路由 |

---

## 缓存与性能 FAQ

### Q1: 什么是 Cloudflare 缓存？

Cloudflare 缓存静态资源到全球节点，减少源站负载：
- **图片/CSS/JS**：自动缓存
- **HTML**：默认不缓存
- **边缘缓存**：存储在全球节点

### Q2: 如何清除缓存？

```bash
# 清除所有缓存
cfcli cache purge --everything

# 清除特定 URL
cfcli cache purge --urls https://example.com/style.css https://example.com/script.js
```

### Q3: 什么是缓存级别？

| 级别 | 说明 |
|------|------|
| **no_query_string** | 忽略查询字符串缓存 |
| **ignore_query_string** | 忽略查询字符串 |
| **basic** | 基于文件扩展名缓存 |
| **cache_everything** | 缓存所有请求 |

### Q4: 什么是 Development Mode？

开发模式临时禁用缓存，方便调试：
```bash
cfcli cache dev-mode --value on   # 启用
cfcli cache dev-mode --value off  # 关闭
```

### Q5: 如何设置缓存 TTL？

通过 Page Rules 或 Cache Rules：
```bash
# 创建 Page Rule 设置缓存
cfcli page-rules create \
  --targets "example.com/static/*" \
  --actions "cache_level:cache_everything,edge_cache_ttl:3600"
```

---

## Enterprise 功能 FAQ

### Q1: 什么是 Enterprise Plan？

Enterprise 是 Cloudflare 最高级别套餐，包含：
- 所有 Pro/Business 功能
- 高级安全功能 (WAF 自定义规则)
- 高级性能 (Image Resizing, Polish)
- 专属 SLA (100% 可用性)
- 专属解决方案架构师

### Q2: Enterprise 包含哪些安全功能？

| 功能 | 说明 |
|------|------|
| Advanced Certificate Manager | 自定义证书管理 |
| Custom WAF 规则 | 自定义防火墙规则 |
| DDoS 高级防护 | 高级 DDoS 缓解 |
| API Shield | API 安全保护 |
| Access/Zero Trust | 零信任访问控制 |

### Q3: 如何设置 Load Balancer？

```bash
# 1. 创建健康检查
cfcli health-checks create --name origin-health --address 1.2.3.4 --type http --path /health

# 2. 创建池
cfcli load-balancer pools create --name us-pool --origins-name server1 --origins-address 1.2.3.4

# 3. 创建负载均衡器
cfcli load-balancer create --name my-lb --pool-id <pool_id> --default-pool-ids <pool_id> --fallback-pool-id <pool_id>
```

### Q4: 什么是 Argo Smart Routing？

Argo 通过 Cloudflare 私有骨干网路由流量，减少延迟和丢包：
```bash
cfcli enterprise argo enable
```

### Q5: 什么是 Logpush？

Logpush 将日志推送到外部存储（S3、Splunk 等）：
```bash
cfcli enterprise logpush create \
  --name my-logpush \
  --destination s3://bucket/path?region=us-east-1 \
  --dataset http_requests
```

---

## 账单与账户 FAQ

### Q1: Cloudflare 有哪些套餐？

| 套餐 | 价格 | 适用场景 |
|------|------|---------|
| **Free** | 免费 | 个人网站、博客 |
| **Pro** | $20/月 | 小型企业 |
| **Business** | $200/月 | 中型企业 |
| **Enterprise** | 定制报价 | 大型企业 |

### Q2: 如何查看当前套餐？

```bash
cfcli account get
```

### Q3: 如何升级套餐？

在 Dashboard → Billing → Subscription 中升级

### Q4: 什么是附加组件 (Add-ons)？

附加组件是需要额外付费的功能：
- Advanced Certificate Manager
- Cloudflare Images
- Zaraz (Analytics)
- Workers Paid Plan

### Q5: 什么是 Workers 免费额度？

- **免费**：每天 100,000 次请求
- **Paid**：$5/月，包含 1000 万次请求，超出按量付费

---

## 故障排查 FAQ

### Q1: 网站显示 "502 Bad Gateway" 错误？

| 原因 | 解决方案 |
|------|---------|
| 源站宕机 | 检查源站是否正常运行 |
| 防火墙阻止 Cloudflare | 允许 Cloudflare IP |
| SSL 配置错误 | 检查 SSL 模式和证书 |
| 超时 | 增加超时设置 |

### Q2: 网站显示 "522 Connection Timed Out"？

源站未在 100 秒内响应：
- 检查源站是否正常运行
- 检查源站防火墙是否阻止 Cloudflare
- 考虑使用 Workers 代理

### Q3: 网站显示 "523 Origin Unreachable"？

源站 IP 地址无法访问：
- 检查 DNS 记录是否正确
- 检查源站是否在线
- 检查网络连接

### Q4: 网站显示 "Too Many Redirects"？

| 原因 | 解决方案 |
|------|---------|
| Flexible SSL + 源站强制 HTTPS | 改为 Full (strict) 或源站停止强制 HTTPS |
| Page Rules 循环重定向 | 检查 Page Rules 设置 |

### Q5: 如何检查 Cloudflare 状态？

```bash
# 检查 Cloudflare 服务状态
# https://www.cloudflarestatus.com/

# 检查域名状态
cfcli zone get
```

### Q6: 证书未自动更新怎么办？

1. 检查域名 DNS 是否正确指向 Cloudflare
2. 检查 DCV (域名控制验证) 是否完成
3. 检查是否有 CAA 记录阻止
4. 联系 Cloudflare 支持

### Q7: 如何测试 SSL 配置？

```bash
# 检查证书状态
cfcli certificate verification get

# 使用在线工具
# https://www.ssllabs.com/ssltest/
```

### Q8: 如何查看请求日志？

Enterprise 客户可以使用 Logpush：
```bash
cfcli enterprise logpush list
cfcli enterprise logpush get --id <job_id>
```

### Q9: 为什么缓存不生效？

- 检查响应头 `Cache-Control`
- 检查是否设置了 `no-cache`
- 检查 Page Rules 缓存设置
- 确保 DNS 记录是 Proxied (橙色云)

### Q10: 如何联系 Cloudflare 支持？

| 套餐 | 支持方式 |
|------|---------|
| Free | 社区论坛 |
| Pro | 社区论坛 + 电子邮件 |
| Business | 24/7 电子邮件 + 聊天 |
| Enterprise | 24/7 电话 + 专属支持 |

---

## 附录：常用命令速查

```bash
# === 域名和 DNS ===
cfcli zone list                    # 列出所有 Zone
cfcli dns list                    # 列出 DNS 记录
cfcli dns add --type A --name api --content 1.2.3.4 --proxied

# === SSL/TLS ===
cfcli ssl settings               # 查看 SSL 设置
cfcli ssl set --mode full-strict # 设置 SSL 模式
cfcli certificate universal get   # 查看 Universal SSL
cfcli certificate acm config    # 查看 ACM 配置

# === 防火墙 ===
cfcli firewall list              # 列出防火墙规则
cfcli firewall add --action block --filter "ip.src eq 1.2.3.4"

# === WAF ===
cfcli waf packages list         # 列出 WAF 规则包
cfcli waf rate-limits list      # 列出速率限制

# === Workers ===
cfcli workers list              # 列出 Workers
cfcli workers upload --name my-api --file ./worker.js

# === 缓存 ===
cfcli cache purge --everything  # 清除所有缓存
cfcli cache dev-mode --value on # 启用开发模式

# === Enterprise ===
cfcli load-balancer list       # 列出负载均衡器
cfcli health-checks list        # 列出健康检查
cfcli access apps list          # 列出 Access 应用

# === 证书 ===
cfcli certificate custom list     # 列出自定义证书
cfcli certificate keyless list    # 列出 Keyless 证书
cfcli certificate hostnames list  # 列出自定义主机名

# === IP 列表 ===
cfcli ip-lists list             # 列出 IP 列表
cfcli ip-lists create --name "Block List" --kind block

# === 通知 ===
cfcli notification alerts list   # 列出通知告警
cfcli notification policies list # 列出通知策略
```

---

> **文档版本**: v1.0  
> **最后更新**: 2026-08-14
