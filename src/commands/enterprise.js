/**
 * Cloudflare 企业功能命令模块。
 *
 * 管理 Cloudflare 企业版功能，包括自定义名称服务器、Argo Smart Routing、
 * Argo Tiered Caching、Logpush 日志推送和 DDoS 防护设置。
 * 这些功能通常需要企业计划或特定套餐才能使用。
 */

const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function enterpriseCommands(program) {
  const enterprise = program.command('enterprise')
    .description('管理 Cloudflare 企业功能，包括自定义名称服务器、Argo 智能路由、日志推送和 DDoS 防护');

  // Custom Nameservers
  const customNs = enterprise.command('custom-ns')
    .description('管理自定义名称服务器 (Custom Nameservers)，允许使用自有域名作为 Cloudflare 的 NS 记录');

  customNs
    .command('list')
    .description('列出所有自定义名称服务器。显示账户下配置的所有自定义名称服务器及其关联的 DNS 记录。适用于查看现有 NS 配置或进行批量管理。')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCustomNameservers();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(ns => ({
            id: ns.id,
            ns_names: ns.ns_names?.join(', ') || '-',
            dns_records: ns.dns_records || '-',
            created_at: ns.created_at || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: '名称服务器', accessor: 'ns_names' },
            { header: 'DNS 记录', accessor: 'dns_records' },
            { header: '创建时间', accessor: 'created_at' }
          ]);
          formatSuccess(`找到 ${data.length} 个自定义名称服务器`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  customNs
    .command('create')
    .description('创建自定义名称服务器。为账户配置自定义名称服务器，使其显示为自有域名而非 Cloudflare 默认 NS。适用于需要品牌化 NS 记录的企业用户。')
    .requiredOption('--ns <ns...>', '名称服务器主机名列表（例如：ns1.example.com ns2.example.com），至少需要两个名称服务器')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          ns_names: options.ns
        };

        const result = await client.createCustomNameserver(data);
        formatSuccess(`自定义名称服务器已创建：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  customNs
    .command('delete')
    .description('删除自定义名称服务器。移除指定的自定义名称服务器配置。此操作不可逆，删除后将恢复为 Cloudflare 默认名称服务器。')
    .requiredOption('-i, --id <id>', '自定义名称服务器 ID，唯一标识要删除的配置')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteCustomNameserver(options.id);
        formatSuccess(`自定义名称服务器已删除：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Argo Smart Routing
  const argo = enterprise.command('argo')
    .description('管理 Argo 智能路由 (Smart Routing) 和分层缓存 (Tiered Caching)，优化网络路径和缓存效率');

  argo
    .command('smart-routing')
    .description('获取 Argo Smart Routing 设置状态。显示当前区域是否启用了 Argo 智能路由功能，该功能通过实时网络分析优化流量路由。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getArgoSmartRouting(options.zoneId);
        formatInfo(`Argo Smart Routing：${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('smart-routing-enable')
    .description('启用 Argo Smart Routing。开启智能路由功能，Cloudflare 将实时分析网络状况并选择最优路径传输流量，可显著减少延迟和提高可靠性。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoSmartRouting('on', options.zoneId);
        formatSuccess('Argo Smart Routing 已启用');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('smart-routing-disable')
    .description('禁用 Argo Smart Routing。关闭智能路由功能，流量将使用标准路由。适用于成本优化或不需要智能路由的场景。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoSmartRouting('off', options.zoneId);
        formatSuccess('Argo Smart Routing 已禁用');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching')
    .description('获取 Argo Tiered Caching 设置状态。显示当前区域是否启用了分层缓存功能，该功能通过多级缓存架构优化缓存命中率。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getArgoTieredCaching(options.zoneId);
        formatInfo(`Argo Tiered Caching：${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching-enable')
    .description('启用 Argo Tiered Caching。开启分层缓存功能，Cloudflare 将使用多级缓存架构（边缘节点和父层节点）来提高缓存命中率并减少源站负载。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoTieredCaching('on', options.zoneId);
        formatSuccess('Argo Tiered Caching 已启用');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching-disable')
    .description('禁用 Argo Tiered Caching。关闭分层缓存功能，所有请求将直接由边缘节点处理。适用于需要简化缓存架构的场景。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoTieredCaching('off', options.zoneId);
        formatSuccess('Argo Tiered Caching 已禁用');
      } catch (error) {
        formatError(error.message);
      }
    });

  // Logpush Jobs
  const logpush = enterprise.command('logpush')
    .description('管理 Logpush 日志推送任务，将 Cloudflare 日志数据自动推送到指定的存储目的地（如 S3、GCS、Azure 等）');

  logpush
    .command('list')
    .description('列出所有 Logpush 任务。显示当前区域配置的所有日志推送任务，包括任务名称、数据集、目的地和启用状态。适用于查看现有日志推送配置。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listLogpushJobs(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(job => ({
            id: job.id,
            name: job.name || '-',
            dataset: job.dataset || '-',
            destination_conf: job.destination_conf || '-',
            output_options: job.output_options || '-',
            enabled: job.enabled ? '是' : '否'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '数据集', accessor: 'dataset' },
            { header: '目的地', accessor: 'destination_conf' },
            { header: '已启用', accessor: 'enabled' }
          ]);
          formatSuccess(`找到 ${data.length} 个任务`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('get')
    .description('获取 Logpush 任务详细信息。显示指定日志推送任务的完整配置，包括数据集、目的地、输出选项、频率等。适用于查看特定任务的详细配置。')
    .requiredOption('-i, --id <id>', '任务 ID（Job ID），唯一标识一个 Logpush 任务')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getLogpushJob(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const job = result.result;
          formatTable([{
            id: job.id,
            name: job.name || '-',
            dataset: job.dataset || '-',
            destination_conf: job.destination_conf || '-',
            output_options: job.output_options || '-',
            enabled: job.enabled ? '是' : '否',
            frequency: job.frequency || '-',
            created_on: job.created_on || '-',
            modified_on: job.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '数据集', accessor: 'dataset' },
            { header: '目的地', accessor: 'destination_conf' },
            { header: '已启用', accessor: 'enabled' },
            { header: '频率', accessor: 'frequency' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('create')
    .description('创建 Logpush 任务。配置新的日志推送任务，将指定类型的日志数据自动推送到指定的存储目的地。适用于设置日志归档、分析或合规性存储。')
    .requiredOption('--destination <destination>', '日志推送目的地（例如：s3://bucket/prefix?region=us-east-1 或 gs://bucket/prefix），支持 S3、GCS、Azure、Splunk 等多种目的地')
    .requiredOption('--dataset <dataset>', '日志数据集类型。有效值：http_requests（HTTP 请求日志）、spectrum_events（Spectrum 事件）、firewall_events（防火墙事件）、dns_logs（DNS 日志）等')
    .option('-n, --name <name>', '任务名称，用于标识该日志推送任务')
    .option('--frequency <frequency>', '日志推送频率。有效值：high（高频率，约每分钟）或 low（低频率，约每五分钟）。默认值：high', 'high')
    .option('--enabled', '是否启用任务。默认值：true', true)
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          destination_conf: options.destination,
          dataset: options.dataset,
          frequency: options.frequency,
          enabled: options.enabled
        };
        if (options.name) data.name = options.name;

        const result = await client.createLogpushJob(options.zoneId, data);
        formatSuccess(`Logpush 任务已创建：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('update')
    .description('更新 Logpush 任务。修改现有日志推送任务的配置，如目的地、数据集、频率等。适用于调整日志推送设置或更新存储目的地。')
    .requiredOption('-i, --id <id>', '任务 ID（Job ID），唯一标识要更新的 Logpush 任务')
    .option('-n, --name <name>', '新的任务名称')
    .option('--destination <destination>', '新的日志推送目的地')
    .option('--frequency <frequency>', '新的推送频率。有效值：high 或 low')
    .option('--enabled', '启用任务', true)
    .option('--no-enabled', '禁用任务', false)
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.destination) data.destination_conf = options.destination;
        if (options.frequency) data.frequency = options.frequency;
        if (options.enabled !== undefined) data.enabled = options.enabled;

        if (Object.keys(data).length === 0) {
          formatError('请至少指定一个要更新的选项');
          return;
        }

        const result = await client.updateLogpushJob(options.id, options.zoneId, data);
        formatSuccess(`Logpush 任务已更新：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('delete')
    .description('删除 Logpush 任务。永久移除指定的日志推送任务。此操作不可逆，任务删除后将停止推送日志。适用于清理不再需要的日志推送配置。')
    .requiredOption('-i, --id <id>', '任务 ID（Job ID），唯一标识要删除的 Logpush 任务')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteLogpushJob(options.id, options.zoneId);
        formatSuccess(`Logpush 任务已删除：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // DDoS Protection
  const ddos = enterprise.command('ddos')
    .description('管理 DDoS 防护设置，配置 L7 应用层 DDoS 防护的敏感度和行为');

  ddos
    .command('settings')
    .description('获取 DDoS L7 防护设置。显示当前区域的 L7 DDoS 防护配置，包括防护敏感度级别和是否可编辑。适用于查看当前防护状态。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getDDoSSL7Settings(options.zoneId);
        const settings = result.result;
        formatTable([{
          id: settings.id,
          value: settings.value,
          editable: settings.editable ? '是' : '否',
          modified_on: settings.modified_on || '-'
        }], [
          { header: '设置项', accessor: 'id' },
          { header: '值', accessor: 'value' },
          { header: '可编辑', accessor: 'editable' },
          { header: '修改时间', accessor: 'modified_on' }
        ]);
      } catch (error) {
        formatError(error.message);
      }
    });

  ddos
    .command('enable')
    .description('启用 DDoS L7 防护。开启应用层 DDoS 防护功能，Cloudflare 将自动检测和缓解 L7 DDoS 攻击，保护源站免受恶意流量影响。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateDDoSSL7Settings(options.zoneId, { value: 'on' });
        formatSuccess('DDoS L7 防护已启用');
      } catch (error) {
        formatError(error.message);
      }
    });

  ddos
    .command('disable')
    .description('禁用 DDoS L7 防护。关闭应用层 DDoS 防护功能。注意：禁用后站点将失去 L7 DDoS 防护能力，请谨慎操作。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateDDoSSL7Settings(options.zoneId, { value: 'off' });
        formatSuccess('DDoS L7 防护已禁用');
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = enterpriseCommands;
