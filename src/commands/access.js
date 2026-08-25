const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function accessCommands(program) {
  const access = program.command('access').description('Manage Cloudflare Access / Zero Trust (Enterprise)');

  // Applications
  const apps = access.command('apps').description('Manage Access Applications');

  apps
    .command('list')
    .description('List all Access applications')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get an Access application details')
    .requiredOption('-i, --id <id>', 'Application ID')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a new Access application')
    .requiredOption('-n, --name <name>', 'Application name')
    .requiredOption('-d, --domain <domain>', 'Application domain')
    .option('-t, --type <type>', 'Application type (self_hosted, saas, ssh, vnc, brower_isolated, bookmark)', 'self_hosted')
    .option('--session-duration <duration>', 'Session duration (e.g., 24h, 30d)', '24h')
    .option('--auto-redirect', 'Auto redirect to identity', false)
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
    .description('Update an Access application')
    .requiredOption('-i, --id <id>', 'Application ID')
    .option('-n, --name <name>', 'Application name')
    .option('-d, --domain <domain>', 'Application domain')
    .option('-t, --type <type>', 'Application type')
    .option('--session-duration <duration>', 'Session duration')
    .option('--auto-redirect', 'Auto redirect to identity', true)
    .option('--no-auto-redirect', 'Disable auto redirect to identity', false)
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
    .description('Delete an Access application')
    .requiredOption('-i, --id <id>', 'Application ID')
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
  const policies = access.command('policies').description('Manage Access Policies');

  policies
    .command('list')
    .description('List policies for an application')
    .requiredOption('-a, --app-id <appId>', 'Application ID')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a new policy')
    .requiredOption('-a, --app-id <appId>', 'Application ID')
    .requiredOption('-n, --name <name>', 'Policy name')
    .requiredOption('--decision <decision>', 'Decision (allow, deny, non_identity, bypass)')
    .option('--include <include...>', 'Include conditions')
    .option('--precedence <precedence>', 'Policy precedence')
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
    .description('Delete a policy')
    .requiredOption('-a, --app-id <appId>', 'Application ID')
    .requiredOption('-p, --policy-id <policyId>', 'Policy ID')
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
  const groups = access.command('groups').description('Manage Access Groups');

  groups
    .command('list')
    .description('List all Access groups')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a new Access group')
    .requiredOption('-n, --name <name>', 'Group name')
    .requiredOption('--include <include...>', 'Include conditions')
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
    .description('Update an Access group')
    .requiredOption('-i, --id <id>', 'Group ID')
    .option('-n, --name <name>', 'Group name')
    .option('--include <include...>', 'Include conditions')
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
    .description('Delete an Access group')
    .requiredOption('-i, --id <id>', 'Group ID')
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
