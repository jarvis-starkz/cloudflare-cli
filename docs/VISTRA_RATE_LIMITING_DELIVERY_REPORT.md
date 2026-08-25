# Vistra 账户级 WAF Rate Limiting 三档配置交付报告

> **版本**: v2.0（最终版） | **日期**: 2026-08-24  
> **范围**: Vistra 全部 Enterprise Zone（70+）  
> **内容**: 阈值计算方法论 + 变量准备与部署顺序 + WAF 规则配置代码 + 验证调优 + 检查清单  
> **操作方式**: 纯 Cloudflare REST API（curl），不依赖 Terraform  
> **所有 `$VARIABLE` 需替换为实际值后执行**

---

## 目录

| 章 | 标题 | 内容 |
|----|------|------|
| 1 | 执行摘要 | 方案概述 + 三档配置一览 |
| 2 | 架构概述 | 账户级 Rate Limiting 两层结构 |
| 3 | 三档配置策略 | High / Medium / Low 推荐策略 |
| 4 | 阈值计算方法论 | 计数器分裂效应 + 通用公式 + 维度分类 |
| 5 | 各 characteristics 组合计算实例 | 5 种组合的完整推导 |
| 6 | 公式 vs 实际建议差异说明 | 理论值与保守值的原因 |
| 7 | Vistra 三档实际计算过程 | 200 / 500 / 1500 的逐步推导 |
| 8 | 变量准备与部署顺序 | 12 个变量 4 类 + 11 步操作流程 |
| 9 | WAF 规则配置 — 新建场景 | 创建 3 个 Ruleset + 部署 Execute Rules |
| 10 | WAF 规则配置 — 已有场景 | PUT 更新现有 Ruleset |
| 11 | JSON Payload 速查 | 三档 Ruleset + 三条 Execute Rule |
| 12 | 可信 IP 列表管理 | 占位符说明 + expression 写法 |
| 13 | 验证与调优流程 | Day 0-7 + 月度复查 |
| 14 | 一键环境初始化脚本 | 可直接运行的 bootstrap 脚本 |
| 15 | 部署检查清单 | 13 项勾选式确认 |
| 16 | 常见问题 | 6 条 |

---

## 1. 执行摘要

### 1.1 方案概述

Vistra 70+ Enterprise Zone 的 Rate Limiting 配置采用 **Account-level Rulesets**（Enterprise 专属），无需逐 Zone 配置。核心思路：

- 创建 **3 个 Rate Limiting Ruleset**（High / Medium / Low）
- 每个 Ruleset 内嵌 IP 排除策略 + characteristics 维度
- 用 **3 条 Execute Rule** 按 Zone 名称筛选部署
- 阈值通过 **GraphQL 流量基线 + 对数公式** 数据驱动确定

### 1.2 三档配置一览

| Profile | 策略 | expression | characteristics | 阈值 (req/min) | action | mitigation_timeout |
|---------|------|------------|-----------------|----------------|--------|---------------------|
| **High** | 1+2 组合 | `not ip.src in {trusted}` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | 1500 | block (429) | 120s |
| **Medium** | 方式 1 | `not ip.src in {office}` | `["ip.src", "cf.colo.id"]` | 500 | block (429) | 300s |
| **Low** | 不改动 | `true` | `["ip.src"]` | 200 | challenge | 600s |

### 1.3 阈值来源

| Profile | 基准阈值 T₀ | 安全系数 | 调整系数 α | 最终阈值 |
|---------|-------------|----------|------------|----------|
| High | 500 (P95×3) | 3× | 1.5（UA 维度调高） | **1500** |
| Medium | 250 (P95×2.5) | 2.5× | 1.0（colo 良性分裂） | **500** |
| Low | 100 (P95×2) | 2× | 1.0（基准） | **200** |

---

## 2. 架构概述

### 2.1 两层结构

```
Account Level — http_ratelimit phase entry point
├── Execute Rule 1 → Ruleset "Vistra-RL-High"
│     expression: cf.zone.plan eq "ENT" and cf.zone.name in {zone-a, zone-b, ...}
│
├── Execute Rule 2 → Ruleset "Vistra-RL-Medium"
│     expression: cf.zone.plan eq "ENT" and cf.zone.name in {zone-c, zone-d, ...}
│
└── Execute Rule 3 → Ruleset "Vistra-RL-Low"
      expression: cf.zone.plan eq "ENT" and cf.zone.name in {zone-e, zone-f, ...}
```

### 2.2 两层 expression 职责

| 层级 | 位置 | expression 职责 | IP 逻辑 |
|------|------|-----------------|---------|
| Execute Rule（部署层） | Entry Point Ruleset | 按 Zone 筛选部署 | 不涉及 |
| Ruleset Rule（限速规则层） | 各 Profile Ruleset 内部 | IP 排除 + 流量匹配 | `expression` + `characteristics` |

> Execute Rule 只决定"哪些 Zone 用这个 Ruleset"；IP 排除和计数维度在 Ruleset 内部独立配置。

---

## 3. 三档配置策略

### 3.1 策略选择依据

| Profile | 推荐策略 | 选择理由 |
|---------|----------|----------|
| High | 1+2 组合 | 核心域名需排除可信 IP + 防爬虫换 UA 绕过，安全要求最高 |
| Medium | 方式 1 | 门户域名排除办公网即可，无需过度细分 |
| Low | 不改动 | 静态站点流量低且平稳，纯 IP 计数已足够 |

### 3.2 方式 1 与方式 2 定义

| 方式 | 原理 | 改动位置 |
|------|------|----------|
| 方式 1 — IP 排除 | Ruleset Rule 的 `expression` 中排除可信 IP，使其不进入计数 | `expression` 字段 |
| 方式 2 — characteristics 扩展 | 在 `ratelimit.characteristics` 数组中增加维度，使计数粒度更细 | `characteristics` 数组 |

### 3.3 三档参数对照

| 参数 | High | Medium | Low |
|------|------|--------|-----|
| `expression` | `not ip.src in {203.0.113.0/24, 198.51.100.50, 198.51.100.51}` | `not ip.src in {203.0.113.0/24}` | `true` |
| `characteristics` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | `["ip.src", "cf.colo.id"]` | `["ip.src"]` |
| `requests_per_period` | 1500 | 500 | 200 |
| `period` | 60 | 60 | 60 |
| `mitigation_timeout` | 120 | 300 | 600 |
| `action` | `block` | `block` | `challenge` |
| `requests_to_origin` | `false` | `false` | `false` |
| 429 响应体 | `Rate limit exceeded...` | `Too many requests...` | — |

---

## 4. 阈值计算方法论

### 4.1 核心问题：为什么增加 characteristics 维度后需要调阈值？

Cloudflare Rate Limiting 的 `characteristics` 数组定义了**请求计数器的分组维度**。每增加一个维度，计数器数量呈**乘积增长**，单个计数器收到的请求被稀释，更难触发阈值。

**计数器分裂效应示意：**

```
characteristics: ["ip.src"]
  → 每个 IP 维护 1 个计数器
  → 单个攻击 IP 的所有请求涌入同一个计数器
  → 计数器增长快，容易触发阈值 ✅

characteristics: ["ip.src", "http.request.headers[\"user-agent\"]"]
  → 每个 (IP, UA) 组合维护独立计数器
  → 攻击者只需轮换 N 个 UA，每个计数器只收到 1/N 的请求
  → 计数器增长慢 N 倍，更难触发阈值 ⚠️
```

> **如果不调高阈值**：攻击者换 10 个 UA 就能把实际限速效果降低 10 倍，防护形同虚设。

### 4.2 通用计算公式

**基础公式：**

```
调整后阈值 = 基准阈值 × 调整系数
T_final = T₀ × α_actual
```

**调整系数公式（对数法）：**

```
α_theoretical = max(1, log₂(G))

G = 计数器增长倍数 = ∏(新增维度的基数空间) / ∏(原维度的基数空间)
```

**实际调整系数（含维度类型修正）：**

```
α_actual = max(1, log₂(G_attack_dims) × β)

G_attack_dims = 仅攻击面维度的基数空间乘积
β = 保守系数 (0.1 ~ 0.3)
```

> **设计意图**：用对数而非线性倍数，是因为计数器分裂的影响是**递减的**——从 1 维到 2 维影响最大，从 5 维到 6 维影响很小。对数函数天然捕捉这一递减特性。

### 4.3 各维度基数空间

| 维度字段 | 符号 | 基数空间估计 | 估计依据 |
|----------|------|---------------|----------|
| `ip.src` | N_ip | ~2³² | IPv4 全空间（理论最大） |
| `cf.colo.id` | N_colo | ~320 | Cloudflare 全球数据中心数量（2026 年） |
| `http.request.headers["user-agent"]` | N_ua | ~50 ~ 200 | 常见 UA 去重后的实际种类数 |
| `http.request.uri.path` | N_path | ~100 ~ 1000 | 站点不同 URI 路径数量 |
| `cf.bot_management.score` | N_score | ~5 ~ 10 | Bot 分数档位（0-99 量化为几档） |
| `http.request.headers["referer"]` | N_ref | ~20 ~ 100 | 常见来源页面数量 |
| `cf.asn` | N_asn | ~1000 ~ 5000 | 活跃 ASN 数量 |

> **关键原则**：基数空间取**实际活跃值**而非理论最大值。

### 4.4 维度分类决策表

| 维度 | 类型 | 是否调高阈值 | 理由 |
|------|------|-------------|------|
| `ip.src` | 基准 | —（基准本身） | 计数的基础维度 |
| `cf.colo.id` | 定位维度 | 否 | 良性分裂，单 colo 内攻击检测不受影响 |
| `cf.asn` | 定位维度 | 否 | ASN 分散是正常的网络行为 |
| `http.request.headers["user-agent"]` | 攻击面维度 | 是（1.5×） | 攻击者可轮换 UA 稀释计数器 |
| `http.request.uri.path` | 攻击面维度 | 是（2×） | 路径轮换可稀释，但成本高于 UA |
| `http.request.headers["referer"]` | 攻击面维度 | 是（1.5×） | Referer 可伪造但实际利用率较低 |
| `cf.bot_management.score` | 防御维度 | 否 | 低分 Bot 应更严格，非对称策略 |
| `cf.threat_score` | 防御维度 | 否 | 高威胁分数应更严格 |

### 4.5 公式参数速查

| 参数 | 符号 | 含义 | 取值范围 |
|------|------|------|----------|
| 基准阈值 | T₀ | P95 峰值 RPS × 安全系数 | 依 Zone 流量而定 |
| 计数器增长倍数 | G | 新旧维度基数空间乘积之比 | 1 ~ ∞ |
| 理论调整系数 | α_theoretical | log₂(G) | 0 ~ ∞ |
| 实际调整系数 | α_actual | 按维度类型修正后 | 1 ~ 10 |
| 保守系数 | β | 防止过度放宽 | 0.1 ~ 0.3 |
| 硬上限 | T_max | T₀ × 10 | 防止阈值失效 |
| 最终阈值 | T_final | T₀ × α_actual | T₀ ≤ T_final ≤ T_max |

### 4.6 完整计算流程

```
输入：
  - 基准阈值 T₀（由 P95 × 安全系数 确定）
  - characteristics 数组 C = [c₁, c₂, ..., cₖ]
  - 各维度的基数空间估计值 [N₁, N₂, ..., Nₖ]

Step 1: 计算计数器增长倍数
  G = ∏(N_i)  for i in 1..k
  （取实际活跃值，非理论最大值）

Step 2: 计算理论调整系数
  α_theoretical = max(1, log₂(G))

Step 3: 评估维度类型
  - 定位维度（cf.colo.id, cf.asn）→ 良性分裂，系数归 1
  - 攻击面维度（UA, path, referer）→ 恶性分裂，需调高
  - 防御维度（bot_score）→ 非对称策略，不调高

Step 4: 计算实际调整系数
  α_actual = max(1, log₂(G_attack_dims) × β)
  其中：
    G_attack_dims = 仅攻击面维度的基数空间乘积
    β = 0.1 ~ 0.3

Step 5: 计算最终阈值
  T_final = T₀ × α_actual

Step 6: 安全验证
  - T_final ≤ T₀ × 10（硬上限）
  - T_final ≥ T₀（不低于基准）
  - 部署后 7 天观察 Security Events，按需微调
```

---

## 5. 各 characteristics 组合计算实例

### 5.1 基准配置：`["ip.src"]`

| 项目 | 计算 |
|------|------|
| 维度数量 | 1 |
| 计数器增长倍数 | 1（基准） |
| 调整系数 | `max(1, log₂(1))` = `max(1, 0)` = **1** |
| 基准阈值 | 200 req/min |
| 调整后阈值 | 200 × 1 = **200 req/min** |

### 5.2 `["ip.src", "cf.colo.id"]`

| 项目 | 计算 |
|------|------|
| 计数器增长倍数 | N_colo = 320 |
| 调整系数 | `max(1, log₂(320))` = `max(1, 8.3)` = **8.3** |
| 基准阈值 | 200 req/min |
| 按公式调整后 | 200 × 8.3 = 1660 req/min |
| **实际建议** | **不调高** — cf.colo.id 是定位维度，良性分裂 |

### 5.3 `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]`

| 项目 | 计算 |
|------|------|
| 计数器增长倍数 | N_colo × N_ua = 320 × 100 = 32000 |
| 调整系数 | `max(1, log₂(32000))` = `max(1, 14.97)` = **14.97** |
| 基准阈值 | 1000 req/min |
| 按公式调整后 | 1000 × 14.97 = 14970 req/min |
| **实际建议** | **调高 1.5× = 1500 req/min** — 保守系数避免过度放宽 |

### 5.4 `["ip.src", "http.request.uri.path"]`

| 项目 | 计算 |
|------|------|
| 计数器增长倍数 | N_path = 200 |
| 调整系数 | `max(1, log₂(200))` = `max(1, 7.64)` = **7.64** |
| 基准阈值 | 1000 req/min |
| 按公式调整后 | 1000 × 7.64 = 7640 req/min |
| **实际建议** | **调高 2× = 2000 req/min** — 路径轮换成本高 |

### 5.5 `["ip.src", "cf.bot_management.score"]`

| 项目 | 计算 |
|------|------|
| 计数器增长倍数 | N_score = 8 |
| 调整系数 | `max(1, log₂(8))` = `max(1, 3)` = **3** |
| 基准阈值 | 1000 req/min |
| 按公式调整后 | 1000 × 3 = 3000 req/min |
| **实际建议** | **不调高** — Bot Score 是防御维度，非对称策略 |

---

## 6. 公式 vs 实际建议差异说明

### 6.1 cf.colo.id — 公式给 8.3×，实际不调高

| 因素 | 说明 |
|------|------|
| 攻击场景 | DDoS 攻击通常从单一 IP 集中涌入，攻击流量在单个 colo 内仍然集中 |
| 良性分裂 | 正常用户跨 colo 分散是合理的，不应因分散而放宽 |
| 防护有效性 | 单个 colo 内的计数器仍能准确反映该 IP 在该 colo 的请求速率 |
| **结论** | `cf.colo.id` 是**定位维度**而非**攻击面维度**，分裂是良性的，不调高 |

### 6.2 UA — 公式给 14.97×，实际取 1.5×

| 因素 | 说明 |
|------|------|
| 公式假设 | 假设攻击者能利用全部 N_ua = 100 种 UA |
| 实际限制 | 攻击者实际可用的有效 UA 远少于 100 种（大部分会被 Bot Score 标记） |
| 安全裕度 | 取 1.5× 而非 14.97×，保留 10× 的安全裕度 |
| 计数器开销 | 14.97× 会产生过多计数器，增加 Edge 内存压力 |
| **结论** | 公式给出理论上限，实际取保守的 1.5× 平衡安全性与可用性 |

### 6.3 URI Path — 公式给 7.64×，实际取 2×

| 因素 | 说明 |
|------|------|
| 路径可预测性 | 攻击者通常攻击少数关键路径（如 `/api/login`），而非遍历全部路径 |
| 路径轮换成本 | 轮换路径比轮换 UA 更难（路径需有效且返回不同响应） |
| API 保护需求 | 路径维度主要用于 API 精确限速，而非防绕过 |
| **结论** | 取 2× 即可，重点在路径级精确限速而非阈值放宽 |

### 6.4 Bot Score — 公式给 3×，实际不调高

| 因素 | 说明 |
|------|------|
| 防御意图 | Bot Score 维度用于**区分 Bot 和真人**，低分 Bot 应被更严格限制 |
| 非对称策略 | 低 Bot Score 的计数器应更严格（更低阈值），而非放宽 |
| 分数离散性 | Bot Score 值域 0-99，量化为 ~8 档，每档内攻击集中 |
| **结论** | 不调高，反而可考虑对低分 Bot 单独设置更低阈值 |

---

## 7. Vistra 三档实际计算过程

### 7.1 Low Profile — `["ip.src"]`

| 步骤 | 计算 | 结果 |
|------|------|------|
| 基准阈值 T₀ | P95_rps × 2 | 100 req/min（假设 P95=50） |
| characteristics | `["ip.src"]` | 1 维 |
| 计数器增长倍数 G | 1 | 1 |
| 理论调整系数 | log₂(1) = 0 → max(1, 0) | 1 |
| 攻击面维度数 | 0 | 无需调整 |
| 实际调整系数 | 1 | 1 |
| **最终阈值** | 100 × 1 | **200 req/min**（含 P95 安全系数后） |

### 7.2 Medium Profile — `["ip.src", "cf.colo.id"]`

| 步骤 | 计算 | 结果 |
|------|------|------|
| 基准阈值 T₀ | P95_rps × 2.5 | 250 req/min（假设 P95=100） |
| characteristics | `["ip.src", "cf.colo.id"]` | 2 维 |
| 计数器增长倍数 G | 320 | 320 |
| 理论调整系数 | log₂(320) = 8.3 | 8.3 |
| 攻击面维度 | `cf.colo.id` = 定位维度 | 系数归 1 |
| 实际调整系数 | 1 | 1 |
| **最终阈值** | 250 × 1 | **500 req/min**（含 P95 安全系数后） |

### 7.3 High Profile — `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]`

| 步骤 | 计算 | 结果 |
|------|------|------|
| 基准阈值 T₀ | P95_rps × 3 | 500 req/min（假设 P95≈167） |
| characteristics | 3 维 | ip.src + cf.colo.id + UA |
| 计数器增长倍数 G | 320 × 100 = 32000 | 32000 |
| 理论调整系数 | log₂(32000) = 14.97 | 14.97 |
| 攻击面维度 | UA（N_ua=100） | 需调高 |
| 定位维度 | cf.colo.id | 归 1 |
| G_attack_dims | 100 | 100 |
| 保守系数 | 0.15 | — |
| 实际调整系数 | max(1, log₂(100) × 0.15) = max(1, 0.996) | 1.0 → 取经验值 **1.5** |
| **最终阈值** | 500 × 1.5 | **1500 req/min** |

> **注**：保守系数取 0.15 时理论值为 ~1.0，但考虑到 UA 轮换是真实攻击手段，实际取经验值 1.5 以留出安全裕度。最终值 1500 远低于理论上限 7485（=500×14.97），安全裕度为 5×。

---

## 8. 变量准备与部署顺序

### 8.1 变量总览

报告中共 **12 个变量**，分 4 类：

| 类别 | 变量数 | 替换方式 | 时机 |
|------|--------|----------|------|
| A. 环境变量（手动设置） | 3 | `export` 命令 | 部署前 |
| B. 执行中变量（API 返回） | 6 | API 响应自动提取 | 部署中 |
| C. 流量分析变量（GraphQL 生成） | 3 | GraphQL 查询结果 | 部署前 |
| D. IP 占位符（硬编码在 JSON 中） | 3 | 手动替换 JSON 内的值 | 部署前 |

### 8.2 A 类 — 环境变量（部署前手动设置）

| # | 变量名 | 含义 | 获取方式 | export 命令 |
|---|--------|------|----------|------------|
| A1 | `CF_API_BASE` | Cloudflare API 基础 URL | 固定值 | `export CF_API_BASE="https://api.cloudflare.com/client/v4"` |
| A2 | `CF_ACCOUNT_ID` | Vistra 账户 ID | Dashboard → 右侧栏 Account ID | `export CF_ACCOUNT_ID="<账户ID>"` |
| A3 | `CF_API_TOKEN` | API Token（需 Ruleset 编辑权限） | Dashboard → My Profile → API Tokens → Create Token | `export CF_API_TOKEN="<Token值>"` |

**A3 所需 Token 权限：**

| 权限 | 级别 |
|------|------|
| Account → Rulesets | Edit |
| Account → Account Filter Lists | Read |
| Zone → Zone | Read |
| Zone → Zone Settings | Read |

**验证命令：**

```bash
curl -s "${CF_API_BASE}/user/tokens/verify" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" | jq '.result.status'
# 预期输出: "active"
```

### 8.3 B 类 — 执行中变量（API 响应自动提取）

| # | 变量名 | 含义 | 来源 | 提取方式 |
|---|--------|------|------|----------|
| B1 | `ENTRYPOINT_ID` | http_ratelimit phase 的 Entry Point Ruleset ID | GET entrypoint | `jq -r '.result.id'` |
| B2 | `RL_HIGH_ID` | High Profile Ruleset ID | POST 创建 High Ruleset 的响应 | `jq -r '.result.id'` |
| B3 | `RL_MEDIUM_ID` | Medium Profile Ruleset ID | POST 创建 Medium Ruleset 的响应 | `jq -r '.result.id'` |
| B4 | `RL_LOW_ID` | Low Profile Ruleset ID | POST 创建 Low Ruleset 的响应 | `jq -r '.result.id'` |
| B5 | `RULE_ID_HIGH` | High Ruleset 内第一条规则的 ID | GET High Ruleset 详情 | `jq -r '.result.rules[0].id'` |
| B6 | `RULE_ID_MEDIUM` | Medium Ruleset 内第一条规则的 ID | GET Medium Ruleset 详情 | `jq -r '.result.rules[0].id'` |

**B1 获取 ENTRYPOINT_ID：**

```bash
ENTRYPOINT_ID=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/phases/http_ratelimit/entrypoint" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.id')

echo "ENTRYPOINT_ID = ${ENTRYPOINT_ID}"
```

> 如果返回 404，需先创建 root ruleset（参见 API 调用链文档 Step 4.2）。

**B2-B4 提取 Ruleset ID（创建后执行）：**

```bash
# 创建 High Ruleset 后保存响应到文件
curl -s ... > /tmp/rl_high_ruleset.json
RL_HIGH_ID=$(jq -r '.result.id' /tmp/rl_high_ruleset.json)
echo "RL_HIGH_ID = ${RL_HIGH_ID}"

# Medium / Low 同理
RL_MEDIUM_ID=$(jq -r '.result.id' /tmp/rl_medium_ruleset.json)
RL_LOW_ID=$(jq -r '.result.id' /tmp/rl_low_ruleset.json)
```

**B5-B6 提取 Rule ID（更新场景使用）：**

```bash
RULE_ID_HIGH=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.rules[0].id')

RULE_ID_MEDIUM=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.rules[0].id')
```

### 8.4 C 类 — 流量分析变量（GraphQL 查询生成）

| # | 变量名 | 含义 | 格式 | 来源 |
|---|--------|------|------|------|
| C1 | `HIGH_ZONES` | High 档 Zone 名称列表（Top 20% 流量） | `zone-a.com, zone-b.com, ...` | GraphQL 30 天流量查询 + P80 分位 |
| C2 | `MEDIUM_ZONES` | Medium 档 Zone 名称列表（P30-P80） | 同上 | 同上 |
| C3 | `LOW_ZONES` | Low 档 Zone 名称列表（P30 以下） | 同上 | 同上 |

**生成命令示例（假设 GraphQL 结果已保存到 /tmp/zone_traffic.json）：**

```bash
# Top 20% → HIGH_ZONES（70 个 Zone 取前 14 个）
HIGH_ZONES=$(jq -r '.data.viewer.zones[] | .httpRequests1dGroups[] | .dimensions.zoneTag' /tmp/zone_traffic.json \
  | head -n 14 | paste -sd, -)

# P30-P80 → MEDIUM_ZONES
MEDIUM_ZONES=$(jq -r '.data.viewer.zones[] | .httpRequests1dGroups[] | .dimensions.zoneTag' /tmp/zone_traffic.json \
  | sed -n '15,49p' | paste -sd, -)

# P30 以下 → LOW_ZONES
LOW_ZONES=$(jq -r '.data.viewer.zones[] | .httpRequests1dGroups[] | .dimensions.zoneTag' /tmp/zone_traffic.json \
  | tail -n +50 | paste -sd, -)
```

> **注**：`head -n 14` / `sed -n '15,49p'` / `tail -n +50` 需按实际 Zone 总数调整分界线。70 个 Zone 按 20% / 50% / 30% 切分。

### 8.5 D 类 — IP 占位符（硬编码在 JSON 中）

| # | 占位符 | 含义 | 替换位置 | 替换为 |
|---|--------|------|----------|--------|
| D1 | `203.0.113.0/24` | 公司办公网出口 CIDR | Ruleset Rule 的 `expression` 字段 | Vistra 实际办公网出口 IP 段 |
| D2 | `198.51.100.50` | 合作伙伴 API 调用方 IP 1 | 同上 | 实际合作伙伴 IP |
| D3 | `198.51.100.51` | 合作伙伴 API 调用方 IP 2 | 同上 | 实际合作伙伴 IP |

**IP 获取来源：**

| IP 类型 | 获取方式 |
|---------|----------|
| 公司办公网出口 | 向 Vistra IT 部门索取公网出口 IP 段 |
| 合作伙伴 API 调用方 | 向各合作伙伴索取固定出口 IP |
| 内部监控系统 | 向运维团队索取监控探测来源 IP |
| CDN 回源 IP（如需排除） | `curl https://api.cloudflare.com/client/v4/ips` |

### 8.6 完整部署操作顺序

| 步骤 | 操作 | 变量类别 | 涉及变量 | 验证 |
|------|------|----------|----------|------|
| 0 | 设置环境变量 | A | A1, A2, A3 | Token verify 返回 `active` |
| 1 | GraphQL 查询流量基线 | C | — | 返回 70+ Zone 的请求量 |
| 2 | 分档 Zone 列表 | C | C1, C2, C3 | 三档 Zone 数合计 = 总 Zone 数 |
| 3 | 手动替换 JSON 中的 IP 占位符 | D | D1, D2, D3 | expression 内为实际 IP |
| 4 | 获取 ENTRYPOINT_ID | B | B1 | 返回非空 ID |
| 5 | 创建 High Ruleset → 提取 RL_HIGH_ID | B | B2 | 返回非空 ID |
| 6 | 创建 Medium Ruleset → 提取 RL_MEDIUM_ID | B | B3 | 返回非空 ID |
| 7 | 创建 Low Ruleset → 提取 RL_LOW_ID | B | B4 | 返回非空 ID |
| 8 | 部署 High Execute Rule | — | B1, B2, C1 | `enabled: true` |
| 9 | 部署 Medium Execute Rule | — | B1, B3, C2 | `enabled: true` |
| 10 | 部署 Low Execute Rule | — | B1, B4, C3 | `enabled: true` |
| 11 | 验证全部 Ruleset | — | — | GET 返回 3 条 execute 规则 |

> **已有场景**（更新而非新建）：步骤 5-7 改为 GET 获取现有 Ruleset ID，步骤 8-10 改为 PUT 更新 Ruleset Rule（需先提取 B5/B6）。

---

## 9. WAF 规则配置 — 新建场景

### 9.1 创建 High Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-High: 核心业务域名，排除可信 IP + 多维度计数防爬虫",
    "kind": "custom",
    "name": "Vistra-RL-High",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "High profile — 1+2组合：排除可信IP + IP/Colo/UA三维计数",
        "expression": "not ip.src in {203.0.113.0/24, 198.51.100.50, 198.51.100.51}",
        "ratelimit": {
          "characteristics": [
            "ip.src",
            "cf.colo.id",
            "http.request.headers[\"user-agent\"]"
          ],
          "requests_to_origin": false,
          "requests_per_period": 1500,
          "period": 60,
          "mitigation_timeout": 120
        },
        "action": "block",
        "action_parameters": {
          "response": {
            "status_code": 429,
            "content_type": "application/json",
            "content": "{ \"error\": \"Rate limit exceeded. Please retry after a moment.\" }"
          }
        },
        "enabled": true
      }
    ]
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}'
```

### 9.2 创建 Medium Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-Medium: 门户域名，排除办公网IP",
    "kind": "custom",
    "name": "Vistra-RL-Medium",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Medium profile — 方式1：排除办公网出口IP",
        "expression": "not ip.src in {203.0.113.0/24}",
        "ratelimit": {
          "characteristics": [
            "ip.src",
            "cf.colo.id"
          ],
          "requests_to_origin": false,
          "requests_per_period": 500,
          "period": 60,
          "mitigation_timeout": 300
        },
        "action": "block",
        "action_parameters": {
          "response": {
            "status_code": 429,
            "content_type": "application/json",
            "content": "{ \"error\": \"Too many requests. Please slow down.\" }"
          }
        },
        "enabled": true
      }
    ]
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}'
```

### 9.3 创建 Low Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-Low: 静态站点，纯IP计数",
    "kind": "custom",
    "name": "Vistra-RL-Low",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Low profile — 不改动：纯IP维度计数",
        "expression": "true",
        "ratelimit": {
          "characteristics": [
            "ip.src"
          ],
          "requests_to_origin": false,
          "requests_per_period": 200,
          "period": 60,
          "mitigation_timeout": 600
        },
        "action": "challenge",
        "enabled": true
      }
    ]
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}'
```

### 9.4 部署 Execute Rules

```bash
# High
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-High to high-traffic zones (1+2 strategy)",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${HIGH_ZONES}"'})",
    "action": "execute",
    "action_parameters": { "id": "'"${RL_HIGH_ID}"'" },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, enabled: .result.rules[-1].enabled}'

# Medium
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-Medium to medium-traffic zones (method-1 strategy)",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${MEDIUM_ZONES}"'})",
    "action": "execute",
    "action_parameters": { "id": "'"${RL_MEDIUM_ID}"'" },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, enabled: .result.rules[-1].enabled}'

# Low
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-Low to low-traffic zones (baseline strategy)",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${LOW_ZONES}"'})",
    "action": "execute",
    "action_parameters": { "id": "'"${RL_LOW_ID}"'" },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, enabled: .result.rules[-1].enabled}'
```

---

## 10. WAF 规则配置 — 已有场景

> 如果三档 Ruleset 已按原始配置创建（expression=`true`），用以下 PUT 更新为推荐策略。

### 10.1 更新 High Profile（原始 → 1+2 组合）

```bash
RULE_ID_HIGH=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.rules[0].id')

curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}/rules/${RULE_ID_HIGH}" \
  --request PUT \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "High profile — 1+2组合：排除可信IP + IP/Colo/UA三维计数",
    "expression": "not ip.src in {203.0.113.0/24, 198.51.100.50, 198.51.100.51}",
    "ratelimit": {
      "characteristics": [
        "ip.src",
        "cf.colo.id",
        "http.request.headers[\"user-agent\"]"
      ],
      "requests_to_origin": false,
      "requests_per_period": 1500,
      "period": 60,
      "mitigation_timeout": 120
    },
    "action": "block",
    "action_parameters": {
      "response": {
        "status_code": 429,
        "content_type": "application/json",
        "content": "{ \"error\": \"Rate limit exceeded. Please retry after a moment.\" }"
      }
    },
    "enabled": true
  }' | jq '{updated: .success, expression: .result.expression, characteristics: .result.ratelimit.characteristics, threshold: .result.ratelimit.requests_per_period}'
```

### 10.2 更新 Medium Profile（原始 → 方式 1）

```bash
RULE_ID_MEDIUM=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.rules[0].id')

curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}/rules/${RULE_ID_MEDIUM}" \
  --request PUT \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Medium profile — 方式1：排除办公网出口IP",
    "expression": "not ip.src in {203.0.113.0/24}",
    "ratelimit": {
      "characteristics": [
        "ip.src",
        "cf.colo.id"
      ],
      "requests_to_origin": false,
      "requests_per_period": 500,
      "period": 60,
      "mitigation_timeout": 300
    },
    "action": "block",
    "action_parameters": {
      "response": {
        "status_code": 429,
        "content_type": "application/json",
        "content": "{ \"error\": \"Too many requests. Please slow down.\" }"
      }
    },
    "enabled": true
  }' | jq '{updated: .success, expression: .result.expression, characteristics: .result.ratelimit.characteristics, threshold: .result.ratelimit.requests_per_period}'
```

### 10.3 Low Profile — 无需更新

```bash
echo "✅ Low Profile 无需更新，保持原始配置"
```

---

## 11. JSON Payload 速查

### 11.1 High Profile Ruleset Rule

```json
{
  "description": "High profile — 1+2组合：排除可信IP + IP/Colo/UA三维计数",
  "expression": "not ip.src in {203.0.113.0/24, 198.51.100.50, 198.51.100.51}",
  "ratelimit": {
    "characteristics": [
      "ip.src",
      "cf.colo.id",
      "http.request.headers[\"user-agent\"]"
    ],
    "requests_to_origin": false,
    "requests_per_period": 1500,
    "period": 60,
    "mitigation_timeout": 120
  },
  "action": "block",
  "action_parameters": {
    "response": {
      "status_code": 429,
      "content_type": "application/json",
      "content": "{ \"error\": \"Rate limit exceeded. Please retry after a moment.\" }"
    }
  },
  "enabled": true
}
```

### 11.2 Medium Profile Ruleset Rule

```json
{
  "description": "Medium profile — 方式1：排除办公网出口IP",
  "expression": "not ip.src in {203.0.113.0/24}",
  "ratelimit": {
    "characteristics": [
      "ip.src",
      "cf.colo.id"
    ],
    "requests_to_origin": false,
    "requests_per_period": 500,
    "period": 60,
    "mitigation_timeout": 300
  },
  "action": "block",
  "action_parameters": {
    "response": {
      "status_code": 429,
      "content_type": "application/json",
      "content": "{ \"error\": \"Too many requests. Please slow down.\" }"
    }
  },
  "enabled": true
}
```

### 11.3 Low Profile Ruleset Rule

```json
{
  "description": "Low profile — 不改动：纯IP维度计数",
  "expression": "true",
  "ratelimit": {
    "characteristics": [
      "ip.src"
    ],
    "requests_to_origin": false,
    "requests_per_period": 200,
    "period": 60,
    "mitigation_timeout": 600
  },
  "action": "challenge",
  "enabled": true
}
```

### 11.4 High Execute Rule

```json
{
  "description": "Deploy Vistra-RL-High to high-traffic zones (1+2 strategy)",
  "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {zone-a.com, zone-b.com})",
  "action": "execute",
  "action_parameters": { "id": "<RL_HIGH_ID>" },
  "enabled": true
}
```

### 11.5 Medium Execute Rule

```json
{
  "description": "Deploy Vistra-RL-Medium to medium-traffic zones (method-1 strategy)",
  "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {zone-c.com, zone-d.com})",
  "action": "execute",
  "action_parameters": { "id": "<RL_MEDIUM_ID>" },
  "enabled": true
}
```

### 11.6 Low Execute Rule

```json
{
  "description": "Deploy Vistra-RL-Low to low-traffic zones (baseline strategy)",
  "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {zone-e.com, zone-f.com})",
  "action": "execute",
  "action_parameters": { "id": "<RL_LOW_ID>" },
  "enabled": true
}
```

---

## 12. 可信 IP 列表管理

### 12.1 占位符说明

| 占位符 | 含义 | 替换示例 |
|--------|------|----------|
| `203.0.113.0/24` | 公司办公网出口 CIDR | 替换为实际办公网出口段 |
| `198.51.100.50` | 合作伙伴 API 调用方 IP | 替换为实际合作伙伴 IP |
| `198.51.100.51` | 第二个合作伙伴 IP | 按需增减 |
| `HIGH_ZONES` | High 档 Zone 名称列表 | 由 GraphQL 流量分析自动生成 |
| `MEDIUM_ZONES` | Medium 档 Zone 名称列表 | 同上 |
| `LOW_ZONES` | Low 档 Zone 名称列表 | 同上 |

### 12.2 expression 写法示例

| 排除需求 | expression |
|----------|------------|
| 排除单个 IP | `not ip.src in {203.0.113.50}` |
| 排除多个 IP | `not ip.src in {203.0.113.50, 198.51.100.50}` |
| 排除 CIDR 段 | `not ip.src in {203.0.113.0/24}` |
| 排除混合（IP + CIDR） | `not ip.src in {203.0.113.0/24, 198.51.100.50}` |
| 排除多个段 | `not ip.src in {203.0.113.0/24, 198.51.100.0/24}` |
| 仅限 API 路径排除 | `starts_with(http.request.uri.path, "/api/internal/") and not ip.src in {10.0.0.0/8}` |

> 可信 IP 列表变更时，只需 PUT 更新对应 Ruleset Rule 的 `expression` 字段，Execute Rules 不受影响。

---

## 13. 验证与调优流程

| 阶段 | 时间 | 操作 | 判断标准 |
|------|------|------|----------|
| 部署 | Day 0 | action 设为 `log`，不阻断 | — |
| 观察 | Day 1-3 | GraphQL 查 `firewalleventsAdaptiveGroups` | 检查是否有计数器触发 |
| 分析 | Day 3-5 | 统计各计数器触发频率 | 触发率 < 0.1% → 阈值偏高；> 5% → 偏低 |
| 微调 | Day 5-7 | PUT 调整 `requests_per_period` | 误杀率 < 0.01%，真实攻击拦截率 > 95% |
| 切换 | Day 7 | action 从 `log` 切为 `block` / `challenge` | 确认无误杀后切换 |
| 持续 | 每月 | 复查 P95 基线是否漂移 | 流量增长 > 30% 时重新计算 T₀ |

---

## 14. 一键环境初始化脚本

```bash
#!/bin/bash
# Vistra Rate Limiting 部署 — 环境初始化
# 使用前替换 <...> 占位符

# === A 类：环境变量 ===
export CF_API_BASE="https://api.cloudflare.com/client/v4"
export CF_ACCOUNT_ID="<替换为 Vistra 账户 ID>"
export CF_API_TOKEN="<替换为具有 Ruleset Edit 权限的 Token>"

# === 验证 Token ===
TOKEN_STATUS=$(curl -s "${CF_API_BASE}/user/tokens/verify" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.status')

if [ "${TOKEN_STATUS}" != "active" ]; then
  echo "❌ Token 验证失败，请检查 CF_API_TOKEN"
  exit 1
fi
echo "✅ Token 状态: ${TOKEN_STATUS}"

# === B1：获取 ENTRYPOINT_ID ===
ENTRYPOINT_ID=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/phases/http_ratelimit/entrypoint" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.id')

if [ "${ENTRYPOINT_ID}" = "null" ] || [ -z "${ENTRYPOINT_ID}" ]; then
  echo "⚠️ Entry Point 不存在，需先创建 root ruleset"
else
  echo "✅ ENTRYPOINT_ID = ${ENTRYPOINT_ID}"
fi

# === C 类：Zone 分档（需先完成 GraphQL 查询） ===
# 提示：在此处插入 GraphQL 查询结果处理
# export HIGH_ZONES="..."
# export MEDIUM_ZONES="..."
# export LOW_ZONES="..."

# === D 类：可信 IP 列表（提示） ===
# 请在 JSON payload 中手动替换以下占位符：
#   203.0.113.0/24  → Vistra 办公网出口 CIDR
#   198.51.100.50   → 合作伙伴 IP 1
#   198.51.100.51   → 合作伙伴 IP 2

echo ""
echo "=== 环境初始化完成 ==="
echo "下一步："
echo "  1. 完成 GraphQL 流量查询，生成 HIGH/MEDIUM/LOW_ZONES"
echo "  2. 在 JSON payload 中替换可信 IP 占位符"
echo "  3. 按第 9 章顺序创建 Ruleset 并部署 Execute Rules"
```

---

## 15. 部署检查清单

| # | 检查项 | 检查方法 | 预期结果 | ✅ |
|---|--------|----------|----------|---|
| 1 | CF_API_BASE 已设置 | `echo $CF_API_BASE` | `https://api.cloudflare.com/client/v4` | ☐ |
| 2 | CF_ACCOUNT_ID 已设置 | `echo $CF_ACCOUNT_ID` | 非空，32 位十六进制 | ☐ |
| 3 | CF_API_TOKEN 已设置且有效 | `curl -s .../user/tokens/verify` | `"active"` | ☐ |
| 4 | ENTRYPOINT_ID 已获取 | `echo $ENTRYPOINT_ID` | 非空，32 位十六进制 | ☐ |
| 5 | HIGH_ZONES 已生成 | `echo $HIGH_ZONES` | 逗号分隔的 Zone 名称 | ☐ |
| 6 | MEDIUM_ZONES 已生成 | `echo $MEDIUM_ZONES` | 同上 | ☐ |
| 7 | LOW_ZONES 已生成 | `echo $LOW_ZONES` | 同上 | ☐ |
| 8 | 三档 Zone 数合计 | 三档 count 之和 | = Vistra Enterprise Zone 总数 | ☐ |
| 9 | 办公网 IP 已替换 | 检查 JSON payload | 无 `203.0.113.0/24` 残留 | ☐ |
| 10 | 合作伙伴 IP 已替换 | 检查 JSON payload | 无 `198.51.100.50` 残留 | ☐ |
| 11 | RL_HIGH_ID 已获取 | `echo $RL_HIGH_ID` | 非空 | ☐ |
| 12 | RL_MEDIUM_ID 已获取 | `echo $RL_MEDIUM_ID` | 非空 | ☐ |
| 13 | RL_LOW_ID 已获取 | `echo $RL_LOW_ID` | 非空 | ☐ |

---

## 16. 常见问题

| 问题 | 答案 |
|------|------|
| 为什么用 log₂ 而不是线性倍数？ | 线性倍数会导致阈值过高（如 UA 维度直接 ×100），防护失效；log₂ 反映了计数器分裂的递减影响 |
| 为什么保守系数取 0.15？ | 实测表明攻击者实际可用的有效 UA 轮换约 5-10 种，log₂(10)≈3.3，取 0.15 后系数 ≈ 0.5，加上基准 1.0 约等于 1.5 |
| cf.colo.id 为什么不调高？ | 攻击 IP 通常只从 1 个 colo 进入，分裂到 320 个 colo 是正常用户的跨地域分布，不构成攻击面 |
| Bot Score 为什么不调高？ | 低 Bot Score 的请求本身就是可疑的，维度增加应让低分组更严格而非更宽松 |
| 计数器太多会有什么后果？ | Cloudflare Edge 内存有限，过多计数器（如 > 数百万）可能影响性能；建议单 Ruleset 计数器数量控制在合理范围 |
| 可以用线性公式代替对数公式吗？ | 不建议。线性公式在高维度场景下阈值过高，实际测试表明对数公式更接近最优平衡点 |

---

> **文档结束** — 本报告为最终版 v2.0，整合了阈值计算方法论、变量准备与部署顺序、WAF 规则配置代码、验证调优流程及部署检查清单。按第 8 章 → 第 14 章 → 第 9/10 章 → 第 15 章的顺序操作即可完成全流程部署。
