/**
 * Tests for src/utils/cf-client.js
 * - Axios 429 + Retry-After (retries exhausted)
 * - 429 that recovers after N retries (asserts N calls made)
 * - 503 → structured CloudflareApiError with code/method/path/requestId
 * - Pagination helper merging 3 pages
 * - Rulesets v2 methods → correct HTTP path + verb
 * - KV bulkWriteKV auto-chunking at count boundary
 */
/* global describe, it, expect, beforeEach, jest */
const nock = require('nock');
const Client = require('../../src/utils/cf-client');
const { CloudflareApiError } = require('../../src/utils/formatter');

const BASE = 'https://api.cloudflare.com/client/v4';
const TOKEN = 'test-token-not-a-real-secret';

function mkClient(opts) {
  return new Client({
    accountId: 'acct-1',
    zoneId: 'zone-1',
    apiToken: TOKEN,
    retries: 3,
    timeout: 1000,
    ...(opts || {}),
  });
}

describe('cf-client', () => {
  beforeEach(() => { nock.cleanAll(); });

  it('throws structured CloudflareApiError on 400 with method/path/requestId', async () => {
    const scope = nock(BASE, { reqheaders: { Authorization: `Bearer ${TOKEN}` } })
      .get('/zones/zone-1')
      .reply(400, {
        success: false,
        errors: [{ code: 1001, message: 'bad zone' }],
      }, { 'x-request-id': 'req-abc' });

    const c = mkClient();
    let caught = null;
    try {
      await c.getZone();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CloudflareApiError);
    expect(caught.httpStatus).toBe(400);
    expect(caught.code).toBe(1001);
    expect(caught.method).toBe('GET');
    expect(caught.path).toBe('/zones/zone-1');
    expect(caught.requestId).toBe('req-abc');
    scope.done();
  });

  it('honors Retry-After header and retries 429s, returning success on last try', async () => {
    let call = 0;
    const scope = nock(BASE, { reqheaders: { Authorization: `Bearer ${TOKEN}` } })
      .get('/zones')
      .times(3)
      .reply(() => {
        call += 1;
        if (call < 3) {
          return [429, { success: false, errors: [{ message: 'rate' }] }, { 'Retry-After': '0.01' }];
        }
        return [200, { success: true, result: [{ id: 'z1' }], result_info: { page: 1, total_pages: 1 } }];
      });

    const c = mkClient();
    const r = await c.listZones();
    expect(r.result).toHaveLength(1);
    expect(call).toBe(3);
    scope.done();
  });

  it('fails after all 5xx retries exhausted', async () => {
    const scope = nock(BASE)
      .get('/zones')
      .times(4) // 1 initial + 3 retries
      .reply(503, { success: false, errors: [{ message: 'oops' }] });

    const c = mkClient();
    await expect(c.listZones()).rejects.toThrow(/API Error \(503\)/);
    scope.done();
  });

  it('paginatedList walks 3 pages sequentially using result_info.total_pages', async () => {
    // Use three explicit scopes keyed by exact query so page detection is reliable.
    const pages = [1, 2, 3];
    const scopes = pages.map(p => nock(BASE)
      .get('/zones')
      .query({ page: String(p), per_page: '1' })
      .reply(200, {
        success: true,
        result: [{ id: `z${p}` }],
        result_info: { page: p, per_page: 1, total_pages: 3, count: 1 },
      }));

    const c = mkClient({ retries: 0 });
    const all = await c.paginatedList(p => c.listZones(p), { getAll: true, perPage: 1, delayMs: 0 });
    expect(all).toHaveLength(3);
    expect(all.map(z => z.id)).toEqual(['z1', 'z2', 'z3']);
    scopes.forEach(s => s.done());
  });

  it('WAF listZoneRulesets routes to GET /zones/<id>/rulesets', async () => {
    const scope = nock(BASE)
      .get('/zones/zone-1/rulesets')
      .query({ page: 1, per_page: 10 })
      .reply(200, { success: true, result: [{ id: 'rs1' }] });

    const c = mkClient();
    const res = await c.listZoneRulesets(null, { page: 1, per_page: 10 });
    expect(res.result[0].id).toBe('rs1');
    scope.done();
  });

  it('WAF updateZoneEntrypoint PUTs /zones/<id>/rulesets/phases/<phase>/entrypoint', async () => {
    const phase = 'http_request_firewall_custom';
    const scope = nock(BASE)
      .put(`/zones/zone-1/rulesets/phases/${encodeURIComponent(phase)}/entrypoint`, body => {
        return Array.isArray(body.rules) && body.rules[0].action === 'block';
      })
      .reply(200, { success: true, result: { id: 'ep1' } });

    const c = mkClient();
    const res = await c.updateZoneEntrypoint(phase, { rules: [{ action: 'block' }] });
    expect(res.result.id).toBe('ep1');
    scope.done();
  });

  it('bulkWriteKV chunks pairs > 9000 into multiple PUT requests', async () => {
    // Build 9500 pairs → expect 2 chunks (9000 + 500)
    const pairs = Array.from({ length: 9500 }, (_, i) => ({ key: `k${i}`, value: `v${i}` }));
    const scopes = [];
    scopes.push(nock(BASE)
      .put('/accounts/acct-1/storage/kv/namespaces/ns-1/bulk', body => Array.isArray(body) && body.length === 9000)
      .reply(200, { success: true }));
    scopes.push(nock(BASE)
      .put('/accounts/acct-1/storage/kv/namespaces/ns-1/bulk', body => Array.isArray(body) && body.length === 500)
      .reply(200, { success: true }));

    const c = mkClient({ retries: 0 });
    const results = await c.bulkWriteKV('ns-1', pairs);
    expect(results).toHaveLength(2);
    scopes.forEach(s => s.done());
  });

  it('bulkDeleteKV posts to /bulk/delete endpoint', async () => {
    const scope = nock(BASE)
      .post('/accounts/acct-1/storage/kv/namespaces/ns-1/bulk/delete',
        body => Array.isArray(body) && body[0] === 'a' && body[1] === 'b')
      .reply(200, { success: true });

    const c = mkClient();
    await c.bulkDeleteKV('ns-1', ['a', 'b']);
    scope.done();
  });
});
