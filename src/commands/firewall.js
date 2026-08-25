const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson } = require('../utils/formatter');

function firewallCommands(program) {
  const fw = program.command('firewall').description(
    'Manage Firewall Rules. 管理防火墙规则、访问控制规则和账户级访问规则，支持基于过滤表达式的精细流量控制。'
  );

  fw
    .command('list')
    .description(
      'List firewall rules. 列出指定 Zone 的所有防火墙规则，显示规则 ID、描述、动作、过滤表达式和暂停状态。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description(
      'Add a firewall rule. 创建新的防火墙规则，基于过滤表达式对匹配流量执行指定动作（阻止、质询、放行等）。'
    )
    .requiredOption('-d, --description <description>', 'Rule description. 规则描述，用于标识该规则的用途。')
    .requiredOption('-a, --action <action>', 'Action (block, challenge, js_challenge, allow, log, bypass). 规则动作：block（阻止）、challenge（质询）、js_challenge（JS 质询）、allow（放行）、log（记录）、bypass（绕过）。')
    .requiredOption('-f, --filter <expression>', 'Filter expression (e.g., "ip.src eq 1.2.3.4"). 过滤表达式，使用 Cloudflare Firewall Rules 语言，如 "ip.src eq 1.2.3.4"。')
    .option('--paused', 'Create rule in paused state. 以暂停状态创建规则，规则创建后不会立即生效。', false)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Update a firewall rule. 更新现有防火墙规则的描述、动作或过滤表达式。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 防火墙规则的唯一标识符。')
    .requiredOption('-d, --description <description>', 'Rule description. 规则描述，用于标识该规则的用途。')
    .requiredOption('-a, --action <action>', 'Action (block, challenge, js_challenge, allow, log, bypass). 规则动作：block（阻止）、challenge（质询）、js_challenge（JS 质询）、allow（放行）、log（记录）、bypass（绕过）。')
    .requiredOption('-f, --filter <expression>', 'Filter expression. 过滤表达式，使用 Cloudflare Firewall Rules 语言。')
    .option('--paused', 'Pause the rule. 暂停该规则，使其暂时不生效。')
    .option('--no-paused', 'Unpause the rule. 取消暂停，恢复规则生效。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Delete a firewall rule. 删除指定的防火墙规则，此操作不可恢复。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 防火墙规则的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteFirewallRule(options.id, options.zoneId);
        formatSuccess(`Firewall rule deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const access = fw.command('access').description(
    'Manage Access Rules (IP/Country blocking). 管理区域级访问控制规则，支持按 IP、IP 范围、国家/地区或 ASN 进行阻止或放行。'
  );

  access
    .command('list')
    .description(
      'List access rules. 列出指定 Zone 的所有访问控制规则，支持按模式过滤。'
    )
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
    .option('-m, --mode <mode>', 'Filter by mode (block, challenge, whitelist, js_challenge). 按模式过滤：block（阻止）、challenge（质询）、whitelist（白名单）、js_challenge（JS 质询）。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description(
      'Block an IP address or country. 阻止指定 IP 地址、IP 范围、国家/地区或 ASN 的访问。'
    )
    .requiredOption('-t, --target <target>', 'IP address or country code (e.g., "1.2.3.4" or "CN"). 目标值：IP 地址（如 "1.2.3.4"）、国家代码（如 "CN"）、IP 范围或 ASN。')
    .option('--type <type>', 'Target type (ip, ip_range, country, asn). 目标类型：ip（IP 地址）、ip_range（IP 范围）、country（国家）、asn（自治系统号）。', 'ip')
    .option('--notes <notes>', 'Notes for this rule. 规则备注，用于说明阻止原因或用途。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
    .description(
      'Delete an access rule. 删除指定的访问控制规则，此操作不可恢复。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 访问控制规则的唯一标识符。')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone). 区域 ID，默认使用配置中的区域。')
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
  const accountAccess = fw.command('account-access').description(
    'Manage Account-level Access Rules (apply to ALL zones in account · Enterprise). 管理账户级访问控制规则，应用于账户下所有区域（企业版功能）。'
  );

  accountAccess
    .command('list')
    .description(
      'List account-level access rules (applies to all zones). 列出账户级访问控制规则，这些规则将应用于账户下的所有区域。'
    )
    .option('-m, --mode <mode>', 'Filter by mode (block, challenge, whitelist, js_challenge). 按模式过滤：block（阻止）、challenge（质询）、whitelist（白名单）、js_challenge（JS 质询）。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
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
    .description(
      'Block an IP/IP range/Country/ASN at account level (all zones). 在账户级别阻止指定 IP、IP 范围、国家/地区或 ASN，规则将应用于所有区域。'
    )
    .requiredOption('-t, --target <target>', 'Target value (IP, IP range, country code, or ASN). 目标值：IP 地址、IP 范围、国家代码或 ASN。')
    .option('--type <type>', 'Target type (ip, ip_range, country, asn). 目标类型：ip（IP 地址）、ip_range（IP 范围）、country（国家）、asn（自治系统号）。', 'ip')
    .option('--mode <mode>', 'Action mode (block, challenge, whitelist, js_challenge). 动作模式：block（阻止）、challenge（质询）、whitelist（白名单）、js_challenge（JS 质询）。', 'block')
    .option('--notes <notes>', 'Notes for this rule. 规则备注，用于说明阻止原因或用途。')
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
    .description(
      'Update an account-level access rule. 更新现有账户级访问控制规则的动作模式或备注。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 账户级访问控制规则的唯一标识符。')
    .option('--mode <mode>', 'Action mode (block, challenge, whitelist, js_challenge). 动作模式：block（阻止）、challenge（质询）、whitelist（白名单）、js_challenge（JS 质询）。')
    .option('--notes <notes>', 'Notes for this rule. 规则备注，用于说明阻止原因或用途。')
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
    .description(
      'Delete an account-level access rule. 删除指定的账户级访问控制规则，此操作不可恢复。'
    )
    .requiredOption('-i, --id <id>', 'Rule ID. 账户级访问控制规则的唯一标识符。')
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
