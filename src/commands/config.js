const inquirer = require('inquirer');
const {
  saveConfig, clearConfig, configPath, loadConfig, showConfig: showCfg,
} = require('../utils/config');
const {
  formatSuccess, formatError, formatInfo, formatJSON, formatVerboseError,
  formatTable,
} = require('../utils/formatter');

const configCommands = {
  init: async () => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'credentialStore',
          message: 'Credential storage backend (recommended: OS Keychain):',
          choices: [
            { name: 'OS Keychain (auto, recommended)', value: 'auto' },
            { name: 'OS Keychain only (error if unavailable)', value: 'keychain' },
            { name: 'AES-encrypted JSON file (fallback)', value: 'file' },
          ],
          default: 'auto',
        },
        {
          type: 'input',
          name: 'accountId',
          message: 'Enter your Cloudflare Account ID:',
          validate: input => input.trim() !== '' || 'Account ID is required',
        },
        {
          type: 'password',
          name: 'apiToken',
          message: 'Enter your Cloudflare API Token:',
          mask: '*',
          validate: input => input.trim() !== '' || 'API Token is required',
        },
        {
          type: 'input',
          name: 'zoneId',
          message: 'Enter your default Cloudflare Zone ID (optional, skip with enter):',
        },
        {
          type: 'input',
          name: 'email',
          message: 'Account email (optional — needed for Global API key only):',
        },
      ]);

      const patch = {
        credentialStore: answers.credentialStore,
        accountId: answers.accountId.trim(),
        apiToken: answers.apiToken.trim(),
        zoneId: answers.zoneId ? answers.zoneId.trim() : undefined,
        email: answers.email ? answers.email.trim() : undefined,
      };

      const config = saveConfig(patch);

      formatSuccess('Configuration saved successfully!');
      formatInfo(`Config file:     ${configPath}`);
      // Display masked config (no secrets leaked here)
      showCfg(config, { showSecrets: false });
    } catch (error) {
      formatVerboseError(error, !!process.env.CFCLI_VERBOSE);
    }
  },

  show: async (options, cmd) => {
    try {
      // Support calling both "config show --show-secrets" and old positional
      const showSecrets = !!(options && (options.showSecrets || options.show_secret));
      const config = loadConfig();
      if (!config.accountId && !config.apiToken && !config.zoneId) {
        formatInfo('No configuration found. Run "cfcli init" to set up.');
        return;
      }
      formatInfo('Current configuration (secrets masked by default; use --show-secrets to reveal):');
      if (options && options.json) {
        // showCfg logs and returns the rendered JSON — use the returned string.
        formatJSON(JSON.parse(showCfg(config, { showSecrets })));
        return;
      }
      const rows = [{
        credentialStore: config.credentialStore || 'auto',
        keychainService: config.keychainService || 'cfcli',
        zoneId: config.zoneId || 'Not set',
        accountId: config.accountId || 'Not set',
        apiToken: config.apiToken ? 'Set (hidden)' : 'Not set',
        r2Keys: (config.r2AccessKeyId || config.r2SecretAccessKey) ? 'Set (hidden)' : 'Not set',
        baseURL: config.baseURL || 'Default',
        format: config.format || 'table',
      }];
      // Masked secrets: showCfg returns the full redacted JSON — extract a subset.
      const redacted = JSON.parse(showCfg(config, { showSecrets: !!showSecrets }));
      const tableRows = [{
        credentialStore: rows[0].credentialStore,
        keychainService: rows[0].keychainService,
        zoneId: redacted.zoneId === '********' ? '********' : rows[0].zoneId,
        accountId: redacted.accountId,
        apiToken: redacted.apiToken,
        r2Keys: rows[0].r2Keys,
        baseURL: redacted.baseURL || 'Default',
        format: redacted.format || 'table',
      }];
      formatTable([
        { header: 'Credential store', accessor: 'credentialStore' },
        { header: 'Keychain service', accessor: 'keychainService' },
        { header: 'Zone ID', accessor: 'zoneId' },
        { header: 'Account ID', accessor: 'accountId' },
        { header: 'API Token', accessor: 'apiToken' },
        { header: 'R2 S3 keys', accessor: 'r2Keys' },
        { header: 'Base URL', accessor: 'baseURL' },
        { header: 'Output format', accessor: 'format' },
      ], tableRows);
    } catch (error) {
      // Support both commander passes (options object with parent) and plain call.
      const verbose = options && options.parent && options.parent._optionValues
        ? options.parent._optionValues.verbose
        : !!(cmd && cmd.opts && cmd.opts().verbose);
      formatVerboseError(error, !!verbose);
    }
  },

  clear: async () => {
    try {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '⚠ Clear local config file? (OS Keychain entries are NOT removed — delete them manually via your OS keychain manager if needed)',
          default: false,
        },
      ]);
      if (confirm) {
        clearConfig();
        formatSuccess('Local configuration file cleared.');
        formatInfo('OS Keychain entries remain. To remove them, use the keychain management UI for your OS.');
      } else {
        formatInfo('Operation cancelled.');
      }
    } catch (error) {
      formatVerboseError(error, !!process.env.CFCLI_VERBOSE);
    }
  },
};

function configCommand(program) {
  const config = program.command('config').description('Manage CLI Configuration');

  config
    .command('show')
    .description('Show current configuration (secrets/PII fully masked)')
    .option('--show-secrets', 'Reveal secrets instead of masking (use carefully!)')
    .option('-j, --json', 'Output as JSON')
    .action(configCommands.show);

  config
    .command('clear')
    .description('Clear local configuration file')
    .action(configCommands.clear);
}

module.exports = configCommand;
module.exports.init = configCommands.init;
module.exports.show = configCommands.show;
module.exports.clear = configCommands.clear;
