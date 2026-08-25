/**
 * @file Command Registry — auto-discovers all commands from a Commander program tree.
 *
 * P3 Core: The registry walks the Commander program's command tree recursively
 * and extracts structured metadata (name, description, options, subcommands,
 * aliases, argument signatures). This JSON is the single source of truth for:
 *   - `cfcli commands`   → dump/list commands as JSON or table
 *   - `cfcli gui`        → Web GUI auto-generates forms from the JSON
 *   - `cfcli tui`        → Terminal UI auto-generates menus from the JSON
 *   - `cfcli completion` → Shell completion scripts from the JSON
 *
 * When you add a new command module in src/commands/, the registry
 * AUTOMATICALLY picks it up — no manual registration needed.
 * GUI and TUI never hardcode any command; they only consume this JSON.
 */

/**
 * Extract option metadata from a Commander Command instance.
 * @param {import('commander').Command} cmd
 * @returns {Array<{flags:string, description:string, required:boolean, optional:boolean, defaultValue?:string}>}
 */
function extractOptions(cmd) {
  return cmd.options.map(opt => {
    const meta = {
      flags: opt.flags,
      description: opt.description || '',
      required: opt.required || false,
      optional: opt.optional || false,
    };
    if (opt.defaultValue !== undefined) {
      meta.defaultValue = String(opt.defaultValue);
    }
    return meta;
  });
}

/**
 * Infer the HTTP method from a command path and description.
 * Mapping based on Cloudflare API conventions and command naming patterns.
 * @param {string} path
 * @param {string} description
 * @returns {{method: string, isWrite: boolean, overridesConfig: boolean}}
 */
function inferMethod(path, description) {
  const name = path.split(' ').pop().toLowerCase();
  const desc = (description || '').toLowerCase();
  const isWrite = true;
  let method = 'GET';
  // DELETE operations
  if (/^(delete|remove|rm|destroy|purge)$/.test(name) || desc.includes('delete ') || desc.includes('remove ') || desc.includes('purge ')) {
    method = 'DELETE';
  } else if (/^(create|add|new|import|upload|deploy|publish|activate)$/.test(name) || desc.includes('create ') || desc.includes('add ') || desc.includes('upload ') || desc.includes('deploy ') || desc.includes('publish ')) {
    method = 'POST';
  } else if (/^(update|modify|set|change|apply|edit|patch|enable|disable)$/.test(name) || desc.includes('update ') || desc.includes('modify ') || desc.includes('set ') || desc.includes('enable ') || desc.includes('disable ') || desc.includes('apply ')) {
    method = name === 'patch' ? 'PATCH' : 'PUT';
  } else if (/^(list|get|show|view|export|verify|check|inspect|search|stat|settings|status)$/.test(name) || desc.includes('list ') || desc.includes('get ') || desc.includes('show ') || desc.includes('export ') || desc.includes('verify ')) {
    method = 'GET';
  } else if (name === 'clear' || name === 'reset' || name === 'empty') {
    method = 'DELETE';
  }
  const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const overridesConfig = isWriteOp && (
    method === 'DELETE' ||
    desc.includes('overwrite') ||
    desc.includes('replace') ||
    desc.includes('clear') ||
    desc.includes('reset') ||
    desc.includes('remove') ||
    desc.includes('purge') ||
    (method === 'PUT' && !desc.includes('append') && !desc.includes('add '))
  );
  return { method, isWrite: isWriteOp, overridesConfig };
}

/**
 * Recursively walk a Commander command tree and extract metadata.
 * @param {import('commander').Command} cmd
 * @param {string} parentPath
 * @returns {object}
 */
function walkCommand(cmd, parentPath = '') {
  const name = cmd.name();
  const fullPath = parentPath ? `${parentPath} ${name}` : name;

  const node = {
    name,
    path: fullPath,
    description: cmd.description() || '',
    aliases: cmd.aliases().length ? cmd.aliases() : undefined,
    usage: cmd.usage() || undefined,
    options: extractOptions(cmd).length ? extractOptions(cmd) : [],
    arguments: cmd.registeredArguments && cmd.registeredArguments.length
      ? cmd.registeredArguments.map(arg => ({
          name: arg.name(),
          description: arg.description || '',
          required: arg.required,
        }))
      : undefined,
    subcommands: [],
  };

  // Infer HTTP method + write/override metadata (only for leaf commands with actions)
  const hasAction = typeof cmd.action === 'function' || cmd._actionHandler;
  if (hasAction && (!cmd.commands || cmd.commands.length === 0)) {
    const methodInfo = inferMethod(fullPath, node.description);
    node.method = methodInfo.method;
    node.isWrite = methodInfo.isWrite;
    node.overridesConfig = methodInfo.overridesConfig;
  }

  // Clean up undefined keys for compact JSON
  Object.keys(node).forEach(k => {
    if (node[k] === undefined) delete node[k];
  });

  // Recurse into subcommands
  if (cmd.commands && cmd.commands.length > 0) {
    node.subcommands = cmd.commands
      .filter(sub => sub.name() !== 'help') // skip auto-generated help
      .map(sub => walkCommand(sub, fullPath));
  }

  return node;
}

/**
 * Build the full command registry from a Commander program.
 *
 * @param {import('commander').Command} program
 * @returns {{version:string, name:string, description:string, globalOptions:object[], commands:object[]}}
 */
function buildRegistry(program) {
  const globalOptions = extractOptions(program);

  const commands = (program.commands || [])
    .filter(cmd => cmd.name() !== 'help')
    .map(cmd => walkCommand(cmd));

  return {
    version: program.version() || '0.0.0',
    name: program.name() || 'cfcli',
    description: program.description() || '',
    globalOptions,
    commands,
  };
}

/**
 * Flatten the command tree into a list of leaf commands (commands with actions).
 * Useful for shell completion and command listings.
 *
 * @param {object} registry
 * @returns {Array<{path:string, description:string, options:object[]}>}
 */
function flattenCommands(registry) {
  const result = [];

  function walk(node) {
    if (!node.subcommands || node.subcommands.length === 0) {
      result.push({
        path: node.path,
        description: node.description,
        options: node.options || [],
        method: node.method,
        isWrite: node.isWrite,
        overridesConfig: node.overridesConfig,
      });
      return;
    }
    node.subcommands.forEach(walk);
  }

  registry.commands.forEach(walk);
  return result;
}

/**
 * Count all commands (including subcommands) in the registry.
 * @param {object} registry
 * @returns {number}
 */
function countCommands(registry) {
  let count = 0;
  function walk(node) {
    count += 1;
    if (node.subcommands) node.subcommands.forEach(walk);
  }
  registry.commands.forEach(walk);
  return count;
}

/**
 * Render the registry as a human-readable table.
 * @param {object} registry
 * @returns {string}
 */
function renderTable(registry) {
  const flat = flattenCommands(registry);
  const lines = [];
  lines.push(`cfcli v${registry.version} — ${countCommands(registry)} commands\n`);
  lines.push('  Command'.padEnd(45) + 'Description');
  lines.push('  ' + '-'.repeat(43) + '  ' + '-'.repeat(35));
  flat.forEach(cmd => {
    const path = `cfcli ${cmd.path}`.slice(0, 43).padEnd(45);
    const desc = (cmd.description || '').slice(0, 35);
    lines.push(`  ${path}${desc}`);
  });
  return lines.join('\n');
}

module.exports = {
  buildRegistry,
  flattenCommands,
  countCommands,
  renderTable,
};
