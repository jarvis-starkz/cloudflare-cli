/**
 * @file Multi-Profile engine — manage multiple Cloudflare API Token sets.
 *
 * Each profile is a named bundle of credentials + context:
 *   { name, accountId, apiToken, zoneId, email, r2AccessKeyId, r2SecretAccessKey }
 *
 * Storage:
 *   config/profiles.json  — non-sensitive metadata (name, accountId, zoneId, email)
 *   Keychain (optional)   — secrets (apiToken, r2 keys) routed via keychain.js
 *
 * Active profile:
 *   config/.active-profile — a single line file containing the active profile name.
 *   The active profile is used by default when no --profile is specified.
 *
 * Resolution order (highest → lowest priority):
 *   1. --token <token> CLI flag (temporary, not persisted)
 *   2. --profile <name> CLI flag (uses that profile)
 *   3. Active profile (from .active-profile file)
 *   4. Legacy single-config (config/config.json + env)
 *   5. Built-in defaults
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Allow override via env (for testing); defaults to <project>/config
const CONFIG_DIR = process.env.CFCLI_CONFIG_DIR
  ? path.resolve(process.env.CFCLI_CONFIG_DIR)
  : path.join(__dirname, '..', '..', 'config');
const PROFILES_FILE = path.join(CONFIG_DIR, 'profiles.json');
const ACTIVE_FILE = path.join(CONFIG_DIR, '.active-profile');

// Keys that are secrets → routed to keychain on save, masked on display.
const PROFILE_SECRET_KEYS = Object.freeze([
  'apiToken',
  'globalApiKey',
  'r2AccessKeyId',
  'r2SecretAccessKey',
]);

/**
 * Lazy-load keychain module.
 */
let _keychain;
function getKeychain() {
  if (_keychain) return _keychain;
  _keychain = require('./keychain');
  return _keychain;
}

/**
 * Read all profiles from profiles.json (metadata only; secrets in keychain).
 * @returns {{ [name: string]: object }}
 */
function loadProfiles() {
  if (!fs.existsSync(PROFILES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Persist profiles metadata to profiles.json.
 * @param {{ [name: string]: object }} profiles
 */
function saveProfiles(profiles) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
}

/**
 * Get the active profile name.
 * @returns {string|null}
 */
function getActiveProfileName() {
  if (!fs.existsSync(ACTIVE_FILE)) return null;
  try {
    return fs.readFileSync(ACTIVE_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Set the active profile name.
 * @param {string} name
 */
function setActiveProfileName(name) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(ACTIVE_FILE, name);
}

/**
 * Add or update a profile. Secrets are routed to keychain (best-effort),
 * metadata is persisted to profiles.json.
 *
 * @param {string} name
 * @param {object} fields — { accountId, apiToken, zoneId, email, r2AccessKeyId, r2SecretAccessKey, ... }
 */
function upsertProfile(name, fields) {
  const profiles = loadProfiles();
  const profile = { name, ...fields };

  // Separate secrets from metadata
  const metadata = {};
  Object.keys(profile).forEach(k => {
    if (!PROFILE_SECRET_KEYS.includes(k)) metadata[k] = profile[k];
  });

  // Persist metadata
  profiles[name] = metadata;
  saveProfiles(profiles);

  // Persist secrets to keychain (best-effort)
  const keychainService = process.env.CFCLI_KEYCHAIN_SERVICE || 'cfcli';
  try {
    const kc = getKeychain();
    PROFILE_SECRET_KEYS.forEach(k => {
      if (profile[k]) {
        kc.setPassword(`${keychainService}-${name}`, k, String(profile[k])).catch(() => {});
      }
    });
  } catch {
    // Keychain unavailable — secrets only in memory for this session
  }

  return metadata;
}

/**
 * Remove a profile. Deletes metadata + keychain secrets.
 * @param {string} name
 * @returns {boolean} true if removed, false if not found
 */
function removeProfile(name) {
  const profiles = loadProfiles();
  if (!profiles[name]) return false;

  delete profiles[name];
  saveProfiles(profiles);

  // Clean up keychain secrets (best-effort)
  const keychainService = process.env.CFCLI_KEYCHAIN_SERVICE || 'cfcli';
  try {
    const kc = getKeychain();
    PROFILE_SECRET_KEYS.forEach(k => {
      kc.deletePassword(`${keychainService}-${name}`, k).catch(() => {});
    });
  } catch {
    // Best-effort
  }

  // Clear active if it was the active profile
  if (getActiveProfileName() === name) {
    if (fs.existsSync(ACTIVE_FILE)) fs.unlinkSync(ACTIVE_FILE);
  }

  return true;
}

/**
 * Resolve a full profile (metadata + secrets from keychain).
 * @param {string} name
 * @returns {object|null} full profile with secrets, or null if not found
 */
async function resolveProfile(name) {
  const profiles = loadProfiles();
  const meta = profiles[name];
  if (!meta) return null;

  const full = { ...meta };

  // Load secrets from keychain
  const keychainService = process.env.CFCLI_KEYCHAIN_SERVICE || 'cfcli';
  try {
    const kc = getKeychain();
    const secretKeys = PROFILE_SECRET_KEYS;
    await Promise.all(secretKeys.map(async k => {
      try {
        const val = await kc.getPassword(`${keychainService}-${name}`, k);
        if (val) full[k] = val;
      } catch {
        // Secret not in keychain — may still be in env
      }
    }));
  } catch {
    // Keychain unavailable
  }

  // Fallback: env vars for secrets if keychain didn't provide them
  if (!full.apiToken && process.env.CLOUDFLARE_API_TOKEN) full.apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!full.accountId && process.env.CLOUDFLARE_ACCOUNT_ID) full.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!full.zoneId && process.env.CLOUDFLARE_ZONE_ID) full.zoneId = process.env.CLOUDFLARE_ZONE_ID;

  return full;
}

/**
 * Resolve the effective config by combining profile + env + overrides.
 *
 * Resolution order (highest → lowest):
 *   1. overrides (from --token, --account-id, --zone-id CLI flags)
 *   2. profile secrets + metadata (from --profile or active profile)
 *   3. env vars
 *   4. defaults
 *
 * @param {{ profile?: string, token?: string, accountId?: string, zoneId?: string }} [opts]
 * @returns {Promise<object>} resolved config ready for CloudflareClient
 */
async function resolveConfig(opts = {}) {
  const { loadConfig } = require('./config');

  // Start with legacy config (file + env + defaults)
  const baseConfig = loadConfig();

  // Determine which profile to use
  const profileName = opts.profile || getActiveProfileName();

  let profileData = {};
  if (profileName) {
    const resolved = await resolveProfile(profileName);
    if (resolved) {
      profileData = resolved;
    }
  }

  // Merge: base < profile < overrides
  const merged = {
    ...baseConfig,
    // Profile values override base
    accountId:  profileData.accountId  || baseConfig.accountId,
    apiToken:   profileData.apiToken   || baseConfig.apiToken,
    zoneId:     profileData.zoneId     || baseConfig.zoneId,
    email:      profileData.email      || baseConfig.email,
    r2AccessKeyId:     profileData.r2AccessKeyId     || baseConfig.r2AccessKeyId,
    r2SecretAccessKey: profileData.r2SecretAccessKey  || baseConfig.r2SecretAccessKey,
    // Active profile name (for display)
    activeProfile: profileName || null,
  };

  // CLI overrides (highest priority)
  if (opts.token) {
    merged.apiToken = opts.token;
    merged.activeProfile = '(ad-hoc token)';
  }
  if (opts.accountId) merged.accountId = opts.accountId;
  if (opts.zoneId) merged.zoneId = opts.zoneId;

  return merged;
}

module.exports = {
  loadProfiles,
  saveProfiles,
  getActiveProfileName,
  setActiveProfileName,
  upsertProfile,
  removeProfile,
  resolveProfile,
  resolveConfig,
  PROFILE_SECRET_KEYS,
  PROFILES_FILE,
  ACTIVE_FILE,
};
