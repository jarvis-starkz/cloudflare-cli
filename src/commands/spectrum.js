const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

/**
 * Spectrum 命令
 *
 * 功能说明：管理 Cloudflare Spectrum，为 TCP/UDP 应用提供 DDoS 防护和性能优化。
 * Spectrum 将 Cloudflare 的安全性和性能优势扩展到所有基于 TCP 或 UDP 的应用程序，
 * 不仅限于 HTTP/HTTPS 流量，支持 SSH、游戏服务器、VoIP 等非 HTTP 协议。
 *
 * 使用场景：
 * - 保护 SSH 服务器免受 DDoS 攻击
 * - 为游戏服务器提供低延迟连接
 * - 保护 VoIP 和视频会议应用
 * - 为数据库服务提供安全代理
 * - 配置 TCP 负载均衡
 */
function spectrumCommands(program) {
  const spectrum = program.command('spectrum').description('管理 Cloudflare Spectrum（企业级 TCP/UDP 应用防护，为非 HTTP 协议提供 DDoS 保护和性能优化）');

  spectrum
    .command('list')
    .description('列出所有 Spectrum 应用 - 显示所有已配置的 TCP/UDP 应用程序及其状态信息')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.listSpectrumApps(options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const data = result.result.map(app => ({
            id: app.id,
            protocol: app.protocol || '-',
            dns: app.dns || '-',
            origin_direct: app.origin_direct?.join(', ') || '-',
            proxy_protocol: app.proxy_protocol ? 'Enabled' : 'Disabled',
            ip_firewall: app.ip_firewall ? 'Enabled' : 'Disabled',
            edge_ips: app.edge_ips || '-'
          }));
          formatTable(data, [
            { header: 'ID', accessor: 'id' },
            { header: 'Protocol', accessor: 'protocol' },
            { header: 'DNS', accessor: 'dns' },
            { header: 'Origin Direct', accessor: 'origin_direct' },
            { header: 'Proxy Protocol', accessor: 'proxy_protocol' },
            { header: 'IP Firewall', accessor: 'ip_firewall' },
            { header: 'Edge IPs', accessor: 'edge_ips' }
          ]);
          formatSuccess(`Found ${data.length} application(s)`);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('get')
    .description('获取 Spectrum 应用详情 - 查看特定 TCP/UDP 应用程序的详细配置信息')
    .requiredOption('-i, --id <id>', '应用程序 ID（Application ID），指定要查询的 Spectrum 应用')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .option('-j, --json', '以 JSON 格式输出结果，便于脚本处理和自动化工作流')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.getSpectrumApp(options.id, options.zoneId);

        if (options.json) {
          formatJson(result.result);
        } else {
          const app = result.result;
          formatTable([{
            id: app.id,
            protocol: app.protocol || '-',
            dns: app.dns || '-',
            origin_direct: app.origin_direct?.join(', ') || '-',
            proxy_protocol: app.proxy_protocol ? 'Enabled' : 'Disabled',
            ip_firewall: app.ip_firewall ? 'Enabled' : 'Disabled',
            edge_ips: app.edge_ips || '-',
            tls: app.tls || '-',
            traffic_type: app.traffic_type || '-'
          }], [
            { header: 'ID', accessor: 'id' },
            { header: 'Protocol', accessor: 'protocol' },
            { header: 'DNS', accessor: 'dns' },
            { header: 'Origin Direct', accessor: 'origin_direct' },
            { header: 'Proxy Protocol', accessor: 'proxy_protocol' },
            { header: 'IP Firewall', accessor: 'ip_firewall' },
            { header: 'Edge IPs', accessor: 'edge_ips' },
            { header: 'TLS', accessor: 'tls' }
          ]);
        }
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('create')
    .description('创建新的 Spectrum 应用 - 为 TCP/UDP 服务配置 Cloudflare Spectrum 防护，将流量代理通过 Cloudflare 网络')
    .requiredOption('--protocol <protocol>', '协议和端口（例如：tcp/22, udp/53），指定要代理的协议类型和端口号')
    .requiredOption('--origin <origin>', '源站地址（例如：192.168.1.1:22），指定后端服务器的 IP 地址和端口')
    .option('--dns <dns>', 'DNS 名称（例如：ssh.example.com），为 Spectrum 应用配置友好的 DNS 名称，便于访问')
    .option('--proxy-protocol', '启用代理协议（Proxy Protocol），用于向后端服务器传递客户端原始 IP 信息', false)
    .option('--ip-firewall', '启用 IP 防火墙，提供基于 IP 地址的访问控制功能', true)
    .option('--tls <tls>', 'TLS 加密模式（控制流量加密级别）', 'off')
    .option('--edge-ips <ips>', '边缘 IP 配置（指定用于接收流量的 Cloudflare IP 类型）', 'all')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {
          protocol: options.protocol,
          origin_direct: [`tcp://${options.origin}`],
          proxy_protocol: options.proxyProtocol,
          ip_firewall: options.ipFirewall,
          tls: options.tls,
          edge_ips: options.edgeIps
        };
        if (options.dns) data.dns = { type: 'CNAME', name: options.dns };

        const result = await client.createSpectrumApp(options.zoneId, data);
        formatSuccess(`Spectrum application created: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('update')
    .description('更新 Spectrum 应用 - 修改现有 TCP/UDP 应用程序的配置设置')
    .requiredOption('-i, --id <id>', '应用程序 ID（Application ID），指定要更新的 Spectrum 应用')
    .option('--protocol <protocol>', '协议和端口（例如：tcp/22, udp/53），修改要代理的协议类型和端口号')
    .option('--origin <origin>', '源站地址（例如：192.168.1.1:22），修改后端服务器的 IP 地址和端口')
    .option('--dns <dns>', 'DNS 名称（例如：ssh.example.com），修改 Spectrum 应用的 DNS 名称')
    .option('--proxy-protocol', '启用代理协议（Proxy Protocol），向后端服务器传递客户端原始 IP 信息', true)
    .option('--no-proxy-protocol', '禁用代理协议（Proxy Protocol）', false)
    .option('--ip-firewall', '启用 IP 防火墙，提供基于 IP 地址的访问控制功能', true)
    .option('--no-ip-firewall', '禁用 IP 防火墙', false)
    .option('--tls <tls>', 'TLS 加密模式（控制流量加密级别）')
    .option('--edge-ips <ips>', '边缘 IP 配置（指定用于接收流量的 Cloudflare IP 类型）')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const data = {};
        if (options.protocol) data.protocol = options.protocol;
        if (options.origin) data.origin_direct = [`tcp://${options.origin}`];
        if (options.dns) data.dns = { type: 'CNAME', name: options.dns };
        if (options.proxyProtocol !== undefined) data.proxy_protocol = options.proxyProtocol;
        if (options.ipFirewall !== undefined) data.ip_firewall = options.ipFirewall;
        if (options.tls) data.tls = options.tls;
        if (options.edgeIps) data.edge_ips = options.edgeIps;

        if (Object.keys(data).length === 0) {
          formatError('Please specify at least one option to update');
          return;
        }

        const result = await client.updateSpectrumApp(options.id, options.zoneId, data);
        formatSuccess(`Spectrum application updated: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });

  spectrum
    .command('delete')
    .description('删除 Spectrum 应用 - 移除 TCP/UDP 应用程序的 Spectrum 防护，删除后流量将直接到达源站')
    .requiredOption('-i, --id <id>', '应用程序 ID（Application ID），指定要删除的 Spectrum 应用')
    .option('-z, --zone-id <zoneId>', '区域 ID（Zone ID），用于指定特定区域。如未指定则使用配置文件中默认的区域')
    .action(async (options) => {
      try {
        const client = new CloudflareClient(program.opts().config);
        const result = await client.deleteSpectrumApp(options.id, options.zoneId);
        formatSuccess(`Spectrum application deleted: ${result.result.id}`);
      } catch (error) {
        formatError(error.message);
      }
    });
}

module.exports = spectrumCommands;
