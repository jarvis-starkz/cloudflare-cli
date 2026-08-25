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
  const waf = program.command('waf').description('Manage WAF (Web Application Firewall)');

  // ------------------------------- Packages --------------------------------
  const packages = waf.command('packages').description('Manage Legacy WAF Packages');

  packages
    .command('list')
    .description('List all legacy WAF packages')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL packages by auto-paging')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get a legacy WAF package details')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Update a legacy WAF package sensitivity / action / status')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .option('--sensitivity <sensitivity>', 'Sensitivity level (low, medium, high)')
    .option('--action-mode <mode>', 'Action mode (simulate, block, challenge)')
    .option('--status <status>', 'Status (on, off)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const groups = waf.command('groups').description('Manage Legacy WAF Groups');

  groups
    .command('list')
    .description('List WAF groups inside a package')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL groups by auto-paging')
    .option('-j, --json', 'Output as JSON')
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
          rules_count: g.rules_count || '-', modified_on: g.modified_on || '-',
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
    .description('Get a WAF group details')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .requiredOption('-g, --group-id <groupId>', 'Group ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
          rules_count: g.rules_count || '-', modified_on: g.modified_on || '-',
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
    .description('Enable all rules in a WAF group [DESTRUCTIVE — needs approval]')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .requiredOption('-g, --group-id <groupId>', 'Group ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Disable all rules in a WAF group [DESTRUCTIVE — needs approval]')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .requiredOption('-g, --group-id <groupId>', 'Group ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const rules = waf.command('rules').description('Manage Legacy WAF Rules');

  rules
    .command('list')
    .description('List WAF rules inside a package')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('--matches-on <matches>', 'Filter by matches (all, any)')
    .option('--mode <mode>', 'Filter by mode (on, off, default, disable)')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL rules by auto-paging')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get a WAF rule details')
    .requiredOption('-p, --package-id <packageId>', 'Package ID')
    .requiredOption('-r, --rule-id <ruleId>', 'Rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
      .description(`Set a WAF rule to ${modeMap[modeOp]} mode [DESTRUCTIVE — needs approval]`)
      .requiredOption('-p, --package-id <packageId>', 'Package ID')
      .requiredOption('-r, --rule-id <ruleId>', 'Rule ID')
      .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const rateLimits = waf.command('rate-limits').description('Manage WAF Rate Limiting Rules');

  rateLimits
    .command('list')
    .description('List all rate limiting rules')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL rate limit rules by auto-paging')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get a rate limiting rule details')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getRateLimit(options.id, options.zoneId);
        if (options.json) return formatJSON(result.result);
        const r = result.result;
        formatTable([{
          id: r.id, description: r.description || '-', threshold: r.threshold,
          period: r.period, action: (r.action && r.action.mode) || '-',
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
    .description('Create a rate limiting rule [DESTRUCTIVE — needs approval]')
    .requiredOption('-d, --description <description>', 'Rule description')
    .requiredOption('-t, --threshold <threshold>', 'Request threshold')
    .requiredOption('-p, --period <period>', 'Period in seconds (10-86400)')
    .requiredOption('--action <action>', 'Action (block, challenge, js_challenge, managed_challenge, log)')
    .option('--action-duration <duration>', 'Action duration in seconds')
    .option('--url-pattern <pattern>', 'URL pattern to match')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Update a rate limiting rule [DESTRUCTIVE — needs approval]')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('-d, --description <description>', 'Rule description')
    .option('-t, --threshold <threshold>', 'Request threshold')
    .option('-p, --period <period>', 'Period in seconds')
    .option('--action <action>', 'Action (block, challenge, js_challenge, managed_challenge, log)')
    .option('--disabled', 'Disable the rule')
    .option('--no-disabled', 'Enable the rule')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Delete a rate limiting rule [DESTRUCTIVE — needs approval]')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Enterprise WAF Rulesets Engine v2 (alias for `cfcli rulesets ...`)');
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
      .description('Fallback — rulesets module failed to load')
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
      .description('Use `cfcli rulesets list` instead (alias tip)')
      .action(() => {
        formatInfo('Tip: use the top-level `cfcli rulesets ...` command for full Rulesets v2 support.');
      });
  }
}

module.exports = wafCommands;
