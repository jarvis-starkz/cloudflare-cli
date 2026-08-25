// =================================================================
// Cloudflare 请求链路完全指南 v3.7 · PPT 生成脚本
// 正式工作汇报风格（Rigorous · Orderly · Restrained）
// 16:9, 13.333" x 7.5" | 共 20 页 | 严格亮色调
// =================================================================
import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_IMG = path.join(__dirname, "assets", "request-flow-cover.jpg");

// ---------- 设计 Token（严格亮色调） ----------
const TOKENS = {
  surface: "FFFDF7", panel: "FFFFFF",
  ink: "1B2A41", muted: "5C6F8C",
  accent: "2C5F8F", accentDark: "1E4466", amber: "C88A2C",
  positive: "2E7D5B", caution: "B58900", risk: "A8322F",
  hairline: "D6DBE4", rule: "9AA7BD",
  // 浅色辅助底
  tintBlue: "EEF3F8", tintWarm: "F7F3EA", tintGreen: "EDF5F0",
  tintAmber: "FBF4E0", tintRed: "FBECEB", tintSoft: "FAFAF6",
  codeBg: "F5F3EE", // 浅色代码块底
  margin: 0.55, sectionW: 8,
  head: "Microsoft YaHei", headEn: "Calibri", mono: "Consolas",
};
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "nc-demo.cf Security Team";
pptx.company = "NC Services Limited";
pptx.title = "Cloudflare 请求链路完全指南 v3.7";
pptx.subject = "Enterprise Deployment Handbook";
const TOTAL = 20;

// ---------- helpers ----------
const singleToken = (s, txt, o) =>
  s.addText(txt, { margin: 0, wrap: false, vert: "horz", fit: "shrink", ...o });

const addFooter = (s, n, src) => {
  const { margin } = TOKENS;
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 7.1, w: 13.333 - 2 * margin, h: 0,
    line: { color: TOKENS.hairline, pt: 0.75 },
  });
  if (src)
    s.addText(src, {
      x: margin, y: 7.16, w: 9, h: 0.28,
      fontFace: TOKENS.headEn, fontSize: 9, color: TOKENS.muted, margin: 0, wrap: false,
    });
  singleToken(s, `${n} / ${TOTAL}`, {
    x: 13.333 - margin - 2, y: 7.16, w: 2, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.muted, align: "right",
  });
};

const claimBand = (s, sec, claim, sz = 24) => {
  const { margin, sectionW: sw, amber, accent, hairline, ink, head, headEn } = TOKENS;
  singleToken(s, sec.toUpperCase(), {
    x: margin, y: 0.4, w: sw, h: 0.32,
    fontFace: headEn, fontSize: 10, bold: true, color: accent,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 0.7, w: 0.55, h: 0, line: { color: amber, pt: 2 },
  });
  s.addText(claim, {
    x: margin, y: 0.8, w: 13.333 - 2 * margin, h: 0.62,
    fontFace: head, fontSize: sz, bold: true, color: ink, margin: 0,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 1.58, w: 13.333 - 2 * margin, h: 0,
    line: { color: hairline, pt: 0.5 },
  });
  return { top: 1.78, bottom: 7.0 };
};

const table = (s, x0, y0, colW, header, rows, opts = {}) => {
  const rowH = opts.rowH || 0.45;
  const accentDark = TOKENS.accentDark, accent = TOKENS.accent,
    hairline = TOKENS.hairline, panel = TOKENS.panel, ink = TOKENS.ink, head = TOKENS.head;
  const colX = [];
  let cx = x0;
  colW.forEach(w => { colX.push(cx); cx += w; });

  header.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: colX[i], y: y0, w: colW[i], h: rowH,
      fill: { color: i === 0 ? accentDark : accent },
      line: { color: accent, pt: 0 },
    });
    s.addText(h, {
      x: colX[i] + 0.1, y: y0 + 0.08, w: colW[i] - 0.2, h: rowH - 0.16,
      fontFace: head, fontSize: 10.5, bold: true, color: "FFFFFF",
      align: i === 0 ? "left" : "center", margin: 0,
    });
  });
  rows.forEach((row, r) => {
    const y = y0 + rowH + r * rowH;
    const bg = r % 2 === 0 ? panel : TOKENS.tintSoft;
    row.forEach((cell, c) => {
      let fill = bg, color = ink, bold = false;
      if (opts.colorize && typeof opts.colorize === "function") {
        const res = opts.colorize(cell, c, r);
        if (res) { fill = res.fill || fill; color = res.color || color; bold = res.bold || bold; }
      }
      s.addShape(pptx.ShapeType.rect, {
        x: colX[c], y, w: colW[c], h: rowH,
        fill: { color: fill }, line: { color: hairline, pt: 0.5 },
      });
      s.addText(cell, {
        x: colX[c] + 0.08, y: y + 0.08, w: colW[c] - 0.16, h: rowH - 0.16,
        fontFace: head,
        fontSize: opts.bodyFont || (c === 0 ? 10 : 9.5),
        bold: c === 0 || bold,
        color,
        align: c === 0 ? "left" : "center",
        margin: 0, wrap: false,
      });
    });
  });
};

const statusColor = (cell) => {
  const t = String(cell);
  if (t.startsWith("✅") || /^★+/.test(t) || t.includes("推荐") || t.includes("Full (Str)"))
    return { fill: "E7F2EC", color: TOKENS.positive, bold: true };
  if (t.startsWith("❌")) return { fill: "FBECEB", color: TOKENS.risk, bold: true };
  if (t.startsWith("⚠️")) return { fill: "FBF4E0", color: TOKENS.caution, bold: true };
  if (t.includes("Optional")) return { fill: "E9EFF7", color: TOKENS.accent, bold: true };
  if (t.includes("Full Proxy") || t.includes("橙云")) return { fill: "E9EFF7", color: TOKENS.accent };
  if (t.includes("Partial") || t.includes("DNS-only")) return { fill: "FBF4E0", color: TOKENS.caution };
  return null;
};

// 浅色代码块（替代原深色代码块，符合严格亮色调要求）
const codeBlock = (s, x, y, w, h, title, lines) => {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText(title, {
    x: x + 0.2, y: y + 0.04, w: w - 0.4, h: 0.36,
    fontFace: TOKENS.mono, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x, y: y + 0.5, w, h: h - 0.5,
    fill: { color: TOKENS.codeBg }, line: { color: TOKENS.hairline, pt: 0.8 }, rectRadius: 0.05,
  });
  lines.forEach((ln, i) => {
    s.addText(ln[0], {
      x: x + 0.25, y: y + 0.58 + i * 0.24, w: w - 0.5, h: 0.24,
      fontFace: TOKENS.mono, fontSize: 9.5, color: ln[1], margin: 0, wrap: false,
    });
  });
};

// ============================================================
// 01 封面
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.addImage({ path: COVER_IMG, x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.0, w: 13.333, h: 1.5,
    fill: { color: "000000", transparency: 55 },
    line: { color: "000000", transparency: 100 },
  });
  singleToken(s, "NC-DEMO.CF  ·  ENTERPRISE REQUEST FLOW  ·  27 CHAPTERS", {
    x: TOKENS.margin, y: 6.12, w: 10, h: 0.3,
    fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: TOKENS.amber,
  });
  s.addText("Cloudflare 请求链路完全指南\n架构全景 · 10 大场景 · 5 大行业 · 可观测性 · SSL/TLS · 合规", {
    x: TOKENS.margin, y: 6.42, w: 12.2, h: 1.0,
    fontFace: TOKENS.head, fontSize: 22, bold: true, color: "FFFFFF",
    margin: 0, lineSpacingMultiple: 1.1,
  });
  singleToken(s, "2026-08-17   |   v3.7   |   决策评审版", {
    x: TOKENS.margin, y: 7.2, w: 7, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, color: "CFD8E6",
  });
})();

// ============================================================
// 02 文档架构 v3.7：27 章五大板块
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "01 · ARCHITECTURE", "文档架构 v3.7：27 章五大板块 · 从基础到行业全覆盖");

  const blocks = [
    { n: "01", name: "基础概念 & 选型", sub: "第 1–4 章",
      color: TOKENS.accent,
      items: ["DNS 设置类型（橙云/DNS-only/Partial/CNAME）", "SSL 证书类型（Universal/ACM/Origin CA）", "mTLS · AOP 三级配置（全 Plan 可用）"] },
    { n: "02", name: "10 大部署场景", sub: "第 5–14 章",
      color: TOKENS.positive,
      items: ["Full Proxy × Partial Zone × Load Balancer", "× ACM（自购证书） × mTLS", "LB DNS 记录优先级（v3.7 新增）"] },
    { n: "03", name: "特色能力专题", sub: "第 15–17 章",
      color: TOKENS.amber,
      items: ["Waiting Room 防源站过载（Business+）", "IP Lists 介入 WAF 自定义规则", "账户级 Lists & Access Rules 跨 Zone"] },
    { n: "04", name: "行业衍生场景", sub: "第 19–24 章",
      color: TOKENS.caution,
      items: ["金融 / 政企 / 电力关基 / 支付 / SaaS 多租户", "ACME 自动化证书管理专章", "行业对比附录 + 缩略语表"] },
    { n: "05", name: "可观测 & 加密 & 模式", sub: "第 25–27 章",
      color: TOKENS.risk,
      items: ["Log Explorer（Beta · R2 存储 · 360 天）", "加密套件自定义 & TLS 协商", "SSL/TLS 4 模式 + Automatic SSL/TLS"] },
  ];

  const x0 = TOKENS.margin;
  const gap = 0.18;
  const pw = (13.333 - 2 * TOKENS.margin - 4 * gap) / 5;
  const top = f.top + 0.05;
  const bh = f.bottom - top - 0.45;

  blocks.forEach((b, i) => {
    const x = x0 + i * (pw + gap);
    const y = top;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: bh, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.08, h: bh, fill: { color: b.color },
      line: { color: b.color, pt: 0 },
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.15, y: y + 0.2, w: 0.58, h: 0.58,
      fill: { color: b.color }, line: { color: b.color, pt: 0 },
    });
    singleToken(s, b.n, {
      x: x + 0.15, y: y + 0.28, w: 0.58, h: 0.45,
      fontFace: TOKENS.headEn, fontSize: 18, bold: true, color: "FFFFFF", align: "center",
    });
    singleToken(s, b.sub, {
      x: x + pw - 1.6, y: y + 0.32, w: 1.4, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 9.5, bold: true, color: b.color, align: "right",
    });
    s.addText(b.name, {
      x: x + 0.18, y: y + 0.92, w: pw - 0.36, h: 0.5,
      fontFace: TOKENS.head, fontSize: 14, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.18, y: y + 1.55, w: pw - 0.36, h: 0,
      line: { color: TOKENS.hairline, pt: 0.5 },
    });
    b.items.forEach((it, k) => {
      s.addText(`• ${it}`, {
        x: x + 0.18, y: y + 1.7 + k * 0.36, w: pw - 0.36, h: 0.34,
        fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0,
      });
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.32, w: 13.333 - 2 * TOKENS.margin, h: 0.32,
    fill: { color: TOKENS.tintBlue }, line: { color: TOKENS.rule, pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("总计：27 章 · 10 大部署场景 · 5 大行业衍生 · 6 大日志来源 · 4 种 SSL/TLS 模式 · 文档 v3.7", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.3, w: 13.333 - 2 * TOKENS.margin - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.ink, align: "center", margin: 0,
  });

  addFooter(s, 2, "资料来源：Cloudflare 请求链路完全指南 v3.7 · 27 章节总览");
})();

// ============================================================
// 03 全景图：请求通过 Cloudflare Edge 的 14 阶段
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "02 · PIPELINE", "请求链路全景：访客 → Cloudflare Edge 14 阶段 → 源站 → 返回");

  const stages = [
    ["01", "DNS", "Anycast DNS · 就近接入"],
    ["02", "TLS", "TLS 握手 · Client Hello 协议协商"],
    ["03", "L3/L4", "L3/L4 DDoS 防护 · SYN 代理"],
    ["04", "Spectrum", "TCP/UDP 代理（Spectrum）"],
    ["05", "HTTP", "HTTP 解析 · Host/Path 匹配"],
    ["06", "WAF", "WAF 自定义/托管规则/速率限制"],
    ["07", "Bot Mgmt", "Bot Management · Bot Score/JA3/JA4"],
    ["08", "API Shield", "API Shield · Schema/mTLS 校验"],
    ["09", "Cache", "边缘缓存 · CDN 命中检查"],
    ["10", "LB", "Load Balancer · Geo Steering"],
    ["11", "Waiting Room", "Waiting Room · 过载保护"],
    ["12", "Workers", "Workers · 边缘计算"],
    ["13", "Origin", "回源 · Authenticated Origin Pulls"],
    ["14", "Response", "响应优化 · Brotli/HTTP/3"],
  ];

  const rows = [stages.slice(0, 7), stages.slice(7, 14)];
  const y0 = f.top + 0.05;
  const cardH = 1.6;
  const rowGap = 0.28;
  const x0 = TOKENS.margin;
  const gap = 0.16;
  const cardW = (13.333 - 2 * x0 - 6 * gap) / 7;

  rows.forEach((row, rIdx) => {
    const y = y0 + rIdx * (cardH + rowGap);
    row.forEach((st, cIdx) => {
      const x = x0 + cIdx * (cardW + gap);
      const [no, title, desc] = st;
      s.addShape(pptx.ShapeType.roundRect, {
        x, y, w: cardW, h: cardH, fill: { color: TOKENS.panel },
        line: { color: TOKENS.hairline, pt: 0.8 }, rectRadius: 0.06,
      });
      const bandColor =
        cIdx <= 2 ? TOKENS.accent :
        cIdx <= 5 ? TOKENS.caution :
        cIdx <= 8 ? TOKENS.amber :
        cIdx <= 10 ? TOKENS.positive : TOKENS.risk;
      s.addShape(pptx.ShapeType.rect, {
        x, y, w: cardW, h: 0.38,
        fill: { color: bandColor }, line: { color: bandColor, pt: 0 },
      });
      singleToken(s, no, {
        x: x + 0.08, y: y + 0.04, w: 0.45, h: 0.3,
        fontFace: TOKENS.headEn, fontSize: 14, bold: true, color: "FFFFFF",
      });
      s.addText(title, {
        x: x + 0.5, y: y + 0.05, w: cardW - 0.58, h: 0.3,
        fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: "FFFFFF",
        align: "right", margin: 0, wrap: false,
      });
      s.addText(desc, {
        x: x + 0.08, y: y + 0.5, w: cardW - 0.16, h: cardH - 0.58,
        fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0,
      });
      if (cIdx < row.length - 1) {
        s.addShape(pptx.ShapeType.chevron, {
          x: x + cardW, y: y + cardH / 2 - 0.1, w: gap, h: 0.2,
          fill: { color: TOKENS.rule, transparency: 30 },
          line: { color: TOKENS.rule, transparency: 30, pt: 0 },
        });
      }
    });
  });
  const downX = x0 + 6 * (cardW + gap) + cardW / 2 - 0.15;
  const downY1 = y0 + cardH;
  const downY2 = y0 + cardH + rowGap - 0.05;
  s.addShape(pptx.ShapeType.line, {
    x: downX, y: downY1, w: 0, h: downY2 - downY1,
    line: { color: TOKENS.amber, pt: 2, beginArrowType: "none", endArrowType: "triangle" },
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.36, w: 13.333 - 2 * TOKENS.margin, h: 0.36,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 },
    rectRadius: 0.04,
  });
  s.addText("关键结论：请求在到达源站之前，会在 Cloudflare Edge 依次通过 14 个阶段的安全、性能与合规检查", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.34, w: 13.333 - 2 * TOKENS.margin - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF",
    align: "center", margin: 0,
  });

  addFooter(s, 3, "对应章节：第 1 章 · 请求链路基础概念");
})();

// ============================================================
// 04 处理节点顺序速查表（含 Waiting Room Business+ · v3.7）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "02 · PIPELINE", "处理节点顺序速查：14 阶段 × 计划要求 × 拦截场景");

  const header = ["#", "节点", "Cloudflare 功能", "计划要求", "可否跳过", "典型拦截场景"];
  const rows = [
    ["①", "Anycast DNS", "Cloudflare DNS（权威）", "全部", "❌", "域名不存在/被阻断"],
    ["②", "TCP/QUIC", "传输层建连", "全部", "❌", "连接超时"],
    ["③", "TLS 握手", "Universal SSL / ACM", "全部", "❌", "证书过期/不受信任"],
    ["④", "DDoS 防护", "Advanced DDoS（L3/L4+L7）", "全部 · Ent 增强", "❌ 始终开启", "SYN Flood / HTTP Flood"],
    ["⑤", "Bot Management", "Bot Score / JA3 / JA4", "Enterprise", "✅ 可关闭", "爬虫/自动化/撞库"],
    ["⑥", "WAF", "Custom + Managed + Rate Limit", "全部 · Ent 增强", "✅ Skip", "SQL注入/XSS/自定义"],
    ["⑦", "Waiting Room", "Waiting Room / Events", "Business+ · Ent 增强", "✅ 可关闭", "并发超限排队"],
    ["⑧", "Cache", "Cache / Cache Rules / Reserve", "全部 · Ent 增强", "✅ Skip", "静态资源命中直返"],
    ["⑨", "Ruleset Engine", "Redirect/Transform/Origin Rules", "全部", "✅", "URL 跳转/重写/回源"],
    ["⑩", "Workers", "Workers / Workers Routes", "全部（限量）", "✅", "边缘计算/直接返回"],
    ["⑪", "Load Balancer", "Pools / Steering / Health", "Enterprise", "✅ 未配置跳过", "Pool 选择/故障转移"],
    ["⑫", "Argo Smart", "Argo Smart Routing", "Ent（附加）", "✅ 附加服务", "路由优化/降回源延迟"],
    ["⑬", "源站连接", "AOP (mTLS) / Tunnel", "全部 · AOP 全 Plan", "❌ Cache HIT 跳过", "mTLS 失败/IP 白名单"],
    ["⑭", "响应处理", "Brotli / Image Resize / HTTP/2", "全部 · 部分 Ent", "❌", "压缩/缓存/图片优化"],
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.02;
  const colW = [0.5, 1.55, 3.3, 2.05, 1.85, 3.43];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.345, bodyFont: 9,
    colorize: (cell, c) => {
      if (c === 3 && String(cell).includes("Business+"))
        return { fill: TOKENS.tintAmber, color: TOKENS.caution, bold: true };
      if (c === 3 && String(cell).includes("Ent"))
        return { fill: TOKENS.tintBlue, color: TOKENS.accent, bold: true };
      if (c === 3) return { fill: TOKENS.tintGreen, color: TOKENS.positive, bold: true };
      if (c === 4) return statusColor(cell);
      return null;
    },
  });

  // 底部 v3.7 更新提示
  const by = y0 + 15 * 0.345 + 0.12;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintWarm }, line: { color: TOKENS.amber, pt: 0.8 }, rectRadius: 0.05,
  });
  singleToken(s, "v3.7 更新", {
    x: TOKENS.margin + 0.25, y: by + 0.08, w: 1.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.amber,
  });
  s.addText("Waiting Room 计划要求修正为 Business+（非 Enterprise 独占）；AOP（Authenticated Origin Pulls）全 Plan 可用，但 Off/Flexible 模式下不生效。", {
    x: TOKENS.margin + 0.25, y: by + 0.38, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.5,
    fontFace: TOKENS.head, fontSize: 11, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
  });

  addFooter(s, 4, "对应章节：第 1.5 章 · Edge 请求处理流水线速查表");
})();

// ============================================================
// 05 部署选型：橙云 / DNS-only / Partial / CNAME
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "03 · DEPLOYMENT", "部署选型对比：Full Proxy（橙云）· DNS-only · Partial · CNAME");

  const header = ["维度", "Full Proxy（橙云）", "DNS-only（灰云）", "Partial（Suffix）", "CNAME 接入"];
  const rows = [
    ["是否通过 Cloudflare", "✅ 全部", "❌ 直连源站", "✅ 指定后缀", "✅ 指定子域"],
    ["WAF / Bot / DDoS", "✅ 全部生效", "❌ 不生效", "✅ 覆盖区", "✅ 覆盖子域"],
    ["缓存 & CDN", "✅", "❌", "✅ 覆盖区", "✅ 覆盖子域"],
    ["证书管理（Edge）", "Universal/ACM", "源站自管", "Universal/ACM", "Universal/ACM"],
    ["源站暴露 IP", "❌ 隐藏", "✅ 暴露", "⚠️ 后缀内部分", "⚠️ 子域内部"],
    ["适用场景", "所有生产默认", "MX/SSH 等 4 层", "混合 IT · 分部门", "第三方 SaaS 域名"],
    ["企业推荐度", "★★★★★", "★★ 仅特殊", "★★★★ 混合", "★★★★ SaaS"],
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const colW = [2.4, 2.75, 2.7, 2.7, 2.6];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.5, bodyFont: 10,
    colorize: (cell, c) => (c >= 1 ? statusColor(cell) : null),
  });

  const bx = TOKENS.margin;
  const by = f.top + 0.05 + 8 * 0.5 + 0.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: bx, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.08,
    fill: { color: TOKENS.tintWarm }, line: { color: TOKENS.amber, pt: 0.8 }, rectRadius: 0.05,
  });
  singleToken(s, "选型决策", {
    x: bx + 0.25, y: by + 0.1, w: 1.5, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.amber,
  });
  s.addText("优先 Full Proxy（橙云），仅 MX/SSH/邮件服务保留 DNS-only；跨部门混合网络选 Partial；第三方 SaaS 域名用 CNAME 接入；任何生产 ≥ 1 个子域必开橙云。", {
    x: bx + 0.25, y: by + 0.42, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.6,
    fontFace: TOKENS.head, fontSize: 11, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
  });

  addFooter(s, 5, "对应章节：第 2 章 · DNS 设置类型详解");
})();

// ============================================================
// 06 证书体系四层架构
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "04 · CERTIFICATES", "证书体系四层架构：访客侧 → Edge 证书 → 源站侧 → mTLS 客户端");

  const layers = [
    {
      n: "L1", name: "访客端 TLS 证书（Edge）",
      color: TOKENS.accent,
      items: [
        { k: "Universal SSL",    d: "Free · DV · 通配符" },
        { k: "Advanced Certificate", d: "Pro+ · 自定义主机名" },
        { k: "ACM（自定义优先级）", d: "Ent · 100 张/Zone" },
        { k: "Total TLS", d: "Ent · 自动覆盖（有限制）" },
      ],
    },
    {
      n: "L2", name: "TLS 版本 & 加密套件",
      color: TOKENS.caution,
      items: [
        { k: "TLS 1.0 / 1.1", d: "⚠️ 禁止（合规）" },
        { k: "TLS 1.2", d: "合规基线 + 前向保密" },
        { k: "TLS 1.3", d: "Ent 可强制 · 性能更优" },
        { k: "自定义 cipher", d: "ACM / Ent · 顺序可控" },
      ],
    },
    {
      n: "L3", name: "源站回源证书（Origin）",
      color: TOKENS.amber,
      items: [
        { k: "Origin CA 证书", d: "15 年免费 · 最佳成本" },
        { k: "公网 CA 证书", d: "Full Strict 直接可用" },
        { k: "自签证书", d: "仅 Full 模式过渡" },
        { k: "Authenticated Origin Pulls", d: "双向认证 · 全 Plan" },
      ],
    },
    {
      n: "L4", name: "客户端证书（mTLS / API Shield）",
      color: TOKENS.positive,
      items: [
        { k: "API Shield mTLS", d: "移动 APP / IoT 设备" },
        { k: "Access mTLS", d: "Zero Trust 员工接入" },
        { k: "SaaS 多租户 mTLS", d: "B2B 对接证书校验" },
        { k: "Hostname Cert", d: "Ent · Per-hostname" },
      ],
    },
  ];

  const x0 = TOKENS.margin;
  const y0 = f.top + 0.1;
  const gap = 0.2;
  const pw = (13.333 - 2 * x0 - 3 * gap) / 4;
  const bh = f.bottom - y0 - 0.5;

  layers.forEach((L, i) => {
    const x = x0 + i * (pw + gap);
    const y = y0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: bh, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.1, y: y + 0.1, w: pw - 0.2, h: 0.62,
      fill: { color: L.color }, line: { color: L.color, pt: 0 }, rectRadius: 0.05,
    });
    singleToken(s, L.n, {
      x: x + 0.2, y: y + 0.18, w: 0.7, h: 0.45,
      fontFace: TOKENS.headEn, fontSize: 20, bold: true, color: "FFFFFF",
    });
    s.addText(L.name, {
      x: x + 0.95, y: y + 0.18, w: pw - 1.1, h: 0.48,
      fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
    });
    L.items.forEach((it, k) => {
      const iy = y + 0.9 + k * (bh - 1.1) / 4 + 0.02;
      s.addText(it.k, {
        x: x + 0.2, y: iy, w: pw - 0.4, h: 0.3,
        fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.ink, margin: 0,
      });
      s.addText(it.d, {
        x: x + 0.2, y: iy + 0.3, w: pw - 0.4, h: 0.26,
        fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted, margin: 0,
      });
    });
    if (i < layers.length - 1) {
      s.addShape(pptx.ShapeType.chevron, {
        x: x + pw, y: y + bh / 2 - 0.2, w: gap, h: 0.4,
        fill: { color: TOKENS.rule, transparency: 35 },
        line: { color: TOKENS.rule, transparency: 35, pt: 0 },
      });
    }
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.3, w: 13.333 - 2 * TOKENS.margin, h: 0.3,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("推荐组合（生产）：ACM + TLS 1.3 强制 + Origin CA 证书 + Authenticated Origin Pulls + API Shield mTLS", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.28, w: 13.333 - 2 * TOKENS.margin - 0.4, h: 0.28,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF",
    align: "center", margin: 0,
  });

  addFooter(s, 6, "对应章节：第 3–4 章 · SSL 证书类型 + mTLS 详解");
})();

// ============================================================
// 07 AOP 三个配置级别（v3.7 · 全 Plan 可用）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "04 · CERTIFICATES", "Authenticated Origin Pulls (AOP) 三级配置 · 全 Plan 可用 · v3.7");

  // 三列级别卡
  const levels = [
    {
      n: "1", name: "Per-hostname", sub: "最高优先级",
      color: TOKENS.positive,
      cert: "自上传证书",
      scope: "特定 hostname",
      strength: "★★★★★",
      scene: "仅特定接口要求账户级验证",
      note: "支持 ML-DSA 后量子证书",
    },
    {
      n: "2", name: "Zone-level", sub: "中优先级",
      color: TOKENS.accent,
      cert: "自上传证书",
      scope: "全 Zone 所有 proxied 流量",
      strength: "★★★★",
      scene: "保证请求来自本账户（非其他 CF 账户）",
      note: "FIPS 合规 · 后量子证书",
    },
    {
      n: "3", name: "Global", sub: "最低优先级",
      color: TOKENS.muted,
      cert: "Cloudflare 共享证书",
      scope: "全 Zone 所有 proxied 流量",
      strength: "★★★",
      scene: "仅验证请求来自 CF 网络（最简配置）",
      note: "不满足 FIPS 要求",
    },
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const gap = 0.22;
  const pw = (13.333 - 2 * x0 - 2 * gap) / 3;
  const ch = 3.0;

  levels.forEach((L, i) => {
    const x = x0 + i * (pw + gap);
    const y = y0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: ch, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.1, y: y + 0.1, w: pw - 0.2, h: 0.62,
      fill: { color: L.color }, line: { color: L.color, pt: 0 }, rectRadius: 0.05,
    });
    singleToken(s, `L${L.n}`, {
      x: x + 0.2, y: y + 0.18, w: 0.8, h: 0.45,
      fontFace: TOKENS.headEn, fontSize: 20, bold: true, color: "FFFFFF",
    });
    s.addText(L.name, {
      x: x + 1.05, y: y + 0.18, w: pw - 1.2, h: 0.3,
      fontFace: TOKENS.head, fontSize: 15, bold: true, color: "FFFFFF", margin: 0,
    });
    singleToken(s, L.sub, {
      x: x + 1.05, y: y + 0.46, w: pw - 1.2, h: 0.24,
      fontFace: TOKENS.headEn, fontSize: 9.5, color: "FFFFFF",
    });
    const fields = [
      ["证书来源", L.cert],
      ["适用范围", L.scope],
      ["安全强度", L.strength],
      ["典型场景", L.scene],
    ];
    fields.forEach((r, k) => {
      const ry = y + 0.85 + k * 0.42;
      s.addText(r[0], {
        x: x + 0.2, y: ry, w: pw * 0.4, h: 0.26,
        fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted, margin: 0,
      });
      s.addText(r[1], {
        x: x + 0.2, y: ry + 0.22, w: pw - 0.4, h: 0.26,
        fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.ink, margin: 0,
      });
    });
    // 备注条
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.15, y: y + ch - 0.5, w: pw - 0.3, h: 0.38,
      fill: { color: L.color, transparency: 88 },
      line: { color: L.color, pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(L.note, {
      x: x + 0.25, y: y + ch - 0.46, w: pw - 0.5, h: 0.3,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: L.color, margin: 0,
    });
    if (i < 2) {
      s.addShape(pptx.ShapeType.chevron, {
        x: x + pw, y: y + ch / 2 - 0.18, w: gap, h: 0.36,
        fill: { color: TOKENS.amber, transparency: 20 },
        line: { color: TOKENS.amber, transparency: 20, pt: 0 },
      });
    }
  });

  // 底部规则提示
  const by = y0 + ch + 0.2;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintWarm }, line: { color: TOKENS.amber, pt: 0.8 }, rectRadius: 0.05,
  });
  const rules = [
    "优先级规则：Per-hostname > Zone-level > Global（启用/禁用任一级别不影响其他级别）",
    "全 Plan 可用：Free / Pro / Business / Enterprise 均支持 AOP；但 Off / Flexible 模式下不生效",
    "FIPS 合规：需使用自上传证书（Zone-level 或 Per-hostname），Global 共享证书不满足 FIPS",
  ];
  rules.forEach((r, i) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: TOKENS.margin + 0.25, y: by + 0.18 + i * 0.34, w: 0.16, h: 0.16,
      fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 },
    });
    s.addText(r, {
      x: TOKENS.margin + 0.55, y: by + 0.13 + i * 0.34, w: 13.333 - 2 * TOKENS.margin - 0.8, h: 0.3,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 7, "对应章节：第 4 章 · Authenticated Origin Pulls (AOP) 三个配置级别");
})();

// ============================================================
// 08 ACM 功能配额 + Total TLS 限制（v3.7）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "04 · CERTIFICATES", "ACM 功能配额细化 + Total TLS 限制说明 · v3.7");

  // 左：ACM 功能矩阵
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.4, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("ACM 功能与配额（v3.7 细化）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 6.0, h: 0.36,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });

  const header = ["功能", "配额 / 说明"];
  const rows = [
    ["自定义 CA", "Let's Encrypt / Google / SSL.com"],
    ["单张证书 SAN", "最多 50 个（apex 必含）"],
    ["每 Zone 证书数", "Enterprise 最多 100 张"],
    ["自定义有效期", "14 天 / 30 天 / 90 天 / 1 年"],
    ["Total TLS", "⚠️ 自动覆盖（有限制，见右）"],
    ["自定义加密套件", "满足合规要求"],
  ];
  const x1 = TOKENS.margin;
  const y1 = f.top + 0.55;
  const colW1 = [2.3, 4.1];
  table(s, x1, y1, colW1, header, rows, {
    rowH: 0.42, bodyFont: 10,
    colorize: (cell, c) => {
      if (c === 1 && String(cell).startsWith("⚠️"))
        return { fill: TOKENS.tintAmber, color: TOKENS.caution, bold: true };
      if (c === 1 && (String(cell).includes("100") || String(cell).includes("50")))
        return { fill: TOKENS.tintBlue, color: TOKENS.accent, bold: true };
      return null;
    },
  });

  // 右：Total TLS 限制说明
  const rx = 13.333 - TOKENS.margin - 6.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.15, h: 0.42,
    fill: { color: TOKENS.caution }, line: { color: TOKENS.caution, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("⚠️  Total TLS 限制说明（v3.7）", {
    x: rx + 0.2, y: f.top + 0.04, w: 5.8, h: 0.36,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });

  const limits = [
    { t: "默认有效期", d: "90 天", ok: true },
    { t: "适用范围", d: "自动覆盖所有代理主机名", ok: true },
    { t: "不适用于 LB", d: "Load Balancing hostname 不覆盖", ok: false },
    { t: "不适用于 Tunnel", d: "Cloudflare Tunnel hostname 不覆盖", ok: false },
    { t: "不适用于 Spectrum", d: "Spectrum hostname 不覆盖", ok: false },
    { t: "DNS 要求", d: "需 Full DNS setup", ok: false },
    { t: "Partial 不支持", d: "不支持 Partial (CNAME) setup", ok: false },
  ];
  limits.forEach((lm, i) => {
    const ly = f.top + 0.55 + i * 0.42;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y: ly, w: 6.15, h: 0.38,
      fill: { color: i % 2 === 0 ? TOKENS.panel : TOKENS.tintSoft },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: rx + 0.15, y: ly + 0.12, w: 0.14, h: 0.14,
      fill: { color: lm.ok ? TOKENS.positive : TOKENS.risk },
      line: { color: lm.ok ? TOKENS.positive : TOKENS.risk, pt: 0 },
    });
    s.addText(lm.t, {
      x: rx + 0.4, y: ly + 0.06, w: 2.0, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10, bold: true,
      color: lm.ok ? TOKENS.positive : TOKENS.risk, margin: 0,
    });
    s.addText(lm.d, {
      x: rx + 2.4, y: ly + 0.06, w: 3.6, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0,
    });
  });

  // 底部 CLI 速查
  const by = f.top + 0.55 + 7 * 0.42 + 0.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintBlue }, line: { color: TOKENS.rule, pt: 0.5 }, rectRadius: 0.05,
  });
  singleToken(s, "$ ACM / Total TLS CLI", {
    x: TOKENS.margin + 0.25, y: by + 0.08, w: 4, h: 0.3,
    fontFace: TOKENS.mono, fontSize: 11, bold: true, color: TOKENS.accent,
  });
  const cmds = [
    "cfcli certificate acm config                                    # 查看 ACM 配置",
    "cfcli certificate total-tls enable --ca lets_encrypt             # 启用 Total TLS",
    "cfcli certificate custom upload --cert $CERT --private-key $KEY  # 上传自购证书",
  ];
  cmds.forEach((c, i) => {
    s.addText(c, {
      x: TOKENS.margin + 0.25, y: by + 0.42 + i * 0.26, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.24,
      fontFace: TOKENS.mono, fontSize: 9.5, color: TOKENS.ink, margin: 0, wrap: false,
    });
  });

  addFooter(s, 8, "对应章节：第 7 章 · ACM 功能与配额 + Total TLS 限制");
})();

// ============================================================
// 09 10 大部署场景对比矩阵
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "05 · SCENARIOS", "10 大部署场景对比矩阵（第 5–14 章每章含完整 CLI）");

  const header = ["#", "场景名", "代理", "证书", "LB", "mTLS", "适用场景"];
  const rows = [
    ["S01", "基础 Full Proxy",   "Full Proxy", "Cloudflare", "—",   "—",   "个人站/博客 默认起手"],
    ["S02", "Full Proxy + mTLS","Full Proxy", "Cloudflare", "—",   "✅",  "APP/IoT 客户端证书"],
    ["S03", "Full Proxy + ACM", "Full Proxy", "ACM 自购",   "—",   "—",   "需要 OV/EV 或品牌证书"],
    ["S04", "S03 + mTLS",       "Full Proxy", "ACM 自购",   "—",   "✅",  "合规行业 APP"],
    ["S05", "Partial Zone",     "Partial",    "Cloudflare", "—",   "—",   "混合 IT · 分域接入"],
    ["S06", "S05 + mTLS",       "Partial",    "Cloudflare", "—",   "✅",  "混合 IT 移动端"],
    ["S07", "Full Proxy + LB",  "Full Proxy", "Cloudflare", "✅",  "—",   "多活 DR · 跨区"],
    ["S08", "S07 + mTLS",       "Full Proxy", "Cloudflare", "✅",  "✅",  "金融多活 APP"],
    ["S09", "Full + ACM + LB",  "Full Proxy", "ACM 自购",   "✅",  "—",   "合规行业官网多活"],
    ["S10", "S09 + mTLS",       "Full Proxy", "ACM 自购",   "✅",  "✅",  "金融/支付 全栈全量"],
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const colW = [0.65, 2.15, 1.7, 1.7, 1.0, 0.9, 5.1];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.46, bodyFont: 10,
    colorize: (cell, c) => (c === 5 ? statusColor(cell) : (c >= 2 && c <= 4 ? statusColor(cell) : null)),
  });

  const by = y0 + 11 * 0.46 + 0.18;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.08,
    fill: { color: TOKENS.tintBlue }, line: { color: TOKENS.rule, pt: 0.5 }, rectRadius: 0.05,
  });
  singleToken(s, "文档索引（可复制）", {
    x: TOKENS.margin + 0.25, y: by + 0.1, w: 3, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.accent,
  });
  s.addText("S01→S10：文档第 5–14 章，每章含完整 cfcli 操作序列（DNS→证书→WAF→Bot→LB→Waiting Room→验证→回滚）。S10 = 金融/支付推荐最终目标态。", {
    x: TOKENS.margin + 0.25, y: by + 0.42, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.6,
    fontFace: TOKENS.head, fontSize: 11, color: TOKENS.ink, margin: 0,
  });

  addFooter(s, 9, "对应章节：第 5–14 章 · 10 大场景完整操作手册");
})();

// ============================================================
// 10 LB DNS 记录优先级（v3.7 新增）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "05 · SCENARIOS", "LB DNS 记录优先级判定（v3.7 新增 · 第 11–14 章通用）");

  // 左：优先级判定表
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 7.6, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("优先级判定规则：按「具体程度」比较，同等具体时 LB 胜出", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 7.2, h: 0.36,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });

  const header = ["场景", "手动 DNS 记录", "LB 记录", "生效结果"];
  const rows = [
    ["1（最常见）", "x.example.com (A)", "x.example.com", "✅ LB 优先"],
    ["2", "y.example.com（精确）", "*.example.com（通配）", "手动优先"],
    ["3", "*.example.com（通配）", "*.example.com（通配）", "✅ LB 优先"],
    ["4（SaaS 例外）", "x.example.com → SaaS", "x + 活跃 Custom Hostname", "Custom Hostname 优先"],
  ];
  const x1 = TOKENS.margin;
  const y1 = f.top + 0.55;
  const colW1 = [1.5, 2.5, 2.4, 1.2];
  table(s, x1, y1, colW1, header, rows, {
    rowH: 0.5, bodyFont: 9.5,
    colorize: (cell, c) => {
      if (c === 3 && String(cell).includes("LB 优先"))
        return { fill: TOKENS.tintGreen, color: TOKENS.positive, bold: true };
      if (c === 3 && String(cell).includes("手动优先"))
        return { fill: TOKENS.tintBlue, color: TOKENS.accent, bold: true };
      if (c === 3 && String(cell).includes("Custom Hostname"))
        return { fill: TOKENS.tintAmber, color: TOKENS.caution, bold: true };
      return null;
    },
  });

  // 右：关键要点
  const rx = 13.333 - TOKENS.margin - 4.35;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 4.35, h: 0.42,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("关键要点", {
    x: rx + 0.2, y: f.top + 0.04, w: 4.0, h: 0.36,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });
  const points = [
    "LB 记录会「接管」同名 hostname，手动记录被遮蔽",
    "判定标准是「具体程度」，不是记录类型",
    "精确 vs 精确 → LB 胜；精确 vs 通配 → 精确胜",
    "Custom Hostname（SaaS）优先级高于 LB",
    "禁用 LB → DNS 回退到手动记录",
    "Partial setup：Universal SSL 不覆盖 LB hostname",
  ];
  points.forEach((p, i) => {
    const py = f.top + 0.55 + i * 0.42;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y: py, w: 4.35, h: 0.38,
      fill: { color: i % 2 === 0 ? TOKENS.panel : TOKENS.tintSoft },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: rx + 0.12, y: py + 0.13, w: 0.12, h: 0.12,
      fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 },
    });
    s.addText(p, {
      x: rx + 0.32, y: py + 0.06, w: 3.95, h: 0.28,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });

  // 底部常见误区
  const by = y1 + 5 * 0.5 + 0.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintRed }, line: { color: TOKENS.risk, pt: 0.6 }, rectRadius: 0.05,
  });
  singleToken(s, "✗ 常见误区", {
    x: TOKENS.margin + 0.25, y: by + 0.08, w: 2, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.risk,
  });
  const myths = [
    "误认为手动 CNAME 会与 LB 记录「负载均衡」→ 不会，同名时 LB 独占生效",
    "误认为删除手动记录才能让 LB 生效 → 不需要，LB 优先级更高",
    "误认为禁用 LB 后手动记录立即生效 → 受 TTL 影响，本地 DNS 缓存可能延迟",
    "误认为 LB 通配符会覆盖所有子域 → 不会，精确手动记录优先于 LB 通配符",
  ];
  myths.forEach((m, i) => {
    const mx = TOKENS.margin + 0.25 + (i % 2) * 6.2;
    const my = by + 0.42 + Math.floor(i / 2) * 0.36;
    s.addText(`• ${m}`, {
      x: mx, y: my, w: 6.0, h: 0.32,
      fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 10, "对应章节：第 11 章 · LB DNS 记录优先级说明（第 11–14 章通用）");
})();

// ============================================================
// 11 场景对比总结（第 18 章）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "05 · SCENARIOS", "10 大场景对比总结：安全级别 × 证书 × 选型建议");

  // 左：安全级别对比
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.0, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("场景安全级别对比", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 5.6, h: 0.36,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const header1 = ["场景", "安全级别", "适用场景"];
  const rows1 = [
    ["S01", "★★★", "基础保护，个人网站"],
    ["S02", "★★★★", "需要源站认证"],
    ["S03", "★★★★", "自定义证书，企业级"],
    ["S04", "★★★★★", "自定义证书 + mTLS"],
    ["S05", "★★★", "Partial Setup 基础"],
    ["S06", "★★★★", "Partial + mTLS"],
    ["S07", "★★★★", "负载均衡 + 故障转移"],
    ["S08", "★★★★★", "负载均衡 + mTLS"],
    ["S09", "★★★★", "ACM + 负载均衡"],
    ["S10", "★★★★★", "完整保护组合，企业级"],
  ];
  const x1 = TOKENS.margin;
  const y1 = f.top + 0.55;
  const colW1 = [0.7, 1.5, 3.8];
  table(s, x1, y1, colW1, header1, rows1, {
    rowH: 0.355, bodyFont: 9.5,
    colorize: (cell, c) => {
      if (c === 1) {
        const t = String(cell);
        if (t.includes("★★★★★")) return { fill: TOKENS.tintGreen, color: TOKENS.positive, bold: true };
        if (t.includes("★★★★")) return { fill: TOKENS.tintBlue, color: TOKENS.accent, bold: true };
        return { fill: TOKENS.tintAmber, color: TOKENS.caution, bold: true };
      }
      return null;
    },
  });

  // 右：选型建议
  const rx = 13.333 - TOKENS.margin - 6.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.15, h: 0.42,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("✓ 选型建议矩阵", {
    x: rx + 0.2, y: f.top + 0.04, w: 5.8, h: 0.36,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const picks = [
    { need: "基础保护", rec: "S01 或 S05", c: TOKENS.caution },
    { need: "最高安全性", rec: "S10", c: TOKENS.positive },
    { need: "全球负载均衡", rec: "S07 或 S08", c: TOKENS.accent },
    { need: "自定义证书", rec: "S03 或 S04", c: TOKENS.accent },
    { need: "已有 DNS 提供商", rec: "S05 或 S06", c: TOKENS.amber },
    { need: "企业级应用", rec: "S10", c: TOKENS.positive },
  ];
  picks.forEach((p, i) => {
    const py = f.top + 0.55 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y: py, w: 6.15, h: 0.46,
      fill: { color: i % 2 === 0 ? TOKENS.panel : TOKENS.tintSoft },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(p.need, {
      x: rx + 0.2, y: py + 0.08, w: 2.5, h: 0.3,
      fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx + 2.9, y: py + 0.08, w: 3.1, h: 0.3,
      fill: { color: p.c, transparency: 85 },
      line: { color: p.c, pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(p.rec, {
      x: rx + 3.0, y: py + 0.1, w: 2.9, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: p.c, margin: 0,
    });
  });

  // 底部证书使用总结
  const by = y1 + 11 * 0.355 + 0.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintWarm }, line: { color: TOKENS.amber, pt: 0.6 }, rectRadius: 0.05,
  });
  s.addText("证书使用总结：S01–S02 / S05–S08 用 Universal SSL；S03–S04 / S09–S10 用自购买证书 (ACM)；10 场景源站证书统一推荐 Origin CA。S10 = 金融/支付最终目标态。", {
    x: TOKENS.margin + 0.25, y: by + 0.12, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.5,
    fontFace: TOKENS.head, fontSize: 11, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
  });

  addFooter(s, 11, "对应章节：第 18 章 · 场景对比总结");
})();

// ============================================================
// 12 5 大行业衍生场景
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "06 · INDUSTRY", "5 大行业衍生场景：金融 / 政企 / 电力 / 支付 / SaaS 多租户");

  const cards = [
    { icon: "💳", n: "19", name: "金融行业", color: TOKENS.accent,
      tags: ["多活 DR", "等保四级", "跨境支付"],
      desc: "LB 双 Region 多活 + ACM + mTLS + API Shield + Data Localization Suite" },
    { icon: "🏛️", n: "20", name: "政企行业", color: TOKENS.caution,
      tags: ["数据本地化", "Magic Transit", "合规"],
      desc: "Magic Transit + DLS（数据不出境）+ Access 双因子 + 账户级 Lists" },
    { icon: "⚡", n: "21", name: "电力公司", color: TOKENS.amber,
      tags: ["OT/ICS", "Spectrum", "关基保护"],
      desc: "Spectrum TCP/UDP 代理 + Spectrum 4 层 DDoS + 关基 IP 白名单 + 审计" },
    { icon: "💰", n: "22", name: "支付行业", color: TOKENS.positive,
      tags: ["PCI-DSS", "API Shield", "抢购高峰"],
      desc: "PCI-DSS 全链路 + Waiting Room 春运 + API Shield + 525/502 实时监控" },
    { icon: "🧩", n: "23", name: "SaaS 多租户", color: TOKENS.risk,
      tags: ["Multi-tenant", "Total TLS", "WAF"],
      desc: "Total TLS + Hostname WAF + Per-Tenant WAF 隔离 + ACM 多证书优先级" },
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.1;
  const gap = 0.18;
  const pw = (13.333 - 2 * x0 - 4 * gap) / 5;
  const bh = f.bottom - y0 - 0.5;

  cards.forEach((c, i) => {
    const x = x0 + i * (pw + gap);
    const y = y0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: bh, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: pw, h: 0.12, fill: { color: c.color }, line: { color: c.color, pt: 0 },
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.25, y: y + 0.35, w: 0.85, h: 0.85,
      fill: { color: c.color, transparency: 10 }, line: { color: c.color, pt: 1.2 },
    });
    s.addText(c.icon, {
      x: x + 0.25, y: y + 0.48, w: 0.85, h: 0.6,
      fontFace: "Segoe UI Emoji", fontSize: 28, color: TOKENS.ink,
      align: "center", margin: 0,
    });
    singleToken(s, `Ch.${c.n}`, {
      x: x + pw - 1.1, y: y + 0.2, w: 0.9, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: c.color, align: "right",
    });
    s.addText(c.name, {
      x: x + 0.2, y: y + 1.35, w: pw - 0.4, h: 0.4,
      fontFace: TOKENS.head, fontSize: 15, bold: true, color: TOKENS.ink,
      align: "center", margin: 0,
    });
    c.tags.forEach((t, k) => {
      const tx = x + 0.12 + k * (pw - 0.24) / 3;
      s.addShape(pptx.ShapeType.roundRect, {
        x: tx, y: y + 1.82, w: (pw - 0.3) / 3, h: 0.3,
        fill: { color: c.color, transparency: 88 },
        line: { color: c.color, pt: 0.5 }, rectRadius: 0.03,
      });
      s.addText(t, {
        x: tx, y: y + 1.85, w: (pw - 0.3) / 3, h: 0.25,
        fontFace: TOKENS.head, fontSize: 8.8, bold: true, color: c.color,
        align: "center", margin: 0,
      });
    });
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.2, y: y + 2.25, w: pw - 0.4, h: 0,
      line: { color: TOKENS.hairline, pt: 0.5 },
    });
    s.addText(c.desc, {
      x: x + 0.2, y: y + 2.4, w: pw - 0.4, h: bh - 2.6,
      fontFace: TOKENS.head, fontSize: 9.8, color: TOKENS.ink, margin: 0,
      lineSpacingMultiple: 1.35,
    });
  });

  addFooter(s, 12, "对应章节：第 19–24 章 · 行业场景对比与附录");
})();

// ============================================================
// 13 ACME 自动化 + Waiting Room (Business+) + IP Lists
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "07 · AUTOMATION", "ACME 自动化 · Waiting Room (Business+) · IP Lists 三大特色");

  const blocks = [
    {
      n: "A", name: "ACME 自动化管理证书", color: TOKENS.accent,
      bul: [
        ["证书类型", "Universal / ACM / Origin CA"],
        ["申请协议", "ACME (RFC 8555) · HTTP-01 / DNS-01"],
        ["自动续期", "30 天前 · 零停机蓝绿切换"],
        ["多 Zone", "账户级脚本批量管理"],
        ["监控", "到期告警 → Logpush → 外部 SIEM"],
      ],
    },
    {
      n: "B", name: "Waiting Room 防源站过载", color: TOKENS.caution,
      bul: [
        ["计划要求", "Business+ · Ent 增强（v3.7 修正）"],
        ["应用场景", "春运/秒杀/抢购/考试报名"],
        ["排队策略", "FIFO / 随机 / Cookie 会话时长"],
        ["品牌化", "自定义排队页面 + Logo + 文案"],
        ["配合 Bot", "先 Bot Score → 再进 Waiting Room"],
      ],
    },
    {
      n: "C", name: "IP Lists + Access Rules", color: TOKENS.positive,
      bul: [
        ["Lists 层级", "Zone 级 / 账户级（跨 Zone 共享）"],
        ["类型", "IP / ASN / Hostname / Redirect"],
        ["WAF 引用", "any(${ip.src in $list_name})"],
        ["账户级 Access Rule", "全账户 Block/Challenge/Allow"],
        ["典型用法", "Cloudflare 出向 IP 白名单（源站）"],
      ],
    },
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const gap = 0.22;
  const pw = (13.333 - 2 * x0 - 2 * gap) / 3;
  const bh = f.bottom - y0 - 0.1;

  blocks.forEach((b, i) => {
    const x = x0 + i * (pw + gap);
    const y = y0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: bh, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.1, y: y + 0.1, w: pw - 0.2, h: 0.62,
      fill: { color: b.color }, line: { color: b.color, pt: 0 }, rectRadius: 0.05,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.22, y: y + 0.18, w: 0.46, h: 0.46,
      fill: { color: "FFFFFF" }, line: { color: "FFFFFF", pt: 0 },
    });
    singleToken(s, b.n, {
      x: x + 0.22, y: y + 0.24, w: 0.46, h: 0.36,
      fontFace: TOKENS.headEn, fontSize: 18, bold: true, color: b.color, align: "center",
    });
    s.addText(b.name, {
      x: x + 0.8, y: y + 0.22, w: pw - 0.9, h: 0.42,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
    });
    b.bul.forEach((r, k) => {
      const iy = y + 0.95 + k * 0.68;
      s.addText(r[0], {
        x: x + 0.2, y: iy, w: pw - 0.4, h: 0.28,
        fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: b.color, margin: 0,
      });
      s.addText(r[1], {
        x: x + 0.2, y: iy + 0.28, w: pw - 0.4, h: 0.34,
        fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
      });
    });
  });

  addFooter(s, 13, "对应章节：第 23 章 ACME · 第 15 章 Waiting Room · 第 16–17 章 IP Lists");
})();

// ============================================================
// 14 可观测性体系（6 大来源 + Log Explorer Beta/R2 · v3.7）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "08 · OBSERVABILITY", "可观测性体系：6 大日志来源 × Log Explorer（Beta · R2 存储 · 360 天）");

  const srcs = [
    { t: "Dashboard 实时日志", s: "SAMPLED · LIVE", d: "Zone 概览 WAF/Bot/LB 事件", c: TOKENS.accent, p: "All Plans" },
    { t: "REST API", s: "HTTP REQUESTS", d: "按需 GraphQL Analytics API", c: TOKENS.caution, p: "All+" },
    { t: "Logpush", s: "PUSH → SIEM", d: "推至 S3 / Splunk / Datadog", c: TOKENS.amber, p: "Pro+ / Ent" },
    { t: "Log Explorer", s: "ENT · BETA · R2", d: "内部 SQL 查询，360 天保留", c: TOKENS.positive, p: "Enterprise" },
    { t: "Workers Logs", s: "TAIL · DEBUG", d: "wrangler tail / Logpush", c: TOKENS.risk, p: "All+" },
    { t: "Audit Logs", s: "AUDIT · 18 个月", d: "账户级配置变更审计", c: TOKENS.muted, p: "All Plans" },
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const colGap = 0.2, rowGap = 0.18;
  const colW2 = (13.333 - 2 * x0 - 2 * colGap) / 3;
  const ph = 1.38;
  const positions = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [1, 1], [2, 1],
  ];
  positions.forEach((p, idx) => {
    const [cx, cy] = p;
    const x = x0 + cx * (colW2 + colGap);
    const y = y0 + cy * (ph + rowGap);
    const sc = srcs[idx];
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: colW2, h: ph, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 0.8 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.1, h: ph, fill: { color: sc.c }, line: { color: sc.c, pt: 0 },
    });
    s.addText(sc.t, {
      x: x + 0.22, y: y + 0.12, w: colW2 - 0.7, h: 0.3,
      fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.ink, margin: 0,
    });
    singleToken(s, sc.p, {
      x: x + colW2 - 1.7, y: y + 0.12, w: 1.5, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 9, bold: true, color: sc.c, align: "right",
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.22, y: y + 0.48, w: colW2 - 0.4, h: 0.28,
      fill: { color: sc.c, transparency: 88 },
      line: { color: sc.c, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(sc.s, {
      x: x + 0.3, y: y + 0.5, w: colW2 - 0.5, h: 0.24,
      fontFace: TOKENS.headEn, fontSize: 9.5, bold: true, color: sc.c, margin: 0,
    });
    s.addText(sc.d, {
      x: x + 0.22, y: y + 0.88, w: colW2 - 0.4, h: 0.45,
      fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0,
    });
  });

  // 底部：保留期策略条 + v3.7 标注
  const bx = TOKENS.margin;
  const by = y0 + 2 * ph + 2 * rowGap + 0.02;
  s.addShape(pptx.ShapeType.roundRect, {
    x: bx, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.08,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 },
    rectRadius: 0.05,
  });
  const cols = [
    ["Dashboard", "~30 分钟采样", "实时排查"],
    ["Log Explorer", "360 天 · Beta", "Ent · R2 存储 · 合规核心"],
    ["Logpush 外置 SIEM", "≥ 3 年（自定义）", "金融/关基超长期归档"],
    ["Audit Logs", "18 个月", "账户级变更审计"],
  ];
  cols.forEach((c, i) => {
    const cw = (13.333 - 2 * TOKENS.margin - 0.4) / 4;
    const cx = bx + 0.2 + i * cw;
    s.addText(c[0], {
      x: cx, y: by + 0.1, w: cw, h: 0.28,
      fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: "left", margin: 0,
    });
    s.addText(c[1], {
      x: cx, y: by + 0.38, w: cw, h: 0.28,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: TOKENS.amber,
      align: "left", margin: 0,
    });
    s.addText(c[2], {
      x: cx, y: by + 0.7, w: cw, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.5, color: "FFFFFF",
      align: "left", margin: 0,
    });
  });

  addFooter(s, 14, "对应章节：第 25 章 · 可观测性体系（Log Explorer Beta · R2 存储 · 360 天保留）");
})();

// ============================================================
// 15 加密套件自定义 & TLS 协商（浅色代码块 · v3.7）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "09 · CIPHER SUITES", "加密套件自定义 & TLS 协商：TLS 1.2/1.3 · 合规映射 · CLI");

  // 左：Plan 能力对比
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.0, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("TLS 版本 & 套件能力（按 Plan）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 5.6, h: 0.36,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });

  const header = ["Plan", "TLS 1.2 套件顺序", "强制 1.3", "ECDH 曲线"];
  const rows = [
    ["Free", "❌ 仅预设等级", "❌", "默认"],
    ["Pro", "❌ 仅预设等级", "❌", "默认"],
    ["Business", "❌ 仅预设等级", "❌", "默认"],
    ["ACM", "✅ 自定义列表", "❌", "默认"],
    ["Ent", "✅ 自定义顺序", "✅", "✅ 自定义"],
  ];
  const x1 = TOKENS.margin;
  const y1 = f.top + 0.55;
  const colW1 = [0.9, 2.3, 1.3, 1.5];
  table(s, x1, y1, colW1, header, rows, {
    rowH: 0.38, bodyFont: 9.5,
    colorize: (cell, c) => (c >= 1 ? statusColor(cell) : null),
  });

  // 左下：合规 → 套件映射
  const y2 = y1 + 6 * 0.38 + 0.18;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: y2, w: 6.0, h: 0.36,
    fill: { color: TOKENS.caution }, line: { color: TOKENS.caution, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("合规框架 → 推荐套件", {
    x: TOKENS.margin + 0.2, y: y2 + 0.04, w: 5.6, h: 0.28,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", margin: 0,
  });
  const rules = [
    ["PCI-DSS v4.0", "TLS 1.2+ · ECDHE + AES-GCM · 禁 3DES/RC4"],
    ["等保 2.0 四级", "TLS 1.2+ · PFS + 256 位 · ECDHE"],
    ["金融等保四级", "TLS 1.2+ · PFS · 国密可选"],
    ["关基条例", "TLS 1.2+ · PFS + AEAD"],
  ];
  rules.forEach((r, i) => {
    const ry = y2 + 0.46 + i * 0.32;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y: ry, w: 6.0, h: 0.3,
      fill: { color: i % 2 === 0 ? TOKENS.panel : TOKENS.tintSoft },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(r[0], {
      x: TOKENS.margin + 0.1, y: ry + 0.04, w: 2.0, h: 0.24,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(r[1], {
      x: TOKENS.margin + 2.1, y: ry + 0.04, w: 3.8, h: 0.24,
      fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0,
    });
  });

  // 右：浅色 CLI 代码块
  const rx = 13.333 - TOKENS.margin - 6.15;
  const lines = [
    ["# 查看当前 cipher 配置", TOKENS.muted],
    ["cfcli ssl ciphers get --zone nc-demo.cf", TOKENS.ink],
    ["", TOKENS.ink],
    ["# 金融等保四级：仅保留 AEAD+PFS 强套件", TOKENS.muted],
    ["cfcli ssl ciphers set --zone fin.nc-demo.cf \\", TOKENS.ink],
    ["  --level custom \\", TOKENS.ink],
    ["  --ciphers \"ECDHE-ECDSA-AES256-GCM-SHA384,", TOKENS.accent],
    ["  ECDHE-RSA-AES256-GCM-SHA384,", TOKENS.accent],
    ["  ECDHE-ECDSA-AES128-GCM-SHA256\"", TOKENS.accent],
    ["", TOKENS.ink],
    ["# Enterprise：强制 TLS 1.3", TOKENS.muted],
    ["cfcli ssl tls-version set --zone nc-demo.cf \\", TOKENS.ink],
    ["  --min 1.3 --max 1.3", TOKENS.ink],
    ["", TOKENS.ink],
    ["# 故障排查：ERR_CIPHER_MISMATCH", TOKENS.muted],
    ["cfcli logs explorer --dataset http --sql \\", TOKENS.ink],
    ["  \"SELECT ClientSSLCipher FROM http\"", TOKENS.accent],
  ];
  codeBlock(s, rx, f.top, 6.15, f.bottom - f.top, "$ cfcli · 加密套件命令", lines);

  addFooter(s, 15, "对应章节：第 26 章 · 加密套件自定义与 TLS 协商深度解析");
})();

// ============================================================
// 16 SSL/TLS 四种模式 + Automatic SSL/TLS（v3.7）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "10 · SSL/TLS MODES", "SSL/TLS 四种模式 + Automatic SSL/TLS（2026 新特性 · v3.7）");

  // 顶部 v3.7 新特性条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 13.333 - 2 * TOKENS.margin, h: 0.42,
    fill: { color: TOKENS.tintAmber }, line: { color: TOKENS.amber, pt: 0.8 }, rectRadius: 0.05,
  });
  singleToken(s, "v3.7 新特性", {
    x: TOKENS.margin + 0.2, y: f.top + 0.06, w: 1.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.amber,
  });
  s.addText("Automatic SSL/TLS（默认模式）：SSL/TLS Recommender 自动探测源站证书能力并选择最安全的加密模式；未迁移的 Zone 仍使用 Custom SSL/TLS（手动四模式）。两种模式下四种加密级别行为一致。", {
    x: TOKENS.margin + 1.9, y: f.top + 0.06, w: 13.333 - 2 * TOKENS.margin - 2.1, h: 0.3,
    fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0,
  });

  // 4 列模式卡
  const modes = [
    { n: "Off",      c: TOKENS.risk,     c1: "HTTP",  c2: "HTTP",   cert: "无",  rank: "1/4" },
    { n: "Flexible", c: TOKENS.caution,  c1: "HTTPS", c2: "HTTP⚠️", cert: "无",  rank: "2/4" },
    { n: "Full",     c: TOKENS.amber,    c1: "HTTPS", c2: "HTTPS",  cert: "自签/任意", rank: "3/4" },
    { n: "Full(Str)",c: TOKENS.positive, c1: "HTTPS", c2: "HTTPS✅", cert: "公网/Origin CA", rank: "4/4" },
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.55;
  const gap = 0.16;
  const pw = (13.333 - 2 * x0 - 3 * gap) / 4;
  const ch = 2.05;

  modes.forEach((m, i) => {
    const x = x0 + i * (pw + gap);
    const y = y0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: ch, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.08, y: y + 0.08, w: pw - 0.16, h: 0.55,
      fill: { color: m.c }, line: { color: m.c, pt: 0 }, rectRadius: 0.04,
    });
    s.addText(m.n, {
      x: x + 0.15, y: y + 0.16, w: pw - 0.3, h: 0.42,
      fontFace: TOKENS.head, fontSize: 17, bold: true, color: "FFFFFF",
      align: "left", margin: 0,
    });
    singleToken(s, `等级 ${m.rank}`, {
      x: x + pw - 1.2, y: y + 0.2, w: 1.0, h: 0.36,
      fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: "FFFFFF", align: "right",
    });
    const rows = [
      ["访客→Edge", m.c1], ["Edge→Origin", m.c2], ["源站证书", m.cert],
    ];
    rows.forEach((r, k) => {
      const ry = y + 0.8 + k * 0.4;
      s.addText(r[0], {
        x: x + 0.15, y: ry, w: pw * 0.42, h: 0.26,
        fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted, margin: 0,
      });
      s.addText(r[1], {
        x: x + pw * 0.42, y: ry, w: pw * 0.5, h: 0.3,
        fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.ink,
        align: "right", margin: 0,
      });
    });
  });

  // 安全等级提示
  const by = y0 + ch + 0.2;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintBlue }, line: { color: TOKENS.rule, pt: 0.5 }, rectRadius: 0.05,
  });
  const facts = [
    ["安全等级", "Off < Flexible < Full < Full Strict"],
    ["合规要求", "Off / Flexible 不满足任何合规框架"],
    ["生产推荐", "Full (Strict) 是唯一推荐的生产模式"],
    ["黄金组合", "Full Strict + AOP + Origin CA + ACM 自动续期"],
  ];
  facts.forEach((fc, i) => {
    const fx = TOKENS.margin + 0.25 + (i % 2) * 6.2;
    const fy = by + 0.15 + Math.floor(i / 2) * 0.42;
    singleToken(s, fc[0], {
      x: fx, y: fy, w: 1.3, h: 0.3,
      fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.accent,
    });
    s.addText(fc[1], {
      x: fx + 1.35, y: fy, w: 4.7, h: 0.3,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 16, "对应章节：第 27 章 · SSL/TLS 四种模式 + Automatic SSL/TLS（2026）");
})();

// ============================================================
// 17 模式 × 合规框架交叉对照（v3.7 新增）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "10 · SSL/TLS MODES", "模式 × 合规框架交叉对照：唯一合规 = Full (Strict)");

  const header = ["合规框架", "Off", "Flexible", "Full", "Full (Strict)", "备注"];
  const rows = [
    ["PCI-DSS v4.0 Req 3.4", "❌", "❌", "❌", "✅", "禁明文传输持卡人数据"],
    ["PCI-DSS v4.0 Req 4",   "❌", "❌", "❌", "✅", "强加密 + 可信密钥管理"],
    ["等保 2.0 三级 8.1.8",   "❌", "❌", "⚠️", "✅", "Full 不验证有理论风险"],
    ["等保 2.0 四级 8.1.7",   "❌", "❌", "❌", "✅", "双向身份鉴别 + 强加密"],
    ["关基条例 第 22 条",     "❌", "❌", "❌", "✅", "端到端验证"],
    ["金融等保四级 JR/T 0171","❌", "❌", "❌", "✅", "支付核心端到端 + 双向"],
    ["支付行业监管 (OR-6)",   "❌", "❌", "❌", "✅", "禁明文 + 端点验证"],
    ["PDPO（香港私隐）",      "❌", "❌", "⚠️", "✅", "Full 有争议"],
    ["GDPR Art 32",          "❌", "❌", "⚠️", "✅", "加密 + 端点验证"],
    ["医疗等保 / HIPAA",     "❌", "❌", "❌", "✅", "PHI 端到端加密"],
  ];
  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const colW = [3.0, 0.85, 1.0, 0.85, 1.2, 5.28];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.4, bodyFont: 9.5,
    colorize: (cell, c) => {
      if (c >= 1 && c <= 4) return statusColor(cell);
      return null;
    },
  });

  // 底部结论
  const by = y0 + 11 * 0.4 + 0.12;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("关键结论：Full (Strict) 是唯一满足所有合规框架（PCI-DSS / 等保 / 关基 / 金融 / 支付 / GDPR / HIPAA）的 SSL/TLS 模式。Off 与 Flexible 在任何合规场景下均违规。", {
    x: TOKENS.margin + 0.25, y: by + 0.15, w: 13.333 - 2 * TOKENS.margin - 0.5, h: 0.5,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.25,
  });

  addFooter(s, 17, "对应章节：第 27.4 节 · 模式 × 合规框架交叉对照表");
})();

// ============================================================
// 18 渐进式迁移 3 阶段
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "10 · SSL/TLS MODES", "渐进式迁移 3 阶段：Flexible → Full → Full (Strict) + AOP");

  const ty = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: ty, w: 13.333 - 2 * TOKENS.margin, h: 0.42,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("🚀  渐进式迁移 3 阶段 + 紧急回滚流程", {
    x: TOKENS.margin + 0.2, y: ty + 0.04, w: 13.333 - 2 * TOKENS.margin - 0.4, h: 0.34,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });

  const phases = [
    { n: "0", name: "现状评估", t: "T+0",        c: TOKENS.muted,    d: "cfcli ssl get-mode · 源站 TLS 健康检查 · 确认 443 可达" },
    { n: "1", name: "切 Full",  t: "1–2 周",     c: TOKENS.caution,  d: "部署 Origin CA 证书（15年） · cfcli ssl set-mode full · 观察 48h" },
    { n: "2", name: "切 Full Strict", t: "2–4 周", c: TOKENS.amber,   d: "Page Rule 灰度 test.* → 监控 525 错误 → 全站切换" },
    { n: "3", name: "启用 AOP", t: "持续",       c: TOKENS.positive, d: "Authenticated Origin Pulls 双向认证闭环 · 合规行业必选" },
  ];
  const gap = 0.16;
  const pw2 = (13.333 - 2 * TOKENS.margin - 3 * gap) / 4;
  const py0 = ty + 0.6;
  phases.forEach((p, i) => {
    const x = TOKENS.margin + i * (pw2 + gap);
    const y = py0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw2, h: 2.3, fill: { color: TOKENS.panel },
      line: { color: TOKENS.hairline, pt: 0.8 }, rectRadius: 0.05,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.15, y: y + 0.15, w: 0.5, h: 0.5,
      fill: { color: p.c }, line: { color: p.c, pt: 0 },
    });
    singleToken(s, p.n, {
      x: x + 0.15, y: y + 0.22, w: 0.5, h: 0.36,
      fontFace: TOKENS.headEn, fontSize: 18, bold: true, color: "FFFFFF", align: "center",
    });
    singleToken(s, p.t, {
      x: x + pw2 - 1.3, y: y + 0.22, w: 1.1, h: 0.36,
      fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: p.c, align: "right",
    });
    s.addText(p.name, {
      x: x + 0.18, y: y + 0.8, w: pw2 - 0.36, h: 0.3,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addText(p.d, {
      x: x + 0.18, y: y + 1.15, w: pw2 - 0.36, h: 1.0,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.muted, margin: 0,
      lineSpacingMultiple: 1.3,
    });
    if (i < 3) {
      s.addShape(pptx.ShapeType.chevron, {
        x: x + pw2, y: y + 1.0, w: gap, h: 0.36,
        fill: { color: TOKENS.rule, transparency: 40 },
        line: { color: TOKENS.rule, transparency: 40, pt: 0 },
      });
    }
  });

  // 底部紧急回滚
  const by = py0 + 2.3 + 0.2;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.tintRed }, line: { color: TOKENS.risk, pt: 0.6 }, rectRadius: 0.05,
  });
  singleToken(s, "↩ 紧急回滚", {
    x: TOKENS.margin + 0.25, y: by + 0.1, w: 1.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.risk,
  });
  const rollbacks = [
    "Full Strict → Full：cfcli ssl set-mode --mode full（< 1 分钟生效）",
    "Full → Flexible：cfcli ssl set-mode --mode flexible（< 1 分钟生效）",
    "源站证书回退（Nginx）：nginx -c ssl.rollback.conf && nginx -s reload（< 30 秒）",
    "紧急切回 80：注释 listen 443 + 恢复 listen 80（< 1 分钟）",
  ];
  rollbacks.forEach((r, i) => {
    const rx = TOKENS.margin + 0.25 + (i % 2) * 6.2;
    const ry = by + 0.42 + Math.floor(i / 2) * 0.36;
    s.addText(`• ${r}`, {
      x: rx, y: ry, w: 6.0, h: 0.32,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 18, "对应章节：第 27.5 节 · 渐进式迁移策略 + 紧急回滚流程");
})();

// ============================================================
// 19 常见陷阱 & 最佳实践
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "11 · BEST PRACTICE", "常见 5 大陷阱 · 7 条最佳实践 · 安全决策清单");

  // 左：陷阱 5 条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.0, h: 0.38,
    fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("✗  5 大常见陷阱", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 5.6, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const traps = [
    "Flexible ≠ 安全（Edge→Origin 仍是明文）",
    "Full + 自签 ≠ 安全（不验证 = 可 MITM）",
    "Origin CA 证书链错误 → 切 Strict 525",
    "Strict 下证书过期 → 全站 525 中断",
    "Off/Flexible 下启用 AOP 不生效",
  ];
  traps.forEach((t, i) => {
    const y = f.top + 0.52 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 6.0, h: 0.44,
      fill: { color: TOKENS.tintRed }, line: { color: "F0D6D5", pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: TOKENS.margin + 0.15, y: y + 0.13, w: 0.18, h: 0.18,
      fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 },
    });
    s.addText(`0${i + 1}  ${t}`, {
      x: TOKENS.margin + 0.45, y: y + 0.1, w: 5.4, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0,
    });
  });

  // 右：最佳实践 7 条
  s.addShape(pptx.ShapeType.roundRect, {
    x: 13.333 - TOKENS.margin - 6.15, y: f.top, w: 6.15, h: 0.38,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("✓  7 条最佳实践", {
    x: 13.333 - TOKENS.margin - 6.15 + 0.2, y: f.top + 0.04, w: 5.8, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const best = [
    "默认 Full (Strict)；无合规豁免不得降级",
    "配 Authenticated Origin Pulls 双向认证",
    "Origin CA（15 年）+ ACM 自动续期",
    "迁移 3 阶段灰度，每阶段 ≥ 7 天",
    "每日 Log Explorer 监控 525/526/502",
    "敏感接口叠 API Shield mTLS（APP/IoT）",
    "每年 CAB 变更评审 + 回滚演练",
  ];
  best.forEach((t, i) => {
    const y = f.top + 0.52 + i * 0.35;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 13.333 - TOKENS.margin - 6.15, y, w: 6.15, h: 0.32,
      fill: { color: TOKENS.tintGreen }, line: { color: "D2E6DC", pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: 13.333 - TOKENS.margin - 6.15 + 0.12, y: y + 0.09, w: 0.14, h: 0.14,
      fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 },
    });
    s.addText(t, {
      x: 13.333 - TOKENS.margin - 6.15 + 0.35, y: y + 0.05, w: 5.7, h: 0.24,
      fontFace: TOKENS.head, fontSize: 9.8, color: TOKENS.ink, margin: 0,
      bold: i < 2,
    });
  });

  // 底部：525 监控告警（浅色）
  const bx = TOKENS.margin;
  const by = f.bottom - 0.55;
  s.addShape(pptx.ShapeType.roundRect, {
    x: bx, y: by, w: 13.333 - 2 * TOKENS.margin, h: 0.5,
    fill: { color: TOKENS.tintBlue }, line: { color: TOKENS.accent, pt: 0.8 }, rectRadius: 0.05,
  });
  singleToken(s, "⚠ 525 监控", {
    x: bx + 0.25, y: by + 0.1, w: 1.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.accent,
  });
  s.addText("切 Strict 后必配：Logpush / SIEM 配置 525 错误率 ≥ 1% 告警 · cfcli logs explorer --sql \"WHERE EdgeResponseStatus=525\"", {
    x: bx + 2.0, y: by + 0.12, w: 13.333 - 2 * TOKENS.margin - 2.2, h: 0.28,
    fontFace: TOKENS.mono, fontSize: 9.5, color: TOKENS.ink, margin: 0,
  });

  addFooter(s, 19, "对应章节：第 27.7 节 · 常见陷阱与最佳实践");
})();

// ============================================================
// 20 CLI 速查 + 决策建议 / Q&A
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "11 · BEST PRACTICE", "CLI 速查 · 决策建议 · Q & A");

  // 左：CLI 速查（浅色面板）
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 7.2, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("常用 cfcli 速查", {
    x: TOKENS.margin + 0.2, y: f.top + 0.04, w: 6.8, h: 0.36,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });
  const cmdGroups = [
    { cat: "SSL 模式", cmds: [
      "cfcli ssl get-mode --zone nc-demo.cf",
      "cfcli ssl set-mode --zone nc-demo.cf --mode full-strict",
    ]},
    { cat: "证书管理", cmds: [
      "cfcli certificate origin-create --validity 5475   # 15年",
      "cfcli certificate total-tls enable --ca lets_encrypt",
    ]},
    { cat: "AOP / mTLS", cmds: [
      "cfcli ssl aop enable --zone nc-demo.cf   # AOP 双向认证",
      "cfcli ssl client-cert create --name \"api-users\"",
    ]},
    { cat: "日志查询", cmds: [
      "cfcli logs explorer --sql \"WHERE EdgeStatus=525\"",
      "cfcli logs tail --filter \"WAFAction eq 'block'\"",
    ]},
    { cat: "加密套件", cmds: [
      "cfcli ssl ciphers get --zone nc-demo.cf",
      "cfcli ssl tls-version set --min 1.2 --max 1.3",
    ]},
  ];
  let cy = f.top + 0.55;
  cmdGroups.forEach((g) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin + 0.1, y: cy, w: 1.4, h: 0.28,
      fill: { color: TOKENS.tintAmber }, line: { color: TOKENS.amber, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(g.cat, {
      x: TOKENS.margin + 0.15, y: cy + 0.03, w: 1.3, h: 0.22,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: TOKENS.caution, align: "center", margin: 0,
    });
    g.cmds.forEach((c, i) => {
      s.addText(`$ ${c}`, {
        x: TOKENS.margin + 1.65, y: cy + i * 0.24, w: 5.5, h: 0.22,
        fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.ink, margin: 0, wrap: false,
      });
    });
    cy += 0.24 * g.cmds.length + 0.1;
  });

  // 右：Q&A + 决策建议
  const rx = 13.333 - TOKENS.margin - 5.3;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 5.3, h: f.bottom - f.top,
    fill: { color: TOKENS.tintWarm }, line: { color: TOKENS.amber, pt: 1 }, rectRadius: 0.06,
  });
  s.addText("Q & A", {
    x: rx + 0.3, y: f.top + 0.25, w: 4.7, h: 0.8,
    fontFace: TOKENS.headEn, fontSize: 44, bold: true, color: TOKENS.amber, margin: 0,
  });
  s.addShape(pptx.ShapeType.line, {
    x: rx + 0.3, y: f.top + 1.15, w: 4.7, h: 0,
    line: { color: TOKENS.amber, pt: 1.5 },
  });
  s.addText("决策建议", {
    x: rx + 0.3, y: f.top + 1.3, w: 4.7, h: 0.4,
    fontFace: TOKENS.head, fontSize: 16, bold: true, color: TOKENS.ink, margin: 0,
  });
  s.addText("立即启动 3 阶段迁移；目标态：Full (Strict) + AOP + ACM + Log Explorer。\n\n所有变更须经 CAB 评审并执行回滚演练。\n\n金融 / 支付 / 关基行业必选 AOP + 自上传证书（FIPS 合规）。", {
    x: rx + 0.3, y: f.top + 1.8, w: 4.7, h: 1.8,
    fontFace: TOKENS.head, fontSize: 11, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.4,
  });
  // v3.7 标签
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx + 0.3, y: f.bottom - 0.6, w: 2.2, h: 0.36,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 }, rectRadius: 0.04,
  });
  singleToken(s, "v3.7 · 27 章 · 20 页", {
    x: rx + 0.3, y: f.bottom - 0.55, w: 2.2, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: "FFFFFF", align: "center",
  });

  addFooter(s, 20, "文档 & CAB：nc-demo.cf / CAB_NC_DEMO_CF.md · REQUEST_FLOW_GUIDE.md v3.7");
})();

// ========== 输出 ==========
const OUT = path.join(__dirname, "Cloudflare_请求链路完全指南_v3.7.pptx");
await pptx.writeFile({ fileName: OUT });
console.log("✅ PPT 生成：", OUT);
