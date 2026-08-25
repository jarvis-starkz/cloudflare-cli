const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 健康检查命令
 *
 * 功能说明：管理 Cloudflare Health Checks，监控源站服务器的可用性和响应性能。
 * 健康检查定期探测源站服务器，自动检测故障并触发流量切换，
 * 确保负载均衡器只将流量路由到健康的源站。
 *
 * 使用场景：
 * - 监控 Web 服务器可用性
 * - 检测源站故障并自动切换流量
 * - 配置不同协议的健康检查（HTTP/HTTPS/TCP/ICMP 等）
 * - 设置检查区域以模拟不同地理位置的用户访问
 * - 监控 SMTP、数据库等服务的健康状态
 */
function healthChecksCommands(program) {
  const hc = program.command('health-checks').description('管理 Cloudflare Health Checks（企业级源站监控，支持多协议健康检测和自动故障切换）');

  hc
    .command('list')
    .description('列出所有健康检查 - 显示区域下配置的所有健康检查及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
            interval: (Array.isArray(hc.check_regions) && hc.check_regions.length > 0) ? hc.check_regions.length : '-'
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
    .description('获取健康检查详情 - 查看特定健康检查的详细配置信息，包括检查参数和区域设置')
    .requiredOption('-i, --id <id>', '健康检查 ID（Health Check ID），指定要查询的健康检查')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的健康检查 - 配置新的源站监控，定期探测服务器可用性并自动触发故障切换')
    .requiredOption('-n, --name <name>', '健康检查名称，用于标识和管理健康检查')
    .requiredOption('-a, --address <address>', '要检查的地址（主机名或 IP 地址），指定要监控的源站服务器')
    .option('-t, --type <type>', '检查类型（http, https, tcp, ping, smtp, udp_icmp, icmp），指定健康检查的协议类型', 'http')
    .option('--description <description>', '健康检查描述，用于说明检查的用途')
    .option('--port <port>', '端口号，指定要检查的服务端口', '80')
    .option('--path <path>', '检查路径，用于 HTTP/HTTPS 类型检查', '/')
    .option('--method <method>', 'HTTP 请求方法（GET, POST 等），用于 HTTP/HTTPS 类型检查', 'GET')
    .option('--expected-codes <codes>', '预期 HTTP 状态码，用于判断源站是否健康', '200')
    .option('--interval <interval>', '检查间隔（秒），两次健康检查之间的时间间隔', '60')
    .option('--timeout <timeout>', '超时时间（秒），等待源站响应的最大时间', '5')
    .option('--retries <retries>', '重试次数，标记为不健康前的连续失败次数', '2')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('更新健康检查 - 修改现有健康检查的配置设置，包括检查参数和阈值')
    .requiredOption('-i, --id <id>', '健康检查 ID（Health Check ID），指定要更新的健康检查')
    .option('-n, --name <name>', '健康检查名称，修改检查的标识名称')
    .option('-a, --address <address>', '要检查的地址，修改监控的源站服务器')
    .option('-t, --type <type>', '检查类型，修改健康检查的协议类型')
    .option('--description <description>', '健康检查描述，修改描述信息')
    .option('--port <port>', '端口号，修改要检查的服务端口')
    .option('--path <path>', '检查路径，修改 HTTP/HTTPS 类型检查的路径')
    .option('--method <method>', 'HTTP 请求方法，修改 HTTP/HTTPS 类型检查的请求方法')
    .option('--interval <interval>', '检查间隔（秒），修改两次检查之间的时间间隔')
    .option('--timeout <timeout>', '超时时间（秒），修改等待响应的最大时间')
    .option('--retries <retries>', '重试次数，修改标记为不健康前的连续失败次数')
    .option('--suspend', '暂停健康检查，临时停止对源站的监控')
    .option('--no-suspend', '恢复健康检查，重新开始对源站的监控')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('删除健康检查 - 移除健康检查，删除后将停止对源站的监控')
    .requiredOption('-i, --id <id>', '健康检查 ID（Health Check ID），指定要删除的健康检查')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
