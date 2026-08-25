const CloudflareClient = require('../utils/cf-client');
const { formatSuccess, formatError, formatTable, formatJson, formatInfo } = require('../utils/formatter');

function certificateCommands(program) {
  const cert = program.command('certificate').description('Manage Cloudflare Certificates');

  // Custom Certificates
  const custom = cert.command('custom').description('Manage Custom Certificates');

  custom
    .command('list')
    .description('List all custom certificates')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get certificate details')
    .requiredOption('-i, --id <id>', 'Certificate ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Upload a custom certificate')
    .requiredOption('--certificate <cert>', 'Certificate (PEM format)')
    .requiredOption('--private-key <key>', 'Private key (PEM format)')
    .option('--bundle-method <method>', 'Bundle method (ubiquitous, optimal, force)', 'ubiquitous')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Update a custom certificate')
    .requiredOption('-i, --id <id>', 'Certificate ID')
    .option('--certificate <cert>', 'Certificate (PEM format)')
    .option('--private-key <key>', 'Private key (PEM format)')
    .option('--bundle-method <method>', 'Bundle method')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Delete a custom certificate')
    .requiredOption('-i, --id <id>', 'Certificate ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const bundles = cert.command('bundles').description('Manage Certificate Bundles');

  bundles
    .command('list')
    .description('List certificate bundles (prioritization)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Update certificate bundles prioritization')
    .requiredOption('--certificates <ids...>', 'Certificate IDs in priority order')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const keyless = cert.command('keyless').description('Manage Keyless SSL (Enterprise)');

  keyless
    .command('list')
    .description('List all keyless certificates')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get keyless certificate details')
    .requiredOption('-i, --id <id>', 'Keyless certificate ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a keyless certificate')
    .requiredOption('-n, --name <name>', 'Certificate name')
    .requiredOption('--host <host>', 'Key server host')
    .requiredOption('--port <port>', 'Key server port')
    .option('--certificate <cert>', 'Certificate (PEM format)')
    .option('--enabled', 'Enable the certificate', true)
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Update a keyless certificate')
    .requiredOption('-i, --id <id>', 'Keyless certificate ID')
    .option('-n, --name <name>', 'Certificate name')
    .option('--host <host>', 'Key server host')
    .option('--port <port>', 'Key server port')
    .option('--enabled', 'Enable the certificate')
    .option('--no-enabled', 'Disable the certificate')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Delete a keyless certificate')
    .requiredOption('-i, --id <id>', 'Keyless certificate ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const hostnames = cert.command('hostnames').description('Manage Custom Hostnames (Enterprise)');

  hostnames
    .command('list')
    .description('List all custom hostnames')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Get custom hostname details')
    .requiredOption('-i, --id <id>', 'Custom hostname ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
    .description('Create a custom hostname')
    .requiredOption('--hostname <hostname>', 'Custom hostname (e.g., app.example.com)')
    .option('--origin <origin>', 'Custom origin server')
    .option('--method <method>', 'SSL validation method (http, txt, email)', 'http')
    .option('--type <type>', 'SSL certificate type (dv)', 'dv')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Update a custom hostname')
    .requiredOption('-i, --id <id>', 'Custom hostname ID')
    .option('--origin <origin>', 'Custom origin server')
    .option('--method <method>', 'SSL validation method')
    .option('--type <type>', 'SSL certificate type')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Delete a custom hostname')
    .requiredOption('-i, --id <id>', 'Custom hostname ID')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const fallback = cert.command('fallback').description('Manage Custom Hostname Fallback Origin');

  fallback
    .command('get')
    .description('Get fallback origin')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Set fallback origin')
    .requiredOption('--origin <origin>', 'Fallback origin (e.g., origin.example.com)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const acm = cert.command('acm').description('Manage Advanced Certificate Manager (Enterprise)');

  acm
    .command('config')
    .description('Get ACM configuration')
    .option('-j, --json', 'Output as JSON')
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
    .description('Update ACM configuration')
    .option('--enabled', 'Enable ACM')
    .option('--no-enabled', 'Disable ACM')
    .option('--ca <ca>', 'Certificate Authority (lets_encrypt, google, ssl_com)')
    .option('--hostnames <hostnames...>', 'Hostnames for certificate')
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
  const verification = cert.command('verification').description('Manage SSL Verification');

  verification
    .command('get')
    .description('Get SSL verification status')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
    .option('-j, --json', 'Output as JSON')
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
  const universal = cert.command('universal').description('Manage Universal SSL Settings');

  universal
    .command('get')
    .description('Get Universal SSL settings')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Enable Universal SSL')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Disable Universal SSL')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
  const ca = cert.command('authorities').description('Manage Certificate Authorities');

  ca
    .command('list')
    .description('List available Certificate Authorities')
    .option('-j, --json', 'Output as JSON')
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
  const totaltls = cert.command('total-tls').description('Manage Total TLS (Enterprise)');

  totaltls
    .command('get')
    .description('Get Total TLS settings')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Enable Total TLS')
    .option('--ca <ca>', 'Certificate Authority (lets_encrypt, google, ssl_com)')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
    .description('Disable Total TLS')
    .option('-z, --zone-id <zoneId>', 'Zone ID (defaults to configured zone)')
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
