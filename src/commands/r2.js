/**
 * @file Cloudflare R2 command module.
 *
 * Original surface — bucket CRUD via Cloudflare REST API (/accounts/<id>/r2/buckets).
 *
 * P2 additions — Object operations via Cloudflare R2 S3-compatible API:
 *   - `r2 objects list`    → S3 ListObjectsV2
 *   - `r2 objects get`     → S3 GetObject (writes to file)
 *   - `r2 objects put`     → S3 PutObject (reads from file)
 *   - `r2 objects delete`  → S3 DeleteObject [DESTRUCTIVE]
 *   - `r2 presign get/put` → Pre-signed URL via @aws-sdk/s3-request-presigner
 *
 * Authentication for the S3 surface:
 *   Credentials required are the R2-specific Access Key pair (NOT the regular
 *   Cloudflare API token). They come from (high → low priority):
 *     1. CLI --r2-access-key-id / --r2-secret-access-key
 *     2. env CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *     3. config.r2AccessKeyId / config.r2SecretAccessKey
 *        (optionally routed to the secure keychain store on save)
 *   CLI never logs these values.
 *
 * Endpoint:
 *   Default  → https://<accountId>.r2.cloudflarestorage.com
 *   Override → --r2-endpoint or CLOUDFLARE_R2_ENDPOINT env or config.r2Endpoint
 */

const fs = require('fs');
const path = require('path');

const CloudflareClient = require('../utils/cf-client');
const {
  formatSuccess, formatError, formatTable, formatJSON, formatInfo,
  formatVerboseError, formatWarning,
} = require('../utils/formatter');
const { isDestructiveConfirmed } = require('../utils/config');

function guard(opName, program) {
  if (isDestructiveConfirmed()) return true;
  formatWarning(
    `REFUSED destructive R2 operation: ${opName}\n`
    + '  Saved credentials are never used for modify/delete/override actions\n'
    + '  without explicit human approval. Please request operator review, then re-run:\n'
    + '    CFCLI_CONFIRM_DESTRUCTIVE=1 cfcli r2 ...',
  );
  return false;
}

/**
 * Resolve R2 S3 configuration from layered sources and validate required keys.
 * @param {*} programOpts  Commander program.opts() for base config + verbose.
 * @param {*} cmdOpts      Commander subcommand options (--r2-access-key-id etc.).
 */
function resolveS3Config(programOpts, cmdOpts) {
  const base = (programOpts && programOpts.config) || {};
  const accountId = cmdOpts.accountId
    || base.accountId
    || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = cmdOpts.r2AccessKeyId
    || base.r2AccessKeyId
    || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = cmdOpts.r2SecretAccessKey
    || base.r2SecretAccessKey
    || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const endpoint = cmdOpts.r2Endpoint
    || base.r2Endpoint
    || process.env.CLOUDFLARE_R2_ENDPOINT
    || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  return { accountId, accessKeyId, secretAccessKey, endpoint };
}

/** Lazy-load AWS SDK; throw a friendly user error if it isn't installed. */
let _awsCached;
function loadAwsSdk() {
  if (_awsCached) return _awsCached;
  try {
    // eslint-disable-next-line global-require
    const s3 = require('@aws-sdk/client-s3');
    let presigner = null;
    try {
      // eslint-disable-next-line global-require
      presigner = require('@aws-sdk/s3-request-presigner');
    } catch (_) { /* presigner is optional — only needed for `r2 presign` */ }
    _awsCached = { s3, presigner };
    return _awsCached;
  } catch (err) {
    throw new Error(
      'R2 object commands require the AWS S3 SDK. Install optional dependencies:\n'
      + '  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner\n'
      + `(underlying error: ${err.message})`,
    );
  }
}

/** Build S3Client or throw a user-friendly error. */
function makeS3Client(s3cfg) {
  const { s3: s3Sdk } = loadAwsSdk();
  const missing = [];
  if (!s3cfg.accessKeyId) missing.push('R2 Access Key ID');
  if (!s3cfg.secretAccessKey) missing.push('R2 Secret Access Key');
  if (!s3cfg.endpoint) missing.push('R2 endpoint / Account ID');
  if (missing.length) {
    throw new Error(
      'Missing R2 S3 credentials:\n  - '
      + missing.join('\n  - ')
      + '\nProvide via config / env CLOUDFLARE_R2_* / CLI flags '
      + '--r2-access-key-id / --r2-secret-access-key / --r2-endpoint.',
    );
  }
  return new s3Sdk.S3Client({
    region: 'auto',
    endpoint: s3cfg.endpoint,
    credentials: {
      accessKeyId: s3cfg.accessKeyId,
      secretAccessKey: s3cfg.secretAccessKey,
    },
    // R2 does not use location-constraint-style virtual-hosted bucket addressing
    // the same way S3 does — force path-style for deterministic routing.
    forcePathStyle: true,
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Commands                                   */
/* -------------------------------------------------------------------------- */

function r2Commands(program) {
  const r2 = program.command('r2').description('Manage Cloudflare R2 Storage');

  // ------------------------------- Buckets ---------------------------------
  const buckets = r2.command('buckets').description('Manage R2 Buckets (Cloudflare REST API)');

  buckets
    .command('list')
    .description('List all R2 buckets in the account')
    .option('--page <N>', 'Page number (1-based) when --all is not used', '1')
    .option('--per-page <N>', 'Page size (default 50)', '50')
    .option('--all', 'Fetch ALL buckets by auto-paging')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        let rows;
        if (options.all) {
          rows = await client.paginatedList(
            (p) => {
              const params = { ...p };
              // listR2Buckets returns {buckets:[…]} — unwrap to array shape
              return client.listR2Buckets(params).then((resp) => ({
                ...resp,
                result: resp.result.buckets || resp.result || [],
              }));
            },
            { getAll: true, perPage: Number(options.perPage) },
          );
        } else {
          const resp = await client.listR2Buckets({
            page: Number(options.page), per_page: Number(options.perPage),
          });
          rows = (resp.result && resp.result.buckets) || resp.result || [];
        }
        if (options.json) return formatJSON(rows);
        const data = rows.map((b) => ({
          name: b.name,
          location: b.location || '-',
          creation_date: b.creation_date || '-',
          storage_class: b.storage_class || '-',
        }));
        formatTable([
          { header: 'Name', accessor: 'name' },
          { header: 'Location', accessor: 'location' },
          { header: 'Created', accessor: 'creation_date' },
          { header: 'Storage Class', accessor: 'storage_class' },
        ], data);
        formatSuccess(`Found ${data.length} bucket(s)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  buckets
    .command('create')
    .description('Create a new R2 bucket [WRITE — operator approval required]')
    .requiredOption('-n, --name <name>', 'Bucket name (globally unique per account)')
    .option('-l, --location <location>', 'Location hint (WNAM, ENAM, WEUR, EEUR, APAC, OCE)', 'WNAM')
    .action(async (options) => {
      try {
        if (!guard(`r2 buckets create (name="${options.name}")`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        const result = await client.createR2Bucket(options.name, options.location);
        formatSuccess(`R2 bucket created: ${result.result.name}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  buckets
    .command('get')
    .description('Get bucket details')
    .requiredOption('-n, --name <name>', 'Bucket name')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getR2Bucket(options.name);
        if (options.json) return formatJSON(result.result);
        const b = result.result;
        formatTable([{
          name: b.name, location: b.location || '-',
          creation_date: b.creation_date || '-', storage_class: b.storage_class || '-',
        }], [
          { header: 'Name', accessor: 'name' },
          { header: 'Location', accessor: 'location' },
          { header: 'Created', accessor: 'creation_date' },
          { header: 'Storage Class', accessor: 'storage_class' },
        ]);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  buckets
    .command('delete')
    .description('Delete an R2 bucket [DESTRUCTIVE — operator approval required]')
    .requiredOption('-n, --name <name>', 'Bucket name')
    .action(async (options) => {
      try {
        if (!guard(`r2 buckets delete (name="${options.name}")`, program)) return;
        const client = new CloudflareClient(program.opts().config);
        await client.deleteR2Bucket(options.name);
        formatSuccess(`R2 bucket deleted: ${options.name}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // ------------------------------- Objects ---------------------------------
  const objects = r2.command('objects').description(
    'Manage objects inside an R2 bucket (S3-compatible API — requires R2 access keys)',
  );
  // Shared credential options mounted on every object subcommand via loop.
  const mountR2Auth = (cmd) => cmd
    .option('--r2-access-key-id <id>', 'R2 access key ID (or env CLOUDFLARE_R2_ACCESS_KEY_ID)')
    .option('--r2-secret-access-key <secret>', 'R2 secret access key (or env CLOUDFLARE_R2_SECRET_ACCESS_KEY)')
    .option('--r2-endpoint <url>', 'Override S3 endpoint (default: https://<accountId>.r2.cloudflarestorage.com)')
    .option('--account-id <id>', 'Cloudflare Account ID (for endpoint derivation)');

  mountR2Auth(objects.command('list')
    .description('List objects in a bucket (S3 ListObjectsV2)')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .option('--prefix <prefix>', 'Key prefix')
    .option('--delimiter <delim>', 'Group keys by this delimiter')
    .option('--max-keys <N>', 'Max keys per page (default 1000)', '1000')
    .option('--all', 'Auto-follow ContinuationTokens until listing is complete')
    .option('-j, --json', 'Output as JSON'))
    .action(async (options) => {
      try {
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk } = loadAwsSdk();
        const client = makeS3Client(s3cfg);

        const collected = [];
        const commonPrefixes = new Set();
        let token = undefined;
        let page = 0;
        const maxPages = options.all ? 1_000_000 : 1;
        do {
          page += 1;
          const out = await client.send(new s3Sdk.ListObjectsV2Command({
            Bucket: options.bucket,
            Prefix: options.prefix,
            Delimiter: options.delimiter,
            MaxKeys: Number(options.maxKeys) || 1000,
            ContinuationToken: token,
          }));
          if (Array.isArray(out.Contents)) collected.push(...out.Contents);
          if (Array.isArray(out.CommonPrefixes)) {
            out.CommonPrefixes.forEach((cp) => { if (cp.Prefix) commonPrefixes.add(cp.Prefix); });
          }
          token = out.NextContinuationToken;
        } while (options.all && token && page < maxPages);

        const payload = {
          objects: collected,
          commonPrefixes: [...commonPrefixes],
          keyCount: collected.length + commonPrefixes.size,
        };
        if (options.json) return formatJSON(options.all ? collected : payload);
        if (commonPrefixes.size > 0) {
          formatInfo(`Directory markers (${commonPrefixes.size}):\n`
            + [...commonPrefixes].slice(0, 10).map((p) => `  · ${p}`).join('\n')
            + (commonPrefixes.size > 10 ? `\n  … (${commonPrefixes.size - 10} more)` : ''));
        }
        const t = collected.map((o) => ({
          Key: o.Key,
          Size: o.Size,
          LastModified: o.LastModified ? new Date(o.LastModified).toISOString() : '-',
          ETag: o.ETag ? o.ETag.replace(/"/g, '') : '-',
          StorageClass: o.StorageClass || '-',
        }));
        formatTable([
          { header: 'Key', accessor: 'Key' },
          { header: 'Size', accessor: 'Size' },
          { header: 'Last Modified', accessor: 'LastModified' },
          { header: 'ETag', accessor: 'ETag' },
          { header: 'Class', accessor: 'StorageClass' },
        ], t);
        formatSuccess(`Listed ${collected.length} object(s)`
          + (token && !options.all ? ' — more pages available, re-run with --all' : ''));
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  mountR2Auth(objects.command('get')
    .description('Download an object from R2 to a local file (S3 GetObject)')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --key <key>', 'Object key')
    .requiredOption('-o, --out <path>', 'Local destination file path'))
    .action(async (options) => {
      try {
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk } = loadAwsSdk();
        const client = makeS3Client(s3cfg);
        const out = await client.send(new s3Sdk.GetObjectCommand({
          Bucket: options.bucket, Key: options.key,
        }));
        const dest = path.resolve(process.cwd(), options.out);
        // Body type is a streaming Readable (Blob on browser / Node Readable on Node).
        // Convert stream → Buffer conservatively; works for modern SDK variants.
        const body = out.Body;
        let bytes;
        if (body && typeof body.transformToByteArray === 'function') {
          bytes = Buffer.from(await body.transformToByteArray());
        } else if (Buffer.isBuffer(body)) {
          bytes = body;
        } else if (typeof body === 'string' || body instanceof Uint8Array) {
          bytes = Buffer.from(body);
        } else if (body && typeof body.pipe === 'function') {
          // Node.js Readable → collect via stream.promises.
          // eslint-disable-next-line global-require
          const { pipeline } = require('stream/promises');
          // eslint-disable-next-line global-require
          const { createWriteStream } = require('fs');
          await pipeline(body, createWriteStream(dest));
          formatSuccess(`Downloaded "${options.key}" → ${dest}`);
          return;
        } else {
          throw new Error(`Unsupported S3 GetObject body type: ${typeof body}`);
        }
        fs.writeFileSync(dest, bytes);
        formatSuccess(`Downloaded "${options.key}" → ${dest} (${bytes.length} bytes)`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  mountR2Auth(objects.command('put')
    .description('Upload a local file to R2 (S3 PutObject) [WRITE — operator approval required]')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --key <key>', 'Object key')
    .requiredOption('-f, --file <path>', 'Local file to upload')
    .option('--content-type <type>', 'Content-Type header (default: guessed from ext or application/octet-stream)')
    .option('--cache-control <value>', 'Cache-Control header')
    .option('--content-disposition <value>', 'Content-Disposition header'))
    .action(async (options) => {
      try {
        if (!guard(`r2 objects put (bucket=${options.bucket}, key=${options.key})`, program)) return;
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk } = loadAwsSdk();
        const client = makeS3Client(s3cfg);
        const src = path.resolve(process.cwd(), options.file);
        if (!fs.existsSync(src)) throw new Error(`File not found: ${src}`);
        const stat = fs.statSync(src);
        const body = fs.readFileSync(src);
        const contentType = options.contentType || guessContentType(options.file);
        const out = await client.send(new s3Sdk.PutObjectCommand({
          Bucket: options.bucket,
          Key: options.key,
          Body: body,
          ContentType: contentType,
          CacheControl: options.cacheControl,
          ContentDisposition: options.contentDisposition,
          ContentLength: stat.size,
        }));
        formatSuccess(
          `Uploaded ${src} → s3://${options.bucket}/${options.key} `
          + `(${stat.size} bytes, ETag=${(out.ETag || '').replace(/"/g, '') || '-'}, `
          + `Content-Type=${contentType})`,
        );
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  mountR2Auth(objects.command('delete')
    .description('Delete a single object [DESTRUCTIVE — operator approval required]')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --key <key>', 'Object key'))
    .action(async (options) => {
      try {
        if (!guard(`r2 objects delete (bucket=${options.bucket}, key=${options.key})`, program)) return;
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk } = loadAwsSdk();
        const client = makeS3Client(s3cfg);
        await client.send(new s3Sdk.DeleteObjectCommand({
          Bucket: options.bucket, Key: options.key,
        }));
        formatSuccess(`Object deleted: s3://${options.bucket}/${options.key}`);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  // ------------------------------- Presign ---------------------------------
  const presign = r2.command('presign').description(
    'Create presigned URLs for private R2 objects (requires R2 access keys)',
  );

  mountR2Auth(presign.command('get')
    .description('Generate a presigned GET URL for an object')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --key <key>', 'Object key')
    .option('-e, --expires <seconds>', 'URL lifetime in seconds (default 900)', '900'))
    .action(async (options) => {
      try {
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk, presigner: presignerMod } = loadAwsSdk();
        if (!presignerMod) {
          throw new Error(
            'Presigning requires @aws-sdk/s3-request-presigner. Install it: '
            + 'npm install @aws-sdk/s3-request-presigner',
          );
        }
        const client = makeS3Client(s3cfg);
        const cmd = new s3Sdk.GetObjectCommand({ Bucket: options.bucket, Key: options.key });
        const url = await presignerMod.getSignedUrl(client, cmd, {
          expiresIn: Math.max(1, parseInt(options.expires, 10) || 900),
        });
        formatInfo('Presigned GET URL (valid until expires):');
        // eslint-disable-next-line no-console
        console.log(url);
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });

  mountR2Auth(presign.command('put')
    .description('Generate a presigned PUT URL so a client can upload without credentials')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --key <key>', 'Object key')
    .option('--content-type <type>', 'Enforce this Content-Type on the uploader')
    .option('--content-length <N>', 'Enforce a specific exact content-length')
    .option('-e, --expires <seconds>', 'URL lifetime in seconds (default 900)', '900'))
    .action(async (options) => {
      try {
        const s3cfg = resolveS3Config(program.opts(), options);
        const { s3: s3Sdk, presigner: presignerMod } = loadAwsSdk();
        if (!presignerMod) {
          throw new Error(
            'Presigning requires @aws-sdk/s3-request-presigner. Install it: '
            + 'npm install @aws-sdk/s3-request-presigner',
          );
        }
        const client = makeS3Client(s3cfg);
        const params = { Bucket: options.bucket, Key: options.key };
        if (options.contentType) params.ContentType = options.contentType;
        if (options.contentLength) params.ContentLength = Number(options.contentLength);
        const cmd = new s3Sdk.PutObjectCommand(params);
        const url = await presignerMod.getSignedUrl(client, cmd, {
          expiresIn: Math.max(1, parseInt(options.expires, 10) || 900),
          // Make signed headers explicit when uploader must match exactly.
          unhoistableHeaders: new Set(options.contentType ? ['content-type'] : []),
        });
        formatInfo('Presigned PUT URL (uploader issues PUT with matching headers):');
        // eslint-disable-next-line no-console
        console.log(url);
        if (options.contentType) {
          formatInfo(`Required request header: Content-Type: ${options.contentType}`);
        }
      } catch (err) { formatVerboseError(err, program.opts().verbose); }
    });
}

function guessContentType(file) {
  const map = {
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'application/yaml',
    '.yml': 'application/yaml',
    '.xml': 'application/xml',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.tgz': 'application/gzip',
    '.tar': 'application/x-tar',
    '.wasm': 'application/wasm',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
  };
  const ext = path.extname(file || '').toLowerCase();
  return map[ext] || 'application/octet-stream';
}

module.exports = r2Commands;
