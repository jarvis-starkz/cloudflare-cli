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
