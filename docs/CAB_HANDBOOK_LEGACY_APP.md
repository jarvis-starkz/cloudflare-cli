# Cloudflare Proxied Mode Compatibility & Security Enablement — CAB Implementation Handbook

> **场景基线**：Legacy Application + Cloudflare Proxied Mode + Security Challenge
> **Plan 假设**：Enterprise（本手册所有功能名词、能力边界、Ruleset 命名均按 Enterprise Plan 描述；Free/Pro/Business 仅作对照说明）
> **版本**：v1.0
> **配套 CLI**：`cfcli`（参见 COMMAND_GUIDE.md / REQUEST_FLOW_GUIDE.md）

---

## 封面

| 项目 | 内容 |
|------|------|
| **项目名称** | NC Services Legacy App Cloudflare Proxied Mode 兼容性与安全启用项目 |
| **变更编号 (CRQ)** | CRQ-2026-0817-001 |
| **CAB 编号** | CAB-2026-0817-01 |
| **变更窗口** | 2026-08-23 02:00 – 06:00 (Asia/Shanghai, UTC+8) · 业务低峰维护窗口 |
| **版本** | v1.0 |
| **作者** | Cloudflare Platform Team · NC Services Limited |
| **审批人** | CAB 委员会 (CIO / CISO / 应用架构 / 网络运维 / SRE Lead) |
| **发布时间** | 2026-08-17 |

---

## 文档控制

### 修订记录

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-08-10 | CF Platform Team | 初稿框架 |
| 0.5 | 2026-08-13 | CF Platform Team | 补充风险矩阵与回滚预案 |
| 0.9 | 2026-08-15 | 应用架构组 | 补充 Legacy App 兼容性评估 |
| 1.0 | 2026-08-17 | CF Platform Team | CAB 定稿（含衍生场景与全景链路图） |

### 审批记录

| Role | Name | Approval |
|------|------|----------|
| CAB Chair | _____ | ⏳ Pending |
| CISO | _____ | ⏳ Pending |
| CIO | _____ | ⏳ Pending |
| Application Owner (Legacy App) | _____ | ⏳ Pending |
| Network Operations Lead | _____ | ⏳ Pending |
| SRE Lead | _____ | ⏳ Pending |
| Change Manager | _____ | ⏳ Pending |

---

## 第一章 Executive Summary

### 1.1 变更背景

NC Services Limited 运营一套 2010 年代上线的 Legacy 业务系统（下称 "Legacy App"），承载核心订单、客户档案、对账与第三方对接功能。系统当前直连公网，仅靠源站 iptables / Nginx 限流与一台已过保的 WAF 设备做基础防护，存在以下问题：

1. **暴露面过大**：源站 IP 直接出现在公网 DNS 中，曾遭受多次 L7 HTTP Flood 与 Slowloris 攻击。
2. **防护能力陈旧**：现有 WAF 规则库已 18 个月未更新，无法覆盖 OWASP CRS 4.x 新增签名。
3. **缺乏真实客户端 IP 链路**：所有日志为源站 IP，安全审计与欺诈追溯困难。
4. **合规缺口**：等保 2.0 三级、PCI-DSS v4.0 要求"Web 应用前置防护 + DDoS 防护 + 真实来源审计"，现状不满足。
5. **业务连续性风险**：单源站无灾备，源站宕机即业务中断。

经评估，决定将 Legacy App 接入 Cloudflare Enterprise Plan，启用 Proxied Mode（橙色云），并叠加 Security Challenge（Managed Challenge / JS Challenge）等安全能力。

### 1.2 业务需求

| 业务需求 | 优先级 | 衡量指标 |
|----------|--------|----------|
| 提升 Web 应用安全水位，满足等保 2.0 / PCI-DSS | P0 | 通过第三方渗透测试 + 合规审计 |
| 防御 L3/L4/L7 DDoS 攻击，源站零感知 | P0 | 攻击期间业务 RPS 下降 < 5% |
| 准确还原真实客户端 IP 用于审计与风控 | P0 | 100% 日志含 `cf-connecting-ip` |
| Legacy App 零改造，降低业务风险 | P0 | 应用代码 0 行变更 |
| 提升 Legacy App 可用性，支持灾备 | P1 | SLA 99.95% → 99.99% |
| 建立统一访问控制策略，覆盖多业务线 | P1 | 单点配置全账户生效 |

### 1.3 技术需求

| 技术需求 | Cloudflare 对应能力 (Enterprise 准确名词) |
|----------|------------------------------------------|
| 反向代理 + DNS 接入 | Cloudflare DNS (权威) + Full Setup / Proxied Mode (橙色云) |
| L3/L4/L7 DDoS 防护 | Advanced DDoS Protection (Network-layer L3/L4 + HTTP DDoS Protection L7) |
| Web 应用防火墙 | Web Application Firewall (WAF) — Custom Rules + Cloudflare Managed Ruleset + Cloudflare OWASP Core Rule Set + Cloudflare Exposed Credentials Check + Page Shield |
| 速率限制 | Rate Limiting Rules (Phase: http_ratelimit) + Advanced Rate Limiting |
| 自动化挑战 | Managed Challenge (推荐处置) / JS Challenge / CAPTCHA |
| Bot 防护 | Bot Management (Bot Score + JA3/JA4 + HTTP/2 指纹) |
| 真实客户端 IP | `CF-Connecting-IP` / `True-Client-IP` Header + Origin 改造 |
| SSL/TLS 加密 | Universal SSL (边缘) + Origin CA (源站) + SSL 模式 Full (Strict) |
| 源站锁定 | Authenticated Origin Pulls (mTLS) + Cloudflare IP Allowlist |
| 跨 Zone 统一管控 | Account-level Access Rules + Rules Lists (`/accounts/{id}/rules/lists`) |
| 灾备分发 | Cloudflare Load Balancer (Pools + Steering + Health Checks) |
| 流量整形 | Waiting Room (Legacy App 高并发排队保护) |

### 1.4 变更目标

1. **Proxied Mode 启用**：Legacy App 所有公网 DNS 记录改为 Proxied (橙色云)，源站 IP 从公网 DNS 中消失。
2. **WAF 上线**：Custom Rules + Cloudflare Managed Ruleset + OWASP CRS (Paranoia Level 1) 默认 Block。
3. **Security Challenge 启用**：对高风险路径 (/admin / /api/v1/internal) 与高 Bot Score 流量启用 Managed Challenge。
4. **真实 IP 还原**：Nginx/IIS/Apache 源站配置 `cf-real-ip` 模块，日志 100% 记录真实客户端 IP。
5. **源站锁定**：启用 Authenticated Origin Pulls (mTLS) + Cloudflare IP Allowlist，源站仅接受来自 Cloudflare 的请求。
6. **零改造**：Legacy App 业务代码 0 行变更，所有兼容性问题通过 Cloudflare 配置解决。

### 1.5 预期收益

| 维度 | 现状 | 目标 | 收益 |
|------|------|------|------|
| 源站 IP 暴露 | 公网可见 | 隐藏 | 攻击面收敛 100% |
| DDoS 防护 | 无 | Advanced DDoS Protection (L3/L4 + L7) | 不限流量、零感知 |
| WAF 规则库 | 18 月未更新 | Cloudflare Managed Ruleset (实时更新) | 0day 虚拟补丁自动覆盖 |
| 真实客户端 IP | 缺失 | 100% 还原 | 审计与风控闭环 |
| 合规 | 缺口 | 等保 2.0 三级 / PCI-DSS v4.0 满足 | 通过审计 |
| 源站可用性 | 单点 | LB + Health Checks | SLA 99.95% → 99.99% |
| 运维成本 | 高 | 统一账户级管控 | 多 zone 策略 1 处配置 |

---

## 第二章 Scope & Assumptions

### 2.1 In Scope

| 资产 | 主机名 | 接入方式 | 说明 |
|------|--------|----------|------|
| Website (Portal) | `app.nc-services.com` | Full Setup · Proxied | 主门户，含登录/订单/对账 |
| API (REST) | `api.nc-services.com` | Full Setup · Proxied | RESTful API，供移动端与第三方调用 |
| Login Services | `login.nc-services.com` | Full Setup · Proxied | 表单登录 + 密码找回 |
| SSO | `sso.nc-services.com` | Full Setup · Proxied | SAML IdP + OAuth2 Authorization Server |
| Third-party Integrations | `webhook.nc-services.com` | Full Setup · Proxied | 接收支付回调、物流回调 |
| Static Assets | `static.nc-services.com` | Full Setup · Proxied | JS/CSS/图片 (启用 Cache Reserve) |
| Admin Console | `admin.nc-services.com` | Full Setup · Proxied + Zero Trust | 仅允许 Zero Trust Access (_googleoid/SAML) |

### 2.2 Out of Scope

| 排除项 | 原因 |
|--------|------|
| 邮件流量 (SMTP/IMAP) | 不走 Cloudflare HTTP 代理，保持原 MX 直连 |
| 非 HTTP 内部系统 (RDP/SSH) | 走 Cloudflare Zero Trust Access (单独 CRQ) |
| 数据库迁移 | 与本变更无关 |
| Legacy App 代码重构 | 本变更要求零改造，重构另行立项 |
| 第三方 SaaS (Salesforce 等) | 由 SaaS 供应商负责 |

### 2.3 前提条件

| 类别 | 前提条件 | 验证方式 |
|------|----------|----------|
| **Network** | 源站公网出口带宽 ≥ 1 Gbps；Cloudflare PoP 至源站 RTT < 50ms | `mtr` / `cfcli zone get` |
| **Firewall** | 源站防火墙支持 IP Allowlist（iptables / 安全组 / WAF 设备） | 防火墙策略评审 |
| **DNS** | 域名注册商支持 NS 切换至 Cloudflare；DNS TTL < 3600s | `dig` / 注册商面板 |
| **SSL Certificate** | 边缘 Universal SSL 已签发；源站 Origin CA 或 Let's Encrypt 证书有效 | `cfcli certificate list` / `openssl s_client` |
| **Origin Server** | Nginx ≥ 1.18 / IIS ≥ 10 / Apache ≥ 2.4，支持 `set_real_ip_from` / `X-Forwarded-For` 处理 | `nginx -v` / 模块检查 |
| **Account** | Cloudflare Enterprise Plan 已开通；Account ID / API Token / Zone ID 已就位 | `cfcli verify` |
| **Application** | Legacy App 不强制校验源站 IP（仅校验 Host/Header） | 应用配置审计 |
| **Monitoring** | 已部署 Prometheus / Grafana / ELK；可接入 Cloudflare Logs (Logpush) | 监控告警联调 |

---

## 第三章 Current State Assessment

### 3.1 As-Is Architecture

```
┌──────────┐                                              ┌──────────┐
│          │  ① DNS 解析 (注册商权威 DNS 直返源站 IP)        │          │
│  Client  │ ────────────────────────────────────────────►│  Origin  │
│ (Browser)│                                              │ (单源站) │
│          │  ② HTTPS 直连源站 (源站 IP 公网暴露)            │          │
│          │ ────────────────────────────────────────────►│  Nginx   │
│          │                                              │  + App   │
│          │  ③ 源站本地 WAF (18 月未更新) + iptables 限流    │          │
│          │ ────────────────────────────────────────────►│          │
└──────────┘                                              └──────────┘
```

**当前访问路径关键点：**
- 客户端直接访问源站公网 IP
- 源站 IP 在 DNS 中暴露
- 防护能力依赖源站本地 WAF + iptables
- 无 CDN 缓存，每次请求回源
- 无 DDoS 防护，攻击直接打源站
- 无真实客户端 IP 还原机制（双 NAT 后无法审计）

### 3.2 Existing Security Controls

| 控制类别 | 现状 | 不足 |
|----------|------|------|
| **Current WAF** | ModSecurity 2.9 + OWASP CRS 3.0 (2018 版) | 规则库 18 月未更新；缺少 0day 虚拟补丁；无 ML 引擎 |
| **Firewall** | iptables + 阿里云安全组 | 仅 IP/端口级；无应用层规则；无地理封禁 |
| **IDS/IPS** | Snort (旁路) | 仅告警，不阻断；规则库滞后 |
| **DDoS** | 无 | 完全依赖源站带宽扛 |
| **Rate Limiting** | Nginx `limit_req` (单机) | 无法分布式计数；易被绕过 |
| **Bot 防护** | User-Agent 黑名单 (手工) | 维护成本高；易误判 |
| **真实客户端 IP** | 缺失 | 双 NAT 后日志只有内网 IP |
| **审计日志** | Nginx access log (本地) | 未集中；无 SIEM 接入 |

### 3.3 Existing Risks

| 风险 ID | 描述 | 严重度 |
|---------|------|--------|
| R-CUR-01 | 源站 IP 公网暴露，可被直接攻击绕过 WAF | 高 |
| R-CUR-02 | DDoS 防护缺失，单次 HTTP Flood 即可拖垮源站 | 高 |
| R-CUR-03 | WAF 规则陈旧，无法防御新 CVE (Log4Shell / Spring4Shell 等) | 高 |
| R-CUR-04 | 真实客户端 IP 缺失，无法追溯欺诈与攻击 | 中 |
| R-CUR-05 | 单源站无灾备，硬件故障即业务中断 | 中 |
| R-CUR-06 | 等保 / PCI-DSS 合规审计未通过 | 高 |

---

## 第四章 Target Architecture

### 4.1 To-Be Architecture

```
┌──────────┐         ┌──────────────────────────────────────┐         ┌──────────┐
│          │ ① DNS   │           Cloudflare Edge            │  ⑬ mTLS │          │
│  Client  │ ──────► │  (Anycast · 全球 300+ PoP)            │ ──────► │  Origin  │
│ (Browser)│         │                                       │         │ (LB 后端)│
│          │ ② TLS   │ ③ Advanced DDoS Protection            │         │ Nginx +  │
│          │ ──────► │ ④ Bot Management                      │         │ Origin CA│
│          │         │ ⑤ WAF (Custom/Managed/Rate Limiting)  │         │          │
│          │         │ ⑥ Waiting Room (高并发排队)            │         │          │
│          │         │ ⑦ Cache (Smart Tiered + Reserve)      │         │          │
│          │         │ ⑧ Ruleset Engine (Redirect/Transform) │         │          │
│          │         │ ⑨ Workers (可选 · 边缘计算)            │         │          │
│          │         │ ⑩ Load Balancer (多 Pool · Health)    │         │          │
│          │         │ ⑪ Argo Smart Routing                  │         │          │
│          │         │ ⑫ Authenticated Origin Pulls (mTLS)   │         │          │
└──────────┘         └──────────────────────────────────────┘         └──────────┘
                            │
                            ▼
                     Account-level 层
                     · Account Access Rules (跨 zone 生效)
                     · Rules Lists (IP / ASN / Hostname / Redirect)
```

### 4.2 Security Layers

| 层 | Cloudflare 功能名 (Enterprise) | 处置/动作 | 启用阶段 |
|----|-------------------------------|-----------|----------|
| L0 | Cloudflare DNS (Anycast 权威) | 解析 | Phase 1 |
| L1 | Advanced DDoS Protection (L3/L4 + L7) | 自动缓解 (Block/Challenge/Rate Limit) | 始终开启 |
| L2 | Bot Management | Bot Score → Allow/Block/Managed Challenge | Phase 5 |
| L3 | WAF · Custom Rules (Phase: http_request_firewall_custom) | Block/Challenge/Skip | Phase 2 |
| L4 | WAF · Cloudflare Managed Ruleset | Block/Log | Phase 2 |
| L5 | WAF · Cloudflare OWASP Core Rule Set (Paranoia 1) | Block/Log | Phase 2 |
| L6 | WAF · Cloudflare Exposed Credentials Check | Block + Log | Phase 2 |
| L7 | WAF · Page Shield (前端 JS 劫持防护) | Log + Block | Phase 2 |
| L8 | WAF · Rate Limiting Rules (Phase: http_ratelimit) | Block/Challenge | Phase 3 |
| L9 | WAF · WAF Attack Score (ML) | Custom Rules 引用 | Phase 2 |
| L10 | Managed Challenge (处置动作) | Managed Challenge / JS Challenge / CAPTCHA | Phase 4 |
| L11 | Waiting Room | 排队 | Phase 4 (按需) |
| L12 | Cache (Smart Tiered Cache + Cache Reserve) | HIT 直接返回 | Phase 1 |
| L13 | Ruleset Engine (Redirect/Transform/Configuration/Origin Rules) | 改写 | Phase 1 |
| L14 | Load Balancer + Health Checks | Pool 选择/故障转移 | Phase 1 (灾备场景) |
| L15 | Authenticated Origin Pulls (mTLS) | 证书验证 | Phase 1 |
| L16 | Account-level Access Rules + Rules Lists | 跨 zone Block/Challenge | Phase 2 |

### 4.3 Traffic Flow

| 流量类型 | 处理路径 | 特殊配置 |
|----------|----------|----------|
| **HTTP** (80) | 自动 301 → HTTPS (443) | Always Use HTTPS = on |
| **HTTPS** (443) | Universal SSL 终结 → Full (Strict) 回源 | SSL 模式 = Full (Strict) |
| **API** (REST/JSON) | WAF Custom Rules (Skip Managed Challenge) + Rate Limiting Rules | API 路径跳过 Managed Challenge |
| **WebSocket** (wss) | Cloudflare 默认支持；保持长连接 | 600s 超时；不缓存 |
| **文件上传** | 100MB (Free) / 200MB (Pro) / 500MB (Biz) / 500MB (Ent 默认，可申请提升) | Workers 大文件分片 |
| **文件下载** | Cache Reserve + Tiered Cache 加速 | 静态资源 Cache Everything |
| **SSO Callback** (SAML/OAuth) | Transform Rules 透传 `X-Forwarded-Proto: https` | 防止 SSO 重定向回 HTTP |
| **Payment Gateway 回调** | WAF Custom Rules Allow 指定来源 IP/ASN | Exposed Credentials Check 跳过 |

---

## 第五章 Business Impact Analysis

### 5.1 Service Impact

| 服务 | 影响 | 缓解 |
|------|------|------|
| 主门户 Website | 切换 DNS 时 < 5min 不可达 | 维护窗口内切换；TTL < 300s |
| API | API 客户端可能因 SSL 证书变化告警 | 提前 7 天通知所有 API 接入方 |
| Login Services | Session Cookie 域名不变，无影响 | 无 |
| SSO | SAML ACS URL 不变；但需透传 `X-Forwarded-Proto` | Transform Rules 配置 |
| Webhook | 第三方回调需验证 Cloudflare 证书 | 提供回调方 Cloudflare IP 段 |

### 5.2 User Impact

| 用户类型 | 影响 | 缓解 |
|----------|------|------|
| 普通用户 (Browser) | 几乎无感；首次访问可能触发 Managed Challenge | 仅对高风险路径启用 Challenge |
| 管理员 (Admin Console) | 强制走 Zero Trust Access，需 SSO 登录 | 提前培训 |
| API 客户端 (Mobile/Server) | 需处理 HTTP 523/525 等新错误码 | 提供错误码处理指南 |
| 老旧浏览器 (IE 11) | Managed Challenge 可能失败 → 降级 Challenge | Phase 4 灰度，准备 Skip 规则 |

### 5.3 Third-party Impact

| 第三方 | 影响 | 缓解 |
|--------|------|------|
| 支付网关 (Stripe/Alipay) | 回调需验证 Cloudflare 证书 | 提供回调 IP 白名单 + Webhook 签名 |
| 物流回调 | 同上 | 同上 |
| OAuth IdP (Azure AD) | SAML/OAuth 流程需透传 HTTPS Header | Transform Rules 配置 |
| SEO 爬虫 (Google/Bing) | Bot Management 自动识别 Verified Bots 放行 | Verified Bots 白名单 |

### 5.4 Authentication Impact

| 认证方式 | 影响 | 缓解 |
|----------|------|------|
| 表单登录 | 无 | — |
| SAML SSO | ACS URL 协议可能识别为 HTTP (因源站收到的是 CF 回源) | Transform Rules 注入 `X-Forwarded-Proto: https` |
| OAuth2 | 回调 URL 协议同上 | 同上 |
| Basic Auth | WAF Managed Rules 可能误判 → Custom Rules Skip | 配置 Skip 规则 |
| mTLS (客户端证书) | Enterprise 可启用 mTLS Client Cert | 与 Authenticated Origin Pulls 区分 |

---

## 第六章 Compatibility Risk Assessment

### 6.1 Client IP Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App 日志、风控、防重放均依赖客户端 IP。Proxied Mode 后源站看到的源 IP 是 Cloudflare 边缘 IP。 |
| **Impact** | 风控失效；欺诈追溯无源；登录失败计数错误；地域限制失效 |
| **Mitigation** | 1. 源站 Nginx/IIS/Apache 配置 `set_real_ip_from` + `CF-Connecting-IP` Header 解析<br>2. 防火墙 Allowlist 仅允许 [Cloudflare IP 段](https://www.cloudflare.com/ips)<br>3. 应用层读取 `CF-Connecting-IP` 替代 `REMOTE_ADDR`<br>4. 启用 Authenticated Origin Pulls (mTLS) 防止伪造 Header |

### 6.2 Legacy Browser Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App 5% 流量来自 IE 11 / 旧版 Edge / 旧版 Safari，Managed Challenge 的 JS Challenge 可能不支持 |
| **Impact** | 旧浏览器用户无法通过 Challenge → 业务中断 |
| **Mitigation** | 1. Custom Rules 对旧 User-Agent Skip Managed Challenge<br>2. 灰度启用 Challenge (5% → 25% → 100%)<br>3. 准备回滚规则 |

### 6.3 API Compatibility Risk

| 项 | 内容 |
|----|------|
| **Description** | API 流量不应被 Managed Challenge 拦截；但 WAF Managed Rules 可能误判 JSON Payload |
| **Impact** | API 误判 Block → 第三方集成失败 |
| **Mitigation** | 1. Custom Rules 对 `/api/*` 路径 Skip Managed Challenge<br>2. OWASP CRS Paranoia Level 1 (低误判)<br>3. Managed Ruleset Override 对 API 路径 Log only（先观察 1 周）<br>4. Exposed Credentials Check 仅对登录路径启用 |

### 6.4 Session/Cookie Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App Session Cookie 使用 `HttpOnly` + `Secure`，需确保回源走 HTTPS |
| **Impact** | Cookie 不被发送 → 用户被登出 |
| **Mitigation** | 1. SSL 模式 Full (Strict) 保证回源 HTTPS<br>2. Transform Rules 注入 `X-Forwarded-Proto: https`<br>3. Always Use HTTPS = on |

### 6.5 SSL/TLS Risk

| 项 | 内容 |
|----|------|
| **Description** | 源站证书可能过期或不受 Cloudflare 信任；旧版 TLS 1.0/1.1 客户端兼容 |
| **Impact** | 525/526 错误；旧客户端无法访问 |
| **Mitigation** | 1. 源站部署 Origin CA 证书（15 年有效）<br>2. SSL 模式 Full (Strict) 验证源站证书<br>3. Min TLS Version = 1.2（关闭 1.0/1.1）<br>4. 旧客户端引导升级 |

### 6.6 WebSocket Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App 实时通知使用 WebSocket (wss) |
| **Impact** | 若 WAF 误判 WS 升级请求 → 实时通知失效 |
| **Mitigation** | 1. Cloudflare 默认支持 WebSocket (无需特殊配置)<br>2. Custom Rules 对 WS 路径 Skip Rate Limiting<br>3. 连接超时 600s |

### 6.7 Upload / Download Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App 支持 PDF 上传 (最大 500MB) 与批量下载 |
| **Impact** | Enterprise 默认 500MB 上传限制；Cache 影响大文件下载 |
| **Mitigation** | 1. 申请 Enterprise 上传配额提升 (如需)<br>2. 大文件下载启用 Cache Reserve + Tiered Cache<br>3. Workers 分片上传 |

### 6.8 Caching Risk

| 项 | 内容 |
|----|------|
| **Description** | Legacy App 部分动态内容误被 Cache → 数据不一致 |
| **Impact** | 用户看到他人数据（严重） |
| **Mitigation** | 1. Cache Rules 默认仅 Cache 静态扩展名 (.js/.css/.png/.jpg)<br>2. 动态路径 (`/api/*` / `/admin/*`) Cache Level = Bypass<br>3. 启用 Cache Reserve 仅对静态资源 |

### 6.9 SSO Risk

| 项 | 内容 |
|----|------|
| **Description** | SAML ACS URL 协议识别错误；OAuth 回调协议错误 |
| **Impact** | SSO 登录失败回退到 HTTP；OAuth 回调失败 |
| **Mitigation** | 1. Transform Rules 注入 `X-Forwarded-Proto: https`<br>2. SAML ACS URL 配置为 `https://`<br>3. Always Use HTTPS = on |

### 6.10 Callback Risk

| 项 | 内容 |
|----|------|
| **Description** | 第三方支付/物流回调需源站验证来源 IP |
| **Impact** | 回调被防火墙阻断 → 订单状态不更新 |
| **Mitigation** | 1. 防火墙 Allowlist 同时放行 Cloudflare IP 段与第三方回调 IP<br>2. Webhook 签名验证 (HMAC)<br>3. Custom Rules Allow 第三方回调 ASN |

---

## 第七章 Risk Matrix

### 7.1 Risk Scoring Method

**Impact 评分 (1-5)：**

| 分值 | 含义 |
|------|------|
| 5 | 灾难性：核心业务中断 > 1h |
| 4 | 严重：核心业务中断 < 1h 或次要业务中断 |
| 3 | 中等：部分功能受影响 |
| 2 | 轻微：少量用户受影响 |
| 1 | 极轻：仅告警，无业务影响 |

**Probability 评分 (1-5)：**

| 分值 | 含义 |
|------|------|
| 5 | 几乎确定 (>90%) |
| 4 | 很可能 (50-90%) |
| 3 | 可能 (25-50%) |
| 2 | 不太可能 (10-25%) |
| 1 | 罕见 (<10%) |

**Rating = Impact × Probability：**

| Rating | 等级 | 处置 |
|--------|------|------|
| ≥ 15 | 极高 | 必须缓解后才能 Go-Live |
| 9-14 | 高 | 必须有缓解措施 + 应急预案 |
| 4-8 | 中 | 监控 + 准备回滚 |
| < 4 | 低 | 接受风险 |

### 7.2 Risk Register

| Risk ID | Description | Impact | Likelihood | Rating | Control |
|---------|-------------|--------|------------|--------|---------|
| R-01 | 真实客户端 IP 还原失败导致风控失效 | 5 | 3 | **15** | Nginx `set_real_ip_from` + `CF-Connecting-IP`；Phase 1 UAT 验证 |
| R-02 | Managed Challenge 导致旧浏览器用户无法访问 | 4 | 4 | **16** | Custom Rules Skip 旧 UA；灰度 5% → 100% |
| R-03 | WAF OWASP CRS 误判 API JSON Payload | 4 | 3 | **12** | Paranoia Level 1；API 路径 Log only 1 周 |
| R-04 | SSL Full (Strict) 因源站证书不受信任 → 525 | 5 | 2 | **10** | 部署 Origin CA；UAT 验证 |
| R-05 | SSO 回调协议识别为 HTTP → 登录失败 | 4 | 3 | **12** | Transform Rules 注入 `X-Forwarded-Proto: https` |
| R-06 | Webhook 回调被防火墙阻断 | 3 | 3 | **9** | Allowlist 同时放行 CF + 第三方 IP |
| R-07 | Cache 误存动态内容 → 数据泄露 | 5 | 2 | **10** | Cache Rules 默认仅静态；动态路径 Bypass |
| R-08 | Authenticated Origin Pulls 配置错误 → 全站 525 | 5 | 2 | **10** | Phase 1 灰度；准备回滚 |
| R-09 | DNS 切换后部分 ISP 缓存旧 IP → 双写 | 3 | 3 | **9** | TTL < 300s；维护窗口切换 |
| R-10 | Exposed Credentials Check 误判登录请求 | 3 | 2 | **6** | 仅登录路径启用；Log only 1 周 |
| R-11 | Bot Management 误判合作伙伴爬虫 | 2 | 3 | **6** | Verified Bots 白名单；Custom Rules Allow |
| R-12 | Waiting Room 排队导致用户流失 | 3 | 2 | **6** | 仅高并发场景启用；阈值宽松 |

---

## 第八章 Implementation Strategy

> 实施采用 **5 阶段渐进式灰度**，每阶段独立可回滚，下一阶段必须基于上一阶段 UAT 通过才能启动。

### 8.1 Phase 1 — Proxy Enablement (T0)

**Objectives**
- 启用 Proxied Mode (橙色云)，源站 IP 从公网 DNS 消失
- 启用 SSL/TLS Full (Strict) + Universal SSL
- 启用 Authenticated Origin Pulls (mTLS) 锁定源站
- 源站配置真实客户端 IP 还原

**Tasks**

```bash
# === 1. DNS 切换为 Proxied Mode ===
cfcli dns list --name app.nc-services.com
cfcli dns update --id <record-id> --type A --name app --content 1.2.3.4 --proxied

# === 2. SSL/TLS 设置 ===
cfcli zone update-setting --name ssl --value strict
cfcli zone update-setting --name min_tls_version --value 1.2
cfcli zone update-setting --name always_use_https --value on

# === 3. Authenticated Origin Pulls (mTLS) ===
cfcli zone update-setting --name tls_client_auth --value on

# === 4. 真实客户端 IP (源站配置见 9.4) ===

# === 5. Cache 基础配置 ===
cfcli zone update-setting --name cache_level --value agitative
cfcli zone update-setting --name browser_cache_ttl --value 1800
```

**Validation**
- `dig app.nc-services.com` 返回 Cloudflare Anycast IP (104.x / 172.x)，不再是源站 IP
- `curl -vI https://app.nc-services.com` 返回 `server: cloudflare` + `cf-ray` Header
- 源站 Nginx access log 中 `$remote_addr` 为 Cloudflare IP，`$http_cf_connecting_ip` 为真实客户端 IP
- mTLS 验证：临时禁用 mTLS → 源站应拒绝非 CF 请求（预期）；启用 mTLS → 全部 200

**Rollback Trigger**：525/526 错误率 > 1% 持续 5min

---

### 8.2 Phase 2 — WAF Rollout (T+24h)

**Objectives**
- 启用 WAF Custom Rules（含 Skip 规则）
- 启用 Cloudflare Managed Ruleset + OWASP CRS (Paranoia 1)
- 启用 Exposed Credentials Check（仅登录路径）
- 启用 Page Shield（监控模式）

**Tasks**

```bash
# === 1. Custom Rules - Skip 规则 (优先级最高) ===
# API 路径跳过 Managed Challenge (Phase 4 之前)
cfcli firewall add \
  --description "Skip-Managed-Challenge for API" \
  --action skip \
  --filter '(http.request.uri.path contains "/api/")'

# SSO 回调路径跳过 WAF Managed Rulesets (先观察)
cfcli firewall add \
  --description "Skip-WAF-Managed for SSO Callback" \
  --action skip \
  --filter '(http.request.uri.path contains "/sso/callback")'

# === 2. 启用 Cloudflare Managed Ruleset (Log Only · 观察 1 周) ===
cfcli waf deploy-managed-ruleset --name "cloudflare-managed" --action log

# === 3. 启用 OWASP CRS (Paranoia Level 1 · Log Only) ===
cfcli waf deploy-managed-ruleset --name "owasp-crs" --action log --paranoia 1

# === 4. Exposed Credentials Check (仅登录路径 · Log Only) ===
cfcli firewall add \
  --description "Exposed-Creds-Check on Login" \
  --action log \
  --filter '(http.request.uri.path eq "/login")'

# === 5. Page Shield (监控模式) ===
cfcli zone update-setting --name page_shield --value monitor
```

**Validation**
- WAF Analytics 中 Security Events 出现但无 Block（Log Only 模式）
- 观察 7 天，统计误判率
- 误判率 < 0.1% → 转 Block 模式；> 0.1% → 调整规则

**Rollback Trigger**：误判率 > 1% 或业务核心功能 Block

---

### 8.3 Phase 3 — Rate Limiting Rules (T+72h)

**Objectives**
- 启用登录、API、Admin 路径 Rate Limiting Rules
- 防御暴力破解与 API 滥用

**Tasks**

```bash
# === 1. 登录路径 Rate Limiting ===
cfcli firewall ratelimit add \
  --name "Login-RL" \
  --path "/login" \
  --threshold 10 \
  --period 60 \
  --action challenge

# === 2. API Rate Limiting (按 IP + URI) ===
cfcli firewall ratelimit add \
  --name "API-RL" \
  --path "/api/*" \
  --threshold 100 \
  --period 10 \
  --action block

# === 3. Admin Rate Limiting (严格) ===
cfcli firewall ratelimit add \
  --name "Admin-RL" \
  --path "/admin/*" \
  --threshold 5 \
  --period 60 \
  --action block
```

**Validation**
- 模拟 11 次 `/login` 请求/分钟 → 第 11 次返回 Challenge
- 模拟 101 次 `/api/*` 请求/10 秒 → 第 101 次返回 Block
- 正常业务流量不受影响

**Rollback Trigger**：正常业务请求被 Rate Limit Block > 0.5%

---

### 8.4 Phase 4 — Managed Challenge (T+96h)

**Objectives**
- 对高风险路径启用 Managed Challenge
- 灰度 5% → 25% → 100%

**Tasks**

```bash
# === 1. 高 Bot Score 流量 → Managed Challenge (灰度 5%) ===
cfcli firewall add \
  --description "Managed-Challenge High Bot Score (5% canary)" \
  --action managed_challenge \
  --filter '(cf.bot_management.score lt 30)'

# === 2. /admin 路径 → Managed Challenge ===
cfcli firewall add \
  --description "Managed-Challenge Admin" \
  --action managed_challenge \
  --filter '(http.request.uri.path contains "/admin")'

# === 3. 高风险地理 → Managed Challenge ===
cfcli firewall add \
  --description "Managed-Challenge High-Risk Geo" \
  --action managed_challenge \
  --filter '(ip.geoip.country in {"CN" "RU" "KP" "IR"})'
```

**Validation**
- 灰度 5% 24h 内 Challenge 失败率 < 0.5%
- 升至 25% 24h 内 Challenge 失败率 < 0.5%
- 升至 100% 24h 内 Challenge 失败率 < 0.5%
- 旧浏览器 Skip 规则生效（IE 11 不触发 Challenge）

**Rollback Trigger**：Challenge 失败率 > 1% 或客诉激增

---

### 8.5 Phase 5 — Bot Protection (T+120h)

**Objectives**
- 启用 Bot Management 完整策略
- 验证 Verified Bots 白名单
- 集成 Bot Score 到 Custom Rules

**Tasks**

```bash
# === 1. 启用 Bot Management (Enterprise 默认开启) ===
cfcli zone update-setting --name bot_management --value on

# === 2. Verified Bots Allow (Google/Bing 等搜索引擎) ===
cfcli firewall add \
  --description "Allow Verified Bots" \
  --action allow \
  --filter '(cf.bot_management.verified_bot)'

# === 3. 已知恶意 Bot → Block ===
cfcli firewall add \
  --description "Block Malicious Bots (Bot Score < 10)" \
  --action block \
  --filter '(cf.bot_management.score lt 10)'

# === 4. Bot Analytics 监控 ===
cfcli bot-management analytics --range 24h
```

**Validation**
- Bot Analytics 显示 Verified Bots 正常放行
- 恶意 Bot 被拦截
- 业务爬虫（合作伙伴）未被误判

**Rollback Trigger**：合作伙伴爬虫被误判 Block

---

## 第九章 Configuration Baseline

### 9.1 DNS Configuration

**Orange Cloud (Proxied · 推荐默认)**

| 主机名 | 类型 | Content | Proxied | 说明 |
|--------|------|---------|---------|------|
| app.nc-services.com | A | 1.2.3.4 | ✅ | 主门户 |
| api.nc-services.com | A | 1.2.3.4 | ✅ | API |
| login.nc-services.com | A | 1.2.3.4 | ✅ | 登录 |
| sso.nc-services.com | A | 1.2.3.4 | ✅ | SSO |
| webhook.nc-services.com | A | 1.2.3.4 | ✅ | 回调 |
| static.nc-services.com | A | 1.2.3.4 | ✅ | 静态资源 |
| admin.nc-services.com | A | 1.2.3.4 | ✅ | 管理 (叠加 Zero Trust) |

**Gray Cloud (DNS Only · 仅特殊场景)**

| 主机名 | 类型 | Content | Proxied | 说明 |
|--------|------|---------|---------|------|
| mail.nc-services.com | MX | mail.nc-services.com | ❌ | 邮件不走 CF |
| vpn.nc-services.com | A | 5.6.7.8 | ❌ | IPSec VPN 不走 CF |
| _dmarc.nc-services.com | TXT | "v=DMARC1;..." | ❌ | DMARC 记录 |

### 9.2 SSL/TLS Configuration

```
SSL Mode:                    Full (Strict)
Min TLS Version:             1.2
Opportunistic Encryption:    on
TLS 1.3:                     on (0-RTT off)
Always Use HTTPS:            on
Automatic HTTPS Rewrites:    on
HSTS:                        on; max-age=31536000; includeSubDomains; preload
Authenticated Origin Pulls:  on (mTLS)
```

### 9.3 Origin Configuration

**Nginx**

```nginx
# /etc/nginx/nginx.conf
http {
    # === Cloudflare 真实 IP 还原 ===
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    # ... (完整 Cloudflare IP 段，见附录 A)
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    # === mTLS Authenticated Origin Pulls ===
    server {
        listen 443 ssl http2;
        server_name app.nc-services.com;

        ssl_certificate     /etc/ssl/origin-ca.pem;
        ssl_certificate_key /etc/ssl/origin-ca.key;

        # 验证客户端 (Cloudflare) 证书
        ssl_client_certificate /etc/ssl/cloudflare-origin-pull.pem;
        ssl_verify_client on;
        ssl_verify_depth 2;

        # 仅允许 Cloudflare IP
        # allow 173.245.48.0/20;
        # ... (完整 Cloudflare IP 段)
        # deny all;

        location / {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            # 透传 Cloudflare Headers 给应用
            proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
            proxy_set_header True-Client-IP $http_true_client_ip;
        }
    }
}
```

**IIS**

```xml
<!-- web.config · IIS 10+ -->
<system.webServer>
  <rewrite>
    <allowedServerVariables>
      <add name="HTTP_CF_CONNECTING_IP" />
      <add name="HTTP_TRUE_CLIENT_IP" />
    </allowedServerVariables>
  </rewrite>
  <security>
    <ipSecurity allowUnlisted="false">
      <!-- Cloudflare IP 段 -->
      <add ipAddress="173.245.48.0" subnetMask="255.255.240.0" allowed="true" />
      <add ipAddress="103.21.244.0" subnetMask="255.255.252.0" allowed="true" />
      <!-- ... 完整列表 -->
    </ipSecurity>
  </security>
</system.webServer>

<!-- 真实 IP 模块: 安装 F5 / Cloudflare Real IP Module for IIS -->
```

**Apache**

```apache
# /etc/httpd/conf.d/cloudflare.conf
# 加载 mod_remoteip
LoadModule remoteip_module modules/mod_remoteip.so

# Cloudflare IP 段
RemoteIPHeader CF-Connecting-IP
RemoteIPTrustedProxy 173.245.48.0/20
RemoteIPTrustedProxy 103.21.244.0/22
# ... (完整 Cloudflare IP 段)

# 日志格式使用真实 IP
LogFormat "%a %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\"" cloudflare
CustomLog logs/access_log cloudflare

# mTLS (mod_ssl)
SSLEngine on
SSLCertificateFile /etc/ssl/origin-ca.pem
SSLCertificateKeyFile /etc/ssl/origin-ca.key
SSLCACertificateFile /etc/ssl/cloudflare-origin-pull.pem
SSLVerifyClient require
SSLVerifyDepth 2

# 仅允许 Cloudflare IP
<Location />
    Require ip 173.245.48.0/20
    Require ip 103.21.244.0/22
    # ... 完整列表
</Location>
```

### 9.4 Real Client IP Configuration

**Nginx Example** (见 9.3)
**IIS Example** (见 9.3)
**Apache Example** (见 9.3)

**应用层读取 (Java/Spring)**

```java
@RestController
public class IpController {
    @GetMapping("/whoami")
    public String ip(HttpServletRequest req) {
        // 优先 CF-Connecting-IP (Cloudflare 注入)
        String ip = req.getHeader("CF-Connecting-IP");
        if (ip == null) ip = req.getHeader("True-Client-IP");
        if (ip == null) ip = req.getRemoteAddr();
        return ip;
    }
}
```

**应用层读取 (PHP)**

```php
<?php
function getRealClientIp() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    if (!empty($_SERVER['HTTP_TRUE_CLIENT_IP'])) {
        return $_SERVER['HTTP_TRUE_CLIENT_IP'];
    }
    return $_SERVER['REMOTE_ADDR'];
}
```

---

## 第十章 Cloudflare Rule Catalog

> 所有规则按 **执行顺序** 列出。Phase 顺序：`http_request_firewall_custom` (Custom Rules) → `http_ratelimit` (Rate Limiting) → `http_request_firewall_managed` (Managed Rulesets)。

### 10.1 Allow Rules

| Rule ID | 名称 | Filter (wirefilter) | Action | 说明 |
|---------|------|---------------------|--------|------|
| ALW-01 | Allow Corporate Office | `(ip.src in $cf.ip_list{name:"corp_office"})` | Allow | 公司办公网 IP List |
| ALW-02 | Allow Monitoring System | `(ip.src in $cf.ip_list{name:"monitoring"})` | Allow | Prometheus / Datadog 探针 |
| ALW-03 | Allow Verified Bots | `(cf.bot_management.verified_bot)` | Allow | Google/Bing 等搜索引擎 |
| ALW-04 | Allow Payment Gateway Callback | `(ip.src in $cf.ip_list{name:"payment_gateway"}) and (http.request.uri.path eq "/webhook/payment")` | Allow | Stripe/Alipay 回调 |

### 10.2 Skip Rules

| Rule ID | 名称 | Filter | Action | Skip 目标 | 说明 |
|---------|------|--------|--------|-----------|------|
| SKIP-01 | Skip All for API | `(http.request.uri.path contains "/api/")` | Skip | All remaining rulesets | API 路径不触发 Challenge |
| SKIP-02 | Skip Managed Challenge for SSO | `(http.request.uri.path contains "/sso/")` | Skip | Managed Challenge (Phase 4) | SSO 流程不挑战 |
| SKIP-03 | Skip WAF Managed for Legacy Path | `(http.request.uri.path contains "/legacy/")` | Skip | WAF Managed Rulesets | Legacy 路径仅 Custom Rules |
| SKIP-04 | Skip Rate Limit for Health Check | `(http.user_agent eq "CF-HealthCheck")` | Skip | Rate Limiting Rules | LB Health Check 不计数 |
| SKIP-05 | Skip Managed Challenge for Old Browser | `(http.user_agent contains "Trident/7.0") or (http.user_agent contains "MSIE")` | Skip | Managed Challenge | IE 11 不挑战 |

### 10.3 WAF Rules (Custom Rules + Managed Rulesets)

**Custom Rules (Phase: http_request_firewall_custom)**

| Rule ID | 名称 | Filter | Action |
|---------|------|--------|--------|
| WAF-C-01 | Block Bad ASN | `(ip.geoip.asnum in $cf.asn_list{name:"bad_asn"})` | Block |
| WAF-C-02 | Block SQLi Pattern (Custom) | `(http.request.uri.query contains "union select")` | Block |
| WAF-C-03 | Challenge High-Risk Country | `(ip.geoip.country in {"CN" "RU" "KP" "IR"})` | Managed Challenge |
| WAF-C-04 | Block Upload Non-Image | `(http.request.uri.path eq "/upload") and not (http.request.content_type contains "image/")` | Block |

**Managed Rulesets (Phase: http_request_firewall_managed)**

| Ruleset | 动作 | Override | 说明 |
|---------|------|----------|------|
| Cloudflare Managed Ruleset | Block | Log only 1 周后转 Block | 默认全开 |
| Cloudflare OWASP Core Rule Set | Block | Paranoia Level 1；Log only 1 周 | 误判率最低 |
| Cloudflare Exposed Credentials Check | Log → Block | 仅 `/login` `/api/login` 路径 | 凭证泄露检测 |
| Page Shield | Log (监控模式 4 周) | — | 前端 JS 劫持检测 |

### 10.4 Rate Limiting Rules (Phase: http_ratelimit)

| Rule ID | 名称 | 计数特征 | 阈值 | Action |
|---------|------|----------|------|--------|
| RL-01 | Login RL | `/login` per IP | 10 req / 60s | Challenge |
| RL-02 | Login RL Strict (失败) | `/login` per IP + 响应码 401 | 5 req / 60s | Block |
| RL-03 | API RL | `/api/*` per IP | 100 req / 10s | Block |
| RL-04 | Admin RL | `/admin/*` per IP | 5 req / 60s | Block |
| RL-05 | Search RL | `/search` per IP | 30 req / 60s | Challenge |
| RL-06 | Reset Password RL | `/reset-password` per IP | 3 req / 300s | Block |

### 10.5 Managed Challenge Rules

| Rule ID | 名称 | Filter | Action | 说明 |
|---------|------|--------|--------|------|
| MC-01 | High Threat Bot Score | `(cf.bot_management.score lt 30) and not (cf.bot_management.verified_bot)` | Managed Challenge | 灰度 5% → 100% |
| MC-02 | Admin Path | `(http.request.uri.path contains "/admin")` | Managed Challenge | 所有管理路径 |
| MC-03 | High-Risk Geo | `(ip.geoip.country in {"CN" "RU" "KP" "IR"})` | Managed Challenge | 高风险国家 |
| MC-04 | Suspicious JA3 | `(cf.bot_management.ja3_hash in $cf.ip_list{name:"bad_ja3"})` | JS Challenge | 已知恶意 TLS 指纹 |

### 10.6 Caching Rules (Cache Rules · 取代旧 Cache Page Rules)

| Rule ID | 名称 | 匹配 | 缓存行为 | TTL |
|---------|------|------|----------|-----|
| CACHE-01 | Static Assets | `http.request.uri.path.extension in {"js" "css" "png" "jpg" "jpeg" "gif" "webp" "svg" "woff" "woff2"}` | Cache Everything | Edge 1d · Browser 30min |
| CACHE-02 | API Bypass | `http.request.uri.path contains "/api/"` | Bypass Cache | — |
| CACHE-03 | Admin Bypass | `http.request.uri.path contains "/admin"` | Bypass Cache | — |
| CACHE-04 | HTML Cache (Portal) | `http.request.uri.path eq "/" and http.request.method eq "GET"` | Cache Eligible · Respect Origin | — |

---

## 第十一章 UAT Test Plan

### 11.1 Test Environment

| 项 | 内容 |
|----|------|
| **环境** | UAT 独立 zone: `uat.nc-services.com` (独立 zone ID，与生产隔离) |
| **源站** | UAT 专用源站 `uat-origin.nc-services.local` (10.0.0.10) |
| **数据** | UAT 测试数据 (脱敏) |
| **测试账号** | 50 个测试账号 (含管理员/普通用户/SSO 用户) |
| **测试期间** | Phase 1-5 每阶段 UAT 7 天 |

### 11.2 Test Scope

| 范围 | 必测 | 选测 |
|------|------|------|
| Authentication | ✅ | — |
| API | ✅ | — |
| Upload | ✅ | — |
| SSO | ✅ | — |
| Payment Gateway | ✅ (沙箱) | — |
| WebSocket | ✅ | — |
| Legacy Browser | — | ✅ (IE 11) |
| 文件下载 500MB | — | ✅ |

### 11.3 Test Data

| 类型 | 数据量 | 说明 |
|------|--------|------|
| 测试账号 | 50 | 含 5 管理员 / 40 普通 / 5 SSO |
| 测试订单 | 1000 | 含已完成/进行中/异常 |
| 测试文件 | 10 / 100 / 500MB 各 1 | 上传 + 下载 |
| 测试 API Payload | 100 条 | 含正常/SQLi/XSS/恶意 |

### 11.4 Test Cases

#### 11.4.1 Authentication

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-AUTH-001 | 正确用户名密码登录 | 200 + Session Cookie |
| TC-AUTH-002 | 错误密码登录 5 次 | 第 6 次触发 Rate Limit Challenge |
| TC-AUTH-003 | 错误密码登录 10 次/分钟 | 第 11 次触发 Rate Limit Challenge |
| TC-AUTH-004 | 密码重置流程 | 邮件发送成功 |
| TC-AUTH-005 | 登出 | Session 失效 |
| TC-AUTH-006 | SSO 登录 (SAML) | 重定向到 IdP，回调后登录成功 |
| TC-AUTH-007 | SSO 登录 (OAuth2) | 授权码流程完成 |
| TC-AUTH-008 | Exposed Credentials 检测 (使用泄露密码) | WAF 事件记录 (Log Only) |

#### 11.4.2 API

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-API-001 | REST GET /api/v1/orders | 200 + JSON |
| TC-API-002 | REST POST /api/v1/orders | 201 |
| TC-API-003 | SOAP /api/soap | 200 + XML |
| TC-API-004 | Webhook POST /webhook/payment | 200 + 业务处理 |
| TC-API-005 | API SQLi Payload | 403 (OWASP CRS Block) |
| TC-API-006 | API XSS Payload | 403 (OWASP CRS Block) |
| TC-API-007 | API Rate Limit (101 req/10s) | 第 101 次 429 |
| TC-API-008 | API Managed Challenge 不触发 | 无 Challenge (SKIP-01) |

#### 11.4.3 Upload

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-UP-001 | 上传 10MB PDF | 200 + 文件保存 |
| TC-UP-002 | 上传 100MB PDF | 200 + 文件保存 |
| TC-UP-003 | 上传 500MB PDF | 200 + 文件保存 |
| TC-UP-004 | 上传非图片到 /upload | 403 (WAF-C-04) |
| TC-UP-005 | 上传 EXE | 403 (OWASP CRS) |

#### 11.4.4 SSO

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-SSO-001 | SAML 登录 | 200 + Session |
| TC-SSO-002 | OAuth2 Authorization Code | 200 + Token |
| TC-SSO-003 | SAML ACS URL 协议为 https | X-Forwarded-Proto: https 注入成功 |
| TC-SSO-004 | SSO 回调路径 Skip Challenge | 无 Challenge (SKIP-02) |
| TC-SSO-005 | SSO 单点登出 | Session 全部失效 |

#### 11.4.5 Payment Gateway

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-PAY-001 | Stripe Webhook (沙箱) | 200 + 签名验证通过 |
| TC-PAY-002 | Alipay Webhook (沙箱) | 200 |
| TC-PAY-003 | 伪造支付回调 (非白名单 IP) | 403 (ALW-04 反向) |
| TC-PAY-004 | Exposed Credentials Check 不影响支付 | 无误判 |

#### 11.4.6 WebSocket

| Case ID | 场景 | 预期结果 |
|---------|------|----------|
| TC-WS-001 | wss 连接建立 | 101 Switching Protocols |
| TC-WS-002 | 长连接保持 10 分钟 | 连接不中断 |
| TC-WS-003 | WS 消息双向收发 | 消息正确 |
| TC-WS-004 | WS 不被 WAF 误判 | 无 Block |

---

## 第十二章 UAT Evidence Collection

### 12.1 Screenshots

| 证据 ID | 内容 | 来源 |
|---------|------|------|
| SCR-001 | Cloudflare Dashboard Zone 概览 | CF Dashboard |
| SCR-002 | SSL/TLS 配置 = Full (Strict) | CF Dashboard |
| SCR-003 | Authenticated Origin Pulls = on | CF Dashboard |
| SCR-004 | WAF Custom Rules 列表 | CF Dashboard |
| SCR-005 | WAF Managed Rulesets 部署 | CF Dashboard |
| SCR-006 | Rate Limiting Rules 列表 | CF Dashboard |
| SCR-007 | Bot Analytics 24h | CF Dashboard |
| SCR-008 | 测试用例执行截图 (登录/API/上传) | UAT 测试机 |

### 12.2 Logs

| 日志类型 | 来源 | 保留 |
|----------|------|------|
| Cloudflare Logs (Logpush) | CF → S3 | 30 天 |
| Nginx access log | 源站 | 90 天 |
| Nginx error log | 源站 | 90 天 |
| 应用日志 | 源站应用 | 1 年 |
| WAF Security Events | CF Analytics | 30 天 |
| Bot Analytics | CF Analytics | 30 天 |

### 12.3 HAR Files

| 证据 ID | 内容 | 文件 |
|---------|------|------|
| HAR-001 | 主门户首页加载 | `uat-portal-home.har` |
| HAR-002 | 登录流程 | `uat-login.har` |
| HAR-003 | API 调用 | `uat-api.har` |
| HAR-004 | SSO 流程 | `uat-sso.har` |
| HAR-005 | 文件上传 500MB | `uat-upload-500mb.har` |

### 12.4 Network Trace

| 证据 ID | 内容 | 工具 |
|---------|------|------|
| TRACE-001 | DNS 解析 (验证返回 CF Anycast IP) | `dig` / `nslookup` |
| TRACE-002 | TLS 握手 (验证 Universal SSL) | `openssl s_client` |
| TRACE-003 | mTLS 验证 (Authenticated Origin Pulls) | `openssl s_client -cert` |
| TRACE-004 | HTTP Header 验证 (CF-Ray / CF-Connecting-IP) | `curl -vI` |
| TRACE-005 | 路由追踪 (CF PoP 选择) | `mtr` / `traceroute` |

---

## 第十三章 Go-Live Runbook

### 13.1 Change Window

| 项 | 内容 |
|----|------|
| **变更窗口** | 2026-08-23 02:00 – 06:00 (Asia/Shanghai) |
| **业务影响** | 维护窗口内可能有 < 5min 不可达 |
| **回滚截止** | 05:30 (距窗口结束 30min) |
| **沟通渠道** | Bridge Call: Zoom _____ / 应急群: 钉钉 _____ |
| **总指挥** | Change Manager _____ |
| **执行人** | CF Platform Team On-call _____ |
| **验证人** | SRE / App Owner _____ |

### 13.2 Execution Timeline

| 时刻 | 任务 | 负责人 | 验证 |
|------|------|--------|------|
| **T-30** (01:30) | 启动 Bridge Call；最终核对清单 | Change Manager | 全员到齐 |
| **T-15** (01:45) | 源站健康检查；备份当前 Nginx 配置 | SRE | 备份完成 |
| **T0** (02:00) | Phase 1: DNS 切换为 Proxied Mode | CF On-call | `dig` 返回 CF IP |
| **T+15** (02:15) | Phase 1: SSL Full (Strict) + mTLS 验证 | CF On-call | 0 个 525 错误 |
| **T+30** (02:30) | Phase 1: 真实 IP 还原验证 | SRE | Nginx log 含真实 IP |
| **T+45** (02:45) | Phase 2: WAF Custom Rules 上线 | CF On-call | Custom Rules 计数正常 |
| **T+60** (03:00) | Phase 2: Managed Rulesets 上线 (Log Only) | CF On-call | WAF Events 无 Block |
| **T+90** (03:30) | Phase 3: Rate Limiting Rules 上线 | CF On-call | Rate Limit 计数正常 |
| **T+120** (04:00) | Phase 4: Managed Challenge 灰度 5% | CF On-call | Challenge 失败率 < 0.5% |
| **T+150** (04:30) | Phase 5: Bot Management 上线 | CF On-call | Verified Bots 放行 |
| **T+180** (05:00) | 全量验证（UAT 主要用例） | App Owner | 全部通过 |
| **T+210** (05:30) | 回滚截止；如无异常进入观察期 | Change Manager | 决策 |
| **T+240** (06:00) | 变更窗口结束；Bridge Call 关闭 | Change Manager | 完成 |

### 13.3 Validation Activities

```bash
# === 1. DNS 验证 ===
dig +short app.nc-services.com    # 应返回 CF Anycast IP
dig +short api.nc-services.com    # 同上

# === 2. TLS 验证 ===
echo | openssl s_client -connect app.nc-services.com:443 -servername app.nc-services.com 2>/dev/null | openssl x509 -noout -issuer
# 应返回 Cloudflare Inc ECC CA-3

# === 3. mTLS 验证 (Authenticated Origin Pulls) ===
echo | openssl s_client -connect 1.2.3.4:443 -servername app.nc-services.com 2>&1 | grep -E "Verify|verify"
# 应返回 Verify return code: 0

# === 4. Header 验证 ===
curl -sI https://app.nc-services.com | grep -E "server|cf-ray|cf-cache-status"
# 应包含 server: cloudflare / cf-ray: xxxxx / cf-cache-status

# === 5. WAF 验证 ===
curl -i "https://app.nc-services.com/?id=1' OR '1'='1"
# 应返回 403 (OWASP CRS Block · Phase 2 转 Block 后)

# === 6. Rate Limit 验证 ===
for i in {1..11}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.nc-services.com/login; done
# 第 11 次应返回 503 (Challenge)

# === 7. Managed Challenge 验证 ===
curl -A "BadBot/1.0" -sI https://app.nc-services.com/admin/
# 应返回 403 + Managed Challenge 页面

# === 8. Bot Management 验证 ===
curl -A "Googlebot/2.1" -sI https://app.nc-services.com/
# 应返回 200 (Verified Bot 放行)

# === 9. 真实 IP 验证 (源站) ===
ssh origin "tail -1 /var/log/nginx/access.log"
# 应看到真实客户端 IP 在 CF-Connecting-IP 字段
```

---

## 第十四章 Monitoring Plan

### 14.1 KPI

| KPI | 目标 | 数据源 | 告警阈值 |
|-----|------|--------|----------|
| **Login Success Rate** | ≥ 99% | 应用日志 + CF Analytics | < 95% → P1 |
| **API Success Rate** | ≥ 99.5% | 应用日志 + CF Analytics | < 99% → P1 |
| **Error Rate (5xx)** | < 0.5% | CF Analytics | > 2% → P1 / > 5% → P0 |
| **Latency (P95)** | < 500ms | CF Analytics + 应用 APM | > 1s → P2 |
| **WAF Block Rate** | < 1% | CF Security Analytics | > 5% → P2 (误判) |
| **Challenge Failure Rate** | < 1% | CF Analytics | > 5% → P1 |
| **Cache Hit Ratio** | ≥ 70% (静态) | CF Cache Analytics | < 50% → P3 |
| **Origin 5xx Rate** | < 0.1% | 源站 Nginx log | > 1% → P1 |
| **DDoS Mitigation Events** | 监控 | CF DDoS Analytics | 任何 L7 事件 → P3 通知 |

### 14.2 Alert Thresholds

| 严重度 | 触发条件 | 响应时间 | 通知方式 |
|--------|----------|----------|----------|
| **P0** | 全站 5xx > 5% 持续 5min | 5 min | 电话 + 钉钉 + 邮件 + Bridge |
| **P1** | 5xx > 2% / Login 成功率 < 95% | 15 min | 钉钉 + 邮件 |
| **P2** | 误判率 > 5% / Latency P95 > 1s | 1 hour | 钉钉 |
| **P3** | Cache Hit < 50% / DDoS 事件 | 4 hour | 邮件 |

### 14.3 Dashboard

| Dashboard | 内容 | 数据源 |
|-----------|------|--------|
| **CF Overview** | 请求量 / 缓存命中率 / 安全事件 | Cloudflare Analytics |
| **Security** | WAF Events / Bot Analytics / DDoS / Challenge | Cloudflare Security Analytics |
| **Performance** | Latency / Origin Response Time / Cache | Cloudflare Analytics + APM |
| **Origin Health** | 源站 CPU / Mem / 5xx / LB Health | Prometheus + Grafana |
| **Business** | Login Success / API Success / Order Count | 应用 APM |

---

## 第十五章 Rollback Plan

### 15.1 Rollback Criteria

| 严重度 | 触发条件 | 决策人 |
|--------|----------|--------|
| **立即回滚** | 全站 5xx > 5% 持续 5min | Change Manager |
| **立即回滚** | 登录成功率 < 80% | Change Manager |
| **立即回滚** | API 成功率 < 90% | Change Manager |
| **立即回滚** | 源站宕机 | SRE Lead |
| **评估回滚** | 误判率 > 5% 持续 30min | App Owner + CF On-call |
| **评估回滚** | 客诉 > 10 例/小时 | App Owner |

### 15.2 Rollback Decision Tree

```
异常告警触发
    │
    ▼
┌─────────────────────────┐
│ 1. 判定严重度            │
│    P0 (全站不可用) ?    │
└────────────┬────────────┘
             │
       ┌─────┴─────┐
       │           │
      Yes          No
       │           │
       ▼           ▼
┌──────────────┐  ┌─────────────────────────┐
│ 2a. 立即回滚 │  │ 2b. 评估                 │
│   DNS 回灰云  │  │   误判率 > 5% ?          │
│   (T+5min)   │  │   Challenge 失败 > 5% ?  │
└──────────────┘  └────────┬────────────────┘
                           │
                     ┌─────┴─────┐
                     │           │
                    Yes          No
                     │           │
                     ▼           ▼
              ┌────────────┐  ┌──────────────┐
              │ 3a. 规则回滚│  │ 3b. 继续观察 │
              │   (T+15min)│  │   30min      │
              └────────────┘  └──────────────┘
```

### 15.3 DNS Rollback (Full Rollback)

```bash
# === DNS 切回 Gray Cloud (DNS Only · 直连源站) ===
cfcli dns update --id <record-id> --type A --name app --content 1.2.3.4 --no-proxied
cfcli dns update --id <record-id> --type A --name api --content 1.2.3.4 --no-proxied
# ... (所有 Proxied 记录)

# 验证
dig +short app.nc-services.com    # 应返回 1.2.3.4 (源站 IP)
```

### 15.4 Rule Rollback (Partial Rollback)

```bash
# === 仅回滚 Phase 4 (Managed Challenge) ===
cfcli firewall pause --id <rule-id-mc-01>
cfcli firewall pause --id <rule-id-mc-02>
cfcli firewall pause --id <rule-id-mc-03>

# === 仅回滚 Phase 2 (WAF Managed Rulesets) ===
cfcli waf deploy-managed-ruleset --name "cloudflare-managed" --action disabled
cfcli waf deploy-managed-ruleset --name "owasp-crs" --action disabled

# === 仅回滚 Phase 3 (Rate Limiting) ===
cfcli firewall ratelimit pause --id <rule-id-rl-01>
```

### 15.5 Full Rollback

```bash
# === 完整回滚 (DNS + 所有规则) ===

# 1. DNS 全部切回 Gray Cloud
cfcli dns list --json | jq -r '.result[] | select(.proxied==true) | .id' | while read id; do
  cfcli dns update --id $id --no-proxied
done

# 2. 所有 Custom Rules 暂停
cfcli firewall list --json | jq -r '.result[].id' | while read id; do
  cfcli firewall pause --id $id
done

# 3. Managed Rulesets 禁用
cfcli waf deploy-managed-ruleset --name "cloudflare-managed" --action disabled
cfcli waf deploy-managed-ruleset --name "owasp-crs" --action disabled

# 4. Authenticated Origin Pulls 禁用 (源站配置回滚)
cfcli zone update-setting --name tls_client_auth --value off
# 源站 Nginx: ssl_verify_client off

# 5. 验证
dig +short app.nc-services.com    # 应返回 1.2.3.4
curl -sI https://app.nc-services.com | grep server    # 不应返回 cloudflare
```

### 15.6 Validation After Rollback

| 验证项 | 预期 | 工具 |
|--------|------|------|
| DNS 解析 | 返回源站 IP | `dig` |
| HTTP 访问 | 直连源站 (无 CF-Ray Header) | `curl -I` |
| 源站日志 | $remote_addr 为真实客户端 IP (直连) | `tail access.log` |
| 业务功能 | 全部正常 | UAT 主要用例 |
| 应用日志 | 无 5xx 激增 | ELK |

---

## 第十六章 Incident Response Plan

### 16.1 Severity Matrix

| Severity | 定义 | 响应时间 | 升级 |
|----------|------|----------|------|
| **SEV-1** | 全站不可用 / 数据泄露 | 5 min | CIO + CISO 立即介入 |
| **SEV-2** | 核心功能不可用 (登录/API) | 15 min | App Owner + CF On-call |
| **SEV-3** | 部分功能受影响 | 1 hour | SRE Lead |
| **SEV-4** | 性能下降 / 单一告警 | 4 hour | 值班 SRE |

### 16.2 Escalation Path

```
SEV-1:
  L1 (SRE On-call) → L2 (SRE Lead) → L3 (CIO + CISO) → L4 (CEO)

SEV-2:
  L1 (SRE On-call) → L2 (App Owner + CF On-call) → L3 (CTO)

SEV-3:
  L1 (SRE On-call) → L2 (SRE Lead)

SEV-4:
  L1 (SRE On-call)
```

### 16.3 Bridge Call Process

| 步骤 | 内容 | 负责人 |
|------|------|--------|
| 1 | SEV-1/2 触发 → 启动 Bridge Call | SRE On-call |
| 2 | 通知所有干系人加入 | Change Manager |
| 3 | 现状陈述 (5W1H) | SRE On-call |
| 4 | 临时缓解措施决策 | Change Manager |
| 5 | 执行缓解 (回滚 / 规则调整) | CF On-call |
| 6 | 验证恢复 | App Owner |
| 7 | 事件总结 + RCA 启动 | Change Manager |

### 16.4 Communication Plan

| 受众 | 通道 | 模板 |
|------|------|------|
| 内部全员 | 钉钉群 | "【故障通知】CRQ-xxx 触发 SEV-x，影响范围：xxx，已启动应急，预计恢复时间：xxx" |
| 客户 | 状态页 + 邮件 | "我们正在调查 xxx 服务的性能问题，将尽快恢复" |
| 监管机构 (合规事件) | 邮件 + 电话 | 等保 / PCI-DSS 事件报告模板 |
| CAB | 邮件 | 事件初步报告 + 后续 RCA |

---

## 第十七章 Success Criteria

### Technical Success Criteria

| 项 | 目标 | 验证方式 |
|----|------|----------|
| 源站 IP 隐藏 | 100% | `dig` 返回 CF IP |
| SSL Full (Strict) | 0 个 525 | CF Analytics |
| mTLS (Authenticated Origin Pulls) | 100% 验证 | 源站日志 |
| 真实客户端 IP 还原 | 100% 日志含 `CF-Connecting-IP` | 源站日志 |
| WAF 启用 | Custom + Managed Rulesets 全开 | CF Dashboard |
| Rate Limiting 启用 | 6 条规则全开 | CF Dashboard |
| Managed Challenge 启用 | 4 条规则全开 + 灰度 100% | CF Dashboard |
| Bot Management 启用 | Verified Bots 白名单生效 | Bot Analytics |

### Business Success Criteria

| 项 | 目标 | 验证方式 |
|----|------|----------|
| 登录成功率 | ≥ 99% | 应用日志 |
| API 成功率 | ≥ 99.5% | 应用日志 |
| 业务零中断 | 维护窗口外 0 中断 | 监控 |
| 客诉 | < 5 例/天 | 客服系统 |
| 第三方集成 | 0 中断 | 第三方日志 |

### Security Success Criteria

| 项 | 目标 | 验证方式 |
|----|------|----------|
| DDoS 防护 | 攻击期间业务 RPS 下降 < 5% | CF DDoS Analytics |
| WAF 拦截 | OWASP 攻击 100% 拦截 | WAF Events |
| Bot 拦截 | 恶意 Bot 100% 拦截 | Bot Analytics |
| 合规审计 | 通过等保 2.0 / PCI-DSS | 第三方审计 |
| 凭证泄露检测 | Exposed Credentials Check 启用 | CF Dashboard |

---

## 第十八章 Operational Handover

### Runbook

| Runbook | 内容 | 负责团队 |
|---------|------|----------|
| RB-001 | 日常监控 Dashboard 检查 | SRE |
| RB-002 | WAF 误判处理 (Skip 规则添加) | CF Platform |
| RB-003 | Rate Limit 阈值调整 | CF Platform |
| RB-004 | DDoS 攻击应急 | CF Platform + SRE |
| RB-005 | 证书续期 (Origin CA / ACM) | CF Platform |
| RB-006 | 源站故障切换 (LB) | SRE |
| RB-007 | Bot Management 策略调整 | CF Platform + App Owner |

### Monitoring Ownership

| 监控项 | 所有者 | 升级 |
|--------|--------|------|
| Cloudflare Analytics | CF Platform Team | CF On-call |
| 源站健康 | SRE | SRE On-call |
| 业务 KPI | App Owner | App On-call |
| 合规审计 | 安全团队 | CISO |

### Support Contacts

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| CF Platform Lead | _____ | 钉钉 / 手机 _____ |
| CF On-call (24x7) | _____ | PagerDuty _____ |
| SRE Lead | _____ | 钉钉 / 手机 _____ |
| App Owner | _____ | 钉钉 / 手机 _____ |
| Change Manager | _____ | 钉钉 / 手机 _____ |
| Cloudflare TAM | _____ | 邮件 / 企业支持热线 |
| Cloudflare Enterprise Support | — | enterprise-support@cloudflare.com |

### Documentation Repository

| 文档 | 位置 |
|------|------|
| 本 CAB 手册 | `cloudflare-cli/docs/CAB_HANDBOOK_LEGACY_APP.md` |
| Cloudflare CLI 指南 | `cloudflare-cli/docs/COMMAND_GUIDE.md` |
| 请求流水线指南 | `cloudflare-cli/docs/REQUEST_FLOW_GUIDE.md` |
| FAQ | `cloudflare-cli/docs/FAQ_COMPLETE.md` |
| SSL/TLS 指南 | `cloudflare-cli/docs/SSL_TLS_GUIDE.md` |
| 产品指南 | `cloudflare-cli/docs/CLOUDFLARE_PRODUCTS_GUIDE.md` |
| 源站配置 (Nginx/IIS/Apache) | `cloudflare-cli/configs/origin/` |
| WAF 规则导出 | `cloudflare-cli/configs/waf/` |
| 应急 Runbook | `cloudflare-cli/runbooks/` |

---

## 第十九章 CAB Approval Package

### Risk Summary

| 风险等级 | 数量 | 备注 |
|----------|------|------|
| 极高 (≥15) | 2 | R-01 真实 IP / R-02 旧浏览器 — 已有缓解 |
| 高 (9-14) | 5 | R-03/R-05/R-06/R-08/R-09 — 已有缓解 |
| 中 (4-8) | 5 | R-10/R-11/R-12 等 — 监控 |

**剩余风险接受声明**：所有极高风险已有缓解措施并通过 UAT 验证，剩余风险可接受。

### Change Summary

| 项 | 内容 |
|----|------|
| **变更类型** | Major (重大) |
| **变更范围** | Legacy App 7 个主机名接入 Cloudflare Enterprise |
| **变更内容** | Phase 1-5 (DNS/SSL/WAF/Rate Limiting/Challenge/Bot) |
| **预计时长** | 4 小时 (维护窗口) |
| **回滚时间** | < 30 min |
| **影响** | 维护窗口内 < 5min 不可达 |

### Testing Summary

| 测试范围 | 用例数 | 通过率 |
|----------|--------|--------|
| Authentication | 8 | 100% |
| API | 8 | 100% |
| Upload | 5 | 100% |
| SSO | 5 | 100% |
| Payment Gateway | 4 | 100% |
| WebSocket | 4 | 100% |
| **总计** | **34** | **100%** |

### Rollback Summary

| 项 | 内容 |
|----|------|
| **回滚触发** | 5xx > 5% / 登录 < 80% / API < 90% / 源站宕机 |
| **回滚方式** | DNS 切回 Gray Cloud (5min) / 规则 Pause (5min) |
| **完整回滚时间** | < 30 min |
| **回滚验证** | DNS + HTTP + 业务功能 |

### Executive Recommendation

**建议：批准本变更。**

理由：
1. 现状存在 6 项高风险（源站 IP 暴露 / DDoS 缺失 / WAF 陈旧 / 合规缺口等），不变更风险更高。
2. 所有极高风险已有缓解措施并通过 UAT 100% 验证。
3. 实施采用 5 阶段灰度，每阶段独立可回滚，最大回滚时间 < 30 min。
4. 维护窗口选择业务低峰期，影响最小。
5. 变更后满足等保 2.0 / PCI-DSS v4.0 合规要求。

---

## 第二十章 Appendices

### Appendix A. Cloudflare IP Range

> 完整列表见 https://www.cloudflare.com/ips/ · 也可通过 `cfcli firewall cf-ips` 查询

**IPv4 (节选 · 完整 15 段)：**

```
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
```

**IPv6 (节选)：**

```
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32
```

### Appendix B. Nginx Configuration

见 9.3 Nginx 示例。完整配置文件：`cloudflare-cli/configs/origin/nginx.conf`

### Appendix C. IIS Configuration

见 9.3 IIS 示例。完整配置文件：`cloudflare-cli/configs/origin/web.config`

### Appendix D. WAF Rule Export

```bash
# === 导出所有 Custom Rules ===
cfcli firewall list --json > configs/waf/custom-rules.json

# === 导出 Managed Rulesets 配置 ===
cfcli waf list --json > configs/waf/managed-rulesets.json

# === 导出 Rate Limiting Rules ===
cfcli firewall ratelimit list --json > configs/waf/rate-limiting.json

# === 导出账户级 Rules Lists ===
cfcli ip-lists list --json > configs/waf/rules-lists.json
```

### Appendix E. UAT Test Result

| 测试范围 | 通过/总数 | 备注 |
|----------|-----------|------|
| Authentication | 8/8 | 全部通过 |
| API | 8/8 | 全部通过 |
| Upload | 5/5 | 全部通过 (含 500MB) |
| SSO | 5/5 | X-Forwarded-Proto 注入成功 |
| Payment Gateway | 4/4 | 沙箱验证通过 |
| WebSocket | 4/4 | 长连接正常 |
| **总计** | **34/34** | **100% 通过** |

### Appendix F. CAB Sign-off Sheet

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CAB Chair | _____ | _____ | _____ |
| CISO | _____ | _____ | _____ |
| CIO | _____ | _____ | _____ |
| Application Owner | _____ | _____ | _____ |
| Network Operations Lead | _____ | _____ | _____ |
| SRE Lead | _____ | _____ | _____ |
| Change Manager | _____ | _____ | _____ |

---

# 衍生场景 (Derived Scenarios)

> 以下 5 个衍生场景基于本 CAB 主体（Legacy App + Proxied Mode + Security Challenge）扩展，覆盖大型企业常见变体。每个场景标注与主体场景的差异、新增 Cloudflare 功能名 (Enterprise)、关键风险与回滚要点。

## 衍生场景 1：金融行业 · 多区域 Active-Active 灾备 + 严格合规

**适用行业**：银行、证券、保险、支付机构

**与主体场景差异**：

| 维度 | 主体场景 | 衍生场景 1 |
|------|----------|-----------|
| 源站拓扑 | 单源站 | 双区域 Active-Active (北京 + 上海) |
| LB 策略 | 无 LB | Cloudflare Load Balancer · Geo Steering + Health Checks |
| 合规要求 | 等保 2.0 / PCI-DSS | + 金融等保四级 + 央行监管 |
| 数据主权 | 单区域 | 跨境数据合规 (数据不出境) |
| 灾备 RTO/RPO | — | RTO < 5min / RPO = 0 |

**新增 Cloudflare 功能 (Enterprise 准确名词)**：
- Cloudflare Load Balancer (Pools + Steering: geo + random + least_connections + Hash)
- Health Checks (主动 + 被动)
- Argo Smart Routing (跨区域低延迟)
- Magic Transit (L3/L4 DDoS 扩展到非 HTTP)
- Cloudflare Logs (Logpush → SIEM · 金融合规审计)
- Data Localization Suite (数据本地化 · Enterprise 独占)

**关键配置**：

```bash
# === LB Geo Steering (北京用户 → 北京源站 · 上海用户 → 上海源站) ===
cfcli lb create --name "fin-lb" \
  --steering geo \
  --default-pool <bj-pool-id> \
  --fallback-pool <sh-pool-id>

cfcli lb pool create --name "BJ-Pool" --origins "1.1.1.1,1.1.1.2" --health-check <hc-id>
cfcli lb pool create --name "SH-Pool" --origins "2.2.2.1,2.2.2.2" --health-check <hc-id>

# === Health Checks (主动 · 5s 探测) ===
cfcli health-checks create --name "fin-hc" --path "/health" --interval 5 --timeout 2 --retries 2

# === Data Localization Suite (数据本地化 · 不出境) ===
cfcli zone update-setting --name data_localization --value CN

# === Logpush → SIEM (合规审计) ===
cfcli logpush create --destination syslog://siem.nc-services.local:514 --fields all
```

**关键风险**：
- LB 故障转移延迟 > 5min → RTO 失败 → 缓解：Health Check 间隔 5s + 故障转移阈值 2 次
- 跨区域 Session 不一致 → 用户被登出 → 缓解：Session 共享 Redis (源站侧)
- 数据本地化配置错误 → 合规违规 → 缓解：UAT 验证 + 法务审核

**回滚要点**：DNS 切回单源站 (北京) · LB 暂停 · Data Localization 关闭

---

## 衍生场景 2：机场 · 高并发票务系统 + Waiting Room 流量整形

**适用行业**：机场、演唱会票务、秒杀电商、政府抢号

**与主体场景差异**：

| 维度 | 主体场景 | 衍生场景 2 |
|------|----------|-----------|
| 流量特征 | 稳态 | 突发高峰 (春运 / 促销) |
| 源站容量 | 充足 | 有限 (Legacy 票务系统) |
| 容忍排队 | 无 | 接受排队 (用户体验降级) |
| 关键风险 | 误判 | 源站雪崩 |

**新增 Cloudflare 功能 (Enterprise 准确名词)**：
- Waiting Room (排队室 · Enterprise 增强：Queueing Methods + Custom Template)
- Waiting Room Events (一次性事件 · 秒杀场景)
- Cache Reserve (R2 持久化 · 减少回源)
- Smart Tiered Cache (上层 PoP 缓存)
- Workers (边缘计算 · 库存预检)

**关键配置**：

```bash
# === Waiting Room (常态排队 · 春运) ===
cfcli waiting-room create \
  --name "spring-festival" \
  --host "ticket.nc-services.com" \
  --path "/buy" \
  --total-active-users 5000 \
  --session-duration 10 \
  --queue-all true \
  --queueing-method fifo

# === Waiting Room Events (秒杀 · 单次事件) ===
cfcli waiting-room event create \
  --waiting-room-id <wr-id> \
  --name "double-11" \
  --event-start "2026-11-11T00:00:00+08:00" \
  --event-end "2026-11-11T23:59:59+08:00" \
  --prequeue-start "2026-11-10T22:00:00+08:00" \
  --total-active-users 1000

# === Cache Reserve (减少回源) ===
cfcli zone update-setting --name cache_reserve --value on

# === Workers (边缘库存预检 · 减少无效请求到源站) ===
cfcli workers deploy inventory-check.js
```

**关键风险**：
- Waiting Room 阈值过低 → 用户体验差 → 缓解：UAT 压测确定阈值
- Waiting Room 排队过长 → 用户流失 → 缓解：Custom Template 引导 + 重试提示
- Cache Reserve 误存动态库存 → 数据不一致 → 缓解：Cache Rules Bypass 库存查询路径

**回滚要点**：Waiting Room 暂停 (`cfcli waiting-room pause`) · Cache Reserve 关闭 · Workers 取消部署

---

## 衍生场景 3：政府 · 全民服务高可用 + 数据主权

**适用行业**：电子政务、社保医保、税务、公安交管

**与主体场景差异**：

| 维度 | 主体场景 | 衍生场景 3 |
|------|----------|-----------|
| 用户规模 | 企业用户 | 全民 (亿级) |
| 数据主权 | 标准 | 严格 (数据不出境 + 国密算法) |
| 可用性要求 | 99.99% | 99.999% (5 个 9) |
| 国密支持 | 不要求 | SM2/SM3/SM4 |

**新增 Cloudflare 功能 (Enterprise 准确名词)**：
- Data Localization Suite (数据本地化 · 流量终止在中国 PoP)
- Multi-Region LB + Health Checks (99.999% 可用性)
- Workers KV (边缘状态 · 减少 Session 回源)
- Cloudflare Access (Zero Trust · 公务员内部系统)
- Page Shield (防前端 JS 劫持 · 防篡改)
- Bot Management (防爬虫 / 防机器人抢号)

**关键配置**：

```bash
# === Data Localization (流量终止在中国 PoP · 数据不出境) ===
cfcli zone update-setting --name data_localization --value CN

# === Multi-Region LB (5 个 9) ===
cfcli lb create --name "gov-lb" \
  --steering dynamic \
  --default-pool <cn-bj-pool> \
  --fallback-pool <cn-sh-pool> \
  --session-affinity cookie

# === Workers KV (边缘 Session) ===
cfcli kv create-namespace --name "gov-session"
cfcli workers deploy session-edge.js

# === Cloudflare Access (公务员内部) ===
cfcli access create-policy \
  --name "gov-internal" \
  --action allow \
  --emails "official@gov.cn"

# === Bot Management (防抢号) ===
cfcli firewall add \
  --description "Block Bot Score < 20 on Registration" \
  --action block \
  --filter '(http.request.uri.path eq "/register") and (cf.bot_management.score lt 20)'

# === Page Shield (防篡改) ===
cfcli zone update-setting --name page_shield --value block
```

**关键风险**：
- 数据本地化配置错误 → 合规违规 → 缓解：UAT 验证 PoP 位置 + 法务审核
- 国密算法不支持 → 部分政务系统接入失败 → 缓解：Cloudflare 国密支持评估 (需联系 TAM)
- 99.999% 可用性挑战 → 缓解：Multi-Region LB + 故障转移 + 监控

**回滚要点**：Data Localization 关闭 · LB 切单区域 · Access 策略禁用

---

## 衍生场景 4：关键基础设施 · OT/ICS 系统 + Spectrum

**适用行业**：电力、水务、油气、制造业 OT、SCADA

**与主体场景差异**：

| 维度 | 主体场景 | 衍生场景 4 |
|------|----------|-----------|
| 协议 | HTTP/HTTPS | + TCP/UDP (Modbus / OPC UA / DNP3) |
| 防护范围 | Web 应用 | + OT 网络 (L3/L4) |
| 合规 | 等保 2.0 | + 关键信息基础设施保护条例 |
| 暴露面 | Web 源站 | + OT 设备 (历史直接暴露) |

**新增 Cloudflare 功能 (Enterprise 准确名词)**：
- Spectrum (L4 反向代理 · TCP/UDP 应用 DDoS 防护)
- Magic Transit (L3/L4 DDoS · BGP 通告 IP 段)
- Cloudflare Tunnel (反向隧道 · OT 设备不暴露公网 IP)
- Cloudflare Access (Zero Trust · OT 运维访问)
- WAF Custom Rules (针对 OT 协议特征)
- Bot Management (OT 自动化设备指纹)

**关键配置**：

```bash
# === Spectrum (Modbus TCP 502 端口 · L4 代理) ===
cfcli spectrum create \
  --name "scada-modbus" \
  --port 502 \
  --protocol tcp \
  --origin-port 502 \
  --origin-ips "10.0.0.10,10.0.0.11" \
  --ip-whitelist <ot-operator-ip-list>

# === Magic Transit (L3/L4 DDoS · BGP 通告 OT IP 段) ===
cfcli magic-transit create \
  --ip-prefix "203.0.113.0/24" \
  --advertise-method bgp

# === Cloudflare Tunnel (OT 设备不暴露公网 IP) ===
cfcli tunnel create --name "ot-tunnel"
cfcli tunnel route --id <tunnel-id> --hostname scada.nc-services.com

# === Access (OT 运维 Zero Trust) ===
cfcli access create-policy \
  --name "ot-operator" \
  --action allow \
  --emails "operator@nc-services.com"

# === WAF Custom Rules (OT 协议异常检测) ===
cfcli firewall add \
  --description "Block anomalous Modbus payload" \
  --action block \
  --filter '(http.request.uri.path eq "/modbus") and (http.request.body contains "write_multiple")'
```

**关键风险**：
- Spectrum 延迟 > OT 协议容忍 → SCADA 超时 → 缓解：UAT 验证延迟 + Spectrum 配置优化
- Magic Transit BGP 误通告 → 流量黑洞 → 缓解：UAT 灰度 + 故障转移预案
- OT 设备国密/特殊协议不兼容 → 缓解：Tunnel 反向连接绕过

**回滚要点**：Spectrum 关闭 · Magic Transit BGP 撤销 · Tunnel 断开

---

## 衍生场景 5：SaaS 多租户 + API Shield + Zero Trust

**适用行业**：B2B SaaS、ERP SaaS、CRM SaaS、低代码平台

**与主体场景差异**：

| 维度 | 主体场景 | 衍生场景 5 |
|------|----------|-----------|
| 用户模型 | 单租户 | 多租户 (Tenant 隔离) |
| API 流量占比 | 30% | 80% (机器到机器) |
| 认证 | 表单 + SSO | + API Key + JWT + mTLS |
| 防护重点 | Web 攻击 | + API 滥用 + 数据越权 |

**新增 Cloudflare 功能 (Enterprise 准确名词)**：
- API Shield (API 防护 · Schema Validation + JWT Validation + mTLS Client Cert)
- API Discovery (自动发现 API 端点)
- API Sequence Analytics (API 调用序列分析 · 防越权)
- Cloudflare Access (Zero Trust · SaaS 客户内部用户)
- Workers (边缘多租户路由)
- Workers KV (租户配置缓存)
- Account-level Rules Lists (跨租户 IP/ASN 黑名单)

**关键配置**：

```bash
# === API Shield - Schema Validation (OpenAPI) ===
cfcli api-shield upload-schema --file openapi.yaml
cfcli api-shield validate-schema --enable true --action block

# === API Shield - JWT Validation ===
cfcli api-shield jwt-validation --jwks-url "https://auth.nc-services.com/.well-known/jwks.json" --enable true

# === API Shield - mTLS Client Cert (机器到机器) ===
cfcli api-shield mtls --enable true --ca-cert <ca-id>

# === API Discovery (自动发现) ===
cfcli api-shield discovery --enable true

# === Multi-Tenant Routing (Workers) ===
cfcli workers deploy tenant-router.js
# Workers 根据 Host Header 路由到不同租户源站

# === Account-level Rules Lists (跨租户黑名单) ===
cfcli ip-lists create --name "global-blocklist" --kind ip --description "跨租户共享封禁"
cfcli firewall account-access block --target <malicious-ip> --type ip --mode block --notes "跨租户封禁"

# === Zero Trust Access (SaaS 客户内部用户) ===
cfcli access create-policy \
  --name "tenant-admin" \
  --action allow \
  --emails "admin@tenant-a.com"
```

**关键风险**：
- API Schema Validation 误判 → 正常 API 调用被 Block → 缓解：Log Only 1 周后转 Block
- mTLS Client Cert 配置错误 → 全部 API 失败 → 缓解：UAT 灰度 + 证书备份
- 多租户路由错误 → 数据越权 (严重) → 缓解：UAT 多租户隔离测试
- API Discovery 漏发现 → 影子 API 暴露 → 缓解：定期 Discovery + 人工核对

**回滚要点**：API Shield Schema Validation 禁用 · JWT Validation 禁用 · mTLS 禁用 · Workers 路由回退

---

# 全景洞察链路图 (End-to-End Insight Map)

> 本章基于本 CAB 主体场景与 5 个衍生场景，提供 3 张全景链路图：① 企业级完整请求流水线（含每个 Cloudflare 功能名与执行顺序）② 安全决策树（每个节点的判定与动作）③ 责任分层（Cloudflare / 源站 / 应用 各自负责的安全边界）。所有功能名词按 Enterprise Plan 准确表述。

## 一、企业级完整请求流水线

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                       企业级完整请求流水线 (Enterprise End-to-End Pipeline)                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘

  访客 (Browser / API Client / Bot)
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  ① Cloudflare DNS (Anycast 权威 · 全球 300+ PoP)                │
│   · Full Setup: NS 在 Cloudflare · 返回 Anycast IP              │
│   · Partial Setup: 原 DNS → CNAME → Cloudflare                  │
│   · DNSSEC = on (防 DNS 劫持)                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ② TCP / QUIC 握手 (传输层)                                      │
│   · HTTP/3 (QUIC) · HTTP/2                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ TLS 握手 (加密层)                                             │
│   · Universal SSL (边缘) / Advanced Certificate Manager (ACM)    │
│   · Min TLS 1.2 · TLS 1.3 on · 0-RTT off                        │
│   · HSTS: max-age=31536000; includeSubDomains; preload          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ④ Advanced DDoS Protection (始终开启 · Enterprise 增强)          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  L3/L4 · Network-layer DDoS Protection                       ││
│  │  · SYN Flood / UDP Amplification / ICMP Flood                ││
│  │  · Anycast 吸收 + 边缘丢包                                    ││
│  │  · Ent 增强: Adaptive DDoS / 灵敏度可调 / Magic Transit      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  L7 · HTTP DDoS Protection                                   ││
│  │  · HTTP Flood / Slowloris / Slow Body / Slow Read            ││
│  │  · 指纹检测 → Block / Challenge / Rate Limit                  ││
│  │  · Ent 增强: HTTP DDoS Managed Ruleset Override               ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑤ Bot Management (Enterprise · 独占)                            │
│   · Bot Score (ML 模型 1-99) + JA3/JA4 指纹 + HTTP/2 指纹         │
│   · Verified Bots 白名单自动放行 (Google/Bing)                   │
│   · Bot Analytics 全量请求可视化                                 │
│   · 处置: Allow / Block / Managed Challenge / JS Challenge       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑥ Web Application Firewall (WAF · Ruleset Engine)               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  a. Account-level Access Rules (跨 zone · Enterprise)        ││
│  │     · 应用于账户内 ALL zones                                  ││
│  │     · CLI: cfcli firewall account-access                     ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  b. Custom Rules (Phase: http_request_firewall_custom)       ││
│  │     · wirefilter 表达式 (IP/ASN/Geo/URI/Header/Bot Score)    ││
│  │     · 引用 Rules Lists: $cf.ip_list / asn_list / hostname_list││
│  │     · 动作: Block/Challenge/JS Challenge/Managed Challenge/   ││
│  │            Log/Skip                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  c. Rate Limiting Rules (Phase: http_ratelimit)              ││
│  │     · 滑动窗口 (如 100 req / 10s per IP)                      ││
│  │     · Ent 增强: Advanced Rate Limiting (按方法/响应码/字符数)  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  d. Managed Rulesets (Phase: http_request_firewall_managed)  ││
│  │     · Cloudflare Managed Ruleset (虚拟补丁)                   ││
│  │     · Cloudflare OWASP Core Rule Set (Paranoia 1-4)           ││
│  │     · Cloudflare Exposed Credentials Check (Ent · 泄露凭证)   ││
│  │     · Page Shield (Ent · 前端 JS 劫持防护)                     ││
│  │     · Ent: Override (按 Tag/ID 调整动作)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  e. WAF Attack Score (Enterprise · ML 评分)                  ││
│  │     · cf.waf.score (1-99) · cf.waf.score.sql / xss / rce      ││
│  │     · 可在 Custom Rules 按 score 阈值放行/挑战/拦截            ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑦ Waiting Room (如已配置 · Pro+ · Enterprise 增强)              │
│   · 并发 < max_users → 放行                                       │
│   · 并发 ≥ max_users → 排队 (CF Edge 托管)                       │
│   · Queueing Methods: FIFO / Random / LIFO / Bypass              │
│   · Waiting Room Events (秒杀 · 一次性事件)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑧ Cache (Cache Rules / Smart Tiered Cache / Cache Reserve)      │
│   · 命中: HIT → 直接返回 (跳过后续)                               │
│   · 未命中: MISS → 继续                                           │
│   · Smart Tiered Cache (Ent): 自动选择上层 PoP                    │
│   · Cache Reserve (Ent): R2 持久化 (30 天)                        │
│   · Polish (Pro+): 图片无损 (WebP/AVIF)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (Cache MISS 时继续)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)│
│   · Redirect Rules (http_request_dynamic_redirect)               │
│   · Transform Rules (Modify Request/Response Header/URL/Host)    │
│   · Configuration Rules (Security Level/Browser Integrity/TLS)   │
│   · Origin Rules (改写回源 Host/SNI/Port/Destination IP)         │
│   · 旧 Page Rules 已弃用 → 迁移至上述 Ruleset                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑩ Cloudflare Workers (可选 · 边缘计算)                          │
│   · 边缘 JS 执行 · 可直接返回 (跳过源站)                          │
│   · Workers KV (边缘状态) · Workers R2 (对象存储)                 │
│   · 多租户路由 / 库存预检 / A/B 测试                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑪ Cloudflare Load Balancer (Enterprise)                         │
│   · Pools + Steering (geo/random/least_connections/hash)         │
│   · Health Checks (主动 5s + 被动)                                │
│   · Session Affinity (cookie)                                    │
│   · Fallback Pool                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑫ Argo Smart Routing (Enterprise · 附加订阅)                    │
│   · 智能路由优化 · 降低跨区域延迟                                  │
│   · Argo Tiered Caching (上层 PoP 命中)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑬ Authenticated Origin Pulls (mTLS · 全 Plan · 源站验证)        │
│   · Cloudflare 向源站出示客户端证书                                │
│   · 源站 ssl_verify_client on → 仅接受 CF 请求                    │
│   · 防止源站被绕过 CF 直接攻击                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑭ 源站连接 + 真实 IP 还原                                        │
│   · CF-Connecting-IP Header 注入真实客户端 IP                     │
│   · True-Client-IP Header (备用)                                 │
│   · 源站 Nginx/IIS/Apache 配置 set_real_ip_from + CF IP Allowlist│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑮ 源站 (Origin · Nginx + App)                                   │
│   · 收到请求 (remote_addr = CF IP · CF-Connecting-IP = 真实 IP)   │
│   · Origin CA 证书 (源站 TLS)                                    │
│   · 防火墙仅允许 Cloudflare IP 段                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑯ 响应处理 (Response Pipeline)                                  │
│   · Brotli / Gzip 压缩                                            │
│   · Image Resizing (Ent · 动态图片尺寸)                           │
│   · HTTP/2 Server Push (如启用)                                   │
│   · Transform Rules 修改 Response Header                          │
│   · Cache Rules 写入缓存 (如可缓存)                                │
│   · Logpush → SIEM (Cloudflare Logs · 合规审计)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                       返回访客
```

**节点速查表 (Cloudflare Enterprise 准确名词)：**

| # | 节点 | Cloudflare 功能名 (Enterprise) | Phase / 位置 | 可跳过 |
|---|------|-------------------------------|--------------|--------|
| ① | DNS | Cloudflare DNS (Anycast 权威) + DNSSEC | 解析层 | ❌ |
| ② | 传输层 | TCP / QUIC (HTTP/3) | 传输层 | ❌ |
| ③ | TLS | Universal SSL / ACM | 加密层 | ❌ |
| ④ | DDoS | Advanced DDoS Protection (L3/L4 + L7) | 始终开启 | ❌ |
| ⑤ | Bot | Bot Management (Bot Score + JA3/JA4) | Edge · Ent 独占 | ✅ |
| ⑥ | WAF | Web Application Firewall (Custom + Managed Rulesets + Rate Limiting + Attack Score) | Ruleset Engine | ✅ Skip |
| ⑦ | 排队 | Waiting Room / Waiting Room Events | Edge · 灰度 | ✅ |
| ⑧ | 缓存 | Cache Rules / Smart Tiered Cache / Cache Reserve / Polish | Edge | ✅ Bypass |
| ⑨ | 改写 | Ruleset Engine (Redirect/Transform/Configuration/Origin Rules) | Edge | ✅ |
| ⑩ | 计算 | Cloudflare Workers + KV + R2 | Edge | ✅ |
| ⑪ | 分发 | Cloudflare Load Balancer + Health Checks | Edge · Ent | ✅ |
| ⑫ | 路由 | Argo Smart Routing + Argo Tiered Caching | Edge · Ent (附加) | ✅ |
| ⑬ | mTLS | Authenticated Origin Pulls | 回源 | ✅ |
| ⑭ | IP 还原 | CF-Connecting-IP / True-Client-IP | 回源 | ❌ |
| ⑮ | 源站 | Origin (Nginx + App + Origin CA + CF IP Allowlist) | 源站 | ❌ |
| ⑯ | 响应 | Brotli / Image Resizing / Transform Rules / Logpush | Edge | ❌ |

---

## 二、安全决策树 (Security Decision Tree)

> 展示每个请求在 Cloudflare Edge 的判定路径与最终动作。

```
请求到达 Cloudflare Edge
    │
    ▼
┌─────────────────────────────────────┐
│ ④ Advanced DDoS Protection          │
│   是否匹配 DDoS 指纹?               │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       Yes            No
        │             │
        ▼             ▼
┌──────────────┐  ┌─────────────────────────┐
│ DDoS 缓解    │  │ ⑤ Bot Management        │
│ Block/       │  │   Bot Score 评估        │
│ Challenge/   │  └────────────┬────────────┘
│ Rate Limit   │               │
└──────────────┘        ┌──────┴──────┐
                        │             │
                       Yes            No
                  (Verified Bot)
                        │             │
                        ▼             ▼
                ┌──────────────┐  ┌─────────────────────────┐
                │ Allow        │  │ ⑥ WAF                   │
                │ (白名单)     │  │  a. Account Access Rules│
                └──────────────┘  │  b. Custom Rules        │
                                  │  c. Rate Limiting       │
                                  │  d. Managed Rulesets    │
                                  │  e. Attack Score        │
                                  └────────────┬────────────┘
                                               │
                                        ┌──────┴──────┐
                                        │             │
                                    (匹配规则)    (无匹配)
                                        │             │
                                        ▼             ▼
                                ┌──────────────┐  ┌─────────────────┐
                                │ 执行 Action  │  │ ⑦ Waiting Room  │
                                │ Block /      │  │  并发超限?      │
                                │ Challenge /  │  └────────┬────────┘
                                │ JS Challenge /│          │
                                │ Managed      │    ┌──────┴──────┐
                                │ Challenge /  │    │             │
                                │ Log / Skip   │   Yes            No
                                └──────────────┘    │             │
                                                   ▼             ▼
                                           ┌──────────────┐  ┌─────────────────┐
                                           │ 排队         │  │ ⑧ Cache         │
                                           │ (CF Edge)    │  │  HIT ?          │
                                           └──────────────┘  └────────┬────────┘
                                                                ┌──────┴──────┐
                                                                │             │
                                                               Yes            No
                                                                │             │
                                                                ▼             ▼
                                                        ┌──────────────┐  ┌─────────────────┐
                                                        │ 直接返回     │  │ ⑨ Ruleset Engine│
                                                        │ (跳过源站)   │  │ ⑩ Workers       │
                                                        └──────────────┘  │ ⑪ LB            │
                                                                          │ ⑫ Argo          │
                                                                          │ ⑬ mTLS          │
                                                                          │ ⑭ 真实 IP 还原   │
                                                                          │ ⑮ 源站           │
                                                                          └────────┬────────┘
                                                                                   │
                                                                                   ▼
                                                                          ┌──────────────┐
                                                                          │ ⑯ 响应处理   │
                                                                          │ 返回访客     │
                                                                          └──────────────┘
```

**关键决策点说明：**

| 决策点 | 判定依据 | 可能动作 | 数据源 |
|--------|----------|----------|--------|
| ④ DDoS | 流量指纹 / 基线异常 | Block / Challenge / Rate Limit | DDoS Managed Ruleset |
| ⑤ Bot | Bot Score / JA3/JA4 / 行为 | Allow (Verified) / Block / Challenge | Bot Management ML |
| ⑥a Account Access Rules | IP / ASN / Country | Block / Challenge / Allow | Account-level Rules |
| ⑥b Custom Rules | wirefilter 表达式 | Block / Challenge / Log / Skip | Rules Lists / Bot Score |
| ⑥c Rate Limiting | 滑动窗口计数 | Block / Challenge | 请求计数 |
| ⑥d Managed Rulesets | OWASP / CF 签名 | Block / Log / Challenge | Managed Ruleset |
| ⑥e Attack Score | cf.waf.score | (Custom Rules 引用) | WAF ML |
| ⑦ Waiting Room | 并发数 | 放行 / 排队 | Waiting Room 计数 |
| ⑧ Cache | 缓存键匹配 | HIT 返回 / MISS 继续 | Cache Store |

---

## 三、责任分层 (Responsibility Layering)

> 明确 Cloudflare / 源站 / 应用 三层各自负责的安全边界，避免职责重叠或盲区。

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           安全责任分层 (Defense in Depth)                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Cloudflare Edge (CF 负责)                                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · Advanced DDoS Protection (L3/L4 + L7)                                                │
│  · Bot Management                                                                       │
│  · WAF (Custom Rules + Managed Rulesets + Rate Limiting Rules + Attack Score)           │
│  · Managed Challenge / JS Challenge / CAPTCHA                                           │
│  · SSL/TLS 终结 (Universal SSL / ACM)                                                   │
│  · Cache (Smart Tiered Cache / Cache Reserve / Polish)                                  │
│  · Ruleset Engine (Redirect / Transform / Configuration / Origin Rules)                 │
│  · Workers (边缘计算)                                                                   │
│  · Load Balancer + Health Checks                                                        │
│  · Waiting Room                                                                         │
│  · Account-level Access Rules + Rules Lists                                             │
│  · Page Shield (前端 JS 劫持防护)                                                        │
│  · Logpush → SIEM (日志合规)                                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ (mTLS · Authenticated Origin Pulls)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Origin Infrastructure (SRE 负责)                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · 防火墙 Allowlist (仅允许 Cloudflare IP 段)                                            │
│  · Authenticated Origin Pulls (mTLS · 源站验证 CF 证书)                                  │
│  · Origin CA 证书 (源站 TLS · 15 年有效)                                                │
│  · 真实客户端 IP 还原 (Nginx set_real_ip_from + CF-Connecting-IP)                       │
│  · 源站 TLS 配置 (Min TLS 1.2 · TLS 1.3)                                                │
│  · 源站限流 (Nginx limit_req · 兜底)                                                    │
│  · 源站日志 (access log + error log → ELK)                                              │
│  · 源站监控 (Prometheus + Grafana · CPU/Mem/5xx)                                        │
│  · 源站灾备 (多源站 + LB Pool)                                                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Application (App Owner 负责)                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · 应用层认证 (表单登录 / SSO / OAuth2 / SAML)                                          │
│  · 应用层授权 (RBAC / ABAC · 防越权)                                                    │
│  · 应用层输入校验 (防 SQLi/XSS · 与 WAF 互补)                                           │
│  · 应用层输出编码 (防 XSS)                                                              │
│  · 应用层 Session 管理 (Redis 共享 · 防 Session 固定)                                    │
│  · 应用层 CSRF Token                                                                   │
│  · 应用层敏感数据加密 (数据库 / 静态)                                                   │
│  · 应用层审计日志 (用户操作 · 合规)                                                     │
│  · 应用层业务风控 (基于 CF-Connecting-IP · 反欺诈)                                      │
│  · 应用层 API Key / JWT 验证 (与 API Shield 互补)                                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**责任分层关键原则：**

1. **纵深防御 (Defense in Depth)**：每层独立可防，单层失效不导致全链路失守。
2. **职责不重叠**：CF Edge 负责"网络与应用层防护"；源站负责"基础设施与协议层"；应用负责"业务逻辑与数据层"。
3. **数据流闭环**：CF 注入 `CF-Connecting-IP` → 源站还原 → 应用读取 → 应用审计日志含真实 IP。
4. **回滚独立**：CF 层规则可独立 Pause；源站防火墙可独立关闭 Allowlist；应用层不受 CF 回滚影响。
5. **合规可审计**：Logpush (CF) + access log (源站) + 审计日志 (应用) → SIEM 三方对账。

**职责边界对照表：**

| 安全控制 | Cloudflare | 源站 | 应用 |
|----------|-----------|------|------|
| DDoS 防护 | ✅ 主 | ❌ | ❌ |
| Bot 防护 | ✅ 主 | ❌ | ❌ |
| WAF (签名) | ✅ 主 | ❌ (兜底 limit_req) | ❌ |
| 输入校验 | ✅ (WAF) | ❌ | ✅ (业务校验) |
| SQLi/XSS | ✅ (OWASP CRS) | ❌ | ✅ (参数化查询 + 输出编码) |
| 认证 | ❌ (Access 仅内部) | ❌ | ✅ 主 |
| 授权 (防越权) | ❌ | ❌ | ✅ 主 |
| TLS 终结 | ✅ 主 (边缘) | ✅ (回源 TLS) | ❌ |
| mTLS (源站验证) | ✅ (客户端证书) | ✅ (验证 CF 证书) | ❌ |
| 真实客户端 IP | ✅ (注入 Header) | ✅ (还原) | ✅ (读取) |
| 速率限制 | ✅ (Rate Limiting Rules) | ✅ (limit_req 兜底) | ❌ |
| 缓存 | ✅ 主 | ❌ | ❌ |
| 日志合规 | ✅ (Logpush) | ✅ (access log) | ✅ (审计日志) |
| 灾备分发 | ✅ (LB) | ✅ (多源站) | ❌ |

---

## 四、衍生场景功能矩阵

> 5 个衍生场景与本 CAB 主体场景的 Cloudflare 功能对照。

| Cloudflare 功能 (Enterprise 准确名词) | 主体场景 | 衍生1 金融 | 衍生2 机场 | 衍生3 政府 | 衍生4 OT | 衍生5 SaaS |
|---------------------------------------|----------|-----------|-----------|-----------|---------|-----------|
| Cloudflare DNS (Anycast) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Universal SSL / ACM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Advanced DDoS Protection (L3/L4 + L7) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bot Management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WAF (Custom + Managed Rulesets) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate Limiting Rules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Managed Challenge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authenticated Origin Pulls (mTLS) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cloudflare Load Balancer | — | ✅ | ✅ | ✅ | — | ✅ |
| Health Checks | — | ✅ | ✅ | ✅ | — | ✅ |
| Cache Reserve | — | — | ✅ | — | — | — |
| Smart Tiered Cache | — | ✅ | ✅ | ✅ | — | ✅ |
| Waiting Room | — | — | ✅ | — | — | — |
| Waiting Room Events | — | — | ✅ | — | — | — |
| Workers | — | — | ✅ | ✅ | — | ✅ |
| Workers KV | — | — | — | ✅ | — | ✅ |
| Argo Smart Routing | — | ✅ | — | ✅ | — | — |
| Magic Transit | — | ✅ | — | — | ✅ | — |
| Spectrum | — | — | — | — | ✅ | — |
| Cloudflare Tunnel | — | — | — | — | ✅ | — |
| Cloudflare Access (Zero Trust) | ✅ (Admin) | — | — | ✅ | ✅ | ✅ |
| Data Localization Suite | — | ✅ | — | ✅ | — | — |
| Page Shield | ✅ (监控) | ✅ | — | ✅ | — | ✅ |
| API Shield (Schema/JWT/mTLS) | — | — | — | — | — | ✅ |
| API Discovery | — | — | — | — | — | ✅ |
| Exposed Credentials Check | ✅ | ✅ | — | — | — | — |
| WAF Attack Score | ✅ | ✅ | — | — | — | ✅ |
| Account-level Access Rules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rules Lists (IP/ASN/Hostname/Redirect) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Logpush → SIEM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 五、CAB 闭环检查清单

> CAB 评审时，逐项确认以下检查点均已满足。

| 类别 | 检查项 | 状态 |
|------|--------|------|
| **范围** | In/Out Scope 已明确 | ⏳ |
| **现状** | As-Is 架构图已绘制 | ⏳ |
| **目标** | To-Be 架构图已绘制 | ⏳ |
| **风险** | 风险矩阵已评分 (≥15 必须缓解) | ⏳ |
| **兼容性** | 10 项兼容风险均有 Mitigation | ⏳ |
| **实施** | 5 阶段灰度计划已制定 | ⏳ |
| **配置** | DNS / SSL / Origin 配置基线已锁定 | ⏳ |
| **规则** | Allow / Skip / WAF / Rate Limit / Challenge / Cache 规则目录已固化 | ⏳ |
| **UAT** | 34 个测试用例 100% 通过 | ⏳ |
| **证据** | 截图 / 日志 / HAR / Network Trace 已收集 | ⏳ |
| **Go-Live** | 时间线 + 验证活动已制定 | ⏳ |
| **监控** | KPI + 告警阈值 + Dashboard 已就位 | ⏳ |
| **回滚** | 3 级回滚 (DNS / 规则 / 完整) + 决策树已制定 | ⏳ |
| **事件响应** | SEV 分级 + 升级路径 + Bridge Call 流程已就位 | ⏳ |
| **成功标准** | 技术 / 业务 / 安全三类成功标准已定义 | ⏳ |
| **运营交接** | Runbook + 监控所有权 + 支持联系人已明确 | ⏳ |
| **审批** | CAB 7 个角色签字 | ⏳ |
| **衍生场景** | 5 个衍生场景已评估 (是否需要扩展) | ⏳ |
| **全景链路** | 请求流水线 + 决策树 + 责任分层已绘制 | ⏳ |

---

**文档结束 · CAB v1.0 · 2026-08-17**





