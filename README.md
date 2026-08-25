# Cloudflare CLI (cfcli)

A comprehensive command-line interface for managing Cloudflare configurations, including DNS records, zones, firewall rules, WAF, SSL/TLS settings, Workers, KV Storage, R2 Storage, Pages, Waiting Room, Custom Pages, IP Lists, and **Enterprise Plan features** (Load Balancer, Health Checks, Page Rules, Stream, Access/Zero Trust, API Shield, Spectrum, and more).

## Features

### Core Features
- **Zone Management**: List zones, view zone details, manage zone settings
- **DNS Management**: Create, read, update, delete DNS records (A, AAAA, CNAME, MX, TXT, SRV, etc.)
- **Firewall Management**: Manage firewall rules and access rules (IP/country blocking)
- **WAF Management**: Web Application Firewall - packages, groups, rules, rate limiting
- **SSL/TLS Management**: Configure SSL mode, HTTPS redirect, HTTP/2, minimum TLS version
- **Workers Management**: Upload, delete, and manage Cloudflare Workers and routes
- **KV Storage**: Manage KV namespaces and key-value pairs
- **R2 Storage**: Manage R2 buckets
- **Pages Management**: Manage Pages projects, deployments, and domains
- **Waiting Room**: Manage waiting rooms and events
- **Custom Pages**: Manage custom error pages
- **IP Lists**: Manage IP lists and items
- **Account Management**: View account details, manage members, verify API token
- **Cache Management**: Purge cache, toggle development mode

### Enterprise Plan Features
- **Load Balancer**: Manage load balancers, pools, and monitors
- **Health Checks**: Monitor origin server health
- **Page Rules**: URL-based traffic management rules
- **Stream**: Video streaming service management
- **Access / Zero Trust**: Zero trust access control, applications, policies, groups
- **API Shield**: API security with endpoint and schema management
- **Spectrum**: TCP/UDP proxy applications
- **Custom Nameservers**: Custom domain name servers
- **Argo Smart Routing**: Intelligent network routing optimization
- **Logpush**: Log delivery to external destinations
- **DDoS Protection**: DDoS protection settings
- **Notifications**: Alert notifications, policies, webhooks, PagerDuty integration
- **Keyless SSL**: Enterprise keyless SSL certificates
- **Custom Hostnames**: Enterprise SSL for SaaS custom hostnames
- **Total TLS**: Enterprise Total TLS certificate management
- **Advanced Certificate Manager (ACM)**: Enterprise ACM configuration

> **Note**: When adding new features, Enterprise Plan functionality is prioritized and included if available.

## Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
```

3. (Optional) Link the CLI globally:

```bash
npm link
```

## Configuration

### Quick Start

Run the initialization wizard:

```bash
cfcli init
```

This will prompt you for:
- **Account ID**: Found at https://dash.cloudflare.com → Account Home → Account ID
- **API Token**: Create at https://dash.cloudflare.com/profile/api-tokens
- **Zone ID**: Found at https://dash.cloudflare.com → Your Domain → Zone ID (right sidebar)

### Environment Variables

Alternatively, you can set environment variables:

```bash
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export CLOUDFLARE_ZONE_ID=your_zone_id
```

Or create a `.env` file in the project root (copy from `.env.example`).

### Configuration Priority

1. Command-line options (highest priority)
2. Environment variables
3. Config file (`config/config.json`)
4. Default values

## Usage

### Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output version number |
| `-v, --verbose` | Enable **verbose error output** — prints HTTP status, Cloudflare error code, request ID, x-cf-correlate, and a stack trace on failure. Off by default for clean human output. Independent of `-j/--json`. |
| `-j, --json` | Output JSON (supported by most list/get commands) |
| `-h, --help` | Display help for command |

---

## P0/P1/P2: Reliability, Security & Feature Matrix

The following non-functional and functional enhancements were added in the P0/P1/P2 hardening pass. **None of these changes ever mutate live Cloudflare resources on their own — destructive mutations only run when YOU explicitly invoke the matching delete/update command.**

### Tier P0 — Foundational Reliability (Always On)

| Area | Behavior | How to trigger |
|------|----------|----------------|
| 429 / 5xx retry | `axios-retry` with exponential backoff (default 5 retries). Honors the `Retry-After` response header exactly. Timeout resets each attempt. | Automatic; tweak via `retries`/`timeout` in `CloudflareClient` constructor. |
| Structured errors | Every failing HTTP call (>= 400) throws a `CloudflareApiError` carrying `{ message, httpStatus, code, method, path, requestId, correlation, stack }`. | Automatic. Pair with `-v/--verbose` CLI flag to dump the full payload. |
| Pagination `--all` | List commands (dns list, zone list, r2 objects list, kv keys list, ...) support `--all` which walks every page sequentially with a small inter-page delay, never missing the last page, capped at 1000 requests safety. | `cfcli <cmd> list --all` or `--page N --per-page M` |
| Unit test harness | Jest + nock; all tests **offline** (no real Cloudflare calls). Coverage on pagination, retry, error shaping, KV chunking, Rulesets routing, option parsing. | `npm test` (all 4 suites / 25 tests) |

### Tier P1 — Security Hardening

| Area | Behavior |
|------|----------|
| **Credential storage (auto / file / keychain)** | `cfcli init` now asks which store to use: `auto` (default, prefers OS keychain, falls back to AES-encrypted JSON), `file` (plain JSON legacy), `keychain` (strict, error if OS keychain unavailable). Keys persisted securely: `apiToken`, `accountId`, `globalApiKey`, `r2AccessKeyId`, `r2SecretAccessKey`. |
| **Secret masking in `cfcli config show`** | Secrets are fully redacted (`********`) unless `--show-secrets` is passed; no prefix/substring leakage. Non-secrets (e.g. contact email) display as-is. |
| **`CFCLI_CONFIRM_DESTRUCTIVE=1` TTY guard** | Any `*delete*` / `*bulk-delete*` / `rulesets delete` command checks `isDestructiveConfirmed()`. In a TTY session the CLI requires `CFCLI_CONFIRM_DESTRUCTIVE=1` in the environment; non-TTY (CI) skips the prompt because CI inputs are assumed to be reviewed. Error message explicitly says: *"destructive op not confirmed — set CFCLI_CONFIRM_DESTRUCTIVE=1 or run in CI"*. |
| **WAF Rulesets Engine v2 (`cfcli rulesets ...`)** | New command module. Replaces legacy `waf packages/groups/rules` API with modern phases + entrypoints + rules (http_request_firewall_custom, http_ratelimit, http_request_sanitize, http_log_custom_fields, etc.). Supports `list / get / create / update / delete` on rulesets and `entrypoint get/update` per phase. Legacy `cfcli waf ...` kept for backward compat; `cfcli waf rulesets-v2` is an alias. |
| **Verbose error surface** | All command modules route their `try/catch` through `formatVerboseError(err, opts.verbose)`, giving one consistent UX for failures. |

### Tier P2 — New Capabilities

| Capability | Command surface |
|------------|-----------------|
| **Workers KV bulk API** | `cfcli kv bulk-write --namespace-id <id> --file seed.json` (JSON array of `{key, value}` or object record), `cfcli kv bulk-get --namespace-id <id> --file keys.txt` (one key per line), `cfcli kv bulk-delete --namespace-id <id> --file keys.txt`. Automatically chunked at **9000 pairs per request** (Cloudflare limit is 10 000; we leave 10% headroom). |
| **R2 objects (S3-compatible API)** | `cfcli r2 objects list --bucket <name> [--prefix foo] [--all]`, `cfcli r2 objects put --bucket <name> --key path/to.bin --file ./local.bin`, `cfcli r2 objects get --bucket <name> --key path/to.bin --file ./out.bin`, `cfcli r2 objects delete --bucket <name> --key path/to.bin`, `cfcli r2 presign --bucket <name> --key path/to.bin --expires 900 [--put]`. Uses AWS SDK S3 client `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` dynamically (optional deps; CLI surfaces a clean install hint if missing). |
| **JSDoc + Type declarations** | `types/cf-client.d.ts` describes the `CloudflareClient` public API surface (DNS / Zone / Firewall / WAF legacy + Rulesets v2 / KV including bulk / R2 buckets / Workers / Pages / LB / Health Checks / Access / ... / Account / Cache / Notifications / Certificate). VSCode / tsserver pick it up automatically via `package.json` > `types`. |
| **Top-level safety net** | `process.on('unhandledRejection', ...)` plus try/`program.parse()` wrapper always print a concise error. No silent promise rejections. |

### Environment Variables (P0/P1/P2 additions)

```bash
CLOUDFLARE_ACCOUNT_ID      # Account ID
CLOUDFLARE_API_TOKEN       # API Token (preferred; NEVER hardcode — use env or keychain)
CLOUDFLARE_ZONE_ID         # Default Zone ID
CFCLI_CREDENTIAL_STORE     # auto | file | keychain
CFCLI_KEYCHAIN_SERVICE     # OS keychain service name (default: cfcli)
CFCLI_CONFIRM_DESTRUCTIVE  # Set to '1' in TTY sessions to approve *delete* commands
CLOUDFLARE_R2_ACCESS_KEY_ID     # S3-compatible access key for r2 objects/presign
CLOUDFLARE_R2_SECRET_ACCESS_KEY # S3-compatible secret key for r2 objects/presign
```

See `.env.example` for a safe template (copy, **never commit the real copy**).

### Destructive-Operation Approval Policy (IMPORTANT)

Per project rules, this tool **never** uses any cached Cloudflare API tokens for modify/delete/overwrite operations behind the scenes. The safety rails are:

1. **Explicit CLI invocation only.** Tokens are only used for the exact command the user typed; no background sync, no auto-migration.
2. **TTY guard.** If you run a `delete`/`bulk-delete`/`rulesets delete`/`kv bulk-delete` etc. in an interactive shell, the command aborts unless you prefixed it with `CFCLI_CONFIRM_DESTRUCTIVE=1`. This guarantees you, the operator, see and approve the call.
3. **CI auto-pass.** If stdout is not a TTY (scripts, GitHub Actions, cd jobs), the guard is skipped because the pipeline definition itself is the review artifact.
4. **The `--verbose` flag on destructive calls** always prints the method, path, and request ID *after* Cloudflare acknowledges the call, making it easy to correlate dashboards with the terminal.

**If any future automated code path ever proposes deletion/modification without you explicitly running that command on the CLI, STOP and manually review — this README and the `isDestructiveConfirmed()` contract above represent the approved policy.**

---

### Tier P3 — CLI-First Architecture: Auto-Adapting GUI/TUI

**Core principle**: All future add/delete/modify operations target the **CLI only**. The GUI and TUI **never hardcode any command** — they read a command registry JSON that is auto-discovered from the Commander program tree, and automatically render forms/menus for every command, including new ones added later.

#### How It Works

```
┌──────────────────────────────────────────────────┐
│              src/commands/*.js                    │
│   (Commander command modules — the ONLY source    │
│    of truth for command definitions)              │
└──────────────────┬───────────────────────────────┘
                   │ require + program.command()
                   ▼
┌──────────────────────────────────────────────────┐
│           src/utils/registry.js                   │
│   Walks the Commander program tree recursively    │
│   → extracts name, description, options,          │
│     subcommands, defaults, aliases, usage         │
│   → Outputs a JSON "command registry"             │
└──────┬───────────────┬───────────────┬───────────┘
       │               │               │
  ┌────▼─────┐   ┌────▼──────┐  ┌────▼──────────┐
  │ cfcli    │   │ cfcli gui │  │ cfcli tui      │
  │ commands │   │ (Web GUI) │  │ (Terminal UI)  │
  │ (JSON/   │   │ Reads /   │  │ Reads registry  │
  │  table/  │   │ api/      │  │ → inquirer menu │
  │  tree/md)│   │ registry  │  │ → option prompts│
  └──────────┘   │ → renders │  │ → execute       │
                 │ forms     │  └─────────────────┘
                 └───────────┘
```

#### Command Registry Commands

| Command | Description |
|---------|-------------|
| `cfcli commands list` | List all leaf commands in a table |
| `cfcli commands json` | Dump full registry as JSON (for GUI/TUI/tooling consumption) |
| `cfcli commands tree` | Show indented command tree |
| `cfcli commands markdown` | Auto-generate Markdown command documentation |
| `npm run registry` | Shortcut for `cfcli commands json` |

#### Web GUI (`cfcli gui`)

```bash
# Start the Web GUI on http://localhost:7700
cfcli gui

# Custom port
cfcli gui --port 8080

# Read-only mode (no command execution — safe for demo/display)
cfcli gui --no-run
```

The Web GUI provides:
- **Sidebar navigation** — auto-grouped by top-level command
- **Option forms** — auto-generated from each command's option metadata
- **Command preview** — shows the equivalent CLI command as you fill options
- **Run button** — executes the command and displays stdout/stderr
- **Destructive badge** — commands matching `delete|bulk-delete|clear` are flagged

#### Terminal UI (`cfcli tui`)

```bash
# Launch interactive TUI
cfcli tui
```

The TUI uses `inquirer` (already a project dependency):
- **Command selection** — searchable list grouped by category
- **Option prompts** — type-aware (boolean → confirm, value → input)
- **Destructive confirmation** — extra yes/no before delete commands
- **Output display** — shows command output, then returns to menu

#### Shell Completion (`cfcli completion`)

```bash
# Generate and install bash completion
cfcli completion bash > /etc/bash_completion.d/cfcli
# Or: npm run completion:bash > /etc/bash_completion.d/cfcli

# Zsh
cfcli completion zsh > ~/.zsh/completions/_cfcli

# Fish
cfcli completion fish > ~/.config/fish/completions/cfcli.fish

# PowerShell (Windows)
cfcli completion powershell | Out-File -Encoding utf8 $PROFILE\cfcli.ps1
```

All completion scripts are auto-generated from the registry — new commands are included automatically.

#### Adding a New Command (Developer Guide)

When you add a new command module in `src/commands/`:

1. **Create** `src/commands/myfeature.js`:
   ```javascript
   function myFeatureCommands(program) {
     const cmd = program.command('myfeature').description('Manage my feature');
     cmd.command('list').description('List items').option('--all', 'Fetch all').action(...);
     cmd.command('add').description('Add item').option('-n, --name <name>', 'Item name').action(...);
   }
   module.exports = myFeatureCommands;
   ```

2. **Register** in `src/index.js`:
   ```javascript
   const myFeatureCommands = require('./commands/myfeature');
   // ...
   myFeatureCommands(program);
   ```

3. **Done!** The following all pick it up automatically — no additional work:
   - `cfcli commands list` → shows `myfeature list` and `myfeature add`
   - `cfcli commands json` → includes full option metadata
   - `cfcli gui` → renders forms for the new commands
   - `cfcli tui` → shows the new commands in the menu
   - `cfcli completion bash/zsh/fish/powershell` → includes the new commands
   - `cfcli commands markdown` → generates documentation

---

### New P2/P1 Command Usage Examples

#### Pagination with `--all`

```bash
# Walk every zone (no page bookkeeping)
cfcli zone list --all

# Walk ALL DNS records in a zone, then back up as JSON
cfcli dns list --all --json > dns-backup-$(date +%F).json

# Walk every object in an R2 bucket with a prefix
cfcli r2 objects list --bucket my-bucket --prefix logs/2024 --all
```

#### Verbose errors (`-v`)

```bash
# If this fails, see HTTP status / CF error code / request ID / stack
cfcli -v dns add --type A --name sub --content 1.2.3.4

# JSON + verbose are independent
cfcli -v -j dns list --all
```

#### WAF Rulesets Engine v2 (P1)

```bash
# List all zone-level rulesets (phases, kinds, IDs)
cfcli rulesets list --zone-id <zone>

# Show the current http_request_firewall_custom entrypoint rules
cfcli rulesets entrypoint get --zone-id <zone> --phase http_request_firewall_custom

# Replace the entrypoint with a new ruleset (from a JSON payload file)
cfcli rulesets entrypoint update --zone-id <zone> --phase http_request_firewall_custom --file ./custom-entrypoint.json

# Create an account-level root ruleset, then delete it (destructive approval required)
cfcli rulesets create --account-id <acct> --name "Root rules" --kind root --rules ./root-rules.json
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli rulesets delete --account-id <acct> --id <ruleset_id>
```

#### Workers KV bulk operations (P2)

```bash
# seed.json format (either):
#   [ { "key": "user:1", "value": "..." }, ... ]
#   { "user:1": "...", "user:2": "..." }
cfcli kv bulk-write --namespace-id <ns> --file seed.json

# Bulk-read values into ./kv-dump/
cfcli kv bulk-get --namespace-id <ns> --file keys.txt --out-dir ./kv-dump

# Bulk-delete 2500 keys (auto-chunked; destructive approval required in TTY)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli kv bulk-delete --namespace-id <ns> --file keys.txt
```

#### R2 objects + presigned URLs (P2)

```bash
# Use S3-compatible API instead of the slower REST bucket endpoints.
# Requires CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY + CLOUDFLARE_ACCOUNT_ID.

# Upload a file
cfcli r2 objects put --bucket my-bucket --key assets/hero.png --file ./hero.png

# Download a file
cfcli r2 objects get --bucket my-bucket --key assets/hero.png --file ./dl-hero.png

# List every object (auto-pagination)
cfcli r2 objects list --bucket my-bucket --all

# Share a 15-minute presigned GET URL for a private object
cfcli r2 presign --bucket my-bucket --key assets/hero.png --expires 900

# Issue a 5-minute presigned PUT URL so a client can upload without credentials
cfcli r2 presign --bucket my-bucket --key uploads/case.pdf --expires 300 --put

# Delete an object (destructive approval required in TTY)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli r2 objects delete --bucket my-bucket --key assets/old.png
```

---

### Commands

#### Initialize Configuration

```bash
cfcli init
```

#### Verify API Token

```bash
cfcli verify
```

#### Zone Commands

```bash
# List zones (default pagination)
cfcli zone list

# Walk ALL zones in the account (auto-pagination, P0)
cfcli zone list --all

# Explicit page + size
cfcli zone list --page 2 --per-page 20

# Get zone details
cfcli zone get

# Get zone settings
cfcli zone settings

# Update a zone setting
cfcli zone update-setting --name ssl --value strict
```

#### DNS Commands

```bash
# List DNS records (first page / 50 default)
cfcli dns list

# Walk EVERY DNS record in the zone (auto-pagination, P0)
cfcli dns list --all

# Filter by type
cfcli dns list --type A

# Filter by name
cfcli dns list --name example.com

# Explicit paging
cfcli dns list --page 2 --per-page 30

# Get a specific record
cfcli dns get --id <record_id>

# Add a DNS record
cfcli dns add --type A --name subdomain --content 1.2.3.4 --proxied

# Update a DNS record (destructive — modify guard applies if implemented)
cfcli dns update --id <record_id> --type A --name subdomain --content 5.6.7.8

# Delete a DNS record (TTY: CFCLI_CONFIRM_DESTRUCTIVE=1 required)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli dns delete --id <record_id>

# Bulk delete records (destructive approval required in TTY)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli dns bulk-delete --type A --name subdomain
```

#### Firewall Commands

```bash
# List firewall rules
cfcli firewall list

# Add a firewall rule
cfcli firewall add --description "Block IP" --action block --filter "ip.src eq 1.2.3.4"

# Update a firewall rule
cfcli firewall update --id <rule_id> --description "Updated rule" --action challenge --filter "ip.src eq 1.2.3.4"

# Delete a firewall rule
cfcli firewall delete --id <rule_id>

# List access rules
cfcli firewall access list

# Block an IP
cfcli firewall access block --target 1.2.3.4

# Block a country
cfcli firewall access block --target CN --type country

# Delete an access rule
cfcli firewall access delete --id <rule_id>
```

#### WAF Commands (legacy)

```bash
# List WAF packages (legacy packages/groups/rules API)
cfcli waf packages list

# Get package details
cfcli waf packages get --id <package_id>

# List groups in a package
cfcli waf groups list --package-id <package_id>

# List rules in a package
cfcli waf rules list --package-id <package_id>

# Get rule details
cfcli waf rules get --rule-id <rule_id>

# Update a rule (TTY destructive guard applies)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli waf rules update --rule-id <rule_id> --action block

# List rate limiting rules
cfcli waf rate-limits list

# Add a rate limiting rule
cfcli waf rate-limits add --description "Rate limit API" --action block --period 60 --requests 100

# ⬇ NEW P1: WAF Rulesets Engine v2 (recommended for Enterprise + current APIs)
# See "New P2/P1 Command Usage Examples" → WAF Rulesets Engine v2 section
# for full examples of `cfcli rulesets {list,entrypoint,create,update,delete}`.
# Quick aliases:
cfcli rulesets list --zone-id <zone>                             # list rulesets
cfcli rulesets entrypoint get --phase http_request_firewall_custom # show phase rules
```

#### SSL/TLS Commands

```bash
# Get SSL settings
cfcli ssl settings

# Set SSL mode
cfcli ssl set --mode strict

# HTTPS redirect
cfcli ssl https redirect
cfcli ssl https redirect-enable
cfcli ssl https redirect-disable

# HTTP/2
cfcli ssl http2 status
cfcli ssl http2 enable
cfcli ssl http2 disable

# TLS version
cfcli ssl tls version
cfcli ssl tls set-version --version 1.2
```

#### Workers Commands

```bash
# List Workers
cfcli workers list

# Upload a Worker
cfcli workers upload --name my-worker --file ./worker.js

# Delete a Worker
cfcli workers delete --name my-worker

# List routes
cfcli workers routes list

# Add a route
cfcli workers routes add --pattern "example.com/api/*" --script my-worker

# Delete a route
cfcli workers routes delete --id <route_id>
```

#### KV Storage Commands

```bash
# Namespaces
cfcli kv namespaces list
cfcli kv namespaces create --title "My Namespace"
# Destructive: namespace deletion wipes its keys (TTY guard applies)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli kv namespaces delete --id <namespace_id>

# Keys (single)
cfcli kv keys list --namespace-id <namespace_id>
cfcli kv keys get --namespace-id <namespace_id> --key my-key
cfcli kv keys put --namespace-id <namespace_id> --key my-key --value "my value"
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli kv keys delete --namespace-id <namespace_id> --key my-key

# ⬇ NEW P2: KV bulk operations — auto-chunked at 9000 pairs/request
# JSON seed: [ { "key": "k1", "value": "v1" }, ... ]  OR  { "k1": "v1", "k2": "v2" }
cfcli kv bulk-write --namespace-id <namespace_id> --file seed.json

# Bulk-read into a directory (one file per key)
cfcli kv bulk-get --namespace-id <namespace_id> --file keys.txt --out-dir ./kv-dump

# Bulk-delete — TTY guard REQUIRES approval env var
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli kv bulk-delete --namespace-id <namespace_id> --file keys.txt
```

#### R2 Storage Commands

```bash
# Buckets (Cloudflare REST API — account-wide)
cfcli r2 buckets list
cfcli r2 buckets create --name my-bucket
cfcli r2 buckets get --name my-bucket
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli r2 buckets delete --name my-bucket

# ⬇ NEW P2: Objects + presigned URLs (S3-compatible API, dynamic import)
# Prereqs: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_R2_ACCESS_KEY_ID + CLOUDFLARE_R2_SECRET_ACCESS_KEY
#          optional deps: npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Object CRUD
cfcli r2 objects put --bucket my-bucket --key assets/logo.png --file ./local.png
cfcli r2 objects get --bucket my-bucket --key assets/logo.png --file ./dl.png

# List + auto-pagination
cfcli r2 objects list --bucket my-bucket --prefix assets/
cfcli r2 objects list --bucket my-bucket --all

# Delete (destructive approval required in TTY)
CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli r2 objects delete --bucket my-bucket --key assets/logo.png

# Presigned URLs (share private objects or allow uncredentialed uploads)
cfcli r2 presign --bucket my-bucket --key assets/logo.png --expires 900        # GET URL (15m)
cfcli r2 presign --bucket my-bucket --key uploads/doc.pdf --expires 300 --put  # PUT URL (5m)
```

#### Pages Commands

```bash
# List projects
cfcli pages projects list

# Get project details
cfcli pages projects get --name my-project

# Create project
cfcli pages projects create --name my-project

# Delete project
cfcli pages projects delete --name my-project

# List deployments
cfcli pages deployments list --name my-project

# Create deployment
cfcli pages deployments create --name my-project

# List domains
cfcli pages domains list --name my-project

# Add domain
cfcli pages domains add --name my-project --domain example.com
```

#### Waiting Room Commands

```bash
# List waiting rooms
cfcli waiting-room list

# Get waiting room details
cfcli waiting-room get --id <room_id>

# Create waiting room
cfcli waiting-room create --name "My Room" --host example.com --path /wait

# Update waiting room
cfcli waiting-room update --id <room_id> --name "Updated Room"

# Delete waiting room
cfcli waiting-room delete --id <room_id>

# List events
cfcli waiting-room events list --room-id <room_id>

# Create event
cfcli waiting-room events create --room-id <room_id> --name "Event" --start 2024-01-01T00:00:00Z --end 2024-01-02T00:00:00Z
```

#### Custom Pages Commands

```bash
# List custom pages
cfcli custom-pages list

# Get custom page details
cfcli custom-pages get --id <page_id>

# Update custom page
cfcli custom-pages update --id <page_id> --url https://example.com/custom-error --state customized
```

#### IP Lists Commands

```bash
# List IP lists
cfcli ip-lists list

# Get IP list details
cfcli ip-lists get --id <list_id>

# Create IP list
cfcli ip-lists create --name "Block List" --kind block

# Delete IP list
cfcli ip-lists delete --id <list_id>

# List items in an IP list
cfcli ip-lists items list --list-id <list_id>

# Add IP to list
cfcli ip-lists items add --list-id <list_id> --items 1.2.3.4,5.6.7.8

# Delete items from list
cfcli ip-lists items delete --list-id <list_id> --item-ids <id1>,<id2>
```

#### Load Balancer Commands (Enterprise)

```bash
# List load balancers
cfcli load-balancer list

# Get load balancer details
cfcli load-balancer get --id <lb_id>

# Create load balancer
cfcli load-balancer create --name my-lb --pool-id <pool_id> --default-pool-ids <pool_id> --fallback-pool-id <pool_id>

# Update load balancer
cfcli load-balancer update --id <lb_id> --name updated-lb

# Delete load balancer
cfcli load-balancer delete --id <lb_id>

# List pools
cfcli load-balancer pools list

# Create pool
cfcli load-balancer pools create --name my-pool --origins-name server1 --origins-address 1.2.3.4

# List monitors
cfcli load-balancer monitors list

# Create monitor
cfcli load-balancer monitors create --type http --expected-codes 200 --interval 60
```

#### Health Checks Commands (Enterprise)

```bash
# List health checks
cfcli health-checks list

# Get health check details
cfcli health-checks get --id <check_id>

# Create health check
cfcli health-checks create --name my-check --address 1.2.3.4 --type http --path /health

# Update health check
cfcli health-checks update --id <check_id> --name updated-check

# Delete health check
cfcli health-checks delete --id <check_id>
```

#### Page Rules Commands (Enterprise)

```bash
# List page rules
cfcli page-rules list

# Get page rule details
cfcli page-rules get --id <rule_id>

# Create page rule
cfcli page-rules create --targets "example.com/*" --actions "always_online:on"

# Update page rule
cfcli page-rules update --id <rule_id> --status active

# Delete page rule
cfcli page-rules delete --id <rule_id>
```

#### Stream Commands (Enterprise)

```bash
# List videos
cfcli stream list

# Get video details
cfcli stream get --id <video_id>

# Upload video
cfcli stream upload --name my-video --file ./video.mp4

# Delete video
cfcli stream delete --id <video_id>
```

#### Access / Zero Trust Commands (Enterprise)

```bash
# List applications
cfcli access apps list

# Get application details
cfcli access apps get --id <app_id>

# Create application
cfcli access apps create --name my-app --domain example.com

# List policies
cfcli access policies list --app-id <app_id>

# Create policy
cfcli access policies create --app-id <app_id> --name my-policy --decision allow

# List groups
cfcli access groups list

# Create group
cfcli access groups create --name my-group --include-email @example.com
```

#### API Shield Commands (Enterprise)

```bash
# List endpoints
cfcli api-shield endpoints list

# Get endpoint details
cfcli api-shield endpoints get --id <endpoint_id>

# Create endpoint
cfcli api-shield endpoints create --method GET --path /api/v1/users

# List schemas
cfcli api-shield schemas list

# Create schema
cfcli api-shield schemas create --name my-schema --file ./schema.json
```

#### Spectrum Commands (Enterprise)

```bash
# List applications
cfcli spectrum list

# Get application details
cfcli spectrum get --id <app_id>

# Create application
cfcli spectrum create --name my-app --dns-type custom --origin 1.2.3.4:80

# Update application
cfcli spectrum update --id <app_id> --name updated-app

# Delete application
cfcli spectrum delete --id <app_id>
```

#### Enterprise Commands

```bash
# Custom Nameservers
cfcli enterprise custom-ns list
cfcli enterprise custom-ns add --ns ns1.example.com
cfcli enterprise custom-ns delete --ns ns1.example.com

# Argo Smart Routing
cfcli enterprise argo get
cfcli enterprise argo enable
cfcli enterprise argo disable

# Logpush
cfcli enterprise logpush list
cfcli enterprise logpush create --name my-logpush --destination s3://bucket/path --dataset http_requests

# DDoS Protection
cfcli enterprise ddos get
cfcli enterprise ddos set --level high
```

#### Notification Commands (Enterprise)

```bash
# Alert Notifications
cfcli notification alerts list
cfcli notification alerts get --id <alert_id>
cfcli notification alerts history

# Notification Policies (Enterprise)
cfcli notification policies list
cfcli notification policies get --id <policy_id>
cfcli notification policies create --name "My Policy" --alert-type load_balancing_health_alert
cfcli notification policies update --id <policy_id> --name "Updated Policy"
cfcli notification policies delete --id <policy_id>

# Notification Webhooks (Enterprise)
cfcli notification webhooks list
cfcli notification webhooks get --id <webhook_id>
cfcli notification webhooks create --name "My Webhook" --url https://example.com/webhook
cfcli notification webhooks update --id <webhook_id> --name "Updated Webhook"
cfcli notification webhooks delete --id <webhook_id>

# PagerDuty (Enterprise)
cfcli notification pagerduty get
cfcli notification pagerduty connect --integration-url https://events.pagerduty.com/integration/xxx
cfcli notification pagerduty disconnect
```

#### Certificate Commands

```bash
# Custom Certificates
cfcli certificate custom list
cfcli certificate custom get --id <cert_id>
cfcli certificate custom upload --certificate <PEM> --private-key <PEM>
cfcli certificate custom update --id <cert_id> --certificate <PEM>
cfcli certificate custom delete --id <cert_id>

# Certificate Bundles
cfcli certificate bundles list
cfcli certificate bundles update --certificates <id1> <id2>

# Keyless SSL (Enterprise)
cfcli certificate keyless list
cfcli certificate keyless get --id <cert_id>
cfcli certificate keyless create --name "My Keyless" --host keystore.example.com --port 3443
cfcli certificate keyless update --id <cert_id> --name "Updated"
cfcli certificate keyless delete --id <cert_id>

# Custom Hostnames (Enterprise - SSL for SaaS)
cfcli certificate hostnames list
cfcli certificate hostnames get --id <hostname_id>
cfcli certificate hostnames create --hostname app.example.com --origin origin.example.com
cfcli certificate hostnames update --id <hostname_id> --origin new.example.com
cfcli certificate hostnames delete --id <hostname_id>

# Fallback Origin
cfcli certificate fallback get
cfcli certificate fallback set --origin origin.example.com

# Advanced Certificate Manager (Enterprise)
cfcli certificate acm config
cfcli certificate acm update --enabled --ca lets_encrypt --hostnames example.com,www.example.com

# SSL Verification
cfcli certificate verification get

# Universal SSL
cfcli certificate universal get
cfcli certificate universal enable
cfcli certificate universal disable

# Certificate Authorities
cfcli certificate authorities list

# Total TLS (Enterprise)
cfcli certificate total-tls get
cfcli certificate total-tls enable --ca lets_encrypt
cfcli certificate total-tls disable
```

#### Account Commands

```bash
# Verify token
cfcli account verify

# List accounts
cfcli account list

# Get account details
cfcli account get

# List members
cfcli account members list
```

#### Cache Commands

```bash
# Purge all cache
cfcli cache purge --everything

# Purge specific URLs
cfcli cache purge --urls https://example.com/page1 https://example.com/page2

# Get cache settings
cfcli cache settings

# Toggle development mode
cfcli cache dev-mode --value on
```

#### Config Commands

```bash
# Show configuration
cfcli config show

# Clear configuration
cfcli config clear
```

## API Token Permissions

When creating your API Token at https://dash.cloudflare.com/profile/api-tokens, ensure it has the following permissions:

### Core Permissions

| Resource | Permission |
|----------|------------|
| Account - Account Settings | Read |
| Account - Workers Scripts | Edit |
| Account - Workers Routes | Edit |
| Account - Members | Read |
| Zone - Zone | Read |
| Zone - Zone Settings | Edit |
| Zone - DNS | Edit |
| Zone - Firewall Services | Edit |
| Zone - Cache | Purge |

### WAF & Security Permissions

| Resource | Permission |
|----------|------------|
| Zone - WAF | Edit |
| Zone - Rate Limiting | Edit |
| Zone - Page Rules | Edit |
| Zone - Custom Pages | Edit |
| Account - IP Lists | Edit |

### Enterprise Permissions

| Resource | Permission |
|----------|------------|
| Zone - Load Balancing | Edit |
| Zone - Health Checks | Edit |
| Zone - Stream | Edit |
| Zone - Spectrum | Edit |
| Account - Access: Apps and Policies | Edit |
| Account - API Shield | Edit |
| Account - Custom Nameservers | Edit |
| Account - Logs | Edit |
| Account - Argo Tunnel | Edit |
| Account - Notifications | Edit |
| Zone - SSL | Edit |
| Zone - Keyless SSL | Edit |
| Zone - Custom Hostnames | Edit |

## Examples

### Complete Setup Workflow

```bash
# 1. Initialize configuration
cfcli init

# 2. Verify token works
cfcli verify

# 3. List your zones
cfcli zone list

# 4. Add a DNS record
cfcli dns add --type A --name api --content 1.2.3.4 --proxied

# 5. Enable strict SSL
cfcli ssl set --mode strict

# 6. Enable HTTPS redirect
cfcli ssl https redirect-enable

# 7. Purge cache
cfcli cache purge --everything
```

### Security Hardening

```bash
# Set SSL to strict
cfcli ssl set --mode strict

# Enable Always Use HTTPS
cfcli ssl https redirect-enable

# Set minimum TLS version to 1.2
cfcli ssl tls set-version --version 1.2

# Enable HTTP/2
cfcli ssl http2 enable

# Block a specific IP
cfcli firewall access block --target 1.2.3.4 --notes "Blocked for abuse"

# Block a country
cfcli firewall access block --target CN --type country

# Configure WAF rate limiting
cfcli waf rate-limits add --description "API Rate Limit" --action block --period 60 --requests 100
```

### Enterprise Load Balancer Setup

```bash
# Create a health check
cfcli health-checks create --name origin-health --address 1.2.3.4 --type http --path /health

# Create a pool
cfcli load-balancer pools create --name origin-pool --origins-name server1 --origins-address 1.2.3.4

# Create a load balancer
cfcli load-balancer create --name my-lb --pool-id <pool_id> --default-pool-ids <pool_id> --fallback-pool-id <pool_id>
```

### Zero Trust Access Setup

```bash
# Create an Access application
cfcli access apps create --name internal-app --domain internal.example.com

# Create an Access policy
cfcli access policies create --app-id <app_id> --name allow-team --decision allow --include-email @company.com

# Create an Access group
cfcli access groups create --name team-group --include-email @company.com
```

## Troubleshooting

### Common Issues

1. **"API Token is required"**: Run `cfcli init` or set `CLOUDFLARE_API_TOKEN` environment variable
2. **"Zone ID is required"**: Run `cfcli init` or use `--zone-id` option
3. **"Account ID is required"**: Run `cfcli init` or set `CLOUDFLARE_ACCOUNT_ID` environment variable
4. **API errors**: Check your API token permissions and ensure it has the required access
5. **Enterprise features not available**: Ensure your Cloudflare plan includes the required Enterprise features

### Debug Mode

Run with debug output:

```bash
DEBUG=* cfcli <command>
```

## License

MIT

## Documentation

- [Cloudflare 产品完全指南](docs/CLOUDFLARE_PRODUCTS_GUIDE.md) - 各产品功能、架构、使用方法和最佳实践
- [CLI 命令详细指南](docs/COMMAND_GUIDE.md) - 每个命令的详细说明和使用示例
- [SSL/TLS 完全小白指南](docs/SSL_TLS_GUIDE.md) - SSL/TLS 证书、加密套件、mTLS 等详细指南
- [完整 FAQ](docs/FAQ_COMPLETE.md) - 常见问题解答，按类别整理

## Resources

- [Cloudflare API Documentation](https://developers.cloudflare.com/api/)
- [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [KV Documentation](https://developers.cloudflare.com/kv/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [WAF Documentation](https://developers.cloudflare.com/waf/)
- [Load Balancing Documentation](https://developers.cloudflare.com/load-balancing/)
- [Access/Zero Trust Documentation](https://developers.cloudflare.com/cloudflare-one/)
- [API Shield Documentation](https://developers.cloudflare.com/api-shield/)
- [Spectrum Documentation](https://developers.cloudflare.com/spectrum/)
- [Stream Documentation](https://developers.cloudflare.com/stream/)
- [Notifications Documentation](https://developers.cloudflare.com/notifications/)
- [SSL Documentation](https://developers.cloudflare.com/ssl/)
- [Keyless SSL Documentation](https://developers.cloudflare.com/ssl/keyless-ssl/)
- [Custom Hostnames Documentation](https://developers.cloudflare.com/ssl/ssl-for-saas/)
- [CLI 命令详细指南](docs/COMMAND_GUIDE.md)
- [SSL/TLS 完全小白指南](docs/SSL_TLS_GUIDE.md)
