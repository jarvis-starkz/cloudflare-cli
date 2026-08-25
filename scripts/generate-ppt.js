/**
 * Cloudflare 请求链路 PPT 生成器
 * 风格：咨询研报 (Consulting Research)
 * - 分析、紧凑、冷静
 * - 结论先行、证据第二
 * - 白/冷灰背景、深色墨、海军蓝/青色证据色、细灰规则线
 */

const PptxGenJS = require("pptxgenjs");
const path = require("path");

// === 设计令牌 (Design Tokens) ===
const TOKENS = {
  // 颜色角色
  colors: {
    bg: "FFFFFF",
    surface: "F5F7FA",
    surfaceMuted: "EEF2F7",
    ink: "1F2937",
    muted: "6B7280",
    subtle: "9CA3AF",
    hairline: "E5E7EB",
    rule: "CBD5E1",
    brand: "0F4C81",           // 海军蓝 (主导)
    accent: "0E93A4",          // 青色 (证据强调)
    brandSoft: "E8F0FA",
    accentSoft: "E6F5F7",
    orange: "F38020",          // Cloudflare 橙色
    orangeSoft: "FFF4E6",
    success: "10B981",
    successSoft: "ECFDF5",
    risk: "EF4444",
    riskSoft: "FEE2E2",
    caution: "F59E0B",
    cautionSoft: "FEF3C7",
    purple: "7C3AED",
    purpleSoft: "EDE9FE",
    info: "3B82F6",
    infoSoft: "DBEAFE",
    // 调色板补充（10 场景专用 tint，均为合法 6 位 RGB）
    tintBlue: "E2E8F0",
    tintOrange: "FFEDD5",
    tintPurple: "E9D5FF",
    tintCyan: "CFFAFE",
    tintEmerald: "D1FAE5",
    tintPink: "FBCFE8",
    tintIndigo: "E0E7FF",
    tintTeal: "CCFBF1",
    tintRose: "FFE4E6",
    tintAmber: "FEF3C7",
    // FAQ 边框专用 tint（浅色带）
    faqInfo: "BFDBFE",
    faqOrange: "FED7AA",
    faqPurple: "DDD6FE",
    faqSuccess: "A7F3D0",
    faqCyan: "A5F3FC",
  },
  // 字体角色
  fonts: {
    title: "Microsoft YaHei",
    body: "Microsoft YaHei",
    metric: "Arial",
  },
  // 间距 (英寸)
  layout: {
    slideW: 13.333,
    slideH: 7.5,
    marginLeft: 0.6,
    marginRight: 0.6,
    marginTop: 0.45,
    marginBottom: 0.45,
    headerBandH: 0.9,
    contentTop: 1.25,
    footerBandH: 0.32,
    contentBottom: 7.0,
  },
};

const C = TOKENS.colors;
const L = TOKENS.layout;

// === 辅助函数：文本防护短代码 ===
function addToken(slide, value, opts) {
  const requestedSize = Number(opts.fontSize || 18);
  const boxW = Number(opts.w);
  const safeLen = String(value).length * requestedSize * 0.62 / 72 * 1.18;
  let fs = requestedSize;
  if (boxW < safeLen) fs = Math.max(10, requestedSize * boxW / safeLen);
  slide.addText(String(value), {
    ...opts,
    fontSize: fs,
    valign: opts.valign || "middle",
    margin: 0,
    wrap: false,
    fit: "shrink",
    vert: "horz",
  });
}

// === 辅助：共享 Chrome ===
function addChrome(slide, { sectionLabel = "", pageNum, total = 20 } = {}) {
  // 顶部细灰线
  slide.addShape("rect", {
    x: L.marginLeft, y: 0.38, w: L.slideW - L.marginLeft - L.marginRight, h: 0,
    line: { color: C.hairline, width: 0.75 },
  });
  // 左侧章节标签
  if (sectionLabel) {
    slide.addText(sectionLabel.toUpperCase(), {
      x: L.marginLeft, y: 0.42, w: 8, h: 0.22,
      fontFace: TOKENS.fonts.body,
      fontSize: 9,
      color: C.subtle,
      bold: false,
      charSpacing: 2,
      margin: 0,
    });
  }
  // 右下角页码
  addToken(slide, `${pageNum} / ${total}`, {
    x: L.slideW - L.marginRight - 0.8, y: 7.08, w: 0.78, h: 0.22,
    fontFace: TOKENS.fonts.metric, fontSize: 9, color: C.subtle, align: "right",
  });
  // 底部细线
  slide.addShape("rect", {
    x: L.marginLeft, y: 7.02, w: L.slideW - L.marginLeft - L.marginRight, h: 0,
    line: { color: C.hairline, width: 0.5 },
  });
  // 左下角品牌色条
  slide.addShape("rect", {
    x: L.marginLeft, y: 7.06, w: 0.28, h: 0.04,
    fill: { color: C.brand }, line: { color: C.brand, width: 0 },
  });
}

// === 辅助：标题带分隔带 ===
function addClaim(slide, claim, { subClaim = "", sectionLabel = "" } = {}) {
  // 声明标题
  slide.addText(claim, {
    x: L.marginLeft, y: 0.58, w: L.slideW - L.marginLeft - L.marginRight, h: 0.52,
    fontFace: TOKENS.fonts.title,
    fontSize: 22,
    color: C.ink,
    bold: true,
    valign: "mid",
    margin: 0,
  });
  // 子声明
  if (subClaim) {
    slide.addText(subClaim, {
      x: L.marginLeft, y: 1.12, w: L.slideW - L.marginLeft - L.marginRight, h: 0.28,
      fontFace: TOKENS.fonts.body,
      fontSize: 11,
      color: C.muted,
      valign: "mid",
      margin: 0,
    });
  }
  // 顶部标题与内容之间的分隔线
  slide.addShape("rect", {
    x: L.marginLeft, y: L.contentTop - 0.05, w: 0.5, h: 0,
    line: { color: C.brand, width: 1.5 },
  });
}

// === 辅助：来源/注释带 ===
function addSource(slide, sourceText, y = 6.8) {
  slide.addText(sourceText, {
    x: L.marginLeft, y: y, w: L.slideW - L.marginLeft - L.marginRight, h: 0.2,
    fontFace: TOKENS.fonts.body,
    fontSize: 8.5,
    color: C.subtle,
    italic: true,
    margin: 0,
  });
}

// === 辅助：绘制卡片 ===
function addCard(slide, x, y, w, h, { fill = C.surface, border = C.hairline, title = "", titleColor = C.ink } = {}) {
  slide.addShape("rect", {
    x, y, w, h, fill: { color: fill }, line: { color: border, width: 0.75 },
    rectRadius: 0.08,
  });
  if (title) {
    slide.addText(title, {
      x: x + 0.16, y: y + 0.12, w: w - 0.32, h: 0.28,
      fontFace: TOKENS.fonts.title, fontSize: 11, color: titleColor, bold: true, margin: 0,
    });
  }
  return { innerX: x + 0.16, innerY: y + 0.44, innerW: w - 0.32, innerH: h - 0.56 };
}

// === 辅助：绘制表格 ===
function addTable(slide, x, y, w, rows, opts = {}) {
  const options = {
    x, y, w,
    rowH: opts.rowH || 0.35,
    borderColor: C.hairline,
    borderWidth: 0.5,
    headerFill: C.surfaceMuted,
    headerColor: C.muted,
    headerBold: true,
    bodyFill: "FFFFFF",
    bodyColor: C.ink,
    fontSize: 10.5,
    colW: opts.colW,
    align: opts.align,
    zebra: opts.zebra !== false,
    ...opts,
  };

  const dataRows = rows.length;
  const columns = rows[0].length;
  const colW = options.colW || Array(columns).fill(options.w / columns);
  const rowH = typeof options.rowH === "number" ? Array(dataRows).fill(options.rowH) : options.rowH;

  let cy = options.y;
  rows.forEach((row, ri) => {
    let cx = options.x;
    const rh = rowH[ri];
    const isHeader = ri === 0;
    row.forEach((cell, ci) => {
      const fill = isHeader ? options.headerFill : (options.zebra && ri % 2 === 0 ? options.bodyFill : C.surface);
      slide.addShape("rect", {
        x: cx, y: cy, w: colW[ci], h: rh,
        fill: { color: fill },
        line: { color: options.borderColor, width: options.borderWidth },
      });
      const align = (options.align && options.align[ci]) || "left";
      slide.addText(cell, {
        x: cx + 0.1, y: cy + 0.04, w: colW[ci] - 0.2, h: rh - 0.08,
        fontFace: TOKENS.fonts.body,
        fontSize: isHeader ? 9.5 : options.fontSize,
        color: isHeader ? options.headerColor : options.bodyColor,
        bold: isHeader && options.headerBold,
        valign: "middle",
        margin: 0,
        align,
      });
      cx += colW[ci];
    });
    cy += rh;
  });

  return { width: w, height: dataRows * (Array.isArray(rowH) ? rowH[0] : rowH) };
}

// === 辅助：绘制形状节点（架构图） ===
function addNode(slide, x, y, w, h, { fill = C.surface, border = C.hairline, borderW = 1, title = "", sub = "", titleColor = C.ink, subColor = C.muted, icon = "" } = {}) {
  slide.addShape("rect", {
    x, y, w, h, fill: { color: fill }, line: { color: border, width: borderW }, rectRadius: 0.1,
  });
  const lines = [];
  if (icon || title) lines.push({ text: (icon ? icon + " " : "") + title, options: { bold: true, fontSize: 11, color: titleColor } });
  if (sub) lines.push({ text: sub, options: { fontSize: 9, color: subColor } });
  slide.addText(lines, {
    x: x + 0.08, y: y + 0.06, w: w - 0.16, h: h - 0.12,
    valign: "mid", align: "center", margin: 0,
  });
}

// === 辅助：绘制连接箭头 ===
function addArrow(slide, x1, y1, x2, y2, { color = C.brand, width = 1.5, label = "", labelFill = "FFFFFF" } = {}) {
  slide.addShape("line", {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, beginArrowType: "none", endArrowType: "triangle" },
  });
  if (label) {
    const lx = (x1 + x2) / 2 - 0.7;
    const ly = (y1 + y2) / 2 - 0.12;
    slide.addShape("rect", {
      x: lx, y: ly, w: 1.4, h: 0.24, fill: { color: labelFill }, line: { color, width: 0.5 }, rectRadius: 0.04,
    });
    addToken(slide, label, {
      x: lx, y: ly, w: 1.4, h: 0.24,
      fontFace: TOKENS.fonts.body, fontSize: 9, color, align: "center",
    });
  }
}

// ======================================================================
// PPT 生成主函数
// ======================================================================
async function generatePPT() {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 (16:9)
  pres.author = "Cloudflare CLI Team";
  pres.company = "NC Services";
  pres.subject = "Cloudflare Request Flow Architecture";
  pres.title = "Cloudflare 请求链路完全指南";

  const TOTAL = 20;

  // ====================================================================
  // SLIDE 1: 封面
  // ====================================================================
  (function slide1() {
    const s = pres.addSlide();
    s.background = { color: "0F2540" }; // 深色封面底

    // 装饰色条
    s.addShape("rect", { x: 0, y: 0, w: L.slideW, h: 0.06, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
    s.addShape("rect", { x: 0, y: 7.44, w: L.slideW, h: 0.06, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });

    // 左侧垂直色块
    s.addShape("rect", { x: 0, y: 0, w: 0.12, h: L.slideH, fill: { color: "1A3A5C" }, line: { color: "1A3A5C", width: 0 } });

    // 徽章
    s.addShape("rect", { x: 0.9, y: 1.4, w: 2.4, h: 0.42, fill: { color: "1A3A5C" }, line: { color: C.orange, width: 0.75 }, rectRadius: 0.06 });
    addToken(s, "ARCHITECTURE GUIDE v2.0", {
      x: 0.9, y: 1.4, w: 2.4, h: 0.42,
      fontFace: TOKENS.fonts.body, fontSize: 11, color: C.orange, align: "center", bold: true, charSpacing: 3,
    });

    // 主标题
    s.addText("Cloudflare", {
      x: 0.9, y: 2.1, w: 10, h: 0.9,
      fontFace: TOKENS.fonts.title, fontSize: 54, color: "FFFFFF", bold: true, margin: 0,
    });
    s.addText("请求链路完全指南", {
      x: 0.9, y: 2.95, w: 10, h: 0.8,
      fontFace: TOKENS.fonts.title, fontSize: 36, color: "F0F4F8", bold: false, margin: 0,
    });
    s.addText("10 大典型场景 · Full/Partial · ACM · LB · mTLS 组合详解", {
      x: 0.92, y: 3.9, w: 10, h: 0.4,
      fontFace: TOKENS.fonts.body, fontSize: 16, color: C.accent, margin: 0,
    });

    // 分隔线
    s.addShape("rect", { x: 0.9, y: 4.45, w: 3.2, h: 0, line: { color: C.orange, width: 1.5 } });

    // 副标题信息
    const infoRows = [
      ["文档版本", "v2.0 · 2026-07"],
      ["适配工具", "cfcli v1.0.0 (Cloudflare CLI)"],
      ["覆盖范围", "DNS · SSL · WAF · Load Balancer · mTLS"],
      ["配套文档", "REQUEST_FLOW_GUIDE.md"],
    ];
    infoRows.forEach((r, i) => {
      const y = 4.75 + i * 0.42;
      addToken(s, r[0], {
        x: 0.9, y, w: 1.2, h: 0.32,
        fontFace: TOKENS.fonts.body, fontSize: 11, color: "94A3B8", bold: true,
      });
      s.addText(r[1], {
        x: 2.15, y, w: 6, h: 0.32,
        fontFace: TOKENS.fonts.body, fontSize: 11, color: "CBD5E1", valign: "mid", margin: 0,
      });
    });

    // 右下角
    s.addText("© 2026 NC Services Limited · 内部资料", {
      x: L.slideW - L.marginRight - 5, y: 7.02, w: 5, h: 0.24,
      fontFace: TOKENS.fonts.body, fontSize: 9, color: "64748B", align: "right", margin: 0,
    });
  })();

  // ====================================================================
  // SLIDE 2: 目录
  // ====================================================================
  (function slide2() {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    addChrome(s, { sectionLabel: "Contents", pageNum: 2, total: TOTAL });
    addClaim(s, "目录", { subClaim: "从基础概念到 10 大典型场景的完整导航" });

    const col1x = L.marginLeft;
    const col2x = L.marginLeft + 6.1;
    const colW = 5.9;

    const blocks = [
      // col 1
      { x: col1x, n: "01", t: "基础概念", d: "两次 TLS 连接模型 · 关键组件说明" },
      { x: col1x, n: "02", t: "DNS 设置类型", d: "Full Setup vs Partial CNAME 对比" },
      { x: col1x, n: "03", t: "SSL 证书类型", d: "边缘证书 · 源站证书 · SSL 模式选择" },
      { x: col1x, n: "04", t: "mTLS 双向认证", d: "握手过程 · Nginx 配置 · 对比" },
      { x: col1x, n: "05", t: "场景 1-4", d: "Full Proxy 四种组合：Universal/ACM × 无/mTLS" },
      // col 2
      { x: col2x, n: "06", t: "场景 5-6", d: "Partial Zone Suffix：Universal × 无/mTLS" },
      { x: col2x, n: "07", t: "场景 7-8", d: "Load Balancer：LB × 无/mTLS" },
      { x: col2x, n: "08", t: "场景 9-10", d: "ACM + LB：最高企业级安全组合" },
      { x: col2x, n: "09", t: "场景对比总结", d: "证书/链路/安全三维度对比矩阵" },
      { x: col2x, n: "10", t: "选择建议与后续", d: "需求匹配推荐 · CLI 命令速查" },
    ];

    blocks.forEach((b, i) => {
      const row = i % 5;
      const y = L.contentTop + row * 1.08;
      // 编号
      s.addShape("rect", { x: b.x, y, w: 0.68, h: 0.68, fill: { color: C.brandSoft }, line: { color: C.brandSoft, width: 0 }, rectRadius: 0.08 });
      addToken(s, b.n, {
        x: b.x, y, w: 0.68, h: 0.68,
        fontFace: TOKENS.fonts.metric, fontSize: 20, color: C.brand, bold: true, align: "center",
      });
      // 标题
      s.addText(b.t, {
        x: b.x + 0.84, y: y + 0.02, w: colW - 0.84, h: 0.32,
        fontFace: TOKENS.fonts.title, fontSize: 14, color: C.ink, bold: true, margin: 0, valign: "mid",
      });
      // 描述
      s.addText(b.d, {
        x: b.x + 0.84, y: y + 0.36, w: colW - 0.84, h: 0.3,
        fontFace: TOKENS.fonts.body, fontSize: 10, color: C.muted, margin: 0, valign: "mid",
      });
      // 细横线
      if (row < 4) {
        s.addShape("rect", { x: b.x + 0.84, y: y + 0.94, w: colW - 0.84, h: 0, line: { color: C.hairline, width: 0.5 } });
      }
    });

    addSource(s, "配套 CLI 工具：cfcli · docs/REQUEST_FLOW_GUIDE.md");
  })();

  // ====================================================================
  // SLIDE 3: 基础概念 - 两次 TLS 连接
  // ====================================================================
  (function slide3() {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    addChrome(s, { sectionLabel: "Foundations · 01", pageNum: 3, total: TOTAL });
    addClaim(s, "核心架构：两次 TLS 连接", {
      subClaim: "用户到 Cloudflare 使用边缘证书，Cloudflare 到源站使用源站证书 — 形成双层加密",
    });

    // 左侧：架构图
    const c1 = addCard(s, L.marginLeft, L.contentTop + 0.05, 7.8, 4.9, {
      fill: C.bg, title: "请求链路架构 · 双层 TLS 模型", titleColor: C.brand,
    });

    const diagramY = c1.innerY + 0.2;
    // 访客
    addNode(s, c1.innerX + 0.1, diagramY + 0.8, 1.7, 1.4, {
      fill: C.surface, border: C.rule, borderW: 0.75,
      title: "访客浏览器", sub: "Visitor", icon: "🌐",
    });
    // Cloudflare
    s.addShape("rect", {
      x: c1.innerX + 2.5, y: diagramY + 0.2, w: 2.9, h: 3.0,
      fill: { color: C.orangeSoft }, line: { color: C.orange, width: 1 }, rectRadius: 0.12,
    });
    s.addText("☁️ CLOUDFLARE EDGE", {
      x: c1.innerX + 2.5, y: diagramY + 0.28, w: 2.9, h: 0.36,
      fontFace: TOKENS.fonts.title, fontSize: 12, color: C.orange, bold: true, align: "center", margin: 0,
    });
    // Edge Cert
    addNode(s, c1.innerX + 2.65, diagramY + 0.7, 1.3, 0.88, {
      fill: "FFFFFF", border: C.orange, borderW: 0.75,
      title: "边缘证书", sub: "Universal / ACM",
      titleColor: C.orange, subColor: C.muted,
    });
    // Origin Cert
    addNode(s, c1.innerX + 4.05, diagramY + 0.7, 1.22, 0.88, {
      fill: "FFFFFF", border: C.success, borderW: 0.75,
      title: "源站证书", sub: "Origin CA / 自购",
      titleColor: C.success, subColor: C.muted,
    });
    // mTLS Cert
    addNode(s, c1.innerX + 3.35, diagramY + 1.75, 1.2, 0.7, {
      fill: C.successSoft, border: C.success, borderW: 0.75,
      title: "mTLS 客户端", sub: "（可选认证）",
      titleColor: C.success, subColor: C.muted,
    });
    // WAF row
    s.addText("🛡️ WAF  ·  💾 Cache  ·  📜 Page Rules  ·  ⚡ Rate Limit", {
      x: c1.innerX + 2.5, y: diagramY + 2.58, w: 2.9, h: 0.3,
      fontFace: TOKENS.fonts.body, fontSize: 9, color: C.muted, align: "center", margin: 0, valign: "mid",
    });
    // 源站
    addNode(s, c1.innerX + 5.8, diagramY + 0.8, 1.7, 1.4, {
      fill: C.successSoft, border: C.success, borderW: 0.75,
      title: "源站服务器", sub: "Nginx / Apache", icon: "🏢",
      titleColor: C.success,
    });

    // 连接1 箭头
    addArrow(s, c1.innerX + 1.8, diagramY + 1.5, c1.innerX + 2.45, diagramY + 1.5, { color: C.orange, width: 1.75, label: "连接1 HTTPS", labelFill: C.orangeSoft });
    // 连接2 箭头
    addArrow(s, c1.innerX + 5.42, diagramY + 1.5, c1.innerX + 5.75, diagramY + 1.5, { color: C.success, width: 1.75, label: "连接2 HTTPS/mTLS", labelFill: C.successSoft });

    // 步骤流程
    const steps = [
      ["STEP 1", "DNS 解析 → CF Anycast IP"],
      ["STEP 2", "TLS 握手（连接1 边缘证书）"],
      ["STEP 3", "CF 处理：缓存/WAF/规则"],
      ["STEP 4", "TLS/mTLS 握手（连接2）"],
      ["STEP 5", "请求转发至源站 + 返回"],
    ];
    let stepY = c1.innerY + 3.5;
    steps.forEach((st, i) => {
      const sx = c1.innerX + 0.1 + i * 1.5;
      s.addShape("rect", { x: sx, y: stepY, w: 0.28, h: 0.28, fill: { color: C.brand }, line: { color: C.brand, width: 0 }, rectRadius: 0.05 });
      addToken(s, String(i + 1), {
        x: sx, y: stepY, w: 0.28, h: 0.28,
        fontFace: TOKENS.fonts.metric, fontSize: 10, color: "FFFFFF", bold: true, align: "center",
      });
      s.addText(st[0], {
        x: sx + 0.34, y: stepY - 0.02, w: 1.1, h: 0.16,
        fontFace: TOKENS.fonts.body, fontSize: 7.5, color: C.brand, bold: true, margin: 0, charSpacing: 1,
      });
      s.addText(st[1], {
        x: sx + 0.34, y: stepY + 0.12, w: 1.1, h: 0.2,
        fontFace: TOKENS.fonts.body, fontSize: 8, color: C.muted, margin: 0, valign: "top",
      });
    });

    // 右侧：关键组件表
    const c2 = addCard(s, L.marginLeft + 8.1, L.contentTop + 0.05, 4.0, 2.2, {
      title: "关键组件说明", titleColor: C.brand,
    });
    addTable(
      s, c2.innerX, c2.innerY, c2.innerW,
      [
        ["组件", "位置", "作用"],
        ["边缘证书", "访客 ↔ CF", "加密访客到 CF 流量（公共信任）"],
        ["源站证书", "CF ↔ 源站", "加密 CF 到源站流量（Origin CA/自购）"],
        ["mTLS 证书", "CF → 源站", "CF 出示客户端证书，防绕过"],
      ],
      {
        colW: [0.85, 1.05, 2.1],
        rowH: [0.34, 0.44, 0.44, 0.44],
        fontSize: 9.5,
        align: ["left", "left", "left"],
      },
    );

    // 右下方：管理启示
    const c3 = addCard(s, L.marginLeft + 8.1, L.contentTop + 2.45, 4.0, 2.5, {
      fill: C.brandSoft, border: C.brandSoft, title: "💡 管理启示", titleColor: C.brand,
    });
    const bullets = [
      "双层 TLS 是 CF 安全模型的基础：连接1面向公众，连接2面向源站",
      "连接2可独立升级为 mTLS：从『任一向 CF 发请求的人可到达源站』变为『只有持有 CF 客户端证书的请求可进入』",
      "源站无需暴露 80/443 给全网，只需要放行 CF IP 段或开启 mTLS 后完全无需白名单",
    ];
    bullets.forEach((b, i) => {
      const by = c3.innerY + i * 0.7;
      s.addShape("rect", { x: c3.innerX, y: by + 0.08, w: 0.06, h: 0.18, fill: { color: C.brand }, line: { color: C.brand, width: 0 } });
      s.addText(b, {
        x: c3.innerX + 0.18, y: by, w: c3.innerW - 0.18, h: 0.62,
        fontFace: TOKENS.fonts.body, fontSize: 10, color: C.ink, valign: "mid", margin: 0,
      });
    });

    addSource(s, "图示：Visitor-to-Edge 与 Edge-to-Origin 两次独立 TLS 连接");
  })();

  // ====================================================================
  // SLIDE 4: DNS 设置类型对比
  // ====================================================================
  (function slide4() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "Foundations · 02", pageNum: 4, total: TOTAL });
    addClaim(s, "DNS 设置：Full Setup vs Partial (CNAME)", {
      subClaim: "Full 将 NS 完全迁移到 CF；Partial 保留原 DNS 提供商，通过 CNAME 将指定子域名指向 CF",
    });

    // Full Setup 流程卡片
    const c1 = addCard(s, L.marginLeft, L.contentTop + 0.05, 6.0, 3.2, {
      fill: C.brandSoft, border: C.brandSoft, title: "方案 A：Full Setup (推荐)", titleColor: C.brand,
    });
    const steps1 = [
      { x: c1.innerX + 0.1, t: "访客", s: "浏览器" },
      { x: c1.innerX + 1.15, t: "递归解析器", s: "Recursive" },
      { x: c1.innerX + 2.45, t: "CF NS 权威", s: "Cloudflare DNS" },
      { x: c1.innerX + 3.95, t: "CF Anycast IP", s: "104.26.x.x" },
      { x: c1.innerX + 5.1, t: "源站", s: "Origin" },
    ];
    steps1.forEach((st, i) => {
      addNode(s, st.x, c1.innerY + 0.4, 1.0, 0.72, {
        fill: "FFFFFF", border: C.brand, borderW: i === 2 ? 1.25 : 0.75,
        title: st.t, sub: st.s,
        titleColor: i === 2 ? C.brand : C.ink,
      });
      if (i < steps1.length - 1) {
        addArrow(s, st.x + 1.0, c1.innerY + 0.76, steps1[i + 1].x - 0.02, c1.innerY + 0.76, {
          color: C.brand, width: 1.25, label: "",
        });
      }
    });
    // Full 特点
    const f1 = ["✅ 使用 Cloudflare NS 记录", "✅ CNAME Flattening 支持", "✅ 自动 DNSSEC", "✅ Universal SSL 根+子域名"];
    f1.forEach((f, i) => {
      s.addText(f, {
        x: c1.innerX + 0.1 + (i % 2) * 2.95, y: c1.innerY + 1.5 + Math.floor(i / 2) * 0.5, w: 2.85, h: 0.4,
        fontFace: TOKENS.fonts.body, fontSize: 10, color: C.ink, valign: "mid", margin: 0,
      });
    });

    // Partial Setup 流程卡片
    const c2 = addCard(s, L.marginLeft + 6.3, L.contentTop + 0.05, 6.0, 3.2, {
      fill: C.orangeSoft, border: C.orangeSoft, title: "方案 B：Partial Zone (CNAME)", titleColor: C.orange,
    });
    const steps2 = [
      { x: c2.innerX + 0.1, t: "访客", s: "浏览器" },
      { x: c2.innerX + 1.15, t: "原 DNS 提供商", s: "Non-authoritative" },
      { x: c2.innerX + 2.6, t: "CNAME 记录", s: "api→cf.cf" },
      { x: c2.innerX + 3.95, t: "CF Anycast", s: "Cloudflare" },
      { x: c2.innerX + 5.1, t: "源站", s: "Origin" },
    ];
    steps2.forEach((st, i) => {
      addNode(s, st.x, c2.innerY + 0.4, 1.0, 0.72, {
        fill: "FFFFFF", border: C.orange, borderW: i === 2 ? 1.25 : 0.75,
        title: st.t, sub: st.s,
        titleColor: i === 2 ? C.orange : C.ink,
      });
      if (i < steps2.length - 1) {
        addArrow(s, st.x + 1.0, c2.innerY + 0.76, steps2[i + 1].x - 0.02, c2.innerY + 0.76, {
          color: C.orange, width: 1.25,
        });
      }
    });
    const f2 = ["⚠️ 保留原 DNS 提供商", "⚠️ 每个子域名单独证书", "⚠️ 不支持 CNAME Flattening", "⚠️ DNSSEC 需手动配置"];
    f2.forEach((f, i) => {
      s.addText(f, {
        x: c2.innerX + 0.1 + (i % 2) * 2.95, y: c2.innerY + 1.5 + Math.floor(i / 2) * 0.5, w: 2.85, h: 0.4,
        fontFace: TOKENS.fonts.body, fontSize: 10, color: C.ink, valign: "mid", margin: 0,
      });
    });

    // 下方对比表
    const tt = addTable(
      s, L.marginLeft, L.contentTop + 3.45, L.slideW - L.marginLeft - L.marginRight,
      [
        ["特性", "Full Setup", "Partial (CNAME)", "选择建议"],
        ["NS 记录", "Cloudflare NS（权威）", "保留原 NS", "全新域名/完全迁移 → Full"],
        ["Universal SSL", "根域名 + 一级子域", "每个子域名单独签发", "证书覆盖广度 → Full"],
        ["CNAME Flattening", "支持", "不支持", "根域名 A 记录需要 → Full"],
        ["DNSSEC", "自动支持", "需手动配置", "合规要求高 → Full"],
        ["迁移复杂度", "较高（切 NS）", "较低（增 CNAME）", "已有 DNS 体系 → Partial"],
      ],
      {
        colW: [1.8, 3.5, 3.5, 3.43],
        rowH: [0.38, 0.46, 0.46, 0.46, 0.46, 0.46],
        fontSize: 10,
      },
    );

    addSource(s, "两种方案均支持 Proxied（橙色云）代理，核心区别在于 DNS 权威归属");
  })();

  // ====================================================================
  // SLIDE 5: SSL 证书类型 & SSL 模式
  // ====================================================================
  (function slide5() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "Foundations · 03", pageNum: 5, total: TOTAL });
    addClaim(s, "SSL 证书类型 & 加密模式选择", {
      subClaim: "边缘证书决定访客看到的信任链；源站证书决定 CF 与源站之间的信任；SSL 模式定义严格程度",
    });

    // 卡 1：边缘证书
    const c1 = addCard(s, L.marginLeft, L.contentTop + 0.05, 4.1, 3.5, {
      title: "① 边缘证书（访客 ↔ CF）", titleColor: C.brand,
    });
    addTable(
      s, c1.innerX, c1.innerY, c1.innerW,
      [
        ["类型", "来源", "信任", "适用"],
        ["Universal SSL", "CF 自动签发", "公共信任", "默认 · 免费 · 足够"],
        ["Advanced Cert", "CF 管理 CA", "公共信任", "自定义主机数/SAN"],
        ["自定义证书", "自购 DigiCert 等", "公共信任", "OV/EV 展示企业名"],
      ],
      { colW: [1.05, 1.0, 0.85, 1.2], rowH: [0.34, 0.5, 0.5, 0.5], fontSize: 9.5 },
    );

    // 卡 2：源站证书
    const c2 = addCard(s, L.marginLeft + 4.35, L.contentTop + 0.05, 4.1, 3.5, {
      title: "② 源站证书（CF ↔ 源站）", titleColor: C.success,
    });
    addTable(
      s, c2.innerX, c2.innerY, c2.innerW,
      [
        ["类型", "来源", "信任", "适用"],
        ["Origin CA", "CF 专用 CA 签发", "仅 CF 信任", "⭐ 推荐 · 免费"],
        ["Let's Encrypt", "公共 CA", "公共信任", "自动续签"],
        ["自购买证书", "DigiCert 等", "公共信任", "严格合规场景"],
      ],
      { colW: [1.05, 1.0, 0.85, 1.2], rowH: [0.34, 0.5, 0.5, 0.5], fontSize: 9.5 },
    );

    // 卡 3：SSL 模式对比
    const c3 = addCard(s, L.marginLeft + 8.7, L.contentTop + 0.05, 4.0, 3.5, {
      title: "③ SSL/TLS 加密模式", titleColor: C.accent,
    });
    const modes = [
      { m: "Off", d1: "无加密", d2: "无加密", risk: "❌ 不推荐", fill: "FEE2E2", border: "FCA5A5" },
      { m: "Flexible", d1: "HTTPS", d2: "HTTP", risk: "⚠️ 源站明文", fill: "FEF3C7", border: "FCD34D" },
      { m: "Full", d1: "HTTPS", d2: "HTTPS 不验证", risk: "⚡ 源站可自签", fill: "DBEAFE", border: "93C5FD" },
      { m: "Full Strict", d1: "HTTPS", d2: "HTTPS 验证", risk: "✅ 推荐", fill: C.successSoft, border: C.success },
    ];
    modes.forEach((m, i) => {
      const my = c3.innerY + i * 0.72;
      s.addShape("rect", { x: c3.innerX, y: my, w: c3.innerW, h: 0.64, fill: { color: m.fill }, line: { color: m.border, width: 0.75 }, rectRadius: 0.05 });
      addToken(s, m.m, {
        x: c3.innerX + 0.1, y: my + 0.14, w: 1.1, h: 0.36,
        fontFace: TOKENS.fonts.title, fontSize: 12, color: C.ink, bold: true,
      });
      s.addText("连接1：" + m.d1, { x: c3.innerX + 1.3, y: my + 0.04, w: 1.3, h: 0.26, fontFace: TOKENS.fonts.body, fontSize: 8.5, color: C.ink, margin: 0 });
      s.addText("连接2：" + m.d2, { x: c3.innerX + 1.3, y: my + 0.32, w: 1.3, h: 0.26, fontFace: TOKENS.fonts.body, fontSize: 8.5, color: C.muted, margin: 0 });
      s.addText(m.risk, { x: c3.innerX + 2.6, y: my + 0.14, w: c3.innerW - 2.7, h: 0.36, fontFace: TOKENS.fonts.body, fontSize: 9.5, color: C.ink, bold: true, margin: 0, valign: "mid", align: "right" });
    });

    // 下方：推荐决策
    const c4 = addCard(s, L.marginLeft, L.contentTop + 3.75, L.slideW - L.marginLeft - L.marginRight, 2.45, {
      fill: C.brandSoft, border: C.brandSoft, title: "🎯 推荐配置路径（从最小化到企业级）", titleColor: C.brand,
    });
    const path = [
      { t: "起步", d: "Universal SSL + Origin CA + Full", color: "3B82F6" },
      { t: "进阶", d: "Advanced Cert / ACM + Full Strict", color: "8B5CF6" },
      { t: "企业", d: "ACM 自购 OV/EV + mTLS + LB", color: C.orange },
    ];
    path.forEach((p, i) => {
      const px = c4.innerX + i * 4.05;
      // 编号圆
      s.addShape("ellipse", { x: px, y: c4.innerY + 0.22, w: 0.42, h: 0.42, fill: { color: p.color }, line: { color: p.color, width: 0 } });
      addToken(s, String(i + 1), {
        x: px, y: c4.innerY + 0.22, w: 0.42, h: 0.42,
        fontFace: TOKENS.fonts.metric, fontSize: 15, color: "FFFFFF", bold: true, align: "center",
      });
      s.addText(p.t, {
        x: px + 0.52, y: c4.innerY + 0.18, w: 1, h: 0.3,
        fontFace: TOKENS.fonts.title, fontSize: 14, color: C.ink, bold: true, margin: 0, valign: "mid",
      });
      s.addText(p.d, {
        x: px + 0.52, y: c4.innerY + 0.54, w: 3.4, h: 0.3,
        fontFace: TOKENS.fonts.body, fontSize: 10.5, color: C.muted, margin: 0, valign: "mid",
      });
      if (i < path.length - 1) {
        s.addShape("line", {
          x: px + 3.95, y: c4.innerY + 0.43, w: 0.15, h: 0,
          line: { color: C.brand, width: 1.5, beginArrowType: "none", endArrowType: "triangle" },
        });
      }
    });
    // 提示
    s.addText("⚠️ 提示：Flexible 模式会让源站与 CF 之间走明文 HTTP，中间人可在 CF→源站段窃取数据，生产环境务必使用 Full Strict + mTLS", {
      x: c4.innerX, y: c4.innerY + 1.28, w: c4.innerW, h: 0.6,
      fontFace: TOKENS.fonts.body, fontSize: 10, color: "991B1B", valign: "mid", margin: 0,
    });

    addSource(s, "参考 docs/SSL_TLS_GUIDE.md · Advanced Certificate Manager (ACM) 允许自定义 CA、有效期、SAN 数量");
  })();

  // ====================================================================
  // SLIDE 6: mTLS 详解
  // ====================================================================
  (function slide6() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "Foundations · 04", pageNum: 6, total: TOTAL });
    addClaim(s, "mTLS：双向 TLS 认证 · 防止绕过 Cloudflare", {
      subClaim: "普通 TLS 仅服务器出示证书；mTLS 要求 Cloudflare 也向源站出示客户端证书，从而证明请求必然来自 CF",
    });

    // 左侧：握手时序
    const c1 = addCard(s, L.marginLeft, L.contentTop + 0.05, 6.4, 4.7, {
      title: "mTLS 握手时序（Edge-to-Origin 连接2）", titleColor: C.success,
    });

    const col_cf = c1.innerX + 1.2;
    const col_og = c1.innerX + 4.8;
    const col_title_y = c1.innerY + 0.1;
    s.addText("Cloudflare Edge", { x: col_cf - 0.8, y: col_title_y, w: 1.8, h: 0.28, fontFace: TOKENS.fonts.title, fontSize: 11, color: C.orange, bold: true, align: "center", margin: 0 });
    s.addText("Origin Server", { x: col_og - 0.8, y: col_title_y, w: 1.8, h: 0.28, fontFace: TOKENS.fonts.title, fontSize: 11, color: C.success, bold: true, align: "center", margin: 0 });
    // 竖线
    s.addShape("rect", { x: col_cf, y: col_title_y + 0.3, w: 0, h: 4.0, line: { color: C.rule, width: 0.75, dashType: "dash" } });
    s.addShape("rect", { x: col_og, y: col_title_y + 0.3, w: 0, h: 4.0, line: { color: C.rule, width: 0.75, dashType: "dash" } });

    const msgs = [
      { y: 0.7, from: "cf", to: "og", text: "Client Hello", color: C.orange },
      { y: 1.2, from: "og", to: "cf", text: "Server Hello + 源站证书", color: C.success },
      { y: 1.8, from: "og", to: "cf", text: "（源站证明自身身份）", color: C.muted, dashed: true, small: true },
      { y: 2.3, from: "cf", to: "og", text: "Client Certificate (CF CA 签发)", color: "7C3AED", hl: true },
      { y: 2.9, from: "og", to: "cf", text: "Certificate Verify · 验证通过 ✅", color: C.success, hl: true },
      { y: 3.5, from: "cf", to: "og", text: "Finished", color: C.orange },
      { y: 3.95, from: "og", to: "cf", text: "Finished", color: C.success },
      { y: 4.3, from: "both", to: "both", text: "════ 双向认证完成 · 加密通信 ════", color: C.brand, bold: true, center: true },
    ];
    msgs.forEach((m) => {
      if (m.center) {
        s.addText(m.text, {
          x: c1.innerX + 0.1, y: c1.innerY + m.y, w: c1.innerW - 0.2, h: 0.3,
          fontFace: TOKENS.fonts.body, fontSize: m.small ? 9 : 10, color: m.color,
          bold: !!m.bold, align: "center", margin: 0,
        });
        return;
      }
      const fromX = m.from === "cf" ? col_cf : col_og;
      const toX = m.to === "cf" ? col_cf : col_og;
      const x1 = Math.min(fromX, toX);
      const x2 = Math.max(fromX, toX);
      const arrowColor = m.color;
      s.addShape("line", {
        x: x1 + 0.05, y: c1.innerY + m.y + 0.14, w: (x2 - x1) - 0.1, h: 0,
        line: {
          color: arrowColor, width: m.hl ? 1.5 : 1,
          beginArrowType: "none", endArrowType: "triangle",
          dashType: m.dashed ? "dash" : "solid",
        },
      });
      s.addText(m.text, {
        x: x1, y: c1.innerY + m.y - 0.04, w: x2 - x1, h: 0.22,
        fontFace: TOKENS.fonts.body, fontSize: m.small ? 8.5 : 9.5, color: m.color,
        align: m.from === "cf" ? "left" : "right", margin: 0,
      });
    });

    // 右侧上：对比表
    const c2 = addCard(s, L.marginLeft + 6.6, L.contentTop + 0.05, 6.1, 2.6, {
      title: "无 mTLS vs 有 mTLS", titleColor: C.brand,
    });
    addTable(
      s, c2.innerX, c2.innerY, c2.innerW,
      [
        ["特性", "无 mTLS", "有 mTLS"],
        ["源站验证", "CF 单向验证源站", "双向验证 ✅"],
        ["源站限制", "需 CF IP 白名单", "仅允许持有有效 CF 客户端证书"],
        ["绕过风险", "伪造 Host 可直达", "无法绕过 · 必须过 CF"],
        ["源站 Nginx 配置", "仅 ssl_certificate", "额外 ssl_client_certificate + ssl_verify_client on"],
      ],
      {
        colW: [1.2, 2.25, 2.25],
        rowH: [0.34, 0.4, 0.4, 0.4, 0.5],
        fontSize: 9.5,
      },
    );

    // 右侧下：Nginx 配置
    const c3 = addCard(s, L.marginLeft + 6.6, L.contentTop + 2.8, 6.1, 1.95, {
      title: "Nginx mTLS 配置片段", titleColor: "374151",
    });
    const nginxCode = [
      'ssl_certificate     /path/origin_ca.pem;',
      'ssl_certificate_key /path/origin_ca.key;',
      '# mTLS — 验证 CF 客户端证书',
      'ssl_client_certificate  /path/cloudflare_ca.pem;',
      'ssl_verify_client       on;    # 核心开关',
      'ssl_verify_depth        2;',
    ];
    s.addShape("rect", {
      x: c3.innerX, y: c3.innerY, w: c3.innerW, h: c3.innerH,
      fill: { color: "0F172A" }, line: { color: "0F172A", width: 0 }, rectRadius: 0.05,
    });
    nginxCode.forEach((ln, i) => {
      s.addText(ln, {
        x: c3.innerX + 0.14, y: c3.innerY + 0.05 + i * 0.27, w: c3.innerW - 0.28, h: 0.24,
        fontFace: "Consolas", fontSize: 9.5, color: ln.startsWith("#") ? "94A3B8" : "22D3EE", margin: 0, valign: "mid",
      });
    });

    addSource(s, "Authenticated Origin Pulls CA 下载：developers.cloudflare.com → SSL → static → authenticated_origin_pulls_ca.pem");
  })();

  // ====================================================================
  // SLIDE 7-16: 10 大场景（每页 2 场景布局，共 5 页）—— 用通用生成器
  // ====================================================================
  const SCENARIOS = [
    {
      no: "1", name: "Full Proxy + Cloudflare 证书 (无 mTLS)",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "Universal SSL · CF 自动签发", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: false, lb: false,
      security: 3, useCase: "基础保护 · 个人网站 · 博客",
      accent: "3B82F6", soft: "DBEAFE",
    },
    {
      no: "2", name: "Full Proxy + Cloudflare 证书 + mTLS",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "Universal SSL · CF 自动签发", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: true, lb: false,
      security: 4, useCase: "需源站认证 · 不暴露源站 IP",
      accent: C.orange, soft: C.orangeSoft,
    },
    {
      no: "3", name: "Full Proxy + 自购买证书 ACM (无 mTLS)",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "自购 OV/EV · ACM 管理", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: false, lb: false,
      security: 4, useCase: "企业品牌展示 · OV/EV 组织信息",
      accent: "7C3AED", soft: "EDE9FE",
    },
    {
      no: "4", name: "Full Proxy + 自购买证书 ACM + mTLS",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "自购 OV/EV · ACM 管理", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: true, lb: false,
      security: 5, useCase: "高安全企业 · 金融/政务",
      accent: "0891B2", soft: "CFFAFE",
    },
    {
      no: "5", name: "Partial Zone Suffix + Cloudflare 证书 (无 mTLS)",
      dns: "Partial · 原 DNS + CNAME", proxy: "Proxied (橙色云)",
      edge: "Universal SSL · 每子域独立", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: false, lb: false,
      security: 3, useCase: "已有 DNS 体系 · 单子域接入",
      accent: "059669", soft: "D1FAE5",
    },
    {
      no: "6", name: "Partial Zone Suffix + Cloudflare 证书 + mTLS",
      dns: "Partial · 原 DNS + CNAME", proxy: "Proxied (橙色云)",
      edge: "Universal SSL · 每子域独立", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: true, lb: false,
      security: 4, useCase: "Partial 接入 + 严格源站认证",
      accent: "DB2777", soft: "FCE7F3",
    },
    {
      no: "7", name: "Full Proxy + Load Balancer (无 mTLS)",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "Universal / ACM 皆可", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: false, lb: true,
      security: 4, useCase: "全球多区域 · 故障转移 · 高可用",
      accent: "2563EB", soft: "DBEAFE",
    },
    {
      no: "8", name: "Full Proxy + Load Balancer + mTLS",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "Universal / ACM 皆可", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: true, lb: true,
      security: 5, useCase: "全球 HA + 严格源站保护",
      accent: "059669", soft: "D1FAE5",
    },
    {
      no: "9", name: "Full Proxy + ACM + Load Balancer (无 mTLS)",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "自购 OV/EV · ACM 管理", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: false, lb: true,
      security: 4, useCase: "企业品牌 + 全球 LB，无 mTLS",
      accent: "4F46E5", soft: "E0E7FF",
    },
    {
      no: "10", name: "Full Proxy + ACM + Load Balancer + mTLS",
      dns: "Full Setup · Cloudflare NS", proxy: "Proxied (橙色云)",
      edge: "自购 OV/EV · ACM 管理", origin: "Origin CA",
      ssl: "Full (Strict)", mtls: true, lb: true,
      security: 5, useCase: "⭐ 企业级完整保护 · 最高安全",
      accent: "0F766E", soft: "CCFBF1",
    },
  ];

  function addScenarioSlide(slideIdx, scA, scB) {
    // 一个页面两个场景上下布局
    const renderScenario = (s, sc, yTop, h) => {
      // 左侧：场景信息面板
      const infoW = 4.3;
      const infoX = L.marginLeft;
      s.addShape("rect", {
        x: infoX, y: yTop, w: infoW, h: h,
        fill: { color: sc.soft }, line: { color: sc.accent, width: 1 }, rectRadius: 0.08,
      });
      // 场景编号
      s.addShape("rect", { x: infoX + 0.18, y: yTop + 0.16, w: 0.56, h: 0.56, fill: { color: sc.accent }, line: { color: sc.accent, width: 0 }, rectRadius: 0.08 });
      addToken(s, sc.no, {
        x: infoX + 0.18, y: yTop + 0.16, w: 0.56, h: 0.56,
        fontFace: TOKENS.fonts.metric, fontSize: 26, color: "FFFFFF", bold: true, align: "center",
      });
      s.addText(sc.name, {
        x: infoX + 0.88, y: yTop + 0.14, w: infoW - 1.0, h: 0.6,
        fontFace: TOKENS.fonts.title, fontSize: 13, color: C.ink, bold: true, valign: "mid", margin: 0,
      });
      // 安全星级
      const stars = "★".repeat(sc.security) + "☆".repeat(5 - sc.security);
      addToken(s, stars, {
        x: infoX + 0.88, y: yTop + 0.72, w: 1.5, h: 0.24,
        fontFace: TOKENS.fonts.metric, fontSize: 14, color: "F59E0B", align: "left", margin: 0,
      });
      // 信息字段
      const fields = [
        ["DNS 类型", sc.dns],
        ["边缘证书", sc.edge],
        ["源站证书", sc.origin],
        ["SSL 模式", sc.ssl],
        ["mTLS", sc.mtls ? "✅ Authenticated Origin Pulls" : "❌ 未启用"],
        ["Load Balancer", sc.lb ? "✅ 多 Pool + 健康检查" : "❌ 未启用"],
        ["适用场景", sc.useCase],
      ];
      fields.forEach((f, i) => {
        const fy = yTop + 1.05 + i * 0.33;
        s.addText(f[0], { x: infoX + 0.18, y: fy, w: 1.1, h: 0.28, fontFace: TOKENS.fonts.body, fontSize: 9, color: C.muted, bold: true, margin: 0, valign: "mid" });
        s.addText(f[1], { x: infoX + 1.28, y: fy, w: infoW - 1.48, h: 0.28, fontFace: TOKENS.fonts.body, fontSize: 9.5, color: C.ink, margin: 0, valign: "mid" });
      });

      // 右侧：架构图
      const diagX = L.marginLeft + infoW + 0.25;
      const diagW = L.slideW - diagX - L.marginRight;
      const diagY = yTop + 0.15;
      const diagH = h - 0.3;

      // 绘制：访客 → CF → [LB?] → 源站
      // 访客
      const vw = 1.15, vh = 0.85;
      const vx = diagX + 0.1;
      const vy = diagY + diagH / 2 - vh / 2;
      addNode(s, vx, vy, vw, vh, {
        fill: "FFFFFF", border: C.rule, borderW: 0.75,
        title: "访客", sub: "浏览器", icon: "🌐",
      });

      // CF Edge 容器
      const cfX = vx + vw + 0.6;
      const cfY = diagY + 0.05;
      const cfW = sc.lb ? 3.3 : 2.6;
      const cfH = diagH - 0.1;
      s.addShape("rect", {
        x: cfX, y: cfY, w: cfW, h: cfH,
        fill: { color: C.orangeSoft }, line: { color: C.orange, width: 0.9 }, rectRadius: 0.08,
      });
      s.addText("☁️ Cloudflare Edge", {
        x: cfX, y: cfY + 0.06, w: cfW, h: 0.26,
        fontFace: TOKENS.fonts.title, fontSize: 10.5, color: C.orange, bold: true, align: "center", margin: 0,
      });

      // Edge Cert
      addNode(s, cfX + 0.15, cfY + 0.38, sc.lb ? 1.4 : 2.3, 0.68, {
        fill: "FFFFFF", border: sc.accent, borderW: 0.75,
        title: sc.lb ? "边缘证书" : sc.edge.split(" · ")[0],
        sub: sc.lb ? sc.edge.split(" · ")[0] : (sc.edge.split(" · ")[1] || ""),
        titleColor: sc.accent,
      });

      if (sc.lb) {
        // ACM (second row)
        addNode(s, cfX + 1.7, cfY + 0.38, 1.45, 0.68, {
          fill: "FFFFFF", border: sc.accent, borderW: 0.75,
          title: sc.edge.split(" · ")[0],
          sub: sc.edge.split(" · ")[1] || "",
          titleColor: sc.accent,
        });
      }

      // Load Balancer
      if (sc.lb) {
        const lbY = cfY + 1.2;
        s.addShape("rect", {
          x: cfX + 0.15, y: lbY, w: cfW - 0.3, h: cfH - 1.55,
          fill: { color: "FFFFFF" }, line: { color: "7C3AED", width: 0.75 }, rectRadius: 0.06,
        });
        s.addText("⚖️ Load Balancer", {
          x: cfX + 0.15, y: lbY + 0.06, w: cfW - 0.3, h: 0.24,
          fontFace: TOKENS.fonts.title, fontSize: 10, color: "5B21B6", bold: true, align: "center", margin: 0,
        });
        const pools = [
          { n: "Pool 1", l: "美" }, { n: "Pool 2", l: "欧" }, { n: "Pool 3", l: "亚" },
        ];
        pools.forEach((p, i) => {
          const px = cfX + 0.28 + i * ((cfW - 0.56) / 3);
          const py = lbY + 0.38;
          s.addShape("rect", {
            x: px, y: py, w: (cfW - 0.7) / 3, h: cfH - 2.1,
            fill: { color: "F5F3FF" }, line: { color: "A78BFA", width: 0.5 }, rectRadius: 0.04,
          });
          s.addText(p.n, { x: px, y: py + 0.04, w: (cfW - 0.7) / 3, h: 0.22, fontFace: TOKENS.fonts.body, fontSize: 8.5, color: "5B21B6", bold: true, align: "center", margin: 0 });
          s.addText(p.l, { x: px, y: py + 0.32, w: (cfW - 0.7) / 3, h: 0.32, fontFace: TOKENS.fonts.body, fontSize: 10, color: C.ink, bold: true, align: "center", margin: 0 });
          s.addText("源站", { x: px, y: py + 0.6, w: (cfW - 0.7) / 3, h: 0.22, fontFace: TOKENS.fonts.body, fontSize: 8, color: C.muted, align: "center", margin: 0 });
        });
      } else {
        // Origin Cert + mTLS 提示
        addNode(s, cfX + 0.15, cfY + cfH - 0.88, cfW - 0.3, 0.68, {
          fill: C.successSoft, border: C.success, borderW: 0.75,
          title: sc.origin + (sc.mtls ? " + mTLS 客户端" : ""),
          sub: sc.mtls ? "双向认证 · Authenticated Origin Pulls" : "CF → 源站加密",
          titleColor: C.success,
        });
      }

      // 源站(s)
      const origins = sc.lb ? 3 : 1;
      const originTotalW = 2.5;
      const ogX = cfX + cfW + 0.6;
      const ogW = sc.lb ? (originTotalW - 0.3) / 3 : 1.6;
      const ogH = sc.lb ? 0.95 : 1.1;
      const ogY = diagY + diagH / 2 - ogH / 2;
      for (let i = 0; i < origins; i++) {
        const ox = sc.lb ? ogX + i * (ogW + 0.15) : ogX;
        addNode(s, ox, ogY, ogW, ogH, {
          fill: C.successSoft, border: C.success, borderW: 0.9,
          title: sc.lb ? `源站${i + 1}` : "源站服务器",
          sub: sc.lb ? (["美", "欧", "亚"][i] + " · " + (sc.mtls ? "mTLS ✓" : "TLS")) : (sc.mtls ? "Nginx · mTLS ✓" : "Nginx/Apache"),
          icon: sc.lb ? "" : "🏢",
          titleColor: C.success,
        });
      }

      // 连接 1
      addArrow(s, vx + vw + 0.02, vy + vh / 2, cfX - 0.02, cfY + cfH / 2 - (sc.lb ? 0.4 : 0), {
        color: sc.accent, width: 1.5,
        label: "连接1 · HTTPS", labelFill: sc.soft,
      });
      // 连接 2
      const con2FromX = cfX + cfW + 0.02;
      const con2ToX = (sc.lb ? ogX : ogX) - 0.02;
      addArrow(s, con2FromX, cfY + cfH - (sc.lb ? 0.4 : 0.28), con2ToX, ogY + ogH / 2, {
        color: C.success, width: 1.5,
        label: sc.mtls ? "连接2 · mTLS" : "连接2 · HTTPS",
        labelFill: C.successSoft,
      });
    };

    const baseY = L.contentTop;
    const halfH = 2.82;
    const gap = 0.14;
    const s = pres.addSlide();
    const isPair = slideIdx % 2 === 1;
    const pageNo = Math.floor(slideIdx / 2) + 7; // 7,8,9,10,11
    addChrome(s, { sectionLabel: `Scenarios ${scA.no} · ${scB.no}`, pageNum: pageNo, total: TOTAL });
    addClaim(s, `场景 ${scA.no} & ${scB.no}`, {
      subClaim: `${scA.name}  ·  ·  ${scB.name}`,
    });
    renderScenario(s, scA, L.contentTop + 0.05, halfH);
    // 分隔
    s.addShape("rect", { x: L.marginLeft, y: L.contentTop + halfH + 0.05 + gap / 2, w: L.slideW - L.marginLeft - L.marginRight, h: 0, line: { color: C.hairline, width: 0.5 } });
    renderScenario(s, scB, L.contentTop + halfH + 0.08 + gap, halfH);

    addSource(s, "参考 docs/REQUEST_FLOW_GUIDE.md 场景 " + scA.no + " 与 " + scB.no + " 查看完整 CLI 配置命令");
  }

  // 生成 5 张场景页
  for (let i = 0; i < 5; i++) {
    addScenarioSlide(i * 2, SCENARIOS[i * 2], SCENARIOS[i * 2 + 1]);
  }

  // ====================================================================
  // SLIDE 17: 场景对比总结
  // ====================================================================
  (function slide17() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "Summary · 09", pageNum: 17, total: TOTAL });
    addClaim(s, "10 大场景多维对比矩阵", {
      subClaim: "从 DNS、证书、mTLS、LB 四个维度交叉分析安全级别与适用场景",
    });

    const rows = [
      ["#", "场景名称", "DNS", "边缘证书", "mTLS", "LB", "安全级", "典型适用"],
      ["1", "Full + Universal", "Full", "Universal", "—", "—", "★★★", "个人博客/站"],
      ["2", "Full + Universal + mTLS", "Full", "Universal", "✓", "—", "★★★★", "需要源站认证"],
      ["3", "Full + ACM 自购", "Full", "ACM OV/EV", "—", "—", "★★★★", "企业品牌展示"],
      ["4", "Full + ACM + mTLS", "Full", "ACM OV/EV", "✓", "—", "★★★★★", "金融/政务高安全"],
      ["5", "Partial + Universal", "CNAME", "Universal", "—", "—", "★★★", "单子域渐进接入"],
      ["6", "Partial + Universal + mTLS", "CNAME", "Universal", "✓", "—", "★★★★", "Partial + 源站认证"],
      ["7", "Full + LB", "Full", "Uni/ACM", "—", "✓", "★★★★", "全球高可用"],
      ["8", "Full + LB + mTLS", "Full", "Uni/ACM", "✓", "✓", "★★★★★", "HA + 防绕过"],
      ["9", "Full + ACM + LB", "Full", "ACM OV/EV", "—", "✓", "★★★★", "企业品牌 + 全球"],
      ["10", "Full + ACM + LB + mTLS", "Full", "ACM OV/EV", "✓", "✓", "★★★★★", "⭐ 企业完整保护"],
    ];
    addTable(
      s, L.marginLeft, L.contentTop + 0.02, L.slideW - L.marginLeft - L.marginRight,
      rows,
      {
        colW: [0.38, 2.3, 0.8, 1.6, 0.75, 0.7, 0.8, 5.2],
        rowH: [0.36, ...Array(10).fill(0.46)],
        fontSize: 9.5,
        align: ["center", "left", "center", "left", "center", "center", "center", "left"],
      },
    );

    // 下方洞察条
    const insights = [
      { k: "最高安全组合", v: "场景 10 · Full + ACM + LB + mTLS", c: C.success },
      { k: "最低门槛组合", v: "场景 1 · Universal SSL，0 成本接入", c: C.info },
      { k: "Partial 最优", v: "场景 6 · CNAME 渐进接入 + mTLS 保护源站", c: C.orange },
      { k: "HA 但无需 OV", v: "场景 8 · LB + mTLS 即可满足 99% 企业", c: "7C3AED" },
    ];
    insights.forEach((ins, i) => {
      const ix = L.marginLeft + i * 3.06;
      const iy = 6.1;
      s.addShape("rect", { x: ix, y: iy, w: 2.95, h: 0.68, fill: { color: C.surface }, line: { color: ins.c, width: 0.75 }, rectRadius: 0.06 });
      s.addText(ins.k, { x: ix + 0.1, y: iy + 0.04, w: 2.75, h: 0.22, fontFace: TOKENS.fonts.body, fontSize: 8.5, color: ins.c, bold: true, margin: 0 });
      s.addText(ins.v, { x: ix + 0.1, y: iy + 0.26, w: 2.75, h: 0.36, fontFace: TOKENS.fonts.body, fontSize: 9, color: C.ink, margin: 0, valign: "mid" });
    });

    addSource(s, "安全星级仅供参考 · 实际风险评估需结合业务合规要求");
  })();

  // ====================================================================
  // SLIDE 18: 选择建议
  // ====================================================================
  (function slide18() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "Recommendation · 10", pageNum: 18, total: TOTAL });
    addClaim(s, "根据需求选择最合适的 Cloudflare 场景", {
      subClaim: "从左到右逐步叠加安全与可用性能力；无需一次到位，可渐进升级",
    });

    // 推荐路径阶梯图
    const pathY = L.contentTop + 0.05;
    const pathH = 3.3;
    s.addShape("rect", { x: L.marginLeft, y: pathY, w: L.slideW - L.marginLeft - L.marginRight, h: pathH, fill: { color: C.surface }, line: { color: C.hairline, width: 0.75 }, rectRadius: 0.08 });

    const tiers = [
      {
        label: "基础保护 Tier 1",
        scene: "场景 1 / 5",
        title: "Cloudflare 免费档",
        items: ["Universal SSL 自动签发", "Origin CA 源站证书（免费）", "Full (Strict) 模式", "基础 WAF 规则 + 缓存"],
        cost: "免费",
        accent: "3B82F6",
        tint: C.infoSoft,
        x: 0.25, w: 3.0,
      },
      {
        label: "源站认证 Tier 2",
        scene: "场景 2 / 4 / 6",
        title: "+ mTLS 防绕过",
        items: ["Authenticated Origin Pulls", "源站只接收 CF 客户端证书请求", "不再需要 CF IP 白名单", "Nginx/Apache 10 行配置"],
        cost: "Pro 起",
        accent: C.orange,
        tint: C.orangeSoft,
        x: 3.45, w: 3.0,
      },
      {
        label: "企业品牌 Tier 3",
        scene: "场景 3 / 4 / 9",
        title: "+ ACM 自购证书",
        items: ["OV/EV 证书显示组织信息", "自定义 CA：DigiCert 等", "自定义 SAN / 有效期", "Total TLS 覆盖所有主机名"],
        cost: "Biz/Ent",
        accent: "7C3AED",
        tint: C.purpleSoft,
        x: 6.65, w: 3.0,
      },
      {
        label: "全球 HA Tier 4",
        scene: "场景 7 / 8 / 10",
        title: "+ Load Balancer",
        items: ["多区域 Pool（美/欧/亚）", "健康检查 + 自动故障转移", "Geo/Least-Conn 调度策略", "FallBack Pool 兜底"],
        cost: "Ent",
        accent: C.success,
        tint: C.successSoft,
        x: 9.85, w: 3.0,
      },
    ];

    tiers.forEach((t, i) => {
      const tx = L.marginLeft + t.x;
      const ty = pathY + 0.2 + i * 0.15; // 阶梯感
      const th = pathH - 0.4 - i * 0.15;
      // 头部色条
      s.addShape("rect", { x: tx, y: ty, w: t.w, h: 0.42, fill: { color: t.accent }, line: { color: t.accent, width: 0 }, rectRadius: 0.06 });
      addToken(s, t.label, {
        x: tx, y: ty, w: t.w - 0.8, h: 0.42,
        fontFace: TOKENS.fonts.body, fontSize: 9, color: "FFFFFF", bold: true, charSpacing: 1, margin: 10,
      });
      addToken(s, t.cost, {
        x: tx + t.w - 0.85, y: ty + 0.08, w: 0.75, h: 0.26,
        fontFace: TOKENS.fonts.body, fontSize: 9, color: t.accent, bold: true, align: "center",
      });
      // 卡片主体
      s.addShape("rect", { x: tx, y: ty + 0.42, w: t.w, h: th - 0.42, fill: { color: "FFFFFF" }, line: { color: C.hairline, width: 0.75 }, rectRadius: 0.06 });
      // 推荐场景
      s.addShape("rect", { x: tx + 0.16, y: ty + 0.58, w: 1.2, h: 0.26, fill: { color: t.tint }, line: { color: t.tint, width: 0 }, rectRadius: 0.04 });
      addToken(s, t.scene, {
        x: tx + 0.16, y: ty + 0.58, w: 1.2, h: 0.26,
        fontFace: TOKENS.fonts.body, fontSize: 8.5, color: t.accent, bold: true, align: "center",
      });
      // 标题
      s.addText(t.title, {
        x: tx + 0.16, y: ty + 0.9, w: t.w - 0.32, h: 0.32,
        fontFace: TOKENS.fonts.title, fontSize: 13, color: C.ink, bold: true, margin: 0, valign: "mid",
      });
      // 列表
      t.items.forEach((it, ii) => {
        const iy = ty + 1.3 + ii * 0.42;
        s.addShape("rect", { x: tx + 0.2, y: iy + 0.12, w: 0.08, h: 0.08, fill: { color: t.accent }, line: { color: t.accent, width: 0 } });
        s.addText(it, {
          x: tx + 0.36, y: iy, w: t.w - 0.52, h: 0.38,
          fontFace: TOKENS.fonts.body, fontSize: 9.5, color: C.ink, valign: "mid", margin: 0,
        });
      });
      // 阶梯箭头
      if (i < tiers.length - 1) {
        const ax = tx + t.w + 0.05;
        const ay = ty + 0.5 + (i + 1) * 0.07;
        s.addShape("line", { x: ax, y: ay, w: 0.32, h: 0, line: { color: C.rule, width: 1, beginArrowType: "none", endArrowType: "triangle" } });
      }
    });

    // CLI 命令速查
    const ccli = addCard(s, L.marginLeft, L.contentTop + 3.5, L.slideW - L.marginLeft - L.marginRight, 2.7, {
      title: "⚡ cfcli 核心命令速查（按对应场景）", titleColor: C.brand,
    });
    const cliCols = [
      [
        ["DNS 记录", "cfcli dns add --type A --name example.com --content 1.2.3.4 --proxied"],
        ["SSL 模式", "cfcli ssl set --mode full-strict"],
        ["Universal SSL", "cfcli certificate universal enable"],
      ],
      [
        ["证书上传 ACM", "cfcli certificate custom upload --cert <crt> --private-key <key>"],
        ["Total TLS", "cfcli certificate total-tls enable --ca lets_encrypt"],
        ["mTLS CA 下载", "curl -o cf_ca.pem developers.cloudflare.com → /ssl/static"],
      ],
      [
        ["健康检查", "cfcli health-checks create --name hc --type http --path /health"],
        ["LB Pool", "cfcli load-balancer pools create --name us --origins server1"],
        ["Load Balancer", "cfcli load-balancer create --name mylb --pool-id <id>"],
      ],
    ];
    cliCols.forEach((col, ci) => {
      const cx = ccli.innerX + ci * 4.05;
      col.forEach((row, ri) => {
        const ry = ccli.innerY + ri * 0.75;
        s.addText(row[0], {
          x: cx, y: ry, w: 1.1, h: 0.26,
          fontFace: TOKENS.fonts.body, fontSize: 9.5, color: C.brand, bold: true, margin: 0,
        });
        s.addShape("rect", {
          x: cx, y: ry + 0.28, w: 3.9, h: 0.4,
          fill: { color: "0F172A" }, line: { color: "0F172A", width: 0 }, rectRadius: 0.04,
        });
        s.addText(row[1], {
          x: cx + 0.08, y: ry + 0.3, w: 3.75, h: 0.36,
          fontFace: "Consolas", fontSize: 8, color: "38BDF8", valign: "mid", margin: 0,
        });
      });
    });

    addSource(s, "CLI 完整命令清单见 docs/COMMAND_GUIDE.md");
  })();

  // ====================================================================
  // SLIDE 19: FAQ 精选（5 问）
  // ====================================================================
  (function slide19() {
    const s = pres.addSlide();
    addChrome(s, { sectionLabel: "FAQ Highlights · 11", pageNum: 19, total: TOTAL });
    addClaim(s, "高频 FAQ · Cloudflare 证书与链路 5 问", {
      subClaim: "完整 FAQ (50+) 见 docs/FAQ_COMPLETE.md，以下为链路与证书相关核心问答",
    });

    const faqs = [
      {
        q: "Q1 · Cloudflare 送的证书每次自动续签，是重新生成吗？",
        a: "是。Universal SSL 是 Cloudflare 通过公共 CA（如 Sectigo/Google）为托管域名自动签发和续签的 DV 证书。每次续签会生成新的私钥和 CSR，用户无需干预；私钥由 CF Edge 保管，不提供下载。如需自管私钥 → 上传自定义证书。",
        c: C.info, bd: C.faqInfo, hd: C.infoSoft,
      },
      {
        q: "Q2 · 如何获取我的证书的公钥和私钥？",
        a: "Universal SSL：私钥由 CF 保管，无法下载。需自行持有私钥 → 上传自定义证书 cfcli certificate custom upload。Origin CA 证书可在面板 SSL/TLS → Origin Server → Create Certificate 生成，此时可获得 PEM 格式公钥和私钥（仅展示一次）。",
        c: C.orange, bd: C.faqOrange, hd: C.orangeSoft,
      },
      {
        q: "Q3 · 加密套件和证书有什么关系？",
        a: "证书决定『谁信任』（CA 身份链），加密套件决定『如何加密』（握手算法 + 对称加密 + MAC）。两者独立：相同证书可搭配不同套件。CF Edge 默认使用『TLS 1.2/1.3 + ECDHE 握手 + AES-GCM/ChaCha20』，可在 SSL/TLS → Edge Certificates → Cipher Suites 自定义（Enterprise 更全）。",
        c: "7C3AED", bd: C.faqPurple, hd: C.purpleSoft,
      },
      {
        q: "Q4 · 除了 IP Lists，还有什么方式限制源站访问？",
        a: "① Authenticated Origin Pulls (mTLS)：源站要求 CF 出示客户端证书，伪造源站 IP/Host 无法通过。② 仅放通 CF IP 段：源站防火墙只允许 CF IP Ranges（需要定期维护）。③ Cloudflare Tunnel (Zero Trust)：源站完全不出公网，出站隧道连到 CF。推荐组合：Tunnel + mTLS 双保险。",
        c: C.success, bd: C.faqSuccess, hd: C.successSoft,
      },
      {
        q: "Q5 · 不同供应商证书有什么限制？",
        a: "CF 支持通用 PEM 证书，限制在于：① 私钥长度必须 ≥ 2048 RSA / P-256 ECC；② 证书链必须完整（bundle-method: ubiquitous/compatible）；③ 通配符 *.domain 匹配一级子域，不匹配多级；④ EV/OV 证书需要组织验证，自动续签需要重新跑验证流程（ACM 可自动完成 HTTP/DNS 验证）。",
        c: "0891B2", bd: C.faqCyan, hd: C.accentSoft,
      },
    ];

    faqs.forEach((f, i) => {
      const col = i < 3 ? 0 : 1;
      const row = i < 3 ? i : i - 3;
      const cx = L.marginLeft + col * 6.12;
      const cy = L.contentTop + row * 2.05;
      const cw = 6.0;
      const ch = 1.95;
      s.addShape("rect", { x: cx, y: cy, w: cw, h: ch, fill: { color: "FFFFFF" }, line: { color: f.bd, width: 0.9 }, rectRadius: 0.08 });
      // Q strip
      s.addShape("rect", { x: cx, y: cy, w: cw, h: 0.42, fill: { color: f.hd }, line: { color: f.hd, width: 0 }, rectRadius: 0.08 });
      s.addText(f.q, {
        x: cx + 0.16, y: cy + 0.06, w: cw - 0.32, h: 0.32,
        fontFace: TOKENS.fonts.title, fontSize: 11, color: C.ink, bold: true, margin: 0, valign: "mid",
      });
      // A text
      s.addText(f.a, {
        x: cx + 0.16, y: cy + 0.52, w: cw - 0.32, h: ch - 0.6,
        fontFace: TOKENS.fonts.body, fontSize: 9.5, color: C.ink, valign: "top", margin: 0, lineSpacingMultiple: 1.25,
      });
    });

    addSource(s, "完整问答：docs/FAQ_COMPLETE.md · 含 50+ 产品级 FAQ 条目");
  })();

  // ====================================================================
  // SLIDE 20: 结束页
  // ====================================================================
  (function slide20() {
    const s = pres.addSlide();
    s.background = { color: "0F2540" };
    s.addShape("rect", { x: 0, y: 0, w: L.slideW, h: 0.06, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
    s.addShape("rect", { x: 0, y: 7.44, w: L.slideW, h: 0.06, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    s.addShape("rect", { x: L.slideW - 0.12, y: 0, w: 0.12, h: L.slideH, fill: { color: "1A3A5C" }, line: { color: "1A3A5C", width: 0 } });

    s.addText("THANK YOU", {
      x: 0.9, y: 1.8, w: 10, h: 1.0,
      fontFace: TOKENS.fonts.title, fontSize: 60, color: "FFFFFF", bold: true, margin: 0,
    });
    s.addText("Cloudflare 请求链路完全指南 · v2.0", {
      x: 0.92, y: 2.9, w: 10, h: 0.5,
      fontFace: TOKENS.fonts.title, fontSize: 22, color: C.orange, margin: 0,
    });
    s.addShape("rect", { x: 0.92, y: 3.55, w: 3.2, h: 0, line: { color: C.accent, width: 1.5 } });

    const resources = [
      ["CLI 工具", "cfcli v1.0.0 · 20+ 模块全覆盖"],
      ["核心文档", "REQUEST_FLOW_GUIDE.md · 10 场景完整步骤"],
      ["产品文档", "CLOUDFLARE_PRODUCTS_GUIDE.md · 非 CLI 产品说明"],
      ["SSL/TLS 指南", "SSL_TLS_GUIDE.md · 证书/ACM/mTLS 详解"],
      ["FAQ", "FAQ_COMPLETE.md · 50+ 问答条目"],
      ["命令速查", "COMMAND_GUIDE.md · cfcli 命令参考"],
    ];
    resources.forEach((r, i) => {
      const rx = 0.9 + (i % 2) * 6;
      const ry = 4.0 + Math.floor(i / 2) * 0.55;
      s.addShape("rect", { x: rx, y: ry + 0.06, w: 0.06, h: 0.2, fill: { color: C.orange }, line: { color: C.orange, width: 0 } });
      addToken(s, r[0], {
        x: rx + 0.22, y: ry, w: 1.3, h: 0.34,
        fontFace: TOKENS.fonts.body, fontSize: 11, color: "94A3B8", bold: true,
      });
      s.addText(r[1], {
        x: rx + 1.55, y: ry, w: 4.2, h: 0.34,
        fontFace: TOKENS.fonts.body, fontSize: 11, color: "CBD5E1", valign: "mid", margin: 0,
      });
    });

    s.addText("© 2026 NC Services Limited · 内部资料 · 版本 v2.0", {
      x: L.slideW - L.marginRight - 5.5, y: 7.02, w: 5.5, h: 0.24,
      fontFace: TOKENS.fonts.body, fontSize: 9, color: "64748B", align: "right", margin: 0,
    });
  })();

  // ====================================================================
  // 写出文件
  // ====================================================================
  const outPath = path.join(__dirname, "..", "Cloudflare_Request_Flow_Guide_v2.0.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("✅ PPT 已生成：", outPath);
  console.log("   幻灯片数：", TOTAL);
  console.log("   尺寸：宽屏 16:9 (13.333 × 7.5 in)");
  console.log("   风格：Consulting Research · 海军蓝/青色证据色系");
}

generatePPT().catch((e) => {
  console.error("❌ PPT 生成失败：", e);
  process.exit(1);
});
