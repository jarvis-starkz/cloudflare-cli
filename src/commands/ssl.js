const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function sslCommands(program) {
  const ssl = program.command('ssl').description(
    'Manage SSL/TLS Settings. 管理 SSL/TLS 模式、HTTPS 重定向、HTTP/2 和 TLS 版本等安全加密配置。'
  );

  ssl
    .command('settings')
    .description(
      'Get SSL/TLS settings. 获取指定 Zone 的当前 SSL/TLS 模式配置，包括是否可编辑及最后修改时间。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description(
      'Set SSL/TLS mode. 设置指定 Zone 的 SSL/TLS 模式，控制客户端与 Cloudflare 之间的加密方式。'
    )
    .requiredOption('-m, --mode <mode>', 'SSL mode (off, flexible, full, strict, origin_pull). SSL 模式：off（关闭）、flexible（灵活，客户端 HTTPS/源站 HTTP）、full（完全，客户端和源站均 HTTPS 但不验证证书）、strict（严格，客户端和源站均 HTTPS 且验证证书）、origin_pull（源站拉取，Cloudflare 自动重写 HTTP 为 HTTPS）。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateSSLSettings(options.mode, options.zoneId);
        formatSuccess(`SSL mode set to: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const https = ssl.command('https').description(
    'Manage HTTPS settings. 管理 HTTPS 重定向设置，控制是否自动将所有 HTTP 请求重定向到 HTTPS。'
  );

  https
    .command('redirect')
    .description(
      'Get Always Use HTTPS setting. 获取当前 Always Use HTTPS 设置状态，查看是否已启用自动 HTTP 到 HTTPS 重定向。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Enable Always Use HTTPS. 启用 Always Use HTTPS，自动将所有 HTTP 请求重定向到 HTTPS，提升安全性。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Disable Always Use HTTPS. 禁用 Always Use HTTPS，停止自动将 HTTP 请求重定向到 HTTPS。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTPSRedirect('off', options.zoneId);
        formatSuccess('Always Use HTTPS disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  const http2 = ssl.command('http2').description(
    'Manage HTTP/2 settings. 管理 HTTP/2 协议支持，HTTP/2 提供多路复用、头部压缩等性能优化。'
  );

  http2
    .command('status')
    .description(
      'Get HTTP/2 setting. 获取当前 HTTP/2 支持状态，查看是否已启用 HTTP/2 协议。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Enable HTTP/2. 启用 HTTP/2 协议支持，提升页面加载性能。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Disable HTTP/2. 禁用 HTTP/2 协议支持，回退到 HTTP/1.1。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateHTTP2('off', options.zoneId);
        formatSuccess('HTTP/2 disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  const tls = ssl.command('tls').description(
    'Manage TLS settings. 管理 TLS 版本配置，控制允许的最低 TLS 版本以平衡安全性和兼容性。'
  );

  tls
    .command('version')
    .description(
      'Get Minimum TLS Version setting. 获取当前最低 TLS 版本设置，查看允许的最低加密协议版本。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Set Minimum TLS Version. 设置允许的最低 TLS 版本，较低版本兼容性更好但安全性较低，较高版本更安全但可能排除部分旧客户端。'
    )
    .requiredOption('-v, --version <version>', 'TLS version (1.0, 1.1, 1.2, 1.3). TLS 版本：1.0（最兼容，安全性最低）、1.1、1.2（推荐）、1.3（最安全，兼容性最低）。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
