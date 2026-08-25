const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function enterpriseCommands(program) {
  const enterprise = program.command('enterprise').description('Manage Enterprise Features');

  // Custom Nameservers
  const customNs = enterprise.command('custom-ns').description('Manage Custom Nameservers');

  customNs
    .command('list')
    .description('List all custom nameservers')
    .option('-j, --json', 'Output as JSON')
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
            { header: 'Nameservers', accessor: 'ns_names' },
            { header: 'DNS Records', accessor: 'dns_records' },
            { header: 'Created', accessor: 'created_at' }
          ]);
          formatSuccess(`Found ${data.length} custom nameserver(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  customNs
    .command('create')
    .description('Create custom nameservers')
    .requiredOption('--ns <ns...>', 'Nameserver hostnames (e.g., ns1.example.com)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          ns_names: options.ns
        };

        const result = await client.createCustomNameserver(data);
        formatSuccess(`Custom nameservers created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  customNs
    .command('delete')
    .description('Delete custom nameservers')
    .requiredOption('-i, --id <id>', 'Custom nameserver ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteCustomNameserver(options.id);
        formatSuccess(`Custom nameservers deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Argo Smart Routing
  const argo = enterprise.command('argo').description('Manage Argo Smart Routing');

  argo
    .command('smart-routing')
    .description('Get Argo Smart Routing setting')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getArgoSmartRouting(options.zoneId);
        formatInfo(`Argo Smart Routing: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('smart-routing-enable')
    .description('Enable Argo Smart Routing')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoSmartRouting('on', options.zoneId);
        formatSuccess('Argo Smart Routing enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('smart-routing-disable')
    .description('Disable Argo Smart Routing')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoSmartRouting('off', options.zoneId);
        formatSuccess('Argo Smart Routing disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching')
    .description('Get Argo Tiered Caching setting')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getArgoTieredCaching(options.zoneId);
        formatInfo(`Argo Tiered Caching: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching-enable')
    .description('Enable Argo Tiered Caching')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoTieredCaching('on', options.zoneId);
        formatSuccess('Argo Tiered Caching enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  argo
    .command('tiered-caching-disable')
    .description('Disable Argo Tiered Caching')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateArgoTieredCaching('off', options.zoneId);
        formatSuccess('Argo Tiered Caching disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  // Logpush Jobs
  const logpush = enterprise.command('logpush').description('Manage Logpush Jobs');

  logpush
    .command('list')
    .description('List all Logpush jobs')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
            enabled: job.enabled ? 'Yes' : 'No'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Dataset', accessor: 'dataset' },
            { header: 'Destination', accessor: 'destination_conf' },
            { header: 'Enabled', accessor: 'enabled' }
          ]);
          formatSuccess(`Found ${data.length} job(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('get')
    .description('Get a Logpush job details')
    .requiredOption('-i, --id <id>', 'Job ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
            enabled: job.enabled ? 'Yes' : 'No',
            frequency: job.frequency || '-',
            created_on: job.created_on || '-',
            modified_on: job.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Dataset', accessor: 'dataset' },
            { header: 'Destination', accessor: 'destination_conf' },
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Frequency', accessor: 'frequency' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('create')
    .description('Create a Logpush job')
    .requiredOption('--destination <destination>', 'Destination (e.g., s3://bucket/prefix?region=us-east-1)')
    .requiredOption('--dataset <dataset>', 'Dataset (http_requests, spectrum_events, firewall_events, etc.)')
    .option('-n, --name <name>', 'Job name')
    .option('--frequency <frequency>', 'Frequency (high, low)', 'high')
    .option('--enabled', 'Enable the job', true)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
        formatSuccess(`Logpush job created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('update')
    .description('Update a Logpush job')
    .requiredOption('-i, --id <id>', 'Job ID')
    .option('-n, --name <name>', 'Job name')
    .option('--destination <destination>', 'Destination')
    .option('--frequency <frequency>', 'Frequency')
    .option('--enabled', 'Enable the job', true)
    .option('--no-enabled', 'Disable the job', false)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.destination) data.destination_conf = options.destination;
        if (options.frequency) data.frequency = options.frequency;
        if (options.enabled !== undefined) data.enabled = options.enabled;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateLogpushJob(options.id, options.zoneId, data);
        formatSuccess(`Logpush job updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  logpush
    .command('delete')
    .description('Delete a Logpush job')
    .requiredOption('-i, --id <id>', 'Job ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteLogpushJob(options.id, options.zoneId);
        formatSuccess(`Logpush job deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // DDoS Protection
  const ddos = enterprise.command('ddos').description('Manage DDoS Protection Settings');

  ddos
    .command('settings')
    .description('Get DDoS L7 protection settings')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getDDoSSL7Settings(options.zoneId);
        const settings = result.result;
        formatTable([{
          id: settings.id,
          value: settings.value,
          editable: settings.editable ? 'Yes' : 'No',
          modified_on: settings.modified_on || '-'
        }], [
          { header: 'Setting', accessor: 'id' },
          { header: 'Value', accessor: 'value' },
          { header: 'Editable', accessor: 'editable' },
          { header: 'Modified', accessor: 'modified_on' }
        ]);
      } catch (error) {
        formatError(error.message);
      }
    });

  ddos
    .command('enable')
    .description('Enable DDoS L7 protection')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateDDoSSL7Settings(options.zoneId, { value: 'on' });
        formatSuccess('DDoS L7 protection enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  ddos
    .command('disable')
    .description('Disable DDoS L7 protection')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateDDoSSL7Settings(options.zoneId, { value: 'off' });
        formatSuccess('DDoS L7 protection disabled');
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = enterpriseCommands;
