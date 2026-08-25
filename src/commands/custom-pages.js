const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * 自定义页面命令
 *
 * 功能说明：管理 Cloudflare 自定义页面，用于定制安全事件发生时显示给用户的页面。
 * 自定义页面允许您品牌化各种 Cloudflare 安全页面，包括质询页面、阻止页面和错误页面，
 * 提供一致的用户体验并传达品牌信息。
 *
 * 使用场景：
 * - 定制 WAF 质询页面（CAPTCHA 验证页面）
 * - 定制 WAF 阻止页面（访问被拒绝时显示）
 * - 定制速率限制阻止页面
 * - 定制基本质询页面（浏览器完整性检查）
 * - 预览自定义页面效果
 */
function customPagesCommands(program) {
  const cp = program.command('custom-pages').description('管理 Cloudflare 自定义页面（定制安全事件页面，包括质询、阻止和错误页面）');

  cp
    .command('list')
    .description('列出所有自定义页面 - 显示账户下所有可用的自定义页面及其配置状态')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listCustomPages(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(page => ({
            id: page.id,
            description: page.description || '-',
            state: page.state || '-',
            url: page.url || '-',
            created_on: page.created_on || '-',
            modified_on: page.modified_on || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Description', accessor: 'description' },
            { header: 'State', accessor: 'state' },
            { header: 'URL', accessor: 'url' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
          formatSuccess(`Found ${data.length} custom page(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('get')
    .description('获取自定义页面详情 - 查看特定自定义页面的详细配置信息')
    .requiredOption('-i, --id <id>', '自定义页面标识符（例如：basic_challenge, waf_challenge, waf_block, ratelimit_block），指定要查询的页面类型')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomPage(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const page = result.result;
          formatTable([{
            id: page.id,
            description: page.description || '-',
            state: page.state || '-',
            url: page.url || '-',
            preview_target: page.preview_target || '-',
            created_on: page.created_on || '-',
            modified_on: page.modified_on || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Description', accessor: 'description' },
            { header: 'State', accessor: 'state' },
            { header: 'URL', accessor: 'url' },
            { header: 'Preview Target', accessor: 'preview_target' },
            { header: 'Created', accessor: 'created_on' },
            { header: 'Modified', accessor: 'modified_on' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('update')
    .description('更新自定义页面 URL - 修改指定自定义页面的 URL 地址，指向您托管的自定义 HTML 页面')
    .requiredOption('-i, --id <id>', '自定义页面标识符（例如：basic_challenge, waf_challenge, waf_block, ratelimit_block），指定要更新的页面类型')
    .requiredOption('--url <url>', '自定义页面的 URL 地址（例如：https://example.com/challenge-page.html），必须是可公开访问的 HTTPS URL')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.updateCustomPage(options.id, options.zoneId, {
          url: options.url
        });
        formatSuccess(`Custom page updated: ${result.result.id}`);
        formatInfo(`URL: ${result.result.url}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  cp
    .command('preview')
    .description('获取自定义页面预览 URL - 获取用于预览自定义页面效果的 URL 链接，无需触发实际安全事件即可查看页面外观')
    .requiredOption('-i, --id <id>', '自定义页面标识符，指定要预览的页面类型')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getCustomPage(options.id, options.zoneId);
        if (result.result.preview_target) {
          formatInfo(`Preview URL: ${result.result.preview_target}`);
        } else {
          formatInfo('No preview URL available');
        }
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = customPagesCommands;
