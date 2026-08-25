const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function ipListsCommands(program) {
  const ipl = program.command('ip-lists').description('Manage Cloudflare IP Lists');

  // IP Lists
  ipl
    .command('list')
    .description('List all IP lists')
    .option('-j, --json', 'Output as JSON')
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
            num_items: list.num_items || 0,
            num_referencing_filters: list.num_referencing_filters || 0,
            created_on: list.created_on || '-',
            modified_on: list.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Kind', accessor: 'kind' },
            { header: 'Items', accessor: 'num_items' },
            { header: 'Referencing Filters', accessor: 'num_referencing_filters' },
            { header: 'Created', accessor: 'created_on' }
          ]);
          formatSuccess(`Found ${data.length} IP list(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('get')
    .description('Get an IP list details')
    .requiredOption('-i, --id <id>', 'IP list ID')
    .option('-j, --json', 'Output as JSON')
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
            num_items: list.num_items || 0,
            num_referencing_filters: list.num_referencing_filters || 0,
            created_on: list.created_on || '-',
            modified_on: list.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' },
            { header: 'Kind', accessor: 'kind' },
            { header: 'Items', accessor: 'num_items' },
            { header: 'Referencing Filters', accessor: 'num_referencing_filters' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('create')
    .description('Create a new IP list')
    .requiredOption('-n, --name <name>', 'IP list name')
    .requiredOption('-k, --kind <kind>', 'IP list kind (ip, redirect, hostname, asn)')
    .option('-d, --description <description>', 'IP list description')
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
        formatSuccess(`IP list created: ${result.result.id}`);
        formatInfo(`Name: ${result.result.name}`);
        formatInfo(`Kind: ${result.result.kind}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  ipl
    .command('delete')
    .description('Delete an IP list')
    .requiredOption('-i, --id <id>', 'IP list ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteIPList(options.id);
        formatSuccess(`IP list deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // IP List Items
  const items = ipl.command('items').description('Manage IP List Items');

  items
    .command('list')
    .description('List items in an IP list')
    .requiredOption('-i, --id <id>', 'IP list ID')
    .option('-j, --json', 'Output as JSON')
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
            { header: 'IP/Redirect/Hostname/ASN', accessor: item => item.ip || item.redirect_url || item.hostname || item.asn || '-' },
            { header: 'Comment', accessor: 'comment' },
            { header: 'Created', accessor: 'created_on' }
          ]);
          formatSuccess(`Found ${data.length} item(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  items
    .command('add')
    .description('Add items to an IP list')
    .requiredOption('-i, --id <id>', 'IP list ID')
    .requiredOption('--items <items...>', 'Items to add (IPs, URLs, hostnames, or ASNs)')
    .option('--comment <comment>', 'Comment for the items')
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
        formatSuccess(`Items added to IP list: ${options.id}`);
        formatInfo(`Operation ID: ${result.result.operation_id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  items
    .command('delete')
    .description('Delete items from an IP list')
    .requiredOption('-i, --id <id>', 'IP list ID')
    .requiredOption('--item-ids <ids...>', 'Item IDs to delete')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteIPListItems(options.id, options.itemIds);
        formatSuccess(`Items deleted from IP list: ${options.id}`);
        formatInfo(`Operation ID: ${result.result.operation_id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = ipListsCommands;
