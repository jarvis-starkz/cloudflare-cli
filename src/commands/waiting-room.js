/**
 * Cloudflare Waiting Room 命令模块。
 *
 * 管理 Cloudflare 等候室功能，用于在高流量事件期间控制网站访问。
 * 等候室可以在网站过载时将访客放入队列中，确保站点稳定运行。
 * 支持创建、更新、启用/禁用等候室，以及查看等候室状态和事件。
 */

const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function waitingRoomCommands(program) {
  const wr = program.command('waiting-room')
    .description('管理 Cloudflare 等候室 (Waiting Room)，用于在高流量期间控制网站访问，将过载的访客放入队列');

  wr
    .command('list')
    .description('列出所有等候室。显示当前区域配置的所有等候室列表，包括名称、主机名、路径、队列状态等基本信息。适用于查看现有等候室配置或进行批量管理。')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listWaitingRooms(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(room => ({
            id: room.id,
            name: room.name,
            description: room.description || '-',
            host: room.host,
            path: room.path || '/',
            queue_all: room.queue_all ? '是' : '否',
            new_users_per_minute: room.new_users_per_minute || '-',
            total_active_users: room.total_active_users || '-',
            disabled: room.disabled ? '是' : '否'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '主机名', accessor: 'host' },
            { header: '路径', accessor: 'path' },
            { header: '全部排队', accessor: 'queue_all' },
            { header: '每分钟新用户数', accessor: 'new_users_per_minute' },
            { header: '活跃用户数', accessor: 'total_active_users' },
            { header: '已禁用', accessor: 'disabled' }
          ]);
          formatSuccess(`找到 ${data.length} 个等候室`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('get')
    .description('获取等候室详细信息。显示指定等候室的完整配置，包括阈值设置、会话持续时间等。适用于查看特定等候室的详细配置或排查问题。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识一个等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaitingRoom(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const room = result.result;
          formatTable([{
            id: room.id,
            name: room.name,
            description: room.description || '-',
            host: room.host,
            path: room.path || '/',
            queue_all: room.queue_all ? '是' : '否',
            new_users_per_minute: room.new_users_per_minute || '-',
            total_active_users: room.total_active_users || '-',
            session_duration: room.session_duration || '-',
            disabled: room.disabled ? '是' : '否',
            created_on: room.created_on || '-',
            modified_on: room.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '主机名', accessor: 'host' },
            { header: '路径', accessor: 'path' },
            { header: '全部排队', accessor: 'queue_all' },
            { header: '每分钟新用户数', accessor: 'new_users_per_minute' },
            { header: '活跃用户数', accessor: 'total_active_users' },
            { header: '会话持续时间', accessor: 'session_duration' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('status')
    .description('获取等候室实时状态。显示等候室的当前运行状态，包括是否处于活动事件、队列是否已满、排队用户数等。适用于监控等候室实时运行状况。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识一个等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaitingRoomStatus(options.id, options.zoneId);
        const status = result.result;

        formatTable([{
          status: status.status || '未知',
          event_active: status.event_active ? '是' : '否',
          queue_is_full: status.queue_is_full ? '是' : '否',
          estimated_queued_users: status.estimated_queued_users || '-',
          estimated_total_active_users: status.estimated_total_active_users || '-',
          max_queued_users: status.max_queued_users || '-'
        }], [
          { header: '状态', accessor: 'status' },
          { header: '事件活动', accessor: 'event_active' },
          { header: '队列已满', accessor: 'queue_is_full' },
          { header: '排队用户数', accessor: 'estimated_queued_users' },
          { header: '活跃用户数', accessor: 'estimated_total_active_users' },
          { header: '最大排队数', accessor: 'max_queued_users' }
        ]);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('create')
    .description('创建新的等候室。为指定主机名和路径创建一个新的等候室配置，可以设置流量阈值来控制何时启用排队。适用于为高流量事件做准备或保护关键页面。')
    .requiredOption('-n, --name <name>', '等候室名称，用于标识该等候室的显示名称')
    .requiredOption('--host <host>', '主机名（例如：example.com），指定要保护的域名')
    .requiredOption('--path <path>', '路径（例如：/api/*），指定要保护的 URL 路径，支持通配符')
    .option('--new-users <count>', '每分钟新用户数阈值，当每分钟新用户数超过此值时启用排队。有效值：正整数。默认值：100', '100')
    .option('--total-users <count>', '总活跃用户数阈值，当活跃用户数超过此值时启用排队。有效值：正整数。默认值：1000', '1000')
    .option('--queue-all', '是否对所有流量排队，而不仅仅是超出阈值的流量。默认值：false', false)
    .option('--session-duration <seconds>', '会话持续时间（秒），用户在队列中等待的时间。有效值：正整数。默认值：300', '300')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const data = {
          name: options.name,
          host: options.host,
          path: options.path,
          new_users_per_minute: parseInt(options.newUsers, 10),
          total_active_users: parseInt(options.totalUsers, 10),
          queue_all: options.queueAll,
          session_duration: parseInt(options.sessionDuration, 10)
        };

        const result = await client.createWaitingRoom(options.zoneId, data);
        formatSuccess(`等候室已创建：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('update')
    .description('更新等候室配置。修改现有等候室的各项参数，如阈值、名称、路径等。适用于调整等候室设置以适应流量模式变化。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识要更新的等候室')
    .option('-n, --name <name>', '新的等候室名称')
    .option('--host <host>', '新的主机名')
    .option('--path <path>', '新的路径')
    .option('--new-users <count>', '新的每分钟新用户数阈值。有效值：正整数')
    .option('--total-users <count>', '新的总活跃用户数阈值。有效值：正整数')
    .option('--queue-all', '启用对所有流量排队', true)
    .option('--no-queue-all', '禁用对所有流量排队', false)
    .option('--session-duration <seconds>', '新的会话持续时间（秒）。有效值：正整数')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const data = {};
        if (options.name) data.name = options.name;
        if (options.host) data.host = options.host;
        if (options.path) data.path = options.path;
        if (options.newUsers) data.new_users_per_minute = parseInt(options.newUsers, 10);
        if (options.totalUsers) data.total_active_users = parseInt(options.totalUsers, 10);
        if (options.queueAll !== undefined) data.queue_all = options.queueAll;
        if (options.sessionDuration) data.session_duration = parseInt(options.sessionDuration, 10);

        if (Object.keys(data).length === 0) {
          formatError('请至少指定一个要更新的选项');
          return;
        }

        const result = await client.updateWaitingRoom(options.id, options.zoneId, data);
        formatSuccess(`等候室已更新：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('enable')
    .description('启用等候室。将已禁用的等候室重新激活，使其开始监控流量并在需要时启用排队。适用于在流量高峰前预先启用等候室。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识要启用的等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaitingRoom(options.id, options.zoneId, {
          disabled: false
        });
        formatSuccess(`等候室已启用：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('disable')
    .description('禁用等候室。临时停用等候室，使其不再监控流量或启用排队。适用于维护期间或不再需要排队保护时。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识要禁用的等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaitingRoom(options.id, options.zoneId, {
          disabled: true
        });
        formatSuccess(`等候室已禁用：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('delete')
    .description('删除等候室。永久移除指定的等候室配置。此操作不可逆，请谨慎使用。适用于清理不再需要的等候室配置。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识要删除的等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteWaitingRoom(options.id, options.zoneId);
        formatSuccess(`等候室已删除：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('events')
    .description('列出等候室事件。显示与指定等候室相关的所有事件，包括事件名称、开始时间、结束时间和描述。适用于查看历史事件或管理计划事件。')
    .requiredOption('-i, --id <id>', '等候室 ID（Waiting Room ID），唯一标识要查看事件的等候室')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID）。如果不指定，则使用配置文件中默认的区域 ID')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listWaitingRoomEvents(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(event => ({
            id: event.id,
            name: event.name || '-',
            event_start_time: event.event_start_time || '-',
            event_end_time: event.event_end_time || '-',
            description: event.description || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: '事件名称', accessor: 'name' },
            { header: '开始时间', accessor: 'event_start_time' },
            { header: '结束时间', accessor: 'event_end_time' },
            { header: '描述', accessor: 'description' }
          ]);
          formatSuccess(`找到 ${data.length} 个事件`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = waitingRoomCommands;
