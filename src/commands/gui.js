/**
 * @file `cfcli gui` — Web GUI that auto-generates from the command registry.
 *
 * Architecture:
 *   1. Build the program tree (same as CLI)
 *   2. Extract registry JSON via registry.js
 *   3. Serve a single-page app at / that fetches /api/registry
 *   4. The frontend auto-renders command forms from the JSON
 *   5. POST /api/run executes the CLI command and returns stdout/stderr
 *
 * When a new command module is added to src/commands/, the Web GUI
 * AUTOMATICALLY displays it — zero frontend changes needed.
 *
 * Usage:
 *   cfcli gui                    # start on http://localhost:7700
 *   cfcli gui --port 8080        # custom port
 *   cfcli gui --no-run            # disable command execution (read-only view)
 */

const http = require('http');
const { buildRegistry } = require('../utils/registry');
const { loadProfiles, getActiveProfileName, setActiveProfileName } = require('../utils/profiles');
const { formatInfo, formatError, formatSuccess } = require('../utils/formatter');

// Inline HTML — no external dependencies, no build step.
// The page fetches /api/registry and auto-renders all commands.
const GUI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>cfcli — Cloudflare CLI GUI</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#1a1a2e}
  .layout{display:flex;height:100vh}
  .sidebar{width:240px;background:#1a1a2e;color:#e0e0e0;overflow-y:auto;padding:12px 0;flex-shrink:0}
  .sidebar h2{font-size:14px;padding:8px 16px;color:#e8741c;text-transform:uppercase;letter-spacing:1px}
  .sidebar .group{padding:4px 0}
  .sidebar .cmd{padding:6px 16px;cursor:pointer;font-size:13px;transition:background .15s}
  .sidebar .cmd:hover{background:#2a2a4e}
  .sidebar .cmd.active{background:#e8741c;color:#fff}
  .sidebar .topcmd{padding:6px 16px;font-weight:600;font-size:12px;color:#8a8a9a;text-transform:uppercase;letter-spacing:.5px;margin-top:8px}
  .main{flex:1;overflow-y:auto;padding:24px}
  .breadcrumb{font-size:13px;color:#8a8a9a;margin-bottom:12px}
  .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .card h3{font-size:18px;margin-bottom:8px}
  .card .desc{color:#666;font-size:14px;margin-bottom:16px}
  .options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .opt{display:flex;flex-direction:column}
  .opt label{font-size:12px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .opt label .flags{font-family:monospace;background:#f0f0f0;padding:1px 4px;border-radius:3px}
  .opt label .opt-desc{font-weight:400;font-size:11px;color:#8a8a9a;flex:1;min-width:0}
  .opt input,.opt select{padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px}
  .opt input:focus,.opt select:focus{border-color:#e8741c;outline:none}
  .run-bar{position:sticky;bottom:0;background:#fff;padding:12px 20px;border-top:1px solid #eee;display:flex;gap:12px;align-items:center}
  .run-bar button{background:#e8741c;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:600}
  .run-bar button:hover{background:#c85f15}
  .run-bar .cmd-preview{font-family:monospace;font-size:13px;color:#333;flex:1;background:#f5f5f5;padding:6px 12px;border-radius:4px}
  .output{background:#1a1a2e;color:#0f0;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;overflow-x:auto;max-height:400px;overflow-y:auto;margin-top:12px}
  .output.error{color:#f55}
  .empty{display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:18px}
  .badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600}
  .badge.destructive{background:#fee;color:#c00}
  .badge.json{background:#e8f4fd;color:#06c}
  .profile-bar{padding:8px 12px;background:#2a2a4e;border-bottom:1px solid #3a3a5e}
  .profile-bar select{background:#1a1a2e;color:#e0e0e0;border:1px solid #3a3a5e;padding:4px 8px;border-radius:4px;font-size:13px}
  .profile-bar .label{color:#8a8a9a;font-size:12px;margin-right:8px}
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <h2>cfcli GUI</h2>
    <div class="profile-bar">
      <span class="label">Profile:</span>
      <select id="profileSelect" onchange="switchProfile()"><option value="">(default)</option></select>
    </div>
    <div id="nav"></div>
  </div>
  <div class="main">
    <div id="content"><div class="empty">Select a command from the sidebar</div></div>
  </div>
</div>
<script>
let REG=null,CURRENT=null,ACTIVE_PROFILE=null,PROFILES=[];
const nav=document.getElementById('nav');
const content=document.getElementById('content');

// B2: Smart field type inference — auto-detect enum/boolean/numeric
// Returns {type:'boolean'|'enum'|'number'|'text', values?:string[]}
function inferFieldType(c,o){
  const flags=(o.flags||'').toLowerCase();
  const desc=(o.description||'').toLowerCase();
  const path=(c.path||'').toLowerCase();
  // 1. Boolean: flags with --no- or no <value> placeholder
  if(flags.includes('no-')||!o.flags.includes('<')){
    return {type:'boolean'};
  }
  // 2. Explicit enum markers in description
  const enumPatterns=[
    /enum:([a-z0-9,_|-]+)/i,
    /one of:\s*([a-z0-9,_|-]+)/i,
    /choices:\s*([a-z0-9,_|-]+)/i,
    /values:\s*([a-z0-9,_|-]+)/i,
    /\\(([^)]+\\|[^)]+)\\)/, // (a|b|c) pattern
  ];
  for(const pat of enumPatterns){
    const m=desc.match(pat);
    if(m){
      const vals=m[1].split(/[\\,|]/).map(s=>s.trim()).filter(Boolean);
      if(vals.length>1)return {type:'enum',values:vals};
    }
  }
  // 3. Smart inference based on command path + flag
  if(path.includes('dns')&&(flags.includes('--type')||flags.match(/-t\\b/))){
    return {type:'enum',values:['A','AAAA','CNAME','MX','TXT','NS','SOA','SRV','CAA','PTR','SMIMEA','SSHFP','TLSA','URI']};
  }
  if(path.includes('ssl')&&flags.includes('--type')){
    return {type:'enum',values:['off','flexible','full','strict']};
  }
  if(path.includes('tls')&&flags.includes('--mode')){
    return {type:'enum',values:['off','flexible','full','strict']};
  }
  if(path.includes('waf')&&flags.includes('--mode')){
    return {type:'enum',values:['on','off','block','challenge','js_challenge','managed_challenge','log']};
  }
  if(path.includes('cache')&&flags.includes('--level')){
    return {type:'enum',values:['bypass','basic','aggressive','simplified']};
  }
  if(flags.includes('--proxied')||flags.includes('--paused')||flags.includes('--enabled')||flags.includes('--active')){
    return {type:'enum',values:['true','false']};
  }
  if(flags.includes('--ttl')||flags.includes('--port')||flags.includes('--page')||flags.includes('--per-page')||flags.includes('--priority')){
    return {type:'number'};
  }
  return {type:'text'};
}

async function init(){
  const [regResp,profResp]=await Promise.all([fetch('/api/registry'),fetch('/api/profiles')]);
  REG=await regResp.json();
  const profData=await profResp.json();
  PROFILES=profData.profiles||[];
  ACTIVE_PROFILE=profData.active||null;
  renderProfileBar();
  renderNav();
}
function renderProfileBar(){
  const sel=document.getElementById('profileSelect');
  sel.innerHTML='<option value="">(default / env)</option>';
  PROFILES.forEach(p=>{
    const opt=document.createElement('option');
    opt.value=p;opt.textContent=p+(p===ACTIVE_PROFILE?' ✓':'');
    if(p===ACTIVE_PROFILE)opt.selected=true;
    sel.appendChild(opt);
  });
}
async function switchProfile(){
  const sel=document.getElementById('profileSelect');
  const profile=sel.value;
  await fetch('/api/profile/active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile})});
  ACTIVE_PROFILE=profile||null;
  renderProfileBar();
}
function renderNav(){
  const groups={};
  REG.commands.forEach(c=>{
    const top=c.name;
    if(!groups[top])groups[top]=[];
    if(c.subcommands&&c.subcommands.length)c.subcommands.forEach(s=>groups[top].push(s));
    else groups[top].push(c);
  });
  Object.keys(groups).sort().forEach(top=>{
    const h=document.createElement('div');
    h.className='topcmd';h.textContent=top;
    nav.appendChild(h);
    groups[top].forEach(c=>{
      const d=document.createElement('div');
      d.className='cmd';d.textContent=c.name;
      d.onclick=()=>selectCmd(c,d);
      nav.appendChild(d);
    });
  });
}
function selectCmd(c,el){
  document.querySelectorAll('.cmd.active').forEach(e=>e.classList.remove('active'));
  if(el)el.classList.add('active');
  CURRENT=c;renderCmd(c);
}
function renderCmd(c){
  const opts=c.options||[];
  const destructive=/delete|bulk-delete|clear/.test(c.path);
  let html='<div class="card"><h3>cfcli '+c.path+'</h3>';
  html+='<div class="desc">'+c.description+'</div>';
  if(destructive)html+='<span class="badge destructive">DESTRUCTIVE</span> ';
  html+='<span class="badge json">JSON</span></div>';
  if(opts.length){
    html+='<div class="card"><h3>Options</h3><div class="options">';
    opts.forEach(o=>{
      const ft=inferFieldType(c,o);
      const dv=o.defaultValue||'';
      const descClean=(o.description||'').replace(/enum:[^ ]+|one of:[^|]+|choices:[^|]+/i,'').trim();
      html+='<div class="opt"><label><span class="flags">'+o.flags+'</span><span class="opt-desc">'+descClean+'</span></label>';
      if(ft.type==='boolean'){
        html+='<select data-flag="'+o.flags+'"><option value="">(off)</option><option value="'+o.flags.split(',').pop().trim()+'">(on)</option></select>';
      }else if(ft.type==='enum'){
        html+='<select data-opt="'+o.flags+'">';
        html+='<option value="">(none)</option>';
        ft.values.forEach(v=>{
          html+='<option value="'+v+'"'+(v===dv?' selected':'')+'>'+v+'</option>';
        });
        html+='</select>';
      }else if(ft.type==='number'){
        html+='<input type="number" data-opt="'+o.flags+'" placeholder="'+descClean+'" value="'+dv+'">';
      }else{
        html+='<input type="text" data-opt="'+o.flags+'" placeholder="'+descClean+'" value="'+dv+'">';
      }
      html+='</div>';
    });
    html+='</div></div>';
  }
  html+='<div class="run-bar"><div class="cmd-preview" id="preview">cfcli '+c.path+'</div>';
  html+='<button onclick="runCmd()">Run</button></div>';
  html+='<div id="output"></div>';
  content.innerHTML=html;
  document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',updatePreview));
}
function updatePreview(){
  if(!CURRENT)return;
  let cmd='cfcli '+CURRENT.path;
  document.querySelectorAll('.opt input,.opt select').forEach(el=>{
    const v=el.value.trim();
    if(!v)return;
    if(el.dataset.flag){
      cmd+=' '+v;
    }else{
      const flagParts=el.dataset.opt.match(/-\\S+/);
      if(flagParts)cmd+=' '+flagParts[0]+' '+v;
    }
  });
  document.getElementById('preview').textContent=cmd;
}
async function runCmd(){
  if(!CURRENT)return;
  const out=document.getElementById('output');
  out.className='output';out.textContent='Running...';
  // Build args from form
  let args=[CURRENT.path];
  document.querySelectorAll('.opt input,.opt select').forEach(el=>{
    const v=el.value.trim();
    if(!v)return;
    if(el.dataset.flag){
      args.push(v);
    }else{
      const flagParts=el.dataset.opt.match(/-\\S+/);
      if(flagParts)args.push(flagParts[0],v);
    }
  });
  // Prepend --profile if a profile is selected
  const sendProfile=ACTIVE_PROFILE?['--profile',ACTIVE_PROFILE]:[];
  try{
    const r=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args:sendProfile.concat(args)})});
    const data=await r.json();
    out.className='output'+(data.exitCode!==0?' error':'');
    out.textContent=data.stdout+(data.stderr?'\\n--- stderr ---\\n'+data.stderr:'');
  }catch(e){
    out.className='output error';out.textContent='Request failed: '+e.message;
  }
}
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
        // CORS for local dev
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // GET /api/registry — return command registry JSON
        if (req.url === '/api/registry' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(registry));
          return;
        }

        // GET /api/profiles — return profile list + active profile
        if (req.url === '/api/profiles' && req.method === 'GET') {
          const profiles = loadProfiles();
          const active = getActiveProfileName();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ profiles: Object.keys(profiles), active }));
          return;
        }

        // POST /api/profile/active — switch active profile
        if (req.url === '/api/profile/active' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { profile } = JSON.parse(body);
              if (profile) {
                setActiveProfileName(profile);
              } else {
                // Clear active profile
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

        // POST /api/run — execute a CLI command
        if (req.url === '/api/run' && req.method === 'POST' && allowRun) {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { args } = JSON.parse(body);
              // Execute the CLI in-process by calling program.parseAsync
              // We capture stdout via a temporary override
              const originalWrite = process.stdout.write.bind(process.stdout);
              let stdout = '';
              let stderr = '';
              process.stdout.write = (chunk) => { stdout += chunk.toString(); };
              process.stderr.write = (chunk) => { stderr += chunk.toString(); };

              program.parseAsync(['node', 'cfcli', ...args], { from: 'user' })
                .then(() => {
                  process.stdout.write = originalWrite;
                  process.stderr.write = originalWrite;
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ exitCode: 0, stdout, stderr }));
                })
                .catch((err) => {
                  process.stdout.write = originalWrite;
                  process.stderr.write = originalWrite;
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ exitCode: 1, stdout, stderr: stderr + err.message }));
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

        // GET / — serve the GUI
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(GUI_HTML);
          return;
        }

        // 404
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
