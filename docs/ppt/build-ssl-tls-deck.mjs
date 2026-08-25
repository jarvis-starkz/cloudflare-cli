// =================================================================
// Cloudflare SSL/TLS 完全指南 v1.3 — 完整版亮色调 PPT
// PptxGenJS · 16:9 · 13.333" x 7.5"
// 风格：严谨、秩序、克制 | 配色：米白底 + 钢蓝 + 琥珀 + 语义绿/琥珀/红
// 严格亮色调：禁止深蓝/墨蓝/黑色作为背景；代码块一律浅底深字
// =================================================================
import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_IMG = path.join(__dirname, "assets", "cover-kv.jpg");

// ---------- 设计 Token（亮色调正式工作汇报配方）----------
const TOKENS = {
  // Palette roles
  surface:    "FFFDF7", // warm off-white background
  panel:      "FFFFFF", // pure white panels
  panelSoft:  "F4F6FA", // soft blue-gray sub-panel
  panelCream: "FAFAF6", // alt row cream
  codePanel:  "EEF3F8", // light code block background
  bandBlue:   "EEF3F8", // light blue band
  // Text
  ink:        "1B2A41", // near-black navy text
  muted:      "5C6F8C", // secondary text
  accent:     "2C5F8F", // deep steel blue primary
  accentDark: "1E4466",
  amber:      "C88A2C", // restrained amber
  // Semantic status
  positive:   "2E7D5B", // green OK
  positiveBg: "E7F2EC",
  caution:    "B58900", // amber warning
  cautionBg:  "FBF4E0",
  risk:       "A8322F", // red risk
  riskBg:     "FBECEB",
  // Lines
  hairline:   "D6DBE4",
  rule:       "9AA7BD",
  // Spacing (inch)
  margin:     0.55,
  titleGap:   0.28,
  sectionW:   2.6,
  // Typography
  head:       "Microsoft YaHei", // 中文主字体
  headEn:     "Calibri",
  mono:       "Consolas",
};

const W = 13.333; // slide width
const H = 7.5;   // slide height
const CONTENT_W = W - 2 * TOKENS.margin;

// ---------- 工具函数 ----------
const addSingleLineToken = (slide, text, opts) => {
  const defaults = { margin: 0, wrap: false, vert: "horz", fit: "shrink" };
  slide.addText(text, { ...defaults, ...opts });
};

const addFooter = (slide, pageNum, totalPages, source) => {
  const x = TOKENS.margin;
  const y = 7.1;
  const w = CONTENT_W;
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h: 0, line: { color: TOKENS.hairline, pt: 0.75 },
  });
  if (source) {
    slide.addText(source, {
      x, y: y + 0.06, w: w * 0.62, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 9, color: TOKENS.muted, margin: 0, wrap: false,
    });
  }
  addSingleLineToken(slide, `${pageNum} / ${totalPages}`, {
    x: x + w * 0.72, y: y + 0.06, w: w * 0.28, h: 0.3,
    fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.muted, align: "right",
  });
};

const addClaimBand = (slide, sectionLabel, claim, claimFontSize = 26) => {
  const x = TOKENS.margin;
  const ySec = 0.4;
  const hSec = 0.32;
  addSingleLineToken(slide, sectionLabel.toUpperCase(), {
    x, y: ySec, w: TOKENS.sectionW, h: hSec,
    fontFace: TOKENS.headEn, fontSize: 10, bold: true,
    color: TOKENS.accent, align: "left",
  });
  slide.addShape(pptx.ShapeType.line, {
    x, y: ySec + hSec - 0.02, w: 0.55, h: 0,
    line: { color: TOKENS.amber, pt: 2 },
  });
  slide.addText(claim, {
    x, y: ySec + hSec + 0.04, w: CONTENT_W, h: 0.58,
    fontFace: TOKENS.head, fontSize: claimFontSize, bold: true,
    color: TOKENS.ink, margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    x, y: 1.55, w: CONTENT_W, h: 0,
    line: { color: TOKENS.hairline, pt: 0.5 },
  });
  return { top: 1.75, bottom: 7.05 }; // content field area
};

// 浅底代码块（严格亮色调，禁止深色背景）
const addLightCodeBlock = (slide, x, y, w, h, title, lines, opts = {}) => {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: TOKENS.codePanel },
    line: { color: TOKENS.hairline, pt: 1 },
    rectRadius: 0.06,
  });
  // 左侧琥珀色 accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x, y: y + 0.08, w: 0.06, h: h - 0.16,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 },
  });
  if (title) {
    addSingleLineToken(slide, title, {
      x: x + 0.22, y: y + 0.13, w: w * 0.7, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: TOKENS.accent,
    });
  }
  const lineH = opts.lineH || 0.24;
  const padTop = title ? 0.5 : 0.2;
  const padX = 0.28;
  lines.forEach((ln, i) => {
    const [text, color] = Array.isArray(ln) ? ln : [ln, TOKENS.ink];
    slide.addText(text, {
      x: x + padX, y: y + padTop + i * lineH, w: w - padX - 0.2, h: lineH,
      fontFace: TOKENS.mono, fontSize: opts.fontSize || 9.5,
      color, margin: 0, wrap: false,
    });
  });
};

// 单元格语义着色
const cellColor = (text) => {
  if (!text) return { fill: TOKENS.panel, ink: TOKENS.ink };
  const t = String(text);
  if (t.startsWith("✅")) return { fill: TOKENS.positiveBg, ink: TOKENS.positive };
  if (t.startsWith("❌")) return { fill: TOKENS.riskBg, ink: TOKENS.risk };
  if (t.startsWith("⚠")) return { fill: TOKENS.cautionBg, ink: TOKENS.caution };
  if (/^★/.test(t))   return { fill: "E9EFF7", ink: TOKENS.accent };
  return { fill: TOKENS.panel, ink: TOKENS.ink };
};

// 简易表格绘制（header + body rows，列宽自适应）
const drawTable = (slide, header, rows, colW, opts = {}) => {
  const x0 = opts.x ?? TOKENS.margin;
  const y0 = opts.y ?? 1.8;
  const rowH = opts.rowH || 0.42;
  const headerH = opts.headerH || rowH + 0.04;
  let cx = x0;
  const colX = colW.map(w => { const r = cx; cx += w; return r; });
  // Header
  header.forEach((h, i) => {
    const fill = i === 0 ? TOKENS.accentDark : TOKENS.accent;
    slide.addShape(pptx.ShapeType.rect, {
      x: colX[i], y: y0, w: colW[i], h: headerH,
      fill: { color: fill }, line: { color: fill, pt: 0 },
    });
    slide.addText(h, {
      x: colX[i] + 0.1, y: y0 + 0.08, w: colW[i] - 0.2, h: headerH - 0.16,
      fontFace: opts.headerFont || TOKENS.head, fontSize: 11, bold: true,
      color: "FFFFFF", align: i === 0 ? "left" : "center", margin: 0, wrap: false,
    });
  });
  // Body
  rows.forEach((row, rIdx) => {
    const y = y0 + headerH + rIdx * rowH;
    const altBg = rIdx % 2 === 0 ? TOKENS.panel : TOKENS.panelCream;
    row.forEach((cell, cIdx) => {
      const t = String(cell);
      let fill = altBg, ink = TOKENS.ink, bold = false;
      if (opts.semantic && cIdx >= 1) {
        const cc = cellColor(t);
        fill = cc.fill; ink = cc.ink;
      }
      if (cIdx === 0) { fill = altBg; ink = TOKENS.ink; bold = true; }
      slide.addShape(pptx.ShapeType.rect, {
        x: colX[cIdx], y, w: colW[cIdx], h: rowH,
        fill: { color: fill }, line: { color: TOKENS.hairline, pt: 0.5 },
      });
      const align = (cIdx === 0 || (opts.leftCols && opts.leftCols.includes(cIdx))) ? "left" : "center";
      slide.addText(t, {
        x: colX[cIdx] + 0.1, y: y + 0.07, w: colW[cIdx] - 0.2, h: rowH - 0.12,
        fontFace: (opts.codeCols && opts.codeCols.includes(cIdx)) ? TOKENS.mono : (cIdx === 0 ? TOKENS.head : TOKENS.headEn),
        fontSize: opts.fontSize || 10, bold: bold || (opts.boldCols && opts.boldCols.includes(cIdx)),
        color: ink, align, margin: 0, wrap: opts.wrap ?? false,
      });
    });
  });
  return { bottom: y0 + headerH + rows.length * rowH };
};

// ========== 初始化 deck ==========
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pptx.author = "nc-demo.cf Security Team";
pptx.company = "NC Services Limited";
pptx.subject = "Cloudflare SSL/TLS 完全指南 v1.3";
pptx.title = "Cloudflare SSL/TLS 完全指南 v1.3 完整版";

const TOTAL_PAGES = 20;
const FOOTER_SRC = "资料来源：Cloudflare SSL/TLS 完全指南 v1.3 · cfcli v1.0.0 · 2026-08-17";

// ============================================================
// 01 封面（亮色调：底部米白信息带 + 深色文字）
// ============================================================
(() => {
  const s = pptx.addSlide();
  // 满版 KV 图（上部）
  s.addImage({ path: COVER_IMG, x: 0, y: 0, w: W, h: 5.55 });
  // 底部米白信息带（严格亮色调，深色文字）
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.55, w: W, h: 1.95,
    fill: { color: TOKENS.surface }, line: { color: TOKENS.surface, pt: 0 },
  });
  // 顶部琥珀色 accent 细线（分隔图与信息带）
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.55, w: W, h: 0.06,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 },
  });
  addSingleLineToken(s, "NC-DEMO.CF  ·  ENTERPRISE SECURITY  ·  v1.3 完整版", {
    x: TOKENS.margin, y: 5.78, w: 10, h: 0.3,
    fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: TOKENS.accent,
  });
  s.addText("Cloudflare SSL/TLS 完全指南", {
    x: TOKENS.margin, y: 6.1, w: 11, h: 0.62,
    fontFace: TOKENS.head, fontSize: 30, bold: true, color: TOKENS.ink, margin: 0,
  });
  s.addText("概念 · 模式 · 加密套件 · 证书管理 · 合规对齐 · 迁移策略", {
    x: TOKENS.margin, y: 6.74, w: 12, h: 0.36,
    fontFace: TOKENS.head, fontSize: 14, color: TOKENS.muted, margin: 0,
  });
  addSingleLineToken(s, "2026-08-17   |   v1.3   |   完整版决策汇报", {
    x: TOKENS.margin, y: 7.14, w: 8, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.rule,
  });
  addSingleLineToken(s, "Cloudflare Docs", {
    x: W - TOKENS.margin - 3, y: 7.14, w: 3, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.rule, align: "right",
  });
})();

// ============================================================
// 02 文档地图：11 章 + v1.3 完整版徽标
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "00 · DOCUMENT MAP", "11 章全景：从基础概念到合规对齐与迁移", 24);

  const chapters = [
    { n: "01", t: "SSL/TLS 基础概念", d: "加密 / 身份 / 完整性 + DV·OV·EV" },
    { n: "02", t: "Cloudflare 两个证书", d: "边缘证书 + 源站证书 = 两段 TLS" },
    { n: "03", t: "证书自动更新机制", d: "Universal / Total TLS / ACM 续期" },
    { n: "04", t: "公钥和私钥", d: "密钥对 / CSR / 自定义证书上传" },
    { n: "05", t: "加密套件 5.1–5.8", d: "TLS 1.2/1.3 套件 + 自定义 + 合规" },
    { n: "06", t: "供应商证书限制", d: "PEM / 证书链 / 密钥类型 / 通配符" },
    { n: "07", t: "ACM 高级证书管理", d: "多级子域 + 自定义 CA + 配额" },
    { n: "08", t: "mTLS 双向认证", d: "AOP 源站 + Client Cert API Shield" },
    { n: "09", t: "限制来源到 Origin", d: "6 方法 + 9.7 四模式场景对比" },
    { n: "10", t: "常见问题 FAQ", d: "Universal vs Total TLS / mTLS 差异" },
    { n: "11", t: "故障排查 + CLI 速查", d: "5.7 矩阵 + Log Explorer (Beta)" },
    { n: "★",  t: "v1.3 完整版", d: "覆盖全章 · 亮色调 · 20 页" },
  ];

  const cols = 4, rowsN = 3;
  const gap = 0.18;
  const cw = (CONTENT_W - (cols - 1) * gap) / cols;
  const ch = 1.62;
  const top = f.top + 0.05;
  chapters.forEach((c, i) => {
    const r = Math.floor(i / cols), col = i % cols;
    const x = TOKENS.margin + col * (cw + gap);
    const y = top + r * (ch + gap);
    const isBadge = c.n === "★";
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cw, h: ch, fill: { color: TOKENS.panel },
      line: { color: isBadge ? TOKENS.amber : TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.12, y: y + 0.12, w: 0.5, h: 0.5,
      fill: { color: isBadge ? TOKENS.amber : TOKENS.accent },
      line: { color: isBadge ? TOKENS.amber : TOKENS.accent, pt: 0 }, rectRadius: 0.05,
    });
    addSingleLineToken(s, c.n, {
      x: x + 0.12, y: y + 0.18, w: 0.5, h: 0.4,
      fontFace: TOKENS.headEn, fontSize: 16, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(c.t, {
      x: x + 0.7, y: y + 0.16, w: cw - 0.85, h: 0.42,
      fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addText(c.d, {
      x: x + 0.18, y: y + 0.72, w: cw - 0.36, h: 0.78,
      fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted, margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  addFooter(s, 2, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 03 SSL/TLS 基础概念 + 证书验证级别
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "01 · FUNDAMENTALS", "SSL/TLS 基础：加密 / 身份 / 完整性 + 三级证书验证", 22);

  // 左：没有 vs 有 SSL/TLS
  const lx = TOKENS.margin, ly = f.top, lw = 6.0;
  s.addShape(pptx.ShapeType.roundRect, {
    x: lx, y: ly, w: lw, h: 0.42,
    fill: { color: TOKENS.accentDark }, line: { color: TOKENS.accentDark, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("没有 SSL/TLS  vs  有 SSL/TLS", {
    x: lx + 0.2, y: ly + 0.06, w: lw - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });
  const pairs = [
    ["数据明文传输，任何人可以窃听", "数据加密传输，即使被截获也无法读取", false],
    ["无法验证服务器身份",           "证书证明服务器真实身份",           true],
    ["数据可能被篡改",               "数据完整性受到保护",               false],
  ];
  pairs.forEach((p, i) => {
    const y = ly + 0.58 + i * 0.92;
    // 左格（风险）
    s.addShape(pptx.ShapeType.roundRect, {
      x: lx, y, w: (lw - 0.2) / 2, h: 0.8,
      fill: { color: TOKENS.riskBg }, line: { color: "F0D6D5", pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText("✗ " + p[0], {
      x: lx + 0.15, y: y + 0.18, w: (lw - 0.2) / 2 - 0.3, h: 0.5,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.risk, margin: 0, lineSpacingMultiple: 1.2,
    });
    // 右格（正向）
    s.addShape(pptx.ShapeType.roundRect, {
      x: lx + (lw - 0.2) / 2 + 0.2, y, w: (lw - 0.2) / 2, h: 0.8,
      fill: { color: TOKENS.positiveBg }, line: { color: "D2E6DC", pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText("✓ " + p[1], {
      x: lx + (lw - 0.2) / 2 + 0.35, y: y + 0.18, w: (lw - 0.2) / 2 - 0.3, h: 0.5,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.positive, margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  // 右：证书验证级别表
  const rx = 6.95, ry = f.top;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: ry, w: 5.85, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("证书验证级别：DV · OV · EV", {
    x: rx + 0.2, y: ry + 0.06, w: 5.5, h: 0.32,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", margin: 0,
  });
  drawTable(s,
    ["类型", "全称", "验证内容", "适用场景"],
    [
      ["DV", "Domain Validated", "仅验证域名所有权", "个人网站 / 博客"],
      ["OV", "Organization Validated", "域名 + 组织身份", "企业官网"],
      ["EV", "Extended Validation", "最严格 + 组织身份", "银行 / 电商"],
    ],
    [0.85, 2.0, 1.8, 1.2],
    { x: rx, y: ry + 0.58, rowH: 0.62, fontSize: 10, wrap: true }
  );
  // 提示条
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.bottom - 0.55, w: 5.85, h: 0.5,
    fill: { color: TOKENS.cautionBg }, line: { color: "EAD9A8", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("Cloudflare 免费证书（Universal / Total TLS / Advanced）均为 DV 级别；OV/EV 需上传 Custom Certificate。", {
    x: rx + 0.18, y: f.bottom - 0.52, w: 5.5, h: 0.44,
    fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.caution, margin: 0, lineSpacingMultiple: 1.15,
  });

  addFooter(s, 3, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 04 Cloudflare 的两个证书（两段连接）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "02 · TWO CERTIFICATES", "反向代理 = 两段 TLS 连接 = 两套证书", 24);

  // 中央链路示意图
  const dy = f.top + 0.05;
  const nodes = [
    { x: 0.9,  label: "访客浏览器",   sub: "Browser" },
    { x: 5.55, label: "Cloudflare",   sub: "Edge" },
    { x: 10.2, label: "源站服务器",   sub: "Origin" },
  ];
  const boxW = 2.55, boxH = 1.1;
  nodes.forEach(n => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: n.x, y: dy, w: boxW, h: boxH,
      fill: { color: TOKENS.panel }, line: { color: TOKENS.accent, pt: 1 }, rectRadius: 0.08,
    });
    s.addText(n.label, {
      x: n.x, y: dy + 0.18, w: boxW, h: 0.4,
      fontFace: TOKENS.head, fontSize: 14, bold: true, color: TOKENS.ink, align: "center", margin: 0,
    });
    s.addText(n.sub, {
      x: n.x, y: dy + 0.62, w: boxW, h: 0.32,
      fontFace: TOKENS.headEn, fontSize: 11, color: TOKENS.muted, align: "center", margin: 0,
    });
  });
  // 连接线 1
  s.addShape(pptx.ShapeType.line, {
    x: nodes[0].x + boxW, y: dy + boxH / 2, w: nodes[1].x - (nodes[0].x + boxW), h: 0,
    line: { color: TOKENS.amber, pt: 2.25 },
  });
  s.addText("① HTTPS · 边缘证书", {
    x: nodes[0].x + boxW, y: dy + boxH / 2 - 0.4, w: nodes[1].x - (nodes[0].x + boxW), h: 0.3,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.amber, align: "center", margin: 0,
  });
  // 连接线 2
  s.addShape(pptx.ShapeType.line, {
    x: nodes[1].x + boxW, y: dy + boxH / 2, w: nodes[2].x - (nodes[1].x + boxW), h: 0,
    line: { color: TOKENS.accent, pt: 2.25 },
  });
  s.addText("② HTTPS · 源站证书", {
    x: nodes[1].x + boxW, y: dy + boxH / 2 - 0.4, w: nodes[2].x - (nodes[1].x + boxW), h: 0.3,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.accent, align: "center", margin: 0,
  });

  // 两张证书对比卡片
  const cy2 = dy + boxH + 0.95;
  const cardW = 5.95, cardH = 2.95;
  // 边缘证书
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: cy2, w: cardW, h: cardH,
    fill: { color: TOKENS.panel }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + 0.12, y: cy2 + 0.12, w: cardW - 0.24, h: 0.5,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("边缘证书  Edge Certificate", {
    x: TOKENS.margin + 0.3, y: cy2 + 0.2, w: cardW - 0.6, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const edge = [
    ["位置", "访客浏览器 ↔ Cloudflare"],
    ["作用", "保护与 Cloudflare 的连接"],
    ["管理", "Cloudflare 自动签发和更新"],
    ["类型", "Universal SSL / Advanced / Custom"],
  ];
  edge.forEach((row, i) => {
    s.addText(row[0], {
      x: TOKENS.margin + 0.3, y: cy2 + 0.78 + i * 0.42, w: 1.4, h: 0.34,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.amber, margin: 0,
    });
    s.addText(row[1], {
      x: TOKENS.margin + 1.7, y: cy2 + 0.78 + i * 0.42, w: cardW - 2.0, h: 0.34,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
    });
  });
  // 源站证书
  const rx2 = TOKENS.margin + cardW + 0.4;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx2, y: cy2, w: cardW, h: cardH,
    fill: { color: TOKENS.panel }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx2 + 0.12, y: cy2 + 0.12, w: cardW - 0.24, h: 0.5,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("源站证书  Origin Certificate", {
    x: rx2 + 0.3, y: cy2 + 0.2, w: cardW - 0.6, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const origin = [
    ["位置", "Cloudflare ↔ 你的服务器"],
    ["作用", "保护与源站的连接"],
    ["管理", "Cloudflare Origin CA 或第三方"],
    ["类型", "Origin CA / Let's Encrypt / 商业"],
  ];
  origin.forEach((row, i) => {
    s.addText(row[0], {
      x: rx2 + 0.3, y: cy2 + 0.78 + i * 0.42, w: 1.4, h: 0.34,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(row[1], {
      x: rx2 + 1.7, y: cy2 + 0.78 + i * 0.42, w: cardW - 2.0, h: 0.34,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 4, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 05 证书管理矩阵：五大类型
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "03 · CERTIFICATE MATRIX", "五大证书类型：有效期 / 自动更新 / 覆盖范围", 22);

  drawTable(s,
    ["证书类型", "有效期", "自动更新", "级别", "覆盖范围 / 适用"],
    [
      ["Universal SSL",   "15 年（90 天续期）", "✅ 自动",  "DV", "根域名 + 一级子域名"],
      ["Total TLS",       "90 天",               "✅ 自动",  "DV", "所有代理主机名（需 Full DNS）"],
      ["Advanced (ACM)",   "1 年",                "✅ 自动",  "DV", "多级子域 + 自定义 CA"],
      ["Origin CA",       "15 年",               "✅ 自动",  "DV", "源站（仅 Cloudflare 信任）"],
      ["Custom",          "取决于证书",          "❌ 手动",  "DV/OV/EV", "上传自有证书（含 OV/EV）"],
    ],
    [1.95, 1.85, 1.35, 1.1, 4.5],
    { y: f.top + 0.05, rowH: 0.66, fontSize: 10, wrap: true, semantic: false }
  );

  // 关键提示条
  const by = f.bottom - 1.55;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: CONTENT_W, h: 1.45,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.06,
  });
  addSingleLineToken(s, "自动更新 = 重新签发（新密钥对）+ 重新部署，新旧证书短暂重叠，用户无感知", {
    x: TOKENS.margin + 0.25, y: by + 0.15, w: CONTENT_W - 0.5, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent,
  });
  const tips = [
    "Universal SSL / Total TLS / ACM / Origin CA 全部自动续期，无需手动操作",
    "Custom Certificate 必须手动上传与更新；如需自动更新，改用 ACM 或 Total TLS",
    "OV / EV 级别只能通过 Custom Certificate 上传自有证书获得",
  ];
  tips.forEach((t, i) => {
    s.addText("• " + t, {
      x: TOKENS.margin + 0.3, y: by + 0.55 + i * 0.28, w: CONTENT_W - 0.6, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.ink, margin: 0,
    });
  });

  addFooter(s, 5, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 06 v1.3 修正：Total TLS 限制 + ACM 配额
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "04 · v1.3 CORRECTIONS", "Total TLS 限制 + ACM 配额（联网官方文档核对）", 22);

  // 左：Total TLS 限制
  const lx = TOKENS.margin, lw = 5.95;
  s.addShape(pptx.ShapeType.roundRect, {
    x: lx, y: f.top, w: lw, h: 0.5,
    fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("Total TLS 限制说明", {
    x: lx + 0.2, y: f.top + 0.08, w: lw - 0.4, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const ttLimits = [
    { k: "不适用于", v: "Load Balancing / Cloudflare Tunnel / Spectrum 的 hostname" },
    { k: "前置条件", v: "需要 Full DNS setup（非 CNAME setup）" },
    { k: "默认有效期", v: "90 天（自动续期，无需手动操作）" },
    { k: "证书级别", v: "DV 级别（需 OV/EV 请用 Custom Certificate）" },
    { k: "CA 来源", v: "可选 Let's Encrypt / Google Trust Services" },
  ];
  ttLimits.forEach((row, i) => {
    const y = f.top + 0.62 + i * 0.62;
    s.addShape(pptx.ShapeType.roundRect, {
      x: lx, y, w: lw, h: 0.54,
      fill: { color: TOKENS.riskBg }, line: { color: "F0D6D5", pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(row.k, {
      x: lx + 0.18, y: y + 0.08, w: 1.5, h: 0.4,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.risk, margin: 0,
    });
    s.addText(row.v, {
      x: lx + 1.7, y: y + 0.08, w: lw - 1.85, h: 0.4,
      fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.15,
    });
  });

  // 右：ACM 配额
  const rx = TOKENS.margin + lw + 0.4, rw = 5.98;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: rw, h: 0.5,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("ACM 配额与能力", {
    x: rx + 0.2, y: f.top + 0.08, w: rw - 0.4, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const acm = [
    { k: "单张 SAN", v: "最多 50 个主机名（zone apex 必含）" },
    { k: "Ent 配额", v: "每 Zone 最多 100 张 edge certificates" },
    { k: "自定义 CA", v: "可选 Let's Encrypt / DigiCert / SSL.com 等" },
    { k: "自定义有效期", v: "支持（如 90 天）" },
    { k: "自定义套件", v: "支持 TLS 1.2 套件顺序控制" },
  ];
  acm.forEach((row, i) => {
    const y = f.top + 0.62 + i * 0.62;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: rw, h: 0.54,
      fill: { color: TOKENS.bandBlue }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(row.k, {
      x: rx + 0.18, y: y + 0.08, w: 1.5, h: 0.4,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(row.v, {
      x: rx + 1.7, y: y + 0.08, w: rw - 1.85, h: 0.4,
      fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.15,
    });
  });
  // 右下提示
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.bottom - 0.5, w: rw, h: 0.46,
    fill: { color: TOKENS.positiveBg }, line: { color: "D2E6DC", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("ACM = 自定义加密套件 / 自定义 CA / Total TLS 的统一前置能力", {
    x: rx + 0.18, y: f.bottom - 0.48, w: rw - 0.36, h: 0.4,
    fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.positive, margin: 0,
  });

  addFooter(s, 6, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 07 加密套件概念 + TLS 1.3 套件（5.1）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "05 · CIPHER SUITES", "加密套件 = 密钥交换 + 认证 + 加密 + MAC", 24);

  // 上：套件解构
  const uy = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: uy, w: CONTENT_W, h: 1.35,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.06,
  });
  addSingleLineToken(s, "ECDHE-RSA-AES128-GCM-SHA256", {
    x: TOKENS.margin + 0.3, y: uy + 0.16, w: 7, h: 0.4,
    fontFace: TOKENS.mono, fontSize: 18, bold: true, color: TOKENS.accent,
  });
  const parts = [
    { c: "ECDHE",  d: "密钥交换（椭圆曲线 / 前向保密）", color: TOKENS.positive },
    { c: "RSA",    d: "认证", color: TOKENS.amber },
    { c: "AES128-GCM", d: "批量加密（AEAD）", color: TOKENS.accent },
    { c: "SHA256", d: "消息认证（MAC）", color: TOKENS.accentDark },
  ];
  const segW = 3.05;
  parts.forEach((p, i) => {
    const x = TOKENS.margin + 0.3 + i * segW;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: uy + 0.66, w: segW - 0.2, h: 0.55,
      fill: { color: TOKENS.panel }, line: { color: p.color, pt: 1 }, rectRadius: 0.05,
    });
    s.addText(p.c, {
      x, y: uy + 0.72, w: segW - 0.2, h: 0.24,
      fontFace: TOKENS.mono, fontSize: 12, bold: true, color: p.color, align: "center", margin: 0,
    });
    s.addText(p.d, {
      x, y: uy + 0.96, w: segW - 0.2, h: 0.22,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.muted, align: "center", margin: 0,
    });
  });

  // 下：TLS 1.3 套件表
  const ty = uy + 1.55;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: ty, w: CONTENT_W, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("TLS 1.3 加密套件（仅 TLS 1.3 协商时可用 · Cloudflare 强制选择顺序）", {
    x: TOKENS.margin + 0.2, y: ty + 0.06, w: CONTENT_W - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  drawTable(s,
    ["套件名称", "加密", "MAC", "推荐场景"],
    [
      ["TLS_AES_128_GCM_SHA256",         "AES-128-GCM",       "SHA256", "默认推荐 · 性能最佳"],
      ["TLS_AES_256_GCM_SHA384",         "AES-256-GCM",       "SHA384", "合规要求 256 位加密"],
      ["TLS_CHACHA20_POLY1305_SHA256",   "ChaCha20-Poly1305", "SHA256", "移动端无 AES-NI 性能更好"],
    ],
    [4.4, 2.2, 1.3, 3.6],
    { y: ty + 0.58, rowH: 0.55, fontSize: 10.5, codeCols: [0] }
  );
  // 限制提示
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.5, w: CONTENT_W, h: 0.46,
    fill: { color: TOKENS.cautionBg }, line: { color: "EAD9A8", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("⚠ TLS 1.3 套件无法自定义顺序，由 Cloudflare 自动选择；如需严格控制必须使用 TLS 1.2。", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.48, w: CONTENT_W - 0.4, h: 0.4,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.caution, margin: 0,
  });

  addFooter(s, 7, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 08 TLS 1.2 套件 + 前向保密规则（5.1）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "05 · CIPHER SUITES", "TLS 1.2 套件（可自定义顺序）+ 前向保密硬指标", 22);

  drawTable(s,
    ["套件名称", "认证", "加密", "PFS", "推荐度"],
    [
      ["ECDHE-ECDSA-AES128-GCM-SHA256",     "ECDSA", "AES-128-GCM",       "✅", "★★★★★"],
      ["ECDHE-ECDSA-AES256-GCM-SHA384",     "ECDSA", "AES-256-GCM",       "✅", "★★★★★"],
      ["ECDHE-ECDSA-CHACHA20-POLY1305",     "ECDSA", "ChaCha20-Poly1305", "✅", "★★★★★"],
      ["ECDHE-RSA-AES128-GCM-SHA256",       "RSA",   "AES-128-GCM",       "✅", "★★★★☆"],
      ["ECDHE-RSA-AES256-GCM-SHA384",       "RSA",   "AES-256-GCM",       "✅", "★★★★☆"],
      ["ECDHE-ECDSA-AES128-SHA256",         "ECDSA", "AES-128-CBC",       "✅", "★★★☆☆"],
      ["AES128-GCM-SHA256",                 "RSA",   "AES-128-GCM",       "❌", "★★☆☆☆（仅兼容）"],
      ["AES256-SHA256",                     "RSA",   "AES-256-CBC",       "❌", "★☆☆☆☆（不推荐）"],
    ],
    [4.5, 1.0, 2.2, 0.8, 3.0],
    { y: f.top + 0.05, rowH: 0.5, fontSize: 9.5, codeCols: [0], semantic: true, leftCols: [] }
  );

  // 规则提示条（三色）
  const ry = f.bottom - 1.05;
  const rules = [
    { c: TOKENS.positive, bg: TOKENS.positiveBg, t: "ECDHE = 前向保密（PFS）· 合规硬性指标" },
    { c: TOKENS.caution,  bg: TOKENS.cautionBg,  t: "CBC 模式有 Lucky13 攻击风险 · 仅兼容旧客户端启用" },
    { c: TOKENS.risk,     bg: TOKENS.riskBg,     t: "无 ECDHE 的 RSA 套件无 PFS · PCI/等保四级不推荐" },
  ];
  rules.forEach((r, i) => {
    const y = ry + i * 0.32;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: CONTENT_W, h: 0.3,
      fill: { color: r.bg }, line: { color: r.bg, pt: 0 }, rectRadius: 0.03,
    });
    s.addText(r.t, {
      x: TOKENS.margin + 0.18, y: y + 0.04, w: CONTENT_W - 0.36, h: 0.24,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: r.c, margin: 0,
    });
  });

  addFooter(s, 8, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 09 Plan 能力对比（5.2）+ 合规对照（5.3）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "06 · PLAN vs COMPLIANCE", "加密套件自定义：随 Plan 递增 + 合规对照", 22);

  // 左：Plan 能力
  const lx = TOKENS.margin, lw = 6.4;
  s.addShape(pptx.ShapeType.roundRect, {
    x: lx, y: f.top, w: lw, h: 0.42,
    fill: { color: TOKENS.accentDark }, line: { color: TOKENS.accentDark, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("5.2 各 Plan 加密套件自定义能力", {
    x: lx + 0.2, y: f.top + 0.06, w: lw - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  drawTable(s,
    ["能力", "Free", "Pro", "Biz", "ACM", "Ent"],
    [
      ["选 Modern/Compatible/Legacy", "✅", "✅", "✅", "✅", "✅"],
      ["自定义 TLS 1.2 套件顺序",      "❌", "❌", "❌", "✅", "✅"],
      ["自定义 TLS 1.3 套件顺序",      "❌", "❌", "❌", "❌", "❌"],
      ["禁用 TLS 1.0 / 1.1",           "✅", "✅", "✅", "✅", "✅"],
      ["强制 TLS 1.3",                  "❌", "❌", "❌", "❌", "✅"],
      ["自定义 ECDH 曲线",              "❌", "❌", "❌", "❌", "✅"],
      ["HSTS preload",                  "✅", "✅", "✅", "✅", "✅"],
    ],
    [2.6, 0.6, 0.6, 0.6, 0.7, 0.7],
    { x: lx, y: f.top + 0.58, rowH: 0.42, fontSize: 9.5, semantic: true }
  );

  // 右：合规对照
  const rx = TOKENS.margin + lw + 0.3, rw = 6.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: rw, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("5.3 合规要求对照（节选）", {
    x: rx + 0.2, y: f.top + 0.06, w: rw - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  drawTable(s,
    ["合规框架", "最低 TLS", "强制要求", "推荐首套件"],
    [
      ["PCI-DSS v4.0",         "1.2", "PFS + AEAD", "ECDHE-ECDSA-AES256-GCM-SHA384"],
      ["等保 2.0 三级",         "1.2", "PFS",        "ECDHE-ECDSA-AES128-GCM-SHA256"],
      ["等保 2.0 四级 / 金融",  "1.2", "PFS + 256",   "ECDHE-ECDSA-AES256-GCM-SHA384"],
      ["关基条例",              "1.2", "PFS + AEAD", "ECDHE-ECDSA-AES256-GCM-SHA384"],
      ["FIPS 140-2",           "1.2", "NIST 算法",   "ECDHE-ECDSA-AES256-GCM-SHA384"],
    ],
    [1.7, 0.7, 1.4, 2.25],
    { x: rx, y: f.top + 0.58, rowH: 0.52, fontSize: 9, codeCols: [3], wrap: true }
  );
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.bottom - 0.5, w: rw, h: 0.46,
    fill: { color: TOKENS.cautionBg }, line: { color: "EAD9A8", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("关键差异：仅 ACM 与 Enterprise 能精确控制单个 TLS 1.2 套件顺序", {
    x: rx + 0.18, y: f.bottom - 0.48, w: rw - 0.36, h: 0.4,
    fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.caution, margin: 0,
  });

  addFooter(s, 9, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 10 加密套件 CLI（5.4）+ 决策流程（5.5）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "07 · CLI & DECISION", "cfcli 加密套件管理 + 决策流程", 24);

  // 上：决策流程（横向 4 终态）
  const dy = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: dy, w: CONTENT_W, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("5.5 决策流程：合规? → 金融/PCI? → 旧客户端?", {
    x: TOKENS.margin + 0.2, y: dy + 0.06, w: CONTENT_W - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const branches = [
    { q: "金融 / 关基 / PCI?", path: "是 → Custom · AES-256-GCM · 强制 PFS · min TLS 1.2", color: TOKENS.positive },
    { q: "普通合规?",          path: "是 → Custom · AES-128-GCM · 强制 PFS · min TLS 1.2", color: TOKENS.accent },
    { q: "旧客户端?",          path: "是 → Legacy · 兼容旧版 · 60 天宽限", color: TOKENS.caution },
    { q: "无特殊要求?",       path: "否 → Modern · 仅 TLS 1.3 · 最严格", color: TOKENS.amber },
  ];
  const bw = (CONTENT_W - 3 * 0.18) / 4;
  branches.forEach((b, i) => {
    const x = TOKENS.margin + i * (bw + 0.18);
    const y = dy + 0.55;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: bw, h: 1.25,
      fill: { color: TOKENS.panel }, line: { color: b.color, pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.1, y: y + 0.1, w: bw - 0.2, h: 0.38,
      fill: { color: b.color }, line: { color: b.color, pt: 0 }, rectRadius: 0.05,
    });
    s.addText(b.q, {
      x: x + 0.18, y: y + 0.14, w: bw - 0.36, h: 0.3,
      fontFace: TOKENS.head, fontSize: 10, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(b.path, {
      x: x + 0.15, y: y + 0.56, w: bw - 0.3, h: 0.62,
      fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  // 下：CLI 代码块（浅底）
  const cy = dy + 2.0;
  addLightCodeBlock(s, TOKENS.margin, cy, CONTENT_W, f.bottom - cy - 0.05,
    "关键 CLI · cfcli 加密套件管理", [
      ["# 设置 Modern 等级（仅 TLS 1.3，最严格）", TOKENS.muted],
      ["cfcli ssl ciphers set --zone nc-demo.cf --level modern", TOKENS.ink],
      ["# 自定义 TLS 1.2 套件顺序（需 ACM 或 Ent）· 金融等保四级", TOKENS.muted],
      ['cfcli ssl ciphers set --zone nc-demo.cf --level custom \\', TOKENS.ink],
      ['  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256"', TOKENS.ink],
      ["# 禁用 TLS 1.0/1.1（PCI-DSS 强制）· Ent 专属可强制 TLS 1.3", TOKENS.muted],
      ["cfcli ssl tls-version set --zone nc-demo.cf --min 1.2 --max 1.3", TOKENS.ink],
      ["# Ent 专属：自定义 ECDH 曲线 + HSTS preload", TOKENS.muted],
      ['cfcli ssl ecdh-curve set --zone nc-demo.cf --curves "X25519,P-256,P-384"', TOKENS.ink],
      ["cfcli ssl hsts set --zone nc-demo.cf --max-age 31536000 --include-subdomains true --preload true", TOKENS.ink],
    ], { lineH: 0.255, fontSize: 9.5 });

  addFooter(s, 10, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 11 四种模式全景图（9.7.1）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "08 · ENCRYPTION MODES", "四种模式全景图：两段加密路径与证书要求", 24);

  const modes = [
    { id: "Off",       c1: "HTTP（明文）",  c2: "HTTP（明文）",  cert: "无",              color: TOKENS.risk,     rank: 1, label: "最低" },
    { id: "Flexible",  c1: "HTTPS",         c2: "HTTP（明文）⚠", cert: "无",              color: TOKENS.caution,  rank: 2, label: "仅访客侧" },
    { id: "Full",      c1: "HTTPS",         c2: "HTTPS（不验证）", cert: "任意（含自签）",  color: TOKENS.amber,    rank: 3, label: "理论风险" },
    { id: "Full\nStrict", c1: "HTTPS",      c2: "HTTPS（验证）✅", cert: "公网 / Origin CA", color: TOKENS.positive, rank: 4, label: "端到端" },
  ];

  const colX = [0.55, 3.72, 6.89, 10.06];
  const colW = 3.05;
  const top = f.top + 0.1;

  const diagramY = top;
  s.addText("访客  ────►  Cloudflare Edge  ────►  源站 Origin", {
    x: TOKENS.margin, y: diagramY, w: CONTENT_W, h: 0.38,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: TOKENS.ink,
    align: "center", margin: 0,
  });
  addSingleLineToken(s, "连接 1", { x: 3.5, y: diagramY + 0.4, w: 2.2, h: 0.28, fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.muted, align: "center" });
  addSingleLineToken(s, "连接 2", { x: 7.6, y: diagramY + 0.4, w: 2.2, h: 0.28, fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.muted, align: "center" });

  modes.forEach((m, i) => {
    const x = colX[i];
    const y = diagramY + 0.8;
    const h = 4.95;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: colW, h, fill: { color: TOKENS.panel }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.08, y: y + 0.08, w: colW - 0.16, h: 0.65,
      fill: { color: m.color }, line: { color: m.color, pt: 0 }, rectRadius: 0.05,
    });
    s.addText(m.id, {
      x: x + 0.18, y: y + 0.16, w: colW - 0.36, h: 0.5,
      fontFace: TOKENS.head, fontSize: 18, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    addSingleLineToken(s, `安全等级 ${m.rank}/4 · ${m.label}`, {
      x: x + 0.15, y: y + 0.86, w: colW - 0.3, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 9.5, bold: true, color: m.color, align: "center",
    });
    s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y: y + 1.28, w: colW - 0.3, h: 0.82, fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.hairline, pt: 0.5 } });
    addSingleLineToken(s, "① 访客 → Edge", { x: x + 0.25, y: y + 1.32, w: colW - 0.5, h: 0.26, fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted });
    s.addText(m.c1, { x: x + 0.25, y: y + 1.58, w: colW - 0.5, h: 0.5, fontFace: TOKENS.head, fontSize: 13, bold: true, color: TOKENS.ink, align: "left", margin: 0 });
    s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y: y + 2.24, w: colW - 0.3, h: 0.82, fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.hairline, pt: 0.5 } });
    addSingleLineToken(s, "② Edge → Origin", { x: x + 0.25, y: y + 2.28, w: colW - 0.5, h: 0.26, fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted });
    s.addText(m.c2, { x: x + 0.25, y: y + 2.54, w: colW - 0.5, h: 0.5, fontFace: TOKENS.head, fontSize: 13, bold: true, color: TOKENS.ink, align: "left", margin: 0 });
    addSingleLineToken(s, "源站证书要求", { x: x + 0.15, y: y + 3.2, w: colW - 0.3, h: 0.26, fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.muted });
    s.addText(m.cert, { x: x + 0.15, y: y + 3.46, w: colW - 0.3, h: 0.6, fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent, align: "left", margin: 0 });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.32, w: CONTENT_W, h: 0.32,
    fill: { color: TOKENS.bandBlue }, line: { color: TOKENS.rule, pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("结论：Off < Flexible < Full < Full (Strict)   |   前三者均不满足等保 / PCI-DSS 合规要求，仅 Full (Strict) 合规", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.3, w: CONTENT_W - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.ink, align: "center", margin: 0,
  });

  addFooter(s, 11, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 12 四种模式 12 维度详细对比（9.7.2）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "08 · FEATURE MATRIX", "12 维度详细对比：安全 · 合规 · 证书要求", 22);

  drawTable(s,
    ["维度", "Off", "Flexible", "Full", "Full (Strict)"],
    [
      ["连接 1（访客→Edge）",  "HTTP", "HTTPS", "HTTPS", "HTTPS"],
      ["连接 2（Edge→Origin）","HTTP", "HTTP ⚠", "HTTPS", "HTTPS ✅"],
      ["源站证书验证",          "—",    "—",    "❌",    "✅ 链+有效期+域名"],
      ["端到端 MITM 防护",      "❌",   "⚠ 仅访客", "⚠ 理论风险", "✅"],
      ["源站 443 要求",         "❌",   "❌",   "✅",    "✅"],
      ["源站证书类型",          "无",   "无",   "自签/过期均可", "公网证书/Origin CA"],
      ["PCI-DSS v4.0",          "❌ 违规", "❌ 违规", "❌ 违规", "✅ 合规"],
      ["等保 2.0 三级",         "❌ 违规", "❌ 违规", "⚠ 有风险", "✅ 合规"],
      ["等保 2.0 四级/金融",    "❌ 违规", "❌ 违规", "❌ 违规", "✅ 合规"],
      ["生产推荐度",            "❌",   "⚠ 仅过渡", "⚠ 短期", "★★★★★"],
      ["与 AOP 双向认证兼容",   "❌",   "❌",   "✅（意义有限）", "✅ 最佳组合"],
      ["迁移复杂度",            "无",   "低",   "中",    "中高"],
    ],
    [2.55, 2.4, 2.4, 2.5, 2.6],
    { y: f.top + 0.05, rowH: 0.40, fontSize: 10, semantic: true, wrap: true }
  );

  // 语义图例
  const legendY = f.bottom - 0.28;
  const legendItem = (x, color, label) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y: legendY, w: 0.18, h: 0.18, fill: { color }, rectRadius: 0.03, line: { color, pt: 0 } });
    s.addText(label, { x: x + 0.24, y: legendY - 0.02, w: 1.4, h: 0.24, fontFace: TOKENS.headEn, fontSize: 9.5, color: TOKENS.muted, margin: 0 });
  };
  legendItem(TOKENS.margin, TOKENS.positive, "合规 / 推荐");
  legendItem(TOKENS.margin + 2.0, TOKENS.caution, "有条件 / 过渡");
  legendItem(TOKENS.margin + 4.2, TOKENS.risk, "违规 / 禁止");

  addFooter(s, 12, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 13 四种模式适用 vs 禁止场景（9.7.3）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "08 · USE CASES", "适用场景 vs 禁止场景：4 模式 × 判定矩阵", 22);

  const cards = [
    {
      name: "Off", color: TOKENS.risk,
      ok: ["本地开发 / 测试环境", "纯公开静态内容站点", "配合 Cloudflare Tunnel（自带加密）"],
      no: ["任何生产环境", "任何登录 / 支付 / PII 场景", "任何合规行业部署"],
    },
    {
      name: "Flexible", color: TOKENS.caution,
      ok: ["源站无法部署 HTTPS（技术债）", "HTTPS 迁移第一步（≤60 天过渡）", "开发环境快速启用 HTTPS"],
      no: ["任何合规行业", "源站在公有云外网络", "登录 / 支付 / 订单 / 任何 PII"],
    },
    {
      name: "Full", color: TOKENS.amber,
      ok: ["源站使用自签证书", "源站证书即将过期（应急）", "迁到 Strict 的中间步骤"],
      no: ["金融 / 支付 / 关基等严格行业", "源站经不可信网络传输", "要求端点验证的合规框架"],
    },
    {
      name: "Full (Strict)", color: TOKENS.positive,
      ok: ["所有生产环境（推荐默认）", "合规行业部署", "登录 / 支付 / 敏感接口", "搭配 AOP + Origin CA"],
      no: ["— 无 —"],
    },
  ];

  const colX = [0.55, 3.72, 6.89, 10.06];
  const colW = 3.05;
  const top = f.top + 0.05;

  cards.forEach((c, i) => {
    const x = colX[i];
    const y = top;
    const h = 5.0;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: colW, h, fill: { color: TOKENS.panel }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08 });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.1, y: y + 0.1, w: colW - 0.2, h: 0.55, fill: { color: c.color }, line: { color: c.color, pt: 0 }, rectRadius: 0.05 });
    s.addText(c.name, { x: x + 0.18, y: y + 0.2, w: colW - 0.36, h: 0.38, fontFace: TOKENS.head, fontSize: c.name.length > 6 ? 15 : 18, bold: true, color: "FFFFFF", align: "center", margin: 0 });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.1, y: y + 0.78, w: colW - 0.2, h: 0.3, fill: { color: TOKENS.positive, transparency: 85 }, line: { color: TOKENS.positive, pt: 0.5 }, rectRadius: 0.03 });
    s.addText("✓ 适用场景", { x: x + 0.2, y: y + 0.8, w: colW - 0.4, h: 0.26, fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.positive, margin: 0 });
    c.ok.forEach((t, k) => {
      s.addText("• " + t, { x: x + 0.2, y: y + 1.15 + k * 0.36, w: colW - 0.4, h: 0.34, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.2 });
    });
    const blockY = y + 1.15 + Math.max(3, c.ok.length) * 0.36 + 0.1;
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.1, y: blockY, w: colW - 0.2, h: 0.3, fill: { color: TOKENS.risk, transparency: 85 }, line: { color: TOKENS.risk, pt: 0.5 }, rectRadius: 0.03 });
    s.addText("✗ 禁止场景", { x: x + 0.2, y: blockY + 0.02, w: colW - 0.4, h: 0.26, fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.risk, margin: 0 });
    c.no.forEach((t, k) => {
      s.addText("• " + t, { x: x + 0.2, y: blockY + 0.35 + k * 0.36, w: colW - 0.4, h: 0.34, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0 });
    });
  });

  addFooter(s, 13, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 14 合规交叉对照表
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "09 · COMPLIANCE", "合规交叉对照表：六大主流合规框架逐模式判定", 22);

  const statusMap = { "✅": TOKENS.positive, "❌": TOKENS.risk, "⚠": TOKENS.caution };
  const statusFill = { "✅": TOKENS.positiveBg, "❌": TOKENS.riskBg, "⚠": TOKENS.cautionBg };

  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const rowH = 0.55;
  const colW0 = [2.4, 1.3, 1.3, 1.3, 1.5, 4.9];
  let cx = x0;
  const colX0 = colW0.map(w => { const r = cx; cx += w; return r; });

  const header = ["合规框架", "Off", "Flexible", "Full", "Full (Strict)", "判定依据要点"];
  header.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, { x: colX0[i], y: y0, w: colW0[i], h: rowH, fill: { color: i === 0 ? TOKENS.accentDark : TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 } });
    s.addText(h, { x: colX0[i] + 0.1, y: y0 + 0.1, w: colW0[i] - 0.2, h: rowH - 0.2, fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", align: i === 0 || i === 5 ? "left" : "center", margin: 0 });
  });

  const rows = [
    ["PCI-DSS v4.0",  "❌", "❌", "❌", "✅", "Req 4：强加密传输持卡人数据 + 端点验证"],
    ["等保 2.0 三级", "❌", "❌", "⚠", "✅", "8.1.7：传输机密性 + 身份鉴别双向"],
    ["等保 2.0 四级 / 金融", "❌", "❌", "❌", "✅", "JR/T 0171：双向验证 + 前向保密"],
    ["关基条例 + IEC 62443", "❌", "❌", "⚠", "✅", "关键信息基础设施须端到端加密"],
    ["GDPR（第 32 条）", "❌", "⚠", "⚠", "✅", "适当技术措施：加密 + 完整性"],
    ["支付行业监管", "❌", "❌", "❌", "✅", "客户资料禁止明文 + 端点验证要求"],
  ];
  rows.forEach((row, rIdx) => {
    const y = y0 + rowH + rIdx * rowH;
    const altBg = rIdx % 2 === 0 ? TOKENS.panel : TOKENS.panelCream;
    row.forEach((cell, cIdx) => {
      let fill = altBg, ink = TOKENS.ink;
      if (cIdx >= 1 && cIdx <= 4 && statusMap[cell]) { fill = statusFill[cell]; ink = statusMap[cell]; }
      s.addShape(pptx.ShapeType.rect, { x: colX0[cIdx], y, w: colW0[cIdx], h: rowH, fill: { color: fill }, line: { color: TOKENS.hairline, pt: 0.5 } });
      const align = (cIdx === 0 || cIdx === 5) ? "left" : "center";
      const center = cIdx >= 1 && cIdx <= 4;
      s.addText(cell, {
        x: colX0[cIdx] + 0.1, y: y + 0.12, w: colW0[cIdx] - 0.2, h: rowH - 0.24,
        fontFace: center ? TOKENS.headEn : TOKENS.head, fontSize: center ? 15 : 10.5,
        bold: center || cIdx === 0, color: center ? ink : TOKENS.ink, align, margin: 0,
      });
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.36, w: CONTENT_W, h: 0.36,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("合规结论：若涉及任何合规框架，唯一安全选择是 Full (Strict)。Flexible 与 Full 不得用于合规生产环境。", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.34, w: CONTENT_W - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", align: "center", margin: 0,
  });

  addFooter(s, 14, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 15 Automatic SSL/TLS 新特性（2026）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "10 · AUTOMATIC SSL/TLS", "2026 新特性：Recommender 自动探测并选择最安全模式", 20);

  // 左：Automatic SSL/TLS（新）
  const lx = TOKENS.margin, lw = 5.95;
  s.addShape(pptx.ShapeType.roundRect, {
    x: lx, y: f.top, w: lw, h: 0.5,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("✓  Automatic SSL/TLS（新默认）", {
    x: lx + 0.2, y: f.top + 0.08, w: lw - 0.4, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const auto = [
    { k: "机制", v: "SSL/TLS Recommender 自动探测源站证书能力" },
    { k: "决策", v: "自动选择最安全的加密模式（无需手动）" },
    { k: "状态", v: "2026 推出 · 默认模式" },
    { k: "适用", v: "新 Zone / 已迁移 Zone" },
    { k: "优势", v: "减少误配 · 自动升级到最严模式" },
  ];
  auto.forEach((row, i) => {
    const y = f.top + 0.62 + i * 0.62;
    s.addShape(pptx.ShapeType.roundRect, {
      x: lx, y, w: lw, h: 0.54,
      fill: { color: TOKENS.positiveBg }, line: { color: "D2E6DC", pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(row.k, { x: lx + 0.18, y: y + 0.08, w: 1.4, h: 0.4, fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.positive, margin: 0 });
    s.addText(row.v, { x: lx + 1.6, y: y + 0.08, w: lw - 1.75, h: 0.4, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.15 });
  });

  // 右：Custom SSL/TLS（旧）
  const rx = TOKENS.margin + lw + 0.4, rw = 5.98;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: rw, h: 0.5,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("Custom SSL/TLS（手动四种模式）", {
    x: rx + 0.2, y: f.top + 0.08, w: rw - 0.4, h: 0.34,
    fontFace: TOKENS.head, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
  const custom = [
    { k: "机制", v: "管理员手动选择 Off / Flexible / Full / Full Strict" },
    { k: "决策", v: "完全由人工判定源站能力与合规要求" },
    { k: "状态", v: "未迁移的 Zone 仍使用此模式" },
    { k: "适用", v: "需要精确控制 / 合规审计场景" },
    { k: "迁移", v: "建议逐步过渡到 Automatic SSL/TLS" },
  ];
  custom.forEach((row, i) => {
    const y = f.top + 0.62 + i * 0.62;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: rw, h: 0.54,
      fill: { color: TOKENS.bandBlue }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.04,
    });
    s.addText(row.k, { x: rx + 0.18, y: y + 0.08, w: 1.4, h: 0.4, fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.accent, margin: 0 });
    s.addText(row.v, { x: rx + 1.6, y: y + 0.08, w: rw - 1.75, h: 0.4, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.15 });
  });

  // 底部官方来源条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.5, w: CONTENT_W, h: 0.46,
    fill: { color: TOKENS.cautionBg }, line: { color: "EAD9A8", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("参考：developers.cloudflare.com/ssl/origin-configuration/ssl-modes/  ·  v1.3 联网官方文档核对", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.48, w: CONTENT_W - 0.4, h: 0.4,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.caution, align: "center", margin: 0,
  });

  addFooter(s, 15, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 16 Authenticated Origin Pulls（AOP 三级别 + 全 Plan · v1.3）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "11 · AUTHENTICATED ORIGIN PULLS", "AOP 三独立级别 + 全 Plan 可用 + Off/Flexible 不生效", 20);

  drawTable(s,
    ["级别", "证书来源", "适用范围", "安全强度", "典型场景"],
    [
      ["Per-hostname", "自上传证书",     "特定 hostname",            "★★★★★", "仅特定接口要求账户级验证"],
      ["Zone-level",   "自上传证书",     "全 Zone 所有 proxied 流量", "★★★★",  "保证请求来自本账户（非其他 CF 账户）"],
      ["Global",       "Cloudflare 共享证书", "全 Zone 所有 proxied 流量", "★★★",   "仅验证请求来自 CF 网络（最简配置）"],
    ],
    [1.7, 2.1, 3.0, 1.3, 3.6],
    { y: f.top + 0.05, rowH: 0.6, fontSize: 10, wrap: true, semantic: false }
  );

  // 四条关键规则（四色卡）
  const ry = f.bottom - 1.45;
  const rules = [
    { c: TOKENS.positive, t: "全 Plan 可用", d: "Free / Pro / Business / Enterprise" },
    { c: TOKENS.risk,     t: "Off / Flexible 不生效", d: "仅在 Full / Full Strict 下有效" },
    { c: TOKENS.accent,   t: "优先级", d: "Per-hostname > Zone-level > Global" },
    { c: TOKENS.amber,    t: "FIPS 合规", d: "需自上传证书（Zone/Per-hostname）" },
  ];
  const rw = (CONTENT_W - 3 * 0.18) / 4;
  rules.forEach((r, i) => {
    const x = TOKENS.margin + i * (rw + 0.18);
    const y = ry;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: rw, h: 1.25, fill: { color: TOKENS.panel }, line: { color: r.c, pt: 1 }, rectRadius: 0.06 });
    s.addShape(pptx.ShapeType.roundRect, { x: x + 0.12, y: y + 0.12, w: rw - 0.24, h: 0.34, fill: { color: r.c }, line: { color: r.c, pt: 0 }, rectRadius: 0.04 });
    s.addText(r.t, { x: x + 0.18, y: y + 0.14, w: rw - 0.36, h: 0.3, fontFace: TOKENS.head, fontSize: 10, bold: true, color: "FFFFFF", align: "center", margin: 0 });
    s.addText(r.d, { x: x + 0.15, y: y + 0.56, w: rw - 0.3, h: 0.62, fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, align: "center", margin: 0, lineSpacingMultiple: 1.2 });
  });

  addFooter(s, 16, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 17 mTLS / API Shield + 限制来源方法（6 种）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "12 · mTLS & ORIGIN LOCKDOWN", "双向认证 + 6 种限制来源方法对比", 22);

  // 上：mTLS 两种方向
  const my = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: my, w: CONTENT_W, h: 1.2,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.06,
  });
  // 左方向
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + 0.2, y: my + 0.18, w: 5.9, h: 0.85,
    fill: { color: TOKENS.bandBlue }, line: { color: TOKENS.accent, pt: 1 }, rectRadius: 0.05,
  });
  s.addText("Authenticated Origin Pulls", { x: TOKENS.margin + 0.35, y: my + 0.24, w: 5.6, h: 0.3, fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent, margin: 0 });
  s.addText("方向：Cloudflare → 源站  ·  验证请求确实来自 Cloudflare  ·  保护源站", { x: TOKENS.margin + 0.35, y: my + 0.56, w: 5.6, h: 0.4, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0 });
  // 右方向
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + 6.3, y: my + 0.18, w: 5.9, h: 0.85,
    fill: { color: TOKENS.positiveBg }, line: { color: TOKENS.positive, pt: 1 }, rectRadius: 0.05,
  });
  s.addText("Client Certificates · API Shield", { x: TOKENS.margin + 6.45, y: my + 0.24, w: 5.6, h: 0.3, fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.positive, margin: 0 });
  s.addText("方向：客户端 → Cloudflare  ·  验证访问者身份  ·  保护 API", { x: TOKENS.margin + 6.45, y: my + 0.56, w: 5.6, h: 0.4, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0 });

  // 下：6 方法对比表
  drawTable(s,
    ["方法", "安全性", "复杂度", "说明"],
    [
      ["Authenticated Origin Pulls", "★★★★★", "中", "验证请求来自 Cloudflare 网络"],
      ["IP 白名单",                   "★★★",   "低", "仅允许 Cloudflare IP 访问"],
      ["防火墙规则（网络层）",        "★★★",   "低", "在网络层限制来源"],
      ["WAF 规则",                    "★★★★",  "中", "在 Cloudflare 边缘过滤"],
      ["API Shield mTLS",             "★★★★★", "高", "客户端证书验证"],
      ["Cloudflare Tunnel",           "★★★★★", "中", "无需暴露源站 IP（最安全）"],
    ],
    [3.8, 1.4, 1.2, 5.2],
    { y: my + 1.4, rowH: 0.5, fontSize: 10, wrap: true }
  );

  // 推荐组合条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.5, w: CONTENT_W, h: 0.46,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("推荐组合：Tunnel（不暴露源站）→ AOP（验证 CF 身份）→ IP 白名单 → WAF → API Shield mTLS", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.48, w: CONTENT_W - 0.4, h: 0.4,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", align: "center", margin: 0,
  });

  addFooter(s, 17, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 18 渐进式迁移 3 阶段 + 关键 CLI（浅底代码块）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "13 · MIGRATION PLAN", "渐进式迁移 3 阶段：Flexible → Full → Full Strict + AOP", 22);

  const phases = [
    { n: "0", name: "现状评估",  sub: "Flexible / Off → Full 前", time: "T+0",   color: TOKENS.muted,    steps: ["cfcli ssl get-mode", "源站 TLS 端口检查", "证书链验证"] },
    { n: "1", name: "部署 Full", sub: "切 Full 模式",            time: "1-2 周", color: TOKENS.caution,  steps: ["申请 Origin CA 证书", "部署到源站 fullchain", "cfcli ssl set-mode full"] },
    { n: "2", name: "切 Strict", sub: "灰度 7 天 → 全站",        time: "2-4 周", color: TOKENS.amber,    steps: ["Page Rule 灰度子域", "监控 525 错误率", "全站切换 Strict"] },
    { n: "3", name: "启用双向认证", sub: "Full Strict + AOP",     time: "持续",   color: TOKENS.positive, steps: ["启用 Authenticated Origin Pulls", "源站导入 AOP 证书", "mTLS 认证闭环"] },
  ];

  const px = TOKENS.margin;
  const py = f.top + 0.1;
  const gap = 0.18;
  const pw = (CONTENT_W - 3 * gap) / 4;

  phases.forEach((p, i) => {
    const x = px + i * (pw + gap);
    const y = py;
    const h = 2.4;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: pw, h, fill: { color: TOKENS.panel }, line: { color: TOKENS.hairline, pt: 1 }, rectRadius: 0.08 });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fill: { color: p.color }, line: { color: p.color, pt: 0 } });
    addSingleLineToken(s, p.n, { x: x + 0.18, y: y + 0.24, w: 0.5, h: 0.4, fontFace: TOKENS.headEn, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
    addSingleLineToken(s, p.time, { x: x + pw - 1.3, y: y + 0.28, w: 1.1, h: 0.3, fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: p.color, align: "right" });
    s.addText(p.name, { x: x + 0.18, y: y + 0.78, w: pw - 0.36, h: 0.36, fontFace: TOKENS.head, fontSize: 14, bold: true, color: TOKENS.ink, margin: 0 });
    s.addText(p.sub, { x: x + 0.18, y: y + 1.1, w: pw - 0.36, h: 0.28, fontFace: TOKENS.head, fontSize: 10, color: TOKENS.muted, margin: 0 });
    p.steps.forEach((st, k) => {
      s.addText(`${k + 1}. ${st}`, { x: x + 0.18, y: y + 1.45 + k * 0.28, w: pw - 0.36, h: 0.28, fontFace: TOKENS.mono, fontSize: 9.5, color: TOKENS.ink, margin: 0 });
    });
    if (i < phases.length - 1) {
      s.addShape(pptx.ShapeType.chevron, { x: x + pw, y: y + 1.0, w: gap, h: 0.45, fill: { color: TOKENS.rule, transparency: 50 }, line: { color: TOKENS.rule, transparency: 50, pt: 0 } });
    }
  });

  // 浅底代码块
  const codeY = f.top + 2.75;
  addLightCodeBlock(s, TOKENS.margin, codeY, CONTENT_W, f.bottom - codeY - 0.1,
    "关键 CLI 操作  ·  cfcli", [
      ["# 阶段 0：现状评估", TOKENS.muted],
      ["cfcli ssl get-mode --zone nc-demo.cf", TOKENS.ink],
      ["cfcli origin cert-check --host origin.nc-demo.cf --port 443", TOKENS.ink],
      ["", TOKENS.ink],
      ["# 阶段 1：部署 Origin CA → Full", TOKENS.muted],
      ['cfcli certificate origin-create --zone nc-demo.cf --hostnames "nc-demo.cf,*.nc-demo.cf" --validity 5475', TOKENS.ink],
      ["cfcli ssl set-mode --zone nc-demo.cf --mode full", TOKENS.ink],
      ["", TOKENS.ink],
      ["# 阶段 2：灰度切 Strict + 监控 525  ·  阶段 3：启用 AOP", TOKENS.muted],
      ['cfcli page-rule create --pattern "test.nc-demo.cf/*" --ssl-mode full-strict --priority 1', TOKENS.ink],
      ["cfcli ssl aop enable --zone nc-demo.cf", TOKENS.ink],
    ], { lineH: 0.235, fontSize: 9.5 });

  addFooter(s, 18, TOTAL_PAGES, "迁移节奏：建议每阶段观察 ≥ 7 天，配合 Log Explorer 监控 525 错误率 < 0.01%");
})();

// ============================================================
// 19 故障排查矩阵 + Log Explorer (Beta)（5.7 / 11）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "14 · TROUBLESHOOTING", "故障排查矩阵 + Log Explorer (Beta) 监控", 22);

  // 左：故障排查表（5.7 节选）
  const lx = TOKENS.margin, lw = 7.5;
  s.addShape(pptx.ShapeType.roundRect, {
    x: lx, y: f.top, w: lw, h: 0.42,
    fill: { color: TOKENS.accentDark }, line: { color: TOKENS.accentDark, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("5.7 加密套件故障排查（节选）", {
    x: lx + 0.2, y: f.top + 0.06, w: lw - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  drawTable(s,
    ["症状", "原因", "解决方案"],
    [
      ["ERR_SSL_VERSION_OR_CIPHER_MISMATCH", "客户端不支持所选套件", "降级到 Compatible 或追加 CBC"],
      ["旧 Android ≤ 7.0 无法访问",         "不支持 TLS 1.3 / ECDHE", "启用 Legacy 或追加 RSA 套件"],
      ["PCI-DSS 扫描不通过",                  "启用了 CBC / RSA 套件",  "切 Custom，仅留 GCM + ECDHE"],
      ["等保四级扫描不通过",                  "未启用 256 位套件",       "首选 ECDHE-ECDSA-AES256-GCM-SHA384"],
      ["TLS 握手延迟高",                      "套件协商耗时",            "减少套件数量，保留 4-6 个"],
      ["SSL Labs 评级低于 A",                 "TLS 1.0/1.1 启用",        "set --min 1.2"],
    ],
    [3.3, 2.2, 2.0],
    { x: lx, y: f.top + 0.58, rowH: 0.5, fontSize: 9, codeCols: [0], wrap: true }
  );

  // 右：Log Explorer + 排查 CLI
  const rx = TOKENS.margin + lw + 0.25, rw = 5.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: rw, h: 0.42,
    fill: { color: TOKENS.amber }, line: { color: TOKENS.amber, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("Log Explorer  ·  Beta", {
    x: rx + 0.2, y: f.top + 0.06, w: rw - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  // Beta 提示
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top + 0.58, w: rw, h: 0.85,
    fill: { color: TOKENS.cautionBg }, line: { color: "EAD9A8", pt: 0.5 }, rectRadius: 0.04,
  });
  s.addText("Log Explorer（http 数据集）", {
    x: rx + 0.18, y: f.top + 0.64, w: rw - 0.36, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.caution, margin: 0,
  });
  s.addText("状态：Beta  ·  Ent Plan  ·  保留期以合同为准\n用于监控 525 / 526 / 502 错误率与 TLS 握手失败", {
    x: rx + 0.18, y: f.top + 0.94, w: rw - 0.36, h: 0.46,
    fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.2,
  });
  // 排查 CLI 浅底代码块
  addLightCodeBlock(s, rx, f.top + 1.55, rw, 2.45, "排查 / 验证 CLI", [
    ["# 测试 TLS 握手", TOKENS.muted],
    ["cfcli ssl verify --zone nc-demo.cf \\", TOKENS.ink],
    ['  --host "www.nc-demo.cf" --verbose', TOKENS.ink],
    ["", TOKENS.ink],
    ["# OpenSSL 测试套件", TOKENS.muted],
    ["openssl s_client -connect \\ ", TOKENS.ink],
    ["  www.nc-demo.cf:443 -tls1_2 \\", TOKENS.ink],
    ["  -cipher ECDHE-ECDSA-AES256-GCM-SHA384", TOKENS.ink],
    ["", TOKENS.ink],
    ["# 查看支持的套件列表", TOKENS.muted],
    ["nmap --script ssl-enum-ciphers -p 443 www.nc-demo.cf", TOKENS.ink],
  ], { lineH: 0.22, fontSize: 9 });

  addFooter(s, 19, TOTAL_PAGES, FOOTER_SRC);
})();

// ============================================================
// 20 8 行业推荐模式速查 + Q&A 总结
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = addClaimBand(s, "15 · INDUSTRY MATRIX & CLOSING", "8 大行业推荐模式速查 + 决策总结", 22);

  const rows = [
    ["#", "行业",                "推荐模式",        "组合建议",                                  "合规要点"],
    ["1", "金融 · 银行 / 证券",  "Full (Strict)",   "+ AOP + mTLS + ACM",                         "等保四级 / 关基"],
    ["2", "政企 · 政务云 / 央企", "Full (Strict)",   "+ AOP + Data Localization + 国密可选",        "等保三级 / 数据出境"],
    ["3", "电力 / 油气 / 关基",   "Full (Strict)",   "+ AOP + Spectrum + LB 多区域",              "关基条例 + IEC 62443"],
    ["4", "支付行业",             "Full (Strict)",   "+ AOP + API Shield mTLS + Waiting Room",    "PCI-DSS v4.0 + 监管"],
    ["5", "交通 / 机场 / 港口",   "Full (Strict)",   "+ AOP + Bot Management + Geo Steering",     "等保三级 + 关基"],
    ["6", "SaaS 多租户",          "Full (Strict)",   "+ ACM 自动续期 + WAF Custom Rules",          "GDPR / SOC 2 / ISO 27001"],
    ["7", "一般企业官网 / 营销",  "Full (Strict)",   "+ ACM 自动续期 + Universal SSL",            "无强制（建议）"],
    ["8", "内网源站 + CF Tunnel", "Off（特殊）",     "Tunnel 自带加密 + 私网回源",                  "仅内网 / 非合规"],
  ];

  const x0 = TOKENS.margin;
  const y0 = f.top + 0.05;
  const rowH = 0.45;
  const colW0 = [0.45, 2.0, 1.8, 5.0, 3.5];
  let cx = x0;
  const colX0 = colW0.map(w => { const r = cx; cx += w; return r; });

  rows.forEach((row, rIdx) => {
    const y = y0 + rIdx * rowH;
    const isHead = rIdx === 0;
    const altBg = !isHead && rIdx % 2 === 0 ? TOKENS.panel : TOKENS.panelCream;
    row.forEach((cell, cIdx) => {
      const fill = isHead ? (cIdx === 0 ? TOKENS.accentDark : TOKENS.accent) : altBg;
      const ink = isHead ? "FFFFFF" : TOKENS.ink;
      s.addShape(pptx.ShapeType.rect, { x: colX0[cIdx], y, w: colW0[cIdx], h: rowH, fill: { color: fill }, line: { color: isHead ? TOKENS.accent : TOKENS.hairline, pt: 0.5 } });
      const align = (cIdx === 0 || cIdx === 2) ? "center" : "left";
      if (cIdx === 2 && !isHead) {
        const badgeColor = cell.startsWith("Full") ? TOKENS.positive : TOKENS.caution;
        s.addShape(pptx.ShapeType.roundRect, { x: colX0[cIdx] + 0.1, y: y + 0.08, w: colW0[cIdx] - 0.2, h: rowH - 0.16, fill: { color: badgeColor }, line: { color: badgeColor, pt: 0 }, rectRadius: 0.04 });
        s.addText(cell, { x: colX0[cIdx] + 0.15, y: y + 0.11, w: colW0[cIdx] - 0.3, h: rowH - 0.22, fontFace: TOKENS.head, fontSize: 10, bold: true, color: "FFFFFF", align: "center", margin: 0 });
      } else {
        s.addText(cell, { x: colX0[cIdx] + 0.1, y: y + 0.1, w: colW0[cIdx] - 0.2, h: rowH - 0.2, fontFace: cIdx === 0 ? TOKENS.headEn : TOKENS.head, fontSize: isHead ? 10.5 : 10, bold: isHead, color: ink, align, margin: 0 });
      }
    });
  });

  // 底部 Q&A 总结条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.72, w: CONTENT_W, h: 0.66,
    fill: { color: TOKENS.accentDark }, line: { color: TOKENS.accentDark, pt: 0 }, rectRadius: 0.06,
  });
  addSingleLineToken(s, "Q & A", {
    x: TOKENS.margin + 0.35, y: f.bottom - 0.65, w: 1.4, h: 0.5,
    fontFace: TOKENS.headEn, fontSize: 20, bold: true, color: TOKENS.amber,
  });
  s.addText("决策建议：立即启动 3 阶段迁移，目标态 Full (Strict) + AOP + ACM  ·  合规行业叠加 API Shield mTLS", {
    x: TOKENS.margin + 1.9, y: f.bottom - 0.58, w: CONTENT_W - 2.2, h: 0.42,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });

  addFooter(s, 20, TOTAL_PAGES, "下次行动：CAB 批准 → 签发 Origin CA 证书 → Page Rule 灰度 test.nc-demo.cf");
})();

// ========== 输出文件 ==========
const OUTPUT = path.join(__dirname, "Cloudflare_SSL_TLS完全指南_v1.3.pptx");
await pptx.writeFile({ fileName: OUTPUT });
console.log("✅ PPT 已生成：", OUTPUT);
