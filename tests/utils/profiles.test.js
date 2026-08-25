/**
 * @file Unit tests for the multi-profile engine (P3+).
 *
 * Uses CFCLI_CONFIG_DIR env var to redirect all file I/O to a temp dir.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temp config dir BEFORE requiring the module
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfcli-prof-'));
process.env.CFCLI_CONFIG_DIR = tmpDir;

const {
  loadProfiles,
  saveProfiles,
  getActiveProfileName,
  setActiveProfileName,
  upsertProfile,
  removeProfile,
  resolveProfile,
  PROFILE_SECRET_KEYS,
} = require('../../src/utils/profiles');

describe('Multi-Profile Engine', () => {

  beforeEach(() => {
    // Clean state before each test
    saveProfiles({});
    const activeFile = path.join(tmpDir, '.active-profile');
    try { fs.unlinkSync(activeFile); } catch {}
  });

  afterAll(() => {
    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  describe('upsertProfile & loadProfiles', () => {
    it('saves and loads profile metadata', () => {
      upsertProfile('prod', { accountId: 'acct-1', zoneId: 'zone-1', email: 'ops@corp.com' });

      const profiles = loadProfiles();
      expect(profiles.prod).toBeDefined();
      expect(profiles.prod.accountId).toBe('acct-1');
      expect(profiles.prod.zoneId).toBe('zone-1');
      expect(profiles.prod.email).toBe('ops@corp.com');
    });

    it('does not store secret keys in profiles.json', () => {
      upsertProfile('prod', {
        accountId: 'acct-1',
        apiToken: 'cf_secret_token',
        r2AccessKeyId: 'r2key',
        r2SecretAccessKey: 'r2secret',
      });

      const profiles = loadProfiles();
      // Secrets should not be in the JSON file
      expect(profiles.prod.apiToken).toBeUndefined();
      expect(profiles.prod.r2AccessKeyId).toBeUndefined();
      expect(profiles.prod.r2SecretAccessKey).toBeUndefined();
      // Metadata should be there
      expect(profiles.prod.accountId).toBe('acct-1');
    });

    it('updates an existing profile without losing metadata', () => {
      upsertProfile('staging', { accountId: 'acct-1', zoneId: 'zone-1' });
      upsertProfile('staging', { accountId: 'acct-2' });

      const profiles = loadProfiles();
      expect(profiles.staging).toBeDefined();
      expect(profiles.staging.accountId).toBe('acct-2');
    });

    it('can save multiple profiles', () => {
      upsertProfile('prod', { accountId: 'acct-prod' });
      upsertProfile('staging', { accountId: 'acct-staging' });
      upsertProfile('dev', { accountId: 'acct-dev' });

      const profiles = loadProfiles();
      expect(Object.keys(profiles)).toHaveLength(3);
      expect(profiles.prod.accountId).toBe('acct-prod');
      expect(profiles.staging.accountId).toBe('acct-staging');
      expect(profiles.dev.accountId).toBe('acct-dev');
    });
  });

  describe('Active Profile', () => {
    it('returns null when no active profile is set', () => {
      expect(getActiveProfileName()).toBeNull();
    });

    it('sets and gets active profile name', () => {
      setActiveProfileName('prod');
      expect(getActiveProfileName()).toBe('prod');
    });

    it('overwrites active profile', () => {
      setActiveProfileName('prod');
      setActiveProfileName('staging');
      expect(getActiveProfileName()).toBe('staging');
    });
  });

  describe('removeProfile', () => {
    it('removes a profile and returns true', () => {
      upsertProfile('prod', { accountId: 'acct-1' });
      const removed = removeProfile('prod');
      expect(removed).toBe(true);

      const profiles = loadProfiles();
      expect(profiles.prod).toBeUndefined();
    });

    it('returns false for non-existent profile', () => {
      const removed = removeProfile('nonexistent');
      expect(removed).toBe(false);
    });

    it('clears active profile when removing the active one', () => {
      upsertProfile('prod', { accountId: 'acct-1' });
      setActiveProfileName('prod');
      removeProfile('prod');
      expect(getActiveProfileName()).toBeNull();
    });
  });

  describe('resolveProfile', () => {
    it('returns null for non-existent profile', async () => {
      const resolved = await resolveProfile('nonexistent');
      expect(resolved).toBeNull();
    });

    it('returns metadata from profiles.json', async () => {
      upsertProfile('prod', { accountId: 'acct-1', zoneId: 'zone-1' });
      const resolved = await resolveProfile('prod');
      expect(resolved).not.toBeNull();
      expect(resolved.accountId).toBe('acct-1');
      expect(resolved.zoneId).toBe('zone-1');
    });

    it('falls back to env vars for secrets if keychain is unavailable', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'cf_env_token';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-env';

      upsertProfile('prod', { accountId: 'acct-1' });
      const resolved = await resolveProfile('prod');
      expect(resolved.apiToken).toBe('cf_env_token');

      delete process.env.CLOUDFLARE_API_TOKEN;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    });
  });

  describe('PROFILE_SECRET_KEYS', () => {
    it('includes apiToken, globalApiKey, r2 keys', () => {
      expect(PROFILE_SECRET_KEYS).toContain('apiToken');
      expect(PROFILE_SECRET_KEYS).toContain('globalApiKey');
      expect(PROFILE_SECRET_KEYS).toContain('r2AccessKeyId');
      expect(PROFILE_SECRET_KEYS).toContain('r2SecretAccessKey');
    });
  });
});
