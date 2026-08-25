const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function pagesCommands(program) {
  const pages = program.command('pages').description('Manage Cloudflare Pages');

  // Pages Projects
  const projects = pages.command('projects').description('Manage Pages Projects');

  projects
    .command('list')
    .description('List all Pages projects')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listPagesProjects();

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(project => ({
            name: project.name,
            subdomain: project.subdomain,
            domain: project.domains?.join(', ') || '-',
            source: project.source?.type || '-',
            created_on: project.created_on || '-'
          }));
          formatTable(data, [
            { header: 'Name', accessor: 'name' },
            { header: 'Subdomain', accessor: 'subdomain' },
            { header: 'Domain', accessor: 'domain' },
            { header: 'Source', accessor: 'source' },
            { header: 'Created', accessor: 'created_on' }
          ]);
          formatSuccess(`Found ${data.length} project(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  projects
    .command('get')
    .description('Get a Pages project details')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getPageProject(options.name);

        if (options.json) {
          formatJson(result.result);
        } else {
          const project = result.result;
          formatTable([{
            name: project.name,
            subdomain: project.subdomain,
            domain: project.domains?.join(', ') || '-',
            source: project.source?.type || '-',
            production_branch: project.production_branch || '-',
            created_on: project.created_on || '-',
            modified_on: project.modified_on || '-'
          }], [
            { header: 'Name', accessor: 'name' },
            { header: 'Subdomain', accessor: 'subdomain' },
            { header: 'Domain', accessor: 'domain' },
            { header: 'Source', accessor: 'source' },
            { header: 'Branch', accessor: 'production_branch' },
            { header: 'Created', accessor: 'created_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  projects
    .command('create')
    .description('Create a new Pages project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('--branch <branch>', 'Production branch', 'main')
    .option('--source-type <type>', 'Source type (github, gitlab)', 'github')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          name: options.name,
          production_branch: options.branch,
          source: {
            type: options.sourceType
          }
        };

        const result = await client.createPageProject(data);
        formatSuccess(`Pages project created: ${result.result.name}`);
        formatInfo(`Subdomain: ${result.result.subdomain}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  projects
    .command('delete')
    .description('Delete a Pages project')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deletePageProject(options.name);
        formatSuccess(`Pages project deleted: ${options.name}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Pages Deployments
  const deployments = pages.command('deployments').description('Manage Pages Deployments');

  deployments
    .command('list')
    .description('List deployments for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listPagesDeployments(options.name);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(dep => ({
            id: dep.id,
            url: dep.url || '-',
            environment: dep.environment || '-',
            deployment_trigger: dep.deployment_trigger?.type || '-',
            created_on: dep.created_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'URL', accessor: 'url' },
            { header: 'Environment', accessor: 'environment' },
            { header: 'Trigger', accessor: 'deployment_trigger' },
            { header: 'Created', accessor: 'created_on' }
          ]);
          formatSuccess(`Found ${data.length} deployment(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  deployments
    .command('create')
    .description('Create a new deployment')
    .requiredOption('-n, --name <name>', 'Project name')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.createPagesDeployment(options.name);
        formatSuccess(`Deployment created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  deployments
    .command('delete')
    .description('Delete a deployment')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('-d, --deployment-id <id>', 'Deployment ID')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deletePagesDeployment(options.name, options.deploymentId);
        formatSuccess(`Deployment deleted: ${options.deploymentId}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  // Pages Domains
  const domains = pages.command('domains').description('Manage Pages Custom Domains');

  domains
    .command('list')
    .description('List custom domains for a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getPageProject(options.name);

        if (options.json) {
          formatJson(result.result.domains);
        } else {
          const domains = result.result.domains || [];
          if (domains.length === 0) {
            formatInfo('No custom domains found');
            return;
          }
          const data = domains.map(domain => ({
            domain: domain
          }));
          formatTable(data, [
            { header: 'Domain', accessor: 'domain' }
          ]);
          formatSuccess(`Found ${data.length} domain(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  domains
    .command('add')
    .description('Add a custom domain to a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('--domain <domain>', 'Custom domain (e.g., example.com)')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.addPagesCustomDomain(options.name, options.domain);
        formatSuccess(`Domain added: ${result.result.name}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  domains
    .command('delete')
    .description('Delete a custom domain from a project')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('--domain <domain>', 'Custom domain')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deletePagesCustomDomain(options.name, options.domain);
        formatSuccess(`Domain deleted: ${options.domain}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = pagesCommands;
