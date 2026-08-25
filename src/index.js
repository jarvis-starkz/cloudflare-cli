#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { loadConfig } = require('./utils/config');
const { formatVerboseError, formatInfo } = require('./utils/formatter');

const zoneCommands = require('./commands/zone');
const dnsCommands = require('./commands/dns');
const firewallCommands = require('./commands/firewall');
const wafCommands = require('./commands/waf');
const sslCommands = require('./commands/ssl');
const workerCommands = require('./commands/workers');
const kvCommands = require('./commands/kv');
const r2Commands = require('./commands/r2');
const pagesCommands = require('./commands/pages');
const waitingRoomCommands = require('./commands/waiting-room');
const customPagesCommands = require('./commands/custom-pages');
const ipListsCommands = require('./commands/ip-lists');
const loadBalancerCommands = require('./commands/load-balancer');
const healthChecksCommands = require('./commands/health-checks');
const pageRulesCommands = require('./commands/page-rules');
const streamCommands = require('./commands/stream');
const accessCommands = require('./commands/access');
const apiShieldCommands = require('./commands/api-shield');
const spectrumCommands = require('./commands/spectrum');
const enterpriseCommands = require('./commands/enterprise');
const accountCommands = require('./commands/account');
const cacheCommands = require('./commands/cache');
const notificationCommands = require('./commands/notification');
const certificateCommands = require('./commands/certificate');
const configCommands = require('./commands/config');
const rulesetsCommands = require('./commands/rulesets');
// P3: CLI-First architecture — GUI/TUI auto-discover commands via registry
const commandsCommands = require('./commands/commands');
const guiCommands = require('./commands/gui');
const tuiCommands = require('./commands/tui');
const completionCommands = require('./commands/completion');
// P3+: Multi-Profile support
const profileCommands = require('./commands/profile');
const { resolveConfig } = require('./utils/profiles');

const program = new Command();

program
  .name('cfcli')
  .description('Cloudflare CLI - A comprehensive tool for managing Cloudflare configurations')
  .version('1.0.0')
  // P1: verbose errors off by default; -v or --verbose to see context/stack
  .option('-v, --verbose', 'Enable verbose error output (HTTP status, CF code, request id, stack)')
  // P3+: Multi-Profile token switching
  .option('--profile <name>', 'Use a specific saved profile (e.g. --profile prod)')
  .option('--token <token>', 'Use an ad-hoc API token (not persisted)')
  .option('--account-id <id>', 'Override account ID for this command')
  .option('--zone-id <id>', 'Override zone ID for this command');

program.hook('preAction', async (thisCommand) => {
  const opts = thisCommand.opts();
  const config = await resolveConfig({
    profile: opts.profile,
    token: opts.token,
    accountId: opts.accountId,
    zoneId: opts.zoneId,
  });
  thisCommand.setOptionValue('config', config);
});

program
  .command('init')
  .description('Initialize CLI configuration')
  .action(configCommands.init);

program
  .command('verify')
  .description('Verify Cloudflare API token')
  .action(accountCommands.verify);

zoneCommands(program);
dnsCommands(program);
firewallCommands(program);
wafCommands(program);
sslCommands(program);
workerCommands(program);
kvCommands(program);
r2Commands(program);
pagesCommands(program);
waitingRoomCommands(program);
customPagesCommands(program);
ipListsCommands(program);
loadBalancerCommands(program);
healthChecksCommands(program);
pageRulesCommands(program);
streamCommands(program);
accessCommands(program);
apiShieldCommands(program);
spectrumCommands(program);
enterpriseCommands(program);
accountCommands(program);
cacheCommands(program);
notificationCommands(program);
certificateCommands(program);
rulesetsCommands(program);
configCommands(program);  // Register `cfcli config show|clear` subcommands
// P3: Register GUI/TUI/completion/registry commands (auto-discover from program tree)
commandsCommands(program);
guiCommands(program);
tuiCommands(program);
completionCommands(program);
profileCommands(program);  // P3+: Multi-profile token switching

program.addHelpText('after', `
Examples:
  $ cfcli init                                    # Initialize configuration
  $ cfcli verify                                  # Verify API token
  $ cfcli zone list                               # List all zones
  $ cfcli dns list --all                          # List ALL DNS records (auto-pagination)
  $ cfcli dns add --type A --name subdomain --content 1.2.3.4
  $ cfcli firewall list                           # List firewall rules
  $ cfcli waf packages list                       # List WAF packages (legacy)
  $ cfcli rulesets list --zone-id <id>            # List WAF Rulesets v2
  $ cfcli rulesets entrypoint get --phase http_request_firewall_custom
  $ cfcli kv bulk-write --namespace-id <id> --file seed.json
  $ cfcli r2 objects list --bucket my-bucket --all
  $ cfcli -v dns list                             # Verbose error output on failure
  $ cfcli -v -j dns list --all                    # -j (JSON output) + -v works independently

P3 — Auto-Adapting GUI/TUI:
  $ cfcli commands list                           # List all leaf commands
  $ cfcli commands json                           # Dump command registry as JSON
  $ cfcli commands tree                           # Show command tree
  $ cfcli commands markdown                       # Generate Markdown docs
  $ cfcli gui                                     # Launch Web GUI on http://localhost:7700
  $ cfcli gui --port 8080 --no-run               # Read-only Web GUI
  $ cfcli tui                                     # Interactive Terminal UI
  $ cfcli completion bash                         # Generate shell completion

P3+ — Multi-Profile Token Switching:
  $ cfcli profile add prod                        # Create a profile (interactive)
  $ cfcli profile add staging                     # Create another profile
  $ cfcli profile list                            # List all profiles
  $ cfcli profile use prod                         # Switch active profile
  $ cfcli profile current                         # Show active profile
  $ cfcli --profile prod dns list                 # Use prod profile for this command
  $ cfcli --profile staging zone list --all       # Use staging profile
  $ cfcli --token cf_xxxxx dns list               # Ad-hoc token (not persisted)
  $ cfcli --profile prod --zone-id abc123 dns list  # Profile + override

Global options:
  -v, --verbose   Print full error context (HTTP status, CF code, request id, stack)

Destructive-operation safety:
  In interactive (TTY) mode, commands such as *delete* and *bulk-delete* require
  the CFCLI_CONFIRM_DESTRUCTIVE=1 environment variable to proceed. CI/CD (non-TTY)
  environments auto-skip this check. For example:
    $ CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli dns delete --id RECORD_ID

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID     Your Cloudflare Account ID
  CLOUDFLARE_API_TOKEN      Your Cloudflare API Token
  CLOUDFLARE_ZONE_ID        Your Cloudflare Zone ID
  CFCLI_CREDENTIAL_STORE    auto|file|keychain — credential backend
  CFCLI_KEYCHAIN_SERVICE    Service name used in OS Keychain (default: cfcli)
  CFCLI_CONFIRM_DESTRUCTIVE Set to 1 to authorize destructive ops (TTY only)
  CLOUDFLARE_R2_ACCESS_KEY_ID / _SECRET  Credentials for S3-compatible R2 objects

Security note:
  This CLI never hardcodes or uploads credentials. Mutation commands only run when
  YOU explicitly invoke them. Before first destructive run, export a backup of your
  current configuration (e.g. 'cfcli dns list --all --json > backup.json').

For more information, visit: https://developers.cloudflare.com/api/
`);

// Top-level safety net: any unhandled promise rejection inside Commander actions
// should print consistent verbose error instead of Node's default trace.
process.on('unhandledRejection', (reason) => {
  try {
    const verbose = program.opts && program.opts().verbose;
    formatVerboseError(reason instanceof Error ? reason : new Error(String(reason)), !!verbose);
  } catch (_) {
    // Fallback: basic console.error if formatVerboseError fails for any reason.
    // eslint-disable-next-line no-console
    console.error('Unhandled rejection:', reason);
  }
  if (!process.exitCode) process.exitCode = 1;
});

try {
  program.parse();
} catch (err) {
  // Commander throws for .exitOverride() in tests; ignore that in production.
  formatVerboseError(err, program.opts && program.opts().verbose);
  process.exitCode = 1;
}
