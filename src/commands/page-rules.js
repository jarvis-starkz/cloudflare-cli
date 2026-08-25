const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function pageRulesCommands(program) {
  const pr = program.command('page-rules').description('Manage Cloudflare Page Rules (Enterprise)');

  pr
    .command('list')
    .description('List all page rules')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-s, --status <status>', 'Filter by status (active, disabled)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.status) params.status = options.status;

        const result = await client.listPageRules(options.zoneId, params);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(rule => ({
            id: rule.id,
            targets: rule.targets?.map(t => t.constraint?.value).join(', ') || '-',
            actions: rule.actions?.map(a => `${a.id}=${a.value}`).join(', ') || '-',
            status: rule.status,
            priority: rule.priority || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Targets', accessor: 'targets' },
            { header: 'Actions', accessor: 'actions' },
            { header: 'Status', accessor: 'status' },
            { header: 'Priority', accessor: 'priority' }
          ]);
          formatSuccess(`Found ${data.length} page rule(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('get')
    .description('Get a page rule details')
    .requiredOption('-i, --id <id>', 'Page rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getPageRule(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const rule = result.result;
          formatTable([{
            id: rule.id,
            targets: rule.targets?.map(t => t.constraint?.value).join(', ') || '-',
            actions: rule.actions?.map(a => `${a.id}=${a.value}`).join(', ') || '-',
            status: rule.status,
            priority: rule.priority || '-',
            created_on: rule.created_on || '-',
            modified_on: rule.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Targets', accessor: 'targets' },
            { header: 'Actions', accessor: 'actions' },
            { header: 'Status', accessor: 'status' },
            { header: 'Priority', accessor: 'priority' },
            { header: 'Created', accessor: 'created_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('create')
    .description('Create a new page rule')
    .requiredOption('--target <pattern>', 'URL pattern to match (e.g., "example.com/*")')
    .requiredOption('--action <action>', 'Action (always_use_https, cache_level, forwarding_url, etc.)')
    .requiredOption('--value <value>', 'Action value')
    .option('--priority <priority>', 'Priority (lower number = higher priority)')
    .option('--status <status>', 'Status (active, disabled)', 'active')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          targets: [{ constraint: { operator: 'matches', value: options.target } }],
          actions: [{ id: options.action, value: options.value }],
          status: options.status
        };
        if (options.priority) data.priority = parseInt(options.priority, 10);

        const result = await client.createPageRule(options.zoneId, data);
        formatSuccess(`Page rule created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('update')
    .description('Update a page rule')
    .requiredOption('-i, --id <id>', 'Page rule ID')
    .option('--target <pattern>', 'URL pattern to match')
    .option('--action <action>', 'Action')
    .option('--value <value>', 'Action value')
    .option('--priority <priority>', 'Priority')
    .option('--status <status>', 'Status (active, disabled)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.target) data.targets = [{ constraint: { operator: 'matches', value: options.target } }];
        if (options.action) data.actions = [{ id: options.action, value: options.value }];
        if (options.status) data.status = options.status;
        if (options.priority) data.priority = parseInt(options.priority, 10);

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updatePageRule(options.id, options.zoneId, data);
        formatSuccess(`Page rule updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('delete')
    .description('Delete a page rule')
    .requiredOption('-i, --id <id>', 'Page rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deletePageRule(options.id, options.zoneId);
        formatSuccess(`Page rule deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('enable')
    .description('Enable a page rule')
    .requiredOption('-i, --id <id>', 'Page rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updatePageRule(options.id, options.zoneId, { status: 'active' });
        formatSuccess(`Page rule enabled: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pr
    .command('disable')
    .description('Disable a page rule')
    .requiredOption('-i, --id <id>', 'Page rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updatePageRule(options.id, options.zoneId, { status: 'disabled' });
        formatSuccess(`Page rule disabled: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = pageRulesCommands;
