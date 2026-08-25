const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');
const fs = require('fs');

function workerCommands(program) {
  const workers = program.command('workers').description('Manage Cloudflare Workers');

  workers
    .command('list')
    .description('List all Workers')
    .option('-j, --json', 'Output as JSON')
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
    .description('Upload a Worker script')
    .requiredOption('-n, --name <name>', 'Worker name')
    .requiredOption('-f, --file <path>', 'Path to Worker script file')
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
    .description('Delete a Worker')
    .requiredOption('-n, --name <name>', 'Worker name')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteWorker(options.name);
        formatSuccess(`Worker deleted: ${options.name}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  const routes = workers.command('routes').description('Manage Worker Routes');

  routes
    .command('list')
    .description('List all Worker routes')
    .option('-j, --json', 'Output as JSON')
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
    .description('Add a Worker route')
    .requiredOption('-p, --pattern <pattern>', 'Route pattern (e.g., "example.com/api/*")')
    .requiredOption('-s, --script <script>', 'Worker script name')
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
    .description('Delete a Worker route')
    .requiredOption('-i, --id <id>', 'Route ID')
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
