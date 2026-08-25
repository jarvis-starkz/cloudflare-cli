const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function notificationCommands(program) {
  const notification = program.command('notification').description('Manage Cloudflare Notifications (Enterprise)');

  // Alerts
  const alerts = notification.command('alerts').description('Manage Alert Notifications');

  alerts
    .command('list')
    .description('List all alert notifications')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get alert notification details')
    .requiredOption('-i, --id <id>', 'Alert ID')
    .option('-j, --json', 'Output as JSON')
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
    .description('List notification history')
    .option('-j, --json', 'Output as JSON')
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
  const policies = notification.command('policies').description('Manage Notification Policies (Enterprise)');

  policies
    .command('list')
    .description('List all notification policies')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get notification policy details')
    .requiredOption('-i, --id <id>', 'Policy ID')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a notification policy')
    .requiredOption('-n, --name <name>', 'Policy name')
    .requiredOption('--alert-type <type>', 'Alert type (e.g., load_balancing_health_alert, g6_pool_toggle_alert)')
    .option('--description <description>', 'Policy description')
    .option('--enabled', 'Enable the policy', true)
    .option('--no-enabled', 'Disable the policy')
    .option('-j, --json', 'Output as JSON')
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
    .description('Update a notification policy')
    .requiredOption('-i, --id <id>', 'Policy ID')
    .option('-n, --name <name>', 'Policy name')
    .option('--description <description>', 'Policy description')
    .option('--enabled', 'Enable the policy')
    .option('--no-enabled', 'Disable the policy')
    .option('-j, --json', 'Output as JSON')
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
    .description('Delete a notification policy')
    .requiredOption('-i, --id <id>', 'Policy ID')
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
  const webhooks = notification.command('webhooks').description('Manage Notification Webhooks (Enterprise)');

  webhooks
    .command('list')
    .description('List all notification webhooks')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get notification webhook details')
    .requiredOption('-i, --id <id>', 'Webhook ID')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a notification webhook')
    .requiredOption('-n, --name <name>', 'Webhook name')
    .requiredOption('-u, --url <url>', 'Webhook URL')
    .option('--secret <secret>', 'Webhook secret for HMAC verification')
    .option('-j, --json', 'Output as JSON')
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
    .description('Update a notification webhook')
    .requiredOption('-i, --id <id>', 'Webhook ID')
    .option('-n, --name <name>', 'Webhook name')
    .option('-u, --url <url>', 'Webhook URL')
    .option('--secret <secret>', 'Webhook secret')
    .option('-j, --json', 'Output as JSON')
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
    .description('Delete a notification webhook')
    .requiredOption('-i, --id <id>', 'Webhook ID')
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
  const pagerduty = notification.command('pagerduty').description('Manage PagerDuty Integration (Enterprise)');

  pagerduty
    .command('get')
    .description('Get PagerDuty integration details')
    .option('-j, --json', 'Output as JSON')
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
    .description('Connect PagerDuty integration')
    .requiredOption('--integration-url <url>', 'PagerDuty integration URL')
    .option('-n, --name <name>', 'Integration name')
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
    .description('Disconnect PagerDuty integration')
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
