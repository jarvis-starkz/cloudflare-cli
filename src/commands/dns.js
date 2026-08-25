const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatVerboseError,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

function dnsCommands(program) {
  const dns = program.command('dns').description('Manage DNS Records');

  dns
    .command('list')
    .description('List DNS records')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-t, --type <type>', 'Filter by record type enum:A,AAAA,CNAME,MX,TXT,SRV,NS,PTR,CAA')
    .option('-n, --name <name>', 'Filter by record name')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL records by auto-paging through every page')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.type) params.type = options.type;
        if (options.name) params.name = options.name;

        let records;
        if (options.all) {
          records = await client.paginatedList(
            (p) => client.listDnsRecords(options.zoneId, { ...params, ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listDnsRecords(options.zoneId, {
            ...params,
            page: Number(options.page),
            per_page: Number(options.perPage),
          });
          records = resp.result;
        }

        if (options.json) {
          formatJSON(records);
        } else {
          const data = records.map(record => ({
            id: record.id,
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied ? 'Yes' : 'No',
            ttl: record.ttl === 1 ? 'Auto' : record.ttl,
            priority: record.priority || '-',
          }));
          formatTable([
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Name', accessor: 'name' },
            { header: 'Content', accessor: 'content' },
            { header: 'Proxied', accessor: 'proxied' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Priority', accessor: 'priority' },
          ], data);
          formatSuccess(`Found ${data.length} record(s)`);
        }
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('get')
    .description('Get a DNS record by ID')
    .requiredOption('-i, --id <id>', 'DNS record ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getDnsRecord(options.id, options.zoneId);
        const record = result.result;
        if (options.json) {
          formatJSON(record);
        } else {
          formatTable([
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Name', accessor: 'name' },
            { header: 'Content', accessor: 'content' },
            { header: 'Proxied', accessor: 'proxied' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Priority', accessor: 'priority' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' },
          ], [{
            id: record.id,
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied ? 'Yes' : 'No',
            ttl: record.ttl === 1 ? 'Auto' : record.ttl,
            priority: record.priority || '-',
            created_on: record.created_on || '-',
            modified_on: record.modified_on || '-',
          }]);
        }
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('add')
    .description('Add a new DNS record')
    .requiredOption('-t, --type <type>', 'Record type (A, AAAA, CNAME, MX, TXT, SRV, etc.)')
    .requiredOption('-n, --name <name>', 'Record name (e.g., subdomain.example.com)')
    .requiredOption('-c, --content <content>', 'Record content (e.g., IP address)')
    .option('--ttl <ttl>', 'TTL in seconds (default: 1 for Auto)', '1')
    .option('--proxied', 'Enable Cloudflare proxy', false)
    .option('--priority <priority>', 'Priority for MX/SRV records')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const record = {
          type: options.type,
          name: options.name,
          content: options.content,
          ttl: parseInt(options.ttl, 10),
          proxied: options.proxied,
        };
        if (options.priority) record.priority = parseInt(options.priority, 10);
        const result = await client.createDnsRecord(record, options.zoneId);
        formatSuccess(`DNS record created: ${result.result.name} -> ${result.result.content}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('update')
    .description('Update an existing DNS record')
    .requiredOption('-i, --id <id>', 'DNS record ID')
    .requiredOption('-t, --type <type>', 'Record type enum:A,AAAA,CNAME,MX,TXT,SRV,NS,PTR,CAA')
    .requiredOption('-n, --name <name>', 'Record name')
    .requiredOption('-c, --content <content>', 'Record content')
    .option('--ttl <ttl>', 'TTL in seconds (default: 1 for Auto)', '1')
    .option('--proxied', 'Enable Cloudflare proxy', false)
    .option('--no-proxied', 'Disable Cloudflare proxy')
    .option('--priority <priority>', 'Priority for MX/SRV records')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const record = {
          type: options.type,
          name: options.name,
          content: options.content,
          ttl: parseInt(options.ttl, 10),
        };
        if (options.proxied !== undefined) record.proxied = options.proxied;
        if (options.priority) record.priority = parseInt(options.priority, 10);
        const result = await client.updateDnsRecord(options.id, record, options.zoneId);
        formatSuccess(`DNS record updated: ${result.result.name} -> ${result.result.content}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('delete')
    .description('Delete a DNS record')
    .requiredOption('-i, --id <id>', 'DNS record ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive delete in TTY mode without confirmation. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed (CI auto-skips this check).',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteDnsRecord(options.id, options.zoneId);
        formatSuccess(`DNS record deleted: ${result.result.id}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('bulk-delete')
    .description('⚠ Delete multiple DNS records by type and/or name')
    .option('-t, --type <type>', 'Delete records by type')
    .option('-n, --name <name>', 'Delete records by name (supports partial match)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive bulk-delete in TTY mode without confirmation. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed (CI auto-skips this check).',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        if (!options.type && !options.name) {
          formatError('Please specify --type or --name to filter records');
          return;
        }
        const params = {};
        if (options.type) params.type = options.type;
        if (options.name) params.name = options.name;

        // Use paginated list (getAll) so we never miss records on > 1 page.
        const records = await client.paginatedList(
          (p) => client.listDnsRecords(options.zoneId, { ...params, ...p }),
          { getAll: true },
        );

        if (records.length === 0) {
          formatError('No matching records found');
          return;
        }
        for (const record of records) {
          await client.deleteDnsRecord(record.id, options.zoneId);
        }
        formatSuccess(`Deleted ${records.length} record(s)`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });
}

module.exports = dnsCommands;
