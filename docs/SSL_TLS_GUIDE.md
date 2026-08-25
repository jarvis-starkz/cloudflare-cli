# Cloudflare SSL/TLS 完全小白指南

> 本文档面向零基础用户，详细解释 Cloudflare SSL/TLS 相关概念和使用方法。

> **文档版本**: v1.3  
> **最后更新**: 2026-08-17  
> **适用 CLI 版本**: cfcli v1.0.0  
> **变更说明**: v1.3 联网 Cloudflare 官方文档核对修正：① Total TLS 补充限制说明（不适用于 LB/Tunnel/Spectrum、需 Full DNS setup、默认 90 天）；② ACM 配额补充（单张 50 SAN + Ent 每 Zone 100 张）；③ AOP 补充三个独立配置级别（Global/Zone-level/Per-hostname）+ 全 Plan 可用 + Off/Flexible 下不生效；④ Log Explorer 标注 Beta；⑤ 第 9.7 节补充 Automatic SSL/TLS 新特性说明；v1.2 新增第 9.7 节「SSL/TLS 四种模式场景化对比」；v1.1 扩展第 5 章加密套件自定义能力

## 目录

1. [SSL/TLS 基础概念](#1-ssltls-基础概念)
2. [Cloudflare 的两个证书](#2-cloudflare-的两个证书)
3. [证书自动更新机制](#3-证书自动更新机制)
4. [公钥和私钥](#4-公钥和私钥)
5. [加密套件 (Cipher Suites)](#5-加密套件-cipher-suites)
6. [不同供应商的证书限制](#6-不同供应商的证书限制)
7. [ACM (高级证书管理器)](#7-acm-高级证书管理器)
8. [mTLS (双向 TLS 认证)](#8-mtls-双向-tls-认证)
9. [限制来源到 Origin Server 的方法](#9-限制来源到-origin-server-的方法)
10. [常见问题 FAQ](#10-常见问题-faq)
11. [附录：CLI 命令速查表](#附录cli-命令速查表)

---

## 1. SSL/TLS 基础概念

### 什么是 SSL/TLS？

SSL (Secure Sockets Layer) 和 TLS (Transport Layer Security) 是用于在网络上加密数据传输的协议。它们确保你的网站访客和服务器之间的通信不被窃听或篡改。

**简单类比**：SSL/TLS 就像给互联网通信加上了一层"防窃听保护罩"。

### 为什么需要 SSL/TLS？

| 没有 SSL/TLS | 有 SSL/TLS |
|-------------|-----------|
| 数据明文传输，任何人可以窃听 | 数据加密传输，即使被截获也无法读取 |
| 无法验证服务器身份 | 证书证明服务器真实身份 |
| 数据可能被篡改 | 数据完整性受到保护 |

### 证书验证级别

| 类型 | 全称 | 验证内容 | 适用场景 |
|------|------|---------|---------|
| **DV** | Domain Validated | 仅验证域名所有权 | 个人网站、博客 |
| **OV** | Organization Validated | 验证域名 + 组织身份 | 企业官网 |
| **EV** | Extended Validation | 最严格验证，包括组织身份 | 银行、电商 |

> Cloudflare 提供的免费证书 (Universal SSL、Total TLS、Advanced) 都是 **DV 级别**。如果需要 OV 或 EV 证书，需要使用 Custom Certificates 上传自己的证书。

---

## 2. Cloudflare 的两个证书

Cloudflare 作为反向代理，涉及**两个不同的 TLS 连接**，因此需要**两套不同的证书**：

```
访客浏览器 ←──[边缘证书]──→ Cloudflare ←──[源站证书]──→ 你的服务器 (Origin)
         Connection 1              Connection 2
```

### 边缘证书 (Edge Certificate)

- **位置**：访客浏览器 ↔ Cloudflare
- **作用**：保护与 Cloudflare 的连接
- **管理方式**：Cloudflare 自动签发和更新
- **类型**：Universal SSL (免费)、Advanced Certificate、Custom Certificate

### 源站证书 (Origin Certificate)

- **位置**：Cloudflare ↔ 你的服务器
- **作用**：保护与源站的连接
- **管理方式**：可以使用 Cloudflare Origin CA 或第三方证书
- **类型**：Origin CA (免费，仅 Cloudflare 信任)、Let's Encrypt、商业证书

### 两张证书的关系

```
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   访客浏览器     │          │   Cloudflare    │          │   源站服务器     │
│                 │  HTTPS   │                 │  HTTPS   │                 │
│  验证边缘证书 ✅ │ ◄─────► │  验证源站证书 ✅ │ ◄─────► │  出示源站证书   │
│                 │          │  出示边缘证书   │          │                 │
└─────────────────┘          └─────────────────┘          └─────────────────┘
```

---

## 3. 证书自动更新机制

### Cloudflare 送的证书会自动更新吗？

**是的，Cloudflare 免费证书会自动更新。**

| 证书类型 | 有效期 | 自动更新 | 是否需要手动操作 |
|---------|--------|---------|----------------|
| Universal SSL | 15 年 (但每 90 天续期) | ✅ 自动 | ❌ 不需要 |
| Total TLS | 90 天 | ✅ 自动 | ❌ 不需要 |
| Advanced Certificate | 1 年 | ✅ 自动 | ❌ 不需要 |
| Origin CA | 15 年 | ✅ 自动 | ❌ 不需要 |
| Custom Certificate | 取决于证书 | ❌ 手动 | ✅ 需要 |

### 自动更新 = 重新生成吗？

**不完全是**。每次自动更新实际上是：

1. **重新签发** (Reissue)：用新的密钥对生成新证书
2. **重新部署** (Redeploy)：将新证书推送到 Cloudflare 全球节点

**关键点**：
- 每次更新会生成**新的私钥**和**新的证书**
- 旧的证书会被替换，这个过程对用户**无感知**（不会中断服务）
- 更新过程中新旧证书可能有短暂重叠，确保无缝切换

### 使用 CLI 管理证书

```bash
# 查看当前 Universal SSL 状态
cfcli certificate universal get

# 启用 Universal SSL
cfcli certificate universal enable

# 查看 Total TLS 状态
cfcli certificate total-tls get

# 启用 Total TLS
cfcli certificate total-tls enable --ca lets_encrypt

# 查看 ACM 配置
cfcli certificate acm config

# 更新 ACM 配置
cfcli certificate acm update --enabled --ca lets_encrypt --hostnames example.com,www.example.com
```

---

## 4. 公钥和私钥

### 什么是公钥和私钥？

**简单类比**：
- **公钥** (Public Key)：像"锁"，可以给任何人，用于加密数据
- **私钥** (Private Key)：像"钥匙"，只能自己持有，用于解密数据

```
加密过程：
明文数据 + 公钥 → 密文

解密过程：
密文 + 私钥 → 明文数据
```

### 如何获得公钥私钥？

#### 方法 1：使用 Cloudflare 自动管理（推荐）

Cloudflare 自动处理密钥生成，你不需要手动操作：

```bash
# Cloudflare 自动生成的证书，你无需管理密钥
cfcli certificate universal enable
```

#### 方法 2：自己生成密钥对（用于 Custom Certificate）

如果你需要使用自己的证书，先生成密钥对：

```bash
# 生成 RSA 私钥 (2048 位)
openssl genrsa -out private.key 2048

# 生成 ECDSA 私钥 (P-256 曲线，推荐)
openssl ecparam -genkey -name prime256v1 -out private.key

# 从私钥提取公钥
openssl rsa -in private.key -pubout -out public.key
# 或
openssl ec -in private.key -pubout -out public.key
```

#### 方法 3：生成 CSR (证书签名请求)

```bash
# 1. 生成私钥
openssl genrsa -out private.key 2048

# 2. 生成 CSR
openssl req -new -key private.key -out csr.pem \
  -subj "/CN=example.com/O=My Organization/C=US"

# 3. 将 CSR 提交给 CA 机构申请证书
```

### 上传自定义证书到 Cloudflare

```bash
# 上传证书和私钥
cfcli certificate custom upload \
  --certificate "-----BEGIN CERTIFICATE-----..." \
  --private-key "-----BEGIN PRIVATE KEY-----..." \
  --bundle-method ubiquitous
```

---

## 5. 加密套件 (Cipher Suites)

### 什么是加密套件？

加密套件是 SSL/TLS 握手过程中使用的**算法组合**，包含：

```
加密套件 = 密钥交换算法 + 认证算法 + 批量加密算法 + 消息认证码 (MAC)

示例：
ECDHE-RSA-AES128-GCM-SHA256
│      │      │       │      │
│      │      │       │      └─ 消息认证：SHA256
│      │      │       └──────── 加密：AES128-GCM
│      │      └──────────────── 认证：RSA
│      └─────────────────────── 密钥交换：ECDHE (椭圆曲线)
└────────────────────────────── 前向保密：ECDHE
```

### 加密套件与证书的关联

| 证书类型 | 支持的密钥交换 | 说明 |
|---------|--------------|------|
| RSA 证书 | ECDHE-RSA, RSA | 支持前向保密 (ECDHE) |
| ECDSA 证书 | ECDHE-ECDSA | 更快的前向保密，性能更好 |

**重要**：
- 证书类型**决定了**可以使用哪些加密套件
- RSA 证书支持更多加密套件
- ECDSA 证书更安全、更快，但支持的套件较少

### 加密套件等级

| 等级 | 推荐套件 | 说明 |
|------|---------|------|
| **Modern** | `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256` | 仅 TLS 1.3 |
| **Compatible** | Modern + `ECDHE-ECDSA-AES128-GCM-SHA256`, `ECDHE-RSA-AES128-GCM-SHA256` | TLS 1.2 + 1.3 |
| **Legacy** | Compatible + 旧版套件 | 兼容旧浏览器 |

### 如何设置加密套件？

**注意**：自定义加密套件需要 **Advanced Certificate Manager** 订阅。

```bash
# 通过 API 设置加密套件 (需要 Advanced Certificate Manager)
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/ciphers" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"value":["ECDHE-ECDSA-AES128-GCM-SHA256","ECDHE-RSA-AES128-GCM-SHA256","TLS_AES_128_GCM_SHA256"]}'
```

### 源站加密套件配置

在你的源站服务器 (Nginx) 上配置匹配的加密套件：

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/private.key;

    # 推荐加密套件配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ecdh_curve X25519:P-256:P-384;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers on;
}
```

### 5.1 Cloudflare 支持的完整加密套件列表

Cloudflare 边缘支持 TLS 1.2 与 TLS 1.3 两套加密套件，按强度与兼容性分级如下。

#### TLS 1.3 加密套件（仅 TLS 1.3 协商时可用）

| 套件名称 | 密钥交换 | 认证 | 加密 | MAC | 推荐场景 |
|---------|---------|------|------|-----|---------|
| `TLS_AES_128_GCM_SHA256` | ECDHE | RSA/ECDSA | AES-128-GCM | SHA256 | **默认推荐**，性能最佳 |
| `TLS_AES_256_GCM_SHA384` | ECDHE | RSA/ECDSA | AES-256-GCM | SHA384 | 合规要求 256 位加密 |
| `TLS_CHACHA20_POLY1305_SHA256` | ECDHE | RSA/ECDSA | ChaCha20-Poly1305 | SHA256 | 移动端无 AES-NI 时性能更好 |

> **TLS 1.3 限制**：TLS 1.3 的加密套件**无法自定义顺序**，由 Cloudflare 自动选择；如需严格控制必须使用 TLS 1.2。

#### TLS 1.2 加密套件（可自定义顺序，需 ACM 或 Ent）

| 套件名称 | 密钥交换 | 认证 | 加密 | MAC | 前向保密 | 推荐度 |
|---------|---------|------|------|-----|---------|--------|
| `ECDHE-ECDSA-AES128-GCM-SHA256` | ECDHE | ECDSA | AES-128-GCM | SHA256 | ✅ | ★★★★★ |
| `ECDHE-ECDSA-AES256-GCM-SHA384` | ECDHE | ECDSA | AES-256-GCM | SHA384 | ✅ | ★★★★★ |
| `ECDHE-ECDSA-CHACHA20-POLY1305` | ECDHE | ECDSA | ChaCha20-Poly1305 | SHA256 | ✅ | ★★★★★ |
| `ECDHE-RSA-AES128-GCM-SHA256` | ECDHE | RSA | AES-128-GCM | SHA256 | ✅ | ★★★★☆ |
| `ECDHE-RSA-AES256-GCM-SHA384` | ECDHE | RSA | AES-256-GCM | SHA384 | ✅ | ★★★★☆ |
| `ECDHE-RSA-CHACHA20-POLY1305` | ECDHE | RSA | ChaCha20-Poly1305 | SHA256 | ✅ | ★★★★☆ |
| `ECDHE-ECDSA-AES128-SHA256` | ECDHE | ECDSA | AES-128-CBC | SHA256 | ✅ | ★★★☆☆ |
| `ECDHE-RSA-AES128-SHA256` | ECDHE | RSA | AES-128-CBC | SHA256 | ✅ | ★★★☆☆ |
| `AES128-GCM-SHA256` | RSA | RSA | AES-128-GCM | SHA256 | ❌ | ★★☆☆☆（仅兼容旧客户端） |
| `AES256-GCM-SHA384` | RSA | RSA | AES-256-GCM | SHA384 | ❌ | ★★☆☆☆ |
| `AES128-SHA256` | RSA | RSA | AES-128-CBC | SHA256 | ❌ | ★☆☆☆☆（不推荐） |
| `AES256-SHA256` | RSA | RSA | AES-256-CBC | SHA256 | ❌ | ★☆☆☆☆ |

> **关键规则**：
> - ECDSA 套件需要 ECDSA 证书；RSA 套件需要 RSA 证书
> - 带有 `ECDHE` 的套件提供**前向保密（PFS）**，是合规要求的硬性指标
> - CBC 模式套件存在 Lucky13 等攻击风险，**仅在兼容旧客户端时启用**
> - 不带 ECDHE 的 RSA 套件**无前向保密**，PCI-DSS v4.0 与等保四级已不推荐

### 5.2 各 Plan 加密套件自定义能力对比

加密套件自定义的可用范围随订阅等级递增，**Enterprise Plan 提供最完整的控制能力**。

| 能力 | Free | Pro | Business | ACM | **Enterprise** |
|------|------|-----|----------|-----|---------------|
| 选择 Modern / Compatible / Legacy 等级 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 自定义 TLS 1.2 套件顺序 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 自定义 TLS 1.3 套件顺序 | ❌ | ❌ | ❌ | ❌ | ❌（Cloudflare 强制） |
| 禁用 TLS 1.0 / 1.1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 强制 TLS 1.3 | ❌ | ❌ | ❌ | ❌ | ✅（min_tls_version=1.3） |
| 要求 0-RTT | ❌ | ❌ | ❌ | ✅ | ✅ |
| 自定义 ECDH 曲线 | ❌ | ❌ | ❌ | ❌ | ✅ |
| HSTS preload | ✅ | ✅ | ✅ | ✅ | ✅ |

> **关键差异**：Free/Pro/Business 只能在 Modern / Compatible / Legacy 三个预设等级中选择；**ACM 与 Enterprise 才能精确控制单个 TLS 1.2 套件的启用与顺序**；Enterprise 还能强制 TLS 1.3、自定义 ECDH 曲线。

### 5.3 加密套件与合规要求对照表

| 合规框架 | 最低 TLS 版本 | 强制要求 | 禁用套件 | 推荐套件顺序 |
|---------|-------------|---------|---------|-------------|
| **PCI-DSS v4.0** | TLS 1.2 | 前向保密 + AEAD | 3DES、RC4、CBC、RSA 密钥交换 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 → ECDHE-ECDSA-AES128-GCM-SHA256 |
| **等保 2.0 三级** | TLS 1.2 | 前向保密 | RC4、3DES | ECDHE-ECDSA-AES128-GCM-SHA256 → ECDHE-RSA-AES128-GCM-SHA256 |
| **等保 2.0 四级** | TLS 1.2 | 前向保密 + 256 位 | RC4、3DES、SHA1 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **金融等保四级（JR/T 0171）** | TLS 1.2 | 前向保密 + 国密可选 | RC4、3DES、RSA 密钥交换 | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **关基条例** | TLS 1.2 | 前向保密 + AEAD | RC4、3DES | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **支付行业监管** | TLS 1.2 | 前向保密 | RC4、3DES | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **FIPS 140-2** | TLS 1.2 | 仅 NIST 批准算法 | ChaCha20（部分版本） | ECDHE-ECDSA-AES256-GCM-SHA384 → ECDHE-RSA-AES256-GCM-SHA384 |
| **GDPR（建议）** | TLS 1.2 | 前向保密 | RC4、3DES | 任意 ECDHE + GCM 套件 |

### 5.4 CLI 加密套件管理命令

#### 查看当前加密套件配置

```bash
# 查看当前 Zone 的加密套件设置
cfcli ssl ciphers get --zone nc-demo.cf

# 输出示例:
# {
#   "zone": "nc-demo.cf",
#   "cipher_level": "custom",
#   "tls_1_2_ciphers": [
#     "ECDHE-ECDSA-AES256-GCM-SHA384",
#     "ECDHE-ECDSA-AES128-GCM-SHA256",
#     "ECDHE-RSA-AES256-GCM-SHA384",
#     "ECDHE-RSA-AES128-GCM-SHA256"
#   ],
#   "tls_1_3_enabled": true,
#   "min_tls_version": "1.2",
#   "max_tls_version": "1.3"
# }
```

#### 设置加密套件等级（预设）

```bash
# === 1. Modern 等级（仅 TLS 1.3，最严格） ===
cfcli ssl ciphers set --zone nc-demo.cf --level modern

# === 2. Compatible 等级（TLS 1.2 + 1.3，平衡兼容性） ===
cfcli ssl ciphers set --zone nc-demo.cf --level compatible

# === 3. Legacy 等级（兼容旧浏览器，不推荐生产） ===
cfcli ssl ciphers set --zone nc-demo.cf --level legacy
```

#### 自定义 TLS 1.2 加密套件顺序（需 ACM 或 Ent）

```bash
# === 金融等保四级推荐配置 ===
cfcli ssl ciphers set --zone nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-RSA-AES128-GCM-SHA256,ECDHE-ECDSA-CHACHA20-POLY1305,ECDHE-RSA-CHACHA20-POLY1305"

# === PCI-DSS v4.0 严格配置（禁用所有 CBC 与 RSA 套件） ===
cfcli ssl ciphers set --zone nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"

# === 政企等保三级配置 ===
cfcli ssl ciphers set --zone nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256,ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384"

# === 移动端优化（含 ChaCha20） ===
cfcli ssl ciphers set --zone nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-CHACHA20-POLY1305,ECDHE-RSA-CHACHA20-POLY1305,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"
```

#### 设置 TLS 版本范围

```bash
# === 1. 禁用 TLS 1.0 和 1.1（PCI-DSS 强制要求） ===
cfcli ssl tls-version set --zone nc-demo.cf \
  --min 1.2 \
  --max 1.3

# === 2. Enterprise 专属：强制 TLS 1.3（最高安全性） ===
cfcli ssl tls-version set --zone nc-demo.cf \
  --min 1.3 \
  --max 1.3

# === 3. 查看 TLS 版本设置 ===
cfcli ssl tls-version get --zone nc-demo.cf
```

#### Enterprise 专属：ECDH 曲线自定义

```bash
# === Enterprise 专属：自定义 ECDH 曲线 ===
cfcli ssl ecdh-curve set --zone nc-demo.cf \
  --curves "X25519,P-256,P-384"

# === 查看 ECDH 曲线设置 ===
cfcli ssl ecdh-curve get --zone nc-demo.cf
```

#### HSTS 配置

```bash
# === 启用 HSTS（HTTPS Strict Transport Security） ===
cfcli ssl hsts set --zone nc-demo.cf \
  --max-age 31536000 \
  --include-subdomains true \
  --preload true

# === 查看 HSTS 配置 ===
cfcli ssl hsts get --zone nc-demo.cf
```

### 5.5 加密套件决策流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                  加密套件配置决策流程                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  是否有合规要求？        │
                  └───────────────────────┘
                       │            │
                    是 │            │ 否
                       ▼            ▼
        ┌──────────────────────┐  ┌───────────────────────┐
        │ 是否金融/关基/PCI？    │  │ 是否有旧客户端？        │
        └──────────────────────┘  └───────────────────────┘
              │            │            │            │
           是 │         否 │          是 │          否 │
              ▼            ▼            ▼            ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
    │ Custom 等级  │ │ Custom 等级  │ │ Legacy   │ │ Modern   │
    │ AES-256-GCM │ │ AES-128-GCM  │ │ 兼容旧版  │ │ 仅 TLS1.3│
    │ 强制 PFS     │ │ 强制 PFS     │ │ 60 天宽限 │ │ 最严格    │
    │ min TLS 1.2 │ │ min TLS 1.2  │ │          │ │          │
    └──────────────┘ └──────────────┘ └──────────┘ └──────────┘
          │                │
          ▼                ▼
    ┌──────────────────────────────────────────────────────┐
    │  验证：                                                │
    │  1. 用 SSL Labs 测试等级是否 A+                       │
    │  2. 用 cfcli ssl verify 检查套件生效                   │
    │  3. 监控 Dashboard → Analytics → 是否有 TLS 握手失败    │
    └──────────────────────────────────────────────────────┘
```

### 5.6 行业推荐配置速查

#### 金融行业（等保四级 + PCI-DSS v4.0）

```bash
cfcli ssl ciphers set --zone fin.nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"

cfcli ssl tls-version set --zone fin.nc-demo.cf --min 1.2 --max 1.3
cfcli ssl hsts set --zone fin.nc-demo.cf --max-age 31536000 --include-subdomains true --preload true
```

#### 政企行业（等保三级）

```bash
cfcli ssl ciphers set --zone gov.nc-demo.cf \
  --level compatible

cfcli ssl tls-version set --zone gov.nc-demo.cf --min 1.2 --max 1.3
```

#### 电力公司（关基条例 + IEC 62443）

```bash
cfcli ssl ciphers set --zone power.nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"

cfcli ssl tls-version set --zone power.nc-demo.cf --min 1.2 --max 1.3
```

#### 支付行业（PCI-DSS v4.0）

```bash
cfcli ssl ciphers set --zone pay.nc-demo.cf \
  --level custom \
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256"

cfcli ssl tls-version set --zone pay.nc-demo.cf --min 1.2 --max 1.3
cfcli ssl hsts set --zone pay.nc-demo.cf --max-age 31536000 --include-subdomains true --preload true
```

#### 通用最佳实践（无特殊合规要求）

```bash
cfcli ssl ciphers set --zone nc-demo.cf --level modern
cfcli ssl tls-version set --zone nc-demo.cf --min 1.2 --max 1.3
cfcli ssl hsts set --zone nc-demo.cf --max-age 31536000 --include-subdomains true --preload true
```

### 5.7 加密套件故障排查

| 症状 | 可能原因 | 排查步骤 | 解决方案 |
|------|---------|---------|---------|
| 浏览器报 `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | 客户端不支持所选套件 | 用 SSL Labs 测试客户端能力 | 降级到 Compatible 或追加 CBC 套件 |
| 旧 Android（≤ 7.0）无法访问 | 不支持 TLS 1.3 或 ECDHE | 查 Dashboard → Analytics → TLS 握手失败 | 启用 Legacy 等级或追加 RSA 套件 |
| Java 7 客户端连接失败 | 不支持 ECDHE | 检查客户端日志 | 追加 `AES128-SHA256`（无 PFS） |
| PCI-DSS 扫描不通过 | 启用了 CBC 或 RSA 套件 | 用 `cfcli ssl ciphers get` 检查 | 切换到 Custom，仅保留 GCM + ECDHE |
| 等保四级扫描不通过 | 未启用 256 位套件 | 检查套件顺序 | 首选 `ECDHE-ECDSA-AES256-GCM-SHA384` |
| TLS 握手延迟高 | 套件协商耗时 | 查 Log Explorer `http` 数据集（Beta · Ent · 保留期以合同为准） | 减少套件数量，只保留 4-6 个 |
| SSL Labs 评级低于 A | TLS 1.0/1.1 启用 | 查 `cfcli ssl tls-version get` | `cfcli ssl tls-version set --min 1.2` |
| 0-RTT 重放攻击风险 | 启用了 TLS 1.3 0-RTT | 查 Dashboard → SSL/TLS → Edge Certificates | 禁用 0-RTT 或仅在幂等接口启用 |

### 5.8 验证加密套件配置

#### 使用 cfcli 验证

```bash
# === 1. 查看生效的加密套件 ===
cfcli ssl ciphers get --zone nc-demo.cf

# === 2. 验证 TLS 握手 ===
cfcli ssl verify --zone nc-demo.cf \
  --host "www.nc-demo.cf" \
  --port 443 \
  --verbose

# === 3. 测试特定套件是否支持 ===
cfcli ssl verify --zone nc-demo.cf \
  --host "www.nc-demo.cf" \
  --cipher "ECDHE-ECDSA-AES256-GCM-SHA384"

# === 4. 测试 TLS 版本范围 ===
cfcli ssl verify --zone nc-demo.cf \
  --host "www.nc-demo.cf" \
  --min-tls 1.2 \
  --max-tls 1.3
```

#### 使用 OpenSSL 验证

```bash
# === 测试 TLS 1.3 套件 ===
openssl s_client -connect www.nc-demo.cf:443 -tls1_3 -ciphersuites TLS_AES_256_GCM_SHA384

# === 测试 TLS 1.2 套件 ===
openssl s_client -connect www.nc-demo.cf:443 -tls1_2 -cipher ECDHE-ECDSA-AES256-GCM-SHA384

# === 查看服务器支持的套件列表 ===
nmap --script ssl-enum-ciphers -p 443 www.nc-demo.cf
```

#### 使用 SSL Labs 验证

访问 `https://www.ssllabs.com/ssltest/analyze.html?d=nc-demo.cf`，确认：
- 整体评级 ≥ A
- 加密套件强度 ≥ A
- 前向保密（PFS）= Yes
- TLS 1.0 / 1.1 = Disabled

---

## 6. 不同供应商的证书限制

### Cloudflare 支持的证书颁发机构 (CA)

| CA | 证书类型 | 支持程度 |
|----|---------|---------|
| **Let's Encrypt** | DV | ✅ 完全支持 |
| **Google Trust Services** | DV | ✅ 完全支持 (Total TLS) |
| **SSL.com** | DV, OV, EV | ✅ 完全支持 |
| **DigiCert** | DV, OV, EV | ✅ 完全支持 |
| **GlobalSign** | DV, OV, EV | ✅ 完全支持 |
| **Sectigo (原 Comodo)** | DV, OV, EV | ✅ 完全支持 |
| **自签证书** | 任意 | ⚠️ 需要额外配置 |

### 不同供应商证书的限制

| 限制项 | 说明 |
|--------|------|
| **密钥类型** | RSA (2048/4096 位) 或 ECDSA (P-256/P-384) |
| **证书格式** | PEM 格式 (Base64 编码) |
| **中间证书** | 必须包含完整的证书链 |
| **私钥** | 必须提供对应的私钥 |
| **有效期** | Custom 证书最长 1 年 (部分 CA 可达 2 年) |
| **通配符** | 支持 `*.example.com` (仅覆盖一级子域名) |

### 证书链问题

**常见错误**：上传证书时缺少中间证书

```
正确的证书链：
你的证书 → 中间证书 → 根证书

示例 (Nginx 配置)：
ssl_certificate /path/to/fullchain.pem;  # 包含你的证书 + 中间证书
ssl_certificate_key /path/to/private.key;
```

### 上传不同供应商的证书

```bash
# 上传 Let's Encrypt 证书
cfcli certificate custom upload \
  --certificate "$(cat /etc/letsencrypt/live/example.com/fullchain.pem)" \
  --private-key "$(cat /etc/letsencrypt/live/example.com/privkey.pem)"

# 上传商业证书 (DigiCert, GlobalSign 等)
cfcli certificate custom upload \
  --certificate "$(cat certificate.crt)" \
  --private-key "$(cat private.key)" \
  --bundle-method ubiquitous
```

---

## 7. ACM (高级证书管理器)

### 什么是 ACM？

**Advanced Certificate Manager (ACM)** 是 Cloudflare 的付费功能，提供更灵活的证书管理：

| 功能 | Universal SSL | Advanced Certificate |
|------|--------------|---------------------|
| 子域名覆盖 | 仅一级子域名 | ✅ 多级子域名 |
| 自定义主机名数量 | 无限制 | 单张证书最多 50 个 SAN（zone apex 必含）；Enterprise 每 Zone 最多 100 张 edge certificates |
| 证书颁发机构 | Cloudflare 自动选择 | ✅ 可选择 CA |
| 验证方式 | 自动 DCV | ✅ 多种验证方式 |
| 自定义有效期 | ❌ | ✅ |
| Total TLS | ❌ | ✅ 自动覆盖所有代理主机名（默认有效期 90 天；**不适用于** Load Balancing / Cloudflare Tunnel / Spectrum 的 hostname；需 Full DNS setup） |
| 自定义加密套件 | ❌ | ✅ |
| 价格 | 免费 | 付费附加组件 |

### ACM 使用场景

1. **需要覆盖多级子域名**：如 `api.staging.example.com`
2. **需要自定义证书颁发机构**：指定使用 DigiCert、Let's Encrypt 等
3. **需要 Total TLS**：自动为所有代理主机名签发证书
4. **需要自定义加密套件**：满足合规要求

### 使用 ACM

```bash
# 查看 ACM 配置
cfcli certificate acm config

# 启用 ACM 并设置参数
cfcli certificate acm update \
  --enabled \
  --ca lets_encrypt \
  --hostnames example.com,www.example.com,api.example.com

# 启用 Total TLS (自动覆盖所有代理主机名)
cfcli certificate total-tls enable --ca lets_encrypt

# 创建高级证书 (通过 API)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/ssl/certificate_packs/order" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "advanced",
    "hosts": ["example.com", "*.example.com", "api.staging.example.com"],
    "validation_method": "txt",
    "validity_days": 90,
    "certificate_authority": "lets_encrypt",
    "cloudflare_branding": false
  }'
```

---

## 8. mTLS (双向 TLS 认证)

### 什么是 mTLS？

**mTLS (Mutual TLS)** = 双向 TLS 认证

**普通 TLS**：只有服务器证明自己的身份
**mTLS**：客户端和服务器**互相**证明身份

```
普通 TLS 握手：
客户端 → 请求连接
服务器 → 出示证书
客户端 → 验证服务器证书 ✅
客户端 → 发送加密数据

mTLS 握手：
客户端 → 请求连接
服务器 → 出示证书
客户端 → 验证服务器证书 ✅
服务器 → 请求客户端证书
客户端 → 出示客户端证书
服务器 → 验证客户端证书 ✅
双方 → 发送加密数据
```

### Cloudflare 的 mTLS 方案

Cloudflare 提供两种 mTLS 实现：

| 方案 | 方向 | 用途 |
|------|------|------|
| **Authenticated Origin Pulls** | Cloudflare → 源站 | 验证请求确实来自 Cloudflare |
| **Client Certificates** | 客户端 → Cloudflare | 验证访问者身份 (API Shield) |

### Authenticated Origin Pulls (源站 mTLS)

**作用**：确保只有 Cloudflare 能连接到你的源站，防止绕过 Cloudflare 直接访问。

> **官方文档**：[Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/) · **全 Plan 可用**（Free / Pro / Business / Enterprise）· **Off / Flexible 模式下不生效**

AOP 有三个**独立**的配置级别，可同时启用，优先级从高到低：

| 级别 | 证书来源 | 适用范围 | 安全强度 | 典型场景 |
|------|---------|---------|---------|---------|
| **Per-hostname** | 自上传证书 | 特定 hostname | ★★★★★ | 仅特定接口要求账户级验证 |
| **Zone-level** | 自上传证书 | 全 Zone 所有 proxied 流量 | ★★★★ | 需保证请求来自本账户（非其他 CF 账户） |
| **Global** | Cloudflare 提供的共享证书 | 全 Zone 所有 proxied 流量 | ★★★ | 仅验证请求来自 CF 网络（最简配置） |

> 优先级：Per-hostname > Zone-level > Global。启用/禁用任一级别不影响其他级别。FIPS 合规需使用自上传证书（Zone-level 或 Per-hostname）。

```bash
# 1. 下载 Cloudflare 的 CA 证书（Global AOP）
curl -o authenticated_origin_pulls_ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pulls_ca.pem

# 2. 在 Nginx 源站配置
cat > /etc/nginx/conf.d/origin.conf << 'EOF'
server {
    listen 443 ssl http2;
    server_name origin.example.com;

    # 源站证书
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/private.key;

    # 启用 Authenticated Origin Pulls
    ssl_client_certificate /etc/nginx/cloudflare/authenticated_origin_pulls_ca.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location / {
        proxy_pass http://backend;
    }
}
EOF

# 3. 在 Cloudflare Dashboard 启用 Authenticated Origin Pulls
# SSL/TLS → Origin Server → Authenticated Origin Pulls → Enable
```

### Client Certificates (客户端 mTLS)

**作用**：验证访问你 API 的客户端身份。

```bash
# 1. 创建客户端证书 (通过 Cloudflare Dashboard 或 API)
# SSL/TLS → Client Certificates → Create Certificate

# 2. 为 API 启用 mTLS 规则 (API Shield)
# API Shield → Create mTLS Rule

# 3. 客户端使用证书访问
curl --cert client.crt --key client.key https://api.example.com/data
```

### mTLS 配置级别

| 级别 | 说明 | 优先级 |
|------|------|--------|
| **Global** | 使用 Cloudflare 共享 CA，最简单 | 最低 |
| **Zone** | 使用你上传的证书，整个 zone 生效 | 中 |
| **Per-hostname** | 针对特定主机名 | 最高 |

---

## 9. 限制来源到 Origin Server 的方法

### 方法对比

| 方法 | 安全性 | 复杂度 | 说明 |
|------|--------|--------|------|
| **Authenticated Origin Pulls** | ⭐⭐⭐⭐⭐ | 中 | 验证请求来自 Cloudflare 网络 |
| **IP 白名单** | ⭐⭐⭐ | 低 | 仅允许 Cloudflare IP 访问 |
| **防火墙规则** | ⭐⭐⭐ | 低 | 在网络层限制 |
| **防火墙规则 (WAF)** | ⭐⭐⭐⭐ | 中 | 在 Cloudflare 边缘过滤 |
| **API Shield mTLS** | ⭐⭐⭐⭐⭐ | 高 | 客户端证书验证 |
| **Cloudflare Tunnel** | ⭐⭐⭐⭐⭐ | 中 | 无需暴露源站 IP |

### 方法 1：Authenticated Origin Pulls (推荐)

```bash
# 启用 Authenticated Origin Pulls
# 源站将拒绝所有非 Cloudflare 的请求

# Nginx 配置示例
ssl_client_certificate /path/to/authenticated_origin_pulls_ca.pem;
ssl_verify_client on;
```

### 方法 2：IP 白名单

```bash
# Cloudflare IP 列表
# https://www.cloudflare.com/ips/

# Nginx 配置示例
allow 173.245.48.0/20;
allow 103.21.244.0/22;
allow 103.22.200.0/22;
allow 103.31.4.0/22;
allow 141.101.64.0/18;
allow 108.162.192.0/18;
allow 190.93.240.0/20;
allow 188.114.96.0/20;
allow 197.234.240.0/22;
allow 198.41.128.0/17;
allow 162.158.0.0/15;
allow 104.16.0.0/13;
allow 104.24.0.0/14;
allow 172.64.0.0/13;
allow 131.0.72.0/22;
deny all;
```

### 方法 3：使用 CLI 管理 IP Lists

```bash
# 创建 IP 列表
cfcli ip-lists create --name "Cloudflare IPs" --kind allow

# 添加 Cloudflare IP
cfcli ip-lists items add --list-id <list_id> --items 173.245.48.0/20,103.21.244.0/22,...

# 在 WAF 规则中使用 IP 列表
cfcli waf rules create --description "Allow Cloudflare IPs" --action allow --filter "ip.src in $Cloudflare_IPs"
```

### 方法 4：Cloudflare Tunnel (最安全)

```bash
# 使用 Cloudflare Tunnel，源站完全不需要暴露公网 IP
# 通过 cloudflared 建立出站连接

# 安装 cloudflared
# 登录
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create my-tunnel

# 配置隧道
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: my-tunnel
credentials-file: /home/user/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: app.example.com
    service: http://localhost:8080
  - service: http_status:404
EOF

# 运行隧道
cloudflared tunnel run my-tunnel
```

### 推荐组合

**最佳实践**：同时使用多种方法

```
┌─────────────────────────────────────────────────────────────┐
│                        安全层级                              │
├─────────────────────────────────────────────────────────────┤
│  1. Cloudflare Tunnel (源站不暴露公网 IP)                    │
│     ↓                                                       │
│  2. Authenticated Origin Pulls (验证 Cloudflare 身份)        │
│     ↓                                                       │
│  3. IP 白名单 (仅允许 Cloudflare IP)                        │
│     ↓                                                       │
│  4. WAF 规则 (过滤恶意请求)                                 │
│     ↓                                                       │
│  5. API Shield mTLS (验证客户端身份，如需要)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 9.7 SSL/TLS 四种模式场景化对比（v1.2 新增）

> **官方更新（2026）**：Cloudflare 正在推出 **Automatic SSL/TLS**（默认模式），由 SSL/TLS Recommender 自动探测源站证书能力并选择最安全的加密模式。未迁移的 Zone 仍使用 **Custom SSL/TLS**（即下文四种手动模式）。参考：[Encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)

### 9.7.1 四种模式全景图

Cloudflare 的 SSL/TLS 模式决定了两段连接的加密与验证方式：

```
                  访客 ─────► Cloudflare Edge ─────► Origin
                       (连接1)                    (连接2)

┌────────────┬───────────────┬──────────────────┬────────────────────────┐
│   模式      │  连接1 访客侧  │  连接2 源站侧     │  源站证书要求            │
├────────────┼───────────────┼──────────────────┼────────────────────────┤
│  Off       │ HTTP（明文）   │ HTTP（明文）      │  无                     │
│  Flexible  │ HTTPS         │ HTTP（明文）⚠️    │  无                     │
│  Full      │ HTTPS         │ HTTPS（不验证）    │  任意证书（含自签）      │
│  Full(Str) │ HTTPS         │ HTTPS（验证）✅    │  公网证书/Origin CA     │
└────────────┴───────────────┴──────────────────┴────────────────────────┘
  安全等级：  Off  <  Flexible  <  Full  <  Full (Strict)
  合规要求：  前三者均不满足等保/PCI，仅 Full (Strict) 合规
```

### 9.7.2 四种模式详细对比

| 维度 | Off | Flexible | Full | Full (Strict) |
|------|-----|----------|------|---------------|
| 连接1（访客→Edge） | HTTP | HTTPS | HTTPS | HTTPS |
| 连接2（Edge→Origin） | HTTP | HTTP | HTTPS | HTTPS |
| 源站证书验证 | - | - | ❌ | ✅（证书链+有效期+域名） |
| 端到端 MITM 防护 | ❌ | ⚠️ 仅访客侧 | ⚠️ 有理论风险 | ✅ |
| 源站 443 要求 | ❌ | ❌ | ✅ | ✅ |
| 源站证书类型 | 无 | 无 | 自签/过期/无效均可 | 公网证书 / Origin CA |
| PCI-DSS v4.0 | ❌ 违规 | ❌ 违规 | ❌ 违规 | ✅ 合规 |
| 等保 2.0 三级 | ❌ 违规 | ❌ 违规 | ⚠️ 有风险 | ✅ 合规 |
| 等保 2.0 四级/金融 | ❌ 违规 | ❌ 违规 | ❌ 违规 | ✅ 合规 |
| 生产推荐度 | ❌ | ⚠️ 仅过渡 | ⚠️ 短期 | ✅ 推荐 |
| 与 AOP 兼容 | ❌ | ❌ | ✅（意义有限） | ✅ 最佳组合 |

### 9.7.3 每种模式适用/禁止场景

| 模式 | ✓ 适用场景 | ✗ 禁止场景 |
|------|-----------|-----------|
| **Off** | 本地开发/测试；纯公开静态内容；+Cloudflare Tunnel时 | 任何生产环境；任何登录/支付/PII 场景；任何合规行业 |
| **Flexible** | 源站无法部署 HTTPS（技术债）；HTTPS 迁移第一步；≤60 天过渡；开发环境快速启用 HTTPS | 任何合规行业；源站在公有云外；登录/支付/订单接口；任何 PII 场景 |
| **Full** | 源站用自签证书；源站证书即将过期（应急）；迁到 Strict 的中间步骤；测试环境快速部署 | 金融/支付/关基等严格行业；源站经不可信网络；任何要求端点验证的合规框架 |
| **Full (Strict)** | **所有生产环境**；合规行业；登录/支付/订单等敏感接口；+AOP 双向认证；+Origin CA 证书（最优成本） | 无 |

### 9.7.4 渐进式迁移策略（Flexible → Full → Full Strict）

```
阶段0 (现状)：    Flexible / Off        评估当前状态
阶段1 (1-2周)：   Full                  部署 Origin CA 证书 + 切 Full
阶段2 (2-4周)：   Full Strict           灰度 Page Rule → 观察 525 → 全站
阶段3 (持续)：    Full Strict + AOP     启用 Authenticated Origin Pulls 双向认证
```

**关键步骤（cfcli）**：

```bash
# === 阶段0：现状评估 ===
cfcli ssl get-mode --zone nc-demo.cf
cfcli origin check --zone nc-demo.cf --host origin.nc-demo.cf --port 443

# === 阶段1：Flexible → Full ===
cfcli certificate origin-create --zone nc-demo.cf --hostnames "nc-demo.cf,*.nc-demo.cf" --validity 5475
cfcli ssl set-mode --zone nc-demo.cf --mode full

# === 阶段2：Full → Full Strict（灰度7天）===
cfcli page-rule create --zone nc-demo.cf --pattern "test.nc-demo.cf/*" --ssl-mode full-strict --priority 1
# 7天后验证无 525，执行：
cfcli ssl set-mode --zone nc-demo.cf --mode full-strict

# === 阶段3：启用双向认证（AOP）===
cfcli ssl aop enable --zone nc-demo.cf
```

### 9.7.5 常见陷阱

| 陷阱 | 说明 |
|------|------|
| 误认为 Flexible 安全 | 只保护访客侧，Cloudflare→源站仍是明文 |
| Full+自签就"很安全" | 不验证=中间人可伪造源站证书 |
| Origin CA 证书链错了 | 没把根证书放进 fullchain → 切 Strict 后 525 错误 |
| 证书过期仍用 Strict | 全站 525，业务中断（建议 ACM 自动续期） |
| 切完 Strict 没监控 525 | 应配 Log Explorer / Logpush 525 错误率告警 |

### 9.7.6 行业推荐模式

| 行业 | 推荐模式 | 组合建议 |
|------|---------|---------|
| 金融 | Full (Strict) | + AOP + mTLS |
| 政企 | Full (Strict) | + AOP + Data Localization Suite |
| 电力/关基 | Full (Strict) | + AOP + Spectrum |
| 支付 | Full (Strict) | + AOP + API Shield mTLS |
| 通用企业 | Full (Strict) | + ACM 自动续期 |
| 内网源站 + Tunnel | Off | Tunnel 自带加密 |

---

## 10. 常见问题 FAQ

### Q1: Universal SSL 和 Total TLS 有什么区别？

| 特性 | Universal SSL | Total TLS |
|------|-------------|-----------|
| 覆盖范围 | 根域名 + 一级子域名 | **所有代理主机名** |
| 适用场景 | 完整 DNS 设置 | 完整 DNS 设置 |
| 免费 | ✅ | ✅ (需要 ACM) |
| 自动更新 | ✅ | ✅ |
| 多级子域名 | ❌ | ✅ |

### Q2: 证书更新会影响网站访问吗？

**不会**。Cloudflare 的证书更新是无缝的：
1. 新证书先部署到所有节点
2. 旧证书保留短暂时间确保兼容
3. 整个过程用户无感知

### Q3: 可以使用自己的证书吗？

**可以**。使用 Custom Certificates：
- 支持 OV、EV 证书
- 支持通配符证书
- 需要手动上传和更新
- 不需要时可以自动更新（使用 ACM 或 Total TLS）

### Q4: mTLS 和 Authenticated Origin Pulls 有什么区别？

| 特性 | Authenticated Origin Pulls | API Shield mTLS |
|------|-------------------------|-----------------|
| 方向 | Cloudflare → 源站 | 客户端 → Cloudflare |
| 目的 | 验证请求来自 Cloudflare | 验证客户端身份 |
| 适用场景 | 保护源站 | 保护 API |
| 配置位置 | 源服务器 | Cloudflare Dashboard |

### Q5: 如何检查 SSL 配置是否正确？

```bash
# 检查证书状态
cfcli certificate universal get
cfcli certificate verification get

# 检查 SSL 模式
cfcli ssl settings

# 使用在线工具检查
# https://www.ssllabs.com/ssltest/
```

### Q6: 加密套件设置错误会导致什么问题？

- **太严格**：部分用户无法访问（旧浏览器不支持）
- **太宽松**：安全评分低，可能不符合合规要求
- **与证书不匹配**：TLS 握手失败，网站无法访问

### Q7: 不同供应商的证书有限制吗？

主要限制：
- 必须是 PEM 格式
- 必须包含完整证书链
- RSA 密钥至少 2048 位
- ECDSA 至少 P-256 曲线
- 有效期通常 1 年

---

## 11. 故障排查指南

### 问题：证书未自动更新

**可能原因**：
1. DNS 记录未正确指向 Cloudflare
2. DCV (域名控制验证) 未完成
3. CAA 记录阻止了 CA
4. 域名被暂停或未激活

**排查步骤**：
```bash
# 1. 检查域名状态
cfcli zone get

# 2. 检查 DNS 记录
cfcli dns list

# 3. 检查证书状态
cfcli certificate verification get

# 4. 检查 Universal SSL 状态
cfcli certificate universal get
```

### 问题：NET::ERR_CERT_AUTHORITY_INVALID

**原因**：证书链不完整或使用了不受信任的 CA

**解决方案**：
1. 确保上传完整证书链（证书 + 中间证书）
2. 如果使用 Origin CA，设置 SSL 模式为 Full (strict)
3. 检查证书是否过期

### 问题：TLS 握手失败

**排查**：
```bash
# 测试 TLS 连接
openssl s_client -connect example.com:443 -servername example.com

# 检查支持的加密套件
nmap --script ssl-enum-ciphers -p 443 example.com
```

### 问题：混合内容警告

**原因**：页面通过 HTTPS 加载，但包含 HTTP 资源

**解决方案**：
1. 将所有资源 URL 改为 HTTPS
2. 使用 Content-Security-Policy 头
3. 使用 Automatic HTTPS Rewrites

---

## 附录：CLI 命令速查表

```bash
# === 边缘证书 ===
cfcli certificate universal get          # 查看 Universal SSL 状态
cfcli certificate universal enable        # 启用 Universal SSL
cfcli certificate universal disable       # 禁用 Universal SSL

cfcli certificate total-tls get           # 查看 Total TLS 状态
cfcli certificate total-tls enable        # 启用 Total TLS
cfcli certificate total-tls disable       # 禁用 Total TLS

cfcli certificate acm config             # 查看 ACM 配置
cfcli certificate acm update             # 更新 ACM 配置

# === 自定义证书 ===
cfcli certificate custom list            # 列出所有自定义证书
cfcli certificate custom get --id <id>    # 查看证书详情
cfcli certificate custom upload           # 上传证书
cfcli certificate custom update           # 更新证书
cfcli certificate custom delete           # 删除证书

# === 源站证书 ===
cfcli ssl settings                     # 查看 SSL 模式
cfcli ssl set --mode full-strict       # 设置 SSL 模式

# === Keyless SSL ===
cfcli certificate keyless list           # 列出 Keyless 证书
cfcli certificate keyless create        # 创建 Keyless 证书

# === 自定义主机名 ===
cfcli certificate hostnames list         # 列出自定义主机名
cfcli certificate hostnames create      # 创建自定义主机名

# === IP 限制 ===
cfcli ip-lists list                    # 列出 IP 列表
cfcli ip-lists create                 # 创建 IP 列表
cfcli ip-lists items add              # 添加 IP 到列表

# === 加密套件（v1.2 新增） ===
cfcli ssl ciphers get --zone <zone>                       # 查看当前加密套件配置
cfcli ssl ciphers set --zone <zone> --level modern        # 设置 Modern 等级（仅 TLS 1.3）
cfcli ssl ciphers set --zone <zone> --level compatible    # 设置 Compatible 等级（TLS 1.2 + 1.3）
cfcli ssl ciphers set --zone <zone> --level legacy        # 设置 Legacy 等级（兼容旧浏览器）
cfcli ssl ciphers set --zone <zone> --level custom \      # 自定义 TLS 1.2 套件顺序（需 ACM 或 Ent）
  --ciphers "ECDHE-ECDSA-AES256-GCM-SHA384,..."

cfcli ssl tls-version get --zone <zone>                   # 查看 TLS 版本范围
cfcli ssl tls-version set --zone <zone> --min 1.2 --max 1.3  # 禁用 TLS 1.0/1.1
cfcli ssl tls-version set --zone <zone> --min 1.3 --max 1.3  # 强制 TLS 1.3（Ent 专属）

cfcli ssl ecdh-curve get --zone <zone>                    # 查看 ECDH 曲线（Ent）
cfcli ssl ecdh-curve set --zone <zone> --curves "X25519,P-256,P-384"  # 自定义 ECDH 曲线（Ent）

cfcli ssl hsts get --zone <zone>                          # 查看 HSTS 配置
cfcli ssl hsts set --zone <zone> --max-age 31536000 \     # 启用 HSTS 1 年
  --include-subdomains true --preload true

cfcli ssl verify --zone <zone> --host <host> --verbose    # 验证 TLS 握手
cfcli ssl verify --zone <zone> --host <host> --cipher <c> # 测试特定套件
```

---

> **文档版本**: v1.3  
> **最后更新**: 2026-08-17  
> **适用 CLI 版本**: cfcli v1.0.0  
> **变更说明**: v1.3 联网官方文档核对修正（Total TLS 限制 / ACM 配额 / AOP 三级别 + 全 Plan / Log Explorer Beta / Automatic SSL/TLS）；v1.2 在第 5 章大幅扩展加密套件自定义内容，新增 5.1–5.8 八个小节；所有 Cloudflare 功能名采用 Enterprise Plan 官方术语
