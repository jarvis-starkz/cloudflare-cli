const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatInfo } = require('../utils/formatter');

function cacheCommands(program) {
  const cache = program.command('cache').description(
    'Manage Cache. 管理缓存清除、缓存设置和开发模式，用于控制 Cloudflare 边缘节点的缓存行为。'
  );

  cache
    .command('purge')
    .description(
      'Purge cache. 清除 Cloudflare 边缘节点的缓存内容，支持按 URL、缓存标签或主机名精确清除，或一键清除全部缓存。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('--everything', 'Purge all cached content. 清除所有缓存内容，适用于全站缓存刷新。', false)
    .option('--urls <urls...>', 'Specific URLs to purge. 指定要清除的 URL 列表，支持多个 URL。')
    .option('--tags <tags...>', 'Specific cache tags to purge. 指定要清除的缓存标签列表，支持多个标签。')
    .option('--hosts <hosts...>', 'Specific hosts to purge. 指定要清除的主机名列表，支持多个主机。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        if (!options.everything && !options.urls && !options.tags && !options.hosts) {
          formatError('Please specify --everything, --urls, --tags, or --hosts');
          return;
        }

        let body = {};
        if (options.everything) {
          body = { purge_everything: true };
        } else if (options.urls) {
          body = { files: options.urls };
        } else if (options.tags) {
          body = { tags: options.tags };
        } else if (options.hosts) {
          body = { hosts: options.hosts };
        }

        const result = await client.purgeCache(options.zoneId, body.purge_everything ? null : body);
        formatSuccess('Cache purge initiated');
        if (result.result?.id) {
          formatInfo(`Purge ID: ${result.result.id}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  cache
    .command('settings')
    .description(
      'Get cache settings. 获取指定 Zone 的缓存配置，包括缓存级别、浏览器缓存 TTL 和开发模式状态。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const zoneId = options.zoneId || program.opts().config.zoneId;

        const result = await client.request('GET', `/zones/${zoneId}/settings/cache_level`);
        formatInfo(`Cache Level: ${result.result.value}`);

        const ttlResult = await client.request('GET', `/zones/${zoneId}/settings/browser_cache_ttl`);
        formatInfo(`Browser Cache TTL: ${ttlResult.result.value} seconds`);

        const devModeResult = await client.request('GET', `/zones/${zoneId}/settings/development_mode`);
        formatInfo(`Development Mode: ${devModeResult.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  cache
    .command('dev-mode')
    .description(
      'Toggle development mode. 开启或关闭开发模式，开启后浏览器缓存 TTL 降为最低，便于开发调试时查看最新内容。'
    )
    .requiredOption('-v, --value <value>', 'on or off. 开发模式开关：on（开启）、off（关闭）。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const zoneId = options.zoneId || program.opts().config.zoneId;
        const result = await client.request('PATCH', `/zones/${zoneId}/settings/development_mode`, {
          value: options.value
        });
        formatSuccess(`Development mode set to: ${result.result.value}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = cacheCommands;
