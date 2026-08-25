const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function spectrumCommands(program) {
  const spectrum = program.command('spectrum').description('Manage Cloudflare Spectrum (Enterprise - TCP/UDP)');

  spectrum
    .command('list')
    .description('List all Spectrum applications')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listSpectrumApps(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(app => ({
            id: app.id,
            protocol: app.protocol || '-',
            dns: app.dns || '-',
            origin_direct: app.origin_direct?.join(', ') || '-',
            proxy_protocol: app.proxy_protocol ? 'Enabled' : 'Disabled',
            ip_firewall: app.ip_firewall ? 'Enabled' : 'Disabled',
            edge_ips: app.edge_ips || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Protocol', accessor: 'protocol' },
            { header: 'DNS', accessor: 'dns' },
            { header: 'Origin Direct', accessor: 'origin_direct' },
            { header: 'Proxy Protocol', accessor: 'proxy_protocol' },
            { header: 'IP Firewall', accessor: 'ip_firewall' },
            { header: 'Edge IPs', accessor: 'edge_ips' }
          ]);
          formatSuccess(`Found ${data.length} application(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('get')
    .description('Get a Spectrum application details')
    .requiredOption('-i, --id <id>', 'Application ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getSpectrumApp(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const app = result.result;
          formatTable([{
            id: app.id,
            protocol: app.protocol || '-',
            dns: app.dns || '-',
            origin_direct: app.origin_direct?.join(', ') || '-',
            proxy_protocol: app.proxy_protocol ? 'Enabled' : 'Disabled',
            ip_firewall: app.ip_firewall ? 'Enabled' : 'Disabled',
            edge_ips: app.edge_ips || '-',
            tls: app.tls || '-',
            traffic_type: app.traffic_type || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Protocol', accessor: 'protocol' },
            { header: 'DNS', accessor: 'dns' },
            { header: 'Origin Direct', accessor: 'origin_direct' },
            { header: 'Proxy Protocol', accessor: 'proxy_protocol' },
            { header: 'IP Firewall', accessor: 'ip_firewall' },
            { header: 'Edge IPs', accessor: 'edge_ips' },
            { header: 'TLS', accessor: 'tls' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('create')
    .description('Create a new Spectrum application')
    .requiredOption('--protocol <protocol>', 'Protocol (e.g., tcp/22, udp/53)')
    .requiredOption('--origin <origin>', 'Origin address (e.g., 192.168.1.1:22)')
    .option('--dns <dns>', 'DNS name (e.g., ssh.example.com)')
    .option('--proxy-protocol', 'Enable proxy protocol', false)
    .option('--ip-firewall', 'Enable IP firewall', true)
    .option('--tls <tls>', 'TLS mode (off, flexible, full, strict)', 'off')
    .option('--edge-ips <ips>', 'Edge IPs (all, connectivity_dynamic, ipv4, ipv6)', 'all')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          protocol: options.protocol,
          origin_direct: [`tcp://${options.origin}`],
          proxy_protocol: options.proxyProtocol,
          ip_firewall: options.ipFirewall,
          tls: options.tls,
          edge_ips: options.edgeIps
        };
        if (options.dns) data.dns = { type: 'CNAME', name: options.dns };

        const result = await client.createSpectrumApp(options.zoneId, data);
        formatSuccess(`Spectrum application created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('update')
    .description('Update a Spectrum application')
    .requiredOption('-i, --id <id>', 'Application ID')
    .option('--protocol <protocol>', 'Protocol')
    .option('--origin <origin>', 'Origin address')
    .option('--dns <dns>', 'DNS name')
    .option('--proxy-protocol', 'Enable proxy protocol', true)
    .option('--no-proxy-protocol', 'Disable proxy protocol', false)
    .option('--ip-firewall', 'Enable IP firewall', true)
    .option('--no-ip-firewall', 'Disable IP firewall', false)
    .option('--tls <tls>', 'TLS mode')
    .option('--edge-ips <ips>', 'Edge IPs')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.protocol) data.protocol = options.protocol;
        if (options.origin) data.origin_direct = [`tcp://${options.origin}`];
        if (options.dns) data.dns = { type: 'CNAME', name: options.dns };
        if (options.proxyProtocol !== undefined) data.proxy_protocol = options.proxyProtocol;
        if (options.ipFirewall !== undefined) data.ip_firewall = options.ipFirewall;
        if (options.tls) data.tls = options.tls;
        if (options.edgeIps) data.edge_ips = options.edgeIps;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateSpectrumApp(options.id, options.zoneId, data);
        formatSuccess(`Spectrum application updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('delete')
    .description('Delete a Spectrum application')
    .requiredOption('-i, --id <id>', 'Application ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteSpectrumApp(options.id, options.zoneId);
        formatSuccess(`Spectrum application deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = spectrumCommands;
