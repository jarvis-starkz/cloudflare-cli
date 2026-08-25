const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * Pages 命令
 *
 * 功能说明：管理 Cloudflare Pages，为 JAMstack 应用提供静态站点托管和持续部署。
 * Pages 支持直接从 Git 仓库自动构建和部署，提供全球 CDN 分发、
 * 自动 HTTPS、预览部署和自定义域名等功能。
 *
 * 使用场景：
 * - 部署静态网站和 JAMstack 应用
 * - 配置自动构建和持续部署
 * - 管理预览部署环境
 * - 添加自定义域名
 * - 查看部署历史和状态
 */
function pagesCommands(program) {
  const pages = program.command('pages').description('管理 Cloudflare Pages（JAMstack 静态站点托管，支持自动构建、部署和全球 CDN 分发）');

  // Pages Projects
  const projects = pages.command('projects').description('管理 Pages 项目 - 创建、配置和删除静态站点项目');

  projects
    .command('list')
    .description('列出所有 Pages 项目 - 显示账户下配置的所有 Pages 项目及其状态信息')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('获取 Pages 项目详情 - 查看特定项目的详细配置信息，包括源代码设置和部署配置')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要查询的 Pages 项目')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的 Pages 项目 - 配置新的静态站点项目，指定源代码仓库和生产分支')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），用于标识和管理项目，也将作为子域名前缀')
    .option('--branch <branch>', '生产分支名称，指定用于生产部署的 Git 分支', 'main')
    .option('--source-type <type>', '源代码仓库类型（github, gitlab），指定托管代码的平台', 'github')
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
    .description('删除 Pages 项目 - 移除项目及其所有部署，删除后项目将无法访问')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要删除的 Pages 项目')
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
  const deployments = pages.command('deployments').description('管理 Pages 部署 - 查看和管理项目的部署历史');

  deployments
    .command('list')
    .description('列出项目部署 - 显示特定项目的所有部署记录及其状态信息')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要查询的项目')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('创建新的部署 - 为项目触发新的部署，将最新代码部署到生产环境')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要部署的项目')
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
    .description('删除部署 - 移除特定的部署记录，删除后该部署将无法访问')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要操作的项目')
    .requiredOption('-d, --deployment-id <id>', '部署 ID（Deployment ID），指定要删除的部署')
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
  const domains = pages.command('domains').description('管理 Pages 自定义域名 - 为项目配置和管理自定义域名');

  domains
    .command('list')
    .description('列出项目自定义域名 - 显示特定项目配置的所有自定义域名')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要查询的项目')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
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
    .description('添加自定义域名 - 为项目配置自定义域名，使站点可通过自有域名访问')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要配置的项目')
    .requiredOption('--domain <domain>', '自定义域名（例如：example.com），指定要添加的域名')
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
    .description('删除自定义域名 - 移除项目的自定义域名配置，删除后该域名将无法访问站点')
    .requiredOption('-n, --name <name>', '项目名称（Project Name），指定要操作的项目')
    .requiredOption('--domain <domain>', '自定义域名，指定要删除的域名')
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
