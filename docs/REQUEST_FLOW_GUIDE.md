# Cloudflare 请求链路完全指南

> 本文档详细展示在不同 Cloudflare 配置下，用户访问网站的完整请求链路。

## 目录

1. [基础概念](#1-基础概念)
2. [DNS 设置类型详解](#2-dns-设置类型详解)
3. [SSL 证书类型详解](#3-ssl-证书类型详解)
4. [mTLS 详解](#4-mtls-详解)
5. [场景一：Full Proxy + Cloudflare 证书 (无 mTLS)](#5-场景一full-proxy--cloudflare-证书-无-mtls)
6. [场景二：Full Proxy + Cloudflare 证书 + mTLS](#6-场景二full-proxy--cloudflare-证书--mtls)
7. [场景三：Full Proxy + 自购买证书 ACM (无 mTLS)](#7-场景三full-proxy--自购买证书-acm-无-mtls)
8. [场景四：Full Proxy + 自购买证书 ACM + mTLS](#8-场景四full-proxy--自购买证书-acm--mtls)
9. [场景五：Partial Zone Suffix + Cloudflare 证书 (无 mTLS)](#9-场景五partial-zone-suffix--cloudflare-证书-无-mtls)
10. [场景六：Partial Zone Suffix + Cloudflare 证书 + mTLS](#10-场景六partial-zone-suffix--cloudflare-证书--mtls)
11. [场景七：Full Proxy + Load Balancer (无 mTLS)](#11-场景七full-proxy--load-balancer-无-mtls)
12. [场景八：Full Proxy + Load Balancer + mTLS](#12-场景八full-proxy--load-balancer--mtls)
13. [场景九：Full Proxy + ACM + Load Balancer (无 mTLS)](#13-场景九full-proxy--acm--load-balancer-无-mtls)
14. [场景十：Full Proxy + ACM + Load Balancer + mTLS](#14-场景十full-proxy--acm--load-balancer--mtls)
15. [特殊场景：Waiting Room 防源站过载详解](#15-特殊场景waiting-room-防源站过载详解)
16. [特殊场景：IP Lists 介入 WAF 详解](#16-特殊场景ip-lists-介入-waf-详解)
17. [账户级 Lists 与 Access Rules：跨 Zone 共享的访问控制](#17-账户级-lists-与-access-rules跨-zone-共享的访问控制)
18. [场景对比总结](#18-场景对比总结)
19. [行业衍生场景一：金融行业（多活 DR + 等保四级 + 跨境支付）](#19-行业衍生场景一金融行业多活-dr--等保四级--跨境支付)
20. [行业衍生场景二：政企行业（数据本地化 + Magic Transit + 合规）](#20-行业衍生场景二政企行业数据本地化--magic-transit--合规)
21. [行业衍生场景三：电力公司（OT/ICS + Spectrum + 关键基础设施保护）](#21-行业衍生场景三电力公司otics--spectrum--关键基础设施保护)
22. [行业衍生场景四：支付行业（PCI-DSS + API Shield + 高并发抢购）](#22-行业衍生场景四支付行业pci-dss--api-shield--高并发抢购)
23. [ACME 自动化管理 Cloudflare 证书专章](#23-acme-自动化管理-cloudflare-证书专章)
24. [行业场景对比与附录](#24-行业场景对比与附录)
25. [Cloudflare 可观测性体系：日志架构、查询路径与归档策略](#25-cloudflare-可观测性体系日志架构查询路径与归档策略)
26. [加密套件自定义与 TLS 协商深度解析](#26-加密套件自定义与-tls-协商深度解析)
27. [SSL/TLS 四种模式场景化深度对比与迁移策略](#27-ssltls-四种模式场景化深度对比与迁移策略)

---

## 1. 基础概念

### 两次 TLS 连接

```
访客浏览器 ←──[连接1: 边缘证书]──→ Cloudflare ←──[连接2: 源站证书]──→ 源站服务器
       Visitor-to-Edge              Edge-to-Origin
```

### 关键组件

| 组件 | 位置 | 作用 |
|------|------|------|
| **边缘证书** | 访客 ↔ Cloudflare | 加密访客到 Cloudflare 的流量 |
| **源站证书** | Cloudflare ↔ 源站 | 加密 Cloudflare 到源站的流量 |
| **mTLS 客户端证书** | Cloudflare 出示给源站 | 证明请求确实来自 Cloudflare |

---

## 1.5 Cloudflare Edge 请求处理流水线（核心）

> 一个 HTTP 请求从访客浏览器发出到到达源站服务器，在 Cloudflare Edge 内部会依次经过**多层安全与性能节点**。下面是完整的处理流水线，理解它有助于排查"请求被谁拦截""缓存为何没命中""Waiting Room 何时触发"等问题。

### 完整处理流水线图

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge · 请求处理流水线 (Request Pipeline)             │
└──────────────────────────────────────────────────────────────────────────────────────┘

  访客请求
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  ① Anycast DNS 解析                                               │
│  · 全球 300+ 城市的 Anycast 节点同时宣告同一 IP                    │
│  · 访客被路由到地理最近的 PoP (Point of Presence)                  │
│  · DNSSEC 验证（Full Setup 自动启用）                              │
│  · CNAME Flattening（根域名 A 记录场景）                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ② TCP / QUQIC 连接建立                                           │
│  · TCP 三次握手（传统 HTTP/2）                                     │
│  · 或 QUIC/HTTP3（基于 UDP，0-RTT 恢复）                          │
│  · 连接复用 (Connection Coalescing)                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ TLS 握手 (连接1: 访客 ↔ Cloudflare)                            │
│  · 出示边缘证书 (Universal SSL / ACM 自购 / Advanced Cert)        │
│  · TLS 1.3 优先 (0-RTT、Forward Secrecy)                         │
│  · 加密套件协商 (ECDHE + AES-GCM / ChaCha20)                     │
│  · 证书透明度 (CT) 日志嵌入                                       │
│  · OCSP Stapling（减少验证延迟）                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ④ Advanced DDoS Protection (始终开启 · Enterprise 增强缓解)       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  L3/L4 DDoS Protection (网络层/传输层 · Network-layer)       │ │
│  │  · 防御: SYN Flood / UDP Amplification / ICMP Flood          │ │
│  │  ·        NTP / DNS / Memcached Reflection Amplification     │ │
│  │  · 机制: Anycast 容量吸收 + 动态路由卸载 (BGP 取代 RTBH)      │ │
│  │  · Enterprise 增强: 流量基准学习 (Baselines Learning)         │ │
│  │  ·                  异常自动检测 → 边缘直接丢包                │ │
│  │  ·                  可调灵敏度 (high / medium / low / easing) │ │
│  │  ·                  Magic Transit (非 HTTP 协议扩展保护)      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  L7 DDoS Protection (HTTP 应用层 · Application-layer)        │ │
│  │  · 防御: HTTP Flood / Slowloris / Slow Body / Slow Read       │ │
│  │  ·        Cache-busting / Random URI / HTTP 5xx 洪泛          │ │
│  │  · 机制: 请求特征指纹 (fingerprinting) → 自动缓解              │ │
│  │  · 缓解动作: Managed Challenge / JS Challenge / CAPTCHA       │ │
│  │  ·           Block (丢包) / Rate Limit (限速)                 │ │
│  │  · Enterprise: HTTP DDoS Managed Ruleset 自定义覆盖           │ │
│  │  ·                Advanced Rules (自定义缓解策略 + 优先级)     │ │
│  │  ·                Adaptive DDoS Protection (自适应学习)        │ │
│  │  ·                L7 资源耗尽保护 (Resource Exhaustion)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑤ Bot Management (Enterprise · 旧层名 Bot Fight Mode 已弃用)     │
│  · Bot Analytics: 全量请求可视化 (机器/人工/自动化/已验证爬虫)     │
│  · Bot Management Rules (Custom Rules · bot 模块)               │
│  · 检测信号:                                                     │
│    - Bot Score (机器学习模型 · 1-99 分)                          │
│    - JA3 / JA4 指纹 (TLS ClientHello 指纹)                       │
│    - HTTP/2 指纹 (SETTINGS / PRIORITY 帧序列)                    │
│    - 启发式检测 (Header 顺序 / User-Agent / 行为模式)             │
│    - 行为分析 (请求频率 / 鼠标轨迹 / 会话模式)                    │
│  · Heuristics / ML / JA3/JA4 → 综合判定 → Bot Score              │
│  · 处置 (Action): Allow / Block / Managed Challenge / JS Challenge│
│  · 验证爬虫 (Verified Bots): Cloudflare 维护白名单自动放行        │
│  · Enterprise 独占:                                               │
│    - 自定义 Bot Score 阈值与处置组合                              │
│    - 与 WAF Custom Rules 联动 (cf.bot_management.score)          │
│    - Bot Management for API (API 流量独立评分)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑥ Web Application Firewall (WAF · 由 Ruleset Engine 驱动)        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  a. Custom Rules                                              │ │
│  │     (Phase: http_request_firewall_custom · 旧名 Firewall Rules)│ │
│  │  · wirefilter 表达式匹配 (IP/ASN/国家/URI/Header/Query/Body)   │ │
│  │  · 可引用账户级 Rules Lists:                                   │ │
│  │    - $cf.ip_list{name:"blocklist"}       (IP List)            │ │
│  │    - $cf.asn_list{name:"bad_asn"}        (ASN List)           │ │
│  │    - $cf.hostname_list{name:"allowed"}   (Hostname List)      │ │
│  │    - $cf.redirect_list{name:"old_urls"}  (Redirect List)      │ │
│  │  · 可读 cf.bot_management.score / cf.waf.score 联动判定        │ │
│  │  · 动作: Block / Challenge / JS Challenge / Managed Challenge  │ │
│  │  ·       Log / Skip (跳过后续 Ruleset · 旧名 Bypass)            │ │
│  │  · Enterprise: 自定义 Ruleset (Custom Ruleset · 跨 Phase 部署) │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  b. Managed Rulesets (Phase: http_request_firewall_managed)  │ │
│  │  · Cloudflare Managed Ruleset                                 │ │
│  │    - Cloudflare 自研签名 + 虚拟补丁 (Virtual Patching)         │ │
│  │  · Cloudflare OWASP Core Rule Set                             │ │
│  │    - SQL Injection / XSS / RFI / LFI / PHP Code Injection     │ │
│  │    - HTTP Protocol Violations / Paranoia Level 可调            │ │
│  │  · Cloudflare Exposed Credentials Check                       │ │
│  │    - 比对 POST 中的账号密码与已知泄露库 (Have I Been Pwned)     │ │
│  │  · Page Shield (Enterprise · 防Magecart/前端JS劫持)            │ │
│  │  · 每条规则可设: Block / Log / Managed Challenge / Skip        │ │
│  │  · Enterprise: 自定义规则覆盖 (Override) · Tag/ID 级别精细控制  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  c. Rate Limiting Rules (Phase: http_ratelimit)              │ │
│  · 滑动窗口 (如 100 req / 10s per IP) → 超限触发动作              │ │
│  · Enterprise 独占:                                              │ │
│  ·    - 按方法 / 响应码 / Header / 字符数精细化计数                │ │
│  ·    - Advanced Rate Limiting (按特征组合、URL 模板)             │ │
│  ·    - 旧版 Rate Limiting (Page Rules 配套) 已弃用                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  d. WAF Attack Score (Enterprise · ML 模型评分)               │ │
│  · cf.waf.score (1-99) · cf.waf.score.sql / xss / rce / ...     │ │
│  · 可在 Custom Rules 按 score 阈值放行/挑战/拦截                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  · 匹配 → Security Events (WAF 事件 · 可在 Cloudflare Logs 查看)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑦ Waiting Room (排队室 · 可选)                                    │
│  · 当并发请求超过源站承载上限时启用                                │
│  · 访客被引导到虚拟"排队室"页面 (自定义品牌)                       │
│  · 按队列顺序逐步放行到源站                                        │
│  · 排队期间源站零压力 (CF Edge 托管排队页)                         │
│  · 适用: 限时抢购、票务发售、考试报名、突发流量                     │
│  · 配置: cfcli waiting-room create --name sale --max-users 500   │
│  · 触发条件: 并发 > max_users 或源站响应时间 > timeout             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑧ Cache (边缘缓存 · Cache Reserve / Tiered Cache 等)             │
│  · 命中状态: HIT / MISS / EXPIRED / STALE / REVALIDATED          │
│  · 缓存键: URL + Query String + Vary Header (可由 Cache Rules 改)  │
│  · TTL 控制: Cache Rules / Origin Cache-Control / Edge TTL       │
│  · Tiered Cache (全 Plan 可用): 上层 PoP 缓存减少回源              │
│  · Smart Tiered Cache (Enterprise): 自动选择最优上层 PoP           │
│  · Cache Reserve (Enterprise): R2 持久化缓存层 (30 天对象保留)     │
│  · 旧 Cache Page Rules (已弃用) → 迁移至 Cache Rules / Origin Rules│
│  · Polish (Pro+): 图片无损压缩 (WebP / AVIF)                      │
│  · Mirage (Pro+): 按设备/网络自适应图片尺寸                        │
│  · 命中 → 直接返回访客 (跳过源站及后续步骤)                         │
│  · 未命中 → 继续向下游走                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (Cache MISS 时继续)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑨ Ruleset Engine · URL/Redirect/Transform/Configuration Rules    │
│  · Redirect Rules (Phase: http_request_dynamic_redirect)          │
│    - HTTP→HTTPS / 域名跳转 / 路径重写 (取代旧 Bulk Redirects 入口) │
│  · Transform Rules                                                │
│    - Modify Request Header (Phase: http_request_late_transform)   │
│    - Modify Response Header (Phase: http_response_headers_transform)│
│    - Modify URL / Host (Phase: http_request_transform)            │
│  · Configuration Rules (Phase: http_request_dynamic_config)       │
│    - 按 URL 改: Security Level / Browser Integrity Check / TLS    │
│  · Origin Rules (Phase: http_request_origin)                      │
│    - 改写回源 Host / SNI / Port / Destination IP                  │
│  · Page Rules (旧 · 已逐步迁移至上述新 Ruleset)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑩ Workers / Workers Routes (可选 · 边缘计算)                      │
│  · 在 CF Edge 运行 JavaScript/WASM 代码                           │
│  · 可拦截、修改、生成请求/响应                                     │
│  · 可直接返回响应 (不经过源站 — "Originless")                      │
│  · 可代理到第三方 API (fetch to external)                         │
│  · KV / D1 / R2 / Durable Objects 提供边缘存储                    │
│  · 适用: A/B 测试、边缘渲染、API 聚合、鉴权代理                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (需要回源时继续)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑪ Load Balancer (可选 · 如已配置)                                 │
│  · 根据策略选择 Pool:                                              │
│    - Geographic (Geo Steering)                                    │
│    - Random / Round Robin                                         │
│    - Least Connections                                            │
│    - Dynamic Steering (基于延迟)                                  │
│  · 健康检查 (Health Checks) 决定 Pool 可用性                       │
│  · 故障转移 (Failover): 主 Pool 宕机 → Fallback Pool              │
│  · Session Affinity (粘性会话): Cookie 维持后端固定                │
│  · Steering Policies (Enterprise): 按地区分配权重                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑫ Argo Smart Routing (可选 · Enterprise)                         │
│  · 智能路由: 实时分析全球网络状况，选择最优回源路径                 │
│  · Argo Tiered Caching: 多级缓存减少回源                          │
│  · 降低源站延迟 ~30%                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑬ 源站连接 (连接2: Cloudflare ↔ 源站)                            │
│  · TLS 握手 (Full Strict 模式验证源站证书)                        │
│  · mTLS (如启用 Authenticated Origin Pulls): CF 出示客户端证书    │
│  · IP 白名单 (可选): 源站仅允许 CF IP Ranges                      │
│  · Cloudflare Tunnel (可选): 源站无需公网 IP，出站隧道连接         │
│  · Proxy Protocol: 传递访客真实 IP (PROXY protocol v1/v2)        │
│  · CF-Connecting-IP Header: 传递访客原始 IP                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                      源站服务器处理请求
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑭ 响应处理 (源站 → Cloudflare → 访客)                             │
│  · CF 接收源站响应                                                 │
│  · 应用响应阶段 Transform Rules (修改 Header)                      │
│  · 缓存响应 (按 Cache-Control / Page Rules / TTL)                 │
│  · 压缩: Brotli / Gzip (自动协商)                                 │
│  · Image Resizing (Enterprise): 自动调整图片尺寸/格式              │
│  · HTTP/2 Server Push (如配置)                                    │
│  · 通过连接1 (TLS) 返回访客浏览器                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 处理节点顺序速查表

| 顺序 | 节点 | Cloudflare 功能名 | 计划要求 | 可否跳过 | 典型拦截场景 |
|------|------|------------------|---------|---------|------------|
| ① | Anycast DNS | Cloudflare DNS (权威) | 全部 | ❌ | 域名不存在/被阻断 |
| ② | TCP/QUIC 握手 | (传输层) | 全部 | ❌ | 连接超时 |
| ③ | TLS 握手 | Universal SSL / Advanced Certificate Manager (ACM) | 全部 | ❌ | 证书过期/不受信任 |
| ④ | Advanced DDoS Protection | Advanced DDoS Protection (L3/L4 + L7) | 全部 · Ent 增强 | ❌ 始终开启 | SYN Flood / HTTP Flood / Slowloris |
| ⑤ | Bot Management | Bot Management | Enterprise | ✅ 可关闭 | 爬虫、自动化工具、凭证填充 |
| ⑥ | WAF | Web Application Firewall (Custom Rules + Managed Rulesets + Rate Limiting Rules + WAF Attack Score) | 全部 · Ent 增强 | ✅ 可设 Skip | SQL注入/XSS/自定义规则 |
| ⑦ | Waiting Room | Waiting Room / Waiting Room Events | Business+ · Ent 增强 | ✅ 可关闭 | 并发超限排队 |
| ⑧ | Cache | Cache / Cache Rules / Smart Tiered Cache / Cache Reserve / Polish | 全部 · Ent 增强 | ✅ 可设 Skip | 静态资源命中后直接返回 |
| ⑨ | Ruleset Engine | Redirect / Transform / Configuration / Origin Rules | 全部 | ✅ | URL 跳转/重写/回源改写 |
| ⑩ | Workers | Cloudflare Workers / Workers Routes | 全部 (请求量限制) | ✅ | 边缘计算/直接返回 |
| ⑪ | Load Balancer | Cloudflare Load Balancer (Pools/Steering/Health Checks) | Ent | ✅ 未配置则跳过 | Pool 选择/故障转移/会话粘性 |
| ⑫ | Argo Smart Routing | Argo Smart Routing + Argo Tiered Caching | Ent (附加订阅) | ✅ 附加服务 | 路由优化/降低回源延迟 |
| ⑬ | 源站连接 | Authenticated Origin Pulls (mTLS) / Cloudflare Tunnel | 全部（AOP 全 Plan 可用；Off/Flexible 下不生效） | ❌ (Cache HIT 时跳过) | mTLS 验证失败/IP 白名单 |
| ⑭ | 响应处理 | Brotli/Gzip · Image Resizing (Ent) · HTTP/2 Server Push | 全部 · 部分功能 Ent | ❌ | 压缩/缓存/图片优化 |

### Advanced DDoS Protection 详解

> Cloudflare DDoS Protection 的官方功能名为 **Advanced DDoS Protection**，由 **Network-layer (L3/L4) DDoS Protection** 和 **HTTP DDoS Protection (L7)** 两个 Managed Ruleset 组成。Free/Pro/Business 启用基础防护，Enterprise 解锁灵敏度调节、自定义覆盖、Adaptive DDoS、Magic Transit 等增强能力。

```
┌──────────────────────────────────────────────────────────────────────────┐
│              Advanced DDoS Protection 分层架构                             │
└──────────────────────────────────────────────────────────────────────────┘

  攻击流量                          Cloudflare 边缘                     源站
     │                                   │                              │
     │  ┌─────────────────────────┐      │                              │
     │  │  L3/L4 · Network-layer  │      │                              │
     │  │  DDoS Protection        │      │                              │
     │  │  · SYN Flood            │─────►│  Anycast 吸收 + 丢弃          │
     │  │  · UDP Amplification    │      │  (源站从不感知)               │
     │  │  · ICMP Flood           │      │                              │
     │  │  · NTP/DNS Amplification│      │  Enterprise: Baselines 学习   │
     │  │  · Memcached Reflection │      │              自适应阈值       │
     │  └─────────────────────────┘      │              灵敏度可调        │
     │                                   │              Magic Transit 扩展│
     │                                   │                              │
     │  ┌─────────────────────────┐      │                              │
     │  │  L7 · HTTP DDoS          │      │                              │
     │  │  Protection              │      │                              │
     │  │  · HTTP Flood           │─────►│  指纹检测 + Challenge         │
     │  │  · Slowloris            │      │  · JS Challenge              │
     │  │  · Slow Body / Read     │      │  · Managed Challenge          │
     │  │  · Cache-busting 攻击   │      │  · CAPTCHA                   │
     │  │  · HTTP 5xx 洪泛        │      │  · Block / Rate Limit        │
     │  └─────────────────────────┘      │  (恶意流量在 Edge 丢弃)       │
     │                                   │                              │
     │                                   │  只放行合法请求 ──────────────►│
```

**Advanced DDoS Protection 关键特性：**

| 特性 | 说明 | 计划要求 |
|------|------|---------|
| **Always-on (始终开启)** | 默认启用，无需配置，零误判策略 | 全部 |
| **Unmetered (不限流量)** | 不限流量、不限次数，不会因攻击额外计费 | 全部 |
| **Anycast 吸收** | 全球 300+ 城市的 PoP 分散吸收攻击流量 | 全部 |
| **Network-layer (L3/L4) DDoS Protection** | 网络层攻击在 Edge 直接丢包，源站无感知 | 全部 |
| **HTTP DDoS Protection (L7)** | 应用层攻击通过指纹 + Challenge 缓解 | 全部 |
| **HTTP DDoS Managed Ruleset Override** | 自定义 L7 DDoS 规则覆盖（按 URI/Header/ASN） | Ent |
| **Adaptive DDoS Protection** | 自适应学习正常流量基线，仅阻断异常 | Ent |
| **L7 资源耗尽保护 (Resource Exhaustion)** | 防止源站被低速慢攻击拖垮 | Ent |
| **Sensitivity Tuning** | 灵敏度可调 (high / medium / low / easing) | Ent |
| **Magic Transit** | L3/L4 扩展到 BGP 通告的 IP 段 (含非 HTTP 协议) | Ent (附加) |
| **Spectrum** | 非 HTTP/HTTPS 的 TCP/UDP 应用 DDoS 保护 | Ent (附加) |
| **与 Rate Limiting Rules 协同** | 配合 WAF 的 Rate Limiting Rules 精确控制 | 全部 · Ent 增强 |

### Web Application Firewall (WAF) 功能详解

> Cloudflare WAF 由 **Ruleset Engine** 统一驱动，所有功能以 **Ruleset** 形式部署到不同 **Phase**。下面按执行顺序列出所有官方 Ruleset 及其计划要求。

```
┌──────────────────────────────────────────────────────────────────────────┐
│              WAF 内部处理顺序 (Phase Order)                                │
└──────────────────────────────────────────────────────────────────────────┘

  请求进入 WAF
     │
     ├──► 1. Custom Rules (Phase: http_request_firewall_custom)
     │       · Cloudflare 自定义规则 · 旧名 Firewall Rules
     │       · wirefilter 表达式 (IP/ASN/国家/URI/Header/Query/Body/Bot Score)
     │       · 可引用账户级 Rules Lists:
     │         - IP List:        (ip.src in $cf.ip_list{name:"blocklist"})
     │         - ASN List:       (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"})
     │         - Hostname List:  (http.host in $cf.hostname_list{name:"allowed"})
     │         - Redirect List:  $cf.redirect_list{...} (配合 Bulk Redirects)
     │       · Rules Lists 优势: 单 List 可容纳 10K+ 条目，改 List 即时生效无需改规则
     │       · 动作: Block / Challenge / JS Challenge / Managed Challenge
     │              Log / Skip (Skip = 跳过后续 Ruleset · 含 Managed Rulesets)
     │
     ├──► 2. Rate Limiting Rules (Phase: http_ratelimit)
     │       · 滑动窗口计数 (如 100 req / 10s per IP)
     │       · Enterprise: 按方法 / 响应码 / Header / 字符数 / URL 模板精细化
     │       · Advanced Rate Limiting (Ent): 特征组合 (例如 IP + UA + Path)
     │       · 旧版 (Page Rules 配套) Rate Limiting 已弃用 → 迁移至本 Ruleset
     │
     ├──► 3. Managed Rulesets (Phase: http_request_firewall_managed)
     │       a) Cloudflare Managed Ruleset
     │          - Cloudflare 自研签名 (针对 0day / 已知 CVE 虚拟补丁)
     │          - 默认 Block / Log 可调
     │       b) Cloudflare OWASP Core Rule Set
     │          - SQL Injection (SQLi)
     │          - Cross-Site Scripting (XSS)
     │          - Remote File Inclusion (RFI) / Local File Inclusion (LFI)
     │          - PHP Code Injection / Session Fixation
     │          - HTTP Protocol Violations
     │          - Paranoia Level (1-4) 可调 · 越高越敏感越易误判
     │       c) Cloudflare Exposed Credentials Check
     │          - POST 表单 / API JSON 中的账号密码
     │          - 比对 Have I Been Pwned 已知泄露库 → 自动标记 + 通知
     │       d) Page Shield (Ent · 防前端 JS 劫持 / Magecart)
     │          - 检测页面加载的第三方 JS / 检测连接异常域名
     │          - 经 AI 分类为 malicious / obfuscated
     │       · 每条规则可设: Block / Log / Managed Challenge / Skip
     │       · Enterprise: Override (按 Tag / ID 覆盖默认动作与敏感度)
     │
     ├──► 4. Custom Ruleset (Enterprise · Phase 自定义)
     │       · 跨 Phase 部署的自定义 Ruleset (http_request_firewall_custom 等)
     │       · 复杂 wirefilter 表达式 + 多规则组合
     │       · 可匹配请求体 / 响应体 / 文件上传内容
     │
     ├──► 5. WAF Attack Score (Enterprise · Phase: http_request_firewall_custom)
     │       · Cloudflare ML 模型评分: cf.waf.score (1-99)
     │       · 细分: cf.waf.score.sql / xss / rce / sqli / xssi / ...
     │       · 可在 Custom Rules 按 score 阈值放行 / 挑战 / 拦截
     │       · 与 Cloudflare Managed Ruleset 互补 (ML + 签名 双引擎)
     │
     └──► 6. WAF Action (最终动作)
             · Allow (放行)
             · Block (直接拦截 · 返回 403 / 自定义 1xxx 错误页)
             · Challenge (CAPTCHA 验证 · 旧版 · 推荐用 Managed Challenge)
             · JS Challenge (浏览器执行 JS 验证)
             · Managed Challenge (CF 自动选择验证方式 · 推荐)
             · Log (仅记录不拦截)
             · Skip (跳过后续规则 · 旧名 Bypass)
```

**WAF 各 Ruleset 计划要求对照：**

| Ruleset | Phase | Free | Pro | Business | Enterprise |
|---------|-------|------|-----|----------|-----------|
| Custom Rules (5 条) | http_request_firewall_custom | ✅ | ✅ | ✅ | ✅ (无限) |
| Cloudflare Managed Ruleset | http_request_firewall_managed | ❌ | ✅ | ✅ | ✅ (Override) |
| Cloudflare OWASP Core Rule Set | http_request_firewall_managed | ❌ | ✅ | ✅ | ✅ (Paranoia 调节) |
| Cloudflare Exposed Credentials Check | http_request_firewall_managed | ❌ | ❌ | ❌ | ✅ |
| Page Shield | http_request_firewall_managed | ❌ | ❌ | ❌ | ✅ |
| Rate Limiting Rules | http_ratelimit | ❌ | 1 条 | 1 条 | ✅ (无限 + Advanced) |
| WAF Attack Score | http_request_firewall_custom | ❌ | ❌ | ❌ | ✅ |
| Custom Ruleset (跨 Phase) | 自定义 | ❌ | ❌ | ❌ | ✅ |
| WAF Custom Rules / Managed Rules Override | - | ❌ | ❌ | ❌ | ✅ |

**Enterprise 关键增强：**
- WAF Attack Score ML 引擎（签名规则无法覆盖的未知攻击模式）
- Cloudflare Exposed Credentials Check（凭证泄露检测）
- Page Shield（前端 JS 劫持防护 / Magecart）
- Managed Ruleset Override（按 Tag / ID 调整动作与敏感度）
- 无限 Custom Rules + 无限 Rate Limiting Rules + Advanced Rate Limiting
- WAF Security Events（事件聚合分析 · 与 Cloudflare Logs / Logpush 联动）
- WAF Single Rule Audit（逐规则审计 + 调试日志）

### Waiting Room 工作原理

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Waiting Room 排队机制                                   │
└──────────────────────────────────────────────────────────────────────────┘

  并发请求量
     │
     │  超过 max-users?
     │
     ├── 否 ──► 正常放行到源站 ──► 源站处理 ──► 返回响应
     │
     └── 是 ──► 进入 Waiting Room
                   │
                   ├──► 显示排队页面 (CF Edge 托管 · 不占源站资源)
                   │    · 自定义品牌 (Logo / 颜色 / 文案)
                   │    · 实时排队位置更新
                   │    · 预估等待时间
                   │
                   ├──► 源站有空位时 (有人完成请求离开)
                   │    · CF Edge 从队列头部放行 1 个访客
                   │    · 通过 Cookie 标记该访客"已通过"
                   │    · 后续请求在 session_duration 内免排队
                   │
                   └──► 超时未放行
                        · 显示超时页面或重定向
```

**Waiting Room 触发条件：**

| 条件 | 说明 |
|------|------|
| **并发数超限** | 同时活跃访客 > `max_users` (如 500) |
| **源站响应慢** | 源站响应时间 > `timeout` (如 10s) |
| **手动启用** | 管理员主动开启（限时活动前预设） |
| **Cookie 有效** | 已通过排队的访客在 `session_duration` 内免排队 |

**CLI 配置示例：**

```bash
# 创建 Waiting Room
cfcli waiting-room create \
  --name "flash-sale" \
  --host example.com \
  --path /sale \
  --total-active-users 500 \
  --session-duration 300 \
  --queue-all true \
  --disable-session-renewal false

# 查看状态
cfcli waiting-room list
cfcli waiting-room get --name "flash-sale"
```

---

## 2. DNS 设置类型详解

### Full Setup (完整设置)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Full Setup 流程                           │
└─────────────────────────────────────────────────────────────────┘

访客 → 递归解析器 → Cloudflare NS → Cloudflare Anycast IP → 源站
                   (权威 DNS)
```

**特点：**
- 使用 Cloudflare 的 NS 记录
- Cloudflare 管理所有 DNS 记录
- 支持 CNAME Flattening
- 自动 DNSSEC

### Partial Zone Suffix (CNAME 设置)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Partial (CNAME) 流程                          │
└─────────────────────────────────────────────────────────────────┘

访客 → 递归解析器 → 原 DNS 提供商 → CNAME → Cloudflare → 源站
                   (非权威)         (指向 Cloudflare)
```

**特点：**
- 保留原 DNS 提供商
- 通过 CNAME 记录指向 Cloudflare
- 每个子域名独立证书
- 不支持 CNAME Flattening

### 对比

| 特性 | Full Setup | Partial (CNAME) |
|------|-----------|-----------------|
| **NS 记录** | Cloudflare NS | 保留原 NS |
| **Universal SSL 覆盖** | 根域名 + 一级子域名 | 每个子域名独立证书 |
| **DNSSEC** | 自动支持 | 需手动配置 |
| **CNAME Flattening** | 支持 | 不支持 |
| **适用场景** | 新域名或完全迁移 | 已有 DNS 提供商 |

---

## 3. SSL 证书类型详解

### 边缘证书 (Visitor ↔ Cloudflare)

| 证书类型 | 来源 | 信任级别 | 适用场景 |
|---------|------|---------|---------|
| **Universal SSL** | Cloudflare 自动签发 | 公共信任 | 默认选择 |
| **Advanced Certificate** | Cloudflare 管理 | 公共信任 | 自定义主机名 |
| **自定义证书** | 自购买 (ACM) | 公共信任 | OV/EV 证书 |

### 源站证书 (Cloudflare ↔ Origin)

| 证书类型 | 来源 | 信任级别 | 适用场景 |
|---------|------|---------|---------|
| **Origin CA** | Cloudflare 签发 | 仅 Cloudflare 信任 | 免费，推荐 |
| **Let's Encrypt** | 公共 CA | 公共信任 | 自签名 |
| **自购买证书** | DigiCert 等 | 公共信任 | 企业级 |

### SSL 模式

| 模式 | 连接1 (访客-Edge) | 连接2 (Edge-Origin) | 说明 |
|------|-------------------|---------------------|------|
| **Off** | 无加密 | 无加密 | ❌ 不安全 |
| **Flexible** | HTTPS | HTTP | ⚠️ 源站不加密 |
| **Full** | HTTPS | HTTPS (不验证) | 源站可不使用有效证书 |
| **Full (Strict)** | HTTPS | HTTPS (验证) | ✅ 需要有效证书 |

---

## 4. mTLS 详解

### 什么是 mTLS (Mutual TLS)

mTLS (Mutual TLS / 双向 TLS 认证) 要求客户端和服务器双方互相验证对方证书。

```
┌─────────────────────────────────────────────────────────────────┐
│                        mTLS 握手过程                            │
└─────────────────────────────────────────────────────────────────┘

Cloudflare                                    Origin Server
    │                                              │
    │ ──────── Client Hello ─────────────────────► │
    │ ◄─────── Server Hello + Certificate ──────── │
    │          (源站证明自己的身份)                  │
    │                                              │
    │ ──────── Client Certificate ────────────────► │
    │          (Cloudflare 客户端证书)              │
    │          证明请求来自 Cloudflare              │
    │                                              │
    │ ◄─────── Certificate Verify ─────────────── │
    │          (源站验证客户端证书)                 │
    │                                              │
    │ ──────── Finished ─────────────────────────► │
    │ ◄─────── Finished ──────────────────────── │
    │                                              │
    │ ══════ 加密通信 (双向认证完成) ══════════════ │
```

### 有 mTLS vs 无 mTLS 对比

| 特性 | 无 mTLS | 有 mTLS |
|------|--------|--------|
| **源站验证** | Cloudflare 验证源站证书 | 双向验证 |
| **源站限制** | 任何有证书的服务器 | 仅持有有效客户端证书的 Cloudflare |
| **安全性** | 标准 | 更高 |
| **源站配置** | 只需源站证书 | 源站证书 + 验证客户端证书 |
| **IP 白名单** | 需要 (Cloudflare IP) | 不需要 |

### Authenticated Origin Pulls (AOP) 三个配置级别

> **官方文档**：[Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/) · 全 Plan 可用（Free / Pro / Business / Enterprise）· **Off / Flexible 模式下不生效**

AOP 有三个**独立**的配置级别，可同时启用，优先级从高到低：

| 级别 | 证书来源 | 适用范围 | 安全强度 | 典型场景 |
|------|---------|---------|---------|---------|
| **Per-hostname** | 自上传证书 | 特定 hostname | ★★★★★ | 仅特定接口要求账户级验证 |
| **Zone-level** | 自上传证书 | 全 Zone 所有 proxied 流量 | ★★★★ | 需保证请求来自本账户（非其他 CF 账户） |
| **Global** | Cloudflare 提供的共享证书 | 全 Zone 所有 proxied 流量 | ★★★ | 仅验证请求来自 CF 网络（最简配置） |

**优先级规则**：Per-hostname > Zone-level > Global。启用/禁用任一级别不影响其他级别。

**FIPS 合规**：需使用自上传证书（Zone-level 或 Per-hostname），Global 证书不满足 FIPS 要求。

**后量子证书**：Zone-level 和 Per-hostname 支持 ML-DSA (FIPS 204) 后量子客户端证书。

### 源站 Nginx 配置 (mTLS)

```nginx
server {
    listen 443 ssl http2;
    server_name origin.example.com;

    # 源站证书
    ssl_certificate /path/to/origin_ca.pem;
    ssl_certificate_key /path/to/origin_ca.key;

    # mTLS 配置
    ssl_client_certificate /path/to/cloudflare_ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location / {
        proxy_pass http://backend;
    }
}
```

---

## 5. 场景一：Full Proxy + Cloudflare 证书 (无 mTLS)

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | Universal SSL (Cloudflare 自动签发) |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ❌ 未启用 |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为单 Zone + 单源站最简链路。账户级 Lists（Account Access Rules / Rules Lists）是**可选叠加项**，分两种情况：

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 请求经 Advanced DDoS Protection → Bot Management → **WAF Custom Rules（仅 zone 级）**→ WAF Managed Rulesets → Cache → 源站 |
| 跨 Zone 复用 | ❌ 每个 zone 独立维护 IP/ASN 黑名单 |
| 适用 | 单业务线、单域名、IP 封禁规模 < 100 条 |
| CLI 命令 | 无需账户级命令，仅用 `cfcli firewall add` (zone 级) |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 请求经 Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② zone 级 Access Rules → ③ WAF Custom Rules (引用账户级 Rules Lists)** → WAF Managed Rulesets → Cache → 源站 |
| 跨 Zone 复用 | ✅ 同一账户内多 zone 共享一个 IP/ASN/Hostname/Redirect List |
| 适用 | 多业务线/多域名统一管控、IP 封禁规模 ≥ 1000 条、需 ASN/Hostname 级匹配 |
| 流水线位置 | **在 zone 级 Access Rules 之前**执行（账户级先于 zone 级） |
| CLI 示例 | 见下方"账户级 Lists CLI 配置" |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List (跨 zone 共享) ===
cfcli ip-lists create --name "blocklist" --kind ip --description "场景一·账户级封禁清单"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24 --comment "威胁情报"

# === 2. 在 WAF Custom Rules 中引用 (本 zone) ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist"}) → Block

# === 3. 创建账户级 Access Rule (直接生效 · 无需表达式) ===
cfcli firewall account-access block \
  --target AS12345 \
  --type asn \
  --mode block \
  --notes "场景一·恶意 ASN 全账户封禁"

# === 4. 验证 ===
cfcli ip-lists list
cfcli firewall account-access list
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    场景一：Full Proxy + Cloudflare 证书 (无 mTLS)                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析                                                         │          │
│  访客    │  (Cloudflare Anycast IP)                                            │  源站    │
│  浏览器  │ ──────────────────────────────────────────────────────────────────► │  服务器  │
│          │                                                                    │          │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: Universal SSL        │  │           │
     │                            │  │ (Cloudflare 自动签发 · 公共 CA)│  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  │   (始终开启 · L3/L4 + L7)       │  │           │
     │                            │  │ · L3/L4: Anycast 吸收 + 丢包   │  │           │
     │                            │  │ · L7: 指纹检测 + Challenge     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  │ · Bot Score + JA3/JA4 指纹     │  │           │
     │                            │  │ · 已知恶意爬虫 → Block         │  │           │
     │                            │  │ · 可疑流量 → JS Challenge      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF (Ruleset Engine)        │  │           │
     │                            │  │ a. Custom Rules                │  │           │
     │                            │  │   · 可引用 Rules Lists 数据源: │  │           │
     │                            │  │     (ip.src in $cf.ip_list    │  │           │
     │                            │  │      {name:"blocklist"})      │  │           │
     │                            │  │ b. Cloudflare Managed Ruleset │  │           │
     │                            │  │ c. OWASP Core Rule Set (CRS)  │  │           │
     │                            │  │    · SQL注入 → Block           │  │           │
     │                            │  │    · XSS → Block               │  │           │
     │                            │  │ d. Exposed Credentials Check  │  │           │
     │                            │  │ e. Rate Limiting Rules        │  │           │
     │                            │  │    · 100req/10s → Challenge   │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  │ · 并发 < max_users → 放行      │  │           │
     │                            │  │ · 并发 ≥ max_users → 排队     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑧ Cache (Smart Tiered Cache)  │  │           │
     │                            │  │ · HIT → 直接返回 (跳过源站) ───────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑨ Ruleset Engine               │  │  │        │
     │                            │  │   (Redirect/Transform/Origin)  │  │  │        │
     │                            │  │ · URL 重写 / Header 修改       │  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │ ⑩     │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │ 连接2  │
     │                            │  │ · 边缘 JS 执行                │  │  │ HTTPS  │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │ ┌──────┤
     │                            │  ┌───────────────────────────────┐  │  │ │Origin│
     │                            │  │ ⑬ 源站连接 (连接2)             │  │  │ │ CA   │
     │                            │  │ · TLS 握手 (Full Strict)       │──┼──┼─┤证书  │
     │                            │  │ · 验证 Origin CA 证书          │  │  │ │      │
     │                            │  │ · CF-Connecting-IP 传递访客 IP │  │  │ └──────┤
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │  ⑭ 响应返回               │  ┌───────────────────────────────┐  │  │        │
     │◄───────────────────────────│  │ ⑭ 响应处理                    │◄─┼──┘        │
     │  · Brotli 压缩             │  │ · 缓存写入                     │  │          │
     │  · 缓存命中后下次直接返回   │  │ · Brotli/Gzip 压缩             │  │          │
     │                            │  │ · 通过连接1 返回访客           │  │          │
     └────────────────────────────┘  └───────────────────────────────┘  │          │
                                                                        └──────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://example.com
    │
    ▼
步骤 2: DNS 解析 (① Anycast DNS)
    │ 查询: example.com
    │ Cloudflare 权威 NS 响应 → Cloudflare Anycast IP (如 104.26.x.x)
    │ 访客被路由到地理最近的 PoP (Point of Presence)
    │
    ▼
步骤 3: TCP/QUIC 连接建立 (②)
    │ TCP 三次握手到 Cloudflare 边缘节点 (或 QUIC 0-RTT)
    │
    ▼
步骤 4: TLS 握手 (③ 连接1: 访客 ↔ Cloudflare)
    │ Client Hello → (含支持的加密套件 + SNI)
    │ ← Server Hello + Universal SSL 证书
    │ 浏览器验证证书 (公共 CA 信任链 + CT 日志)
    │ TLS 1.3 密钥交换完成 (ECDHE + AES-GCM)
    │
    ▼
步骤 5: HTTPS 请求发送 (④)
    │ 加密请求通过连接1发送到 Cloudflare Edge
    │
    ▼
步骤 6: Cloudflare 处理 (依次经过以下节点)
    │
    ├─ ④ Advanced DDoS Protection (始终开启)
    │   · L3/L4: 检查是否 SYN Flood / UDP Amplification → 边缘丢弃
    │   · L7: 检查是否 HTTP Flood / Slowloris → Challenge 或 Rate Limit
    │   · Ent 增强: Adaptive DDoS 自适应基线 + 灵敏度可调
    │   · 合法流量放行
    │
    ├─ ⑤ Bot Management (Enterprise · 如已启用)
    │   · Bot Score (ML 模型) + JA3/JA4 指纹 + 行为分析
    │   · 已知 Verified Bots 白名单自动放行
    │   · 已知恶意 Bot → Block
    │   · 可疑流量 → JS Challenge / Managed Challenge
    │   · 合法浏览器 → 放行
    │
    ├─ ⑥ WAF (Web Application Firewall · Ruleset Engine)
    │   ├─ a. Custom Rules (Phase: http_request_firewall_custom)
    │   │   · 匹配 IP / ASN / 国家 / URI / Header / Query / Bot Score
    │   │   · 可引用 Rules Lists (cfcli ip-lists) 作为数据源:
    │   │     - 大规模 IP 封禁: (ip.src in $cf.ip_list{name:"blocklist"})
    │   │     - ASN 黑名单: (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"})
    │   │   · 如: 封禁某国 IP → Block
    │   │   · 如: /admin 路径 → Challenge
    │   │
    │   ├─ b. Managed Rulesets (Phase: http_request_firewall_managed)
    │   │   · Cloudflare Managed Ruleset: 已知漏洞签名 / 虚拟补丁
    │   │   · Cloudflare OWASP Core Rule Set: SQL注入/XSS/RFI/LFI 检测
    │   │   · 如: POST 含 ' OR 1=1 → Block (403)
    │   │   · 如: GET 含 <script> → Block (403)
    │   │   · Cloudflare Exposed Credentials Check: 检查泄露凭证
    │   │   · Page Shield (Ent): 检测前端 JS 劫持
    │   │   · WAF Attack Score (Ent): cf.waf.score ML 评分
    │   │
    │   └─ c. Rate Limiting Rules (Phase: http_ratelimit)
    │       · 如: /api/* 100req/10s per IP → 超限 Block
    │       · Ent: Advanced Rate Limiting (按方法/响应码/字符数)
    │
    ├─ ⑦ Waiting Room (如已配置且路径匹配)
    │   · 检查当前并发活跃用户数
    │   · 并发 < max_users → 放行
    │   · 并发 ≥ max_users → 进入排队页面 (CF Edge 托管)
    │   · 排队期间源站零压力
    │   · 源站有空位时按队列顺序放行
    │
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache) (Cache Rules / Smart Tiered Cache)
    │   · 检查缓存键: URL + Query String + Vary Header
    │   · HIT → 直接从边缘缓存返回 (跳过后续所有步骤 → 步骤 11)
    │   · MISS → 继续向源站请求
    │   · Ent 增强: Smart Tiered Cache 上层 PoP 命中 / Cache Reserve 持久化
    │
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    │   · URL 重写 (如 /old → /new)
    │   · Header 修改 (如添加 X-Forwarded-Proto)
    │   · 回源 Host / SNI / Port 改写 (Origin Rules)
    │   · 旧 Cache Page Rules 已弃用 → 迁移至 Cache Rules / Origin Rules
    │
    └─ ⑩ Workers (如已配置 Workers Route 匹配)
        · 在 Edge 执行 JS/WASM 代码
        · 可修改请求/响应、直接返回、或继续代理
    │
    ▼
步骤 7: 向源站发起请求 (⑬ 连接2)
    │ 建立到源站的 TCP 连接
    │
    ▼
步骤 8: TLS 握手 (⑬ 连接2: Cloudflare ↔ 源站)
    │ Client Hello →
    │ ← Server Hello + Origin CA 证书
    │ Cloudflare 验证 Origin CA 证书 (信任 Cloudflare Origin CA)
    │ 密钥交换完成
    │ 注: 此场景无 mTLS，源站不验证 CF 客户端证书
    │
    ▼
步骤 9: 请求转发到源站
    │ 加密请求通过连接2发送到源站
    │ 附加 Header: CF-Connecting-IP (访客真实 IP)
    │              CF-IPCountry (访客国家代码)
    │              X-Forwarded-For / X-Forwarded-Proto
    │
    ▼
步骤 10: 源站响应
    │ 源站处理请求 (应用逻辑 + 数据库查询)
    │ 返回响应给 Cloudflare
    │
    ▼
步骤 11: 响应处理 (⑭)
    │ Cloudflare 接收源站响应
    │ · 应用响应阶段 Transform Rules (修改响应 Header)
    │ · 缓存写入 (按 Cache-Control / TTL 规则)
    │ · Brotli/Gzip 压缩 (自动协商)
    │ · Image Resizing (如已配置)
    │ 通过连接1返回给访客浏览器
```

### CLI 配置

```bash
# DNS 记录
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# SSL 模式
cfcli ssl set --mode full-strict

# 启用 Universal SSL
cfcli certificate universal enable

# 查看状态
cfcli certificate universal get
cfcli ssl settings
```

---

## 6. 场景二：Full Proxy + Cloudflare 证书 + mTLS

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | Universal SSL (Cloudflare 自动签发) |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ✅ 已启用 (Authenticated Origin Pulls) |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为单 Zone + 单源站 + mTLS 链路。账户级 Lists 与 mTLS **互补不冲突**：账户级 Lists 在 Edge 拦截已知恶意来源，mTLS 在源站强制验证请求来自 Cloudflare，两者可叠加形成"Edge 过滤 + 源站验证"双重防御。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **mTLS 验证** → 源站 |
| 安全层级 | 仅靠 mTLS 强制来源为 CF，未在 Edge 做大规模 IP/ASN 过滤 |
| 适用 | 单业务线、源站已通过 mTLS 锁定、无需跨 zone 共享封禁策略 |
| CLI 命令 | 无需账户级命令 |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → WAF Managed Rulesets → Cache → **mTLS 验证** → 源站 |
| 安全层级 | Edge 层账户级过滤 + 源站 mTLS 验证（双层防护） |
| 跨 Zone 复用 | ✅ 账户内多 zone 共享 Lists |
| 适用 | 多业务线、需统一管控封禁策略、IP 封禁规模 ≥ 1000 条 |
| 流水线位置 | 账户级 Access Rules 在 zone 级规则**之前**执行；Rules Lists 被 Custom Rules 引用 |
| CLI 示例 | 见下方 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List ===
cfcli ip-lists create --name "blocklist_mtls" --kind ip --description "场景二·账户级封禁清单"

# === 2. 添加条目 ===
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 3. 在 WAF Custom Rules 引用 ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist_mtls"}) → Block

# === 4. 账户级 ASN 封禁 (直接生效) ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景二·恶意 ASN"

# === 5. mTLS 仍正常启用 (与 Lists 互不冲突) ===
# Authenticated Origin Pulls: SSL/TLS → Origin Server → Enable
```

### 请求链路图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    场景二：Full Proxy + Cloudflare 证书 + mTLS                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────────────────────────────────────┐         ┌──────────┐
│          │   HTTPS  │           Cloudflare Edge              │   mTLS   │          │
│  访客    │ ───────► │  ┌─────────────────────────────────┐  │ ───────► │  源站    │
│  浏览器  │  连接1  │  │      Universal SSL 证书          │  │  连接2  │  服务器  │
│          │  (加密)  │  │      (Cloudflare 自动签发)        │  │ (双向    │          │
└──────────┘         │  └─────────────────────────────────┘  │  认证)   │          │
                     │                                          │         │          │
                     │  ┌─────────────────────────────────┐  │         │          │
                     │  │      Origin CA 证书             │  │         │          │
                     │  │      + Cloudflare 客户端证书    │  │         │          │
                     │  │      (由 Cloudflare CA 签发)    │  │         │          │
                     │  └─────────────────────────────────┘  │         │          │
                     └──────────────────────────────────────────┘         └──────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://example.com
    │
    ▼
步骤 2: DNS 解析
    │ 查询: example.com
    │ 响应: Cloudflare Anycast IP
    │
    ▼
步骤 3: TCP 连接建立
    │ 三次握手到 Cloudflare 边缘节点
    │
    ▼
步骤 4: TLS 握手 (连接1: 访客 ↔ Cloudflare)
    │ Client Hello →
    │ ← Server Hello + Universal SSL 证书
    │ 浏览器验证证书 (公共 CA 信任链)
    │ 密钥交换完成
    │
    ▼
步骤 5: HTTPS 请求发送
    │ 加密请求通过连接1发送到 Cloudflare
    │
    ▼
步骤 6: Cloudflare 处理
    │ 检查缓存 (HIT/MISS)
    │ 应用 WAF 规则
    │
    ▼
步骤 7: 向源站发起请求
    │ 建立到源站的 TCP 连接
    │
    ▼
步骤 8: mTLS 握手 (连接2: Cloudflare ↔ 源站)
    │ Client Hello →
    │ ← Server Hello + Origin CA 证书
    │ Cloudflare 验证源站证书
    │
    │ ── mTLS 特有步骤 ──
    │ Client Certificate → (Cloudflare 出示客户端证书)
    │ ← Certificate Verify (源站验证客户端证书)
    │ ✅ 确认请求来自 Cloudflare
    │
    │ 密钥交换完成
    │
    ▼
步骤 9: 请求转发到源站
    │ 加密请求通过连接2发送到源站
    │ (双向认证完成，源站信任请求来源)
    │
    ▼
步骤 10: 源站响应
    │ 源站处理请求
    │ 返回响应给 Cloudflare
    │
    ▼
步骤 11: 响应返回给访客
    │ 通过连接1返回给访客浏览器
```

### mTLS 验证流程

```
Cloudflare Edge              Origin Server
      │                         │
      │ ── Client Hello ───────► │
      │ ◄── Server Cert ──────── │
      │                         │
      │ ── Client Cert ─────────► │
      │    (Cloudflare 签发)     │
      │                         │
      │ ◄── Verify OK ────────── │
      │    (源站验证通过)        │
      │                         │
      │ ═══ 加密通信 ═══════════ │
```

### CLI 配置

```bash
# DNS 记录
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# SSL 模式
cfcli ssl set --mode full-strict

# 启用 Universal SSL
cfcli certificate universal enable

# 1. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. 在源站配置 mTLS (见上方 Nginx 配置)

# 3. 在 Cloudflare Dashboard 启用 Authenticated Origin Pulls
#    SSL/TLS → Origin Server → Authenticated Origin Pulls → Enable

# 验证状态
cfcli ssl settings
```

---

## 7. 场景三：Full Proxy + 自购买证书 ACM (无 mTLS)

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | 自购买证书 (OV/EV)，通过 ACM 管理 |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ❌ 未启用 |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 ACM 自购买证书 + 单源站链路。账户级 Lists 与 ACM 证书**完全独立**：ACM 管理边缘证书生命周期，账户级 Lists 管理 Edge 访问控制，两者可任意组合。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → 源站 |
| 适用 | 单业务线、IP 封禁规模 < 100 条、ACM 证书已覆盖品牌需求 |
| CLI 命令 | 无需账户级命令 |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → WAF Managed Rulesets → Cache → 源站 |
| 跨 Zone 复用 | ✅ 多 zone 共享 Lists（如品牌主站 + 子品牌） |
| 适用 | 多域名品牌矩阵、需统一封禁策略、ACM 多 SAN 证书对应多主机名 |
| 流水线位置 | 账户级 Access Rules 先于 zone 级；Rules Lists 被 Custom Rules 引用 |
| 主机名匹配 | 可用 Hostname List (`$cf.hostname_list`) 区分 ACM 不同 SAN 的访问策略 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 Hostname List (区分 ACM 不同 SAN) ===
cfcli ip-lists create --name "premium_hosts" --kind hostname --description "场景三·ACM 高级用户主机名"
cfcli ip-lists items add --id <list-id> --items premium.example.com vip.example.com

# === 2. 创建账户级 IP List (封禁清单) ===
cfcli ip-lists create --name "blocklist_acm" --kind ip
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 3. 在 WAF Custom Rules 引用 ===
# 规则1: (http.host in $cf.hostname_list{name:"premium_hosts"}) and (ip.src in $cf.ip_list{name:"blocklist_acm"}) → Block
# 规则2: (ip.src in $cf.ip_list{name:"blocklist_acm"}) → Block

# === 4. ACM 证书配置 (与 Lists 独立) ===
cfcli certificate upload --name "example.com-ACM" --cert-file ./fullchain.pem --key-file ./privkey.pem
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    场景三：Full Proxy + 自购买证书 ACM (无 mTLS)                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析                                                         │          │
│  访客    │  (Cloudflare Anycast IP)                                            │  源站    │
│  浏览器  │ ──────────────────────────────────────────────────────────────────► │  服务器  │
│          │                                                                    │          │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: 自购买 (OV/EV)       │  │           │
     │                            │  │ · ACM 管理上传                 │  │           │
     │                            │  │ · CA: DigiCert/GlobalSign/SSL.com│ │           │
     │                            │  │ · 浏览器地址栏显示组织名称    │  │           │
     │                            │  │ · SAN: 自定义主机名 (≤100)    │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  │ · L3/L4: Anycast 吸收 + 丢包   │  │           │
     │                            │  │ · L7: 指纹检测 + Challenge     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  │ · 已知恶意爬虫 → Block         │  │           │
     │                            │  │ · 可疑流量 → JS Challenge      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules (IP/国家/URI)  │  │           │
     │                            │  │ b. Managed Rulesets (OWASP CRS)│  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  │ · 并发 < max_users → 放行      │  │           │
     │                            │  │ · 并发 ≥ max_users → 排队     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 (跳过源站) ───────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │ ⑩     │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │ 连接2  │
     │                            │  └───────────┬───────────────────┘  │  │ HTTPS  │
     │                            │              ▼                       │  │ ┌──────┤
     │                            │  ┌───────────────────────────────┐  │  │ │Origin│
     │                            │  │ ⑬ 源站连接 (连接2)             │  │  │ │ CA   │
     │                            │  │ · TLS 握手 (Full Strict)       │──┼──┼─┤证书  │
     │                            │  │ · 验证 Origin CA 证书          │  │  │ │      │
     │                            │  │ · 无 mTLS (源站不验证 CF 证书) │  │  │ └──────┤
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │  ⑭ 响应返回               │  ┌───────────────────────────────┐  │  │        │
     │◄───────────────────────────│  │ ⑭ 响应处理                    │◄─┼──┘        │
     │  · Brotli 压缩             │  │ · 缓存写入                     │  │          │
     │                            │  │ · 通过连接1 返回访客           │  │          │
     └────────────────────────────┘  └───────────────────────────────┘  │          │
                                                                        └──────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (① Anycast DNS)
    │ 查询: www.example.com
    │ Cloudflare 权威 NS 响应 → Cloudflare Anycast IP (如 104.26.x.x)
    │ 访客被路由到地理最近的 PoP
    │
    ▼
步骤 3: TCP/QUIC 连接建立 (②)
    │ TCP 三次握手到 Cloudflare 边缘节点 (或 QUIC 0-RTT)
    │
    ▼
步骤 4: TLS 握手 (③ 连接1: 访客 ↔ Cloudflare)
    │ Client Hello → (含 SNI: www.example.com)
    │ ← Server Hello + 自购买证书 (OV/EV)
    │ 浏览器验证证书:
    │   · 公共 CA 信任链 (DigiCert/GlobalSign/SSL.com)
    │   · CT 日志可查
    │   · OV/EV 证书显示组织名称 (地址栏/证书详情)
    │ TLS 1.3 密钥交换完成
    │ 注: ACM 管理证书可设置自定义有效期 (14/30/90天/1年)
    │
    ▼
步骤 5: HTTPS 请求发送 (④)
    │ 加密请求通过连接1发送到 Cloudflare Edge
    │
    ▼
步骤 6: Cloudflare 处理 (依次经过以下节点)
    │
    ├─ ④ Advanced DDoS Protection (始终开启)
    │   · L3/L4: SYN Flood / UDP Amplification → 边缘丢弃
    │   · L7: HTTP Flood / Slowloris → Challenge 或 Rate Limit
    │
    ├─ ⑤ Bot Management (Ent · 如已启用)
    │   · User-Agent / 行为特征检测
    │   · 已知恶意 Bot → Block / 可疑流量 → JS Challenge
    │
    ├─ ⑥ WAF
    │   ├─ a. Custom Rules: IP/ASN/国家/URI/Header 匹配
    │   │   · 可引用 IP Lists (cfcli ip-lists) 作为数据源:
    │   │     - (ip.src in $cf.ip_list{name:"blocklist"}) → Block
    │   │     - (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"}) → Challenge
    │   │     - (http.host in $cf.hostname_list{name:"allowed"}) → Bypass
    │   ├─ b. Managed Rulesets: Cloudflare Managed Ruleset + OWASP CRS 检测 SQL注入/XSS/RFI/LFI
    │   └─ c. Rate Limiting: /api/* 限速
    │
    ├─ ⑦ Waiting Room (如已配置且路径匹配)
    │   · 并发 < max_users → 放行
    │   · 并发 ≥ max_users → 排队页面 (CF Edge 托管)
    │
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache)
    │   · HIT → 直接返回 (跳过源站)
    │   · MISS → 继续
    │
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    │   · URL 重写 / Header 修改
    │
    └─ ⑩ Workers (如已配置)
        · 在 Edge 执行 JS/WASM
    │
    ▼
步骤 7: 向源站发起请求 (⑬ 连接2)
    │ 建立到源站的 TCP 连接
    │
    ▼
步骤 8: TLS 握手 (⑬ 连接2: Cloudflare ↔ 源站)
    │ Client Hello →
    │ ← Server Hello + Origin CA 证书
    │ Cloudflare 验证 Origin CA 证书 (Full Strict)
    │ 密钥交换完成
    │ 注: 此场景无 mTLS，源站不验证 CF 客户端证书
    │
    ▼
步骤 9: 请求转发到源站
    │ 加密请求通过连接2发送到源站
    │ 附加 Header: CF-Connecting-IP / CF-IPCountry / X-Forwarded-For
    │
    ▼
步骤 10: 源站响应
    │ 源站处理请求 → 返回响应给 Cloudflare
    │
    ▼
步骤 11: 响应处理 (⑭)
    │ Cloudflare 接收源站响应
    │ · 应用响应阶段 Transform Rules
    │ · 缓存写入 (按 Cache-Control / TTL 规则)
    │ · Brotli/Gzip 压缩
    │ 通过连接1返回给访客浏览器
```

### ACM 功能

| 功能 | 说明 |
|------|------|
| **自定义 CA** | 选择证书颁发机构 (Let's Encrypt, Google, SSL.com) |
| **自定义主机名** | 单张证书最多 50 个 SAN（zone apex 必须包含在内）；Enterprise 每 Zone 最多 100 张 edge certificates |
| **自定义有效期** | 14天, 30天, 90天, 1年 |
| **Total TLS** | 自动覆盖所有代理主机名（默认有效期 90 天；**不适用于** Load Balancing / Cloudflare Tunnel / Spectrum 的 hostname；需 Full DNS setup，不支持 Partial setup） |
| **自定义加密套件** | 满足合规要求 |

### CLI 配置

```bash
# DNS 记录
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# SSL 模式
cfcli ssl set --mode full-strict

# 上传自购买证书
cfcli certificate custom upload \
  --certificate "$(cat certificate.crt)" \
  --private-key "$(cat private.key)" \
  --bundle-method ubiquitous

# 查看 ACM 配置
cfcli certificate acm config

# 启用 Total TLS (自动覆盖所有代理主机名)
cfcli certificate total-tls enable --ca lets_encrypt

# 列出证书
cfcli certificate custom list
```

---

## 8. 场景四：Full Proxy + 自购买证书 ACM + mTLS

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | 自购买证书 (OV/EV)，通过 ACM 管理 |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ✅ 已启用 (Authenticated Origin Pulls) |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 ACM + mTLS 双重强化链路。账户级 Lists 在 Edge 层提供"已知恶意来源过滤"，mTLS 在源站层提供"来源身份验证"，三者（ACM/Lists/mTLS）互不冲突，可同时启用形成完整防护链。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **mTLS 验证** → 源站 |
| 安全层级 | ACM 边缘证书 + mTLS 源站验证（无 Edge 大规模过滤） |
| 适用 | 单业务线、源站已通过 mTLS 锁定 |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → WAF Managed Rulesets → Cache → **mTLS 验证** → 源站 |
| 安全层级 | ACM + Edge 账户级过滤 + 源站 mTLS（三层防护） |
| 跨 Zone 复用 | ✅ 多 zone 共享 Lists |
| 适用 | 多业务线、企业级合规要求、需统一封禁 + 源站锁定 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List ===
cfcli ip-lists create --name "blocklist_acm_mtls" --kind ip --description "场景四·账户级封禁清单"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 2. 在 WAF Custom Rules 引用 ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist_acm_mtls"}) → Block

# === 3. 账户级 ASN 封禁 ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景四·恶意 ASN"

# === 4. ACM 证书 + mTLS 配置 (与 Lists 独立) ===
cfcli certificate upload --name "example.com-ACM" --cert-file ./fullchain.pem --key-file ./privkey.pem
# Authenticated Origin Pulls: SSL/TLS → Origin Server → Enable
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    场景四：Full Proxy + 自购买证书 ACM + mTLS                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析                                                         │          │
│  访客    │  (Cloudflare Anycast IP)                                            │  源站    │
│  浏览器  │ ──────────────────────────────────────────────────────────────────► │  服务器  │
│          │                                                                    │ (mTLS)   │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: 自购买 (OV/EV)       │  │           │
     │                            │  │ · ACM 管理上传                 │  │           │
     │                            │  │ · CA: DigiCert/GlobalSign/SSL.com│ │           │
     │                            │  │ · 显示组织名称 + SAN 自定义   │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  │ · L3/L4: Anycast 吸收 + 丢包   │  │           │
     │                            │  │ · L7: 指纹检测 + Challenge     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets (OWASP CRS)│  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │ ⑩     │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │ 连接2  │
     │                            │  └───────────┬───────────────────┘  │  │ mTLS   │
     │                            │              ▼                       │  │ (双向) │
     │                            │  ┌───────────────────────────────┐  │  │ ┌──────┤
     │                            │  │ ⑩ Workers (如已配置)           │  │  │ │Origin│
     │                            │  └───────────┬───────────────────┘  │  │ │ CA + │
     │                            │              ▼                       │  │ │CF 客 │
     │                            │  ┌───────────────────────────────┐  │  │ │户端证│
     │                            │  │ ⑬ 源站连接 (连接2)             │  │  │ │书    │
     │                            │  │ · TLS 握手 (Full Strict)       │──┼──┼─┤      │
     │                            │  │ · CF 出示客户端证书            │  │  │ │      │
     │                            │  │ · 源站验证 CF 证书 (mTLS)      │  │  │ └──────┤
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │  ⑭ 响应返回               │  ┌───────────────────────────────┐  │  │        │
     │◄───────────────────────────│  │ ⑭ 响应处理                    │◄─┼──┘        │
     │                            │  │ · 缓存写入 + Brotli 压缩       │  │          │
     └────────────────────────────┘  └───────────────────────────────┘  │          │
                                                                        └──────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (① Anycast DNS)
    │ 查询: www.example.com → Cloudflare Anycast IP
    │
    ▼
步骤 3: TCP/QUIC 连接建立 (②)
    │
    ▼
步骤 4: TLS 握手 (③ 连接1: 访客 ↔ Cloudflare)
    │ ← 自购买证书 (OV/EV · ACM 管理)
    │ 浏览器验证公共 CA 信任链 + CT 日志
    │ 显示组织名称 (地址栏/证书详情)
    │
    ▼
步骤 5: HTTPS 请求发送 (④)
    │
    ▼
步骤 6: Cloudflare 处理
    ├─ ④ Advanced DDoS Protection (L3/L4 + L7)
    ├─ ⑤ Bot Management (Ent)
    ├─ ⑥ WAF (Custom Rules + Managed Rulesets + Rate Limiting Rules)
    ├─ ⑦ Waiting Room (如已配置)
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache · HIT → 直接返回 / MISS → 继续)
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 7: 向源站发起请求 (⑬ 连接2)
    │
    ▼
步骤 8: mTLS 握手 (⑬ 连接2: Cloudflare ↔ 源站)
    │ Client Hello →
    │ ← Server Hello + Origin CA 证书
    │ Cloudflare 验证源站证书
    │
    │ ── mTLS 特有步骤 ──
    │ CertificateRequest → (源站请求客户端证书)
    │ Client Certificate → (Cloudflare 出示 CF 客户端证书)
    │   · 由 Cloudflare Origin CA 签发
    │   · CN: cloudflare.com
    │ ← CertificateVerify (源站验证 CF 客户端证书)
    │   · 源站信任 cloudflare_ca.pem
    │   · ✅ 确认请求来自 Cloudflare (非伪造)
    │
    │ 密钥交换完成
    │
    ▼
步骤 9: 请求转发到源站
    │ 加密请求通过连接2发送到源站
    │ 源站信任请求来源 (mTLS 双向认证完成)
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭) → 返回访客
```

### mTLS 验证流程

```
Cloudflare Edge                       Origin Server
      │                                    │
      │ ── Client Hello ─────────────────► │
      │ ◄── Server Hello + Origin CA ───── │
      │                                    │
      │ ◄── CertificateRequest ────────── │ (要求客户端证书)
      │                                    │
      │ ── Client Certificate ──────────► │
      │   (Cloudflare Origin CA 签发)      │
      │                                    │
      │ ◄── CertificateVerify ─────────── │ (源站验证通过)
      │   · 信任 cloudflare_ca.pem         │
      │   · ✅ 请求来源确认是 Cloudflare    │
      │                                    │
      │ ═════ 加密通信 ═══════════════════ │
      │                                    │
      │ ── 加密请求 (含 CF-Connecting-IP) ► │
      │ ◄── 加密响应 ───────────────────── │
```

### CLI 配置

```bash
# DNS 记录
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# SSL 模式
cfcli ssl set --mode full-strict

# 上传自购买证书
cfcli certificate custom upload \
  --certificate "$(cat certificate.crt)" \
  --private-key "$(cat private.key)" \
  --bundle-method ubiquitous

# 启用 Total TLS
cfcli certificate total-tls enable --ca lets_encrypt

# 1. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. 在源站配置 mTLS

# 3. 在 Cloudflare Dashboard 启用 Authenticated Origin Pulls

# 验证状态
cfcli certificate custom list
cfcli ssl settings
```

---

## 9. 场景五：Partial Zone Suffix + Cloudflare 证书 (无 mTLS)

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | 保留原 DNS 提供商 |
| **代理** | 通过 CNAME 指向 Cloudflare |
| **边缘证书** | Universal SSL (每个子域名独立证书) |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ❌ 未启用 |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 Partial Setup（CNAME 接入）链路。账户级 Lists **仍然适用**：CNAME 接入不影响 Cloudflare Edge 内部流水线，账户级 Lists 在 WAF 阶段正常执行。这是 Partial Setup 用户常忽略的能力。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 原 DNS → CNAME → CF Edge → Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → 源站 |
| 跨 Zone 复用 | ❌ 每个 Partial Setup 子域独立维护封禁策略 |
| 适用 | 单子域接入、IP 封禁规模 < 100 条 |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 原 DNS → CNAME → CF Edge → Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → Cache → 源站 |
| 跨 Zone 复用 | ✅ 同账户内 Full Setup zone + Partial Setup zone 共享 Lists |
| 适用 | 多个子域 Partial 接入、混合 Full/Partial 接入、需统一管控 |
| 流水线位置 | 账户级规则在所有接入方式（Full/Partial）下执行顺序一致 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List (Full + Partial 子域共享) ===
cfcli ip-lists create --name "blocklist_partial" --kind ip --description "场景五·跨接入方式共享封禁"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 2. 在 Partial Setup zone 的 WAF Custom Rules 引用 ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist_partial"}) → Block

# === 3. 账户级 ASN 封禁 (Full + Partial zone 同时生效) ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景五·恶意 ASN 全账户生效"

# === 4. CNAME 接入配置 (原 DNS 提供商处) ===
# api.example.com CNAME → api.example.com.cf.cloudflare.com (Partial 接入)
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│              场景五：Partial Zone Suffix + Cloudflare 证书 (无 mTLS)                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘

【DNS 解析阶段 - Partial Setup 特有】
┌──────────┐      ┌──────────┐      ┌──────────────┐      ┌─────────────────┐
│  访客    │ ① 查询 │ 原 DNS    │ ② CNAME│ Cloudflare    │ ③ Anycast│ 访客被路由到   │
│  浏览器  │ ────► │ 权威 NS  │ ────► │ cf.cloudflare │ ───────► │ 最近 PoP       │
└──────────┘      └──────────┘      └──────────────┘          └─────────────────┘
                  (非 Cloudflare)    api.example.com
                                     └──► cf.cloudflare.com

【请求处理链路】
┌──────────┐                                                                    ┌──────────┐
│          │  ④ TCP/QUIC + TLS 握手 (连接1)                                       │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站    │
│  浏览器  │                                                                    │  服务器  │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │                            ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: Universal SSL        │  │           │
     │                            │  │ (Partial: 每个子域名单独签发)  │  │           │
     │                            │  │ · SNI: api.example.com         │  │           │
     │                            │  │ · 验证: TXT 记录               │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  │ · L3/L4: Anycast 吸收 + 丢包   │  │           │
     │                            │  │ · L7: 指纹检测 + Challenge     │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets (OWASP CRS)│  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │ ⑩     │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │ 连接2  │
     │                            │  └───────────┬───────────────────┘  │  │ HTTPS  │
     │                            │              ▼                       │  │ ┌──────┤
     │                            │  ┌───────────────────────────────┐  │  │ │Origin│
     │                            │  │ ⑩ Workers (如已配置)           │  │  │ │ CA   │
     │                            │  └───────────┬───────────────────┘  │  │ │证书  │
     │                            │              ▼                       │  │ │      │
     │                            │  ┌───────────────────────────────┐  │  │ └──────┤
     │                            │  │ ⑬ 源站连接 (连接2)             │  │  │        │
     │                            │  │ · TLS 握手 (Full Strict)       │──┼──┼─┐      │
     │                            │  │ · 验证 Origin CA 证书          │  │  │ │      │
     │                            │  │ · 无 mTLS                      │  │  │ │      │
     │                            │  └───────────────────────────────┘  │  │ │      │
     │                            │                                     │  │ │      │
     │  ⑭ 响应返回               │  ┌───────────────────────────────┐  │  │ │      │
     │◄───────────────────────────│  │ ⑭ 响应处理                    │◄─┼──┘ │      │
     │                            │  │ · 缓存写入 + Brotli 压缩       │  │    │      │
     └────────────────────────────┘  └───────────────────────────────┘  │    │      │
                                                                        └────┴──────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://api.example.com
    │
    ▼
步骤 2: DNS 解析 (Partial Setup · 与 Full Setup 不同)
    │ ① 访客向 DNS 解析器查询 api.example.com
    │ ② 解析器向"原 DNS 提供商"权威 NS 查询 (非 Cloudflare NS)
    │   · 原 DNS 返回 CNAME: api.example.com → cf.cloudflare.com
    │ ③ 继续解析 cf.cloudflare.com
    │   · Cloudflare NS 返回 Anycast IP (104.26.x.x)
    │ ④ 访客被路由到地理最近的 Cloudflare PoP
    │ 注: Partial Setup 仅代理通过 CNAME 接入的子域名
    │     根域名 A 记录不经过 Cloudflare
    │
    ▼
步骤 3: TCP/QUIC 连接建立 (④)
    │ TCP 三次握手到 Cloudflare 边缘节点
    │
    ▼
步骤 4: TLS 握手 (③ 连接1: 访客 ↔ Cloudflare)
    │ Client Hello → (SNI: api.example.com)
    │ ← Server Hello + Universal SSL 证书
    │ Partial Setup 特点:
    │   · 每个子域名单独签发证书 (api.example.com)
    │   · 不覆盖根域名 example.com (因为根域名不走 CF)
    │   · 通过 TXT 记录验证域名所有权
    │ 浏览器验证证书 → 密钥交换完成
    │
    ▼
步骤 5: HTTPS 请求发送 (④)
    │
    ▼
步骤 6: Cloudflare 处理 (依次经过以下节点)
    │
    ├─ ④ Advanced DDoS Protection (始终开启)
    │   · L3/L4 + L7 全层防护
    │
    ├─ ⑤ Bot Management (Ent · 如已启用)
    │
    ├─ ⑥ WAF
    │   ├─ a. Custom Rules: IP/国家/URI 匹配
    │   │   · 可引用 IP Lists (cfcli ip-lists) 作为数据源
    │   ├─ b. Managed Rulesets: Cloudflare Managed Ruleset + OWASP CRS 检测
    │   └─ c. Rate Limiting: 限速规则
    │
    ├─ ⑦ Waiting Room (如已配置)
    │   · 并发超限 → 排队页面
    │
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache)
    │   · HIT → 直接返回
    │   · MISS → 继续向源站
    │
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    │   · URL 重写 / Header 修改
    │
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 7: 向源站发起请求 (⑬ 连接2)
    │ 建立到源站的 TCP 连接 (源站 IP 由 DNS 记录配置)
    │
    ▼
步骤 8: TLS 握手 (⑬ 连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书
    │ Cloudflare 验证源站证书 (Full Strict)
    │ 注: 无 mTLS
    │
    ▼
步骤 9: 请求转发到源站
    │ 附加 Header: CF-Connecting-IP / CF-IPCountry / X-Forwarded-For
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭)
    │ · Transform Rules (响应阶段)
    │ · 缓存写入
    │ · Brotli/Gzip 压缩
    │ 通过连接1返回访客
```

### CLI 配置

```bash
# 在原 DNS 提供商添加 CNAME 记录
# api.example.com CNAME → cf.cloudflare.com

# 确认为 Proxied
cfcli dns list

# 查看证书状态
cfcli certificate verification get
```

---

## 10. 场景六：Partial Zone Suffix + Cloudflare 证书 + mTLS

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | 保留原 DNS 提供商 |
| **代理** | 通过 CNAME 指向 Cloudflare |
| **边缘证书** | Universal SSL (每个子域名独立证书) |
| **源站证书** | Origin CA 或 Let's Encrypt |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ✅ 已启用 (Authenticated Origin Pulls) |
| **Load Balancer** | ❌ 未启用 |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 Partial Setup + mTLS 链路。账户级 Lists 在 Edge 层过滤，mTLS 在源站层验证，两者在 Partial Setup 下均可正常工作。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 原 DNS → CNAME → CF Edge → Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **mTLS** → 源站 |
| 适用 | 单子域 Partial 接入、mTLS 已锁定源站 |

**✅ 方案 B：启用账户级 Lists（推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | 原 DNS → CNAME → CF Edge → Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → Cache → **mTLS** → 源站 |
| 跨 Zone 复用 | ✅ Partial + Full zone 共享 Lists |
| 适用 | 多子域 Partial 接入 + 源站 mTLS、需统一封禁 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List ===
cfcli ip-lists create --name "blocklist_partial_mtls" --kind ip --description "场景六·Partial+mTLS 共享封禁"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 2. 在 WAF Custom Rules 引用 ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist_partial_mtls"}) → Block

# === 3. 账户级 ASN 封禁 ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景六·恶意 ASN"

# === 4. CNAME + mTLS 配置 (与 Lists 独立) ===
# 原 DNS: api.example.com CNAME → cf.cloudflare.com
# CF Dashboard: SSL/TLS → Origin Server → Authenticated Origin Pulls → Enable
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│              场景六：Partial Zone Suffix + Cloudflare 证书 + mTLS                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

【DNS 解析阶段 - Partial Setup 特有】
┌──────────┐      ┌──────────┐      ┌──────────────┐      ┌─────────────────┐
│  访客    │ ① 查询 │ 原 DNS    │ ② CNAME│ Cloudflare    │ ③ Anycast│ 访客被路由到   │
│  浏览器  │ ────► │ 权威 NS  │ ────► │ cf.cloudflare │ ───────► │ 最近 PoP       │
└──────────┘      └──────────┘      └──────────────┘          └─────────────────┘
                  (非 Cloudflare)    api.example.com
                                     └──► cf.cloudflare.com

【请求处理链路】
┌──────────┐                                                                    ┌──────────┐
│          │  ④ TCP/QUIC + TLS 握手 (连接1)                                       │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站    │
│  浏览器  │                                                                    │ (mTLS)   │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │                            ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: Universal SSL        │  │           │
     │                            │  │ (Partial: 每个子域名单独签发)  │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  │ · L3/L4 + L7 全层防护          │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets (OWASP CRS)│  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │ ⑩     │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │ 连接2  │
     │                            │  └───────────┬───────────────────┘  │  │ mTLS   │
     │                            │              ▼                       │  │ (双向) │
     │                            │  ┌───────────────────────────────┐  │  │ ┌──────┤
     │                            │  │ ⑩ Workers (如已配置)           │  │  │ │Origin│
     │                            │  └───────────┬───────────────────┘  │  │ │ CA + │
     │                            │              ▼                       │  │ │CF 客 │
     │                            │  ┌───────────────────────────────┐  │  │ │户端证│
     │                            │  │ ⑬ 源站连接 (连接2)             │  │  │ │书    │
     │                            │  │ · TLS 握手 (Full Strict)       │──┼──┼─┤      │
     │                            │  │ · CF 出示客户端证书            │  │  │ │      │
     │                            │  │ · 源站验证 CF 证书 (mTLS)      │  │  │ └──────┤
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │  ⑭ 响应返回               │  ┌───────────────────────────────┐  │  │        │
     │◄───────────────────────────│  │ ⑭ 响应处理                    │◄─┼──┘        │
     │                            │  │ · 缓存写入 + Brotli 压缩       │  │          │
     └────────────────────────────┘  └───────────────────────────────┘  │          │
                                                                        └──────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://api.example.com
    │
    ▼
步骤 2: DNS 解析 (Partial Setup)
    │ ① 访客查询 api.example.com
    │ ② 原 DNS 提供商返回 CNAME: api.example.com → cf.cloudflare.com
    │ ③ 继续解析 cf.cloudflare.com → Cloudflare Anycast IP
    │ ④ 路由到最近 PoP
    │
    ▼
步骤 3: TCP/QUIC 连接建立 (④)
    │
    ▼
步骤 4: TLS 握手 (③ 连接1: 访客 ↔ Cloudflare)
    │ ← Universal SSL 证书 (每个子域名独立签发)
    │ 浏览器验证证书 → 密钥交换完成
    │
    ▼
步骤 5: HTTPS 请求发送 (④)
    │
    ▼
步骤 6: Cloudflare 处理
    ├─ ④ Advanced DDoS Protection (L3/L4 + L7)
    ├─ ⑤ Bot Management (Ent)
    ├─ ⑥ WAF (Custom Rules + Managed Rulesets + Rate Limiting Rules)
    ├─ ⑦ Waiting Room (如已配置)
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache · HIT/MISS)
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 7: 向源站发起请求 (⑬ 连接2)
    │
    ▼
步骤 8: mTLS 握手 (⑬ 连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书
    │ Cloudflare 验证源站证书
    │
    │ ── mTLS 特有步骤 ──
    │ ◄── CertificateRequest (源站要求客户端证书)
    │ ── Client Certificate ──► (Cloudflare 出示 CF 客户端证书)
    │ ◄── CertificateVerify (源站验证通过 cloudflare_ca.pem)
    │ ✅ 确认请求来自 Cloudflare
    │
    ▼
步骤 9: 请求转发到源站
    │ 源站信任请求来源 (mTLS 完成)
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭) → 返回访客
```

### mTLS 验证流程 (Partial Setup 适用)

```
Cloudflare Edge                       Origin Server
      │                                    │
      │ ── Client Hello ─────────────────► │
      │ ◄── Server Hello + Origin CA ───── │
      │                                    │
      │ ◄── CertificateRequest ────────── │ (要求客户端证书)
      │                                    │
      │ ── Client Certificate ──────────► │
      │   (Cloudflare Origin CA 签发)      │
      │                                    │
      │ ◄── CertificateVerify ─────────── │ (源站验证通过)
      │   · 信任 cloudflare_ca.pem         │
      │   · ✅ 请求来源确认是 Cloudflare    │
      │                                    │
      │ ═════ 加密通信 ═══════════════════ │
```

### CLI 配置

```bash
# 在原 DNS 提供商添加 CNAME 记录
# api.example.com CNAME → cf.cloudflare.com

# 确认为 Proxied
cfcli dns list

# 1. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. 在源站配置 mTLS

# 3. 在 Cloudflare Dashboard 启用 Authenticated Origin Pulls

# 验证状态
cfcli certificate verification get
cfcli ssl settings
```

---

## 11. 场景七：Full Proxy + Load Balancer (无 mTLS)

### LB DNS 记录优先级说明（第 11–14 章通用）

> 创建 Load Balancer 时，Cloudflare 会自动为指定 **Hostname** 生成一条 LB DNS 记录（内部 CNAME）。当该 hostname 已存在手动 A/AAAA/CNAME 记录时，两者共存但优先级不同。本节规则适用于第 11–14 章所有含 LB 的场景。

**官方优先级判定规则：按"具体程度"比较，同等具体时 LB 胜出。**

| 场景 | 手动 DNS 记录 | LB 记录 | 生效结果 | 判定依据 |
|------|-------------|---------|---------|---------|
| **1（最常见）** | `x.example.com`（A/AAAA/CNAME） | `x.example.com` | ✅ **LB 记录优先** | 同等具体 → LB 胜 |
| 2 | `y.example.com`（精确名） | `*.example.com`（通配符） | 手动记录优先 | 精确 > 通配符 |
| 3 | `*.example.com`（通配符） | `*.example.com`（通配符） | ✅ **LB 记录优先** | 同等具体 → LB 胜 |
| 4（SaaS 例外） | `x.example.com` → Cloudflare for SaaS | `x.example.com` + 活跃 Custom Hostname | Custom Hostname 优先 | SaaS 优先级最高 |

**关键要点：**

1. **LB 记录会"接管"同名 hostname**：手动记录虽然存在，但解析时 LB 记录生效，手动记录被"遮蔽"。
2. **判定标准是"具体程度"，不是记录类型**：精确 vs 精确 → LB 胜；精确 vs 通配符 → 精确胜。
3. **例外**：Cloudflare for SaaS 的 Custom Hostname 优先级高于 LB 记录。
4. **禁用 LB 后的回退**：禁用 LB 时，DNS 解析回退到现有手动记录；若无手动记录，请求失败。
5. **Partial (CNAME) setup 特殊注意**：Universal SSL 证书默认不覆盖 LB hostname，需手动创建 proxied CNAME/A 记录指向 LB hostname 作为 workaround。

**CLI 操作：**

```bash
# 查看 LB 详情（含自动生成的 DNS 记录信息）
cfcli lb get --zone nc-demo.cf --name "fin-lb"

# 临时禁用 LB（保留配置，DNS 回退到手动记录）
cfcli lb disable --zone nc-demo.cf --name "fin-lb"

# 重新启用
cfcli lb enable --zone nc-demo.cf --name "fin-lb"

# 删除 LB（同时移除自动生成的 DNS 记录）
cfcli lb delete --zone nc-demo.cf --name "fin-lb"
```

**常见误区：**

| 误区 | 说明 |
|------|------|
| 误认为手动 CNAME 会与 LB 记录"负载均衡" | 不会。同名时 LB 记录独占生效，手动记录被遮蔽 |
| 误认为删除手动记录才能让 LB 生效 | 不需要。LB 记录优先级更高，手动记录存在与否不影响 LB 生效 |
| 误认为禁用 LB 后手动记录立即生效 | 受 TTL 影响，本地 DNS 缓存可能延迟更新 |
| 误认为 LB 通配符会覆盖所有子域 | 不会。精确手动记录优先于 LB 通配符记录 |

> **参考文档**：[Cloudflare Load Balancing - DNS records](https://developers.cloudflare.com/load-balancing/reference/dns-records/)

---

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | Universal SSL 或 ACM 管理 |
| **源站证书** | Origin CA |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ❌ 未启用 |
| **Load Balancer** | ✅ 已启用，多个 Pool |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 Load Balancer 多 Pool 链路。账户级 Lists 在 **LB 之前** 执行（WAF 阶段），可在请求到达 LB / 源站 Pool 前过滤掉恶意来源，避免 Pool 被恶意流量拖垮。这是 LB 场景下保护源站健康度的关键能力。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **LB → Pool 选择** → 源站 |
| 风险 | 恶意 IP 可能到达 LB → Pool 被压垮 → Health Check 失败 → 整个 Pool 摘除 |
| 适用 | 单业务线、LB 后端源站已有自身防护 |

**✅ 方案 B：启用账户级 Lists（强烈推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → Cache → **LB → Pool 选择** → 源站 |
| 跨 Zone 复用 | ✅ 多 LB（不同 zone）共享封禁策略 |
| 适用 | 多区域 LB、跨业务线统一管控、保护 LB Pool 健康度 |
| 流水线位置 | **在 LB 之前**（WAF 阶段）执行，恶意流量不会到达 LB |
| LB 联动 | 可用 Hostname List 区分不同 LB 主机名的访问策略 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List (保护 LB Pool) ===
cfcli ip-lists create --name "blocklist_lb" --kind ip --description "场景七·保护 LB Pool 免受恶意流量"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 2. 创建账户级 Hostname List (区分 LB 主机名) ===
cfcli ip-lists create --name "lb_hosts" --kind hostname --description "场景七·LB 主机名清单"
cfcli ip-lists items add --id <list-id> --items api.example.com app.example.com

# === 3. 在 WAF Custom Rules 引用 ===
# 规则1: (http.host in $cf.hostname_list{name:"lb_hosts"}) and (ip.src in $cf.ip_list{name:"blocklist_lb"}) → Block
# 规则2: (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"}) → Block

# === 4. 账户级 ASN 封禁 (全账户 LB 生效) ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景七·恶意 ASN 全账户 LB 生效"

# === 5. LB 配置 (与 Lists 独立) ===
cfcli lb create --name "api-lb" --default-pool <pool-id> --fallback-pool <fallback-id>
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    场景七：Full Proxy + Load Balancer (无 mTLS)                             │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析 (Cloudflare NS 返回 LB 主机名)                           │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站群   │
│  浏览器  │                                                                    │ (多 Pool) │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: Universal SSL / ACM  │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets           │  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑪ Load Balancer (LB) ★ 关键节点│  │  │        │
     │                            │  │ · 会话保持 (Cookie / IP Hash)  │  │  │        │
     │                            │  │ · 地理路由 / 权重分配          │  │  │        │
     │                            │  │ · 故障转移 (Failover)          │  │  │        │
     │                            │  │ · Health Check 决定 Pool 选择  │  │  │        │
     │                            │  └──┬─────────┬─────────┬────────┘  │  │        │
     │                            │     ▼         ▼         ▼           │  │        │
     │                            │  ┌──────┐ ┌──────┐ ┌──────┐         │  │        │
     │                            │  │Pool 1│ │Pool 2│ │Pool 3│         │  │        │
     │                            │  │美国  │ │欧洲  │ │亚洲  │         │  │        │
     │                            │  └──┬───┘ └──┬───┘ └──┬───┘         │  │        │
     │                            │     │        │        │             │  │        │
     │                            └─────┼────────┼────────┼─────────────┘  │        │
     │                                  │        │        │                │        │
     │  ⑬ 源站连接 (连接2 · 多 Pool)    │        │        │                │        │
     │                                  ▼        ▼        ▼                │        │
     │                            ┌──────────┐┌──────────┐┌──────────┐    │        │
     │                            │源站 1    ││源站 2    ││源站 3    │◄───┼────────┤
     │                            │美国      ││欧洲      ││亚洲      │    │ Origin │
     │                            │Origin CA ││Origin CA ││Origin CA │    │ CA 证书│
     │                            │(无 mTLS) ││(无 mTLS) ││(无 mTLS) │    │        │
     │                            └──────────┘└──────────┘└──────────┘    │        │
     │                                                                      │        │
     │  ⑭ 响应返回                                                         │        │
     │◄────────────────────────────────────────────────────────────────────┴────────┤
     │  · 缓存写入 + Brotli 压缩 + 通过连接1返回访客                                 │
     └─────────────────────────────────────────────────────────────────────────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (①)
    │ Cloudflare NS 返回 LB 关联主机名 → Anycast IP
    │
    ▼
步骤 3: TCP/QUIC + TLS 握手 (连接1) (②③)
    │ ← Universal SSL 或 ACM 证书
    │
    ▼
步骤 4: HTTPS 请求发送 (④)
    │
    ▼
步骤 5: Cloudflare 处理 (依次经过以下节点)
    │
    ├─ ④ Advanced DDoS Protection (始终开启)
    │
    ├─ ⑤ Bot Management (Ent)
    │
    ├─ ⑥ WAF (Custom Rules + Managed Rulesets + Rate Limiting Rules)
    │
    ├─ ⑦ Waiting Room (如已配置)
    │
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache)
    │   · HIT → 直接返回 (跳过 LB 和源站)
    │   · MISS → 继续
    │
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    │
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 6: Load Balancer 决策 (⑪ ★ 关键节点)
    │ · 读取会话 Cookie (如配置 Session Affinity)
    │   · 命中 → 路由到原 Pool (粘性会话)
    │   · 未命中 → 进入路由策略
    │ · 路由策略:
    │   · 地理路由: 亚洲访客 → Pool 3 (亚洲)
    │   · 权重分配: 按 Pool 权重比例分配
    │   · 故障转移: 主 Pool 全离线 → Fallback Pool
    │ · Health Check 实时状态:
    │   · 仅向健康 Pool 转发请求
    │   · 离线 Pool 自动剔除
    │
    ▼
步骤 7: 向选中 Pool 内的源站发起请求 (⑬ 连接2)
    │ · Pool 内多个源站: 轮询 / 最少连接
    │ · 建立到源站的 TCP 连接
    │
    ▼
步骤 8: TLS 握手 (连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书
    │ Cloudflare 验证源站证书 (Full Strict)
    │ 注: 无 mTLS
    │
    ▼
步骤 9: 请求转发到源站
    │ 附加 Header: CF-Connecting-IP / X-Forwarded-For
    │            LB 特有: CF-Host / CF-LB (Pool 信息)
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭)
    │ · 缓存写入 (按 Cache Rules)
    │ · Brotli/Gzip 压缩
    │ 通过连接1返回访客
```

### 健康检查流程

```
Load Balancer
    │
    ├── Pool 1 (美国)
    │   ├── Origin 1 ─── 健康检查 ─── ✅ 在线
    │   └── Origin 2 ─── 健康检查 ─── ❌ 离线
    │
    ├── Pool 2 (欧洲)
    │   ├── Origin 1 ─── 健康检查 ─── ✅ 在线
    │   └── Origin 2 ─── 健康检查 ─── ✅ 在线
    │
    └── Fallback Pool
        └── Origin 1 ─── 健康检查 ─── ✅ 在线
```

### CLI 配置

```bash
# 1. 创建健康检查
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# 2. 创建 Pool
cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

# 3. 创建 Load Balancer
cfcli load-balancer create \
  --name my-lb \
  --pool-id <us-pool-id> \
  --default-pool-ids <us-pool-id> \
  --fallback-pool-id <fallback-pool-id>

# 4. 查看状态
cfcli load-balancer list
cfcli health-checks list
```

---

## 12. 场景八：Full Proxy + Load Balancer + mTLS

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | Universal SSL 或 ACM 管理 |
| **源站证书** | Origin CA |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ✅ 已启用 (Authenticated Origin Pulls) |
| **Load Balancer** | ✅ 已启用，多个 Pool |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 LB + mTLS 双重防护链路。账户级 Lists 在 LB 之前执行过滤，mTLS 在 LB → Pool → 源站路径上验证请求来自 Cloudflare，三者形成"Edge 过滤 → LB 分发 → 源站验证"完整链。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **LB → Pool 选择 → mTLS** → 源站 |
| 风险 | 恶意 IP 可能到达 LB → Pool 健康度受损 |
| 适用 | 单业务线、LB + mTLS 已锁定源站 |

**✅ 方案 B：启用账户级 Lists（强烈推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → Cache → **LB → Pool 选择 → mTLS** → 源站 |
| 安全层级 | Edge 过滤 + LB 分发 + mTLS 源站验证（三层防护） |
| 跨 Zone 复用 | ✅ 多 LB 共享封禁策略 |
| 适用 | 多区域 LB + mTLS、企业级合规、需统一管控封禁 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 IP List (保护 LB Pool + mTLS 源站) ===
cfcli ip-lists create --name "blocklist_lb_mtls" --kind ip --description "场景八·LB+mTLS 共享封禁"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 2. 在 WAF Custom Rules 引用 ===
# 表达式: (ip.src in $cf.ip_list{name:"blocklist_lb_mtls"}) → Block

# === 3. 账户级 ASN 封禁 ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景八·恶意 ASN"

# === 4. LB + mTLS 配置 (与 Lists 独立) ===
cfcli lb create --name "api-lb" --default-pool <pool-id> --fallback-pool <fallback-id>
# Authenticated Origin Pulls: SSL/TLS → Origin Server → Enable (LB Pool 源站)
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    场景八：Full Proxy + Load Balancer + mTLS                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析 (Cloudflare NS 返回 LB 主机名)                           │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站群   │
│  浏览器  │                                                                    │ (mTLS)   │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: Universal SSL / ACM  │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑪ Load Balancer (LB) ★ 关键节点│  │  │        │
     │                            │  │ · 会话保持 / 地理 / 权重       │  │  │        │
     │                            │  │ · 故障转移 / Health Check     │  │  │        │
     │                            │  └──┬─────────┬─────────┬────────┘  │  │        │
     │                            │     ▼         ▼         ▼           │  │        │
     │                            │  ┌──────┐ ┌──────┐ ┌──────┐         │  │        │
     │                            │  │Pool 1│ │Pool 2│ │Pool 3│         │  │        │
     │                            │  └──┬───┘ └──┬───┘ └──┬───┘         │  │        │
     │                            └─────┼────────┼────────┼─────────────┘  │        │
     │                                  │        │        │                │        │
     │  ⑬ 源站连接 (连接2 · mTLS)       │        │        │                │        │
     │                                  ▼        ▼        ▼                │        │
     │                            ┌──────────┐┌──────────┐┌──────────┐    │        │
     │                            │源站 1    ││源站 2    ││源站 3    │◄───┼────────┤
     │                            │(mTLS)    ││(mTLS)    ││(mTLS)    │    │Origin CA│
     │                            │CF 客户端 ││CF 客户端 ││CF 客户端 │    │+ CF 客户│
     │                            │证书验证  ││证书验证  ││证书验证  │    │端证书   │
     │                            └──────────┘└──────────┘└──────────┘    │        │
     │                                                                      │        │
     │  ⑭ 响应返回                                                         │        │
     │◄────────────────────────────────────────────────────────────────────┴────────┤
     └─────────────────────────────────────────────────────────────────────────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (①) → Cloudflare Anycast IP
    │
    ▼
步骤 3: TCP/QUIC + TLS 握手 (连接1) (②③)
    │ ← Universal SSL 或 ACM 证书
    │
    ▼
步骤 4: HTTPS 请求发送 (④)
    │
    ▼
步骤 5: Cloudflare 处理
    ├─ ④ Advanced DDoS Protection
    ├─ ⑤ Bot Management (Ent)
    ├─ ⑥ WAF (Custom + Managed + Rate Limiting)
    ├─ ⑦ Waiting Room (如已配置)
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache · HIT/MISS)
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 6: Load Balancer 决策 (⑪ ★ 关键节点)
    │ · 会话保持 / 地理路由 / 权重 / 故障转移
    │ · Health Check 实时筛选健康 Pool
    │
    ▼
步骤 7: 向选中 Pool 内源站发起请求 (⑬ 连接2)
    │
    ▼
步骤 8: mTLS 握手 (连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书 (源站身份)
    │ Cloudflare 验证源站证书
    │
    │ ── mTLS 特有步骤 ──
    │ ◄── CertificateRequest (源站要求客户端证书)
    │ ── Client Certificate ──► (CF 出示客户端证书)
    │ ◄── CertificateVerify (源站验证 cloudflare_ca.pem)
    │ ✅ 确认请求来自 Cloudflare
    │
    ▼
步骤 9: 请求转发到源站
    │ 所有源站均通过 mTLS 双向认证
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭) → 返回访客
```

### CLI 配置

```bash
# 1. 创建健康检查
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# 2. 创建 Pool
cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

# 3. 创建 Load Balancer
cfcli load-balancer create \
  --name my-lb \
  --pool-id <us-pool-id> \
  --default-pool-ids <us-pool-id> \
  --fallback-pool-id <fallback-pool-id>

# 4. 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 5. 在所有源站配置 mTLS

# 6. 在 Cloudflare Dashboard 启用 Authenticated Origin Pulls

# 7. 查看状态
cfcli load-balancer list
cfcli health-checks list
cfcli ssl settings
```

---

## 13. 场景九：Full Proxy + ACM + Load Balancer (无 mTLS)

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | 自购买证书 (OV/EV)，通过 ACM 管理 |
| **源站证书** | Origin CA |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ❌ 未启用 |
| **Load Balancer** | ✅ 已启用，多个 Pool |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为 ACM + LB 链路。账户级 Lists 与 ACM 证书、LB 三者完全独立，可任意组合。ACM 多 SAN 证书常对应多业务线，账户级 Lists 可跨 zone 统一管控这些业务线的访问策略。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **LB → Pool** → 源站 |
| 风险 | 恶意 IP 到达 LB → Pool 健康度受损 |
| 适用 | 单业务线、ACM + LB 已覆盖需求 |

**✅ 方案 B：启用账户级 Lists（强烈推荐 · Enterprise）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → Cache → **LB → Pool** → 源站 |
| 跨 Zone 复用 | ✅ 多 LB（多 zone）共享封禁策略 |
| 适用 | ACM 多 SAN 多业务线、多区域 LB、需统一管控 |
| Hostname List | 可用 Hostname List 区分 ACM 不同 SAN 的访问策略 |

**账户级 Lists CLI 配置（方案 B 启用时）：**

```bash
# === 1. 创建账户级 Hostname List (区分 ACM SAN) ===
cfcli ip-lists create --name "acm_lb_hosts" --kind hostname --description "场景九·ACM SAN 主机名"
cfcli ip-lists items add --id <list-id> --items api.example.com app.example.com admin.example.com

# === 2. 创建账户级 IP List (保护 LB Pool) ===
cfcli ip-lists create --name "blocklist_acm_lb" --kind ip
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 3. 在 WAF Custom Rules 引用 ===
# 规则1: (http.host in $cf.hostname_list{name:"acm_lb_hosts"}) and (ip.src in $cf.ip_list{name:"blocklist_acm_lb"}) → Block

# === 4. 账户级 ASN 封禁 ===
cfcli firewall account-access block --target AS12345 --type asn --mode block --notes "场景九·恶意 ASN"

# === 5. ACM + LB 配置 (与 Lists 独立) ===
cfcli certificate upload --name "example.com-ACM" --cert-file ./fullchain.pem --key-file ./privkey.pem
cfcli lb create --name "api-lb" --default-pool <pool-id> --fallback-pool <fallback-id>
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                 场景九：Full Proxy + ACM + Load Balancer (无 mTLS)                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析 (Cloudflare NS 返回 LB 主机名)                           │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站群   │
│  浏览器  │                                                                    │ (多 Pool) │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: 自购买 (OV/EV)       │  │           │
     │                            │  │ · ACM 管理上传                 │  │           │
     │                            │  │ · 显示组织名称 + SAN 自定义   │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets           │  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑪ Load Balancer (LB) ★ 关键节点│  │  │        │
     │                            │  │ · 会话保持 / 地理 / 权重       │  │  │        │
     │                            │  │ · 故障转移 / Health Check     │  │  │        │
     │                            │  └──┬─────────┬─────────┬────────┘  │  │        │
     │                            │     ▼         ▼         ▼           │  │        │
     │                            │  ┌──────┐ ┌──────┐ ┌──────┐         │  │        │
     │                            │  │Pool 1│ │Pool 2│ │Pool 3│         │  │        │
     │                            │  └──┬───┘ └──┬───┘ └──┬───┘         │  │        │
     │                            └─────┼────────┼────────┼─────────────┘  │        │
     │                                  │        │        │                │        │
     │  ⑬ 源站连接 (连接2 · 多 Pool)    │        │        │                │        │
     │                                  ▼        ▼        ▼                │        │
     │                            ┌──────────┐┌──────────┐┌──────────┐    │        │
     │                            │源站 1    ││源站 2    ││源站 3    │◄───┼────────┤
     │                            │美国      ││欧洲      ││亚洲      │    │ Origin │
     │                            │Origin CA ││Origin CA ││Origin CA │    │ CA 证书│
     │                            │(无 mTLS) ││(无 mTLS) ││(无 mTLS) │    │        │
     │                            └──────────┘└──────────┘└──────────┘    │        │
     │                                                                      │        │
     │  ⑭ 响应返回                                                         │        │
     │◄────────────────────────────────────────────────────────────────────┴────────┤
     └─────────────────────────────────────────────────────────────────────────────┘
```

### 详细请求步骤

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (①) → Cloudflare Anycast IP (LB 关联)
    │
    ▼
步骤 3: TCP/QUIC + TLS 握手 (连接1) (②③)
    │ ← 自购买证书 (OV/EV · ACM 管理)
    │ 浏览器验证公共 CA 信任链 + 显示组织名称
    │
    ▼
步骤 4: HTTPS 请求发送 (④)
    │
    ▼
步骤 5: Cloudflare 处理
    ├─ ④ Advanced DDoS Protection
    ├─ ⑤ Bot Management (Ent)
    ├─ ⑥ WAF (Custom + Managed + Rate Limiting)
    ├─ ⑦ Waiting Room (如已配置)
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache · HIT/MISS)
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    └─ ⑩ Workers (如已配置)
    │
    ▼
步骤 6: Load Balancer 决策 (⑪ ★ 关键节点)
    │ · 会话保持 / 地理路由 / 权重 / 故障转移
    │ · Health Check 实时筛选健康 Pool
    │
    ▼
步骤 7: 向选中 Pool 内源站发起请求 (⑬ 连接2)
    │
    ▼
步骤 8: TLS 握手 (连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书
    │ Cloudflare 验证源站证书 (Full Strict)
    │ 注: 无 mTLS
    │
    ▼
步骤 9: 请求转发到源站
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭) → 返回访客
```

### CLI 配置

```bash
# 1. DNS 记录
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# 2. SSL 模式
cfcli ssl set --mode full-strict

# 3. 上传自购买证书 (ACM)
cfcli certificate custom upload \
  --certificate "$(cat certificate.crt)" \
  --private-key "$(cat private.key)" \
  --bundle-method ubiquitous

# 4. 启用 Total TLS
cfcli certificate total-tls enable --ca lets_encrypt

# 5. 创建健康检查
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# 6. 创建 Pool
cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

# 7. 创建 Load Balancer
cfcli load-balancer create \
  --name my-lb \
  --pool-id <us-pool-id> \
  --default-pool-ids <us-pool-id> \
  --fallback-pool-id <fallback-pool-id>

# 8. 查看状态
cfcli certificate custom list
cfcli load-balancer list
cfcli health-checks list
```

---

## 14. 场景十：Full Proxy + ACM + Load Balancer + mTLS

### 配置说明

| 配置项 | 值 |
|--------|-----|
| **DNS** | Full Setup (使用 Cloudflare NS) |
| **代理** | 所有记录 Proxied (橙色云) |
| **边缘证书** | 自购买证书 (OV/EV)，通过 ACM 管理 |
| **源站证书** | Origin CA |
| **SSL 模式** | Full (Strict) |
| **mTLS** | ✅ 已启用 (Authenticated Origin Pulls) |
| **Load Balancer** | ✅ 已启用，多个 Pool |
| **账户级 Lists** | ⚙️ 可选（见下方介入说明） |

### 账户级 Lists 介入说明

> 本场景为企业级完整链路（ACM + LB + mTLS）。账户级 Lists 在 LB 之前执行 Edge 过滤，与 ACM（边缘证书）、LB（分发）、mTLS（源站验证）形成**四层完整企业防护**，是企业 Plan 的最佳实践组合。

**❌ 方案 A：未启用账户级 Lists（默认）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → WAF (仅 zone 级) → Cache → **LB → Pool → mTLS** → 源站 |
| 风险 | 恶意 IP 可能到达 LB → Pool 健康度受损；虽 mTLS 锁源站，但 LB 压力未减 |
| 适用 | 单业务线、ACM + LB + mTLS 已锁定全部链路 |

**✅ 方案 B：启用账户级 Lists（强烈推荐 · Enterprise 最佳实践）**

| 维度 | 说明 |
|------|------|
| 链路行为 | Advanced DDoS Protection → Bot Management → **① 账户级 Access Rules → ② WAF Custom Rules (引用 Rules Lists)** → WAF Managed Rulesets → Cache → **LB → Pool → mTLS** → 源站 |
| 安全层级 | **四层完整防护**: ACM 边缘证书 + Edge 账户级过滤 + LB 分发 + mTLS 源站验证 |
| 跨 Zone 复用 | ✅ 多 LB 共享封禁策略（多区域灾备场景） |
| 适用 | 企业级多业务线 + 多区域 LB + 源站锁定 + 统一封禁策略 |
| Hostname List | 用 Hostname List 区分 ACM 不同 SAN（业务线）的访问策略 |

**账户级 Lists CLI 配置（方案 B 启用时 · 企业级最佳实践）：**

```bash
# === 1. 创建账户级 Hostname List (区分 ACM SAN 业务线) ===
cfcli ip-lists create --name "acm_lb_mtls_hosts" --kind hostname --description "场景十·企业级 ACM SAN 业务线"
cfcli ip-lists items add --id <list-id> --items api.example.com app.example.com admin.example.com

# === 2. 创建账户级 IP List (跨区域 LB 共享封禁) ===
cfcli ip-lists create --name "blocklist_enterprise" --kind ip --description "场景十·跨区域 LB 共享封禁"
cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24

# === 3. 创建账户级 ASN List (恶意 ASN 清单) ===
cfcli ip-lists create --name "bad_asn" --kind asn --description "场景十·恶意 ASN"
cfcli ip-lists items add --id <list-id> --items 12345 67890

# === 4. 在 WAF Custom Rules 引用 (按业务线区分) ===
# 规则1: (http.host in $cf.hostname_list{name:"acm_lb_mtls_hosts"}) and (ip.src in $cf.ip_list{name:"blocklist_enterprise"}) → Block
# 规则2: (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"}) → Block

# === 5. 账户级 ASN 封禁 (直接生效) ===
cfcli firewall account-access block --target AS99999 --type asn --mode block --notes "场景十·恶意 ASN 全账户生效"

# === 6. ACM + LB + mTLS 配置 (与 Lists 独立) ===
cfcli certificate upload --name "example.com-ACM" --cert-file ./fullchain.pem --key-file ./privkey.pem
cfcli lb create --name "api-lb" --default-pool <pool-id> --fallback-pool <fallback-id>
# Authenticated Origin Pulls: SSL/TLS → Origin Server → Enable (LB Pool 源站)
```

### 请求链路图

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│              场景十：Full Proxy + ACM + Load Balancer + mTLS  (企业级完整链路)              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐                                                                    ┌──────────┐
│          │  ① DNS 解析 (Cloudflare NS 返回 LB 主机名)                           │          │
│  访客    │ ──────────────────────────────────────────────────────────────────► │  源站群   │
│  浏览器  │                                                                    │ (mTLS)   │
└──────────┘                                                                    └──────────┘
     │                                                                              ▲
     │  ② TCP/QUIC 握手           ┌─────────────────────────────────────┐           │
     ├───────────────────────────►│  Cloudflare Edge                     │           │
     │                            │                                     │           │
     │  ③ TLS 握手 (连接1)        │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ 边缘证书: 自购买 (OV/EV)       │  │           │
     │                            │  │ · ACM 管理 / 显示组织名称      │  │           │
     │                            │  └───────────────────────────────┘  │           │
     │                            │                                     │           │
     │  ④ HTTPS 请求发送          │  ┌───────────────────────────────┐  │           │
     ├───────────────────────────►│  │ ④ Advanced DDoS Protection    │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑤ Bot Management (Ent)        │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑥ WAF                         │  │           │
     │                            │  │ a. Custom Rules               │  │           │
     │                            │  │ b. Managed Rulesets           │  │           │
     │                            │  │ c. Rate Limiting              │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │ ⑦ Waiting Room (如已配置)      │  │           │
     │                            │  └───────────┬───────────────────┘  │           │
     │                            │              ▼                       │           │
     │                            │  ┌───────────────────────────────┐  │           │
     │                            │  │  ⑧ Cache (Cache Rules/Tiered)  │  │           │
     │                            │  │ · HIT → 直接返回 ──────────────────┼──────────►│ 访客
     │                            │  │ · MISS → 继续 ──────────────────┼──┐        │
     │                            │  └───────────────────────────────┘  │  │        │
     │                            │                                     │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │  ⑨ Ruleset Engine (Redirect/Origin)│  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑩ Workers (如已配置)           │  │  │        │
     │                            │  └───────────┬───────────────────┘  │  │        │
     │                            │              ▼                       │  │        │
     │                            │  ┌───────────────────────────────┐  │  │        │
     │                            │  │ ⑪ Load Balancer (LB) ★ 关键节点│  │  │        │
     │                            │  │ · 会话保持 / 地理 / 权重       │  │  │        │
     │                            │  │ · 故障转移 / Health Check     │  │  │        │
     │                            │  └──┬─────────┬─────────┬────────┘  │  │        │
     │                            │     ▼         ▼         ▼           │  │        │
     │                            │  ┌──────┐ ┌──────┐ ┌──────┐         │  │        │
     │                            │  │Pool 1│ │Pool 2│ │Pool 3│         │  │        │
     │                            │  └──┬───┘ └──┬───┘ └──┬───┘         │  │        │
     │                            └─────┼────────┼────────┼─────────────┘  │        │
     │                                  │        │        │                │        │
     │  ⑬ 源站连接 (连接2 · mTLS)       │        │        │                │        │
     │                                  ▼        ▼        ▼                │        │
     │                            ┌──────────┐┌──────────┐┌──────────┐    │        │
     │                            │源站 1    ││源站 2    ││源站 3    │◄───┼────────┤
     │                            │(mTLS)    ││(mTLS)    ││(mTLS)    │    │Origin CA│
     │                            │CF 客户端 ││CF 客户端 ││CF 客户端 │    │+ CF 客户│
     │                            │证书验证  ││证书验证  ││证书验证  │    │端证书   │
     │                            └──────────┘└──────────┘└──────────┘    │        │
     │                                                                      │        │
     │  ⑭ 响应返回                                                         │        │
     │◄────────────────────────────────────────────────────────────────────┴────────┤
     └─────────────────────────────────────────────────────────────────────────────┘
```

### 详细请求步骤 (企业级完整链路)

```
步骤 1: 用户输入 https://www.example.com
    │
    ▼
步骤 2: DNS 解析 (①) → Cloudflare Anycast IP (LB 关联)
    │
    ▼
步骤 3: TCP/QUIC + TLS 握手 (连接1) (②③)
    │ ← 自购买证书 (OV/EV · ACM 管理)
    │ · 浏览器验证公共 CA 信任链 + CT 日志
    │ · 显示组织名称 (地址栏/证书详情)
    │
    ▼
步骤 4: HTTPS 请求发送 (④)
    │
    ▼
步骤 5: Cloudflare 处理 (完整处理流水线)
    │
    ├─ ④ Advanced DDoS Protection (L3/L4 + L7)
    │
    ├─ ⑤ Bot Management (Enterprise)
    │
    ├─ ⑥ WAF
    │   ├─ a. Custom Rules (IP/国家/URI/ASN)
    │   │   · 可引用 IP Lists (cfcli ip-lists) 作为数据源:
    │   │     - ip / asn / hostname / redirect 四种 kind
    │   │     - 单列表可容纳 10K+ 条目，修改即时生效
    │   ├─ b. Managed Rulesets (Cloudflare Managed Ruleset + OWASP CRS)
    │   └─ c. Rate Limiting Rules
    │
    ├─ ⑦ Waiting Room (如已配置 · 防源站过载)
    │
    ├─ ⑧ Cache (Cache Rules / Smart Tiered Cache)
    │   · HIT → 直接返回 (跳过 LB 和源站)
    │   · MISS → 继续
    │
    ├─ ⑨ Ruleset Engine (Redirect/Transform/Configuration/Origin Rules)
    │   · URL 重写 / Header 修改 / 回源改写
    │
    └─ ⑩ Workers (如已配置 · 边缘 JS 执行)
    │
    ▼
步骤 6: Load Balancer 决策 (⑪ ★ 关键节点)
    │ · 会话保持 (Session Affinity via Cookie)
    │ · 地理路由 (亚洲访客 → Pool 3)
    │ · 权重分配 (按 Pool weight 比例)
    │ · 故障转移 (主 Pool 全离线 → Fallback Pool)
    │ · Health Check 实时筛选健康 Pool
    │
    ▼
步骤 7: 向选中 Pool 内源站发起请求 (⑬ 连接2)
    │
    ▼
步骤 8: mTLS 握手 (连接2: Cloudflare ↔ 源站)
    │ ← Origin CA 证书 (源站身份)
    │ Cloudflare 验证源站证书 (Full Strict)
    │
    │ ── mTLS 特有步骤 (所有源站均配置) ──
    │ ◄── CertificateRequest (源站要求客户端证书)
    │ ── Client Certificate ──► (CF 出示客户端证书)
    │   · 由 Cloudflare Origin CA 签发
    │ ◄── CertificateVerify (源站验证 cloudflare_ca.pem)
    │ ✅ 确认请求来自 Cloudflare (非伪造)
    │
    ▼
步骤 9: 请求转发到源站
    │ 所有源站均通过 mTLS 双向认证
    │ 附加 Header: CF-Connecting-IP / CF-IPCountry / X-Forwarded-For
    │
    ▼
步骤 10: 源站响应 → 步骤 11: 响应处理 (⑭)
    │ · Transform Rules (响应阶段)
    │ · 缓存写入 (按 Cache Rules)
    │ · Brotli/Gzip 压缩
    │ · Image Resizing (如已配置)
    │ 通过连接1返回访客浏览器
```

### 安全层级总结 (企业级完整防护)

```
┌─────────────────────────────────────────────────────────────────────┐
│  防护层级          |  技术                         |  阻挡威胁        │
├─────────────────────────────────────────────────────────────────────┤
│  L3/L4 网络层      |  Anycast + DDoS               |  SYN Flood/UDP  │
│  L7 应用层 (边缘)  |  WAF + Bot Management         |  SQL注入/XSS/Bot│
│  速率限制          |  Rate Limiting                |  暴力破解/CC     │
│  排队保护          |  Waiting Room                 |  源站过载        │
│  连接1 加密        |  自购买 OV/EV 证书 (ACM)      |  中间人/窃听     │
│  连接2 加密        |  Origin CA 证书               |  CF↔源站窃听     │
│  mTLS 双向认证     |  Authenticated Origin Pulls   |  伪造请求直连源站│
│  负载均衡          |  LB + Health Check            |  单点故障        │
└─────────────────────────────────────────────────────────────────────┘
```

### 完整 CLI 配置

```bash
# === 1. DNS 配置 ===
cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied

# === 2. SSL 模式 ===
cfcli ssl set --mode full-strict

# === 3. 上传自购买证书 (ACM) ===
cfcli certificate custom upload \
  --certificate "$(cat certificate.crt)" \
  --private-key "$(cat private.key)" \
  --bundle-method ubiquitous

# === 4. 启用 Total TLS ===
cfcli certificate total-tls enable --ca lets_encrypt

# === 5. 创建健康检查 ===
cfcli health-checks create \
  --name origin-health \
  --address 1.2.3.4 \
  --type http \
  --path /health

# === 6. 创建 Pool ===
cfcli load-balancer pools create \
  --name us-pool \
  --origins-name server1 \
  --origins-address 1.2.3.4

# === 7. 创建 Load Balancer ===
cfcli load-balancer create \
  --name my-lb \
  --pool-id <us-pool-id> \
  --default-pool-ids <us-pool-id> \
  --fallback-pool-id <fallback-pool-id>

# === 8. 配置 mTLS (源站) ===
# 下载 Cloudflare CA
curl -o cloudflare_ca.pem https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem
# 在所有源站配置 ssl_client_certificate 和 ssl_verify_client on

# === 9. 验证状态 ===
cfcli certificate custom list
cfcli load-balancer list
cfcli health-checks list
cfcli ssl settings
```

---

## 15. 特殊场景：Waiting Room 防源站过载详解

> Waiting Room 是 Cloudflare 的源站保护功能，当并发访客数超过源站承载能力时，自动将溢出流量引导至 Cloudflare Edge 托管的排队页面，避免源站被压垮。它在前述 10 个场景中均可以作为"叠加功能"启用，本身不改变 DNS / 证书 / mTLS / LB 的链路结构，只是在 **WAF 之后、Cache 检查之前** 增加一个并发控制节点。

### 15.1 Waiting Room 在请求流水线中的位置

```
… 前置节点 (Advanced DDoS Protection → Bot Management → WAF) …
              │
              ▼
   ┌─────────────────────────────────────────────────┐
   │  ⑦ Waiting Room (如已配置且路径匹配)             │
   │  ┌───────────────────────────────────────────┐  │
   │  │ 1. 路径匹配检查 (Host + Path)              │  │
   │  │    · 匹配 → 进入 Waiting Room 逻辑         │  │
   │  │    · 不匹配 → 跳过 (继续 Cache 检查)       │  │
   │  └─────────────┬─────────────────────────────┘  │
   │                ▼                                 │
   │  ┌───────────────────────────────────────────┐  │
   │  │ 2. 读取当前并发活跃用户数                  │  │
   │  │    · CF Edge 实时统计 (跨 PoP 同步)        │  │
   │  └─────────────┬─────────────────────────────┘  │
   │                ▼                                 │
   │  ┌───────────────────────────────────────────┐  │
   │  │ 3. 判定                                    │  │
   │  │    · 并发 < max_users → 放行 (继续 Cache)  │  │
   │  │    · 并发 ≥ max_users → 进入排队           │  │
   │  └─────────────┬─────────────────────────────┘  │
   │                ▼                                 │
   │  ┌───────────────────────────────────────────┐  │
   │  │ 4a. 排队 (溢出流量)                        │  │
   │  │    · 返回 CF 托管排队页面 (无源站压力)     │  │
   │  │    · 浏览器轮询 / WebSocket 通知           │  │
   │  │    · 源站有空位 → 按队列顺序放行           │  │
   │  └───────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────┘
              │ (放行)
              ▼
   ⑧ Cache 检查 → … 后续节点 (Ruleset Engine / Workers / LB / 源站) …
```

### 15.2 触发场景示例

```
场景: 电商秒杀活动 / 票务开售 / 限时抢购

配置:
  · Waiting Room 路径: /sale/*
  · max_users: 5000        (源站可承载并发)
  · session_duration: 30m  (用户离开后保留会话 30 分钟)
  · queue_all: false       (仅超限用户排队，已在线用户不受影响)
  · queue_action_path: /queue  (排队页面路径)

时间线:
  T0   : 活动开始，瞬时流量 50000 QPS 涌入
  T0+1s: Advanced DDoS Protection → Bot Management 拦截恶意流量 (剩 30000 QPS)
  T0+2s: WAF → 拦截注入/扫描 (剩 28000 QPS)
  T0+3s: Waiting Room 检查 → 并发已达 5000
         · 第 1~5000 名用户 → 放行进入源站
         · 第 5001~28000 名用户 → 进入排队页面 (CF Edge 托管)
  T0+5m: 部分用户完成购买离开 → 源站有空位
         · 排队队列按 FIFO 顺序放行新用户
  T1h  : 流量回落 → 排队清空 → Waiting Room 自动恢复直通
```

### 15.3 Waiting Room 与其它节点的协作

| 节点 | 与 Waiting Room 的关系 |
|------|------------------------|
| **Advanced DDoS Protection** | 先于 Waiting Room 执行，过滤洪水流量，避免排队系统被 DDoS 拖垮 |
| **Bot Management** | 先于 Waiting Room，拦截恶意 Bot，防止 Bot 占满排队名额 |
| **WAF** | 先于 Waiting Room，过滤注入/扫描，避免恶意请求进入排队 |
| **Cache** | 后于 Waiting Room，已放行的请求才检查缓存；HIT 请求不消耗源站并发名额 |
| **Load Balancer** | 后于 Waiting Room，放行后的请求才进入 LB 选 Pool；Waiting Room 防止 LB 后端被打满 |
| **Workers** | 可与 Waiting Room 配合：Worker 在边缘生成动态排队页面，进一步减轻源站压力 |
| **mTLS** | 独立维度，Waiting Room 不影响连接2 的 mTLS 握手 |

### 15.4 三种 Waiting Room 模式

```
┌─────────────────────────────────────────────────────────────────────┐
│  模式                  |  行为                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Queueing (默认)       |  超限用户进入排队页面，等源站有空位后放行     │
│  Reject Requests       |  超限用户直接收到 503，不排队                 │
│  Bypass                |  仅监控并发数，不限制 (用于观察基准)          │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.5 CLI 配置示例

```bash
# 1. 创建 Waiting Room
cfcli waiting-room create \
  --name "秒杀活动排队室" \
  --host example.com \
  --path "/sale/*" \
  --total-active-users 5000 \
  --session-duration 30 \
  --queue-action-path "/queue" \
  --queue-status-method json \
  --queue-all false \
  --description "电商秒杀活动源站保护"

# 2. 查看所有 Waiting Room
cfcli waiting-room list

# 3. 查看某个 Waiting Room 详情 (含当前排队人数)
cfcli waiting-room get --room-id <room-id>

# 4. 修改配置 (如临时提高并发上限)
cfcli waiting-room update \
  --room-id <room-id> \
  --total-active-users 8000

# 5. 启用 / 禁用
cfcli waiting-room enable --room-id <room-id>
cfcli waiting-room disable --room-id <room-id>

# 6. 查看实时排队数据 (Enterprise)
cfcli waiting-room status --room-id <room-id>

# 7. 删除
cfcli waiting-room delete --room-id <room-id>
```

### 15.6 Waiting Room Events (Enterprise)

> Enterprise 计划支持 Waiting Room Events，可预先配置活动开始/结束时间，自动在高峰期启用排队，活动结束后自动关闭。

```bash
# 预约活动 (双 11 秒杀)
cfcli waiting-room events create \
  --room-id <room-id> \
  --name "双11秒杀" \
  --event-start "2026-11-11T00:00:00+08:00" \
  --event-end "2026-11-11T03:00:00+08:00" \
  --total-active-users 10000 \
  --prequeue-start "2026-11-10T23:30:00+08:00" \
  --prequeue-enabled true

# 查看活动列表
cfcli waiting-room events list --room-id <room-id>
```

### 15.7 Waiting Room 适用与不适用场景

| 适用 ✅ | 不适用 ❌ |
|---------|-----------|
| 秒杀/抢购/开售 | 静态资源 (图片/CSS/JS) — 应使用 Cache |
| 票务/限量发售 | API 接口 — 应使用 Rate Limiting |
| 限时注册/报名 | 后台管理页面 — 应使用 Access/Zero Trust |
| 直播/发布会直播页 | 已缓存的 HTML — Cache HIT 不消耗并发 |
| 突发流量高峰保护 | 长连接/WebSocket — 应用 Spectrum/Smart Routing |

### 15.8 与 Load Balancer 叠加的完整链路 (场景十 + Waiting Room)

```
访客 → Advanced DDoS Protection → Bot Management → WAF → Waiting Room (⑦)
                                 │
                                 ▼ (放行)
                              Cache (⑧)
                                 │ MISS
                                 ▼
                              Ruleset Engine (⑨) → Workers (⑩)
                                 │
                                 ▼
                              Load Balancer (⑪)
                                 │
                                 ▼
                              mTLS + Origin Pool (⑬)
                                 │
                                 ▼
                              源站响应 (⑭) → 返回访客

注: Waiting Room 在 LB 之前执行，确保进入 LB 的流量不超过源站群总承载能力。
   即使有多个 Pool，Waiting Room 的并发上限是全局计数 (跨所有 Pool)。
```

---

## 16. 特殊场景：IP Lists 介入 WAF 详解

> IP Lists 是 Cloudflare 提供的可复用列表对象（IP / ASN / Hostname / Redirect 四种 kind），**存储在账户级别**（API: `/accounts/{account_id}/rules/lists`），可跨账户内所有 zone 共享。在 WAF Custom Rules 中作为**匹配数据源**被引用。它本身不直接拦截请求，而是为 Custom Rules 提供大规模、可动态维护的匹配集合，是除 mTLS 之外限制来源到源站的重要补充手段。

### 16.1 IP Lists 在请求流水线中的位置

```
… 前置节点 (Advanced DDoS Protection → Bot Management) …
              │
              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  ⑥ WAF                                                   │
   │  ┌─────────────────────────────────────────────────────┐ │
   │  │ a. Custom Rules (执行时引用 IP Lists)               │ │
   │  │                                                      │ │
   │  │  请求进入 → 读取 cf.ip_list / cf.asn_list / ...      │ │
   │  │           ↓                                          │ │
   │  │  ┌──────────────────────────────────────────────┐    │ │
   │  │  │ IP Lists (预先创建并维护的列表)               │    │ │
   │  │  │ · blocklist (ip)      → 1.2.3.4, 5.6.7.0/24  │    │ │
   │  │  │ · bad_asn (asn)       → AS12345, AS67890      │    │ │
   │  │  │ · allowed_hosts (hostname) → admin.example.com│    │ │
   │  │  │ · maintenance (redirect) → /maintenance.html  │    │ │
   │  │  └──────────────────────────────────────────────┘    │ │
   │  │           ↓                                          │ │
   │  │  匹配判定: (ip.src in $cf.ip_list{name:"blocklist"}) │ │
   │  │           ↓                                          │ │
   │  │  执行动作: Block / Challenge / Log / Bypass          │ │
   │  └─────────────────────────────────────────────────────┘ │
   │  ┌─────────────────────────────────────────────────────┐ │
   │  │ b. Managed Rulesets (OWASP CRS)                     │ │
   │  └─────────────────────────────────────────────────────┘ │
   │  ┌─────────────────────────────────────────────────────┐ │
   │  │ c. Rate Limiting                                     │ │
   │  └─────────────────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────┘
              │
              ▼
   ⑦ Waiting Room → ⑧ Cache → … 后续节点 …
```

### 16.2 四种 List Kind 对比

| Kind | 用途 | 示例条目 | 典型引用方式 |
|------|------|----------|-------------|
| `ip` | 封禁/放行特定 IP 或网段 | `1.2.3.4`、`5.6.7.0/24` | `(ip.src in $cf.ip_list{name:"blocklist"})` |
| `asn` | 基于 ASN 封禁/放行 | `AS12345`、`AS67890` | `(ip.geoip.asnum in $cf.asn_list{name:"bad_asn"})` |
| `hostname` | 基于主机名匹配 | `admin.example.com` | `(http.host in $cf.hostname_list{name:"allowed"})` |
| `redirect` | 重定向到指定 URL | `https://example.com/maintenance.html` | 配合 Custom Rules 重定向动作 |

### 16.3 IP Lists vs 直接在 Custom Rules 写 IP 的对比

```
┌─────────────────────────────────────────────────────────────────────┐
│  对比项              | 直接写 IP              | IP Lists              │
├─────────────────────────────────────────────────────────────────────┤
│  单规则条目上限      | 有限 (表达式长度限制)   | 单列表 10K+ 条目       │
│  修改即时生效        | 需修改规则 (可能影响顺序)│ 列表修改即时生效       │
│  跨规则复用          | ❌ 每规则重复写         | ✅ 多规则引用同一列表  │
│  审计与维护          | 散落在各规则中          | 集中管理 (cfcli ip-lists)│
│  API 批量操作        | ❌                     | ✅ items add 支持批量  │
│  修改历史            | 规则级                 | 列表级 (operation_id)  │
│  适用规模            | < 100 条               | 100 ~ 10000+ 条        │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.4 典型介入场景

#### 场景 A: 大规模 IP 封禁 (替代散落的 Custom Rules)

```
需求: 安全团队提供 5000+ 恶意 IP 清单，需在 WAF 中封禁

传统做法 (不推荐):
  · 在 Custom Rules 中写 5000 条 OR 条件 → 表达式超长，无法保存
  · 或拆成几十条规则 → 难以维护

IP Lists 做法 (推荐):
  1. cfcli ip-lists create --name "blocklist" --kind ip --description "恶意IP清单"
  2. cfcli ip-lists items add --id <list-id> --items 1.2.3.4 5.6.7.0/24 ... --comment "来自威胁情报"
  3. 创建 Custom Rule:
     表达式: (ip.src in $cf.ip_list{name:"blocklist"})
     动作:   Block
  4. 后续更新: 仅维护 IP List，无需改规则
```

#### 场景 B: ASN 级别封禁 (应对某 ISP 大规模攻击)

```
需求: 某攻击来自 AS12345 和 AS67890，需整段封禁

IP Lists 做法:
  1. cfcli ip-lists create --name "bad_asn" --kind asn
  2. cfcli ip-lists items add --id <list-id> --items AS12345 AS67890
  3. Custom Rule:
     表达式: (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"})
     动作:   Managed Challenge
```

#### 场景 C: 维护模式 (仅允许特定主机名访问)

```
需求: 维护期间仅允许 admin.example.com 访问，其它主机名重定向到维护页

IP Lists 做法:
  1. cfcli ip-lists create --name "allowed_hosts" --kind hostname
  2. cfcli ip-lists items add --id <list-id> --items admin.example.com
  3. cfcli ip-lists create --name "maintenance_redirect" --kind redirect
  4. cfcli ip-lists items add --id <list-id> --items https://example.com/maintenance.html
  5. Custom Rule 1 (允许白名单主机):
     表达式: (http.host in $cf.hostname_list{name:"allowed_hosts"})
     动作:   Bypass (跳过后续封禁规则)
  6. Custom Rule 2 (其它主机名重定向):
     表达式: (http.host != "admin.example.com")
     动作:   Redirect to $cf.redirect_list{name:"maintenance_redirect"}
```

### 16.5 CLI 配置示例

```bash
# === 1. 创建 IP List ===
cfcli ip-lists create \
  --name "blocklist" \
  --kind ip \
  --description "恶意 IP 封禁清单"

# === 2. 查看所有 IP Lists ===
cfcli ip-lists list

# === 3. 查看某个 IP List 详情 ===
cfcli ip-lists get --id <list-id>

# === 4. 批量添加 IP 条目 ===
cfcli ip-lists items add \
  --id <list-id> \
  --items 1.2.3.4 5.6.7.0/24 10.0.0.1 \
  --comment "来自威胁情报 2026-08"

# === 5. 查看 IP List 中的条目 ===
cfcli ip-lists items list --id <list-id>

# === 6. 删除特定条目 (需先获取 item-id) ===
cfcli ip-lists items delete --id <list-id> --item-ids <item-id-1> <item-id-2>

# === 7. 删除整个 IP List ===
cfcli ip-lists delete --id <list-id>

# === 8. 创建 ASN 列表 ===
cfcli ip-lists create \
  --name "bad_asn" \
  --kind asn \
  --description "恶意 ASN 清单"

cfcli ip-lists items add \
  --id <asn-list-id> \
  --items AS12345 AS67890

# === 9. 创建 Hostname 列表 ===
cfcli ip-lists create --name "allowed_hosts" --kind hostname
cfcli ip-lists items add --id <host-list-id> --items admin.example.com

# === 10. 创建 Redirect 列表 ===
cfcli ip-lists create --name "maintenance_redirect" --kind redirect
cfcli ip-lists items add --id <redirect-list-id> --items https://example.com/maintenance.html
```

### 16.6 IP Lists 与其它节点的协作

| 节点 | 与 IP Lists 的关系 |
|------|---------------------|
| **Advanced DDoS Protection** | 先于 IP Lists 生效，过滤洪水流量；IP Lists 处理精确 IP 封禁 |
| **Bot Management** | 独立维度，Bot Management 基于行为，IP Lists 基于 IP/ASN 静态匹配 |
| **WAF Custom Rules** | **直接引用 IP Lists** (主要使用场景) |
| **WAF Managed Rulesets** | 不直接引用 IP Lists，但 Custom Rules 的 Skip 可跳过 Managed Rulesets |
| **Rate Limiting** | 独立维度，可结合 IP Lists 实现白名单豁免限速 |
| **Waiting Room** | 独立维度，IP Lists 封禁的请求不会进入 Waiting Room |
| **Cache** | 独立维度，IP Lists 封禁的请求不会到达 Cache 检查 |
| **Load Balancer** | 独立维度，IP Lists 封禁的请求不会进入 LB |
| **mTLS** | 互补关系：IP Lists 在 Edge 拦截，mTLS 在源站验证来源；两者结合可分层防御 |

### 16.7 IP Lists vs mTLS: 限制来源到源站的两种途径对比

> 用户常问: "除了 IP Lists，还有什么途径可以限制来源到 origin server？是 mTLS 吗？"
> 答案: 两者都是，但作用层和机制不同，应组合使用。

```
┌─────────────────────────────────────────────────────────────────────┐
│  对比项              | IP Lists                          | mTLS                │
├─────────────────────────────────────────────────────────────────────┤
│  作用层              | Cloudflare Edge (WAF Custom Rules)│ 源站 TLS 层 (连接2) │
│  机制                | IP/ASN/Hostname 静态匹配           │ 证书双向认证        │
│  拦截位置            | 请求到达源站前 (Edge)              │ 请求到达源站时      │
│  能否绕过            | 直连源站 IP 可绕过 ⚠️              | 无法绕过 (源站强制) │
│  维护成本            | 需持续更新列表                     | 证书签发后长期有效   │
│  粒度                | IP/ASN 级                          │ 证书身份级          │
│  适用场景            | 已知恶意 IP/ASN 封禁               | 强制只接受 CF 流量   │
│  Enterprise 特性     | ✅ 支持                             | ✅ Authenticated Origin Pulls │
└─────────────────────────────────────────────────────────────────────┘

最佳实践: IP Lists + mTLS 组合
  · IP Lists: 在 Edge 拦截已知恶意 IP/ASN (减轻源站压力)
  · mTLS: 在源站强制验证请求来自 Cloudflare (防直连绕过)
  · 防火墙: 源站仅允许 Cloudflare IP 段入站 (cfcli firewall 配置)
  三层结合 → 完整的源站访问控制
```

### 16.8 IP Lists 在前述 10 个场景中的通用介入方式

> IP Lists 在所有 10 个场景中均可叠加启用，本身不改变 DNS / 证书 / mTLS / LB 的链路结构，只是在 **WAF Custom Rules** 阶段增加基于列表的匹配能力。

```
所有场景通用:
  访客 → Advanced DDoS Protection → Bot Management → ⑥ WAF
                         │
                         ├─ a. Custom Rules (引用 IP Lists)
                         │   · (ip.src in $cf.ip_list{name:"blocklist"}) → Block
                         │   · (ip.geoip.asnum in $cf.asn_list{name:"bad_asn"}) → Challenge
                         │
                         ├─ b. Managed Rulesets (Cloudflare Managed Ruleset + OWASP CRS)
                         └─ c. Rate Limiting Rules
                         │
                         ▼ (放行)
                      ⑦ Waiting Room → ⑧ Cache → … 后续节点 …

注: IP Lists 的修改 (items add/delete) 即时生效，无需重新部署 Custom Rules。
   列表规模上限: 单列表 10K+ 条目 (Enterprise 可申请提升)。
```

---

## 17. 账户级 Lists 与 Access Rules：跨 Zone 共享的访问控制

> Cloudflare 的访问控制对象分为两个层级：**账户级（Account-level）** 和 **Zone 级（Zone-level）**。账户级对象应用于账户内**所有 zone**，是 Enterprise运维中统一管控多域名/多业务线的重要手段。本章梳理两类账户级对象的差异、CLI 用法和在请求流水线中的位置。

### 17.1 两类账户级对象总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Cloudflare 账户 (Account)                                                │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  对象1: Rules Lists  (API: /accounts/{id}/rules/lists)              │  │
│  │  · CLI: cfcli ip-lists                                              │  │
│  │  · 存储: 账户级 (跨 zone 共享)                                       │  │
│  │  · Kind: ip / asn / hostname / redirect                             │  │
│  │  · 容量: 单列表 10K+ 条目                                           │  │
│  │  · 引用方式: 在 Custom Rules / Transform Rules 表达式中引用          │  │
│  │  · 引用语法: $cf.ip_list{name:"xxx"}                                │  │
│  │  · 引用场景: WAF Custom Rules, Transform Rules, Bulk Redirects      │  │
│  │  · 适用: 大规模、可复用的匹配数据源                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  对象2: Account Access Rules  (API: /accounts/{id}/firewall/       │  │
│  │                                    access_rules/rules)              │  │
│  │  · CLI: cfcli firewall account-access                               │  │
│  │  · 存储: 账户级 (应用于账户内 ALL zones)                             │  │
│  │  · Target: ip / ip_range / country / asn                           │  │
│  │  · Mode: block / challenge / whitelist / js_challenge              │  │
│  │  · 引用方式: 直接生效，无需在规则中引用                              │  │
│  │  · 引用场景: 旧式访问规则 (类似 WAF Custom Rules 的简化版)           │  │
│  │  · 适用: 快速封禁/放行，无需写表达式                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Zone 级对照 (作为对比)                                              │  │
│  │  · Zone Access Rules: cfcli firewall access                         │  │
│  │    API: /zones/{id}/firewall/access_rules/rules                     │  │
│  │    仅应用于单个 zone                                                 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 17.2 两类对象的关键差异

| 对比项 | Rules Lists (`ip-lists`) | Account Access Rules (`firewall account-access`) |
|--------|--------------------------|--------------------------------------------------|
| **API 路径** | `/accounts/{id}/rules/lists` | `/accounts/{id}/firewall/access_rules/rules` |
| **CLI 命令** | `cfcli ip-lists` | `cfcli firewall account-access` |
| **存储层级** | 账户级（跨 zone 共享） | 账户级（应用于 ALL zones） |
| **数据类型** | ip / asn / hostname / redirect | ip / ip_range / country / asn |
| **作用机制** | 作为数据源，被 Custom Rules 引用 | 直接生效，无需规则引用 |
| **需要写表达式** | ✅ 需要（在 Custom Rules 中） | ❌ 不需要（直接配置 target+mode） |
| **支持 Hostname** | ✅ 支持 | ❌ 不支持 |
| **支持 Redirect** | ✅ 支持（配合 Bulk Redirects） | ❌ 不支持 |
| **容量上限** | 单列表 10K+ 条目 | 账户级规则数受限 |
| **更新即时性** | 修改列表即时生效 | 修改规则即时生效 |
| **跨规则复用** | ✅ 一个 List 可被多条规则引用 | ❌ 一条规则一个 target |
| **适用场景** | 大规模、多维度匹配 | 快速简单封禁/放行 |
| **Enterprise** | ✅ 支持 | ✅ 支持 |

### 17.3 在请求流水线中的位置对照

```
访客 → Advanced DDoS Protection → Bot Management → ⑥ WAF
                         │
                         ├─ a. Custom Rules
                         │   │
                         │   ├─ 引用 Rules Lists (ip-lists) ★ 数据源
                         │   │   · (ip.src in $cf.ip_list{name:"blocklist"})
                         │   │   · 跨 zone 共享同一个 list
                         │   │
                         │   └─ Account Access Rules (firewall account-access)
                         │       · 独立执行，不依赖 Custom Rules 表达式
                         │       · 在请求处理早期阶段生效 (与 Custom Rules 同层)
                         │       · 应用于账户内 ALL zones
                         │
                         ├─ b. Managed Rulesets (Cloudflare Managed Ruleset + OWASP CRS)
                         └─ c. Rate Limiting Rules
                         │
                         ▼
                      ⑦ Waiting Room → ⑧ Cache → … 后续节点 …

注: Rules Lists 和 Account Access Rules 都在 WAF 阶段生效，但机制不同：
   · Rules Lists: 被动数据源，需 Custom Rules 引用才生效
   · Account Access Rules: 主动规则，配置即生效
```

### 17.4 账户级 Access Rules CLI 配置示例

```bash
# === 1. 列出账户级 Access Rules (应用于 ALL zones) ===
cfcli firewall account-access list

# 按模式过滤
cfcli firewall account-access list --mode block

# JSON 输出 (适合脚本处理)
cfcli firewall account-access list --json

# === 2. 在账户级封禁 IP (所有 zone 生效) ===
cfcli firewall account-access block \
  --target 1.2.3.4 \
  --type ip \
  --mode block \
  --notes "恶意 IP · 全账户封禁"

# === 3. 在账户级封禁 IP 网段 ===
cfcli firewall account-access block \
  --target 5.6.7.0/24 \
  --type ip_range \
  --mode block \
  --notes "恶意网段 · 全账户封禁"

# === 4. 在账户级封禁国家 (所有 zone 屏蔽该国家) ===
cfcli firewall account-access block \
  --target CN \
  --type country \
  --mode challenge \
  --notes "地理限制 · 访客需通过 Challenge"

# === 5. 在账户级封禁 ASN ===
cfcli firewall account-access block \
  --target AS12345 \
  --type asn \
  --mode block \
  --notes "恶意 ASN · 全账户封禁"

# === 6. 在账户级白名单 (跳过安全检查) ===
cfcli firewall account-access block \
  --target 203.0.113.0/24 \
  --type ip_range \
  --mode whitelist \
  --notes "公司办公网 · 全账户白名单"

# === 7. 更新账户级规则 (如从 block 改为 challenge) ===
cfcli firewall account-access update \
  --id <rule-id> \
  --mode challenge \
  --notes "改为 Challenge 模式"

# === 8. 删除账户级规则 ===
cfcli firewall account-access delete --id <rule-id>
```

### 17.5 Rules Lists CLI 配置示例（账户级 · 跨 zone 共享）

```bash
# === 1. 创建账户级 IP List (可被账户内任意 zone 的 Custom Rules 引用) ===
cfcli ip-lists create \
  --name "blocklist" \
  --kind ip \
  --description "账户级恶意 IP 清单 · 跨 zone 共享"

# === 2. 添加条目 (修改即时生效，所有引用此 list 的 Custom Rules 同步更新) ===
cfcli ip-lists items add \
  --id <list-id> \
  --items 1.2.3.4 5.6.7.0/24 \
  --comment "威胁情报 2026-08"

# === 3. 查看账户内所有 Lists ===
cfcli ip-lists list

# === 4. 在 zone A 的 Custom Rules 中引用 (表达式) ===
#    (ip.src in $cf.ip_list{name:"blocklist"}) → Block

# === 5. 在 zone B 的 Custom Rules 中引用 (同一 list，无需重复创建) ===
#    (ip.src in $cf.ip_list{name:"blocklist"}) → Block

# === 6. 创建 ASN List (跨 zone 共享) ===
cfcli ip-lists create --name "bad_asn" --kind asn
cfcli ip-lists items add --id <list-id> --items AS12345 AS67890

# === 7. 创建 Hostname List (跨 zone 共享) ===
cfcli ip-lists create --name "allowed_hosts" --kind hostname
cfcli ip-lists items add --id <list-id> --items admin.example.com admin.another.com

# === 8. 创建 Redirect List (配合 Bulk Redirects 使用) ===
cfcli ip-lists create --name "maintenance_redirect" --kind redirect
cfcli ip-lists items add --id <list-id> --items https://example.com/maintenance.html
```

### 17.6 何时用 Rules Lists vs Account Access Rules

```
┌─────────────────────────────────────────────────────────────────────────┐
│  场景                                          | 推荐方案                │
├─────────────────────────────────────────────────────────────────────────┤
│  封禁单个 IP                                   | Account Access Rules    │
│  (快速操作，无需写表达式)                       | (cfcli firewall         │
│                                                 |  account-access block)  │
├─────────────────────────────────────────────────────────────────────────┤
│  封禁 5000+ 恶意 IP                            | Rules Lists             │
│  (大规模数据，需跨规则复用)                     | (cfcli ip-lists)        │
├─────────────────────────────────────────────────────────────────────────┤
│  封禁某国家 (全账户)                            | Account Access Rules    │
│  (简单 country + mode)                         | (type=country)          │
├─────────────────────────────────────────────────────────────────────────┤
│  封禁某 ASN (需在多条规则中复用)                | Rules Lists             │
│                                                 | (kind=asn)              │
├─────────────────────────────────────────────────────────────────────────┤
│  基于主机名的白名单/黑名单                      | Rules Lists             │
│                                                 | (kind=hostname)         │
├─────────────────────────────────────────────────────────────────────────┤
│  维护期间重定向到维护页                         | Rules Lists             │
│                                                 | (kind=redirect)         │
├─────────────────────────────────────────────────────────────────────────┤
│  同一封禁策略需在多个 zone 复用                 | Rules Lists             │
│  (跨 zone 共享)                                 | (账户级，一处维护)      │
├─────────────────────────────────────────────────────────────────────────┤
│  临时快速封禁某 IP (全账户)                     | Account Access Rules    │
│  (应急响应，立即生效)                           | (无需写表达式)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 17.7 账户级对象与 zone 级对象的叠加优先级

```
请求处理顺序 (从早到晚):

  ① 账户级 Access Rules (account-access)
       ↓ (未拦截则继续)
  ② Zone 级 Access Rules (firewall access)
       ↓
  ③ WAF Custom Rules (可能引用 Rules Lists)
       ↓
  ④ WAF Managed Rulesets (Cloudflare Managed Ruleset + OWASP CRS)
       ↓
  ⑤ Rate Limiting Rules
       ↓
  ⑥ Waiting Room → Cache → … 后续 …

说明:
  · 账户级规则先于 zone 级规则执行
  · 账户级规则若 Block，请求不会到达 zone 级规则
  · 账户级规则若 Whitelist，会跳过后续所有安全检查 (慎用)
  · Rules Lists 本身无优先级，取决于引用它的 Custom Rules 的执行顺序
  · 同一 IP 同时命中账户级 Block 和 zone 级 Whitelist:
    账户级 Block 先执行 → 请求被拦截 (Whitelist 不生效)
```

### 17.8 与其它节点的协作

| 节点 | Account Access Rules | Rules Lists (ip-lists) |
|------|----------------------|------------------------|
| **Advanced DDoS Protection** | DDoS 先执行，过滤洪水流量 | DDoS 先执行 |
| **Bot Management** | 独立维度 | 独立维度 |
| **WAF Custom Rules** | 同层执行 (账户级先于 zone 级) | **被 Custom Rules 引用** |
| **Cache** | 封禁的请求不达 Cache | 封禁的请求不达 Cache |
| **Waiting Room** | 封禁的请求不进 Waiting Room | 封禁的请求不进 Waiting Room |
| **mTLS** | 互补：Edge 拦截 + 源站验证 | 互补：Edge 拦截 + 源站验证 |
| **跨 zone** | ✅ 应用于 ALL zones | ✅ 同一 list 可被多 zone 规则引用 |

### 17.9 企业级最佳实践：三层访问控制

```
┌─────────────────────────────────────────────────────────────────────┐
│  三层访问控制 (Enterprise 最佳实践)                                   │
├─────────────────────────────────────────────────────────────────────┤
│  层1: 账户级 Rules Lists (cfcli ip-lists)                            │
│       · 维护大规模 IP/ASN/Hostname 黑白名单                          │
│       · 跨 zone 共享，一处维护                                       │
│       · 在 Custom Rules 中引用                                       │
│       · 适合: 威胁情报订阅、长期封禁清单                              │
├─────────────────────────────────────────────────────────────────────┤
│  层2: 账户级 Access Rules (cfcli firewall account-access)            │
│       · 快速应急封禁单个 IP/国家/ASN                                 │
│       · 应用于 ALL zones，无需写表达式                                │
│       · 适合: 突发攻击应急响应、临时封禁                              │
├─────────────────────────────────────────────────────────────────────┤
│  层3: mTLS (Authenticated Origin Pulls)                              │
│       · 源站强制验证请求来自 Cloudflare                               │
│       · 防止直连源站 IP 绕过 CF                                       │
│       · 适合: 源站访问控制底线                                        │
├─────────────────────────────────────────────────────────────────────┤
│  补充: 源站防火墙仅允许 Cloudflare IP 段入站                          │
│       · cfcli firewall access (zone 级)                              │
│       · 配合 ip-lists 维护 CF IP 段                                   │
└─────────────────────────────────────────────────────────────────────┘

完整防御链路:
  访客 → Advanced DDoS Protection → 账户级 Access Rules → WAF Custom Rules (引用 Rules Lists)
       → Managed Rulesets → Rate Limiting Rules → Waiting Room → Cache → LB
       → mTLS → 源站 (仅允许 CF IP)

  任何一层拦截 → 请求不会到达源站
  全部通过 → 源站通过 mTLS 确认请求来自 CF，再处理请求
```

---

## 18. 场景对比总结

### 证书使用对比

| 场景 | DNS类型 | 边缘证书 | 源站证书 | mTLS | Load Balancer |
|------|---------|---------|---------|------|-------------|
| 场景一 | Full Setup | Universal SSL (Cloudflare) | Origin CA | ❌ | ❌ |
| 场景二 | Full Setup | Universal SSL (Cloudflare) | Origin CA | ✅ | ❌ |
| 场景三 | Full Setup | 自购买证书 (ACM) | Origin CA | ❌ | ❌ |
| 场景四 | Full Setup | 自购买证书 (ACM) | Origin CA | ✅ | ❌ |
| 场景五 | Partial (CNAME) | Universal SSL (Cloudflare) | Origin CA | ❌ | ❌ |
| 场景六 | Partial (CNAME) | Universal SSL (Cloudflare) | Origin CA | ✅ | ❌ |
| 场景七 | Full Setup | Universal SSL 或 ACM | Origin CA | ❌ | ✅ |
| 场景八 | Full Setup | Universal SSL 或 ACM | Origin CA | ✅ | ✅ |
| 场景九 | Full Setup | 自购买证书 (ACM) | Origin CA | ❌ | ✅ |
| 场景十 | Full Setup | 自购买证书 (ACM) | Origin CA | ✅ | ✅ |

### 请求链路对比

| 场景 | DNS 解析 | 边缘 TLS | 源站 TLS | 负载均衡 | mTLS |
|------|---------|---------|---------|---------|------|
| 场景一 | Cloudflare NS | Universal SSL | Origin CA | ❌ | ❌ |
| 场景二 | Cloudflare NS | Universal SSL | Origin CA | ❌ | ✅ |
| 场景三 | Cloudflare NS | 自购买证书 | Origin CA | ❌ | ❌ |
| 场景四 | Cloudflare NS | 自购买证书 | Origin CA | ❌ | ✅ |
| 场景五 | 原 NS + CNAME | Universal SSL | Origin CA | ❌ | ❌ |
| 场景六 | 原 NS + CNAME | Universal SSL | Origin CA | ❌ | ✅ |
| 场景七 | Cloudflare NS | Universal/ACM | Origin CA | ✅ | ❌ |
| 场景八 | Cloudflare NS | Universal/ACM | Origin CA | ✅ | ✅ |
| 场景九 | Cloudflare NS | 自购买证书 | Origin CA | ✅ | ❌ |
| 场景十 | Cloudflare NS | 自购买证书 | Origin CA | ✅ | ✅ |

### 安全级别对比

| 场景 | 安全级别 | 适用场景 |
|------|---------|---------|
| 场景一 | ⭐⭐⭐ | 基础保护，个人网站 |
| 场景二 | ⭐⭐⭐⭐ | 需要源站认证 |
| 场景三 | ⭐⭐⭐⭐ | 自定义证书，企业级 |
| 场景四 | ⭐⭐⭐⭐⭐ | 自定义证书 + mTLS |
| 场景五 | ⭐⭐⭐ | Partial Setup 基础 |
| 场景六 | ⭐⭐⭐⭐ | Partial Setup + mTLS |
| 场景七 | ⭐⭐⭐⭐ | 负载均衡 + 故障转移 |
| 场景八 | ⭐⭐⭐⭐⭐ | 负载均衡 + mTLS |
| 场景九 | ⭐⭐⭐⭐ | ACM + 负载均衡 |
| 场景十 | ⭐⭐⭐⭐⭐ | 完整保护组合，企业级 |

### 选择建议

| 需求 | 推荐场景 |
|------|---------|
| **基础保护** | 场景一或场景五 |
| **最高安全性** | 场景十 |
| **全球负载均衡** | 场景七或场景八 |
| **自定义证书** | 场景三或场景四 |
| **已有 DNS 提供商** | 场景五或场景六 |
| **企业级应用** | 场景十 |

---

## 19. 行业衍生场景一：金融行业（多活 DR + 等保四级 + 跨境支付）

### 19.1 业务场景与合规要求

| 维度 | 要求 |
|------|------|
| **业务类型** | 商业银行核心系统、证券交易、保险理赔、跨境支付 |
| **典型域名** | `bank.nc-demo.cf`、`trade.nc-demo.cf`、`pay.nc-demo.cf` |
| **可用性** | RPO = 0（零数据丢失）、RTO < 5 min、全年可用性 ≥ 99.99% |
| **合规框架** | 等保 2.0 四级、PCI-DSS v4.0、个人金融信息保护技术规范（JR/T 0171）、人行《网上银行系统信息安全通用规范》 |
| **数据驻留** | 境内金融数据不得出境（数据安全法 + 个人信息保护法） |
| **审计要求** | 全量日志留存 ≥ 6 个月、操作可追溯、SIEM 接入 |
| **特殊威胁** | DDoS 勒索、APT 攻击、自动化交易攻击（高频刷单、撞库）、内鬼交易 |

### 19.2 多活 DR 架构（北京 + 上海 + 深圳）

```
┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge (全球 320+ 城市)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Advanced DDoS│→ │ Bot Mgmt     │→ │ WAF Ruleset  │         │
│  │ Protection   │  │ (Bot Score)  │  │ Engine       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ API Shield   │→ │ Waiting Room │→ │ Cache + Ruleset │      │
│  │ (JWT+Schema) │  │ (峰值排队)   │  │ (Transform)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────────────────────────────────────┐             │
│  │  Load Balancer (Geo Steering + Health Check) │             │
│  │  北京用户 → 北京 Pool / 上海用户 → 上海 Pool  │             │
│  │  故障 → 深圳 Pool (Fallback)                  │             │
│  └──────────────────────────────────────────────┘             │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ Argo Smart  │→ │ mTLS (AOP)   │                          │
│  │ Routing     │  │              │                          │
│  └──────────────┘  └──────────────┘                          │
└────────────┬─────────────────┬─────────────────┬─────────────┘
             │                 │                 │
       ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
       │ 北京源站   │     │ 上海源站   │     │ 深圳源站   │
       │ (Active)  │     │ (Active)  │     │ (Standby) │
       │ 核心交易   │     │ 核心交易   │     │ 灾备切换   │
       └───────────┘     └───────────┘     └───────────┘
```

### 19.3 完整请求链路图（金融级 16 段流水线）

```
访客 (HTTPS 请求)
  │
  ▼
[1] Cloudflare Anycast DNS (geo-aware) ──── DNSSEC 启用、防 DNS 劫持
  │
  ▼
[2] TCP/QUIC 接入 ──── HTTP/3 over QUIC、TLS 1.3、0-RTT 禁用（防重放）
  │
  ▼
[3] TLS 握手 (边缘证书 ACM) ──── ECC 证书、HSTS、OCSP Stapling
  │
  ▼
[4] Advanced DDoS Protection (L3/L4) ──── 网络层洪水攻击缓解（Ent 永久免费、无计量）
  │
  ▼
[5] Advanced DDoS Protection (L7 HTTP) ──── HTTP 洪水、Slowloris、HTTP 放大
  │
  ▼
[6] Bot Management (Ent) ──── Bot Score (1-99)、JA3/JA4 指纹、Machine Learning 检测
  │                              评分 < 10 → Challenge / Block
  │                              检测自动化交易攻击（高频下单、刷单）
  ▼
[7] WAF · Ruleset Engine
  │  ├─ Custom Rules (Phase http_request_transform)
  │  │   └─ 国家白名单（仅允许境内 + 港澳台）
  │  ├─ Managed Rulesets (Phase http_request_firewall_managed)
  │  │   ├─ Cloudflare Managed Ruleset (OWASP Top 10)
  │  │   ├─ Cloudflare Exposed Credentials Check
  │  │   └─ Cloudflare Payment Fraud Detection (Beta)
  │  └─ Rate Limiting Rules (Phase http_ratelimit)
  │      └─ /api/login: 5次/分钟、/api/transfer: 10次/分钟
  ▼
[8] API Shield (Ent)
  │  ├─ OpenAPI Schema Validation ── 字段类型/必填校验
  │  ├─ JSON Web Token (JWT) Validation ── 过期/签名校验
  │  ├─ Schema Validation (Positive/Negative Security Model)
  │  └─ Sequence Analysis ── 检测异常 API 调用顺序（撞库、暴力破解）
  ▼
[9] Waiting Room (Ent) ──── 仅在双 11 / 节日理财高峰启用
  │                          total_active_users=50000、session_duration=15
  ▼
[10] Cache ──── Smart Tiered Cache、Cache Reserve (Ent)、Polish（图片优化）
  │              静态资源缓存、API 响应默认不缓存
  ▼
[11] Ruleset Engine (Transform Phase)
  │  ├─ URL Rewrite Rules
  │  ├─ HTTP Request Header Modification (注入 X-Forwarded-For、CF-Connecting-IP)
  │  └─ HTTP Response Header Modification (CSP、X-Frame-Options、Referrer-Policy)
  ▼
[12] Workers (Ent) ──── 边缘汇率转换、风控预处理、JWT 解析
  │                       Workers Unbound（30 秒 CPU 时间）
  ▼
[13] Load Balancer (Ent) ──── Geo Steering + Health Check
  │  ├─ 北京 Pool (权重 50%) ← 北京用户
  │  ├─ 上海 Pool (权重 50%) ← 上海用户
  │  └─ 深圳 Pool (Fallback) ← 北京/上海均故障时启用
  ▼
[14] Argo Smart Routing (Ent) ──── 智能路由、降低延迟 30%+
  │
  ▼
[15] mTLS (Authenticated Origin Pulls) ──── Cloudflare 证书 → 源站校验
  │                                       源站仅接受 Cloudflare IP + mTLS 双重验证
  ▼
[16] 源站 (北京/上海/深圳) ──── Nginx + 核心交易系统
  │                              ssl_client_certificate / ssl_verify_client on
  │                              real_ip_header CF-Connecting-IP
  ▼
响应回流 → Ruleset Engine (Response Phase) → TLS 关闭 → 访客
```

### 19.4 关键配置详解

#### 19.4.1 ACM 边缘证书（多 SAN 通配符）

```bash
# === 上传银行自购买证书（含多个 SAN） ===
cfcli ssl upload-custom-cert --zone nc-demo.cf \
  --cert-file ./bank.nc-demo.cf.crt \
  --key-file ./bank.nc-demo.cf.key \
  --bundle true

# === 启用 Total TLS（自动覆盖所有代理主机名） ===
cfcli ssl total-tls --zone nc-demo.cf --enable true

# === 设置最低 TLS 版本为 1.3 ===
cfcli ssl min-tls-version --zone nc-demo.cf --version 1.3

# === 启用 HSTS ===
cfcli ssl hsts --zone nc-demo.cf \
  --enable true \
  --max-age 31536000 \
  --include-subdomains true \
  --preload true
```

#### 19.4.2 mTLS 双向认证（Authenticated Origin Pulls）

```bash
# 1. 下载 Cloudflare Origin CA 证书
cfcli ssl download-origin-ca --output ./origin-pull-ca.pem

# 2. 在所有源站 Nginx 配置
# ssl_client_certificate /etc/nginx/ssl/origin-pull-ca.pem;
# ssl_verify_client on;
# ssl_verify_depth 2;

# 3. 在 Cloudflare 启用 Authenticated Origin Pulls
cfcli ssl authenticated-origin-pulls --zone nc-demo.cf --enable true

# 4. 验证
cfcli ssl authenticated-origin-pulls --zone nc-demo.cf --status
```

#### 19.4.3 Bot Management（防自动化交易攻击）

```bash
# === Bot Management (Ent) 启用 ===
cfcli bot-mgmt enable --zone nc-demo.cf --mode "managed"

# === WAF Custom Rule: 拦截恶意 Bot ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "block-malicious-bots" \
  --expression '(cf.bot_management.score < 10) and (http.request.uri.path contains "/api/")' \
  --action "block" \
  --description "拦截 Bot Score < 10 的自动化交易请求"

# === WAF Custom Rule: 高风险操作要求 JS Challenge ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "high-risk-challenge" \
  --expression '(cf.bot_management.score < 30) and (http.request.uri.path contains "/api/transfer")' \
  --action "js_challenge" \
  --description "大额转账路径对低信任 Bot 进行 JS 验证"

# === JA3/JA4 指纹封禁（已知恶意工具） ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "block-known-attack-tools" \
  --expression '(cf.ja3_hash in $cf.ja3_list{name:"known_attack_tools"})' \
  --action "block"
```

#### 19.4.4 API Shield（JWT + Schema + Sequence Analysis）

```bash
# === 启用 API Shield ===
cfcli api-shield enable --zone nc-demo.cf

# === 上传 OpenAPI Schema ===
cfcli api-shield schema upload --zone nc-demo.cf \
  --file ./openapi-bank.yaml \
  --name "bank-api-v2"

# === 启用 Schema Validation ===
cfcli api-shield schema-validation --zone nc-demo.cf \
  --schema-id <schema-id> \
  --action block \
  --mitigate-missing-schema true

# === JWT Validation ===
cfcli api-shield jwt-validation --zone nc-demo.cf \
  --jwks-url "https://auth.nc-demo.cf/.well-known/jwks.json" \
  --enable true

# === Sequence Analysis（检测撞库、暴力破解） ===
cfcli api-shield sequence-analysis --zone nc-demo.cf \
  --enable true \
  --sensitivity high \
  --action js_challenge
```

#### 19.4.5 Load Balancer Geo Steering（三地多活）

```bash
# === 1. 创建健康检查（每 10 秒检测一次） ===
cfcli lb health-check create \
  --name "bank-hc" \
  --type https \
  --path "/healthz" \
  --interval 10 \
  --timeout 5 \
  --retries 2 \
  --expected-code 200

# === 2. 创建北京 Pool ===
cfcli lb pool create \
  --name "beijing-pool" \
  --origins "1.1.1.1:443,1.1.1.2:443" \
  --health-check-id <hc-id> \
  --notification-email "ops@nc-demo.cf"

# === 3. 创建上海 Pool ===
cfcli lb pool create \
  --name "shanghai-pool" \
  --origins "2.2.2.1:443,2.2.2.2:443" \
  --health-check-id <hc-id>

# === 4. 创建深圳 Pool（Fallback） ===
cfcli lb pool create \
  --name "shenzhen-pool" \
  --origins "3.3.3.1:443,3.3.3.2:443" \
  --health-check-id <hc-id>

# === 5. 创建 Load Balancer（Geo Steering） ===
cfcli lb create --zone nc-demo.cf \
  --name "bank-lb" \
  --steering geo \
  --default-pool <bj-pool-id> \
  --fallback-pool <sz-pool-id> \
  --region-pools "CN-BJ:<bj-pool-id>,CN-SH:<sh-pool-id>" \
  --pop-pools "LAX:<us-pool-id>,HKG:<hk-pool-id>"
```

#### 19.4.6 Data Localization Suite（数据驻留）

```bash
# === 启用 Data Localization Suite (Ent) ===
cfcli data-localization enable --zone nc-demo.cf --region "CN"

# === 配置 Regional Services（仅中国边缘节点处理） ===
cfcli data-localization regional-services --zone nc-demo.cf \
  --region "CN" \
  --services "waf,bot-mgmt,cache,workers" \
  --logpush-region "CN"

# === 配置 Audit Logs 仅存境内 ===
cfcli data-localization audit-logs --zone nc-demo.cf --region "CN"
```

### 19.5 合规对应表（等保 2.0 四级 → Cloudflare 控制项）

| 等保四级控制项 | Cloudflare 对应功能 | 实现方式 |
|--------------|---------------------|---------|
| **8.1.3 网络边界防护** | Advanced DDoS Protection (L3/L4 + L7) | Ent 永久缓解、L7 Managed Ruleset |
| **8.1.4 访问控制** | WAF Custom Rules + Account Access Rules | IP/ASN/Country 白名单 |
| **8.1.5 入侵防范** | WAF Managed Ruleset + Bot Management | OWASP Top 10 + Bot Score |
| **8.1.6 恶意代码防范** | WAF Managed Ruleset + Page Shield | 防页面注入恶意 JS |
| **8.1.7 安全审计** | Logpush to SIEM + Audit Logs | 全量 HTTP 日志推送至 SIEM |
| **8.1.10 数据完整性** | mTLS (AOP) + TLS 1.3 | 边缘到源站双向认证 |
| **8.1.11 数据保密性** | TLS 1.3 + ACM + HSTS | 全链路加密 |
| **8.1.13 可信接入** | API Shield + JWT Validation | API 调用身份认证 |
| **8.1.15 剩余信息保护** | Cache Reserve + Cache Key 自定义 | 敏感数据不缓存 |
| **8.1.18 个人信息保护** | Data Localization Suite | 金融数据不出境 |
| **8.1.20 备份与恢复** | Load Balancer + Geo Steering + Health Check | 多活 DR、自动故障切换 |

### 19.6 跨境支付专线（与境外银行 SWIFT 对接）

```bash
# === Argo Smart Routing 启用（降低跨境延迟） ===
cfcli argo smart-routing --zone nc-demo.cf --enable true

# === Argo Tiered Caching ===
cfcli argo tiered-cache --zone nc-demo.cf --enable true

# === Workers 边缘汇率转换 ===
cfcli workers deploy --zone nc-demo.cf \
  --name "fx-converter" \
  --script ./workers/fx-converter.js \
  --routes "pay.nc-demo.cf/fx/*"

# === 跨境路径专用 WAF 规则 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "cross-border-pay" \
  --expression '(http.host eq "pay.nc-demo.cf") and (not ip.geoip.country in {"CN" "HK" "MO" "TW"})' \
  --action "block" \
  --description "跨境支付仅允许境内 + 港澳台访问"
```

### 19.7 灾备演练流程（每季度执行）

| 阶段 | 活动 | 预期结果 |
|------|------|---------|
| T-7 天 | 通知监管机构、备份当前配置 | 演练方案审批 |
| T-1 天 | 配置快照、健康检查确认 | 所有源站健康 |
| T+0 | 模拟北京源站故障（关闭 LB Pool） | Health Check 10s 内检测、流量切换深圳 |
| T+30s | 验证 RTO | 用户无感知、错误率 < 0.1% |
| T+5min | 验证数据一致性 | 核心交易数据零丢失 (RPO=0) |
| T+10min | 恢复北京源站、流量回切 | 流量按 Geo Steering 恢复 |
| T+1h | 演练报告 | 提交监管机构备案 |

### 19.8 监控与告警

```bash
# === Logpush 到 SIEM (Splunk / ELK) ===
cfcli logpush create --zone nc-demo.cf \
  --destination "splunk://siem.bank.internal:8088" \
  --dataset "http_requests,firewall_events,nel_reports" \
  --logpull-options "fields=ClientIP,ClientRequestPath,EdgeResponseStatus,WAFAction,BotScore" \
  --frequency 60

# === 告警：错误率突增 ===
cfcli notification create --zone nc-demo.cf \
  --name "high-error-rate" \
  --type "http_status_5xx" \
  --threshold 1 \
  --window 5 \
  --email "oncall@nc-demo.cf" \
  --webhook "https://hooks.slack.com/services/xxx"

# === 告警：DDoS 检测 ===
cfcli notification create --zone nc-demo.cf \
  --name "ddos-detected" \
  --type "ddos_alert" \
  --email "sec-team@nc-demo.cf"
```

---

## 20. 行业衍生场景二：政企行业（数据本地化 + Magic Transit + 合规）

### 20.1 业务场景与合规要求

| 维度 | 要求 |
|------|------|
| **业务类型** | 政务服务门户、税务申报、社保查询、公共资源交易、电子证照 |
| **典型域名** | `gov.nc-demo.cf`、`tax.nc-demo.cf`、`social.nc-demo.cf` |
| **合规框架** | 等保 2.0 三级（部分四级）、数据安全法、个人信息保护法、关基条例、电子政务外网规范 |
| **数据驻留** | 政务数据严格境内驻留、政务云专区 |
| **特殊要求** | 国密算法支持（SM2/SM3/SM4）、信创兼容、IPv6 双栈 |
| **访问群体** | 公众用户（C 端）+ 政务办公（B 端）+ 跨部门数据交换（G 端） |

### 20.2 网络层接入：Magic Transit 保护政务专网

```
┌──────────────────────────────────────────────────────────────┐
│                  公众互联网 + 政务外网                         │
└────────────┬─────────────────────────────────────────────────┘
             │ BGP Anycast 接入
             ▼
┌──────────────────────────────────────────────────────────────┐
│              Cloudflare Magic Transit (Ent)                   │
│  ┌──────────────────────────────────────────────────┐        │
│  │  Anycast 网络（吸收 L3/L4 DDoS 攻击）              │        │
│  │  网段 100.64.0.0/16 ← 政务源站公网 IP             │        │
│  │  所有入站流量经 Cloudflare 边缘节点                │        │
│  └──────────────────────────────────────────────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Advanced DDoS│→ │ WAF          │→ │ Bot Mgmt     │        │
│  │ (Magic Transit) │ (Ruleset)   │  │ (政府版)      │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ Access       │→ │ Data         │                         │
│  │ (Zero Trust) │  │ Localization │                         │
│  └──────────────┘  └──────────────┘                         │
└────────────┬─────────────────────────────────────────────────┘
             │ GRE Tunnel / Anycast 回源
             ▼
┌──────────────────────────────────────────────────────────────┐
│            政务云专区（境内合规数据中心）                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ 政务门户  │  │ 税务系统  │  │ 社保系统  │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

### 20.3 完整请求链路图（政务级 14 段流水线）

```
公众用户 (HTTPS 请求)
  │
  ▼
[1] Cloudflare Anycast DNS ──── DNSSEC、防 DNS 劫持
  │
  ▼
[2] Magic Transit 接入 ──── BGP Anycast、L3/L4 攻击吸收
  │                         网段级保护（非单 IP）
  ▼
[3] TCP/QUIC + TLS 1.3 ──── 国密 SM2 证书（部分场景）+ ECC 证书
  │
  ▼
[4] Advanced DDoS Protection (L3/L4 + L7)
  │
  ▼
[5] Bot Management (Ent) ──── 识别爬虫、防政务数据爬取
  │
  ▼
[6] WAF · Ruleset Engine
  │  ├─ Custom Rules: 仅允许境内 IP（部分开放港澳台）
  │  ├─ Managed Ruleset: OWASP Top 10
  │  └─ Rate Limiting: 防政务接口刷量
  ▼
[7] Access (Zero Trust) ──── 公务员办公接入
  │  ├─ SSO 集成（OAuth2 / SAML）
  │  ├─ 设备指纹 + mTLS 客户端证书
  │  └─ 多因素认证（MFA）
  ▼
[8] Cache + Smart Tiered Cache ──── 政务公开信息缓存
  │
  ▼
[9] Ruleset Engine (Transform) ──── 注入政务请求头、URL 改写
  │
  ▼
[10] Workers ──── 边缘身份转换、数据脱敏
  │
  ▼
[11] Data Localization Suite ──── 数据仅在境内边缘处理
  │                              日志推送至境内 SIEM
  ▼
[12] Argo Smart Routing ──── 智能路由
  │
  ▼
[13] GRE Tunnel 回源 ──── Magic Transit GRE 隧道到政务云
  │
  ▼
[14] 政务源站 ──── 政务云专区、等保三级合规
```

### 20.4 关键配置详解

#### 20.4.1 Magic Transit 配置

```bash
# === 1. 创建 Magic Transit Tunnel ===
cfcli magic-transit tunnel create \
  --name "gov-tunnel" \
  --customer-ip "100.64.0.1/32" \
  --customer-network "100.64.0.0/16" \
  --tunnel-type gre \
  --mtu 1476

# === 2. 添加 GRE Tunnel 端点 ===
cfcli magic-transit tunnel endpoint add \
  --tunnel-id <tunnel-id> \
  --customer-endpoint "203.0.113.1" \
  --cloudflare-endpoint "auto" \
  --ttl 64

# === 3. 配置 Static Route ===
cfcli magic-transit static-route create \
  --prefix "100.64.0.0/16" \
  --tunnel-id <tunnel-id> \
  --priority 100

# === 4. 配置 ACL（仅允许政务流量） ===
cfcli magic-transit acl create \
  --name "gov-acl" \
  --action allow \
  --source "100.64.0.0/16" \
  --destination "0.0.0.0/0" \
  --protocol any

# === 5. 启用 Advanced DDoS Protection（Magic Transit 内置） ===
cfcli magic-transit ddos-protection --tunnel-id <tunnel-id> --enable true
```

#### 20.4.2 Data Localization Suite（数据境内驻留）

```bash
# === 1. 启用 Data Localization Suite ===
cfcli data-localization enable --zone nc-demo.cf --region "CN"

# === 2. 配置 Regional Services ===
cfcli data-localization regional-services --zone nc-demo.cf \
  --region "CN" \
  --services "waf,bot-mgmt,cache,workers,rate-limiting" \
  --logpush-region "CN"

# === 3. 配置 CNAME Flattening（避免 DNS 出境） ===
cfcli dns cname-flattening --zone nc-demo.cf --enable true

# === 4. 配置 Logpush 到境内 SIEM ===
cfcli logpush create --zone nc-demo.cf \
  --destination "https://siem.gov.internal:9200/_bulk" \
  --dataset "http_requests,firewall_events,audit_logs" \
  --region "CN" \
  --frequency 60
```

#### 20.4.3 Access (Zero Trust) 内部办公接入

```bash
# === 1. 创建 Access Application（保护内部 OA 系统） ===
cfcli access app create --zone nc-demo.cf \
  --name "gov-oa" \
  --domain "oa.gov.nc-demo.cf" \
  --session-duration 8h \
  --type self-hosted

# === 2. 配置身份提供商（IdP） ===
cfcli access idp create --zone nc-demo.cf \
  --name "gov-idp" \
  --type saml \
  --metadata-url "https://idp.gov.internal/metadata" \
  --sign-in-attribute "email"

# === 3. 创建访问策略（仅公务员可访问） ===
cfcli access policy create --zone nc-demo.cf \
  --app-id <app-id> \
  --name "civil-servant-only" \
  --action allow \
  --decision-block \
  --include 'email-domain "gov.cn"' \
  --require 'mfa' \
  --session-duration 8h

# === 4. 启用设备姿态检查（Posture Check） ===
cfcli access device-posture create --zone nc-demo.cf \
  --name "gov-device-check" \
  --type disk_encryption \
  --require true \
  --platform windows
```

#### 20.4.4 WAF 政务专用规则

```bash
# === 1. 仅允许境内 + 港澳台访问 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "cn-only" \
  --expression '(not ip.geoip.country in {"CN" "HK" "MO" "TW"}) and (http.host contains "gov.nc-demo.cf")' \
  --action "block" \
  --description "政务服务仅对境内 + 港澳台开放"

# === 2. 防政务数据爬取 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "anti-scraping" \
  --expression '(cf.bot_management.score < 30) and (http.request.uri.path contains "/api/records")' \
  --action "managed_challenge"

# === 3. 政务接口限流 ===
cfcli waf rate-limit create --zone nc-demo.cf \
  --name "gov-api-rl" \
  --expression '(http.request.uri.path contains "/api/")' \
  --characteristics 'ip.src,http.request.uri.path' \
  --limit 100 \
  --period 60 \
  --action "block"
```

### 20.5 合规对应表（等保 2.0 三级 + 数据安全法）

| 合规要求 | Cloudflare 对应功能 | 实现方式 |
|---------|---------------------|---------|
| **等保三级 8.1.2 网络边界** | Magic Transit + Advanced DDoS Protection | 网段级防护 + L3/L4 攻击吸收 |
| **等保三级 8.1.3 访问控制** | WAF + Access (Zero Trust) | 公众端 IP/国家限制、办公端 SSO+MFA |
| **等保三级 8.1.4 入侵防范** | WAF Managed Ruleset + Bot Management | OWASP Top 10 + 爬虫防护 |
| **等保三级 8.1.5 恶意代码防范** | Page Shield + WAF | 防页面注入 |
| **等保三级 8.1.6 安全审计** | Logpush + Audit Logs | 全量日志推送至 SIEM |
| **数据安全法 第 31 条** | Data Localization Suite | 政务数据不出境 |
| **个人信息保护法 第 40 条** | Data Localization + Workers 脱敏 | 边缘脱敏后再回源 |
| **关基条例 第 19 条** | Magic Transit + Spectrum | 关键基础设施网络层防护 |
| **电子政务外网规范** | Access (Zero Trust) | 替代传统 VPN |

### 20.6 与等级保护三级控制项详细映射

| 等保三级控制域 | 控制项 | Cloudflare 实现 |
|--------------|--------|----------------|
| **安全通信网络** | 8.1.1 网络架构 | Anycast 分布式架构、Magic Transit 网段防护 |
| **安全通信网络** | 8.1.2 通信传输 | TLS 1.3、mTLS、国密 SM2 证书 |
| **安全区域边界** | 8.1.3 边界防护 | Advanced DDoS Protection、WAF |
| **安全区域边界** | 8.1.4 访问控制 | Custom Rules、Access Policies |
| **安全区域边界** | 8.1.5 入侵防范 | Managed Ruleset、Bot Management |
| **安全区域边界** | 8.1.6 恶意代码防范 | Page Shield、WAF |
| **安全区域边界** | 8.1.7 安全审计 | Logpush、Audit Logs |
| **安全计算环境** | 8.1.8 身份鉴别 | Access SSO + MFA |
| **安全计算环境** | 8.1.10 数据完整性 | mTLS、TLS 1.3 |
| **安全计算环境** | 8.1.11 数据保密性 | TLS 1.3、ACM、Data Localization |
| **安全管理中心** | 8.1.15 集中管控 | Logpush to SIEM、API 集中管理 |

### 20.7 内部办公零信任接入（替代传统 VPN）

| 传统 VPN 方案 | Cloudflare Access 方案 |
|--------------|----------------------|
| 网络层接入（一旦进入即全互通） | 应用层接入（按应用授权） |
| 静态证书 / 账号 | SSO + MFA + 设备姿态 |
| 集中 VPN 网关（单点故障） | Anycast 分布式（无单点） |
| 长连接、客户端维护 | 浏览器即可、零客户端 |
| 难以审计到应用层 | 每次访问完整审计日志 |
| 跨境访问性能差 | 全球 320+ POP 就近接入 |

---

## 21. 行业衍生场景三：电力公司（OT/ICS + Spectrum + 关键基础设施保护）

### 21.1 业务场景与合规要求

| 维度 | 要求 |
|------|------|
| **业务类型** | 电网调度自动化、SCADA 系统、配电网监控、变电站远程控制、电力市场交易、营销客服系统 |
| **典型域名** | `dispatch.nc-demo.cf`、`scada.nc-demo.cf`、`market.nc-demo.cf`、`service.nc-demo.cf` |
| **OT 协议** | IEC 60870-5-104 (TCP 2404)、Modbus TCP (TCP 502)、DNP3 (TCP 20000)、IEC 61850 MMS (TCP 102)、OPC UA (TCP 4840) |
| **合规框架** | 《关键信息基础设施安全保护条例》、《电力监控系统安全防护规定》(国能安全 [2015] 36 号)、IEC 62443 工控安全标准、《网络安全法》、等保 2.0 三级（部分四级） |
| **安全分区** | 生产控制大区（安全区 I/II）+ 管理信息大区（安全区 III/IV）+ 互联网大区，**严格物理/逻辑隔离** |
| **特殊要求** | 横向隔离（正向/反向隔离装置）、纵向认证（IPsec VPN）、国密算法 SM2/SM3/SM4 |
| **可用性** | 调度自动化系统 RTO < 30s、全年可用性 ≥ 99.999% |

### 21.2 OT/IT 融合安全架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                        互联网用户 / 远程运维工程师                       │
└────────────┬──────────────────────────────────┬───────────────────────┘
             │ HTTPS (管理信息大区)              │ TCP/UDP (OT 协议)
             ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge (Ent)                              │
│  ┌────────────────────────────────────────────────────────┐          │
│  │  Anycast 网络 (320+ POP)                                │          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │          │
│  │  │ Advanced DDoS│→ │ Spectrum     │→ │ Magic Transit│  │          │
│  │  │ Protection   │  │ (TCP/UDP)    │  │ (网段级)     │  │          │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │          │
│  │  │ WAF Ruleset  │→ │ Bot Mgmt     │→ │ Access       │  │          │
│  │  │ (HTTP 业务)  │  │ (管理信息区)  │  │ (Zero Trust) │  │          │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │          │
│  │  ┌──────────────┐  ┌──────────────┐                    │          │
│  │  │ Workers     │→ │ Logpush to   │                    │          │
│  │  │ (边缘计算)  │  │ SIEM         │                    │          │
│  │  └──────────────┘  └──────────────┘                    │          │
│  └────────────────────────────────────────────────────────┘          │
└──────────┬───────────────────────────────┬───────────────────────────┘
           │                               │
   ┌───────▼───────┐               ┌───────▼───────┐
   │ 管理信息大区   │               │ 生产控制大区   │
   │ (安全区 III/IV)│               │ (安全区 I/II) │
   │               │               │               │
   │ 营销客服系统   │               │ SCADA 系统    │
   │ 电力市场交易   │               │ EMS/DMS       │
   │ ERP/OA        │               │ 变电站自动化   │
   └───────────────┘               └───────────────┘
        ↑                                  ↑
        │                                  │
        └──── 反向隔离装置 (物理隔离) ──────┘
              仅允许单向数据流（生产 → 管理）
```

### 21.3 完整请求链路图（电力 OT/IT 双栈 18 段流水线）

```
[场景 A: 管理信息大区 - HTTPS 业务（营销客服 / 电力市场）]

访客 (HTTPS 请求)
  │
  ▼
[1] Cloudflare Anycast DNS ──── DNSSEC、防 DNS 劫持
  │
  ▼
[2] Advanced DDoS Protection (L3/L4) ──── Magic Transit 网段级防护
  │
  ▼
[3] TCP/QUIC + TLS 1.3 ──── ECC 证书、HSTS
  │
  ▼
[4] Advanced DDoS Protection (L7 HTTP)
  │
  ▼
[5] Bot Management (Ent) ──── 识别自动化攻击、爬虫
  │
  ▼
[6] WAF · Ruleset Engine ──── OWASP Top 10 + Custom Rules
  │
  ▼
[7] Access (Zero Trust) ──── 电力公司员工接入
  │  ├─ SSO (LDAP / AD 集成)
  │  ├─ mTLS 客户端证书（工程师站）
  │  └─ 设备姿态检查（仅公司设备）
  ▼
[8] Cache + Smart Tiered Cache
  │
  ▼
[9] Ruleset Engine (Transform) ──── 注入工程师身份头
  │
  ▼
[10] Workers ──── 边缘权限校验
  │
  ▼
[11] Argo Smart Routing
  │
  ▼
[12] mTLS (AOP) ──── Cloudflare → 管理信息大区源站
  │
  ▼
[13] 管理信息大区源站 ──── 等保三级合规

[场景 B: 生产控制大区 - OT 协议业务（SCADA / 变电站远程控制）]

工程师站 (IEC 104 / Modbus TCP / DNP3)
  │
  ▼
[14] Cloudflare Anycast ──── 通过 Spectrum 接入
  │
  ▼
[15] Spectrum (TCP/UDP Proxy) ──── 非 HTTP 协议代理
  │  ├─ Modbus TCP (Port 502)
  │  ├─ IEC 60870-5-104 (Port 2404)
  │  ├─ DNP3 (Port 20000)
  │  ├─ IEC 61850 MMS (Port 102)
  │  └─ OPC UA (Port 4840)
  │
  ▼
[16] Advanced DDoS Protection (L3/L4) ──── 针对 OT 协议的洪水攻击
  │
  ▼
[17] Spectrum ACL + IP 白名单 ──── 仅允许授权工程师站 IP
  │  ├─ 基于 mTLS 客户端证书
  │  └─ 基于 IP 白名单（工程师站固定 IP）
  ▼
[18] 生产控制大区源站 ──── SCADA / EMS / 变电站自动化
                            纵深认证（IPsec VPN + 国密 SM2）
```

### 21.4 关键配置详解

#### 21.4.1 Spectrum 配置（保护 OT 协议）

```bash
# === 1. 创建 Spectrum Application: Modbus TCP ===
cfcli spectrum app create --zone nc-demo.cf \
  --name "modbus-tcp" \
  --protocol "tcp/502" \
  --traffic-type "tcp" \
  --ip-protocol "tcp" \
  --origin-port 502 \
  --origin-direct "203.0.113.10:502" \
  --tls "off" \
  --ip-whitelist "198.51.100.0/24,203.0.113.0/24"

# === 2. 创建 Spectrum Application: IEC 60870-5-104 ===
cfcli spectrum app create --zone nc-demo.cf \
  --name "iec104" \
  --protocol "tcp/2404" \
  --traffic-type "tcp" \
  --origin-port 2404 \
  --origin-direct "203.0.113.11:2404" \
  --tls "off" \
  --ip-whitelist "198.51.100.0/24"

# === 3. 创建 Spectrum Application: DNP3 ===
cfcli spectrum app create --zone nc-demo.cf \
  --name "dnp3" \
  --protocol "tcp/20000" \
  --traffic-type "tcp" \
  --origin-port 20000 \
  --origin-direct "203.0.113.12:20000" \
  --tls "off" \
  --ip-whitelist "198.51.100.0/24"

# === 4. 创建 Spectrum Application: OPC UA (mTLS) ===
cfcli spectrum app create --zone nc-demo.cf \
  --name "opc-ua" \
  --protocol "tcp/4840" \
  --traffic-type "tcp" \
  --origin-port 4840 \
  --origin-direct "203.0.113.13:4840" \
  --tls "on" \
  --tls-cert-id <cert-id> \
  --mtls "on" \
  --mtls-cert-id <client-ca-cert-id>

# === 5. 启用 Spectrum DDoS Protection ===
cfcli spectrum ddos-protection --zone nc-demo.cf --enable true
```

#### 21.4.2 Magic Transit 配置（生产控制大区网段防护）

```bash
# === 1. 创建 Magic Transit Tunnel（生产控制大区专用） ===
cfcli magic-transit tunnel create \
  --name "ot-tunnel" \
  --customer-ip "10.0.0.1/32" \
  --customer-network "10.0.0.0/8" \
  --tunnel-type gre \
  --mtu 1476

# === 2. 配置 ACL（仅允许工程师站网段访问 OT 协议） ===
cfcli magic-transit acl create \
  --name "ot-engineer-access" \
  --action allow \
  --source "198.51.100.0/24" \
  --destination "10.0.0.0/8" \
  --protocol "tcp" \
  --port "502,2404,20000,102,4840"

# === 3. 拒绝其他所有访问 ===
cfcli magic-transit acl create \
  --name "ot-deny-all" \
  --action deny \
  --source "0.0.0.0/0" \
  --destination "10.0.0.0/8" \
  --protocol "any"
```

#### 21.4.3 Access (Zero Trust) 工程师站接入

```bash
# === 1. 创建 Access Application（保护 SCADA Web HMI） ===
cfcli access app create --zone nc-demo.cf \
  --name "scada-hmi" \
  --domain "scada.nc-demo.cf" \
  --session-duration 4h \
  --type self-hosted

# === 2. 配置 LDAP/AD IdP ===
cfcli access idp create --zone nc-demo.cf \
  --name "ad-idp" \
  --type ldap \
  --server "ldap://ad.power.internal:389" \
  --base-dn "OU=Engineers,DC=power,DC=internal" \
  --bind-dn "CN=cf-svc,OU=Service,DC=power,DC=internal"

# === 3. 创建访问策略（仅调度员 + 工程师） ===
cfcli access policy create --zone nc-demo.cf \
  --app-id <app-id> \
  --name "dispatcher-only" \
  --action allow \
  --decision-block \
  --include 'groups "调度员"' \
  --require 'mfa,device-cert' \
  --session-duration 4h

# === 4. 设备姿态检查（仅公司配发的工程师站） ===
cfcli access device-posture create --zone nc-demo.cf \
  --name "engineer-workstation" \
  --type "domain_joined" \
  --domain "power.internal" \
  --require true

cfcli access device-posture create --zone nc-demo.cf \
  --name "endpoint-protection" \
  --type "disk_encryption" \
  --require true \
  --platform all

cfcli access device-posture create --zone nc-demo.cf \
  --name "os-version" \
  --type "os_version" \
  --min-version "Windows 10 22H2" \
  --require true
```

#### 21.4.4 WAF 电力专用规则

```bash
# === 1. 仅允许电力公司内网工程师站访问 SCADA ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "scada-internal-only" \
  --expression '(http.host eq "scada.nc-demo.cf") and (not ip.src in $cf.ip_list{name:"engineer_stations"})' \
  --action "block" \
  --description "SCADA HMI 仅允许工程师站访问"

# === 2. 电力市场交易接口限流 ===
cfcli waf rate-limit create --zone nc-demo.cf \
  --name "market-rl" \
  --expression '(http.host eq "market.nc-demo.cf") and (http.request.uri.path contains "/api/trade")' \
  --characteristics 'ip.src,http.request.uri.path' \
  --limit 20 \
  --period 60 \
  --action "block"

# === 3. 防电力数据爬取 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "anti-scraping-power-data" \
  --expression '(cf.bot_management.score < 30) and (http.request.uri.path contains "/api/grid-data")' \
  --action "managed_challenge"
```

#### 21.4.5 Logpush 到 SIEM（电力监控安全审计）

```bash
# === 1. Logpush HTTP 日志 ===
cfcli logpush create --zone nc-demo.cf \
  --destination "https://siem.power.internal:9200/_bulk" \
  --dataset "http_requests,firewall_events,spectrum_events" \
  --logpull-options "fields=ClientIP,ClientRequestPath,EdgeResponseStatus,WAFAction,SpectrumApp" \
  --frequency 60

# === 2. Logpush Magic Transit 流量日志 ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://power-siem/magic-transit/" \
  --dataset "magic_transit_logs" \
  --frequency 60

# === 3. Audit Logs 推送 ===
cfcli logpush create --zone nc-demo.cf \
  --destination "https://siem.power.internal:9200/audit/_bulk" \
  --dataset "audit_logs" \
  --frequency 60
```

### 21.5 合规对应表（关基条例 + 国能安全 36 号 + IEC 62443）

| 合规要求 | 条款 | Cloudflare 对应功能 | 实现方式 |
|---------|------|---------------------|---------|
| **关基条例** 第 19 条 | 网络安全保护义务 | Magic Transit + Spectrum | 网段级 + 协议级防护 |
| **关基条例** 第 22 条 | 安全事件报告 | Logpush + Notifications | 实时日志推送、告警 |
| **关基条例** 第 25 条 | 网络安全应急预案 | Health Check + LB Fallback | 自动故障切换 |
| **国能安全 36 号** 第 5 条 | 安全分区 | Access + Spectrum | 管理区与生产区逻辑隔离 |
| **国能安全 36 号** 第 6 条 | 纵向认证 | mTLS + Access MFA | 双向认证 + 多因素 |
| **国能安全 36 号** 第 7 条 | 横向隔离 | Cloudflare 边缘代理 | 替代传统正向/反向隔离 |
| **IEC 62443 SL3** | 区域边界防护 | WAF + Bot Management | 应用层防护 |
| **IEC 62443 SL3** | 通信完整性 | mTLS + TLS 1.3 | 双向认证 |
| **IEC 62443 SL3** | 使用控制 | Access + 设备姿态 | 仅授权设备接入 |
| **IEC 62443 SL3** | 数据机密性 | TLS 1.3 + ACM | 全链路加密 |
| **等保三级** 8.1.2 | 网络边界 | Advanced DDoS + Magic Transit | 多层防护 |
| **等保三级** 8.1.7 | 安全审计 | Logpush to SIEM | 全量日志留存 |

### 21.6 纵深防御三道防线（电力行业最佳实践）

| 防线 | 位置 | 防护措施 | Cloudflare 功能 |
|------|------|---------|----------------|
| **第一道防线** | Cloudflare Edge | 网络/传输层防护 | Advanced DDoS Protection、Magic Transit、Spectrum |
| **第二道防线** | Cloudflare Edge | 应用层防护 | WAF、Bot Management、API Shield、Access |
| **第三道防线** | 源站 | 系统层防护 | mTLS、IP 白名单、Host-based IDS、国密 IPsec VPN |

### 21.7 OT 协议安全加固对照表

| OT 协议 | 默认端口 | 风险 | Cloudflare 加固方式 |
|---------|---------|------|---------------------|
| **Modbus TCP** | 502 | 无认证、无加密 | Spectrum + IP 白名单 + mTLS |
| **IEC 60870-5-104** | 2404 | 无认证、明文传输 | Spectrum + IP 白名单 + Access |
| **DNP3** | 20000 | Secure Auth 可选 | Spectrum + IP 白名单 + mTLS |
| **IEC 61850 MMS** | 102 | 部分认证 | Spectrum + mTLS |
| **OPC UA** | 4840 | 支持加密 | Spectrum + TLS + mTLS |

### 21.8 与电力监控系统安全防护规定对照

| 国能安全 36 号条款 | 要求 | Cloudflare 实现 |
|------------------|------|----------------|
| 第 5 条 安全分区 | 生产控制大区与管理信息大区逻辑隔离 | Spectrum + Access 分域授权 |
| 第 6 条 纵向认证 | 跨区通信需认证 | mTLS + Access MFA + 设备姿态 |
| 第 7 条 横向隔离 | 不同安全区之间物理/逻辑隔离 | Cloudflare 边缘代理 + WAF Custom Rules |
| 第 9 条 入侵检测 | 部署入侵检测系统 | WAF Managed Ruleset + Bot Management + Logpush to SIEM |
| 第 10 条 漏洞扫描 | 定期漏洞扫描 | WAF Managed Ruleset 持续更新 |
| 第 11 条 安全审计 | 全量审计日志 | Logpush + Audit Logs |

---

## 22. 行业衍生场景四：支付行业（PCI-DSS + API Shield + 高并发抢购）

### 22.1 业务场景与合规要求

| 维度 | 要求 |
|------|------|
| **业务类型** | 支付卡在线充值、商户收款、电子钱包、跨境支付、移动支付（含粤港澳大湾区场景） |
| **典型域名** | `pay.hkpay.nc-demo.cf`、`topup.hkpay.nc-demo.cf`、`merchant.hkpay.nc-demo.cf`、`api.hkpay.nc-demo.cf` |
| **日均交易** | 1500 万笔交易、高峰期（早晚高峰地铁）5000 TPS |
| **合规框架** | **PCI-DSS v4.0**（持卡人数据保护）、**支付行业监管《支付系统的监管指引》**（支付行业监管机构）、**PDPO 香港个人资料（私隐）条例》、SSDPA 新加坡支付服务法案（如适用跨境）、ISO 27001 |
| **数据驻留** | 香港境内驻留、跨境需符合 PDPO 个人资料转移 |
| **可用性** | RPO = 0、RTO < 2 min、全年可用性 ≥ 99.99% |
| **特殊威胁** | DDoS 勒索、黄牛抢购（节日优惠卡）、撞库攻击、API 滥用、支付欺诈、PSD2 强认证要求 |

### 22.2 多层架构（边缘 + API 网关 + 后端核心）

```
┌──────────────────────────────────────────────────────────────────────┐
│  用户终端                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 支付 App    │  │ 网页充值  │  │ 商户 POS │  │ 闸机 / 终端 │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
└────────────┬─────────────────────────────────────────────────────────┘
             │ HTTPS / HTTPS API
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge (Ent)                              │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  L3/L4 防护层                                             │         │
│  │  ┌──────────────┐  ┌──────────────┐                     │         │
│  │  │ Advanced DDoS│→ │ Magic Transit│                     │         │
│  │  │ Protection   │  │ (网段级)     │                     │         │
│  │  └──────────────┘  └──────────────┘                     │         │
│  └─────────────────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  L7 防护层                                               │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │         │
│  │  │ Bot Mgmt     │→ │ WAF Ruleset  │→ │ API Shield   │   │         │
│  │  │ (黄牛检测)   │  │ (OWASP+RL)   │  │ (Schema+JWT) │   │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │         │
│  └─────────────────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  流量管理层                                               │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │         │
│  │  │ Waiting Room │→ │ Rate Limiting│→ │ Load Balancer│   │         │
│  │  │ (高峰排队)   │  │ (per-endpoint)│  │ (多区域)     │   │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │         │
│  └─────────────────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  边缘计算层                                               │         │
│  │  ┌──────────────┐  ┌──────────────┐                    │         │
│  │  │ Workers     │→ │ Argo Smart  │                    │         │
│  │  │ (风控预处理)│  │ Routing     │                    │         │
│  │  └──────────────┘  └──────────────┘                    │         │
│  └─────────────────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  回源层                                                   │         │
│  │  ┌──────────────┐                                       │         │
│  │  │ mTLS (AOP)   │                                       │         │
│  │  └──────────────┘                                       │         │
│  └─────────────────────────────────────────────────────────┘         │
└──────────┬─────────────────────────────────────┬─────────────────────┘
           │                                     │
   ┌───────▼───────┐                     ┌───────▼───────┐
   │ 香港数据中心    │                     │ 新加坡 DR      │
   │ (Primary)     │                     │ (DR)          │
   │               │                     │               │
   │ 支付核心系统   │                     │ 支付核心系统   │
   │ 卡务管理       │                     │ (热备)        │
   │ 闸机接口       │                     │               │
   └───────────────┘                     └───────────────┘
```

### 22.3 完整请求链路图（支付级 18 段流水线）

```
用户 (支付 App / 网页 / POS / 闸机)
  │
  ▼
[1] Cloudflare Anycast DNS ──── DNSSEC、HK + SG POP 优先
  │
  ▼
[2] Magic Transit 接入 ──── 网段级 L3/L4 DDoS 防护
  │
  ▼
[3] TCP/QUIC + TLS 1.3 ──── ACM 证书、ECC、HSTS、OCSP Stapling
  │                         0-RTT 禁用（防支付重放攻击）
  ▼
[4] Advanced DDoS Protection (L3/L4) ──── Ent 永久缓解、无计量
  │
  ▼
[5] Advanced DDoS Protection (L7 HTTP) ──── HTTP 洪水、Slowloris
  │
  ▼
[6] Bot Management (Ent) ──── Bot Score (1-99)、JA3/JA4 指纹
  │                              检测黄牛抢购、自动化充值工具
  │                              评分 < 10 → Block
  ▼
[7] WAF · Ruleset Engine
  │  ├─ Custom Rules (Phase http_request_transform)
  │  │   ├─ 国家白名单（HK + CN 大湾区 + 澳门）
  │  │   └─ 支付路径强制 HTTPS
  │  ├─ Managed Rulesets (Phase http_request_firewall_managed)
  │  │   ├─ Cloudflare Managed Ruleset (OWASP Top 10)
  │  │   ├─ Cloudflare Exposed Credentials Check
  │  │   └─ Cloudflare Payment Fraud Detection (Beta)
  │  └─ Rate Limiting Rules (Phase http_ratelimit)
  │      ├─ /api/topup: 10次/分钟
  │      ├─ /api/payment: 20次/分钟
  │      └─ /api/login: 5次/分钟
  ▼
[8] API Shield (Ent) ──── 支付 API 专用防护
  │  ├─ OpenAPI Schema Validation ── 字段类型/必填校验
  │  ├─ JSON Web Token (JWT) Validation ── 过期/签名校验
  │  ├─ Schema Validation (Positive Security Model)
  │  └─ Sequence Analysis ── 检测异常支付流程
  ▼
[9] Waiting Room (Ent) ──── 仅在节日优惠 / 抢购高峰启用
  │                          total_active_users=100000
  │                          session_duration=10
  │                          queueing_method=brotli+fifo
  ▼
[10] Cache + Smart Tiered Cache ──── 静态资源缓存、API 不缓存
  │                              Cache Reserve (Ent)
  ▼
[11] Ruleset Engine (Transform Phase)
  │  ├─ HTTP Request Header Modification (注入 CF-Connecting-IP)
  │  └─ HTTP Response Header Modification
  │      ├─ CSP (Content-Security-Policy)
  │      ├─ X-Frame-Options: DENY
  │      ├─ X-Content-Type-Options: nosniff
  │      ├─ Referrer-Policy: strict-origin-when-cross-origin
  │      └─ Strict-Transport-Security
  ▼
[12] Workers (Ent) ──── 边缘风控预处理
  │  ├─ 设备指纹采集
  │  ├─ 用户行为分析
  │  ├─ 汇率转换（跨境支付）
  │  └─ JWT 解析与权限校验
  ▼
[13] Load Balancer (Ent) ──── Geo Steering + Health Check
  │  ├─ 香港 Pool (主) ← HK + CN 用户
  │  └─ 新加坡 Pool (DR) ← HK 故障时切换
  ▼
[14] Argo Smart Routing (Ent) ──── 智能路由、降低延迟
  │
  ▼
[15] mTLS (Authenticated Origin Pulls) ──── Cloudflare → 源站双向认证
  │                                       防止源站被绕过攻击
  ▼
[16] 香港源站 ──── 支付核心系统
  │  ├─ PCI-DSS v4.0 合规
  │  ├─ 卡务管理（卡号加密存储）
  │  ├─ 闸机 / 终端接口
  │  └─ 商户 POS 接口
  ▼
[17] 响应回流 → Ruleset Engine (Response Phase)
  │  └─ HTTP Response Header Modification
  ▼
[18] TLS 关闭 → 用户
```

### 22.4 关键配置详解

#### 22.4.1 ACM 边缘证书（支付专用）

```bash
# === 上传 EV 证书（Extended Validation，支付行业最佳实践） ===
cfcli ssl upload-custom-cert --zone nc-demo.cf \
  --cert-file ./hkpay-pay.crt \
  --key-file ./hkpay-pay.key \
  --bundle true

# === 启用 Total TLS（覆盖所有子域） ===
cfcli ssl total-tls --zone nc-demo.cf --enable true

# === 最低 TLS 1.3 ===
cfcli ssl min-tls-version --zone nc-demo.cf --version 1.3

# === HSTS ===
cfcli ssl hsts --zone nc-demo.cf \
  --enable true \
  --max-age 63072000 \
  --include-subdomains true \
  --preload true

# === OCSP Stapling ===
cfcli ssl ocsp-stapling --zone nc-demo.cf --enable true
```

#### 22.4.2 API Shield（支付 API 专用防护）

```bash
# === 1. 启用 API Shield ===
cfcli api-shield enable --zone nc-demo.cf

# === 2. 上传 OpenAPI Schema（支付 API） ===
cfcli api-shield schema upload --zone nc-demo.cf \
  --file ./openapi-hkpay.yaml \
  --name "hkpay-pay-v3"

# === 3. 启用 Schema Validation（严格模式） ===
cfcli api-shield schema-validation --zone nc-demo.cf \
  --schema-id <schema-id> \
  --action block \
  --mitigate-missing-schema true \
  --mitigate-malformed-json true

# === 4. JWT Validation ===
cfcli api-shield jwt-validation --zone nc-demo.cf \
  --jwks-url "https://auth.hkpay.nc-demo.cf/.well-known/jwks.json" \
  --enable true \
  --clock-skew 30

# === 5. Sequence Analysis（检测异常支付流程） ===
cfcli api-shield sequence-analysis --zone nc-demo.cf \
  --enable true \
  --sensitivity high \
  --action js_challenge \
  --rules '{"login-before-topup": "require /api/login before /api/topup"}'

# === 6. 配置 Positive Security Model（仅允许 Schema 中定义的请求） ===
cfcli api-shield positive-security --zone nc-demo.cf \
  --enable true \
  --default-action block
```

#### 22.4.3 Bot Management（防黄牛抢购）

```bash
# === 1. 启用 Bot Management ===
cfcli bot-mgmt enable --zone nc-demo.cf --mode "managed"

# === 2. 拦截自动化抢购工具 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "block-scalper-bots" \
  --expression '(cf.bot_management.score < 10) and (http.request.uri.path contains "/api/promotion")' \
  --action "block"

# === 3. 拦截自动化充值工具 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "block-auto-topup" \
  --expression '(cf.bot_management.score < 30) and (http.request.uri.path contains "/api/topup") and (http.request.method eq "POST")' \
  --action "js_challenge"

# === 4. JA3/JA4 指纹封禁（已知工具） ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "block-known-tools" \
  --expression '(cf.ja3_hash in $cf.ja3_list{name:"known_attack_tools"})' \
  --action "block"
```

#### 22.4.4 Waiting Room（节日抢购高峰排队）

```bash
# === 1. 创建 Waiting Room（节日抢购） ===
cfcli waiting-room create --zone nc-demo.cf \
  --name "festival-promotion" \
  --host "pay.hkpay.nc-demo.cf" \
  --path "/promotion" \
  --total-active-users 100000 \
  --session-duration 10 \
  --queue-all true \
  --queueing-method "fifo" \
  --custom-page-html "https://hkpay.nc-demo.cf/queue.html"

# === 2. 创建 Waiting Room Event（节日活动预约） ===
cfcli waiting-room event create --zone nc-demo.cf \
  --room-id <room-id> \
  --name "christmas-promo" \
  --event-start-time "2026-12-25T00:00:00+08:00" \
  --event-end-time "2026-12-25T23:59:59+08:00" \
  --prequeue-start-time "2026-12-24T23:00:00+08:00" \
  --prequeue-true 100000

# === 3. 创建 Waiting Room（早晚高峰地铁充值） ===
cfcli waiting-room create --zone nc-demo.cf \
  --name "morning-peak" \
  --host "topup.hkpay.nc-demo.cf" \
  --path "/" \
  --total-active-users 50000 \
  --session-duration 5 \
  --queue-all false \
  --queueing-method "fifo"

# === 4. 启用 Waiting Room 实时分析（Ent） ===
cfcli waiting-room analytics --zone nc-demo.cf --enable true
```

#### 22.4.5 Load Balancer（香港 + 新加坡 DR）

```bash
# === 1. 创建健康检查 ===
cfcli lb health-check create \
  --name "hkpay-hc" \
  --type https \
  --path "/healthz" \
  --interval 5 \
  --timeout 3 \
  --retries 2 \
  --expected-code 200

# === 2. 创建香港 Pool ===
cfcli lb pool create \
  --name "hk-pool" \
  --origins "203.0.113.1:443,203.0.113.2:443" \
  --health-check-id <hc-id> \
  --notification-email "ops@hkpay.nc-demo.cf"

# === 3. 创建新加坡 Pool（DR） ===
cfcli lb pool create \
  --name "sg-pool" \
  --origins "192.0.2.1:443,192.0.2.2:443" \
  --health-check-id <hc-id>

# === 4. 创建 Load Balancer（Geo Steering） ===
cfcli lb create --zone nc-demo.cf \
  --name "hkpay-lb" \
  --steering geo \
  --default-pool <hk-pool-id> \
  --fallback-pool <sg-pool-id> \
  --region-pools "HK:<hk-pool-id>,SG:<sg-pool-id>" \
  --pop-pools "HKG:<hk-pool-id>,SIN:<sg-pool-id>"
```

#### 22.4.6 Rate Limiting（per-endpoint 限流）

```bash
# === 1. 充值接口限流 ===
cfcli waf rate-limit create --zone nc-demo.cf \
  --name "topup-rl" \
  --expression '(http.request.uri.path eq "/api/topup") and (http.request.method eq "POST")' \
  --characteristics 'ip.src,http.request.headers["x-card-id"]' \
  --limit 10 \
  --period 60 \
  --action "block"

# === 2. 登录接口限流（防撞库） ===
cfcli waf rate-limit create --zone nc-demo.cf \
  --name "login-rl" \
  --expression '(http.request.uri.path eq "/api/login")' \
  --characteristics 'ip.src,http.request.headers["x-device-id"]' \
  --limit 5 \
  --period 300 \
  --action "block"

# === 3. 支付接口限流 ===
cfcli waf rate-limit create --zone nc-demo.cf \
  --name "payment-rl" \
  --expression '(http.request.uri.path eq "/api/payment")' \
  --characteristics 'ip.src,http.request.headers["x-card-id"]' \
  --limit 20 \
  --period 60 \
  --action "js_challenge"
```

#### 22.4.7 Workers 边缘风控预处理

```bash
# === 1. 部署边缘风控 Worker ===
cfcli workers deploy --zone nc-demo.cf \
  --name "hkpay-risk-engine" \
  --script ./workers/risk-engine.js \
  --routes "api.hkpay.nc-demo.cf/*"

# === 2. 部署跨境支付 Worker（汇率转换） ===
cfcli workers deploy --zone nc-demo.cf \
  --name "cross-border-fx" \
  --script ./workers/fx-converter.js \
  --routes "pay.hkpay.nc-demo.cf/fx/*"
```

### 22.5 合规对应表（PCI-DSS v4.0 + 支付行业监管 + PDPO）

| 合规要求 | 条款 | Cloudflare 对应功能 | 实现方式 |
|---------|------|---------------------|---------|
| **PCI-DSS v4.0** Req 1 | 网络安全控制 | Advanced DDoS + Magic Transit | L3/L4/L7 多层防护 |
| **PCI-DSS v4.0** Req 2 | 加密传输 | TLS 1.3 + mTLS + ACM | 全链路加密 |
| **PCI-DSS v4.0** Req 3 | 持卡人数据保护 | Workers 边缘脱敏 | 边缘去除敏感字段 |
| **PCI-DSS v4.0** Req 4 | 加密传输中数据 | TLS 1.3 + HSTS | 强制 HTTPS |
| **PCI-DSS v4.0** Req 6 | 安全开发 | API Shield Schema Validation | Positive Security Model |
| **PCI-DSS v4.0** Req 7 | 访问控制 | Access (Zero Trust) | 应用层授权 |
| **PCI-DSS v4.0** Req 8 | 身份验证 | API Shield JWT Validation | API 调用认证 |
| **PCI-DSS v4.0** Req 10 | 日志监控 | Logpush to SIEM | 全量日志留存 ≥ 1 年 |
| **PCI-DSS v4.0** Req 11 | 持续安全测试 | WAF Managed Ruleset | OWASP Top 10 防护 |
| **PCI-DSS v4.0** Req 12 | 安全策略 | Cloudflare Audit Logs | 配置变更审计 |
| **支付行业监管 PS-01** | 支付系统安全 | Advanced DDoS + Waiting Room | 防止支付系统中断 |
| **支付行业监管 PS-02** | 业务连续性 | LB + 多区域 DR | 自动故障切换 |
| **PDPO 第 4 条** | 个人资料收集 | Workers 边缘脱敏 | 最小化收集 |
| **PDPO 第 6 条** | 资料使用 | Data Localization Suite | 限制跨境 |
| **PDPO 第 33 条** | 资料跨境转移 | Data Localization + Custom Rules | 仅允许 HK + 大湾区 |

### 22.6 高峰期容量规划

| 场景 | 时间 | 峰值 TPS | 配置策略 |
|------|------|---------|---------|
| **平日早晚高峰** | 07:30-09:30 / 17:30-19:30 | 5000 TPS | LB + Rate Limiting |
| **节日优惠抢购** | 双 11 / 圣诞 / 春节 | 50000 TPS | Waiting Room + LB |
| **闸机系统故障** | 突发 | 10000 TPS | Waiting Room + LB + Argo |
| **跨境支付高峰** | 大湾区节假日 | 8000 TPS | LB + Workers 汇率 |
| **系统维护窗口** | 凌晨 02:00-04:00 | < 1000 TPS | Waiting Room + 维护页面 |

### 22.7 与闸机 / 终端系统对接

| 接口 | 协议 | 端口 | Cloudflare 防护 |
|------|------|------|----------------|
| 闸机状态上报 | HTTPS API | 443 | API Shield + JWT |
| 闸机远程控制 | mTLS HTTPS | 443 | mTLS (AOP) + IP 白名单 |
| 闸机日志推送 | HTTPS Webhook | 443 | Workers + Logpush |
| 闸机紧急停用 | HTTPS API | 443 | Access + MFA |
| 跨站换乘查询 | HTTPS API | 443 | API Shield + Cache |

### 22.8 跨境支付（粤港澳大湾区）

```bash
# === 1. 跨境路径专用 WAF 规则 ===
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "greater-bay-pay" \
  --expression '(http.host eq "pay.hkpay.nc-demo.cf") and (not ip.geoip.country in {"HK" "CN" "MO"})' \
  --action "block" \
  --description "跨境支付仅允许 HK + CN + MO"

# === 2. Workers 汇率转换（实时汇率） ===
cfcli workers deploy --zone nc-demo.cf \
  --name "cross-border-fx" \
  --script ./workers/fx-converter.js \
  --routes "pay.hkpay.nc-demo.cf/fx/*"

# === 3. Argo Smart Routing（降低跨境延迟） ===
cfcli argo smart-routing --zone nc-demo.cf --enable true

# === 4. 支付行业监管 合规日志推送 ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://hkma-compliance/logs/" \
  --dataset "http_requests,firewall_events,audit_logs" \
  --logpull-options "fields=ClientIP,ClientRequestPath,EdgeResponseStatus,WAFAction,BotScore" \
  --frequency 60 \
  --region "HK"
```

---

## 23. ACME 自动化管理 Cloudflare 证书专章

### 23.1 概述：什么是 ACME

**ACME (Automatic Certificate Management Environment)** 是 RFC 8555 定义的证书自动化管理协议，由 Internet Security Research Group (ISRG) 为 Let's Encrypt 设计，现已成为业界标准。

**ACME 的核心目标**：
- **自动化**：证书申请、验证、签发、部署、续期全自动化
- **免费**：Let's Encrypt、ZeroSSL、Buypass、Google Trust Services 等提供免费证书
- **标准化**：RFC 8555 标准，多 CA 互通
- **短周期**：证书有效期 90 天，强制自动化续期（防长期暴露）

**主流 ACME 客户端**：

| 客户端 | 语言 | 特点 |
|--------|------|------|
| **Certbot** | Python | 最流行，EFF 维护，社区生态完善 |
| **acme.sh** | Shell | 纯 Shell 实现，零依赖，支持 60+ CA |
| **lego** | Go | Go 实现，适合 Go 项目集成 |
| **win-acme** | C# | Windows 平台，IIS 集成 |
| **Certify The Web** | C# | Windows GUI，IIS / Exchange 集成 |

### 23.2 Cloudflare 涉及的证书类型全景

Cloudflare 体系内涉及三类证书，ACME 在每类的角色不同：

```
┌──────────────────────────────────────────────────────────────┐
│                    用户（访客）                                │
└────────────────────────┬─────────────────────────────────────┘
                         │ TLS 连接 1: 边缘证书
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  边缘证书 (Visitor ↔ Cloudflare)                       │    │
│  │  ┌─────────────────┬────────────────────────────────┐ │    │
│  │  │ Universal SSL   │ 所有 Ent/Pro 用户自动签发         │ │    │
│  │  │                 │ ACME ❌ (Cloudflare 内部签发)    │ │    │
│  │  ├─────────────────┼────────────────────────────────┤ │    │
│  │  │ ACM (Advanced   │ Ent 用户自定义主机名/SAN/Wildcard│ │    │
│  │  │  Certificate    │ ACME ❌ (Cloudflare 内部签发)    │ │    │
│  │  │  Manager)       │ 但可上传第三方 ACME 签发的证书    │ │    │
│  │  ├─────────────────┼────────────────────────────────┤ │    │
│  │  │ Total TLS       │ ACM 增强版，自动覆盖所有子域      │ │    │
│  │  ├─────────────────┼────────────────────────────────┤ │    │
│  │  │ Custom Cert     │ 用户上传第三方证书（含 ACME 签发）│ │    │
│  │  └─────────────────┴────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────┘
                         │ TLS 连接 2: 源站证书
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    源站 (Origin)                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  源站证书 (Cloudflare ↔ Origin)                        │    │
│  │  ┌─────────────────┬────────────────────────────────┐ │    │
│  │  │ Origin CA       │ Cloudflare 签发，15 年有效期      │ │    │
│  │  │ Certificate     │ ACME ❌ (Cloudflare 内部签发)    │ │    │
│  │  │                 │ 但 Cloudflare Origin CA 已支持   │ │    │
│  │  │                 │ 作为 ACME CA 签发证书（见 23.5）  │ │    │
│  │  ├─────────────────┼────────────────────────────────┤ │    │
│  │  │ Authenticated   │ 不是证书，是 mTLS 客户端证书校验  │ │    │
│  │  │ Origin Pulls    │ 复用 Origin CA 证书链             │ │    │
│  │  ├─────────────────┼────────────────────────────────┤ │    │
│  │  │ 自上传证书       │ 公网受信 CA 证书（DV/OV/EV）      │ │    │
│  │  │                 │ ACME ✅ (acme.sh + Let's Encrypt)│ │    │
│  │  └─────────────────┴────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 23.3 ACME 能否管理 Cloudflare 边缘证书？

**直接答案：不能。** Cloudflare 边缘证书（Universal SSL / ACM / Total TLS）由 Cloudflare 内部 CA 或其合作的 CA（如 Let's Encrypt、DigiCert、Sectigo）签发，**不开放 ACME 接口给终端用户**。

**原因**：
- Cloudflare 边缘证书是 Cloudflare 服务的一部分，由 Cloudflare 自动管理
- 边缘证书私钥保存在 Cloudflare HSM 中，用户无法获取
- 不开放 ACME 是为了确保证书部署在 Cloudflare 全球 Anycast 网络上的一致性

**但是**：用户可以通过以下方式间接使用 ACME 签发的证书作为边缘证书：

| 方式 | 适用计划 | 操作 |
|------|---------|------|
| **上传自定义证书到 ACM** | Ent / Business+ | 用 ACME 客户端签发证书后，通过 API / CLI 上传到 Cloudflare |
| **Cloudflare for SaaS** | Ent | SaaS Provider 为客户自定义主机名自动签发证书（背后可能使用 ACME） |
| **Keyless SSL** | Ent | 用户保留私钥，仅上传证书，适合金融等私钥不出境场景 |

### 23.4 ACME 能否管理 Cloudflare Origin CA 证书？

**直接答案：Cloudflare Origin CA 本身不开放 ACME 接口，但 Cloudflare 已支持作为 ACME CA 签发证书。**

#### 23.4.1 Cloudflare Origin CA（传统方式）

Cloudflare Origin CA 是 Cloudflare 自建 CA，签发的证书仅被 Cloudflare 边缘节点信任（不被公网浏览器信任），用于 Cloudflare ↔ Origin 的 TLS 连接 2。

**特点**：
- 有效期 15 年（2025 年起部分缩短至 1 年，详见官方公告）
- 免费
- 通过 Dashboard / API 签发
- 私钥仅用户持有

**CLI 签发 Origin CA 证书**：

```bash
# === 1. 生成 CSR 和私钥 ===
openssl req -new -newkey rsa:2048 -nodes \
  -keyout origin.key \
  -out origin.csr \
  -subj "/C=CN/O=NC Services/CN=nc-demo.cf"

# === 2. 通过 cfcli 申请 Origin CA 证书 ===
cfcli ssl origin-ca create \
  --hostnames "nc-demo.cf,*.nc-demo.cf,api.nc-demo.cf" \
  --csr ./origin.csr \
  --request-type "origin-rsa" \
  --validity 5475

# === 3. 下载签发的证书 ===
cfcli ssl origin-ca download --cert-id <cert-id> --output origin.crt

# === 4. 在源站 Nginx 配置 ===
# ssl_certificate     /etc/nginx/ssl/origin.crt;
# ssl_certificate_key /etc/nginx/ssl/origin.key;
```

#### 23.4.2 Cloudflare 作为 ACME CA（新功能）

**Cloudflare 在 2024 年推出了 ACME 端点**，用户可以使用任何 ACME 客户端（certbot / acme.sh）从 Cloudflare 直接签发证书，证书由 Cloudflare CA 签发。

**ACME 端点**：`https://acme.cloudflare.com/`

**支持的验证方式**：
- HTTP-01
- DNS-01（通过 Cloudflare DNS API）
- TLS-ALPN-01

**使用 acme.sh 从 Cloudflare ACME 签发证书**：

```bash
# === 1. 安装 acme.sh ===
curl https://get.acme.sh | sh -s email=admin@nc-demo.cf

# === 2. 设置 Cloudflare ACME 为默认 CA ===
acme.sh --set-default-ca --server https://acme.cloudflare.com/

# === 3. 设置 Cloudflare API Token（用于 DNS-01 验证） ===
export CF_Token="your-cloudflare-api-token"
export CF_Account_ID="your-account-id"
export CF_Zone_ID="your-zone-id"

# === 4. 签发证书（DNS-01 验证） ===
acme.sh --issue --dns dns_cf -d "origin.nc-demo.cf" -d "*.origin.nc-demo.cf"

# === 5. 安装证书到 Nginx ===
acme.sh --install-cert -d "origin.nc-demo.cf" \
  --key-file /etc/nginx/ssl/origin.key \
  --fullchain-file /etc/nginx/ssl/origin.crt \
  --reloadcmd "systemctl reload nginx"

# === 6. 自动续期（acme.sh 默认安装 cron） ===
# 已自动配置，无需手动操作
```

#### 23.4.3 ACME 与 Cloudflare Origin CA 的对比

| 维度 | Cloudflare Origin CA | Cloudflare ACME CA | 第三方 ACME (Let's Encrypt) |
|------|---------------------|-------------------|----------------------------|
| **签发方** | Cloudflare CA | Cloudflare CA | Let's Encrypt / ZeroSSL / 等 |
| **信任范围** | 仅 Cloudflare 边缘节点 | 仅 Cloudflare 边缘节点 | 公网浏览器全信任 |
| **有效期** | 15 年（部分 1 年） | 90 天 | 90 天 |
| **ACME 支持** | ❌ | ✅ | ✅ |
| **自动续期** | ❌ 需手动重新签发 | ✅ ACME 客户端自动 | ✅ ACME 客户端自动 |
| **私钥控制** | ✅ 用户持有 | ✅ 用户持有 | ✅ 用户持有 |
| **免费** | ✅ | ✅ | ✅ |
| **适用场景** | 仅 Cloudflare 代理的源站 | 仅 Cloudflare 代理的源站，需自动化 | 源站直接对外（非 Cloudflare 代理）或混合场景 |

### 23.5 三种方案完整对比

| 方案 | 边缘证书 | 源站证书 | 自动化程度 | 适用场景 |
|------|---------|---------|-----------|---------|
| **方案 A: 全 Cloudflare** | Universal SSL / ACM | Origin CA（15 年） | ⭐⭐ 中等 | Cloudflare 全代理，源站不对外 |
| **方案 B: Cloudflare ACME** | Universal SSL / ACM | Cloudflare ACME（90 天自动续期） | ⭐⭐⭐⭐ 高 | Cloudflare 全代理，需自动化续期 |
| **方案 C: 第三方 ACME** | 上传第三方证书到 ACM | Let's Encrypt（90 天自动续期） | ⭐⭐⭐⭐⭐ 最高 | 需要公网信任证书，混合场景，金融合规 |

### 23.6 实战：使用 acme.sh + Cloudflare DNS API 签发 Let's Encrypt 通配符证书

通配符证书（`*.nc-demo.cf`）必须使用 DNS-01 验证，Cloudflare DNS API 是最常用的验证方式。

```bash
# === 1. 安装 acme.sh ===
curl https://get.acme.sh | sh -s email=admin@nc-demo.cf
source ~/.bashrc

# === 2. 设置 Let's Encrypt 为默认 CA ===
acme.sh --set-default-ca --server letsencrypt

# === 3. 创建 Cloudflare API Token ===
# 在 Cloudflare Dashboard → My Profile → API Tokens → Create Token
# 使用 "Edit zone DNS" 模板，限定 Zone = nc-demo.cf
# 权限: Zone:Zone:Read, Zone:DNS:Edit
# 复制 Token

# === 4. 设置环境变量 ===
export CF_Token="cf-token-xxxxxxxxxxxxxxxxxxxx"
export CF_Account_ID="account-id-xxxxxxxx"
export CF_Zone_ID="zone-id-xxxxxxxx"

# === 5. 签发通配符证书（DNS-01） ===
acme.sh --issue --dns dns_cf \
  -d "nc-demo.cf" \
  -d "*.nc-demo.cf" \
  --keylength ec-256

# === 6. 安装证书到 Nginx ===
acme.sh --install-cert -d "nc-demo.cf" --ecc \
  --key-file /etc/nginx/ssl/nc-demo.cf.key \
  --fullchain-file /etc/nginx/ssl/nc-demo.cf.crt \
  --ca-file /etc/nginx/ssl/nc-demo.cf.ca.crt \
  --reloadcmd "systemctl reload nginx"

# === 7. 验证自动续期 cron ===
crontab -l | grep acme.sh
# 输出示例: 0 0 * * * /root/.acme.sh/acme.sh --cron --home /root/.acme.sh
```

### 23.7 上传 ACME 签发的证书到 Cloudflare ACM（边缘证书）

```bash
# === 1. 签发证书后（acme.sh 已安装到本地） ===
ls ~/.acme.sh/nc-demo.cf_ecc/
# nc-demo.cf.cer  nc-demo.cf.key  fullchain.cer  ca.cer

# === 2. 通过 cfcli 上传到 Cloudflare ACM ===
cfcli ssl upload-custom-cert --zone nc-demo.cf \
  --cert-file ~/.acme.sh/nc-demo.cf_ecc/fullchain.cer \
  --key-file ~/.acme.sh/nc-demo.cf_ecc/nc-demo.cf.key \
  --bundle true

# === 3. 验证上传 ===
cfcli ssl list-certs --zone nc-demo.cf

# === 4. 设置该证书为优先证书 ===
cfcli ssl set-priority --zone nc-demo.cf --cert-id <cert-id> --priority 1
```

### 23.8 自动化部署：Cloudflare Worker + ACME 续期

对于大规模证书管理，可以使用 Cloudflare Worker 自动触发 ACME 续期并上传：

```bash
# === 1. 创建 Worker 处理证书续期 ===
cfcli workers deploy --zone nc-demo.cf \
  --name "acme-renewer" \
  --script ./workers/acme-renewer.js \
  --routes "internal.nc-demo.cf/acme-renew/*" \
  --cron "0 0 1 * *"  # 每月 1 日 00:00 触发

# === 2. 设置 API Token 权限 ===
# Worker 需要 SSL and Certificates:Edit 权限
```

### 23.9 Cloudflare for SaaS：自定义主机名 ACM

对于 SaaS Provider 场景，Cloudflare for SaaS 可以**自动**为客户的自定义主机名签发证书：

```bash
# === 1. 创建 SaaS Application ===
cfcli saas app create --zone nc-demo.cf \
  --name "nc-saas" \
  --custom-hostname "*.customer.com"

# === 2. 添加客户自定义主机名 ===
cfcli saas custom-hostname create --zone nc-demo.cf \
  --hostname "app.customer1.com" \
  --ssl-method "http" \
  --ssl-cname "app.customer1.com.nc-demo.cf"

# === 3. Cloudflare 自动签发证书 ===
# Cloudflare 通过 HTTP-01 / TXT 验证后自动签发 ACM 证书
# 无需用户干预

# === 4. 查看证书状态 ===
cfcli saas custom-hostname list --zone nc-demo.cf --status active
```

### 23.10 三种验证方式对比

| 验证方式 | 原理 | 适用场景 | Cloudflare 支持 |
|---------|------|---------|----------------|
| **HTTP-01** | 在 `/.well-known/acme-challenge/` 放置验证文件 | 单域名证书、HTTP 服务 | ✅ 通过 Cloudflare 代理即可 |
| **DNS-01** | 在 DNS 添加 TXT 记录 | 通配符证书、内网证书、无 HTTP 服务 | ✅ 通过 Cloudflare DNS API |
| **TLS-ALPN-01** | 通过 TLS ALPN 扩展验证 | 不开放 HTTP 端口的服务器 | ❌ Cloudflare 代理模式不支持 |

### 23.11 决策流程图：选择证书方案

```
你的证书需求？
    │
    ├── 希望完全托管、零运维？
    │       │
    │       ├── 是 → Universal SSL（Free）或 ACM（Ent）
    │       │       源站用 Origin CA（15 年）
    │       │
    │       └── 否 → 进入下一题
    │
    ├── 需要公网信任的源站证书（非 Cloudflare 代理）？
    │       │
    │       ├── 是 → acme.sh + Let's Encrypt + Cloudflare DNS API
    │       │       自动续期（90 天）
    │       │
    │       └── 否 → 进入下一题
    │
    ├── 需要自动化续期但仅 Cloudflare 代理？
    │       │
    │       ├── 是 → Cloudflare ACME CA (https://acme.cloudflare.com/)
    │       │       acme.sh + Cloudflare ACME
    │       │
    │       └── 否 → Origin CA（15 年手动签发）
    │
    ├── 金融合规要求私钥不出境？
    │       │
    │       ├── 是 → Keyless SSL（Ent）
    │       │       私钥保留在用户 HSM
    │       │
    │       └── 否 → 标准方案
    │
    └── SaaS 多租户场景？
            │
            ├── 是 → Cloudflare for SaaS
            │       自动为客户自定义主机名签发
            │
            └── 否 → 标准方案
```

### 23.12 关键限制与最佳实践

| 限制 / 实践 | 说明 |
|------------|------|
| **ACM 证书上传限制** | Ent 用户每月 100 张自定义证书 / zone |
| **Origin CA 证书数量** | 每账户 100 张 Origin CA 证书 |
| **ACME 续期频率** | Let's Encrypt 建议每 60 天续期（证书有效期 90 天） |
| **Rate Limit** | Let's Encrypt 每周每域名 50 张证书，失败 5 次/小时锁定 1 小时 |
| **私钥安全** | Origin CA 私钥仅用户持有，Cloudflare 不存储 |
| **Keyless SSL** | Ent 功能，私钥完全保留在用户 HSM，Cloudflare 仅在握手时回调 |
| **CAA 记录** | 建议配置 DNS CAA 记录，限制仅允许 Let's Encrypt / Cloudflare 签发 |
| **HSTS Preload** | 启用 HSTS preload 后，证书必须长期有效（避免锁死用户） |

### 23.13 CAA 记录配置示例

```bash
# === 仅允许 Let's Encrypt 和 Cloudflare 签发证书 ===
cfcli dns record create --zone nc-demo.cf \
  --type CAA \
  --name "@" \
  --content '0 issue "letsencrypt.org"' \
  --ttl 3600

cfcli dns record create --zone nc-demo.cf \
  --type CAA \
  --name "@" \
  --content '0 issue "cloudflare.com"' \
  --ttl 3600

# === 通配符证书仅允许 Let's Encrypt ===
cfcli dns record create --zone nc-demo.cf \
  --type CAA \
  --name "@" \
  --content '0 issuewild "letsencrypt.org"' \
  --ttl 3600

# === 报告违规签发到指定邮箱 ===
cfcli dns record create --zone nc-demo.cf \
  --type CAA \
  --name "@" \
  --content '0 iodef "mailto:security@nc-demo.cf"' \
  --ttl 3600
```

---

## 24. 行业场景对比与附录

### 24.1 行业场景总览对比

| 维度 | 场景一～十（基础） | 金融（第 19 章） | 政企（第 20 章） | 电力（第 21 章） | 支付行业（第 22 章） |
|------|-----------------|-----------------|-----------------|-----------------|---------------------|
| **典型业务** | 通用 Web / API | 银行核心 / 证券 / 支付 | 政务 / 税务 / 社保 | SCADA / 电网调度 | 交通支付 / 充值 / 商户 |
| **典型域名** | example.com | bank.nc-demo.cf | gov.nc-demo.cf | scada.nc-demo.cf | pay.hkpay.nc-demo.cf |
| **合规要求** | 通用 | 等保四级 + PCI-DSS | 等保三级 + 数据安全法 | 关基条例 + IEC 62443 | PCI-DSS + 支付行业监管 + PDPO |
| **可用性** | 99.9% | 99.99% | 99.9% | 99.999% | 99.99% |
| **RTO** | 30 min | 5 min | 30 min | 30 s | 2 min |
| **数据驻留** | 不强制 | 境内 | 境内 | 境内 | 香港 |
| **DDoS 防护** | Advanced DDoS | Advanced DDoS + Magic Transit | Magic Transit | Magic Transit + Spectrum | Advanced DDoS + Magic Transit |
| **WAF** | Custom + Managed | Custom + Managed + Payment Fraud | Custom + Managed | Custom + Managed | Custom + Managed + Payment Fraud |
| **Bot Management** | 可选 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须（防黄牛） |
| **API Shield** | 可选 | ✅ 必须 | 可选 | 可选 | ✅ 必须 |
| **Waiting Room** | 可选 | ✅ 双 11 理财 | 可选 | 可选 | ✅ 节日抢购 |
| **Load Balancer** | 可选 | ✅ Geo Steering（三地多活） | 可选 | 可选 | ✅ 香港 + 新加坡 DR |
| **mTLS (AOP)** | 可选 | ✅ 必须 | 可选 | ✅ 必须（工程师站） | ✅ 必须 |
| **ACM** | 可选 | ✅ 必须（多 SAN） | 可选 | 可选 | ✅ 必须（EV 证书） |
| **Data Localization** | ❌ | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 香港 + 大湾区 |
| **Magic Transit** | ❌ | 可选 | ✅ 必须 | ✅ 必须 | 可选 |
| **Spectrum** | ❌ | ❌ | ❌ | ✅ 必须（OT 协议） | ❌ |
| **Access (Zero Trust)** | 可选 | 可选 | ✅ 必须 | ✅ 必须（工程师站） | 可选 |
| **Argo Smart Routing** | 可选 | ✅ 跨境支付 | 可选 | 可选 | ✅ 跨境支付 |
| **Workers** | 可选 | ✅ 汇率转换 | ✅ 数据脱敏 | ✅ 权限校验 | ✅ 风控预处理 |
| **Logpush** | 可选 | ✅ SIEM | ✅ SIEM | ✅ SIEM | ✅ 支付行业监管 合规 |

### 24.2 合规框架对应总表

| 合规框架 | 适用行业 | 关键条款 | Cloudflare 实现章节 |
|---------|---------|---------|-------------------|
| **等保 2.0 三级** | 政企、电力 | 8.1.1-8.1.20 | 第 20 章、第 21 章 |
| **等保 2.0 四级** | 金融 | 8.1.1-8.1.20（增强） | 第 19 章 |
| **PCI-DSS v4.0** | 支付行业 | Req 1-12 | 第 22 章 |
| **关键信息基础设施保护条例** | 电力、政务 | 第 19-25 条 | 第 20 章、第 21 章 |
| **数据安全法** | 政企、金融 | 第 21、31 条 | 第 19 章、第 20 章 |
| **个人信息保护法** | 全行业 | 第 40 条 | 第 19-22 章 |
| **国能安全 36 号** | 电力 | 第 5-11 条 | 第 21 章 |
| **IEC 62443 (SL3)** | 电力、工控 | 工控安全 | 第 21 章 |
| **支付行业监管 支付系统指引** | 支付行业 | PS-01、PS-02 | 第 22 章 |
| **PDPO（香港私隐条例）** | 支付、香港业务 | 第 4、6、33 条 | 第 22 章 |
| **JR/T 0171 金融信息保护** | 金融 | 全文 | 第 19 章 |
| **GDPR（欧盟）** | 跨境业务 | 第 44-50 条 | Data Localization Suite |

### 24.3 Enterprise Plan 功能使用矩阵

| 功能 | 金融 | 政企 | 电力 | 支付 | 说明 |
|------|------|------|------|--------|------|
| **Advanced DDoS Protection (L3/L4)** | ✅ | ✅ | ✅ | ✅ | Ent 永久免费、无计量 |
| **Advanced DDoS Protection (L7)** | ✅ | ✅ | ✅ | ✅ | HTTP 洪水、Slowloris |
| **Bot Management** | ✅ | ✅ | ✅ | ✅ | Bot Score、JA3/JA4 |
| **WAF · Ruleset Engine** | ✅ | ✅ | ✅ | ✅ | Custom + Managed + RL |
| **API Shield** | ✅ | ⚠️ | ⚠️ | ✅ | Schema + JWT + Sequence |
| **Waiting Room** | ✅ | ⚠️ | ⚠️ | ✅ | 峰值排队 |
| **Load Balancer** | ✅ | ⚠️ | ⚠️ | ✅ | Geo Steering + HC |
| **Argo Smart Routing** | ✅ | ⚠️ | ⚠️ | ✅ | 智能路由 |
| **Magic Transit** | ⚠️ | ✅ | ✅ | ⚠️ | 网段级 L3/L4 防护 |
| **Spectrum** | ❌ | ❌ | ✅ | ❌ | TCP/UDP 非 HTTP 协议 |
| **Data Localization Suite** | ✅ | ✅ | ✅ | ✅ | 数据驻留 |
| **Access (Zero Trust)** | ⚠️ | ✅ | ✅ | ⚠️ | SSO + MFA |
| **Workers (Unbound)** | ✅ | ✅ | ✅ | ✅ | 边缘计算 |
| **Logpush** | ✅ | ✅ | ✅ | ✅ | SIEM 集成 |
| **ACM** | ✅ | ⚠️ | ⚠️ | ✅ | 自定义证书 |
| **Total TLS** | ✅ | ⚠️ | ⚠️ | ✅ | 自动覆盖子域 |
| **mTLS (AOP)** | ✅ | ⚠️ | ✅ | ✅ | 双向认证 |
| **Keyless SSL** | ⚠️ | ❌ | ❌ | ⚠️ | 私钥不出境 |
| **Page Shield** | ✅ | ✅ | ⚠️ | ✅ | 防页面注入 |
| **Cache Reserve** | ✅ | ⚠️ | ⚠️ | ✅ | 持久缓存 |
| **Smart Tiered Cache** | ✅ | ✅ | ✅ | ✅ | 多级缓存 |
| **Polish** | ⚠️ | ⚠️ | ❌ | ✅ | 图片优化 |
| **Cloudflare for SaaS** | ⚠️ | ❌ | ❌ | ⚠️ | 多租户证书 |

> ✅ = 必须 / 强烈推荐；⚠️ = 视场景；❌ = 不适用

### 24.4 术语表（补充 v3.0 新增术语）

| 术语 | 英文 | 说明 |
|------|------|------|
| **ACME** | Automatic Certificate Management Environment | RFC 8555 证书自动化协议 |
| **ACM** | Advanced Certificate Manager | Cloudflare Ent 自定义证书管理 |
| **AOP** | Authenticated Origin Pulls | Cloudflare 到源站的 mTLS |
| **Advanced DDoS Protection (L3/L4)** | Layer 3/4 DDoS Protection | 网络层 DDoS 防护 |
| **Advanced DDoS Protection (L7)** | Layer 7 DDoS Protection | HTTP 层 DDoS 防护 |
| **Bot Management** | Bot Management (Ent) | Bot Score 评分系统 |
| **Bot Score** | Bot Score | 1-99 分，<10 为 Bot |
| **JA3 / JA4** | JA3/JA4 Fingerprint | TLS 客户端指纹 |
| **API Shield** | API Shield (Ent) | API 安全防护套件 |
| **Schema Validation** | Schema Validation | OpenAPI Schema 校验 |
| **Sequence Analysis** | Sequence Analysis | API 调用顺序分析 |
| **Magic Transit** | Magic Transit (Ent) | 网段级 L3/L4 DDoS 防护 |
| **Spectrum** | Spectrum (Ent) | TCP/UDP 非 HTTP 协议代理 |
| **Data Localization Suite** | Data Localization Suite (Ent) | 数据驻留方案 |
| **Waiting Room** | Waiting Room (Ent) | 源站过载排队系统 |
| **Access (Zero Trust)** | Cloudflare Access | 零信任应用接入 |
| **Origin CA** | Cloudflare Origin CA | Cloudflare 自建 CA |
| **Keyless SSL** | Keyless SSL (Ent) | 私钥不出境的 SSL 方案 |
| **Total TLS** | Total TLS (Ent) | 自动覆盖所有子域证书 |
| **Cloudflare for SaaS** | Cloudflare for SaaS (Ent) | 多租户证书方案 |
| **OT 协议** | Operational Technology Protocol | 工控协议（Modbus、IEC 104 等） |
| **关基条例** | Critical Information Infrastructure Protection Regulation | 关键信息基础设施安全保护条例 |
| **国能安全 36 号** | NEA Safety No. 36 | 电力监控系统安全防护规定 |
| **等保** | MLPS (Multi-Level Protection Scheme) | 网络安全等级保护 |
| **PCI-DSS** | Payment Card Industry Data Security Standard | 支付卡行业数据安全标准 |
| **支付行业监管** | Payment Industry Regulator | 支付行业监管机构 |
| **PDPO** | Personal Data (Privacy) Ordinance | 香港个人资料（私隐）条例 |
| **IEC 62443** | IEC 62443 | 工控系统安全标准 |

### 24.5 行业场景 CLI 命令索引（v3.0 新增）

| 命令 | 章节 | 用途 |
|------|------|------|
| `cfcli bot-mgmt enable` | 19.4.3、22.4.3 | 启用 Bot Management |
| `cfcli api-shield enable` | 19.4.4、22.4.2 | 启用 API Shield |
| `cfcli api-shield schema upload` | 19.4.4、22.4.2 | 上传 OpenAPI Schema |
| `cfcli api-shield schema-validation` | 19.4.4、22.4.2 | 启用 Schema 校验 |
| `cfcli api-shield jwt-validation` | 19.4.4、22.4.2 | 启用 JWT 校验 |
| `cfcli api-shield sequence-analysis` | 19.4.4、22.4.2 | 启用 Sequence Analysis |
| `cfcli api-shield positive-security` | 22.4.2 | 启用 Positive Security Model |
| `cfcli data-localization enable` | 19.4.6、20.4.2 | 启用 Data Localization Suite |
| `cfcli data-localization regional-services` | 19.4.6、20.4.2 | 配置 Regional Services |
| `cfcli magic-transit tunnel create` | 20.4.1、21.4.2 | 创建 Magic Transit Tunnel |
| `cfcli magic-transit acl create` | 20.4.1、21.4.2 | 创建 Magic Transit ACL |
| `cfcli spectrum app create` | 21.4.1 | 创建 Spectrum Application |
| `cfcli spectrum ddos-protection` | 21.4.1 | 启用 Spectrum DDoS 防护 |
| `cfcli access app create` | 20.4.3、21.4.3 | 创建 Access Application |
| `cfcli access idp create` | 20.4.3、21.4.3 | 配置 IdP |
| `cfcli access policy create` | 20.4.3、21.4.3 | 创建 Access Policy |
| `cfcli access device-posture create` | 20.4.3、21.4.3 | 创建设备姿态检查 |
| `cfcli waiting-room create` | 22.4.4 | 创建 Waiting Room |
| `cfcli waiting-room event create` | 22.4.4 | 创建 Waiting Room Event |
| `cfcli waiting-room analytics` | 22.4.4 | 启用 Waiting Room 实时分析 |
| `cfcli argo smart-routing` | 19.6、22.8 | 启用 Argo Smart Routing |
| `cfcli argo tiered-cache` | 19.6 | 启用 Argo Tiered Cache |
| `cfcli workers deploy` | 19.6、22.4.7 | 部署 Worker |
| `cfcli logpush create` | 19.8、20.4.2、21.4.5、22.8 | 创建 Logpush 推送 |
| `cfcli notification create` | 19.8 | 创建告警通知 |
| `cfcli ssl upload-custom-cert` | 19.4.1、22.4.1、23.7 | 上传自定义证书 |
| `cfcli ssl total-tls` | 19.4.1、22.4.1 | 启用 Total TLS |
| `cfcli ssl min-tls-version` | 19.4.1、22.4.1 | 设置最低 TLS 版本 |
| `cfcli ssl hsts` | 19.4.1、22.4.1 | 启用 HSTS |
| `cfcli ssl ocsp-stapling` | 22.4.1 | 启用 OCSP Stapling |
| `cfcli ssl authenticated-origin-pulls` | 19.4.2、21.4.3 | 启用 mTLS (AOP) |
| `cfcli ssl download-origin-ca` | 19.4.2、21.4.3 | 下载 Origin CA 证书 |
| `cfcli ssl origin-ca create` | 23.4.1 | 申请 Origin CA 证书 |
| `cfcli ssl origin-ca download` | 23.4.1 | 下载 Origin CA 证书 |
| `cfcli ssl set-priority` | 23.7 | 设置证书优先级 |
| `cfcli saas app create` | 23.9 | 创建 SaaS Application |
| `cfcli saas custom-hostname create` | 23.9 | 添加客户自定义主机名 |
| `cfcli saas custom-hostname list` | 23.9 | 列出自定义主机名 |
| `cfcli dns cname-flattening` | 20.4.2 | 启用 CNAME Flattening |

### 24.6 行业场景快速选型指南

```
你的业务属于哪个行业？
    │
    ├── 金融（银行 / 证券 / 保险 / 支付）
    │       └── 第 19 章（多活 DR + 等保四级）
    │
    ├── 政企（政务 / 税务 / 社保 / 公共服务）
    │       └── 第 20 章（Magic Transit + 数据本地化）
    │
    ├── 电力（电网 / 调度 / SCADA / 工控）
    │       └── 第 21 章（OT/ICS + Spectrum + 关基）
    │
    ├── 支付（支付行业 / 支付宝 / 微信支付 / 跨境支付）
    │       └── 第 22 章（PCI-DSS + API Shield + Waiting Room）
    │
    └── 其他行业
            │
            ├── 高并发电商 → 第 19 章多活 DR + 第 22 章 Waiting Room
            ├── 医疗（HIPAA） → 第 20 章 Data Localization + Access
            ├── 教育 → 场景一或场景十
            ├── SaaS 多租户 → 第 23.9 节 Cloudflare for SaaS
            └── 通用 Web → 场景一～场景十
```

### 24.7 行业场景证书选型决策表

| 场景 | 边缘证书 | 源站证书 | mTLS | 说明 |
|------|---------|---------|------|------|
| **金融（第 19 章）** | ACM（EV 证书） | Origin CA + 自上传公网证书 | ✅ | 合规要求 EV 证书 |
| **政企（第 20 章）** | ACM + 国密 SM2 | Origin CA | ✅ | 国密算法可选 |
| **电力（第 21 章）** | ACM | Origin CA + 国密 SM2 | ✅ | OT 协议 mTLS |
| **支付行业（第 22 章）** | ACM（EV 证书） | Origin CA + 自上传公网证书 | ✅ | PCI-DSS 要求 |
| **SaaS 多租户** | Cloudflare for SaaS ACM | Origin CA | 可选 | 自动为客户签发 |
| **金融合规（私钥不出境）** | Keyless SSL | 用户 HSM 保留私钥 | ✅ | 私钥永不离开用户 |
| **自动化续期** | Universal SSL / ACM | Cloudflare ACME CA | - | 90 天自动续期 |
| **公网信任源站** | Universal SSL | Let's Encrypt + acme.sh | - | 90 天自动续期 |

---

## 25. Cloudflare 可观测性体系：日志架构、查询路径与归档策略

### 25.1 概述：Cloudflare 日志可观测性六大来源

Cloudflare 的可观测性数据分散在多个位置，运维与安全团队最常遇到的问题就是「发生异常时，应从哪条路径定位」。本章从 **「可观测性目标 → 数据源 → 查询路径」** 的视角，系统梳理 Cloudflare 日志架构、查询入口与长期归档策略，构建端到端的排障与审计闭环。

```
┌──────────────────────────────────────────────────────────────────┐
│                  Cloudflare 日志体系全景                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ① Dashboard 实时日志（无需配置，开箱即用）                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Analytics  │ Overview / Security / Performance / Workers │     │
│  │ Edge Log   │ tail 模式实时滚动（Ent）                     │     │
│  │ Firewall   │ Security → Events                           │     │
│  │ DDoS       │ Security → Events (DDoS 标签)               │     │
│  │ Bot Mgmt   │ Security → Bot Management                   │     │
│  │ API Shield │ Security → API Shield                       │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ② REST API（按需查询，可分页）                                      │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ GraphQL Analytics API  │ 任意时间窗口、任意维度聚合         │     │
│  │ Firewall Events API    │ 近 30 天 WAF/Bot/DDoS 事件       │     │
│  │ Audit Logs API         │ 账户级配置变更（近 18 个月）       │     │
│  │ DNS Analytics API      │ DNS 查询统计                     │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ③ Logpush（推送至外部存储，长期归档 + SIEM）                       │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ HTTP Requests         │ 全量访问日志（Ent）                │     │
│  │ Firewall Events       │ WAF / Bot / DDoS 事件             │     │
│  │ Spectrum Events       │ TCP/UDP 协议事件（Ent）            │     │
│  │ Magic Transit Events  │ L3/L4 网络事件（Ent）              │     │
│  │ Network Analytics     │ 网络层流量分析                     │     │
│  │ Workers Requests      │ Worker 调用日志                   │     │
│  │ Audit Logs            │ 账户级审计日志                     │     │
│  │ NEL Reports           │ 浏览器侧 Real User Monitoring     │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ④ Log Explorer（Ent · Beta · Cloudflare 内部 SQL 查询引擎）          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ HTTP      │ 原始 HTTP 请求事件（含 Bot/JA3/Cache 字段）   │     │
│  │ Security  │ 原始安全事件（WAF/Bot/DDoS/RL 原始行）        │     │
│  │ Workers   │ 原始 Worker 调用与异常事件                    │     │
│  │ Spectrum  │ 原始 TCP/UDP 事件                            │     │
│  │ 查询方式  │ SQL (Cloudflare SQL API / Dashboard 探索器)   │     │
│  │ 保留期    │ 360 天（Ent 合同，Beta 功能，以合同条款为准）  │     │
│  │ 数据存储  │ Cloudflare R2（单租户隔离）                   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ⑤ Workers Logs（边缘计算日志，独立体系）                            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ wrangler tail      │ 实时滚动（开发调试）                  │     │
│  │ Workers Analytics  │ Dashboard → Workers → Analytics      │     │
│  │ Workers Logpush    │ 推送至外部存储（Ent）                 │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ⑥ Audit Logs（账户级配置变更审计）                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Dashboard  │ My Profile → Audit Logs                     │     │
│  │ API        │ /audit_logs（近 18 个月）                    │     │
│  │ Logpush    │ 推送至 SIEM 长期留存                         │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

> **Log Explorer 与 Logpush 的关键区别**：
> - **Logpush** = 把日志**推出去**到外部 SIEM（S3 / Splunk / Datadog），适合跨平台关联分析、自定义保留期（> 360 天）和满足金融/关基行业 ≥ 1 年/3 年的合规归档。
> - **Log Explorer** = 在 **Cloudflare 内部**直接用 SQL 查询原始日志事件，**保留期 360 天**（以 Enterprise 合同条款为准；该功能目前为 Beta，官方保留策略可能调整），数据存储于 Cloudflare R2（单租户隔离），无需配置外部存储，适合临时排障、深度下钻、安全调查与近一年事件回溯。
> - 二者**互补**：Logpush 解决「跨平台关联 + 超长归档」，Log Explorer 解决「即席探查 + 钻取 + 近一年回溯」。两者均需 **Enterprise Plan**。
>
> **官方文档参考**：[Log Explorer](https://developers.cloudflare.com/logs/log-explorer/)（标注为 Beta）

### 25.2 速查表：我想看 X，去哪里看？

| 我想看 | Dashboard 位置 | API | Logpush Dataset | Log Explorer Dataset（Ent） | 保留期 |
|--------|---------------|-----|-----------------|----------------------------|--------|
| **网站总流量 / 带宽** | Analytics → Overview | GraphQL Analytics | http_requests | http | 30 天（Ent 90 天） |
| **5xx 错误率** | Analytics → Overview | GraphQL Analytics | http_requests | http | 30 天 |
| **某个 IP 访问了什么** | Analytics → Security → Events | Firewall Events API | firewall_events | http / security | 30 天 |
| **WAF 拦截了哪些请求** | Security → Events | Firewall Events API | firewall_events | security | 30 天 |
| **Bot Management 评分** | Security → Bot Management | GraphQL Analytics | firewall_events | security（BotScore 字段） | 30 天 |
| **DDoS 攻击事件** | Security → Events (DDoS 标签) | Firewall Events API | firewall_events / dos_events | security | 30 天 |
| **Rate Limiting 触发** | Security → Events | Firewall Events API | firewall_events | security | 30 天 |
| **API Shield 拦截** | Security → API Shield | GraphQL Analytics | firewall_events | security | 30 天 |
| **Waiting Room 排队** | Traffic → Waiting Room | GraphQL Analytics | waiting_room_analytics | - | 30 天 |
| **Cache 命中率** | Caching → Analytics | GraphQL Analytics | http_requests (CacheCacheStatus) | http（CacheCacheStatus 字段） | 30 天 |
| **Worker 调用日志** | Workers → Analytics | Workers Analytics API | workers_requests | workers | 30 天 |
| **Worker console.log** | `wrangler tail` | - | workers_trace | workers（log_level/message） | 实时 |
| **DNS 查询统计** | DNS → Analytics | DNS Analytics API | dns_analytics | - | 30 天 |
| **Spectrum TCP/UDP 事件** | Spectrum → Analytics | GraphQL Analytics | spectrum_events | spectrum | 30 天（Ent） |
| **Magic Transit 流量** | Magic Transit → Analytics | GraphQL Analytics | magic_transit_logs | - | 30 天（Ent） |
| **Load Balancer 健康** | Traffic → Load Balancing | LB API | - | - | 30 天 |
| **Argo 路由统计** | Traffic → Argo | GraphQL Analytics | argo_smart_routing_logs | - | 30 天 |
| **配置变更审计** | My Profile → Audit Logs | Audit Logs API | audit_logs | - | 18 个月 |
| **登录 / Token 使用** | My Profile → Audit Logs | Audit Logs API | audit_logs | - | 18 个月 |
| **Real User Monitoring** | Speed → RUM | GraphQL Analytics | nel_reports | - | 30 天 |
| **Page Shield 警报** | Security → Page Shield | GraphQL Analytics | page_shield_events | - | 30 天 |
| **Zone 配置变更** | My Profile → Audit Logs | Audit Logs API | audit_logs | - | 18 个月 |
| **JA3/JA4 指纹** | - | - | firewall_events | http / security | 30 天 |
| **某 URL 历史响应** | - | - | http_requests | http | 30 天 |
| **某 Bot Score 区间** | - | GraphQL Analytics | firewall_events | security | 30 天 |

> **Log Explorer 适用场景提示**：当 GraphQL Analytics 只返回聚合数据、Firewall Events API 因分页限制查不全、或需要按 JA3/Bot Score/UA 等字段深度下钻时，首选 Log Explorer（保留期 360 天，支持近一年事件回溯）。

### 25.3 六大日志来源详解

#### 25.3.1 Dashboard 实时日志（开箱即用）

**特点**：无需任何配置，登录 Dashboard 即可查看；实时性高（延迟 < 1 分钟）；保留期短（30 天）。

**适用场景**：日常巡检、实时排障、快速验证规则是否生效。

**入口路径速查**：

| 看什么 | Dashboard 路径 |
|--------|--------------|
| 站点总览（流量/带宽/请求/错误） | 选 Zone → Analytics → Overview |
| 安全事件（WAF/Bot/DDoS/RL） | 选 Zone → Security → Events |
| DDoS 专项 | 选 Zone → Security → Events → 筛选 "DDoS" |
| Bot 评分分布 | 选 Zone → Security → Bot Management |
| API Shield 事件 | 选 Zone → Security → API Shield |
| Cache 命中率 | 选 Zone → Caching → Analytics |
| Workers 调用 | 选 Account → Workers → Analytics |
| DNS 查询 | 选 Zone → DNS → Analytics |
| Spectrum 流量 | 选 Zone → Spectrum → Analytics |
| Magic Transit 流量 | 选 Account → Magic Transit → Analytics |
| Waiting Room 排队 | 选 Zone → Traffic → Waiting Room |
| Load Balancer 健康 | 选 Zone → Traffic → Load Balancing |
| Page Shield 警报 | 选 Zone → Security → Page Shield |
| Real User Monitoring | 选 Zone → Speed → RUM |
| 账户配置审计 | 选 Account → My Profile → Audit Logs |
| Zone 配置审计 | 选 Account → My Profile → Audit Logs（筛选 Zone） |

**Enterprise 专属：Edge Log Streaming（实时 tail）**

```bash
# === 实时滚动查看边缘日志（Ent 专属） ===
cfcli logs tail --zone nc-demo.cf \
  --fields "ClientIP,ClientRequestPath,EdgeResponseStatus,WAFAction,BotScore" \
  --filter "EdgeResponseStatus >= 500"

# === 实时筛选 WAF 拦截 ===
cfcli logs tail --zone nc-demo.cf \
  --filter "WAFAction eq 'block'" \
  --fields "ClientIP,ClientRequestPath,WAFRuleID"
```

#### 25.3.2 REST API（按需查询）

**特点**：可编程查询；支持分页；适合自动化告警脚本；GraphQL Analytics API 支持复杂聚合。

**主要 API 端点**：

| API | 端点 | 用途 | 保留期 |
|-----|------|------|--------|
| **GraphQL Analytics** | `POST /graphql` | 任意维度聚合查询 | 30 天（Ent 90 天） |
| **Firewall Events** | `GET /zones/{id}/security/events` | WAF/Bot/DDoS 事件 | 30 天 |
| **Audit Logs** | `GET /accounts/{id}/audit_logs` | 账户配置变更 | 18 个月 |
| **DNS Analytics** | `GET /zones/{id}/dns_analytics/report` | DNS 查询统计 | 30 天 |
| **DNS Firewall** | `GET /zones/{id}/dns_firewall` | DNS 防火墙 | 30 天 |
| **Health Check** | `GET /zones/{id}/health_checks/{id}/preview` | LB 健康检查 | 实时 |
| **Workers Analytics** | `GET /accounts/{id}/workers/analytics` | Worker 调用统计 | 30 天 |

**CLI 示例**：

```bash
# === 1. 查询最近 1 小时的 WAF 拦截事件 ===
cfcli logs firewall-events --zone nc-demo.cf \
  --since 1h \
  --action block \
  --limit 100

# === 2. 查询某个 IP 的所有访问 ===
cfcli logs firewall-events --zone nc-demo.cf \
  --since 24h \
  --client-ip "1.2.3.4"

# === 3. GraphQL 查询：最近 7 天 5xx 错误率 ===
cfcli logs graphql --zone nc-demo.cf \
  --query '{
    viewer {
      zones(filter: {zoneTag: "xxx"}) {
        httpRequests1dGroups(limit: 7, filter: {date_geq: "2026-08-10"}) {
          sum { requests pageViews }
          dimensions { date }
          avg { responseStatus }
        }
      }
    }
  }'

# === 4. 查询账户级 Audit Logs ===
cfcli logs audit --account <account-id> \
  --since 30d \
  --action "update" \
  --resource-type "zone"

# === 5. 查询 DNS 查询统计 ===
cfcli logs dns-analytics --zone nc-demo.cf \
  --since 24h \
  --group-by "queryName"
```

#### 25.3.3 Logpush（推送至外部存储）

**特点**：全量日志推送至外部存储（S3 / GCS / Azure Blob / Splunk / Datadog / HTTPS）；支持长期归档（> 1 年）；适合 SIEM 集成；**Ent 专属**。

**支持的 Dataset（按业务域分类）**：

| 业务域 | Dataset | 字段示例 | 推送频率 |
|--------|---------|---------|---------|
| **访问** | `http_requests` | ClientIP、ClientRequestPath、EdgeResponseStatus、CacheCacheStatus、WAFAction、BotScore | 60 秒 |
| **安全** | `firewall_events` | ClientIP、Action、Source、RuleID、BotScore、JA3、JA4 | 60 秒 |
| **DDoS** | `dos_events` | ClientIP、AttackID、MitigatedPackets、AttackType | 60 秒 |
| **Bot** | `bot_management_logs` (Ent) | BotScore、JA3、JA4、MachineLearning | 60 秒 |
| **API Shield** | `apiShield_logs` (Ent) | SchemaValidationResult、JWTValidationResult、SequenceAnalysis | 60 秒 |
| **Workers** | `workers_requests` | WorkerName、Status、CPUtime、EventType | 60 秒 |
| **Workers Trace** | `workers_trace` | LogLevel、Message、Exception | 实时 |
| **Spectrum** | `spectrum_events` (Ent) | Application、Protocol、ClientIP、OriginIP | 60 秒 |
| **Magic Transit** | `magic_transit_logs` (Ent) | TunnelID、Protocol、Packets、Bytes | 60 秒 |
| **Network Analytics** | `network_analytics_logs` (Ent) | ColoID、AttackID、Mitigation | 60 秒 |
| **DNS** | `dns_logs` (Ent) | QueryName、QueryType、ClientIP、ResponseCode | 60 秒 |
| **Waiting Room** | `waiting_room_analytics` | QueueLength、ActiveUsers、Path | 60 秒 |
| **Page Shield** | `page_shield_events` | URL、Host、Action | 60 秒 |
| **Audit Logs** | `audit_logs` | ActorEmail、Action、ResourceType、ResourceID | 60 秒 |
| **NEL Reports** | `nel_reports` | URL、ServerIP、Protocol、Status | 60 秒 |
| **Argo** | `argo_smart_routing_logs` | Path、Status、TTFB | 60 秒 |

**CLI 配置示例**：

```bash
# === 1. 推送 HTTP 访问日志到 S3 ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://my-bucket/cloudflare/http/" \
  --dataset "http_requests" \
  --logpull-options 'fields=ClientIP,ClientRequestPath,EdgeResponseStatus,WAFAction,BotScore,CacheCacheStatus' \
  --frequency 60 \
  --region "CN"

# === 2. 推送 WAF 事件到 Splunk ===
cfcli logpush create --zone nc-demo.cf \
  --destination "splunk://siem.internal:8088" \
  --dataset "firewall_events" \
  --frequency 60

# === 3. 推送 Audit Logs 到 SIEM（账户级） ===
cfcli logpush create --account <account-id> \
  --destination "https://siem.internal:9200/audit/_bulk" \
  --dataset "audit_logs" \
  --frequency 60

# === 4. 推送 Workers 日志到 Datadog ===
cfcli logpush create --account <account-id> \
  --destination "datadog://api.datadoghq.com/api/v2/logs" \
  --dataset "workers_requests" \
  --frequency 60

# === 5. 推送 Spectrum 事件到 Azure Blob ===
cfcli logpush create --zone nc-demo.cf \
  --destination "azureblob://storageaccount/container/spectrum/" \
  --dataset "spectrum_events" \
  --frequency 60
```

#### 25.3.4 Log Explorer（Ent · Cloudflare 内部 SQL 查询引擎）

**特点**：Enterprise Plan 专属；在 Cloudflare 内部以 SQL 直接查询**原始**日志事件（非聚合），无需推送到外部存储；30 天保留期；与 Logpush 互补。

**适用场景**：临时排障、深度下钻、安全调查、审计追溯。当 GraphQL Analytics 返回的聚合数据不足以定位问题时，Log Explorer 是首选。

**入口**：

| 入口 | 路径 |
|------|------|
| **Dashboard** | 选 Zone → Analytics & Logs → **Log Explorer**（或 Security → Events → "View in Log Explorer"） |
| **API** | `POST /zones/{id}/logs/search`（SQL API） |
| **CLI** | `cfcli logs explorer` |

**支持的 Dataset（与 Logpush 对应）**：

| Dataset | 包含字段示例 | 用途 |
|---------|-------------|------|
| `http` | ClientIP、ClientRequestPath、EdgeResponseStatus、OriginResponseStatus、WAFAction、BotScore、JA3、JA4、CacheCacheStatus、ClientRequestUserAgent、RayID | HTTP 访问原始事件 |
| `security` | Action、Source、RuleID、BotScore、JA3、JA4、AttackGroup、ClientIP、ClientRequestPath | WAF / Bot / DDoS / RL 原始安全事件 |
| `workers` | WorkerName、Status、CPUtime、EventType、log_level、message | Worker 调用与异常 |
| `spectrum` | Application、Protocol、ClientIP、OriginIP、Bytes | TCP/UDP 原始事件 |

**Dashboard 操作流程**：

1. 进入 Cloudflare Dashboard → 选 Zone → Analytics & Logs → **Log Explorer**
2. 选择 Dataset（HTTP / Security / Workers / Spectrum）
3. 设置时间范围（最长 30 天）
4. 在 SQL 编辑器中输入 SQL 查询，或使用可视化过滤器（图形化 AND/OR 组合）
5. 支持导出 CSV / JSON（单次最多 10000 行）

**CLI 示例**：

```bash
# === 1. 查询最近 1 小时某个 IP 的所有 HTTP 请求 ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset http \
  --since 1h \
  --sql "SELECT timestamp, ClientIP, ClientRequestPath, EdgeResponseStatus, WAFAction, BotScore FROM http WHERE ClientIP = '1.2.3.4' ORDER BY timestamp DESC LIMIT 1000"

# === 2. 查询最近 24 小时所有 WAF Block 事件 ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset security \
  --since 24h \
  --sql "SELECT timestamp, ClientIP, ClientRequestPath, RuleID, Action, BotScore, JA3 FROM security WHERE Action = 'block' ORDER BY timestamp DESC LIMIT 5000"

# === 3. 查询某 JA3 指纹的所有请求（识别同一工具的批量请求） ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset http \
  --since 7d \
  --sql "SELECT ClientIP, ClientRequestPath, COUNT(*) AS hits FROM http WHERE JA3 = 'e7d705a3286e19ea42f587b344ee6865' GROUP BY ClientIP, ClientRequestPath ORDER BY hits DESC"

# === 4. 查询 Bot Score < 10 的自动化请求 ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset http \
  --since 24h \
  --sql "SELECT timestamp, ClientIP, ClientRequestUserAgent, ClientRequestPath, BotScore FROM http WHERE BotScore < 10 ORDER BY BotScore ASC LIMIT 1000"

# === 5. 查询某 URL 的所有 5xx 响应（含源站状态码） ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset http \
  --since 24h \
  --sql "SELECT timestamp, ClientIP, EdgeResponseStatus, OriginResponseStatus, RayID FROM http WHERE ClientRequestPath = '/api/payment' AND EdgeResponseStatus >= 500 ORDER BY timestamp DESC"

# === 6. 查询 Worker 异常事件 ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset workers \
  --since 1h \
  --sql "SELECT timestamp, WorkerName, EventType, log_level, message FROM workers WHERE log_level = 'error' ORDER BY timestamp DESC"

# === 7. 导出结果为 CSV ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset http \
  --since 7d \
  --sql "SELECT * FROM http WHERE EdgeResponseStatus >= 500" \
  --format csv \
  --output ./5xx-7d.csv

# === 8. 查询 Spectrum TCP/UDP 事件 ===
cfcli logs explorer --zone nc-demo.cf \
  --dataset spectrum \
  --since 24h \
  --sql "SELECT timestamp, Application, Protocol, ClientIP, Bytes FROM spectrum ORDER BY Bytes DESC LIMIT 100"
```

**Log Explorer vs GraphQL Analytics API 对比**：

| 维度 | GraphQL Analytics API | Log Explorer |
|------|----------------------|--------------|
| **数据形态** | 聚合数据（按维度分组） | 原始事件行（逐条记录） |
| **查询语言** | GraphQL | SQL |
| **保留期** | 30 天（Ent 90 天） | 360 天 |
| **适合场景** | 趋势分析、KPI 监控、容量规划 | 单事件下钻、根因分析、安全调查 |
| **结果粒度** | 通常聚合到分钟 / 小时 / 天 | 秒级精确到单条请求 |
| **是否需要外部存储** | ❌ | ❌ |
| **Enterprise 专属** | 部分 | ✅ |
| **典型用途** | "最近 7 天 5xx 错误率趋势" | "找出一小时前那条 5xx 的具体请求和 RayID" |

**Log Explorer vs Logpush 对比**：

| 维度 | Logpush | Log Explorer |
|------|---------|--------------|
| **数据流向** | 推出到外部存储 | Cloudflare 内部查询 |
| **是否需要外部基础设施** | ✅ S3 / Splunk / Datadog | ❌ |
| **保留期** | 由外部存储决定（≥ 1 年） | 360 天 |
| **查询方式** | 在外部 SIEM 中查询 | Cloudflare SQL API / Dashboard |
| **实时性** | 60 秒延迟 | 1-2 分钟索引延迟 |
| **典型用途** | 跨平台关联、超长期合规归档（金融 ≥ 3 年） | 临时排障、深度下钻、近一年事件回溯、快速安全调查 |
| **Enterprise 专属** | ✅ | ✅ |

**最佳实践**：
- **临时排障、安全调查、近一年回溯**：首选 Log Explorer（无需配置外部存储）
- **跨平台关联、超长期合规归档（> 360 天）**：用 Logpush 推到 SIEM
- **趋势分析、KPI 监控**：用 GraphQL Analytics API
- **三者协同**：Log Explorer 即时定位 → Logpush 长期归档 → GraphQL API 趋势监控

#### 25.3.5 Workers Logs（边缘计算日志）

Workers 日志是独立体系，**不能在 Dashboard Analytics 直接看到 console.log 输出**，需要专门的查看方式。

| 查看方式 | 命令 / 入口 | 适用场景 |
|---------|-----------|---------|
| **wrangler tail**（实时） | `wrangler tail <worker-name>` | 开发调试、实时排障 |
| **Workers Analytics** | Dashboard → Workers → Analytics | 调用量、CPU 时间、错误率统计 |
| **Workers Logpush** | Logpush dataset = `workers_requests` / `workers_trace` | 生产环境长期归档、SIEM 集成 |
| **Workers Logs（新功能）** | `wrangler tail --format json` + Workers Logs API | 结构化日志查询（Ent） |

**示例：**

```bash
# === 1. 实时查看 Worker console.log 输出 ===
cd workers/my-worker
wrangler tail

# === 2. 筛选特定状态码 ===
wrangler tail --status error

# === 3. JSON 格式输出（便于 jq 处理） ===
wrangler tail --format json | jq 'select(.outcome == "exception")'

# === 4. 推送 Workers 日志到 SIEM ===
cfcli logpush create --account <account-id> \
  --destination "https://siem.internal:9200/workers/_bulk" \
  --dataset "workers_requests" \
  --frequency 60

# === 5. 在 Worker 代码中使用 console.log ===
# 在 Worker 脚本中：
# console.log({
#   user: userId,
#   action: 'login',
#   result: 'success'
# });
# 然后用 wrangler tail 实时查看
```

#### 25.3.6 Audit Logs（账户级配置变更审计）

**特点**：记录账户级所有配置变更（包括 Zone 配置、防火墙规则、DNS 修改、Token 使用等）；保留期 18 个月；**所有 Plan 都有**（Ent 可通过 Logpush 长期归档）。

**记录内容**：

| 字段 | 说明 |
|------|------|
| `ActorEmail` | 操作者邮箱 |
| `ActorIP` | 操作者 IP |
| `Action` | 操作类型（create / update / delete） |
| `ResourceType` | 资源类型（zone / firewall_rule / dns_record / etc.） |
| `ResourceID` | 资源 ID |
| `Metadata` | 变更前后的值 |
| `Timestamp` | 操作时间 |

**查看位置**：

| 入口 | 路径 |
|------|------|
| **Dashboard** | 选 Account → My Profile → Audit Logs |
| **API** | `GET /accounts/{id}/audit_logs` |
| **Logpush** | Dataset = `audit_logs` |

**CLI 示例**：

```bash
# === 1. 查看账户级 Audit Logs ===
cfcli logs audit --account <account-id> --since 30d

# === 2. 筛选某个 Zone 的变更 ===
cfcli logs audit --account <account-id> \
  --since 30d \
  --resource-type "zone" \
  --resource-id "<zone-id>"

# === 3. 筛选防火墙规则变更 ===
cfcli logs audit --account <account-id> \
  --since 7d \
  --resource-type "firewall_rule"

# === 4. 筛选某个操作者的所有操作 ===
cfcli logs audit --account <account-id> \
  --since 30d \
  --actor "admin@nc-demo.cf"

# === 5. 推送 Audit Logs 到 SIEM 长期留存（合规要求） ===
cfcli logpush create --account <account-id> \
  --destination "s3://compliance-bucket/audit/" \
  --dataset "audit_logs" \
  --frequency 60
```

### 25.4 行业场景日志配置对照表

| 行业 | 必备 Logpush Dataset（长期归档） | Log Explorer Dataset（即时探查） | SIEM 目标 | 合规依据 |
|------|-------------------------------|-------------------------------|-----------|---------|
| **金融（第 19 章）** | http_requests + firewall_events + audit_logs + dos_events | http + security | Splunk / ELK | 等保四级 8.1.7 |
| **政企（第 20 章）** | http_requests + firewall_events + audit_logs + magic_transit_logs | http + security | 政府 SIEM | 等保三级 8.1.7 |
| **电力（第 21 章）** | http_requests + firewall_events + spectrum_events + magic_transit_logs + audit_logs | http + security + spectrum | 电力监控 SIEM | 关基条例第 22 条 |
| **支付（第 22 章）** | http_requests + firewall_events + audit_logs + apiShield_logs | http + security + workers | PCI SIEM | PCI-DSS Req 10 |

> **典型组合策略**：日常运维与近一年回溯用 Log Explorer 即时探查 → 高危事件用 Logpush 推到 SIEM 跨平台关联 → 金融/关基 ≥ 3 年合规归档从 SIEM 导出报表。Log Explorer 360 天保留期已覆盖多数合规要求，Logpush 用于超长期归档与跨平台关联。

### 25.5 日志保留期与归档策略

| 日志类型 | Dashboard / API 保留期 | Log Explorer 保留期（Ent） | 长期归档方式 | 合规建议保留期 |
|---------|----------------------|---------------------------|------------|--------------|
| **HTTP Requests** | 30 天（Ent 90 天） | 360 天 | Logpush → S3 | ≥ 6 个月（Log Explorer 已覆盖） |
| **Firewall Events** | 30 天 | 360 天 | Logpush → S3 | ≥ 6 个月（Log Explorer 已覆盖） |
| **Audit Logs** | 18 个月 | - | Logpush → S3 | ≥ 3 年（金融） |
| **DDoS Events** | 30 天 | 360 天 | Logpush → S3 | ≥ 1 年（Log Explorer 已覆盖） |
| **Spectrum Events** | 30 天（Ent） | 360 天 | Logpush → S3 | ≥ 1 年（Log Explorer 已覆盖） |
| **Magic Transit Logs** | 30 天（Ent） | - | Logpush → S3 | ≥ 1 年 |
| **Workers Logs** | 30 天 | 360 天 | Logpush → S3 | ≥ 6 个月（Log Explorer 已覆盖） |
| **DNS Logs** | 30 天（Ent） | - | Logpush → S3 | ≥ 1 年 |

**Logpush 长期归档最佳实践**：

```bash
# === 1. 设置 S3 生命周期策略（自动分层） ===
# S3 → 30 天后转 S3-IA → 90 天后转 Glacier → 1 年后删除
# 通过 AWS CLI 或控制台配置

# === 2. Logpush 推送到 S3（带时间分区） ===
cfcli logpush create --zone nc-demo.cf \
  --destination "s3://cf-logs-archive/http/year=YYYY/month=MM/day=DD/" \
  --dataset "http_requests" \
  --frequency 300 \
  --gzip true

# === 3. Logpush 推送到 Splunk（实时） ===
cfcli logpush create --zone nc-demo.cf \
  --destination "splunk://siem.internal:8088" \
  --dataset "firewall_events,http_requests" \
  --frequency 60
```

### 25.6 日志查询场景实战

#### 场景 1：排查「某用户反馈访问被拦截」

```bash
# 步骤 1：先查 Firewall Events，看是否被 WAF 拦截
cfcli logs firewall-events --zone nc-demo.cf \
  --since 1h \
  --client-ip "用户IP"

# 步骤 2：如果找到拦截记录，看 RuleID 和 Action
# 输出示例:
# {
#   "ClientIP": "1.2.3.4",
#   "Action": "block",
#   "Source": "firewallrules",
#   "RuleID": "abc123",
#   "RuleMessage": "block-malicious-bots",
#   "BotScore": 5,
#   "JA3": "e7d705a3286e19ea42f587b344ee6865"
# }

# 步骤 3：如果是误判，可临时禁用该规则
cfcli waf custom-rule disable --zone nc-demo.cf --rule-id "abc123"

# 步骤 4：如果需要长期放行，添加白名单规则
cfcli waf custom-rule create --zone nc-demo.cf \
  --name "whitelist-user" \
  --expression '(ip.src eq 1.2.3.4)' \
  --action "skip" \
  --skip-phase "http_request_firewall_managed,http_ratelimit"
```

#### 场景 2：排查「网站 5xx 错误率突增」

```bash
# 步骤 1：GraphQL 查询最近 1 小时 5xx 趋势
cfcli logs graphql --zone nc-demo.cf \
  --query '{
    viewer {
      zones(filter: {zoneTag: "xxx"}) {
        httpRequests1mGroups(limit: 60, filter: {datetime_geq: "2026-08-17T10:00:00Z"}) {
          sum { requests errors }
          dimensions { datetime }
        }
      }
    }
  }'

# 步骤 2：查 Edge Log Streaming（Ent），实时过滤 5xx
cfcli logs tail --zone nc-demo.cf \
  --filter "EdgeResponseStatus >= 500" \
  --fields "ClientIP,ClientRequestPath,EdgeResponseStatus,OriginResponseStatus"

# 步骤 3：判断是边缘错误还是源站错误
# EdgeResponseStatus=5xx + OriginResponseStatus=5xx → 源站问题
# EdgeResponseStatus=5xx + OriginResponseStatus=0   → 源站不可达
# EdgeResponseStatus=5xx + OriginResponseStatus=null → 边缘问题（WAF/Worker）

# 步骤 4：查 Health Check 状态
cfcli lb health-check status --zone nc-demo.cf --hc-id <hc-id>
```

#### 场景 3：排查「某员工改了什么配置」

```bash
# 步骤 1：查 Audit Logs，按操作者筛选
cfcli logs audit --account <account-id> \
  --since 24h \
  --actor "admin@nc-demo.cf"

# 步骤 2：按资源类型筛选
cfcli logs audit --account <account-id> \
  --since 24h \
  --resource-type "firewall_rule"

# 步骤 3：导出审计日志（合规检查）
cfcli logs audit --account <account-id> \
  --since 90d \
  --format csv \
  --output ./audit-90d.csv
```

#### 场景 4：排查「Worker 报错」

```bash
# 步骤 1：实时查看 Worker 日志
cd workers/my-worker
wrangler tail --status error

# 步骤 2：JSON 格式 + jq 过滤异常
wrangler tail --format json | jq 'select(.outcome == "exception")'

# 步骤 3：查 Workers Analytics（Dashboard 看不到 console.log，但能看到调用统计）
cfcli logs graphql --account <account-id> \
  --query '{
    viewer {
      accounts(filter: {accountTag: "xxx"}) {
        workersInvocationsAdaptive(limit: 100) {
          sum { requests errors subrequests }
          dimensions { scriptName status }
        }
      }
    }
  }'

# 步骤 4：如果需要长期归档，配置 Workers Logpush
cfcli logpush create --account <account-id> \
  --destination "s3://workers-logs/" \
  --dataset "workers_requests,workers_trace" \
  --frequency 60
```

#### 场景 5：排查「DDoS 攻击」

```bash
# 步骤 1：查 Dashboard → Security → Events → DDoS 标签
# 或用 CLI 查询
cfcli logs firewall-events --zone nc-demo.cf \
  --since 1h \
  --source "dos_analytics"

# 步骤 2：Logpush DDoS 事件到 SIEM
cfcli logpush create --zone nc-demo.cf \
  --destination "splunk://siem.internal:8088" \
  --dataset "dos_events" \
  --frequency 60

# 步骤 3：实时监控（Ent Edge Log tail）
cfcli logs tail --zone nc-demo.cf \
  --filter "WAFAction eq 'block'" \
  --fields "ClientIP,ClientRequestPath,WAFAction"
```

### 25.7 日志位置完整速查矩阵

```
┌─────────────────────────────────────────────────────────────────────┐
│                    我想看 X → 去哪里看？                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── HTTP 访问日志 ──────────────────────────────────────────────┐ │
│  │ Dashboard    │ Analytics → Overview                            │ │
│  │ API          │ GraphQL Analytics API                           │ │
│  │ Logpush      │ dataset = http_requests                         │ │
│  │ 实时 tail    │ cfcli logs tail (Ent)                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── WAF / Bot / DDoS / Rate Limiting ─────────────────────────┐  │
│  │ Dashboard    │ Security → Events                              │  │
│  │ API          │ Firewall Events API                            │  │
│  │ Logpush      │ dataset = firewall_events                      │  │
│  │ DDoS 专项   │ dataset = dos_events                            │  │
│  │ Bot 专项    │ dataset = bot_management_logs (Ent)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── API Shield ───────────────────────────────────────────────┐  │
│  │ Dashboard    │ Security → API Shield                          │  │
│  │ Logpush      │ dataset = apiShield_logs (Ent)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Workers 日志 ─────────────────────────────────────────────┐  │
│  │ console.log  │ wrangler tail（实时，开发调试）                  │  │
│  │ Analytics    │ Dashboard → Workers → Analytics                │  │
│  │ Logpush      │ dataset = workers_requests / workers_trace     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Spectrum (TCP/UDP) ───────────────────────────────────────┐  │
│  │ Dashboard    │ Spectrum → Analytics                            │  │
│  │ Logpush      │ dataset = spectrum_events (Ent)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Magic Transit ────────────────────────────────────────────┐  │
│  │ Dashboard    │ Magic Transit → Analytics                       │  │
│  │ Logpush      │ dataset = magic_transit_logs (Ent)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Audit Logs（配置变更审计）────────────────────────────────┐  │
│  │ Dashboard    │ My Profile → Audit Logs                        │  │
│  │ API          │ /audit_logs                                    │  │
│  │ Logpush      │ dataset = audit_logs                           │  │
│  │ 保留期       │ 18 个月                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Waiting Room ────────────────────────────────────────────┐   │
│  │ Dashboard    │ Traffic → Waiting Room                         │   │
│  │ Logpush      │ dataset = waiting_room_analytics               │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── DNS ─────────────────────────────────────────────────────┐   │
│  │ Dashboard    │ DNS → Analytics                                 │   │
│  │ API          │ DNS Analytics API                               │   │
│  │ Logpush      │ dataset = dns_logs (Ent)                       │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── NEL Reports (Real User Monitoring) ──────────────────────┐   │
│  │ Dashboard    │ Speed → RUM                                     │   │
│  │ Logpush      │ dataset = nel_reports                           │   │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Page Shield ────────────────────────────────────────────┐    │
│  │ Dashboard    │ Security → Page Shield                        │    │
│  │ Logpush      │ dataset = page_shield_events                  │    │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Argo Smart Routing ────────────────────────────────────┐     │
│  │ Dashboard    │ Traffic → Argo                               │     │
│  │ Logpush      │ dataset = argo_smart_routing_logs            │     │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── Log Explorer（Ent · 即时 SQL 探查）──────────────────────┐   │
│  │ Dashboard    │ Analytics & Logs → Log Explorer              │    │
│  │ API          │ /zones/{id}/logs/search（SQL API）           │    │
│  │ CLI          │ cfcli logs explorer --dataset http/security  │    │
│  │ 数据集       │ http / security / workers / spectrum         │    │
│  │ 保留期       │ 360 天                                        │    │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 25.8 CLI 日志命令索引（v3.1 新增）

| 命令 | 用途 | 示例 |
|------|------|------|
| `cfcli logs tail` | 实时边缘日志流（Ent） | `cfcli logs tail --zone nc-demo.cf --filter "EdgeResponseStatus >= 500"` |
| `cfcli logs explorer` | Log Explorer SQL 查询（Ent） | `cfcli logs explorer --zone nc-demo.cf --dataset http --sql "SELECT ..."` |
| `cfcli logs firewall-events` | 查询 WAF/Bot/DDoS 事件 | `cfcli logs firewall-events --zone nc-demo.cf --since 24h` |
| `cfcli logs audit` | 查询账户级审计日志 | `cfcli logs audit --account <id> --since 30d` |
| `cfcli logs dns-analytics` | 查询 DNS 查询统计 | `cfcli logs dns-analytics --zone nc-demo.cf --since 24h` |
| `cfcli logs graphql` | GraphQL Analytics 查询 | `cfcli logs graphql --zone nc-demo.cf --query '...'` |
| `cfcli logpush create` | 创建 Logpush 推送任务 | `cfcli logpush create --zone nc-demo.cf --destination "s3://..." --dataset http_requests` |
| `cfcli logpush list` | 列出 Logpush 任务 | `cfcli logpush list --zone nc-demo.cf` |
| `cfcli logpush delete` | 删除 Logpush 任务 | `cfcli logpush delete --zone nc-demo.cf --id <job-id>` |
| `cfcli logpush update` | 更新 Logpush 任务 | `cfcli logpush update --zone nc-demo.cf --id <job-id> --frequency 300` |
| `cfcli logpush validate` | 验证目标可达性 | `cfcli logpush validate --destination "s3://..."` |
| `cfcli logpush ownership` | 验证存储桶所有权 | `cfcli logpush ownership --zone nc-demo.cf --id <job-id>` |

### 25.9 常见误区与最佳实践

| 误区 | 正确做法 |
|------|---------|
| ❌ 在 Dashboard → Analytics 找 Worker 的 console.log | ✅ 用 `wrangler tail` 实时查看，或配置 Workers Logpush，或在 Log Explorer 查 workers 数据集 |
| ❌ 在 Firewall Events 找 Audit Logs | ✅ Audit Logs 在 My Profile → Audit Logs，是账户级而非 Zone 级 |
| ❌ 期望 Dashboard 默认保留日志 1 年 | ✅ Dashboard 默认 30 天（Ent 90 天），需 Logpush 推送到外部长期保存 |
| ❌ 在 Zone 级 API 找 Audit Logs | ✅ Audit Logs 是账户级 API：`/accounts/{id}/audit_logs` |
| ❌ 把所有日志推到同一个 S3 bucket 不分区 | ✅ 按日期 + dataset 分区：`s3://bucket/dataset/year=YYYY/month=MM/day=DD/` |
| ❌ 没启用 Logpush 就期望有 6 个月前的日志 | ✅ 合规要求 ≥ 6 个月保留期，必须配置 Logpush + S3 生命周期 |
| ❌ Worker 异常只在 Dashboard 看 | ✅ Dashboard 看不到 console.log，必须 `wrangler tail`、Workers Logpush 或 Log Explorer（workers 数据集） |
| ❌ 等保审计只看 HTTP 日志 | ✅ 必须包含 Audit Logs（配置变更），否则不满足等保 8.1.7 |
| ❌ Logpush 频率设为 0（实时） | ✅ Logpush 最小频率 60 秒，需要实时用 `cfcli logs tail`，需要即席查询用 Log Explorer |
| ❌ 一台机器装 wrangler 用于生产日志 | ✅ wrangler tail 是开发工具，生产用 Workers Logpush 或 Log Explorer |
| ❌ 把 Log Explorer 当作超长期合规归档 | ✅ Log Explorer 保留 360 天，对 ≥ 6 个月 / 1 年的合规要求已覆盖；但金融等保 ≥ 3 年仍需 Logpush → 外部存储 |
| ❌ 用 GraphQL Analytics 查询原始单条请求 | ✅ GraphQL 返回的是聚合数据，单条请求下钻用 Log Explorer（原始事件行） |
| ❌ 想查询某 JA3 指纹的所有请求却用 Dashboard | ✅ Dashboard 不支持 JA3 下钻，用 Log Explorer SQL 查询 `WHERE JA3 = '...'` |
| ❌ Log Explorer 数据集与 Logpush Dataset 混淆 | ✅ Log Explorer 用 `http/security/workers/spectrum`，Logpush 用 `http_requests/firewall_events/workers_requests/spectrum_events` |
| ❌ 期望 Log Explorer 查到 1 年前的数据 | ✅ Log Explorer 保留 360 天（接近 1 年），超过 360 天的长期查询需从 Logpush 推送的外部 SIEM 中查 |

---

> **文档版本**: v3.7  
> **最后更新**: 2026-08-17  
> **适用 CLI 版本**: cfcli v1.0.0  
> **变更说明**: v3.7 联网 Cloudflare 官方文档核对修正：① Waiting Room 可用 Plan 由 Pro+ 修正为 Business+；② Log Explorer 标注 Beta 状态并注明保留期以 Enterprise 合同为准、数据存储于 R2；③ Total TLS 补充限制说明（不适用于 LB/Tunnel/Spectrum、需 Full DNS setup、默认有效期 90 天）；④ ACM 补充单张证书 50 SAN 限制与 Enterprise 每 Zone 100 张证书配额；⑤ 第 27 章补充 Automatic SSL/TLS 新特性说明；⑥ 第 4 章补充 AOP 三个独立配置级别（Global/Zone-level/Per-hostname）、优先级规则、FIPS 合规与后量子证书支持；⑦ AOP Plan 可用性修正为全 Plan 可用（原误标为 Ent）；v3.6 在第 11 章新增「LB DNS 记录优先级说明」；v3.5 新增第 27 章「SSL/TLS 四种模式场景化深度对比与迁移策略」；v3.4 新增第 26 章「加密套件自定义与 TLS 协商深度解析」；v3.3 修正 Log Explorer 保留期为 360 天（Enterprise Plan）；v3.2 在第 25 章补充 Log Explorer（Enterprise Plan）专节；v3.1 新增第 25 章可观测性体系；v3.0 新增第 19–24 章（金融 / 政企 / 电力 / 支付行业 / ACME 证书自动化 / 行业对比附录），所有 Cloudflare 功能名采用 Enterprise Plan 官方术语

---

## 26. 加密套件自定义与 TLS 协商深度解析

### 26.1 概述：为什么需要自定义加密套件

加密套件（Cipher Suite）决定了客户端与 Cloudflare 边缘之间 TLS 握手所用的算法组合，直接影响：

- **安全性**：是否提供前向保密（PFS）、是否抗 Lucky13 / BEAST / POODLE 等攻击
- **合规性**：PCI-DSS v4.0、等保 2.0、金融等保四级、关基条例对加密算法有硬性要求
- **兼容性**：旧浏览器、移动端、IoT 设备可能不支持现代套件
- **性能**：AES-NI 硬件加速 vs ChaCha20 软件实现、套件协商耗时

**核心结论**：

- **Free / Pro / Business** 只能在 Modern / Compatible / Legacy 三个预设等级中选择
- **ACM 与 Enterprise Plan** 才能精确控制单个 TLS 1.2 套件的启用与顺序
- **Enterprise Plan** 额外支持强制 TLS 1.3、自定义 ECDH 曲线
- **TLS 1.3 套件无法自定义顺序**，由 Cloudflare 强制管理

### 26.2 TLS 握手在请求流水线中的位置

```
客户端 ─── TCP/QUIC 建连 ─── TLS 握手 ─── HTTP 请求 ─── 响应
                                │
                                ▼
                    ┌───────────────────────┐
                    │  ClientHello          │
                    │  - 支持的 TLS 版本     │
                    │  - 支持的加密套件列表  │ ← 客户端能力上限
                    │  - SNI                │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Cloudflare Edge 选套件│ ← 受 Zone 配置约束
                    │  - 匹配 TLS 版本       │
                    │  - 从自定义列表中选    │
                    │  - 考虑证书类型(RSA/   │
                    │    ECDSA)             │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  ServerHello          │
                    │  - 选定套件            │ ← 协商结果
                    │  - 证书               │
                    │  - 密钥交换           │
                    └───────────────────────┘
```

> **关键点**：加密套件协商发生在 **TLS 握手阶段**，**早于** WAF / Bot Management / Cache 等所有 HTTP 层处理。如果套件协商失败，请求根本进不到 Cloudflare 的安全管线。

### 26.3 TLS 1.3 加密套件（无法自定义顺序）

| 套件名称 | 加密 | MAC | 推荐场景 |
|---------|------|-----|---------|
| `TLS_AES_128_GCM_SHA256` | AES-128-GCM | SHA256 | **默认推荐**，性能最佳 |
| `TLS_AES_256_GCM_SHA384` | AES-256-GCM | SHA384 | 合规要求 256 位 |
| `TLS_CHACHA20_POLY1305_SHA256` | ChaCha20-Poly1305 | SHA256 | 移动端无 AES-NI |

> TLS 1.3 套件由 Cloudflare 强制管理，无法通过 API / CLI 修改顺序。如需严格控制必须使用 TLS 1.2。

### 26.4 TLS 1.2 加密套件（可自定义顺序，需 ACM 或 Ent）

| 套件名称 | 认证 | 加密 | 前向保密 | 推荐度 |
|---------|------|------|---------|--------|
| `ECDHE-ECDSA-AES128-GCM-SHA256` | ECDSA | AES-128-GCM | ✅ | ★★★★★ |
| `ECDHE-ECDSA-AES256-GCM-SHA384` | ECDSA | AES-256-GCM | ✅ | ★★★★★ |
| `ECDHE-ECDSA-CHACHA20-POLY1305` | ECDSA | ChaCha20 | ✅ | ★★★★★ |
| `ECDHE-RSA-AES128-GCM-SHA256` | RSA | AES-128-GCM | ✅ | ★★★★☆ |
| `ECDHE-RSA-AES256-GCM-SHA384` | RSA | AES-256-GCM | ✅ | ★★★★☆ |
| `ECDHE-RSA-CHACHA20-POLY1305` | RSA | ChaCha20 | ✅ | ★★★★☆ |
| `ECDHE-ECDSA-AES128-SHA256` | ECDSA | AES-128-CBC | ✅ | ★★★☆☆ |
| `ECDHE-RSA-AES128-SHA256` | RSA | AES-128-CBC | ✅ | ★★★☆☆ |
| `AES128-GCM-SHA256` | RSA | AES-128-GCM | ❌ | ★★☆☆☆ |
| `AES256-GCM-SHA384` | RSA | AES-256-GCM | ❌ | ★★☆☆☆ |
| `AES128-SHA256` | RSA | AES-128-CBC | ❌ | ★☆☆☆☆ |
| `AES256-SHA256` | RSA | AES-256-CBC | ❌ | ★☆☆☆☆ |

**关键规则**：
- ECDSA 套件需 ECDSA 证书；RSA 套件需 RSA 证书
- 带 `ECDHE` 的套件提供**前向保密（PFS）**，是合规硬性指标
- CBC 模式存在 Lucky13 攻击风险，**仅在兼容旧客户端时启用**
- 不带 ECDHE 的 RSA 套件**无 PFS**，PCI-DSS v4.0 与等保四级已不推荐

### 26.5 各 Plan 加密套件自定义能力对比

| 能力 | Free | Pro | Business | ACM | **Enterprise** |
|------|------|-----|----------|-----|---------------|
| Modern / Compatible / Legacy 等级 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 自定义 TLS 1.2 套件顺序 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 自定义 TLS 1.3 套件顺序 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 禁用 TLS 1.0 / 1.1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 强制 TLS 1.3（min=1.3） | ❌ | ❌ | ❌ | ❌ | ✅ |
| 0-RTT 控制 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 自定义 ECDH 曲线 | ❌ | ❌ | ❌ | ❌ | ✅ |
| HSTS preload | ✅ | ✅ | ✅ | ✅ | ✅ |

### 26.6 合规要求对照表

| 合规框架 | 最低 TLS | 强制要求 | 禁用套件 | 推荐套件顺序 |
|---------|---------|---------|---------|-------------|
| **PCI-DSS v4.0** | 1.2 | PFS + AEAD | 3DES、RC4、CBC、RSA 密钥交换 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **等保 2.0 三级** | 1.2 | PFS | RC4、3DES | ECDHE-ECDSA-AES128-GCM-SHA256 → ECDHE-RSA-AES128-GCM-SHA256 |
| **等保 2.0 四级** | 1.2 | PFS + 256 位 | RC4、3DES、SHA1 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **金融等保四级（JR/T 0171）** | 1.2 | PFS + 国密可选 | RC4、3DES、RSA 密钥交换 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **关基条例** | 1.2 | PFS + AEAD | RC4、3DES | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **支付行业监管** | 1.2 | PFS | RC4、3DES | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **FIPS 140-2** | 1.2 | NIST 批准算法 | ChaCha20（部分版本） | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |

### 26.7 CLI 命令示例

#### 查看与设置加密套件等级

```bash
# 查看当前配置
cfcli ssl ciphers get --zone nc-demo.cf

# 设置预设等级
cfcli ssl ciphers set --zone nc-demo.cf --level modern        # 仅 TLS 1.3
cfcli ssl ciphers set --zone nc-demo.cf --level compatible    # TLS 1.2 + 1.3
cfcli ssl ciphers set --zone nc-demo.cf --level legacy        # 兼容旧浏览器
```

#### 自定义 TLS 1.2 套件顺序（需 ACM 或 Ent）

```bash
# === 金融等保四级推荐配置 ===
cfcli ssl ciphers set --zone fin.nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-RSA-AES128-GCM-SHA256,ECDHE-ECDSA-CHACHA20-POLY1305,ECDHE-RSA-CHACHA20-POLY1305"

# === PCI-DSS v4.0 严格配置（禁用 CBC 与 RSA 套件） ===
cfcli ssl ciphers set --zone pay.nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"
```

#### TLS 版本与 ECDH 曲线

```bash
# 禁用 TLS 1.0 / 1.1
cfcli ssl tls-version set --zone nc-demo.cf --min 1.2 --max 1.3

# Enterprise 专属：强制 TLS 1.3
cfcli ssl tls-version set --zone nc-demo.cf --min 1.3 --max 1.3

# Enterprise 专属：自定义 ECDH 曲线
cfcli ssl ecdh-curve set --zone nc-demo.cf --curves "X25519,P-256,P-384"
```

#### HSTS

```bash
cfcli ssl hsts set --zone nc-demo.cf \
  --max-age 31536000 \
  --include-subdomains true \
  --preload true
```

#### 验证

```bash
# cfcli 验证
cfcli ssl verify --zone nc-demo.cf --host "www.nc-demo.cf" --verbose
cfcli ssl verify --zone nc-demo.cf --host "www.nc-demo.cf" --cipher "ECDHE-ECDSA-AES256-GCM-SHA384"

# OpenSSL 验证
openssl s_client -connect www.nc-demo.cf:443 -tls1_2 -cipher ECDHE-ECDSA-AES256-GCM-SHA384
openssl s_client -connect www.nc-demo.cf:443 -tls1_3 -ciphersuites TLS_AES_256_GCM_SHA384

# 全量扫描
nmap --script ssl-enum-ciphers -p 443 www.nc-demo.cf
```

### 26.8 决策流程图

```
                  ┌───────────────────────┐
                  │  是否有合规要求？        │
                  └───────────────────────┘
                       │            │
                    是 │            │ 否
                       ▼            ▼
        ┌──────────────────────┐  ┌───────────────────────┐
        │ 是否金融/关基/PCI？    │  │ 是否有旧客户端？        │
        └──────────────────────┘  └───────────────────────┘
              │            │            │            │
           是 │         否 │          是 │          否 │
              ▼            ▼            ▼            ▼
        Custom        Custom        Legacy        Modern
        AES-256-GCM   AES-128-GCM   兼容旧版       仅 TLS1.3
        强制 PFS       强制 PFS      60 天宽限      最严格
        min 1.2       min 1.2
              │                │
              ▼                ▼
        ┌──────────────────────────────────────────────────────┐
        │  验证：                                                │
        │  1. SSL Labs 评级 ≥ A                                  │
        │  2. cfcli ssl verify 检查套件生效                       │
        │  3. Dashboard → Analytics → TLS 握手失败监控             │
        │  4. Log Explorer 查 `http` 数据集确认协商结果            │
        └──────────────────────────────────────────────────────┘
```

### 26.9 行业推荐配置

| 行业 | 等级 | 推荐套件顺序 | TLS 版本 | HSTS |
|------|------|-------------|---------|------|
| **金融** | Custom | ECDHE-ECDSA-AES256-GCM-SHA384, ECDHE-RSA-AES256-GCM-SHA384, ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256 | 1.2-1.3 | ✅ 1 年 + preload |
| **政企** | Compatible | （预设） | 1.2-1.3 | ✅ 1 年 |
| **电力** | Custom | ECDHE-ECDSA-AES256-GCM-SHA384, ECDHE-RSA-AES256-GCM-SHA384, ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256 | 1.2-1.3 | ✅ 1 年 + preload |
| **支付** | Custom | ECDHE-ECDSA-AES256-GCM-SHA384, ECDHE-RSA-AES256-GCM-SHA384, ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256 | 1.2-1.3 | ✅ 1 年 + preload |
| **通用** | Modern | （仅 TLS 1.3） | 1.2-1.3 | ✅ 1 年 |

### 26.10 故障排查

| 症状 | 可能原因 | 排查步骤 | 解决方案 |
|------|---------|---------|---------|
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | 客户端不支持所选套件 | SSL Labs 测试客户端能力 | 降级到 Compatible 或追加 CBC 套件 |
| 旧 Android（≤ 7.0）无法访问 | 不支持 TLS 1.3 或 ECDHE | 查 Log Explorer `http` 数据集 TLS 错误 | 启用 Legacy 或追加 RSA 套件 |
| Java 7 客户端连接失败 | 不支持 ECDHE | 检查客户端日志 | 追加 `AES128-SHA256`（无 PFS） |
| PCI-DSS 扫描不通过 | 启用了 CBC 或 RSA 套件 | `cfcli ssl ciphers get` 检查 | 切换 Custom，仅保留 GCM + ECDHE |
| 等保四级扫描不通过 | 未启用 256 位套件 | 检查套件顺序 | 首选 `ECDHE-ECDSA-AES256-GCM-SHA384` |
| TLS 握手延迟高 | 套件协商耗时 | Log Explorer 查 `http` 数据集 | 减少套件数量，只保留 4-6 个 |
| SSL Labs 评级低于 A | TLS 1.0/1.1 启用 | `cfcli ssl tls-version get` | `cfcli ssl tls-version set --min 1.2` |
| 0-RTT 重放攻击风险 | 启用了 TLS 1.3 0-RTT | Dashboard → SSL/TLS → Edge Certificates | 禁用 0-RTT 或仅在幂等接口启用 |

### 26.11 与日志体系联动（第 25 章关联）

加密套件协商失败可在以下日志位置定位：

| 排障场景 | 日志位置 | 查询方式 |
|---------|---------|---------|
| TLS 握手失败统计 | GraphQL Analytics API | `cfcli logs graphql --query '...tlsHandshake...'` |
| 单条 TLS 错误下钻 | Log Explorer（Ent） | `cfcli logs explorer --dataset http --sql "SELECT ... WHERE EdgeResponseStatus = 525"` |
| 套件协商结果分布 | Log Explorer（Ent） | `SELECT ClientSSLCipher, COUNT(*) FROM http GROUP BY ClientSSLCipher` |
| 长期归档 TLS 错误 | Logpush → SIEM | `dataset = http_requests` + 筛选 `EdgeResponseStatus IN (525, 526)` |
| 配置变更审计 | Audit Logs | `cfcli logs audit --resource-type "ssl_setting"` |

> **典型排障链**：SSL Labs 报告评级下降 → Audit Logs 确认是否有人改动套件配置 → Log Explorer 查最近 7 天 TLS 握手失败分布 → 必要时回滚到合规配置。

### 26.12 与其他章节关联

| 关联章节 | 关联点 |
|---------|--------|
| 第 3 章 SSL 模式 | SSL 模式（Flexible / Full / Full Strict）决定源站连接，加密套件决定客户端连接 |
| 第 5 章 mTLS | mTLS 套件协商同样受 Zone 加密套件配置影响 |
| 第 19–22 章行业场景 | 各行业推荐配置见 26.9 节 |
| 第 23 章 ACME | ACME 签发的证书类型（RSA / ECDSA）决定可用套件范围 |
| 第 25 章日志体系 | 加密套件协商失败可在 Log Explorer / Logpush 定位 |

---

## 27. SSL/TLS 四种模式场景化深度对比与迁移策略

> **官方更新（2026）**：Cloudflare 正在推出 **Automatic SSL/TLS**（默认模式），由 SSL/TLS Recommender 自动探测源站证书能力并选择最安全的加密模式。未迁移的 Zone 仍使用 **Custom SSL/TLS**（即下文四种手动模式）。两种模式下的四种加密级别行为一致，本章对比适用于 Custom SSL/TLS 手动设置和 Automatic SSL/TLS 的底层行为。参考：[Encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)

### 27.1 四种 SSL/TLS 模式全景图

Cloudflare 在访客 → Edge 与 Edge → Origin 之间支持四种 SSL/TLS 加密模式，差异在于「是否加密」与「是否验证源站证书」两个维度：

```
                  访客 ─────────────► Cloudflare Edge ─────────────► Origin
                        (连接1)                         (连接2)

┌─────────────────────┬────────────────────┬─────────────────────┬──────────────────┐
│      模式           │      连接1          │       连接2           │  源站证书要求    │
├─────────────────────┼────────────────────┼─────────────────────┼──────────────────┤
│  ① Off              │ HTTP（明文）        │ HTTP（明文）          │ 无               │
│  ② Flexible         │ HTTPS              │ HTTP（明文）⚠️        │ 无               │
│  ③ Full             │ HTTPS              │ HTTPS（不验证）        │ 任意证书(含自签) │
│  ④ Full (Strict)    │ HTTPS              │ HTTPS（验证）✅        │ 有效公网证书     │
│                     │                    │                      │ 或 Cloudflare    │
│                     │                    │                      │ Origin CA        │
└─────────────────────┴────────────────────┴─────────────────────┴──────────────────┘

安全等级：Off < Flexible < Full < Full Strict
合规要求：Off / Flexible 不满足任何合规框架
```

### 27.2 四种模式详细特性对比

| 维度 | Off | Flexible | Full | Full (Strict) |
|------|-----|----------|------|---------------|
| **连接1（访客→Edge）** | HTTP（明文） | HTTPS | HTTPS | HTTPS |
| **连接2（Edge→Origin）** | HTTP（明文） | HTTP（明文） | HTTPS | HTTPS |
| **源站证书验证** | - | - | ❌ 不验证 | ✅ 验证证书链 + 有效期 + 域名匹配 |
| **MITM 攻击防护** | ❌ | ⚠️ 仅访客侧 | ⚠️ 仅防中间网络嗅探 | ✅ 端到端防护 |
| **源站 443 要求** | ❌（80 即可） | ❌（80 即可） | ✅（443/8443 等） | ✅（443/8443 等） |
| **源站证书类型** | 无 | 无 | 自签 / 过期 / 无效均可 | 公网有效证书 / Cloudflare Origin CA |
| **PCI-DSS v4.0** | ❌ 违规 | ❌ 违规（源站不加密） | ❌ 违规（不验证源站） | ✅ 合规 |
| **等保 2.0** | ❌ 违规 | ❌ 违规 | ⚠️ 合规有风险 | ✅ 合规 |
| **金融等保四级** | ❌ 违规 | ❌ 违规 | ❌ 违规 | ✅ 合规 |
| **关基条例** | ❌ 违规 | ❌ 违规 | ❌ 违规 | ✅ 合规 |
| **支付行业监管** | ❌ 违规 | ❌ 违规 | ❌ 违规 | ✅ 合规 |
| **适合生产** | ❌ | ⚠️ 仅过渡 | ⚠️ 可短期用 | ✅ 推荐 |
| **Authenticated Origin Pulls 兼容** | ❌ | ❌ | ✅（意义有限） | ✅（最佳组合） |
| **Client Certificates 兼容** | ❌ | ✅（连接2 不影响） | ✅ | ✅ |
| **Spectrum 兼容** | ✅ | ✅ | ✅ | ✅ |
| **Cloudflare Tunnel 兼容** | ✅ | ✅ | ✅ | ✅（Tunnel 自带加密） |

### 27.3 四种模式适用场景深度分析

#### 27.3.1 Off 模式：纯明文传输

**机制**：访客 ↔ Edge ↔ Origin 全程 HTTP 明文，无任何 TLS 加密。

```
访客 ────── HTTP (明文) ──────► Cloudflare ────── HTTP (明文) ──────► Origin
        (Cookie / Token 裸奔)             (Cookie / Token 裸奔)
```

**✓ 适用场景**：

| 场景 | 说明 |
|------|------|
| 本地开发 / 测试环境 | 完全不需要安全的测试站 |
| 纯静态公开内容 | 无用户登录、无表单提交（纯展示官网且无敏感内容） |
| 灰度启用 HTTPS 前的基线状态 | 迁移前确认源站可用性 |
| 内网穿透场景 + Cloudflare Tunnel | Tunnel 自身提供 end-to-end 加密，SSL 模式 Off 也安全 |

**✗ 绝对禁止场景**：
- 任何用户登录 / 表单提交 / Cookie 认证的场景
- 任何涉及 PII / 订单 / 支付的场景
- 任何合规要求的行业（金融 / 关基 / 医疗 / 支付 / 政企）
- **任何生产环境**

**风险点**：
```
┌───────────────────────────────────────────────┐
│ Off 模式风险                                   │
├───────────────────────────────────────────────┤
│ 1. 访客 ↔ Edge：Cookie / Token / 密码被中间人  │
│ 2. Edge ↔ Origin：Cookie / Token / 密码被窃取   │
│ 3. 所有合规框架均不允许                        │
│ 4. SEO 惩罚（Google 降低排名）                 │
└───────────────────────────────────────────────┘
```

#### 27.3.2 Flexible 模式：访客侧加密，源站明文

**机制**：访客 ↔ Edge 是 HTTPS（加密），但 Edge ↔ Origin 退化为 HTTP（明文）。Cloudflare 历史上最常用的「迁移跳板」模式。

```
访客 ── HTTPS (加密) ──► Cloudflare ── HTTP (明文) ──► Origin
        ✓ 安全              ⚠️ 不安全 (Cloudflare 和源站之间)
```

**✓ 适用场景**：

| 场景 | 说明 |
|------|------|
| 源站暂时无法部署 HTTPS | 遗留系统无法升级 Nginx / Apache，或技术债严重 |
| HTTPS 迁移的第一步 | 先用 Flexible 让访客侧有锁图标，同时准备源站证书 |
| 源站仅监听 80 | 企业源站因运维管控无法开放 443 |
| 开发 / 测试环境快速启用 HTTPS | 不关心源站加密 |
| 静态资源站（无敏感内容） | 图片 / CSS / JS CDN 场景 |
| 灰度 Full 模式前的过渡 | 建议 ≤ 60 天灰度期 |

**✗ 禁止场景**：
- 任何合规要求的行业（PCI-DSS / 等保 / 支付行业监管 / 关基 / HIPAA）
- 源站与 Cloudflare 不在同一机房（公网传输明文）
- 任何登录 / 支付 / 订单 / 用户中心接口
- 涉及 PII 的任何场景

**典型风险（被忽视的陷阱）**：

```
┌───────────────────────────────────────────────┐
│ Flexible 模式隐藏风险                          │
├───────────────────────────────────────────────┤
│                                               │
│  访客 → Edge：✓ HTTPS 加密（浏览器有锁图标）     │
│  Edge → Origin：✗ HTTP 明文（中间网络可嗅探）   │
│                                               │
│  ⚠️ 风险点：                                   │
│  1. 源站在公有云上 VPC 外 → 明文跨 IDC          │
│  2. Cloudflare 到源站经过中间运营商 → 被嗅探     │
│  3. PCI-DSS Req 3.4 明文传输持卡人数据 → 违规    │
│  4. 等保 8.1.8 不允许明文传输敏感信息 → 违规      │
│                                               │
└───────────────────────────────────────────────┘
```

> **关键认知**：Flexible 模式只保护「最后一公里」（访客到 Cloudflare），但**中间几万公里**（Cloudflare 到源站）是裸奔的。合规审计不会因为浏览器有锁图标就放行。

#### 27.3.3 Full 模式：端到端加密，但不验证源站证书

**机制**：访客 ↔ Edge ↔ Origin 全程 HTTPS 加密，但 Cloudflare **不验证**源站证书有效性（自签 / 过期 / 名称不匹配 / 任意链均可）。

```
访客 ── HTTPS (加密) ──► Cloudflare ── HTTPS (加密, 不验证) ──► Origin
        ✓ 安全               ✓ 加密了, 但:
                                  ⚠️ 自签证书可以
                                  ⚠️ 过期证书可以
                                  ⚠️ 域名不匹配可以
```

**✓ 适用场景**：

| 场景 | 说明 |
|------|------|
| 源站使用自签证书 | 内部 CA 签发或 `openssl req -x509 -newkey rsa:2048` |
| 源站证书即将过期 / 已过期 | 应急过渡，避免证书更新断业务 |
| 迁移到 Full Strict 的中间步骤 | 先从 Flexible 升到 Full，再换成有效证书 |
| 测试环境大量实例 | 无需申请有效证书，自签快速部署 |
| 源站证书链配置复杂 | 临时用 Full 模式避免链错误 |
| 源站部署在内部网络 | 组织内网 CA 签发 + 网络已可信 |

**✗ 禁止场景**：
- 金融 / 支付 / 关基等合规严格行业
- 源站与 Cloudflare 之间经过不可信网络（如公网多跳）
- 任何要求**有源站身份验证**的合规框架（等保 8.1.7 / PCI-DSS Req 4 / 支付行业监管 OR-6）

**Full 模式的中间人大漏洞**：

```
假设源站用了自签证书，攻击者在 Cloudflare 与源站之间劫持流量：

合法路径：Cloudflare ── HTTPS ──► 真实源站 (自签证书 A)
被劫持：    Cloudflare ── HTTPS ──► 攻击者服务器 (自签证书 B)

因为 Full 模式不验证证书，Cloudflare 会认为证书 B 也合法。
结果：Cloudflare 把所有请求发给攻击者，完成中间人攻击。
```

#### 27.3.4 Full (Strict) 模式：端到端加密 + 源站证书验证

**机制**：全程 HTTPS 加密 + Cloudflare 严格验证源站证书（必须是 Cloudflare Origin CA 或有效公网证书，且证书链、有效期、域名全部匹配）。

```
访客 ── HTTPS (加密) ──► Cloudflare ── HTTPS (加密, 严格验证) ──► Origin
        ✓ 安全               ✓ 双重保障:
                                  1. 全程 TLS 加密
                                  2. 源站证书必须有效
                                    · Cloudflare Origin CA   ✅
                                    · 公网可信证书 (Let's Encrypt / DigiCert / ACM)  ✅
                                    · 自签证书                 ❌
                                    · 过期 / 域名不匹配         ❌
```

**✓ 适用场景**：

| 场景 | 说明 |
|------|------|
| 所有生产环境 | **默认推荐** |
| 合规行业（金融 / 支付 / 关基 / 政企 / 医疗） | 唯一满足所有合规框架的模式 |
| 登录 / 支付 / 订单 / 用户中心 | 敏感接口必须严格模式 |
| 与 Authenticated Origin Pulls (AOP) 组合 | AOP + Full Strict = 双向认证，业界最佳实践 |
| 与 Cloudflare Origin CA 证书组合 | 免费 Origin CA 证书 + Full Strict = 最优成本 |
| 与 ACM 组合 | ACM 管理源站证书自动续期 |
| 多云 / 多活源站 | 每个源站都需要严格验证身份 |

**✗ 禁止场景**：
- 无。Full Strict 是唯一推荐的生产模式，所有场景都应该在合理迁移期后到达 Full Strict。

**Full Strict 与其他功能的黄金组合**：

```
┌─────────────────────────────────────────────────────────┐
│ Full Strict 黄金组合（等保四级 / PCI-DSS 推荐）            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  客户端 ───── HTTPS ─────► Cloudflare Edge ── HTTPS ──► 源站
│                              │                  │         │
│                              │                  ├─ 证书验证 (Full Strict) │
│                              │                  └─ mTLS 客户端证书验证     │
│                              │                    (Authenticated Origin Pulls) │
│                              │                             │
│                              ├─ 访客侧：TLS 1.2/1.3 加密套件自定义（Ent） │
│                              ├─ 访客侧：Client Certificates (mTLS)  │
│                              ├─ WAF / Bot / DDoS / Waiting Room   │
│                              └─ 安全管线所有 Enterprise 功能生效     │
│                                                         │
│  组合效果：端到端加密 + 双向身份认证 + 全功能安全防护         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 27.4 模式 + 合规框架交叉对照表

| 合规框架 | Off | Flexible | Full | Full (Strict) | 备注 |
|---------|-----|----------|------|---------------|------|
| **PCI-DSS v4.0 Req 3.4** | ❌ | ❌ | ❌ | ✅ | 禁止明文传输持卡人数据；必须验证端点 |
| **PCI-DSS v4.0 Req 4** | ❌ | ❌ | ❌ | ✅ | 强加密传输 + 可信密钥管理 |
| **等保 2.0 三级 8.1.8** | ❌ | ❌ | ⚠️ | ✅ | 传输中敏感信息应加密；Full 不验证存在理论风险 |
| **等保 2.0 四级 8.1.7** | ❌ | ❌ | ❌ | ✅ | 双向身份鉴别 + 强加密传输 |
| **关基条例第 22 条** | ❌ | ❌ | ❌ | ✅ | 优先使用可信密码产品；端到端验证 |
| **金融等保四级 JR/T 0171** | ❌ | ❌ | ❌ | ✅ | 支付核心业务必须端到端 + 双向验证 |
| **支付行业监管 (OR-6)** | ❌ | ❌ | ❌ | ✅ | 支付行业监管机构禁止明文传输客户资料 + 要求端点验证 |
| **PDPO（香港私隐）** | ❌ | ❌ | ⚠️ | ✅ | 传输保护需合理安全措施；Full 有争议 |
| **GDPR Art 32** | ❌ | ❌ | ⚠️ | ✅ | 加密 + 端点验证为"适当技术措施" |
| **医疗等保 / HIPAA** | ❌ | ❌ | ❌ | ✅ | PHI 数据必须端到端加密 + 验证 |

### 27.5 渐进式迁移策略（Flexible → Full → Full Strict）

**目标**：在不中断业务的前提下，用 3 阶段从最低安全迁移到 Full Strict。

```
阶段 0 (现状)：    Flexible (或 Off)
阶段 1 (1-2周)：    Full（部署源站证书）
阶段 2 (2-4周)：    Full Strict（验证生效 + 灰度）
阶段 3 (持续)：     Full Strict + Authenticated Origin Pulls（双向认证）
```

#### 阶段 0：现状评估

```bash
# === 1. 检查当前 SSL 模式 ===
cfcli ssl get-mode --zone nc-demo.cf

# === 2. 检查源站是否监听 443 ===
cfcli origin check --zone nc-demo.cf --host origin.nc-demo.cf --port 443

# === 3. 检查源站当前是否有证书 ===
cfcli origin cert-check --host origin.nc-demo.cf --port 443
```

#### 阶段 1：Flexible → Full（部署源站证书）

```bash
# === 1. 用 Cloudflare Origin CA 签发源站证书（免费） ===
cfcli certificate origin-create --zone nc-demo.cf \
  --hostnames "nc-demo.cf,*.nc-demo.cf" \
  --key-type rsa \
  --key-size 2048 \
  --validity 5475   # 15 年

# === 2. 部署到源站 (Nginx 示例) ===
# 将证书和私钥放到 /etc/nginx/ssl/ 下
# 编辑 nginx.conf:
#   listen 443 ssl http2;
#   ssl_certificate      /etc/nginx/ssl/origin-cert.pem;
#   ssl_certificate_key  /etc/nginx/ssl/origin-key.pem;
# systemctl reload nginx

# === 3. 验证源站 HTTPS 可达（从 Cloudflare 角度） ===
cfcli origin health --zone nc-demo.cf --host origin.nc-demo.cf --port 443 --protocol https

# === 4. 切换到 Full 模式 ===
cfcli ssl set-mode --zone nc-demo.cf --mode full

# === 5. 验证 48 小时 ===
# 查 Dashboard → Analytics → 5xx 错误率
# 查 Log Explorer http 数据集：EdgeResponseStatus IN (502, 521, 522, 525)
```

#### 阶段 2：Full → Full Strict（验证 + 灰度）

```bash
# === 1. 确认证书类型（Origin CA / 公网证书均可） ===
cfcli origin cert-check --host origin.nc-demo.cf --port 443

# === 2. 灰度 1% 流量到 Full Strict（Page Rules 临时配置） ===
cfcli page-rule create --zone nc-demo.cf \
  --pattern "test.nc-demo.cf/*" \
  --ssl-mode full-strict \
  --priority 1

# === 3. 灰度验证 3-7 天，确认无 525 错误 ===
# 525 = Cloudflare 无法验证源站证书
cfcli logs explorer --zone nc-demo.cf \
  --dataset http --since 7d \
  --sql "SELECT COUNT(*) FROM http WHERE EdgeResponseStatus = 525 AND ClientRequestHost = 'test.nc-demo.cf'"

# === 4. 全站切换 ===
cfcli ssl set-mode --zone nc-demo.cf --mode full-strict

# === 5. 验证 72 小时 ===
# 重点关注 525 错误率，若异常立即回滚
```

#### 阶段 3：Full Strict → 双向认证（可选，合规行业建议）

```bash
# 组合 1：Authenticated Origin Pulls (Cloudflare 向源站出示客户端证书)
cfcli ssl aop enable --zone nc-demo.cf   # 启用 AOP
# 源站 Nginx 配置验证 AOP 证书：
#   ssl_client_certificate /etc/nginx/ssl/cloudflare-origin-pull-ca.pem;
#   ssl_verify_client on;

# 组合 2：Client Certificates (访客向 Cloudflare 出示客户端证书)
cfcli ssl client-cert create --zone nc-demo.cf --name "internal-users"
```

#### 紧急回滚流程

| 回滚目标 | 命令 | 验证方式 | 生效时间 |
|---------|------|---------|---------|
| Full Strict → Full | `cfcli ssl set-mode --zone nc-demo.cf --mode full` | 30 秒后访问确认 | < 1 分钟 |
| Full → Flexible | `cfcli ssl set-mode --zone nc-demo.cf --mode flexible` | 30 秒后确认 | < 1 分钟 |
| 源站证书回退（Nginx） | `nginx -c /etc/nginx/ssl.rollback.conf && nginx -s reload` | `curl https://origin.nc-demo.cf` | < 30 秒 |
| 紧急切回 80 | Nginx 注释掉 listen 443 + 恢复 listen 80 | `curl http://origin.nc-demo.cf` | < 1 分钟 |

### 27.6 行业场景推荐模式

| 行业 | 推荐模式 | 组合建议 | 备注 |
|------|---------|---------|------|
| **金融行业（第 19 章）** | Full (Strict) | + Authenticated Origin Pulls + mTLS | 必须；等保四级 + PCI-DSS 双重合规 |
| **政企行业（第 20 章）** | Full (Strict) | + AOP + Data Localization Suite | 必须；部分政务内网可先 Full 再升级 |
| **电力公司（第 21 章）** | Full (Strict) | + AOP + Spectrum OT 保护 | 必须；关基条例要求 + IEC 62443 |
| **支付行业（第 22 章）** | Full (Strict) | + AOP + API Shield mTLS | 必须；PCI-DSS Req 3.4 + 4 |
| **通用企业官网** | Full (Strict) | + ACM 自动续期源站证书 | 建议；成本低且消除所有风险 |
| **开发 / 测试环境** | Full / Flexible | 自签证书即可 | 视测试内容而定 |
| **临时演示站** | Flexible | 无需源站证书 | 短期，无敏感内容 |
| **内网源站 + Cloudflare Tunnel** | Off | Tunnel 自带加密 | Tunnel 替代 TLS 传输加密 |

### 27.7 常见陷阱与最佳实践

#### 常见陷阱

| 陷阱 | 说明 | 后果 |
|------|------|------|
| 误以为 Flexible 足够安全 | 浏览器有锁图标就认为安全了 | 源站到 Cloudflare 明文，合规不通过 |
| Flexible 模式下启用 Authenticated Origin Pulls | 源站连 443 都没开，AOP 根本无法生效 | AOP 配置了也没用 |
| Full 模式下用自签证书就"很安全" | 不验证 = 中间人可以伪造源站证书 | 理论上有 MITM 风险 |
| Origin CA 证书部署错了证书链 | 没把 Origin CA 根证书放进 fullchain | 切到 Strict 后立即 525 错误 |
| 证书过期了还在用 Full Strict | Strict 会立即验证有效期 | 全站 525，业务中断 |

#### 最佳实践

| 最佳实践 | 说明 |
|---------|------|
| **默认 Full Strict** | 新建 Zone 直接设置，不经过 Flexible 阶段（前提：已有源站证书） |
| **源站用 Origin CA 证书** | 免费、15 年有效期、自动被 Cloudflare 信任，Strict 模式下零配置通过 |
| **搭配 Authenticated Origin Pulls** | Strict + AOP = 双向认证，业界最佳实践组合 |
| **搭配 Cloudflare Tunnel** | Tunnel 自带 end-to-end 加密 + 不用暴露源站公网 IP |
| **证书续期用 ACM** | ACM 自动续期公网证书，避免 Strict 下 525 |
| **灰度切换** | 新 Zone → 先 Full 观察 48h → 再 Full Strict |
| **525 监控告警** | 配置 Logpush / SIEM 525 错误率 ≥ 1% 告警 | 切 Strict 后必配 |

### 27.8 CLI 命令速查

```bash
# === 模式查看与设置 ===
cfcli ssl get-mode --zone nc-demo.cf                         # 查看当前模式
cfcli ssl set-mode --zone nc-demo.cf --mode off              # Off（不推荐）
cfcli ssl set-mode --zone nc-demo.cf --mode flexible         # Flexible（过渡用）
cfcli ssl set-mode --zone nc-demo.cf --mode full             # Full（不验证）
cfcli ssl set-mode --zone nc-demo.cf --mode full-strict      # Full (Strict)（推荐）

# === 源站证书（Origin CA） ===
cfcli certificate origin-create --zone nc-demo.cf \            # 签发 Origin CA 证书
  --hostnames "nc-demo.cf,*.nc-demo.cf" --validity 5475
cfcli certificate origin-list --zone nc-demo.cf              # 列出 Origin CA 证书
cfcli certificate origin-revoke --zone nc-demo.cf --id <id>   # 吊销

# === 源站连通性检查 ===
cfcli origin check --zone nc-demo.cf --host origin.nc-demo.cf --port 443   # 443 可达性
cfcli origin cert-check --host origin.nc-demo.cf --port 443               # 证书有效性
cfcli origin health --zone nc-demo.cf --host origin.nc-demo.cf --protocol https  # 健康检查

# === Authenticated Origin Pulls (AOP) ===
cfcli ssl aop get --zone nc-demo.cf                         # 查看 AOP 状态
cfcli ssl aop enable --zone nc-demo.cf                       # 启用 AOP（配合 Strict）
cfcli ssl aop disable --zone nc-demo.cf                      # 禁用

# === 客户端证书 (双向 mTLS) ===
cfcli ssl client-cert create --zone nc-demo.cf --name "api-users"   # 创建客户端证书
cfcli ssl client-cert list --zone nc-demo.cf                         # 列出

# === 迁移验证 (Log Explorer 查询 525 错误) ===
cfcli logs explorer --zone nc-demo.cf --dataset http --since 7d \
  --sql "SELECT EdgeResponseStatus, COUNT(*) FROM http WHERE EdgeResponseStatus IN (525, 502, 521, 522) GROUP BY EdgeResponseStatus"
```

### 27.9 与其他章节关联

| 关联章节 | 关联点 |
|---------|--------|
| 第 3 章 SSL 模式 | 本节基础理论的展开（4 行对比表 → 9 节深度场景化） |
| 第 4 章 mTLS / AOP | Full Strict + Authenticated Origin Pulls = 双向认证最佳实践 |
| 第 7 章 Cloudflare Origin CA | Origin CA 证书 + Full Strict = 最优成本方案 |
| 第 23 章 ACME | ACM 源站证书自动续期，避免 Strict 下 525 故障 |
| 第 26 章加密套件 | 加密套件决定连接1的算法，SSL模式决定连接2是否加密/验证 |
| 第 19–22 章行业场景 | 4 行业全部要求 Full Strict，对应 27.6 节 |
| 第 25 章日志体系 | 模式切换后必须用 Log Explorer 监控 525 错误率 |

---

---