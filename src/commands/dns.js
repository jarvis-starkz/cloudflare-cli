const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatVerboseError,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

function dnsCommands(program) {
  const dns = program.command('dns').description('Manage DNS Records. 管理 Cloudflare DNS 记录，支持增删改查及批量操作。');

  dns
    .command('list')
    .description('List DNS records. 列出指定 Zone 下的所有 DNS 记录，支持按类型/名称过滤和自动分页。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .option('-t, --type <type>', 'Filter by record type. 按记录类型过滤，有效值: A, AAAA, CNAME, MX, TXT, SRV, NS, PTR, CAA。')
    .option('-n, --name <name>', 'Filter by record name. 按记录名称过滤（完整域名），例如 "sub.example.com"。')
    .option('--page <N>', 'Page number (1-based). 页码（从 1 开始），仅在未使用 --all 时生效。', '1')
    .option('--per-page <N>', 'Page size, default 50. 每页返回的记录数量。', '50')
    .option('--all', 'Fetch ALL records by auto-paging. 自动翻页获取所有记录，忽略 --page 参数。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.type) params.type = options.type;
        if (options.name) params.name = options.name;

        let records;
        if (options.all) {
          records = await client.paginatedList(
            (p) => client.listDnsRecords(options.zoneId, { ...params, ...p }),
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listDnsRecords(options.zoneId, {
            ...params,
            page: Number(options.page),
            per_page: Number(options.perPage),
          });
          records = resp.result;
        }

        if (options.json) {
          formatJSON(records);
        } else {
          const data = records.map(record => ({
            id: record.id,
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied ? 'Yes' : 'No',
            ttl: record.ttl === 1 ? 'Auto' : record.ttl,
            priority: record.priority || '-',
          }));
          formatTable([
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Name', accessor: 'name' },
            { header: 'Content', accessor: 'content' },
            { header: 'Proxied', accessor: 'proxied' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Priority', accessor: 'priority' },
          ], data);
          formatSuccess(`Found ${data.length} record(s)`);
        }
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('get')
    .description('Get a DNS record. 根据记录 ID 获取单条 DNS 记录的详细信息。')
    .requiredOption('-i, --id <id>', 'DNS record ID. DNS 记录的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getDnsRecord(options.id, options.zoneId);
        const record = result.result;
        if (options.json) {
          formatJSON(record);
        } else {
          formatTable([
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Name', accessor: 'name' },
            { header: 'Content', accessor: 'content' },
            { header: 'Proxied', accessor: 'proxied' },
            { header: 'TTL', accessor: 'ttl' },
            { header: 'Priority', accessor: 'priority' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' },
          ], [{
            id: record.id,
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied ? 'Yes' : 'No',
            ttl: record.ttl === 1 ? 'Auto' : record.ttl,
            priority: record.priority || '-',
            created_on: record.created_on || '-',
            modified_on: record.modified_on || '-',
          }]);
        }
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('add')
    .description('Add a DNS record. 在指定 Zone 下新增一条 DNS 记录。')
    .requiredOption('-t, --type <type>', 'Record type. DNS 记录类型，有效值: A, AAAA, CNAME, MX, TXT, SRV, NS, PTR, CAA。')
    .requiredOption('-n, --name <name>', 'Record name. 记录名称（完整域名），例如 "sub.example.com"。')
    .requiredOption('-c, --content <content>', 'Record content. 记录内容，A 记录填 IP 地址，CNAME 填目标域名，MX 填邮件服务器地址。')
    .option('--ttl <ttl>', 'TTL in seconds, default 1 (Auto). 生存时间（秒），1 表示自动，默认值为 1。', '1')
    .option('--proxied', 'Enable Cloudflare proxy. 启用 Cloudflare 代理（小黄云），默认关闭。', false)
    .option('--priority <priority>', 'Priority for MX/SRV. MX/SRV 记录的优先级数值，数值越小优先级越高。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const record = {
          type: options.type,
          name: options.name,
          content: options.content,
          ttl: parseInt(options.ttl, 10),
          proxied: options.proxied,
        };
        if (options.priority) record.priority = parseInt(options.priority, 10);
        const result = await client.createDnsRecord(record, options.zoneId);
        formatSuccess(`DNS record created: ${result.result.name} -> ${result.result.content}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('update')
    .description('Update a DNS record. 更新指定 ID 的 DNS 记录，支持修改类型、名称、内容、TTL 和代理状态。')
    .requiredOption('-i, --id <id>', 'DNS record ID. 要更新的 DNS 记录唯一标识符。')
    .requiredOption('-t, --type <type>', 'Record type. DNS 记录类型，有效值: A, AAAA, CNAME, MX, TXT, SRV, NS, PTR, CAA。')
    .requiredOption('-n, --name <name>', 'Record name. 记录名称（完整域名）。')
    .requiredOption('-c, --content <content>', 'Record content. 记录内容（IP 地址、目标域名等）。')
    .option('--ttl <ttl>', 'TTL in seconds, default 1 (Auto). 生存时间（秒），1 表示自动，默认值为 1。', '1')
    .option('--proxied', 'Enable Cloudflare proxy. 启用 Cloudflare 代理（小黄云）。', false)
    .option('--no-proxied', 'Disable Cloudflare proxy. 禁用 Cloudflare 代理。')
    .option('--priority <priority>', 'Priority for MX/SRV. MX/SRV 记录的优先级数值，数值越小优先级越高。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const record = {
          type: options.type,
          name: options.name,
          content: options.content,
          ttl: parseInt(options.ttl, 10),
        };
        if (options.proxied !== undefined) record.proxied = options.proxied;
        if (options.priority) record.priority = parseInt(options.priority, 10);
        const result = await client.updateDnsRecord(options.id, record, options.zoneId);
        formatSuccess(`DNS record updated: ${result.result.name} -> ${result.result.content}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('delete')
    .description('Delete a DNS record. 删除指定 ID 的单条 DNS 记录。[DESTRUCTIVE — 需要 CFCLI_CONFIRM_DESTRUCTIVE=1 确认执行]')
    .requiredOption('-i, --id <id>', 'DNS record ID. 要删除的 DNS 记录唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .action(async (options) => {
      try {
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive delete in TTY mode without confirmation. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed (CI auto-skips this check).',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteDnsRecord(options.id, options.zoneId);
        formatSuccess(`DNS record deleted: ${result.result.id}`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });

  dns
    .command('bulk-delete')
    .description('Bulk delete DNS records. 按类型和/或名称批量删除 DNS 记录，支持跨页自动获取所有匹配记录。[DESTRUCTIVE — 需要 CFCLI_CONFIRM_DESTRUCTIVE=1 确认执行]')
    .option('-t, --type <type>', 'Delete by type. 按记录类型删除，有效值: A, AAAA, CNAME, MX, TXT, SRV 等。')
    .option('-n, --name <name>', 'Delete by name. 按记录名称删除（支持模糊匹配），例如 "sub.example.com"。')
    .option('-z, --zone-id <zoneId>', 'Zone ID. Zone 唯一标识符，默认使用配置文件中的 zoneId。')
    .action(async (options) => {
      try {
        if (!isDestructiveConfirmed()) {
          formatError(
            'Refusing destructive bulk-delete in TTY mode without confirmation. ' +
            'Set CFCLI_CONFIRM_DESTRUCTIVE=1 to proceed (CI auto-skips this check).',
          );
          process.exitCode = 1;
          return;
        }
        const client = new CloudflareClient(program.opts().config);
        if (!options.type && !options.name) {
          formatError('Please specify --type or --name to filter records');
          return;
        }
        const params = {};
        if (options.type) params.type = options.type;
        if (options.name) params.name = options.name;

        // Use paginated list (getAll) so we never miss records on > 1 page.
        const records = await client.paginatedList(
          (p) => client.listDnsRecords(options.zoneId, { ...params, ...p }),
          { getAll: true },
        );

        if (records.length === 0) {
          formatError('No matching records found');
          return;
        }
        for (const record of records) {
          await client.deleteDnsRecord(record.id, options.zoneId);
        }
        formatSuccess(`Deleted ${records.length} record(s)`);
      } catch (error) {
        formatVerboseError(error, program.opts().verbose);
      }
    });
}

module.exports = dnsCommands;
