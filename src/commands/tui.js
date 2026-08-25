/**
 * @file `cfcli tui` — Interactive Terminal UI that auto-discovers all CLI commands.
 *
 * Architecture:
 *   1. Build the program tree (same as CLI)
 *   2. Extract registry JSON via registry.js
 *   3. Show an interactive menu (inquirer) of all commands grouped by top-level
 *   4. For the selected command, prompt for each option
 *   5. Execute the command via program.parseAsync and show the output
 *
 * When a new command module is added to src/commands/, the TUI
 * AUTOMATICALLY displays it — zero TUI changes needed.
 *
 * Uses `inquirer` (already a project dependency) — no new deps required.
 */

const inquirer = require('inquirer');
const { buildRegistry, flattenCommands } = require('../utils/registry');
const { loadProfiles, getActiveProfileName, setActiveProfileName } = require('../utils/profiles');
const { formatInfo, formatSuccess, formatError, formatWarning } = require('../utils/formatter');

function tuiModule(program) {
  program
    .command('tui')
    .description('Launch an interactive Terminal UI that auto-discovers all CLI commands')
    .action(async () => {
      // --- Profile selection (P3+) ---
      const profiles = loadProfiles();
      const profileNames = Object.keys(profiles);
      let activeProfile = getActiveProfileName();
      let profileFlag = [];

      if (profileNames.length > 0) {
        const choices = [
          { name: `(default / env)${!activeProfile ? ' ✓' : ''}`, value: '' },
          ...profileNames.map(n => ({
            name: `${n}${n === activeProfile ? ' ✓' : ''}`,
            value: n,
          })),
        ];
        const { selectedProfile } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedProfile',
            message: 'Select a Cloudflare profile:',
            choices,
            default: activeProfile || '',
          },
        ]);
        if (selectedProfile) {
          activeProfile = selectedProfile;
          setActiveProfileName(selectedProfile);
          profileFlag = ['--profile', selectedProfile];
          formatSuccess(`Using profile: ${selectedProfile}`);
        } else if (activeProfile) {
          // Clear active profile
          activeProfile = null;
          const fs = require('fs');
          const path = require('path');
          const activeFile = path.join(__dirname, '..', '..', 'config', '.active-profile');
          if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
          formatInfo('Using default config (env / config.json).');
        }
      } else {
        formatInfo('No profiles saved. Using default config. Use `cfcli profile add <name>` to create one.');
      }

      // --- Build command registry ---
      const registry = buildRegistry(program);
      const flat = flattenCommands(registry);

      // Group commands by top-level category
      const groups = {};
      flat.forEach(c => {
        const top = c.path.split(' ')[0];
        if (!groups[top]) groups[top] = [];
        groups[top].push(c);
      });

      // Build inquirer choices with category separators
      const choices = [];
      Object.keys(groups).sort().forEach(top => {
        choices.push(new inquirer.Separator(`── ${top} ──`));
        groups[top].forEach(c => {
          choices.push({
            name: `  ${c.path}${c.description ? '  — ' + c.description : ''}`,
            value: c,
            short: c.path,
          });
        });
      });
      choices.push(new inquirer.Separator('────────────'));
      choices.push({ name: '  Exit', value: 'exit', short: 'Exit' });

      // Main command selection loop
      let running = true;
      while (running) {
      // B3: Fuzzy search — two-step: input filter → list selection
      // Step 1: ask for search term (empty = show all)
      const { searchTerm } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchTerm',
          message: 'Search commands (empty for all,Esc+Enter to skip):',
        },
      ]);

      const term = (searchTerm || '').toLowerCase().trim();
      const filteredChoices = term
        ? choices.filter(c => {
            if (c.type === 'separator') return false;
            const name = (c.name || '').toLowerCase();
            const path = (c.value || '').path || '';
            return name.includes(term) || path.toLowerCase().includes(term);
          })
        : choices;

      if (filteredChoices.length === 0) {
        formatInfo('No matching commands. Try again.');
        continue;
      }

      // Step 2: select from filtered list
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: `cfcli — Select a command (${filteredChoices.length} matches):`,
          choices: filteredChoices,
          pageSize: 20,
        },
      ]);

        if (selected === 'exit') {
          running = false;
          break;
        }

        // Prompt for each option of the selected command
        const cmd = selected;
        const prompts = [];

        (cmd.options || []).forEach(opt => {
          // Parse option flags to determine type
          const isBoolean = !opt.flags.includes('<') && !opt.flags.includes('[');
          const shortFlag = opt.flags.match(/-\w,/);
          const longFlag = opt.flags.match(/--[\w-]+/);
          const flagLabel = longFlag ? longFlag[0] : (shortFlag ? shortFlag[0].replace(',', '') : opt.flags);

          if (isBoolean) {
            prompts.push({
              type: 'confirm',
              name: opt.flags,
              message: `${opt.description} (${opt.flags})?`,
              default: false,
            });
          } else {
            prompts.push({
              type: 'input',
              name: opt.flags,
              message: `${opt.description} (${opt.flags})`,
              default: opt.defaultValue || '',
            });
          }
        });

        const answers = prompts.length
          ? await inquirer.prompt(prompts)
          : {};

        // Build the args array (prepend --profile if set)
        const args = [...profileFlag, cmd.path];
        Object.entries(answers).forEach(([flags, value]) => {
          if (value === '' || value === false || value === undefined) return;
          const longFlag = flags.match(/--[\w-]+/);
          const flag = longFlag ? longFlag[0] : flags;
          if (value === true) {
            args.push(flag);
          } else {
            args.push(flag, String(value));
          }
        });

        // Show the command preview
        const previewParts = profileFlag.length ? ['cfcli', ...profileFlag, ...args.slice(profileFlag.length)] : ['cfcli', ...args];
        console.log('\n  > ' + previewParts.join(' ') + '\n');

        // Confirm before destructive commands
        const isDestructive = /delete|bulk-delete|clear|remove/.test(cmd.path);
        if (isDestructive) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: formatWarning('This is a DESTRUCTIVE operation. Proceed?'),
              default: false,
            },
          ]);
          if (!confirm) {
            formatInfo('Aborted.');
            continue;
          }
        }

        // Execute the command
        try {
          await program.parseAsync(['node', 'cfcli', ...args], { from: 'user' });
        } catch (err) {
          formatError(`Command failed: ${err.message}`);
        }

        // Pause before returning to menu
        console.log('');
        await inquirer.prompt([
          {
            type: 'input',
            name: '_pause',
            message: 'Press Enter to continue...',
          },
        ]);
      }

      formatSuccess('Goodbye!');
    });
}

module.exports = tuiModule;
