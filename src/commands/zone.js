/**
 * @file Zone management commands.
 *
 * Enhancements (P0/P1):
 *   - `zone list` supports --page / --per-page / --all auto-pagination.
 *   - `zone update-setting` is classified as destructive because it can
 *     alter live traffic (SSL, HTTPS-enforcement, security levels, etc.)
 *     → gated by isDestructiveConfirmed.
 *   - All catch blocks route through formatVerboseError when --verbose is set.
 */

const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON,
  formatVerboseError, formatWarning,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

function guard(opName, program) {
  if (isDestructiveConfirmed()) return true;
  formatWarning(
    `REFUSED destructive zone operation: ${opName}\n`
    + '  Saved Cloudflare tokens are never used for modify/delete/override actions\n'
    + '  without explicit human approval. Please request operator review, then re-run:\n'
    + '    CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli zone ...',
  );
  return false;
}

function zoneCommands(program) {
  const zone = program.command('zone').description('Manage Cloudflare Zones. 管理 Cloudflare Zone，支持查看 Zone 列表、详情、设置以及更新 Zone 配置。');

  zone
    .command('list')
    .description('List all zones. 列出当前 API Token 可访问的所有 Zone，支持按状态/名称过滤和自动分页。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
    .option('-s, --status <status>', 'Filter by status. 按 Zone 状态过滤，有效值: active, pending, initializing, moved, deleted, deactivated。')
    .option('-n, --name <name>', 'Filter by zone name (contains match). 按 Zone 名称过滤（服务端模糊匹配），例如 "example.com"。')
    .option('--page <N>', 'Page number (1-based). 页码（从 1 开始），仅在未使用 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size, default 50, max 50. 每页返回的 Zone 数量，最大值为 50。', '50')
    .option('--all', 'Fetch ALL zones by auto-paging. 自动翻页获取所有 Zone，忽略 --page 参数。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.status) params.status = options.status;
        if (options.name) params.name = options.name;

        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listZones({ ...params, ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listZones({
            ...params,
            page: Number(options.page),
            per_page: Number(options.perPage),
          });
          rows = resp.result;
        }

        if (options.json) return formatJSON(rows);
        const data = rows.map((z) => ({
          id: z.id,
          name: z.name,
          status: z.status,
          name_servers: (z.name_servers || []).join(', ') || '-',
          plan: (z.plan && z.plan.name) || '-',
          type: z.type || '-',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Status', accessor: 'status' },
          { header: 'Plan', accessor: 'plan' },
          { header: 'Type', accessor: 'type' },
          { header: 'Name Servers', accessor: 'name_servers' },
        ], data);
        formatSuccess(`Found ${data.length} zone(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  zone
    .command('get')
    .description('Get zone details. 获取指定 Zone 的详细信息，包括名称、状态、计划、名称服务器等。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getZone(options.zoneId);
        if (options.json) return formatJSON(result.result);
        const z = result.result;
        formatTable([{
          id: z.id, name: z.name, status: z.status, type: z.type || '-',
          name_servers: (z.name_servers || []).join(', ') || '-',
          plan: (z.plan && z.plan.name) || '-',
          created_on: z.created_on || '-', modified_on: z.modified_on || '-',
          original_name_servers: (z.original_name_servers || []).join(', ') || '-',
        }], [
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Status', accessor: 'status' },
          { header: 'Type', accessor: 'type' },
          { header: 'Plan', accessor: 'plan' },
          { header: 'Created', accessor: 'created_on' },
          { header: 'Modified', accessor: 'modified_on' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  zone
    .command('settings')
    .description('Get zone settings. 获取 Zone 的所有生效设置（SSL、HTTPS、安全级别等），支持查询单个设置项。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
    .option('-k, --key <key>', 'Show only a single setting. 仅显示指定 ID 的单个设置项，例如 ssl、always_use_https、security_level。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const zoneId = options.zoneId || (program.opts().config && program.opts().config.zoneId);
        if (!zoneId) {
          return formatError('Zone ID is required. Pass -z/--zone-id or set config.zoneId.');
        }

        if (options.key) {
          const one = await client.request(
            'GET', `/zones/${zoneId}/settings/${encodeURIComponent(options.key)}`,
          );
          if (options.json) return formatJSON(one.result);
          const s = one.result;
          formatTable([{
            id: s.id,
            value: typeof s.value === 'object' ? JSON.stringify(s.value) : s.value,
            editable: s.editable ? 'Yes' : 'No',
            modified_on: s.modified_on || '-',
          }], [
            { header: 'Setting', accessor: 'id' },
            { header: 'Value', accessor: 'value' },
            { header: 'Editable', accessor: 'editable' },
            { header: 'Modified', accessor: 'modified_on' },
          ]);
          return;
        }

        const result = await client.request('GET', `/zones/${zoneId}/settings`);
        const settings = result.result;
        if (options.json) return formatJSON(settings);
        const data = settings.map((s) => ({
          id: s.id,
          value: typeof s.value === 'object' ? JSON.stringify(s.value) : s.value,
          editable: s.editable ? 'Yes' : 'No',
          modified_on: s.modified_on || '-',
        }));
        formatTable([
          { header: 'Setting', accessor: 'id' },
          { header: 'Value', accessor: 'value' },
          { header: 'Editable', accessor: 'editable' },
          { header: 'Modified', accessor: 'modified_on' },
        ], data);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  zone
    .command('update-setting')
    .description(
      'Update a single zone setting. 更新单个 Zone 设置项（如 SSL、always_use_https、security_level 等）。'
      + '[DESTRUCTIVE — 需要 CFCLI_CONFIRM_DESTRUCTIVE=1 确认执行]',
    )
    .requiredOption('-n, --name <name>', 'Setting name. 设置项名称，例如 ssl、always_use_https、security_level、min_tls_version。')
    .requiredOption('-v, --value <value>', 'Setting value. 设置值，支持 JSON 或字符串格式。布尔值使用 "true"/"false"，数字直接输入数值。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .action(async (options) => {
      try {
        if (!guard(
          `zone update-setting (${options.name}=${options.value} on zone=${options.zoneId || '<configured>'})`,
          program,
        )) return;
        const client = new CloudflareClient(program.opts().config);

        // Parse JSON-like values (objects/arrays/booleans/numbers) but fall
        // back to raw string for plain string values like "strict".
        let value;
        try {
          value = JSON.parse(options.value);
        } catch (_) {
          if (options.value === 'true') value = true;
          else if (options.value === 'false') value = false;
          else {
            const asNum = Number(options.value);
            value = (options.value !== '' && !Number.isNaN(asNum)) ? asNum : options.value;
          }
        }

        const result = await client.updateZoneSettings(options.zoneId, {
          [options.name]: value,
        });
        const updated = (result && result.result && result.result[0]) || result.result || {};
        formatSuccess(
          `Zone setting "${options.name}" ${updated.id ? 'updated' : 'applied'} `
          + `(${updated.id ? `id=${updated.id}` : ''}). New value: `
          + (typeof updated.value === 'object'
            ? JSON.stringify(updated.value)
            : String(updated.value ?? value)),
        );
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });
}

module.exports = zoneCommands;
