/**
 * @file Output formatting utilities (semantic colors, tables, JSON, errors).
 * All semantic helpers both log to console AND return the rendered string,
 * so they are unit-testable without hijacking console.
 *
 * @typedef {object} CloudflareApiErrorShape
 * @property {string} [message]
 * @property {number|string} [code]        Cloudflare error code (e.g. 10000)
 * @property {number} [httpStatus]         HTTP status (e.g. 429)
 * @property {string} [method]             HTTP method of the failing request
 * @property {string} [path]               Request path (query params stripped)
 * @property {string} [requestId]          X-Request-Id response header
 * @property {string} [stack]              JS stack trace
 */

const chalk = require('chalk');
const { table } = require('table');

const PREFIX_SUCCESS = '✓';
const PREFIX_ERROR = '✗';
const PREFIX_WARNING = '⚠';
const PREFIX_INFO = 'ℹ';

function formatSuccess(message) {
  const str = `${chalk.green(PREFIX_SUCCESS)} ${message}`;
  console.log(str);
  return str;
}

function formatError(message) {
  const str = `${chalk.red(PREFIX_ERROR)} ${message}`;
  console.error(str);
  return str;
}

function formatWarning(message) {
  const str = `${chalk.yellow(PREFIX_WARNING)} ${message}`;
  console.log(str);
  return str;
}

function formatInfo(message) {
  const str = `${chalk.blue(PREFIX_INFO)} ${message}`;
  console.log(str);
  return str;
}

/**
 * Render a table (or an empty-state message when data is absent).
 *
 * @param {Array<{header:string,accessor:string|((row:any)=>any)}>} columns
 * @param {any[]} data
 * @param {string} [emptyMsg='No data found']
 * @returns {string} rendered table string
 */
function formatTable(columns, data, emptyMsg) {
  if (!data || data.length === 0) {
    return formatInfo(emptyMsg || 'No data found');
  }
  const headers = columns.map(col => chalk.cyan(col.header));
  const rows = data.map(item => columns.map(col => {
    const value = typeof col.accessor === 'function'
      ? col.accessor(item)
      : item[col.accessor];
    return value !== undefined && value !== null ? String(value) : '-';
  }));
  const rendered = table([headers, ...rows]);
  console.log(rendered);
  return rendered;
}

/**
 * JSON output.
 * @param {any} data
 * @param {boolean} [pretty=true]
 * @returns {string}
 */
function formatJSON(data, pretty) {
  const out = pretty === false
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);
  console.log(out);
  return out;
}

// Legacy name alias — keep backward-compat for commands already using it.
const formatJson = formatJSON;

/**
 * Verbose error formatter.
 * - verbose=false (default): user-friendly short message.
 * - verbose=true:          full structured context + stack + request id.
 *
 * @param {Error|CloudflareApiErrorShape} err
 * @param {boolean} [verbose=false]
 * @returns {string} rendered error string (also logged to stderr)
 */
function formatVerboseError(err, verbose) {
  if (!err) return '';
  const isStructured = typeof err === 'object'
    && ('code' in err || 'httpStatus' in err || 'method' in err || 'requestId' in err);

  if (!verbose) {
    const msg = err.message || String(err);
    const str = `${chalk.red(PREFIX_ERROR)} ${msg}`;
    console.error(str);
    return str;
  }

  const lines = [chalk.red(`${PREFIX_ERROR} Verbose error report`)];
  lines.push(`  Message:     ${err.message || String(err)}`);
  if (isStructured) {
    if (err.code !== undefined && err.code !== null) lines.push(`  CF Code:     ${err.code}`);
    if (err.httpStatus) lines.push(`  HTTP Status: ${err.httpStatus}`);
    if (err.method && err.path) lines.push(`  Request:     ${err.method} ${err.path}`);
    if (err.requestId) lines.push(`  X-Request-Id: ${err.requestId}`);
    if (err.correlation) lines.push(`  Correlation: ${err.correlation}`);
  }
  if (err.stack) {
    lines.push('  Stack:');
    err.stack.split('\n').forEach(l => lines.push(`    ${l}`));
  }
  const rendered = lines.join('\n');
  console.error(rendered);
  return rendered;
}

/**
 * Typed custom Cloudflare API error (throws from cf-client axios interceptors).
 * Accepts a single object payload — every field optional for call-site ergonomics.
 *
 * @param {CloudflareApiErrorShape} payload
 * @extends Error
 */
function CloudflareApiError(payload = {}) {
  if (!(this instanceof CloudflareApiError)) return new CloudflareApiError(payload);
  Error.call(this);
  Error.captureStackTrace(this, CloudflareApiError);
  this.name = 'CloudflareApiError';
  this.message = payload.message || 'Cloudflare API error';
  this.code = payload.code;
  this.httpStatus = payload.httpStatus;
  this.method = payload.method;
  this.path = payload.path;
  this.requestId = payload.requestId;
  this.correlation = payload.correlation;
  // allow caller-supplied stack override (e.g. from axios error stack)
  if (payload.stack) this.stack = payload.stack;
}
CloudflareApiError.prototype = Object.create(Error.prototype);
CloudflareApiError.prototype.constructor = CloudflareApiError;

// Record-specific formatters — preserved from original API
function formatDnsRecord(record) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied ? chalk.green('Yes') : chalk.gray('No'),
    ttl: record.ttl === 1 ? 'Auto' : record.ttl,
    priority: record.priority || '-',
  };
}

function formatZone(zone) {
  return {
    id: zone.id,
    name: zone.name,
    status: zone.status === 'active' ? chalk.green(zone.status) : chalk.yellow(zone.status),
    name_servers: zone.name_servers ? zone.name_servers.join(', ') : '-',
    plan: zone.plan && zone.plan.name ? zone.plan.name : '-',
  };
}

function formatWorker(script) {
  return {
    id: script.id,
    created_on: script.created_on || '-',
    modified_on: script.modified_on || '-',
  };
}

function formatKVNamespace(namespace) {
  return {
    id: namespace.id,
    title: namespace.title,
    supports_url_encoding: namespace.supports_url_encoding ? 'Yes' : 'No',
  };
}

function formatR2Bucket(bucket) {
  return {
    name: bucket.name,
    location: bucket.location || '-',
    creation_date: bucket.creation_date || '-',
    storage_class: bucket.storage_class || '-',
  };
}

module.exports = {
  // Core semantic
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  // Structured output
  formatTable,
  formatJSON,
  formatJson, // alias
  formatVerboseError,
  CloudflareApiError,
  // Domain-specific presets
  formatDnsRecord,
  formatZone,
  formatWorker,
  formatKVNamespace,
  formatR2Bucket,
};
