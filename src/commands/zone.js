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
  const zone = program.command('zone').description('Manage Cloudflare Zones');

  zone
    .command('list')
    .description('List all zones accessible by the current API Token')
    .option('-j, --json', 'Output as JSON')
    .option('-s, --status <status>', 'Filter by status (active, pending, initializing, moved, deleted, deactivated)')
    .option('-n, --name <name>', 'Filter by zone name (contains match server-side)')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50, max 50)', '50')
    .option('--all', 'Fetch ALL zones by auto-paging through every page')
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
    .description('Get zone details (default: configured zoneId)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get effective zone settings (all known keys)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .option('-k, --key <key>', 'Show only a single setting by id (e.g. ssl)')
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
      'Update a single zone setting (ssl, always_use_https, security_level, …) '
      + '[DESTRUCTIVE — needs operator approval]',
    )
    .requiredOption('-n, --name <name>', 'Setting name (e.g. ssl, always_use_https)')
    .requiredOption('-v, --value <value>', 'Setting value (JSON or string). Use "true"/"false" for booleans')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
