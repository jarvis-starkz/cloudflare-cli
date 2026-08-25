/**
 * @file Cross-platform credential adapter.
 *
 * Strategy:
 *   1. Prefer `keytar` (optional dep) → OS Keychain (Win Credential Manager,
 *      macOS Keychain, Linux libsecret).
 *   2. Fallback: AES-256-CBC encrypted JSON file at
 *      `config/credentials.enc.json`, keyed by:
 *         CFCLI_MASTER_PASS (env)  →  user-provided
 *         otherwise                →  machine fingerprint + static salt
 *
 * The adapter exports Promise-based methods; callers may `await` or `.catch`.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto-js');

const FALLBACK_FILE = path.join(__dirname, '..', '..', 'config', 'credentials.enc.json');

let _keytar;
function tryLoadKeytar() {
  if (_keytar !== undefined) return _keytar;
  try {
    // keytar is an optional dependency. require() throws if not installed.
    // eslint-disable-next-line global-require
    const mod = require('keytar');
    _keytar = mod || null;
  } catch (_e) {
    _keytar = null;
  }
  return _keytar;
}

function getStoreMode() {
  const env = (process.env.CFCLI_CREDENTIAL_STORE || 'auto').toLowerCase();
  if (env === 'file') return 'file';
  if (env === 'keychain') return 'keychain';
  // auto
  return tryLoadKeytar() ? 'keychain' : 'file';
}

// ---------- Fallback encrypted-file store ----------
function deriveKey() {
  const explicit = process.env.CFCLI_MASTER_PASS;
  const salt = 'cfcli-default-salt-v1';
  const material = explicit
    || `${os.hostname()}|${os.platform()}|${os.userInfo().uid || '0'}|${os.totalmem()}`;
  // 256-bit key = 32 bytes hex → 64 hex chars
  return crypto.SHA256(`${salt}:${material}`).toString(crypto.enc.Hex).slice(0, 64);
}

function readFallbackStore() {
  if (!fs.existsSync(FALLBACK_FILE)) return {};
  try {
    const blob = fs.readFileSync(FALLBACK_FILE, 'utf8');
    const key = deriveKey();
    const bytes = crypto.AES.decrypt(blob, key);
    const plain = bytes.toString(crypto.enc.Utf8);
    return JSON.parse(plain || '{}');
  } catch (_e) {
    return {};
  }
}

function writeFallbackStore(store) {
  const dir = path.dirname(FALLBACK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const key = deriveKey();
  const cipher = crypto.AES.encrypt(JSON.stringify(store), key).toString();
  fs.writeFileSync(FALLBACK_FILE, cipher);
}

function fbKey(service, account) {
  return `${service}::${account}`;
}

async function fbGet(service, account) {
  const store = readFallbackStore();
  return store[fbKey(service, account)] || null;
}

async function fbSet(service, account, value) {
  const store = readFallbackStore();
  store[fbKey(service, account)] = value;
  writeFallbackStore(store);
}

async function fbDelete(service, account) {
  const store = readFallbackStore();
  delete store[fbKey(service, account)];
  writeFallbackStore(store);
}

// ---------- Public Adapter API ----------

async function getPassword(service, account) {
  const mode = getStoreMode();
  if (mode === 'keychain') {
    const kt = tryLoadKeytar();
    if (kt) {
      try { return await kt.getPassword(service, account); }
      catch (_e) { /* fallthrough */ }
    }
  }
  return fbGet(service, account);
}

async function setPassword(service, account, value) {
  const mode = getStoreMode();
  if (mode === 'keychain') {
    const kt = tryLoadKeytar();
    if (kt) {
      try { await kt.setPassword(service, account, value); return; }
      catch (_e) { /* fallthrough */ }
    }
  }
  await fbSet(service, account, value);
}

async function deletePassword(service, account) {
  const mode = getStoreMode();
  if (mode === 'keychain') {
    const kt = tryLoadKeytar();
    if (kt) {
      try { return await kt.deletePassword(service, account); }
      catch (_e) { /* fallthrough */ }
    }
  }
  return fbDelete(service, account);
}

module.exports = {
  getPassword,
  setPassword,
  deletePassword,
  // test hooks
  _testing: {
    getStoreMode,
    tryLoadKeytar,
    FALLBACK_FILE,
    deriveKey,
  },
};
