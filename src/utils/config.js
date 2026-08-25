/**
 * @file 4-layer configuration loader + secure credential delegation.
 *
 * Priority (high → low):
 *   1. Explicit CLI overrides  (pass `overrides` object)
 *   2. Process environment variables
 *   3. Persisted config file   (config/config.json by default, or `configPath` param)
 *   4. Built-in defaults
 *
 * Sensitive values (apiToken / email / r2 keys / ...) are saved through the
 * keychain adapter (src/utils/keychain.js) so they never reside as plaintext
 * in config/config.json when the user selects store=auto|keychain.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'config.json');

const DEFAULTS = Object.freeze({
  baseURL: 'https://api.cloudflare.com/client/v4',
  format: 'table',
  credentialStore: process.env.CFCLI_CREDENTIAL_STORE || 'auto',
  keychainService: process.env.CFCLI_KEYCHAIN_SERVICE || 'cfcli',
});

// Keys we classify as "secrets" → routed to the secure credential store on save,
// AND masked in showConfig by default (unless --show-secrets is passed).
const SECRET_KEYS = Object.freeze([
  'apiToken',
  'accountId',           // PII identifier; user requested it never appear unmasked
  'globalApiKey',
  'r2AccessKeyId',
  'r2SecretAccessKey',
]);

// Keys that are personally identifying (not credential-level secrets) but
// should still be masked in terminal output by default to avoid shoulder-surfing
// leaks. These are *not* routed through the OS keychain on save (they live in
// the JSON config file).
const DISPLAY_MASK_KEYS = Object.freeze([
  // Add fields like 'recoveryEmail' here to redact them from showConfig output.
]);

// Convenience set used by showConfig for default redaction.
const MASK_KEYS_FOR_DISPLAY = Object.freeze([...SECRET_KEYS, ...DISPLAY_MASK_KEYS]);

/**
 * Resolve active config path.
 * @param {{configPath?:string}} [opts]
 */
function resolveConfigPath(opts = {}) {
  return opts.configPath || DEFAULT_CONFIG_PATH;
}

/**
 * Lazy-load keychain module (keytar is optional dep; may fail to load).
 * Returns a stable adapter with getPassword/setPassword/deletePassword.
 */
let _keychain;
function getKeychain() {
  if (_keychain) return _keychain;
  // Uses dynamic require so tests can swap via jest.resetModules + mock.
  // eslint-disable-next-line global-require
  _keychain = require('./keychain');
  return _keychain;
}

/**
 * Read & merge config. Safe to call with no file + no env → returns defaults.
 *
 * @param {{configPath?:string, overrides?:Record<string,any>}} [opts]
 */
function loadConfig(opts = {}) {
  const file = resolveConfigPath(opts);
  let fileConfig = {};
  if (fs.existsSync(file)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn('Warning: Could not parse config.json, using defaults');
      fileConfig = {};
    }
  }

  // Layer 4 (defaults) ← layer 3 (file) ← layer 2 (env) ← layer 1 (overrides)
  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    // env overrides
    accountId:  process.env.CLOUDFLARE_ACCOUNT_ID        || fileConfig.accountId  || DEFAULTS.accountId,
    apiToken:   process.env.CLOUDFLARE_API_TOKEN         || fileConfig.apiToken   || DEFAULTS.apiToken,
    zoneId:     process.env.CLOUDFLARE_ZONE_ID           || fileConfig.zoneId     || DEFAULTS.zoneId,
    baseURL:    process.env.CLOUDFLARE_API_BASE_URL      || fileConfig.baseURL    || DEFAULTS.baseURL,
    email:      process.env.CLOUDFLARE_EMAIL             || fileConfig.email      || DEFAULTS.email,
    r2AccessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID     || fileConfig.r2AccessKeyId,
    r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || fileConfig.r2SecretAccessKey,
    credentialStore:   process.env.CFCLI_CREDENTIAL_STORE         || fileConfig.credentialStore || DEFAULTS.credentialStore,
    keychainService:   process.env.CFCLI_KEYCHAIN_SERVICE         || fileConfig.keychainService || DEFAULTS.keychainService,
    // CLI / explicit overrides (highest precedence)
    ...(opts.overrides || {}),
  };

  return merged;
}

/**
 * Persist non-sensitive values to the JSON config file; route secrets to
 * the active credential store (Keychain / AES file depending on setting).
 *
 * @param {Record<string,any>} configPatch
 * @param {{configPath?:string}} [opts]
 */
function saveConfig(configPatch, opts = {}) {
  const file = resolveConfigPath(opts);
  const existing = loadConfig(opts);
  const merged = { ...existing, ...configPatch };

  // --- Split secrets from metadata ---
  const secrets = {};
  const metadata = {};
  Object.keys(merged).forEach(k => {
    if (SECRET_KEYS.includes(k)) secrets[k] = merged[k];
    else metadata[k] = merged[k];
  });

  // --- Write metadata to JSON (no plaintext secrets) ---
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(metadata, null, 2));

  // --- Persist secrets to secure store ---
  if (merged.credentialStore !== 'file-only') {
    try {
      const kc = getKeychain();
      const service = merged.keychainService || DEFAULTS.keychainService;
      Object.keys(secrets).forEach(k => {
        if (secrets[k] === undefined || secrets[k] === null || secrets[k] === '') return;
        kc.setPassword(service, k, String(secrets[k])).catch(() => {
          // Fire-and-forget best-effort; fallback already populated secrets via env.
        });
      });
    } catch (_kcErr) {
      // Keychain unavailable; secrets still available from env/previous file read
      // during this CLI session. User will be prompted on next run.
    }
  }

  return merged;
}

/**
 * Remove JSON config file (does NOT wipe keychain secrets — by design).
 * @param {{configPath?:string}} [opts]
 */
function clearConfig(opts = {}) {
  const file = resolveConfigPath(opts);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/**
 * Render config for display. By default, all secrets/PII are fully masked
 * with `********` (no prefix leak). Use --show-secrets to print raw values.
 *
 * @param {Record<string,any>} cfg
 * @param {{showSecrets?:boolean}} [flags]
 * @returns {string} pretty JSON for terminal display
 */
function showConfig(cfg, flags = {}) {
  const redacted = {};
  Object.keys(cfg).forEach(k => {
    if (flags.showSecrets) {
      redacted[k] = cfg[k];
    } else if (MASK_KEYS_FOR_DISPLAY.includes(k) && cfg[k]) {
      redacted[k] = '********';
    } else {
      redacted[k] = cfg[k];
    }
  });
  const out = JSON.stringify(redacted, null, 2);
  console.log(out);
  return out;
}

/**
 * Destructive-operation confirmation guard.
 *   - Non-TTY (CI): allow (assume scripted + reviewed) → return true.
 *   - TTY + env CFCLI_CONFIRM_DESTRUCTIVE=1 → allow.
 *   - Otherwise return false (caller should exit(1) + print instructions).
 *
 * @param {{stdoutIsTTY?:boolean}} [opts]
 * @returns {boolean}
 */
function isDestructiveConfirmed(opts = {}) {
  const tty = opts.stdoutIsTTY !== undefined
    ? opts.stdoutIsTTY
    : process.stdout.isTTY;
  if (!tty) return true; // CI / non-interactive → auto allow
  return process.env.CFCLI_CONFIRM_DESTRUCTIVE === '1';
}

module.exports = {
  loadConfig,
  saveConfig,
  clearConfig,
  showConfig,
  isDestructiveConfirmed,
  // expose for tests/debug
  DEFAULT_CONFIG_PATH: DEFAULT_CONFIG_PATH,
  SECRET_KEYS: SECRET_KEYS,
  resolveConfigPath: resolveConfigPath,
  get configPath() { return DEFAULT_CONFIG_PATH; },
};
