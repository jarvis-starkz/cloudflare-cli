/**
 * Cloudflare IP 列表命令模块。
 *
 * 管理 Cloudflare IP 列表，用于在防火墙规则、速率限制规则和其他策略中引用 IP 地址集合。
 * 支持创建、删除 IP 列表，以及管理列表中的 IP 地址、重定向 URL、主机名和 ASN。
 * IP 列表可用于批量管理允许或阻止的 IP 地址。
 */

const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function ipListsCommands(program) {
  const ipl = program.command('ip-lists')
    .description('管理 Cloudflare IP 列表，用于在防火墙规则和速率限制中引用 IP 地址集合');

  // IP Lists
  ipl
    .command('list')
    .description('列出所有 IP 列表。显示账户下配置的所有 IP 列表，包括列表名称、类型、项目数量和引用该列表的筛选器数量。适用于查看现有 IP 列表配置。')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listIPLists();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(list => ({
            id: list.id,
            name: list.name,
            description: list.description || '-',
            kind: list.kind || '-',
            num_items: list.num_items || '-',
            num_referencing_filters: list.num_referencing_filters || '-',
            created_on: list.created_on || '-',
            modified_on: list.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '描述', accessor: 'description' },
            { header: '类型', accessor: 'kind' },
            { header: '项目数', accessor: 'num_items' },
            { header: '引用筛选器数', accessor: 'num_referencing_filters' },
            { header: '创建时间', accessor: 'created_on' }
          ]);
          formatSuccess(`找到 ${data.length} 个 IP 列表`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('get')
    .description('获取 IP 列表详细信息。显示指定 IP 列表的完整配置，包括名称、类型、描述、项目数量和创建时间。适用于查看特定 IP 列表的详细配置。')
    .requiredOption('-i, --id <id>', 'IP 列表 ID，唯一标识一个 IP 列表')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getIPList(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const list = result.result;
          formatTable([{
            id: list.id,
            name: list.name,
            description: list.description || '-',
            kind: list.kind || '-',
            num_items: list.num_items || '-',
            num_referencing_filters: list.num_referencing_filters || '-',
            created_on: list.created_on || '-',
            modified_on: list.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: '名称', accessor: 'name' },
            { header: '描述', accessor: 'description' },
            { header: '类型', accessor: 'kind' },
            { header: '项目数', accessor: 'num_items' },
            { header: '引用筛选器数', accessor: 'num_referencing_filters' },
            { header: '创建时间', accessor: 'created_on' },
            { header: '修改时间', accessor: 'modified_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('create')
    .description('创建新的 IP 列表。创建一个新的 IP 地址集合，可用于防火墙规则、速率限制规则等。支持 IP 地址、重定向 URL、主机名和 ASN 类型的列表。')
    .requiredOption('-n, --name <name>', 'IP 列表名称，用于标识该列表的显示名称')
    .requiredOption('-k, --kind <kind>', 'IP 列表类型。有效值：ip（IP 地址列表）、redirect（重定向 URL 列表）、hostname（主机名列表）、asn（ASN 列表）')
    .option('-d, --description <description>', 'IP 列表描述，用于说明该列表的用途')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const data = {
          name: options.name,
          kind: options.kind
        };

        if (options.description) {
          data.description = options.description;
        }

        const result = await client.createIPList(data);
        formatSuccess(`IP 列表已创建：${result.result.id}`);
        formatInfo(`名称：${result.result.name}`);
        formatInfo(`类型：${result.result.kind}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('delete')
    .description('删除 IP 列表。永久移除指定的 IP 列表。注意：如果该列表被防火墙规则或速率限制引用，删除操作可能会影响这些规则的行为。')
    .requiredOption('-i, --id <id>', 'IP 列表 ID，唯一标识要删除的 IP 列表')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteIPList(options.id);
        formatSuccess(`IP 列表已删除：${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // IP List Items
  const items = ipl.command('items')
    .description('管理 IP 列表中的项目，包括添加、删除和查看 IP 地址、重定向 URL、主机名或 ASN');

  items
    .command('list')
    .description('列出 IP 列表中的所有项目。显示指定 IP 列表中包含的所有 IP 地址、重定向 URL、主机名或 ASN。适用于查看列表内容或进行批量管理。')
    .requiredOption('-i, --id <id>', 'IP 列表 ID，唯一标识要查看的 IP 列表')
    .option('-j, --json', '以 JSON 格式输出结果，便于程序化解析或脚本处理')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listIPListItems(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(item => ({
            id: item.id,
            ip: item.ip || '-',
            redirect_url: item.redirect_url || '-',
            hostname: item.hostname || '-',
            asn: item.asn || '-',
            comment: item.comment || '-',
            created_on: item.created_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'IP/重定向/主机名/ASN', accessor: item => item.ip || item.redirect_url || item.hostname || item.asn || '-' },
            { header: '备注', accessor: 'comment' },
            { header: '创建时间', accessor: 'created_on' }
          ]);
          formatSuccess(`找到 ${data.length} 个项目`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  items
    .command('add')
    .description('添加项目到 IP 列表。向指定的 IP 列表中添加一个或多个 IP 地址、重定向 URL、主机名或 ASN。适用于批量添加允许或阻止的地址。')
    .requiredOption('-i, --id <id>', 'IP 列表 ID，唯一标识要添加项目的 IP 列表')
    .requiredOption('--items <items...>', '要添加的项目列表。根据列表类型，可以是 IP 地址（如 192.0.2.1）、CIDR 网段（如 192.0.2.0/24）、重定向 URL（如 https://example.com）、主机名（如 example.com）或 ASN（如 AS12345）')
    .option('--comment <comment>', '为添加的项目添加备注说明')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const items = options.items.map(item => {
          const entry = {};
          if (item.includes('/') && !item.startsWith('AS')) {
            entry.ip = item;
          } else if (item.startsWith('http')) {
            entry.redirect_url = item;
          } else if (item.startsWith('AS')) {
            entry.asn = item;
          } else {
            entry.hostname = item;
          }
          if (options.comment) entry.comment = options.comment;
          return entry;
        });

        const result = await client.createIPListItems(options.id, items);
        formatSuccess(`项目已添加到 IP 列表：${options.id}`);
        formatInfo(`操作 ID：${result.result.operation_id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  items
    .command('delete')
    .description('从 IP 列表中删除项目。从指定的 IP 列表中移除一个或多个项目。适用于清理不再需要的地址或更新列表内容。')
    .requiredOption('-i, --id <id>', 'IP 列表 ID，唯一标识要删除项目的 IP 列表')
    .requiredOption('--item-ids <ids...>', '要删除的项目 ID 列表，每个 ID 唯一标识列表中的一个项目')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteIPListItems(options.id, options.itemIds);
        formatSuccess(`项目已从 IP 列表删除：${options.id}`);
        formatInfo(`操作 ID：${result.result.operation_id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = ipListsCommands;
