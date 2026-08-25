// =================================================================
// Cloudflare CAB 实施手册 v1.1 · PPT 生成脚本
// 视觉主线：Rigorous · Orderly · Restrained（明亮全亮色调）
// 16:9, 13.333" x 7.5" | 共 20 页
// 覆盖 CAB 手册全部主要章节（nc-demo.cf · Enterprise Plan · Proxied Mode）
// =================================================================
import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_IMG = path.join(__dirname, "assets", "audit-report-cover.jpg");

// ---------- 明亮全亮色调设计 Token（禁止暗色调/深蓝/墨蓝背景）----------
const TOKENS = {
  surface: "FFFBF2",     // 米白底
  panel: "FFFFFF",       // 纯白卡片
  ink: "1C2A3A",         // 深蓝近黑字
  muted: "6B7A8F",       // 次要灰字
  accent: "3A6EA5",      // 天蓝主色（亮，非深蓝）
  accent2: "E7A14C",     // 温暖琥珀强调
  positive: "2F855A",    // 正绿
  caution: "C99512",     // 警告琥珀
  risk: "B03A2E",        // 风险红
  hairline: "D9DEE5",    // 分割线浅灰
  rule: "9AA7BD",
  panelSoft: "F3F7FB",   // 极浅蓝面板
  panelSoftAmber: "FBF3E2",
  panelSoftGreen: "EAF4EC",
  panelSoftRed: "FAEAE8",
  margin: 0.55,
  head: "Microsoft YaHei", headEn: "Calibri", mono: "Consolas",
};
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Cloudflare Platform Team";
pptx.company = "NC Services Limited";
pptx.title = "Cloudflare CAB 实施手册 v1.1 (nc-demo.cf)";
const TOTAL = 20;

// ---------- helpers ----------
const T = (s, txt, o) =>
  s.addText(txt, { margin: 0, wrap: false, vert: "horz", fit: "shrink", ...o });

const footer = (s, n, src) => {
  const { margin } = TOKENS;
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 7.1, w: 13.333 - 2 * margin, h: 0,
    line: { color: TOKENS.hairline, pt: 0.75 },
  });
  if (src)
    s.addText(src, {
      x: margin, y: 7.16, w: 10, h: 0.28,
      fontFace: TOKENS.headEn, fontSize: 9, color: TOKENS.muted, margin: 0, wrap: false,
    });
  T(s, `${n} / ${TOTAL}`, {
    x: 13.333 - margin - 2, y: 7.16, w: 2, h: 0.28,
    fontFace: TOKENS.headEn, fontSize: 10, color: TOKENS.muted, align: "right",
  });
};

const claimBand = (s, sec, claim) => {
  const { margin, accent, accent2, hairline, ink, head, headEn } = TOKENS;
  T(s, sec.toUpperCase(), {
    x: margin, y: 0.4, w: 8, h: 0.32,
    fontFace: headEn, fontSize: 10, bold: true, color: accent,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 0.7, w: 0.55, h: 0, line: { color: accent2, pt: 2 },
  });
  s.addText(claim, {
    x: margin, y: 0.78, w: 13.333 - 2 * margin, h: 0.64,
    fontFace: head, fontSize: 22, bold: true, color: ink, margin: 0,
  });
  s.addShape(pptx.ShapeType.line, {
    x: margin, y: 1.55, w: 13.333 - 2 * margin, h: 0,
    line: { color: hairline, pt: 0.5 },
  });
  return { top: 1.72, bottom: 7.0 };
};

const colorize = (cell) => {
  const t = String(cell);
  if (t.startsWith("✅")) return { fill: TOKENS.panelSoftGreen, color: TOKENS.positive, bold: true };
  if (t.startsWith("❌")) return { fill: TOKENS.panelSoftRed, color: TOKENS.risk, bold: true };
  if (t.startsWith("⚠️")) return { fill: TOKENS.panelSoftAmber, color: TOKENS.caution, bold: true };
  if (t.startsWith("⏳")) return { fill: TOKENS.panelSoftAmber, color: TOKENS.caution, bold: true };
  return null;
};

const table = (s, x0, y0, colW, header, rows, opts = {}) => {
  const rowH = opts.rowH || 0.45;
  const { accent, hairline, panel, ink, head } = TOKENS;
  const colX = [];
  let cx = x0;
  colW.forEach(w => { colX.push(cx); cx += w; });
  header.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: colX[i], y: y0, w: colW[i], h: rowH,
      fill: { color: accent }, line: { color: accent, pt: 0 },
    });
    s.addText(h, {
      x: colX[i] + 0.1, y: y0 + 0.08, w: colW[i] - 0.2, h: rowH - 0.16,
      fontFace: head, fontSize: 10.5, bold: true, color: "FFFFFF",
      align: i === 0 ? "left" : "center", margin: 0,
    });
  });
  rows.forEach((row, r) => {
    const y = y0 + rowH + r * rowH;
    const bg = r % 2 === 0 ? panel : "FBFAF5";
    row.forEach((cell, c) => {
      let fill = bg, color = ink, bold = false;
      if (opts.colorize) {
        const res = opts.colorize(cell, c, r);
        if (res) { fill = res.fill || fill; color = res.color || color; bold = res.bold || bold; }
      }
      s.addShape(pptx.ShapeType.rect, {
        x: colX[c], y, w: colW[c], h: rowH,
        fill: { color: fill }, line: { color: hairline, pt: 0.5 },
      });
      s.addText(cell, {
        x: colX[c] + 0.08, y: y + 0.07, w: colW[c] - 0.16, h: rowH - 0.14,
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

// ============================================================
// 01 封面
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.addImage({ path: COVER_IMG, x: 0, y: 0, w: 13.333, h: 7.5 });
  // 顶部琥珀标签
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: 0.5, w: 6.4, h: 0.42,
    fill: { color: TOKENS.accent2, transparency: 12 }, line: { color: TOKENS.accent2, pt: 0 }, rectRadius: 0.05,
  });
  T(s, "NC-DEMO.CF  ·  CHANGE ADVISORY BOARD  ·  IMPLEMENTATION HANDBOOK", {
    x: TOKENS.margin + 0.2, y: 0.56, w: 6.0, h: 0.3,
    fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: "FFFFFF",
  });
  // 底部元信息条（柔和琥珀底，无暗色）
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.55, w: 13.333, h: 1.95,
    fill: { color: "FFF8E7", transparency: 25 }, line: { color: "FFF8E7", transparency: 100 },
  });
  s.addText("Cloudflare CAB 实施手册\nnc-demo.cf · Legacy App · Proxied Mode · Security Challenge", {
    x: TOKENS.margin, y: 5.7, w: 12.2, h: 1.2,
    fontFace: TOKENS.head, fontSize: 26, bold: true, color: TOKENS.ink,
    margin: 0, lineSpacingMultiple: 1.12,
  });
  T(s, "CRQ-2026-0817-DEMO-001   |   CAB-2026-0817-DEMO-01   |   v1.1   |   2026-08-17   |   Enterprise Plan", {
    x: TOKENS.margin, y: 6.95, w: 12.2, h: 0.3,
    fontFace: TOKENS.headEn, fontSize: 10.5, bold: true, color: TOKENS.accent,
  });
  T(s, "变更窗口 2026-08-23 02:00–06:00 (Asia/Shanghai)   ·   审批人：CAB 委员会 (CIO / CISO / 应用架构 / 网络运维 / SRE Lead)", {
    x: TOKENS.margin, y: 7.22, w: 12.2, h: 0.26,
    fontFace: TOKENS.head, fontSize: 9, color: TOKENS.muted,
  });
})();

// ============================================================
// 02 文档信息与变更概览
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "00 · DOCUMENT CONTROL", "文档信息与变更概览 · v1.1 联网官方核对版");

  // 左：项目元信息卡
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.2, h: 0.42,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("项目元信息", {
    x: TOKENS.margin + 0.2, y: f.top + 0.06, w: 5.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12.5, bold: true, color: "FFFFFF", margin: 0,
  });
  const meta = [
    ["演示域名", "nc-demo.cf (Enterprise · Full Setup · Proxied)"],
    ["Zone ID", "ZONE_ID_NC_DEMO_CF (占位)"],
    ["Account ID", "ACCOUNT_ID_NC_SERVICES (占位)"],
    ["变更编号 (CRQ)", "CRQ-2026-0817-DEMO-001"],
    ["CAB 编号", "CAB-2026-0817-DEMO-01"],
    ["变更窗口", "2026-08-23 02:00 – 06:00 (UTC+8)"],
    ["配套 CLI", "cfcli (COMMAND_GUIDE.md / REQUEST_FLOW_GUIDE.md)"],
    ["版本", "v1.1（联网官方核对 · 修正 WR Business+ / AOP 全 Plan）"],
  ];
  meta.forEach(([k, v], i) => {
    const y = f.top + 0.54 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 6.2, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panel : "FBFAF5" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(k, {
      x: TOKENS.margin + 0.15, y: y + 0.06, w: 1.85, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.8, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(v, {
      x: TOKENS.margin + 2.0, y: y + 0.06, w: 4.1, h: 0.26,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.ink, margin: 0, wrap: false,
    });
  });

  // 右：修订记录 + 审批状态
  const rx = 13.333 - TOKENS.margin - 6.0;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.0, h: 0.42,
    fill: { color: TOKENS.accent2 }, line: { color: TOKENS.accent2, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("修订记录 (v1.1 联网核对)", {
    x: rx + 0.2, y: f.top + 0.06, w: 5.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12.5, bold: true, color: "FFFFFF", margin: 0,
  });
  const rev = [
    ["0.1", "2026-08-10", "初稿框架（Legacy App 通用模板）"],
    ["0.5", "2026-08-13", "替换为 nc-demo.cf 主机名与源站 IP"],
    ["0.9", "2026-08-15", "兼容性评估与 UAT 用例补充"],
    ["1.0", "2026-08-17", "CAB 定稿（含 cfcli 命令与 Nginx 配置）"],
    ["1.1", "2026-08-17", "联网核对：WR Business+ / AOP 全 Plan + 三级别"],
  ];
  rev.forEach(([v, d, c], i) => {
    const y = f.top + 0.54 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 6.0, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panel : "FBFAF5" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: rx + 0.14, y: y + 0.09, w: 0.2, h: 0.2,
      fill: { color: i === 4 ? TOKENS.positive : TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 },
    });
    T(s, v, {
      x: rx + 0.14, y: y + 0.08, w: 0.2, h: 0.2,
      fontFace: TOKENS.headEn, fontSize: 8, bold: true, color: "FFFFFF", align: "center",
    });
    T(s, d, {
      x: rx + 0.42, y: y + 0.06, w: 1.0, h: 0.26,
      fontFace: TOKENS.headEn, fontSize: 9.5, bold: true, color: TOKENS.accent,
    });
    s.addText(c, {
      x: rx + 1.45, y: y + 0.06, w: 4.45, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });
  // 审批状态条
  const by = f.top + 0.54 + 5 * 0.4 + 0.16;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: by, w: 6.0, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftAmber }, line: { color: TOKENS.caution, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("⏳ CAB 审批状态：7 角色待签 (CAB Chair / CISO / CIO / 应用 Owner / 网络运维 / SRE Lead / Change Manager)", {
    x: rx + 0.2, y: by + 0.12, w: 5.6, h: 0.6,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.caution, margin: 0, lineSpacingMultiple: 1.3,
  });

  footer(s, 2, "文档位置：cloudflare-cli/docs/CAB_NC_DEMO_CF.md · 作者：Cloudflare Platform Team");
})();

// ============================================================
// 03 CAB 概述与变更目标
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "01 · EXECUTIVE SUMMARY", "变更背景与目标：Legacy App 零改造接入 Cloudflare Enterprise");

  // 左：变更背景（5 大问题）
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.2, h: 0.4,
    fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("现状 5 大问题（变更背景）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 5.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const issues = [
    ["暴露面过大", "源站 IP 直接出现在公网 DNS，多次 L7 Flood / Slowloris"],
    ["防护陈旧", "WAF 规则库 18 月未更新，不覆盖 OWASP CRS 4.x"],
    ["无真实 IP", "日志只有源站 IP，安全审计与欺诈追溯困难"],
    ["合规缺口", "等保 2.0 三级 / PCI-DSS v4.0 要求未满足"],
    ["连续性风险", "单源站无灾备，源站宕机即业务中断"],
  ];
  issues.forEach(([t, d], i) => {
    const y = f.top + 0.52 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 6.2, h: 0.45,
      fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: TOKENS.margin + 0.12, y: y + 0.12, w: 0.22, h: 0.22,
      fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 },
    });
    T(s, `${i + 1}`, {
      x: TOKENS.margin + 0.12, y: y + 0.11, w: 0.22, h: 0.22,
      fontFace: TOKENS.headEn, fontSize: 9, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(t, {
      x: TOKENS.margin + 0.45, y: y + 0.05, w: 1.7, h: 0.2,
      fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.risk, margin: 0,
    });
    s.addText(d, {
      x: TOKENS.margin + 0.45, y: y + 0.23, w: 5.6, h: 0.2,
      fontFace: TOKENS.head, fontSize: 8.8, color: TOKENS.ink, margin: 0,
    });
  });

  // 右：变更目标 6 项 + 预期收益条
  const rx = 13.333 - TOKENS.margin - 6.0;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.0, h: 0.4,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("变更目标 6 项 + 预期收益", {
    x: rx + 0.2, y: f.top + 0.05, w: 5.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const goals = [
    ["Proxied Mode", "全部公网 DNS 改橙色云 · 源站 IP 从 DNS 消失"],
    ["WAF 上线", "Custom + Managed Ruleset + OWASP CRS PL1 · Block"],
    ["Security Challenge", "/admin / /api/v1/internal + 高 Bot Score → Managed Challenge"],
    ["真实 IP 还原", "Nginx set_real_ip_from + CF-Connecting-IP · 100%"],
    ["源站锁定", "Authenticated Origin Pulls (mTLS) + CF IP Allowlist"],
    ["零改造", "Legacy App 业务代码 0 行变更"],
  ];
  goals.forEach(([t, d], i) => {
    const y = f.top + 0.52 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 6.0, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panelSoftGreen : "FFFFFF" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    T(s, "✓", {
      x: rx + 0.12, y: y + 0.06, w: 0.24, h: 0.26,
      fontFace: TOKENS.headEn, fontSize: 13, bold: true, color: TOKENS.positive, align: "center",
    });
    s.addText(t, {
      x: rx + 0.45, y: y + 0.05, w: 1.85, h: 0.26,
      fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.positive, margin: 0,
    });
    s.addText(d, {
      x: rx + 2.3, y: y + 0.06, w: 3.55, h: 0.26,
      fontFace: TOKENS.head, fontSize: 8.8, color: TOKENS.ink, margin: 0,
    });
  });
  // 收益条
  const by = f.top + 0.52 + 6 * 0.4 + 0.18;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: by, w: 6.0, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.6 }, rectRadius: 0.05,
  });
  s.addText("预期收益：源站 IP 隐藏 100% · DDoS 零感知 · WAF 实时更新 · 真实 IP 100% 还原 · SLA 99.95% → 99.99% · 多 zone 策略 1 处配置", {
    x: rx + 0.2, y: by + 0.1, w: 5.6, h: 0.7,
    fontFace: TOKENS.head, fontSize: 9.8, bold: true, color: TOKENS.accent, margin: 0, lineSpacingMultiple: 1.35,
  });

  footer(s, 3, "第一章 Executive Summary · 业务/技术需求 · 变更目标 · 预期收益");
})();

// ============================================================
// 04 范围与前提条件
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "02 · SCOPE & ASSUMPTIONS", "范围与前提条件 · 7 主机名 Proxied + 2 源站直连");

  // 上：主机名 → 源站映射表
  const header = ["主机名", "源站", "接入方式", "Proxy", "说明"];
  const rows = [
    ["www.nc-demo.cf", "LB Pool HK1+SG1", "Full · Proxied", "🟧 Orange", "主门户 登录/订单/对账"],
    ["api.nc-demo.cf", "LB Pool HK1+SG1", "Full · Proxied", "🟧 Orange", "RESTful API 第三方调用"],
    ["login.nc-demo.cf", "HK1", "Full · Proxied", "🟧 Orange", "表单登录 + 密码找回"],
    ["sso.nc-demo.cf", "HK1", "Full · Proxied", "🟧 Orange", "SAML IdP + OAuth2"],
    ["webhook.nc-demo.cf", "HK1", "Full · Proxied", "🟧 Orange", "支付/物流回调"],
    ["static.nc-demo.cf", "HK1", "Full · Proxied", "🟧 Orange", "JS/CSS/图 (Cache Reserve)"],
    ["admin.nc-demo.cf", "HK1", "Full · Proxied + ZT", "🟧 Orange", "仅 Zero Trust Access"],
    ["origin-hk1.nc-demo.cf", "203.0.113.10", "DNS Only", "⬜ Gray", "源站直连 · 仅 CF IP Allowlist"],
    ["origin-sg1.nc-demo.cf", "198.51.100.10", "DNS Only", "⬜ Gray", "源站直连 · 仅 CF IP Allowlist"],
  ];
  const x0 = TOKENS.margin, y0 = f.top + 0.05;
  const colW = [2.5, 2.1, 2.1, 1.3, 4.6];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.34, bodyFont: 9,
    colorize: (cell) => /Orange/.test(cell) ? { fill: TOKENS.panelSoftAmber, color: TOKENS.caution, bold: true }
      : /Gray/.test(cell) ? { fill: TOKENS.panelSoft, color: TOKENS.accent, bold: true } : null,
  });

  // 下：Out of Scope + 前提条件
  const by = y0 + 10 * 0.34 + 0.15;
  const half = (13.333 - 2 * TOKENS.margin - 0.2) / 2;
  // Out of Scope
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: half, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftAmber }, line: { color: TOKENS.caution, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("Out of Scope（6 项）", {
    x: TOKENS.margin + 0.2, y: by + 0.08, w: half - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.caution, margin: 0,
  });
  const oos = [
    "邮件 SMTP/IMAP（保持原 MX 直连）",
    "非 HTTP 内部系统 RDP/SSH（单独 CRQ · Zero Trust）",
    "数据库迁移（与本变更无关）",
    "Legacy App 代码重构（另行立项）",
    "第三方 SaaS（Salesforce 等 · 供应商负责）",
    "staging.nc-demo.cf 子域（单独 CRQ 解耦）",
  ];
  oos.forEach((t, i) => {
    s.addText(`• ${t}`, {
      x: TOKENS.margin + 0.25, y: by + 0.42 + i * 0.3, w: half - 0.5, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.2, color: TOKENS.ink, margin: 0,
    });
  });
  // 前提条件
  const rx2 = TOKENS.margin + half + 0.2;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx2, y: by, w: half, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("前提条件（全部 ✅ 就绪）", {
    x: rx2 + 0.2, y: by + 0.08, w: half - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.positive, margin: 0,
  });
  const pre = [
    "Network：HK1/SG1 1Gbps · RTT 30ms",
    "Firewall：iptables 已就位（支持 IP Allowlist）",
    "DNS：Cloudflare Registrar · TTL < 3600s",
    "SSL：Universal SSL 已签发 · Origin CA 已申请",
    "Origin：Nginx 1.24.0 支持 set_real_ip_from",
    "Account：Enterprise 已开通 · cfcli verify ✅",
    "Application：仅校验 Host Header（不强校验源 IP）",
    "Monitoring：ELK 已就位 · 可接 Logpush",
  ];
  pre.forEach((t, i) => {
    s.addText(`✅ ${t}`, {
      x: rx2 + 0.25, y: by + 0.42 + i * 0.28, w: half - 0.5, h: 0.24,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });

  footer(s, 4, "第二章 Scope & Assumptions · 7 Proxied + 2 DNS Only · 8 项前提全部就绪");
})();

// ============================================================
// 05 现状评估与现有风险
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "03 · CURRENT STATE", "现状评估 · As-Is 架构缺陷与现有安全控制不足");

  // 左：As-Is 访问路径关键点
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.2, h: 0.4,
    fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("As-Is 访问路径（5 大缺陷）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 5.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const asis = [
    ["①", "客户端直接访问源站公网 IP 203.0.113.10"],
    ["②", "源站 IP 在 DNS 中暴露 (A 203.0.113.10)"],
    ["③", "防护依赖源站本地 WAF + iptables（无 CDN 缓存 · 每次回源）"],
    ["④", "无 DDoS 防护 · 攻击直接打源站"],
    ["⑤", "无真实客户端 IP 还原 · 双 NAT 后日志只有内网 IP"],
    ["⑥", "SG1 备源 198.51.100.10 已部署但未接 LB · 冷备状态"],
  ];
  asis.forEach(([n, d], i) => {
    const y = f.top + 0.52 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 6.2, h: 0.45,
      fill: { color: TOKENS.panelSoftRed }, line: { color: TOKENS.risk, pt: 0.5 }, rectRadius: 0.03,
    });
    T(s, n, {
      x: TOKENS.margin + 0.12, y: y + 0.08, w: 0.35, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 14, bold: true, color: TOKENS.risk, align: "center",
    });
    s.addText(d, {
      x: TOKENS.margin + 0.55, y: y + 0.1, w: 5.5, h: 0.28,
      fontFace: TOKENS.head, fontSize: 9.5, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  // 右：现有安全控制不足 + 现有风险
  const rx = 13.333 - TOKENS.margin - 6.0;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.0, h: 0.4,
    fill: { color: TOKENS.caution }, line: { color: TOKENS.caution, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("现有安全控制不足 + 现有风险", {
    x: rx + 0.2, y: f.top + 0.05, w: 5.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const ctrl = [
    ["WAF", "ModSec 2.9 + CRS 3.0 (2018) · 18 月未更新"],
    ["Firewall", "iptables + 安全组 · 仅 IP/端口 · 无应用层"],
    ["IDS/IPS", "Snort 旁路 · 仅告警不阻断"],
    ["DDoS", "无 · 完全依赖源站带宽"],
    ["Rate Limit", "Nginx limit_req 单机 · 易绕过"],
    ["真实 IP", "缺失 · 双 NAT 后日志只有内网 IP"],
  ];
  ctrl.forEach(([t, d], i) => {
    const y = f.top + 0.52 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 6.0, h: 0.36,
      fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    T(s, t, {
      x: rx + 0.12, y: y + 0.06, w: 1.2, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: TOKENS.caution,
    });
    s.addText(d, {
      x: rx + 1.4, y: y + 0.06, w: 4.5, h: 0.26,
      fontFace: TOKENS.head, fontSize: 8.8, color: TOKENS.ink, margin: 0,
    });
  });
  // 现有风险摘要条
  const by = f.top + 0.52 + 6 * 0.4 + 0.16;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: by, w: 6.0, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftRed }, line: { color: TOKENS.risk, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("现有风险 R-CUR-01~05：源站 IP 暴露(高) · DDoS 缺失(高) · WAF 陈旧(高) · 真实 IP 缺失(中) · 单点无灾备(中)", {
    x: rx + 0.2, y: by + 0.1, w: 5.6, h: 0.7,
    fontFace: TOKENS.head, fontSize: 9.6, bold: true, color: TOKENS.risk, margin: 0, lineSpacingMultiple: 1.35,
  });

  footer(s, 5, "第三章 Current State Assessment · As-Is 架构 / 现有安全控制 / 现有风险");
})();

// ============================================================
// 06 目标架构全景
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "04 · TARGET ARCHITECTURE", "目标架构全景 · CF Edge 11 层链路 + LB HK1/SG1 多区域");

  // 上方：流量链路 11 节点（横向流程）
  const pipeline = [
    ["①", "DNS", "Anycast 权威\nDNSSEC on"],
    ["②", "DDoS", "L3/L4 + L7\nAdvanced"],
    ["③", "TLS", "Universal SSL\nFull Strict"],
    ["④", "Bot", "Bot Score\nJA3/JA4"],
    ["⑤", "WAF", "Custom + Managed\n+ OWASP CRS"],
    ["⑥", "Wait Room", "高并发排队\nBusiness+"],
    ["⑦", "Cache", "Smart Tiered\n+ Reserve"],
    ["⑧", "Ruleset", "Redirect /\nTransform"],
    ["⑨", "Workers", "边缘计算\n可选"],
    ["⑩", "LB", "HK1+SG1\nHealth 5s"],
    ["⑪", "Argo", "Smart Routing\n智能路由"],
  ];
  const pY = f.top + 0.05;
  const pW = (13.333 - 2 * TOKENS.margin - 10 * 0.1) / 11;
  pipeline.forEach((node, i) => {
    const x = TOKENS.margin + i * (pW + 0.1);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: pY, w: pW, h: 1.15,
      fill: { color: i === 10 ? TOKENS.panelSoftAmber : TOKENS.panelSoft },
      line: { color: i === 10 ? TOKENS.accent2 : TOKENS.accent, pt: 0.8 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y: pY, w: pW, h: 0.05, fill: { color: i === 10 ? TOKENS.accent2 : TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 },
    });
    T(s, node[0], {
      x: x + 0.05, y: pY + 0.1, w: pW - 0.1, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 16, bold: true, color: i === 10 ? TOKENS.accent2 : TOKENS.accent, align: "center",
    });
    s.addText(node[1], {
      x: x + 0.04, y: pY + 0.42, w: pW - 0.08, h: 0.28,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: TOKENS.ink, align: "center", margin: 0,
    });
    s.addText(node[2], {
      x: x + 0.04, y: pY + 0.7, w: pW - 0.08, h: 0.42,
      fontFace: TOKENS.head, fontSize: 7.6, color: TOKENS.muted, align: "center", margin: 0, lineSpacingMultiple: 1.1,
    });
    if (i < 10) {
      T(s, "→", {
        x: x + pW - 0.02, y: pY + 0.4, w: 0.14, h: 0.3,
        fontFace: TOKENS.headEn, fontSize: 12, bold: true, color: TOKENS.hairline, align: "center",
      });
    }
  });

  // 中：源站锁定 ⑫ + Origin Pool
  const mY = pY + 1.25;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: mY, w: 13.333 - 2 * TOKENS.margin, h: 0.55,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.8 }, rectRadius: 0.05,
  });
  T(s, "⑫", {
    x: TOKENS.margin + 0.15, y: mY + 0.1, w: 0.4, h: 0.35,
    fontFace: TOKENS.headEn, fontSize: 16, bold: true, color: TOKENS.positive, align: "center",
  });
  s.addText("Authenticated Origin Pulls (mTLS) · CF → 源站双向证书校验 · 源站仅接受来自 Cloudflare 的请求", {
    x: TOKENS.margin + 0.6, y: mY + 0.12, w: 12.0, h: 0.32,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.positive, margin: 0,
  });

  // 下：Origin Pool 双源 + 关键架构要点
  const oY = mY + 0.65;
  const oHalf = (13.333 - 2 * TOKENS.margin - 0.2) / 2;
  // HK1
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: oY, w: oHalf, h: 1.0,
    fill: { color: "FFFFFF" }, line: { color: TOKENS.accent, pt: 1 }, rectRadius: 0.06,
  });
  s.addShape(pptx.ShapeType.rect, { x: TOKENS.margin, y: oY, w: 0.1, h: 1.0, fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 } });
  s.addText("HK1 Origin（主源 · 权重 100）", {
    x: TOKENS.margin + 0.25, y: oY + 0.1, w: oHalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent, margin: 0,
  });
  s.addText("203.0.113.10 · Nginx 1.24 + App · Origin CA · CF IP Allowlist · set_real_ip_from · mTLS Verify (CF Cert)", {
    x: TOKENS.margin + 0.25, y: oY + 0.42, w: oHalf - 0.4, h: 0.5,
    fontFace: TOKENS.mono, fontSize: 8.8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.3,
  });
  // SG1
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + oHalf + 0.2, y: oY, w: oHalf, h: 1.0,
    fill: { color: "FFFFFF" }, line: { color: TOKENS.accent2, pt: 1 }, rectRadius: 0.06,
  });
  s.addShape(pptx.ShapeType.rect, { x: TOKENS.margin + oHalf + 0.2, y: oY, w: 0.1, h: 1.0, fill: { color: TOKENS.accent2 }, line: { color: TOKENS.accent2, pt: 0 } });
  s.addText("SG1 Origin（备源 · 权重 50）", {
    x: TOKENS.margin + oHalf + 0.45, y: oY + 0.1, w: oHalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent2, margin: 0,
  });
  s.addText("198.51.100.10 · 同 HK1 配置 · Health Check GET /healthz 5s · LB 故障自动切换 < 30s", {
    x: TOKENS.margin + oHalf + 0.45, y: oY + 0.42, w: oHalf - 0.4, h: 0.5,
    fontFace: TOKENS.mono, fontSize: 8.8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.3,
  });

  // 底部要点条
  const eY = oY + 1.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: eY, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - eY - 0.05,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("架构要点：DNSSEC 防劫持 · Universal SSL 边缘 + Origin CA 源站 · Full (Strict) · LB Multi-Region HK1+SG1 · Argo Smart Routing · 真实 IP 还原 · 源站 mTLS 锁定", {
    x: TOKENS.margin + 0.2, y: eY + 0.08, w: 13.0 - 0.4, h: 0.6,
    fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.accent, margin: 0, lineSpacingMultiple: 1.3,
  });

  footer(s, 6, "第四章 Target Architecture · 11 节点链路 + mTLS 源站锁定 + HK1/SG1 双源 LB");
})();

// ============================================================
// 07 安全防护分层
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "05 · SECURITY LAYERS", "安全防护分层 · DDoS / WAF / Bot / API Shield / Rate Limit");

  const header = ["层级", "Cloudflare Enterprise 功能（准确名词）", "防护对象"];
  const rows = [
    ["CDN", "Cache Rules + Smart Tiered Cache + Cache Reserve + Polish", "静态资源加速 + 减少回源"],
    ["DDoS Protection", "Advanced DDoS Protection (L3/L4 Network-layer + L7 HTTP DDoS)", "流量型与应用层 DDoS"],
    ["WAF", "Custom Rules + Cloudflare Managed Ruleset + OWASP CRS + Exposed Credentials Check + Page Shield + WAF Attack Score", "OWASP Top 10 + 0day 虚拟补丁"],
    ["Rate Limiting", "Rate Limiting Rules (http_ratelimit) + Advanced Rate Limiting", "暴力破解 / API 滥用"],
    ["Managed Challenge", "Managed Challenge (推荐) / JS Challenge / CAPTCHA", "可疑流量自动挑战"],
    ["Bot Protection", "Bot Management (Bot Score 1-99 + JA3/JA4 + HTTP/2 指纹 + Verified Bots)", "自动化攻击 / 爬虫"],
    ["API Shield", "Schema Validation (OpenAPI) + JWT Validation + mTLS Client Cert", "API 滥用 / 越权 / 机器到机器"],
    ["源站锁定", "Authenticated Origin Pulls (mTLS) + Cloudflare IP Allowlist", "防止绕过 CF 直连源站"],
    ["Zero Trust", "Cloudflare Access (Admin Console · Google OIDC/SAML)", "内部系统身份认证"],
  ];
  const x0 = TOKENS.margin, y0 = f.top + 0.05;
  const colW = [1.9, 8.0, 2.4];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.4, bodyFont: 9.2,
    colorize: (cell, c) => c === 0 ? { fill: TOKENS.panelSoft, color: TOKENS.accent, bold: true } : null,
  });

  // 底部 4 个语义色卡
  const by = y0 + 10 * 0.4 + 0.18;
  const cards = [
    ["L3/L4 + L7", "Advanced DDoS", "不限流量 · 零感知", TOKENS.accent],
    ["Bot Score 1-99", "Bot Management", "JA3/JA4 + HTTP/2 指纹", TOKENS.accent2],
    ["CF Managed + OWASP", "WAF", "实时更新 · 0day 补丁", TOKENS.positive],
    ["Schema + JWT + mTLS", "API Shield", "衍生场景 SaaS", TOKENS.caution],
  ];
  const gap = 0.2;
  const cw = (13.333 - 2 * TOKENS.margin - 3 * gap) / 4;
  cards.forEach((C, i) => {
    const x = TOKENS.margin + i * (cw + gap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: by, w: cw, h: f.bottom - by - 0.05, fill: { color: C[3] },
      line: { color: C[3], pt: 0 }, rectRadius: 0.06,
    });
    s.addText(C[0], {
      x: x + 0.15, y: by + 0.12, w: cw - 0.3, h: 0.3,
      fontFace: TOKENS.headEn, fontSize: 10, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(C[1], {
      x: x + 0.15, y: by + 0.42, w: cw - 0.3, h: 0.32,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(C[2], {
      x: x + 0.15, y: by + 0.78, w: cw - 0.3, h: 0.24,
      fontFace: TOKENS.head, fontSize: 8.8, color: "FFFFFF", align: "center", margin: 0,
    });
  });

  footer(s, 7, "第四章 4.2 Security Layers · 9 层防护 · Enterprise 准确功能名词");
})();

// ============================================================
// 08 SSL/TLS 配置与证书管理
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "06 · SSL / TLS CONFIG", "SSL/TLS 配置与证书管理 · Full (Strict) + Universal SSL + Origin CA");

  // 左：SSL/TLS 配置表
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 7.0, h: 0.4,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("SSL/TLS 配置基线（第九章 9.2）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 6.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const cfg = [
    ["SSL Mode", "Full (Strict)", "边缘→源站 TLS（源站 Origin CA 证书）"],
    ["Min TLS Version", "1.2", "兼容 IE 11 / Legacy Browser"],
    ["TLS 1.3", "On", "启用但不强制"],
    ["0-RTT", "Off", "防重放攻击"],
    ["HSTS", "On · max-age=31536000", "includeSubDomains · preload · Phase 3 启用"],
    ["Authenticated Origin Pulls", "On", "mTLS · 全 Plan 可用（Off/Flexible 下不生效）"],
    ["Always Use HTTPS", "On", "80 → 443 强制跳转"],
    ["Automatic HTTPS Rewrites", "On", "防混合内容"],
    ["Certificate", "Universal SSL + Origin CA", "边缘 + 源站（Origin CA 15 年）"],
  ];
  cfg.forEach(([k, v, d], i) => {
    const y = f.top + 0.52 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 7.0, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panel : "FBFAF5" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(k, {
      x: TOKENS.margin + 0.15, y: y + 0.06, w: 2.3, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.2, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(v, {
      x: TOKENS.margin + 2.5, y: y + 0.06, w: 2.3, h: 0.26,
      fontFace: TOKENS.mono, fontSize: 9, bold: true, color: TOKENS.positive, margin: 0,
    });
    s.addText(d, {
      x: TOKENS.margin + 4.85, y: y + 0.06, w: 2.05, h: 0.26,
      fontFace: TOKENS.head, fontSize: 8.2, color: TOKENS.muted, margin: 0,
    });
  });

  // 右：证书管理 + ACM/Total TLS 说明
  const rx = 13.333 - TOKENS.margin - 4.7;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 4.7, h: 0.4,
    fill: { color: TOKENS.accent2 }, line: { color: TOKENS.accent2, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("证书管理与配额（联网核对）", {
    x: rx + 0.2, y: f.top + 0.05, w: 4.3, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11.5, bold: true, color: "FFFFFF", margin: 0,
  });
  const cert = [
    ["Universal SSL", "边缘默认签发 · Partial 按主机名逐个"],
    ["Origin CA", "源站证书 · 15 年有效"],
    ["ACM 配额", "单张 50 SAN（apex 必含）· Ent 每 Zone 100 张"],
    ["Total TLS", "默认 90 天 · 不适用 LB/Tunnel/Spectrum · 需 Full DNS"],
    ["Automatic SSL/TLS", "2026 推出 · 新 Zone 默认 · Recommender 自动选模式"],
    ["Min TLS 兼容", "1.2 兼容 IE 11（1.3 启用不禁用）"],
  ];
  cert.forEach(([t, d], i) => {
    const y = f.top + 0.52 + i * 0.58;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 4.7, h: 0.52,
      fill: { color: i % 2 === 0 ? TOKENS.panelSoftAmber : "FFFFFF" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(t, {
      x: rx + 0.15, y: y + 0.06, w: 4.4, h: 0.22,
      fontFace: TOKENS.head, fontSize: 10, bold: true, color: TOKENS.accent2, margin: 0,
    });
    s.addText(d, {
      x: rx + 0.15, y: y + 0.27, w: 4.4, h: 0.22,
      fontFace: TOKENS.head, fontSize: 8.6, color: TOKENS.ink, margin: 0,
    });
  });
  // 底部 HSTS 提示条
  const hy = f.top + 0.52 + 6 * 0.58 + 0.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: hy, w: 4.7, h: f.bottom - hy - 0.05,
    fill: { color: TOKENS.panelSoftAmber }, line: { color: TOKENS.caution, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("⚠️ HSTS 在 Phase 3 启用（Phase 1/2 不启用）· 0-RTT 关闭防重放 · Full (Strict) 需源站有效证书", {
    x: rx + 0.2, y: hy + 0.1, w: 4.3, h: 0.7,
    fontFace: TOKENS.head, fontSize: 9, bold: true, color: TOKENS.caution, margin: 0, lineSpacingMultiple: 1.3,
  });

  footer(s, 8, "第九章 9.2 SSL/TLS Configuration · 联网核对：ACM 配额 / Total TLS 限制 / Automatic SSL/TLS");
})();

// ============================================================
// 09 AOP 配置（全 Plan + 三级别）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "07 · AUTHENTICATED ORIGIN PULLS", "AOP 配置 · 全 Plan 可用 + 三独立级别 + 优先级");

  // 上：全 Plan 可用性横幅
  const y1 = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: y1, w: 13.333 - 2 * TOKENS.margin, h: 1.05,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.8 }, rectRadius: 0.06,
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: TOKENS.margin + 0.25, y: y1 + 0.25, w: 0.55, h: 0.55,
    fill: { color: TOKENS.positive }, line: { color: TOKENS.positive, pt: 0 },
  });
  T(s, "✓", {
    x: TOKENS.margin + 0.25, y: y1 + 0.27, w: 0.55, h: 0.5,
    fontFace: TOKENS.headEn, fontSize: 22, bold: true, color: "FFFFFF", align: "center",
  });
  s.addText("AOP 全 Plan 可用（联网核对修正）", {
    x: TOKENS.margin + 1.0, y: y1 + 0.1, w: 11.5, h: 0.4,
    fontFace: TOKENS.head, fontSize: 16, bold: true, color: TOKENS.ink, margin: 0,
  });
  s.addText("Free / Pro / Business / Enterprise 全 Plan 可用 · SSL/TLS 模式为 Off 或 Flexible 时 AOP 不生效（官方明确限制）", {
    x: TOKENS.margin + 1.0, y: y1 + 0.52, w: 11.5, h: 0.4,
    fontFace: TOKENS.head, fontSize: 10.5, color: TOKENS.positive, bold: true, margin: 0, lineSpacingMultiple: 1.3,
  });

  // 下：三级别对照
  const y2 = y1 + 1.2;
  s.addText("三个独立配置级别（可同时启用 · 优先级 Per-hostname > Zone > Global）", {
    x: TOKENS.margin, y: y2, w: 12, h: 0.32,
    fontFace: TOKENS.head, fontSize: 12.5, bold: true, color: TOKENS.accent, margin: 0,
  });
  const levels = [
    ["①", "Per-hostname", "自上传证书", "特定 hostname", "★★★★★", TOKENS.positive, TOKENS.panelSoftGreen,
      "FIPS 支持 · ML-DSA 后量子客户端证书 · 精度最高"],
    ["②", "Zone-level", "自上传证书", "全 Zone", "★★★★", TOKENS.accent2, TOKENS.panelSoftAmber,
      "FIPS 支持 · ML-DSA 后量子 · 全 Zone 统一"],
    ["③", "Global", "CF 共享证书", "全 Zone", "★★★", TOKENS.muted, TOKENS.panelSoft,
      "仅证明请求来自 CF 网络 · 不保证来自本账户（需 Zone/Per）"],
  ];
  const gap = 0.2;
  const lw = (13.333 - 2 * TOKENS.margin - 2 * gap) / 3;
  levels.forEach((lv, i) => {
    const x = TOKENS.margin + i * (lw + gap);
    const y = y2 + 0.4;
    const h = f.bottom - y - 0.05;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: lw, h, fill: { color: lv[6] },
      line: { color: lv[5], pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, { x, y, w: lw, h: 0.08, fill: { color: lv[5] }, line: { color: lv[5], pt: 0 } });
    // 优先级徽章
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.2, y: y + 0.2, w: 0.55, h: 0.55,
      fill: { color: lv[5] }, line: { color: lv[5], pt: 0 },
    });
    T(s, lv[0], {
      x: x + 0.2, y: y + 0.25, w: 0.55, h: 0.45,
      fontFace: TOKENS.headEn, fontSize: 20, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(lv[1], {
      x: x + 0.85, y: y + 0.22, w: lw - 1.0, h: 0.32,
      fontFace: TOKENS.head, fontSize: 14, bold: true, color: lv[5], margin: 0,
    });
    T(s, lv[4], {
      x: x + 0.85, y: y + 0.52, w: lw - 1.0, h: 0.24,
      fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: TOKENS.caution,
    });
    // 详情行
    const rows2 = [["证书来源", lv[2]], ["作用范围", lv[3]]];
    rows2.forEach((r, k) => {
      const ry = y + 0.95 + k * 0.34;
      s.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.2, y: ry, w: lw - 0.4, h: 0.3,
        fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
      });
      s.addText(r[0], {
        x: x + 0.3, y: ry + 0.05, w: 1.2, h: 0.22,
        fontFace: TOKENS.head, fontSize: 8.8, bold: true, color: TOKENS.muted, margin: 0,
      });
      s.addText(r[1], {
        x: x + 1.5, y: ry + 0.05, w: lw - 1.8, h: 0.22,
        fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
      });
    });
    // 说明
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.2, y: y + h - 0.62, w: lw - 0.4, h: 0,
      line: { color: TOKENS.hairline, pt: 0.5 },
    });
    s.addText(lv[7], {
      x: x + 0.2, y: y + h - 0.55, w: lw - 0.4, h: 0.5,
      fontFace: TOKENS.head, fontSize: 8.8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.3,
    });
  });

  footer(s, 9, "第九章 9.2 AOP · docs：ssl/origin-configuration/authenticated-origin-pulls/ > Availability");
})();

// ============================================================
// 10 Waiting Room 与流量整形
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "08 · WAITING ROOM", "Waiting Room 流量整形 · Business+ 可用 + 机场票务衍生场景");

  // 上：Plan 可用性 + 核心要点
  const y1 = f.top + 0.05;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: y1, w: 13.333 - 2 * TOKENS.margin, h: 0.95,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.8 }, rectRadius: 0.06,
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + 0.2, y: y1 + 0.18, w: 2.4, h: 0.6,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("Business+\n可用", {
    x: TOKENS.margin + 0.2, y: y1 + 0.2, w: 2.4, h: 0.56,
    fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0, lineSpacingMultiple: 1.1,
  });
  s.addText("Plan 可用性（联网核对修正：原文档 Pro+ 标注错误）→ ✅ Business + Enterprise · Pro Plan 不具备 Waiting Room", {
    x: TOKENS.margin + 2.8, y: y1 + 0.12, w: 10.0, h: 0.34,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.accent, margin: 0,
  });
  s.addText("常态排队 + 一次性秒杀事件 (Waiting Room Events) · 阈值动态调整 · FIFO 队列 · 不需源站改造", {
    x: TOKENS.margin + 2.8, y: y1 + 0.46, w: 10.0, h: 0.34,
    fontFace: TOKENS.head, fontSize: 10, color: TOKENS.ink, margin: 0,
  });

  // 中：nc-demo.cf 主体 vs 衍生场景 2 机场对照
  const y2 = y1 + 1.05;
  const header = ["维度", "主体场景 (nc-demo.cf)", "衍生场景 2 (机场 / 票务 / 秒杀)"];
  const rows = [
    ["流量模式", "平稳 ~10K DAU", "峰值 100K 并发 (春运 / 促销)"],
    ["源站压力", "低", "高 (库存查询 + 锁座)"],
    ["用户体验", "全部放行", "排队 (Waiting Room)"],
    ["缓存策略", "默认 Bypass", "+ Cache Reserve (R2 · 30 天) + Workers 边缘预检"],
    ["新增功能", "—", "Waiting Room + Waiting Room Events + Cache Reserve + Workers"],
  ];
  const colW = [2.0, 4.6, 5.6];
  table(s, TOKENS.margin, y2, colW, header, rows, {
    rowH: 0.42, bodyFont: 9.2,
    colorize: (cell, c) => c === 2 ? { fill: TOKENS.panelSoftAmber, color: TOKENS.accent2, bold: false } : null,
  });

  // 下：机场场景关键配置命令
  const cy = y2 + 6 * 0.42 + 0.15;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: cy, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - cy - 0.05,
    fill: { color: "1C2A3A".replace("1C2A3A", "F3F7FB") }, line: { color: TOKENS.accent, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("关键配置（机场场景 · cfcli）", {
    x: TOKENS.margin + 0.2, y: cy + 0.08, w: 5, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.accent,
  });
  s.addText("cfcli waiting-room create --name spring-festival --host www.nc-demo.cf --path /buy --total-active-users 5000 --session-duration 10 --queue-all true --queueing-method fifo\nWaiting Room Events (秒杀) · total-active-users 10000 · start/end-at · cfcli cache update --cache-reserve true · cfcli workers deploy inventory-check.js", {
    x: TOKENS.margin + 0.2, y: cy + 0.4, w: 13.0 - 0.4, h: 0.9,
    fontFace: TOKENS.mono, fontSize: 8.6, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.4,
  });

  footer(s, 10, "第八章 Waiting Room · docs：waiting-room/（Business & Enterprise）· 衍生场景 2 机场");
})();

// ============================================================
// 11 可观测性与日志合规
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "09 · OBSERVABILITY", "可观测性与日志合规 · Logpush / Log Explorer Beta / Audit Logs");

  // 左：日志与可观测性能力
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 6.2, h: 0.4,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("日志与可观测性能力（联网核对）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 5.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11.5, bold: true, color: "FFFFFF", margin: 0,
  });
  const obs = [
    ["Logpush → SIEM", "CF → S3/ELK · http_requests · 高频 · cf-ray 串联", TOKENS.accent],
    ["Log Explorer", "⚠️ Beta · 保留期以 Enterprise 合同为准 · R2 单租户存储", TOKENS.caution],
    ["Audit Logs", "账户级操作审计 · 配置变更可追溯", TOKENS.positive],
    ["CF Analytics", "Requests / Bandwidth / Threats / 5xx / WAF / Bot / Cache", TOKENS.accent2],
    ["Grafana (源站)", "Nginx RPS / 5xx / Latency · CPU / Mem / Disk", TOKENS.muted],
    ["ELK Dashboard", "Logpush + access log + 审计日志 · 三方对账", TOKENS.muted],
  ];
  obs.forEach(([t, d, c], i) => {
    const y = f.top + 0.52 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 6.2, h: 0.45,
      fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.rect, { x: TOKENS.margin, y, w: 0.08, h: 0.45, fill: { color: c }, line: { color: c, pt: 0 } });
    s.addText(t, {
      x: TOKENS.margin + 0.2, y: y + 0.05, w: 1.9, h: 0.22,
      fontFace: TOKENS.head, fontSize: 9.8, bold: true, color: c, margin: 0,
    });
    s.addText(d, {
      x: TOKENS.margin + 0.2, y: y + 0.25, w: 5.85, h: 0.2,
      fontFace: TOKENS.head, fontSize: 8.6, color: TOKENS.ink, margin: 0,
    });
  });

  // 右：KPI 关键指标 + 告警
  const rx = 13.333 - TOKENS.margin - 6.0;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.0, h: 0.4,
    fill: { color: TOKENS.accent2 }, line: { color: TOKENS.accent2, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("KPI 关键指标 + 告警阈值", {
    x: rx + 0.2, y: f.top + 0.05, w: 5.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11.5, bold: true, color: "FFFFFF", margin: 0,
  });
  const kpi = [
    ["Login Success Rate", "≥ 99%", "ALT-02 < 95% / 10min Critical"],
    ["API 2xx Rate", "≥ 99.5%", "5xx > 1% / 5min Critical"],
    ["5xx Error Rate", "< 0.1%", "ALT-01 > 1% / 5min"],
    ["Edge TTFB P95", "< 200ms", "Origin Resp P95 < 500ms"],
    ["WAF Block Rate", "< 1%", "ALT-05 > 5% / 10min (误判)"],
    ["Cache Hit Ratio", "> 95% (static)", "Bot Score < 30 占比 < 30%"],
    ["Origin CPU/Mem", "< 70% / 80%", "ALT-03/04 > 90% / 5min High"],
    ["LB / TLS", "HK1 Fail = Critical", "TLS 证书过期 < 30 天 Email"],
  ];
  kpi.forEach(([t, v, a], i) => {
    const y = f.top + 0.52 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 6.0, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panel : "FBFAF5" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addText(t, {
      x: rx + 0.15, y: y + 0.06, w: 2.0, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9, bold: true, color: TOKENS.accent2, margin: 0,
    });
    s.addText(v, {
      x: rx + 2.2, y: y + 0.06, w: 1.5, h: 0.26,
      fontFace: TOKENS.mono, fontSize: 8.8, bold: true, color: TOKENS.positive, margin: 0,
    });
    s.addText(a, {
      x: rx + 3.75, y: y + 0.06, w: 2.15, h: 0.26,
      fontFace: TOKENS.head, fontSize: 7.8, color: TOKENS.muted, margin: 0,
    });
  });
  // 底部 Logpush 命令条
  const ly = f.top + 0.52 + 8 * 0.4 + 0.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: ly, w: 6.0, h: f.bottom - ly - 0.05,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.6 }, rectRadius: 0.05,
  });
  s.addText("cfcli logpush create --dataset http_requests --fields Timestamp,ClientIP,ClientRequestURI,EdgeResponseStatus,WAFAction,BotScore,CFRay --frequency high", {
    x: rx + 0.2, y: ly + 0.1, w: 5.6, h: 0.6,
    fontFace: TOKENS.mono, fontSize: 8.2, color: TOKENS.accent, bold: true, margin: 0, lineSpacingMultiple: 1.3,
  });

  footer(s, 11, "第十四章 Monitoring Plan · Logpush → SIEM · Log Explorer Beta · 10 KPI + 10 Alert");
})();

// ============================================================
// 12 合规框架
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "10 · COMPLIANCE", "合规框架 · 等保 2.0 / PCI-DSS v4.0 / 金融等保 / DLS");

  // 上：合规对照表
  const header = ["合规要求", "现状", "Cloudflare 对应能力 (Enterprise)", "状态"];
  const rows = [
    ["等保 2.0 三级", "缺口", "WAF + DDoS + 真实 IP 还原 + Logpush 审计", "✅ 满足"],
    ["PCI-DSS v4.0", "缺口", "WAF + Page Shield + Exposed Credentials Check + TLS 加密", "✅ 满足"],
    ["金融等保四级", "—（衍生）", "+ Data Localization Suite + 日志 7 年留存 (WORM)", "✅ 衍生 1"],
    ["数据不出境", "—（衍生）", "Data Localization Suite · 流量终止在指定区域 PoP", "✅ 衍生 1/3"],
    ["关键基础设施条例", "—（衍生）", "Magic Transit + Spectrum + Tunnel (OT)", "✅ 衍生 4"],
    ["真实来源审计", "缺失", "CF-Connecting-IP + Nginx set_real_ip_from + SIEM 对账", "✅ 满足"],
    ["日志集中 / SIEM", "本地未集中", "Logpush → ELK / Splunk · cf-ray 串联三方对账", "✅ 满足"],
  ];
  const x0 = TOKENS.margin, y0 = f.top + 0.05;
  const colW = [2.4, 1.4, 6.4, 2.6];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.42, bodyFont: 9,
    colorize: (cell, c) => c === 3 ? colorize(cell) : null,
  });

  // 下：合规闭环 + Data Localization
  const by = y0 + 8 * 0.42 + 0.18;
  const half = (13.333 - 2 * TOKENS.margin - 0.2) / 2;
  // 合规审计闭环
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: by, w: half, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("✅ 合规审计闭环（cf-ray 串联）", {
    x: TOKENS.margin + 0.2, y: by + 0.08, w: half - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.positive, margin: 0,
  });
  s.addText("CF 注入 CF-Connecting-IP → 源站 Nginx 还原 → Legacy App 读取 → 应用审计日志含真实 IP → Logpush + access log → ELK 三方对账（cf-ray 串联）\n\n三方对账：Logpush (CF) + access log cloudflare 格式 (源站) + 审计日志 (应用) → SIEM", {
    x: TOKENS.margin + 0.2, y: by + 0.42, w: half - 0.4, h: 1.0,
    fontFace: TOKENS.head, fontSize: 9.4, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.4,
  });
  // Data Localization Suite
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + half + 0.2, y: by, w: half, h: f.bottom - by - 0.05,
    fill: { color: TOKENS.panelSoftAmber }, line: { color: TOKENS.accent2, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("🌐 Data Localization Suite (Enterprise-only)", {
    x: TOKENS.margin + half + 0.4, y: by + 0.08, w: half - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: TOKENS.accent2, margin: 0,
  });
  s.addText("流量终止在指定区域 PoP · 数据不出境\n\n三大组件：数据本地化（CN PoP）· Geo Steering · 日志区域留存\n\n适用：金融（数据不出境）· 政府（数据主权）\ncfcli zone update-setting --name data_localization --value CN", {
    x: TOKENS.margin + half + 0.4, y: by + 0.42, w: half - 0.4, h: 1.0,
    fontFace: TOKENS.head, fontSize: 9.2, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.4,
  });

  footer(s, 12, "合规：等保 2.0 / PCI-DSS v4.0 / 金融等保四级 / DLS · Logpush → SIEM 7 年留存");
})();

// ============================================================
// 13 实施阶段与里程碑
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "11 · IMPLEMENTATION", "实施阶段与里程碑 · 5 阶段灰度 · 每阶段 ≥ 1 周观察");

  // 5 阶段横向时间线
  const phases = [
    ["Phase 1", "Proxy Enablement", "DNS 切换 + 源站锁定", "Full Strict + mTLS + 真实 IP", TOKENS.accent, TOKENS.panelSoft],
    ["Phase 2", "WAF Rollout", "Log Only → Block", "CF Managed + OWASP + ECC", TOKENS.accent2, TOKENS.panelSoftAmber],
    ["Phase 3", "Rate Limiting", "登录 / API / Admin", "RL-01/02/03 三级阈值", TOKENS.positive, TOKENS.panelSoftGreen],
    ["Phase 4", "Managed Challenge", "灰度 5% → 100%", "Bot Score + /admin + 地理", TOKENS.caution, TOKENS.panelSoftAmber],
    ["Phase 5", "Bot Protection", "Bot Management", "Verified Allow + 恶意 Block", TOKENS.risk, TOKENS.panelSoftRed],
  ];
  const pY = f.top + 0.1;
  const gap = 0.18;
  const pw = (13.333 - 2 * TOKENS.margin - 4 * gap) / 5;
  phases.forEach((p, i) => {
    const x = TOKENS.margin + i * (pw + gap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: pY, w: pw, h: 2.4, fill: { color: p[5] },
      line: { color: p[4], pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, { x, y: pY, w: pw, h: 0.5, fill: { color: p[4] }, line: { color: p[4], pt: 0 } });
    s.addText(p[0], {
      x: x + 0.1, y: pY + 0.08, w: pw - 0.2, h: 0.36,
      fontFace: TOKENS.headEn, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(p[1], {
      x: x + 0.1, y: pY + 0.58, w: pw - 0.2, h: 0.3,
      fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: p[4], align: "center", margin: 0,
    });
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.15, y: pY + 0.92, w: pw - 0.3, h: 0, line: { color: TOKENS.hairline, pt: 0.5 },
    });
    s.addText(p[2], {
      x: x + 0.1, y: pY + 1.0, w: pw - 0.2, h: 0.5,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, align: "center", margin: 0, lineSpacingMultiple: 1.2,
    });
    s.addText(p[3], {
      x: x + 0.1, y: pY + 1.55, w: pw - 0.2, h: 0.7,
      fontFace: TOKENS.mono, fontSize: 7.8, color: TOKENS.muted, align: "center", margin: 0, lineSpacingMultiple: 1.25,
    });
    // 箭头
    if (i < 4) {
      T(s, "→", {
        x: x + pw - 0.05, y: pY + 1.0, w: 0.3, h: 0.4,
        fontFace: TOKENS.headEn, fontSize: 18, bold: true, color: TOKENS.hairline, align: "center",
      });
    }
  });

  // 下：观察期 + 失败策略 + 维护窗口
  const bY = pY + 2.6;
  const cols = [
    ["观察期", "≥ 1 周 / 阶段", "总计 5-6 周", "Phase 2-5 1 周 Log Only → Block"],
    ["失败策略", "Phase 1", "DNS Rollback (15.3)", "Phase 2-5 Pause 对应规则"],
    ["维护窗口", "Phase 1", "2026-08-23 02:00–06:00", "Asia/Shanghai · 业务低峰"],
    ["UAT 用例", "47 个 (34 P0)", "100% 通过", "Auth/API/SSO/WebSocket/DR 等"],
  ];
  const cw = (13.333 - 2 * TOKENS.margin - 3 * gap) / 4;
  cols.forEach((c, i) => {
    const x = TOKENS.margin + i * (cw + gap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: bY, w: cw, h: f.bottom - bY - 0.05,
      fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.8 }, rectRadius: 0.05,
    });
    s.addShape(pptx.ShapeType.rect, { x, y: bY, w: cw, h: 0.1, fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 } });
    s.addText(c[0], {
      x: x + 0.15, y: bY + 0.2, w: cw - 0.3, h: 0.3,
      fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent, margin: 0,
    });
    s.addText(c[1], {
      x: x + 0.15, y: bY + 0.55, w: cw - 0.3, h: 0.28,
      fontFace: TOKENS.headEn, fontSize: 11, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addText(c[2], {
      x: x + 0.15, y: bY + 0.85, w: cw - 0.3, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9.5, bold: true, color: TOKENS.accent2, margin: 0,
    });
    s.addText(c[3], {
      x: x + 0.15, y: bY + 1.15, w: cw - 0.3, h: 0.5,
      fontFace: TOKENS.head, fontSize: 8.6, color: TOKENS.muted, margin: 0, lineSpacingMultiple: 1.3,
    });
  });

  footer(s, 13, "第八章 Implementation Strategy · 5 阶段灰度 · 每阶段 ≥ 1 周观察 · 总计 5-6 周");
})();

// ============================================================
// 14 风险矩阵与兼容性
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "12 · RISK MATRIX", "风险矩阵 · 12 项风险评分 + 10 项兼容性缓解");

  // 左：风险矩阵表
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 7.2, h: 0.4,
    fill: { color: TOKENS.risk }, line: { color: TOKENS.risk, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("风险矩阵 R-01 ~ R-12（Rating = Impact × Probability）", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 6.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", margin: 0,
  });
  const header = ["ID", "Description", "Rating", "Control"];
  const rows = [
    ["R-01", "真实 IP 丢失 (REMOTE_ADDR)", "25", "set_real_ip_from + CF-Connecting-IP"],
    ["R-02", "IE 11 无法过 Challenge", "16", "UA Skip 规则 + Min TLS 1.2"],
    ["R-03", "WAF 误判 API JSON", "16", "api Skip Managed Rulesets"],
    ["R-04", "SAML 触发 WAF XXE", "15", "sso Skip Managed Rulesets"],
    ["R-05", "Webhook 被 Challenge Block", "15", "webhook Skip Challenge + HMAC"],
    ["R-06", "Full Strict 回源失败", "15", "Origin CA 部署 + 先 Full 后 Strict"],
    ["R-07", "WebSocket 被中断", "9", "Cache Bypass + WAF Skip"],
    ["R-08", "上传 > 100MB 失败", "8", "Ent Max Upload 500MB"],
    ["R-09", "动态缓存数据串", "10", "默认 Bypass Cache"],
    ["R-10", "DNS TTL 中断", "9", "TTL 300s + 维护窗口"],
    ["R-11", "mTLS 配置错误", "10", "UAT 灰度 + 回滚预案"],
    ["R-12", "Access 锁死管理员", "10", "Break-glass + 紧急回滚"],
  ];
  const colW = [0.7, 3.2, 0.9, 2.4];
  table(s, TOKENS.margin, f.top + 0.5, colW, header, rows, {
    rowH: 0.36, bodyFont: 8.8,
    colorize: (cell, c) => {
      if (c !== 2) return null;
      const n = parseInt(cell);
      if (n >= 15) return { fill: TOKENS.panelSoftRed, color: TOKENS.risk, bold: true };
      if (n >= 9) return { fill: TOKENS.panelSoftAmber, color: TOKENS.caution, bold: true };
      return { fill: TOKENS.panelSoftGreen, color: TOKENS.positive, bold: true };
    },
  });

  // 右：≥15 分风险 + 兼容性
  const rx = 13.333 - TOKENS.margin - 4.8;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 4.8, h: 0.4,
    fill: { color: TOKENS.caution }, line: { color: TOKENS.caution, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("≥ 15 分风险 + 兼容性缓解", {
    x: rx + 0.2, y: f.top + 0.05, w: 4.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", margin: 0,
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top + 0.5, w: 4.8, h: 1.0,
    fill: { color: TOKENS.panelSoftRed }, line: { color: TOKENS.risk, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("⚠️ ≥ 15 分风险（R-01 ~ R-06）必须在 Phase 1 前完成缓解 + UAT 验证才能 Go-Live", {
    x: rx + 0.2, y: f.top + 0.58, w: 4.4, h: 0.4,
    fontFace: TOKENS.head, fontSize: 9.6, bold: true, color: TOKENS.risk, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addText("全部 ✅ 已缓解并通过 UAT 验证（CAB 审批包）", {
    x: rx + 0.2, y: f.top + 1.05, w: 4.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 9, bold: true, color: TOKENS.positive, margin: 0,
  });

  // 10 项兼容性风险
  s.addText("10 项兼容性风险（均有 Mitigation）", {
    x: rx, y: f.top + 1.6, w: 4.8, h: 0.3,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.accent,
  });
  const compat = [
    "Client IP / Legacy Browser / API 兼容",
    "Session Cookie / SSL-TLS / WebSocket",
    "Upload / Caching / SSO / Callback",
  ];
  compat.forEach((t, i) => {
    const y = f.top + 1.95 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y, w: 4.8, h: 0.36,
      fill: { color: i % 2 === 0 ? TOKENS.panelSoft : "FFFFFF" },
      line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    T(s, "✓", {
      x: rx + 0.12, y: y + 0.05, w: 0.3, h: 0.26,
      fontFace: TOKENS.headEn, fontSize: 12, bold: true, color: TOKENS.positive, align: "center",
    });
    s.addText(t, {
      x: rx + 0.45, y: y + 0.06, w: 4.2, h: 0.26,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });
  // 底部提示
  const ebY = f.top + 1.95 + 3 * 0.4 + 0.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: ebY, w: 4.8, h: f.bottom - ebY - 0.05,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.5 }, rectRadius: 0.05,
  });
  s.addText("Legacy App 零改造：所有兼容性问题通过 Cloudflare 配置（Skip / Transform / Cache Rules）解决，应用代码 0 行变更", {
    x: rx + 0.2, y: ebY + 0.1, w: 4.4, h: 0.8,
    fontFace: TOKENS.head, fontSize: 9.2, bold: true, color: TOKENS.positive, margin: 0, lineSpacingMultiple: 1.35,
  });

  footer(s, 14, "第六/七章 · 12 风险评分 + 10 兼容性 · ≥ 15 分已全部缓解");
})();

// ============================================================
// 15 回滚策略（三级 + 决策树）
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "13 · ROLLBACK PLAN", "回滚策略 · 三级回滚 + 决策树 + 验证");

  // 左：三级回滚
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.top, w: 5.6, h: 0.4,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("三级回滚预案", {
    x: TOKENS.margin + 0.2, y: f.top + 0.05, w: 5.2, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  const rbs = [
    ["1", "DNS Rollback", "Phase 1 全量", "< 5 min (TTL 300s)", "7 主机名切回 Gray Cloud · 短暂中断", TOKENS.risk, TOKENS.panelSoftRed],
    ["2", "Rule Rollback", "Phase 2-5 单级", "< 1 min · 无中断", "Pause 对应 WAF/RL/MC/Bot 规则", TOKENS.caution, TOKENS.panelSoftAmber],
    ["3", "Full Rollback", "Phase 1-5 全量", "< 10 min · 短暂中断", "DNS + 全部规则 + mTLS + Access", TOKENS.accent2, TOKENS.panelSoftAmber],
  ];
  rbs.forEach((r, i) => {
    const y = f.top + 0.52 + i * 0.95;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin, y, w: 5.6, h: 0.86,
      fill: { color: r[6] }, line: { color: r[5], pt: 0.8 }, rectRadius: 0.05,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: TOKENS.margin + 0.18, y: y + 0.18, w: 0.5, h: 0.5,
      fill: { color: r[5] }, line: { color: r[5], pt: 0 },
    });
    T(s, r[0], {
      x: TOKENS.margin + 0.18, y: y + 0.22, w: 0.5, h: 0.42,
      fontFace: TOKENS.headEn, fontSize: 20, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(r[1], {
      x: TOKENS.margin + 0.8, y: y + 0.1, w: 4.6, h: 0.3,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: r[5], margin: 0,
    });
    s.addText(`${r[2]} · ${r[3]}`, {
      x: TOKENS.margin + 0.8, y: y + 0.4, w: 4.6, h: 0.24,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
    s.addText(r[4], {
      x: TOKENS.margin + 0.8, y: y + 0.62, w: 4.6, h: 0.22,
      fontFace: TOKENS.head, fontSize: 8.8, color: TOKENS.muted, margin: 0,
    });
  });
  // 回滚条件条
  const rcY = f.top + 0.52 + 3 * 0.95 + 0.1;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: rcY, w: 5.6, h: f.bottom - rcY - 0.05,
    fill: { color: TOKENS.panelSoftRed }, line: { color: TOKENS.risk, pt: 0.6 }, rectRadius: 0.05,
  });
  s.addText("触发条件：5xx > 5% / 登录 < 80% / WAF 误判 > 5% / mTLS 拒绝全部 / Access 锁死", {
    x: TOKENS.margin + 0.2, y: rcY + 0.1, w: 5.2, h: 0.7,
    fontFace: TOKENS.head, fontSize: 9.4, bold: true, color: TOKENS.risk, margin: 0, lineSpacingMultiple: 1.35,
  });

  // 右：回滚决策树
  const rx = 13.333 - TOKENS.margin - 6.6;
  s.addShape(pptx.ShapeType.roundRect, {
    x: rx, y: f.top, w: 6.6, h: 0.4,
    fill: { color: TOKENS.accent2 }, line: { color: TOKENS.accent2, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("回滚决策树 (Rollback Decision Tree)", {
    x: rx + 0.2, y: f.top + 0.05, w: 6.2, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });
  // 决策树节点
  const dt = [
    ["Go-Live 期间异常", TOKENS.ink, TOKENS.panel, true],
    ["5xx / 服务中断", TOKENS.risk, TOKENS.panelSoftRed, false],
    ["→ 全站 (www+api+login) → DNS Rollback (15.3)", TOKENS.risk, "FFFFFF", false],
    ["→ 单一服务 → Rule Rollback (15.4)", TOKENS.caution, "FFFFFF", false],
    ["WAF 误判 → Pause Managed Rulesets · 15min 观察", TOKENS.caution, TOKENS.panelSoftAmber, false],
    ["未恢复 → DNS Rollback", TOKENS.risk, "FFFFFF", false],
    ["mTLS 拒绝全部 → Disable AOP + nginx ssl_verify_client off", TOKENS.risk, TOKENS.panelSoftRed, false],
    ["Access 锁死 → Pause Cloudflare Access + Break-glass", TOKENS.caution, TOKENS.panelSoftAmber, false],
  ];
  dt.forEach((n, i) => {
    const y = f.top + 0.55 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx + (n[3] ? 1.6 : 0.2), y, w: n[3] ? 3.4 : 6.2, h: 0.42,
      fill: { color: n[2] }, line: { color: n[1], pt: 0.8 }, rectRadius: 0.05,
    });
    s.addText(n[0], {
      x: rx + (n[3] ? 1.7 : 0.3), y: y + 0.07, w: n[3] ? 3.2 : 6.0, h: 0.28,
      fontFace: TOKENS.head, fontSize: 9.2, bold: n[3] || /Rollback|Pause|Disable/.test(n[0]), color: n[1], align: n[3] ? "center" : "left", margin: 0,
    });
    if (!n[3] && i > 0 && i < 4) {
      T(s, "├", {
        x: rx, y: y - 0.35, w: 0.3, h: 0.5,
        fontFace: TOKENS.headEn, fontSize: 16, bold: true, color: TOKENS.hairline,
      });
    }
  });

  footer(s, 15, "第十五章 Rollback Plan · 三级回滚 + 决策树 · 回滚时间 < 10 min");
})();

// ============================================================
// 16 衍生场景矩阵
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "14 · DERIVED SCENARIOS", "衍生场景功能矩阵 · 5 行业 vs Cloudflare 功能");

  const header = ["Cloudflare 功能 (Enterprise)", "主体 nc-demo.cf", "金融", "机场", "政府", "OT", "SaaS"];
  const rows = [
    ["Cloudflare DNS (Anycast) + Universal SSL", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["Advanced DDoS Protection (L3/L4 + L7)", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["WAF (Custom + Managed Rulesets)", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["Bot Management + Managed Challenge", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["Authenticated Origin Pulls (mTLS)", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["Cloudflare Load Balancer (Multi-Region)", "✅ HK1+SG1", "✅ 3 区域", "✅", "✅ 5 个 9", "—", "✅"],
    ["Waiting Room / Events (Business+)", "—", "—", "✅ 春运/秒杀", "—", "—", "—"],
    ["Workers + Workers KV", "—", "✅ KV", "✅ 预检", "✅ Session", "—", "✅ 多租户"],
    ["Argo Smart Routing", "—", "✅", "—", "✅", "—", "—"],
    ["Magic Transit + Spectrum (L4)", "—", "✅", "—", "—", "✅ Modbus", "—"],
    ["Cloudflare Tunnel", "—", "—", "—", "—", "✅", "—"],
    ["Cloudflare Access (Zero Trust)", "✅ admin", "—", "—", "✅ 公务员", "✅ OT 运维", "✅ 租户"],
    ["Data Localization Suite", "—", "✅ 不出境", "—", "✅ 主权", "—", "—"],
    ["API Shield (Schema/JWT/mTLS) + Discovery", "—", "—", "—", "—", "—", "✅"],
    ["Logpush → SIEM", "✅ ELK", "✅ 7 年", "✅", "✅", "✅", "✅"],
  ];
  const x0 = TOKENS.margin, y0 = f.top + 0.05;
  const colW = [4.4, 1.5, 1.3, 1.3, 1.3, 1.3, 1.3];
  table(s, x0, y0, colW, header, rows, {
    rowH: 0.31, bodyFont: 8.2,
    colorize: (cell, c) => {
      if (c === 0) return { fill: TOKENS.panelSoft, color: TOKENS.accent, bold: true };
      if (/^✅/.test(cell)) return { fill: TOKENS.panelSoftGreen, color: TOKENS.positive, bold: true };
      if (cell === "—") return { fill: "FBFAF5", color: TOKENS.muted, bold: false };
      return null;
    },
  });

  // 底部 5 场景标签条
  const by = y0 + 16 * 0.31 + 0.12;
  const tags = [
    ["金融", "多区域 Active-Active + 严格合规", TOKENS.accent],
    ["机场", "高并发票务 + Waiting Room", TOKENS.accent2],
    ["政府", "全民服务 + 数据主权", TOKENS.positive],
    ["OT", "Spectrum + Magic Transit", TOKENS.caution],
    ["SaaS", "API Shield + 多租户", TOKENS.risk],
  ];
  const gap = 0.15;
  const tw = (13.333 - 2 * TOKENS.margin - 4 * gap) / 5;
  tags.forEach((t, i) => {
    const x = TOKENS.margin + i * (tw + gap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: by, w: tw, h: f.bottom - by - 0.05, fill: { color: t[2] },
      line: { color: t[2], pt: 0 }, rectRadius: 0.05,
    });
    s.addText(t[0], {
      x: x + 0.1, y: by + 0.1, w: tw - 0.2, h: 0.32,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(t[1], {
      x: x + 0.1, y: by + 0.46, w: tw - 0.2, h: 0.4,
      fontFace: TOKENS.head, fontSize: 8.2, color: "FFFFFF", align: "center", margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  footer(s, 16, "衍生场景功能矩阵 · 5 行业对照 · docs 主体场景 + 衍生 1-5");
})();

// ============================================================
// 17 衍生场景详情
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "15 · SCENARIO DETAILS", "衍生场景详情 · 关键差异 + 新增功能 + 回滚要点");

  const sc = [
    {
      n: "1", name: "金融", sub: "多区域 Active-Active + 严格合规", c: TOKENS.accent, bg: TOKENS.panelSoft,
      diff: "99.999% (3 区域) · 金融等保四级 · 数据不出境 · 日志 7 年",
      feat: "Data Localization · LB Geo Steering · Argo · Logpush→SIEM · Workers KV",
      roll: "Data Localization 关闭 · LB 切单区域 · Argo 禁用",
    },
    {
      n: "2", name: "机场", sub: "高并发票务 + Waiting Room", c: TOKENS.accent2, bg: TOKENS.panelSoftAmber,
      diff: "峰值 100K 并发 · 排队体验 · Cache Reserve · Workers 预检",
      feat: "Waiting Room + Events · Cache Reserve (R2·30天) · Workers 库存预检",
      roll: "Waiting Room 关闭 · Cache Reserve 关闭 · Workers 路由回退",
    },
    {
      n: "3", name: "政府", sub: "全民服务 + 数据主权", c: TOKENS.positive, bg: TOKENS.panelSoftGreen,
      diff: "亿级用户 · 5 个 9 可用 · 数据主权 · 公务员 ZT",
      feat: "Data Localization (CN PoP) · Multi-Region LB · Workers KV · Access · Page Shield",
      roll: "Data Localization 关闭 · LB 切单区域 · Access 策略禁用",
    },
    {
      n: "4", name: "OT", sub: "关键基础设施 + Spectrum", c: TOKENS.caution, bg: TOKENS.panelSoftAmber,
      diff: "TCP/UDP (Modbus/OPC UA) · OT 网络防护 · 关基条例",
      feat: "Spectrum (L4) · Magic Transit (L3/L4) · Tunnel · Access · WAF Custom",
      roll: "Spectrum 禁用 · Magic Transit 撤回 · Tunnel 断开",
    },
    {
      n: "5", name: "SaaS", sub: "多租户 + API Shield + Zero Trust", c: TOKENS.risk, bg: TOKENS.panelSoftRed,
      diff: "多租户隔离 · API 80% · API Key+JWT+mTLS · 防越权",
      feat: "API Shield (Schema+JWT+mTLS) · Discovery · Sequence · Workers · KV",
      roll: "API Shield 禁用 · JWT 禁用 · mTLS 禁用 · Workers 回退",
    },
  ];
  const x0 = TOKENS.margin, gap = 0.2;
  const cw = (13.333 - 2 * x0 - 4 * gap) / 5;
  const y0 = f.top + 0.05;
  const ch = f.bottom - y0 - 0.05;
  sc.forEach((S, i) => {
    const x = x0 + i * (cw + gap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: y0, w: cw, h: ch, fill: { color: S.bg },
      line: { color: S.c, pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, { x, y: y0, w: cw, h: 0.1, fill: { color: S.c }, line: { color: S.c, pt: 0 } });
    // 编号圆
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + cw / 2 - 0.32, y: y0 + 0.2, w: 0.64, h: 0.64,
      fill: { color: S.c }, line: { color: S.c, pt: 0 },
    });
    T(s, S.n, {
      x: x + cw / 2 - 0.32, y: y0 + 0.26, w: 0.64, h: 0.5,
      fontFace: TOKENS.headEn, fontSize: 24, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(S.name, {
      x: x + 0.1, y: y0 + 0.92, w: cw - 0.2, h: 0.3,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: S.c, align: "center", margin: 0,
    });
    s.addText(S.sub, {
      x: x + 0.1, y: y0 + 1.22, w: cw - 0.2, h: 0.42,
      fontFace: TOKENS.head, fontSize: 8.2, color: TOKENS.muted, align: "center", margin: 0, lineSpacingMultiple: 1.2,
    });
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.15, y: y0 + 1.68, w: cw - 0.3, h: 0, line: { color: TOKENS.hairline, pt: 0.5 },
    });
    // 差异
    T(s, "差异", {
      x: x + 0.15, y: y0 + 1.74, w: cw - 0.3, h: 0.22,
      fontFace: TOKENS.headEn, fontSize: 8, bold: true, color: S.c,
    });
    s.addText(S.diff, {
      x: x + 0.15, y: y0 + 1.96, w: cw - 0.3, h: 0.7,
      fontFace: TOKENS.head, fontSize: 8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
    });
    // 新增功能
    T(s, "新增功能", {
      x: x + 0.15, y: y0 + 2.7, w: cw - 0.3, h: 0.22,
      fontFace: TOKENS.headEn, fontSize: 8, bold: true, color: S.c,
    });
    s.addText(S.feat, {
      x: x + 0.15, y: y0 + 2.92, w: cw - 0.3, h: 0.85,
      fontFace: TOKENS.head, fontSize: 7.8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
    });
    // 回滚要点
    s.addShape(pptx.ShapeType.line, {
      x: x + 0.15, y: y0 + 3.85, w: cw - 0.3, h: 0, line: { color: TOKENS.hairline, pt: 0.5 },
    });
    T(s, "回滚要点", {
      x: x + 0.15, y: y0 + 3.92, w: cw - 0.3, h: 0.22,
      fontFace: TOKENS.headEn, fontSize: 8, bold: true, color: TOKENS.risk,
    });
    s.addText(S.roll, {
      x: x + 0.15, y: y0 + 4.14, w: cw - 0.3, h: 0.6,
      fontFace: TOKENS.head, fontSize: 7.8, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.25,
    });
  });

  footer(s, 17, "衍生场景 1-5 · 金融 / 机场 / 政府 / OT / SaaS · 差异 + 新增功能 + 回滚要点");
})();

// ============================================================
// 18 验收标准
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "16 · SUCCESS CRITERIA", "验收标准 · 技术 / 业务 / 安全 三类成功标准");

  const groups = [
    {
      title: "Technical · 技术成功标准", c: TOKENS.accent, bg: TOKENS.panelSoft,
      items: [
        ["DNS Proxied 切换", "7 主机名 100% Proxied"],
        ["SSL Mode Full (Strict)", "启用 + 源站验证成功"],
        ["mTLS (AOP)", "启用 · 直连源站 IP 失败"],
        ["WAF Block 模式", "CF Managed + OWASP CRS Block"],
        ["Rate Limiting 触发", "暴力破解 100 次触发 Challenge"],
        ["Managed Challenge", "Bot Score < 30 触发"],
        ["真实 IP 还原", "100% 日志含 CF-Connecting-IP"],
        ["灾备切换", "HK1 下线 → LB 切 SG1 < 30s"],
        ["5xx 错误率", "< 0.1% (24h)"],
      ],
    },
    {
      title: "Business · 业务成功标准", c: TOKENS.accent2, bg: TOKENS.panelSoftAmber,
      items: [
        ["业务功能完整", "47 UAT 用例 100% 通过"],
        ["用户无感知", "客户投诉 < 5 单"],
        ["第三方对接正常", "8 家 Webhook 全部正常"],
        ["性能提升", "TTFB P95 < 200ms"],
        ["SLA", "99.99% (28 天观察期)"],
      ],
    },
    {
      title: "Security · 安全成功标准", c: TOKENS.positive, bg: TOKENS.panelSoftGreen,
      items: [
        ["源站 IP 隐藏", "dig 不返回源站 IP"],
        ["DDoS 防护", "攻击期间 RPS 下降 < 5%"],
        ["OWASP Top 10 防护", "渗透测试 0 高危"],
        ["真实 IP 审计", "100% 审计日志含真实 IP"],
        ["合规", "等保 2.0 三级 / PCI-DSS v4.0"],
        ["Bot 防护", "Bot Score < 10 全部 Block"],
      ],
    },
  ];
  const x0 = TOKENS.margin, gap = 0.25;
  const cw = (13.333 - 2 * x0 - 2 * gap) / 3;
  const y0 = f.top + 0.05;
  groups.forEach((G, i) => {
    const x = x0 + i * (cw + gap);
    const h = f.bottom - y0 - 0.05;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: y0, w: cw, h, fill: { color: G.bg },
      line: { color: G.c, pt: 1 }, rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, { x, y: y0, w: cw, h: 0.5, fill: { color: G.c }, line: { color: G.c, pt: 0 } });
    s.addText(G.title, {
      x: x + 0.15, y: y0 + 0.08, w: cw - 0.3, h: 0.36,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    G.items.forEach(([t, d], k) => {
      const iy = y0 + 0.62 + k * 0.5;
      s.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.15, y: iy, w: cw - 0.3, h: 0.44,
        fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
      });
      T(s, "✓", {
        x: x + 0.22, y: iy + 0.06, w: 0.3, h: 0.32,
        fontFace: TOKENS.headEn, fontSize: 14, bold: true, color: G.c, align: "center",
      });
      s.addText(t, {
        x: x + 0.55, y: iy + 0.04, w: cw - 0.85, h: 0.2,
        fontFace: TOKENS.head, fontSize: 9, bold: true, color: G.c, margin: 0,
      });
      s.addText(d, {
        x: x + 0.55, y: iy + 0.22, w: cw - 0.85, h: 0.2,
        fontFace: TOKENS.head, fontSize: 8.4, color: TOKENS.ink, margin: 0,
      });
    });
  });

  footer(s, 18, "第十七章 Success Criteria · 技术 9 + 业务 5 + 安全 6 · UAT 100% 通过");
})();

// ============================================================
// 19 CAB 审批包
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "17 · CAB APPROVAL PACKAGE", "CAB 审批包 · 风险 / 变更 / 测试 / 回滚摘要");

  // 上：4 个统计卡
  const stats = [
    ["12", "项风险", "≥ 15 分已缓解", TOKENS.accent],
    ["47", "UAT 用例", "100% 通过 (34 P0)", TOKENS.positive],
    ["3", "级回滚", "回滚 < 10 min", TOKENS.accent2],
    ["0", "应用改造", "Legacy 零改造", TOKENS.caution],
  ];
  const sy = f.top + 0.05;
  const sgap = 0.2;
  const sw = (13.333 - 2 * TOKENS.margin - 3 * sgap) / 4;
  stats.forEach((S, i) => {
    const x = TOKENS.margin + i * (sw + sgap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: sy, w: sw, h: 1.35, fill: { color: S[3] },
      line: { color: S[3], pt: 0 }, rectRadius: 0.06,
    });
    s.addText(S[0], {
      x: x + 0.1, y: sy + 0.15, w: sw - 0.2, h: 0.7,
      fontFace: TOKENS.headEn, fontSize: 40, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(S[1], {
      x: x + 0.1, y: sy + 0.85, w: sw - 0.2, h: 0.24,
      fontFace: TOKENS.head, fontSize: 12, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(S[2], {
      x: x + 0.1, y: sy + 1.08, w: sw - 0.2, h: 0.22,
      fontFace: TOKENS.head, fontSize: 8.8, color: "FFFFFF", align: "center", margin: 0,
    });
  });

  // 中：变更摘要 + 测试摘要
  const my = sy + 1.5;
  const mhalf = (13.333 - 2 * TOKENS.margin - 0.2) / 2;
  // 变更摘要
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: my, w: mhalf, h: 1.5,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("变更摘要 (Change Summary)", {
    x: TOKENS.margin + 0.2, y: my + 0.08, w: mhalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11.5, bold: true, color: TOKENS.accent, margin: 0,
  });
  const cs = [
    ["范围", "nc-demo.cf Zone · 7 主机名 Proxied"],
    ["CF 功能", "DNS+SSL+DDoS+WAF+RL+MC+Bot+AOP+LB+Cache+Access"],
    ["源站改造", "Nginx (set_real_ip_from + mTLS + CF IP Allowlist)"],
    ["实施周期", "5 阶段 · 每阶段 1 周 · 总计 5-6 周"],
    ["维护窗口", "2026-08-23 02:00–06:00 (Phase 1)"],
  ];
  cs.forEach(([k, v], i) => {
    const y = my + 0.4 + i * 0.26;
    s.addText(k, {
      x: TOKENS.margin + 0.2, y, w: 1.0, h: 0.22,
      fontFace: TOKENS.head, fontSize: 8.8, bold: true, color: TOKENS.muted, margin: 0,
    });
    s.addText(v, {
      x: TOKENS.margin + 1.25, y, w: mhalf - 1.45, h: 0.22,
      fontFace: TOKENS.head, fontSize: 8.6, color: TOKENS.ink, margin: 0,
    });
  });
  // 测试摘要
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + mhalf + 0.2, y: my, w: mhalf, h: 1.5,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("测试摘要 (47 UAT · 100% Pass)", {
    x: TOKENS.margin + mhalf + 0.4, y: my + 0.08, w: mhalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 11.5, bold: true, color: TOKENS.positive, margin: 0,
  });
  const ts = "Auth 9 · API 8 · Upload 5 · SSO 4 · Payment 3 · WebSocket 4 · Compat 5 · Security 8 · Real IP 3 · DR 3";
  s.addText(ts, {
    x: TOKENS.margin + mhalf + 0.4, y: my + 0.45, w: mhalf - 0.6, h: 0.5,
    fontFace: TOKENS.head, fontSize: 9.2, color: TOKENS.ink, margin: 0, lineSpacingMultiple: 1.4,
  });
  s.addText("✅ 47 / 47 通过 · 0 失败 · 含 34 个 P0 用例", {
    x: TOKENS.margin + mhalf + 0.4, y: my + 1.05, w: mhalf - 0.6, h: 0.3,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: TOKENS.positive, margin: 0,
  });

  // 下：执行建议条
  const ey = my + 1.62;
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: ey, w: 13.333 - 2 * TOKENS.margin, h: f.bottom - ey - 0.05,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.05,
  });
  s.addText("📌 执行建议：建议 CAB 批准本变更 Go-Live。所有 ≥ 15 分风险已缓解 + UAT 验证；3 级回滚预案完备 (< 10 min)；预期收益显著；Legacy App 零改造，业务风险低。", {
    x: TOKENS.margin + 0.25, y: ey + 0.1, w: 13.0 - 0.5, h: 0.7,
    fontFace: TOKENS.head, fontSize: 11, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.35,
  });
  s.addText("条件：Phase 1 维护窗口执行 · Phase 2-5 每阶段 ≥ 1 周观察 · 监控告警 Go-Live 前就位", {
    x: TOKENS.margin + 0.25, y: ey + 0.82, w: 13.0 - 0.5, h: 0.26,
    fontFace: TOKENS.head, fontSize: 9.5, color: "FFF8E7", margin: 0,
  });

  footer(s, 19, "第十九章 CAB Approval Package · 风险 / 变更 / 测试 / 回滚摘要 + 执行建议");
})();

// ============================================================
// 20 结语与附录
// ============================================================
(() => {
  const s = pptx.addSlide();
  s.background = { color: TOKENS.surface };
  const f = claimBand(s, "18 · CONCLUSION & APPENDIX", "结语：CAB 闭环达成 · 附录与文档定位");

  // 上：CAB 闭环检查清单（4 个统计）
  const stats = [
    ["20", "章", "覆盖 CAB 全流程", TOKENS.accent],
    ["5", "阶段", "灰度实施", TOKENS.accent2],
    ["5", "衍生场景", "行业扩展", TOKENS.positive],
    ["100%", "UAT", "47 用例通过", TOKENS.caution],
  ];
  const sy = f.top + 0.05;
  const sgap = 0.2;
  const sw = (13.333 - 2 * TOKENS.margin - 3 * sgap) / 4;
  stats.forEach((S, i) => {
    const x = TOKENS.margin + i * (sw + sgap);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: sy, w: sw, h: 1.45, fill: { color: S[3] },
      line: { color: S[3], pt: 0 }, rectRadius: 0.06,
    });
    s.addText(S[0], {
      x: x + 0.1, y: sy + 0.18, w: sw - 0.2, h: 0.75,
      fontFace: TOKENS.headEn, fontSize: 42, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(S[1], {
      x: x + 0.1, y: sy + 0.95, w: sw - 0.2, h: 0.26,
      fontFace: TOKENS.head, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0,
    });
    s.addText(S[2], {
      x: x + 0.1, y: sy + 1.2, w: sw - 0.2, h: 0.22,
      fontFace: TOKENS.head, fontSize: 9, color: "FFFFFF", align: "center", margin: 0,
    });
  });

  // 中：文档定位 + 闭环检查
  const my = sy + 1.6;
  const mhalf = (13.333 - 2 * TOKENS.margin - 0.2) / 2;
  // 文档定位
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: my, w: mhalf, h: f.bottom - my - 0.5,
    fill: { color: TOKENS.panelSoft }, line: { color: TOKENS.accent, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("📋 文档定位与附录", {
    x: TOKENS.margin + 0.2, y: my + 0.08, w: mhalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.accent, margin: 0,
  });
  const docs = [
    ["01", "CAB_NC_DEMO_CF.md", "v1.1 · 本手册"],
    ["02", "REQUEST_FLOW_GUIDE.md", "v3.7 · 请求链路"],
    ["03", "SSL_TLS_GUIDE.md", "v1.3 · SSL/TLS 指南"],
    ["04", "COMMAND_GUIDE.md", "cfcli 命令参考"],
    ["05", "runbooks/RB-06-rollback.md", "紧急回滚 Runbook"],
  ];
  docs.forEach((d, i) => {
    const y = my + 0.45 + i * 0.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: TOKENS.margin + 0.15, y, w: mhalf - 0.3, h: 0.36,
      fill: { color: "FFFFFF" }, line: { color: TOKENS.hairline, pt: 0.5 }, rectRadius: 0.03,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: TOKENS.margin + 0.28, y: y + 0.07, w: 0.22, h: 0.22,
      fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 },
    });
    T(s, d[0], {
      x: TOKENS.margin + 0.28, y: y + 0.06, w: 0.22, h: 0.22,
      fontFace: TOKENS.headEn, fontSize: 8, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText(d[1], {
      x: TOKENS.margin + 0.6, y: y + 0.06, w: 2.5, h: 0.26,
      fontFace: TOKENS.mono, fontSize: 8.6, bold: true, color: TOKENS.ink, margin: 0,
    });
    s.addText(d[2], {
      x: TOKENS.margin + 3.1, y: y + 0.06, w: mhalf - 3.3, h: 0.26,
      fontFace: TOKENS.head, fontSize: 8.2, color: TOKENS.muted, margin: 0,
    });
  });
  // CAB 闭环检查
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin + mhalf + 0.2, y: my, w: mhalf, h: f.bottom - my - 0.5,
    fill: { color: TOKENS.panelSoftGreen }, line: { color: TOKENS.positive, pt: 0.8 }, rectRadius: 0.05,
  });
  s.addText("✅ CAB 闭环检查清单（全部就绪）", {
    x: TOKENS.margin + mhalf + 0.4, y: my + 0.08, w: mhalf - 0.4, h: 0.3,
    fontFace: TOKENS.head, fontSize: 12, bold: true, color: TOKENS.positive, margin: 0,
  });
  const checks = [
    "范围 / 现状 / 目标 / 风险 / 兼容性 已明确",
    "5 阶段灰度 + 配置基线 + 规则目录已固化",
    "47 UAT (34 P0) 100% 通过 · 证据已收集",
    "Go-Live 时间线 + 监控 KPI/告警/Dashboard 就位",
    "3 级回滚 + 决策树 + 事件响应 SEV 1-4 就位",
    "三类成功标准 + 运营交接 Runbook 已明确",
    "5 衍生场景 + 全景链路图已绘制",
  ];
  checks.forEach((t, i) => {
    s.addText(`✅ ${t}`, {
      x: TOKENS.margin + mhalf + 0.4, y: my + 0.5 + i * 0.32, w: mhalf - 0.6, h: 0.28,
      fontFace: TOKENS.head, fontSize: 9, color: TOKENS.ink, margin: 0,
    });
  });

  // 底部最终结论条
  s.addShape(pptx.ShapeType.roundRect, {
    x: TOKENS.margin, y: f.bottom - 0.38, w: 13.333 - 2 * TOKENS.margin, h: 0.38,
    fill: { color: TOKENS.accent }, line: { color: TOKENS.accent, pt: 0 }, rectRadius: 0.04,
  });
  s.addText("📌 文档结束 · nc-demo.cf CAB v1.1 · 2026-08-17 · 覆盖 20 章 + 5 衍生场景 + 全景链路 · 待 CAB 7 角色签字 Go-Live", {
    x: TOKENS.margin + 0.2, y: f.bottom - 0.35, w: 13.0 - 0.4, h: 0.32,
    fontFace: TOKENS.head, fontSize: 10.5, bold: true, color: "FFFFFF", align: "center", margin: 0,
  });

  footer(s, 20, "第二十章 Appendices · 文档定位 + CAB 闭环检查 · END OF HANDBOOK");
})();

// ========== 输出 ==========
const OUT = path.join(__dirname, "Cloudflare_CAB实施手册_v1.1.pptx");
await pptx.writeFile({ fileName: OUT });
console.log("✅ PPT 生成：", OUT);