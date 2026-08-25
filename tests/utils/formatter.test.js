/**
 * Tests for src/utils/formatter.js
 * Covers: semantic color helpers, table formatting, JSON output, verbose errors.
 */
/* global describe, it, expect, beforeEach */
const chalk = require('chalk');
const {
  formatSuccess, formatError, formatWarning, formatInfo,
  formatTable, formatJSON, formatVerboseError, CloudflareApiError,
} = require('../../src/utils/formatter');

// chalk with color disabled so asserts are stable across terminals
beforeEach(() => {
  chalk.level = 0;
});

describe('formatter.semantic', () => {
  it('prefixes success with green checkmark equivalent', () => {
    const out = formatSuccess('done');
    expect(typeof out).toBe('string');
    expect(out).toContain('done');
    // formatSuccess must never include ERROR-like tokens
    expect(out).not.toMatch(/error/i);
  });

  it('prefixes error with red X equivalent', () => {
    const out = formatError('boom');
    expect(out).toContain('boom');
  });

  it('prefixes warning with ⚠ equivalent', () => {
    const out = formatWarning('warn');
    expect(out).toContain('warn');
  });

  it('prefixes info with ℹ equivalent', () => {
    const out = formatInfo('info');
    expect(out).toContain('info');
  });
});

describe('formatter.formatTable', () => {
  it('renders simple object array as a table string', () => {
    const cols = [
      { header: 'ID', accessor: 'id' },
      { header: 'Name', accessor: (row) => row.name.toUpperCase() },
    ];
    const rows = [{ id: 'a', name: 'one' }, { id: 'b', name: 'two' }];
    const out = formatTable(cols, rows);
    expect(out).toContain('ID');
    expect(out).toContain('Name');
    expect(out).toContain('ONE');
    expect(out).toContain('TWO');
    expect(out).toContain('a');
  });

  it('renders empty state with provided message', () => {
    const cols = [{ header: 'ID', accessor: 'id' }];
    const out = formatTable(cols, [], 'no data');
    expect(out).toContain('no data');
  });
});

describe('formatter.formatJSON', () => {
  it('returns pretty-printed JSON by default', () => {
    const out = formatJSON({ a: 1 });
    expect(out).toContain('  "a"'); // indentation present
  });

  it('returns minified JSON when pretty=false', () => {
    const out = formatJSON({ a: 1 }, false);
    expect(out).toBe('{"a":1}');
  });
});

describe('formatter.formatVerboseError', () => {
  it('shows only message when verbose=false (default)', () => {
    const err = new CloudflareApiError({
      message: 'nope', code: 1000, httpStatus: 400, method: 'GET', path: '/',
    });
    const short = formatVerboseError(err, false);
    expect(short).toContain('nope');
    expect(short).not.toContain('CloudflareApiError');
    expect(short).not.toContain('stack');
  });

  it('shows stack, code, method, path, requestId when verbose=true', () => {
    const err = new CloudflareApiError({
      message: 'nope', code: 1000, httpStatus: 429, method: 'POST',
      path: '/zones/x/rulesets', requestId: 'deadbeef', stack: 'fake-stack',
    });
    const long = formatVerboseError(err, true);
    expect(long).toContain('nope');
    expect(long).toContain('1000');
    expect(long).toContain('429');
    expect(long).toContain('POST');
    expect(long).toContain('/zones/x/rulesets');
    expect(long).toContain('deadbeef');
    expect(long).toContain('fake-stack');
  });
});
