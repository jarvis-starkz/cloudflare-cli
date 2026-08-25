#!/bin/bash
# ============================================================
# Vistra Rate Limiting 部署检查表
# 配套文档: VISTRA_RATE_LIMITING_DELIVERY_REPORT.md v2.0
# 用法: bash VISTRA_RATE_LIMITING_DEPLOYMENT_CHECKLIST.sh
# ============================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# 计数器
PASS=0
FAIL=0
WARN=0
TOTAL=0

# ============================================================
# 辅助函数
# ============================================================

check() {
    local num="$1"
    local desc="$2"
    local cmd="$3"
    local expected="$4"
    local actual
    actual=$(eval "$cmd" 2>/dev/null || echo "__ERROR__")
    TOTAL=$((TOTAL + 1))
    if [ "$actual" = "__ERROR__" ]; then
        FAIL=$((FAIL + 1))
        printf "${RED}[FAIL] %s. %s${NC}\n" "$num" "$desc"
        printf "       命令: %s\n" "$cmd"
        printf "       结果: 执行失败\n"
    elif echo "$actual" | grep -qiE "$expected"; then
        PASS=$((PASS + 1))
        printf "${GREEN}[PASS] %s. %s${NC}\n" "$num" "$desc"
        printf "       结果: %s\n" "$actual"
    else
        FAIL=$((FAIL + 1))
        printf "${RED}[FAIL] %s. %s${NC}\n" "$num" "$desc"
        printf "       预期: %s\n" "$expected"
        printf "       实际: %s\n" "$actual"
    fi
}

check_manual() {
    local num="$1"
    local desc="$2"
    local instructions="$3"
    TOTAL=$((TOTAL + 1))
    WARN=$((WARN + 1))
    printf "${YELLOW}[MANUAL] %s. %s${NC}\n" "$num" "$desc"
    printf "          %s\n" "$instructions"
}

section() {
    echo ""
    printf "${BLUE}${BOLD}=== %s ===${NC}\n" "$1"
}

# ============================================================
# Phase 0: 环境变量设置（手动填写后取消注释）
# ============================================================

section "Phase 0: 环境变量设置"

# --- 取消注释并填写实际值 ---
# export CF_API_BASE="https://api.cloudflare.com/client/v4"
# export CF_ACCOUNT_ID="<替换为 Vistra 账户 ID>"
# export CF_API_TOKEN="<替换为具有 Ruleset Edit 权限的 Token>"

echo "请在脚本顶部 Phase 0 区域取消注释并填写以下 3 个环境变量："
echo "  - CF_API_BASE   (固定值)"
echo "  - CF_ACCOUNT_ID (Vistra 账户 ID)"
echo "  - CF_API_TOKEN  (API Token)"
echo ""

# 检查环境变量是否已设置
if [ -z "${CF_API_BASE:-}" ] || [ -z "${CF_ACCOUNT_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ]; then
    printf "${RED}${BOLD}❌ 环境变量未设置，请先填写 Phase 0 区域的 export 语句。${NC}\n"
    exit 1
fi
printf "${GREEN}✅ 环境变量已设置${NC}\n"

# ============================================================
# Phase 1: Token 验证（自动）
# ============================================================

section "Phase 1: Token 验证"

check "1.1" \
    "Token 状态为 active" \
    'curl -s "${CF_API_BASE}/user/tokens/verify" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.status"' \
    "active"

# ============================================================
# Phase 2: 账户信息验证（自动）
# ============================================================

section "Phase 2: 账户信息验证"

check "2.1" \
    "账户 ID 可访问" \
    'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.name"' \
    ".+"

check "2.2" \
    "账户下 Enterprise Zone 数量" \
    'curl -s "${CF_API_BASE}/zones?account_id=${CF_ACCOUNT_ID}&per_page=50&page=1" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result | length"' \
    "[0-9]+"

# ============================================================
# Phase 3: Entry Point 获取（自动）
# ============================================================

section "Phase 3: Entry Point 获取"

ENTRYPOINT_ID=$(curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/phases/http_ratelimit/entrypoint" \
    --header "Authorization: Bearer ${CF_API_TOKEN}" \
    | jq -r '.result.id' 2>/dev/null || echo "null")

check "3.1" \
    "ENTRYPOINT_ID 非空" \
    'echo "${ENTRYPOINT_ID}"' \
    "[a-f0-9]{32}"

# ============================================================
# Phase 4: 流量分析变量（半自动 — 需先运行 GraphQL）
# ============================================================

section "Phase 4: 流量分析变量"

check_manual "4.1" \
    "HIGH_ZONES 已生成" \
    "运行 GraphQL 30 天流量查询 → 按请求量排序 → 取 Top 20% Zone → export HIGH_ZONES=..."

check_manual "4.2" \
    "MEDIUM_ZONES 已生成" \
    "同上 → 取 P30-P80 区间的 Zone → export MEDIUM_ZONES=..."

check_manual "4.3" \
    "LOW_ZONES 已生成" \
    "同上 → 取 P30 以下 Zone → export LOW_ZONES=..."

check_manual "4.4" \
    "三档 Zone 数合计 = 总 Zone 数" \
    "echo \$HIGH_ZONES | tr ',' '\n' | wc -l + Medium + Low = Enterprise Zone 总数"

# ============================================================
# Phase 5: IP 占位符替换（手动）
# ============================================================

section "Phase 5: IP 占位符替换"

check_manual "5.1" \
    "办公网 IP 已替换" \
    "在 JSON payload 中将 203.0.113.0/24 替换为 Vistra 实际办公网出口 CIDR"

check_manual "5.2" \
    "合作伙伴 IP 1 已替换" \
    "在 JSON payload 中将 198.51.100.50 替换为实际合作伙伴 IP"

check_manual "5.3" \
    "合作伙伴 IP 2 已替换" \
    "在 JSON payload 中将 198.51.100.51 替换为实际合作伙伴 IP（或删除多余占位符）"

# ============================================================
# Phase 6: Ruleset 创建（自动 — 需先完成 Phase 3-5）
# ============================================================

section "Phase 6: Ruleset 创建（或已有 Ruleset 确认）"

check_manual "6.1" \
    "High Ruleset 已创建" \
    "按报告第 9.1 节执行 curl POST 创建 Vistra-RL-High → 从响应中提取 RL_HIGH_ID"

check_manual "6.2" \
    "Medium Ruleset 已创建" \
    "按报告第 9.2 节执行 curl POST 创建 Vistra-RL-Medium → 从响应中提取 RL_MEDIUM_ID"

check_manual "6.3" \
    "Low Ruleset 已创建" \
    "按报告第 9.3 节执行 curl POST 创建 Vistra-RL-Low → 从响应中提取 RL_LOW_ID"

# ============================================================
# Phase 7: Ruleset ID 验证（自动）
# ============================================================

section "Phase 7: Ruleset ID 验证"

echo "请在下方取消注释并填入实际 Ruleset ID："
echo "  RL_HIGH_ID=..."
echo "  RL_MEDIUM_ID=..."
echo "  RL_LOW_ID=..."
echo ""

# --- 取消注释并填写实际值 ---
# RL_HIGH_ID="<填入 Phase 6.1 提取的 ID>"
# RL_MEDIUM_ID="<填入 Phase 6.2 提取的 ID>"
# RL_LOW_ID="<填入 Phase 6.3 提取的 ID>"

if [ -z "${RL_HIGH_ID:-}" ] || [ -z "${RL_MEDIUM_ID:-}" ] || [ -z "${RL_LOW_ID:-}" ]; then
    printf "${YELLOW}⚠️ 请先填入 Ruleset ID 后重新运行 Phase 7${NC}\n"
else
    check "7.1" \
        "RL_HIGH_ID 有效" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.name"' \
        "Vistra-RL-High"

    check "7.2" \
        "RL_MEDIUM_ID 有效" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.name"' \
        "Vistra-RL-Medium"

    check "7.3" \
        "RL_LOW_ID 有效" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_LOW_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.name"' \
        "Vistra-RL-Low"
fi

# ============================================================
# Phase 8: Execute Rules 部署验证（需先完成全部前置步骤）
# ============================================================

section "Phase 8: Execute Rules 部署验证"

check "8.1" \
    "Entry Point 内 Execute Rules 数量 ≥ 3" \
    'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules | length"' \
    "[3-9]|[1-9][0-9]"

check "8.2" \
    "Entry Point 内 enabled Execute Rules 数量" \
    'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${ENTRYPOINT_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r "[.result.rules[] | select(.enabled == true)] | length"' \
    "[3-9]|[1-9][0-9]"

# ============================================================
# Phase 9: 配置内容验证（自动）
# ============================================================

section "Phase 9: 配置内容验证"

if [ -n "${RL_HIGH_ID:-}" ]; then
    check "9.1" \
        "High Ruleset expression 包含 IP 排除" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].expression"' \
        "not ip.src"

    check "9.2" \
        "High Ruleset characteristics 含 3 维度" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.characteristics | length"' \
        "3"

    check "9.3" \
        "High Ruleset 阈值 = 1500" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.requests_per_period"' \
        "1500"

    check "9.4" \
        "High Ruleset action = block" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_HIGH_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].action"' \
        "block"
fi

if [ -n "${RL_MEDIUM_ID:-}" ]; then
    check "9.5" \
        "Medium Ruleset expression 包含 IP 排除" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].expression"' \
        "not ip.src"

    check "9.6" \
        "Medium Ruleset characteristics 含 2 维度" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.characteristics | length"' \
        "2"

    check "9.7" \
        "Medium Ruleset 阈值 = 500" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_MEDIUM_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.requests_per_period"' \
        "500"
fi

if [ -n "${RL_LOW_ID:-}" ]; then
    check "9.8" \
        "Low Ruleset expression = true" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_LOW_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].expression"' \
        "true"

    check "9.9" \
        "Low Ruleset characteristics 含 1 维度" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_LOW_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.characteristics | length"' \
        "1"

    check "9.10" \
        "Low Ruleset 阈值 = 200" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_LOW_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].ratelimit.requests_per_period"' \
        "200"

    check "9.11" \
        "Low Ruleset action = challenge" \
        'curl -s "${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/rulesets/${RL_LOW_ID}" --header "Authorization: Bearer ${CF_API_TOKEN}" | jq -r ".result.rules[0].action"' \
        "challenge"
fi

# ============================================================
# Phase 10: 汇总
# ============================================================

section "汇总"

echo ""
printf "${BOLD}总计: %d 项${NC}\n" "$TOTAL"
printf "${GREEN}通过: %d${NC}\n" "$PASS"
printf "${YELLOW}待手动确认: %d${NC}\n" "$WARN"
printf "${RED}失败: %d${NC}\n" "$FAIL"

echo ""
if [ "$FAIL" -gt 0 ]; then
    printf "${RED}${BOLD}❌ 有 %d 项检查未通过，请修正后重新运行。${NC}\n" "$FAIL"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    printf "${YELLOW}${BOLD}⚠️ %d 项需手动确认，%d 项自动检查已通过。${NC}\n" "$WARN" "$PASS"
    echo ""
    echo "手动确认项清单："
    echo "  [ ] 4.1  HIGH_ZONES 已生成"
    echo "  [ ] 4.2  MEDIUM_ZONES 已生成"
    echo "  [ ] 4.3  LOW_ZONES 已生成"
    echo "  [ ] 4.4  三档 Zone 数合计 = 总 Zone 数"
    echo "  [ ] 5.1  办公网 IP 已替换"
    echo "  [ ] 5.2  合作伙伴 IP 1 已替换"
    echo "  [ ] 5.3  合作伙伴 IP 2 已替换"
    echo "  [ ] 6.1  High Ruleset 已创建 (RL_HIGH_ID)"
    echo "  [ ] 6.2  Medium Ruleset 已创建 (RL_MEDIUM_ID)"
    echo "  [ ] 6.3  Low Ruleset 已创建 (RL_LOW_ID)"
else
    printf "${GREEN}${BOLD}✅ 全部 %d 项检查通过！${NC}\n" "$PASS"
fi
