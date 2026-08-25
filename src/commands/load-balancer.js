const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 负载均衡器命令
 *
 * 功能说明：管理 Cloudflare 负载均衡器，提供流量分发、健康检查和故障转移功能。
 * 负载均衡器将入站流量智能分配到多个源站池（Pool），支持基于地理位置、
 * 延迟和随机等多种流量导向策略，确保高可用性和最佳性能。
 *
 * 使用场景：
 * - 在多个源站服务器之间分配流量
 * - 配置健康检查以自动移除故障源站
 * - 设置地理负载均衡以就近服务用户
 * - 配置故障转移以实现高可用性
 * - 监控源站池健康状态
 */
function loadBalancerCommands(program) {
  const lb = program.command('load-balancer').description('管理 Cloudflare Load Balancer（企业级流量分发，支持健康检查、地理路由和故障转移）');

  // Load Balancers
  lb
    .command('list')
    .description('列出所有负载均衡器 - 显示区域下配置的所有负载均衡器及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('获取负载均衡器详情 - 查看特定负载均衡器的详细配置信息，包括流量导向策略和源站池配置')
    .requiredOption('-i, --id <id>', '负载均衡器 ID（Load Balancer ID），指定要查询的负载均衡器')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的负载均衡器 - 配置新的流量分发负载均衡器，指定源站池和流量导向策略')
    .requiredOption('-n, --name <name>', '负载均衡器名称（FQDN，例如：lb.example.com），作为负载均衡器的 DNS 名称')
    .requiredOption('--fallback-pool <poolId>', '故障转移源站池 ID，当所有默认源站池不可用时使用的备用池')
    .requiredOption('--default-pools <pools...>', '默认源站池 ID 列表（一个或多个），负载均衡器将流量分配到的源站池')
    .option('--description <description>', '负载均衡器描述，用于标识和说明负载均衡器的用途')
    .option('--ttl <ttl>', 'DNS 生存时间（秒），控制 DNS 记录的缓存时间', '30')
    .option('--steering <policy>', '流量导向策略（off 关闭, geo 地理, random 随机, dynamic_latency 动态延迟, proximity 邻近），决定如何选择源站池')
    .option('--enabled', '启用负载均衡器，使其开始处理流量', true)
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('更新负载均衡器 - 修改现有负载均衡器的配置设置，包括源站池、流量导向策略等')
    .requiredOption('-i, --id <id>', '负载均衡器 ID（Load Balancer ID），指定要更新的负载均衡器')
    .option('-n, --name <name>', '负载均衡器名称（FQDN），修改负载均衡器的 DNS 名称')
    .option('--fallback-pool <poolId>', '故障转移源站池 ID，修改备用源站池')
    .option('--default-pools <pools...>', '默认源站池 ID 列表，修改流量分配的目标源站池')
    .option('--description <description>', '负载均衡器描述，修改描述信息')
    .option('--ttl <ttl>', 'DNS 生存时间（秒），修改 DNS 记录的缓存时间')
    .option('--steering <policy>', '流量导向策略，修改流量分配策略')
    .option('--enabled', '启用负载均衡器', true)
    .option('--no-enabled', '禁用负载均衡器', false)
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('删除负载均衡器 - 移除负载均衡器，删除后该 DNS 名称将不再进行流量分发')
    .requiredOption('-i, --id <id>', '负载均衡器 ID（Load Balancer ID），指定要删除的负载均衡器')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
  const pools = lb.command('pools').description('管理负载均衡器源站池 - 配置和管理流量分配的后端服务器池');

  pools
    .command('list')
    .description('列出所有源站池 - 显示账户下配置的所有源站池及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
            origins: (Array.isArray(pool.origins) && pool.origins.length > 0) ? pool.origins.length : '-',
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
    .description('获取源站池详情 - 查看特定源站池的详细配置信息，包括源服务器和健康检查设置')
    .requiredOption('-i, --id <id>', '源站池 ID（Pool ID），指定要查询的源站池')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的源站池 - 配置新的后端服务器池，定义源服务器地址和健康检查设置')
    .requiredOption('-n, --name <name>', '源站池名称，用于标识和管理源站池')
    .requiredOption('--origins <origins...>', '源服务器地址列表（例如：192.168.1.1, 192.168.1.2），指定后端服务器地址')
    .option('--description <description>', '源站池描述，用于说明源站池的用途')
    .option('--monitor <monitorId>', '健康检查监视器 ID，指定用于监控源服务器健康状态的检查器')
    .option('--enabled', '启用源站池，使其参与流量分配', true)
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
    .description('更新源站池 - 修改现有源站池的配置设置，包括源服务器列表和健康检查')
    .requiredOption('-i, --id <id>', '源站池 ID（Pool ID），指定要更新的源站池')
    .option('-n, --name <name>', '源站池名称，修改源站池的标识名称')
    .option('--origins <origins...>', '源服务器地址列表，修改后端服务器地址')
    .option('--description <description>', '源站池描述，修改描述信息')
    .option('--monitor <monitorId>', '健康检查监视器 ID，修改健康检查设置')
    .option('--enabled', '启用源站池', true)
    .option('--no-enabled', '禁用源站池', false)
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
    .description('删除源站池 - 移除源站池，删除后该池将不再参与流量分配')
    .requiredOption('-i, --id <id>', '源站池 ID（Pool ID），指定要删除的源站池')
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
  const monitors = lb.command('monitors').description('管理负载均衡器监视器 - 配置和管理源服务器健康检查');

  monitors
    .command('list')
    .description('列出所有监视器 - 显示账户下配置的所有健康检查监视器及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('获取监视器详情 - 查看特定健康检查监视器的详细配置信息')
    .requiredOption('-i, --id <id>', '监视器 ID（Monitor ID），指定要查询的监视器')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的监视器 - 配置新的健康检查监视器，用于监控源服务器的可用性和响应时间')
    .requiredOption('-t, --type <type>', '监视器类型（http, https, tcp, ping, smtp, udp_icmp, icmp），指定健康检查的协议类型')
    .option('--description <description>', '监视器描述，用于说明监视器的用途')
    .option('--method <method>', 'HTTP 请求方法（GET, POST 等），用于 HTTP/HTTPS 类型监视器', 'GET')
    .option('--path <path>', '检查路径，用于 HTTP/HTTPS 类型监视器', '/')
    .option('--expected-codes <codes>', '预期 HTTP 状态码，用于判断源服务器是否健康', '200')
    .option('--timeout <timeout>', '超时时间（秒），等待源服务器响应的最大时间', '5')
    .option('--interval <interval>', '检查间隔（秒），两次健康检查之间的时间间隔', '60')
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
    .description('更新监视器 - 修改现有健康检查监视器的配置设置')
    .requiredOption('-i, --id <id>', '监视器 ID（Monitor ID），指定要更新的监视器')
    .option('-t, --type <type>', '监视器类型，修改健康检查的协议类型')
    .option('--description <description>', '监视器描述，修改描述信息')
    .option('--method <method>', 'HTTP 请求方法，修改 HTTP/HTTPS 类型监视器的请求方法')
    .option('--path <path>', '检查路径，修改 HTTP/HTTPS 类型监视器的检查路径')
    .option('--expected-codes <codes>', '预期 HTTP 状态码，修改健康判断标准')
    .option('--timeout <timeout>', '超时时间（秒），修改等待响应的最大时间')
    .option('--interval <interval>', '检查间隔（秒），修改两次健康检查之间的时间间隔')
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
    .description('删除监视器 - 移除健康检查监视器，删除后将停止对关联源站池的健康检查')
    .requiredOption('-i, --id <id>', '监视器 ID（Monitor ID），指定要删除的监视器')
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
