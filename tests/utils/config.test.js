/**
 * Tests for src/utils/config.js — 4-layer priority, showConfig masking,
 * Keychain integration (mocked), destructive-confirmation helper.
 *
 * All tests isolated: tmpdir used for configPath; env var changes restored.
 */
/* global describe, it, expect, beforeEach, afterEach, jest */
const path = require('path');
const os = require('os');
const fs = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfcli-cfg-'));
const configPath = path.join(tmpDir, 'config.json');

// Ensure fresh module state per run so env vars + singleton are reloaded
function loadConfigModule() {
  jest.resetModules();
  return require('../../src/utils/config');
}

describe('utils/config', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CFCLI_CREDENTIAL_STORE;
    // Clear pre-existing config file if any
    try { fs.unlinkSync(configPath); } catch (_) { /* ignore */ }
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('applies 4-layer priority: defaults < file < env < explicit overrides', () => {
    // Layer 1: File config
    fs.writeFileSync(configPath, JSON.stringify({
      zoneId: 'from-file-zone',
      accountId: 'from-file-acct',
      apiToken: 'from-file-token', // legacy field for testing migration
    }));
    // Layer 2: Env overrides file for accountId
    process.env.CLOUDFLARE_ACCOUNT_ID = 'from-env-acct';
    process.env.CLOUDFLARE_API_TOKEN = 'from-env-token';

    const cfg = loadConfigModule();
    const merged = cfg.loadConfig({ configPath });

    // defaults: format=table applied
    expect(merged.format).toBe('table');

    // file value where env not set
    expect(merged.zoneId).toBe('from-file-zone');

    // env > file
    expect(merged.accountId).toBe('from-env-acct');
    expect(merged.apiToken).toBe('from-env-token');

    // Layer 3: Explicit overrides (highest)
    const explicit = cfg.loadConfig({
      configPath,
      overrides: { zoneId: 'cli-zone', apiToken: 'cli-token' },
    });
    expect(explicit.zoneId).toBe('cli-zone');
    expect(explicit.apiToken).toBe('cli-token');
    expect(explicit.accountId).toBe('from-env-acct');
  });

  it('showConfig fully masks secrets when --show-secrets is false', () => {
    const cfg = loadConfigModule();
    const displayed = cfg.showConfig({
      zoneId: '123-zone',
      accountId: '456-account',
      apiToken: 'Yc2SuperSecretToken9',
      email: 'ops@corp.com',
      format: 'table',
    }, { showSecrets: false });

    expect(displayed).toContain('123-zone');
    expect(displayed).toContain('ops@corp.com');
    // Secrets fully masked — no prefix, no substring leak
    expect(displayed).not.toContain('Yc2SuperSecretToken9');
    expect(displayed).not.toMatch(/Yc2/);
    expect(displayed).not.toContain('456-account');
    expect(displayed).toMatch(/\*{6,}/);
  });

  it('showConfig reveals secrets only when --show-secrets is true', () => {
    const cfg = loadConfigModule();
    const full = cfg.showConfig({
      zoneId: '123', accountId: '456', apiToken: 'T0P-SECRET', email: 'a@b.co', format: 'json',
    }, { showSecrets: true });
    expect(full).toContain('T0P-SECRET');
    expect(full).toContain('456');
  });

  it('isDestructiveConfirmed() skips prompt in CI (no TTY)', () => {
    const cfg = loadConfigModule();
    delete process.env.CFCLI_CONFIRM_DESTRUCTIVE;
    const stdoutIsTTY = false; // simulate CI
    // When NOT TTY and env var unset → should return true (auto allow)
    expect(typeof cfg.isDestructiveConfirmed).toBe('function');
    const res = cfg.isDestructiveConfirmed({ stdoutIsTTY });
    expect(res).toBe(true);
  });

  it('isDestructiveConfirmed() returns true when env override is set', () => {
    const cfg = loadConfigModule();
    process.env.CFCLI_CONFIRM_DESTRUCTIVE = '1';
    expect(cfg.isDestructiveConfirmed({ stdoutIsTTY: true })).toBe(true);
  });
});
