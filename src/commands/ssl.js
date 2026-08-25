const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function sslCommands(program) {
  const ssl = program.command('ssl').description('Manage SSL/TLS Settings');

  ssl
    .command('settings')
    .description('Get SSL/TLS settings')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getSSLSettings(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          formatInfo(`SSL Mode: ${result.result.value}`);
          formatTable([{
            value: result.result.value,
            editable: result.result.editable ? 'Yes' : 'No',
            modified_on: result.result.modified_on || '-'
          }], [
            { header: 'Value', accessor: 'value' },
            { header: 'Editable', accessor: 'editable' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  ssl
    .command('set')
    .description('Set SSL/TLS mode')
    .requiredOption('-m, --mode <mode>', 'SSL mode (off, flexible, full, strict, origin_pull)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateSSLSettings(options.mode, options.zoneId);
        formatSuccess(`SSL mode set to: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const https = ssl.command('https').description('Manage HTTPS settings');

  https
    .command('redirect')
    .description('Get Always Use HTTPS setting')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getHTTPSRedirect(options.zoneId);
        formatInfo(`Always Use HTTPS: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  https
    .command('redirect-enable')
    .description('Enable Always Use HTTPS')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTPSRedirect('on', options.zoneId);
        formatSuccess('Always Use HTTPS enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  https
    .command('redirect-disable')
    .description('Disable Always Use HTTPS')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTPSRedirect('off', options.zoneId);
        formatSuccess('Always Use HTTPS disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  const http2 = ssl.command('http2').description('Manage HTTP/2 settings');

  http2
    .command('status')
    .description('Get HTTP/2 setting')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getHTTP2(options.zoneId);
        formatInfo(`HTTP/2: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  http2
    .command('enable')
    .description('Enable HTTP/2')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTP2('on', options.zoneId);
        formatSuccess('HTTP/2 enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  http2
    .command('disable')
    .description('Disable HTTP/2')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTP2('off', options.zoneId);
        formatSuccess('HTTP/2 disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  const tls = ssl.command('tls').description('Manage TLS settings');

  tls
    .command('version')
    .description('Get Minimum TLS Version setting')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const zoneId = options.zoneId || program.opts().config.zoneId;
        const result = await client.request('GET', `/zones/${zoneId}/settings/min_tls_version`);
        formatInfo(`Minimum TLS Version: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  tls
    .command('set-version')
    .description('Set Minimum TLS Version')
    .requiredOption('-v, --version <version>', 'TLS version (1.0, 1.1, 1.2, 1.3)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const zoneId = options.zoneId || program.opts().config.zoneId;
        const result = await client.request('PATCH', `/zones/${zoneId}/settings/min_tls_version`, {
          value: options.version
        });
        formatSuccess(`Minimum TLS Version set to: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = sslCommands;
