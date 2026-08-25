/**
 * @file `cfcli profile` — manage multiple Cloudflare API Token profiles.
 *
 * Subcommands:
 *   cfcli profile list                — list all saved profiles
 *   cfcli profile current             — show the active profile
 *   cfcli profile use <name>          — switch active profile
 *   cfcli profile add <name>          — create/update a profile (prompts for credentials)
 *   cfcli profile remove <name>      — delete a profile [DESTRUCTIVE]
 *   cfcli profile export              — export profiles as JSON (secrets masked)
 *   cfcli profile import --file <f>   — import profiles from JSON file
 *
 * Usage with global --profile flag:
 *   cfcli --profile prod dns list
 *   cfcli --profile staging zone list
 *
 * Usage with --token flag (ad-hoc, not persisted):
 *   cfcli --token cf_xxxxx dns list
 */

const inquirer = require('inquirer');
const {
  loadProfiles,
  saveProfiles,
  getActiveProfileName,
  setActiveProfileName,
  upsertProfile,
  removeProfile,
  resolveProfile,
  PROFILE_SECRET_KEYS,
} = require('../utils/profiles');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatInfo, formatWarning,
} = require('../utils/formatter');

function profileModule(program) {
  const profile = program.command('profile').description('Manage multiple Cloudflare API Token profiles');

  // cfcli profile list
  profile
    .command('list')
    .description('List all saved profiles')
    .option('-j, --json', 'Output as JSON')
    .action((options) => {
      const profiles = loadProfiles();
      const active = getActiveProfileName();
      const names = Object.keys(profiles);

      if (names.length === 0) {
        formatInfo('No profiles saved. Use `cfcli profile add <name>` to create one.');
        return;
      }

      if (options.json) {
        const out = {};
        names.forEach(n => {
          out[n] = { ...profiles[n], _active: n === active };
        });
        formatJSON(out);
        return;
      }

      const data = names.map(n => ({
        name: n,
        active: n === active ? 'Yes' : '',
        accountId: profiles[n].accountId || '',
        zoneId: profiles[n].zoneId || '',
        email: profiles[n].email || '',
      }));
      formatTable(data, ['name', 'active', 'accountId', 'zoneId', 'email']);
    });

  // cfcli profile current
  profile
    .command('current')
    .description('Show the active profile')
    .action(() => {
      const active = getActiveProfileName();
      if (active) {
        formatSuccess(`Active profile: ${active}`);
        const profiles = loadProfiles();
        if (profiles[active]) {
          const p = profiles[active];
          formatInfo(`  accountId: ${p.accountId || '(not set)'}`);
          formatInfo(`  zoneId:    ${p.zoneId || '(not set)'}`);
          formatInfo(`  email:     ${p.email || '(not set)'}`);
          formatInfo(`  apiToken:  ******** (use --token to override, or 'cfcli profile add' to update)`);
        }
      } else {
        formatInfo('No active profile set. Using legacy config (config/config.json + env).');
        formatInfo('Use `cfcli profile add <name>` to create a profile, then `cfcli profile use <name>`.');
      }
    });

  // cfcli profile use <name>
  profile
    .command('use <name>')
    .description('Switch the active profile')
    .action((name) => {
      const profiles = loadProfiles();
      if (!profiles[name]) {
        formatError(`Profile "${name}" not found. Available: ${Object.keys(profiles).join(', ') || '(none)'}`);
        process.exitCode = 1;
        return;
      }
      setActiveProfileName(name);
      formatSuccess(`Switched to profile: ${name}`);
    });

  // cfcli profile add <name>
  profile
    .command('add <name>')
    .description('Create or update a profile (prompts for credentials)')
    .action(async (name) => {
      const existing = loadProfiles();
      const prev = existing[name] || {};

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'accountId',
          message: 'Cloudflare Account ID:',
          default: prev.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '',
        },
        {
          type: 'password',
          name: 'apiToken',
          message: 'Cloudflare API Token (input hidden):',
          default: prev.apiToken ? '(unchanged)' : '',
          mask: '*',
        },
        {
          type: 'input',
          name: 'zoneId',
          message: 'Default Zone ID (optional):',
          default: prev.zoneId || process.env.CLOUDFLARE_ZONE_ID || '',
        },
        {
          type: 'input',
          name: 'email',
          message: 'Account email (optional, for Global API Key auth):',
          default: prev.email || '',
        },
        {
          type: 'confirm',
          name: 'addR2',
          message: 'Configure R2 S3 credentials for this profile?',
          default: !!prev.r2AccessKeyId,
        },
        {
          type: 'input',
          name: 'r2AccessKeyId',
          message: 'R2 Access Key ID:',
          default: prev.r2AccessKeyId || '',
          when: a => a.addR2,
        },
        {
          type: 'password',
          name: 'r2SecretAccessKey',
          message: 'R2 Secret Access Key (input hidden):',
          default: prev.r2SecretAccessKey ? '(unchanged)' : '',
          mask: '*',
          when: a => a.addR2,
        },
      ]);

      // Don't overwrite existing secret if user kept "(unchanged)"
      const fields = { ...answers };
      if (fields.apiToken === '(unchanged)') delete fields.apiToken;
      if (fields.r2SecretAccessKey === '(unchanged)') delete fields.r2SecretAccessKey;
      delete fields.addR2;

      // If creating a new profile (not updating), require apiToken
      if (!prev.name && !fields.apiToken && !process.env.CLOUDFLARE_API_TOKEN) {
        formatError('API Token is required for new profiles.');
        process.exitCode = 1;
        return;
      }

      upsertProfile(name, fields);
      formatSuccess(`Profile "${name}" saved.`);

      // Ask if this should be the active profile
      const { makeActive } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'makeActive',
          message: `Set "${name}" as the active profile?`,
          default: !getActiveProfileName(),
        },
      ]);
      if (makeActive) {
        setActiveProfileName(name);
        formatSuccess(`Active profile is now: ${name}`);
      }
    });

  // cfcli profile remove <name>
  profile
    .command('remove <name>')
    .description('Delete a profile (including keychain secrets) [DESTRUCTIVE]')
    .action((name) => {
      const removed = removeProfile(name);
      if (removed) {
        formatSuccess(`Profile "${name}" removed.`);
      } else {
        formatError(`Profile "${name}" not found.`);
        process.exitCode = 1;
      }
    });

  // cfcli profile export
  profile
    .command('export')
    .description('Export profiles as JSON (secrets masked)')
    .action(() => {
      const profiles = loadProfiles();
      const active = getActiveProfileName();
      const out = {};
      Object.keys(profiles).forEach(n => {
        out[n] = { ...profiles[n], _active: n === active };
        // Mask secrets (they shouldn't be in profiles.json, but just in case)
        PROFILE_SECRET_KEYS.forEach(k => {
          if (out[n][k]) out[n][k] = '********';
        });
      });
      formatJSON(out);
    });

  // cfcli profile import --file <f>
  profile
    .command('import')
    .description('Import profiles from a JSON file')
    .option('-f, --file <file>', 'JSON file to import')
    .action((options) => {
      if (!options.file) {
        formatError('--file is required.');
        process.exitCode = 1;
        return;
      }
      const fs = require('fs');
      if (!fs.existsSync(options.file)) {
        formatError(`File not found: ${options.file}`);
        process.exitCode = 1;
        return;
      }
      try {
        const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        const existing = loadProfiles();
        let count = 0;
        Object.keys(data).forEach(name => {
          if (name.startsWith('_')) return;
          const fields = { ...data[name] };
          delete fields._active;
          upsertProfile(name, fields);
          count++;
        });
        formatSuccess(`Imported ${count} profile(s).`);
      } catch (err) {
        formatError(`Import failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

module.exports = profileModule;
