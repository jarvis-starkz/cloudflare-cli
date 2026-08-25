// =============================================================================
// CloudflareClient — public TypeScript declarations.
//
// Project: cloudflare-cli (cfcli)
// File:    types/cf-client.d.ts
// Purpose: Provide IntelliSense / JSDoc-friendly type information for IDEs
//          and tsc --check consumers. The real implementation lives in
//          src/utils/cf-client.js and this file mirrors only its public API.
//
// NOTE: Methods annotated [DESTRUCTIVE] perform PUT/POST/DELETE requests that
// modify live Cloudflare resources. The CLI layer (src/commands/*.js) already
// gates them through `isDestructiveConfirmed()`; nevertheless, calling these
// methods directly in code also requires operator approval — DO NOT invoke
// them behind the guard in any automation that reuses saved tokens.
// =============================================================================

export = CloudflareClient;

declare class CloudflareClient {
  constructor(config?: CloudflareClient.CloudflareConfig);

  readonly accountId: string;
  readonly apiToken: string;
  readonly zoneId: string;
  readonly baseURL: string;

  // ----- Core transport -----------------------------------------------------

  /** Raw JSON request helper (all typed wrappers call through this). */
  request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown | null,
    params?: Record<string, unknown> | null,
  ): Promise<CloudflareClient.ApiResponse<T>>;

  /**
   * Page-based pagination wrapper. Pass a call accepting {page,per_page,...}
   * and receiving `{result:T[], result_info:{page,per_page,total_pages,count,total_count}}`.
   */
  paginatedList<T = unknown>(
    call: (params: { page: number; perPage: number; params?: Record<string, unknown> }) => Promise<{
      result: T[];
      result_info?: { page: number; per_page: number; total_pages?: number; count?: number; total_count?: number };
      success?: boolean;
    }>,
    opts?: { getAll?: boolean; page?: number; perPage?: number },
  ): Promise<T[]>;

  // ----- Zones --------------------------------------------------------------
  listZones(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<CloudflareClient.Zone[]>>;
  getZone(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<CloudflareClient.Zone>>;
  /** [DESTRUCTIVE] */
  updateZoneSettings(
    zoneId: string | null,
    settings: Record<string, unknown>,
  ): Promise<CloudflareClient.ApiResponse<Array<{ id: string; value: unknown; editable?: boolean }>>>;

  // ----- DNS ---------------------------------------------------------------
  listDnsRecords(
    zoneId?: string | null,
    params?: CloudflareClient.ListParams & { type?: string; name?: string; content?: string; order?: string },
  ): Promise<CloudflareClient.ApiResponse<CloudflareClient.DnsRecord[]>>;
  getDnsRecord(recordId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<CloudflareClient.DnsRecord>>;
  /** [DESTRUCTIVE] */
  createDnsRecord(record: Partial<CloudflareClient.DnsRecord>, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<CloudflareClient.DnsRecord>>;
  /** [DESTRUCTIVE] */
  updateDnsRecord(recordId: string, record: Partial<CloudflareClient.DnsRecord>, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<CloudflareClient.DnsRecord>>;
  /** [DESTRUCTIVE] */
  deleteDnsRecord(recordId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<{ id: string }>>;

  // ----- Firewall (Rules) ---------------------------------------------------
  listFirewallRules(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createFirewallRule(rule: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateFirewallRule(ruleId: string, rule: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteFirewallRule(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Access Rules -------------------------------------------------------
  listAccessRules(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAccessRule(rule: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAccessRule(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listAccountAccessRules(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAccountAccessRule(rule: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateAccountAccessRule(ruleId: string, rule: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAccountAccessRule(ruleId: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- SSL / TLS ----------------------------------------------------------
  getSSLSettings(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<{ id: string; value: string }>>;
  /** [DESTRUCTIVE] */
  updateSSLSettings(value: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getHTTPSRedirect(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateHTTPSRedirect(value: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getHTTP2(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateHTTP2(value: 'on' | 'off', zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Legacy WAF (packages/groups/rules) ---------------------------------
  listWaFRulesets(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getWaFRuleset(packageId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateWaFRuleset(packageId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  listWaFGroups(packageId: string, zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getWaFGroup(packageId: string, groupId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateWaFGroup(packageId: string, groupId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  listWaFRules(packageId: string, zoneId?: string | null, params?: CloudflareClient.ListParams & { matches_on?: string; mode?: string }): Promise<CloudflareClient.ApiResponse<any[]>>;
  getWaFRule(packageId: string, ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateWaFRule(packageId: string, ruleId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Rate Limiting ------------------------------------------------------
  listRateLimits(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getRateLimit(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createRateLimit(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateRateLimit(ruleId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteRateLimit(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Workers ------------------------------------------------------------
  listWorkers(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  uploadWorker(scriptName: string, script: string, metadata?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteWorker(scriptName: string): Promise<CloudflareClient.ApiResponse<any>>;
  listWorkerRoutes(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createWorkerRoute(pattern: string, scriptName: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteWorkerRoute(routeId: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Workers KV ---------------------------------------------------------
  listKVNamespaces(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<CloudflareClient.KVNamespace[]>>;
  /** [DESTRUCTIVE] */
  createKVNamespace(title: string): Promise<CloudflareClient.ApiResponse<CloudflareClient.KVNamespace>>;
  /** [DESTRUCTIVE] */
  deleteKVNamespace(namespaceId: string): Promise<CloudflareClient.ApiResponse<{ id: string }>>;
  listKVKeys(namespaceId: string, params?: CloudflareClient.ListParams & { limit?: number; cursor?: string; prefix?: string }): Promise<CloudflareClient.ApiResponse<Array<{ name: string; expiration?: number; metadata?: any }>>>;
  getKVValue(namespaceId: string, key: string): Promise<string | any>;
  /** [DESTRUCTIVE] */
  putKVValue(namespaceId: string, key: string, value: any, metadata?: null | { metadata?: any; expiration?: number; expiration_ttl?: number }): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteKVKey(namespaceId: string, key: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Workers KV — Bulk (P2) ---------------------------------------------
  /**
   * Write up to 9,000 pairs per request (auto-chunked) via the KV Bulk Write
   * API. [DESTRUCTIVE] (can overwrite existing keys).
   */
  bulkWriteKV(
    namespaceId: string,
    pairs: Array<{ key: string; value: any; base64?: boolean; expiration?: number; expiration_ttl?: number; metadata?: any }>,
    accountId?: string | null,
  ): Promise<Array<CloudflareClient.ApiResponse<any>>>;
  bulkGetKV(
    namespaceId: string,
    keys: string[],
    accountId?: string | null,
  ): Promise<Array<CloudflareClient.ApiResponse<any>>>;
  /** [DESTRUCTIVE] */
  bulkDeleteKV(
    namespaceId: string,
    keys: string[],
    accountId?: string | null,
  ): Promise<Array<CloudflareClient.ApiResponse<any>>>;

  // ----- R2 Buckets (Cloudflare REST API) -----------------------------------
  listR2Buckets(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<{ buckets: CloudflareClient.R2Bucket[] }>>;
  /** [DESTRUCTIVE] */
  createR2Bucket(name: string, location?: string): Promise<CloudflareClient.ApiResponse<CloudflareClient.R2Bucket>>;
  /** [DESTRUCTIVE] */
  deleteR2Bucket(name: string): Promise<CloudflareClient.ApiResponse<any>>;
  getR2Bucket(name: string): Promise<CloudflareClient.ApiResponse<CloudflareClient.R2Bucket>>;

  // ----- Accounts / Membership ---------------------------------------------
  listAccounts(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getAccount(accountId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listMembers(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  purgeCache(zoneId: string | null, files?: string[] | null): Promise<CloudflareClient.ApiResponse<any>>;
  verifyToken(): Promise<CloudflareClient.ApiResponse<{ id: string; status: string; not_before: number }>>;

  // ----- Pages --------------------------------------------------------------
  listPagesProjects(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getPageProject(projectName: string, params?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createPageProject(data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deletePageProject(projectName: string): Promise<CloudflareClient.ApiResponse<any>>;
  listPagesDeployments(projectName: string, params?: any): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createPagesDeployment(projectName: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deletePagesDeployment(projectName: string, deploymentId: string): Promise<CloudflareClient.ApiResponse<any>>;
  getPagesDeploymentDomains(projectName: string, deploymentId: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  addPagesCustomDomain(projectName: string, domain: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deletePagesCustomDomain(projectName: string, domain: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Waiting Room -------------------------------------------------------
  listWaitingRooms(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getWaitingRoom(roomId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createWaitingRoom(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateWaitingRoom(roomId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteWaitingRoom(roomId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getWaitingRoomStatus(roomId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listWaitingRoomEvents(roomId: string, zoneId?: string | null, params?: any): Promise<CloudflareClient.ApiResponse<any[]>>;

  // ----- Custom Pages -------------------------------------------------------
  listCustomPages(zoneId?: string | null, params?: any): Promise<CloudflareClient.ApiResponse<any[]>>;
  getCustomPage(identifier: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateCustomPage(identifier: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- IP Lists -----------------------------------------------------------
  listIPLists(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getIPList(listId: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createIPList(data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteIPList(listId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listIPListItems(listId: string, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createIPListItems(listId: string, items: any[]): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteIPListItems(listId: string, itemIds: string[]): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Load Balancer ------------------------------------------------------
  listLoadBalancers(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getLoadBalancer(loadBalancerId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createLoadBalancer(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateLoadBalancer(loadBalancerId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteLoadBalancer(loadBalancerId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listLoadBalancerPools(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getLoadBalancerPool(poolId: string, params?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createLoadBalancerPool(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateLoadBalancerPool(poolId: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteLoadBalancerPool(poolId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listLoadBalancerMonitors(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getLoadBalancerMonitor(monitorId: string, params?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createLoadBalancerMonitor(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateLoadBalancerMonitor(monitorId: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteLoadBalancerMonitor(monitorId: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Health Checks ------------------------------------------------------
  listHealthChecks(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getHealthCheck(healthCheckId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createHealthCheck(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateHealthCheck(healthCheckId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteHealthCheck(healthCheckId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Page Rules ---------------------------------------------------------
  listPageRules(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getPageRule(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createPageRule(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updatePageRule(ruleId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deletePageRule(ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Stream -------------------------------------------------------------
  listStreams(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getStream(videoId: string, params?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  uploadStream(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteStream(videoId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listStreamCaptions(videoId: string, params?: any): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  updateStreamCaption(videoId: string, language: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteStreamCaption(videoId: string, language: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Access (Zero Trust) ------------------------------------------------
  listAccessApplications(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getAccessApplication(appId: string, params?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createAccessApplication(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateAccessApplication(appId: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAccessApplication(appId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listAccessPolicies(appId: string, params?: any): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAccessPolicy(appId: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAccessPolicy(appId: string, policyId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listAccessGroups(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAccessGroup(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateAccessGroup(groupId: string, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAccessGroup(groupId: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- API Shield ---------------------------------------------------------
  listAPIShieldEndpoints(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAPIShieldEndpoint(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAPIShieldEndpoint(endpointId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listAPIShieldSchemas(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createAPIShieldSchema(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteAPIShieldSchema(schemaId: string): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Spectrum -----------------------------------------------------------
  listSpectrumApps(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getSpectrumApp(appId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createSpectrumApp(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateSpectrumApp(appId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteSpectrumApp(appId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Custom nameservers / Argo ------------------------------------------
  listCustomNameservers(params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  createCustomNameserver(data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteCustomNameserver(nsId: string): Promise<CloudflareClient.ApiResponse<any>>;
  getArgoSmartRouting(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateArgoSmartRouting(value: 'on' | 'off', zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getArgoTieredCaching(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateArgoTieredCaching(value: 'on' | 'off', zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Logpush ------------------------------------------------------------
  listLogpushJobs(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getLogpushJob(jobId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createLogpushJob(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateLogpushJob(jobId: string, zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteLogpushJob(jobId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- DDoS L7 ------------------------------------------------------------
  getDDoSSL7Settings(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateDDoSSL7Settings(zoneId: string | null, data: any): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Notifications ------------------------------------------------------
  listNotifications(): Promise<CloudflareClient.ApiResponse<any>>;
  getNotification(alertId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listNotificationHistory(): Promise<CloudflareClient.ApiResponse<any>>;
  listNotificationPolicies(): Promise<CloudflareClient.ApiResponse<any[]>>;
  getNotificationPolicy(policyId: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createNotificationPolicy(data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateNotificationPolicy(policyId: string, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteNotificationPolicy(policyId: string): Promise<CloudflareClient.ApiResponse<any>>;
  listNotificationWebhooks(): Promise<CloudflareClient.ApiResponse<any[]>>;
  getNotificationWebhook(webhookId: string): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createNotificationWebhook(data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateNotificationWebhook(webhookId: string, data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteNotificationWebhook(webhookId: string): Promise<CloudflareClient.ApiResponse<any>>;
  getPagerDutyIntegration(): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createPagerDutyIntegration(data: any): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deletePagerDutyIntegration(): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Certificates / SSL/TLS ---------------------------------------------
  listCertificates(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any[]>>;
  getCertificate(certId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  uploadCertificate(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateCertificate(certId: string, data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteCertificate(certId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listCertificateBundles(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any[]>>;
  /** [DESTRUCTIVE] */
  updateCertificateBundles(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listKeylessCertificates(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any[]>>;
  getKeylessCertificate(certId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createKeylessCertificate(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateKeylessCertificate(certId: string, data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteKeylessCertificate(certId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- Custom Hostnames (SaaS / Fallback) --------------------------------
  listCustomHostnames(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any[]>>;
  getCustomHostname(hostnameId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createCustomHostname(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateCustomHostname(hostnameId: string, data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteCustomHostname(hostnameId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getCustomHostnameFallbackOrigin(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateCustomHostnameFallbackOrigin(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- ACM / Universal SSL / Total TLS / CA / Verification ----------------
  getACMConfig(accountId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateACMConfig(accountId: string | null, data?: any): Promise<CloudflareClient.ApiResponse<any>>;
  getSSLVerification(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getUniversalSSLSettings(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateUniversalSSLSettings(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  listCertificateAuthorities(): Promise<CloudflareClient.ApiResponse<any[]>>;
  getTotalTLSSettings(zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateTotalTLSSettings(data: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;

  // ----- WAF Rulesets Engine v2 (P1) ----------------------------------------
  listZoneRulesets(zoneId?: string | null, params?: CloudflareClient.ListParams): Promise<CloudflareClient.ApiResponse<any[]>>;
  getZoneRuleset(rulesetId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createZoneRuleset(body: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateZoneRuleset(rulesetId: string, body: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteZoneRuleset(rulesetId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  getZoneEntrypoint(phase: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateZoneEntrypoint(phase: string, body: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  createRulesetRule(rulesetId: string, rule: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  updateRulesetRule(rulesetId: string, ruleId: string, rule: any, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
  /** [DESTRUCTIVE] */
  deleteRulesetRule(rulesetId: string, ruleId: string, zoneId?: string | null): Promise<CloudflareClient.ApiResponse<any>>;
}

declare namespace CloudflareClient {
  /** Constructor config. Layered defaults are applied by src/utils/config.js. */
  export interface CloudflareConfig {
    accountId?: string;
    apiToken?: string;
    zoneId?: string;
    baseURL?: string;
    timeout?: number;
    retries?: number;
    /** R2 S3-compatible credentials — never logged. */
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    r2Endpoint?: string;
    /** Where to persist secrets: auto | keychain | file. See src/utils/config.js. */
    credentialStore?: string;
    keychainService?: string;
    [key: string]: any;
  }

  /** Standard Cloudflare V4 response envelope. */
  export interface ApiResponse<T> {
    success: boolean;
    errors: Array<{ code: number | string; message: string }>;
    messages: any[];
    result: T;
    result_info?: ResultInfo;
  }

  export interface ResultInfo {
    page?: number;
    per_page?: number;
    count?: number;
    total_count?: number;
    total_pages?: number;
    /** Cursor-based endpoints (KV keys) expose opaque cursor fields. */
    cursor?: string;
    cursors?: { before?: string; after?: string };
  }

  export interface ListParams {
    page?: number;
    per_page?: number;
    direction?: 'asc' | 'desc';
    order?: string;
    match?: 'any' | 'all';
    name?: string;
    status?: string;
    [key: string]: any;
  }

  export interface Zone {
    id: string;
    name: string;
    status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
    type?: 'full' | 'partial' | 'secondary';
    name_servers?: string[];
    original_name_servers?: string[];
    plan?: { id?: string; name?: string };
    created_on?: string;
    modified_on?: string;
    account?: { id?: string; name?: string };
  }

  export interface DnsRecord {
    id: string;
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SRV' | 'PTR' | 'CAA' | 'HTTPS' | string;
    name: string;
    content: string;
    ttl?: number; // 1 = auto
    proxied?: boolean;
    priority?: number;
    comment?: string;
    tags?: string[];
    created_on?: string;
    modified_on?: string;
  }

  export interface KVNamespace {
    id: string;
    title: string;
    supports_url_encoding?: boolean;
  }

  export interface R2Bucket {
    name: string;
    location?: string;
    creation_date?: string;
    storage_class?: string;
  }

  /**
   * Structured error surfaced by the axios response interceptor. Cast any
   * thrown unknown to this shape via instanceof; for code without instanceof
   * access, at least the message/httpStatus/code fields are reliable.
   *
   * NOTE: declared here but instantiated in src/utils/formatter.js as the
   * exported `CloudflareApiError` class.
   */
  export interface CloudflareApiErrorShape extends Error {
    code?: number | string;
    httpStatus?: number;
    method?: string;
    path?: string;
    requestId?: string;
    correlation?: string;
  }
}
