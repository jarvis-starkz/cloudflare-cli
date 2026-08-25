const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function streamCommands(program) {
  const stream = program.command('stream').description(
    'Manage Cloudflare Stream (Enterprise - Video). 管理 Cloudflare Stream 视频服务（企业级），包括视频的列出、查看、删除和字幕管理。'
  );

  stream
    .command('list')
    .description('List all videos. 列出所有视频，支持按时间范围过滤和限制返回数量。')
    .option('--limit <limit>', 'Number of videos to return. 返回的视频数量。', '100')
    .option('--before <timestamp>', 'Videos before this timestamp. 仅返回此时间戳之前创建的视频。')
    .option('--after <timestamp>', 'Videos after this timestamp. 仅返回此时间戳之后创建的视频。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description('Get a video details. 获取视频的详细信息，包括 UID、名称、状态、时长、大小、播放地址等。')
    .requiredOption('-i, --id <id>', 'Video UID. 视频的唯一标识符 UID。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description('Delete a video. 删除视频，此操作不可逆。')
    .requiredOption('-i, --id <id>', 'Video UID. 要删除的视频 UID。')
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
  const captions = stream.command('captions').description(
    'Manage Video Captions. 管理视频字幕，支持列出、更新和删除操作。'
  );

  captions
    .command('list')
    .description('List captions for a video. 列出视频的所有字幕，显示语言、标签和状态。')
    .requiredOption('-i, --id <id>', 'Video UID. 视频的唯一标识符 UID。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description('Update a caption. 更新视频字幕的标签信息。')
    .requiredOption('-i, --id <id>', 'Video UID. 视频的唯一标识符 UID。')
    .requiredOption('-l, --language <language>', 'Language code. 字幕语言代码。')
    .option('--label <label>', 'Caption label. 字幕标签。')
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
    .description('Delete a caption. 删除视频字幕，此操作不可逆。')
    .requiredOption('-i, --id <id>', 'Video UID. 视频的唯一标识符 UID。')
    .requiredOption('-l, --language <language>', 'Language code. 要删除的字幕语言代码。')
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
