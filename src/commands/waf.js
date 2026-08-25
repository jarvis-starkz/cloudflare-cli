/**
 * @file WAF command module.
 *
 *   - Legacy surface: packages / groups / rules / rate-limits (Legacy WAF).
 *   - Alias surface : `waf rulesets-v2` → mirrors the standalone `rulesets`
 *     command, giving Enterprise users a one-stop WAF umbrella.
 *
 * SECURITY (destructive-operation guard):
 *   Every write path (enable/disable/challenge/simulate/update/create/delete)
 *   runs through `isDestructiveConfirmed`. TTY users MUST explicitly set
 *   CFCLI_CONFIRM_DESTRUCTIVE=1 or the call is REFUSED and the user is
 *   prompted to ask the operator (you) for manual approval.
 *   No saved token is ever used for a destructive mutation without this gate.
 */

const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatVerboseError,
  formatWarning, formatInfo,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

/**
 * Wrap any destructive action with the approval guard. Returns true if the
 * caller may proceed; otherwise prints a refusal message and returns false.
 *
 * @param {string} opName  Human-readable operation description.
 * @param {*} program      Commander program (used for verbose errors).
 * @returns {boolean}
 */
function guard(opName, program) {
  if (isDestructiveConfirmed()) return true;
  const msg =
    `REFUSED destructive WAF operation: ${opName}\n`
    + '  Saved Cloudflare tokens are never used for modify/delete/override actions\n'
    + '  without explicit human approval. To proceed, please ask the operator\n'
    + '  (administrator) to review this request, then re-run with env var:\n'
    + '    CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli ...\n'
    + '  or run the command inside a non-interactive reviewed pipeline.';
  formatWarning(msg);
  if (program && program.opts && program.opts().verbose) {
    try {
      // Keep silent — refusal is self-explanatory.
    } catch (_) { /* noop */ }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                          Legacy WAF (packages/groups/rules)                */
/* -------------------------------------------------------------------------- */

function wafCommands(program) {
  const waf = program.command('waf').description(
    'Manage WAF (Web Application Firewall). 管理 Web 应用防火墙，包括 Legacy WAF 的包/组/规则/速率限制，以及 WAF Rulesets v2 引擎。'
  );

  // ------------------------------- Packages --------------------------------
  const packages = waf.command('packages').description(
    'Manage Legacy WAF Packages. 管理 Legacy WAF 包，每个包包含一组规则组，用于控制特定应用或路径的防护策略。'
  );

  packages
    .command('list')
    .description(
      'List all legacy WAF packages. 列出指定 Zone 的所有 Legacy WAF 包，支持分页获取全部数据。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('--page <N>', 'Page number (1-based) when --all is not used. 页码（从 1 开始），仅在未指定 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size (default 50). 每页返回的包数量。', '50')
    .option('--all', 'Fetch ALL packages by auto-paging. 自动分页获取所有包，忽略 --page 参数。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const z = options.zoneId;
        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listWaFRulesets(z, { ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listWaFRulesets(z, {
            page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = resp.result;
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || '-',
          detection_mode: pkg.detection_mode || '-',
          status: pkg.status || '-',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Description', accessor: 'description' },
          { header: 'Detection Mode', accessor: 'detection_mode' },
          { header: 'Status', accessor: 'status' },
        ], data);
        formatSuccess(`Found ${data.length} package(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  packages
    .command('get')
    .description(
      'Get a legacy WAF package details. 获取指定 Legacy WAF 包的详细信息，包括名称、描述、检测模式和动作模式。'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaFRuleset(options.packageId, options.zoneId);
        if (options.json) return formatJSON(result.result);
        const pkg = result.result;
        formatTable([{
          id: pkg.id, name: pkg.name, description: pkg.description || '-',
          detection_mode: pkg.detection_mode || '-', status: pkg.status || '-',
          action_mode: pkg.action_mode || '-',
        }], [
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Description', accessor: 'description' },
          { header: 'Detection Mode', accessor: 'detection_mode' },
          { header: 'Status', accessor: 'status' },
          { header: 'Action Mode', accessor: 'action_mode' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  packages
    .command('update')
    .description(
      'Update a legacy WAF package sensitivity / action / status. 更新 Legacy WAF 包的灵敏度、动作模式或状态，用于调整防护级别和响应行为。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .option('--sensitivity <sensitivity>', 'Sensitivity level (low, medium, high). 灵敏度级别：low（低）、medium（中）、high（高）。')
    .option('--action-mode <mode>', 'Action mode (simulate, block, challenge). 动作模式：simulate（模拟）、block（阻止）、challenge（质询）。')
    .option('--status <status>', 'Status (on, off). 包状态：on（启用）、off（禁用）。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf packages update (pkg=${options.packageId})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.sensitivity) data.sensitive = options.sensitivity;
        if (options.actionMode) data.action_mode = options.actionMode;
        if (options.status) data.status = options.status;
        if (Object.keys(data).length === 0) {
          return formatError('Specify at least one: --sensitivity / --action-mode / --status');
        }
        const result = await client.updateWaFRuleset(options.packageId, options.zoneId, data);
        formatSuccess(`WAF package updated: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // -------------------------------- Groups ---------------------------------
  const groups = waf.command('groups').description(
    'Manage Legacy WAF Groups. 管理 Legacy WAF 规则组，每个组包含一组相关规则，可统一启用或禁用。'
  );

  groups
    .command('list')
    .description(
      'List WAF groups inside a package. 列出指定 WAF 包中的所有规则组，支持分页获取全部数据。'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('--page <N>', 'Page number (1-based) when --all is not used. 页码（从 1 开始），仅在未指定 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size (default 50). 每页返回的规则组数量。', '50')
    .option('--all', 'Fetch ALL groups by auto-paging. 自动分页获取所有规则组，忽略 --page 参数。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listWaFGroups(options.packageId, options.zoneId, { ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listWaFGroups(options.packageId, options.zoneId, {
            page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = resp.result;
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((g) => ({
          id: g.id, name: g.name, description: g.description || '-',
          rules_count: Number(g.rules_count) || '-', modified_on: g.modified_on || '-',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Description', accessor: 'description' },
          { header: 'Rules Count', accessor: 'rules_count' },
          { header: 'Modified', accessor: 'modified_on' },
        ], data);
        formatSuccess(`Found ${data.length} group(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  groups
    .command('get')
    .description(
      'Get a WAF group details. 获取指定 WAF 规则组的详细信息，包括名称、描述、规则数量和修改时间。'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .requiredOption('-g, --group-id <groupId>', 'Group ID. 规则组的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaFGroup(
          options.packageId, options.groupId, options.zoneId,
        );
        if (options.json) return formatJSON(result.result);
        const g = result.result;
        formatTable([{
          id: g.id, name: g.name, description: g.description || '-',
          rules_count: Number(g.rules_count) || '-', modified_on: g.modified_on || '-',
        }], [
          { header: 'ID', accessor: 'id' },
          { header: 'Name', accessor: 'name' },
          { header: 'Description', accessor: 'description' },
          { header: 'Rules Count', accessor: 'rules_count' },
          { header: 'Modified', accessor: 'modified_on' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  groups
    .command('enable')
    .description(
      'Enable all rules in a WAF group. 启用指定 WAF 规则组中的所有规则，使防护策略生效。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .requiredOption('-g, --group-id <groupId>', 'Group ID. 规则组的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf groups enable (pkg=${options.packageId}, group=${options.groupId})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaFGroup(
          options.packageId, options.groupId, options.zoneId, { status: 'on' },
        );
        formatSuccess(`WAF group enabled: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  groups
    .command('disable')
    .description(
      'Disable all rules in a WAF group. 禁用指定 WAF 规则组中的所有规则，暂停该组的防护策略。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .requiredOption('-g, --group-id <groupId>', 'Group ID. 规则组的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf groups disable (pkg=${options.packageId}, group=${options.groupId})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaFGroup(
          options.packageId, options.groupId, options.zoneId, { status: 'off' },
        );
        formatSuccess(`WAF group disabled: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // --------------------------------- Rules ---------------------------------
  const rules = waf.command('rules').description(
    'Manage Legacy WAF Rules. 管理 Legacy WAF 规则，支持查看、启用、禁用、模拟和质询等操作。'
  );

  rules
    .command('list')
    .description(
      'List WAF rules inside a package. 列出指定 WAF 包中的所有规则，支持按匹配模式和状态过滤。'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('--matches-on <matches>', 'Filter by matches (all, any). 按匹配条件过滤：all（全部匹配）、any（任意匹配）。')
    .option('--mode <mode>', 'Filter by mode (on, off, default, disable). 按模式过滤：on（启用）、off（禁用）、default（默认）、disable（已禁用）。')
    .option('--page <N>', 'Page number (1-based) when --all is not used. 页码（从 1 开始），仅在未指定 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size (default 50). 每页返回的规则数量。', '50')
    .option('--all', 'Fetch ALL rules by auto-paging. 自动分页获取所有规则，忽略 --page 参数。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.matchesOn) params.matches_on = options.matchesOn;
        if (options.mode) params.mode = options.mode;

        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listWaFRules(options.packageId, options.zoneId, { ...params, ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listWaFRules(options.packageId, options.zoneId, {
            ...params, page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = resp.result;
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((r) => ({
          id: r.id, description: r.description || '-', priority: r.priority || '-',
          group: (r.group && r.group.name) || '-', mode: r.mode || '-',
          allowed_modes: (r.allowed_modes || []).join(', ') || '-',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Description', accessor: 'description' },
          { header: 'Priority', accessor: 'priority' },
          { header: 'Group', accessor: 'group' },
          { header: 'Mode', accessor: 'mode' },
        ], data);
        formatSuccess(`Found ${data.length} rule(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  rules
    .command('get')
    .description(
      'Get a WAF rule details. 获取指定 WAF 规则的详细信息，包括描述、优先级、所属组和允许的模式。'
    )
    .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
    .requiredOption('-r, --rule-id <ruleId>', 'Rule ID. 规则的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaFRule(
          options.packageId, options.ruleId, options.zoneId,
        );
        if (options.json) return formatJSON(result.result);
        const r = result.result;
        formatTable([{
          id: r.id, description: r.description || '-', priority: r.priority || '-',
          group: (r.group && r.group.name) || '-', mode: r.mode || '-',
          allowed_modes: (r.allowed_modes || []).join(', ') || '-',
          default_mode: r.default_mode || '-', ref: r.ref || '-',
        }], [
          { header: 'ID', accessor: 'id' },
          { header: 'Description', accessor: 'description' },
          { header: 'Priority', accessor: 'priority' },
          { header: 'Group', accessor: 'group' },
          { header: 'Mode', accessor: 'mode' },
          { header: 'Allowed Modes', accessor: 'allowed_modes' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  ['enable', 'disable', 'challenge', 'simulate'].forEach((modeOp) => {
    const modeMap = { enable: 'on', disable: 'off', challenge: 'challenge', simulate: 'simulate' };
    rules
      .command(modeOp)
      .description(
        `Set a WAF rule to ${modeMap[modeOp]} mode. 将指定 WAF 规则设置为 ${modeMap[modeOp]} 模式。[DESTRUCTIVE — needs approval]`
      )
      .requiredOption('-p, --package-id <packageId>', 'Package ID. WAF 包的唯一标识符。')
      .requiredOption('-r, --rule-id <ruleId>', 'Rule ID. 规则的唯一标识符。')
      .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
      .action(async (options) => {
        try {
          if (!guard(`waf rules ${modeOp} (rule=${options.ruleId})`, program)) return;
          const client = new CloudflareClient(program.opts().config);
          const result = await client.updateWaFRule(
            options.packageId, options.ruleId, options.zoneId, { mode: modeMap[modeOp] },
          );
          formatSuccess(`WAF rule set to ${modeMap[modeOp]}: ${result.result.id}`);
        } catch (err) { formatVerboseError(err, program.opts().verbose); }
      });
  });

  // ------------------------------ Rate Limits ------------------------------
  const rateLimits = waf.command('rate-limits').description(
    'Manage WAF Rate Limiting Rules. 管理 WAF 速率限制规则，用于控制请求频率、防止滥用和 DDoS 攻击。'
  );

  rateLimits
    .command('list')
    .description(
      'List all rate limiting rules. 列出指定 Zone 的所有速率限制规则，支持分页获取全部数据。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('--page <N>', 'Page number (1-based) when --all is not used. 页码（从 1 开始），仅在未指定 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size (default 50). 每页返回的规则数量。', '50')
    .option('--all', 'Fetch ALL rate limit rules by auto-paging. 自动分页获取所有速率限制规则，忽略 --page 参数。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => client.listRateLimits(options.zoneId, p),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listRateLimits(options.zoneId, {
            page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = resp.result;
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((rl) => ({
          id: rl.id, description: rl.description || '-', threshold: rl.threshold,
          period: rl.period, action: (rl.action && rl.action.mode) || '-',
          disabled: rl.disabled ? 'Yes' : 'No',
        }));
        formatTable([
          { header: 'ID', accessor: 'id' },
          { header: 'Description', accessor: 'description' },
          { header: 'Threshold', accessor: 'threshold' },
          { header: 'Period (s)', accessor: 'period' },
          { header: 'Action', accessor: 'action' },
          { header: 'Disabled', accessor: 'disabled' },
        ], data);
        formatSuccess(`Found ${data.length} rate limit rule(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  rateLimits
    .command('get')
    .description(
      'Get a rate limiting rule details. 获取指定速率限制规则的详细信息，包括阈值、周期、动作和关联配置。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 速率限制规则的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getRateLimit(options.id, options.zoneId);
        if (options.json) return formatJSON(result.result);
        const r = result.result;
        formatTable([{
          id: r.id, description: r.description || '-', threshold: r.threshold || '-',
          period: r.period || '-', action: (r.action && r.action.mode) || '-',
          action_duration: (r.action && r.action.timeout) || '-',
          disabled: r.disabled ? 'Yes' : 'No', correlate: (r.correlated && r.correlated.by) || '-',
        }], [
          { header: 'ID', accessor: 'id' },
          { header: 'Description', accessor: 'description' },
          { header: 'Threshold', accessor: 'threshold' },
          { header: 'Period (s)', accessor: 'period' },
          { header: 'Action', accessor: 'action' },
          { header: 'Duration', accessor: 'action_duration' },
          { header: 'Disabled', accessor: 'disabled' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  rateLimits
    .command('create')
    .description(
      'Create a rate limiting rule. 创建新的速率限制规则，用于限制特定 URL 或全站的请求频率。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-d, --description <description>', 'Rule description. 规则描述，用于标识该规则的用途。')
    .requiredOption('-t, --threshold <threshold>', 'Request threshold. 请求阈值，在指定周期内允许的最大请求数。')
    .requiredOption('-p, --period <period>', 'Period in seconds (10-86400). 统计周期（秒），取值范围 10-86400。')
    .requiredOption('--action <action>', 'Action (block, challenge, js_challenge, managed_challenge, log). 触发后的动作：block（阻止）、challenge（质询）、js_challenge（JS 质询）、managed_challenge（托管质询）、log（记录）。')
    .option('--action-duration <duration>', 'Action duration in seconds. 动作持续时间（秒），默认 60 秒。')
    .option('--url-pattern <pattern>', 'URL pattern to match. 要匹配的 URL 模式，不指定则匹配所有请求。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf rate-limits create (desc="${options.description}")`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const data = {
          description: options.description,
          threshold: parseInt(options.threshold, 10),
          period: parseInt(options.period, 10),
          action: {
            mode: options.action,
            timeout: options.actionDuration ? parseInt(options.actionDuration, 10) : 60,
          },
        };
        if (options.urlPattern) data.match = { request: { url: options.urlPattern } };
        const result = await client.createRateLimit(options.zoneId, data);
        formatSuccess(`Rate limit rule created: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  rateLimits
    .command('update')
    .description(
      'Update a rate limiting rule. 更新现有速率限制规则的阈值、周期、动作或描述。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 速率限制规则的唯一标识符。')
    .option('-d, --description <description>', 'Rule description. 规则描述，用于标识该规则的用途。')
    .option('-t, --threshold <threshold>', 'Request threshold. 请求阈值，在指定周期内允许的最大请求数。')
    .option('-p, --period <period>', 'Period in seconds. 统计周期（秒）。')
    .option('--action <action>', 'Action (block, challenge, js_challenge, managed_challenge, log). 触发后的动作：block（阻止）、challenge（质询）、js_challenge（JS 质询）、managed_challenge（托管质询）、log（记录）。')
    .option('--disabled', 'Disable the rule. 禁用该规则。')
    .option('--no-disabled', 'Enable the rule. 启用该规则。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf rate-limits update (id=${options.id})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.description) data.description = options.description;
        if (options.threshold) data.threshold = parseInt(options.threshold, 10);
        if (options.period) data.period = parseInt(options.period, 10);
        if (options.action) data.action = { mode: options.action };
        if (options.disabled !== undefined) data.disabled = options.disabled;
        if (Object.keys(data).length === 0) {
          return formatError('Specify at least one option to update');
        }
        const result = await client.updateRateLimit(options.id, options.zoneId, data);
        formatSuccess(`Rate limit rule updated: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  rateLimits
    .command('delete')
    .description(
      'Delete a rate limiting rule. 删除指定的速率限制规则，此操作不可恢复。[DESTRUCTIVE — needs approval]'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 速率限制规则的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        if (!guard(`waf rate-limits delete (id=${options.id})`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteRateLimit(options.id, options.zoneId);
        formatSuccess(`Rate limit rule deleted: ${result.result.id}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  /* ---------------------------------------------------------------------- */
  /*                 `waf rulesets-v2` — alias to rulesets module           */
  /* ---------------------------------------------------------------------- */
  const v2 = waf.command('rulesets-v2')
    .description('Enterprise WAF Rulesets Engine v2 (alias for `cfcli rulesets ...`). 企业版 WAF Rulesets v2 引擎，作为 `cfcli rulesets ...` 的别名，提供一站式 WAF 管理入口。');
  // Reuse rulesets command module — it registers subcommands on the passed
  // commander node. We just alias the command container name.
  try {
    // eslint-disable-next-line global-require
    const rulesetsMod = require('./rulesets');
    // rulesets.js expects `program` to register commands. Pass a wrapper that
    // hangs off our `waf rulesets-v2` node by registering subcommands via
    // a lightweight proxy that hijacks `program.command(name).description()`
    // to become rulesets-v2 subcommands instead of top-level.
    registerRulesetsSubset(v2, rulesetsMod, program);
  } catch (err) {
    v2.command('*')
      .description('Fallback — rulesets module failed to load. 回退命令 — rulesets 模块加载失败时的占位提示。')
      .action(() => formatError(`Failed to load rulesets module: ${err.message}`));
  }
}

/**
 * Rulesets module registers subcommands on program via program.command(). To
 * mirror it under `waf rulesets-v2`, we create a fake `program` object that
 * intercepts the first-level `.command(name)` call and instead creates the
 * sub-subcommand on the real `rulesets-v2` commander node we already own.
 */
function registerRulesetsSubset(aliasNode, rulesetsMod, realProgram) {
  formatInfo; // silence unused (kept for future log)
  const pseudo = new Proxy(realProgram, {
    get(target, prop) {
      if (prop === 'command') {
        return (name, ...args) => {
          // Intercept the top-level 'rulesets' registration and ignore it, so
          // only its `.command(...)` sub-chains register under aliasNode.
          if (name === 'rulesets' || name === 'rulesets-v2') {
            // Return a fake builder that sinks the top-level call but
            // redirects any chained `.command(...)` back onto aliasNode.
            const sink = {};
            const rewire = () => sink;
            ['description', 'alias', 'option', 'requiredOption', 'action', 'addCommand']
              .forEach((m) => { sink[m] = rewire; });
            sink.command = (n, ...rest) => aliasNode.command(n, ...rest);
            return sink;
          }
          // Any other command (if rulesets module later re-exports helpers)
          // falls back to normal behavior.
          return target.command(name, ...args);
        };
      }
      return typeof target[prop] === 'function'
        ? target[prop].bind(target)
        : target[prop];
    },
  });
  try {
    rulesetsMod(pseudo);
  } catch (_) {
    // Module likely already registered its top-level command — fall back to
    // registering a one-line pointer command instead of crashing.
    aliasNode
      .command('list')
      .description('Use `cfcli rulesets list` instead (alias tip). 提示：请使用顶层命令 `cfcli rulesets list` 获取完整的 Rulesets v2 支持。')
      .action(() => {
        formatInfo('Tip: use the top-level `cfcli rulesets ...` command for full Rulesets v2 support.');
      });
  }
}

module.exports = wafCommands;
