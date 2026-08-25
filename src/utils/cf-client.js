/**
 * @file Cloudflare REST API client — 90+ typed convenience methods.
 *
 * P0/P1/P2 enhancements:
 *   - axios-retry with exponential backoff on 429/5xx (honors Retry-After).
 *   - Structured CloudflareApiError (code / httpStatus / method / path / requestId).
 *   - Generic `paginatedList` helper via pagination util.
 *   - WAF Rulesets v2 methods (phases / entrypoints / rules).
 *   - Workers KV bulk write / get / delete with 10k-pair auto-chunking.
 *
 * NOTE: All methods are safe; they do NOT read/write any real Cloudflare
 * resources until the CLI user explicitly invokes them with valid credentials.
 */

/* eslint-disable max-len */
const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const { CloudflareApiError } = require('./formatter');
const { paginate, sleep: _sleep } = require('./pagination');

class CloudflareClient {
  constructor(config = {}) {
    this.accountId = config.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = config.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = config.zoneId || process.env.CLOUDFLARE_ZONE_ID;
    this.baseURL = config.baseURL || process.env.CLOUDFLARE_API_BASE_URL || 'https://api.cloudflare.com/client/v4';

    if (!this.apiToken) {
      throw new Error('Cloudflare API Token is required. Set CLOUDFLARE_API_TOKEN environment variable or pass it in config.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 60_000,
      headers: {
        'Authorization': 'Bearer ' + this.apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // --- 429 / 5xx retry with exponential backoff + Retry-After header ---
    axiosRetry(this.client, {
      retries: config.retries !== undefined ? config.retries : 5,
      retryCondition: (err) => {
        if (!err || !err.response) return false;
        const s = err.response.status;
        return s === 429 || (s >= 500 && s < 600);
      },
      retryDelay: (retryCount, err) => {
        // Prefer Retry-After header when given (RFC 7231 seconds)
        const ra = err && err.response && err.response.headers
          && err.response.headers['retry-after'];
        const parsed = Number(ra);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed * 1000;
        return axiosRetry.exponentialDelay(retryCount, err);
      },
      shouldResetTimeout: true,
    });

    this.client.interceptors.response.use(
      // Guard against axios-retry internals occasionally invoking the
      // fulfilled chain with an undefined placeholder on retry recovery.
      response => (response && response.data) ? response.data : response,
      error => {
        if (error && error.response) {
          const { data, status, headers, config: cfg } = error.response;
          const errs = data && Array.isArray(data.errors) ? data.errors : [];
          const firstCode = errs[0] && (errs[0].code || errs[0].error_chain?.[0]?.code);
          const msg = errs.length
            ? errs.map(e => `${e.code ? `${e.code}: ` : ''}${e.message}`).join('; ')
            : error.message;
          throw new CloudflareApiError({
            message: `API Error (${status}): ${msg}`,
            code: firstCode,
            httpStatus: status,
            method: cfg && cfg.method ? cfg.method.toUpperCase() : undefined,
            path: cfg && cfg.url ? stripOrigin(cfg.url, this.baseURL) : undefined,
            requestId: headers && (headers['x-request-id'] || headers['cf-ray']),
            correlation: headers && headers['x-cf-correlate'],
            stack: error.stack,
          });
        }
        if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
          // axios-retry already re-tried; let it bubble as structured error.
          throw new CloudflareApiError({
            message: error.message || 'Network error',
            stack: error.stack,
          });
        }
        throw error;
      },
    );
  }

  async request(method, path, data = null, params = null) {
    // When no body is supplied, omit `data` so axios won't serialize
    // `null` into a JSON body (which breaks nock and real GET semantics).
    const payload = data === null || data === undefined
      ? {}
      : { data };
    return this.client.request({
      method,
      url: path,
      ...payload,
      params: params || undefined,
    });
  }

  /**
   * Generic paginated wrapper for `listXxx(zoneId, params)` methods.
   * Handles page-based pagination (Cloudflare default). Cursor pagination
   * for specific endpoints is performed inside each method when detected.
   *
   * @template T
   * @param {(params:any) => Promise<{result:T[],result_info:any}>} call
   * @param {{getAll?:boolean,page?:number,perPage?:number}} opts
   * @returns {Promise<T[]>}
   */
  async paginatedList(call, opts = {}) {
    return paginate(
      ({ page, perPage, params }) => call({
        ...(params || {}),
        page,
        per_page: perPage,
      }),
      {
        getAll: !!opts.getAll,
        page: opts.page || 1,
        perPage: opts.perPage || 50,
      },
    );
  }

  // Zone operations
  async listZones(params = {}) {
    return this.request('GET', '/zones', null, params);
  }

  async getZone(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id);
  }

  async updateZoneSettings(zoneId = null, settings = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/settings', settings);
  }

  // DNS operations
  async listDnsRecords(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/dns_records', null, params);
  }

  async getDnsRecord(recordId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/dns_records/' + recordId);
  }

  async createDnsRecord(record, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/dns_records', record);
  }

  async updateDnsRecord(recordId, record, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/dns_records/' + recordId, record);
  }

  async deleteDnsRecord(recordId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/dns_records/' + recordId);
  }

  // Firewall operations
  async listFirewallRules(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/rules', null, params);
  }

  async createFirewallRule(rule, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/firewall/rules', rule);
  }

  async updateFirewallRule(ruleId, rule, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/firewall/rules/' + ruleId, rule);
  }

  async deleteFirewallRule(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/firewall/rules/' + ruleId);
  }

  // Access rules (IP/Country blocking)
  async listAccessRules(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/access_rules/rules', null, params);
  }

  async createAccessRule(rule, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/firewall/access_rules/rules', rule);
  }

  async deleteAccessRule(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/firewall/access_rules/rules/' + ruleId);
  }

  // Account-level access rules (apply to all zones in account · Enterprise)
  async listAccountAccessRules(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/firewall/access_rules/rules', null, params);
  }

  async createAccountAccessRule(rule) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/firewall/access_rules/rules', rule);
  }

  async updateAccountAccessRule(ruleId, rule) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PATCH', '/accounts/' + this.accountId + '/firewall/access_rules/rules/' + ruleId, rule);
  }

  async deleteAccountAccessRule(ruleId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/firewall/access_rules/rules/' + ruleId);
  }

  // SSL/TLS operations
  async getSSLSettings(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/settings/ssl');
  }

  async updateSSLSettings(value, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/settings/ssl', { value });
  }

  async getHTTPSRedirect(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/settings/always_use_https');
  }

  async updateHTTPSRedirect(value, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/settings/always_use_https', { value });
  }

  async getHTTP2(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/settings/http2');
  }

  async updateHTTP2(value, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/settings/http2', { value });
  }

  // WAF operations (Zone-level WAF)
  async listWaFRulesets(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages', null, { per_page: 50 });
  }

  async getWaFRuleset(packageId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages/' + packageId);
  }

  async updateWaFRuleset(packageId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/firewall/waf/packages/' + packageId, data);
  }

  async listWaFGroups(packageId, zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/groups', null, params);
  }

  async getWaFGroup(packageId, groupId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/groups/' + groupId);
  }

  async updateWaFGroup(packageId, groupId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/groups/' + groupId, data);
  }

  async listWaFRules(packageId, zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/rules', null, params);
  }

  async getWaFRule(packageId, ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/rules/' + ruleId);
  }

  async updateWaFRule(packageId, ruleId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/firewall/waf/packages/' + packageId + '/rules/' + ruleId, data);
  }

  // WAF Rate Limiting
  async listRateLimits(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/rate_limits', null, params);
  }

  async getRateLimit(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/rate_limits/' + ruleId);
  }

  async createRateLimit(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/rate_limits', data);
  }

  async updateRateLimit(ruleId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/rate_limits/' + ruleId, data);
  }

  async deleteRateLimit(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/rate_limits/' + ruleId);
  }

  // Workers operations
  async listWorkers(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/workers/scripts', null, params);
  }

  async uploadWorker(scriptName, script, metadata = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/workers/scripts/' + scriptName, {
      script,
      metadata
    });
  }

  async deleteWorker(scriptName) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/workers/scripts/' + scriptName);
  }

  async listWorkerRoutes(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/workers/routes', null, params);
  }

  async createWorkerRoute(pattern, scriptName) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/workers/routes', {
      pattern,
      script: scriptName
    });
  }

  async deleteWorkerRoute(routeId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/workers/routes/' + routeId);
  }

  // KV Storage operations
  async listKVNamespaces(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/storage/kv/namespaces', null, params);
  }

  async createKVNamespace(title) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/storage/kv/namespaces', { title });
  }

  async deleteKVNamespace(namespaceId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/storage/kv/namespaces/' + namespaceId);
  }

  async listKVKeys(namespaceId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/storage/kv/namespaces/' + namespaceId + '/keys', null, params);
  }

  async getKVValue(namespaceId, key) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/storage/kv/namespaces/' + namespaceId + '/values/' + key);
  }

  async putKVValue(namespaceId, key, value, metadata = null) {
    if (!this.accountId) throw new Error('Account ID is required');
    const body = { value };
    if (metadata) body.metadata = metadata;
    return this.request('PUT', '/accounts/' + this.accountId + '/storage/kv/namespaces/' + namespaceId + '/values/' + key, body);
  }

  async deleteKVKey(namespaceId, key) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/storage/kv/namespaces/' + namespaceId + '/values/' + key);
  }

  // R2 Storage operations
  async listR2Buckets(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/r2/buckets', null, params);
  }

  async createR2Bucket(name, location = 'WNAM') {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/r2/buckets', {
      name,
      locationHint: location
    });
  }

  async deleteR2Bucket(name) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/r2/buckets/' + name);
  }

  async getR2Bucket(name) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/r2/buckets/' + name);
  }

  // Account operations
  async listAccounts(params = {}) {
    return this.request('GET', '/accounts', null, params);
  }

  async getAccount(accountId = null) {
    const id = accountId || this.accountId;
    if (!id) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + id);
  }

  async listMembers(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/members', null, params);
  }

  // Purge cache
  async purgeCache(zoneId = null, files = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    const body = files ? { files } : { purge_everything: true };
    return this.request('POST', '/zones/' + id + '/purge_cache', body);
  }

  // Verify token
  async verifyToken() {
    return this.request('GET', '/user/tokens/verify');
  }

  // Pages operations
  async listPagesProjects(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/pages/projects', null, params);
  }

  async getPageProject(projectName, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/pages/projects/' + projectName, null, params);
  }

  async createPageProject(data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/pages/projects', data);
  }

  async deletePageProject(projectName) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/pages/projects/' + projectName);
  }

  async listPagesDeployments(projectName, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/deployments', null, params);
  }

  async createPagesDeployment(projectName, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/deployments', data);
  }

  async deletePagesDeployment(projectName, deploymentId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/deployments/' + deploymentId);
  }

  async getPagesDeploymentDomains(projectName, deploymentId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/deployments/' + deploymentId + '/domains');
  }

  async addPagesCustomDomain(projectName, domain) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/domains', {
      name: domain
    });
  }

  async deletePagesCustomDomain(projectName, domain) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/pages/projects/' + projectName + '/domains/' + domain);
  }

  // Waiting Room operations
  async listWaitingRooms(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/waiting_rooms', null, params);
  }

  async getWaitingRoom(roomId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/waiting_rooms/' + roomId);
  }

  async createWaitingRoom(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/waiting_rooms', data);
  }

  async updateWaitingRoom(roomId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/waiting_rooms/' + roomId, data);
  }

  async deleteWaitingRoom(roomId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/waiting_rooms/' + roomId);
  }

  async getWaitingRoomStatus(roomId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/waiting_rooms/' + roomId + '/status');
  }

  async listWaitingRoomEvents(roomId, zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/waiting_rooms/' + roomId + '/events', null, params);
  }

  // Custom Pages operations
  async listCustomPages(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_pages', null, params);
  }

  async getCustomPage(identifier, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_pages/' + identifier);
  }

  async updateCustomPage(identifier, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/custom_pages/' + identifier, data);
  }

  // IP Lists operations
  async listIPLists(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/rules/lists', null, params);
  }

  async getIPList(listId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/rules/lists/' + listId);
  }

  async createIPList(data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/rules/lists', data);
  }

  async deleteIPList(listId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/rules/lists/' + listId);
  }

  async listIPListItems(listId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/rules/lists/' + listId + '/items', null, params);
  }

  async createIPListItems(listId, items) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/rules/lists/' + listId + '/items', items);
  }

  async deleteIPListItems(listId, itemIds) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/rules/lists/' + listId + '/items', {
      items: itemIds.map(id => ({ id }))
    });
  }

  // Load Balancing (Enterprise)
  async listLoadBalancers(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/load_balancers', null, params);
  }

  async getLoadBalancer(loadBalancerId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/load_balancers/' + loadBalancerId);
  }

  async createLoadBalancer(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/load_balancers', data);
  }

  async updateLoadBalancer(loadBalancerId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/load_balancers/' + loadBalancerId, data);
  }

  async deleteLoadBalancer(loadBalancerId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/load_balancers/' + loadBalancerId);
  }

  async listLoadBalancerPools(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/load_balancers/pools', null, params);
  }

  async getLoadBalancerPool(poolId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/load_balancers/pools/' + poolId, null, params);
  }

  async createLoadBalancerPool(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/load_balancers/pools', data);
  }

  async updateLoadBalancerPool(poolId, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/load_balancers/pools/' + poolId, data);
  }

  async deleteLoadBalancerPool(poolId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/load_balancers/pools/' + poolId);
  }

  async listLoadBalancerMonitors(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/load_balancers/monitors', null, params);
  }

  async getLoadBalancerMonitor(monitorId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/load_balancers/monitors/' + monitorId, null, params);
  }

  async createLoadBalancerMonitor(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/load_balancers/monitors', data);
  }

  async updateLoadBalancerMonitor(monitorId, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/load_balancers/monitors/' + monitorId, data);
  }

  async deleteLoadBalancerMonitor(monitorId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/load_balancers/monitors/' + monitorId);
  }

  // Health Checks (Enterprise)
  async listHealthChecks(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/healthchecks', null, params);
  }

  async getHealthCheck(healthCheckId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/healthchecks/' + healthCheckId);
  }

  async createHealthCheck(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/healthchecks', data);
  }

  async updateHealthCheck(healthCheckId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/healthchecks/' + healthCheckId, data);
  }

  async deleteHealthCheck(healthCheckId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/healthchecks/' + healthCheckId);
  }

  // Page Rules (Enterprise)
  async listPageRules(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/pagerules', null, params);
  }

  async getPageRule(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/pagerules/' + ruleId);
  }

  async createPageRule(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/pagerules', data);
  }

  async updatePageRule(ruleId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/pagerules/' + ruleId, data);
  }

  async deletePageRule(ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/pagerules/' + ruleId);
  }

  // Stream (Enterprise - Video)
  async listStreams(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/stream', null, params);
  }

  async getStream(videoId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/stream/' + videoId, null, params);
  }

  async uploadStream(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/stream', data);
  }

  async deleteStream(videoId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/stream/' + videoId);
  }

  async listStreamCaptions(videoId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/stream/' + videoId + '/captions', null, params);
  }

  async updateStreamCaption(videoId, language, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/stream/' + videoId + '/captions/' + language, data);
  }

  async deleteStreamCaption(videoId, language) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/stream/' + videoId + '/captions/' + language);
  }

  // Cloudflare Access / Zero Trust (Enterprise)
  async listAccessApplications(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/access/apps', null, params);
  }

  async getAccessApplication(appId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/access/apps/' + appId, null, params);
  }

  async createAccessApplication(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/access/apps', data);
  }

  async updateAccessApplication(appId, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/access/apps/' + appId, data);
  }

  async deleteAccessApplication(appId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/access/apps/' + appId);
  }

  async listAccessPolicies(appId, params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/access/apps/' + appId + '/policies', null, params);
  }

  async createAccessPolicy(appId, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/access/apps/' + appId + '/policies', data);
  }

  async deleteAccessPolicy(appId, policyId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/access/apps/' + appId + '/policies/' + policyId);
  }

  async listAccessGroups(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/access/groups', null, params);
  }

  async createAccessGroup(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/access/groups', data);
  }

  async updateAccessGroup(groupId, data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/access/groups/' + groupId, data);
  }

  async deleteAccessGroup(groupId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/access/groups/' + groupId);
  }

  // API Shield (Enterprise)
  async listAPIShieldEndpoints(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/api_gateway/endpoints', null, params);
  }

  async createAPIShieldEndpoint(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/api_gateway/endpoints', data);
  }

  async deleteAPIShieldEndpoint(endpointId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/api_gateway/endpoints/' + endpointId);
  }

  async listAPIShieldSchemas(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/api_gateway/user_schemas', null, params);
  }

  async createAPIShieldSchema(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/api_gateway/user_schemas', data);
  }

  async deleteAPIShieldSchema(schemaId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/api_gateway/user_schemas/' + schemaId);
  }

  // Spectrum (Enterprise)
  async listSpectrumApps(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/spectrum/apps', null, params);
  }

  async getSpectrumApp(appId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/spectrum/apps/' + appId);
  }

  async createSpectrumApp(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/spectrum/apps', data);
  }

  async updateSpectrumApp(appId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/spectrum/apps/' + appId, data);
  }

  async deleteSpectrumApp(appId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/spectrum/apps/' + appId);
  }

  // Custom Nameservers (Enterprise)
  async listCustomNameservers(params = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/custom_ns', null, params);
  }

  async createCustomNameserver(data = {}) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/custom_ns', data);
  }

  async deleteCustomNameserver(nsId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/custom_ns/' + nsId);
  }

  // Argo Smart Routing (Enterprise)
  async getArgoSmartRouting(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/argo/smart_routing');
  }

  async updateArgoSmartRouting(value, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/argo/smart_routing', { value });
  }

  async getArgoTieredCaching(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/argo/tiered_caching');
  }

  async updateArgoTieredCaching(value, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/argo/tiered_caching', { value });
  }

  // Logpush/Logpull (Enterprise)
  async listLogpushJobs(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/logpush/jobs', null, params);
  }

  async getLogpushJob(jobId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/logpush/jobs/' + jobId);
  }

  async createLogpushJob(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/logpush/jobs', data);
  }

  async updateLogpushJob(jobId, zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/logpush/jobs/' + jobId, data);
  }

  async deleteLogpushJob(jobId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/logpush/jobs/' + jobId);
  }

  // Advanced DDoS Protection (Enterprise)
  async getDDoSSL7Settings(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/ddos/settings');
  }

  async updateDDoSSL7Settings(zoneId = null, data = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/ddos/settings', data);
  }

  // Notifications (Account level)
  async listNotifications() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/alerts');
  }

  async getNotification(alertId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/alerts/' + alertId);
  }

  async listNotificationHistory() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/history');
  }

  // Notification Policies (Enterprise)
  async listNotificationPolicies() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/policies');
  }

  async getNotificationPolicy(policyId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/policies/' + policyId);
  }

  async createNotificationPolicy(data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/alerting/v3/policies', data);
  }

  async updateNotificationPolicy(policyId, data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/alerting/v3/policies/' + policyId, data);
  }

  async deleteNotificationPolicy(policyId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/alerting/v3/policies/' + policyId);
  }

  // Notification Webhooks (Enterprise)
  async listNotificationWebhooks() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/destinations/webhooks');
  }

  async getNotificationWebhook(webhookId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/destinations/webhooks/' + webhookId);
  }

  async createNotificationWebhook(data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/alerting/v3/destinations/webhooks', data);
  }

  async updateNotificationWebhook(webhookId, data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + this.accountId + '/alerting/v3/destinations/webhooks/' + webhookId, data);
  }

  async deleteNotificationWebhook(webhookId) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/alerting/v3/destinations/webhooks/' + webhookId);
  }

  // PagerDuty Integration (Enterprise)
  async getPagerDutyIntegration() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/alerting/v3/destinations/pagerduty');
  }

  async createPagerDutyIntegration(data) {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('POST', '/accounts/' + this.accountId + '/alerting/v3/destinations/pagerduty', data);
  }

  async deletePagerDutyIntegration() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('DELETE', '/accounts/' + this.accountId + '/alerting/v3/destinations/pagerduty');
  }

  // Certificate Management (Custom Certificates)
  async listCertificates(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_certificates');
  }

  async getCertificate(certId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_certificates/' + certId);
  }

  async uploadCertificate(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/custom_certificates', data);
  }

  async updateCertificate(certId, data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/custom_certificates/' + certId, data);
  }

  async deleteCertificate(certId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/custom_certificates/' + certId);
  }

  // Certificate Bundles
  async listCertificateBundles(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_certificates/prioritize');
  }

  async updateCertificateBundles(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/custom_certificates/prioritize', data);
  }

  // Keyless SSL (Enterprise)
  async listKeylessCertificates(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/keyless_certificates');
  }

  async getKeylessCertificate(certId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/keyless_certificates/' + certId);
  }

  async createKeylessCertificate(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/keyless_certificates', data);
  }

  async updateKeylessCertificate(certId, data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/keyless_certificates/' + certId, data);
  }

  async deleteKeylessCertificate(certId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/keyless_certificates/' + certId);
  }

  // Custom Hostnames (Enterprise - SSL for SaaS)
  async listCustomHostnames(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_hostnames');
  }

  async getCustomHostname(hostnameId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_hostnames/' + hostnameId);
  }

  async createCustomHostname(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('POST', '/zones/' + id + '/custom_hostnames', data);
  }

  async updateCustomHostname(hostnameId, data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/custom_hostnames/' + hostnameId, data);
  }

  async deleteCustomHostname(hostnameId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('DELETE', '/zones/' + id + '/custom_hostnames/' + hostnameId);
  }

  // Custom Hostname Fallback Origin
  async getCustomHostnameFallbackOrigin(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/custom_hostnames/fallback_origin');
  }

  async updateCustomHostnameFallbackOrigin(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PUT', '/zones/' + id + '/custom_hostnames/fallback_origin', data);
  }

  // ACM - Advanced Certificate Manager (Enterprise)
  async getACMConfig(accountId = null) {
    const id = accountId || this.accountId;
    if (!id) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + id + '/acm/config');
  }

  async updateACMConfig(accountId = null, data = {}) {
    const id = accountId || this.accountId;
    if (!id) throw new Error('Account ID is required');
    return this.request('PUT', '/accounts/' + id + '/acm/config', data);
  }

  // SSL Verification
  async getSSLVerification(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/ssl/verification');
  }

  // Universal SSL Settings
  async getUniversalSSLSettings(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/ssl/universal/settings');
  }

  async updateUniversalSSLSettings(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/ssl/universal/settings', data);
  }

  // Certificate Authority (CA) Management
  async listCertificateAuthorities() {
    if (!this.accountId) throw new Error('Account ID is required');
    return this.request('GET', '/accounts/' + this.accountId + '/certificate_authorities');
  }

  // Total TLS (Enterprise)
  async getTotalTLSSettings(zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/total_tls');
  }

  async updateTotalTLSSettings(data, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('PATCH', '/zones/' + id + '/total_tls', data);
  }

  // ---------------------------------------------------------------------
  // WAF Rulesets Engine (v2) — replaces legacy packages/groups/rules API.
  // Docs: GET/POST /zones/{zone}/rulesets  and phases/{phase}/entrypoint
  // ---------------------------------------------------------------------
  async listZoneRulesets(zoneId = null, params = {}) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    return this.request('GET', '/zones/' + id + '/rulesets', null, params);
  }

  async getZoneRuleset(rulesetId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId) throw new Error('Ruleset ID is required');
    return this.request('GET', '/zones/' + id + '/rulesets/' + rulesetId);
  }

  async createZoneRuleset(body, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!body || !body.name || !body.kind || !body.phase) {
      throw new Error('ruleset body requires {name, kind, phase}');
    }
    return this.request('POST', '/zones/' + id + '/rulesets', body);
  }

  async updateZoneRuleset(rulesetId, body, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId) throw new Error('Ruleset ID is required');
    return this.request('PUT', '/zones/' + id + '/rulesets/' + rulesetId, body);
  }

  async deleteZoneRuleset(rulesetId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId) throw new Error('Ruleset ID is required');
    return this.request('DELETE', '/zones/' + id + '/rulesets/' + rulesetId);
  }

  async getZoneEntrypoint(phase, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!phase) throw new Error('Ruleset phase is required (e.g. http_request_firewall_custom, http_ratelimit)');
    return this.request('GET',
      '/zones/' + id + '/rulesets/phases/' + encodeURIComponent(phase) + '/entrypoint');
  }

  async updateZoneEntrypoint(phase, body, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!phase) throw new Error('Ruleset phase is required');
    return this.request('PUT',
      '/zones/' + id + '/rulesets/phases/' + encodeURIComponent(phase) + '/entrypoint', body);
  }

  async createRulesetRule(rulesetId, rule, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId) throw new Error('Ruleset ID is required');
    return this.request('POST', '/zones/' + id + '/rulesets/' + rulesetId + '/rules', rule);
  }

  async updateRulesetRule(rulesetId, ruleId, rule, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId || !ruleId) throw new Error('Ruleset ID and Rule ID are required');
    return this.request('PATCH',
      '/zones/' + id + '/rulesets/' + rulesetId + '/rules/' + ruleId, rule);
  }

  async deleteRulesetRule(rulesetId, ruleId, zoneId = null) {
    const id = zoneId || this.zoneId;
    if (!id) throw new Error('Zone ID is required');
    if (!rulesetId || !ruleId) throw new Error('Ruleset ID and Rule ID are required');
    return this.request('DELETE',
      '/zones/' + id + '/rulesets/' + rulesetId + '/rules/' + ruleId);
  }

  // ---------------------------------------------------------------------
  // Workers KV bulk APIs (≤10,000 pairs / ≤100 MB per chunk)
  // ---------------------------------------------------------------------
  async bulkWriteKV(namespaceId, pairs, accountId = null) {
    const acct = accountId || this.accountId;
    if (!acct) throw new Error('Account ID is required');
    if (!namespaceId) throw new Error('KV Namespace ID is required');
    if (!Array.isArray(pairs)) throw new Error('pairs must be an array');
    // Chunk by count (9000, leaves 10% headroom under 10k) AND by payload size.
    const MAX_COUNT = 9000;
    const MAX_BYTES = 90 * 1024 * 1024; // 90 MB
    const chunks = chunkPairs(pairs, MAX_COUNT, MAX_BYTES);
    const results = [];
    for (const chunk of chunks) {
      results.push(await this.request('PUT',
        '/accounts/' + acct + '/storage/kv/namespaces/' + namespaceId + '/bulk', chunk));
      // Small inter-chunk delay to avoid spiky 429s.
      if (chunks.length > 1) await _sleep(100);
    }
    return results;
  }

  async bulkGetKV(namespaceId, keys, accountId = null) {
    const acct = accountId || this.accountId;
    if (!acct) throw new Error('Account ID is required');
    if (!namespaceId) throw new Error('KV Namespace ID is required');
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('keys must be a non-empty array');
    // Cloudflare POST body shape for bulk get is undocumented length — chunk defensively.
    const results = [];
    const MAX = 5000;
    for (let i = 0; i < keys.length; i += MAX) {
      const slice = keys.slice(i, i + MAX);
      results.push(await this.request('POST',
        '/accounts/' + acct + '/storage/kv/namespaces/' + namespaceId + '/bulk/get', slice));
    }
    return results;
  }

  async bulkDeleteKV(namespaceId, keys, accountId = null) {
    const acct = accountId || this.accountId;
    if (!acct) throw new Error('Account ID is required');
    if (!namespaceId) throw new Error('KV Namespace ID is required');
    if (!Array.isArray(keys) || keys.length === 0) throw new Error('keys must be a non-empty array');
    const MAX = 9000;
    const results = [];
    for (let i = 0; i < keys.length; i += MAX) {
      const slice = keys.slice(i, i + MAX);
      results.push(await this.request('POST',
        '/accounts/' + acct + '/storage/kv/namespaces/' + namespaceId + '/bulk/delete', slice));
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

/** Strip baseURL origin/scheme from an axios request URL for error context. */
function stripOrigin(url, baseURL) {
  if (!url) return url;
  if (baseURL && url.startsWith(baseURL)) return url.slice(baseURL.length) || '/';
  // Probably already a relative path; return as-is.
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch (_) { return url; }
}

/**
 * Split KV pairs into chunks respecting both a count ceiling AND a size ceiling.
 * JSON.stringify size is cheaply estimated — conservative (≤90 MB) by design.
 */
function chunkPairs(pairs, maxCount, maxBytes) {
  if (!pairs.length) return [];
  const chunks = [];
  let bucket = [];
  let size = 2; // '[]'
  for (const pair of pairs) {
    const pairStr = JSON.stringify(pair);
    // +1 comma if bucket non-empty
    const add = pairStr.length + (bucket.length ? 1 : 0);
    if ((bucket.length && (bucket.length >= maxCount || size + add > maxBytes))) {
      chunks.push(bucket);
      bucket = [pair];
      size = 2 + pairStr.length;
    } else {
      bucket.push(pair);
      size += add;
    }
  }
  if (bucket.length) chunks.push(bucket);
  return chunks;
}

module.exports = CloudflareClient;
