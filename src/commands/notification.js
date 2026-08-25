const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 通知命令
 *
 * 功能说明：管理 Cloudflare 通知服务，包括告警通知、通知策略、
 * Webhook 集成和 PagerDuty 集成。提供灵活的通知配置，
 * 确保在发生重要事件时及时收到提醒。
 *
 * 使用场景：
 * - 配置告警通知以监控服务状态
 * - 设置通知策略定义通知规则
 * - 集成 Webhook 实现自动化工作流
 * - 连接 PagerDuty 实现事件管理
 * - 查看通知历史记录
 */
function notificationCommands(program) {
  const notification = program.command('notification').description('管理 Cloudflare Notifications（企业级告警通知，支持邮件、Webhook 和 PagerDuty 集成）');

  // Alerts
  const alerts = notification.command('alerts').description('管理告警通知 - 配置和查看告警通知设置');

  alerts
    .command('list')
    .description('列出所有告警通知 - 显示账户下配置的所有告警通知及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listNotifications();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(alert => ({
            id: alert.id,
            name: alert.name || '-',
            alert_type: alert.alert_type || '-',
            enabled: alert.enabled ? 'Yes' : 'No',
            mechanisms: Object.keys(alert.mechanisms || {}).join(', ') || '-',
            created: alert.created || '-',
            modified: alert.modified || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Type', accessor: 'alert_type' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Mechanisms', accessor: 'mechanisms' }
          ]);
          formatSuccess(`Found ${data.length} alert(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  alerts
    .command('get')
    .description('获取告警通知详情 - 查看特定告警通知的详细配置信息')
    .requiredOption('-i, --id <id>', '告警通知 ID（Alert ID），指定要查询的告警')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getNotification(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const alert = result.result;
          formatTable([{
            id: alert.id,
            name: alert.name || '-',
            alert_type: alert.alert_type || '-',
            enabled: alert.enabled ? 'Yes' : 'No',
            description: alert.description || '-',
            filters: JSON.stringify(alert.filters || {}),
            created: alert.created || '-',
            modified: alert.modified || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Type', accessor: 'alert_type' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Description', accessor: 'description' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  alerts
    .command('history')
    .description('列出通知历史 - 查看已发送的通知历史记录，包括发送状态和时间')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listNotificationHistory();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(item => ({
            id: item.id,
            alert_type: item.alert_type || '-',
            status: item.status || '-',
            sent: item.sent || '-',
            message: item.message || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Alert Type', accessor: 'alert_type' },
            { header: 'Status', accessor: 'status' },
            { header: 'Sent', accessor: 'sent' }
          ]);
          formatSuccess(`Found ${data.length} history record(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  // Policies (Enterprise)
  const policies = notification.command('policies').description('管理通知策略（企业级）- 配置通知规则和条件');

  policies
    .command('list')
    .description('列出所有通知策略 - 显示账户下配置的所有通知策略及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listNotificationPolicies();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(policy => ({
            id: policy.id,
            name: policy.name || '-',
            description: policy.description || '-',
            enabled: policy.enabled ? 'Yes' : 'No',
            alert_type: policy.alert_type || '-',
            mechanisms: Object.keys(policy.mechanisms || {}).join(', ') || '-',
            created: policy.created || '-',
            modified: policy.modified || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Alert Type', accessor: 'alert_type' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Mechanisms', accessor: 'mechanisms' }
          ]);
          formatSuccess(`Found ${data.length} policy/policies`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('get')
    .description('获取通知策略详情 - 查看特定通知策略的详细配置信息')
    .requiredOption('-i, --id <id>', '通知策略 ID（Policy ID），指定要查询的策略')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getNotificationPolicy(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const policy = result.result;
          formatTable([{
            id: policy.id,
            name: policy.name || '-',
            description: policy.description || '-',
            enabled: policy.enabled ? 'Yes' : 'No',
            alert_type: policy.alert_type || '-',
            filters: JSON.stringify(policy.filters || {}),
            created: policy.created || '-',
            modified: policy.modified || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Alert Type', accessor: 'alert_type' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Description', accessor: 'description' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('create')
    .description('创建通知策略 - 配置新的通知策略，定义通知条件和接收方式')
    .requiredOption('-n, --name <name>', '策略名称，用于标识和管理通知策略')
    .requiredOption('--alert-type <type>', '告警类型（例如：load_balancing_health_alert, g6_pool_toggle_alert），指定触发通知的事件类型')
    .option('--description <description>', '策略描述，用于说明策略的用途')
    .option('--enabled', '启用策略，使其开始监控和发送通知', true)
    .option('--no-enabled', '禁用策略')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          alert_type: options.alertType,
          enabled: options.enabled
        };
        if (options.description) data.description = options.description;

        const result = await client.createNotificationPolicy(data);

        if (options.json) {
          formatJson(result.result);
        } else {
          formatSuccess(`Notification policy created: ${result.result.id}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('update')
    .description('更新通知策略 - 修改现有通知策略的配置设置')
    .requiredOption('-i, --id <id>', '通知策略 ID（Policy ID），指定要更新的策略')
    .option('-n, --name <name>', '策略名称，修改策略的标识名称')
    .option('--description <description>', '策略描述，修改描述信息')
    .option('--enabled', '启用策略')
    .option('--no-enabled', '禁用策略')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.description) data.description = options.description;
        if (options.enabled !== undefined) data.enabled = options.enabled;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateNotificationPolicy(options.id, data);

        if (options.json) {
          formatJson(result.result);
        } else {
          formatSuccess(`Notification policy updated: ${result.result.id}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('delete')
    .description('删除通知策略 - 移除通知策略，删除后将停止根据该策略发送通知')
    .requiredOption('-i, --id <id>', '通知策略 ID（Policy ID），指定要删除的策略')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteNotificationPolicy(options.id);
        formatSuccess(`Notification policy deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Webhooks (Enterprise)
  const webhooks = notification.command('webhooks').description('管理通知 Webhook（企业级）- 配置 Webhook 接收通知事件');

  webhooks
    .command('list')
    .description('列出所有通知 Webhook - 显示账户下配置的所有 Webhook 及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listNotificationWebhooks();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(wh => ({
            id: wh.id,
            name: wh.name || '-',
            url: wh.url || '-',
            type: wh.type || '-',
            created: wh.created || '-',
            modified: wh.modified || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'URL', accessor: 'url' },
            { header: 'Type', accessor: 'type' }
          ]);
          formatSuccess(`Found ${data.length} webhook(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  webhooks
    .command('get')
    .description('获取通知 Webhook 详情 - 查看特定 Webhook 的详细配置信息')
    .requiredOption('-i, --id <id>', 'Webhook ID，指定要查询的 Webhook')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getNotificationWebhook(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const wh = result.result;
          formatTable([{
            id: wh.id,
            name: wh.name || '-',
            url: wh.url || '-',
            type: wh.type || '-',
            created: wh.created || '-',
            modified: wh.modified || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'URL', accessor: 'url' },
            { header: 'Type', accessor: 'type' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  webhooks
    .command('create')
    .description('创建通知 Webhook - 配置新的 Webhook 端点，用于接收通知事件')
    .requiredOption('-n, --name <name>', 'Webhook 名称，用于标识和管理 Webhook')
    .requiredOption('-u, --url <url>', 'Webhook URL，指定接收通知的端点地址')
    .option('--secret <secret>', 'Webhook 密钥，用于 HMAC 签名验证，确保通知来源可信')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          url: options.url
        };
        if (options.secret) data.secret = options.secret;

        const result = await client.createNotificationWebhook(data);

        if (options.json) {
          formatJson(result.result);
        } else {
          formatSuccess(`Notification webhook created: ${result.result.id}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  webhooks
    .command('update')
    .description('更新通知 Webhook - 修改现有 Webhook 的配置设置')
    .requiredOption('-i, --id <id>', 'Webhook ID，指定要更新的 Webhook')
    .option('-n, --name <name>', 'Webhook 名称，修改 Webhook 的标识名称')
    .option('-u, --url <url>', 'Webhook URL，修改接收通知的端点地址')
    .option('--secret <secret>', 'Webhook 密钥，修改 HMAC 签名验证密钥')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.url) data.url = options.url;
        if (options.secret) data.secret = options.secret;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateNotificationWebhook(options.id, data);

        if (options.json) {
          formatJson(result.result);
        } else {
          formatSuccess(`Notification webhook updated: ${result.result.id}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  webhooks
    .command('delete')
    .description('删除通知 Webhook - 移除 Webhook 配置，删除后将停止向该端点发送通知')
    .requiredOption('-i, --id <id>', 'Webhook ID，指定要删除的 Webhook')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteNotificationWebhook(options.id);
        formatSuccess(`Notification webhook deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // PagerDuty Integration (Enterprise)
  const pagerduty = notification.command('pagerduty').description('管理 PagerDuty 集成（企业级）- 连接 PagerDuty 实现事件管理');

  pagerduty
    .command('get')
    .description('获取 PagerDuty 集成详情 - 查看当前 PagerDuty 集成的配置信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getPagerDutyIntegration();

        if (options.json) {
          formatJson(result.result);
        } else {
          const pd = result.result;
          formatTable([{
            id: pd.id || '-',
            name: pd.name || '-',
            integration_url: pd.integration_url || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Integration URL', accessor: 'integration_url' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  pagerduty
    .command('connect')
    .description('连接 PagerDuty 集成 - 配置与 PagerDuty 的连接，将 Cloudflare 通知发送到 PagerDuty')
    .requiredOption('--integration-url <url>', 'PagerDuty 集成 URL，指定 PagerDuty 的集成端点地址')
    .option('-n, --name <name>', '集成名称，用于标识 PagerDuty 集成')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          integration_url: options.integrationUrl
        };
        if (options.name) data.name = options.name;

        const result = await client.createPagerDutyIntegration(data);
        formatSuccess('PagerDuty integration connected');
      } catch (error) {
        formatError(error.message);
      }
    });

  pagerduty
    .command('disconnect')
    .description('断开 PagerDuty 集成 - 移除与 PagerDuty 的连接，停止发送通知到 PagerDuty')
    .action(async () => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deletePagerDutyIntegration();
        formatSuccess('PagerDuty integration disconnected');
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = notificationCommands;
