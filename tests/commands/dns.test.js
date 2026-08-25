/**
 * Smoke-test DNS/top-level command parsing via Commander, NOT network calls.
 * We intercept CloudflareClient instantiation to ensure no axios request is made.
 */
/* global describe, it, expect, beforeEach, jest, afterEach */
const { Command } = require('commander');

// Stub config/formatter to avoid real I/O — we only care that command parsing
// reaches the handler with the correct args.
jest.mock('../../src/utils/config', () => ({
  loadConfig: jest.fn(() => ({
    accountId: 'x', zoneId: 'z', apiToken: 't', baseURL: 'https://x',
    format: 'json',
  })),
  saveConfig: jest.fn(),
  clearConfig: jest.fn(),
  showConfig: jest.fn(x => JSON.stringify(x)),
  isDestructiveConfirmed: jest.fn(() => true),
}));

// We don't actually want any commands to execute real network — mock cf-client.
jest.mock('../../src/utils/cf-client', () => jest.fn().mockImplementation(() => ({})));

// Commander programs are stateful — build fresh per test via the dns module
const dnsCommands = require('../../src/commands/dns');
const { formatTable, formatJSON } = require('../../src/utils/formatter');

function buildProgram(argv) {
  const program = new Command();
  program.exitOverride();
  program.option('-j, --json', 'Output JSON');
  program.option('-v, --verbose', 'Verbose output');
  dnsCommands(program);
  // argv here is user-space (no node/cfcli prefix) — prepend node-style placeholders
  // so Commander's default `from: node` parser correctly skips the first two.
  return program.parseAsync([process.execPath, 'cfcli', ...argv]);
}

describe('commands/dns (parsing)', () => {
  const realTable = formatTable;
  const realJson = formatJSON;
  beforeEach(() => {
    // We don't actually care about printed content — just swallow.
    require('../../src/utils/formatter').formatTable = () => '';
    require('../../src/utils/formatter').formatJSON = () => '';
  });
  afterEach(() => {
    require('../../src/utils/formatter').formatTable = realTable;
    require('../../src/utils/formatter').formatJSON = realJson;
  });

  it('parses dns list with --all --type A --name api.example.com', async () => {
    // Patch the actual command handler so we can inspect opts synchronously.
    // We monkey-patch by registering a custom command after dnsCommands — easier:
    // capture the error state. If parseAsync does not throw "Unknown option", OK.
    const program = new Command();
    program.exitOverride();
    dnsCommands(program);
    let parsedOpts;
    let parsedCmd;
    const dnsCmd = program.commands.find(c => c.name() === 'dns');
    const listCmd = dnsCmd.commands.find(c => c.name() === 'list');
    listCmd.action(() => {
      parsedOpts = listCmd.opts();
      parsedCmd = listCmd.args; // list has no positional args
    });
    await program.parseAsync([
      process.execPath,
      'cfcli',
      'dns',
      'list',
      '--all',
      '--type',
      'A',
      '--name',
      'api.example.com',
      '--page',
      '2',
      '--per-page',
      '30',
    ]);

    expect(parsedOpts.all).toBe(true);
    expect(parsedOpts.type).toBe('A');
    expect(parsedOpts.name).toBe('api.example.com');
    expect(parsedOpts.page).toBe('2');
    expect(parsedOpts.perPage).toBe('30');
    expect(parsedCmd).toEqual([]);
  });

  it('dns add --type --name --content proxied requiredOptions enforcements fire', async () => {
    const program = new Command();
    program.exitOverride();
    dnsCommands(program);
    // Missing required --type → should throw
    await expect(
      program.parseAsync([process.execPath, 'cfcli', 'dns', 'add',
        '--name', 'a.example.com', '--content', '1.2.3.4']),
    ).rejects.toThrow();
  });
});
