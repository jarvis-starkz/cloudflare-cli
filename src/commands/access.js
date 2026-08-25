const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * Access 命令
 *
 * 功能说明：管理 Cloudflare Access（Zero Trust），提供基于身份的应用访问控制。
 * Access 通过身份验证策略和访问控制规则保护内部应用，
 * 支持多种身份提供商（IdP）集成，实现零信任安全架构。
 *
 * 使用场景：
 * - 保护内部应用和仪表板
 * - 配置基于身份的访问控制
 * - 集成企业身份提供商（Okta、Azure AD 等）
 * - 设置 SSH/VNC 应用的安全访问
 * - 管理用户组和访问策略
 */
function accessCommands(program) {
  const access = program.command('access').description('管理 Cloudflare Access / Zero Trust（企业级零信任访问控制，基于身份验证保护应用）');

  // Applications
  const apps = access.command('apps').description('管理 Access 应用 - 配置和保护内部应用程序');

  apps
    .command('list')
    .description('列出所有 Access 应用 - 显示账户下配置的所有 Access 应用及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAccessApplications();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(app => ({
            id: app.id,
            name: app.name,
            domain: app.domain,
            type: app.type || '-',
            session_duration: app.session_duration || '-',
            allowed_idps: app.allowed_idps?.join(', ') || '-',
            auto_redirect_to_identity: app.auto_redirect_to_identity ? 'Yes' : 'No'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Domain', accessor: 'domain' },
            { header: 'Type', accessor: 'type' },
            { header: 'Session Duration', accessor: 'session_duration' },
            { header: 'Auto Redirect', accessor: 'auto_redirect_to_identity' }
          ]);
          formatSuccess(`Found ${data.length} application(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  apps
    .command('get')
    .description('获取 Access 应用详情 - 查看特定 Access 应用的详细配置信息，包括身份提供商和会话设置')
    .requiredOption('-i, --id <id>', '应用 ID（Application ID），指定要查询的 Access 应用')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getAccessApplication(options.id);

        if (options.json) {
          formatJson(result.result);
        } else {
          const app = result.result;
          formatTable([{
            id: app.id,
            name: app.name,
            domain: app.domain,
            type: app.type || '-',
            session_duration: app.session_duration || '-',
            allowed_idps: app.allowed_idps?.join(', ') || '-',
            auto_redirect_to_identity: app.auto_redirect_to_identity ? 'Yes' : 'No',
            enable_binding_cookie: app.enable_binding_cookie ? 'Yes' : 'No',
            cors_headers: app.cors_headers ? 'Yes' : 'No'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Domain', accessor: 'domain' },
            { header: 'Type', accessor: 'type' },
            { header: 'Session Duration', accessor: 'session_duration' },
            { header: 'Allowed IDPs', accessor: 'allowed_idps' },
            { header: 'Auto Redirect', accessor: 'auto_redirect_to_identity' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  apps
    .command('create')
    .description('创建新的 Access 应用 - 配置新的受保护应用，指定域名和访问控制设置')
    .requiredOption('-n, --name <name>', '应用名称，用于标识和管理 Access 应用')
    .requiredOption('-d, --domain <domain>', '应用域名（例如：app.example.com），指定要保护的域名')
    .option('-t, --type <type>', '应用类型（self_hosted, saas, ssh, vnc, brower_isolated, bookmark），指定应用的类型', 'self_hosted')
    .option('--session-duration <duration>', '会话持续时间（例如：24h, 30d），指定用户登录后的会话有效期', '24h')
    .option('--auto-redirect', '自动重定向到身份提供商，用户访问时自动跳转到 IdP 登录', false)
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          domain: options.domain,
          type: options.type,
          session_duration: options.sessionDuration,
          auto_redirect_to_identity: options.autoRedirect
        };

        const result = await client.createAccessApplication(data);
        formatSuccess(`Access application created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  apps
    .command('update')
    .description('更新 Access 应用 - 修改现有 Access 应用的配置设置')
    .requiredOption('-i, --id <id>', '应用 ID（Application ID），指定要更新的 Access 应用')
    .option('-n, --name <name>', '应用名称，修改应用的标识名称')
    .option('-d, --domain <domain>', '应用域名，修改要保护的域名')
    .option('-t, --type <type>', '应用类型，修改应用的类型')
    .option('--session-duration <duration>', '会话持续时间，修改用户登录后的会话有效期')
    .option('--auto-redirect', '启用自动重定向到身份提供商', true)
    .option('--no-auto-redirect', '禁用自动重定向到身份提供商', false)
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.domain) data.domain = options.domain;
        if (options.type) data.type = options.type;
        if (options.sessionDuration) data.session_duration = options.sessionDuration;
        if (options.autoRedirect !== undefined) data.auto_redirect_to_identity = options.autoRedirect;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateAccessApplication(options.id, data);
        formatSuccess(`Access application updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  apps
    .command('delete')
    .description('删除 Access 应用 - 移除 Access 应用，删除后该应用将不再受到 Access 保护')
    .requiredOption('-i, --id <id>', '应用 ID（Application ID），指定要删除的 Access 应用')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAccessApplication(options.id);
        formatSuccess(`Access application deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Policies
  const policies = access.command('policies').description('管理 Access 策略 - 配置应用的访问控制规则');

  policies
    .command('list')
    .description('列出应用策略 - 显示特定应用配置的所有访问策略及其状态信息')
    .requiredOption('-a, --app-id <appId>', '应用 ID（Application ID），指定要查询的应用')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAccessPolicies(options.appId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(policy => ({
            id: policy.id,
            name: policy.name,
            decision: policy.decision,
            include: policy.include?.map(i => i.email?.domain || i.email?.email || i.azureAD || i.github || i.gitlab || i.okta || i.saml || i.anyValidServiceToken || i.loginMethod || i.group || i.externalEvaluation || i.geo || i.ip || i.certificate || i['everyone'] || i.commonName).join(', ') || '-',
            precedence: policy.precedence || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Decision', accessor: 'decision' },
            { header: 'Include', accessor: 'include' },
            { header: 'Precedence', accessor: 'precedence' }
          ]);
          formatSuccess(`Found ${data.length} policy(ies)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('create')
    .description('创建新的策略 - 配置新的访问控制策略，定义允许或拒绝访问的条件')
    .requiredOption('-a, --app-id <appId>', '应用 ID（Application ID），指定要配置策略的应用')
    .requiredOption('-n, --name <name>', '策略名称，用于标识和管理访问策略')
    .requiredOption('--decision <decision>', '策略决策（allow 允许, deny 拒绝, non_identity 非身份验证, bypass 绕过），指定匹配后的操作')
    .option('--include <include...>', '包含条件列表，指定匹配策略的用户或组条件')
    .option('--precedence <precedence>', '策略优先级，数字越小优先级越高，控制策略的评估顺序')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          decision: options.decision,
          include: options.include?.map(i => ({ email: { email: i } })) || []
        };
        if (options.precedence) data.precedence = parseInt(options.precedence, 10);

        const result = await client.createAccessPolicy(options.appId, data);
        formatSuccess(`Policy created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  policies
    .command('delete')
    .description('删除策略 - 移除访问策略，删除后该策略将不再应用于应用')
    .requiredOption('-a, --app-id <appId>', '应用 ID（Application ID），指定要操作的应用')
    .requiredOption('-p, --policy-id <policyId>', '策略 ID（Policy ID），指定要删除的策略')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAccessPolicy(options.appId, options.policyId);
        formatSuccess(`Policy deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Groups
  const groups = access.command('groups').description('管理 Access 用户组 - 配置和管理用户组，用于访问控制');

  groups
    .command('list')
    .description('列出所有 Access 用户组 - 显示账户下配置的所有用户组及其包含条件')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAccessGroups();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(group => ({
            id: group.id,
            name: group.name,
            include: group.include?.map(i => i.email?.domain || i.email?.email || i.azureAD || i.github || i.gitlab || i.okta || i.saml || i.anyValidServiceToken || i.loginMethod || i.group || i.externalEvaluation || i.geo || i.ip || i.certificate || i['everyone'] || i.commonName).join(', ') || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Include', accessor: 'include' }
          ]);
          formatSuccess(`Found ${data.length} group(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  groups
    .command('create')
    .description('创建新的 Access 用户组 - 配置新的用户组，定义组成员条件')
    .requiredOption('-n, --name <name>', '用户组名称，用于标识和管理用户组')
    .requiredOption('--include <include...>', '包含条件列表，指定属于该组的用户条件')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          include: options.include.map(i => ({ email: { email: i } }))
        };

        const result = await client.createAccessGroup(data);
        formatSuccess(`Access group created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  groups
    .command('update')
    .description('更新 Access 用户组 - 修改现有用户组的配置设置')
    .requiredOption('-i, --id <id>', '用户组 ID（Group ID），指定的用户组')
    .option('-n, --name <name>', '用户组名称，修改用户组的标识名称')
    .option('--include <include...>', '包含条件列表，修改属于该组的用户条件')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.include) data.include = options.include.map(i => ({ email: { email: i } }));

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateAccessGroup(options.id, data);
        formatSuccess(`Access group updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  groups
    .command('delete')
    .description('删除 Access 用户组 - 移除用户组，删除后该组将不再可用于访问控制')
    .requiredOption('-i, --id <id>', '用户组 ID（Group ID），指定要删除的用户组')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAccessGroup(options.id);
        formatSuccess(`Access group deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = accessCommands;
