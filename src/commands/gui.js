/**
 * @file `cfcli gui` — Open API Explorer-style Web GUI (auto-generated from registry).
 *
 * Layout (à la Alibaba Cloud OpenAPI Explorer):
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ Header: cfcli GUI | Profile ▾ | Theme                    │
 *   ├──────────┬─────────────────────────┬──────────────────────┤
 *   │ Sidebar  │  Parameter Form         │  Preview / Output    │
 *   │ (tree +  │  (required markers,     │  (cmd preview, curl, │
 *   │  search) │   type badges, desc)    │  history, JSON view) │
 *   └──────────┴─────────────────────────┴──────────────────────┘
 *
 * Backend routes (unchanged): /api/registry, /api/profiles,
 *   /api/profile/active, /api/run (child-process isolated).
 */

const http = require('http');
const { buildRegistry } = require('../utils/registry');
const { loadProfiles, getActiveProfileName, setActiveProfileName } = require('../utils/profiles');
const { formatInfo, formatError, formatSuccess } = require('../utils/formatter');

// Inline HTML — no external dependencies, no build step.
const GUI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>cfcli — API Explorer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#faf9f7;--surface:#ffffff;--surface-2:#fdfcfa;--border:#ece9e4;--border-soft:#f3f1ec;
    --text:#1a1a2e;--text-2:#3d3d4f;--muted:#8a8a9a;--muted-2:#a8a8b3;
    --accent:#e8741c;--accent-2:#d4640f;--accent-soft:#fef3e8;--accent-tint:#fff8f0;
    --orange-light:#f5a623;--code-bg:#fafafa;--code-fg:#1a1a2e;
    --ok:#16a34a;--ok-bg:#ecfdf5;--err:#dc2626;--err-bg:#fef2f2;
    --warn:#d97706;--warn-bg:#fffbeb;
    --shadow-xs:0 1px 2px rgba(26,26,46,.04);
    --shadow-sm:0 1px 3px rgba(26,26,46,.06),0 1px 2px rgba(26,26,46,.04);
    --shadow-md:0 4px 12px rgba(26,26,46,.08),0 1px 3px rgba(26,26,46,.04);
    --shadow-lg:0 12px 40px rgba(26,26,46,.12),0 4px 12px rgba(26,26,46,.06);
    --radius:10px;--radius-sm:6px;--radius-xs:4px;
  }
  :root[data-theme="dark"]{
    --bg:#131318;--surface:#1a1a22;--surface-2:#1e1e28;--border:#2a2a35;--border-soft:#232329;
    --text:#e8e8f0;--text-2:#c0c0d0;--muted:#7a7a8a;--muted-2:#6a6a7a;
    --accent:#f5a623;--accent-2:#e8741c;--accent-soft:#2a2010;--accent-tint:#221a0a;
    --code-bg:#0f0f14;--code-fg:#cdd6f4;
    --shadow-xs:0 1px 2px rgba(0,0,0,.2);--shadow-sm:0 1px 3px rgba(0,0,0,.3);
    --shadow-md:0 4px 12px rgba(0,0,0,.4);--shadow-lg:0 12px 40px rgba(0,0,0,.5);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Manrope',sans-serif;background:var(--bg);color:var(--text);font-size:13px;font-weight:400;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  .app{display:flex;flex-direction:column;height:100vh;overflow:hidden}
  /* Header */
  header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 20px;display:flex;align-items:center;gap:16px;flex-shrink:0;height:52px;box-shadow:var(--shadow-xs);position:relative;z-index:10}
  header .logo{font-family:'Sora',sans-serif;font-weight:700;font-size:16px;color:var(--text);letter-spacing:-.3px;display:flex;align-items:center;gap:8px}
  header .logo .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
  header .logo small{font-family:'Manrope';font-weight:500;font-size:11px;color:var(--muted);background:var(--accent-tint);padding:2px 8px;border-radius:20px;border:1px solid var(--accent-soft);margin-left:4px;letter-spacing:.2px}
  header .spacer{flex:1}
  header .profile-sel{display:flex;align-items:center;gap:8px}
  header .profile-sel label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
  header select{font-family:'Manrope';background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-xs);padding:5px 28px 5px 10px;font-size:12px;font-weight:500;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a8a9a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
  header select:hover{border-color:var(--accent)}
  header .icon-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-xs);cursor:pointer;font-size:14px;color:var(--muted);transition:all .15s}
  header .icon-btn:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-tint)}
  /* Main grid */
  .main{flex:1;display:grid;grid-template-columns:256px 1fr 440px;overflow:hidden;min-height:0}
  /* Sidebar */
  aside.sidebar{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
  .search-box{padding:14px 14px 10px;border-bottom:1px solid var(--border-soft)}
  .search-box input{width:100%;padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12.5px;font-family:'Manrope';background:var(--surface-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238a8a9a' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 10px center;color:var(--text);transition:all .15s}
  .search-box input::placeholder{color:var(--muted-2)}
  .search-box input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background-color:var(--surface)}
  .tree{flex:1;overflow-y:auto;padding:6px 0}
  .tree .group{margin:1px 0}
  .tree .group-head{padding:7px 14px 7px 12px;font-family:'Sora';font-weight:600;font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;cursor:pointer;display:flex;align-items:center;gap:10px;user-select:none;transition:color .15s}
  .tree .group-head:hover{color:var(--text-2)}
  .tree .group-head .arrow{width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid currentColor;opacity:.5;transition:transform .2s ease;margin-right:4px}
  .tree .group.collapsed .arrow{transform:rotate(-90deg)}
  .tree .group-head .count{font-family:'JetBrains Mono';font-size:9.5px;font-weight:500;background:var(--bg);padding:1px 5px;border-radius:8px;color:var(--muted-2);margin-left:2px}
  .tree .group.collapsed .group-body{display:none}
  .tree .group-body{padding:0}
  .tree .leaf{padding:5px 14px 5px 26px;cursor:pointer;font-size:12.5px;font-weight:500;color:var(--text-2);border-left:2px solid transparent;transition:all .12s;display:flex;align-items:center;gap:6px;position:relative}
  .tree .leaf:hover{background:var(--accent-tint);border-left-color:var(--orange-light);color:var(--text)}
  .tree .leaf.active{background:var(--accent-soft);border-left-color:var(--accent);color:var(--accent);font-weight:600}
  .tree .leaf.active::after{content:'';position:absolute;right:10px;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:var(--accent)}
  .tree .leaf .badge-d{color:var(--err);font-size:9px;font-weight:700;margin-left:auto;background:var(--err-bg);padding:1px 4px;border-radius:3px}
  .tree .leaf .m-tag{font-size:8.5px;font-weight:700;letter-spacing:.3px;padding:1px 4px;border-radius:3px;margin-left:auto;flex-shrink:0;text-transform:uppercase}
  .m-get{background:#e8f4fd;color:#045691}
  .m-post{background:#e8f7ed;color:#0a7a3f}
  .m-put{background:#fff3e0;color:#b8530a}
  .m-patch{background:#f3e8fd;color:#7c3aed}
  .m-delete{background:#fde8e8;color:#b91c1c}
  /* Center: form */
  section.form-pane{overflow-y:auto;padding:24px 28px;background:var(--bg);min-height:0}
  .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);text-align:center;gap:12px}
  .empty-state .icon{width:56px;height:56px;border-radius:14px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:var(--shadow-sm)}
  .empty-state .title{font-family:'Sora';font-size:15px;font-weight:600;color:var(--text-2)}
  .empty-state .sub{font-size:12.5px;color:var(--muted);max-width:280px;line-height:1.5}
  .cmd-header{margin-bottom:20px}
  .cmd-header h2{font-family:'JetBrains Mono';font-size:18px;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:-.2px}
  .cmd-header .desc{color:var(--muted);font-size:13px;line-height:1.5}
  .badges{margin:10px 0 20px;display:flex;gap:6px;flex-wrap:wrap}
  .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:600;font-family:'Manrope';letter-spacing:.3px}
  .badge.destructive{background:var(--err-bg);color:var(--err);border:1px solid #fecaca}
  .badge.read{background:#f0f7ff;color:#0369a1;border:1px solid #bae0fd}
  .badge.write{background:var(--warn-bg);color:var(--warn);border:1px solid #fde68a}
  .badge.override{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
  .panel-title{font-family:'Sora';font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px;display:flex;align-items:center;gap:8px}
  .panel-title::after{content:'';flex:1;height:1px;background:var(--border-soft)}
  .params{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .param{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;box-shadow:var(--shadow-xs);transition:border-color .15s,box-shadow .15s}
  .param:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft),var(--shadow-xs)}
  .param label{font-size:12px;font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-family:'Manrope'}
  .param label .req{color:var(--err);font-weight:700;font-size:13px}
  .param label .opt{font-family:'JetBrains Mono';color:var(--text-2);font-weight:500;font-size:11.5px}
  .param label .type-tag{font-size:9.5px;font-family:'JetBrains Mono';font-weight:600;background:var(--accent-tint);padding:1px 6px;border-radius:10px;color:var(--accent);text-transform:uppercase;letter-spacing:.3px;border:1px solid var(--accent-soft)}
  .param .desc{font-size:11.5px;color:var(--muted);margin-bottom:8px;line-height:1.45}
  .param input,.param select,.param textarea{padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:13px;font-family:'JetBrains Mono';background:var(--surface-2);color:var(--text);transition:all .15s}
  .param input:focus,.param select:focus{outline:none;border-color:var(--accent);background:var(--surface)}
  .args-section{margin:12px 0;display:flex;flex-direction:column;gap:10px}
  .args-section .arg-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;box-shadow:var(--shadow-xs)}
  .args-section .arg-item label{font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;margin-bottom:4px}
  .args-section .arg-item .arg-desc{font-size:11.5px;color:var(--muted);margin-bottom:8px;line-height:1.45}
  .args-section .arg-item input{width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:13px;font-family:'JetBrains Mono';background:var(--surface-2);color:var(--text)}
  .args-section .arg-item input:focus{outline:none;border-color:var(--accent);background:var(--surface)}
  .run-bar{position:sticky;bottom:0;background:linear-gradient(to top,var(--bg) 60%,transparent);border-top:1px solid var(--border-soft);padding:16px 0 4px;margin-top:24px;display:flex;gap:14px;align-items:center}
  .run-bar button{background:var(--accent);color:#fff;border:none;padding:9px 28px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600;font-family:'Sora';letter-spacing:.2px;box-shadow:0 1px 2px rgba(232,116,28,.3),0 4px 12px rgba(232,116,28,.15);transition:all .15s}
  .run-bar button:hover{background:var(--accent-2);transform:translateY(-1px);box-shadow:0 2px 4px rgba(232,116,28,.3),0 8px 20px rgba(232,116,28,.2)}
  .run-bar button:active{transform:translateY(0)}
  .run-bar button.destructive{background:var(--err);box-shadow:0 1px 2px rgba(220,38,38,.3),0 4px 12px rgba(220,38,38,.15)}
  .run-bar button.destructive:hover{background:#b91c1c;box-shadow:0 2px 4px rgba(220,38,38,.3),0 8px 20px rgba(220,38,38,.2)}
  .run-bar .status{font-size:12px;color:var(--muted);font-family:'JetBrains Mono';font-weight:500}
  .run-bar .status.ok{color:var(--ok)}
  .run-bar .status.err{color:var(--err)}
  /* Right: preview */
  aside.preview-pane{background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
  .preview-tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;padding:0 4px;background:var(--surface-2)}
  .preview-tabs .tab{padding:11px 16px;cursor:pointer;font-size:12px;font-weight:600;font-family:'Sora';color:var(--muted);border-bottom:2px solid transparent;transition:all .15s;display:flex;align-items:center;gap:6px;letter-spacing:.2px}
  .preview-tabs .tab:hover{color:var(--text-2)}
  .preview-tabs .tab.active{color:var(--accent);border-bottom-color:var(--accent)}
  .preview-tabs .tab .count{font-family:'JetBrains Mono';font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:600}
  .preview-body{flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column;min-height:0}
  #tab-preview,#tab-history{overflow-y:auto}
  #tab-output{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden}
  .section-label{font-family:'Sora';font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
  .cmd-preview{background:var(--code-bg);color:var(--code-fg);padding:14px 16px;border-radius:var(--radius-sm);font-family:'JetBrains Mono';font-size:12.5px;white-space:pre-wrap;word-break:break-all;line-height:1.6;box-shadow:var(--shadow-sm);border:1px solid var(--border)}
  .cmd-preview .prompt{color:var(--orange-light);font-weight:600}
  .curl-preview{background:var(--code-bg);color:var(--code-fg);padding:14px 16px;border-radius:var(--radius-sm);font-family:'JetBrains Mono';font-size:11.5px;white-space:pre-wrap;word-break:break-all;line-height:1.6;margin-top:8px;box-shadow:var(--shadow-sm);border:1px solid var(--border)}
  .copy-btn{font-family:'Sora';font-size:10px;font-weight:600;background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:var(--radius-xs);cursor:pointer;transition:all .15s;text-transform:uppercase;letter-spacing:.5px}
  .copy-btn:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-tint)}
  /* History */
  .history-list{display:flex;flex-direction:column;gap:6px}
  .history-item{padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;box-shadow:var(--shadow-xs);transition:all .15s}
  .history-item:hover{border-color:var(--accent);box-shadow:var(--shadow-sm);transform:translateY(-1px)}
  .history-item .hcmd{font-family:'JetBrains Mono';font-size:11.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)}
  .history-item .hstatus{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;font-family:'Sora'}
  .history-item .hstatus.ok{background:var(--ok-bg);color:var(--ok)}
  .history-item .hstatus.err{background:var(--err-bg);color:var(--err)}
  .history-item .htime{font-size:10px;color:var(--muted-2);font-family:'JetBrains Mono'}
  .history-empty{padding:24px;text-align:center;color:var(--muted);font-size:12px}
  /* Output */
  .output-view{background:var(--code-bg);color:var(--code-fg);padding:14px 16px;border-radius:var(--radius-sm);font-family:'JetBrains Mono';font-size:12px;white-space:pre;word-break:normal;line-height:1.6;overflow:auto;flex:1;min-height:0;box-shadow:var(--shadow-sm);border:1px solid var(--border)}
  .output-view.error{color:var(--err)}
  .output-empty{color:var(--muted);font-size:12px;padding:24px;text-align:center}
  .json-key{color:#045691}
  .json-str{color:#0a7a3f}
  .json-num{color:#b8530a}
  .json-bool{color:#7c3aed}
  .json-null{color:#8a8a9a}
  /* Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(26,26,46,.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:100;animation:fadeIn .15s ease;padding:20px}
  .modal-overlay.show{display:flex}
  .modal{background:var(--surface);border-radius:var(--radius);padding:24px;max-width:480px;width:92%;max-height:calc(100vh - 40px);overflow-y:auto;box-shadow:var(--shadow-lg);border:1px solid var(--border);animation:slideUp .2s ease}
  .modal h3{font-family:'Sora';color:var(--err);margin-bottom:10px;font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px}
  .modal h3::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--err);box-shadow:0 0 0 4px var(--err-bg)}
  .modal p{color:var(--text-2);font-size:13px;margin-bottom:16px;line-height:1.6;font-family:'Manrope'}
  .modal .cmd-box{background:var(--code-bg);color:var(--code-fg);padding:12px 14px;border-radius:var(--radius-xs);font-family:'JetBrains Mono';font-size:12px;margin-bottom:20px;word-break:break-all;line-height:1.6;border:1px solid #2a2a3a}
  .modal .actions{display:flex;gap:10px;justify-content:flex-end}
  .modal button{padding:8px 18px;border-radius:var(--radius-xs);cursor:pointer;font-size:13px;font-weight:600;font-family:'Sora';transition:all .15s}
  .modal button.cancel{border:1px solid var(--border);background:var(--surface);color:var(--text-2)}
  .modal button.cancel:hover{background:var(--bg);border-color:var(--muted)}
  .modal button.confirm{background:var(--err);color:#fff;border:1px solid var(--err);box-shadow:0 1px 3px rgba(220,38,38,.3)}
  .modal button.confirm:hover{background:#b91c1c;transform:translateY(-1px);box-shadow:0 4px 12px rgba(220,38,38,.25)}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes fadeStagger{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
  .tree .leaf{animation:fadeStagger .2s ease both}
  /* Responsive: 5-level breakpoint system */
  /* XL: > 1400px — default, spacious three-column */
  /* LG: 1200-1400px — slightly narrower columns */
  @media (max-width:1400px){
    .main{grid-template-columns:240px 1fr 400px}
    section.form-pane{padding:22px 24px}
  }
  /* MD: 1000-1200px — compact three-column */
  @media (max-width:1200px){
    .main{grid-template-columns:220px 1fr 340px}
    section.form-pane{padding:20px 20px}
    .params{grid-template-columns:1fr 1fr;gap:8px}
  }
  /* SM: 768-1000px — two-column, right side splits top/bottom (form fixed, preview fills) */
  @media (max-width:1000px){
    .main{grid-template-columns:200px 1fr;grid-template-rows:minmax(300px,45%) 1fr}
    aside.sidebar{grid-row:1 / span 2}
    section.form-pane{grid-column:2;grid-row:1;padding:16px 18px;display:flex;flex-direction:column}
    section.form-pane .run-bar{position:sticky;bottom:0;background:var(--bg);padding:8px 0 4px;margin-top:auto}
    aside.preview-pane{display:flex !important;grid-column:2;grid-row:2;border-left:none;border-top:1px solid var(--border)}
    .params{grid-template-columns:1fr 1fr}
    header .logo small{display:none}
  }
  /* Tablet: 480-768px — narrow sidebar, single-column params */
  @media (max-width:768px){
    .main{grid-template-columns:170px 1fr;grid-template-rows:minmax(280px,42%) 1fr}
    aside.sidebar{grid-row:1 / span 2}
    section.form-pane{grid-column:2;grid-row:1;padding:14px 14px;display:flex;flex-direction:column}
    section.form-pane .run-bar{position:sticky;bottom:0;background:var(--bg);padding:8px 0 4px;margin-top:auto}
    .params{grid-template-columns:1fr;gap:8px}
    .modal{padding:18px}
    #profileFormGrid{grid-template-columns:1fr !important}
    header .profile-sel label{display:none}
    header select{font-size:11px;padding:4px 24px 4px 8px}
    header .icon-btn{width:28px;height:28px;font-size:12px}
    .cmd-header h2{font-size:16px}
    .output-view{font-size:11px;padding:10px 12px}
    .cmd-preview,.curl-preview{font-size:11px;padding:10px 12px}
  }
  /* Mobile: < 480px — minimal, stack everything */
  @media (max-width:480px){
    .main{grid-template-columns:140px 1fr;grid-template-rows:minmax(260px,40%) 1fr}
    aside.sidebar{grid-row:1 / span 2}
    section.form-pane{grid-column:2;grid-row:1;padding:12px 10px;display:flex;flex-direction:column}
    section.form-pane .run-bar{position:sticky;bottom:0;background:var(--bg);padding:8px 0 4px;margin-top:auto}
    .tree .leaf{font-size:11px;padding:4px 10px 4px 20px}
    .tree .group-head{font-size:9.5px;padding:6px 10px}
    .modal{padding:14px;width:96%}
    .modal-overlay{padding:10px}
    header{padding:0 10px;gap:6px}
    header .logo{font-size:13px}
    header .logo .dot{width:6px;height:6px}
    header .icon-btn{width:26px;height:26px;font-size:11px}
    .badges{gap:4px}
    .badge{font-size:9.5px;padding:2px 8px}
    .run-bar{flex-direction:column;align-items:stretch;gap:8px}
    .run-bar button{width:100%;padding:10px}
    .output-view{font-size:10.5px}
  }
  /* Scrollbar */
  ::-webkit-scrollbar{width:7px;height:7px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px}
  ::-webkit-scrollbar-thumb:hover{background:var(--muted-2)}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="logo"><span class="dot"></span>cfcli<small>API Explorer</small></div>
    <div class="spacer"></div>
    <div class="profile-sel">
      <label>Profile</label>
      <select id="profileSelect" onchange="switchProfile()"><option value="">default / env</option></select>
    </div>
    <button class="icon-btn" onclick="openProfileManager()" title="Manage API Tokens & Profiles">⚙</button>
    <button class="icon-btn" onclick="toggleTheme()" title="Toggle theme">◐</button>
    <button class="icon-btn" onclick="refresh()" title="Refresh">↻</button>
  </header>
  <div class="main">
    <aside class="sidebar">
      <div class="search-box">
        <input id="search" placeholder="Search commands..." oninput="filterTree()">
      </div>
      <div class="tree" id="tree"></div>
    </aside>
    <section class="form-pane">
      <div id="formContent" class="empty-state">
        <div class="icon">⌘</div>
        <div class="title">Select a Command</div>
        <div class="sub">Browse the command tree on the left or use search to find a Cloudflare API operation.</div>
      </div>
    </section>
    <aside class="preview-pane">
      <div class="preview-tabs">
        <div class="tab active" data-tab="preview" onclick="switchTab('preview')">Preview</div>
        <div class="tab" data-tab="history" onclick="switchTab('history')">History<span id="histCount" class="count" style="display:none"></span></div>
        <div class="tab" data-tab="output" onclick="switchTab('output')">Output</div>
      </div>
      <div class="preview-body">
        <div id="tab-preview">
          <div class="section-label">Command</div>
          <div class="cmd-preview" id="cmdPreview">—</div>
          <div class="section-label" style="margin-top:16px">Equivalent <button class="copy-btn" onclick="copyText(document.getElementById('curlPreview').textContent)">Copy</button></div>
          <div class="curl-preview" id="curlPreview">—</div>
        </div>
        <div id="tab-history" style="display:none">
          <div class="history-list" id="historyList"><div class="history-empty">No calls yet</div></div>
        </div>
        <div id="tab-output" style="display:none">
          <div id="outputView" class="output-empty">Run a command to see output.</div>
        </div>
      </div>
    </aside>
  </div>
</div>
<div class="modal-overlay" id="confirmModal">
  <div class="modal">
    <h3>Destructive Operation</h3>
    <p>This command may modify or delete Cloudflare resources. Please confirm you want to proceed:</p>
    <div class="cmd-box" id="modalCmd"></div>
    <div class="actions">
      <button class="cancel" onclick="closeModal()">Cancel</button>
      <button class="confirm" id="confirmBtn">Confirm & Run</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="profileManager">
  <div class="modal" style="max-width:min(560px,94vw);width:94%">
    <h3 style="color:var(--accent)"><span style="background:var(--accent-soft)"></span>API Token & Profile Manager</h3>
    <p>Manage saved Cloudflare API Tokens. Secrets are stored in the system Keychain, not in plaintext.</p>
    <div id="profileListSection" style="margin-bottom:20px">
      <div class="section-label" style="font-family:'Sora';font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Saved Profiles</div>
      <div id="profileListBody">Loading...</div>
    </div>
    <div class="section-label" style="font-family:'Sora';font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Add / Update Profile</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="profileFormGrid">
      <div class="param" style="grid-column:1/-1"><label><span class="req">*</span><span class="opt">name</span><span class="type-tag">text</span></label><div class="desc">Unique profile identifier (used with --profile)</div><input type="text" id="pfName" placeholder="e.g. prod, staging, personal"></div>
      <div class="param"><label><span class="opt">apiToken</span><span class="type-tag">secret</span></label><div class="desc">Cloudflare API Token (stored in Keychain)</div><input type="password" id="pfApiToken" placeholder="••••••••••••••••"></div>
      <div class="param"><label><span class="opt">accountId</span><span class="type-tag">text</span></label><div class="desc">Cloudflare Account ID</div><input type="text" id="pfAccountId" placeholder="account_id"></div>
      <div class="param"><label><span class="opt">zoneId</span><span class="type-tag">text</span></label><div class="desc">Default Zone ID</div><input type="text" id="pfZoneId" placeholder="zone_id"></div>
      <div class="param"><label><span class="opt">email</span><span class="type-tag">text</span></label><div class="desc">Account email (for Global API Key auth)</div><input type="text" id="pfEmail" placeholder="you@example.com"></div>
    </div>
    <div id="profileFormStatus" style="font-size:11.5px;margin-top:8px;font-family:'JetBrains Mono';color:var(--muted)"></div>
    <div class="actions" style="margin-top:16px">
      <button class="cancel" onclick="closeProfileManager()">Close</button>
      <button class="confirm" id="saveProfileBtn" style="background:var(--accent);border-color:var(--accent)" onclick="saveProfile()">Save Profile</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="profileDeleteModal">
  <div class="modal">
    <h3>Delete Profile</h3>
    <p>This will permanently remove the profile <strong id="deleteProfileName"></strong> and all its secrets from the Keychain. This cannot be undone.</p>
    <div class="actions">
      <button class="cancel" onclick="closeDeleteProfileModal()">Cancel</button>
      <button class="confirm" id="confirmDeleteProfileBtn">Delete Permanently</button>
    </div>
  </div>
</div>
<script>
let REG=null,CUR=null,ACTIVE=null,PROFILES=[],HISTORY=[],CURRENT_TAB='preview',PENDING_RUN=null;
const tree=document.getElementById('tree');
const formContent=document.getElementById('formContent');
// B2: Smart field type inference (enum/boolean/number/text)
function inferFieldType(c,o){
  const flags=(o.flags||'').toLowerCase(),desc=(o.description||'').toLowerCase(),path=(c.path||'').toLowerCase();
  if(flags.includes('no-')||!o.flags.includes('<'))return {type:'boolean'};
  const pats=[/enum:([a-z0-9,_|-]+)/i,/one of:\\s*([a-z0-9,_|-]+)/i,/choices:\\s*([a-z0-9,_|-]+)/i,/values:\\s*([a-z0-9,_|-]+)/i,/\\(([^)]+\\|[^)]+)\\)/];
  for(const p of pats){const m=desc.match(p);if(m){const v=m[1].split(/[\\,|]/).map(s=>s.trim()).filter(Boolean);if(v.length>1)return {type:'enum',values:v};}}
  if(path.includes('dns')&&(flags.includes('--type')||flags.match(/-t\\b/)))return {type:'enum',values:['A','AAAA','CNAME','MX','TXT','NS','SOA','SRV','CAA','PTR','SMIMEA','SSHFP','TLSA','URI']};
  if(path.includes('ssl')&&flags.includes('--type'))return {type:'enum',values:['off','flexible','full','strict']};
  if(path.includes('tls')&&flags.includes('--mode'))return {type:'enum',values:['off','flexible','full','strict']};
  if(path.includes('waf')&&flags.includes('--mode'))return {type:'enum',values:['on','off','block','challenge','js_challenge','managed_challenge','log']};
  if(path.includes('cache')&&flags.includes('--level'))return {type:'enum',values:['bypass','basic','aggressive','simplified']};
  if(flags.includes('--proxied')||flags.includes('--paused')||flags.includes('--enabled')||flags.includes('--active'))return {type:'enum',values:['true','false']};
  if(flags.includes('--ttl')||flags.includes('--port')||flags.includes('--page')||flags.includes('--per-page')||flags.includes('--priority'))return {type:'number'};
  return {type:'text'};
}
// B3: Fuzzy match for sidebar search
function fuzzy(q,t){if(!q)return true;q=q.toLowerCase();t=(t||'').toLowerCase();let qi=0;for(let ti=0;ti<t.length&&qi<q.length;ti++){if(t[ti]===q[qi])qi++;}return qi===q.length;}
// Init
async function init(){
  const [r1,r2]=await Promise.all([fetch('/api/registry'),fetch('/api/profiles')]);
  REG=await r1.json();const pd=await r2.json();
  PROFILES=pd.profiles||[];ACTIVE=pd.active||null;
  renderProfileBar();renderTree();
}
function renderProfileBar(){
  const sel=document.getElementById('profileSelect');
  sel.innerHTML='<option value="">(default / env)</option>';
  PROFILES.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p+(p===ACTIVE?' ✓':'');if(p===ACTIVE)o.selected=true;sel.appendChild(o);});
}
async function switchProfile(){
  const p=document.getElementById('profileSelect').value;
  await fetch('/api/profile/active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:p})});
  ACTIVE=p||null;renderProfileBar();
}
// Profile Manager
async function openProfileManager(){
  document.getElementById('profileManager').classList.add('show');
  await loadProfileList();
}
function closeProfileManager(){document.getElementById('profileManager').classList.remove('show');}
async function loadProfileList(){
  const body=document.getElementById('profileListBody');
  body.textContent='Loading...';
  try{
    const r=await fetch('/api/profile/list');
    const d=await r.json();
    if(!d.profiles||!d.profiles.length){body.innerHTML='<div style="color:var(--muted);font-size:12px;padding:12px;text-align:center">No profiles yet. Add one below.</div>';return;}
    body.innerHTML=d.profiles.map(p=>{
      const isActive=p.name===d.active;
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">'+
        '<div style="flex:1">'+
          '<div style="font-weight:600;font-family:Sora;font-size:13px;color:var(--text)">'+p.name+(isActive?' <span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:600;margin-left:4px">ACTIVE</span>':'')+'</div>'+
          '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;margin-top:3px">'+
            (p.accountId?'acct: '+p.accountId.slice(0,12)+(p.accountId.length>12?'…':'')+' · ':'')+
            (p.email?p.email+' · ':'')+
            (p.hasApiToken?'<span style="color:var(--ok)">✓ token</span>':'')+
            (p.hasR2Keys?' · <span style="color:var(--ok)">✓ R2</span>':'')+
          '</div>'+
        '</div>'+
        (isActive?'':('<button class="copy-btn" onclick="activateProfile(\\''+p.name+'\\')" style="margin-right:4px">Set Active</button>'))+
        '<button class="copy-btn" onclick="editProfile(\\''+p.name+'\\')" style="margin-right:4px">Edit</button>'+
        '<button class="copy-btn" onclick="confirmDeleteProfile(\\''+p.name+'\\')" style="color:var(--err);border-color:#fecaca">Delete</button>'+
      '</div>';
    }).join('');
  }catch(e){body.innerHTML='<div style="color:var(--err);font-size:12px">Error: '+e.message+'</div>';}
}
async function activateProfile(name){
  await fetch('/api/profile/active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:name})});
  ACTIVE=name;await loadProfileList();renderProfileBar();
}
function editProfile(name){
  document.getElementById('pfName').value=name;
  document.getElementById('pfApiToken').value='';
  document.getElementById('pfApiToken').placeholder='Enter new token to update (leave blank to keep existing)';
  document.getElementById('pfAccountId').value='';
  document.getElementById('pfZoneId').value='';
  document.getElementById('pfEmail').value='';
  document.getElementById('profileFormStatus').textContent='Editing "'+name+'". Re-enter values to update; blank fields keep existing.';
  document.getElementById('profileFormStatus').style.color='var(--muted)';
  document.getElementById('pfName').focus();
}
async function saveProfile(){
  const name=document.getElementById('pfName').value.trim();
  if(!name){document.getElementById('profileFormStatus').textContent='✗ name is required';document.getElementById('profileFormStatus').style.color='var(--err)';return;}
  const data={name};
  ['apiToken','accountId','zoneId','email'].forEach(k=>{
    const v=document.getElementById('pf'+k.charAt(0).toUpperCase()+k.slice(1)).value.trim();
    if(v)data[k]=v;
  });
  document.getElementById('profileFormStatus').textContent='Saving...';
  document.getElementById('profileFormStatus').style.color='var(--muted)';
  try{
    const r=await fetch('/api/profile/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const d=await r.json();
    if(d.ok){
      document.getElementById('profileFormStatus').textContent='✓ Profile "'+name+'" saved. Secret stored in Keychain.';
      document.getElementById('profileFormStatus').style.color='var(--ok)';
      ['pfName','pfApiToken','pfAccountId','pfZoneId','pfEmail'].forEach(id=>document.getElementById(id).value='');
      await loadProfileList();
      const r2=await fetch('/api/profiles');const d2=await r2.json();
      PROFILES=d2.profiles||[];ACTIVE=d2.active||null;renderProfileBar();
    }else{
      document.getElementById('profileFormStatus').textContent='✗ '+d.error;
      document.getElementById('profileFormStatus').style.color='var(--err)';
    }
  }catch(e){
    document.getElementById('profileFormStatus').textContent='✗ '+e.message;
    document.getElementById('profileFormStatus').style.color='var(--err)';
  }
}
function confirmDeleteProfile(name){
  document.getElementById('deleteProfileName').textContent=name;
  document.getElementById('profileDeleteModal').classList.add('show');
  document.getElementById('confirmDeleteProfileBtn').onclick=async()=>{
    closeDeleteProfileModal();
    try{
      const r=await fetch('/api/profile/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
      const d=await r.json();
      if(d.ok){
        await loadProfileList();
        const r2=await fetch('/api/profiles');const d2=await r2.json();
        PROFILES=d2.profiles||[];ACTIVE=d2.active||null;renderProfileBar();
      }else{alert('Failed to delete: '+d.error);}
    }catch(e){alert('Error: '+e.message);}
  };
}
function closeDeleteProfileModal(){document.getElementById('profileDeleteModal').classList.remove('show');}
// Sidebar tree
function renderTree(filter){
  const q=(filter||'').toLowerCase().trim();
  const groups={};
  REG.commands.forEach(c=>{
    const top=c.name;
    if(!groups[top])groups[top]=[];
    if(c.subcommands&&c.subcommands.length)c.subcommands.forEach(s=>groups[top].push(s));
    else groups[top].push(c);
  });
  tree.innerHTML='';
  Object.keys(groups).sort().forEach(top=>{
    const subs=groups[top];
    const anyMatch=!q||subs.some(s=>fuzzy(q,s.path)||fuzzy(q,s.description||''));
    if(!anyMatch)return;
    const g=document.createElement('div');g.className='group';
    const head=document.createElement('div');head.className='group-head';
    head.innerHTML='<span class="arrow">▼</span> '+top+' <span class="mark">('+subs.length+')</span>';
    head.onclick=()=>g.classList.toggle('collapsed');
    g.appendChild(head);
    const body=document.createElement('div');body.className='group-body';
    subs.forEach(s=>{
      if(q&&!fuzzy(q,s.path)&&!fuzzy(q,s.description||''))return;
      const leaf=document.createElement('div');leaf.className='leaf';
      const m=s.method||'GET';
      const mClass='m-'+m.toLowerCase();
      const ov=s.overridesConfig;
      const ovMark=ov?' <span class="badge-d">⊘</span>':'';
      leaf.innerHTML='<span>'+s.name+'</span>'+ovMark+'<span class="m-tag '+mClass+'">'+m+'</span>';
      leaf.onclick=()=>{selectCmd(s);document.querySelectorAll('.leaf.active').forEach(e=>e.classList.remove('active'));leaf.classList.add('active');};
      body.appendChild(leaf);
    });
    g.appendChild(body);tree.appendChild(g);
  });
  if(!tree.children.length){tree.innerHTML='<div style="padding:12px;color:var(--muted);font-size:12px">No matches</div>';}
}
function filterTree(){renderTree(document.getElementById('search').value);}
// Select command → render form
function selectCmd(c){
  CUR=c;renderForm(c);updatePreview();switchTab('preview');
}
function renderForm(c){
  const opts=c.options||[];
  const m=c.method||'GET';
  const isWrite=c.isWrite||false;
  const overrides=c.overridesConfig||false;
  const isDestr=m==='DELETE';
  const hasArgs=c.arguments&&c.arguments.length;
  let html='<div class="cmd-header"><h2>cfcli '+c.path+'</h2>';
  if(c.description)html+='<div class="desc">'+c.description+'</div>';
  html+='</div><div class="badges">';
  html+='<span class="badge m-tag m-'+m.toLowerCase()+'">'+m+'</span>';
  if(isDestr)html+='<span class="badge destructive">⊘ DESTRUCTIVE</span>';
  else if(isWrite)html+='<span class="badge write">✎ WRITE</span>';
  else html+='<span class="badge read">READ</span>';
  if(overrides)html+='<span class="badge override">⟳ OVERRIDES CONFIG</span>';
  html+='</div>';
  if(hasArgs){
    html+='<div class="panel-title">Arguments</div><div class="args-section">';
    c.arguments.forEach(a=>{
      const req=a.required?'<span class="req">*</span>':'';
      html+='<div class="arg-item"><label>'+a.name+' '+req+'</label>';
      if(a.description)html+='<div class="arg-desc">'+a.description+'</div>';
      html+='<input type="text" data-arg="'+a.name+'" placeholder="'+a.name+'"></div>';
    });
    html+='</div>';
  }
  if(opts.length){
    html+='<div class="panel-title">Parameters ('+opts.length+')</div><div class="params">';
    opts.forEach(o=>{
      const ft=inferFieldType(c,o);
      const dv=o.defaultValue||'';
      const descClean=(o.description||'').replace(/enum:[^ ]+|one of:[^|]+|choices:[^|]+/i,'').trim();
      const req=o.required?'<span class="req">*</span>':'';
      html+='<div class="param"><label>'+req+'<span class="opt">'+o.flags+'</span><span class="type-tag">'+ft.type+'</span></label>';
      if(descClean)html+='<div class="desc">'+descClean+'</div>';
      if(ft.type==='boolean'){
        html+='<select data-flag="'+o.flags+'"><option value="">(off)</option><option value="'+o.flags.split(',').pop().trim()+'">(on)</option></select>';
      }else if(ft.type==='enum'){
        html+='<select data-opt="'+o.flags+'"><option value="">(none)</option>';
        ft.values.forEach(v=>{html+='<option value="'+v+'"'+(v===dv?' selected':'')+'>'+v+'</option>';});
        html+='</select>';
      }else if(ft.type==='number'){
        html+='<input type="number" data-opt="'+o.flags+'" placeholder="0" value="'+dv+'">';
      }else{
        html+='<input type="text" data-opt="'+o.flags+'" placeholder="'+(descClean||'(value)')+'" value="'+dv+'">';
      }
      html+='</div>';
    });
    html+='</div>';
  }
  html+='<div class="run-bar"><button onclick="runCmd()"'+(isDestr?' class="destructive"':'')+'>▶ Run'+(isDestr?' (destructive)':'')+'</button><span class="status" id="runStatus"></span></div>';
  formContent.innerHTML=html;
  formContent.classList.remove('empty-state');
  formContent.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',updatePreview));
}
// Preview: command + curl equivalent
function buildArgs(){
  if(!CUR)return [];
  let args=[];
  // positional args
  document.querySelectorAll('[data-arg]').forEach(el=>{const v=el.value.trim();if(v)args.push(v);});
  // options
  document.querySelectorAll('[data-flag]').forEach(el=>{const v=el.value.trim();if(v)args.push(v);});
  document.querySelectorAll('[data-opt]').forEach(el=>{const v=el.value.trim();if(!v)return;const m=el.dataset.opt.match(/--?[\\w-]+/);if(m)args.push(m[0],v);});
  return args;
}
function updatePreview(){
  if(!CUR)return;
  const args=buildArgs();
  const prof=ACTIVE?['--profile',ACTIVE]:[];
  const full=prof.concat(CUR.path.split(' '),args);
  document.getElementById('cmdPreview').textContent='cfcli '+full.join(' ');
  // curl equivalent (approximate)
  const token='CFCLI_API_TOKEN';
  const path=CUR.path.split(' ')[0];
  document.getElementById('curlPreview').textContent='# CLI (no API call needed)\\n# '+full.join(' ');
}
// Run command
async function runCmd(){
  if(!CUR)return;
  const args=buildArgs();
  const prof=ACTIVE?['--profile',ACTIVE]:[];
  const fullArgs=prof.concat(CUR.path.split(' '),args);
  const cmdStr='cfcli '+fullArgs.join(' ');
  const isDestr=/delete|bulk-delete|clear|remove/.test(CUR.path);
  if(isDestr){
    PENDING_RUN=fullArgs;
    document.getElementById('modalCmd').textContent=cmdStr;
    document.getElementById('confirmModal').classList.add('show');
    document.getElementById('confirmBtn').onclick=()=>{closeModal();doRun(fullArgs,cmdStr);};
    return;
  }
  doRun(fullArgs,cmdStr);
}
function closeModal(){document.getElementById('confirmModal').classList.remove('show');PENDING_RUN=null;}
async function doRun(args,cmdStr){
  document.getElementById('runStatus').textContent='Running...';
  switchTab('output');
  document.getElementById('outputView').className='output-view';
  document.getElementById('outputView').textContent='Running...';
  try{
    const r=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args})});
    const d=await r.json();
    const ok=d.exitCode===0;
    // history
    HISTORY.unshift({cmd:cmdStr,exitCode:d.exitCode,time:new Date().toLocaleTimeString(),stdout:d.stdout,stderr:d.stderr});
    if(HISTORY.length>20)HISTORY.pop();
    renderHistory();
    // output
    const out=d.stdout+(d.stderr?'\\n\\n--- stderr ---\\n'+d.stderr:'');
    document.getElementById('outputView').className='output-view'+(ok?'':' error');
    document.getElementById('outputView').innerHTML=highlightJSON(out);
    document.getElementById('runStatus').textContent=ok?'✓ Done':'✗ exit '+d.exitCode;
  }catch(e){
    document.getElementById('outputView').className='output-view error';
    document.getElementById('outputView').textContent='Error: '+e.message;
    document.getElementById('runStatus').textContent='✗ Failed';
  }
}
// JSON syntax highlight
function highlightJSON(text){
  if(!text)return '';
  // 1. Try JSON parse first (pure JSON output)
  try{
    const obj=JSON.parse(text);
    text=JSON.stringify(obj,null,2);
    return highlightJSONSyntax(escapeHtml(text));
  }catch(e){}
  // 2. Detect table output (box-drawing chars or column separators)
  if(/[╔╚╟╠║═╤╗╝╜╛╞╡┌┐└┘├┤┬┴┼]/.test(text)||/^\\s*[─]{3,}/m.test(text)||/^\\s*-{3,}/m.test(text)||/^\\s*\\|.*\\|/m.test(text)){
    return renderTable(text);
  }
  // 3. Line-by-line: semantic prefixes (✓ ✗ ℹ ⚠)
  const lines=text.split('\\n');
  const html=lines.map(line=>{
    const esc=escapeHtml(line);
    if(/^✓/.test(line))return '<span style="color:var(--ok)">'+esc+'</span>';
    if(/^✗/.test(line))return '<span style="color:var(--err)">'+esc+'</span>';
    if(/^ℹ/.test(line))return '<span style="color:var(--accent)">'+esc+'</span>';
    if(/^⚠/.test(line))return '<span style="color:var(--warn)">'+esc+'</span>';
    return esc;
  });
  return html.join('\\n');
}
function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function highlightJSONSyntax(escaped){
  return escaped.replace(/("(?:[^"\\\\]|\\\\.)*")\\s*:/g,'<span class="json-key">$1</span>:')
    .replace(/:\\s*("(?:[^"\\\\]|\\\\.)*")/g,': <span class="json-str">$1</span>')
    .replace(/:\\s*(-?\\d+\\.?\\d*)/g,': <span class="json-num">$1</span>')
    .replace(/:\\s*(true|false)/g,': <span class="json-bool">$1</span>')
    .replace(/:\\s*null/g,': <span class="json-null">null</span>');
}
// Render CLI table output as styled HTML table
function renderTable(text){
  const lines=text.split('\\n');
  const thStyle='text-align:left;padding:7px 12px;border-bottom:2px solid var(--accent);color:var(--accent);font-weight:600;font-family:Sora,sans-serif;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap';
  const tdStyle='padding:6px 12px;border-bottom:1px solid var(--border-soft);color:var(--text-2);white-space:pre';
  const tblOpen='<div style="overflow-x:auto;margin:4px 0"><table style="width:100%;border-collapse:collapse;font-family:JetBrains Mono,monospace;font-size:11.5px">';
  const tblClose='</table></div>';
  // 1. Box-drawing table (table lib): data rows start with ║
  const boxRows=lines.filter(l=>/^║/.test(l));
  if(boxRows.length>=2){
    const rows=boxRows.map(l=>l.split(/[║│]/).map(c=>c.trim()).filter(c=>c.length>0));
    const [header,...body]=rows;
    let html=tblOpen;
    html+='<thead><tr>'+header.map(h=>'<th style="'+thStyle+'">'+escapeHtml(h)+'</th>').join('')+'</tr></thead>';
    html+='<tbody>'+body.map(row=>'<tr>'+row.map(c=>'<td style="'+tdStyle+'">'+escapeHtml(c)+'</td>').join('')+'</tr>').join('')+'</tbody>';
    html+=tblClose;
    return html;
  }
  // 2. Pipe table (| col | col |): data rows start with |
  const pipeRows=lines.filter(l=>/^\\s*\\|.*\\|\\s*$/.test(l)&&!/^[\\s|-]+$/.test(l));
  if(pipeRows.length>=2){
    const rows=pipeRows.map(l=>l.split('|').map(c=>c.trim()).filter(c=>c.length>0));
    const [header,...body]=rows;
    let html=tblOpen;
    html+='<thead><tr>'+header.map(h=>'<th style="'+thStyle+'">'+escapeHtml(h)+'</th>').join('')+'</tr></thead>';
    html+='<tbody>'+body.map(row=>'<tr>'+row.map(c=>'<td style="'+tdStyle+'">'+escapeHtml(c)+'</td>').join('')+'</tr>').join('')+'</tbody>';
    html+=tblClose;
    return html;
  }
  // 3. Column-aligned table (--- or ─── separators)
  const sepIdx=lines.findIndex(l=>/^\\s*[─\\-]{3,}/.test(l));
  if(sepIdx>0){
    const headerLine=lines[sepIdx-1];
    const sepLine=lines[sepIdx];
    const cols=[...sepLine.matchAll(/[─\\-]+/g)].map(m=>({start:m.index,end:m.index+m[0].length}));
    const validCols=cols.filter(c=>c.end-c.start>3);
    if(validCols.length>=2){
      const extractCells=(line)=>validCols.map(c=>(line||'').slice(c.start,c.end).trim());
      const header=extractCells(headerLine);
      const body=lines.slice(sepIdx+1).filter(l=>l.trim().length>0&&!/^[\\s─\\-]+$/.test(l)).map(extractCells).filter(r=>r.some(c=>c.length>0));
      let html=tblOpen;
      html+='<thead><tr>'+header.map(h=>'<th style="'+thStyle+'">'+escapeHtml(h)+'</th>').join('')+'</tr></thead>';
      html+='<tbody>'+body.map(row=>'<tr>'+row.map(c=>'<td style="'+tdStyle+'">'+escapeHtml(c)+'</td>').join('')+'</tr>').join('')+'</tbody>';
      html+=tblClose;
      return html;
    }
  }
  return '<span style="color:var(--muted)">'+escapeHtml(text)+'</span>';
}
// History
function renderHistory(){
  const el=document.getElementById('historyList');
  document.getElementById('histCount').textContent=HISTORY.length?'('+HISTORY.length+')':'';
  if(!HISTORY.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;padding:12px">No calls yet</div>';return;}
  el.innerHTML=HISTORY.map((h,i)=>'<div class="history-item" onclick="showHistoryOutput('+i+')"><span class="hcmd">'+h.cmd.replace(/</g,'&lt;')+'</span><span class="hstatus '+(h.exitCode===0?'ok':'err')+'">'+(h.exitCode===0?'✓':'✗')+'</span><span class="htime">'+h.time+'</span></div>').join('');
}
function showHistoryOutput(i){
  const h=HISTORY[i];if(!h)return;
  const out=h.stdout+(h.stderr?'\\n\\n--- stderr ---\\n'+h.stderr:'');
  document.getElementById('outputView').className='output-view'+(h.exitCode===0?'':' error');
  document.getElementById('outputView').innerHTML=highlightJSON(out);
  switchTab('output');
}
// Tabs
function switchTab(name){
  CURRENT_TAB=name;
  document.querySelectorAll('.preview-tabs .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  ['preview','history','output'].forEach(n=>{document.getElementById('tab-'+n).style.display=n===name?(n==='output'?'flex':'block'):'none';});
}
// Utilities
function toggleTheme(){
  const cur=document.documentElement.dataset.theme||'light';
  document.documentElement.dataset.theme=cur==='light'?'dark':'light';
}
function refresh(){init();}
function copyText(t){navigator.clipboard&&navigator.clipboard.writeText(t);}
init();
</script>
</body>
</html>`;

function guiModule(program) {
  program
    .command('gui')
    .description('Launch a web GUI that auto-discovers all CLI commands')
    .option('-p, --port <port>', 'Port to serve on (default 7700)', '7700')
    .option('--host <host>', 'Host to bind (default localhost)', 'localhost')
    .option('--no-run', 'Read-only mode — disable command execution')
    .action((options) => {
      const port = parseInt(options.port, 10);
      const host = options.host;
      const allowRun = options.run !== false;

      const registry = buildRegistry(program);

      const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.url === '/api/registry' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(registry));
          return;
        }

        if (req.url === '/api/profiles' && req.method === 'GET') {
          const profiles = loadProfiles();
          const active = getActiveProfileName();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ profiles: Object.keys(profiles), active }));
          return;
        }

        if (req.url === '/api/profile/active' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { profile } = JSON.parse(body);
              if (profile) {
                setActiveProfileName(profile);
              } else {
                const fs = require('fs');
                const path = require('path');
                const activeFile = path.join(__dirname, '..', '..', 'config', '.active-profile');
                if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, active: profile || null }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }

        // GET /api/profile/list — list all profiles with metadata (secrets masked)
        if (req.url === '/api/profile/list' && req.method === 'GET') {
          const profiles = loadProfiles();
          const active = getActiveProfileName();
          const list = Object.values(profiles).map(p => ({
            name: p.name,
            accountId: p.accountId || '',
            zoneId: p.zoneId || '',
            email: p.email || '',
            hasApiToken: true, // metadata-only view; actual secrets in keychain
            hasR2Keys: !!(p.r2AccessKeyId || p.r2SecretAccessKey),
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ profiles: list, active }));
          return;
        }

        // POST /api/profile/create — create/update a profile (secrets → keychain)
        if (req.url === '/api/profile/create' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { name } = data;
              if (!name || typeof name !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'name is required' }));
                return;
              }
              // Route secrets to keychain via upsertProfile
              const { upsertProfile } = require('../utils/profiles');
              upsertProfile(name, {
                accountId: data.accountId || '',
                apiToken: data.apiToken || '',
                zoneId: data.zoneId || '',
                email: data.email || '',
                r2AccessKeyId: data.r2AccessKeyId || '',
                r2SecretAccessKey: data.r2SecretAccessKey || '',
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, name }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }

        // POST /api/profile/delete — delete a profile (DESTRUCTIVE: removes secrets + metadata)
        if (req.url === '/api/profile/delete' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { name } = JSON.parse(body);
              if (!name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'name is required' }));
                return;
              }
              const { removeProfile } = require('../utils/profiles');
              const removed = removeProfile(name);
              if (!removed) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'profile not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, name }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }

        // POST /api/run — child-process isolated execution
        if (req.url === '/api/run' && req.method === 'POST' && allowRun) {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { args } = JSON.parse(body);
              if (!Array.isArray(args)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exitCode: 1, error: 'args must be an array' }));
                return;
              }
              const { execFile } = require('child_process');
              const entry = require('path').join(__dirname, '..', 'index.js');
              execFile(process.execPath, [entry, ...args], {
                cwd: process.cwd(),
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
                env: { ...process.env },
              }, (err, stdout, stderr) => {
                const exitCode = err ? (err.code || 1) : 0;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exitCode, stdout: stdout || '', stderr: stderr || '' }));
              });
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ exitCode: 1, error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/run' && req.method === 'POST' && !allowRun) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ exitCode: 1, error: 'Command execution is disabled (--no-run mode)' }));
          return;
        }

        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(GUI_HTML);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      });

      server.listen(port, host, () => {
        formatSuccess(`Web GUI running at http://${host}:${port}`);
        formatInfo('Press Ctrl+C to stop.');
        if (!allowRun) {
          formatInfo('Read-only mode: command execution is disabled.');
        }
      });
    });
}

module.exports = guiModule;
