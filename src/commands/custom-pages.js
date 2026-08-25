const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function customPagesCommands(program) {
  const cp = program.command('custom-pages').description('Manage Cloudflare Custom Pages');

  cp
    .command('list')
    .description('List all custom pages')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCustomPages(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(page => ({
            id: page.id,
            description: page.description || '-',
            state: page.state || '-',
            url: page.url || '-',
            created_on: page.created_on || '-',
            modified_on: page.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Description', accessor: 'description' },
            { header: 'State', accessor: 'state' },
            { header: 'URL', accessor: 'url' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
          formatSuccess(`Found ${data.length} custom page(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('get')
    .description('Get a custom page details')
    .requiredOption('-i, --id <id>', 'Custom page identifier (e.g., basic_challenge, waf_challenge, waf_block, ratelimit_block)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomPage(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const page = result.result;
          formatTable([{
            id: page.id,
            description: page.description || '-',
            state: page.state || '-',
            url: page.url || '-',
            preview_target: page.preview_target || '-',
            created_on: page.created_on || '-',
            modified_on: page.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Description', accessor: 'description' },
            { header: 'State', accessor: 'state' },
            { header: 'URL', accessor: 'url' },
            { header: 'Preview Target', accessor: 'preview_target' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('update')
    .description('Update a custom page URL')
    .requiredOption('-i, --id <id>', 'Custom page identifier (e.g., basic_challenge, waf_challenge, waf_block, ratelimit_block)')
    .requiredOption('--url <url>', 'Custom page URL')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateCustomPage(options.id, options.zoneId, {
          url: options.url
        });
        formatSuccess(`Custom page updated: ${result.result.id}`);
        formatInfo(`URL: ${result.result.url}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('preview')
    .description('Get preview URL for a custom page')
    .requiredOption('-i, --id <id>', 'Custom page identifier')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomPage(options.id, options.zoneId);
        if (result.result.preview_target) {
          formatInfo(`Preview URL: ${result.result.preview_target}`);
        } else {
          formatInfo('No preview URL available');
        }
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = customPagesCommands;
