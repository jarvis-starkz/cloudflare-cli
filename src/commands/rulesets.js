/**
 * WAF Rulesets Engine (v2) 命令模块。
 *
 * 管理 Cloudflare WAF 规则集引擎 (v2)，替代传统的 waf packages/groups/rules API。
 * 支持创建、更新、删除规则集，管理阶段入口点规则集，以及操作单个规则。
 * 提供细粒度的 Web 应用防火墙控制，支持自定义规则和托管规则。
 *
 * 参考文档 (Cloudflare docs via MCP):
 *   GET/POST /zones/{zone_id}/rulesets
 *   GET/PUT /zones/{zone_id}/rulesets/phases/{phase}/entrypoint
 *   GET/PUT/DELETE /zones/{zone_id}/rulesets/{ruleset_id}
 *   POST/PATCH/DELETE /zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}
 */

const fs = require('fs');
const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatInfo, formatTable, formatJSON, formatVerboseError,
} = require('../utils/formatter');

const VALID_PHASES = [
  'http_request_sanitize',
  'http_ratelimit',
  'http_request_firewall_custom',
  'http_request_firewall_managed',
  'http_request_cache_settings',
  'http_origin_error_page_customizations',
  'http_config_settings',
  'http_log_custom_fields',
  'http_request_late_transform',
  'http_request_redirect',
  'http_request_origin',
  'http_response_headers_transform',
  'http_request_headers_transform',
  'http_response_firewall_managed',
];

function readJSONFile(path, onFailMessage) {
  const raw = fs.readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${onFailMessage}：${e.message}`);
  }
}

function rulesetsCommands(program) {
  const rs = program.command('rulesets')
    .description('管理 WAF 规则集引擎 (v2)，替代传统的 waf packages/groups/rules API，提供更细粒度的防火墙控制');

  // ---------- rulesets list / get / create / update / delete ----------
  rs.command('list')
    .description('列出区域规则集。显示指定区域配置的所有规则集，可按阶段筛选。适用于查看现有规则集配置或进行批量管理。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要查询的区域')
    .option('--phase <phase>', `按阶段筛选规则集。有效值：${VALID_PHASES.join(', ')}。例如：http_request_firewall_custom`)
    .option('--all', '自动分页获取所有结果，适用于规则集数量较多的场景')
    .option('--page <N>', '页码，用于分页浏览结果。默认值：1', '1')
    .option('--per-page <N>', '每页显示的规则集数量。有效值：1-100。默认值：50', '50')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.phase) { params.phase = options.phase; }
        let result;
        if (options.all) {
          result = await client.paginatedList(
            p => client.listZoneRulesets(options.zoneId, { ...params, ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const r = await client.listZoneRulesets(options.zoneId, {
            ...params,
            page: Number(options.page),
            per_page: Number(options.perPage),
          });
          result = r.result;
        }
        if (options.json) return formatJSON(result);
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: '名称', accessor: 'name' },
          { header: '类型', accessor: 'kind' },
          { header: '阶段', accessor: 'phase' },
          { header: '版本', accessor: 'version' },
          { header: '规则数', accessor: r => (Array.isArray(r.rules) ? r.rules.length : '-') },
        ], result.map(r => ({ ...r })));
        formatSuccess(`找到 ${result.length} 个规则集`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('get <rulesetId>')
    .description('获取单个区域规则集。显示指定规则集的完整配置，包含所有规则详情。适用于查看特定规则集的详细配置或排查问题。')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要查询的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (rulesetId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const r = await client.getZoneRuleset(rulesetId, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatInfo(`规则集 ${rulesetId}：`);
        formatJSON(r.result);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('create')
    .description('创建新的区域规则集。创建一个新的规则集，可指定名称、类型、阶段和初始规则。适用于设置自定义 WAF 规则或配置特定阶段的规则集。')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要创建规则集的区域')
    .requiredOption('--name <name>', '规则集名称，用于标识该规则集的显示名称')
    .requiredOption('--kind <kind>', '规则集类型。有效值：zone（区域级别规则集）或 custom（自定义规则集）')
    .requiredOption('--phase <phase>', `规则集阶段，指定规则集在请求处理流程中的位置。有效值示例：${VALID_PHASES.slice(0, 5).join(', ')}`)
    .option('--description <desc>', '规则集描述，用于说明该规则集的用途')
    .option('--rules-file <path>', '规则文件路径，指定包含规则数组的 JSON 文件路径。文件内容必须是规则对象数组')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const body = {
          name: options.name,
          kind: options.kind,
          phase: options.phase,
          description: options.description || '',
        };
        if (options.rulesFile) {
          body.rules = readJSONFile(options.rulesFile, '--rules-file 必须包含有效的 JSON');
          if (!Array.isArray(body.rules)) throw new Error('--rules-file JSON 必须是规则对象数组');
        }
        const r = await client.createZoneRuleset(body, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`规则集已创建：${r.result.id} (${r.result.name})`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('update <rulesetId>')
    .description('更新区域规则集 (PUT)。替换指定规则集的完整配置，包括名称、描述和规则。适用于批量更新规则集配置。')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要更新规则集的区域')
    .option('--name <name>', '新的规则集名称')
    .option('--description <desc>', '新的规则集描述')
    .option('--rules-file <path>', '规则文件路径，用于替换规则集的所有规则。文件内容必须是规则对象数组')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (rulesetId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const existing = await client.getZoneRuleset(rulesetId, options.zoneId);
        const body = { ...existing.result };
        if (options.name) body.name = options.name;
        if (options.description) body.description = options.description;
        if (options.rulesFile) {
          body.rules = readJSONFile(options.rulesFile, '--rules-file 必须包含有效的 JSON');
          if (!Array.isArray(body.rules)) throw new Error('--rules-file JSON 必须是数组');
        }
        const r = await client.updateZoneRuleset(rulesetId, body, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`规则集 ${rulesetId} 已更新`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('delete <rulesetId>')
    .description('⚠ 删除区域规则集。永久移除指定的规则集及其所有规则。此操作不可逆，且会影响依赖该规则集的防护策略，请谨慎使用。')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要删除规则集的区域')
    .action(async (rulesetId, options) => {
      try {
        // Destructive-confirmation guard handled via util.
        // eslint-disable-next-line global-require
        const { isDestructiveConfirmed } = require('../utils/config');
        if (!isDestructiveConfirmed()) {
          formatError(
            '在 TTY 模式下拒绝破坏性规则集删除操作。' +
            '设置 CFCLI_CONFIRM_DESTRUCTIVE=1 以继续（CI 环境自动跳过）。',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        await client.deleteZoneRuleset(rulesetId, options.zoneId);
        formatSuccess(`规则集 ${rulesetId} 已删除`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  // ---------- entrypoint subcommand ----------
  const ep = rs.command('entrypoint')
    .description('获取或更新阶段的入口点规则集，入口点规则集定义了特定处理阶段的规则集合');

  ep.command('get')
    .description('获取阶段的入口点规则集。显示指定阶段的入口点规则集配置，包含该阶段的所有规则。适用于查看特定阶段的规则配置。')
    .requiredOption('--phase <phase>', `阶段名称（例如：http_request_firewall_custom）。有效值：${VALID_PHASES.join(', ')}`)
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要查询的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const r = await client.getZoneEntrypoint(options.phase, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatInfo(`阶段 ${options.phase} 的入口点规则集：`);
        formatJSON(r.result);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  ep.command('update')
    .description('替换阶段入口点的所有规则。使用指定的规则数组替换阶段入口点的全部规则。适用于批量更新特定阶段的防护规则。')
    .requiredOption('--phase <phase>', '阶段名称，指定要更新入口点的阶段')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要更新规则集的区域')
    .requiredOption('--rules-file <path>', '规则文件路径，包含规则数组的 JSON 文件（PUT body rules key）')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const rules = readJSONFile(options.rulesFile, '--rules-file 必须包含有效的 JSON');
        if (!Array.isArray(rules)) throw new Error('--rules-file JSON 必须是规则对象数组');
        const r = await client.updateZoneEntrypoint(
          options.phase,
          { description: `cfcli entrypoint update @ ${new Date().toISOString()}`, rules },
          options.zoneId,
        );
        if (options.json) return formatJSON(r.result);
        formatSuccess(`入口点阶段=${options.phase} 已更新 — ${rules.length} 条规则`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  // ---------- rule subcommand (single rule CRUD within a ruleset or entrypoint) ----------
  const rule = rs.command('rule')
    .description('操作规则集中的单个规则，支持创建、更新和删除规则集中的具体规则');

  rule.command('create')
    .description('向规则集添加规则。在指定的规则集或阶段入口点中创建新规则。适用于添加自定义防护规则或扩展现有规则集。')
    .requiredOption('--ruleset-id <rulesetId>', '目标规则集 ID，可使用 "entrypoint:<phase>" 格式指定阶段入口点（例如：entrypoint:http_request_firewall_custom）')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要创建规则的区域')
    .requiredOption('--expression <expr>', 'WAF 过滤器表达式，定义规则的匹配条件（例如："http.request.uri.path contains \"/admin\""）')
    .requiredOption('--action <action>',
      '规则动作。有效值：block（阻止）、challenge（验证码挑战）、js_challenge（JavaScript 挑战）、managed_challenge（托管挑战）、log（记录）、skip（跳过）、rewrite（重写）、redirect（重定向）、set_cache_settings（设置缓存）等')
    .option('--description <desc>', '规则描述，用于说明该规则的用途')
    .option('--action-params <json>', '动作参数对象（JSON 字符串），用于配置动作的详细参数（例如：{"response": {"content": "blocked"}}）')
    .option('--enabled <true|false>', '是否启用规则。有效值：true 或 false。默认值：true', 'true')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let actionParams = undefined;
        if (options.actionParams) {
          try { actionParams = JSON.parse(options.actionParams); }
          catch (e) { throw new Error(`--action-params 解析错误：${e.message}`); }
        }
        const ruleBody = {
          action: options.action,
          expression: options.expression,
          description: options.description || '',
          enabled: options.enabled !== 'false',
        };
        if (actionParams) ruleBody.action_parameters = actionParams;

        // Syntax sugar: "entrypoint:<phase>" targets the entrypoint ruleset
        const rulesetId = options.rulesetId;
        let result;
        if (String(rulesetId).startsWith('entrypoint:')) {
          const phase = String(rulesetId).slice('entrypoint:'.length);
          const epRs = await client.getZoneEntrypoint(phase, options.zoneId);
          const epId = epRs.result.id;
          result = await client.createRulesetRule(epId, ruleBody, options.zoneId);
        } else {
          result = await client.createRulesetRule(rulesetId, ruleBody, options.zoneId);
        }
        if (options.json) return formatJSON(result.result);
        formatSuccess(`规则 ${result.result.id} 已创建（动作=${result.result.action}）`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rule.command('update <ruleId>')
    .description('修补单个规则。更新指定规则的部分字段，如表达式、动作、启用状态等。适用于修改现有规则的配置。')
    .requiredOption('--ruleset-id <rulesetId>', '目标规则集 ID，指定要更新规则所在的规则集')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要更新规则的区域')
    .option('--expression <expr>', '新的过滤器表达式，替换规则的匹配条件')
    .option('--action <action>', '新的规则动作')
    .option('--action-params <json>', '新的动作参数（JSON 字符串）')
    .option('--enabled <true|false>', '启用或禁用规则。有效值：true 或 false')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (ruleId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const patch = {};
        if (options.expression !== undefined) patch.expression = options.expression;
        if (options.action !== undefined) patch.action = options.action;
        if (options.enabled !== undefined) patch.enabled = options.enabled !== 'false';
        if (options.actionParams) {
          try { patch.action_parameters = JSON.parse(options.actionParams); }
          catch (e) { throw new Error(`--action-params 解析错误：${e.message}`); }
        }
        const r = await client.updateRulesetRule(options.rulesetId, ruleId, patch, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`规则 ${ruleId} 已更新`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rule.command('delete <ruleId>')
    .description('⚠ 删除单个规则。从规则集中永久移除指定的规则。此操作不可逆，请谨慎使用。')
    .requiredOption('--ruleset-id <rulesetId>', '目标规则集 ID，指定要删除规则所在的规则集')
    .requiredOption('-z, --zone-id <zoneId>', '区域 ID（Zone ID），指定要删除规则的区域')
    .action(async (ruleId, options) => {
      try {
        // eslint-disable-next-line global-require
        const { isDestructiveConfirmed } = require('../utils/config');
        if (!isDestructiveConfirmed()) {
          formatError(
            '在 TTY 模式下拒绝破坏性规则删除操作。' +
            '设置 CFCLI_CONFIRM_DESTRUCTIVE=1 以继续。',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        await client.deleteRulesetRule(options.rulesetId, ruleId, options.zoneId);
        formatSuccess(`规则 ${ruleId} 已删除`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });
}

module.exports = rulesetsCommands;
