/**
 * @file `cfcli commands` — inspect the command registry.
 *
 * Subcommands:
 *   cfcli commands list          — table of all leaf commands
 *   cfcli commands json          — full registry as JSON (for GUI/TUI consumption)
 *   cfcli commands tree          — indented tree view
 *   cfcli commands markdown      — generate Markdown documentation
 *
 * This is the canonical source for GUI/TUI auto-discovery:
 *   cfcli commands json | cfcli gui --stdin
 *   cfcli commands json > registry.json
 */

const { buildRegistry, flattenCommands, countCommands, renderTable } = require('../utils/registry');
const { formatTable, formatJSON, formatInfo } = require('../utils/formatter');

function commandsModule(program) {
  const cmd = program.command('commands').description('Inspect the command registry (auto-discovered)');

  // cfcli commands list
  cmd
    .command('list')
    .description('List all leaf commands in a table')
    .action(() => {
      const registry = buildRegistry(program);
      console.log(renderTable(registry));
    });

  // cfcli commands json
  cmd
    .command('json')
    .description('Dump full command registry as JSON (for GUI/TUI consumption)')
    .action(() => {
      const registry = buildRegistry(program);
      console.log(JSON.stringify(registry, null, 2));
    });

  // cfcli commands tree
  cmd
    .command('tree')
    .description('Show command tree (indented)')
    .action(() => {
      const registry = buildRegistry(program);
      const lines = [];
      function walk(node, depth) {
        const indent = '  '.repeat(depth);
        const opts = node.options && node.options.length
          ? `  [${node.options.map(o => o.flags).join(', ')}]`
          : '';
        lines.push(`${indent}${node.name} — ${node.description}${opts}`);
        if (node.subcommands) {
          node.subcommands.forEach(sub => walk(sub, depth + 1));
        }
      }
      registry.commands.forEach(c => walk(c, 0));
      console.log(lines.join('\n'));
    });

  // cfcli commands markdown
  cmd
    .command('markdown')
    .description('Generate Markdown documentation from the registry')
    .action(() => {
      const registry = buildRegistry(program);
      const flat = flattenCommands(registry);
      const lines = [];

      lines.push(`# cfcli Command Reference\n`);
      lines.push(`> Auto-generated from the command registry (${countCommands(registry)} commands).\n`);

      // Group by top-level command
      const groups = {};
      flat.forEach(c => {
        const top = c.path.split(' ')[0];
        if (!groups[top]) groups[top] = [];
        groups[top].push(c);
      });

      Object.keys(groups).sort().forEach(top => {
        lines.push(`## ${top}\n`);
        groups[top].forEach(c => {
          lines.push(`### \`${c.path}\``);
          lines.push(`${c.description}\n`);
          if (c.options.length) {
            lines.push('| Option | Description |');
            lines.push('|--------|-------------|');
            c.options.forEach(o => {
              lines.push(`| \`${o.flags}\` | ${o.description} |`);
            });
            lines.push('');
          }
        });
      });

      console.log(lines.join('\n'));
    });
}

module.exports = commandsModule;
