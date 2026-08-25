const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function streamCommands(program) {
  const stream = program.command('stream').description('Manage Cloudflare Stream (Enterprise - Video)');

  stream
    .command('list')
    .description('List all videos')
    .option('--limit <limit>', 'Number of videos to return', '100')
    .option('--before <timestamp>', 'Videos before this timestamp')
    .option('--after <timestamp>', 'Videos after this timestamp')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = { limit: parseInt(options.limit, 10) };
        if (options.before) params.before = options.before;
        if (options.after) params.after = options.after;

        const result = await client.listStreams(params);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(video => ({
            uid: video.uid,
            name: video.name || '-',
            status: video.status?.state || '-',
            duration: video.duration ? `${Math.round(video.duration)}s` : '-',
            size: video.size ? `${Math.round(video.size / 1024 / 1024)}MB` : '-',
            created: video.created || '-',
            ready_to_stream: video.readyToStream ? 'Yes' : 'No'
          }));
          formatTable(data, [
            { header: 'UID', accessor: 'uid' },
            { header: 'Name', accessor: 'name' },
            { header: 'Status', accessor: 'status' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Size', accessor: 'size' },
            { header: 'Ready', accessor: 'ready_to_stream' },
            { header: 'Created', accessor: 'created' }
          ]);
          formatSuccess(`Found ${data.length} video(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  stream
    .command('get')
    .description('Get a video details')
    .requiredOption('-i, --id <id>', 'Video UID')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getStream(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const video = result.result;
          formatTable([{
            uid: video.uid,
            name: video.name || '-',
            status: video.status?.state || '-',
            duration: video.duration ? `${Math.round(video.duration)}s` : '-',
            size: video.size ? `${Math.round(video.size / 1024 / 1024)}MB` : '-',
            created: video.created || '-',
            ready_to_stream: video.readyToStream ? 'Yes' : 'No',
            downloadable: video.downloadable ? 'Yes' : 'No',
            playback_url: video.playback?.hls || '-',
            thumbnail: video.thumbnail || '-'
          }], [
            { header: 'UID', accessor: 'uid' },
            { header: 'Name', accessor: 'name' },
            { header: 'Status', accessor: 'status' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Size', accessor: 'size' },
            { header: 'Ready', accessor: 'ready_to_stream' },
            { header: 'Downloadable', accessor: 'downloadable' },
            { header: 'Playback URL', accessor: 'playback_url' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  stream
    .command('delete')
    .description('Delete a video')
    .requiredOption('-i, --id <id>', 'Video UID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteStream(options.id);
        formatSuccess(`Video deleted: ${options.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Captions
  const captions = stream.command('captions').description('Manage Video Captions');

  captions
    .command('list')
    .description('List captions for a video')
    .requiredOption('-i, --id <id>', 'Video UID')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listStreamCaptions(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(caption => ({
            language: caption.language,
            label: caption.label || '-',
            status: caption.status || '-'
          }));
          formatTable(data, [
            { header: 'Language', accessor: 'language' },
            { header: 'Label', accessor: 'label' },
            { header: 'Status', accessor: 'status' }
          ]);
          formatSuccess(`Found ${data.length} caption(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  captions
    .command('update')
    .description('Update a caption')
    .requiredOption('-i, --id <id>', 'Video UID')
    .requiredOption('-l, --language <language>', 'Language code')
    .option('--label <label>', 'Caption label')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.label) data.label = options.label;

        const result = await client.updateStreamCaption(options.id, options.language, data);
        formatSuccess(`Caption updated: ${options.language}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  captions
    .command('delete')
    .description('Delete a caption')
    .requiredOption('-i, --id <id>', 'Video UID')
    .requiredOption('-l, --language <language>', 'Language code')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteStreamCaption(options.id, options.language);
        formatSuccess(`Caption deleted: ${options.language}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = streamCommands;
