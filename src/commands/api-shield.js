const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * API Shield 命令
 *
 * 功能说明：管理 Cloudflare API Shield，提供 API 端点保护和 Schema 验证功能。
 * API Shield 通过自动发现、监控和保护 API 端点来增强 API 安全性，
 * 支持基于 OpenAPI Schema 的输入验证，防止恶意请求和数据泄露。
 *
 * 使用场景：
 * - 自动发现和注册 API 端点
 * - 上传和管理 API Schema 定义
 * - 配置 API 请求验证规则
 * - 监控 API 流量和异常行为
 */
function apiShieldCommands(program) {
  const shield = program.command('api-shield').description('管理 Cloudflare API Shield（企业级 API 安全保护，提供端点管理和 Schema 验证功能）');

  // Endpoints
  const endpoints = shield.command('endpoints').description('管理 API Shield 端点 - 注册、发现和监控 API 端点');

  endpoints
    .command('list')
    .description('列出所有 API Shield 端点 - 显示已注册的所有 API 端点及其状态信息，包括端点 URL、HTTP 方法和主机名')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAPIShieldEndpoints();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(endpoint => ({
            id: endpoint.id,
            endpoint: endpoint.endpoint || '-',
            method: endpoint.method || '-',
            host: endpoint.host || '-',
            status: endpoint.status || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Endpoint', accessor: 'endpoint' },
            { header: 'Method', accessor: 'method' },
            { header: 'Host', accessor: 'host' },
            { header: 'Status', accessor: 'status' }
          ]);
          formatSuccess(`Found ${data.length} endpoint(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  endpoints
    .command('create')
    .description('创建新的 API Shield 端点 - 注册一个新的 API 端点以启用安全保护和流量监控')
    .requiredOption('--host <host>', 'API 主机名（例如：api.example.com），指定要保护的 API 服务域名')
    .requiredOption('--method <method>', 'HTTP 请求方法（GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS），指定端点支持的 HTTP 方法')
    .requiredOption('--path <path>', 'API 路径模式（例如：/api/v1/*），支持通配符匹配多个路径')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          endpoint: {
            host: options.host,
            method: options.method,
            path: options.path
          }
        };

        const result = await client.createAPIShieldEndpoint(data);
        formatSuccess(`API Shield endpoint created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  endpoints
    .command('delete')
    .description('删除 API Shield 端点 - 移除已注册的 API 端点，删除后该端点将不再受到 API Shield 保护')
    .requiredOption('-i, --id <id>', '要删除的端点唯一标识符（Endpoint ID）')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAPIShieldEndpoint(options.id);
        formatSuccess(`API Shield endpoint deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Schemas
  const schemas = shield.command('schemas').description('管理 API Shield Schema - 上传和管理 OpenAPI Schema 定义用于请求验证');

  schemas
    .command('list')
    .description('列出所有 API Shield Schema - 显示已上传的所有 API Schema 定义及其元数据信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listAPIShieldSchemas();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(schema => ({
            id: schema.id,
            name: schema.name || '-',
            kind: schema.kind || '-',
            created_at: schema.created_at || '-',
            source_type: schema.source_type || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Kind', accessor: 'kind' },
            { header: 'Source Type', accessor: 'source_type' },
            { header: 'Created', accessor: 'created_at' }
          ]);
          formatSuccess(`Found ${data.length} schema(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  schemas
    .command('create')
    .description('创建新的 API Shield Schema - 上传 OpenAPI Schema 定义以启用 API 请求验证和异常检测')
    .requiredOption('-n, --name <name>', 'Schema 名称，用于标识和管理 Schema 定义')
    .requiredOption('--source <source>', 'Schema 源文件 URL 或本地文件路径，指向 OpenAPI Schema 文件（支持 http:// 或 https:// URL，或本地文件路径）')
    .option('--kind <kind>', 'Schema 类型（指定 Schema 格式版本）', 'openapi_v3')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          source: {
            url: options.source
          },
          kind: options.kind
        };

        const result = await client.createAPIShieldSchema(data);
        formatSuccess(`API Shield schema created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  schemas
    .command('delete')
    .description('删除 API Shield Schema - 移除已上传的 Schema 定义，删除后将停止基于该 Schema 的请求验证')
    .requiredOption('-i, --id <id>', '要删除的 Schema 唯一标识符（Schema ID）')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteAPIShieldSchema(options.id);
        formatSuccess(`API Shield schema deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = apiShieldCommands;
