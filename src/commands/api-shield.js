const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function apiShieldCommands(program) {
  const shield = program.command('api-shield').description('Manage Cloudflare API Shield (Enterprise)');

  // Endpoints
  const endpoints = shield.command('endpoints').description('Manage API Shield Endpoints');

  endpoints
    .command('list')
    .description('List all API Shield endpoints')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a new API Shield endpoint')
    .requiredOption('--host <host>', 'Host (e.g., api.example.com)')
    .requiredOption('--method <method>', 'HTTP method (GET, POST, PUT, DELETE, etc.)')
    .requiredOption('--path <path>', 'API path (e.g., /api/v1/*)')
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
    .description('Delete an API Shield endpoint')
    .requiredOption('-i, --id <id>', 'Endpoint ID')
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
  const schemas = shield.command('schemas').description('Manage API Shield Schemas');

  schemas
    .command('list')
    .description('List all API Shield schemas')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a new API Shield schema')
    .requiredOption('-n, --name <name>', 'Schema name')
    .requiredOption('--source <source>', 'Schema source URL or file path')
    .option('--kind <kind>', 'Schema kind (openapi_v3)', 'openapi_v3')
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
    .description('Delete an API Shield schema')
    .requiredOption('-i, --id <id>', 'Schema ID')
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
