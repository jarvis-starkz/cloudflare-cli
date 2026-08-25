const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 页面规则命令
 *
 * 功能说明：管理 Cloudflare 页面规则（Page Rules），用于根据 URL 模式配置各种 HTTP 行为。
 * 页面规则允许您基于 URL 匹配条件自定义 Cloudflare 的行为，包括缓存策略、安全设置、
 * 转发 URL、SSL 模式等，为您提供细粒度的流量控制能力。
 *
 * 使用场景：
 * - 配置特定路径的缓存策略
 * - 设置 URL 重定向（301/302 转发）
 * - 强制 HTTPS 连接
 * - 配置自定义 SSL 设置
 * - 设置安全级别和 WAF 规则
 */
function pageRulesCommands(program) {
  const pr = program.command('page-rules').description('管理 Cloudflare Page Rules（企业级 URL 规则引擎，根据 URL 模式配置缓存、安全和转发行为）');

  pr
    .command('list')
    .description('列出所有页面规则 - 显示区域下配置的所有页面规则及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-s, --status <status>', '按状态过滤规则（active 表示已启用，disabled 表示已禁用），便于筛选特定状态的规则')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('获取页面规则详情 - 查看特定页面规则的详细配置信息，包括目标匹配条件和执行的动作')
    .requiredOption('-i, --id <id>', '页面规则 ID（Page Rule ID），指定要查询的规则')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的页面规则 - 基于 URL 匹配模式创建新的页面规则，定义匹配条件和处理动作')
    .requiredOption('--target <pattern>', 'URL 匹配模式（例如："example.com/*"），支持通配符 * 和 **，用于匹配请求 URL')
    .requiredOption('--action <action>', '规则动作类型（always_use_https, cache_level, forwarding_url, ssl, security_level 等），指定匹配后执行的操作')
    .requiredOption('--value <value>', '规则动作值（例如：cache_level 的值为 bypass, basic, simplified, aggressive, cache_everything），与 --action 配合使用')
    .option('--priority <priority>', '规则优先级（数字越小优先级越高），数值相同时后创建的规则优先，默认为最低优先级')
    .option('--status <status>', '规则状态（active 表示启用，disabled 表示禁用），创建后是否立即生效', 'active')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('更新页面规则 - 修改现有页面规则的匹配条件、动作类型或状态')
    .requiredOption('-i, --id <id>', '页面规则 ID（Page Rule ID），指定要更新的规则')
    .option('--target <pattern>', 'URL 匹配模式（例如："example.com/*"），修改匹配的 URL 模式')
    .option('--action <action>', '规则动作类型，修改匹配后执行的操作')
    .option('--value <value>', '规则动作值，修改动作的具体参数值')
    .option('--priority <priority>', '规则优先级（数字越小优先级越高），调整规则的执行顺序')
    .option('--status <status>', '规则状态（active 表示启用，disabled 表示禁用），控制规则是否生效')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('删除页面规则 - 移除指定的页面规则，删除后该规则将不再应用于匹配的流量')
    .requiredOption('-i, --id <id>', '页面规则 ID（Page Rule ID），指定要删除的规则')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('启用页面规则 - 激活已禁用的页面规则，使其重新应用于匹配的流量')
    .requiredOption('-i, --id <id>', '页面规则 ID（Page Rule ID），指定要启用的规则')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
    .description('禁用页面规则 - 停用页面规则，使其暂时不应用于匹配的流量，但保留配置以便后续重新启用')
    .requiredOption('-i, --id <id>', '页面规则 ID（Page Rule ID），指定要禁用的规则')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
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
