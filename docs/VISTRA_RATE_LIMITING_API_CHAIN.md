# Vistra 账户级 WAF Rate Limiting — 完整 API 调用链示例

> **文档版本**: v1.0  
> **最后更新**: 2026-08-24  
> **适用范围**: Vistra Enterprise 账户，70+ Zone，三档（High / Medium / Low）  
> **注意**: 本文档仅为 API 调用链示例，所有 `$VARIABLE` 需替换为实际值后执行

---

## 0. 前置条件

### 0.1 所需环境变量

```bash
# ─── Cloudflare 凭据 ───
export CF_API_TOKEN="your-api-token-here"          # API Token
export CF_ACCOUNT_ID="your-account-id-here"         # 账户 ID

# ─── API 端点 ───
export CF_API_BASE="https://api.cloudflare.com/client/v4"
export CF_GRAPHQL_ENDPOINT="https://api.cloudflare.com/client/v4/graphql"
```

### 0.2 API Token 所需权限

| 权限 | 用途 |
|------|------|
| `Account > Account Settings > Read` | 获取账户信息 |
| `Zone > Zone > Read` | 列出所有 Zone |
| `Account > Account Analytics > Read` | GraphQL 查询流量基线 |
| `Account > WAF > Write` | 创建 Rate Limiting Ruleset + 部署 |
| `Account > Rulesets > Write` | 操作 Rulesets API |
| `Account > Rulesets > Read` | 读取 entry point ruleset |

> 建议创建一个专用 API Token，仅包含上述权限，用后回收。

### 0.3 验证 Token 有效性

```bash
curl -s "${CF_API_BASE}/user/tokens/verify" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" | jq '.success'
```

---

## 1. 获取全部 Zone 列表

### 1.1 分页拉取所有 Zone（含 Zone ID 与名称）

```bash
# ─── 拉取所有 Zone，输出 zone_id + zone_name + plan + status ───
PAGE=1
ALL_ZONES=""

while true; do
  RESPONSE=$(curl -s "${CF_API_BASE}/zones?per_page=50&page=${PAGE}&status=active" \
    --header "Authorization: Bearer ${CF_API_TOKEN}")

  ZONES=$(echo "$RESPONSE" | jq -r '.result[] | [.id, .name, .plan.name, .status] | @tsv')
  ALL_ZONES="${ALL_ZONES}${ZONES}\n"

  TOTAL_PAGES=$(echo "$RESPONSE" | jq '.result_info.total_pages')
  if [ "$PAGE" -ge "$TOTAL_PAGES" ]; then
    break
  fi
  PAGE=$((PAGE + 1))
done

echo -e "zone_id\tzone_name\tplan\tstatus"
echo -e "$ALL_ZONES"
```

### 1.2 导出为 CSV（供后续分组使用）

```bash
echo "zone_id,zone_name,plan,status" > /tmp/vistra_zones.csv
echo -e "$ALL_ZONES" | awk -F'\t' '{printf "%s,%s,%s,%s\n",$1,$2,$3,$4}' >> /tmp/vistra_zones.csv
echo "✅ Zone 列表已导出: /tmp/vistra_zones.csv ($(wc -l < /tmp/vistra_zones.csv) 行)"
```

---

## 2. GraphQL Analytics API — 批量拉取 30 天流量基线

### 2.1 查询全部 Zone 的 30 天请求量（按 Zone 聚合 + 降序排列）

> **一次查询覆盖所有 Zone**，无需逐 Zone 调用。

```bash
# ─── 日期范围：过去 30 天 ───
END_DATE=$(date -u +"%Y-%m-%d")
START_DATE=$(date -u -d "30 days ago" +"%Y-%m-%d")

cat > /tmp/graphql_baseline.json << QUERY
{
  "query": "query ZoneTrafficBaseline(\$accountTag: String!, \$start: Date!, \$end: Date!) {
    viewer {
      zones(filter: { accountTag: \$accountTag }) {
        httpRequests1dGroups(
          filter: { date_geq: \$start, date_leq: \$end }
          limit: 10000
          orderBy: [sum_requests_DESC]
        ) {
          sum {
            requests
            pageViews
            cachedRequests
          }
          dimensions {
            zoneTag
          }
          uniq {
            visitors
          }
        }
      }
    }
  }",
  "variables": {
    "accountTag": "${CF_ACCOUNT_ID}",
    "start": "${START_DATE}",
    "end": "${END_DATE}"
  }
}
QUERY

curl -s "${CF_GRAPHQL_ENDPOINT}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data @/tmp/graphql_baseline.json | jq '.data.viewer.zones[] | {
    zone_tag: .httpRequests1dGroups[0].dimensions.zoneTag,
    total_requests: .httpRequests1dGroups[0].sum.requests,
    cached_requests: .httpRequests1dGroups[0].sum.cachedRequests,
    unique_visitors: .httpRequests1dGroups[0].uniq.visitors
  }' > /tmp/zone_traffic_baseline.json

echo "✅ 流量基线已保存: /tmp/zone_traffic_baseline.json"
```

### 2.2 查询每 Zone 的峰值 RPS（按小时粒度，取 P95）

```bash
cat > /tmp/graphql_peak_rps.json << QUERY
{
  "query": "query ZonePeakRPS(\$accountTag: String!, \$start: Date!, \$end: Date!) {
    viewer {
      zones(filter: { accountTag: \$accountTag }) {
        httpRequests1hGroups(
          filter: { date_geq: \$start, date_leq: \$end }
          limit: 10000
          orderBy: [sum_requests_DESC]
        ) {
          sum { requests }
          dimensions { zoneTag datetimeHour }
        }
      }
    }
  }",
  "variables": {
    "accountTag": "${CF_ACCOUNT_ID}",
    "start": "${START_DATE}",
    "end": "${END_DATE}"
  }
}
QUERY

curl -s "${CF_GRAPHQL_ENDPOINT}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data @/tmp/graphql_peak_rps.json \
  | jq '[.data.viewer.zones[] | {
      zone_tag: .httpRequests1hGroups[0].dimensions.zoneTag,
      peak_hourly_requests: .httpRequests1hGroups[0].sum.requests,
      peak_rps_estimate: ((.httpRequests1hGroups[0].sum.requests / 3600) | floor)
    }]' > /tmp/zone_peak_rps.json

echo "✅ 峰值 RPS 已保存: /tmp/zone_peak_rps.json"
```

### 2.3 按流量分位自动分组（生成三档 Zone 名单）

```bash
# ─── 按 total_requests 降序排列，按 P80/P30 切分三档 ───
jq -r '
  sort_by(.total_requests) | reverse
  | . as $all
  | ($all | length) as $n
  | ($n * 0.2 | floor) as $p80_idx      # Top 20% → High
  | ($n * 0.7 | floor) as $p30_idx      # 中间 50% → Medium, 后 30% → Low
  | {
      high:   [$all[0:$p80_idx][] | .zone_tag],
      medium: [$all[$p80_idx:$p30_idx][] | .zone_tag],
      low:    [$all[$p30_idx:][] | .zone_tag]
    }
' /tmp/zone_traffic_baseline.json > /tmp/zone_groups.json

echo "✅ 三档分组完成: /tmp/zone_groups.json"
jq '{high_count: (.high | length), medium_count: (.medium | length), low_count: (.low | length)}' /tmp/zone_groups.json
```

---

## 3. 创建三档 Rate Limiting Ruleset

> 以下三个 Ruleset 在账户级 `http_ratelimit` phase 创建。  
> **此处仅为创建操作示例，不会自动执行。**

### 3.1 创建 High Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-High: 核心业务域名，高阈值，仅拦截真正攻击",
    "kind": "custom",
    "name": "Vistra-RL-High",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "High profile — 核心业务域名速率限制",
        "expression": "true",
        "ratelimit": {
          "characteristics": [
            "ip.src",
            "cf.colo.id"
          ],
          "requests_to_origin": false,
          "requests_per_period": 1000,
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
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}' > /tmp/rl_high_ruleset.json

echo "✅ High Ruleset 创建完成"
cat /tmp/rl_high_ruleset.json
```

### 3.2 创建 Medium Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-Medium: 企业官网/客户门户，中等阈值",
    "kind": "custom",
    "name": "Vistra-RL-Medium",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Medium profile — 门户域名速率限制",
        "expression": "true",
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
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}' > /tmp/rl_medium_ruleset.json

echo "✅ Medium Ruleset 创建完成"
cat /tmp/rl_medium_ruleset.json
```

### 3.3 创建 Low Profile Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Vistra RL-Low: 静态站点/营销页面，低阈值，严格管控",
    "kind": "custom",
    "name": "Vistra-RL-Low",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Low profile — 静态站点速率限制",
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
  }' | jq '{id: .result.id, name: .result.name, phase: .result.phase}' > /tmp/rl_low_ruleset.json

echo "✅ Low Ruleset 创建完成"
cat /tmp/rl_low_ruleset.json
```

### 3.4 提取三个 Ruleset ID（后续部署步骤需要）

```bash
RL_HIGH_ID=$(jq -r '.id' /tmp/rl_high_ruleset.json)
RL_MEDIUM_ID=$(jq -r '.id' /tmp/rl_medium_ruleset.json)
RL_LOW_ID=$(jq -r '.id' /tmp/rl_low_ruleset.json)

echo "RL_HIGH_ID   = ${RL_HIGH_ID}"
echo "RL_MEDIUM_ID = ${RL_MEDIUM_ID}"
echo "RL_LOW_ID    = ${RL_LOW_ID}"
```

---

## 4. 获取 http_ratelimit Phase Entry Point

### 4.1 查询账户级 Entry Point Ruleset

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/phases/http_ratelimit/entrypoint" \
  --request GET \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq '{id: .result.id, kind: .result.kind, phase: .result.phase, rules_count: (.result.rules | length)}' \
  > /tmp/rl_entrypoint.json

echo "✅ Entry Point Ruleset 信息:"
cat /tmp/rl_entrypoint.json

ENTRYPOINT_ID=$(jq -r '.id' /tmp/rl_entrypoint.json)
echo "ENTRYPOINT_ID = ${ENTRYPOINT_ID}"
```

> 如果返回 `404 Not Found`，说明 entry point 尚未创建。  
> 需要先创建 root kind 的 entry point ruleset（见附录 A）。

---

## 5. 部署三档 Ruleset 到指定 Zone 组

> 以下操作在 entry point ruleset 中添加 3 条 `execute` 规则，  
> 每条用 `cf.zone.name in {...}` 筛选对应档位的 Zone。  
> **此处仅为调用示例，不会自动执行。**

### 5.1 生成三档 Zone 名称列表（从 Step 2.3 的分组结果转换）

```bash
# ─── 将 zone_tag 转换为 zone_name（需 Step 1 的 zone 列表做映射）───
# 构建 zone_tag → zone_name 映射
jq -r 'split("\n")[] | split("\t") | {key: .[0], value: .[1]}' /tmp/vistra_zones.csv > /tmp/zone_map.json 2>/dev/null

# 生成三档 zone name 列表（逗号分隔，带引号，用于表达式）
HIGH_ZONES=$(jq -r '.high[]' /tmp/zone_groups.json | while read tag; do
  grep "$tag" /tmp/vistra_zones.csv 2>/dev/null | cut -d',' -f2
done | sort -u | jq -R . | jq -sc 'join(", ")')

MEDIUM_ZONES=$(jq -r '.medium[]' /tmp/zone_groups.json | while read tag; do
  grep "$tag" /tmp/vistra_zones.csv 2>/dev/null | cut -d',' -f2
done | sort -u | jq -R . | jq -sc 'join(", ")')

LOW_ZONES=$(jq -r '.low[]' /tmp/zone_groups.json | while read tag; do
  grep "$tag" /tmp/vistra_zones.csv 2>/dev/null | cut -d',' -f2
done | sort -u | jq -R . | jq -sc 'join(", ")')

echo "HIGH_ZONES   = ${HIGH_ZONES}"
echo "MEDIUM_ZONES = ${MEDIUM_ZONES}"
echo "LOW_ZONES    = ${LOW_ZONES}"
```

### 5.2 部署 High Profile（Execute Rule 1）

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-High to high-traffic zones",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${HIGH_ZONES}"'})",
    "action": "execute",
    "action_parameters": {
      "id": "'"${RL_HIGH_ID}"'"
    },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, description: .result.rules[-1].description, enabled: .result.rules[-1].enabled}'

echo "✅ High Profile 部署完成"
```

### 5.3 部署 Medium Profile（Execute Rule 2）

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-Medium to medium-traffic zones",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${MEDIUM_ZONES}"'})",
    "action": "execute",
    "action_parameters": {
      "id": "'"${RL_MEDIUM_ID}"'"
    },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, description: .result.rules[-1].description, enabled: .result.rules[-1].enabled}'

echo "✅ Medium Profile 部署完成"
```

### 5.4 部署 Low Profile（Execute Rule 3）

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}/rules" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Deploy Vistra-RL-Low to low-traffic zones",
    "expression": "(cf.zone.plan eq \"ENT\" and cf.zone.name in {'"${LOW_ZONES}"'})",
    "action": "execute",
    "action_parameters": {
      "id": "'"${RL_LOW_ID}"'"
    },
    "enabled": true
  }' | jq '{rule_id: .result.rules[-1].id, description: .result.rules[-1].description, enabled: .result.rules[-1].enabled}'

echo "✅ Low Profile 部署完成"
```

---

## 6. 验证（只读操作）

### 6.1 查看 Entry Point 全部规则

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/phases/http_ratelimit/entrypoint" \
  --request GET \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq '.result.rules[] | {
      description,
      expression,
      action,
      action_parameters_id: .action_parameters.id,
      enabled
    }'
```

### 6.2 查看各 Ruleset 的 Rate Limiting 规则详情

```bash
for RULESET_ID in "${RL_HIGH_ID}" "${RL_MEDIUM_ID}" "${RL_LOW_ID}"; do
  echo "═══════════════════════════════════════"
  curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RULESET_ID}" \
    --request GET \
    --header "Authorization: Bearer ${CF_API_TOKEN}" \
    | jq "{name: .result.name, rules: [.result.rules[] | {
        description,
        requests_per_period: .ratelimit.requests_per_period,
        period: .ratelimit.period,
        mitigation_timeout: .ratelimit.mitigation_timeout,
        characteristics: .ratelimit.characteristics,
        action,
        enabled
      }]}"
done
```

### 6.3 通过 Security Events 检查命中情况（部署 7 天后）

```bash
END_DATE=$(date -u +"%Y-%m-%d")
START_DATE=$(date -u -d "7 days ago" +"%Y-%m-%d")

cat > /tmp/graphql_security_events.json << QUERY
{
  "query": "query SecurityEvents(\$accountTag: String!, \$start: Date!, \$end: Date!) {
    viewer {
      accounts(filter: { accountTag: \$accountTag }) {
        firewalleventsAdaptiveGroups(
          filter: { date_geq: \$start, date_leq: \$end, action: \"block\" }
          limit: 10000
          orderBy: [datetime_DESC]
        ) {
          count
          dimensions {
            zoneTag
            ruleId
            datetime
          }
        }
      }
    }
  }",
  "variables": {
    "accountTag": "${CF_ACCOUNT_ID}",
    "start": "${START_DATE}",
    "end": "${END_DATE}"
  }
}
QUERY

curl -s "${CF_GRAPHQL_ENDPOINT}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data @/tmp/graphql_security_events.json \
  | jq '.data.viewer.accounts[0].firewalleventsAdaptiveGroups[] | {
      zone: .dimensions.zoneTag,
      rule: .dimensions.ruleId,
      blocked_count: .count,
      timestamp: .dimensions.datetime
    }'

echo "✅ 如果 blocked_count 为 0 或极低，说明阈值合理；如果偏高，需调高对应档位的 requests_per_period"
```

---

## 7. 阈值调优流程（运维持续改进）

```bash
# ─── 调整 High Profile 阈值（例如从 1000 调到 1500）───
# 需先获取 High Ruleset 中的 rule_id
RULE_ID=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  | jq -r '.result.rules[0].id')

curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}/rules/${RULE_ID}" \
  --request PUT \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "High profile — 核心业务域名速率限制（调优后）",
    "expression": "true",
    "ratelimit": {
      "characteristics": ["ip.src", "cf.colo.id"],
      "requests_to_origin": false,
      "requests_per_period": 1500,
      "period": 60,
      "mitigation_timeout": 120
    },
    "action": "block",
    "enabled": true
  }' | jq '{updated: .success, new_threshold: .result.ratelimit.requests_per_period}'
```

---

## 附录 A：Entry Point 不存在时创建 Root Ruleset

> 如果 Step 4.1 返回 `404`，先执行此操作。

```bash
curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets" \
  --request POST \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --json '{
    "description": "Account-level http_ratelimit phase entry point",
    "kind": "root",
    "name": "Account-level phase entry point",
    "phase": "http_ratelimit",
    "rules": []
  }' | jq '{id: .result.id, kind: .result.kind, phase: .result.phase}'
```

---

## 附录 B：三档参数速查表

| 参数 | High | Medium | Low |
|------|------|--------|-----|
| `requests_per_period` | 1000（可按 P95×3 调优） | 500（可按 P95×2.5 调优） | 200（可按 P95×2 调优） |
| `period` | 60 秒 | 60 秒 | 60 秒 |
| `characteristics` | `["ip.src", "cf.colo.id"]` | `["ip.src", "cf.colo.id"]` | `["ip.src"]` |
| `mitigation_timeout` | 120 秒 | 300 秒 | 600 秒 |
| `action` | `block` | `block` | `challenge` |
| `requests_to_origin` | `false` | `false` | `false` |
| `response.status_code` | 429 | 429 | N/A（challenge） |
| Zone 筛选 | Top 20% 流量 | P30~P80 | 后 30% |

---

## 附录 C：API 调用链一览

```
Step 0  验证 Token 有效性
  └─ GET /user/tokens/verify

Step 1  列出全部 Zone
  └─ GET /zones?per_page=50&page=N&status=active  (分页循环)

Step 2  GraphQL 批量拉取流量基线
  ├─ Query: httpRequests1dGroups  (30天总请求量, 按 Zone 聚合)
  ├─ Query: httpRequests1hGroups  (峰值小时请求量, 估算 P95 RPS)
  └─ 本地 jq 分组: P80 / P30 切分 → High / Medium / Low Zone 名单

Step 3  创建三档 Ruleset (POST, 3次)
  ├─ POST /accounts/{id}/rulesets  →  Vistra-RL-High
  ├─ POST /accounts/{id}/rulesets  →  Vistra-RL-Medium
  └─ POST /accounts/{id}/rulesets  →  Vistra-RL-Low

Step 4  获取 http_ratelimit Entry Point
  └─ GET /accounts/{id}/rulesets/phases/http_ratelimit/entrypoint
     (404 → 附录 A 创建 root ruleset)

Step 5  部署三档 Execute Rules (POST, 3次)
  ├─ POST /accounts/{id}/rulesets/{entrypoint_id}/rules  →  High (cf.zone.name in {top zones})
  ├─ POST /accounts/{id}/rulesets/{entrypoint_id}/rules  →  Medium (cf.zone.name in {mid zones})
  └─ POST /accounts/{id}/rulesets/{entrypoint_id}/rules  →  Low (cf.zone.name in {low zones})

Step 6  验证（只读）
  ├─ GET  .../rulesets/phases/http_ratelimit/entrypoint  (确认 3 条 execute 规则)
  ├─ GET  .../rulesets/{ruleset_id}  (确认各 Ruleset 参数)
  └─ GraphQL firewalleventsAdaptiveGroups  (7天后检查命中)

Step 7  持续调优
  └─ PUT  .../rulesets/{ruleset_id}/rules/{rule_id}  (调整 requests_per_period)
```

---

## 附录 D：关键注意事项

1. **`cf.zone.plan eq "ENT"` 是硬性要求**  
   账户级 Rate Limiting 仅对 Enterprise Zone 生效。每条 execute 规则的 expression 必须包含此条件。

2. **`requests_to_origin: false`**  
   不计算缓存命中请求，只对到达源站的流量计数，避免 CDN 缓存撑爆计数器。

3. **第一周建议 action 设为 `log`**  
   先观察命中情况，确认无误杀后再切 `block` / `challenge`。

4. **Zone 增减维护**  
   新增 Zone 只需更新对应 execute 规则的 `cf.zone.name in {...}` 列表（PUT 更新该规则）。

5. **表达式长度限制**  
   如果 70+ Zone 名称导致表达式过长，可改用 `cf.zone.id in {...}`（更短的 ID），或拆分为多条 execute 规则。

6. **Characteristics 选择**  
   - `["ip.src", "cf.colo.id"]`：按 IP + 数据中心维度计数，适合多 POP 分布式流量
   - `["ip.src"]`：纯 IP 维度，适合静态站点
   - 还可添加 `http.request.headers["user-agent"]`、`cf.bot_management.score` 等维度

7. **Rate Limiting 与 Custom Rules 的区别**  
   Rate Limiting Rules 在 `http_ratelimit` phase 执行，位于 `http_request_firewall_custom` 之后。  
   如果 Custom Rules 已经 Block 了某些请求，Rate Limiting 不会对被 Block 的请求计数。

---

> **文档结束** — 本文档所有 API 调用均为示例，需替换 `$VARIABLE` 为实际值后按需执行。
