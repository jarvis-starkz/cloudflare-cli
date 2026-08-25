const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function accountCommands(program) {
  const account = program.command('account').description('Manage Cloudflare Account. 管理 Cloudflare 账户，支持查看账户信息、验证 Token 及管理账户成员。');

  account
    .command('verify')
    .description('Verify API token. 验证当前 API Token 是否有效，显示 Token 状态和过期时间。')
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
    .description('List all accounts. 列出当前 API Token 可访问的所有账户。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
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
    .description('Get account details. 获取指定账户的详细信息，包括名称、类型、创建时间和双因素认证状态。')
    .option('-a, --account-id <accountId>', 'Account ID. 账户唯一标识符，默认使用配置文件中的 accountId。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
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

  const members = account.command('members').description('Manage Account Members. 管理账户成员，支持查看当前账户下的所有成员及其角色。');

  members
    .command('list')
    .description('List account members. 列出指定账户下的所有成员，显示邮箱、状态和角色信息。')
    .option('-a, --account-id <accountId>', 'Account ID. 账户唯一标识符，默认使用配置文件中的 accountId。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出原始 API 响应数据，便于脚本处理。')
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
