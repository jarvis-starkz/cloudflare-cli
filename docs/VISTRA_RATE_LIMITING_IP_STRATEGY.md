# Vistra Rate Limiting — Source IP 动态策略对比表

> **版本**: v1.0 | **更新**: 2026-08-24  
> **对比对象**: 方式 1（Ruleset expression 增加 IP 排除） vs 方式 2（增加 characteristics 维度）  
> **适用**: Vistra 账户级 Rate Limiting 三档配置（High / Medium / Low）

---

## 表 1 — 两种方式核心对比

| 维度 | 方式 1 — IP 排除（expression 过滤） | 方式 2 — characteristics 维度扩展 |
|------|--------------------------------------|--------------------------------------|
| **原理** | 在 Ruleset Rule 的 `expression` 中排除可信 IP，使其完全不进入计数 | 在 `ratelimit.characteristics` 数组中增加维度，使计数粒度更细，同 IP 不同维度各维护独立计数器 |
| **改动位置** | Ruleset Rule 的 `expression` 字段 | Ruleset Rule 的 `ratelimit.characteristics` 数组 |
| **改动层级** | Ruleset 内部（Execute Rules 不动） | Ruleset 内部（Execute Rules 不动） |
| **改动前** | `"expression": "true"` | `"characteristics": ["ip.src", "cf.colo.id"]` |
| **改动后（示例）** | `"expression": "not ip.src in {203.0.113.0/24}"` | `"characteristics": ["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` |
| **可信 IP 是否计数** | 否 — expression 不匹配，请求不进入 Rate Limiting 引擎 | 是 — 请求照常计数，但每个 IP+UA 组合独立计数 |
| **对阈值的间接影响** | 可信 IP 不消耗计数器配额，普通用户计数器不会被可信 IP 流量稀释 | 不影响阈值，但增加了计数维度数量 |
| **爬虫换 UA 绕过** | 无法防 — 只看 IP，换 UA 仍被排除 | 可防 — 同 IP 不同 UA 各有独立计数器 |
| **API 调用次数** | 3 次 PUT（每个 Ruleset 1 次） | 3 次 PUT（每个 Ruleset 1 次） |
| **回滚** | PUT 把 expression 改回 `true` | PUT 把 characteristics 改回原值 |
| **维护成本** | 低 — IP 列表变更时更新 expression | 中 — 维度调整需理解计数器增长倍数 |

---

## 表 2 — 改动范围对比

| 项目 | 方式 1 | 方式 2 |
|------|--------|--------|
| Execute Rules（部署层） | 不改动 | 不改动 |
| Ruleset Rule `expression` | ✅ 改动（`true` → `not ip.src in {...}`） | 不改动 |
| Ruleset Rule `ratelimit.characteristics` | 不改动 | ✅ 改动（增加数组元素） |
| Ruleset Rule `ratelimit.requests_per_period` | 不改动 | 可能需调整（见 表 5） |
| Ruleset Rule `ratelimit.period` | 不改动 | 不改动 |
| Ruleset Rule `action` | 不改动 | 不改动 |
| Entry Point Ruleset | 不改动 | 不改动 |

---

## 表 3 — 适用场景对比

| 场景 | 方式 1 适配度 | 方式 2 适配度 | 推荐选择 |
|------|---------------|---------------|----------|
| 排除公司办公网出口 IP | ✅ 最佳 | ❌ 无效（办公网仍计数） | 方式 1 |
| 排除已知合作伙伴 API 调用方 IP | ✅ 最佳 | ❌ 无效 | 方式 1 |
| 排除内部监控系统探测 IP | ✅ 最佳 | ❌ 无效 | 方式 1 |
| 防爬虫换 User-Agent 绕过限速 | ❌ 无效 | ✅ 最佳 | 方式 2 |
| 防同一 IP 轮换 URI 路径刷量 | ❌ 无效 | ✅ 最佳（加 `http.request.uri.path`） | 方式 2 |
| 区分 Bot/真人流量阈值 | ❌ 无效 | ✅ 良好（加 `cf.bot_management.score`） | 方式 2 |
| 内外网差异化阈值 | ❌ 不适用（需方式 3） | ❌ 不适用 | 两者均非最优 |
| 通用 DDoS 防护（无特殊 IP 排除需求） | ❌ 无需改动 | ❌ 无需改动 | 不改动 |

---

## 表 4 — API 调用对比（PUT 更新 Ruleset Rule）

| 参数 | 方式 1 | 方式 2 |
|------|--------|--------|
| 方法 | `PUT` | `PUT` |
| 端点 | `/accounts/{id}/rulesets/{RULESET_ID}/rules/{RULE_ID}` | 同左 |
| 改动字段 | `expression` | `ratelimit.characteristics` |
| 其他字段 | 保持不变 | 保持不变 |
| 调用次数 | 3 次（High / Medium / Low 各 1 次） | 3 次（同） |
| 验证方法 | GET ruleset → 检查 `expression` 值 | GET ruleset → 检查 `characteristics` 数组 |

### 方式 1 — API Payload 示例

| 字段 | 值 |
|------|-----|
| `expression` | `not ip.src in {203.0.113.0/24, 198.51.100.50}` |
| `ratelimit.characteristics` | `["ip.src", "cf.colo.id"]`（不变） |
| `ratelimit.requests_per_period` | 1000（不变） |
| `ratelimit.period` | 60（不变） |
| `action` | `block`（不变） |

### 方式 2 — API Payload 示例

| 字段 | 值 |
|------|-----|
| `expression` | `true`（不变） |
| `ratelimit.characteristics` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` |
| `ratelimit.requests_per_period` | 1000 → 可调为 1500（见 表 5） |
| `ratelimit.period` | 60（不变） |
| `action` | `block`（不变） |

---

## 表 5 — 方式 2 阈值调整建议

| characteristics 组合 | 计数器数量增长 | 阈值建议 | 原因 |
|----------------------|----------------|----------|------|
| `["ip.src"]` | 1× | 基准值 | 每 IP 1 个计数器 |
| `["ip.src", "cf.colo.id"]` | ~Ncolo× | 基准值不变 | 同 IP 跨 colo 分散，单 colo 内压力不变 |
| `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | ~Ncolo × Nua× | 调高 1.5× | 同 IP 换不同 UA 拆分计数器，单个计数器更难触发，需适当调高以保持等效防护 |
| `["ip.src", "http.request.uri.path"]` | ~Npath× | 调高 2× | 不同路径各自计数，攻击者分散路径刷量时单路径计数器增长更慢 |
| `["ip.src", "cf.bot_management.score"]` | ~Nscore× | 保持基准 | Bot 分数粒度粗（几档），增长可控 |

> **公式**：`调整后阈值 = 基准阈值 × max(1, log2(新增维度后计数器数量增长倍数))`

---

## 表 6 — 可信 IP 列表管理建议（方式 1 专用）

| IP 来源 | 典型条目 | 更新频率 | 管理方式 |
|---------|----------|----------|----------|
| 公司办公网出口 | `203.0.113.0/24` | 低（数月不变） | 硬编码在 expression 中 |
| 合作伙伴 API 调用方 | `198.51.100.50, 198.51.100.51` | 中（按合作变更） | 维护 IP 列表文档，变更时 PUT 更新 |
| 内部监控系统 | `10.0.0.0/8`（内网） | 低 | 同上 |
| CDN 回源 IP（如有） | `173.245.48.0/20` 等 | 低 | Cloudflare IP 列表可从 `/ips` API 获取 |

### expression 写法建议

| 排除需求 | expression 示例 |
|----------|-----------------|
| 排除单个 IP | `not ip.src in {203.0.113.50}` |
| 排除多个 IP | `not ip.src in {203.0.113.50, 198.51.100.50}` |
| 排除 CIDR 段 | `not ip.src in {203.0.113.0/24}` |
| 排除混合（IP + CIDR） | `not ip.src in {203.0.113.0/24, 198.51.100.50}` |
| 排除多个段 | `not ip.src in {203.0.113.0/24, 198.51.100.0/24}` |
| 仅限 API 路径排除 | `starts_with(http.request.uri.path, "/api/internal/") and not ip.src in {10.0.0.0/8}` |

---

## 表 7 — 两种方式组合使用

| 组合策略 | expression | characteristics | 效果 |
|----------|------------|-----------------|------|
| 纯方式 1 | `not ip.src in {trusted}` | `["ip.src", "cf.colo.id"]` | 可信 IP 完全不限速，其余按 IP+colo 计数 |
| 纯方式 2 | `true` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | 全部流量按 IP+colo+UA 计数，防换 UA |
| **1+2 组合** | `not ip.src in {trusted}` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | 可信 IP 不限速 + 其余按 IP+colo+UA 细粒度计数 |

> **推荐**：对 High Profile 使用 **1+2 组合**（核心域名需同时排除可信 IP + 防爬虫换 UA），Medium / Low 仅用方式 1 或不改动。

---

## 表 8 — 三档配置推荐策略

| Profile | 推荐方式 | expression | characteristics | 理由 |
|---------|----------|------------|-----------------|------|
| High | 1+2 组合 | `not ip.src in {office, partners}` | `["ip.src", "cf.colo.id", "http.request.headers[\"user-agent\"]"]` | 核心域名需排除可信 IP + 防爬虫，安全要求最高 |
| Medium | 方式 1 | `not ip.src in {office}` | `["ip.src", "cf.colo.id"]` | 门户域名排除办公网即可，无需过度细分 |
| Low | 不改动 | `true` | `["ip.src"]` | 静态站点流量低且平稳，无需额外排除 |

---

## 表 9 — 落地步骤对比

| 步骤 | 方式 1 | 方式 2 |
|------|--------|--------|
| 1. 获取 RULE_ID | GET `/accounts/{id}/rulesets/{RULESET_ID}` → `.result.rules[0].id` | 同左 |
| 2. 更新规则 | PUT `/accounts/{id}/rulesets/{RULESET_ID}/rules/{RULE_ID}` | 同左 |
| 3. 改动内容 | `expression` 字段改为 `not ip.src in {...}` | `ratelimit.characteristics` 数组增加元素 |
| 4. 阈值调整 | 不需要 | 按 表 5 调高 `requests_per_period` |
| 5. 验证 | GET ruleset → 确认 `expression` 已更新 | GET ruleset → 确认 `characteristics` 已更新 |
| 6. 观察 7 天 | 检查可信 IP 是否不再被 Block | 检查是否有误杀、阈值是否合理 |

---

## 表 10 — 风险对比

| 风险项 | 方式 1 风险等级 | 方式 1 说明 | 方式 2 风险等级 | 方式 2 说明 |
|--------|----------------|-------------|----------------|-------------|
| 误杀可信用户 | 低 | 可信 IP 被排除，不会误杀 | 中 | 新维度拆分计数器后阈值需重新校准，过渡期可能误杀 |
| 爬虫绕过限速 | 中 | 换 UA / 换 IP 仍可绕过 | 低 | 多维度计数更难绕过 |
| 计数器数量爆炸 | 无 | 不增加计数维度 | 中 | characteristics 增加后计数器数量呈乘积增长，可能影响 Edge 性能 |
| 配置复杂度 | 低 | 只需维护 IP 列表 | 中 | 需理解多维度计数逻辑和阈值调整 |
| 回滚难度 | 低 | expression 改回 `true` | 低 | characteristics 改回原数组 |

---

> **总结**：方式 1 适合 IP 白名单排除，方式 2 适合多维度细粒度计数防绕过。对 Vistra 场景，建议 High Profile 用 1+2 组合，Medium 用方式 1，Low 不改动。
