# Vistra 账户级 WAF Rate Limiting — API 调用链速查表

> **版本**: v1.0 | **更新**: 2026-08-24 | **适用**: Vistra Enterprise, 70+ Zone, 三档 High/Medium/Low  
> 所有 `$VARIABLE` 需替换为实际值后执行

---

## 表 1 — 环境变量

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `CF_API_TOKEN` | `your-api-token-here` | Cloudflare API Token |
| `CF_ACCOUNT_ID` | `your-account-id-here` | Vistra 账户 ID |
| `CF_API_BASE` | `https://api.cloudflare.com/client/v4` | REST API 基址 |
| `CF_GRAPHQL_ENDPOINT` | `https://api.cloudflare.com/client/v4/graphql` | GraphQL 端点 |

---

## 表 2 — API Token 所需权限

| 权限 | 用途 |
|------|------|
| `Account > Account Settings > Read` | 获取账户信息 |
| `Zone > Zone > Read` | 列出所有 Zone |
| `Account > Account Analytics > Read` | GraphQL 查询流量基线 |
| `Account > WAF > Write` | 创建 Rate Limiting Ruleset + 部署 |
| `Account > Rulesets > Write` | 操作 Rulesets API |
| `Account > Rulesets > Read` | 读取 entry point ruleset |

---

## 表 3 — 完整 API 调用链（7 步）

| Step | 子步骤 | 方法 | 端点 | 用途 | 关键参数 / Body 摘要 |
|------|--------|------|------|------|----------------------|
| 0 | 0.1 | GET | `/user/tokens/verify` | 验证 Token 有效性 | Header: `Authorization: Bearer $CF_API_TOKEN` |
| 1 | 1.1 | GET | `/zones?per_page=50&page={N}&status=active` | 分页拉取全部 Zone | 循环至 `page >= total_pages`；输出 `id`, `name`, `plan.name`, `status` |
| 1 | 1.2 | — | 本地处理 | 导出 Zone CSV | `zone_id,zone_name,plan,status → /tmp/vistra_zones.csv` |
| 2 | 2.1 | POST | `$CF_GRAPHQL_ENDPOINT` | 查询 30 天总请求量（按 Zone 聚合） | Query: `httpRequests1dGroups`，`orderBy: [sum_requests_DESC]`，`limit: 10000`；返回 `zoneTag`, `sum.requests`, `sum.cachedRequests`, `uniq.visitors` |
| 2 | 2.2 | POST | `$CF_GRAPHQL_ENDPOINT` | 查询峰值小时请求量（估算 P95 RPS） | Query: `httpRequests1hGroups`，`orderBy: [sum_requests_DESC]`；返回 `zoneTag`, `peak_hourly_requests`, `peak_rps_estimate = requests/3600` |
| 2 | 2.3 | — | 本地 jq 处理 | 按 P80/P30 自动分三档 | `sort_by(.total_requests) | reverse`；Top 20% → High，P30~P80 → Medium，后 30% → Low；输出 `/tmp/zone_groups.json` |
| 3 | 3.1 | POST | `/accounts/{id}/rulesets` | 创建 High Profile Ruleset | `name: "Vistra-RL-High"`, `kind: "custom"`, `phase: "http_ratelimit"`；见 **表 4** |
| 3 | 3.2 | POST | `/accounts/{id}/rulesets` | 创建 Medium Profile Ruleset | `name: "Vistra-RL-Medium"`, `kind: "custom"`, `phase: "http_ratelimit"`；见 **表 4** |
| 3 | 3.3 | POST | `/accounts/{id}/rulesets` | 创建 Low Profile Ruleset | `name: "Vistra-RL-Low"`, `kind: "custom"`, `phase: "http_ratelimit"`；见 **表 4** |
| 3 | 3.4 | — | 本地处理 | 提取三个 Ruleset ID | `RL_HIGH_ID`, `RL_MEDIUM_ID`, `RL_LOW_ID` 从各自响应 `.result.id` 提取 |
| 4 | 4.1 | GET | `/accounts/{id}/rulesets/phases/http_ratelimit/entrypoint` | 获取 Entry Point Ruleset | 返回 `id`（存为 `ENTRYPOINT_ID`）、`kind: "root"`；404 时见 **表 8** |
| 5 | 5.1 | — | 本地处理 | 生成三档 Zone 名称列表 | zone_tag → zone_name 映射；输出 `HIGH_ZONES`, `MEDIUM_ZONES`, `LOW_ZONES`（逗号分隔带引号） |
| 5 | 5.2 | POST | `/accounts/{id}/rulesets/{ENTRYPOINT_ID}/rules` | 部署 High Execute Rule | `action: "execute"`, `expression: "cf.zone.plan eq \"ENT\" and cf.zone.name in {HIGH_ZONES}"`, `action_parameters.id: RL_HIGH_ID` |
| 5 | 5.3 | POST | `/accounts/{id}/rulesets/{ENTRYPOINT_ID}/rules` | 部署 Medium Execute Rule | `action: "execute"`, `expression: "cf.zone.plan eq \"ENT\" and cf.zone.name in {MEDIUM_ZONES}"`, `action_parameters.id: RL_MEDIUM_ID` |
| 5 | 5.4 | POST | `/accounts/{id}/rulesets/{ENTRYPOINT_ID}/rules` | 部署 Low Execute Rule | `action: "execute"`, `expression: "cf.zone.plan eq \"ENT\" and cf.zone.name in {LOW_ZONES}"`, `action_parameters.id: RL_LOW_ID` |
| 6 | 6.1 | GET | `/accounts/{id}/rulesets/phases/http_ratelimit/entrypoint` | 验证 Entry Point 全部规则 | 检查 3 条 execute 规则的 `description`, `expression`, `action`, `enabled` |
| 6 | 6.2 | GET | `/accounts/{id}/rulesets/{RULESET_ID}` | 查看各 Ruleset 参数详情 | 遍历 `RL_HIGH_ID`, `RL_MEDIUM_ID`, `RL_LOW_ID`；检查 `ratelimit` 各字段 |
| 6 | 6.3 | POST | `$CF_GRAPHQL_ENDPOINT` | 检查 Security Events 命中（部署 7 天后） | Query: `firewalleventsAdaptiveGroups`，`filter: {action: "block"}`；返回 `zoneTag`, `ruleId`, `count`, `datetime` |
| 7 | 7.1 | GET | `/accounts/{id}/rulesets/{RL_HIGH_ID}` | 获取待调优的 rule_id | 从 `.result.rules[0].id` 提取 `RULE_ID` |
| 7 | 7.2 | PUT | `/accounts/{id}/rulesets/{RL_HIGH_ID}/rules/{RULE_ID}` | 调整阈值 | 更新 `ratelimit.requests_per_period` 等参数；见 **表 4** |

---

## 表 4 — 三档 Ruleset 参数对照

| 参数 | High | Medium | Low |
|------|------|--------|-----|
| Ruleset 名称 | `Vistra-RL-High` | `Vistra-RL-Medium` | `Vistra-RL-Low` |
| `kind` | `custom` | `custom` | `custom` |
| `phase` | `http_ratelimit` | `http_ratelimit` | `http_ratelimit` |
| `expression`（Ruleset 内） | `true` | `true` | `true` |
| `ratelimit.characteristics` | `["ip.src", "cf.colo.id"]` | `["ip.src", "cf.colo.id"]` | `["ip.src"]` |
| `ratelimit.requests_to_origin` | `false` | `false` | `false` |
| `ratelimit.requests_per_period` | 1000（可按 P95×3 调优） | 500（可按 P95×2.5 调优） | 200（可按 P95×2 调优） |
| `ratelimit.period` | 60 | 60 | 60 |
| `ratelimit.mitigation_timeout` | 120 | 300 | 600 |
| `action` | `block` | `block` | `challenge` |
| `action_parameters.response.status_code` | 429 | 429 | N/A |
| `action_parameters.response.content_type` | `application/json` | `application/json` | N/A |
| `action_parameters.response.content` | `{"error":"Rate limit exceeded..."}` | `{"error":"Too many requests..."}` | N/A |
| 部署 expression（execute 规则） | `cf.zone.plan eq "ENT" and cf.zone.name in {HIGH_ZONES}` | `cf.zone.plan eq "ENT" and cf.zone.name in {MEDIUM_ZONES}` | `cf.zone.plan eq "ENT" and cf.zone.name in {LOW_ZONES}` |
| Zone 分配策略 | Top 20% 流量 | P30~P80 | 后 30% |

---

## 表 5 — GraphQL 查询一览

| 编号 | 查询名 | Dataset | 粒度 | 用途 | 关键 filter | 返回字段 |
|------|--------|---------|------|------|-------------|----------|
| Q1 | `ZoneTrafficBaseline` | `httpRequests1dGroups` | 按天 | 30 天总请求量 | `date_geq: $start, date_leq: $end` | `zoneTag`, `sum.requests`, `sum.cachedRequests`, `uniq.visitors` |
| Q2 | `ZonePeakRPS` | `httpRequests1hGroups` | 按小时 | 峰值小时请求量 | `date_geq: $start, date_leq: $end` | `zoneTag`, `datetimeHour`, `sum.requests`（÷3600 估算 RPS） |
| Q3 | `SecurityEvents` | `firewalleventsAdaptiveGroups` | 自适应 | 7 天 Block 命中 | `date_geq, date_leq, action: "block"` | `zoneTag`, `ruleId`, `count`, `datetime` |

> 三条 GraphQL 查询均使用 `viewer > zones(filter: {accountTag})` 或 `viewer > accounts(filter: {accountTag})` 作为入口，一次查询覆盖全部 Zone。

---

## 表 6 — 各步骤输出文件

| 文件 | 来源步骤 | 内容 |
|------|----------|------|
| `/tmp/vistra_zones.csv` | Step 1.2 | `zone_id,zone_name,plan,status` |
| `/tmp/zone_traffic_baseline.json` | Step 2.1 | 每 Zone 30 天总请求量 + 缓存请求 + 独立访客 |
| `/tmp/zone_peak_rps.json` | Step 2.2 | 每 Zone 峰值小时请求量 + 估算 RPS |
| `/tmp/zone_groups.json` | Step 2.3 | 三档 Zone 分组 `{high: [...], medium: [...], low: [...]}` |
| `/tmp/rl_high_ruleset.json` | Step 3.1 | High Ruleset ID + name + phase |
| `/tmp/rl_medium_ruleset.json` | Step 3.2 | Medium Ruleset ID + name + phase |
| `/tmp/rl_low_ruleset.json` | Step 3.3 | Low Ruleset ID + name + phase |
| `/tmp/rl_entrypoint.json` | Step 4.1 | Entry Point Ruleset ID + kind + phase |

---

## 表 7 — 部署后验证检查清单

| 检查项 | 方法 | 预期结果 | 异常处理 |
|--------|------|----------|----------|
| Entry Point 有 3 条 execute 规则 | GET entrypoint | `rules` 数组长度 = 3 | 缺失则重新 POST 对应 execute 规则 |
| 每条 execute 规则 `enabled: true` | GET entrypoint | 全部 `true` | `false` 则 PUT 更新 `enabled: true` |
| 每条 execute 规则 expression 包含 `cf.zone.plan eq "ENT"` | GET entrypoint | 全部包含 | 缺失则 PUT 补充 |
| 各 Ruleset 的 `requests_per_period` 值正确 | GET ruleset | High=1000 / Medium=500 / Low=200 | 不符则 PUT 更新 |
| 各 Ruleset 的 `action` 正确 | GET ruleset | High=block / Medium=block / Low=challenge | 不符则 PUT 更新 |
| 各 Ruleset 的 `characteristics` 正确 | GET ruleset | High/Medium 含 `cf.colo.id`，Low 仅 `ip.src` | 不符则 PUT 更新 |
| 部署 7 天后 Block 命中数 | GraphQL Q3 | 合理范围内（非 0 非爆量） | 偏高→调高 `requests_per_period`；为 0→可适当调低 |

---

## 表 8 — Entry Point 不存在时（404）创建 Root Ruleset

| 参数 | 值 |
|------|-----|
| 方法 | POST |
| 端点 | `/accounts/{id}/rulesets` |
| `description` | `Account-level http_ratelimit phase entry point` |
| `kind` | `root` |
| `name` | `Account-level phase entry point` |
| `phase` | `http_ratelimit` |
| `rules` | `[]`（空数组，后续通过 Step 5 逐条添加 execute 规则） |

---

## 表 9 — 阈值调优公式

| Profile | 分组标准 | 阈值公式 | 安全系数 | 调优建议 |
|---------|----------|----------|----------|----------|
| High | Top 20% 流量（P80+） | `P95_peak_rps × 3` | 3x | 第一周 action 改为 `log`，观察后切 `block` |
| Medium | P30~P80 | `P95_peak_rps × 2.5` | 2.5x | 同上 |
| Low | 后 30%（P30 以下） | `P95_peak_rps × 2` | 2x | 静态站点流量平稳，可更严格 |

> `P95_peak_rps` 来自 Step 2.2 的 `peak_hourly_requests / 3600`

---

## 表 10 — 关键注意事项

| # | 注意事项 | 说明 |
|---|----------|------|
| 1 | `cf.zone.plan eq "ENT"` 是硬性要求 | 账户级 Rate Limiting 仅对 Enterprise Zone 生效，每条 execute 规则必须包含 |
| 2 | `requests_to_origin: false` | 不计算缓存命中请求，只对到达源站流量计数，避免 CDN 缓存撑爆计数器 |
| 3 | 第一周 action 设为 `log` | 先观察命中情况，确认无误杀后再切 `block` / `challenge` |
| 4 | Zone 增减维护 | 新增 Zone 只需 PUT 更新对应 execute 规则的 `cf.zone.name in {...}` 列表 |
| 5 | 表达式长度限制 | 70+ Zone 名称过长时改用 `cf.zone.id in {...}`（更短 ID）或拆分多条 execute 规则 |
| 6 | Characteristics 选择 | `["ip.src","cf.colo.id"]` 适合多 POP 分布式流量；`["ip.src"]` 适合静态站点；还可加 `http.request.headers["user-agent"]`、`cf.bot_management.score` |
| 7 | Rate Limiting 与 Custom Rules 区别 | Rate Limiting 在 `http_ratelimit` phase 执行，位于 `http_request_firewall_custom` 之后；Custom Rules 已 Block 的请求不会被 Rate Limiting 计数 |

---

## 表 11 — characteristics 可选维度

| characteristics 值 | 计数维度 | 适用场景 | 建议档位 |
|---------------------|----------|----------|----------|
| `["ip.src"]` | 纯客户端 IP | 静态站点、流量集中 | Low |
| `["ip.src", "cf.colo.id"]` | IP + 数据中心 | 多 POP 分布式流量 | High / Medium |
| `["ip.src", "http.request.headers["user-agent"]"]` | IP + UA | 防爬虫场景 | High（API） |
| `["ip.src", "cf.bot_management.score"]` | IP + Bot 分数 | Bot Management 集成 | High（含 Bot Mgmt） |
| `["ip.src", "http.request.uri.path"]` | IP + 路径 | 精确到路径级限速 | 按需 |

---

> **文档结束** — 全部内容以表格形式呈现，可直接复制粘贴到任意文档中。
