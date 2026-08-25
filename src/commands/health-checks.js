const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function healthChecksCommands(program) {
  const hc = program.command('health-checks').description('Manage Cloudflare Health Checks (Enterprise)');

  hc
    .command('list')
    .description('List all health checks')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listHealthChecks(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(hc => ({
            id: hc.id,
            name: hc.name || '-',
            description: hc.description || '-',
            address: hc.address || '-',
            suspended: hc.suspended ? 'Yes' : 'No',
            healthy: hc.healthy ? 'Yes' : 'No',
            type: hc.type || '-',
            interval: hc.check_regions?.length || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Address', accessor: 'address' },
            { header: 'Type', accessor: 'type' },
            { header: 'Suspended', accessor: 'suspended' },
            { header: 'Healthy', accessor: 'healthy' }
          ]);
          formatSuccess(`Found ${data.length} health check(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  hc
    .command('get')
    .description('Get a health check details')
    .requiredOption('-i, --id <id>', 'Health check ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getHealthCheck(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const hc = result.result;
          formatTable([{
            id: hc.id,
            name: hc.name || '-',
            description: hc.description || '-',
            address: hc.address || '-',
            type: hc.type || '-',
            port: hc.port || '-',
            path: hc.path || '/',
            method: hc.method || '-',
            expected_codes: hc.expected_codes || '-',
            interval: hc.interval || '-',
            timeout: hc.timeout || '-',
            retries: hc.retries || '-',
            suspended: hc.suspended ? 'Yes' : 'No',
            healthy: hc.healthy ? 'Yes' : 'No'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Address', accessor: 'address' },
            { header: 'Type', accessor: 'type' },
            { header: 'Port', accessor: 'port' },
            { header: 'Path', accessor: 'path' },
            { header: 'Method', accessor: 'method' },
            { header: 'Interval', accessor: 'interval' },
            { header: 'Suspended', accessor: 'suspended' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  hc
    .command('create')
    .description('Create a new health check')
    .requiredOption('-n, --name <name>', 'Health check name')
    .requiredOption('-a, --address <address>', 'Address to check (hostname or IP)')
    .option('-t, --type <type>', 'Type (http, https, tcp, ping, smtp, udp_icmp, icmp)', 'http')
    .option('--description <description>', 'Description')
    .option('--port <port>', 'Port number', '80')
    .option('--path <path>', 'Path to check', '/')
    .option('--method <method>', 'HTTP method', 'GET')
    .option('--expected-codes <codes>', 'Expected HTTP codes', '200')
    .option('--interval <interval>', 'Check interval in seconds', '60')
    .option('--timeout <timeout>', 'Timeout in seconds', '5')
    .option('--retries <retries>', 'Retries before marking unhealthy', '2')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          address: options.address,
          type: options.type,
          port: parseInt(options.port, 10),
          path: options.path,
          method: options.method,
          expected_codes: options.expectedCodes,
          interval: parseInt(options.interval, 10),
          timeout: parseInt(options.timeout, 10),
          retries: parseInt(options.retries, 10)
        };
        if (options.description) data.description = options.description;

        const result = await client.createHealthCheck(options.zoneId, data);
        formatSuccess(`Health check created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  hc
    .command('update')
    .description('Update a health check')
    .requiredOption('-i, --id <id>', 'Health check ID')
    .option('-n, --name <name>', 'Health check name')
    .option('-a, --address <address>', 'Address to check')
    .option('-t, --type <type>', 'Type')
    .option('--description <description>', 'Description')
    .option('--port <port>', 'Port number')
    .option('--path <path>', 'Path to check')
    .option('--method <method>', 'HTTP method')
    .option('--interval <interval>', 'Check interval')
    .option('--timeout <timeout>', 'Timeout')
    .option('--retries <retries>', 'Retries')
    .option('--suspend', 'Suspend the health check')
    .option('--no-suspend', 'Resume the health check')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.address) data.address = options.address;
        if (options.type) data.type = options.type;
        if (options.port) data.port = parseInt(options.port, 10);
        if (options.path) data.path = options.path;
        if (options.method) data.method = options.method;
        if (options.interval) data.interval = parseInt(options.interval, 10);
        if (options.timeout) data.timeout = parseInt(options.timeout, 10);
        if (options.retries) data.retries = parseInt(options.retries, 10);
        if (options.description) data.description = options.description;
        if (options.suspend !== undefined) data.suspended = options.suspend;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateHealthCheck(options.id, options.zoneId, data);
        formatSuccess(`Health check updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  hc
    .command('delete')
    .description('Delete a health check')
    .requiredOption('-i, --id <id>', 'Health check ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteHealthCheck(options.id, options.zoneId);
        formatSuccess(`Health check deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = healthChecksCommands;
