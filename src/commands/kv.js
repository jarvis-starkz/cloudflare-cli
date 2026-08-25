/**
 * @file Workers KV command module.
 *
 * P2 additions — Bulk KV APIs:
 *   - `kv keys bulk-write`  → up to 9,000 pairs per HTTP call (auto-chunked).
 *   - `kv keys bulk-get`    → POST /bulk/get with key array (auto-chunked).
 *   - `kv keys bulk-delete` → POST /bulk/delete with key array (auto-chunked).
 *
 * SECURITY:
 *   Bulk-write and bulk-delete are destructive → guard with
 *   isDestructiveConfirmed. Namespace delete/put are also guarded. Namespace
 *   CREATE is considered write-but-not-destructive-overwrite; still guarded
 *   because it consumes Enterprise quota.
 */

const fs = require('fs');
const path = require('path');

const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatInfo,
  formatVerboseError, formatWarning,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

function guard(opName, program) {
  if (isDestructiveConfirmed()) return true;
  formatWarning(
    `REFUSED destructive KV operation: ${opName}\n`
    + '  Saved Cloudflare tokens are never used for modify/delete/override actions\n'
    + '  without explicit human approval. Please request operator review, then re-run:\n'
    + '    CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli kv ...',
  );
  return false;
}

/**
 * Parse a KV pair file. Supported formats:
 *   - .json → array of {key, value, expiration?, expiration_ttl?, metadata?}
 *             OR object {key1: value1, key2: value2} (stringified as values)
 *   - .csv  → key,value[,expiration][,metadataJson]  (header row optional)
 *   - .ndjson → one object per line
 *
 * @param {string} filePath
 * @returns {Array<{key:string,base64?:boolean,value:any,expiration?:number,expiration_ttl?:number,metadata?:any}>}
 */
function loadPairsFromFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();

  if (ext === '.json') {
    const doc = JSON.parse(raw);
    if (Array.isArray(doc)) return doc.map(normalizePair);
    if (doc && typeof doc === 'object') {
      return Object.keys(doc).map((k) => normalizePair({ key: k, value: doc[k] }));
    }
    throw new Error('JSON file must be an array or plain object');
  }

  if (ext === '.csv') {
    const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
    const out = [];
    let start = 0;
    const firstCells = splitCsvLine(lines[0] || '');
    if (firstCells.map((c) => c.toLowerCase()).includes('key')) {
      start = 1; // header row
    }
    for (let i = start; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      const [k, v, exp, meta] = cells;
      if (!k) continue;
      const pair = { key: k, value: v === undefined ? '' : v };
      if (exp && !Number.isNaN(Number(exp))) pair.expiration = Number(exp);
      if (meta) {
        try { pair.metadata = JSON.parse(meta); } catch (_) { pair.metadata = meta; }
      }
      out.push(normalizePair(pair));
    }
    return out;
  }

  if (ext === '.ndjson') {
    return raw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => normalizePair(JSON.parse(l)));
  }

  throw new Error(`Unsupported file extension: ${ext}. Use .json / .csv / .ndjson`);
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizePair(p) {
  if (!p || typeof p !== 'object') throw new Error('Pair must be an object: ' + JSON.stringify(p));
  if (typeof p.key !== 'string' || p.key.length === 0) {
    throw new Error('Every pair must have a non-empty string "key": ' + JSON.stringify(p));
  }
  const out = { key: p.key };
  if (p.value !== undefined) out.value = p.value;
  if (typeof p.expiration === 'number') out.expiration = p.expiration;
  if (typeof p.expiration_ttl === 'number') out.expiration_ttl = p.expiration_ttl;
  if (p.metadata !== undefined) out.metadata = p.metadata;
  if (p.base64 === true) out.base64 = true;
  return out;
}

/**
 * Load key list from file (.txt one-per-line, .json array, .csv first column).
 * @param {string} filePath
 * @returns {string[]}
 */
function loadKeysFromFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();
  if (ext === '.json') {
    const doc = JSON.parse(raw);
    if (!Array.isArray(doc)) throw new Error('Key JSON file must be a string array');
    return doc.map((k) => String(k));
  }
  if (ext === '.csv') {
    return raw
      .split(/\r?\n/)
      .filter((l) => l.length > 0)
      .map((l) => splitCsvLine(l)[0])
      .filter((k) => !!k);
  }
  // .txt / default
  return raw.split(/\r?\n/).map((l) => l.trim()).filter((k) => k.length > 0);
}

/* -------------------------------------------------------------------------- */
/*                                  Commands                                  */
/* -------------------------------------------------------------------------- */

function kvCommands(program) {
  const kv = program.command('kv').description(
    'Manage Workers KV Storage. 管理 Workers KV 键值存储，包括命名空间的增删查改以及键值对的读写操作。'
  );

  // ------------------------------ Namespaces -------------------------------
  const namespaces = kv.command('namespaces').description(
    'Manage KV Namespaces. 管理 KV 命名空间，支持列出、创建和删除命名空间。'
  );

  namespaces
    .command('list')
    .description('List all KV namespaces. 列出账户下所有 KV 命名空间，支持分页和自动翻页获取全部数据。')
    .option('--page <N>', 'Page number (1-based) when --all is not used. 页码（从 1 开始），仅在未使用 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size (default 50). 每页返回的命名空间数量。', '50')
    .option('--all', 'Fetch ALL namespaces by auto-paging. 自动翻页获取所有命名空间。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listKVNamespaces(p),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listKVNamespaces({
            page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = resp.result;
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((ns) => ({
          id: ns.id, title: ns.title,
          supports_url_encoding: ns.supports_url_encoding ? 'Yes' : 'No',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Title', accessor: 'title' },
          { header: 'URL Encoding', accessor: 'supports_url_encoding' },
        ], data);
        formatSuccess(`Found ${data.length} namespace(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  namespaces
    .command('create')
    .description(
      'Create a new KV namespace [WRITE — operator approval required]. 创建新的 KV 命名空间，需要操作员审批。命名空间标题将用于标识该存储区域。'
    )
    .requiredOption('-t, --title <title>', 'Namespace title. 命名空间标题，用于标识该 KV 存储区域。')
    .action(async (options) => {
      try {
        if (!guard(`kv namespaces create (title="${options.title}")`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.createKVNamespace(options.title);
        formatSuccess(`KV namespace created: ${result.result.id} (title="${result.result.title}")`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  namespaces
    .command('delete')
    .description(
      'Delete an entire KV namespace [DESTRUCTIVE — operator approval required]. 删除整个 KV 命名空间及其所有键值对，此操作不可逆，需要操作员审批。'
    )
    .requiredOption('-i, --id <id>', 'Namespace ID. 要删除的命名空间 ID。')
    .action(async (options) => {
      try {
        if (!guard(`kv namespaces delete (id=${options.id})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteKVNamespace(options.id);
        formatSuccess(`KV namespace deleted: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // --------------------------------- Keys ----------------------------------
  const keys = kv.command('keys').description(
    'Manage KV Keys / Values. 管理 KV 命名空间中的键值对，支持单键读写和批量操作。'
  );

  keys
    .command('list')
    .description(
      'List keys in a namespace. 列出命名空间中的键列表，支持基于游标的分页，使用 --all 可自动翻页获取全部键。'
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .option('--prefix <prefix>', 'Only return keys starting with this prefix. 仅返回以该前缀开头的键。')
    .option('--limit <limit>', 'Page size (default 1000, max 1000). 每页返回的键数量，最大 1000。', '1000')
    .option('--cursor <cursor>', 'Opaque cursor returned by a previous page. 上一页返回的不透明游标，用于翻页。')
    .option('--all', 'Auto-follow cursors until namespace is exhausted. 自动跟随游标直到遍历完所有键。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {
          limit: Math.min(1000, parseInt(options.limit, 10) || 1000),
        };
        if (options.prefix) params.prefix = options.prefix;

        if (options.all) {
          const all = [];
          let cursor = options.cursor || undefined;
          do {
            const p = { ...params };
            if (cursor) p.cursor = cursor;
            const resp = await client.listKVKeys(options.namespaceId, p);
            all.push(...(resp.result || []));
            cursor = resp.result_info && resp.result_info.cursor;
          } while (cursor);
          if (options.json) return formatJSON(all);
          renderKeyList(all);
          formatSuccess(`Found ${all.length} key(s)`);
          return;
        }

        if (options.cursor) params.cursor = options.cursor;
        const resp = await client.listKVKeys(options.namespaceId, params);
        if (options.json) return formatJSON(resp);
        renderKeyList(resp.result || []);
        const nextCursor = resp.result_info && resp.result_info.cursor;
        formatSuccess(
          `Found ${(resp.result || []).length} key(s)`
          + (nextCursor ? ` — next cursor: ${nextCursor}` : ''),
        );
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  keys
    .command('get')
    .description('Get a single value from KV. 从 KV 命名空间中获取单个键的值，支持直接输出或写入文件。')
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .requiredOption('-k, --key <key>', 'Key name. 要获取的键名。')
    .option('-o, --out-file <path>', 'Write raw bytes to file (useful for binary). 将原始内容写入文件（适用于二进制数据）。')
    .option('-j, --json', 'Output metadata + value as JSON object. 以 JSON 对象格式输出元数据和值。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const value = await client.getKVValue(options.namespaceId, options.key);
        if (options.outFile) {
          fs.writeFileSync(path.resolve(process.cwd(), options.outFile), String(value));
          formatSuccess(`Wrote ${options.key} → ${options.outFile}`);
          return;
        }
        if (options.json) return formatJSON({ key: options.key, value });
        formatInfo(`Value for "${options.key}":`);
        // eslint-disable-next-line no-console
        console.log(value);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  keys
    .command('put')
    .description(
      'Put a single value into KV [WRITE — operator approval required]. 向 KV 命名空间写入单个键值对，支持设置过期时间和元数据，需要操作员审批。'
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .requiredOption('-k, --key <key>', 'Key name. 要写入的键名。')
    .option('-v, --value <value>', 'Value string. 要写入的值（与 --from-file 二选一）。')
    .option('-f, --from-file <path>', 'Read value from file (supersedes --value). 从文件读取值（优先于 --value）。')
    .option('--ttl <seconds>', 'Expiration TTL in seconds (must be >= 60). 过期时间（秒），必须 >= 60。')
    .option('--expiration <unix>', 'Unix timestamp (seconds) at which key expires. 键过期的 Unix 时间戳（秒）。')
    .option('--meta <json>', 'Metadata object as JSON string. 元数据对象，JSON 字符串格式。')
    .action(async (options) => {
      try {
        if (!guard(`kv keys put (ns=${options.namespaceId}, key=${options.key})`, program)) return;
        if (!options.value && !options.fromFile) {
          return formatError('Provide either --value or --from-file');
        }
        const value = options.fromFile
          ? fs.readFileSync(path.resolve(process.cwd(), options.fromFile), 'utf8')
          : options.value;
        const meta = options.meta ? JSON.parse(options.meta) : undefined;
        const client = new CloudflareClient(program.opts().config);
        await client.putKVValue(options.namespaceId, options.key, value, {
          metadata: meta,
          expiration: options.expiration ? Number(options.expiration) : undefined,
          expiration_ttl: options.ttl ? Number(options.ttl) : undefined,
        });
        formatSuccess(`Key "${options.key}" stored successfully`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  keys
    .command('delete')
    .description(
      'Delete a single KV key [DESTRUCTIVE — operator approval required]. 删除 KV 命名空间中的单个键，此操作不可逆，需要操作员审批。'
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .requiredOption('-k, --key <key>', 'Key name. 要删除的键名。')
    .action(async (options) => {
      try {
        if (!guard(`kv keys delete (ns=${options.namespaceId}, key=${options.key})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        await client.deleteKVKey(options.namespaceId, options.key);
        formatSuccess(`Key "${options.key}" deleted`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // ------------------------------ Bulk keys --------------------------------
  keys
    .command('bulk-write')
    .description(
      'Write many KV pairs in bulk [DESTRUCTIVE — operator approval required]. 批量写入 KV 键值对（自动分块，每次最多 9000 对或 90 MB），需要操作员审批。',
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .requiredOption('-f, --file <path>', '.json / .csv / .ndjson file with KV pairs. 包含键值对的文件路径，支持 .json/.csv/.ndjson 格式。')
    .option('--dry-run', 'Only parse + summarize the file; do NOT call Cloudflare. 仅解析和汇总文件内容，不调用 Cloudflare API。')
    .action(async (options) => {
      try {
        const pairs = loadPairsFromFile(options.file);
        formatInfo(`Parsed ${pairs.length} KV pair(s) from ${options.file}`);
        if (pairs.length === 0) {
          return formatWarning('No pairs loaded — aborting');
        }
        if (options.dryRun) {
          const sample = pairs.slice(0, 3).map(
            (p) => `  · ${p.key}${p.expiration_ttl ? ` [ttl=${p.expiration_ttl}s]` : ''}`,
          );
          formatInfo(`Preview (first ${sample.length}):\n${sample.join('\n')}`);
          return;
        }
        if (!guard(
          `kv keys bulk-write (ns=${options.namespaceId}, count=${pairs.length})`,
          program,
        )) return;

        const client = new CloudflareClient(program.opts().config);
        const results = await client.bulkWriteKV(options.namespaceId, pairs);
        const okChunks = results.filter((r) => r && r.success).length;
        formatSuccess(
          `Bulk write completed — ${pairs.length} pair(s) across ${results.length} chunk(s), `
          + `${okChunks} chunk(s) reported success.`,
        );
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  keys
    .command('bulk-get')
    .description(
      'Read many KV values by key list. 批量读取 KV 键值对（自动分块，每次最多 5000 个键），支持内联键列表或从文件读取。'
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .option('-k, --keys <csv>', 'Inline key list (comma-separated). 内联键列表，逗号分隔。')
    .option('-f, --file <path>', 'Key list file (.txt one-per-line, .json array, .csv first col). 键列表文件，支持 .txt（每行一个）、.json（数组）、.csv（第一列）。')
    .option('-o, --out <path>', 'Write output as JSON array to file. 将结果以 JSON 数组格式写入文件。')
    .option('-j, --json', 'Output results as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        if (!options.keys && !options.file) {
          return formatError('Provide either --keys (inline CSV) or --file');
        }
        const keys = options.keys
          ? String(options.keys).split(',').map((k) => k.trim()).filter(Boolean)
          : loadKeysFromFile(options.file);
        if (keys.length === 0) return formatWarning('No keys provided — aborting');
        const client = new CloudflareClient(program.opts().config);
        const chunks = await client.bulkGetKV(options.namespaceId, keys);
        const flat = [];
        chunks.forEach((c) => {
          // Cloudflare bulk/get result shape: documented as {result:[{key,value,metadata,...}]}
          if (Array.isArray(c && c.result)) flat.push(...c.result);
          else if (Array.isArray(c)) flat.push(...c);
        });
        if (options.out) {
          fs.writeFileSync(
            path.resolve(process.cwd(), options.out),
            JSON.stringify(flat, null, 2),
          );
          formatSuccess(`Wrote ${flat.length} result(s) → ${options.out}`);
          return;
        }
        if (options.json) return formatJSON(flat);
        const t = flat.map((r) => ({
          key: r.key,
          value: typeof r.value === 'string' && r.value.length > 60
            ? `${r.value.slice(0, 60)}…`
            : String(r.value ?? ''),
          metadata: r.metadata ? JSON.stringify(r.metadata) : '-',
        }));
        formatTable([
          { header: 'Key', accessor: 'key' },
          { header: 'Value (truncated)', accessor: 'value' },
          { header: 'Metadata', accessor: 'metadata' },
        ], t);
        formatSuccess(`Returned ${flat.length} value(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  keys
    .command('bulk-delete')
    .description(
      'Delete many KV keys in bulk [DESTRUCTIVE — operator approval required]. 批量删除 KV 键（自动分块，每次最多 9000 个键），此操作不可逆，需要操作员审批。'
    )
    .requiredOption('-n, --namespace-id <id>', 'Namespace ID. 命名空间 ID。')
    .option('-k, --keys <csv>', 'Inline key list (comma-separated). 内联键列表，逗号分隔。')
    .option('-f, --file <path>', 'Key list file (.txt one-per-line, .json array, .csv first col). 键列表文件，支持 .txt（每行一个）、.json（数组）、.csv（第一列）。')
    .option('--dry-run', 'Only parse + count; do NOT call Cloudflare. 仅解析和计数，不调用 Cloudflare API。')
    .action(async (options) => {
      try {
        if (!options.keys && !options.file) {
          return formatError('Provide either --keys (inline CSV) or --file');
        }
        const keys = options.keys
          ? String(options.keys).split(',').map((k) => k.trim()).filter(Boolean)
          : loadKeysFromFile(options.file);
        if (keys.length === 0) return formatWarning('No keys provided — aborting');
        formatInfo(`Parsed ${keys.length} key(s)`);
        if (options.dryRun) {
          const sample = keys.slice(0, 5).map((k) => `  · ${k}`).join('\n');
          formatInfo(`Preview (first up to 5):\n${sample}`);
          return;
        }
        if (!guard(
          `kv keys bulk-delete (ns=${options.namespaceId}, count=${keys.length})`,
          program,
        )) return;
        const client = new CloudflareClient(program.opts().config);
        const results = await client.bulkDeleteKV(options.namespaceId, keys);
        const ok = results.filter((r) => r && r.success).length;
        formatSuccess(
          `Bulk delete completed — ${keys.length} key(s) across ${results.length} chunk(s), `
          + `${ok} chunk(s) reported success.`,
        );
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });
}

function renderKeyList(rows) {
  const data = rows.map((k) => ({
    name: k.name,
    expiration: k.expiration ? new Date(k.expiration * 1000).toISOString() : '-',
    metadata: k.metadata ? JSON.stringify(k.metadata) : '-',
  }));
  formatTable([
    { header: 'Name', accessor: 'name' },
    { header: 'Expires', accessor: 'expiration' },
    { header: 'Metadata', accessor: 'metadata' },
  ], data);
}

module.exports = kvCommands;
