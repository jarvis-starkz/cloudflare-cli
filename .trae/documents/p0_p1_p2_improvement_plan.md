# cloudflare-cli P0/P1/P2 功能完善实施计划

## 1. 研究结论与范围

### 1.1 现状（基于仓库代码 + Cloudflare 最新文档）

**仓库结构**：
- `src/index.js` — CLI 入口（Commander + 25 个子命令注册 + preAction 钩子）
- `src/utils/cf-client.js` — 1200+ 行，封装 90+ Cloudflare REST API 方法（Axios）
- `src/utils/config.js` — 4 层配置优先级（参数 > 环境变量 > 文件 > 默认值）
- `src/utils/formatter.js` — 彩色语义化输出 + ASCII 表格
- `src/commands/*.js` — 25 个命令模块

**当前痛点**（来自深度分析报告）：
| # | 痛点 | 严重度 | 对应阶段 |
|---|------|--------|----------|
| 1 | 0 单元测试 / 集成测试 | 高 | P0 |
| 2 | API 429 限流无重试逻辑，批量操作易失败 | 中 | P0 |
| 3 | list 类命令仅取第一页结果（除 rate-limits 外无分页） | 中 | P0 |
| 4 | API Token 明文存 `config/config.json` | 中 | P1 |
| 5 | `config show` 仍显示 Token 前 8 位 | 低 | P1 |
| 6 | WAF 使用旧 packages/groups/rules API，缺少新版 Rulesets Engine | 中 | P1 |
| 7 | 错误仅展示 message 无 stack，调试困难 | 中 | P1 |
| 8 | R2 只有 bucket 管理，无对象级操作（list/get/put/delete） | 低 | P2 |
| 9 | KV 无 bulk write/get/delete 批量 API | 低 | P2 |
| 10 | 纯 JS，无类型注解 | 低 | P2 |

### 1.2 Cloudflare 最新 API 调研结果（通过 MCP cloudflare-api docs/search 检索）

| 模块 | 关键发现 |
|------|----------|
| **WAF Rulesets v2** | 新路径 `/zones/{zone_id}/rulesets`，phase 入口点路径 `/zones/{zone_id}/rulesets/phases/{phase}/entrypoint`，支持 http_request_firewall_custom、http_ratelimit 等 phases |
| **KV 批量 API** | 已存在：`PUT /accounts/{account_id}/storage/kv/namespaces/{ns}/bulk`（≤10000 pairs，≤100MB request body），对应 bulk delete (POST /bulk/delete)、bulk get (POST /bulk/get) |
| **R2 对象操作** | Cloudflare 管理 REST API **仅**有 bucket 级操作（已实现），objects 走 **S3 兼容 API**（endpoint `{account}.r2.cloudflarestorage.com`，需 AWS SigV4 签名），presigned URL 支持 GET/PUT/HEAD/DELETE，过期 1s~7 天 |
| **429 / 限流** | R2 REST API: 1200 req/5min；所有 Cloudflare API 返回 `Retry-After` header；应结合指数退避 + `axios-retry` 模式 |
| **分页** | 通用 `?page=1&per_page=20` 参数，响应体含 `result_info:{page,per_page,total_pages,count,total_cursor}`，cursor 分页部分端点适用 |

### 1.3 安全红线（必须严格执行）

> 用户要求：**严禁使用任何可能保存的 Cloudflare API Tokens 进行修改 / 删除 / 覆盖等破坏性操作；如碰到必须提示用户审批。**

执行策略：
1. **本项目所有代码改动 = 纯代码增强，不触发任何真实 Cloudflare API 调用。**
2. 单元测试使用 `nock` 模拟 HTTP，**完全离线**。
3. 验证用 `node -c` 语法检查 + `jest`（mock） + `--help` 命令，不执行真实 `cfcli create/delete/update`。
4. 如后续用户要在**真实账号**测试，再单独提出审批。

---

## 2. 文件与模块改动

### 2.1 新增文件

| 文件 | 作用 |
|------|------|
| `jest.config.js` | Jest 测试配置（transform: ignore node_modules） |
| `tests/utils/cf-client.test.js` | cf-client 单元测试（nock mock 429重试 + 分页 + 错误处理） |
| `tests/utils/config.test.js` | 配置层测试（4层优先级 + Keychain 回退逻辑） |
| `tests/utils/formatter.test.js` | 输出格式化测试（table/json/彩色语义） |
| `tests/commands/dns.test.js` | DNS 命令典型命令集成测试（commander 解析 + handler 调用） |
| `src/utils/keychain.js` | 跨平台凭证安全存储（优先 `keytar`，回退内存 + 加密 JSON） |
| `src/utils/pagination.js` | 通用分页助手（fetchAllPages，支持 page 分页 + cursor 分页） |
| `src/utils/r2-s3.js` | R2 S3 兼容 API 封装（`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`） |
| `src/commands/rulesets.js` | WAF Rulesets v2 命令模块（list/get/create/update/delete + rules CRUD + phases entrypoint） |
| `types/cf-client.d.ts` | JSDoc / 声明文件，cf-client 类型 |

### 2.2 修改文件

| 文件 | 改动 |
|------|------|
| `package.json` | 新增依赖：`jest`、`nock`、`axios-retry`、`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`、`crypto-js`；devDeps 增加 `@types/node`；`scripts.test` = `jest`；engines 保留 Node 14+（避免 axios-retry/keytar 不兼容） |
| `.gitignore` | 忽略 `.jest-cache/`、`coverage/`、`*.local.json` |
| `.env.example` | 新增可选变量：`CFCLI_KEYCHAIN_SERVICE=cfcli`、`CFCLI_CREDENTIAL_STORE=auto\|file\|keychain`、`CLOUDFLARE_R2_ACCESS_KEY_ID`、`CLOUDFLARE_R2_SECRET_ACCESS_KEY` |
| `src/utils/cf-client.js` | (1) 引入 `axios-retry`，对 429/5xx 最多 5 次指数退避，遵循 `Retry-After`；(2) 引入 `pagination` helper，新增 `paginate(fn)` 包装；(3) 新增 WAF Rulesets v2 方法组；(4) 新增 KV bulk write/get/delete 方法；(5) 所有错误抛出自定义 `CloudflareApiError(code, http, requestId, stack)`；(6) JSDoc 补全 |
| `src/utils/config.js` | (1) 引入 `keychain` 模块；(2) save 时 Token/Key 改存 Keychain（store=auto 时优先）；(3) `showConfig` 默认完全隐藏凭证，加 `--show-secrets` 才显示；(4) `init` 向导增加存储方式选择 |
| `src/utils/formatter.js` | 新增 `formatVerboseError(err, verbose)`：verbose=true 时打印 stack + request_id + correlation 头 |
| `src/index.js` | (1) 全局选项 `-v, --verbose`（覆盖所有子命令）；(2) preAction 注入 `program.opts().verbose`；(3) 注册 `rulesets` 新命令；(4) catch 错误时调用 `formatVerboseError` |
| `src/commands/config.js` | `show` 命令新增 `--show-secrets` 选项（默认 false，不打印任何 Token/Key） |
| `src/commands/dns.js` | `list` 命令新增 `--all` 选项（自动分页），`--page`/`--per-page` 透传 |
| `src/commands/kv.js` | `keys` 新增 `--all`；新增 `bulk-write --file`、`bulk-get --keys`、`bulk-delete --keys` |
| `src/commands/r2.js` | 新增 `objects list`/`objects get`/`objects put`/`objects delete`、`presign <get\|put> --key --expiry` 子命令组（使用 `r2-s3.js` S3 SDK） |
| `src/commands/waf.js` | 在 waf 命令组下新增 `rulesets` 别名子命令指向 rulesets 模块 |
| `README.md` | 增补 P0/P1/P2 新功能说明、凭证安全策略、测试运行方法、Rulesets 示例、KV bulk 示例、R2 对象操作示例 |

---

## 3. 实施步骤（按依赖顺序）

### 阶段 1：基建与测试框架（P0-1）
1. 在 `package.json` 新增 jest/nock/axios-retry/crypto-js/@aws-sdk 依赖，`npm test` 脚本
2. 写 `jest.config.js`（testEnvironment: node；transform: 无）
3. 写 `tests/utils/formatter.test.js` → 断言表格/json/颜色输出
4. 写 `tests/utils/config.test.js` → 断言 4 层优先级合并；模拟 Keychain 接口（mock）
5. 写 `tests/utils/cf-client.test.js` → nock mock API：成功/404/429（重 3 次后 200）/5xx（重试耗尽抛错）/ 分页连续 3 页合并
6. 写 `tests/commands/dns.test.js` → 手动 program.parse 解析命令，断言 handler 被调用参数正确（不实际访问网络）
7. 本地跑 `npm test`，全部用例通过

### 阶段 2：429 限流 + 自定义错误（P0-2）
8. 修改 `cf-client.js`：导入 `axios-retry`，配置 `retryCondition = 429/5xx`、`retries=5`、`retryDelay=exponentialDelay`、读取 `Retry-After` 并优先
9. 定义 `CloudflareApiError` 类（code/http/method/path/requestId/stack），拦截器把 axios error 统一转换
10. 修改 `formatter.js` 增加 `formatVerboseError`
11. 修改 `index.js` 加全局 `-v, --verbose`，preAction 注入；顶层 try/catch 调用 formatter
12. 修改 `README.md` 记录用法
13. 补充/更新 cf-client.test.js 对应 429 重试用例通过

### 阶段 3：分页助手 + `--all`（P0-3）
14. 新建 `src/utils/pagination.js`：`await paginate(apiCall, opts)`（遍历 `result_info.total_pages`，并发 ≤2，避免再次 429），cursor 分页走 `result_info.cursor`
15. 修改 `cf-client.js`：listZones/listDnsRecords/listFirewallRules/listWafRulesets/listWorkers/listNamespaces/listBuckets/... 加 `{ getAll=true|false, page, perPage }` 参数分支
16. 修改 `dns.js` / `kv.js` / `zone.js`（select）：新增全局一致的 `--all` 与 `--page N --per-page N`；未指定时保持默认行为（第 1 页）以免破坏向后兼容
17. 新增分页测试 → `npm test` 通过
18. 验证 `cfcli dns list --help` 显示新选项

### 阶段 4：凭证安全存储（P1-1）
19. 新建 `src/utils/keychain.js`：尝试 `require('keytar')`（如不可用/安装失败则 catch 并自动 fallback 到 `config/credentials.enc.json`（AES + 用户 `--master-pass` 或机器指纹 + salt）；对外 API：`getPassword(service, account)`、`setPassword(service, account, value)`、`deletePassword(...)`；环境变量 `CFCLI_CREDENTIAL_STORE` 覆盖
20. 修改 `config.js`：`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_EMAIL` / `CLOUDFLARE_ACCOUNT_ID` 等敏感项 save/load 走 Keychain；文件中只存非敏感元数据（默认 zone_id、默认 account_id、format 默认值）；`init` 向导询问"凭证存储方式：OS Keychain(推荐) / 加密文件"
21. 修改 `commands/config.js show`：新增 `--show-secrets` 开关（默认 false）；关闭时 Token/Key/AccessKey 显示 `******` 不显示前 8 位
22. 更新 `.env.example` + `README.md` 安全策略章节
23. config.test.js 补齐 `--show-secrets` 用例 → 通过

### 阶段 5：WAF Rulesets v2（P1-2）
24. `cf-client.js` 新增方法组：
    - `listZoneRulesets(zoneId, {page,perPage})` → GET `/zones/{zone}/rulesets`
    - `getZoneRuleset(zoneId, rulesetId)` → GET `.../{id}`
    - `createZoneRuleset(zoneId, body)` → POST
    - `updateZoneRuleset(zoneId, rulesetId, body)` → PUT
    - `deleteZoneRuleset(zoneId, rulesetId)` → DELETE
    - `getZoneEntrypoint(zoneId, phase)` → GET `phases/{phase}/entrypoint`
    - `updateZoneEntrypoint(zoneId, phase, rules)` → PUT（创建/覆盖该 phase 的 rule 列表）
    - `createRulesetRule(zoneId, rulesetId, rule)` → POST `.../{id}/rules`
    - `updateRulesetRule(zoneId, rulesetId, ruleId, rule)` → PATCH
    - `deleteRulesetRule(zoneId, rulesetId, ruleId)` → DELETE
25. 新建 `src/commands/rulesets.js`：
    - `cfcli rulesets list --zone-id <id> [--phase http_ratelimit|...] [--all]`
    - `cfcli rulesets get <id> --zone-id <id>`
    - `cfcli rulesets create --zone-id <id> --name <name> --kind <zone/custom> --phase <phase> [--rules-file <json>]`
    - `cfcli rulesets update <id> --zone-id <id> [--name] [--rules-file]`
    - `cfcli rulesets delete <id> --zone-id <id>`
    - `cfcli rulesets entrypoint get --phase <phase> --zone-id <id>`
    - `cfcli rulesets entrypoint update --phase <phase> --zone-id <id> --rules-file <json>`
    - `cfcli rulesets rule create <ruleset_id> --zone-id <id> --expression <expr> --action <block/challenge/log/...> [--action-params <json>]`
    - 对应 `rule update/delete`
26. `index.js` 注册 rulesets 模块；`waf.js` 增加 `cfcli waf rulesets ...` 别名指向 rulesets 命令
27. 新增 `tests/commands/rulesets.test.js`（command parsing + mock）
28. README 新增示例：`cfcli rulesets entrypoint update --phase http_request_firewall_custom --rules-file rules.json --zone-id <id>`
29. 跑 `npm test` → 通过

### 阶段 6：verbose 错误输出完善（P1-3）
30. 所有 `commands/*.js` 的 catch 块统一：`formatVerboseError(e, program.opts().verbose)` 代替原来的 `formatError(e.message)`；保持向后兼容（默认只打 message）
31. `cf-client.js` 抛出 `CloudflareApiError` 时带上 `config.url` + `method` + `X-Request-Id`（axios response headers）
32. `tests/utils/cf-client.test.js` 断言错误对象含 code/method/path/requestId
33. `cfcli config --help` / `cfcli -V -v` 自测语法无错

### 阶段 7：R2 对象级操作（P2-1）
34. 新建 `src/utils/r2-s3.js`：
    - 构造函数接收 `{ accountId, accessKeyId, secretAccessKey }`（accountId 来自 program.opts().config.accountId 或 CLOUDFLARE_ACCOUNT_ID）
    - 内部实例化 `S3Client({ region: 'auto', endpoint: \`https://\${accountId}.r2.cloudflarestorage.com\`, credentials })`
    - 方法：`listObjectsV2({ bucket, prefix, maxKeys, continuationToken })`、`getObject({ bucket, key })` → Buffer + metadata、`putObject({ bucket, key, body, contentType })`、`deleteObject({ bucket, key })`、`generatePresignedUrl(operation, { bucket, key, expiresIn })`（operation=get/put/head/delete）
35. 修改 `commands/r2.js`：新增 `objects` 子命令组：
    - `cfcli r2 objects list --bucket <name> [--prefix <p>] [--all]`
    - `cfcli r2 objects get --bucket <name> --key <k> [--out <file>]`（默认 stdout，指定 --out 写文件）
    - `cfcli r2 objects put --bucket <name> --key <k> [--file <file>|--body <text>] [--content-type <ct>]`
    - `cfcli r2 objects delete --bucket <name> --key <k>`
    - `cfcli r2 presign <get|put|head|delete> --bucket <name> --key <k> --expiry 3600`
    - **凭证来源**：优先 `--access-key-id`/`--secret-access-key` 命令行，否则 `CLOUDFLARE_R2_*` env，否则 Keychain（阶段 4 的 Keychain 存 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`）
36. 注意：不执行真实上传下载，测试仅用 jest mock S3Client；写 `tests/utils/r2-s3.test.js` → mock @aws-sdk/client-s3，断言参数签名 endpoint 正确
37. README 增补 R2 对象操作示例 + presign 示例；强调 R2 对象操作不经过 Cloudflare 管理 REST API，也不受其 1200/5min 限制，但仍有**同 object 并发写返回 429** 的文档警告

### 阶段 8：KV 批量 API（P2-2）
38. `cf-client.js` 新增方法：
    - `bulkWriteKV(accountId, namespaceId, [{key,value,expiration?,expiration_ttl?,metadata?}, ...])` → PUT `.../bulk`（body JSON 数组；自动 chunk 每 ≤10000 pairs 或 ≤100MB，并串行处理，返回每个 chunk 的 result）
    - `bulkGetKV(accountId, namespaceId, [key1, key2, ...])` → POST `.../bulk/get`
    - `bulkDeleteKV(accountId, namespaceId, keys)` → POST `.../bulk/delete` 或 DELETE `.../bulk`（按 OpenAPI，兼容两种路径）
39. `commands/kv.js` 新增子命令：
    - `cfcli kv bulk-write --namespace-id <id> --file <json>`（--file 为 JSON array，- 表示 stdin）
    - `cfcli kv bulk-get --namespace-id <id> --keys k1,k2,... [--keys-file <line-delimited>]`
    - `cfcli kv bulk-delete --namespace-id <id> --keys k1,k2,...`
    - `cfcli kv keys` 列表新增 `--all`（阶段 3 的分页）
40. `tests/commands/kv.test.js` 断言命令解析 + bulk API 调用参数正确（nock mock）

### 阶段 9：类型完善（P2-3 / 轻量，不迁移 TS）
41. 写 `types/cf-client.d.ts`：
    - 导出 `CloudflareClientConfig`、`CFClient`、所有 API 方法参数/返回类型（按现有方法签名总结）
    - 导出 `CloudflareApiError` 类型
    - 导出 `PaginationOptions`、`PaginatedResult<T>`
42. 在 `cf-client.js`、`config.js`、`formatter.js` 文件顶部加 JSDoc：
    - `/** @typedef {import('../../types/cf-client').CFClient} CFClient */`
    - 在函数上补 `@param` / `@returns`
43. 在 `package.json` 加 `"types": "types/cf-client.d.ts"`（方便后续作为 lib 引用），不强制 tsc

### 阶段 10：文档汇总与最终验证
44. `README.md` 追加：
    - 测试章节：`npm test`、`npm run test:cov`
    - 凭证安全策略章节：Keychain + fallback、`--show-secrets`、**绝不硬编码**
    - Rulesets 命令示例 4 条、KV bulk 示例 3 条、R2 对象操作示例 5 条
    - 全局选项：`--verbose`、`--all`
    - 安全红线重申："脚本本工具不提供内建 Token，所有修改操作均由用户显式触发。"
45. 最终运行：
    - `npm test -- --runInBand` → 全部绿色
    - `node -c src/index.js && node -c src/utils/cf-client.js && ...` → 无语法错误
    - `node src/index.js --help` → 显示 verbose 选项
    - `node src/index.js dns list --help` → 显示 --all/--page/--per-page
    - `node src/index.js rulesets --help` → 新命令组展示
    - `node src/index.js r2 objects --help` → 新子命令组展示
    - `node src/index.js config show --help` → 显示 --show-secrets

---

## 4. 依赖与兼容性考虑

| 依赖 | 版本约束 | 原因 |
|------|----------|------|
| `axios-retry` | ^3.9.0 | axios 1.x 兼容，保持 CommonJS（纯 require） |
| `jest` | ^29.7.0 | Node 14 兼容最后一版；不引入 v30+（要求 Node 18） |
| `nock` | ^13.5.4 | 稳定、兼容 Jest 29 |
| `@aws-sdk/client-s3` | ^3.556.0 | 兼容 Node 14 最后一版大版本区间；避免用 v4 |
| `@aws-sdk/s3-request-presigner` | 同 client-s3 | 成对升级 |
| `crypto-js` | ^4.2.0 | AES 加密 JSON fallback（keytar 不可用时）；MIT |
| `keytar` | ^7.9.0 | **可选依赖 optionalDependencies**：prebuilt 二进制，失败不阻塞安装；Node 14+ 兼容；自动 fallback（见阶段 4） |
| `@types/node` | ^18.19.0 | devDependency；声明文件用 |

**向后兼容保证**：
- 所有命令默认行为不变（默认不加 `--all` 仍只取第一页；默认不加 `--verbose` 仍只打 message；默认 `config show` 完全隐藏敏感字段）
- 配置文件格式：新增 `credentialStore` 字段；老 config.json 读入时自动迁移敏感字段到 Keychain（一次性提示）
- 不影响 4 套 PPT 脚本（`docs/ppt/*.mjs`）、`scripts/generate-ppt.js`

**破坏性操作防护**：
- 所有会产生 mutation 的命令（update/delete/put/bulk-write/presign）在 help 文本加 `⚠ 此操作会修改真实 Cloudflare 资源` 前缀；当 `program.opts().verbose` 或检测到有 `--confirm` 缺失时：
  - **但默认不直接拦截**（保持原行为，兼容 CI/CD 脚本），改在 README 的安全章节明确标注，并在 `cfcli` 根 help 尾部加"提示：所有修改类命令请先在测试账号验证。由于 CLI 不记录操作日志，建议先导出当前配置备份。"
  - 对 `delete` / `bulk-delete` 类命令增加环境变量 `CFCLI_CONFIRM_DESTRUCTIVE=1` 要求；未设置时提示用户"如需跳过确认，请设置该环境变量"，但实际执行前**不会真实调用 API**（只是 exit code 1 + 打印提示），避免误伤；需在测试中通过设置 env 覆盖以正常跑 mock。

---

## 5. 验证清单（每项必须通过）

### 5.1 自动化
- [ ] `npm test` 0 failures（无网络连接情况下亦可通过）
- [ ] `npm test -- --coverage` 新增代码覆盖率 ≥ 65%（对新增 utils/commands 模块）

### 5.2 CLI 冒烟
- [ ] `node src/index.js --help` 输出末尾显示 `-v, --verbose` 和 20+ 示例
- [ ] `node src/index.js dns list --help` 显示 `--all --page --per-page`
- [ ] `node src/index.js r2 objects --help` 显示 5 个子命令
- [ ] `node src/index.js rulesets --help` 显示 rulesets/rules 相关命令
- [ ] `node src/index.js config show --help` 显示 `--show-secrets`
- [ ] `node src/index.js kv --help` 显示 `bulk-write / bulk-get / bulk-delete`

### 5.3 安全
- [ ] `config show` 不带 `--show-secrets` 时：Token/Account ID/Email 均显示 `********`（不显示前 8 位）
- [ ] 生成的 `config/config.json` 新格式不存 api_token 明文（如 store=keychain 或 enc 时）
- [ ] 单元测试中未出现任何真实 Cloudflare 域名的未 mock 网络请求（nock.enableNetConnect(false) 兜底）
- [ ] **任何情况下，执行过程中未调用 Cloudflare MCP `execute` 工具对真实资源做修改**（仅用 docs/search 做研究）

---

## 6. 风险与处置

| 风险 | 等级 | 处置 |
|------|------|------|
| keytar 在某些 Windows 机器上编译失败 | 中 | 已设为 optionalDependencies；自动 fallback 到 `crypto-js` AES 文件加密；README 提示"如需 Keychain 可手动 `npm i keytar` + 安装 build tools" |
| @aws-sdk/client-s3 体积较大（~10MB） | 低 | 正常；不影响 CLI 启动速度；若用户在意可用动态 `require`，加载 r2-s3.js 时才首次 require |
| Jest 29 与旧 Node ≤14 的兼容性 | 中 | 若本仓库实际 Node < 16（README 要求 >=14），Jest 29 要求 Node >=14.15；在 package.json engines 收紧为 `>=14.17` 并在 README 说明 |
| KV bulk 请求体超过 100MB 导致 413 | 中 | 在 `cf-client.bulkWriteKV` 内自动按 9000 pairs 或 90MB（比文档极限留 10% 余量）切 chunk 并串行执行；超量时 warn |
| 新增 rulesets 命令与旧 waf packages 命令命名混淆 | 低 | 采用 `cfcli rulesets` 顶层命令组；在 `cfcli waf rulesets` 做别名，并在 help 中加提示"本命令基于新版 Rulesets Engine；旧 packages/groups/rules 路径仍可通过 `cfcli waf packages|groups|rules` 使用" |
| 分页 `--all` 对超大量结果仍会触发 429 | 中 | paginate helper 内部加 `min(并发=1, Math.min(result_info?.per_page/?, 2))`，且每一页之间 `sleep 200ms`；重试已在 axios-retry 统一处理；README 提示"如数据量超 5 万条建议配合 cursor 或分批导出" |
| 删除类命令破坏性（`CFCLI_CONFIRM_DESTRUCTIVE` 机制）可能导致已有 CI/CD 脚本失败 | 中 | 该机制**只对** `cfcli * delete` / `cfcli * bulk-delete` / `cfcli cache purge --everything` 生效；默认对非交互 stdout (CI) 环境**自动跳过确认**（通过 `process.stdout.isTTY` 判断）；README 明示 |
