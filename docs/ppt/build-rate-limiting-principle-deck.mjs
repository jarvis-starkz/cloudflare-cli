// =================================================================
// Cloudflare 账户级 Rate Limiting 三档配置原理 · PPT 生成脚本
// 视觉主线：Jarvis's PPT Theme (橙白主题 · 白色主调 · 橙色强调)
// 16:9, 13.333" x 7.5" | 共 20 页
// =================================================================
import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "Cloudflare_Rate_Limiting原理_橙白主题.pptx");

// ---------- Jarvis's PPT Theme Design Token ----------
const T = {
  surface: "FFFFFF",      // 纯白底
  panelSoft: "FFF8F0",    // 极浅橙面板
  ink: "1A1A2E",          // 近黑深字
  muted: "8A8A9A",        // 次要灰
  accent: "E8741C",       // 橙色主色
  accentLight: "F5A623",  // 浅橙
  accentSoft: "FFF0E1",   // 柔橙底
  positive: "2F855A",     // 正绿
  caution: "C99512",      // 警告琥珀
  risk: "B03A2E",         // 风险红
  blue: "4A6FA5",         // 辅助蓝（仅用于数据维度区分）
  hairline: "E0E0E0",     // 分割线
  margin: 0.55,
  head: "Microsoft YaHei", headEn: "Calibri", mono: "Consolas",
};

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Cloudflare Platform Team";
pptx.company = "NC Services Limited";
pptx.title = "Cloudflare 账户级 Rate Limiting 三档配置原理";
const TOTAL = 22;

// ---------- helpers ----------
const addText = (s, txt, o) =>
  s.addText(txt, { margin: 0, wrap: false, vert: "horz", ...o });

const footer = (s, n) => {
  const { margin } = T;
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 7.1, w: 13.333 - 2 * margin, h: 0,
    line: { color: T.hairline, pt: 0.75 },
  });
  addText(s, "Cloudflare Rate Limiting 原理", {
    x: margin, y: 7.16, w: 8, h: 0.28,
    fontFace: T.headEn, fontSize: 9, color: T.muted,
  });
  addText(s, `${n} / ${TOTAL}`, {
    x: 13.333 - margin - 2, y: 7.16, w: 2, h: 0.28,
    fontFace: T.headEn, fontSize: 10, color: T.muted, align: "right",
  });
};

const header = (s, sec, title) => {
  const { margin, accent, hairline, ink, head, headEn } = T;
  addText(s, sec.toUpperCase(), {
    x: margin, y: 0.4, w: 8, h: 0.32,
    fontFace: headEn, fontSize: 10, bold: true, color: accent,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 0.7, w: 0.55, h: 0, line: { color: accent, pt: 2 },
  });
  addText(s, title, {
    x: margin, y: 0.78, w: 13.333 - 2 * margin, h: 0.64,
    fontFace: head, fontSize: 22, bold: true, color: ink,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 1.55, w: 13.333 - 2 * margin, h: 0,
    line: { color: hairline, pt: 0.5 },
  });
};

const bg = (s) => {
  s.background = { color: T.surface };
};

// =================================================================
// PAGE 1: Cover
// =================================================================
const s1 = pptx.addSlide();
bg(s1);
s1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: T.accent },
});
addText(s1, "CLOUDFLARE ENTERPRISE", {
  x: 1.2, y: 1.8, w: 10, h: 0.35,
  fontFace: T.headEn, fontSize: 14, bold: true, color: T.accent, charSpacing: 2,
});
addText(s1, "账户级 Rate Limiting 三档配置原理", {
  x: 1.2, y: 2.2, w: 11, h: 0.8,
  fontFace: T.head, fontSize: 32, bold: true, color: T.ink,
});
addText(s1, "查询全过程 · 判断原理 · 部署建议 · Vistra Enterprise 实战", {
  x: 1.2, y: 3.1, w: 10, h: 0.4,
  fontFace: T.head, fontSize: 16, color: T.muted,
});
s1.addShape(pptx.ShapeType.line, {
  x: 1.2, y: 3.65, w: 3.5, h: 0, line: { color: T.accent, pt: 2 },
});
addText(s1, "Vistra Enterprise · 52 个 Enterprise Zone · 82 个总 Zone", {
  x: 1.2, y: 3.85, w: 10, h: 0.3,
  fontFace: T.headEn, fontSize: 12, color: T.muted,
});
addText(s1, "2026.08", {
  x: 1.2, y: 6.5, w: 4, h: 0.3,
  fontFace: T.headEn, fontSize: 11, color: T.muted,
});

// =================================================================
// PAGE 2: Query Process — 查询全过程
// =================================================================
const s2 = pptx.addSlide();
bg(s2); header(s2, "01 / 查询全过程", "如何获取 52 个 Zone 的流量数据？");
footer(s2, 2);

const { margin, accent, ink, muted, head, headEn, panelSoft, hairline, positive, risk, mono, accentLight, blue } = T;

// 4-step horizontal flow
const qSteps = [
  { x: 0.55, num: "1", title: "Token 验证", sub: "GET /user/tokens/verify\n确认只读权限\n0 破坏性操作", color: accent },
  { x: 3.65, num: "2", title: "拉取 Zone 列表", sub: "GET /zones?per_page=50\n分页获取全部 82 个 Zone\n筛选 52 个 Enterprise", color: blue },
  { x: 6.75, num: "3", title: "GraphQL 流量查询", sub: "POST /graphql\nhttpRequests1dGroups\n30 天请求量 + 独立访客", color: accentLight },
  { x: 9.85, num: "4", title: "提取 IP 列表", sub: "GET /accounts/{id}/rules/lists\n获取 17 个 IP List\n提取 7 个可信列表", color: positive },
];

for (const qs of qSteps) {
  s2.addShape(pptx.ShapeType.roundRect, {
    x: qs.x, y: 1.85, w: 2.85, h: 4.8, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: qs.color, pt: 1.5 },
  });
  // Number badge
  s2.addShape(pptx.ShapeType.ellipse, {
    x: qs.x + 1.05, y: 2.05, w: 0.55, h: 0.55, fill: { color: qs.color },
  });
  addText(s2, qs.num, {
    x: qs.x + 1.05, y: 2.08, w: 0.55, h: 0.5,
    fontFace: headEn, fontSize: 18, bold: true, color: "FFFFFF", align: "center",
  });
  addText(s2, qs.title, {
    x: qs.x + 0.15, y: 2.75, w: 2.55, h: 0.4,
    fontFace: head, fontSize: 15, bold: true, color: ink, align: "center",
  });
  addText(s2, qs.sub, {
    x: qs.x + 0.15, y: 3.3, w: 2.55, h: 1.5,
    fontFace: head, fontSize: 11, color: muted, align: "center", lineSpacingMultiple: 1.35,
  });
  // API method badge
  const method = qs.sub.split("\n")[0];
  s2.addShape(pptx.ShapeType.roundRect, {
    x: qs.x + 0.35, y: 5.0, w: 2.15, h: 0.35, rectRadius: 0.06,
    fill: { color: "FFFFFF" }, line: { color: qs.color, pt: 1 },
  });
  addText(s2, method, {
    x: qs.x + 0.35, y: 5.03, w: 2.15, h: 0.3,
    fontFace: mono, fontSize: 9, bold: true, color: qs.color, align: "center",
  });
}

// Arrows — positioned in gaps between cards (gap = 0.25")
for (let i = 0; i < 3; i++) {
  s2.addShape(pptx.ShapeType.rightArrow, {
    x: 3.42 + i * 3.1, y: 4.0, w: 0.21, h: 0.35, fill: { color: accent },
  });
}

// Bottom note
s2.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 6.35, w: 12.23, h: 0.6, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accent, pt: 1 },
});
addText(s2, "全部 5 步均为 GET / POST 只读请求 — 0 创建、0 修改、0 删除", {
  x: 0.75, y: 6.45, w: 12, h: 0.35,
  fontFace: head, fontSize: 12, bold: true, color: accent, align: "center",
});

// =================================================================
// PAGE 3: GraphQL Query Example (NEW — split from page 2)
// =================================================================
const s2g = pptx.addSlide();
bg(s2g); header(s2g, "01 / 查询全过程", "GraphQL 查询示例 — 30 天流量基线");
footer(s2g, 3);

// Left: GraphQL query
s2g.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 7.0, h: 4.85, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2g, "GraphQL Query", {
  x: 0.75, y: 1.95, w: 6, h: 0.3,
  fontFace: head, fontSize: 12, bold: true, color: "F5A623",
});
addText(s2g, [
  { text: 'query ZoneTraffic($accountTag: String!) {\n  viewer {\n    zones(filter: {\n      accountTag: $accountTag\n    }) {\n      httpRequests1dGroups(\n        limit: 10000\n        filter: {\n          date_geq: "2026-07-25"\n          date_leq: "2026-08-23"\n        }\n        orderBy: [sum_requests_DESC]\n      ) {\n        sum { requests }\n        uniq { visitors }\n        dimensions { zoneTag }\n      }\n    }\n  }\n}', options: { fontSize: 10, fontFace: mono, color: "FFFFFF" } },
], {
  x: 0.75, y: 2.35, w: 6.6, h: 4.2, lineSpacingMultiple: 1.2,
});

// Right: Response (enlarged)
s2g.addShape(pptx.ShapeType.roundRect, {
  x: 7.75, y: 1.85, w: 5.03, h: 3.75, rectRadius: 0.08,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1 },
});
addText(s2g, "Response (摘要)", {
  x: 7.95, y: 1.95, w: 4.6, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: positive,
});
addText(s2g, [
  { text: '{\n  "data": {\n    "viewer": {\n      "zones": [{\n        "httpRequests1dGroups": [{\n          "sum": {', options: { fontSize: 8, fontFace: mono, color: muted } },
  { text: '\n            "requests": 39787847', options: { fontSize: 8, fontFace: mono, color: accent, bold: true } },
  { text: '\n          },\n          "uniq": {', options: { fontSize: 8, fontFace: mono, color: muted } },
  { text: '\n            "visitors": 823588', options: { fontSize: 8, fontFace: mono, color: positive } },
  { text: '\n          },\n          "dimensions": {\n            "zoneTag": "a1b2..."\n          }\n        }]\n      }]\n    }\n  }\n}', options: { fontSize: 8, fontFace: mono, color: muted } },
], {
  x: 7.95, y: 2.3, w: 4.6, h: 3.2, lineSpacingMultiple: 1.15,
});

// Right bottom: analysis (two columns, compressed)
s2g.addShape(pptx.ShapeType.roundRect, {
  x: 7.75, y: 5.75, w: 5.03, h: 0.95, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s2g, "分析步骤", {
  x: 7.85, y: 5.8, w: 4.9, h: 0.25,
  fontFace: head, fontSize: 10, bold: true, color: accent,
});
// Left column: items 1-3
addText(s2g, "1. 一次查询全部 Zone\n2. requests DESC 排序\n3. 日均每分钟请求量", {
  x: 7.85, y: 6.1, w: 2.4, h: 0.55,
  fontFace: head, fontSize: 9, color: muted, lineSpacingMultiple: 1.2,
});
// Right column: items 4-6
addText(s2g, "4. P80/P30 切三档\n5. visitors 估算 P95\n6. 30 天窗口避波动", {
  x: 10.3, y: 6.1, w: 2.4, h: 0.55,
  fontFace: head, fontSize: 9, color: muted, lineSpacingMultiple: 1.2,
});

// =================================================================
// PAGE 4: API Call Step 1 — Token Verify
// =================================================================
const s2a = pptx.addSlide();
bg(s2a); header(s2a, "02 / API 调用 · Step 1", "Token 验证 — 确认只读权限");
footer(s2a, 4);

// Left column: curl command
s2a.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 5.9, h: 4.85, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2a, "$ curl", {
  x: 0.75, y: 2.0, w: 1.0, h: 0.3,
  fontFace: mono, fontSize: 11, bold: true, color: "F5A623",
});
addText(s2a, '\\\n  https://api.cloudflare.com\n  /client/v4/user/tokens/verify \\\n  -H "Authorization: Bearer\n      ${CF_API_TOKEN}" \\\n  -H "Content-Type: application/json"', {
  x: 1.7, y: 2.0, w: 4.5, h: 2.0,
  fontFace: mono, fontSize: 10, color: "E0E0E0", lineSpacingMultiple: 1.35,
});
// Left bottom: explanation
addText(s2a, "说明", {
  x: 0.75, y: 4.2, w: 5.5, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: "F5A623",
});
addText(s2a, "• /user/tokens/verify 是\n  Cloudflare Token 验证端点\n• 不消耗配额，不修改任何资源\n• 返回 Token 绑定的权限组\n• 用于确认只读权限", {
  x: 0.75, y: 4.55, w: 5.5, h: 2.0,
  fontFace: head, fontSize: 10, color: "E0E0E0", lineSpacingMultiple: 1.3,
});

// Right column: Response
s2a.addShape(pptx.ShapeType.roundRect, {
  x: 6.75, y: 1.85, w: 6.03, h: 4.85, rectRadius: 0.08,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1 },
});
addText(s2a, "Response (200 OK)", {
  x: 6.95, y: 1.95, w: 5, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: positive,
});
addText(s2a, [
  { text: '{\n  "result": {\n    "id": "ed1757...",\n    "status": "active",\n    "policies": [{\n      "effect": "allow",\n      "resources": {\n        "com.cloudflare.api.account": "*"\n      },\n      "permission_groups": [\n        {', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '"name": "Account Rulesets Read"', options: { fontSize: 9, fontFace: mono, color: ink, bold: true } },
  { text: '\n        },\n        {', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '"name": "Account Filter Lists Read"', options: { fontSize: 9, fontFace: mono, color: ink, bold: true } },
  { text: '\n        }\n      ]\n    }]\n  },\n  ', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '"success": true', options: { fontSize: 9, fontFace: mono, color: positive, bold: true } },
  { text: ', "errors": []\n}', options: { fontSize: 9, fontFace: mono, color: muted } },
], {
  x: 6.95, y: 2.35, w: 5.6, h: 4.2, lineSpacingMultiple: 1.25,
});

// Key takeaway
s2a.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 6.35, w: 12.23, h: 0.6, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accent, pt: 1 },
});
addText(s2a, "✓ Token 有效 | ✓ 只读权限确认 (Read) | ✓ 0 破坏性操作", {
  x: 0.75, y: 6.45, w: 12, h: 0.35,
  fontFace: head, fontSize: 12, bold: true, color: positive, align: "center",
});

// =================================================================
// PAGE 4: API Call Step 2 — List Zones
// =================================================================
const s2b = pptx.addSlide();
bg(s2b); header(s2b, "02 / API 调用 · Step 2", "拉取 Zone 列表 — 分页获取 82 个 Zone");
footer(s2b, 5);

// curl command
s2b.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 12.23, h: 1.7, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2b, "$ curl", {
  x: 0.75, y: 1.95, w: 1.0, h: 0.3,
  fontFace: mono, fontSize: 11, bold: true, color: "F5A623",
});
addText(s2b, '\\\n  "https://api.cloudflare.com/client/v4/zones?per_page=50&page=1" \\\n  -H "Authorization: Bearer ${CF_API_TOKEN}" \\\n  | jq \'.result[] | {name, id, plan:.plan.name, status}\'', {
  x: 1.7, y: 1.95, w: 11, h: 1.5,
  fontFace: mono, fontSize: 10, color: "E0E0E0", lineSpacingMultiple: 1.3,
});

// Response + jq filter
s2b.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 3.7, w: 6.0, h: 3.0, rectRadius: 0.08,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1 },
});
addText(s2b, "Response (jq 过滤后)", {
  x: 0.75, y: 3.8, w: 5, h: 0.3,
  fontFace: head, fontSize: 10, bold: true, color: positive,
});
addText(s2b, [
  { text: '{\n  "name": "www.vistra.com",\n  "id": "a1b2c3d4...",\n  "plan": ', options: { fontSize: 8, fontFace: mono, color: muted } },
  { text: '"Enterprise Website"', options: { fontSize: 8, fontFace: mono, color: accent, bold: true } },
  { text: ',\n  "status": "active"\n}\n{\n  "name": "vistra.com",\n  "id": "e5f6g7h8...",\n  "plan": ', options: { fontSize: 8, fontFace: mono, color: muted } },
  { text: '"Enterprise Website"', options: { fontSize: 8, fontFace: mono, color: accent, bold: true } },
  { text: ',\n  "status": "active"\n}\n... (共 82 个 Zone)', options: { fontSize: 8, fontFace: mono, color: muted } },
], {
  x: 0.75, y: 4.15, w: 5.7, h: 2.4, lineSpacingMultiple: 1.15,
});

// jq filter logic
s2b.addShape(pptx.ShapeType.roundRect, {
  x: 6.75, y: 3.7, w: 6.03, h: 3.0, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s2b, "筛选 Enterprise Zone", {
  x: 6.95, y: 3.8, w: 5, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: accent,
});
addText(s2b, [
  { text: '# 分页拉取全部 82 个 Zone\n', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: 'page=1 → 50 zones\npage=2 → 32 zones\n\n', options: { fontSize: 9, fontFace: mono, color: ink } },
  { text: '# 筛选 Enterprise\n', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '| jq \'.[] | select(.plan.name\n  == "Enterprise Website")\'\n\n', options: { fontSize: 9, fontFace: mono, color: accent } },
  { text: '# 结果\n', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '54 active + 3 pending\n= ', options: { fontSize: 9, fontFace: mono, color: ink } },
  { text: '57 Enterprise Zone', options: { fontSize: 9, fontFace: mono, color: positive, bold: true } },
  { text: '\n28 Free Zone (不受影响)', options: { fontSize: 9, fontFace: mono, color: muted } },
], {
  x: 6.95, y: 4.15, w: 5.7, h: 2.4, lineSpacingMultiple: 1.2,
});

// =================================================================
// PAGE 5: API Call Step 3 — GraphQL Traffic Query
// =================================================================
const s2c = pptx.addSlide();
bg(s2c); header(s2c, "02 / API 调用 · Step 3", "GraphQL 流量查询 — 30 天请求量基线");
footer(s2c, 6);

// Full GraphQL query
s2c.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 7.0, h: 4.85, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2c, "$ curl -X POST https://api.cloudflare.com/client/v4/graphql \\", {
  x: 0.7, y: 1.95, w: 6.8, h: 0.25,
  fontFace: mono, fontSize: 8, color: "F5A623",
});
addText(s2c, [
  { text: '  -H "Authorization: Bearer ${TOKEN}" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"query":"\n', options: { fontSize: 8, fontFace: mono, color: "E0E0E0" } },
  { text: 'query ZoneTraffic($accountTag: String!) {\n  viewer {\n    zones(filter: {\n      accountTag: $accountTag\n    }) {\n      httpRequests1dGroups(\n        limit: 10000\n        filter: {\n          date_geq: \"2026-07-25\"\n          date_leq: \"2026-08-23\"\n        }\n        orderBy: [sum_requests_DESC]\n      ) {\n        sum { requests }\n        uniq { visitors }\n        dimensions { zoneTag }\n      }\n    }\n  }\n}', options: { fontSize: 8, fontFace: mono, color: "FFFFFF" } },
  { text: '\n"}"\'', options: { fontSize: 8, fontFace: mono, color: "E0E0E0" } },
], {
  x: 0.7, y: 2.25, w: 6.8, h: 4.3, lineSpacingMultiple: 1.15,
});

// Response (enlarged, like page 3)
s2c.addShape(pptx.ShapeType.roundRect, {
  x: 7.75, y: 1.85, w: 5.03, h: 3.75, rectRadius: 0.08,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1 },
});
addText(s2c, "Response (摘要)", {
  x: 7.95, y: 1.95, w: 4.6, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: positive,
});
addText(s2c, [
  { text: '{\n  "data": {\n    "viewer": {\n      "zones": [{\n        "httpRequests1dGroups": [{\n          "sum": {\n            ', options: { fontSize: 7, fontFace: mono, color: muted } },
  { text: '"requests": 39787847', options: { fontSize: 7, fontFace: mono, color: accent, bold: true } },
  { text: '\n          },\n          "uniq": {\n            ', options: { fontSize: 7, fontFace: mono, color: muted } },
  { text: '"visitors": 823588', options: { fontSize: 7, fontFace: mono, color: positive } },
  { text: '\n          },\n          "dimensions": {\n            "zoneTag": "a1b2..."\n          }\n        }]\n      }]\n    }\n  }\n}', options: { fontSize: 7, fontFace: mono, color: muted } },
], {
  x: 7.95, y: 2.3, w: 4.6, h: 3.2, lineSpacingMultiple: 1.15,
});

// Analysis (two columns, compressed)
s2c.addShape(pptx.ShapeType.roundRect, {
  x: 7.75, y: 5.75, w: 5.03, h: 0.95, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s2c, "分析步骤", {
  x: 7.85, y: 5.8, w: 4.9, h: 0.25,
  fontFace: head, fontSize: 10, bold: true, color: accent,
});
addText(s2c, "1. 一次查询全部 Zone\n2. requests DESC 排序\n3. 日均每分钟请求量", {
  x: 7.85, y: 6.1, w: 2.4, h: 0.55,
  fontFace: head, fontSize: 9, color: muted, lineSpacingMultiple: 1.2,
});
addText(s2c, "4. P80/P30 切三档\n5. visitors 估算 P95\n6. 30 天窗口避波动", {
  x: 10.3, y: 6.1, w: 2.4, h: 0.55,
  fontFace: head, fontSize: 9, color: muted, lineSpacingMultiple: 1.2,
});

// =================================================================
// PAGE 6: API Call Step 4-5 — Extract IP Lists + Check RL
// =================================================================
const s2d = pptx.addSlide();
bg(s2d); header(s2d, "02 / API 调用 · Step 4-5", "提取 IP 列表 + 检查现有 Rate Limiting");
footer(s2d, 7);

// Step 4: IP Lists — left column, full height
s2d.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 6.0, h: 4.85, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2d, "Step 4: 提取账户级 IP 列表", {
  x: 0.7, y: 1.95, w: 5, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: "F5A623",
});
addText(s2d, [
  { text: '$ curl "https://api.cloudflare.com/client/v4/\n  accounts/${CF_ACCOUNT_ID}/rules/lists" \\\n  -H "Authorization: Bearer ${TOKEN}" \\\n  | jq \'.result[] | select(.type=="ip")\n     | {name, id, num_items}\'', options: { fontSize: 9, fontFace: mono, color: "E0E0E0" } },
], {
  x: 0.7, y: 2.35, w: 5.7, h: 1.2, lineSpacingMultiple: 1.25,
});
addText(s2d, "Response (jq 过滤后)", {
  x: 0.7, y: 3.7, w: 5, h: 0.3,
  fontFace: head, fontSize: 10, bold: true, color: positive,
});
addText(s2d, [
  { text: '→ 返回 17 个 IP 列表\n→ 其中 7 个用于可信 IP 排除：\n\n  ', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: 'customer_whitelist          (60)\n  tricorridor_ip_allow_list  (44)\n  vistra_zscaler_sipa_ip      (7)\n  usm_prod_ip_list           (10)\n  allowed_maintenance_ips     (4)\n  vistra_aws_nat_ip           (3)\n  allowed_ips                  (2)', options: { fontSize: 9, fontFace: mono, color: accent } },
], {
  x: 0.7, y: 4.05, w: 5.7, h: 2.5, lineSpacingMultiple: 1.2,
});

// Step 5: Check RL — right column, full height
s2d.addShape(pptx.ShapeType.roundRect, {
  x: 6.75, y: 1.85, w: 6.03, h: 4.85, rectRadius: 0.08,
  fill: { color: "1A1A2E" }, line: { color: accent, pt: 1 },
});
addText(s2d, "Step 5: 检查现有 Rate Limiting", {
  x: 6.9, y: 1.95, w: 5, h: 0.3,
  fontFace: head, fontSize: 11, bold: true, color: "F5A623",
});
addText(s2d, [
  { text: '# 检查账户级 Entry Point\n$ curl "https://api.cloudflare.com/client/v4/\n  accounts/${ID}/rulesets/\n  phases/http_ratelimit/entrypoint" \\\n  -H "Authorization: Bearer ${TOKEN}"', options: { fontSize: 9, fontFace: mono, color: "E0E0E0" } },
], {
  x: 6.9, y: 2.35, w: 5.8, h: 1.2, lineSpacingMultiple: 1.25,
});
addText(s2d, "Response", {
  x: 6.9, y: 3.7, w: 5, h: 0.3,
  fontFace: head, fontSize: 10, bold: true, color: risk,
});
addText(s2d, [
  { text: 'HTTP ', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '404 Not Found', options: { fontSize: 9, fontFace: mono, color: risk, bold: true } },
  { text: '\n{\n  "result": null,\n  "message": "ruleset not found",\n  "success": false\n}\n\n', options: { fontSize: 9, fontFace: mono, color: muted } },
  { text: '→ 账户级 Rate Limiting\n  从未创建\n→ 需要从零开始部署\n→ 不会有冲突风险', options: { fontSize: 9, fontFace: mono, color: accent } },
], {
  x: 6.9, y: 4.05, w: 5.8, h: 2.5, lineSpacingMultiple: 1.2,
});

// Bottom note
s2d.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 6.35, w: 12.23, h: 0.6, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accent, pt: 1 },
});
addText(s2d, "Step 4-5 均为 GET 只读请求 — 获取现有配置，不创建任何 Ruleset 或 Rule", {
  x: 0.75, y: 6.45, w: 12, h: 0.35,
  fontFace: head, fontSize: 11, bold: true, color: accent, align: "center",
});

// =================================================================
// PAGE 8: Query Summary (NEW — split from page 6)
// =================================================================
const s2e = pptx.addSlide();
bg(s2e); header(s2e, "02 / API 调用 · 总结", "查询全过程总结");
footer(s2e, 8);

// Summary table — full page, larger rows
const apiSummary = [
  ["Step", "API 端点", "方法", "结果", "说明"],
  ["1", "/user/tokens/verify", "GET", "200 OK", "Token 只读权限确认"],
  ["2", "/zones?per_page=50", "GET", "82 Zone", "54 Enterprise + 28 Free"],
  ["3", "/graphql", "POST", "52 Zone 流量", "30 天请求量 + 访客数"],
  ["4", "/accounts/{id}/rules/lists", "GET", "17 个 IP 列表", "7 个可信列表 ≈130 IP"],
  ["5", "/accounts/{id}/rulesets/...", "GET", "404 Not Found", "账户级 RL 未配置"],
];

const sColW = [0.8, 3.7, 0.9, 2.5, 4.33];
const sX = [0.55, 1.35, 5.05, 5.95, 8.45];

// Header row
for (let i = 0; i < 5; i++) {
  s2e.addShape(pptx.ShapeType.rect, {
    x: sX[i], y: 1.85, w: sColW[i], h: 0.45,
    fill: { color: T.ink }, line: { color: T.ink, pt: 0.5 },
  });
  addText(s2e, apiSummary[0][i], {
    x: sX[i], y: 1.9, w: sColW[i], h: 0.35, align: "center",
    fontFace: head, fontSize: 11, bold: true, color: "FFFFFF",
  });
}

// Data rows
for (let r = 1; r < 6; r++) {
  const y = 2.3 + (r - 1) * 0.65;
  const isEven = r % 2 === 0;
  for (let c = 0; c < 5; c++) {
    s2e.addShape(pptx.ShapeType.rect, {
      x: sX[c], y, w: sColW[c], h: 0.65,
      fill: { color: isEven ? "FFFFFF" : panelSoft },
      line: { color: hairline, pt: 0.5 },
    });
    addText(s2e, apiSummary[r][c], {
      x: sX[c] + 0.1, y: y + 0.05, w: sColW[c] - 0.2, h: 0.55,
      fontFace: c === 1 ? mono : head,
      fontSize: c === 1 ? 9 : 11,
      bold: c === 0,
      color: c === 0 ? accent : (c === 3 && r === 5 ? risk : ink),
      align: c === 0 || c === 2 ? "center" : "left",
      valign: "middle", lineSpacingMultiple: 1.1,
    });
  }
}

// Bottom summary cards
const sumCards = [
  { x: 0.55, num: "5", label: "API 调用", color: accent },
  { x: 3.72, num: "82→52", label: "Zone (总→Enterprise)", color: accentLight },
  { x: 6.89, num: "17", label: "IP 列表 (7 可信)", color: blue },
  { x: 10.05, num: "0", label: "破坏性操作", color: positive },
];

for (const sc of sumCards) {
  s2e.addShape(pptx.ShapeType.roundRect, {
    x: sc.x, y: 5.85, w: 2.73, h: 1.1, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: sc.color, pt: 1.5 },
  });
  addText(s2e, sc.num, {
    x: sc.x + 0.1, y: 5.9, w: 2.53, h: 0.5,
    fontFace: headEn, fontSize: 24, bold: true, color: sc.color, align: "center",
  });
  addText(s2e, sc.label, {
    x: sc.x + 0.1, y: 6.42, w: 2.53, h: 0.35,
    fontFace: head, fontSize: 10, color: ink, align: "center",
  });
}

// =================================================================
// PAGE 9: Vistra Account Current State
// =================================================================
const s3 = pptx.addSlide();
bg(s3); header(s3, "03 / 账户现状", "Vistra 账户当前状态评估");
footer(s3, 9);

// Summary cards
const stateCards = [
  { x: 0.55, num: "82", label: "总 Zone 数", color: accent },
  { x: 3.72, num: "54", label: "Enterprise Zone", color: accentLight },
  { x: 6.89, num: "28", label: "Free Zone", color: muted },
  { x: 10.05, num: "17", label: "IP 列表", color: blue },
];

for (const sc of stateCards) {
  s3.addShape(pptx.ShapeType.roundRect, {
    x: sc.x, y: 1.85, w: 2.73, h: 1.5, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: sc.color, pt: 1.5 },
  });
  addText(s3, sc.num, {
    x: sc.x + 0.1, y: 1.95, w: 2.53, h: 0.7,
    fontFace: headEn, fontSize: 36, bold: true, color: sc.color, align: "center",
  });
  addText(s3, sc.label, {
    x: sc.x + 0.1, y: 2.7, w: 2.53, h: 0.4,
    fontFace: head, fontSize: 11, color: ink, align: "center",
  });
}

// Current RL state
s3.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 3.65, w: 6.0, h: 2.9, rectRadius: 0.1,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s3, "Rate Limiting 配置现状", {
  x: 0.75, y: 3.75, w: 5.5, h: 0.3,
  fontFace: head, fontSize: 13, bold: true, color: accent,
});

const rlStates = [
  { item: "账户级 http_ratelimit Entry Point", status: "不存在", color: risk },
  { item: "www.vistra.com Zone 级 RL", status: "未配置", color: risk },
  { item: "vistra.com Zone 级 RL", status: "未配置", color: risk },
  { item: "osc.vistra.com Zone 级 RL", status: "未配置", color: risk },
  { item: "myformations.vistra.com Zone 级 RL", status: "未配置", color: risk },
  { item: "tricorglobal.com Zone 级 RL", status: "未配置", color: risk },
];

for (let i = 0; i < rlStates.length; i++) {
  const y = 4.1 + i * 0.38;
  s3.addShape(pptx.ShapeType.rect, {
    x: 0.75, y, w: 5.6, h: 0.33,
    fill: { color: i % 2 === 0 ? panelSoft : "FFFFFF" }, line: { color: hairline, pt: 0.5 },
  });
  addText(s3, rlStates[i].item, {
    x: 0.85, y: y + 0.02, w: 3.8, h: 0.28,
    fontFace: head, fontSize: 10, color: muted,
  });
  addText(s3, `✗ ${rlStates[i].status}`, {
    x: 4.65, y: y + 0.02, w: 1.6, h: 0.28,
    fontFace: head, fontSize: 10, bold: true, color: rlStates[i].color, align: "right",
  });
}

// IP lists summary
s3.addShape(pptx.ShapeType.roundRect, {
  x: 6.75, y: 3.65, w: 6.03, h: 2.9, rectRadius: 0.1,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s3, "可信 IP 列表（7 个关键列表）", {
  x: 6.95, y: 3.75, w: 5.5, h: 0.3,
  fontFace: head, fontSize: 13, bold: true, color: accent,
});

const ipSummary = [
  ["customer_whitelist", "60 条", "客户/办公网"],
  ["tricorridor_ip_allow_list", "44 条", "业务允许"],
  ["vistra_zscaler_sipa_ip", "7 条", "Zscaler 代理"],
  ["usm_prod_ip_list", "10 条", "USM 生产"],
  ["allowed_maintenance_ips", "4 条", "维护窗口"],
  ["vistra_aws_nat_ip", "3 条", "AWS NAT"],
  ["allowed_ips", "2 条", "通用允许"],
];

for (let i = 0; i < ipSummary.length; i++) {
  const y = 4.1 + i * 0.33;
  s3.addShape(pptx.ShapeType.rect, {
    x: 6.95, y, w: 5.63, h: 0.28,
    fill: { color: i % 2 === 0 ? "FFFFFF" : panelSoft }, line: { color: hairline, pt: 0.5 },
  });
  addText(s3, ipSummary[i][0], {
    x: 7.05, y: y + 0.01, w: 2.8, h: 0.25,
    fontFace: mono, fontSize: 9, bold: true, color: accent,
  });
  addText(s3, ipSummary[i][1], {
    x: 9.85, y: y + 0.01, w: 1.0, h: 0.25,
    fontFace: headEn, fontSize: 10, color: ink, align: "center",
  });
  addText(s3, ipSummary[i][2], {
    x: 10.85, y: y + 0.01, w: 1.6, h: 0.25,
    fontFace: head, fontSize: 9, color: muted,
  });
}

// =================================================================
// PAGE 4: What is Account-Level Rate Limiting
// =================================================================
const s4 = pptx.addSlide();
bg(s4); header(s4, "04 / 基础概念", "什么是账户级 Rate Limiting？");
footer(s4, 10);

// Left: Before (Zone-by-Zone)
s4.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 5.5, h: 2.2, rectRadius: 0.1,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1 },
});
addText(s4, "❌ 逐 Zone 配置（旧方式）", {
  x: 0.8, y: 1.95, w: 5, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: risk,
});
addText(s4, "• 每个 Zone 单独创建 Rate Limiting Rule\n• 52 个 Enterprise Zone = 52 次操作\n• 改阈值需逐 Zone 修改\n• 无法统一管理", {
  x: 0.8, y: 2.4, w: 5, h: 1.5,
  fontFace: head, fontSize: 12, color: muted, lineSpacingMultiple: 1.3,
});

// Right: After (Account-Level)
s4.addShape(pptx.ShapeType.roundRect, {
  x: 7.0, y: 1.85, w: 5.78, h: 2.2, rectRadius: 0.1,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s4, "✅ 账户级统一配置（推荐）", {
  x: 7.25, y: 1.95, w: 5.3, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: positive,
});
addText(s4, "• 创建 3 个 Ruleset（High / Medium / Low）\n• 部署 3 条 Execute Rule 按 Zone 分流\n• 52 个 Zone 一次覆盖\n• 改阈值只改 1 处", {
  x: 7.25, y: 2.4, w: 5.3, h: 1.5,
  fontFace: head, fontSize: 12, color: ink, lineSpacingMultiple: 1.3,
});

// Bottom: Architecture
s4.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 4.3, w: 12.23, h: 2.4, rectRadius: 0.1,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s4, "两层架构", {
  x: 0.8, y: 4.4, w: 4, h: 0.3,
  fontFace: head, fontSize: 13, bold: true, color: accent,
});

s4.addShape(pptx.ShapeType.roundRect, {
  x: 0.8, y: 4.8, w: 5.5, h: 1.5, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1 },
});
addText(s4, "Layer 1: Entry Point Ruleset", {
  x: 1.0, y: 4.9, w: 5, h: 0.3,
  fontFace: head, fontSize: 12, bold: true, color: ink,
});
addText(s4, '3 条 Execute Rule\nexpression: cf.zone.name in {…}\n→ 按 Zone 名称分流到对应 Ruleset', {
  x: 1.0, y: 5.22, w: 5, h: 0.9,
  fontFace: head, fontSize: 11, color: muted, lineSpacingMultiple: 1.25,
});

s4.addShape(pptx.ShapeType.rightArrow, {
  x: 6.4, y: 5.3, w: 0.6, h: 0.4, fill: { color: accent },
});

s4.addShape(pptx.ShapeType.roundRect, {
  x: 7.1, y: 4.8, w: 1.7, h: 1.5, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accentLight, pt: 1 },
});
addText(s4, "HIGH\nRuleset", {
  x: 7.15, y: 5.1, w: 1.6, h: 0.8, align: "center",
  fontFace: head, fontSize: 11, bold: true, color: accent,
});

s4.addShape(pptx.ShapeType.roundRect, {
  x: 8.95, y: 4.8, w: 1.7, h: 1.5, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accentLight, pt: 1 },
});
addText(s4, "MEDIUM\nRuleset", {
  x: 9.0, y: 5.1, w: 1.6, h: 0.8, align: "center",
  fontFace: head, fontSize: 11, bold: true, color: accent,
});

s4.addShape(pptx.ShapeType.roundRect, {
  x: 10.8, y: 4.8, w: 1.7, h: 1.5, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accentLight, pt: 1 },
});
addText(s4, "LOW\nRuleset", {
  x: 10.85, y: 5.1, w: 1.6, h: 0.8, align: "center",
  fontFace: head, fontSize: 11, bold: true, color: accent,
});

// =================================================================
// PAGE 5: Request Flow (4 Steps)
// =================================================================
const s5 = pptx.addSlide();
bg(s5); header(s5, "05 / 请求路径", "一个请求经过的 4 个步骤");
footer(s5, 11);

const steps = [
  { x: 0.55, title: "STEP 1\n分流", sub: "Entry Point\n检查 Zone 名称\n匹配 Execute Rule", color: accent },
  { x: 3.65, title: "STEP 2\n排除", sub: "检查 source IP\n在可信 IP 列表?\n可信 → 放行", color: blue },
  { x: 6.75, title: "STEP 3\n计数", sub: "按 characteristics\n维度建桶计数\n(IP / Colo / UA)", color: accentLight },
  { x: 9.85, title: "STEP 4\n判定", sub: "桶内请求量\n超过阈值?\n→ Block / Challenge", color: positive },
];

for (const step of steps) {
  s5.addShape(pptx.ShapeType.roundRect, {
    x: step.x, y: 2.0, w: 2.85, h: 2.2, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: step.color, pt: 1.5 },
  });
  addText(s5, step.title, {
    x: step.x + 0.15, y: 2.15, w: 2.55, h: 0.7,
    fontFace: head, fontSize: 14, bold: true, color: step.color, align: "center",
  });
  addText(s5, step.sub, {
    x: step.x + 0.15, y: 2.85, w: 2.55, h: 1.2,
    fontFace: head, fontSize: 11, color: muted, align: "center", lineSpacingMultiple: 1.3,
  });
}

for (let i = 0; i < 3; i++) {
  s5.addShape(pptx.ShapeType.rightArrow, {
    x: 3.15 + i * 3.1, y: 2.9, w: 0.4, h: 0.35,
    fill: { color: accent },
  });
}

addText(s5, "示例：用户 203.0.113.5 访问 www.vistra.com", {
  x: margin, y: 4.5, w: 12, h: 0.35,
  fontFace: head, fontSize: 13, bold: true, color: ink,
});

const exSteps = [
  { x: 0.55, t: "Zone = www.vistra.com\n→ 匹配 High Execute Rule" },
  { x: 3.65, t: "IP 203.0.113.5\n不在 $customer_whitelist\n→ 需计数" },
  { x: 6.75, t: "桶: {IP, HKG, Chrome}\n当前计数: 1520" },
  { x: 9.85, t: "1520 > 1500 阈值\n→ Block 429" },
];
for (const ex of exSteps) {
  s5.addShape(pptx.ShapeType.roundRect, {
    x: ex.x, y: 4.95, w: 2.85, h: 1.5, rectRadius: 0.08,
    fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
  });
  addText(s5, ex.t, {
    x: ex.x + 0.12, y: 5.08, w: 2.6, h: 1.25,
    fontFace: head, fontSize: 10, color: ink, align: "center", lineSpacingMultiple: 1.25,
  });
}

// =================================================================
// PAGE 6: Three Profile Parameters
// =================================================================
const s6 = pptx.addSlide();
bg(s6); header(s6, "06 / 三档配置", "三档 Profile 参数对照");
footer(s6, 12);

const tHeaders = ["参数", "HIGH", "MEDIUM", "LOW"];
const tColW = [2.5, 3.3, 3.3, 3.3];
const tX = [0.55, 3.05, 6.35, 9.65];

for (let i = 0; i < 4; i++) {
  s6.addShape(pptx.ShapeType.rect, {
    x: tX[i], y: 1.85, w: tColW[i], h: 0.5,
    fill: { color: i === 0 ? T.ink : T.accent }, line: { color: T.ink, pt: 0.5 },
  });
  addText(s6, tHeaders[i], {
    x: tX[i], y: 1.9, w: tColW[i], h: 0.4, align: "center",
    fontFace: head, fontSize: 12, bold: true, color: "FFFFFF",
  });
}

const rows = [
  ["适用 Zone", "Top 20% 高流量", "P30-P80 中流量", "P30 以下低流量"],
  ["Zone 数量", "10 个", "26 个", "16 个"],
  ["expression", "not ip.src in\n$customer_whitelist", "not ip.src in\n$customer_whitelist", "true\n（无排除）"],
  ["characteristics", '["ip.src"\n"cf.colo.id"\n"UA"]', '["ip.src"\n"cf.colo.id"]', '["ip.src"]'],
  ["阈值 (req/min)", "1500", "500", "200"],
  ["action", "block (429)", "block (429)", "challenge"],
  ["mitigation_timeout", "120s", "300s", "600s"],
  ["额外排除 IP", "$vistra_zscaler\n$aws_nat_ip\n$allowed_maint", "$aws_nat_ip", "无"],
];

for (let r = 0; r < rows.length; r++) {
  const y = 2.35 + r * 0.55;
  const isEven = r % 2 === 0;
  for (let c = 0; c < 4; c++) {
    s6.addShape(pptx.ShapeType.rect, {
      x: tX[c], y, w: tColW[c], h: 0.55,
      fill: { color: isEven ? "FFFFFF" : panelSoft },
      line: { color: hairline, pt: 0.5 },
    });
    const txt = rows[r][c];
    addText(s6, txt, {
      x: tX[c] + 0.1, y: y + 0.02, w: tColW[c] - 0.2, h: 0.5,
      fontFace: c === 0 ? head : (txt.includes("[") || txt.includes("$") ? mono : head),
      fontSize: c === 0 ? 11 : (txt.includes("[") || txt.includes("$") ? 10 : 11),
      bold: c === 0,
      color: c === 0 ? ink : muted,
      align: "center", valign: "middle", lineSpacingMultiple: 1.1,
    });
  }
}

// =================================================================
// PAGE 7: Counter Bucket Principle (Low vs Medium)
// =================================================================
const s7 = pptx.addSlide();
bg(s7); header(s7, "07 / 计数器分桶", "Low Profile：1 个 IP = 1 个桶");
footer(s7, 13);

s7.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 5.5, h: 4.8, rectRadius: 0.1,
  fill: { color: panelSoft }, line: { color: accentLight, pt: 1.5 },
});
addText(s7, 'LOW — 维度: ["ip.src"]', {
  x: 0.75, y: 1.95, w: 5, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: accent,
});

s7.addShape(pptx.ShapeType.roundRect, {
  x: 0.75, y: 2.5, w: 5.1, h: 1.4, rectRadius: 0.08,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s7, "桶 A: IP 203.0.113.5", {
  x: 0.9, y: 2.6, w: 4.8, h: 0.3,
  fontFace: mono, fontSize: 12, bold: true, color: ink,
});
addText(s7, "█████████░░░░░░░ 50 / 200", {
  x: 0.9, y: 2.95, w: 4.8, h: 0.3,
  fontFace: mono, fontSize: 13, color: positive,
});
addText(s7, "→ 同一 IP 的所有请求都进这个桶", {
  x: 0.9, y: 3.35, w: 4.8, h: 0.3,
  fontFace: head, fontSize: 11, color: muted,
});

addText(s7, "特点：", {
  x: 0.75, y: 4.1, w: 5, h: 0.3,
  fontFace: head, fontSize: 12, bold: true, color: ink,
});
addText(s7, "• 桶数 = 活跃 IP 数\n• 每个桶累积所有请求（不分数据中心）\n• 阈值低 (200) 因为桶大\n• 优点：简单有效\n• 缺点：换 IP 即可绕过\n• 适合：低流量静态站", {
  x: 0.75, y: 4.4, w: 5, h: 2,
  fontFace: head, fontSize: 11, color: muted, lineSpacingMultiple: 1.35,
});

s7.addShape(pptx.ShapeType.roundRect, {
  x: 6.3, y: 1.85, w: 6.48, h: 4.8, rectRadius: 0.1,
  fill: { color: "F8F8F8" }, line: { color: hairline, pt: 1.5 },
});
addText(s7, 'MEDIUM — 维度: ["ip.src", "cf.colo.id"]', {
  x: 6.5, y: 1.95, w: 6, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: blue,
});

s7.addShape(pptx.ShapeType.roundRect, {
  x: 6.5, y: 2.5, w: 2.9, h: 1.0, rectRadius: 0.06,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s7, "桶 A1: 203.0.113.5\n@ HKG", {
  x: 6.6, y: 2.58, w: 2.7, h: 0.5,
  fontFace: mono, fontSize: 11, bold: true, color: ink, align: "center",
});
addText(s7, "██░░░░░ 20", {
  x: 6.6, y: 3.05, w: 2.7, h: 0.3,
  fontFace: mono, fontSize: 13, color: positive, align: "center",
});

s7.addShape(pptx.ShapeType.roundRect, {
  x: 9.55, y: 2.5, w: 2.9, h: 1.0, rectRadius: 0.06,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s7, "桶 A2: 203.0.113.5\n@ SIN", {
  x: 9.65, y: 2.58, w: 2.7, h: 0.5,
  fontFace: mono, fontSize: 11, bold: true, color: ink, align: "center",
});
addText(s7, "█░░░░░░ 10", {
  x: 9.65, y: 3.05, w: 2.7, h: 0.3,
  fontFace: mono, fontSize: 13, color: positive, align: "center",
});

s7.addShape(pptx.ShapeType.roundRect, {
  x: 6.5, y: 3.65, w: 2.9, h: 1.0, rectRadius: 0.06,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s7, "桶 B1: 198.51.100.8\n@ HKG", {
  x: 6.6, y: 3.73, w: 2.7, h: 0.5,
  fontFace: mono, fontSize: 11, bold: true, color: ink, align: "center",
});
addText(s7, "██░░░░░ 15", {
  x: 6.6, y: 4.2, w: 2.7, h: 0.3,
  fontFace: mono, fontSize: 13, color: positive, align: "center",
});

addText(s7, "特点：", {
  x: 6.5, y: 4.85, w: 5, h: 0.3,
  fontFace: head, fontSize: 12, bold: true, color: ink,
});
addText(s7, "• 同一 IP 从不同数据中心访问\n  各数据中心独立计数\n• 桶数 = IP × Colo\n• 阈值中 (500) 因为桶更多\n• 优点：防单 POP 洪泛\n• 适合：中流量业务站", {
  x: 6.5, y: 5.15, w: 6, h: 1.4,
  fontFace: head, fontSize: 11, color: muted, lineSpacingMultiple: 1.35,
});

// =================================================================
// PAGE 8: Counter Bucket Principle (High)
// =================================================================
const s8 = pptx.addSlide();
bg(s8); header(s8, "07 / 计数器分桶", "High Profile：IP × Colo × UA = N×M 个桶");
footer(s8, 14);

s8.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 12.23, h: 4.8, rectRadius: 0.1,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s8, 'HIGH — 维度: ["ip.src", "cf.colo.id", "http.request.headers["user-agent"]"]', {
  x: 0.75, y: 1.95, w: 12, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: accent,
});

const buckets = [
  { x: 0.75, ip: "203.0.113.5", colo: "HKG", ua: "Chrome", count: 20 },
  { x: 3.8, ip: "203.0.113.5", colo: "HKG", ua: "bot/2.0", count: 8 },
  { x: 6.85, ip: "203.0.113.5", colo: "SIN", ua: "Chrome", count: 15 },
  { x: 9.9, ip: "198.51.100.8", colo: "HKG", ua: "curl/8.0", count: 5 },
];

for (const b of buckets) {
  s8.addShape(pptx.ShapeType.roundRect, {
    x: b.x, y: 2.5, w: 2.85, h: 1.4, rectRadius: 0.08,
    fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
  });
  addText(s8, `${b.ip}`, {
    x: b.x + 0.1, y: 2.6, w: 2.65, h: 0.25,
    fontFace: mono, fontSize: 11, bold: true, color: ink, align: "center",
  });
  addText(s8, `@ ${b.colo} · UA: ${b.ua}`, {
    x: b.x + 0.1, y: 2.88, w: 2.65, h: 0.25,
    fontFace: mono, fontSize: 10, color: muted, align: "center",
  });
  const bar = "█".repeat(Math.ceil(b.count / 5)) + "░".repeat(14 - Math.ceil(b.count / 5));
  addText(s8, `${bar} ${b.count}`, {
    x: b.x + 0.1, y: 3.2, w: 2.65, h: 0.3,
    fontFace: mono, fontSize: 12, color: positive, align: "center",
  });
  addText(s8, "同一 IP 换 UA = 新桶", {
    x: b.x + 0.1, y: 3.5, w: 2.65, h: 0.25,
    fontFace: head, fontSize: 9, color: muted, align: "center",
  });
}

s8.addShape(pptx.ShapeType.roundRect, {
  x: 0.75, y: 4.15, w: 11.83, h: 2.3, rectRadius: 0.08,
  fill: { color: "FFFFFF" }, line: { color: accent, pt: 1 },
});
addText(s8, "关键洞察", {
  x: 0.95, y: 4.25, w: 5, h: 0.3,
  fontFace: head, fontSize: 13, bold: true, color: accent,
});
addText(s8, "• 桶数 = IP × Colo × UA → 桶最多，每个桶分到的请求最少\n• 爬虫换 UA 访问 → 每个 UA 只有少量请求 → 无法累积到阈值\n• 阈值最高 (1500) 因为需要更激进的请求量才会触发\n• 每个桶独立计数，不会跨桶合并", {
  x: 0.95, y: 4.6, w: 11.4, h: 1.7,
  fontFace: head, fontSize: 12, color: ink, lineSpacingMultiple: 1.4,
});

// =================================================================
// PAGE 9: Why More Dimensions = Higher Threshold
// =================================================================
const s9 = pptx.addSlide();
bg(s9); header(s9, "08 / 阈值逻辑", "为什么维度越多，阈值要越高？");
footer(s9, 15);

const dHeaders = ["Profile", "维度", "同一 IP 产生几个桶", "桶大小", "阈值"];
const dCols = [0.55, 3.7, 7.2, 9.8, 11.8];
const dWidths = [3.15, 3.5, 2.6, 2.0, 1.48];

for (let i = 0; i < 5; i++) {
  s9.addShape(pptx.ShapeType.rect, {
    x: dCols[i], y: 1.85, w: dWidths[i], h: 0.5,
    fill: { color: i === 0 ? T.ink : T.accent }, line: { color: T.ink, pt: 0.5 },
  });
  addText(s9, dHeaders[i], {
    x: dCols[i], y: 1.9, w: dWidths[i], h: 0.4, align: "center",
    fontFace: head, fontSize: 11, bold: true, color: "FFFFFF",
  });
}

const dRows = [
  ["LOW", '["ip.src"]', "1 个桶", "大（所有请求进同一桶）", "200"],
  ["MEDIUM", '["ip.src"\n"cf.colo.id"]', "≈3-5 个桶", "中（按数据中心分散）", "500"],
  ["HIGH", '["ip.src"\n"cf.colo.id"\n"UA"]', "≈10-20 个桶", "小（按 UA 再分散）", "1500"],
];

for (let r = 0; r < 3; r++) {
  const y = 2.35 + r * 1.0;
  for (let c = 0; c < 5; c++) {
    s9.addShape(pptx.ShapeType.rect, {
      x: dCols[c], y, w: dWidths[c], h: 1.0,
      fill: { color: r % 2 === 0 ? "FFFFFF" : panelSoft },
      line: { color: hairline, pt: 0.5 },
    });
    addText(s9, dRows[r][c], {
      x: dCols[c] + 0.1, y: y + 0.05, w: dWidths[c] - 0.2, h: 0.9,
      fontFace: c === 1 ? mono : head,
      fontSize: c === 1 ? 10 : 11,
      bold: c === 0,
      color: c === 0 ? accent : ink,
      align: "center", valign: "middle", lineSpacingMultiple: 1.2,
    });
  }
}

s9.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 5.55, w: 12.23, h: 1.1, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1 },
});
addText(s9, "核心公式：T_final = T₀ × max(1, log₂(G_attack_dims) × β)", {
  x: 0.75, y: 5.65, w: 12, h: 0.35,
  fontFace: mono, fontSize: 13, bold: true, color: accent,
});
addText(s9, "T₀ = P95 峰值 × 安全系数 | G = 攻击面维度基数空间 | β = 保守系数 (0.1~0.3)", {
  x: 0.75, y: 6.05, w: 12, h: 0.3,
  fontFace: head, fontSize: 11, color: muted,
});

// =================================================================
// PAGE 10: IP Exclusion Principle
// =================================================================
const s10 = pptx.addSlide();
bg(s10); header(s10, "09 / IP 排除", "可信 IP 如何跳过计数器？");
footer(s10, 16);

s10.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 5.8, h: 4.8, rectRadius: 0.1,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s10, "收费站类比", {
  x: 0.75, y: 1.95, w: 5, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: accent,
});
addText(s10, "想象一个停车场收费站——", {
  x: 0.75, y: 2.4, w: 5.3, h: 0.3,
  fontFace: head, fontSize: 12, color: ink,
});
addText(s10, "• LOW：只按车牌识别\n  → 所有入口的进出算在一起\n  → 限额低 (200)\n\n• MEDIUM：车牌 + 收费站位置\n  → 不同入口分别计数\n  → 限额中 (500)\n\n• HIGH：车牌 + 入口 + 车型\n  → 换拖挂就不累积\n  → 限额高 (1500)\n\nIP 排除 = 对已登记车辆直接放行\n（不进计数器，不会误触发）", {
  x: 0.75, y: 2.8, w: 5.3, h: 3.6,
  fontFace: head, fontSize: 11, color: muted, lineSpacingMultiple: 1.3,
});

s10.addShape(pptx.ShapeType.roundRect, {
  x: 6.5, y: 1.85, w: 6.28, h: 4.8, rectRadius: 0.1,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1.5 },
});
addText(s10, "Vistra 实际可信 IP 列表", {
  x: 6.7, y: 1.95, w: 6, h: 0.35,
  fontFace: head, fontSize: 14, bold: true, color: ink,
});

const ipLists = [
  ["customer_whitelist", "60", "客户/办公网白名单"],
  ["tricorridor_ip_allow_list", "44", "业务允许列表"],
  ["vistra_zscaler_sipa_ip", "7", "Zscaler 安全代理"],
  ["usm_prod_ip_list", "10", "USM 生产环境"],
  ["allowed_maintenance_ips", "4", "维护窗口 IP"],
  ["vistra_aws_nat_ip", "3", "AWS NAT 网关"],
  ["allowed_ips", "2", "通用允许 IP"],
];

for (let i = 0; i < ipLists.length; i++) {
  const y = 2.45 + i * 0.55;
  s10.addShape(pptx.ShapeType.rect, {
    x: 6.7, y, w: 5.88, h: 0.5,
    fill: { color: i % 2 === 0 ? panelSoft : "FFFFFF" },
    line: { color: hairline, pt: 0.5 },
  });
  addText(s10, ipLists[i][0], {
    x: 6.8, y: y + 0.03, w: 3.2, h: 0.4,
    fontFace: mono, fontSize: 10, bold: true, color: accent,
  });
  addText(s10, `${ipLists[i][1]} 条`, {
    x: 10.0, y: y + 0.03, w: 1.0, h: 0.4,
    fontFace: headEn, fontSize: 11, color: ink, align: "center",
  });
  addText(s10, ipLists[i][2], {
    x: 11.0, y: y + 0.03, w: 1.5, h: 0.4,
    fontFace: head, fontSize: 9, color: muted,
  });
}

addText(s10, "合计 ≈ 130 个 IP/CIDR 将被排除", {
  x: 6.7, y: 6.2, w: 5.8, h: 0.3,
  fontFace: head, fontSize: 12, bold: true, color: accent,
});

// =================================================================
// PAGE 11: Zone Classification (P80/P30) Bar Chart
// =================================================================
const s11 = pptx.addSlide();
bg(s11); header(s11, "10 / Zone 分档", "52 个 Enterprise Zone 按流量分档");
footer(s11, 17);

addText(s11, "30 天总请求量排名（Top 20 示意）", {
  x: margin, y: 1.8, w: 12, h: 0.3,
  fontFace: head, fontSize: 12, color: muted,
});

const zones = [
  { name: "www.vistra.com", req: 39787, tier: "H" },
  { name: "vistra.com", req: 35788, tier: "H" },
  { name: "myformations", req: 21895, tier: "H" },
  { name: "osc.vistra.com", req: 20951, tier: "H" },
  { name: "orisoftsaas", req: 17311, tier: "H" },
  { name: "iipaysp.com", req: 13796, tier: "H" },
  { name: "tricorglobal", req: 10376, tier: "H" },
  { name: "tricoreportal", req: 7275, tier: "H" },
  { name: "ioikorea.com", req: 6925, tier: "H" },
  { name: "unifyhrs.com", req: 6509, tier: "H" },
  { name: "vistra.com.cn", req: 4633, tier: "M" },
  { name: "star.vistra", req: 3638, tier: "M" },
  { name: "tricorbpo", req: 3838, tier: "M" },
  { name: "vistraitcl", req: 2269, tier: "M" },
  { name: "iipay.com", req: 2141, tier: "M" },
  { name: "srmy.vistra", req: 2018, tier: "M" },
  { name: "prodv4", req: 245, tier: "L" },
  { name: "prodv3", req: 79, tier: "L" },
  { name: "eshareholder", req: 12, tier: "L" },
  { name: "onepayroll", req: 0.2, tier: "L" },
];

const maxReq = 39787;
const barAreaX = 3.2;
const barAreaW = 8.5;
const barH = 0.24;
const barGap = 0.08;

for (let i = 0; i < zones.length; i++) {
  const y = 2.2 + i * (barH + barGap);
  const w = (zones[i].req / maxReq) * barAreaW;
  const color = zones[i].tier === "H" ? accent : (zones[i].tier === "M" ? accentLight : muted);

  addText(s11, zones[i].name, {
    x: margin, y, w: 2.6, h: barH,
    fontFace: head, fontSize: 9, color: ink, align: "right",
  });
  s11.addShape(pptx.ShapeType.rect, {
    x: barAreaX, y, w: Math.max(w, 0.05), h: barH,
    fill: { color }, line: { color, pt: 0 },
  });
  if (zones[i].req >= 1) {
    addText(s11, `${(zones[i].req / 1000).toFixed(1)}M`, {
      x: barAreaX + w + 0.1, y, w: 1.5, h: barH,
      fontFace: headEn, fontSize: 9, color: muted,
    });
  }
}

addText(s11, "High (10)", { x: 0.55, y: 2.2, w: 2.5, h: 0.2, fontFace: head, fontSize: 9, bold: true, color: accent, align: "right" });
addText(s11, "Medium (26)", { x: 0.55, y: 2.2 + 10 * (barH + barGap), w: 2.5, h: 0.2, fontFace: head, fontSize: 9, bold: true, color: accentLight, align: "right" });
addText(s11, "Low (16)", { x: 0.55, y: 2.2 + 16 * (barH + barGap), w: 2.5, h: 0.2, fontFace: head, fontSize: 9, bold: true, color: muted, align: "right" });

// =================================================================
// PAGE 12: Full 52 Zone Data Table
// =================================================================
const s12 = pptx.addSlide();
bg(s12); header(s12, "11 / 完整数据", "52 个 Enterprise Zone 完整流量表");
footer(s12, 18);

// Two-column table: left 26, right 26
const colXs = [0.55, 6.95];
const colW = 6.0;
const rowH = 0.175;

// Column headers
for (let ci = 0; ci < 2; ci++) {
  const cx = colXs[ci];
  s12.addShape(pptx.ShapeType.rect, { x: cx, y: 1.8, w: 0.4, h: 0.28, fill: { color: T.ink } });
  addText(s12, "#", { x: cx, y: 1.83, w: 0.4, h: 0.25, fontFace: headEn, fontSize: 8, bold: true, color: "FFFFFF", align: "center" });
  s12.addShape(pptx.ShapeType.rect, { x: cx + 0.4, y: 1.8, w: 3.4, h: 0.28, fill: { color: T.ink } });
  addText(s12, "Zone", { x: cx + 0.4, y: 1.83, w: 3.4, h: 0.25, fontFace: head, fontSize: 8, bold: true, color: "FFFFFF", align: "center" });
  s12.addShape(pptx.ShapeType.rect, { x: cx + 3.8, y: 1.8, w: 1.3, h: 0.28, fill: { color: T.ink } });
  addText(s12, "30天请求", { x: cx + 3.8, y: 1.83, w: 1.3, h: 0.25, fontFace: head, fontSize: 8, bold: true, color: "FFFFFF", align: "center" });
  s12.addShape(pptx.ShapeType.rect, { x: cx + 5.1, y: 1.8, w: 0.9, h: 0.28, fill: { color: T.ink } });
  addText(s12, "档", { x: cx + 5.1, y: 1.83, w: 0.9, h: 0.25, fontFace: head, fontSize: 8, bold: true, color: "FFFFFF", align: "center" });
}

const allZones = [
  ["www.vistra.com", "39.8M", "H"], ["vistra.com.cn", "4.6M", "M"],
  ["vistra.com", "35.8M", "H"], ["tricorbpo.com", "3.8M", "M"],
  ["myformations.v", "21.9M", "H"], ["star.vistra.com", "3.6M", "M"],
  ["osc.vistra.com", "21.0M", "H"], ["vistraitcl.com", "2.3M", "M"],
  ["orisoftsaas.com", "17.3M", "H"], ["iipay.com", "2.1M", "M"],
  ["iipaysp.com", "13.8M", "H"], ["srmy.vistra.com", "2.0M", "M"],
  ["tricorglobal.com", "10.4M", "H"], ["vistrasedico.com", "1.8M", "M"],
  ["tricoreportal.com", "7.3M", "H"], ["nortonsassurance", "1.7M", "M"],
  ["ioikorea.com", "6.9M", "H"], ["tricorunify.com", "1.3M", "M"],
  ["unifyhrs.com", "6.5M", "H"], ["orisoftbpo.com", "1.1M", "M"],
  ["prodv3.vistra", "79K", "L"], ["tricoris.com", "897K", "M"],
  ["jordanscorp", "84K", "L"], ["hkeipo.hk", "869K", "M"],
  ["ezservices365", "71K", "L"], ["tricor.com.hk", "724K", "M"],
  ["osc-dev.vistra", "62K", "L"], ["tricor.hk", "671K", "M"],
  ["vistra.com.my", "45K", "L"], ["osc-stg.vistra", "492K", "M"],
  ["eshareholder.hk", "12K", "L"], ["osc-test.vistra", "474K", "M"],
  ["tiih.com.my", "9K", "L"], ["orisoft.com.my", "390K", "M"],
  ["myetricor.com", "529", "L"], ["ieglobal.vistra", "347K", "M"],
  ["tricorpayroll", "364", "L"], ["sertus-inc.com", "330K", "M"],
  ["onepayroll.net", "197", "L"], ["osc-sdb.vistra", "265K", "M"],
  ["tricorlabuan", "210", "L"], ["jordans.co.uk", "246K", "M"],
  ["axcelasia.com", "204", "L"], ["prodv4.vistra", "246K", "M"],
  ["rfdy.net", "31", "L"], ["tricor-hrm.com", "236K", "M"],
  ["tricor-roots.com", "7", "L"], ["orisoft.co.th", "206K", "M"],
  ["4uwecare.com", "2", "L"], ["tiih.online", "134K", "M"],
  ["rfdy.hk", "2", "L"], ["uat.vistra.com", "102K", "M"],
];

for (let i = 0; i < 26; i++) {
  for (let ci = 0; ci < 2; ci++) {
    const idx = i + ci * 26;
    if (idx >= allZones.length) continue;
    const cx = colXs[ci];
    const y = 2.1 + i * rowH;
    const isEven = i % 2 === 0;
    const tier = allZones[idx][2];
    const tierColor = tier === "H" ? accent : (tier === "M" ? accentLight : muted);

    s12.addShape(pptx.ShapeType.rect, { x: cx, y, w: 6.0, h: rowH, fill: { color: isEven ? "FFFFFF" : panelSoft }, line: { color: hairline, pt: 0.25 } });
    addText(s12, `${idx + 1}`, { x: cx, y: y + 0.01, w: 0.4, h: rowH - 0.01, fontFace: headEn, fontSize: 7, color: muted, align: "center" });
    addText(s12, allZones[idx][0], { x: cx + 0.4, y: y + 0.01, w: 3.4, h: rowH - 0.01, fontFace: head, fontSize: 7, color: ink });
    addText(s12, allZones[idx][1], { x: cx + 3.8, y: y + 0.01, w: 1.3, h: rowH - 0.01, fontFace: headEn, fontSize: 7, color: ink, align: "center" });
    addText(s12, tier, { x: cx + 5.1, y: y + 0.01, w: 0.9, h: rowH - 0.01, fontFace: head, fontSize: 7, bold: true, color: tierColor, align: "center" });
  }
}

// =================================================================
// PAGE 13: Threshold Calculation
// =================================================================
const s13 = pptx.addSlide();
bg(s13); header(s13, "12 / 阈值计算", "阈值如何从流量数据推导出来？");
footer(s13, 19);

s13.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 1.85, w: 12.23, h: 1.3, rectRadius: 0.08,
  fill: { color: panelSoft }, line: { color: accent, pt: 1.5 },
});
addText(s13, "P95 峰值 → × 安全系数 → × 维度调整 → 最终阈值", {
  x: 0.75, y: 1.95, w: 12, h: 0.4,
  fontFace: head, fontSize: 14, bold: true, color: accent, align: "center",
});
addText(s13, "T₀ = P95_peak_rps × Safety_Multiplier → T_final = T₀ × α_actual", {
  x: 0.75, y: 2.4, w: 12, h: 0.35,
  fontFace: mono, fontSize: 12, color: ink, align: "center",
});
addText(s13, "Safety: High=3x | Medium=2.5x | Low=2x     α = max(1, log₂(G) × β)", {
  x: 0.75, y: 2.78, w: 12, h: 0.3,
  fontFace: head, fontSize: 11, color: muted, align: "center",
});

addText(s13, "示例：www.vistra.com", {
  x: margin, y: 3.35, w: 12, h: 0.35,
  fontFace: head, fontSize: 13, bold: true, color: ink,
});

const calcRows = [
  ["30 天总请求", "39,787,847"],
  ["日均每分钟", "~921 req/min（全部访客）"],
  ["估算峰值小时每分钟", "~1,800 req/min"],
  ["估算每 IP P95 峰值", "~100-200 req/min"],
  ["High 阈值", "100 × 3 × 5 (UA调整) = 1500"],
  ["Medium 阈值", "100 × 2.5 × 2 (Colo调整) = 500"],
  ["Low 阈值", "100 × 2 × 1 = 200"],
];

for (let i = 0; i < calcRows.length; i++) {
  const y = 3.8 + i * 0.42;
  s13.addShape(pptx.ShapeType.rect, {
    x: 0.55, y, w: 12.23, h: 0.38,
    fill: { color: i % 2 === 0 ? "FFFFFF" : panelSoft },
    line: { color: hairline, pt: 0.5 },
  });
  addText(s13, calcRows[i][0], {
    x: 0.7, y: y + 0.03, w: 5, h: 0.32,
    fontFace: head, fontSize: 11, color: muted,
  });
  addText(s13, calcRows[i][1], {
    x: 6.0, y: y + 0.03, w: 6.5, h: 0.32,
    fontFace: i >= 4 ? mono : headEn,
    fontSize: 11, bold: i >= 4,
    color: i >= 4 ? accent : ink,
  });
}

// =================================================================
// PAGE 14: Deployment Summary
// =================================================================
const s14 = pptx.addSlide();
bg(s14); header(s14, "13 / 部署总结", "3 个 Ruleset + 3 条 Execute Rule = 全覆盖");
footer(s14, 20);

const cards = [
  { x: 0.55, title: "创建", count: "3", sub: "Ruleset\n(High/Medium/Low)", color: accent },
  { x: 4.75, title: "部署", count: "3", sub: "Execute Rule\n(按 Zone 分流)", color: accentLight },
  { x: 8.95, title: "覆盖", count: "52", sub: "Enterprise Zone\n一次全覆盖", color: positive },
];

for (const c of cards) {
  s14.addShape(pptx.ShapeType.roundRect, {
    x: c.x, y: 1.85, w: 3.83, h: 2.2, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: c.color, pt: 1.5 },
  });
  addText(s14, c.title, {
    x: c.x + 0.2, y: 1.95, w: 3.4, h: 0.3,
    fontFace: head, fontSize: 13, bold: true, color: c.color, align: "center",
  });
  addText(s14, c.count, {
    x: c.x + 0.2, y: 2.3, w: 3.4, h: 0.8,
    fontFace: headEn, fontSize: 48, bold: true, color: c.color, align: "center",
  });
  addText(s14, c.sub, {
    x: c.x + 0.2, y: 3.2, w: 3.4, h: 0.7,
    fontFace: head, fontSize: 11, color: muted, align: "center", lineSpacingMultiple: 1.2,
  });
}

s14.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 4.3, w: 12.23, h: 2.3, rectRadius: 0.1,
  fill: { color: "FFFFFF" }, line: { color: hairline, pt: 1 },
});
addText(s14, "关键注意事项", {
  x: 0.75, y: 4.4, w: 5, h: 0.3,
  fontFace: head, fontSize: 13, bold: true, color: accent,
});
addText(s14, "1. cf.zone.plan eq \"ENT\" 是硬性要求 — 账户级 Rate Limiting 仅对 Enterprise Zone 生效\n2. requests_to_origin: false — 不计算缓存命中请求，只对到达源站的流量计数\n3. 先 Log 后 Block — 第一周 action 设为 log，观察命中后再切换\n4. 阈值调优 — 7 天后检查 Security Events，微调阈值\n5. IP 列表维护 — 新增可信 IP 只需更新对应 IP 列表", {
  x: 0.75, y: 4.75, w: 12, h: 1.7,
  fontFace: head, fontSize: 11, color: ink, lineSpacingMultiple: 1.35,
});

// =================================================================
// PAGE 15: Deployment Recommendations & Timeline (NEW)
// =================================================================
const s15 = pptx.addSlide();
bg(s15); header(s15, "14 / 部署建议", "推荐行动路线与时间规划");
footer(s15, 21);

// Timeline phases
const phases = [
  { x: 0.55, phase: "Day 0", title: "准备阶段", items: "• 验证 API Token 只读权限\n• 确认 52 个 Enterprise Zone\n• 整理 7 个可信 IP 列表\n• 确认三档 Zone 分组名单", color: accent },
  { x: 3.65, phase: "Day 1", title: "创建部署", items: "• 创建 3 个 Ruleset\n  (High/Medium/Low)\n• 部署 3 条 Execute Rule\n  expression: cf.zone.name in {…}\n• action 全部设为 log", color: blue },
  { x: 6.75, phase: "Day 2-7", title: "观察期", items: "• 监控 Security Events\n• 记录命中 IP + 频次\n• 确认无误杀可信 IP\n• 记录误触发场景\n• 收集峰值数据", color: accentLight },
  { x: 9.85, phase: "Day 7+", title: "切换上线", items: "• log → block/challenge\n• 微调阈值\n• 月度复查\n• 新增 Zone 更新\n  execute expression", color: positive },
];

for (const p of phases) {
  s15.addShape(pptx.ShapeType.roundRect, {
    x: p.x, y: 1.85, w: 2.85, h: 4.0, rectRadius: 0.1,
    fill: { color: panelSoft }, line: { color: p.color, pt: 1.5 },
  });
  // Phase badge
  s15.addShape(pptx.ShapeType.roundRect, {
    x: p.x + 0.6, y: 1.95, w: 1.65, h: 0.35, rectRadius: 0.08,
    fill: { color: p.color },
  });
  addText(s15, p.phase, {
    x: p.x + 0.6, y: 1.97, w: 1.65, h: 0.3,
    fontFace: headEn, fontSize: 11, bold: true, color: "FFFFFF", align: "center",
  });
  addText(s15, p.title, {
    x: p.x + 0.15, y: 2.4, w: 2.55, h: 0.3,
    fontFace: head, fontSize: 12, bold: true, color: ink, align: "center",
  });
  addText(s15, p.items, {
    x: p.x + 0.15, y: 2.8, w: 2.55, h: 2.9,
    fontFace: head, fontSize: 9, color: muted, lineSpacingMultiple: 1.3,
  });
}

// Arrows
for (let i = 0; i < 3; i++) {
  s15.addShape(pptx.ShapeType.rightArrow, {
    x: 3.15 + i * 3.1, y: 3.7, w: 0.4, h: 0.3, fill: { color: accent },
  });
}

// Bottom recommendation
s15.addShape(pptx.ShapeType.roundRect, {
  x: 0.55, y: 6.05, w: 12.23, h: 0.8, rectRadius: 0.08,
  fill: { color: "FFF0E1" }, line: { color: accent, pt: 1 },
});
addText(s15, "核心建议：第一周 action=log 是安全上线的关键 — 先观察，再封禁，避免误杀可信流量", {
  x: 0.75, y: 6.15, w: 12, h: 0.35,
  fontFace: head, fontSize: 12, bold: true, color: accent, align: "center",
});
addText(s15, "Vistra 使用纯 API 操作（非 Terraform），所有步骤均可通过 curl + GraphQL 完成", {
  x: 0.75, y: 6.5, w: 12, h: 0.3,
  fontFace: head, fontSize: 10, color: muted, align: "center",
});

// =================================================================
// PAGE 16: End
// =================================================================
const s16 = pptx.addSlide();
bg(s16);
s16.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: accent },
});
addText(s16, "总结", {
  x: 1.2, y: 1.8, w: 10, h: 0.5,
  fontFace: head, fontSize: 20, bold: true, color: accent,
});
addText(s16, [
  { text: "查询全过程", options: { bold: true, color: accent, fontSize: 14 } },
  { text: "\nToken 验证 → 拉取 82 Zone → GraphQL 30 天流量 → 提取 17 个 IP 列表\n\n", options: { color: ink, fontSize: 12 } },
  { text: "判断原理", options: { bold: true, color: accent, fontSize: 14 } },
  { text: "\nP80/P30 分位 → 10 High / 26 Medium / 16 Low\n维度越多桶越多 → 阈值越高\nIP 排除 → 可信 IP 跳过计数器\n\n", options: { color: ink, fontSize: 12 } },
  { text: "部署建议", options: { bold: true, color: accent, fontSize: 14 } },
  { text: "\n3 Ruleset + 3 Execute Rule 覆盖 52 个 Zone\nDay 0 准备 → Day 1 创建(log) → Day 2-7 观察 → Day 7+ 切换\n纯 API 操作，无需 Terraform", options: { color: ink, fontSize: 12 } },
], {
  x: 1.2, y: 2.4, w: 10.5, h: 3.5, lineSpacingMultiple: 1.3,
});
s16.addShape(pptx.ShapeType.line, {
  x: 1.2, y: 6.0, w: 3.5, h: 0, line: { color: accent, pt: 2 },
});
addText(s16, "END", {
  x: 1.2, y: 6.2, w: 3, h: 0.4,
  fontFace: headEn, fontSize: 14, bold: true, color: muted,
});

// =================================================================
// Write
// =================================================================
await pptx.writeFile({ fileName: OUT });
console.log("✅ PPT 生成：", OUT);
