const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');
const fs = require('fs');

function workerCommands(program) {
  const workers = program.command('workers').description(
    'Manage Cloudflare Workers. 管理 Cloudflare Workers，包括脚本上传、删除和路由配置。'
  );

  workers
    .command('list')
    .description('List all Workers. 列出账户下所有 Workers，显示 ID、创建时间和修改时间。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listWorkers();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(script => ({
            id: script.id,
            created_on: script.created_on || '-',
            modified_on: script.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
          formatSuccess(`Found ${data.length} Worker(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  workers
    .command('upload')
    .description('Upload a Worker script. 上传 Worker 脚本到 Cloudflare，自动设置兼容性日期为当天。')
    .requiredOption('-n, --name <name>', 'Worker name. Worker 名称，用于标识该 Worker。')
    .requiredOption('-f, --file <path>', 'Path to Worker script file. Worker 脚本文件路径。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);

        if (!fs.existsSync(options.file)) {
          formatError(`File not found: ${options.file}`);
          return;
        }

        const script = fs.readFileSync(options.file, 'utf8');
        const result = await client.uploadWorker(options.name, script, {
          main_module: 'index.js',
          compatibility_date: new Date().toISOString().split('T')[0]
        });

        formatSuccess(`Worker uploaded: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  workers
    .command('delete')
    .description('Delete a Worker. 删除 Cloudflare Worker，此操作不可逆。')
    .requiredOption('-n, --name <name>', 'Worker name. 要删除的 Worker 名称。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteWorker(options.name);
        formatSuccess(`Worker deleted: ${options.name}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const routes = workers.command('routes').description(
    'Manage Worker Routes. 管理 Worker 路由，用于将 URL 模式映射到指定的 Worker 脚本。'
  );

  routes
    .command('list')
    .description('List all Worker routes. 列出所有 Worker 路由，显示路由 ID、URL 模式和关联的脚本名称。')
    .option('-j, --json', 'Output as JSON. 以 JSON 格式输出结果。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listWorkerRoutes();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(route => ({
            id: route.id,
            pattern: route.pattern,
            script: route.script || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Pattern', accessor: 'pattern' },
            { header: 'Script', accessor: 'script' }
          ]);
          formatSuccess(`Found ${data.length} route(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  routes
    .command('add')
    .description('Add a Worker route. 添加 Worker 路由，将 URL 模式映射到指定的 Worker 脚本。')
    .requiredOption('-p, --pattern <pattern>', 'Route pattern (e.g., "example.com/api/*"). 路由模式，支持通配符，如 "example.com/api/*"。')
    .requiredOption('-s, --script <script>', 'Worker script name. 要关联的 Worker 脚本名称。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.createWorkerRoute(options.pattern, options.script);
        formatSuccess(`Route added: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  routes
    .command('delete')
    .description('Delete a Worker route. 删除 Worker 路由，此操作不可逆。')
    .requiredOption('-i, --id <id>', 'Route ID. 要删除的路由 ID。')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteWorkerRoute(options.id);
        formatSuccess(`Route deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = workerCommands;
