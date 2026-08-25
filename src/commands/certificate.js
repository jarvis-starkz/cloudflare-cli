const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 证书命令
 *
 * 功能说明：管理 Cloudflare 证书服务，包括自定义证书、Keyless SSL、
 * 自定义主机名、Universal SSL、Total TLS 和高级证书管理器（ACM）。
 * 提供完整的证书生命周期管理，从上传到更新和删除。
 *
 * 使用场景：
 * - 上传和管理自定义 SSL/TLS 证书
 * - 配置 Keyless SSL 以使用外部密钥服务器
 * - 管理自定义主机名证书（SSL for SaaS）
 * - 启用 Universal SSL 提供免费证书
 * - 配置 Total TLS 自动签发证书
 * - 管理高级证书管理器（ACM）配置
 */
function certificateCommands(program) {
  const cert = program.command('certificate').description('管理 Cloudflare 证书服务（自定义证书、Keyless SSL、Universal SSL、Total TLS 和 ACM）');

  // Custom Certificates
  const custom = cert.command('custom').description('管理自定义证书 - 上传和管理您自己的 SSL/TLS 证书');

  custom
    .command('list')
    .description('列出所有自定义证书 - 显示区域下上传的所有自定义证书及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCertificates(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(c => ({
            id: c.id,
            hosts: (c.hosts || []).join(', '),
            issuer: c.issuer || '-',
            signature: c.signature || '-',
            bundle_method: c.bundle_method || '-',
            status: c.status || '-',
            uploaded_on: c.uploaded_on || '-',
            expires_on: c.expires_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Hosts', accessor: 'hosts' },
            { header: 'Issuer', accessor: 'issuer' },
            { header: 'Status', accessor: 'status' },
            { header: 'Expires', accessor: 'expires_on' }
          ]);
          formatSuccess(`Found ${data.length} certificate(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  custom
    .command('get')
    .description('获取证书详情 - 查看特定自定义证书的详细配置信息，包括域名、颁发者和有效期')
    .requiredOption('-i, --id <id>', '证书 ID（Certificate ID），指定要查询的证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCertificate(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const c = result.result;
          formatTable([{
            id: c.id,
            hosts: (c.hosts || []).join(', '),
            issuer: c.issuer || '-',
            signature: c.signature || '-',
            bundle_method: c.bundle_method || '-',
            status: c.status || '-',
            uploaded_on: c.uploaded_on || '-',
            expires_on: c.expires_on || '-',
            geo_restrictions: c.geo_restrictions || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Hosts', accessor: 'hosts' },
            { header: 'Issuer', accessor: 'issuer' },
            { header: 'Signature', accessor: 'signature' },
            { header: 'Bundle Method', accessor: 'bundle_method' },
            { header: 'Status', accessor: 'status' },
            { header: 'Expires', accessor: 'expires_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  custom
    .command('upload')
    .description('上传自定义证书 - 上传您自己的 SSL/TLS 证书到 Cloudflare，用于加密用户到 Cloudflare 的连接')
    .requiredOption('--certificate <cert>', '证书内容（PEM 格式），包含完整的证书链')
    .requiredOption('--private-key <key>', '私钥内容（PEM 格式），与证书配对的私钥')
    .option('--bundle-method <method>', '证书捆绑方法（ubiquitous, optimal, force），控制证书链的组装方式', 'ubiquitous')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          certificate: options.certificate,
          private_key: options.privateKey,
          bundle_method: options.bundleMethod
        };

        const result = await client.uploadCertificate(data, options.zoneId);
        formatSuccess(`Certificate uploaded: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  custom
    .command('update')
    .description('更新自定义证书 - 修改现有证书的配置，如更新证书内容或私钥')
    .requiredOption('-i, --id <id>', '证书 ID（Certificate ID），指定要更新的证书')
    .option('--certificate <cert>', '证书内容（PEM 格式），更新证书内容')
    .option('--private-key <key>', '私钥内容（PEM 格式），更新私钥')
    .option('--bundle-method <method>', '证书捆绑方法，修改证书链组装方式')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.certificate) data.certificate = options.certificate;
        if (options.privateKey) data.private_key = options.privateKey;
        if (options.bundleMethod) data.bundle_method = options.bundleMethod;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateCertificate(options.id, data, options.zoneId);
        formatSuccess(`Certificate updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  custom
    .command('delete')
    .description('删除自定义证书 - 移除上传的自定义证书，删除后该证书将不再用于加密连接')
    .requiredOption('-i, --id <id>', '证书 ID（Certificate ID），指定要删除的证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteCertificate(options.id, options.zoneId);
        formatSuccess(`Certificate deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Certificate Bundles
  const bundles = cert.command('bundles').description('管理证书捆绑 - 配置证书优先级和捆绑策略');

  bundles
    .command('list')
    .description('列出证书捆绑（优先级）- 显示当前配置的证书优先级顺序')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCertificateBundles(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = (result.result || []).map(b => ({
            id: b.id,
            type: b.type || '-',
            status: b.status || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Type', accessor: 'type' },
            { header: 'Status', accessor: 'status' }
          ]);
          formatSuccess(`Found ${data.length} bundle(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  bundles
    .command('update')
    .description('更新证书捆绑优先级 - 配置多个证书的使用优先级，控制证书选择顺序')
    .requiredOption('--certificates <ids...>', '按优先级顺序排列的证书 ID 列表，靠前的证书优先级更高')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          certificates: options.certificates.map(id => ({ id }))
        };

        const result = await client.updateCertificateBundles(data, options.zoneId);
        formatSuccess('Certificate bundles updated');
      } catch (error) {
        formatError(error.message);
      }
    });

  // Keyless SSL (Enterprise)
  const keyless = cert.command('keyless').description('管理 Keyless SSL（企业级）- 配置外部密钥服务器，私钥不存储在 Cloudflare 上');

  keyless
    .command('list')
    .description('列出所有 Keyless 证书 - 显示所有配置的 Keyless SSL 证书及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listKeylessCertificates(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(k => ({
            id: k.id,
            name: k.name || '-',
            host: k.host || '-',
            port: k.port || '-',
            status: k.status || '-',
            enabled: k.enabled ? 'Yes' : 'No',
            created_on: k.created_on || '-',
            modified_on: k.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Host', accessor: 'host' },
            { header: 'Port', accessor: 'port' },
            { header: 'Status', accessor: 'status' },
            { header: 'Enabled', accessor: 'enabled' }
          ]);
          formatSuccess(`Found ${data.length} keyless certificate(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  keyless
    .command('get')
    .description('获取 Keyless 证书详情 - 查看特定 Keyless SSL 证书的详细配置信息')
    .requiredOption('-i, --id <id>', 'Keyless 证书 ID，指定要查询的证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getKeylessCertificate(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const k = result.result;
          formatTable([{
            id: k.id,
            name: k.name || '-',
            host: k.host || '-',
            port: k.port || '-',
            status: k.status || '-',
            enabled: k.enabled ? 'Yes' : 'No',
            created_on: k.created_on || '-',
            modified_on: k.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Host', accessor: 'host' },
            { header: 'Port', accessor: 'port' },
            { header: 'Status', accessor: 'status' },
            { header: 'Enabled', accessor: 'enabled' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  keyless
    .command('create')
    .description('创建 Keyless 证书 - 配置新的 Keyless SSL 证书，使用外部密钥服务器进行 TLS 握手')
    .requiredOption('-n, --name <name>', '证书名称，用于标识和管理 Keyless 证书')
    .requiredOption('--host <host>', '密钥服务器主机名，指定外部密钥服务器的地址')
    .requiredOption('--port <port>', '密钥服务器端口，指定外部密钥服务器的端口号')
    .option('--certificate <cert>', '证书内容（PEM 格式），指定与密钥服务器配对的证书')
    .option('--enabled', '启用证书，使其可用于 TLS 握手', true)
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          host: options.host,
          port: parseInt(options.port),
          enabled: options.enabled
        };
        if (options.certificate) data.certificate = options.certificate;

        const result = await client.createKeylessCertificate(data, options.zoneId);
        formatSuccess(`Keyless certificate created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  keyless
    .command('update')
    .description('更新 Keyless 证书 - 修改现有 Keyless SSL 证书的配置设置')
    .requiredOption('-i, --id <id>', 'Keyless 证书 ID，指定要更新的证书')
    .option('-n, --name <name>', '证书名称，修改证书的标识名称')
    .option('--host <host>', '密钥服务器主机名，修改外部密钥服务器的地址')
    .option('--port <port>', '密钥服务器端口，修改外部密钥服务器的端口号')
    .option('--enabled', '启用证书')
    .option('--no-enabled', '禁用证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.name) data.name = options.name;
        if (options.host) data.host = options.host;
        if (options.port) data.port = parseInt(options.port);
        if (options.enabled !== undefined) data.enabled = options.enabled;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateKeylessCertificate(options.id, data, options.zoneId);
        formatSuccess(`Keyless certificate updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  keyless
    .command('delete')
    .description('删除 Keyless 证书 - 移除 Keyless SSL 证书，删除后将停止使用外部密钥服务器')
    .requiredOption('-i, --id <id>', 'Keyless 证书 ID，指定要删除的证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteKeylessCertificate(options.id, options.zoneId);
        formatSuccess(`Keyless certificate deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Custom Hostnames (Enterprise - SSL for SaaS)
  const hostnames = cert.command('hostnames').description('管理自定义主机名（企业级 SSL for SaaS）- 为 SaaS 客户提供自定义域名 SSL 证书');

  hostnames
    .command('list')
    .description('列出所有自定义主机名 - 显示所有配置的自定义主机名及其 SSL 状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCustomHostnames(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(h => ({
            id: h.id,
            hostname: h.hostname || '-',
            ssl_status: h.ssl?.status || '-',
            ssl_method: h.ssl?.method || '-',
            ssl_type: h.ssl?.type || '-',
            created_at: h.created_at || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Hostname', accessor: 'hostname' },
            { header: 'SSL Status', accessor: 'ssl_status' },
            { header: 'SSL Method', accessor: 'ssl_method' },
            { header: 'SSL Type', accessor: 'ssl_type' }
          ]);
          formatSuccess(`Found ${data.length} custom hostname(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  hostnames
    .command('get')
    .description('获取自定义主机名详情 - 查看特定自定义主机名的详细配置信息，包括 SSL 设置和验证状态')
    .requiredOption('-i, --id <id>', '自定义主机名 ID，指定要查询的主机名')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomHostname(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const h = result.result;
          formatTable([{
            id: h.id,
            hostname: h.hostname || '-',
            custom_origin_server: h.custom_origin_server || '-',
            custom_origin_sni: h.custom_origin_sni || '-',
            ssl_status: h.ssl?.status || '-',
            ssl_method: h.ssl?.method || '-',
            ssl_type: h.ssl?.type || '-',
            ssl_validation_errors: (h.ssl?.validation_errors || []).map(e => e.message).join(', ') || '-',
            created_at: h.created_at || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Hostname', accessor: 'hostname' },
            { header: 'Origin Server', accessor: 'custom_origin_server' },
            { header: 'SSL Status', accessor: 'ssl_status' },
            { header: 'SSL Method', accessor: 'ssl_method' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  hostnames
    .command('create')
    .description('创建自定义主机名 - 为 SaaS 客户配置自定义域名，自动签发 SSL 证书')
    .requiredOption('--hostname <hostname>', '自定义主机名（例如：app.example.com），指定客户要使用的域名')
    .option('--origin <origin>', '自定义源站服务器，指定后端源站的地址')
    .option('--method <method>', 'SSL 验证方法（http, txt, email），指定验证域名所有权的方式', 'http')
    .option('--type <type>', 'SSL 证书类型（dv），指定证书验证级别', 'dv')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          hostname: options.hostname
        };
        if (options.origin) data.custom_origin_server = options.origin;
        if (options.method || options.type) {
          data.ssl = {
            method: options.method || 'http',
            type: options.type || 'dv'
          };
        }

        const result = await client.createCustomHostname(data, options.zoneId);
        formatSuccess(`Custom hostname created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  hostnames
    .command('update')
    .description('更新自定义主机名 - 修改现有自定义主机名的配置设置')
    .requiredOption('-i, --id <id>', '自定义主机名 ID，指定的主机名')
    .option('--origin <origin>', '自定义源站服务器，修改后端源站的地址')
    .option('--method <method>', 'SSL 验证方法，修改验证域名所有权的方式')
    .option('--type <type>', 'SSL 证书类型，修改证书验证级别')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.origin) data.custom_origin_server = options.origin;
        if (options.method || options.type) {
          data.ssl = {};
          if (options.method) data.ssl.method = options.method;
          if (options.type) data.ssl.type = options.type;
        }

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateCustomHostname(options.id, data, options.zoneId);
        formatSuccess(`Custom hostname updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  hostnames
    .command('delete')
    .description('删除自定义主机名 - 移除自定义主机名配置，删除后该域名将不再受到 SSL 保护')
    .requiredOption('-i, --id <id>', '自定义主机名 ID，指定要删除的主机名')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteCustomHostname(options.id, options.zoneId);
        formatSuccess(`Custom hostname deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Fallback Origin
  const fallback = cert.command('fallback').description('管理自定义主机名故障转移源站 - 配置自定义主机名的默认回源地址');

  fallback
    .command('get')
    .description('获取故障转移源站 - 查看当前配置的默认回源地址')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomHostnameFallbackOrigin(options.zoneId);
        formatInfo(`Fallback Origin: ${result.result.origin || 'Not set'}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  fallback
    .command('set')
    .description('设置故障转移源站 - 配置自定义主机名的默认回源地址，用于未配置源站的主机名')
    .requiredOption('--origin <origin>', '故障转移源站（例如：origin.example.com），指定默认的回源地址')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = { origin: options.origin };
        const result = await client.updateCustomHostnameFallbackOrigin(data, options.zoneId);
        formatSuccess(`Fallback origin set to: ${result.result.origin}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // ACM - Advanced Certificate Manager (Enterprise)
  const acm = cert.command('acm').description('管理高级证书管理器（ACM，企业级）- 自动签发和管理证书');

  acm
    .command('config')
    .description('获取 ACM 配置 - 查看当前高级证书管理器的配置信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getACMConfig();

        if (options.json) {
          formatJson(result.result);
        } else {
          const config = result.result;
          formatTable([{
            enabled: config.enabled ? 'Yes' : 'No',
            ca: config.ca || '-',
            hostnames: (config.hostnames || []).join(', ') || '-'
          }], [
            { header: 'Enabled', accessor: 'enabled' },
            { header: 'Certificate Authority', accessor: 'ca' },
            { header: 'Hostnames', accessor: 'hostnames' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  acm
    .command('update')
    .description('更新 ACM 配置 - 修改高级证书管理器的配置设置')
    .option('--enabled', '启用 ACM')
    .option('--no-enabled', '禁用 ACM')
    .option('--ca <ca>', '证书颁发机构（lets_encrypt, google, ssl_com），指定签发证书的 CA')
    .option('--hostnames <hostnames...>', '证书主机名列表，指定要签发证书的域名')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.enabled !== undefined) data.enabled = options.enabled;
        if (options.ca) data.ca = options.ca;
        if (options.hostnames) data.hostnames = options.hostnames;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateACMConfig(data);
        formatSuccess('ACM configuration updated');
      } catch (error) {
        formatError(error.message);
      }
    });

  // SSL Verification
  const verification = cert.command('verification').description('管理 SSL 验证 - 查看证书验证状态和验证信息');

  verification
    .command('get')
    .description('获取 SSL 验证状态 - 查看区域证书的验证状态和验证详细信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getSSLVerification(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = (result.result || []).map(v => ({
            certificate_status: v.certificate_status || '-',
            verification_type: v.verification_type || '-',
            verification_status: v.verification_status ? 'Verified' : 'Pending',
            verification_info: JSON.stringify(v.verification_info || {})
          }));
          formatTable(data, [
            { header: 'Certificate Status', accessor: 'certificate_status' },
            { header: 'Verification Type', accessor: 'verification_type' },
            { header: 'Status', accessor: 'verification_status' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  // Universal SSL Settings
  const universal = cert.command('universal').description('管理 Universal SSL 设置 - 配置免费的通用 SSL 证书');

  universal
    .command('get')
    .description('获取 Universal SSL 设置 - 查看当前 Universal SSL 的启用状态')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getUniversalSSLSettings(options.zoneId);
        formatInfo(`Universal SSL Enabled: ${result.result.enabled ? 'Yes' : 'No'}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  universal
    .command('enable')
    .description('启用 Universal SSL - 为区域启用免费的通用 SSL 证书，自动保护所有子域名')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateUniversalSSLSettings({ enabled: true }, options.zoneId);
        formatSuccess('Universal SSL enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  universal
    .command('disable')
    .description('禁用 Universal SSL - 关闭免费的通用 SSL 证书')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateUniversalSSLSettings({ enabled: false }, options.zoneId);
        formatSuccess('Universal SSL disabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  // Certificate Authorities
  const ca = cert.command('authorities').description('管理证书颁发机构 - 查看可用的证书颁发机构列表');

  ca
    .command('list')
    .description('列出可用的证书颁发机构 - 显示所有可用于签发证书的 CA 列表')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCertificateAuthorities();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = (result.result || []).map(c => ({
            id: c.id,
            name: c.name || '-',
            description: c.description || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Description', accessor: 'description' }
          ]);
          formatSuccess(`Found ${data.length} Certificate Authority/Authorities`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  // Total TLS (Enterprise)
  const totaltls = cert.command('total-tls').description('管理 Total TLS（企业级）- 自动为指向 Cloudflare 的域名签发证书');

  totaltls
    .command('get')
    .description('获取 Total TLS 设置 - 查看当前 Total TLS 的启用状态和配置')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getTotalTLSSettings(options.zoneId);
        formatInfo(`Total TLS Enabled: ${result.result.enabled ? 'Yes' : 'No'}`);
        if (result.result.certificate_authority) {
          formatInfo(`Certificate Authority: ${result.result.certificate_authority}`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  totaltls
    .command('enable')
    .description('启用 Total TLS - 自动为指向 Cloudflare 的域名签发证书，确保源站连接安全')
    .option('--ca <ca>', '证书颁发机构（lets_encrypt, google, ssl_com），指定签发证书的 CA')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = { enabled: true };
        if (options.ca) data.certificate_authority = options.ca;
        const result = await client.updateTotalTLSSettings(data, options.zoneId);
        formatSuccess('Total TLS enabled');
      } catch (error) {
        formatError(error.message);
      }
    });

  totaltls
    .command('disable')
    .description('禁用 Total TLS - 关闭自动证书签发功能')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateTotalTLSSettings({ enabled: false }, options.zoneId);
        formatSuccess('Total TLS disabled');
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = certificateCommands;
