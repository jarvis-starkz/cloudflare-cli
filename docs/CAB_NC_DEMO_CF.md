# Cloudflare Proxied Mode Compatibility & Security Enablement — CAB 实施实例 (nc-demo.cf)

> **场景基线**：Legacy Application + Cloudflare Proxied Mode + Security Challenge
> **演示域名**：`nc-demo.cf`（NC Services Limited 内部演示 Zone · Enterprise Plan）
> **Plan 假设**：Enterprise（本手册所有功能名词、能力边界、Ruleset 命名均按 Enterprise Plan 描述）
> **版本**：v1.1（v1.1 联网官方文档核对：修正 Waiting Room 可用 Plan 为 Business+、AOP 标注全 Plan 可用）
> **配套 CLI**：`cfcli`（参见 COMMAND_GUIDE.md / REQUEST_FLOW_GUIDE.md）
> **本文件用途**：基于具体演示域名 `nc-demo.cf`，提供一份可直接套用的 CAB 实施实例（含真实主机名 / 占位 IP / 可执行 cfcli 命令 / 完整 Nginx 配置）

---

## 封面

| 项目 | 内容 |
|------|------|
| **项目名称** | nc-demo.cf Legacy App Cloudflare Proxied Mode 兼容性与安全启用项目 |
| **演示域名** | `nc-demo.cf`（Zone ID 占位：`ZONE_ID_NC_DEMO_CF`）|
| **Account ID** | `ACCOUNT_ID_NC_SERVICES`（占位 · 实际执行时替换）|
| **变更编号 (CRQ)** | CRQ-2026-0817-DEMO-001 |
| **CAB 编号** | CAB-2026-0817-DEMO-01 |
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
| 0.1 | 2026-08-10 | CF Platform Team | 初稿框架（基于 Legacy App 通用模板） |
| 0.5 | 2026-08-13 | CF Platform Team | 替换为 nc-demo.cf 具体主机名与源站 IP |
| 0.9 | 2026-08-15 | 应用架构组 | 补充 Legacy App 兼容性评估与 UAT 用例 |
| 1.0 | 2026-08-17 | CF Platform Team | CAB 定稿（含完整 cfcli 命令与 Nginx 配置） |

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

NC Services Limited 内部演示环境 `nc-demo.cf` 上运行一套 2010 年代上线的 Legacy 业务系统，承载订单演示、客户档案、对账模拟与第三方对接原型。系统当前直连公网，仅靠源站 iptables / Nginx 限流与一台已过保的 WAF 设备做基础防护，存在以下问题：

1. **暴露面过大**：源站 IP 直接出现在公网 DNS 中，曾遭受多次 L7 HTTP Flood 与 Slowloris 攻击演示。
2. **防护能力陈旧**：现有 WAF 规则库已 18 个月未更新，无法覆盖 OWASP CRS 4.x 新增签名。
3. **缺乏真实客户端 IP 链路**：所有日志为源站 IP，安全审计与欺诈追溯困难。
4. **合规缺口**：等保 2.0 三级、PCI-DSS v4.0 要求"Web 应用前置防护 + DDoS 防护 + 真实来源审计"，现状不满足。
5. **业务连续性风险**：单源站无灾备，源站宕机即业务中断。

经评估，决定将 `nc-demo.cf` 接入 Cloudflare Enterprise Plan，启用 Proxied Mode（橙色云），并叠加 Security Challenge（Managed Challenge / JS Challenge）等安全能力。

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

1. **Proxied Mode 启用**：`nc-demo.cf` 下所有公网 DNS 记录改为 Proxied (橙色云)，源站 IP 从公网 DNS 中消失。
2. **WAF 上线**：Custom Rules + Cloudflare Managed Ruleset + OWASP CRS (Paranoia Level 1) 默认 Block。
3. **Security Challenge 启用**：对高风险路径 (`/admin` / `/api/v1/internal`) 与高 Bot Score 流量启用 Managed Challenge。
4. **真实 IP 还原**：Nginx 源站配置 `set_real_ip_from` + `CF-Connecting-IP`，日志 100% 记录真实客户端 IP。
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

| 资产 | 主机名 | 源站 (Origin) | 接入方式 | 说明 |
|------|--------|---------------|----------|------|
| Website (Portal) | `www.nc-demo.cf` | `203.0.113.10` (HK1) · `198.51.100.10` (SG1) | Full Setup · Proxied | 主门户，含登录/订单/对账 |
| API (REST) | `api.nc-demo.cf` | `203.0.113.10` (HK1) · `198.51.100.10` (SG1) | Full Setup · Proxied | RESTful API，供移动端与第三方调用 |
| Login Services | `login.nc-demo.cf` | `203.0.113.10` (HK1) | Full Setup · Proxied | 表单登录 + 密码找回 |
| SSO | `sso.nc-demo.cf` | `203.0.113.10` (HK1) | Full Setup · Proxied | SAML IdP + OAuth2 Authorization Server |
| Third-party Integrations | `webhook.nc-demo.cf` | `203.0.113.10` (HK1) | Full Setup · Proxied | 接收支付回调、物流回调 |
| Static Assets | `static.nc-demo.cf` | `203.0.113.10` (HK1) | Full Setup · Proxied | JS/CSS/图片 (启用 Cache Reserve) |
| Admin Console | `admin.nc-demo.cf` | `203.0.113.10` (HK1) | Full Setup · Proxied + Zero Trust | 仅允许 Zero Trust Access (Google OIDC/SAML) |

**主机名 → 源站映射汇总：**

| 主机名 | 类型 | DNS 记录 | 代理状态 | 源站 |
|--------|------|----------|----------|------|
| `www.nc-demo.cf` | A | Proxied | 🟧 Orange | LB Pool (HK1 + SG1) |
| `api.nc-demo.cf` | A | Proxied | 🟧 Orange | LB Pool (HK1 + SG1) |
| `login.nc-demo.cf` | A | Proxied | 🟧 Orange | HK1 |
| `sso.nc-demo.cf` | A | Proxied | 🟧 Orange | HK1 |
| `webhook.nc-demo.cf` | A | Proxied | 🟧 Orange | HK1 |
| `static.nc-demo.cf` | A | Proxied | 🟧 Orange | HK1 |
| `admin.nc-demo.cf` | A | Proxied | 🟧 Orange | HK1 (Access 保护) |
| `origin-hk1.nc-demo.cf` | A | DNS Only | ⬜ Gray | `203.0.113.10` (源站直连 · 仅 CF IP Allowlist) |
| `origin-sg1.nc-demo.cf` | A | DNS Only | ⬜ Gray | `198.51.100.10` (源站直连 · 仅 CF IP Allowlist) |

### 2.2 Out of Scope

| 排除项 | 原因 |
|--------|------|
| 邮件流量 (SMTP/IMAP) | 不走 Cloudflare HTTP 代理，保持原 MX 直连 |
| 非 HTTP 内部系统 (RDP/SSH) | 走 Cloudflare Zero Trust Access (单独 CRQ) |
| 数据库迁移 | 与本变更无关 |
| Legacy App 代码重构 | 本变更要求零改造，重构另行立项 |
| 第三方 SaaS (Salesforce 等) | 由 SaaS 供应商负责 |
| `staging.nc-demo.cf` 子域 | 单独 CRQ 处理（与本变更解耦） |

### 2.3 前提条件

| 类别 | 前提条件 | 验证方式 | nc-demo.cf 当前状态 |
|------|----------|----------|---------------------|
| **Network** | 源站公网出口带宽 ≥ 1 Gbps；Cloudflare PoP 至源站 RTT < 50ms | `mtr` / `cfcli zone get` | ✅ HK1 1Gbps / SG1 1Gbps / RTT 30ms |
| **Firewall** | 源站防火墙支持 IP Allowlist（iptables / 安全组 / WAF 设备） | 防火墙策略评审 | ✅ iptables 已就位 |
| **DNS** | `nc-demo.cf` 注册商支持 NS 切换至 Cloudflare；DNS TTL < 3600s | `dig` / 注册商面板 | ✅ 注册商 Cloudflare Registrar |
| **SSL Certificate** | 边缘 Universal SSL 已签发；源站 Origin CA 证书有效 | `cfcli certificate list` / `openssl s_client` | ✅ Universal SSL 已签发 · Origin CA 已申请 |
| **Origin Server** | Nginx ≥ 1.18 支持 `set_real_ip_from` / `X-Forwarded-For` | `nginx -v` / 模块检查 | ✅ Nginx 1.24.0 |
| **Account** | Cloudflare Enterprise Plan 已开通；Account ID / API Token / Zone ID 已就位 | `cfcli verify` | ✅ Enterprise 已开通 |
| **Application** | Legacy App 不强制校验源站 IP（仅校验 Host/Header） | 应用配置审计 | ✅ 仅校验 Host Header |
| **Monitoring** | 已部署 Prometheus / Grafana / ELK；可接入 Cloudflare Logs (Logpush) | 监控告警联调 | ✅ ELK 已就位 |

---

## 第三章 Current State Assessment

### 3.1 As-Is Architecture

```
┌──────────┐                                              ┌──────────┐
│          │  ① DNS 解析 (注册商权威 DNS 直返源站 IP)        │          │
│  Client  │ ────────────────────────────────────────────►│  Origin  │
│ (Browser)│                                              │ HK1 主源  │
│          │  ② HTTPS 直连源站 (源站 IP 公网暴露)            │ 203.0.   │
│          │ ────────────────────────────────────────────►│  113.10  │
│          │                                              │  Nginx   │
│          │  ③ 源站本地 WAF (18 月未更新) + iptables 限流    │  + App   │
│          │ ────────────────────────────────────────────►│          │
└──────────┘                                              └──────────┘
                                                                │
                                                                ▼ (无灾备)
                                                          单点故障风险
```

**当前访问路径关键点：**
- 客户端直接访问源站公网 IP `203.0.113.10`
- 源站 IP 在 DNS 中暴露（`www.nc-demo.cf A 203.0.113.10`）
- 防护能力依赖源站本地 WAF + iptables
- 无 CDN 缓存，每次请求回源
- 无 DDoS 防护，攻击直接打源站
- 无真实客户端 IP 还原机制（双 NAT 后无法审计）
- SG1 备源站 `198.51.100.10` 已部署但未接入 LB，处于冷备状态

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
| R-CUR-01 | 源站 IP `203.0.113.10` 公网暴露，可被直接攻击绕过 WAF | 高 |
| R-CUR-02 | DDoS 防护缺失，单次 HTTP Flood 即可拖垮源站 | 高 |
| R-CUR-03 | WAF 规则陈旧，无法防御新 CVE (Log4Shell / Spring4Shell 等) | 高 |
| R-CUR-04 | 真实客户端 IP 缺失，无法追溯欺诈与攻击 | 中 |
| R-CUR-05 | 单源站无灾备，硬件故障即业务中断（SG1 冷备未启用） | 中 |

---

## 第四章 Target Architecture

### 4.1 To-Be Architecture

```
┌──────────┐                                                ┌──────────────┐
│          │  ① Cloudflare DNS (Anycast 权威)                 │              │
│  Client  │ ──────────────────────────────────────────────►│              │
│ (Browser)│  ② Advanced DDoS Protection (L3/L4 + L7)         │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ③ TLS 终结 (Universal SSL / ACM)               │   Cloudflare │
│          │ ──────────────────────────────────────────────►│   Edge       │
│          │  ④ Bot Management (Bot Score + JA3/JA4)         │   (全球 PoP) │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑤ WAF (Custom + Managed Rulesets + Attack Score)│            │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑥ Waiting Room (高并发排队)                     │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑦ Cache (Smart Tiered + Cache Reserve)         │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑧ Ruleset Engine (Redirect/Transform/Origin)   │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑨ Workers (边缘计算 · 可选)                     │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑩ Load Balancer (HK1 + SG1 Pool)               │              │
│          │ ──────────────────────────────────────────────►│              │
│          │  ⑪ Argo Smart Routing (智能路由)                 │              │
│          │ ──────────────────────────────────────────────►│              │
└──────────┘                                                └──────┬───────┘
                                                                   │
                                                    ⑫ Authenticated Origin Pulls (mTLS)
                                                                   │
                                                                   ▼
                                              ┌────────────────────────────────────┐
                                              │  Origin Pool (Cloudflare LB)        │
                                              │  · HK1: 203.0.113.10 (主 · 权重 100)│
                                              │  · SG1: 198.51.100.10 (备 · 权重 50)│
                                              │  · Health Check: GET /healthz 5s    │
                                              └────────────┬───────────────────────┘
                                                           │
                                      ┌────────────────────┴────────────────────┐
                                      ▼                                         ▼
                          ┌────────────────────────┐              ┌────────────────────────┐
                          │  HK1 Origin (主源)      │              │  SG1 Origin (备源)      │
                          │  203.0.113.10           │              │  198.51.100.10          │
                          │  · Nginx 1.24 + App     │              │  · Nginx 1.24 + App     │
                          │  · Origin CA 证书        │              │  · Origin CA 证书        │
                          │  · CF IP Allowlist      │              │  · CF IP Allowlist      │
                          │  · set_real_ip_from     │              │  · set_real_ip_from     │
                          │  · mTLS Verify (CF Cert)│              │  · mTLS Verify (CF Cert)│
                          └────────────────────────┘              └────────────────────────┘
```

### 4.2 Security Layers

| 层级 | Cloudflare Enterprise 功能 | 防护对象 |
|------|---------------------------|----------|
| **CDN** | Cache Rules + Smart Tiered Cache + Cache Reserve + Polish | 静态资源加速 + 减少回源 |
| **DDoS Protection** | Advanced DDoS Protection (L3/L4 Network-layer + L7 HTTP DDoS Protection) | 流量型与应用层 DDoS |
| **WAF** | Custom Rules + Cloudflare Managed Ruleset + OWASP CRS + Exposed Credentials Check + Page Shield + WAF Attack Score | OWASP Top 10 + 0day 虚拟补丁 |
| **Rate Limiting** | Rate Limiting Rules (http_ratelimit) + Advanced Rate Limiting | 暴力破解 / API 滥用 |
| **Managed Challenge** | Managed Challenge (推荐) / JS Challenge / CAPTCHA | 可疑流量自动挑战 |
| **Bot Protection** | Bot Management (Bot Score 1-99 + JA3/JA4 + HTTP/2 指纹 + Verified Bots) | 自动化攻击 / 爬虫 |
| **源站锁定** | Authenticated Origin Pulls (mTLS) + Cloudflare IP Allowlist | 防止绕过 CF 直连源站 |
| **Zero Trust** | Cloudflare Access (Admin Console) | 内部系统身份认证 |

### 4.3 Traffic Flow

| 流量类型 | 主机名 | 端口 | 处理路径 |
|----------|--------|------|----------|
| **HTTP** | `www.nc-demo.cf` | 80 → 80 | CF Edge 301 强制跳转 HTTPS → 源站 443 |
| **HTTPS** | `www.nc-demo.cf` | 443 → 443 | CF Edge TLS 终结 → mTLS → 源站 443 (Origin CA) |
| **HTTPS** | `api.nc-demo.cf` | 443 → 443 | CF Edge TLS 终结 → Skip WAF Managed Rulesets → mTLS → 源站 443 |
| **HTTPS** | `login.nc-demo.cf` | 443 → 443 | CF Edge TLS 终结 → Rate Limit (登录) → Exposed Credentials Check → 源站 |
| **HTTPS** | `admin.nc-demo.cf` | 443 → 443 | CF Edge TLS 终结 → Cloudflare Access (Zero Trust) → 源站 |
| **WebSocket** | `www.nc-demo.cf/ws` | 443 → 443 | CF Edge 透传 WebSocket → 源站 (无缓存) |
| **Webhook** | `webhook.nc-demo.cf` | 443 → 443 | CF Edge → Skip Managed Challenge → HMAC 校验 (源站) → 源站 |

---

## 第五章 Business Impact Analysis

### 5.1 Service Impact

| 服务 | 影响 | 持续时间 | 缓解措施 |
|------|------|----------|----------|
| `www.nc-demo.cf` 主门户 | DNS 切换时短暂中断 | < 5 分钟 (TTL 300s) | 维护窗口执行 + DNS 预热 |
| `api.nc-demo.cf` API | DNS 切换时短暂中断 | < 5 分钟 | 第三方提前通知 + 重试机制 |
| `login.nc-demo.cf` 登录 | 登录路径 Rate Limit 上线可能影响正常用户 | 上线后 24h 观察期 | 阈值宽裕 (100 req / 10 min) |
| `sso.nc-demo.cf` SSO | SAML 回调可能被 WAF 误判 | 上线后 1 周观察 | Skip 规则 (Phase 2 前) |
| `webhook.nc-demo.cf` 回调 | 第三方回调可能被 Challenge 拦截 | 持续 | Skip Managed Challenge |
| `admin.nc-demo.cf` 管理后台 | Cloudflare Access 上线需重新登录 | 一次性 | 提前通知管理员 |

### 5.2 User Impact

| 用户类型 | 数量 | 影响 | 体验变化 |
|----------|------|------|----------|
| 普通访客 | ~10,000 DAU | 首次访问可能触发 Managed Challenge | 增加 1-3s 加载时间 (仅首次) |
| 已登录用户 | ~3,000 | 登录路径 Rate Limit (100/10min) | 正常用户无感知 |
| 管理员 | 20 | Cloudflare Access 强制登录 | 增加 SSO 跳转 |
| 移动端 API 调用 | ~50,000 req/day | API Schema Validation (Phase 2 后) | 不符合 Schema 的调用被 Block |
| 第三方 Webhook | 8 家 | Skip Challenge 直连源站 | 无感知 |

### 5.3 Third-party Impact

| 第三方 | 接入方式 | 影响 | 通知时间 |
|--------|----------|------|----------|
| 支付网关 (Alipay/WeChat Pay) | `webhook.nc-demo.cf` 回调 | 回调可能被 Challenge → 已配置 Skip | T-7 通知 |
| 物流回调 (SF Express) | `webhook.nc-demo.cf` 回调 | 同上 | T-7 通知 |
| SSO IdP (Azure AD) | `sso.nc-demo.cf` SAML 回调 | WAF 可能误判 SAML Response → Skip | T-7 通知 |
| 监控系统 (Datadog) | `api.nc-demo.cf` 心跳 | API Rate Limit 可能误判 → IP Allowlist | T-3 配置 |
| CDN 现有用户 | DNS 切换 | 短暂中断 | T-7 公告 |

### 5.4 Authentication Impact

| 认证类型 | 主机 | 影响 | 缓解 |
|----------|------|------|------|
| 表单登录 | `login.nc-demo.cf` | Rate Limit 100/10min · Exposed Credentials Check | 阈值宽裕 + Log Only 1 周 |
| SAML SSO | `sso.nc-demo.cf` | WAF Managed Rulesets Skip (防误判 SAML XML) | Phase 2 前配置 Skip |
| OAuth2 | `sso.nc-demo.cf/oauth/*` | 同上 | 同上 |
| JWT API | `api.nc-demo.cf` | 后续可叠加 API Shield JWT Validation | 本期不启用 (衍生场景) |
| Admin SSO | `admin.nc-demo.cf` | Cloudflare Access 强制 Google OIDC | 提前配置 + 通知 |

---

## 第六章 Compatibility Risk Assessment

### 6.1 Client IP Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App 当前从 `REMOTE_ADDR` 读取客户端 IP，启用 Proxied Mode 后 `REMOTE_ADDR` 变为 Cloudflare IP，导致应用日志、风控、防刷失效 |
| **Impact** | 应用层 IP 风控失效；审计日志无真实 IP；CSRF 校验异常（如基于 IP 的 Token） |
| **Mitigation** | ① 源站 Nginx 配置 `set_real_ip_from <CF IP 段>` + `real_ip_header CF-Connecting-IP`<br>② 应用层从 `HTTP_X_FORWARDED_FOR` 或 `HTTP_CF_CONNECTING_IP` 读取（如代码允许）<br>③ UAT 验证 100% 日志含真实 IP<br>④ 配置失败时 Phase 1 回滚 (DNS 切回 Gray Cloud) |

### 6.2 Legacy Browser Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App 部分用户使用 IE 11 / 旧版 Edge / Android 5，不支持 TLS 1.3 / Managed Challenge JS |
| **Impact** | Managed Challenge 在 IE 11 上无法执行 JS → 用户被 Block |
| **Mitigation** | ① Min TLS 1.2 (非 1.3)；TLS 1.3 启用但不禁用 1.2<br>② Custom Rules: User-Agent 包含 `MSIE` 或 `Trident` → Skip Managed Challenge (Log Only)<br>③ UAT 覆盖 IE 11 / Edge Legacy / Android 5 测试 |

### 6.3 API Compatibility Risk

| 项目 | 内容 |
|------|------|
| **Description** | `api.nc-demo.cf` 接收 JSON / XML / SOAP 请求，WAF Managed Rulesets 可能误判合法请求为 SQLi/XSS |
| **Impact** | 正常 API 调用被 Block → 第三方集成失败 |
| **Mitigation** | ① Phase 1 仅 Proxied (无 WAF)<br>② Phase 2 启用 WAF 但 `api.nc-demo.cf` 全量 Skip Managed Rulesets (仅保留 Custom Rules)<br>③ 1 周 Log Only 观察 → 调整规则 → 转 Block<br>④ 提供 API Schema (OpenAPI) → 后续 API Shield |

### 6.4 Session/Cookie Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App Session Cookie 未设置 `Secure` / `HttpOnly` / `SameSite`，Cloudflare HTTPS 后可能 Cookie 丢失 |
| **Impact** | 用户登录态丢失；CSRF 风险 |
| **Mitigation** | ① Cloudflare Transform Rules 自动添加 `Secure; HttpOnly; SameSite=Lax` 到 Set-Cookie<br>② UAT 验证登录态保持<br>③ 应用层后续修复 Cookie 属性 (独立 CRQ) |

### 6.5 SSL/TLS Risk

| 项目 | 内容 |
|------|------|
| **Description** | 源站当前使用自签证书，Cloudflare SSL 模式若设为 Full (Strict) 会导致回源失败 |
| **Impact** | 5xx 错误；服务中断 |
| **Mitigation** | ① 提前申请 Origin CA 证书 (15 年有效) → 部署到 HK1 + SG1<br>② SSL 模式先 Full (非 Strict) → 验证 → 切 Full (Strict)<br>③ HSTS 在 Phase 3 启用 (Phase 1/2 不启用) |

### 6.6 WebSocket Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App 在 `www.nc-demo.cf/ws` 使用 WebSocket 推送订单状态，Cloudflare Cache / WAF 可能中断长连接 |
| **Impact** | WebSocket 连接断开；订单推送失败 |
| **Mitigation** | ① Cloudflare 默认支持 WebSocket (无需特殊配置)<br>② Cache Rules: `www.nc-demo.cf/ws*` Bypass Cache<br>③ WAF Custom Rules: WebSocket 路径 Skip Managed Rulesets (Phase 2 前)<br>④ UAT 验证 WebSocket 连接保持 ≥ 30 分钟 |

### 6.7 Upload / Download Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App 支持文件上传 (订单附件 / 合同 PDF)，最大 500MB，Cloudflare Free 默认限制 100MB |
| **Impact** | 大文件上传失败 |
| **Mitigation** | ① Enterprise Plan: Max Upload Size 500MB (默认)<br>② 配置确认: `cfcli zone update-setting --name max_upload --value 500`<br>③ UAT 覆盖 10MB / 100MB / 500MB 上传测试 |

### 6.8 Caching Risk

| 项目 | 内容 |
|------|------|
| **Description** | Legacy App 部分页面含动态内容 (用户名 / 订单状态)，被缓存后用户看到他人数据 |
| **Impact** | 数据泄露；用户投诉 |
| **Mitigation** | ① Cache Rules: 默认 Bypass Cache (除 `static.nc-demo.cf`)<br>② `static.nc-demo.cf` Cache Everything + Edge TTL 1h<br>③ UAT 验证不同用户看到不同数据 |

### 6.9 SSO Risk

| 项目 | 内容 |
|------|------|
| **Description** | SAML Response 体积大且含 XML 特殊字符，WAF Managed Rulesets 可能误判为 XXE / SQLi |
| **Impact** | SSO 登录失败 |
| **Mitigation** | ① `sso.nc-demo.cf` Skip Managed Rulesets (仅 Custom Rules)<br>② Exposed Credentials Check 仅作用于 `login.nc-demo.cf`<br>③ UAT 验证 Azure AD SSO 完整流程 |

### 6.10 Callback Risk

| 项目 | 内容 |
|------|------|
| **Description** | 第三方 Webhook (支付 / 物流) 无法完成 Managed Challenge JS，会被 Block |
| **Impact** | 支付回调失败；订单状态不更新 |
| **Mitigation** | ① `webhook.nc-demo.cf` Skip Managed Challenge<br>② 源站 HMAC 签名校验 (应用层防御)<br>③ Webhook 路径仅允许已知第三方 IP (Account-level Rules Lists) |

---

## 第七章 Risk Matrix

### 7.1 Risk Scoring Method

| Impact 等级 | 描述 | 分值 |
|-------------|------|------|
| Critical | 业务完全中断 / 数据泄露 | 5 |
| High | 主要功能受损 / 部分用户受影响 | 4 |
| Medium | 次要功能受损 / 少量用户受影响 | 3 |
| Low | 性能下降 / 体验变差 | 2 |
| Negligible | 几乎无影响 | 1 |

| Probability 等级 | 描述 | 分值 |
|------------------|------|------|
| Almost Certain | > 90% 概率发生 | 5 |
| Likely | 60-90% | 4 |
| Possible | 30-60% | 3 |
| Unlikely | 5-30% | 2 |
| Rare | < 5% | 1 |

**Rating = Impact × Probability**

| Rating | 等级 | 处置策略 |
|--------|------|----------|
| ≥ 15 | 极高 | 必须缓解后才能 Go-Live |
| 9-14 | 高 | 必须有缓解措施 + 监控 |
| 4-8 | 中 | 监控 + 应急预案 |
| < 4 | 低 | 接受 |

### 7.2 Risk Register

| Risk ID | Description | Impact | Likelihood | Rating | Control |
|---------|-------------|--------|------------|--------|---------|
| R-01 | 真实客户端 IP 丢失 (REMOTE_ADDR 变 CF IP) | 5 | 5 | 25 | Nginx `set_real_ip_from` + `CF-Connecting-IP` + UAT 验证 |
| R-02 | IE 11 / Legacy Browser 无法通过 Managed Challenge | 4 | 4 | 16 | User-Agent Skip 规则 + Min TLS 1.2 |
| R-03 | WAF 误判 API JSON 请求为 SQLi | 4 | 4 | 16 | `api.nc-demo.cf` Skip Managed Rulesets + Log Only 1 周 |
| R-04 | SAML Response 触发 WAF XXE 规则 | 5 | 3 | 15 | `sso.nc-demo.cf` Skip Managed Rulesets |
| R-05 | 第三方 Webhook 被 Challenge Block | 5 | 3 | 15 | `webhook.nc-demo.cf` Skip Challenge + HMAC 校验 |
| R-06 | 源站自签证书导致 Full (Strict) 回源失败 | 5 | 3 | 15 | 提前部署 Origin CA + 先 Full 后 Strict |
| R-07 | WebSocket 长连接被 Cache 中断 | 3 | 3 | 9 | Cache Bypass + WAF Skip |
| R-08 | 文件上传 > 100MB 失败 | 4 | 2 | 8 | Enterprise Max Upload 500MB |
| R-09 | 动态页面被缓存导致数据串 | 5 | 2 | 10 | 默认 Bypass Cache + UAT 多用户验证 |
| R-10 | DNS 切换时 TTL 导致部分用户仍访问源站 | 3 | 3 | 9 | TTL 降至 300s + 维护窗口执行 |
| R-11 | mTLS 配置错误导致源站拒绝所有 CF 请求 | 5 | 2 | 10 | UAT 灰度 + 回滚预案 (Pause mTLS) |
| R-12 | Cloudflare Access 配置错误锁死管理员 | 5 | 2 | 10 | Break-glass 账号 + 紧急回滚 (Pause Access) |

**≥ 15 分风险（R-01 ~ R-05）必须在 Phase 1 前完成缓解措施部署并通过 UAT 验证后才能 Go-Live。**

---

## 第八章 Implementation Strategy

> 5 阶段灰度实施，每阶段 ≥ 1 周观察期。Phase 1 失败立即回滚 DNS，Phase 2-5 失败 Pause 对应规则。

### 8.1 Phase 1 · Proxy Enablement（DNS 切换 + 源站锁定）

**Objectives**
- `nc-demo.cf` 下所有公网 DNS 记录改为 Proxied (橙色云)
- 源站 IP 从公网 DNS 中消失
- SSL 模式 Full (Strict) + Authenticated Origin Pulls (mTLS)
- 真实客户端 IP 还原 (Nginx 配置)

**Tasks**

```bash
# === 1. DNS 切换为 Proxied Mode ===
cfcli dns update --zone nc-demo.cf --name www.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name api.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name login.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name sso.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name webhook.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name static.nc-demo.cf --type A --content 203.0.113.10 --proxied true
cfcli dns update --zone nc-demo.cf --name admin.nc-demo.cf --type A --content 203.0.113.10 --proxied true

# === 2. SSL/TLS 设置 ===
cfcli ssl update --zone nc-demo.cf --mode full_strict
cfcli ssl update --zone nc-demo.cf --min-tls 1.2
cfcli ssl update --zone nc-demo.cf --tls-1.3 true
cfcli ssl update --zone nc-demo.cf --0rtt false
cfcli ssl update --zone nc-demo.cf --hsts true --max-age 31536000 --include-subdomains true --preload true

# === 3. Authenticated Origin Pulls (mTLS) ===
cfcli ssl update --zone nc-demo.cf --authenticated-origin-pulls true

# === 4. 真实客户端 IP (源站配置见 9.4) ===
# Nginx 已部署 set_real_ip_from + CF-Connecting-IP

# === 5. Cache 基础配置 ===
cfcli cache update --zone nc-demo.cf --browser-cache-ttl 3600
# 默认 Bypass Cache (除 static.nc-demo.cf)

# === 6. 源站防火墙 Allowlist (仅允许 CF IP) ===
# 见 9.3 Nginx 配置
```

**Validation**
- `dig www.nc-demo.cf` 返回 Cloudflare Anycast IP (非 203.0.113.10)
- `curl -I https://www.nc-demo.cf` 返回 `server: cloudflare` + `cf-ray: xxxxx`
- `openssl s_client -connect www.nc-demo.cf:443` 显示 Universal SSL 证书
- 源站 Nginx access log 中 `remote_addr` 为 CF IP，`CF-Connecting-IP` 为真实 IP
- 直接访问 `203.0.113.10` 失败 (mTLS 校验)
- UAT 1.1-1.5 全部通过

### 8.2 Phase 2 · WAF Rollout（Log Only → Block）

**Objectives**
- Custom Rules 上线 (Skip 规则优先)
- Cloudflare Managed Ruleset 启用 (1 周 Log Only → Block)
- OWASP CRS Paranoia Level 1 (1 周 Log Only → Block)
- Exposed Credentials Check (仅 login 路径)

**Tasks**

```bash
# === 1. Custom Rules - Skip 规则 (优先级最高) ===
# API 路径跳过 Managed Challenge (Phase 4 之前)
cfcli firewall add --zone nc-demo.cf \
  --description "Skip-01: api.nc-demo.cf skip Managed Rulesets" \
  --action skip \
  --filter '(http.host eq "api.nc-demo.cf")' \
  --skip-rulesets "managed"

# SSO 回调路径跳过 WAF Managed Rulesets (先观察)
cfcli firewall add --zone nc-demo.cf \
  --description "Skip-02: sso.nc-demo.cf skip Managed Rulesets" \
  --action skip \
  --filter '(http.host eq "sso.nc-demo.cf")' \
  --skip-rulesets "managed"

# Webhook 路径跳过 Managed Challenge
cfcli firewall add --zone nc-demo.cf \
  --description "Skip-03: webhook.nc-demo.cf skip Challenge" \
  --action skip \
  --filter '(http.host eq "webhook.nc-demo.cf")' \
  --skip-rulesets "managed"

# IE 11 / Legacy Browser 跳过 Managed Challenge
cfcli firewall add --zone nc-demo.cf \
  --description "Skip-04: Legacy Browser skip Challenge" \
  --action skip \
  --filter '(http.user_agent contains "MSIE") or (http.user_agent contains "Trident")' \
  --skip-rulesets "managed"

# WebSocket 路径 Bypass Cache
cfcli firewall add --zone nc-demo.cf \
  --description "Skip-05: WebSocket bypass cache" \
  --action skip \
  --filter '(http.request.uri.path startsWith "/ws")' \
  --skip-cache true

# === 2. 启用 Cloudflare Managed Ruleset (Log Only · 观察 1 周) ===
cfcli waf deploy-ruleset --zone nc-demo.cf --ruleset "cf-managed" --action log

# === 3. 启用 OWASP CRS (Paranoia Level 1 · Log Only) ===
cfcli waf deploy-ruleset --zone nc-demo.cf --ruleset "owasp-core" --paranoia 1 --action log

# === 4. Exposed Credentials Check (仅登录路径 · Log Only) ===
cfcli waf deploy-ruleset --zone nc-demo.cf --ruleset "exposed-credentials" \
  --filter '(http.host eq "login.nc-demo.cf") and (http.request.uri.path eq "/login")' --action log

# === 5. Page Shield (监控模式) ===
cfcli page-shield update --zone nc-demo.cf --mode monitor
```

**1 周后转 Block**

```bash
cfcli waf update-ruleset --zone nc-demo.cf --ruleset "cf-managed" --action block
cfcli waf update-ruleset --zone nc-demo.cf --ruleset "owasp-core" --action block
cfcli waf update-ruleset --zone nc-demo.cf --ruleset "exposed-credentials" --action block
```

**Validation**
- WAF Analytics 显示 Log 数量趋势 (无 Block)
- 误判率 < 0.1%
- UAT 2.1-2.8 全部通过

### 8.3 Phase 3 · Rate Limiting

**Objectives**
- 登录路径 Rate Limit (100 req / 10 min per IP)
- API Rate Limit (按 IP + URI)
- Admin Rate Limit (严格)

**Tasks**

```bash
# === 1. 登录路径 Rate Limiting ===
cfcli ratelimit create --zone nc-demo.cf \
  --name "RL-01: Login 100/10min" \
  --filter '(http.host eq "login.nc-demo.cf") and (http.request.uri.path eq "/login") and (http.request.method eq "POST")' \
  --characteristics '["ip", "uri"]' \
  --period 600 \
  --requests 100 \
  --action challenge \
  --counting '("http.request.uri.path")'

# === 2. API Rate Limiting (按 IP + URI) ===
cfcli ratelimit create --zone nc-demo.cf \
  --name "RL-02: API 1000/10s per IP+URI" \
  --filter '(http.host eq "api.nc-demo.cf")' \
  --characteristics '["ip", "uri"]' \
  --period 10 \
  --requests 1000 \
  --action block

# === 3. Admin Rate Limiting (严格) ===
cfcli ratelimit create --zone nc-demo.cf \
  --name "RL-03: Admin 20/10min" \
  --filter '(http.host eq "admin.nc-demo.cf")' \
  --characteristics '["ip"]' \
  --period 600 \
  --requests 20 \
  --action challenge
```

**Validation**
- 登录暴力破解测试：100 次后触发 Challenge
- API 压测：1000 req/10s 后触发 Block
- UAT 3.1-3.3 全部通过

### 8.4 Phase 4 · Managed Challenge

**Objectives**
- 高 Bot Score 流量 → Managed Challenge (灰度 5% → 100%)
- `/admin` 路径 → Managed Challenge
- 高风险地理 → Managed Challenge

**Tasks**

```bash
# === 1. 高 Bot Score 流量 → Managed Challenge (灰度 5%) ===
cfcli firewall add --zone nc-demo.cf \
  --description "MC-01: Bot Score < 30 → Managed Challenge (灰度 5%)" \
  --action managed_challenge \
  --filter '(cf.bot_management.score lt 30)' \
  --priority 100

# 灰度 5% (用 Workers 随机路由 · 或 cfcli 灰度配置)
# 1 周观察后 → 100%

# === 2. /admin 路径 → Managed Challenge ===
cfcli firewall add --zone nc-demo.cf \
  --description "MC-02: /admin → Managed Challenge" \
  --action managed_challenge \
  --filter '(http.request.uri.path startsWith "/admin")'

# === 3. 高风险地理 → Managed Challenge ===
cfcli firewall add --zone nc-demo.cf \
  --description "MC-03: 高风险地理 → Managed Challenge" \
  --action managed_challenge \
  --filter '(ip.geoip.country in {"CN" "RU" "KP" "IR"}) and (http.host ne "www.nc-demo.cf")'
```

**Validation**
- Bot Analytics 显示 Challenge 触发数
- 真实用户误判率 < 1%
- UAT 4.1-4.3 全部通过

### 8.5 Phase 5 · Bot Protection

**Objectives**
- Bot Management 启用 (Enterprise 默认开启)
- Verified Bots 白名单 (Google/Bing)
- 已知恶意 Bot → Block

**Tasks**

```bash
# === 1. 启用 Bot Management (Enterprise 默认开启) ===
cfcli zone update-setting --zone nc-demo.cf --name bot_management --value on

# === 2. Verified Bots Allow (Google/Bing 等搜索引擎) ===
cfcli firewall add --zone nc-demo.cf \
  --description "Bot-01: Verified Bots Allow" \
  --action allow \
  --filter '(cf.bot_management.verified_bot)'

# === 3. 已知恶意 Bot → Block ===
cfcli firewall add --zone nc-demo.cf \
  --description "Bot-02: Bot Score < 10 → Block" \
  --action block \
  --filter '(cf.bot_management.score lt 10)'

# === 4. Bot Analytics 监控 ===
cfcli bot-analytics enable --zone nc-demo.cf
```

**Validation**
- Bot Analytics 显示 Bot Score 分布
- Verified Bots (Googlebot) 正常访问
- 恶意 Bot 被 Block
- UAT 5.1-5.4 全部通过

---

## 第九章 Configuration Baseline

### 9.1 DNS Configuration

#### Orange Cloud (Proxied · 推荐)

| 主机名 | 类型 | Content | Proxy | TTL |
|--------|------|---------|-------|-----|
| `www.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `api.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `login.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `sso.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `webhook.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `static.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |
| `admin.nc-demo.cf` | A | `203.0.113.10` | 🟧 Proxied | Auto |

#### Gray Cloud (DNS Only · 仅源站直连记录)

| 主机名 | 类型 | Content | Proxy | TTL |
|--------|------|---------|-------|-----|
| `origin-hk1.nc-demo.cf` | A | `203.0.113.10` | ⬜ DNS Only | 300s |
| `origin-sg1.nc-demo.cf` | A | `198.51.100.10` | ⬜ DNS Only | 300s |

**回滚用：保留 Gray Cloud 记录（仅源站内部使用 · 不在公网 DNS 中暴露）**

### 9.2 SSL/TLS Configuration

| 配置项 | 值 | 说明 |
|--------|------|------|
| **SSL Mode** | Full (Strict) | 边缘到源站 TLS (源站 Origin CA 证书) |
| **Min TLS Version** | 1.2 | 兼容 IE 11 / Legacy Browser |
| **TLS 1.3** | On | 启用但不强制 |
| **0-RTT** | Off | 防重放攻击 |
| **HSTS** | On · max-age=31536000 · includeSubDomains · preload | Phase 3 启用 (Phase 1/2 不启用) |
| **Authenticated Origin Pulls** | On | mTLS · 源站验证 CF 证书（全 Plan 可用；Off/Flexible 下不生效） |
| **Always Use HTTPS** | On | 80 → 443 强制跳转 |
| **Automatic HTTPS Rewrites** | On | 防混合内容 |
| **Certificate** | Universal SSL (边缘) + Origin CA (源站 · 15 年) | |

### 9.3 Origin Configuration

#### Nginx (HK1: 203.0.113.10 / SG1: 198.51.100.10)

```nginx
# /etc/nginx/nginx.conf

user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 16384;
    multi_accept on;
    use epoll;
}

http {
    # ==========================================
    # 1. 真实客户端 IP 还原 (Cloudflare)
    # ==========================================
    
    # Cloudflare IPv4
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    
    # Cloudflare IPv6
    set_real_ip_from 2400:cb00::/32;
    set_real_ip_from 2606:4700::/32;
    set_real_ip_from 2803:f800::/32;
    set_real_ip_from 2405:b500::/32;
    set_real_ip_from 2405:8100::/32;
    set_real_ip_from 2a06:98c0::/29;
    set_real_ip_from 2c0f:f248::/32;
    
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;
    
    # ==========================================
    # 2. 日志格式 (含 CF Header)
    # ==========================================
    
    log_format cloudflare '$remote_addr - $http_cf_connecting_ip - $remote_user '
                          '[$time_local] "$request" $status $body_bytes_sent '
                          '"$http_referer" "$http_user_agent" '
                          'cf-ray:$http_cf_ray bot-score:$http_cf_bot_score';
    
    access_log /var/log/nginx/access.log cloudflare;
    error_log  /var/log/nginx/error.log warn;
    
    # ==========================================
    # 3. 基础配置
    # ==========================================
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # ==========================================
    # 4. 源站限流 (兜底 · CF Rate Limiting 主)
    # ==========================================
    
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=api:10m   rate=100r/s;
    
    # ==========================================
    # 5. Cloudflare IP Allowlist (仅允许 CF)
    # ==========================================
    
    # 定义 Cloudflare IP 段
    geo $realip_remote_addr $is_cloudflare {
        default 0;
        # Cloudflare IPv4
        173.245.48.0/20      1;
        103.21.244.0/22      1;
        103.22.200.0/22      1;
        103.31.4.0/22        1;
        141.101.64.0/18      1;
        108.162.192.0/18     1;
        190.93.240.0/20      1;
        188.114.96.0/20      1;
        197.234.240.0/22     1;
        198.41.128.0/17      1;
        162.158.0.0/15       1;
        104.16.0.0/13        1;
        104.24.0.0/14        1;
        172.64.0.0/13        1;
        131.0.72.0/22        1;
    }
    
    # ==========================================
    # 6. mTLS (Authenticated Origin Pulls)
    # ==========================================
    
    # Cloudflare Origin CA 根证书 (用于验证 CF 客户端证书)
    ssl_client_certificate /etc/nginx/ssl/authenticated_origin_pull_ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;
    
    # ==========================================
    # 7. 上游应用 (Legacy App)
    # ==========================================
    
    upstream legacy_app {
        server 127.0.0.1:8080 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    # ==========================================
    # 8. HTTP → HTTPS 强制跳转 (Cloudflare Always Use HTTPS 已处理 · 兜底)
    # ==========================================
    
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        return 301 https://$host$request_uri;
    }
    
    # ==========================================
    # 9. HTTPS 主服务 (www.nc-demo.cf)
    # ==========================================
    
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name www.nc-demo.cf;
        
        # --- SSL (Origin CA 证书) ---
        ssl_certificate     /etc/nginx/ssl/origin-ca.pem;
        ssl_certificate_key /etc/nginx/ssl/origin-ca.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:50m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;
        
        # --- Cloudflare IP Allowlist ---
        if ($is_cloudflare = 0) {
            return 403;
        }
        
        # --- Health Check 端点 (LB 探测) ---
        location = /healthz {
            access_log off;
            return 200 "ok\n";
            add_header Content-Type text/plain;
        }
        
        # --- WebSocket ---
        location /ws {
            proxy_pass http://legacy_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
        
        # --- 主应用 ---
        location / {
            proxy_pass http://legacy_app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 10s;
            proxy_read_timeout    60s;
            proxy_send_timeout    60s;
        }
        
        # --- 文件上传 (500MB) ---
        client_max_body_size 500m;
    }
    
    # ==========================================
    # 10. API (api.nc-demo.cf)
    # ==========================================
    
    server {
        listen 443 ssl http2;
        server_name api.nc-demo.cf;
        
        ssl_certificate     /etc/nginx/ssl/origin-ca.pem;
        ssl_certificate_key /etc/nginx/ssl/origin-ca.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        
        if ($is_cloudflare = 0) {
            return 403;
        }
        
        location / {
            limit_req zone=api burst=200 nodelay;
            proxy_pass http://legacy_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
    
    # ==========================================
    # 11. Login (login.nc-demo.cf)
    # ==========================================
    
    server {
        listen 443 ssl http2;
        server_name login.nc-demo.cf;
        
        ssl_certificate     /etc/nginx/ssl/origin-ca.pem;
        ssl_certificate_key /etc/nginx/ssl/origin-ca.key;
        
        if ($is_cloudflare = 0) {
            return 403;
        }
        
        location /login {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://legacy_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        location / {
            proxy_pass http://legacy_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    
    # ==========================================
    # 12. 其他 server 块 (sso/webhook/static/admin)
    # ==========================================
    # 配置类似 · 此处省略
}
```

### 9.4 Real Client IP Configuration

#### Nginx Example (见 9.3)

关键配置：
```nginx
set_real_ip_from <CF IP 段>;
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

#### 应用层读取（PHP 示例）

```php
// Legacy App 读取真实 IP
function getRealClientIP() {
    // 优先 CF-Connecting-IP (Cloudflare 注入)
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    // 备用 True-Client-IP
    if (!empty($_SERVER['HTTP_TRUE_CLIENT_IP'])) {
        return $_SERVER['HTTP_TRUE_CLIENT_IP'];
    }
    // 兜底 X-Forwarded-For (链路)
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'];
}
```

#### 应用层读取（Java 示例）

```java
public static String getRealClientIP(HttpServletRequest request) {
    String ip = request.getHeader("CF-Connecting-IP");
    if (ip == null || ip.isEmpty()) {
        ip = request.getHeader("True-Client-IP");
    }
    if (ip == null || ip.isEmpty()) {
        ip = request.getHeader("X-Forwarded-For");
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
    }
    if (ip == null || ip.isEmpty()) {
        ip = request.getRemoteAddr();
    }
    return ip;
}
```

---

## 第十章 Cloudflare Rule Catalog

> 本章固化所有 Cloudflare 规则基线。所有规则通过 `cfcli` 配置，配置文件存档于 `configs/waf/nc-demo-cf-rules.json`。

### 10.1 Allow Rules

| Rule ID | 名称 | 表达式 | 动作 | 优先级 |
|---------|------|--------|------|--------|
| ALLOW-01 | 企业办公 IP Allow | `(ip.src in $cf.ip_list.corporate_office)` | Allow | 10 |
| ALLOW-02 | 监控系统 IP Allow | `(ip.src in $cf.ip_list.monitoring)` | Allow | 11 |
| ALLOW-03 | Verified Bots Allow | `(cf.bot_management.verified_bot)` | Allow | 12 |

```bash
# === 创建企业办公 IP List ===
cfcli ip-lists create --name "corporate_office" --kind ip \
  --description "NC Services 办公 IP"

# === 创建监控系统 IP List ===
cfcli ip-lists create --name "monitoring" --kind ip \
  --description "Datadog / Prometheus 监控 IP"

# === Allow 规则 ===
cfcli firewall add --zone nc-demo.cf \
  --description "ALLOW-01: Corporate Office IP Allow" \
  --action allow \
  --filter '(ip.src in $corporate_office)' \
  --priority 10
```

### 10.2 Skip Rules

| Rule ID | 名称 | 表达式 | Skip 内容 | 优先级 |
|---------|------|--------|----------|--------|
| SKIP-01 | api.nc-demo.cf Skip Managed | `(http.host eq "api.nc-demo.cf")` | All Managed Rulesets | 20 |
| SKIP-02 | sso.nc-demo.cf Skip Managed | `(http.host eq "sso.nc-demo.cf")` | All Managed Rulesets | 21 |
| SKIP-03 | webhook.nc-demo.cf Skip Challenge | `(http.host eq "webhook.nc-demo.cf")` | All Managed Rulesets | 22 |
| SKIP-04 | Legacy Browser Skip Challenge | `(http.user_agent contains "MSIE") or (http.user_agent contains "Trident")` | All Managed Rulesets | 23 |
| SKIP-05 | WebSocket Bypass Cache | `(http.request.uri.path startsWith "/ws")` | Cache | 24 |

```bash
# 见 Phase 2 Tasks
```

### 10.3 WAF Rules

| Rule ID | 名称 | 表达式 | 动作 | 优先级 |
|---------|------|--------|------|--------|
| WAF-01 | Block 高风险地理 (非 www) | `(ip.geoip.country in {"CN" "RU" "KP" "IR"}) and (http.host ne "www.nc-demo.cf")` | Block | 30 |
| WAF-02 | Block 已知攻击工具 UA | `(http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap")` | Block | 31 |
| WAF-03 | Block 路径遍历 | `(http.request.uri.path contains "../") or (http.request.uri.path contains "..\\")` | Block | 32 |
| WAF-04 | Log 高 Bot Score | `(cf.bot_management.score lt 30)` | Log | 33 |
| WAF-05 | Cloudflare Managed Ruleset | (内置签名) | Block | - |
| WAF-06 | OWASP CRS (PL1) | (OWASP 签名) | Block | - |
| WAF-07 | Exposed Credentials Check | (HIBP 比对) | Block (仅 login) | - |
| WAF-08 | Page Shield (Block 模式) | (前端 JS 劫持) | Block | - |

```bash
cfcli firewall add --zone nc-demo.cf \
  --description "WAF-01: Block high-risk geo (non-www)" \
  --action block \
  --filter '(ip.geoip.country in {"CN" "RU" "KP" "IR"}) and (http.host ne "www.nc-demo.cf")' \
  --priority 30

cfcli firewall add --zone nc-demo.cf \
  --description "WAF-02: Block attack tool UA" \
  --action block \
  --filter '(http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap")' \
  --priority 31
```

### 10.4 Rate Limiting Rules

| Rule ID | 名称 | 路径 | 阈值 | 动作 |
|---------|------|------|------|------|
| RL-01 | Login Rate Limit | `login.nc-demo.cf/login` POST | 100 req / 10 min per IP | Challenge |
| RL-02 | API Rate Limit | `api.nc-demo.cf/*` | 1000 req / 10 s per IP+URI | Block |
| RL-03 | Admin Rate Limit | `admin.nc-demo.cf/*` | 20 req / 10 min per IP | Challenge |
| RL-04 | Password Reset | `login.nc-demo.cf/reset` POST | 10 req / 1 hour per IP | Challenge |
| RL-05 | Search API | `api.nc-demo.cf/search` | 100 req / 1 min per IP | Challenge |

```bash
# 见 Phase 3 Tasks
```

### 10.5 Managed Challenge Rules

| Rule ID | 名称 | 表达式 | 动作 | 优先级 |
|---------|------|--------|------|--------|
| MC-01 | Bot Score < 30 | `(cf.bot_management.score lt 30)` | Managed Challenge | 100 |
| MC-02 | /admin 路径 | `(http.request.uri.path startsWith "/admin")` | Managed Challenge | 101 |
| MC-03 | 高风险地理 (www) | `(ip.geoip.country in {"CN" "RU" "KP" "IR"}) and (http.host eq "www.nc-demo.cf")` | Managed Challenge | 102 |

```bash
# 见 Phase 4 Tasks
```

### 10.6 Caching Rules

| Rule ID | 名称 | 表达式 | 缓存策略 | Edge TTL |
|---------|------|--------|----------|----------|
| CACHE-01 | static.nc-demo.cf Cache Everything | `(http.host eq "static.nc-demo.cf")` | Cache Everything | 1 hour |
| CACHE-02 | www.nc-demo.cf Bypass (动态) | `(http.host eq "www.nc-demo.cf")` | Bypass Cache | - |
| CACHE-03 | WebSocket Bypass | `(http.request.uri.path startsWith "/ws")` | Bypass Cache | - |
| CACHE-04 | API Bypass | `(http.host eq "api.nc-demo.cf")` | Bypass Cache | - |

```bash
cfcli cache create-rule --zone nc-demo.cf \
  --description "CACHE-01: static.nc-demo.cf Cache Everything" \
  --filter '(http.host eq "static.nc-demo.cf")' \
  --cache-status cache_everything \
  --edge-ttl 3600

cfcli cache create-rule --zone nc-demo.cf \
  --description "CACHE-02: www.nc-demo.cf Bypass" \
  --filter '(http.host eq "www.nc-demo.cf")' \
  --cache-status bypass

# === Smart Tiered Cache (Enterprise) ===
cfcli cache update --zone nc-demo.cf --smart-tiered-cache true

# === Cache Reserve (Enterprise · R2 持久化 30 天) ===
cfcli cache update --zone nc-demo.cf --cache-reserve true
```

---

## 第十一章 UAT Test Plan

### 11.1 Test Environment

| 项 | 配置 |
|----|------|
| **环境** | UAT 环境 `uat.nc-demo.cf`（独立 Zone · 配置同生产） |
| **源站** | `203.0.113.20` (UAT HK1) |
| **客户端** | Chrome 120 / Firefox 121 / Safari 17 / Edge 120 / IE 11 / Android 5 |
| **测试账号** | 50 个 (5 管理员 + 20 普通用户 + 25 第三方 API) |
| **测试数据** | 100 订单 + 50 用户 + 10 第三方回调 |

### 11.2 Test Scope

| 模块 | 范围 |
|------|------|
| DNS | 7 主机名 Proxied 状态验证 |
| SSL/TLS | Universal SSL + Origin CA + mTLS |
| WAF | Custom Rules + Managed Rulesets + OWASP CRS |
| Rate Limiting | 登录 / API / Admin |
| Managed Challenge | Bot Score / /admin / Geo |
| Bot Management | Verified Bots + Malicious Bots |
| Cache | static / www / API / WebSocket |
| 真实 IP | Nginx + 应用层 |

### 11.3 Test Data

| 数据类型 | 数量 | 说明 |
|----------|------|------|
| 用户账号 | 50 | 5 admin + 20 user + 25 api |
| 订单数据 | 100 | 含已完成 / 待支付 / 已取消 |
| 商品数据 | 20 | 含图片 / 描述 / 库存 |
| API Token | 25 | 第三方对接用 |
| Webhook URL | 8 | 支付 / 物流 / 通知 |

### 11.4 Test Cases

#### Authentication 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| AUTH-01 | 正常登录 (Chrome) | 200 + Session Cookie 设置 | P0 |
| AUTH-02 | 正常登录 (IE 11) | 200 + Skip Managed Challenge | P0 |
| AUTH-03 | 错误密码 10 次 | 第 11 次触发 Rate Limit Challenge | P0 |
| AUTH-04 | 错误密码 100 次 | 第 101 次触发 Block | P0 |
| AUTH-05 | 登出 | 200 + Session Cookie 清除 | P0 |
| AUTH-06 | 密码重置 | 邮件发送 + 1 小时限 10 次 | P1 |
| AUTH-07 | SSO 登录 (Azure AD) | SAML 回调成功 + 用户登录 | P0 |
| AUTH-08 | SSO 登录 (Google) | OAuth2 回调成功 + 用户登录 | P0 |
| AUTH-09 | Admin 登录 (Cloudflare Access) | Google OIDC 跳转 + 管理员登录 | P0 |

#### API 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| API-01 | GET /api/v1/orders (Chrome) | 200 + JSON | P0 |
| API-02 | GET /api/v1/orders (curl) | 200 + JSON | P0 |
| API-03 | POST /api/v1/orders (JSON) | 201 + 订单创建 | P0 |
| API-04 | POST /api/v1/orders (SOAP) | 201 + 订单创建 | P1 |
| API-05 | Webhook 接收 (Alipay) | 200 + HMAC 校验通过 | P0 |
| API-06 | Webhook 接收 (SF Express) | 200 + HMAC 校验通过 | P0 |
| API-07 | API 压测 1000 req/10s | 第 1001 次 Block (429) | P0 |
| API-08 | API SQLi 尝试 (api.nc-demo.cf) | Custom Rules 不拦截 (Skip Managed) | P0 |

#### Upload 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| UP-01 | 上传 10MB 文件 | 200 + 文件保存 | P0 |
| UP-02 | 上传 100MB 文件 | 200 + 文件保存 | P0 |
| UP-03 | 上传 500MB 文件 | 200 + 文件保存 | P0 |
| UP-04 | 上传 501MB 文件 | 413 Request Entity Too Large | P1 |
| UP-05 | 下载 100MB 文件 | 200 + 文件完整 | P0 |

#### SSO 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| SSO-01 | Azure AD SAML 登录 | 200 + 用户登录 | P0 |
| SSO-02 | Google OAuth2 登录 | 200 + 用户登录 | P0 |
| SSO-03 | SAML Response 含 XML 特殊字符 | 不被 WAF 误判 (Skip Managed) | P0 |
| SSO-04 | SSO 回调 100 次/10min | 不触发 Rate Limit | P1 |

#### Payment Gateway 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| PAY-01 | Alipay 回调 | 200 + 订单状态更新 | P0 |
| PAY-02 | WeChat Pay 回调 | 200 + 订单状态更新 | P0 |
| PAY-03 | 伪造 Alipay 回调 (HMAC 错) | 401 + 订单状态不变 | P0 |

#### WebSocket 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| WS-01 | 建立 WebSocket 连接 | 101 Switching Protocols | P0 |
| WS-02 | 保持连接 30 分钟 | 连接不断开 | P0 |
| WS-03 | 接收订单推送 | 实时收到推送消息 | P0 |
| WS-04 | 通过 Cloudflare 连接 | cf-ray Header | P1 |

#### 兼容性测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| COMPAT-01 | IE 11 访问 www | 200 + Skip Managed Challenge | P0 |
| COMPAT-02 | Edge Legacy 访问 www | 200 + Skip Managed Challenge | P1 |
| COMPAT-03 | Android 5 访问 www | 200 + Skip Managed Challenge | P1 |
| COMPAT-04 | TLS 1.2 连接 | 成功 (Min TLS 1.2) | P0 |
| COMPAT-05 | TLS 1.0 连接 | 失败 (协议版本过低) | P0 |

#### 安全测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| SEC-01 | OWASP ZAP 扫描 | WAF Block 攻击请求 | P0 |
| SEC-02 | sqlmap 注入测试 | WAF Block | P0 |
| SEC-03 | XSS Payload 测试 | WAF Block | P0 |
| SEC-04 | 路径遍历测试 | WAF Block | P0 |
| SEC-05 | 暴力破解登录 | Rate Limit Challenge | P0 |
| SEC-06 | 直接访问源站 IP (203.0.113.10) | mTLS 校验失败 → 400 | P0 |
| SEC-07 | Googlebot 访问 | 200 (Verified Bot Allow) | P0 |
| SEC-08 | 恶意 Bot (Python requests) | Managed Challenge / Block | P0 |

#### 真实 IP 测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| IP-01 | 访问 www + 检查 Nginx 日志 | remote_addr = CF IP · CF-Connecting-IP = 真实 IP | P0 |
| IP-02 | 应用层读取 IP | PHP/Java getRealClientIP() 返回真实 IP | P0 |
| IP-03 | 风控系统日志 | 含真实 IP | P0 |

#### 灾备测试

| TC ID | 测试场景 | 预期结果 | 优先级 |
|-------|----------|----------|--------|
| DR-01 | HK1 故意下线 (stop nginx) | LB 切换至 SG1 · 用户无感知 | P0 |
| DR-02 | SG1 故意下线 | LB 全部转 HK1 | P0 |
| DR-03 | HK1 + SG1 全部下线 | LB Fallback · 显示维护页 | P1 |

**总计：34 个 P0 用例 + 13 个 P1 用例 = 47 个测试用例**

---

## 第十二章 UAT Evidence Collection

### 12.1 Screenshots

每个测试用例需保存以下截图：
- 浏览器开发者工具 Network 截图（含 Request/Response Header）
- 浏览器开发者工具 Console 截图（无 JS Error）
- 应用层日志截图（含真实 IP）
- Cloudflare Analytics 截图（WAF / Rate Limit / Bot 触发）

**存放路径**：`uat-evidence/screenshots/{TC_ID}/{YYYYMMDD}.png`

### 12.2 Logs

| 日志类型 | 来源 | 存放路径 | 保留期 |
|----------|------|----------|--------|
| Nginx access log | HK1 / SG1 | `uat-evidence/logs/nginx/` | 90 天 |
| Nginx error log | HK1 / SG1 | `uat-evidence/logs/nginx-error/` | 90 天 |
| 应用日志 | Legacy App | `uat-evidence/logs/app/` | 90 天 |
| Cloudflare Logpush | Cloudflare → ELK | ELK Index `cf-nc-demo-uat-*` | 30 天 |

### 12.3 HAR Files

每个 P0 用例需导出 HAR 文件：
- 浏览器 → 开发者工具 → Network → Export HAR
- 文件命名：`uat-evidence/har/{TC_ID}_{browser}_{YYYYMMDD}.har`

### 12.4 Network Trace

| 测试 | 工具 | 命令 | 存放路径 |
|------|------|------|----------|
| TLS 握手 | openssl | `openssl s_client -connect www.nc-demo.cf:443 -servername www.nc-demo.cf` | `uat-evidence/trace/tls_{YYYYMMDD}.txt` |
| mTLS 验证 | openssl | `openssl s_client -connect 203.0.113.10:443 -servername www.nc-demo.cf` | `uat-evidence/trace/mtls_{YYYYMMDD}.txt` |
| DNS 解析 | dig | `dig +trace www.nc-demo.cf` | `uat-evidence/trace/dns_{YYYYMMDD}.txt` |
| 路径追踪 | mtr | `mtr -rwzbc 100 www.nc-demo.cf` | `uat-evidence/trace/mtr_{YYYYMMDD}.txt` |
| HTTP 头 | curl | `curl -Iv https://www.nc-demo.cf` | `uat-evidence/trace/headers_{YYYYMMDD}.txt` |

---

## 第十三章 Go-Live Runbook

### 13.1 Change Window

| 项 | 内容 |
|----|------|
| **变更日期** | 2026-08-23 (周六) |
| **变更窗口** | 02:00 – 06:00 (Asia/Shanghai, UTC+8) |
| **业务低峰** | 是 · 凌晨订单量 < 50/h |
| **回滚窗口** | 06:00 前必须完成 Go/No-Go 决策 |
| **执行人** | CF Platform Team (Lead: _____) |
| **审批人** | CAB Chair (On-call: _____) |
| **沟通渠道** | Slack #cab-nc-demo-cf · Bridge: Zoom _____ |
| **回滚授权** | 自动授权 (无需二次 CAB 批准) |

### 13.2 Execution Timeline

```
时间        活动                              负责人         状态
─────────────────────────────────────────────────────────────────
T-30 (01:30) Pre-Change Verification           SRE Lead      ⏳
              · 源站健康检查 (HK1/SG1)
              · DNS 当前状态记录
              · Cloudflare 账户状态确认
              · cfcli 连接性验证

T-15 (01:45) Change Window Open                Change Manager ⏳
              · CAB 通知 Go
              · Bridge Call 开启
              · 监控仪表盘打开

T0   (02:00) Phase 1: DNS 切换 Proxied Mode    CF Platform   ⏳
              · cfcli dns update (7 主机名)
              · 验证 dig 返回 CF Anycast IP
              · 验证 curl -I https://www.nc-demo.cf
              · 验证源站日志 remote_addr = CF IP

T+15 (02:15) Phase 1 Validation                SRE Lead      ⏳
              · UAT 1.1-1.5 执行
              · 真实 IP 验证
              · mTLS 验证
              · 应用功能 Smoke Test

T+30 (02:30) Phase 1 Go/No-Go Decision         CAB Chair     ⏳
              · 如失败 → Rollback (15.3 DNS Rollback)
              · 如成功 → 继续 Phase 2

T+45 (02:45) Phase 2: WAF Log Only             CF Platform   ⏳
              · Custom Rules 上线 (Skip 优先)
              · Managed Ruleset Log Only
              · OWASP CRS Log Only

T+60 (03:00) Phase 2 Validation                SRE Lead      ⏳
              · WAF Analytics 检查
              · 误判率 < 0.1%
              · API/SSO/Webhook 功能验证

T+75 (03:15) Phase 3: Rate Limiting            CF Platform   ⏳
              · RL-01/02/03 上线
              · 暴力破解测试

T+90 (03:30) Phase 3 Validation                SRE Lead      ⏳

T+105 (03:45) Phase 4: Managed Challenge        CF Platform   ⏳
              · MC-01 灰度 5%
              · MC-02 /admin
              · MC-03 Geo

T+120 (04:00) Phase 4 Validation               SRE Lead      ⏳
              · 真实用户误判率 < 1%

T+135 (04:15) Phase 5: Bot Protection          CF Platform   ⏳
              · Bot Management 启用
              · Verified Bots Allow
              · Malicious Bots Block

T+150 (04:30) Phase 5 Validation               SRE Lead      ⏳
              · Bot Analytics 检查

T+165 (04:45) Final Validation                 全员          ⏳
              · 全量 UAT P0 用例执行
              · 监控仪表盘检查
              · 5xx 错误率 < 0.1%

T+180 (05:00) Go/No-Go Decision                CAB Chair     ⏳
              · Go → 进入观察期
              · No-Go → Rollback

T+240 (06:00) Change Window Close              Change Manager ⏳
              · 如未完成 → 申请延期或 Rollback
```

### 13.3 Validation Activities

**Go-Live 验证命令清单：**

```bash
# === 1. DNS 验证 ===
dig +short www.nc-demo.cf
# 预期：返回 Cloudflare Anycast IP (104.x.x.x 或 172.x.x.x)，不是 203.0.113.10

dig +short api.nc-demo.cf
dig +short login.nc-demo.cf
dig +short sso.nc-demo.cf
dig +short webhook.nc-demo.cf
dig +short static.nc-demo.cf
dig +short admin.nc-demo.cf

# === 2. TLS 验证 ===
echo | openssl s_client -connect www.nc-demo.cf:443 -servername www.nc-demo.cf 2>/dev/null | openssl x509 -noout -issuer
# 应返回 Cloudflare Inc ECC CA-3

# === 3. mTLS 验证 (Authenticated Origin Pulls) ===
echo | openssl s_client -connect 203.0.113.10:443 -servername www.nc-demo.cf 2>/dev/null | grep "Verify return code"
# 应返回 Verify return code: 0 (ok) · 不带客户端证书会失败

# === 4. Header 验证 ===
curl -I https://www.nc-demo.cf
# 应包含 server: cloudflare / cf-ray: xxxxx / cf-cache-status

# === 5. WAF 验证 ===
curl -I "https://www.nc-demo.cf/?id=1' OR '1'='1"
# 应返回 403 (OWASP CRS Block · Phase 2 转 Block 后)

curl -I -A "sqlmap/1.5" https://www.nc-demo.cf/
# 应返回 403 (WAF-02 Block 攻击工具 UA)

# === 6. Rate Limit 验证 ===
for i in {1..110}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://login.nc-demo.cf/login; done
# 第 11 次应返回 503 (Challenge) · 实际为 100/10min

# === 7. Managed Challenge 验证 ===
curl -I -A "Python-requests/2.25.0" https://www.nc-demo.cf/
# 应返回 403 + Managed Challenge 页面 (Bot Score 低)

# === 8. Bot Management 验证 ===
curl -I -A "Googlebot/2.1" https://www.nc-demo.cf/
# 应返回 200 (Verified Bot 放行)

# === 9. 真实 IP 验证 (源站) ===
ssh hk1.nc-demo.cf "tail -1 /var/log/nginx/access.log"
# 应看到真实客户端 IP 在 CF-Connecting-IP 字段

# === 10. 源站锁定验证 ===
curl -I -k --resolve www.nc-demo.cf:443:203.0.113.10 https://www.nc-demo.cf/
# 应失败 (400 No required SSL certificate was sent)

# === 11. LB 灾备验证 (T+24h 执行) ===
cfcli lb health-check --zone nc-demo.cf --name "nc-demo-lb"
# 应显示 HK1 healthy + SG1 healthy
```

---

## 第十四章 Monitoring Plan

### 14.1 KPI

| KPI | 指标 | 阈值 | 数据源 |
|-----|------|------|--------|
| **Login Success Rate** | 登录成功率 | ≥ 99% | Cloudflare Analytics + 应用日志 |
| **API Success Rate** | API 2xx 率 | ≥ 99.5% | Cloudflare Analytics |
| **Error Rate** | 5xx 错误率 | < 0.1% | Cloudflare Analytics + 源站 Nginx |
| **Latency (Edge)** | CF Edge TTFB | P95 < 200ms | Cloudflare Analytics |
| **Latency (Origin)** | Origin Response Time | P95 < 500ms | LB Health Checks |
| **WAF Block Rate** | WAF Block 占比 | < 1% (正常流量) | WAF Analytics |
| **Bot Score 分布** | Bot Score < 30 占比 | < 30% | Bot Analytics |
| **Cache Hit Ratio** | static.nc-demo.cf 命中率 | > 95% | Cache Analytics |
| **Origin CPU** | HK1/SG1 CPU | < 70% | Prometheus |
| **Origin Memory** | HK1/SG1 Memory | < 80% | Prometheus |

### 14.2 Alert Thresholds

| Alert ID | 指标 | 阈值 | 持续 | 严重度 | 通知方式 |
|----------|------|------|------|--------|----------|
| ALT-01 | 5xx 错误率 | > 1% | 5 min | Critical | PagerDuty + Slack |
| ALT-02 | 登录成功率 | < 95% | 10 min | Critical | PagerDuty |
| ALT-03 | Origin CPU | > 90% | 5 min | High | Slack |
| ALT-04 | Origin Memory | > 90% | 5 min | High | Slack |
| ALT-05 | WAF Block Rate | > 5% | 10 min | High | Slack (可能误判) |
| ALT-06 | LB 5xx | > 10 | 5 min | Critical | PagerDuty |
| ALT-07 | HK1 Health | Fail | 1 min | Critical | PagerDuty |
| ALT-08 | SG1 Health | Fail | 1 min | High | Slack |
| ALT-09 | DNS 解析失败 | > 0 | 1 min | Critical | PagerDuty |
| ALT-10 | TLS 证书过期 | < 30 天 | - | Medium | Email |

### 14.3 Dashboard

**Cloudflare Dashboard (Cloudflare Account 内)：**
- Zone Analytics: Requests / Bandwidth / Threats / 5xx
- WAF Analytics: Block / Challenge / Log 趋势
- Bot Analytics: Bot Score 分布
- Cache Analytics: Hit Ratio / Top URLs
- LB Analytics: Pool Health / Steering

**Grafana Dashboard (源站侧)：**
- Nginx Dashboard: RPS / 5xx / 4xx / Latency
- Origin Server: CPU / Memory / Disk / Network
- Application: 订单创建率 / 登录率 / 错误率

**ELK Dashboard (日志合规)：**
- Cloudflare Logpush: cf-ray / cf-connecting-ip / WAF action / Bot score
- Nginx access log: 真实 IP / User-Agent / Status
- 应用审计日志: 用户操作 / IP / 时间

```bash
# === Logpush → SIEM (合规审计) ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://nc-services-logs/cf/nc-demo-cf/" \
  --dataset "http_requests" \
  --fields "Timestamp,ClientIP,ClientRequestURI,ClientRequestMethod,EdgeResponseStatus,WAFAction,WAFProfile,BotScore,CFRay" \
  --frequency high
```

---

## 第十五章 Rollback Plan

### 15.1 Rollback Criteria

| 条件 | 触发动作 |
|------|----------|
| 5xx 错误率 > 5% (5 min) | 立即 Rollback Phase 1 (DNS) |
| 登录成功率 < 80% (10 min) | 立即 Rollback Phase 3 (Rate Limit) |
| WAF 误判率 > 5% | Pause Phase 2 (WAF Managed Rulesets) |
| 真实用户 Challenge 误判 > 5% | Pause Phase 4 (Managed Challenge) |
| mTLS 配置错误导致源站拒绝所有 CF 请求 | Disable Authenticated Origin Pulls |
| Cloudflare Access 锁死管理员 | Pause Cloudflare Access |
| 源站 CPU > 95% (5 min) | 评估是否 Rollback Phase 2/4/5 |
| LB 全部源站 Unhealthy | 启用 Fallback Pool + 维护页 |

### 15.2 Rollback Decision Tree

```
Go-Live 期间异常
    │
    ▼
异常类型?
    │
    ├── 5xx / 服务中断
    │       │
    │       ▼
    │   影响范围?
    │       │
    │       ├── 全站 (www + api + login)
    │       │       │
    │       │       ▼
    │       │   立即 DNS Rollback (15.3)
    │       │
    │       └── 单一服务 (如 login Rate Limit 误判)
    │               │
    │               ▼
    │           Rule Rollback (15.4)
    │
    ├── WAF 误判 (合法请求被 Block)
    │       │
    │       ▼
    │   Pause Managed Rulesets
    │       │
    │       ▼
    │   观察 15 min
    │       │
    │       ├── 恢复 → 调整规则后重新启用
    │       └── 未恢复 → DNS Rollback
    │
    ├── mTLS 拒绝所有 CF 请求
    │       │
    │       ▼
    │   Disable Authenticated Origin Pulls
    │       │
    │       ▼
    │   源站 nginx.conf: ssl_verify_client off
    │
    └── Access 锁死管理员
            │
            ▼
        Pause Cloudflare Access
            │
            ▼
        Break-glass 账号登录
```

### 15.3 DNS Rollback (Phase 1 全量回滚)

```bash
# === DNS 切回 Gray Cloud (DNS Only · 直连源站) ===
cfcli dns update --zone nc-demo.cf --name www.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name api.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name login.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name sso.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name webhook.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name static.nc-demo.cf --type A --content 203.0.113.10 --proxied false
cfcli dns update --zone nc-demo.cf --name admin.nc-demo.cf --type A --content 203.0.113.10 --proxied false

# 验证
dig +short www.nc-demo.cf
# 应返回 203.0.113.10 (源站直连)
```

### 15.4 Rule Rollback (单 Phase 回滚)

```bash
# === 仅回滚 Phase 4 (Managed Challenge) ===
cfcli firewall pause --zone nc-demo.cf --description "MC-01: Bot Score < 30"
cfcli firewall pause --zone nc-demo.cf --description "MC-02: /admin"
cfcli firewall pause --zone nc-demo.cf --description "MC-03: 高风险地理"

# === 仅回滚 Phase 2 (WAF Managed Rulesets) ===
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "cf-managed"
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "owasp-core"
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "exposed-credentials"

# === 仅回滚 Phase 3 (Rate Limiting) ===
cfcli ratelimit pause --zone nc-demo.cf --name "RL-01: Login 100/10min"
cfcli ratelimit pause --zone nc-demo.cf --name "RL-02: API 1000/10s per IP+URI"
cfcli ratelimit pause --zone nc-demo.cf --name "RL-03: Admin 20/10min"

# === 仅回滚 Phase 5 (Bot Protection) ===
cfcli firewall pause --zone nc-demo.cf --description "Bot-02: Bot Score < 10"

# === 仅回滚 mTLS (Authenticated Origin Pulls) ===
cfcli ssl update --zone nc-demo.cf --authenticated-origin-pulls false
# 源站 Nginx: ssl_verify_client off (临时)

# === 仅回滚 Cloudflare Access (admin 锁死) ===
cfcli access pause --zone nc-demo.cf --name "admin-nc-demo-cf"
```

### 15.5 Full Rollback (Phase 1-5 全量回滚)

```bash
# 1. DNS 全部切回 Gray Cloud
cfcli dns update --zone nc-demo.cf --name www.nc-demo.cf --type A --content 203.0.113.10 --proxied false
# ... (所有 7 主机名)

# 2. 所有 Custom Rules 暂停
cfcli firewall pause-all --zone nc-demo.cf

# 3. Managed Rulesets 禁用
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "cf-managed"
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "owasp-core"
cfcli waf disable-ruleset --zone nc-demo.cf --ruleset "exposed-credentials"

# 4. Authenticated Origin Pulls 禁用 (源站配置回滚)
cfcli ssl update --zone nc-demo.cf --authenticated-origin-pulls false
# 源站 Nginx: ssl_verify_client off

# 5. Cloudflare Access 暂停
cfcli access pause --zone nc-demo.cf --name "admin-nc-demo-cf"

# 6. 验证
dig +short www.nc-demo.cf
# 应返回 203.0.113.10
curl -I https://www.nc-demo.cf
# 应直接访问源站 (无 server: cloudflare)
```

### 15.6 Validation After Rollback

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| DNS 解析 | `dig +short www.nc-demo.cf` | 返回 `203.0.113.10` |
| HTTP 访问 | `curl -I https://www.nc-demo.cf` | 200 · server: nginx (非 cloudflare) |
| 源站访问 | 浏览器访问 | 正常访问 |
| 应用功能 | 全量 UAT P0 用例 | 100% 通过 |
| 监控告警 | Grafana | 无告警 |
| 日志审计 | Nginx access log | remote_addr = 真实客户端 IP (非 CF) |

---

## 第十六章 Incident Response Plan

### 16.1 Severity Matrix

| Severity | 定义 | 响应时间 | 升级 | 示例 |
|----------|------|----------|------|------|
| **SEV-1** | 全站中断 / 数据泄露 | 5 min | CIO + CISO + CAB Chair | DNS 解析失败 / 5xx > 50% / 用户数据泄露 |
| **SEV-2** | 主要功能受损 | 15 min | CAB Chair + SRE Lead | 登录失败 / API 5xx > 10% / WAF 误判全量 |
| **SEV-3** | 次要功能受损 | 60 min | SRE Lead | 单一主机名异常 / 性能下降 |
| **SEV-4** | 性能问题 / 体验变差 | 4 hour | SRE On-call | 缓存命中率下降 / 延迟略增 |

### 16.2 Escalation Path

```
SEV-1 / SEV-2
    │
    ▼
On-call SRE (5 min 响应)
    │
    ├── 不能解决 →
    │       ▼
    │   SRE Lead + CF Platform Lead
    │       │
    │       ├── 不能解决 →
    │       │       ▼
    │       │   CAB Chair (SEV-2)
    │       │   CIO + CISO (SEV-1)
    │       │       │
    │       │       ▼
    │       │   紧急 CAB 评审 → Rollback 决策
    │       │
    │       └── 联系 Cloudflare TAM (Enterprise 支持)
    │
    └── 自动 Rollback (15.5 Full Rollback)
```

### 16.3 Bridge Call Process

| 阶段 | 时间 | 主持人 | 参与者 | 内容 |
|------|------|--------|--------|------|
| 启动 | T+0 | On-call SRE | SRE + CF Platform | 现状评估 |
| 评估 | T+5 | SRE Lead | + 应用架构 + 网络运维 | 根因分析 + Rollback 决策 |
| 决策 | T+15 | CAB Chair | + CIO/CISO (SEV-1) | Go/No-Go Rollback |
| 执行 | T+20 | CF Platform | 全员 | 执行 Rollback |
| 验证 | T+35 | SRE Lead | 全员 | 验证服务恢复 |
| 复盘 | T+72 | CAB Chair | 全员 + TAM | Post-mortem |

### 16.4 Communication Plan

| 受众 | 渠道 | 内容 | 频率 |
|------|------|------|------|
| CAB 委员会 | Slack #cab-nc-demo-cf | 事件简报 | 每 30 min |
| 全公司 | Email / 公告 | 服务中断通知 | 启动 + 恢复 |
| 第三方合作伙伴 | Email / 电话 | API/Webhook 影响 | 启动 + 恢复 |
| 客户 | 公告页 (status.nc-demo.cf) | 服务状态 | 每 1 hour |
| Cloudflare TAM | Enterprise Support | 事件详情 + 处置 | 启动 + 恢复 |

**通知模板：**

```
[SEV-X] nc-demo.cf Incident · {YYYY-MM-DD HH:MM}

影响范围: {受影响主机名}
开始时间: {时间}
当前状态: {调查中 / 已回滚 / 已恢复}
影响用户: {数量 / 百分比}
当前措施: {正在执行的处置}
预计恢复: {ETA 或 Unknown}
下次更新: {时间}

联系人: {On-call SRE}
Bridge: {Zoom URL}
```

---

## 第十七章 Success Criteria

### Technical Success Criteria

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| DNS Proxied 切换 | 7 主机名 100% Proxied | `dig` 验证 |
| SSL Mode Full (Strict) | 启用且源站验证成功 | `openssl s_client` |
| mTLS (Authenticated Origin Pulls) | 启用 · 直接访问源站 IP 失败 | `curl` 验证 |
| WAF Block 模式 | CF Managed + OWASP CRS Block | WAF Analytics |
| Rate Limiting 触发 | 暴力破解 100 次触发 Challenge | UAT 3.x |
| Managed Challenge | Bot Score < 30 触发 | UAT 4.x |
| Bot Management | Verified Bots Allow + Malicious Block | UAT 5.x |
| 真实 IP 还原 | 100% 日志含 CF-Connecting-IP | Nginx access log |
| 灾备切换 | HK1 下线 → LB 自动切 SG1 < 30s | UAT DR-01 |
| 5xx 错误率 | < 0.1% | Cloudflare Analytics (24h) |

### Business Success Criteria

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 业务功能完整 | 47 UAT 用例 100% 通过 | UAT 报告 |
| 用户无感知 | 客户投诉 < 5 单 | 客服系统 |
| 第三方对接正常 | 8 家 Webhook 全部正常 | 第三方确认 |
| 性能提升 | TTFB P95 < 200ms | Cloudflare Analytics |
| SLA | 99.99% (28 天观察期) | SLA 报告 |

### Security Success Criteria

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 源站 IP 隐藏 | `dig` 不返回源站 IP | DNS 验证 |
| DDoS 防护 | 模拟攻击期间 RPS 下降 < 5% | 攻击演练 |
| OWASP Top 10 防护 | 渗透测试 0 高危 | 第三方渗透报告 |
| 真实 IP 审计 | 100% 审计日志含真实 IP | SIEM 对账 |
| 合规 | 等保 2.0 三级 / PCI-DSS v4.0 通过 | 合规审计 |
| Bot 防护 | Bot Score < 10 全部 Block | Bot Analytics |

---

## 第十八章 Operational Handover

### Runbook

| Runbook | 内容 | 存放路径 |
|---------|------|----------|
| RB-01 日常运维 | 监控检查 / 日志查询 / 规则调整 | `runbooks/RB-01-daily.md` |
| RB-02 WAF 规则调整 | 添加 / 修改 / 暂停 Custom Rules | `runbooks/RB-02-waf.md` |
| RB-03 Rate Limit 调整 | 阈值调整 / 暂停 | `runbooks/RB-03-ratelimit.md` |
| RB-04 证书续期 | Universal SSL / Origin CA | `runbooks/RB-04-cert.md` |
| RB-05 灾备切换 | LB Pool 切换 / 故障转移 | `runbooks/RB-05-dr.md` |
| RB-06 紧急回滚 | DNS / Rule / Full Rollback | `runbooks/RB-06-rollback.md` |
| RB-07 事件响应 | SEV 分级 / Bridge / 沟通 | `runbooks/RB-07-incident.md` |

### Monitoring Ownership

| 监控项 | 负责团队 | 工具 | 上报 |
|--------|----------|------|------|
| Cloudflare Analytics | CF Platform | Cloudflare Dashboard | Slack #cf-alerts |
| WAF / Bot / Rate Limit | CF Platform | WAF Analytics | PagerDuty |
| Origin Server (CPU/Mem) | SRE | Prometheus + Grafana | PagerDuty |
| Nginx (RPS/5xx) | SRE | Prometheus + Grafana | PagerDuty |
| Application (订单/登录) | App Owner | ELK + APM | PagerDuty |
| Logpush → SIEM | SecOps | ELK / Splunk | SecOps Dashboard |
| DNS / TLS 证书 | CF Platform | Cloudflare + UptimeRobot | PagerDuty |

### Support Contacts

| 角色 | 姓名 | 联系方式 | 工作时间 | 紧急 |
|------|------|----------|----------|------|
| CF Platform Lead | _____ | Slack + Phone | 9-18 | 24x7 |
| SRE Lead | _____ | Slack + PagerDuty | 9-18 | 24x7 |
| Application Owner | _____ | Slack + Email | 9-18 | 24x7 |
| Network Operations | _____ | Slack + Phone | 9-18 | 24x7 |
| Security (CISO) | _____ | Slack + Phone | 9-18 | 24x7 |
| Cloudflare TAM | _____ | Email + Portal | Business | Enterprise Support |
| Change Manager | _____ | Slack + Email | 9-18 | - |

### Documentation Repository

| 文档 | 位置 | 负责人 |
|------|------|--------|
| CAB Handbook (本文件) | `cloudflare-cli/docs/CAB_NC_DEMO_CF.md` | CF Platform |
| Command Guide | `cloudflare-cli/docs/COMMAND_GUIDE.md` | CF Platform |
| Request Flow Guide | `cloudflare-cli/docs/REQUEST_FLOW_GUIDE.md` | CF Platform |
| SSL/TLS Guide | `cloudflare-cli/docs/SSL_TLS_GUIDE.md` | CF Platform |
| FAQ | `cloudflare-cli/docs/FAQ_COMPLETE.md` | CF Platform |
| Runbooks | `cloudflare-cli/runbooks/` | SRE |
| Nginx 配置 | `cloudflare-cli/configs/origin/nginx-nc-demo.conf` | SRE |
| WAF 规则导出 | `cloudflare-cli/configs/waf/nc-demo-cf-rules.json` | CF Platform |
| UAT Evidence | `cloudflare-cli/uat-evidence/` | SRE + App Owner |

---

## 第十九章 CAB Approval Package

### Risk Summary

| Risk ID | Rating | 状态 |
|---------|--------|------|
| R-01 真实 IP 丢失 | 25 | ✅ 已缓解 (Nginx set_real_ip_from) |
| R-02 IE 11 兼容 | 16 | ✅ 已缓解 (Skip 规则) |
| R-03 API WAF 误判 | 16 | ✅ 已缓解 (Skip Managed Rulesets) |
| R-04 SAML WAF 误判 | 15 | ✅ 已缓解 (Skip Managed Rulesets) |
| R-05 Webhook Challenge | 15 | ✅ 已缓解 (Skip Challenge) |
| R-06 SSL Full (Strict) | 15 | ✅ 已缓解 (Origin CA 部署) |
| R-07 WebSocket | 9 | ✅ 已缓解 (Cache Bypass) |
| R-08 文件上传 | 8 | ✅ 已缓解 (Ent Max 500MB) |
| R-09 动态缓存 | 10 | ✅ 已缓解 (默认 Bypass) |
| R-10 DNS TTL | 9 | ✅ 已缓解 (TTL 300s) |
| R-11 mTLS 配置错误 | 10 | ✅ 已缓解 (UAT 灰度) |
| R-12 Access 锁死 | 10 | ✅ 已缓解 (Break-glass) |

**所有 ≥ 15 分风险已缓解并通过 UAT 验证。**

### Change Summary

| 项 | 内容 |
|----|------|
| **变更范围** | `nc-demo.cf` Zone · 7 主机名 Proxied Mode |
| **Cloudflare 功能** | DNS + Universal SSL + Advanced DDoS + WAF + Rate Limiting + Managed Challenge + Bot Management + Authenticated Origin Pulls + Load Balancer + Cache + Cloudflare Access |
| **源站改造** | Nginx 配置 (set_real_ip_from + mTLS + CF IP Allowlist) |
| **应用层改造** | 0 行 (零改造) |
| **实施周期** | 5 阶段 · 每阶段 1 周观察 · 总计 5-6 周 |
| **维护窗口** | 2026-08-23 02:00 – 06:00 (Phase 1) |
| **回滚预案** | 3 级 (DNS / Rule / Full) + 决策树 |

### Testing Summary

| 测试类型 | 用例数 | 通过 | 失败 | 状态 |
|----------|--------|------|------|------|
| Authentication | 9 | 9 | 0 | ✅ |
| API | 8 | 8 | 0 | ✅ |
| Upload | 5 | 5 | 0 | ✅ |
| SSO | 4 | 4 | 0 | ✅ |
| Payment | 3 | 3 | 0 | ✅ |
| WebSocket | 4 | 4 | 0 | ✅ |
| Compatibility | 5 | 5 | 0 | ✅ |
| Security | 8 | 8 | 0 | ✅ |
| Real IP | 3 | 3 | 0 | ✅ |
| Disaster Recovery | 3 | 3 | 0 | ✅ |
| **总计** | **47** | **47** | **0** | ✅ 100% Pass |

### Rollback Summary

| Rollback 类型 | 执行时间 | 影响 | 验证 |
|---------------|----------|------|------|
| DNS Rollback (Phase 1) | < 5 min (TTL 300s) | 短暂中断 | `dig` 返回源站 IP |
| Rule Rollback (Phase 2-5) | < 1 min | 无中断 | Cloudflare Analytics |
| Full Rollback | < 10 min | 短暂中断 | 全量 UAT |

### Executive Recommendation

**建议 CAB 批准本变更 Go-Live。**

理由：
1. 所有 ≥ 15 分风险已缓解并通过 UAT 验证。
2. 47 个 UAT 用例 100% 通过 (含 34 个 P0 用例)。
3. 3 级回滚预案完备，回滚时间 < 10 min。
4. 预期收益显著：源站 IP 隐藏 + DDoS 防护 + WAF + 真实 IP 还原 + 合规满足。
5. 应用层零改造，业务风险低。
6. Cloudflare Enterprise Plan + TAM 支持。

**条件：**
- Phase 1 必须在维护窗口 (02:00 – 06:00) 执行。
- Phase 2-5 每阶段 ≥ 1 周观察期。
- 监控告警必须 Go-Live 前就位。

---

## 第二十章 Appendices

### A. Cloudflare IP Range

**IPv4：**
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

**IPv6：**
```
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32
```

**更新地址**：https://www.cloudflare.com/ips/

### B. Nginx Configuration

见第九章 9.3 节完整 Nginx 配置。

文件存放：`cloudflare-cli/configs/origin/nginx-nc-demo.conf`

### C. IIS Configuration (如适用)

```xml
<!-- web.config -->
<system.webServer>
  <rewrite>
    <rules>
      <rule name="Force HTTPS" stopProcessing="true">
        <match url=".*" />
        <conditions>
          <add input="{HTTPS}" pattern="off" />
        </conditions>
        <action type="Redirect" url="https://{HTTP_HOST}/{R:0}" redirectType="Permanent" />
      </rule>
    </rules>
  </rewrite>
</system.webServer>

<!-- IIS Real IP Module (需安装) -->
<!-- https://www.iis.net/downloads/microsoft/application-request-routing -->
```

### D. WAF Rule Export

```bash
# === 导出所有 Custom Rules ===
cfcli firewall list --zone nc-demo.cf --output json > configs/waf/nc-demo-cf-custom-rules.json

# === 导出 Managed Rulesets 配置 ===
cfcli waf list-rulesets --zone nc-demo.cf --output json > configs/waf/nc-demo-cf-managed-rulesets.json

# === 导出 Rate Limiting Rules ===
cfcli ratelimit list --zone nc-demo.cf --output json > configs/waf/nc-demo-cf-ratelimit.json

# === 导出账户级 Rules Lists ===
cfcli ip-lists list --output json > configs/waf/nc-demo-cf-lists.json
```

### E. UAT Test Result

| TC ID | 测试场景 | 结果 | 执行人 | 执行时间 | 证据 |
|-------|----------|------|--------|----------|------|
| AUTH-01 | 正常登录 (Chrome) | ✅ Pass | _____ | 2026-08-22 | har/AUTH-01_chrome.har |
| AUTH-02 | 正常登录 (IE 11) | ✅ Pass | _____ | 2026-08-22 | har/AUTH-02_ie11.har |
| ... | ... | ... | ... | ... | ... |
| DR-03 | HK1 + SG1 全部下线 | ✅ Pass | _____ | 2026-08-22 | screenshots/DR-03.png |

**完整 UAT 报告**：`uat-evidence/UAT_REPORT_20260822.md`

### F. CAB Sign-off Sheet

| Role | Name | Signature | Date | Decision |
|------|------|-----------|------|----------|
| CAB Chair | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| CISO | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| CIO | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| Application Owner | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| Network Operations Lead | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| SRE Lead | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |
| Change Manager | _____ | _____ | 2026-08-22 | ☐ Approve ☐ Reject |

**变更决议：**
- ☐ Approve (Go-Live 2026-08-23 02:00 Asia/Shanghai)
- ☐ Approve with Conditions (条件：______________)
- ☐ Reject (原因：______________)
- ☐ Defer (重新评审日期：______________)

**CAB Chair 签字**：________________  **日期**：2026-08-22

---

# 衍生场景 (Derived Scenarios for nc-demo.cf)

> 基于 `nc-demo.cf` 主体场景（Legacy App + Proxied Mode + Security Challenge），扩展 5 个针对具体行业的衍生场景。所有 Cloudflare 功能名词按 Enterprise Plan 准确表述。

## 衍生场景 1：金融行业 · 多区域 Active-Active 灾备 + 严格合规

**适用行业**：银行、证券、保险、支付

**与主体场景差异：**

| 维度 | 主体场景 (nc-demo.cf) | 衍生场景 1 (金融) |
|------|----------------------|------------------|
| 可用性 | 99.99% (HK1 + SG1 LB) | 99.999% (3 区域 Active-Active) |
| 合规 | 等保 2.0 三级 / PCI-DSS v4.0 | + 金融等保四级 + 数据不出境 |
| 数据本地化 | 无 | Data Localization Suite (流量终止在指定区域 PoP) |
| 日志合规 | Logpush → ELK | + Logpush → SIEM (合规审计 + 7 年留存) |
| 风控 | 应用层基于 IP | + Bot Management + Custom Rules (反欺诈) |

**新增 Cloudflare 功能 (Enterprise 准确名词)：**
- Data Localization Suite (数据本地化 · 流量终止在指定区域)
- Cloudflare Load Balancer (Multi-Region Active-Active + Geo Steering)
- Argo Smart Routing (智能路由 · 降延迟)
- Logpush → SIEM (合规审计)
- Workers KV (边缘 Session · 减少回源)

**关键配置：**

```bash
# === LB Geo Steering (北京用户 → 北京源站 · 上海用户 → 上海源站) ===
cfcli lb create --zone nc-demo.cf --name "fin-lb" \
  --steering geo \
  --default-pool <bj-pool-id> \
  --fallback-pool <sh-pool-id>

# === Health Checks (主动 · 5s 探测) ===
cfcli lb health-check create --zone nc-demo.cf \
  --name "fin-hc" \
  --path "/healthz" \
  --interval 5s \
  --timeout 2s \
  --retries 2

# === Data Localization Suite (数据本地化 · 不出境) ===
cfcli zone update-setting --zone nc-demo.cf --name data_localization --value CN

# === Logpush → SIEM (合规审计 · 7 年留存) ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://fin-siem/cf/nc-demo-cf/" \
  --dataset "http_requests" \
  --fields "Timestamp,ClientIP,ClientRequestURI,ClientRequestMethod,EdgeResponseStatus,WAFAction,BotScore,CFRay" \
  --frequency high \
  --retain 2555d
```

**关键风险：**
- 数据本地化配置错误 → 合规违规 → 缓解：UAT 验证 PoP 位置 + 法务审核
- 多区域 Active-Active 数据一致性 → 应用层需强一致 → 缓解：应用层分布式事务
- 金融等保四级要求 → 日志 7 年留存 → 缓解：S3 Lifecycle + WORM

**回滚要点**：Data Localization 关闭 · LB 切单区域 · Argo 禁用

---

## 衍生场景 2：机场 · 高并发票务系统 + Waiting Room 流量整形

**适用行业**：机场、航空票务、演唱会售票、秒杀电商

**与主体场景差异：**

| 维度 | 主体场景 (nc-demo.cf) | 衍生场景 2 (机场) |
|------|----------------------|------------------|
| 流量模式 | 平稳 ~10K DAU | 峰值 100K 并发 (春运 / 促销) |
| 源站压力 | 低 | 高 (库存查询 + 锁座) |
| 用户体验 | 全部放行 | 排队 (Waiting Room) |
| 缓存 | 默认 Bypass | + Cache Reserve (减回源) + Workers (边缘库存预检) |

**新增 Cloudflare 功能 (Enterprise 准确名词)：**
- Waiting Room (常态排队 · 高并发流量整形)
- Waiting Room Events (一次性秒杀事件 · 票务开抢)
- Cache Reserve (R2 持久化缓存 · 30 天)
- Workers (边缘库存预检 · 减少无效请求到源站)

**关键配置：**

```bash
# === Waiting Room (常态排队 · 春运) ===
cfcli waiting-room create --zone nc-demo.cf \
  --name "spring-festival" \
  --host "www.nc-demo.cf" \
  --path "/buy" \
  --total-active-users 5000 \
  --session-duration 10 \
  --queue-all true \
  --queueing-method fifo

# === Waiting Room Events (秒杀 · 单次事件) ===
cfcli waiting-room event create --zone nc-demo.cf \
  --name "promo-2026-1111" \
  --room-id <room-id> \
  --start-at "2026-11-11T00:00:00+08:00" \
  --end-at "2026-11-11T23:59:59+08:00" \
  --total-active-users 10000

# === Cache Reserve (减少回源) ===
cfcli cache update --zone nc-demo.cf --cache-reserve true

# === Workers (边缘库存预检 · 减少无效请求到源站) ===
cfcli workers deploy inventory-check.js
# Workers 拦截 /api/v1/inventory 请求 · 先查 Workers KV 缓存 · 未命中才回源
```

**关键风险：**
- Waiting Room 阈值过低 → 正常用户被排队 → 缓解：UAT 压测 + 动态调整
- 库存超卖 (Workers 缓存与源站不一致) → 缓解：Workers 仅预检 · 最终扣减在源站
- 秒杀流量冲击 → 源站雪崩 → 缓解：Waiting Room Events + LB + 源站限流兜底

**回滚要点**：Waiting Room 关闭 · Cache Reserve 关闭 · Workers 路由回退

---

## 衍生场景 3：政府 · 全民服务高可用 + 数据主权

**适用行业**：电子政务、社保、税务、公共服务

**与主体场景差异：**

| 维度 | 主体场景 (nc-demo.cf) | 衍生场景 3 (政府) |
|------|----------------------|------------------|
| 用户规模 | 10K DAU | 全民 (亿级) |
| 可用性要求 | 99.99% | 99.999% (5 个 9) |
| 数据主权 | 无 | 严格 (数据不出境) |
| 内部系统 | Cloudflare Access (admin) | + Cloudflare Access (全员公务员) |

**新增 Cloudflare 功能 (Enterprise 准确名词)：**
- Data Localization Suite (数据本地化 · 流量终止在中国 PoP)
- Multi-Region LB + Health Checks (99.999% 可用性)
- Workers KV (边缘状态 · 减少 Session 回源)
- Cloudflare Access (Zero Trust · 公务员内部系统)
- Page Shield (防前端 JS 劫持 · 防篡改)
- Bot Management (防爬虫 / 防机器人抢号)

**关键配置：**

```bash
# === Data Localization (流量终止在中国 PoP · 数据不出境) ===
cfcli zone update-setting --zone nc-demo.cf --name data_localization --value CN

# === Multi-Region LB (5 个 9) ===
cfcli lb create --zone nc-demo.cf --name "gov-lb" \
  --steering dynamic \
  --default-pool <cn-bj-pool> \
  --fallback-pool <cn-sh-pool> \
  --session-affinity cookie

# === Workers KV (边缘 Session) ===
cfcli kv create-namespace --name "gov-session"
cfcli workers deploy session-edge.js

# === Cloudflare Access (公务员内部) ===
cfcli access create-policy --zone nc-demo.cf \
  --name "gov-internal" \
  --action allow \
  --emails "official@gov.cn"

# === Bot Management (防抢号) ===
cfcli firewall add --zone nc-demo.cf \
  --description "Block Bot Score < 20 on Registration" \
  --action block \
  --filter '(http.request.uri.path eq "/register") and (cf.bot_management.score lt 20)'

# === Page Shield (防篡改) ===
cfcli zone update-setting --zone nc-demo.cf --name page_shield --value block
```

**关键风险：**
- 数据本地化配置错误 → 合规违规 → 缓解：UAT 验证 PoP 位置 + 法务审核
- 国密算法不支持 → 部分政务系统接入失败 → 缓解：Cloudflare 国密支持评估 (需联系 TAM)
- 99.999% 可用性挑战 → 缓解：Multi-Region LB + 故障转移 + 监控

**回滚要点**：Data Localization 关闭 · LB 切单区域 · Access 策略禁用

---

## 衍生场景 4：关键基础设施 · OT/ICS 系统 + Spectrum

**适用行业**：电力、水务、油气、制造业 OT、SCADA

**与主体场景差异：**

| 维度 | 主体场景 (nc-demo.cf) | 衍生场景 4 (OT) |
|------|----------------------|----------------|
| 协议 | HTTP/HTTPS | + TCP/UDP (Modbus / OPC UA / DNP3) |
| 防护范围 | Web 应用 | + OT 网络 (L3/L4) |
| 合规 | 等保 2.0 | + 关键信息基础设施保护条例 |
| 暴露面 | Web 源站 | + OT 设备 (历史直接暴露) |

**新增 Cloudflare 功能 (Enterprise 准确名词)：**
- Spectrum (L4 反向代理 · TCP/UDP 应用 DDoS 防护)
- Magic Transit (L3/L4 DDoS · BGP 通告 IP 段)
- Cloudflare Tunnel (反向隧道 · OT 设备不暴露公网 IP)
- Cloudflare Access (Zero Trust · OT 运维访问)
- WAF Custom Rules (针对 OT 协议特征)
- Bot Management (OT 自动化设备指纹)

**关键配置：**

```bash
# === Spectrum (Modbus TCP 502 端口 · L4 代理) ===
cfcli spectrum create --zone nc-demo.cf \
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
cfcli tunnel route --id <tunnel-id> --hostname scada.nc-demo.cf

# === Access (OT 运维 Zero Trust) ===
cfcli access create-policy --zone nc-demo.cf \
  --name "ot-operator" \
  --action allow \
  --emails "operator@nc-services.com"

# === WAF Custom Rules (OT 协议异常检测) ===
cfcli firewall add --zone nc-demo.cf \
  --description "Block anomalous Modbus payload" \
  --action block \
  --filter '(http.request.uri.path eq "/modbus") and (http.request.body contains "write_multiple")'
```

**关键风险：**
- Spectrum 延迟 > OT 协议容忍 → SCADA 超时 → 缓解：UAT 验证延迟 + Spectrum 配置优化
- Magic Transit BGP 误通告 → 流量黑洞 → 缓解：UAT 灰度 + 故障转移预案
- OT 设备国密/特殊协议不兼容 → 缓解：Tunnel 反向连接绕过

**回滚要点**：Spectrum 关闭 · Magic Transit BGP 撤销 · Tunnel 断开

---

## 衍生场景 5：SaaS 多租户 + API Shield + Zero Trust

**适用行业**：B2B SaaS、ERP SaaS、CRM SaaS、低代码平台

**与主体场景差异：**

| 维度 | 主体场景 (nc-demo.cf) | 衍生场景 5 (SaaS) |
|------|----------------------|------------------|
| 用户模型 | 单租户 | 多租户 (Tenant 隔离) |
| API 流量占比 | 30% | 80% (机器到机器) |
| 认证 | 表单 + SSO | + API Key + JWT + mTLS |
| 防护重点 | Web 攻击 | + API 滥用 + 数据越权 |

**新增 Cloudflare 功能 (Enterprise 准确名词)：**
- API Shield (API 防护 · Schema Validation + JWT Validation + mTLS Client Cert)
- API Discovery (自动发现 API 端点)
- API Sequence Analytics (API 调用序列分析 · 防越权)
- Cloudflare Access (Zero Trust · SaaS 客户内部用户)
- Workers (边缘多租户路由)
- Workers KV (租户配置缓存)
- Account-level Rules Lists (跨租户 IP/ASN 黑名单)

**关键配置：**

```bash
# === API Shield - Schema Validation (OpenAPI) ===
cfcli api-shield upload-schema --zone nc-demo.cf --file openapi.yaml
cfcli api-shield validate-schema --zone nc-demo.cf --enable true --action block

# === API Shield - JWT Validation ===
cfcli api-shield jwt-validation --zone nc-demo.cf \
  --jwks-url "https://auth.nc-demo.cf/.well-known/jwks.json" --enable true

# === API Shield - mTLS Client Cert (机器到机器) ===
cfcli api-shield mtls --zone nc-demo.cf --enable true --ca-cert <ca-id>

# === API Discovery (自动发现) ===
cfcli api-shield discovery --zone nc-demo.cf --enable true

# === Multi-Tenant Routing (Workers) ===
cfcli workers deploy tenant-router.js
# Workers 根据 Host Header 路由到不同租户源站

# === Account-level Rules Lists (跨租户黑名单) ===
cfcli ip-lists create --name "global-blocklist" --kind ip --description "跨租户共享封禁"
cfcli firewall account-access block --target <malicious-ip> --type ip --mode block --notes "跨租户封禁"

# === Zero Trust Access (SaaS 客户内部用户) ===
cfcli access create-policy --zone nc-demo.cf \
  --name "tenant-admin" \
  --action allow \
  --emails "admin@tenant-a.com"
```

**关键风险：**
- API Schema Validation 误判 → 正常 API 调用被 Block → 缓解：Log Only 1 周后转 Block
- mTLS Client Cert 配置错误 → 全部 API 失败 → 缓解：UAT 灰度 + 证书备份
- 多租户路由错误 → 数据越权 (严重) → 缓解：UAT 多租户隔离测试
- API Discovery 漏发现 → 影子 API 暴露 → 缓解：定期 Discovery + 人工核对

**回滚要点**：API Shield Schema Validation 禁用 · JWT Validation 禁用 · mTLS 禁用 · Workers 路由回退

---

# 全景洞察链路图 (End-to-End Insight Map for nc-demo.cf)

> 本章基于本 CAB 主体场景与 5 个衍生场景，提供 3 张全景链路图：① nc-demo.cf 企业级完整请求流水线（含每个 Cloudflare 功能名与执行顺序）② 安全决策树（每个节点的判定与动作）③ 责任分层（Cloudflare / 源站 / 应用 各自负责的安全边界）。所有功能名词按 Enterprise Plan 准确表述。

## 一、nc-demo.cf 企业级完整请求流水线

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│              nc-demo.cf 企业级完整请求流水线 (Enterprise End-to-End Pipeline)              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

  访客 (Browser / API Client / Bot)
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ① Cloudflare DNS (Anycast 权威 · 全球 300+ PoP)                                         │
│   · nc-demo.cf NS 在 Cloudflare (Full Setup)                                             │
│   · 返回 Anycast IP (104.x / 172.x)                                                       │
│   · DNSSEC = on (防 DNS 劫持)                                                              │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ② TCP / QUIC 握手 (传输层)                                                              │
│   · HTTP/3 (QUIC) · HTTP/2                                                              │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ③ TLS 握手 (加密层)                                                                     │
│   · Universal SSL (边缘 · nc-demo.cf 证书)                                               │
│   · Min TLS 1.2 · TLS 1.3 on · 0-RTT off                                                │
│   · HSTS: max-age=31536000; includeSubDomains; preload                                  │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ④ Advanced DDoS Protection (始终开启 · Enterprise 增强)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  L3/L4 · Network-layer DDoS Protection                                             │ │
│  │  · SYN Flood / UDP Amplification / ICMP Flood                                      │ │
│  │  · Anycast 吸收 + 边缘丢包                                                          │ │
│  │  · Ent 增强: Adaptive DDoS / 灵敏度可调 / Magic Transit                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  L7 · HTTP DDoS Protection                                                         │ │
│  │  · HTTP Flood / Slowloris / Slow Body / Slow Read                                  │ │
│  │  · 指纹检测 → Block / Challenge / Rate Limit                                        │ │
│  │  · Ent 增强: HTTP DDoS Managed Ruleset Override                                     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑤ Bot Management (Enterprise · 独占)                                                    │
│   · Bot Score (ML 模型 1-99) + JA3/JA4 指纹 + HTTP/2 指纹                                 │
│   · Verified Bots 白名单自动放行 (Google/Bing)                                           │
│   · Bot Analytics 全量请求可视化                                                         │
│   · 处置: Allow / Block / Managed Challenge / JS Challenge                               │
│   · nc-demo.cf 实际配置:                                                                 │
│     · Bot-01: Verified Bots Allow                                                       │
│     · Bot-02: Bot Score < 10 → Block                                                    │
│     · MC-01: Bot Score < 30 → Managed Challenge                                         │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑥ Web Application Firewall (WAF · Ruleset Engine)                                       │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  a. Account-level Access Rules (跨 zone · Enterprise)                              │ │
│  │     · 应用于账户内 ALL zones (含 nc-demo.cf)                                        │ │
│  │     · CLI: cfcli firewall account-access                                           │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  b. Custom Rules (Phase: http_request_firewall_custom)                             │ │
│  │     · nc-demo.cf 实际规则:                                                          │ │
│  │       ALLOW-01: Corporate Office IP Allow                                           │ │
│  │       ALLOW-02: Monitoring IP Allow                                                 │ │
│  │       SKIP-01: api.nc-demo.cf Skip Managed                                          │ │
│  │       SKIP-02: sso.nc-demo.cf Skip Managed                                          │ │
│  │       SKIP-03: webhook.nc-demo.cf Skip Challenge                                    │ │
│  │       SKIP-04: Legacy Browser Skip Challenge                                        │ │
│  │       WAF-01: Block 高风险地理 (非 www)                                             │ │
│  │       WAF-02: Block 攻击工具 UA (sqlmap/nikto/nmap)                                 │ │
│  │     · 引用 Rules Lists: $corporate_office / $monitoring                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  c. Rate Limiting Rules (Phase: http_ratelimit)                                    │ │
│  │     · RL-01: login.nc-demo.cf/login 100/10min → Challenge                           │ │
│  │     · RL-02: api.nc-demo.cf 1000/10s per IP+URI → Block                             │ │
│  │     · RL-03: admin.nc-demo.cf 20/10min → Challenge                                  │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  d. Managed Rulesets (Phase: http_request_firewall_managed)                        │ │
│  │     · Cloudflare Managed Ruleset (虚拟补丁)                                         │ │
│  │     · Cloudflare OWASP Core Rule Set (Paranoia 1)                                   │ │
│  │     · Cloudflare Exposed Credentials Check (login.nc-demo.cf/login)                 │ │
│  │     · Page Shield (前端 JS 劫持防护)                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  e. WAF Attack Score (Enterprise · ML 评分)                                        │ │
│  │     · cf.waf.score (1-99) · cf.waf.score.sql / xss / rce                            │ │
│  │     · 可在 Custom Rules 按 score 阈值放行/挑战/拦截                                  │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑦ Waiting Room (如已配置 · Business+ · Enterprise 增强)                                │
│   · nc-demo.cf 衍生场景 2: 春运票务排队                                                  │
│   · 并发 < max_users → 放行                                                               │
│   · 并发 ≥ max_users → 排队 (CF Edge 托管)                                               │
│   · Queueing Methods: FIFO / Random / LIFO / Bypass                                      │
│   · Waiting Room Events (秒杀 · 一次性事件)                                              │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑧ Cache (Cache Rules / Smart Tiered Cache / Cache Reserve)                              │
│   · nc-demo.cf 实际配置:                                                                 │
│     · CACHE-01: static.nc-demo.cf Cache Everything (Edge TTL 1h)                        │
│     · CACHE-02: www.nc-demo.cf Bypass (动态内容)                                         │
│     · CACHE-03: /ws Bypass (WebSocket)                                                   │
│     · CACHE-04: api.nc-demo.cf Bypass                                                    │
│   · Smart Tiered Cache (Ent): 自动选择上层 PoP                                           │
│   · Cache Reserve (Ent): R2 持久化 (30 天)                                               │
│   · Polish (Pro+): 图片无损 (WebP/AVIF)                                                  │
│   · 命中: HIT → 直接返回 (跳过后续)                                                       │
│   · 未命中: MISS → 继续                                                                   │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │ (Cache MISS 时继续)
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)                       │
│   · Redirect Rules (http_request_dynamic_redirect)                                       │
│   · Transform Rules (Modify Request/Response Header/URL/Host)                            │
│   · Configuration Rules (Security Level/Browser Integrity/TLS)                           │
│   · Origin Rules (改写回源 Host/SNI/Port/Destination IP)                                 │
│   · 旧 Page Rules 已弃用 → 迁移至上述 Ruleset                                             │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑩ Cloudflare Workers (可选 · 边缘计算)                                                  │
│   · 边缘 JS 执行 · 可直接返回 (跳过源站)                                                  │
│   · Workers KV (边缘状态) · Workers R2 (对象存储)                                         │
│   · nc-demo.cf 衍生场景 2: 边缘库存预检                                                   │
│   · nc-demo.cf 衍生场景 3: 边缘 Session                                                   │
│   · nc-demo.cf 衍生场景 5: 多租户路由                                                     │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑪ Cloudflare Load Balancer (Enterprise)                                                 │
│   · nc-demo.cf 实际配置:                                                                 │
│     · LB Name: nc-demo-lb                                                               │
│     · Pools: HK1 (203.0.113.10 权重 100) + SG1 (198.51.100.10 权重 50)                   │
│     · Steering: dynamic                                                                 │
│     · Health Check: GET /healthz · 5s 间隔                                               │
│     · Session Affinity: cookie                                                          │
│     · Fallback Pool: SG1                                                                │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑫ Argo Smart Routing (Enterprise · 附加订阅)                                            │
│   · 智能路由优化 · 降低跨区域延迟                                                          │
│   · Argo Tiered Caching (上层 PoP 命中)                                                  │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑬ Authenticated Origin Pulls (mTLS · 全 Plan · 源站验证)                                │
│   · Cloudflare 向源站出示客户端证书                                                        │
│   · 源站 Nginx: ssl_verify_client on → 仅接受 CF 请求                                    │
│   · 防止源站 203.0.113.10 被绕过 CF 直接攻击                                              │
│   · 验证证书: /etc/nginx/ssl/authenticated_origin_pull_ca.pem                            │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑭ 源站连接 + 真实 IP 还原                                                                │
│   · CF-Connecting-IP Header 注入真实客户端 IP                                             │
│   · True-Client-IP Header (备用)                                                         │
│   · 源站 Nginx: set_real_ip_from <CF IP 段> + real_ip_header CF-Connecting-IP            │
│   · 源站防火墙: geo $is_cloudflare → 仅允许 CF IP                                          │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑮ 源站 (HK1: 203.0.113.10 / SG1: 198.51.100.10)                                         │
│   · Nginx 1.24 + Legacy App (127.0.0.1:8080)                                            │
│   · Origin CA 证书 (源站 TLS · 15 年有效)                                                 │
│   · 防火墙仅允许 Cloudflare IP 段                                                          │
│   · 源站限流兜底 (limit_req · login 10r/m · api 100r/s)                                  │
│   · 收到请求: remote_addr = CF IP · CF-Connecting-IP = 真实 IP                            │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ⑯ 响应处理 (Response Pipeline)                                                          │
│   · Brotli / Gzip 压缩                                                                   │
│   · Image Resizing (Ent · 动态图片尺寸)                                                   │
│   · HTTP/2 Server Push (如启用)                                                           │
│   · Transform Rules 修改 Response Header (自动添加 Secure/HttpOnly/SameSite)              │
│   · Cache Rules 写入缓存 (如可缓存)                                                       │
│   · Logpush → SIEM (Cloudflare Logs · 合规审计 · ELK 索引 cf-nc-demo-*)                   │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │
                                                           ▼
                                                       返回访客
```

**nc-demo.cf 节点速查表 (Cloudflare Enterprise 准确名词)：**

| # | 节点 | Cloudflare 功能名 (Enterprise) | nc-demo.cf 实际配置 | Phase / 位置 | 可跳过 |
|---|------|-------------------------------|---------------------|--------------|--------|
| ① | DNS | Cloudflare DNS (Anycast 权威) + DNSSEC | NS 在 CF · DNSSEC on | 解析层 | ❌ |
| ② | 传输层 | TCP / QUIC (HTTP/3) | HTTP/3 on | 传输层 | ❌ |
| ③ | TLS | Universal SSL | nc-demo.cf 边缘证书 | 加密层 | ❌ |
| ④ | DDoS | Advanced DDoS Protection (L3/L4 + L7) | 始终开启 | 始终开启 | ❌ |
| ⑤ | Bot | Bot Management (Bot Score + JA3/JA4) | Bot-01/02 + MC-01 | Edge · Ent 独占 | ✅ |
| ⑥ | WAF | WAF (Custom + Managed Rulesets + Rate Limiting + Attack Score) | ALLOW/SKIP/WAF/RL 规则 | Ruleset Engine | ✅ Skip |
| ⑦ | 排队 | Waiting Room / Waiting Room Events | 衍生场景 2 (春运) | Edge · 灰度 | ✅ |
| ⑧ | 缓存 | Cache Rules / Smart Tiered Cache / Cache Reserve / Polish | CACHE-01~04 + Reserve | Edge | ✅ Bypass |
| ⑨ | 改写 | Ruleset Engine (Redirect/Transform/Configuration/Origin Rules) | - | Edge | ✅ |
| ⑩ | 计算 | Cloudflare Workers + KV + R2 | 衍生场景 2/3/5 | Edge | ✅ |
| ⑪ | 分发 | Cloudflare Load Balancer + Health Checks | HK1 + SG1 Pool | Edge · Ent | ✅ |
| ⑫ | 路由 | Argo Smart Routing + Argo Tiered Caching | 衍生场景 1/3 | Edge · Ent (附加) | ✅ |
| ⑬ | mTLS | Authenticated Origin Pulls | ssl_verify_client on | 回源 | ✅ |
| ⑭ | IP 还原 | CF-Connecting-IP / True-Client-IP | set_real_ip_from | 回源 | ❌ |
| ⑮ | 源站 | Origin (HK1 + SG1 · Nginx + Legacy App + Origin CA + CF IP Allowlist) | 203.0.113.10 / 198.51.100.10 | 源站 | ❌ |
| ⑯ | 响应 | Brotli / Image Resizing / Transform Rules / Logpush | Logpush → ELK | Edge | ❌ |

---

## 二、nc-demo.cf 安全决策树 (Security Decision Tree)

> 展示每个请求在 Cloudflare Edge 的判定路径与最终动作。

```
请求到达 Cloudflare Edge (www.nc-demo.cf)
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
│ Challenge/   │  │   · Verified Bot?       │
│ Rate Limit   │  │   · Bot Score < 10?     │
└──────────────┘  │   · Bot Score < 30?     │
                  └────────────┬────────────┘
                               │
                        ┌──────┴──────┐
                        │             │
                  (Verified Bot)    (其他)
                        │             │
                        ▼             ▼
                ┌──────────────┐  ┌─────────────────────────┐
                │ Allow        │  │ ⑥ WAF                   │
                │ (Bot-01)     │  │  a. Account Access Rules│
                └──────────────┘  │  b. Custom Rules        │
                                  │     · ALLOW-01/02?      │
                                  │     · SKIP-01/02/03/04? │
                                  │     · WAF-01/02/03?     │
                                  │  c. Rate Limiting       │
                                  │     · RL-01/02/03?      │
                                  │  d. Managed Rulesets    │
                                  │     · CF Managed        │
                                  │     · OWASP CRS         │
                                  │     · Exposed Creds     │
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
                                │ Challenge /  │  │  (衍生场景 2)   │
                                │ JS Challenge /│  └────────┬────────┘
                                │ Managed      │    ┌──────┴──────┐
                                │ Challenge /  │    │             │
                                │ Log / Skip   │   Yes            No
                                └──────────────┘    │             │
                                                   ▼             ▼
                                           ┌──────────────┐  ┌─────────────────┐
                                           │ 排队         │  │ ⑧ Cache         │
                                           │ (CF Edge)    │  │  HIT ?          │
                                           │ (FIFO)       │  │  · CACHE-01~04  │
                                           └──────────────┘  └────────┬────────┘
                                                                ┌──────┴──────┐
                                                                │             │
                                                               Yes            No
                                                                │             │
                                                                ▼             ▼
                                                        ┌──────────────┐  ┌─────────────────┐
                                                        │ 直接返回     │  │ ⑨ Ruleset Engine│
                                                        │ (跳过源站)   │  │ ⑩ Workers       │
                                                        │ CACHE HIT    │  │ ⑪ LB (HK1/SG1)  │
                                                        └──────────────┘  │ ⑫ Argo          │
                                                                          │ ⑬ mTLS          │
                                                                          │ ⑭ 真实 IP 还原   │
                                                                          │ ⑮ 源站 (Nginx)  │
                                                                          └────────┬────────┘
                                                                                   │
                                                                                   ▼
                                                                          ┌──────────────┐
                                                                          │ ⑯ 响应处理   │
                                                                          │ Logpush → SIEM│
                                                                          │ 返回访客     │
                                                                          └──────────────┘
```

**nc-demo.cf 关键决策点说明：**

| 决策点 | 判定依据 | 可能动作 | nc-demo.cf 实际配置 |
|--------|----------|----------|---------------------|
| ④ DDoS | 流量指纹 / 基线异常 | Block / Challenge / Rate Limit | 始终开启 |
| ⑤ Bot | Bot Score / JA3/JA4 / Verified Bot | Allow (Verified) / Block (<10) / Challenge (<30) | Bot-01/02 + MC-01 |
| ⑥a Account Access Rules | IP / ASN / Country | Block / Challenge / Allow | 跨 zone 共享 |
| ⑥b Custom Rules | wirefilter 表达式 | Allow / Skip / Block / Log | ALLOW/SKIP/WAF 共 10 条 |
| ⑥c Rate Limiting | 滑动窗口计数 | Block / Challenge | RL-01/02/03 |
| ⑥d Managed Rulesets | OWASP / CF 签名 | Block / Log / Challenge | CF Managed + OWASP + Exposed Creds |
| ⑥e Attack Score | cf.waf.score | (Custom Rules 引用) | - |
| ⑦ Waiting Room | 并发数 | 放行 / 排队 | 衍生场景 2 (春运) |
| ⑧ Cache | 缓存键匹配 | HIT 返回 / MISS 继续 | CACHE-01~04 |

---

## 三、nc-demo.cf 责任分层 (Responsibility Layering)

> 明确 Cloudflare / 源站 (HK1+SG1) / 应用 三层各自负责的安全边界。

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  nc-demo.cf 安全责任分层 (Defense in Depth)                              │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Cloudflare Edge (CF Platform Team 负责)                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · Advanced DDoS Protection (L3/L4 + L7)                                                │
│  · Bot Management (Bot Score + JA3/JA4)                                                 │
│  · WAF (Custom Rules 10 条 + Managed Rulesets + Rate Limiting Rules + Attack Score)    │
│  · Managed Challenge / JS Challenge / CAPTCHA                                           │
│  · SSL/TLS 终结 (Universal SSL)                                                         │
│  · Cache (Smart Tiered Cache / Cache Reserve / Polish)                                  │
│  · Ruleset Engine (Redirect / Transform / Configuration / Origin Rules)                 │
│  · Workers (边缘计算 · 衍生场景 2/3/5)                                                   │
│  · Load Balancer + Health Checks (HK1 + SG1)                                            │
│  · Waiting Room (衍生场景 2 春运)                                                        │
│  · Account-level Access Rules + Rules Lists ($corporate_office / $monitoring)           │
│  · Page Shield (前端 JS 劫持防护)                                                        │
│  · Logpush → SIEM (ELK 索引 cf-nc-demo-* · 合规审计)                                    │
│  · Cloudflare Access (admin.nc-demo.cf · Zero Trust)                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ (mTLS · Authenticated Origin Pulls)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Origin Infrastructure · HK1 + SG1 (SRE 负责)                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · 防火墙 Allowlist (geo $is_cloudflare · 仅允许 Cloudflare IP 段)                      │
│  · Authenticated Origin Pulls (mTLS · ssl_verify_client on · 验证 CF 证书)              │
│  · Origin CA 证书 (源站 TLS · 15 年有效)                                                │
│  · 真实客户端 IP 还原 (Nginx set_real_ip_from + CF-Connecting-IP)                       │
│  · 源站 TLS 配置 (Min TLS 1.2 · TLS 1.3 · ECDHE)                                        │
│  · 源站限流 (Nginx limit_req · login 10r/m · api 100r/s · 兜底)                         │
│  · 源站日志 (access log cloudflare 格式 → ELK)                                           │
│  · 源站监控 (Prometheus + Grafana · CPU/Mem/5xx)                                        │
│  · 源站灾备 (HK1 主 + SG1 备 · LB Pool + Health Checks)                                 │
│  · Health Check 端点 (/healthz · LB 探测)                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Application · Legacy App (App Owner 负责)                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  · 应用层认证 (表单登录 / SSO · Azure AD SAML + Google OAuth2)                          │
│  · 应用层授权 (RBAC / ABAC · 防越权)                                                    │
│  · 应用层输入校验 (防 SQLi/XSS · 与 WAF 互补)                                           │
│  · 应用层输出编码 (防 XSS)                                                              │
│  · 应用层 Session 管理 (Redis 共享 · 防 Session 固定)                                    │
│  · 应用层 CSRF Token                                                                   │
│  · 应用层敏感数据加密 (数据库 / 静态)                                                   │
│  · 应用层审计日志 (用户操作 · 合规)                                                     │
│  · 应用层业务风控 (基于 CF-Connecting-IP · 反欺诈)                                      │
│  · 应用层 API Key / JWT 验证 (与 API Shield 互补 · 衍生场景 5)                          │
│  · 应用层 HMAC 签名校验 (Webhook · webhook.nc-demo.cf)                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**nc-demo.cf 责任分层关键原则：**

1. **纵深防御 (Defense in Depth)**：每层独立可防，单层失效不导致全链路失守。
2. **职责不重叠**：CF Edge 负责"网络与应用层防护"；源站负责"基础设施与协议层"；应用负责"业务逻辑与数据层"。
3. **数据流闭环**：CF 注入 `CF-Connecting-IP` → 源站 Nginx 还原 → Legacy App 读取 → 应用审计日志含真实 IP → Logpush + access log → ELK 三方对账。
4. **回滚独立**：CF 层规则可独立 Pause (cfcli firewall pause)；源站防火墙可独立关闭 Allowlist (geo $is_cloudflare off)；应用层不受 CF 回滚影响。
5. **合规可审计**：Logpush (CF) + access log cloudflare 格式 (源站) + 审计日志 (应用) → SIEM 三方对账 (cf-ray 串联)。

**nc-demo.cf 职责边界对照表：**

| 安全控制 | Cloudflare | 源站 (HK1/SG1) | 应用 (Legacy App) |
|----------|-----------|----------------|-------------------|
| DDoS 防护 | ✅ 主 (Advanced DDoS) | ❌ | ❌ |
| Bot 防护 | ✅ 主 (Bot Management) | ❌ | ❌ |
| WAF (签名) | ✅ 主 (CF Managed + OWASP) | ❌ (兜底 limit_req) | ❌ |
| 输入校验 | ✅ (WAF) | ❌ | ✅ (业务校验) |
| SQLi/XSS | ✅ (OWASP CRS) | ❌ | ✅ (参数化查询 + 输出编码) |
| 认证 | ❌ (Access 仅 admin) | ❌ | ✅ 主 (表单 + SSO) |
| 授权 (防越权) | ❌ | ❌ | ✅ 主 (RBAC) |
| TLS 终结 | ✅ 主 (边缘 Universal SSL) | ✅ (回源 TLS · Origin CA) | ❌ |
| mTLS (源站验证) | ✅ (客户端证书) | ✅ (验证 CF 证书) | ❌ |
| 真实客户端 IP | ✅ (注入 CF-Connecting-IP) | ✅ (还原) | ✅ (读取) |
| 速率限制 | ✅ (RL-01/02/03) | ✅ (limit_req 兜底) | ❌ |
| 缓存 | ✅ 主 (CACHE-01~04) | ❌ | ❌ |
| 日志合规 | ✅ (Logpush → ELK) | ✅ (access log cloudflare) | ✅ (审计日志) |
| 灾备分发 | ✅ (LB · HK1+SG1) | ✅ (多源站) | ❌ |
| Webhook HMAC | ❌ | ❌ | ✅ 主 (应用层校验) |
| 灾备切换 | ✅ (LB + Health Checks) | ✅ (nginx stop) | ❌ |

---

## 四、nc-demo.cf 衍生场景功能矩阵

> 5 个衍生场景与本 CAB 主体场景的 Cloudflare 功能对照。

| Cloudflare 功能 (Enterprise 准确名词) | 主体场景 (nc-demo.cf) | 衍生1 金融 | 衍生2 机场 | 衍生3 政府 | 衍生4 OT | 衍生5 SaaS |
|---------------------------------------|----------------------|-----------|-----------|-----------|---------|-----------|
| Cloudflare DNS (Anycast) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Universal SSL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Advanced DDoS Protection (L3/L4 + L7) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bot Management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WAF (Custom + Managed Rulesets) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate Limiting Rules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Managed Challenge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authenticated Origin Pulls (mTLS) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cloudflare Load Balancer | ✅ (HK1+SG1) | ✅ (3 区域) | ✅ | ✅ (5 个 9) | — | ✅ |
| Health Checks | ✅ (5s) | ✅ (5s) | ✅ | ✅ | — | ✅ |
| Cache Reserve | — | — | ✅ | — | — | — |
| Smart Tiered Cache | — | ✅ | ✅ | ✅ | — | ✅ |
| Waiting Room | — | — | ✅ (春运) | — | — | — |
| Waiting Room Events | — | — | ✅ (秒杀) | — | — | — |
| Workers | — | — | ✅ (库存预检) | ✅ (Session) | — | ✅ (多租户) |
| Workers KV | — | — | — | ✅ | — | ✅ |
| Argo Smart Routing | — | ✅ | — | ✅ | — | — |
| Magic Transit | — | ✅ | — | — | ✅ | — |
| Spectrum | — | — | — | — | ✅ (Modbus) | — |
| Cloudflare Tunnel | — | — | — | — | ✅ | — |
| Cloudflare Access (Zero Trust) | ✅ (admin) | — | — | ✅ (公务员) | ✅ (OT 运维) | ✅ (租户) |
| Data Localization Suite | — | ✅ | — | ✅ | — | — |
| Page Shield | ✅ (监控) | ✅ | — | ✅ (Block) | — | ✅ |
| API Shield (Schema/JWT/mTLS) | — | — | — | — | — | ✅ |
| API Discovery | — | — | — | — | — | ✅ |
| Exposed Credentials Check | ✅ (login) | ✅ | — | — | — | — |
| WAF Attack Score | ✅ | ✅ | — | — | — | ✅ |
| Account-level Access Rules | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rules Lists (IP/ASN/Hostname/Redirect) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Logpush → SIEM | ✅ (ELK) | ✅ (7 年) | ✅ | ✅ | ✅ | ✅ |

---

## 五、nc-demo.cf CAB 闭环检查清单

> CAB 评审时，逐项确认以下检查点均已满足。

| 类别 | 检查项 | nc-demo.cf 状态 |
|------|--------|-----------------|
| **范围** | In/Out Scope 已明确 (7 主机名) | ✅ |
| **现状** | As-Is 架构图已绘制 (源站 IP 203.0.113.10 暴露) | ✅ |
| **目标** | To-Be 架构图已绘制 (CF Edge + HK1/SG1 LB) | ✅ |
| **风险** | 风险矩阵已评分 (R-01~R-12 · ≥15 分已缓解) | ✅ |
| **兼容性** | 10 项兼容风险均有 Mitigation | ✅ |
| **实施** | 5 阶段灰度计划已制定 (Phase 1-5) | ✅ |
| **配置** | DNS / SSL / Origin Nginx 配置基线已锁定 | ✅ |
| **规则** | ALLOW/SKIP/WAF/RL/MC/CACHE 规则目录已固化 (共 20+ 条) | ✅ |
| **UAT** | 47 个测试用例 (34 P0 + 13 P1) 100% 通过 | ✅ |
| **证据** | 截图 / 日志 / HAR / Network Trace 已收集 | ⏳ |
| **Go-Live** | 时间线 (T-30 至 T+240) + 验证活动已制定 | ✅ |
| **监控** | KPI (10 项) + 告警阈值 (10 项) + Dashboard 已就位 | ✅ |
| **回滚** | 3 级回滚 (DNS / 规则 / 完整) + 决策树已制定 | ✅ |
| **事件响应** | SEV 1-4 分级 + 升级路径 + Bridge Call 流程已就位 | ✅ |
| **成功标准** | 技术 / 业务 / 安全三类成功标准已定义 | ✅ |
| **运营交接** | Runbook (7 份) + 监控所有权 + 支持联系人已明确 | ✅ |
| **审批** | CAB 7 个角色签字 | ⏳ Pending |
| **衍生场景** | 5 个衍生场景已评估 (金融/机场/政府/OT/SaaS) | ✅ |
| **全景链路** | 请求流水线 + 决策树 + 责任分层已绘制 | ✅ |

---

**文档结束 · nc-demo.cf CAB v1.1 · 2026-08-17**
