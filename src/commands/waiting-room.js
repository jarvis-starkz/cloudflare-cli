const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function waitingRoomCommands(program) {
  const wr = program.command('waiting-room').description('Manage Cloudflare Waiting Room');

  wr
    .command('list')
    .description('List all waiting rooms')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
            queue_all: room.queue_all ? 'Yes' : 'No',
            new_users_per_minute: room.new_users_per_minute || '-',
            total_active_users: room.total_active_users || '-',
            disabled: room.disabled ? 'Yes' : 'No'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Host', accessor: 'host' },
            { header: 'Path', accessor: 'path' },
            { header: 'Queue All', accessor: 'queue_all' },
            { header: 'New Users/min', accessor: 'new_users_per_minute' },
            { header: 'Active Users', accessor: 'total_active_users' },
            { header: 'Disabled', accessor: 'disabled' }
          ]);
          formatSuccess(`Found ${data.length} waiting room(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('get')
    .description('Get a waiting room details')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
            queue_all: room.queue_all ? 'Yes' : 'No',
            new_users_per_minute: room.new_users_per_minute || '-',
            total_active_users: room.total_active_users || '-',
            session_duration: room.session_duration || '-',
            disabled: room.disabled ? 'Yes' : 'No',
            created_on: room.created_on || '-',
            modified_on: room.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Host', accessor: 'host' },
            { header: 'Path', accessor: 'path' },
            { header: 'Queue All', accessor: 'queue_all' },
            { header: 'New Users/min', accessor: 'new_users_per_minute' },
            { header: 'Active Users', accessor: 'total_active_users' },
            { header: 'Session Duration', accessor: 'session_duration' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('status')
    .description('Get waiting room status')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getWaitingRoomStatus(options.id, options.zoneId);
        const status = result.result;

        formatTable([{
          status: status.status || 'unknown',
          event_active: status.event_active ? 'Yes' : 'No',
          queue_is_full: status.queue_is_full ? 'Yes' : 'No',
          estimated_queued_users: status.estimated_queued_users || 0,
          estimated_total_active_users: status.estimated_total_active_users || 0,
          max_queued_users: status.max_queued_users || 0
        }], [
          { header: 'Status', accessor: 'status' },
          { header: 'Event Active', accessor: 'event_active' },
          { header: 'Queue Full', accessor: 'queue_is_full' },
          { header: 'Queued Users', accessor: 'estimated_queued_users' },
          { header: 'Active Users', accessor: 'estimated_total_active_users' },
          { header: 'Max Queued', accessor: 'max_queued_users' }
        ]);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('create')
    .description('Create a new waiting room')
    .requiredOption('-n, --name <name>', 'Waiting room name')
    .requiredOption('--host <host>', 'Host (e.g., example.com)')
    .requiredOption('--path <path>', 'Path (e.g., /api/*)')
    .option('--new-users <count>', 'New users per minute threshold', '100')
    .option('--total-users <count>', 'Total active users threshold', '1000')
    .option('--queue-all', 'Queue all traffic', false)
    .option('--session-duration <seconds>', 'Session duration in seconds', '300')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
        formatSuccess(`Waiting room created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('update')
    .description('Update a waiting room')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-n, --name <name>', 'Waiting room name')
    .option('--host <host>', 'Host')
    .option('--path <path>', 'Path')
    .option('--new-users <count>', 'New users per minute threshold')
    .option('--total-users <count>', 'Total active users threshold')
    .option('--queue-all', 'Queue all traffic', true)
    .option('--no-queue-all', 'Disable queue all traffic', false)
    .option('--session-duration <seconds>', 'Session duration in seconds')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateWaitingRoom(options.id, options.zoneId, data);
        formatSuccess(`Waiting room updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('enable')
    .description('Enable a waiting room')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaitingRoom(options.id, options.zoneId, {
          disabled: false
        });
        formatSuccess(`Waiting room enabled: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('disable')
    .description('Disable a waiting room')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateWaitingRoom(options.id, options.zoneId, {
          disabled: true
        });
        formatSuccess(`Waiting room disabled: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('delete')
    .description('Delete a waiting room')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteWaitingRoom(options.id, options.zoneId);
        formatSuccess(`Waiting room deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  wr
    .command('events')
    .description('List events for a waiting room')
    .requiredOption('-i, --id <id>', 'Waiting room ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
            { header: 'Name', accessor: 'name' },
            { header: 'Start Time', accessor: 'event_start_time' },
            { header: 'End Time', accessor: 'event_end_time' },
            { header: 'Description', accessor: 'description' }
          ]);
          formatSuccess(`Found ${data.length} event(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = waitingRoomCommands;
