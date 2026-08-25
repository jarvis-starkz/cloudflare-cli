const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatInfo } = require('../utils/formatter');

function cacheCommands(program) {
  const cache = program.command('cache').description('Manage Cache');

  cache
    .command('purge')
    .description('Purge cache')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('--everything', 'Purge all cached content', false)
    .option('--urls <urls...>', 'Specific URLs to purge')
    .option('--tags <tags...>', 'Specific cache tags to purge')
    .option('--hosts <hosts...>', 'Specific hosts to purge')
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
    .description('Get cache settings')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Toggle development mode')
    .requiredOption('-v, --value <value>', 'on or off')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
