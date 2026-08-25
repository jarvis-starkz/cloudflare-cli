/**
 * @file Integration tests — verify ALL command modules register correctly
 * and the registry auto-discovers them.
 *
 * This test leverages the P3 Command Registry to validate every command module
 * without manually duplicating each module's subcommand list.
 *
 * Strategy:
 *   1. Build the real cfcli program (same as src/index.js does)
 *   2. Build the registry from the program
 *   3. Assert each top-level command exists with expected subcommands
 *   4. Assert all leaf commands have at least a description
 *   5. Assert destructive commands (delete/remove/clear) exist and are flagged
 */

const { Command } = require('commander');
const { buildRegistry, flattenCommands, countCommands } = require('../../src/utils/registry');

// Import ALL command modules — same as src/index.js
const zoneCommands = require('../../src/commands/zone');
const dnsCommands = require('../../src/commands/dns');
const firewallCommands = require('../../src/commands/firewall');
const wafCommands = require('../../src/commands/waf');
const sslCommands = require('../../src/commands/ssl');
const workerCommands = require('../../src/commands/workers');
const kvCommands = require('../../src/commands/kv');
const r2Commands = require('../../src/commands/r2');
const pagesCommands = require('../../src/commands/pages');
const waitingRoomCommands = require('../../src/commands/waiting-room');
const customPagesCommands = require('../../src/commands/custom-pages');
const ipListsCommands = require('../../src/commands/ip-lists');
const loadBalancerCommands = require('../../src/commands/load-balancer');
const healthChecksCommands = require('../../src/commands/health-checks');
const pageRulesCommands = require('../../src/commands/page-rules');
const streamCommands = require('../../src/commands/stream');
const accessCommands = require('../../src/commands/access');
const apiShieldCommands = require('../../src/commands/api-shield');
const spectrumCommands = require('../../src/commands/spectrum');
const enterpriseCommands = require('../../src/commands/enterprise');
const accountCommands = require('../../src/commands/account');
const cacheCommands = require('../../src/commands/cache');
const notificationCommands = require('../../src/commands/notification');
const certificateCommands = require('../../src/commands/certificate');
const rulesetsCommands = require('../../src/commands/rulesets');
const configCommands = require('../../src/commands/config');
const commandsCommands = require('../../src/commands/commands');
const guiCommands = require('../../src/commands/gui');
const tuiCommands = require('../../src/commands/tui');
const completionCommands = require('../../src/commands/completion');
const profileCommands = require('../../src/commands/profile');

// Build the real program tree
function buildProgram() {
  const program = new Command();
  program.name('cfcli').description('Cloudflare CLI').version('1.0.0');
  program.option('-v, --verbose', 'Verbose');
  program.option('--profile <name>', 'Profile');
  program.option('--token <token>', 'Ad-hoc token');

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
  configCommands(program);
  commandsCommands(program);
  guiCommands(program);
  tuiCommands(program);
  completionCommands(program);
  profileCommands(program);

  return program;
}

// Expected top-level commands (name => min subcommand count)
const EXPECTED_TOP_COMMANDS = {
  zone: 0,
  dns: 2,
  firewall: 2,
  waf: 2,
  ssl: 2,
  workers: 2,
  kv: 2,
  r2: 2,
  pages: 2,
  'waiting-room': 2,
  'custom-pages': 2,
  'ip-lists': 2,
  'load-balancer': 2,
  'health-checks': 2,
  'page-rules': 2,
  stream: 2,
  access: 2,
  'api-shield': 2,
  spectrum: 2,
  enterprise: 2,
  account: 2,
  cache: 2,
  notification: 2,
  certificate: 2,
  rulesets: 2,
  config: 2,
  commands: 4,
  gui: 0,
  tui: 0,
  completion: 4,
  profile: 5,
};

describe('Command Module Integration — Registry Auto-Discovery', () => {
  let program, registry, flat;

  beforeAll(() => {
    program = buildProgram();
    registry = buildRegistry(program);
    flat = flattenCommands(registry);
    // Defensive: ensure we got results
    if (!registry || !registry.commands) {
      throw new Error('buildRegistry returned invalid result');
    }
  });

  describe('All command modules register successfully', () => {
    it('registers 30+ top-level commands', () => {
      expect(registry.commands.length).toBeGreaterThanOrEqual(30);
    });

    it('discovers 300+ total commands (including subcommands)', () => {
      expect(countCommands(registry)).toBeGreaterThanOrEqual(300);
    });

    Object.keys(EXPECTED_TOP_COMMANDS).forEach(topName => {
      it(`registers "${topName}" as a top-level command`, () => {
        const found = registry.commands.find(c => c.name === topName);
        expect(found).toBeDefined();
        expect(found.description.length).toBeGreaterThan(0);
      });

      if (EXPECTED_TOP_COMMANDS[topName] > 0) {
        it(`"${topName}" has at least ${EXPECTED_TOP_COMMANDS[topName]} subcommand(s)`, () => {
          const found = registry.commands.find(c => c.name === topName);
          expect(found.subcommands.length).toBeGreaterThanOrEqual(EXPECTED_TOP_COMMANDS[topName]);
        });
      }
    });
  });

  describe('All leaf commands have descriptions', () => {
    it('all leaf commands have non-empty descriptions', () => {
      expect(flat).toBeDefined();
      expect(flat.length).toBeGreaterThan(0);
      const noDesc = flat.filter(c => !c.description || c.description.length === 0);
      expect(noDesc).toEqual([]);
    });
  });

  describe('Destructive commands are identifiable', () => {
    it('finds destructive commands in the registry', () => {
      const destructive = (flat || []).filter(c =>
        /delete|remove|clear|bulk-delete|purge/.test(c.path)
      );
      expect(destructive.length).toBeGreaterThan(0);
    });

    // Known destructive commands that must exist
    const REQUIRED_DESTRUCTIVE = [
      'dns delete',
      'dns bulk-delete',
      'config clear',
      'profile remove',
    ];

    REQUIRED_DESTRUCTIVE.forEach(path => {
      it(`"${path}" is registered as a destructive command`, () => {
        const found = (flat || []).find(c => c.path === path);
        expect(found).toBeDefined();
      });
    });
  });

  describe('P3 commands (commands/gui/tui/completion/profile) are registered', () => {
    it('registers "commands" with list/json/tree/markdown subcommands', () => {
      const cmds = registry.commands.find(c => c.name === 'commands');
      const subNames = cmds.subcommands.map(s => s.name);
      expect(subNames).toContain('list');
      expect(subNames).toContain('json');
      expect(subNames).toContain('tree');
      expect(subNames).toContain('markdown');
    });

    it('registers "completion" with bash/zsh/fish/powershell subcommands', () => {
      const comp = registry.commands.find(c => c.name === 'completion');
      const subNames = comp.subcommands.map(s => s.name);
      expect(subNames).toContain('bash');
      expect(subNames).toContain('zsh');
      expect(subNames).toContain('fish');
      expect(subNames).toContain('powershell');
    });

    it('registers "profile" with list/use/add/remove/current subcommands', () => {
      const prof = registry.commands.find(c => c.name === 'profile');
      const subNames = prof.subcommands.map(s => s.name);
      expect(subNames).toContain('list');
      expect(subNames).toContain('use');
      expect(subNames).toContain('add');
      expect(subNames).toContain('remove');
      expect(subNames).toContain('current');
    });

    it('registers "gui" as a leaf command with --port option', () => {
      const gui = flat.find(c => c.path === 'gui');
      expect(gui).toBeDefined();
      const portOpt = gui.options.find(o => o.flags.includes('--port'));
      expect(portOpt).toBeDefined();
    });

    it('registers "tui" as a leaf command', () => {
      const tui = flat.find(c => c.path === 'tui');
      expect(tui).toBeDefined();
    });
  });

  describe('Global options are captured', () => {
    it('captures --profile global option', () => {
      const flags = registry.globalOptions.map(o => o.flags);
      expect(flags.some(f => f.includes('--profile'))).toBe(true);
    });

    it('captures --token global option', () => {
      const flags = registry.globalOptions.map(o => o.flags);
      expect(flags.some(f => f.includes('--token'))).toBe(true);
    });

    it('captures --verbose global option', () => {
      const flags = registry.globalOptions.map(o => o.flags);
      expect(flags.some(f => f.includes('--verbose'))).toBe(true);
    });
  });
});
