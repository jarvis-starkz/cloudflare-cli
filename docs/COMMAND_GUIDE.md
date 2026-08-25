# Cloudflare CLI 命令完全指南

> 本文档为每个命令提供详细的使用说明，适合零基础用户。

## 目录

1. [快速入门](#1-快速入门)
2. [Zone 管理](#2-zone-管理)
3. [DNS 管理](#3-dns-管理)
4. [防火墙管理](#4-防火墙管理)
5. [WAF 管理](#5-waf-管理)
6. [SSL/TLS 管理](#6-ssltls-管理)
7. [Workers 管理](#7-workers-管理)
8. [KV 存储管理](#8-kv-存储管理)
9. [R2 存储管理](#9-r2-存储管理)
10. [Pages 管理](#10-pages-管理)
11. [Waiting Room 管理](#11-waiting-room-管理)
12. [Custom Pages 管理](#12-custom-pages-管理)
13. [IP Lists 管理](#13-ip-lists-管理)
14. [Load Balancer 管理 (Enterprise)](#14-load-balancer-管理-enterprise)
15. [Health Checks 管理 (Enterprise)](#15-health-checks-管理-enterprise)
16. [Page Rules 管理 (Enterprise)](#16-page-rules-管理-enterprise)
17. [Stream 管理 (Enterprise)](#17-stream-管理-enterprise)
18. [Access/Zero Trust 管理 (Enterprise)](#18-accesszero-trust-管理-enterprise)
19. [API Shield 管理 (Enterprise)](#19-api-shield-管理-enterprise)
20. [Spectrum 管理 (Enterprise)](#20-spectrum-管理-enterprise)
21. [Enterprise 功能 (Enterprise)](#21-enterprise-功能-enterprise)
22. [Notifications 管理 (Enterprise)](#22-notifications-管理-enterprise)
23. [Certificate 管理](#23-certificate-管理)
24. [Account 管理](#24-account-管理)
25. [Cache 管理](#25-cache-管理)

---

## 1. 快速入门

### 安装

```bash
# 1. 安装依赖
npm install

# 2. (可选) 全局链接
npm link
```

### 初始化配置

```bash
# 运行初始化向导
cfcli init
```

按提示输入：
- **Account ID**: 在 https://dash.cloudflare.com → Account Home → Account ID
- **API Token**: 在 https://dash.cloudflare.com/profile/api-tokens 创建
- **Zone ID**: 在 https://dash.cloudflare.com → Your Domain → Zone ID

### 验证配置

```bash
# 验证 API Token 是否有效
cfcli verify
```

---

## 2. Zone 管理

### 什么是 Zone？

Zone 是 Cloudflare 管理的基本单位，对应你的域名 (如 `example.com`)。

### 常用命令

```bash
# 列出所有 Zone
cfcli zone list

# 获取当前 Zone 详情
cfcli zone get

# 获取 Zone 设置
cfcli zone settings

# 更新 Zone 设置
cfcli zone update-setting --name ssl --value strict
cfcli zone update-setting --name min_tls_version --value 1.2
cfcli zone update-setting --name always_use_https --value on
```

### 实际应用场景

- **查看域名状态**：检查域名是否正确接入 Cloudflare
- **修改安全设置**：调整 SSL 模式、最低 TLS 版本等

---

## 3. DNS 管理

### 什么是 DNS 记录？

DNS 记录是将域名指向 IP 地址的规则。

### 记录类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **A** | IPv4 地址 | `example.com` → `1.2.3.4` |
| **AAAA** | IPv6 地址 | `example.com` → `2001:db8::1` |
| **CNAME** | 别名 | `www.example.com` → `example.com` |
| **MX** | 邮件服务器 | `example.com` → `mail.example.com` |
| **TXT** | 文本记录 | 用于验证、SPF、DKIM |
| **SRV** | 服务记录 | SIP、XMPP 等 |

### 常用命令

```bash
# 列出所有 DNS 记录
cfcli dns list

# 按类型筛选
cfcli dns list --type A

# 按名称筛选
cfcli dns list --name example.com

# 获取单条记录
cfcli dns get --id <record_id>

# 添加 A 记录
cfcli dns add --type A --name api --content 1.2.3.4 --proxied

# 添加 CNAME 记录
cfcli dns add --type CNAME --name www --content example.com

# 添加 MX 记录
cfcli dns add --type MX --name @ --content mail.example.com --priority 10

# 添加 TXT 记录 (用于验证)
cfcli dns add --type TXT --name @ --content "v=spf1 include:_spf.google.com ~all"

# 更新记录
cfcli dns update --id <record_id> --type A --name api --content 5.6.7.8

# 删除记录
cfcli dns delete --id <record_id>

# 批量删除
cfcli dns bulk-delete --type A --name api
```

### 实际应用场景

- **添加子域名**：为 `api.example.com` 添加 A 记录
- **配置邮箱**：添加 MX 记录指向邮件服务商
- **验证域名**：添加 TXT 记录完成验证

### 代理状态说明

| 状态 | 图标 | 说明 |
|------|------|------|
| **Proxied** | 🟠 橙色云 | 流量经过 Cloudflare，享受保护 |
| **DNS Only** | ⚪ 灰色云 | 仅 DNS 解析，不经过 Cloudflare |

---

## 4. 防火墙管理

### 什么是防火墙规则？

防火墙规则用于控制谁可以访问你的网站。

### 规则动作

| 动作 | 说明 |
|------|------|
| **block** | 完全阻止访问 |
| **challenge** | 要求通过验证码 |
| **js_challenge** | 要求通过 JavaScript 挑战 |
| **allow** | 允许访问 |
| **log** | 仅记录不阻止 |

### 常用命令

```bash
# 列出防火墙规则
cfcli firewall list

# 添加阻止规则
cfcli firewall add --description "Block attacker IP" --action block --filter "ip.src eq 1.2.3.4"

# 添加国家阻止规则
cfcli firewall add --description "Block country" --action block --filter "ip.geoip.country eq CN"

# 添加允许规则
cfcli firewall add --description "Allow office IP" --action allow --filter "ip.src eq 5.6.7.8"

# 更新规则
cfcli firewall update --id <rule_id> --action challenge --filter "ip.src eq 1.2.3.4"

# 删除规则
cfcli firewall delete --id <rule_id>

# === 访问规则 (Access Rules) ===
cfcli firewall access list

# 阻止 IP
cfcli firewall access block --target 1.2.3.4

# 阻止国家
cfcli firewall access block --target CN --type country

# 允许 IP
cfcli firewall access allow --target 5.6.7.8

# 删除访问规则
cfcli firewall access delete --id <rule_id>

# === 账户级访问规则 (Account Access Rules · Enterprise) ===
# 应用于账户内 ALL zones，无需在每条规则中写表达式

# 列出账户级访问规则
cfcli firewall account-access list

# 按模式过滤
cfcli firewall account-access list --mode block

# 账户级封禁 IP (所有 zone 生效)
cfcli firewall account-access block --target 1.2.3.4 --type ip --mode block

# 账户级封禁 IP 网段
cfcli firewall account-access block --target 5.6.7.0/24 --type ip_range --mode block

# 账户级封禁国家 (所有 zone 屏蔽该国家)
cfcli firewall account-access block --target CN --type country --mode challenge

# 账户级封禁 ASN
cfcli firewall account-access block --target AS12345 --type asn --mode block

# 账户级白名单 (跳过安全检查，慎用)
cfcli firewall account-access block --target 203.0.113.0/24 --type ip_range --mode whitelist

# 更新账户级规则
cfcli firewall account-access update --id <rule_id> --mode challenge

# 删除账户级规则
cfcli firewall account-access delete --id <rule_id>
```

### 实际应用场景

- **阻止恶意 IP**：发现攻击者 IP 后立即阻止
- **国家限制**：只允许特定国家访问
- **办公室白名单**：只允许公司 IP 访问管理后台

---

## 5. WAF 管理

### 什么是 WAF？

**Web Application Firewall (WAF)** 用于保护网站免受 SQL 注入、XSS 等攻击。

### WAF 组件

```
WAF Package (规则包)
  └── Group (规则组)
      └── Rule (具体规则)
```

### 常用命令

```bash
# === WAF 规则包 ===
cfcli waf packages list
cfcli waf packages get --id <package_id>

# === WAF 规则组 ===
cfcli waf groups list --package-id <package_id>

# === WAF 规则 ===
cfcli waf rules list --package-id <package_id>
cfcli waf rules get --rule-id <rule_id>

# 更新规则动作
cfcli waf rules update --rule-id <rule_id> --action block
cfcli waf rules update --rule-id <rule_id> --action challenge

# === 速率限制 ===
cfcli waf rate-limits list

# 添加速率限制规则
cfcli waf rate-limits add \
  --description "API rate limit" \
  --action block \
  --period 60 \
  --requests 100

# 更新速率限制
cfcli waf rate-limits update --id <id> --requests 200

# 删除速率限制
cfcli waf rate-limits delete --id <id>
```

### 实际应用场景

- **防止暴力破解**：限制登录页面请求频率
- **API 限流**：防止 API 被滥用
- **阻止恶意 User-Agent**：阻止已知攻击工具

---

## 6. SSL/TLS 管理

> 详细 SSL/TLS 指南请参考 [SSL_TLS_GUIDE.md](./SSL_TLS_GUIDE.md)

### 常用命令

```bash
# 查看 SSL 设置
cfcli ssl settings

# 设置 SSL 模式
cfcli ssl set --mode strict
cfcli ssl set --mode full-strict

# HTTPS 重定向
cfcli ssl https redirect-enable
cfcli ssl https redirect-disable

# HTTP/2
cfcli ssl http2 enable
cfcli ssl http2 disable

# TLS 版本
cfcli ssl tls version
cfcli ssl tls set-version --version 1.2
cfcli ssl tls set-version --version 1.3
```

### SSL 模式说明

| 模式 | 说明 | 安全级别 |
|------|------|---------|
| **Off** | 不加密 | ❌ 不安全 |
| **Flexible** | 访客 HTTPS，源站 HTTP | ⚠️ 中等 |
| **Full** | 全程加密，不验证源站证书 | ✅ 安全 |
| **Full (strict)** | 全程加密 + 验证源站证书 | ✅✅ 最安全 |

---

## 7. Workers 管理

### 什么是 Workers？

Cloudflare Workers 是边缘计算平台，允许你在 Cloudflare 全球节点上运行代码。

### 常用命令

```bash
# 列出所有 Workers
cfcli workers list

# 上传 Worker
cfcli workers upload --name my-api --file ./worker.js

# 删除 Worker
cfcli workers delete --name my-api

# === 路由管理 ===
cfcli workers routes list

# 添加路由
cfcli workers routes add --pattern "example.com/api/*" --script my-api

# 删除路由
cfcli workers routes delete --id <route_id>
```

### Worker 示例代码

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  return new Response('Hello from Cloudflare Workers!', {
    headers: { 'content-type': 'text/plain' },
  })
}
```

---

## 8. KV 存储管理

### 什么是 KV？

Cloudflare KV 是全局分布式键值存储，用于 Workers 等场景。

### 常用命令

```bash
# 列出命名空间
cfcli kv namespaces list

# 创建命名空间
cfcli kv namespaces create --title "My App Config"

# 删除命名空间
cfcli kv namespaces delete --id <namespace_id>

# === 键值管理 ===
cfcli kv keys list --namespace-id <namespace_id>

# 获取值
cfcli kv keys get --namespace-id <namespace_id> --key api_key

# 设置值
cfcli kv keys put --namespace-id <namespace_id> --key api_key --value "secret123"

# 删除键
cfcli kv keys delete --namespace-id <namespace_id> --key api_key
```

---

## 9. R2 存储管理

### 什么是 R2？

R2 是 Cloudflare 的对象存储服务，兼容 S3 API。

### 常用命令

```bash
# 列出所有 Bucket
cfcli r2 buckets list

# 创建 Bucket
cfcli r2 buckets create --name my-data-bucket

# 获取 Bucket 详情
cfcli r2 buckets get --name my-data-bucket

# 删除 Bucket
cfcli r2 buckets delete --name my-data-bucket
```

---

## 10. Pages 管理

### 什么是 Pages？

Cloudflare Pages 是静态网站和 JAMstack 应用的托管平台。

### 常用命令

```bash
# 列出项目
cfcli pages projects list

# 获取项目详情
cfcli pages projects get --name my-website

# 创建项目
cfcli pages projects create --name my-website

# 删除项目
cfcli pages projects delete --name my-website

# === 部署管理 ===
cfcli pages deployments list --name my-website

# 创建部署
cfcli pages deployments create --name my-website

# === 域名管理 ===
cfcli pages domains list --name my-website

# 添加域名
cfcli pages domains add --name my-website --domain example.com
```

---

## 11. Waiting Room 管理

### 什么是 Waiting Room？

Waiting Room 用于在流量高峰时排队访客，防止服务器过载。

### 常用命令

```bash
# 列出等候室
cfcli waiting-room list

# 获取详情
cfcli waiting-room get --id <room_id>

# 创建等候室
cfcli waiting-room create --name "Product Launch" --host example.com --path /launch

# 更新等候室
cfcli waiting-room update --id <room_id> --name "Updated Room"

# 删除等候室
cfcli waiting-room delete --id <room_id>

# === 事件管理 ===
cfcli waiting-room events list --room-id <room_id>

# 创建事件
cfcli waiting-room events create \
  --room-id <room_id> \
  --name "Flash Sale" \
  --start 2026-01-01T00:00:00Z \
  --end 2026-01-02T00:00:00Z
```

---

## 12. Custom Pages 管理

### 什么是 Custom Pages？

Custom Pages 用于自定义 Cloudflare 显示的错误页面（如 502、503、1000 等）。

### 常用命令

```bash
# 列出自定义页面
cfcli custom-pages list

# 获取详情
cfcli custom-pages get --id <page_id>

# 更新页面
cfcli custom-pages update \
  --id <page_id> \
  --url https://example.com/custom-error \
  --state customized
```

---

## 13. IP Lists 管理 (账户级 · 跨 Zone 共享)

### 什么是 IP Lists？

IP Lists 是 Cloudflare 的 **账户级 Rules Lists**（API: `/accounts/{account_id}/rules/lists`），存储在账户级别，可跨账户内所有 zone 共享。在 WAF Custom Rules、Transform Rules、Bulk Redirects 中作为匹配数据源被引用。支持四种 kind：
- `ip` — IP 地址或网段（如 `1.2.3.4`、`5.6.7.0/24`）
- `asn` — 自治系统号（如 `AS12345`）
- `hostname` — 主机名（如 `admin.example.com`）
- `redirect` — 重定向 URL（配合 Bulk Redirects 使用）

引用语法: `$cf.ip_list{name:"list_name"}`、`$cf.asn_list{name:"..."}`、`$cf.hostname_list{name:"..."}`

### 常用命令

```bash
# 列出账户内所有 Lists
cfcli ip-lists list

# 获取详情
cfcli ip-lists get --id <list_id>

# 创建 IP 列表 (kind: ip / asn / hostname / redirect)
cfcli ip-lists create --name "blocklist" --kind ip --description "恶意 IP 清单"
cfcli ip-lists create --name "bad_asn" --kind asn
cfcli ip-lists create --name "allowed_hosts" --kind hostname
cfcli ip-lists create --name "maintenance_redirect" --kind redirect

# 删除列表
cfcli ip-lists delete --id <list_id>

# === 条目管理 ===
# 列出列表中的条目
cfcli ip-lists items list --id <list_id>

# 添加条目 (支持 IP/ASN/Hostname/Redirect，按 kind 自动识别)
cfcli ip-lists items add --id <list_id> --items 1.2.3.4 5.6.7.0/24 --comment "威胁情报"
cfcli ip-lists items add --id <list_id> --items AS12345 AS67890
cfcli ip-lists items add --id <list_id> --items admin.example.com
cfcli ip-lists items add --id <list_id> --items https://example.com/maintenance.html

# 删除条目 (需先获取 item-id)
cfcli ip-lists items delete --id <list_id> --item-ids <id1> <id2>
```

### 在 Custom Rules 中引用 (示例)

```
# 在 WAF Custom Rules 表达式中引用 IP List
(ip.src in $cf.ip_list{name:"blocklist"}) → Block
(ip.geoip.asnum in $cf.asn_list{name:"bad_asn"}) → Challenge
(http.host in $cf.hostname_list{name:"allowed_hosts"}) → Bypass
```

> 注: IP Lists 修改即时生效，所有引用此 list 的 Custom Rules 同步更新。

---

## 14. Load Balancer 管理 (Enterprise)

### 什么是 Load Balancer？

负载均衡器将流量分配到多个源站服务器，提高可用性和性能。

### 组件

```
Load Balancer (负载均衡器)
  ├── Pool (池) - 一组源站服务器
  │   └── Origin (源站)
  └── Monitor (监视器) - 健康检查
```

### 常用命令

```bash
# === 负载均衡器 ===
cfcli load-balancer list
cfcli load-balancer get --id <lb_id>

cfcli load-balancer create \
  --name my-lb \
  --pool-id <pool_id> \
  --default-pool-ids <pool_id> \
  --fallback-pool-id <pool_id>

cfcli load-balancer update --id <lb_id> --name updated-lb
cfcli load-balancer delete --id <lb_id>

# === 池管理 ===
cfcli load-balancer pools list

cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

cfcli load-balancer pools get --id <pool_id>
cfcli load-balancer pools update --id <pool_id> --name updated-pool
cfcli load-balancer pools delete --id <pool_id>

# === 监视器管理 ===
cfcli load-balancer monitors list

cfcli load-balancer monitors create \
  --type http \
  --expected-codes 200 \
  --interval 60

cfcli load-balancer monitors get --id <monitor_id>
cfcli load-balancer monitors update --id <monitor_id> --interval 30
cfcli load-balancer monitors delete --id <monitor_id>
```

---

## 15. Health Checks 管理 (Enterprise)

### 什么是 Health Checks？

健康检查用于监控源站服务器的健康状态。

### 常用命令

```bash
# 列出健康检查
cfcli health-checks list

# 获取详情
cfcli health-checks get --id <check_id>

# 创建健康检查
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# 更新健康检查
cfcli health-checks update --id <check_id> --name updated-check

# 删除健康检查
cfcli health-checks delete --id <check_id>
```

---

## 16. Page Rules 管理 (Enterprise)

### 什么是 Page Rules？

Page Rules 用于根据 URL 模式执行特定操作（如缓存、转发等）。

### 常用命令

```bash
# 列出 Page Rules
cfcli page-rules list

# 获取详情
cfcli page-rules get --id <rule_id>

# 创建 Page Rule
cfcli page-rules create \
  --targets "example.com/api/*" \
  --actions "cache_level:cache_everything"

# 更新 Page Rule
cfcli page-rules update --id <rule_id> --status active

# 删除 Page Rule
cfcli page-rules delete --id <rule_id>
```

---

## 17. Stream 管理 (Enterprise)

### 什么是 Stream？

Cloudflare Stream 是视频流媒体服务平台。

### 常用命令

```bash
# 列出视频
cfcli stream list

# 获取详情
cfcli stream get --id <video_id>

# 上传视频
cfcli stream upload --name my-video --file ./video.mp4

# 删除视频
cfcli stream delete --id <video_id>
```

---

## 18. Access/Zero Trust 管理 (Enterprise)

### 什么是 Access？

Cloudflare Access 提供零信任访问控制，保护内部应用。

### 组件

```
Access Application (应用)
  ├── Policy (策略) - 控制谁可以访问
  └── Group (用户组) - 用户分组
```

### 常用命令

```bash
# === 应用管理 ===
cfcli access apps list
cfcli access apps get --id <app_id>

cfcli access apps create --name internal-app --domain internal.example.com
cfcli access apps update --id <app_id> --name updated-app
cfcli access apps delete --id <app_id>

# === 策略管理 ===
cfcli access policies list --app-id <app_id>

cfcli access policies create \
  --app-id <app_id> \
  --name allow-team \
  --decision allow

cfcli access policies update --id <policy_id> --name updated-policy
cfcli access policies delete --id <policy_id>

# === 用户组管理 ===
cfcli access groups list

cfcli access groups create \
  --name team-group \
  --include-email @example.com

cfcli access groups update --id <group_id> --name updated-group
cfcli access groups delete --id <group_id>
```

---

## 19. API Shield 管理 (Enterprise)

### 什么是 API Shield？

API Shield 用于保护 API 端点，支持 mTLS 和 Schema 验证。

### 常用命令

```bash
# === 端点管理 ===
cfcli api-shield endpoints list
cfcli api-shield endpoints get --id <endpoint_id>

cfcli api-shield endpoints create --method GET --path /api/v1/users
cfcli api-shield endpoints update --id <endpoint_id> --method POST
cfcli api-shield endpoints delete --id <endpoint_id>

# === Schema 管理 ===
cfcli api-shield schemas list
cfcli api-shield schemas get --id <schema_id>

cfcli api-shield schemas create --name user-schema --file ./schema.json
cfcli api-shield schemas update --id <schema_id> --name updated-schema
cfcli api-shield schemas delete --id <schema_id>
```

---

## 20. Spectrum 管理 (Enterprise)

### 什么是 Spectrum？

Spectrum 为 TCP/UDP 应用提供 DDoS 保护和性能优化。

### 常用命令

```bash
# 列出应用
cfcli spectrum list

# 获取详情
cfcli spectrum get --id <app_id>

# 创建应用
cfcli spectrum create \
  --name my-app \
  --dns-type custom \
  --origin 1.2.3.4:8080

# 更新应用
cfcli spectrum update --id <app_id> --name updated-app

# 删除应用
cfcli spectrum delete --id <app_id>
```

---

## 21. Enterprise 功能 (Enterprise)

### 包含的功能

- Custom Nameservers (自定义域名服务器)
- Argo Smart Routing (智能路由)
- Logpush (日志推送)
- DDoS Protection (DDoS 防护)

### 常用命令

```bash
# === 自定义域名服务器 ===
cfcli enterprise custom-ns list
cfcli enterprise custom-ns add --ns ns1.example.com
cfcli enterprise custom-ns delete --ns ns1.example.com

# === Argo Smart Routing ===
cfcli enterprise argo get
cfcli enterprise argo enable
cfcli enterprise argo disable

# === Logpush ===
cfcli enterprise logpush list
cfcli enterprise logpush get --id <job_id>

cfcli enterprise logpush create \
  --name my-logpush \
  --destination s3://bucket/path?region=us-east-1 \
  --dataset http_requests

cfcli enterprise logpush update --id <job_id> --frequency low
cfcli enterprise logpush delete --id <job_id>

# === DDoS 防护 ===
cfcli enterprise ddos get
cfcli enterprise ddos enable
cfcli enterprise ddos disable
```

---

## 22. Notifications 管理 (Enterprise)

### 什么是 Notifications？

Notifications 用于接收 Cloudflare 发送的告警通知。

### 常用命令

```bash
# === 告警通知 ===
cfcli notification alerts list
cfcli notification alerts get --id <alert_id>
cfcli notification alerts history

# === 通知策略 ===
cfcli notification policies list
cfcli notification policies get --id <policy_id>

cfcli notification policies create \
  --name "LB Health Alert" \
  --alert-type load_balancing_health_alert

cfcli notification policies update --id <policy_id> --name updated-policy
cfcli notification policies delete --id <policy_id>

# === Webhooks ===
cfcli notification webhooks list
cfcli notification webhooks get --id <webhook_id>

cfcli notification webhooks create \
  --name "My Webhook" \
  --url https://hooks.slack.com/services/xxx

cfcli notification webhooks update --id <webhook_id> --name updated-webhook
cfcli notification webhooks delete --id <webhook_id>

# === PagerDuty 集成 ===
cfcli notification pagerduty get
cfcli notification pagerduty connect --integration-url https://events.pagerduty.com/integration/xxx
cfcli notification pagerduty disconnect
```

---

## 23. Certificate 管理

> 详细 SSL/TLS 指南请参考 [SSL_TLS_GUIDE.md](./SSL_TLS_GUIDE.md)

### 常用命令

```bash
# === 自定义证书 ===
cfcli certificate custom list
cfcli certificate custom get --id <cert_id>
cfcli certificate custom upload --certificate <PEM> --private-key <PEM>
cfcli certificate custom update --id <cert_id> --certificate <PEM>
cfcli certificate custom delete --id <cert_id>

# === 证书捆绑 ===
cfcli certificate bundles list
cfcli certificate bundles update --certificates <id1> <id2>

# === Keyless SSL (Enterprise) ===
cfcli certificate keyless list
cfcli certificate keyless create --name my-keyless --host keystore.example.com --port 3443
cfcli certificate keyless delete --id <cert_id>

# === 自定义主机名 (Enterprise) ===
cfcli certificate hostnames list
cfcli certificate hostnames create --hostname app.example.com --origin origin.example.com
cfcli certificate hostnames delete --id <hostname_id>

# === ACM (Enterprise) ===
cfcli certificate acm config
cfcli certificate acm update --enabled --ca lets_encrypt --hostnames example.com

# === SSL 验证 ===
cfcli certificate verification get

# === Universal SSL ===
cfcli certificate universal get
cfcli certificate universal enable
cfcli certificate universal disable

# === 证书颁发机构 ===
cfcli certificate authorities list

# === Total TLS (Enterprise) ===
cfcli certificate total-tls get
cfcli certificate total-tls enable --ca lets_encrypt
cfcli certificate total-tls disable
```

---

## 24. Account 管理

### 常用命令

```bash
# 验证 Token
cfcli account verify

# 列出账户
cfcli account list

# 获取账户详情
cfcli account get

# 列出成员
cfcli account members list
```

---

## 25. Cache 管理

### 常用命令

```bash
# 清除所有缓存
cfcli cache purge --everything

# 清除特定 URL
cfcli cache purge --urls https://example.com/page1 https://example.com/page2

# 查看缓存设置
cfcli cache settings

# 切换开发模式
cfcli cache dev-mode --value on
cfcli cache dev-mode --value off
```

---

## 附录：环境变量

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Zone ID |

---

> **文档版本**: v1.0  
> **最后更新**: 2026-08-14  
> **适用 CLI 版本**: cfcli v1.0.0
