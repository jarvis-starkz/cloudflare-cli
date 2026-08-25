/**
 * WAF Rulesets Engine (v2) commands.
 *
 * Reference (Cloudflare docs via MCP):
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
    throw new Error(`${onFailMessage}: ${e.message}`);
  }
}

function rulesetsCommands(program) {
  const rs = program.command('rulesets').description(
    'Manage WAF Rulesets Engine (v2) — replaces legacy waf packages/groups/rules API',
  );

  // ---------- rulesets list / get / create / update / delete ----------
  rs.command('list')
    .description('List zone rulesets (use --phase to filter)')
    .option('-z, --zone-id <zoneId>', 'Zone ID')
    .option('--phase <phase>', `Filter by phase (e.g. http_request_firewall_custom). Known: ${VALID_PHASES.join(', ')}`)
    .option('--all', 'Auto-paginate through all pages')
    .option('--page <N>', 'Page number (default 1)', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('-j, --json', 'Output as JSON')
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
          { header: 'Name', accessor: 'name' },
          { header: 'Kind', accessor: 'kind' },
          { header: 'Phase', accessor: 'phase' },
          { header: 'Version', accessor: 'version' },
          { header: 'Rules', accessor: r => (Array.isArray(r.rules) ? r.rules.length : 0) },
        ], result.map(r => ({ ...r })));
        formatSuccess(`Found ${result.length} ruleset(s)`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('get <rulesetId>')
    .description('Get a single zone ruleset (including rules)')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .option('-j, --json', 'Output as JSON')
    .action(async (rulesetId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const r = await client.getZoneRuleset(rulesetId, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatInfo(`Ruleset ${rulesetId}:`);
        formatJSON(r.result);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('create')
    .description('Create a new zone ruleset')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .requiredOption('--name <name>', 'Ruleset name')
    .requiredOption('--kind <kind>', 'Ruleset kind: zone, custom')
    .requiredOption('--phase <phase>', `Ruleset phase. Examples: ${VALID_PHASES.slice(0, 5).join(', ')}`)
    .option('--description <desc>', 'Free-form description')
    .option('--rules-file <path>', 'Path to a JSON file with an array of rules')
    .option('-j, --json', 'Output as JSON')
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
          body.rules = readJSONFile(options.rulesFile, '--rules-file must contain valid JSON');
          if (!Array.isArray(body.rules)) throw new Error('--rules-file JSON must be an array of rule objects');
        }
        const r = await client.createZoneRuleset(body, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`Created ruleset ${r.result.id} (${r.result.name})`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('update <rulesetId>')
    .description('Update a zone ruleset (PUT)')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .option('--name <name>', 'Ruleset name')
    .option('--description <desc>', 'Free-form description')
    .option('--rules-file <path>', 'Replace rules with JSON array in file')
    .option('-j, --json', 'Output as JSON')
    .action(async (rulesetId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const existing = await client.getZoneRuleset(rulesetId, options.zoneId);
        const body = { ...existing.result };
        if (options.name) body.name = options.name;
        if (options.description) body.description = options.description;
        if (options.rulesFile) {
          body.rules = readJSONFile(options.rulesFile, '--rules-file must contain valid JSON');
          if (!Array.isArray(body.rules)) throw new Error('--rules-file JSON must be an array');
        }
        const r = await client.updateZoneRuleset(rulesetId, body, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`Ruleset ${rulesetId} updated`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rs.command('delete <rulesetId>')
    .description('⚠ Delete a zone ruleset')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .action(async (rulesetId, options) => {
      try {
        // Destructive-confirmation guard handled via util.
        // eslint-disable-next-line global-require
        const { isDestructiveConfirmed } = require('../utils/config');
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive ruleset delete in TTY mode. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed (CI auto-skips).',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        await client.deleteZoneRuleset(rulesetId, options.zoneId);
        formatSuccess(`Ruleset ${rulesetId} deleted`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  // ---------- entrypoint subcommand ----------
  const ep = rs.command('entrypoint').description('Get/update entry-point ruleset for a phase');
  ep.command('get')
    .description('Get entrypoint ruleset of a phase')
    .requiredOption('--phase <phase>', `Phase (e.g. http_request_firewall_custom)`)
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const r = await client.getZoneEntrypoint(options.phase, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatInfo(`Entrypoint ruleset for phase ${options.phase}:`);
        formatJSON(r.result);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  ep.command('update')
    .description('Replace all rules in a phase entry-point')
    .requiredOption('--phase <phase>', 'Phase name')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .requiredOption('--rules-file <path>', 'JSON file with rules array (PUT body rules key)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const rules = readJSONFile(options.rulesFile, '--rules-file must contain valid JSON');
        if (!Array.isArray(rules)) throw new Error('--rules-file JSON must be an array of rule objects');
        const r = await client.updateZoneEntrypoint(
          options.phase,
          { description: `cfcli entrypoint update @ ${new Date().toISOString()}`, rules },
          options.zoneId,
        );
        if (options.json) return formatJSON(r.result);
        formatSuccess(`Entrypoint phase=${options.phase} updated — ${rules.length} rule(s)`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  // ---------- rule subcommand (single rule CRUD within a ruleset or entrypoint) ----------
  const rule = rs.command('rule').description('Manipulate individual rules inside a ruleset');

  rule.command('create')
    .description('Append a rule to a ruleset')
    .requiredOption('--ruleset-id <rulesetId>', 'Target ruleset ID (or "entrypoint:<phase>")')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .requiredOption('--expression <expr>', 'WAF filter expression')
    .requiredOption('--action <action>',
      'Action: block, challenge, js_challenge, managed_challenge, log, skip, rewrite, redirect, set_cache_settings, etc.')
    .option('--description <desc>', 'Rule description')
    .option('--action-params <json>', 'action_parameters object literal (JSON string)')
    .option('--enabled <true|false>', 'Enable/disable the rule', 'true')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let actionParams = undefined;
        if (options.actionParams) {
          try { actionParams = JSON.parse(options.actionParams); }
          catch (e) { throw new Error(`--action-params parse error: ${e.message}`); }
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
        formatSuccess(`Rule ${result.result.id} created (action=${result.result.action})`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rule.command('update <ruleId>')
    .description('Patch an individual rule')
    .requiredOption('--ruleset-id <rulesetId>', 'Target ruleset ID')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .option('--expression <expr>', 'Replacement filter expression')
    .option('--action <action>', 'Replacement action')
    .option('--action-params <json>', 'Replacement action_parameters (JSON)')
    .option('--enabled <true|false>', 'Enable/disable the rule')
    .option('-j, --json', 'Output as JSON')
    .action(async (ruleId, options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const patch = {};
        if (options.expression !== undefined) patch.expression = options.expression;
        if (options.action !== undefined) patch.action = options.action;
        if (options.enabled !== undefined) patch.enabled = options.enabled !== 'false';
        if (options.actionParams) {
          try { patch.action_parameters = JSON.parse(options.actionParams); }
          catch (e) { throw new Error(`--action-params parse error: ${e.message}`); }
        }
        const r = await client.updateRulesetRule(options.rulesetId, ruleId, patch, options.zoneId);
        if (options.json) return formatJSON(r.result);
        formatSuccess(`Rule ${ruleId} updated`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });

  rule.command('delete <ruleId>')
    .description('⚠ Delete an individual rule')
    .requiredOption('--ruleset-id <rulesetId>', 'Target ruleset ID')
    .requiredOption('-z, --zone-id <zoneId>', 'Zone ID')
    .action(async (ruleId, options) => {
      try {
        // eslint-disable-next-line global-require
        const { isDestructiveConfirmed } = require('../utils/config');
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive rule delete in TTY mode. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed.',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        await client.deleteRulesetRule(options.rulesetId, ruleId, options.zoneId);
        formatSuccess(`Rule ${ruleId} deleted`);
      } catch (e) { formatVerboseError(e, program.opts().verbose); }
    });
}

module.exports = rulesetsCommands;
