const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function accountCommands(program) {
  const account = program.command('account').description('Manage Cloudflare Account');

  account
    .command('verify')
    .description('Verify API token')
    .action(async () => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.verifyToken();
        formatSuccess('API token is valid');
        formatInfo(`Token status: ${result.result.status}`);
        if (result.result.expires_on) {
          formatInfo(`Expires on: ${result.result.expires_on}`);
        }
      } catch (error) {
        formatError(`Token verification failed: ${error.message}`);
      }
    });

  account
    .command('list')
    .description('List all accounts')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAccounts();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(acc => ({
            id: acc.id,
            name: acc.name,
            type: acc.type || '-',
            created_on: acc.created_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Type', accessor: 'type' },
            { header: 'Created', accessor: 'created_on' }
          ]);
          formatSuccess(`Found ${data.length} account(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  account
    .command('get')
    .description('Get account details')
    .option('-a, --account-id <accountId>', 'Account ID (defaults to configured account)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getAccount(options.accountId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const acc = result.result;
          formatTable([{
            id: acc.id,
            name: acc.name,
            type: acc.type || '-',
            created_on: acc.created_on || '-',
            enforce_twofactor: acc.settings?.enforce_twofactor ? 'Yes' : 'No'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Type', accessor: 'type' },
            { header: 'Created', accessor: 'created_on' },
            { header: '2FA Enforced', accessor: 'enforce_twofactor' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  const members = account.command('members').description('Manage Account Members');

  members
    .command('list')
    .description('List account members')
    .option('-a, --account-id <accountId>', 'Account ID (defaults to configured account)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const accountId = options.accountId || program.opts().config.accountId;
        const result = await client.listMembers({ account_id: accountId });

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(member => ({
            id: member.id,
            email: member.user?.email || '-',
            status: member.status,
            roles: member.roles?.map(r => r.name).join(', ') || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Email', accessor: 'email' },
            { header: 'Status', accessor: 'status' },
            { header: 'Roles', accessor: 'roles' }
          ]);
          formatSuccess(`Found ${data.length} member(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = accountCommands;
