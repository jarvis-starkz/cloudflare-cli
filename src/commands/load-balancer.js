const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function loadBalancerCommands(program) {
  const lb = program.command('load-balancer').description('Manage Cloudflare Load Balancer (Enterprise)');

  // Load Balancers
  lb
    .command('list')
    .description('List all load balancers')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listLoadBalancers(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(lb => ({
            id: lb.id,
            name: lb.name,
            description: lb.description || '-',
            enabled: lb.enabled ? 'Yes' : 'No',
            ttl: lb.ttl || '-',
            fallback_pool: lb.fallback_pool || '-',
            default_pools: lb.default_pools?.join(', ') || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Fallback Pool', accessor: 'fallback_pool' },
            { header: 'Default Pools', accessor: 'default_pools' }
          ]);
          formatSuccess(`Found ${data.length} load balancer(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  lb
    .command('get')
    .description('Get a load balancer details')
    .requiredOption('-i, --id <id>', 'Load balancer ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getLoadBalancer(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const lb = result.result;
          formatTable([{
            id: lb.id,
            name: lb.name,
            description: lb.description || '-',
            enabled: lb.enabled ? 'Yes' : 'No',
            ttl: lb.ttl || '-',
            fallback_pool: lb.fallback_pool || '-',
            default_pools: lb.default_pools?.join(', ') || '-',
            steering_policy: lb.steering_policy || '-',
            created_on: lb.created_on || '-',
            modified_on: lb.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Fallback Pool', accessor: 'fallback_pool' },
            { header: 'Default Pools', accessor: 'default_pools' },
            { header: 'Steering Policy', accessor: 'steering_policy' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  lb
    .command('create')
    .description('Create a new load balancer')
    .requiredOption('-n, --name <name>', 'Load balancer name (FQDN)')
    .requiredOption('--fallback-pool <poolId>', 'Fallback pool ID')
    .requiredOption('--default-pools <pools...>', 'Default pool IDs')
    .option('--description <description>', 'Description')
    .option('--ttl <ttl>', 'TTL', '30')
    .option('--steering <policy>', 'Steering policy (off, geo, random, dynamic_latency, proximity)')
    .option('--enabled', 'Enable the load balancer', true)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          fallback_pool: options.fallbackPool,
          default_pools: options.defaultPools,
          ttl: parseInt(options.ttl, 10),
          enabled: options.enabled
        };
        if (options.description) data.description = options.description;
        if (options.steering) data.steering_policy = options.steering;

        const result = await client.createLoadBalancer(options.zoneId, data);
        formatSuccess(`Load balancer created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  lb
    .command('update')
    .description('Update a load balancer')
    .requiredOption('-i, --id <id>', 'Load balancer ID')
    .option('-n, --name <name>', 'Load balancer name')
    .option('--fallback-pool <poolId>', 'Fallback pool ID')
    .option('--default-pools <pools...>', 'Default pool IDs')
    .option('--description <description>', 'Description')
    .option('--ttl <ttl>', 'TTL')
    .option('--steering <policy>', 'Steering policy')
    .option('--enabled', 'Enable the load balancer', true)
    .option('--no-enabled', 'Disable the load balancer', false)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.fallbackPool) data.fallback_pool = options.fallbackPool;
        if (options.defaultPools) data.default_pools = options.defaultPools;
        if (options.ttl) data.ttl = parseInt(options.ttl, 10);
        if (options.enabled !== undefined) data.enabled = options.enabled;
        if (options.description) data.description = options.description;
        if (options.steering) data.steering_policy = options.steering;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateLoadBalancer(options.id, options.zoneId, data);
        formatSuccess(`Load balancer updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  lb
    .command('delete')
    .description('Delete a load balancer')
    .requiredOption('-i, --id <id>', 'Load balancer ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteLoadBalancer(options.id, options.zoneId);
        formatSuccess(`Load balancer deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Pools
  const pools = lb.command('pools').description('Manage Load Balancer Pools');

  pools
    .command('list')
    .description('List all pools')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listLoadBalancerPools();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(pool => ({
            id: pool.id,
            name: pool.name,
            description: pool.description || '-',
            enabled: pool.enabled ? 'Yes' : 'No',
            origins: pool.origins?.length || 0,
            monitor: pool.monitor || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Origins', accessor: 'origins' },
            { header: 'Monitor', accessor: 'monitor' }
          ]);
          formatSuccess(`Found ${data.length} pool(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  pools
    .command('get')
    .description('Get a pool details')
    .requiredOption('-i, --id <id>', 'Pool ID')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getLoadBalancerPool(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const pool = result.result;
          formatTable([{
            id: pool.id,
            name: pool.name,
            description: pool.description || '-',
            enabled: pool.enabled ? 'Yes' : 'No',
            origins: pool.origins?.map(o => o.name).join(', ') || '-',
            monitor: pool.monitor || '-',
            notification_email: pool.notification_email || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Origins', accessor: 'origins' },
            { header: 'Monitor', accessor: 'monitor' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  pools
    .command('create')
    .description('Create a new pool')
    .requiredOption('-n, --name <name>', 'Pool name')
    .requiredOption('--origins <origins...>', 'Origin server addresses')
    .option('--description <description>', 'Description')
    .option('--monitor <monitorId>', 'Health check monitor ID')
    .option('--enabled', 'Enable the pool', true)
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          origins: options.origins.map(origin => ({ name: origin, address: origin, enabled: true })),
          enabled: options.enabled
        };
        if (options.description) data.description = options.description;
        if (options.monitor) data.monitor = options.monitor;

        const result = await client.createLoadBalancerPool(data);
        formatSuccess(`Pool created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pools
    .command('update')
    .description('Update a pool')
    .requiredOption('-i, --id <id>', 'Pool ID')
    .option('-n, --name <name>', 'Pool name')
    .option('--origins <origins...>', 'Origin server addresses')
    .option('--description <description>', 'Description')
    .option('--monitor <monitorId>', 'Health check monitor ID')
    .option('--enabled', 'Enable the pool', true)
    .option('--no-enabled', 'Disable the pool', false)
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.origins) data.origins = options.origins.map(origin => ({ name: origin, address: origin, enabled: true }));
        if (options.description) data.description = options.description;
        if (options.monitor) data.monitor = options.monitor;
        if (options.enabled !== undefined) data.enabled = options.enabled;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateLoadBalancerPool(options.id, data);
        formatSuccess(`Pool updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  pools
    .command('delete')
    .description('Delete a pool')
    .requiredOption('-i, --id <id>', 'Pool ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteLoadBalancerPool(options.id);
        formatSuccess(`Pool deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Monitors
  const monitors = lb.command('monitors').description('Manage Load Balancer Monitors');

  monitors
    .command('list')
    .description('List all monitors')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listLoadBalancerMonitors();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(monitor => ({
            id: monitor.id,
            type: monitor.type || '-',
            description: monitor.description || '-',
            method: monitor.method || '-',
            path: monitor.path || '/',
            expected_codes: monitor.expected_codes || '-',
            timeout: monitor.timeout || '-',
            interval: monitor.interval || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Description', accessor: 'description' },
            { header: 'Method', accessor: 'method' },
            { header: 'Path', accessor: 'path' },
            { header: 'Expected Codes', accessor: 'expected_codes' },
            { header: 'Timeout', accessor: 'timeout' },
            { header: 'Interval', accessor: 'interval' }
          ]);
          formatSuccess(`Found ${data.length} monitor(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  monitors
    .command('get')
    .description('Get a monitor details')
    .requiredOption('-i, --id <id>', 'Monitor ID')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getLoadBalancerMonitor(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const monitor = result.result;
          formatTable([{
            id: monitor.id,
            type: monitor.type || '-',
            description: monitor.description || '-',
            method: monitor.method || '-',
            path: monitor.path || '/',
            expected_codes: monitor.expected_codes || '-',
            timeout: monitor.timeout || '-',
            interval: monitor.interval || '-',
            retries: monitor.retries || '-',
            consecutive_up: monitor.consecutive_up || '-',
            consecutive_down: monitor.consecutive_down || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Description', accessor: 'description' },
            { header: 'Method', accessor: 'method' },
            { header: 'Path', accessor: 'path' },
            { header: 'Expected Codes', accessor: 'expected_codes' },
            { header: 'Timeout', accessor: 'timeout' },
            { header: 'Interval', accessor: 'interval' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  monitors
    .command('create')
    .description('Create a new monitor')
    .requiredOption('-t, --type <type>', 'Monitor type (http, https, tcp, ping, smtp, udp_icmp, icmp)')
    .option('--description <description>', 'Description')
    .option('--method <method>', 'HTTP method (GET, POST, etc.)', 'GET')
    .option('--path <path>', 'Path to check', '/')
    .option('--expected-codes <codes>', 'Expected HTTP codes', '200')
    .option('--timeout <timeout>', 'Timeout in seconds', '5')
    .option('--interval <interval>', 'Check interval in seconds', '60')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          type: options.type,
          method: options.method,
          path: options.path,
          expected_codes: options.expectedCodes,
          timeout: parseInt(options.timeout, 10),
          interval: parseInt(options.interval, 10)
        };
        if (options.description) data.description = options.description;

        const result = await client.createLoadBalancerMonitor(data);
        formatSuccess(`Monitor created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  monitors
    .command('update')
    .description('Update a monitor')
    .requiredOption('-i, --id <id>', 'Monitor ID')
    .option('-t, --type <type>', 'Monitor type')
    .option('--description <description>', 'Description')
    .option('--method <method>', 'HTTP method')
    .option('--path <path>', 'Path to check')
    .option('--expected-codes <codes>', 'Expected HTTP codes')
    .option('--timeout <timeout>', 'Timeout in seconds')
    .option('--interval <interval>', 'Check interval in seconds')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.type) data.type = options.type;
        if (options.method) data.method = options.method;
        if (options.path) data.path = options.path;
        if (options.expectedCodes) data.expected_codes = options.expectedCodes;
        if (options.timeout) data.timeout = parseInt(options.timeout, 10);
        if (options.interval) data.interval = parseInt(options.interval, 10);
        if (options.description) data.description = options.description;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateLoadBalancerMonitor(options.id, data);
        formatSuccess(`Monitor updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  monitors
    .command('delete')
    .description('Delete a monitor')
    .requiredOption('-i, --id <id>', 'Monitor ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteLoadBalancerMonitor(options.id);
        formatSuccess(`Monitor deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = loadBalancerCommands;
