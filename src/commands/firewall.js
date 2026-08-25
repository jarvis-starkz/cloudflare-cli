const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson } = require('../utils/formatter');

function firewallCommands(program) {
  const fw = program.command('firewall').description('Manage Firewall Rules');

  fw
    .command('list')
    .description('List firewall rules')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listFirewallRules(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(rule => ({
            id: rule.id,
            description: rule.description || '-',
            action: rule.action || '-',
            filter: rule.filter?.expression || '-',
            paused: rule.paused ? 'Yes' : 'No'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Description', accessor: 'description' },
            { header: 'Action', accessor: 'action' },
            { header: 'Filter', accessor: 'filter' },
            { header: 'Paused', accessor: 'paused' }
          ]);
          formatSuccess(`Found ${data.length} rule(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  fw
    .command('add')
    .description('Add a firewall rule')
    .requiredOption('-d, --description <description>', 'Rule description')
    .requiredOption('-a, --action <action>', 'Action (block, challenge, js_challenge, allow, log, bypass)')
    .requiredOption('-f, --filter <expression>', 'Filter expression (e.g., "ip.src eq 1.2.3.4")')
    .option('--paused', 'Create rule in paused state', false)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const rule = {
          description: options.description,
          action: options.action,
          filter: {
            expression: options.filter,
            paused: options.paused
          }
        };

        const result = await client.createFirewallRule(rule, options.zoneId);
        formatSuccess(`Firewall rule created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  fw
    .command('update')
    .description('Update a firewall rule')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .requiredOption('-d, --description <description>', 'Rule description')
    .requiredOption('-a, --action <action>', 'Action (block, challenge, js_challenge, allow, log, bypass)')
    .requiredOption('-f, --filter <expression>', 'Filter expression')
    .option('--paused', 'Pause the rule')
    .option('--no-paused', 'Unpause the rule')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const rule = {
          description: options.description,
          action: options.action,
          filter: {
            expression: options.filter
          }
        };

        if (options.paused !== undefined) {
          rule.filter.paused = options.paused;
        }

        const result = await client.updateFirewallRule(options.id, rule, options.zoneId);
        formatSuccess(`Firewall rule updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  fw
    .command('delete')
    .description('Delete a firewall rule')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteFirewallRule(options.id, options.zoneId);
        formatSuccess(`Firewall rule deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const access = fw.command('access').description('Manage Access Rules (IP/Country blocking)');

  access
    .command('list')
    .description('List access rules')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-m, --mode <mode>', 'Filter by mode (block, challenge, whitelist, js_challenge)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.mode) params.mode = options.mode;

        const result = await client.listAccessRules(options.zoneId, params);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(rule => ({
            id: rule.id,
            mode: rule.mode,
            configuration: rule.configuration?.value || rule.configuration?.target || '-',
            notes: rule.notes || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Mode', accessor: 'mode' },
            { header: 'Configuration', accessor: 'configuration' },
            { header: 'Notes', accessor: 'notes' }
          ]);
          formatSuccess(`Found ${data.length} access rule(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  access
    .command('block')
    .description('Block an IP address or country')
    .requiredOption('-t, --target <target>', 'IP address or country code (e.g., "1.2.3.4" or "CN")')
    .option('--type <type>', 'Target type (ip, ip_range, country, asn)', 'ip')
    .option('--notes <notes>', 'Notes for this rule')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const configMap = {
          ip: { value: options.target },
          ip_range: { range: options.target },
          country: { geo: options.target },
          asn: { asn: options.target }
        };

        const rule = {
          mode: 'block',
          configuration: configMap[options.type] || configMap.ip,
          notes: options.notes || `Blocked ${options.target}`
        };

        const result = await client.createAccessRule(rule, options.zoneId);
        formatSuccess(`Access rule created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  access
    .command('delete')
    .description('Delete an access rule')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAccessRule(options.id, options.zoneId);
        formatSuccess(`Access rule deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // === Account-level access rules (apply to ALL zones in account) ===
  const accountAccess = fw.command('account-access').description('Manage Account-level Access Rules (apply to ALL zones in account · Enterprise)');

  accountAccess
    .command('list')
    .description('List account-level access rules (applies to all zones)')
    .option('-m, --mode <mode>', 'Filter by mode (block, challenge, whitelist, js_challenge)')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const params = {};
        if (options.mode) params.mode = options.mode;

        const result = await client.listAccountAccessRules(params);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(rule => ({
            id: rule.id,
            mode: rule.mode,
            target: rule.configuration?.target || '-',
            value: rule.configuration?.value || '-',
            notes: rule.notes || '-',
            scope: rule.scope?.name || 'account'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Mode', accessor: 'mode' },
            { header: 'Target', accessor: 'target' },
            { header: 'Value', accessor: 'value' },
            { header: 'Notes', accessor: 'notes' },
            { header: 'Scope', accessor: 'scope' }
          ]);
          formatSuccess(`Found ${data.length} account-level access rule(s) · applies to ALL zones`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  accountAccess
    .command('block')
    .description('Block an IP/IP range/Country/ASN at account level (all zones)')
    .requiredOption('-t, --target <target>', 'Target value (IP, IP range, country code, or ASN)')
    .option('--type <type>', 'Target type (ip, ip_range, country, asn)', 'ip')
    .option('--mode <mode>', 'Action mode (block, challenge, whitelist, js_challenge)', 'block')
    .option('--notes <notes>', 'Notes for this rule')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        const rule = {
          mode: options.mode,
          configuration: {
            target: options.type,
            value: options.target
          },
          notes: options.notes || 'Account-level rule (all zones)'
        };

        const result = await client.createAccountAccessRule(rule);
        formatSuccess(`Account-level access rule created: ${result.result.id}`);
        formatInfo(`Mode: ${result.result.mode}`);
        formatInfo(`Target: ${result.result.configuration.target} = ${result.result.configuration.value}`);
        formatInfo(`Scope: account (applies to ALL zones)`);
      } catch (error) {
        formatError(error.message);
      }
    });

  accountAccess
    .command('update')
    .description('Update an account-level access rule')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .option('--mode <mode>', 'Action mode (block, challenge, whitelist, js_challenge)')
    .option('--notes <notes>', 'Notes for this rule')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const rule = {};
        if (options.mode) rule.mode = options.mode;
        if (options.notes) rule.notes = options.notes;

        const result = await client.updateAccountAccessRule(options.id, rule);
        formatSuccess(`Account-level access rule updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  accountAccess
    .command('delete')
    .description('Delete an account-level access rule')
    .requiredOption('-i, --id <id>', 'Rule ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAccountAccessRule(options.id);
        formatSuccess(`Account-level access rule deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = firewallCommands;
