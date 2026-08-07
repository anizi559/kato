# 一键脚本使用说明

本文档覆盖仓库内所有可执行脚本的用途与用法：

- `install.sh`：全角色一键安装 / 升级。
- `scripts/admin-ui-backup.sh`：面板前端一键备份。
- `scripts/admin-ui-restore.sh`：面板前端备份还原 / 迁移恢复。
- `scripts/panelctl.js`：面板后端运维 CLI。

## 1. install.sh — 全角色一键安装 / 升级

### 1.1 基本用法

```bash
sudo ./install.sh
```

不带参数时进入中文交互向导：选择操作（安装/升级）、角色、apt 镜像、角色参数。

推荐安装顺序：`backend-core` → `admin-ui` → `subscription-edge` → `proxy-node` → `transit-relay`。

### 1.2 角色安装命令

```bash
# 面板后端
sudo ./install.sh --role backend-core

# 面板前端（需要后端输出的前端配对 token）
sudo ./install.sh --role admin-ui \
  --backend-url http://<后端IP>:8080 \
  --frontend-token <front-token>

# 订阅入口（先在面板“服务器管理 → 订阅服务器”生成安装 token）
sudo ./install.sh --role subscription-edge \
  --backend-url http://<后端IP>:8080 \
  --bootstrap-token <boot-token> \
  --subscription-path-prefix go

# 代理节点（先在面板创建代理服务器并生成安装 token）
sudo ./install.sh --role proxy-node \
  --backend-url http://<后端IP>:8080 \
  --bootstrap-token <boot-token> \
  --agent-name hk-01

# 中转服务器
sudo ./install.sh --role transit-relay \
  --backend-url http://<后端IP>:8080 \
  --bootstrap-token <boot-token> \
  --agent-name relay-hk-01
```

### 1.3 代理节点特殊参数（v1.0.0 必须）

按用户流量统计依赖带 `with_v2ray_api` 的 sing-box 编译版本，官方 Release 默认不带。安装 proxy-node 时二选一：

```bash
# 方式一：环境变量
sudo KATO_SINGBOX_BINARY_URL="https://你的下载地址/sing-box-...-with-v2ray-api" \
  ./install.sh --role proxy-node \
  --backend-url http://<后端IP>:8080 \
  --bootstrap-token <boot-token>

# 方式二：命令行参数
sudo ./install.sh --role proxy-node \
  --singbox-url "https://你的下载地址/sing-box-...-with-v2ray-api" \
  --backend-url http://<后端IP>:8080 \
  --bootstrap-token <boot-token>
```

也可以手动替换节点上的 `/usr/local/bin/sing-box`。

### 1.4 HTTPS / 证书

所有角色支持：

```bash
--tls-mode letsencrypt --domain <域名> --acme-email <邮箱> --cloudflare-api-token <Token>
```

示例：

```bash
sudo ./install.sh --role admin-ui \
  --backend-url https://api.example.com \
  --frontend-token <front-token> \
  --tls-mode letsencrypt \
  --domain panel.example.com \
  --acme-email admin@example.com \
  --cloudflare-api-token <cloudflare-token>
```

Cloudflare Token 最小权限：目标 Zone 的 `Zone:Read` + `DNS:Edit`。证书使用 DNS-01 验证，自动续期。

### 1.5 常用参数速查

| 参数 | 说明 |
| --- | --- |
| `--role <role>` | 角色：backend-core / admin-ui / subscription-edge / proxy-node / transit-relay |
| `--action <install\|upgrade>` | 操作类型；`--upgrade` 等价于 `--action upgrade` |
| `--source-dir <path>` | 使用本机已有源码目录 |
| `--repo-url <url>` | 拉取源码的 Git 仓库地址 |
| `--install-root <path>` | 安装目录，默认 `/opt/kato` |
| `--apt-mirror <none\|tuna\|ustc\|aliyun>` | apt 镜像源 |
| `--skip-deps` | 跳过系统依赖与 Node.js 安装 |
| `--skip-runtime-binaries` | 不安装 sing-box / Realm |
| `--force-runtime-binaries` | 强制重新下载 sing-box / Realm |
| `--non-interactive` | 非交互模式，缺少必要参数直接失败 |
| `--singbox-url <url>` | 自定义 sing-box 二进制下载地址 |
| `--admin-token <token>` | 后端管理员 API 密钥 |
| `--admin-username / --admin-password` | 初始化管理员账号密码 |
| `--frontend-token <token>` | 前端配对 token |
| `--admin-path <path>` | 管理后台隐藏路径 |
| `--bootstrap-token <token>` | 节点首次注册 token |
| `--agent-name <name>` | Agent 显示名称 |
| `--subscription-path-prefix <prefix>` | 订阅路径前缀，默认 `go` |

### 1.6 升级

```bash
sudo ./install.sh --upgrade --role backend-core
sudo ./install.sh --upgrade --role admin-ui
sudo ./install.sh --upgrade --role subscription-edge
sudo ./install.sh --upgrade --role proxy-node --singbox-url <url>
sudo ./install.sh --upgrade --role transit-relay
```

升级前自动备份 `/etc/kato` 与 `/var/lib/kato` 到 `/var/backups/kato`。

### 1.7 低配服务器 / 远程安装建议

- 脚本在 RAM 不足且 swap 不足时自动创建 `/swapfile-kato`。
- 远程安装建议先进入 tmux：

```bash
apt update && apt install -y tmux
tmux new -s kato-install
sudo ./install.sh
```

SSH 断开后 `tmux attach -t kato-install` 回到现场。

## 2. scripts/admin-ui-backup.sh — 前端一键备份

在旧/当前前端面板服务器上以 root 执行：

```bash
cd /opt/kato/src
sudo ./scripts/admin-ui-backup.sh
```

输出：

- `/var/backups/kato-admin-ui-backup-<时间>.tar.gz`
- 同目录 `.sha256` 校验文件

备份内容：`/etc/kato` 前端相关配置、Nginx 站点配置、Let's Encrypt 证书、`/var/www/kato-panel-frontend` 静态文件。

可用环境变量 `BACKUP_DIR` 修改输出目录：

```bash
sudo BACKUP_DIR=/root/backups ./scripts/admin-ui-backup.sh
```

## 3. scripts/admin-ui-restore.sh — 前端还原 / 迁移

先在新服务器完成基础安装：

```bash
sudo ./install.sh --role admin-ui \
  --backend-url <后端地址> \
  --frontend-token <前端Token>
```

然后还原备份：

```bash
cd /opt/kato/src
sudo ./scripts/admin-ui-restore.sh /var/backups/kato-admin-ui-backup-<时间>.tar.gz
```

脚本会：

1. 检查基础安装是否齐全。
2. 校验 `.sha256`（存在时）。
3. 还原配置、证书、Nginx 配置与面板静态文件。
4. 重载 Nginx 与前端本地管理服务。

原服务器回滚同样适用：先备份当前状态，再还原目标备份。

## 4. scripts/panelctl.js — 后端运维 CLI

需要环境变量：

```bash
export BACKEND_URL=http://127.0.0.1:8080
export BACKEND_ADMIN_TOKEN=<admin-token>
```

常用命令：

```bash
node scripts/panelctl.js health
node scripts/panelctl.js version
node scripts/panelctl.js summary
node scripts/panelctl.js agents
node scripts/panelctl.js list users
node scripts/panelctl.js get proxy-nodes <id>
node scripts/panelctl.js create users --json '{"name":"alice"}'
node scripts/panelctl.js patch access-nodes <id> --json '{"enabled":false}'
node scripts/panelctl.js delete access-nodes <id>
node scripts/panelctl.js create-relay-access-node --json '{"inboundId":"...","transitRelayId":"...","entryPort":8443}'
node scripts/panelctl.js create-bootstrap-token --role proxy-node --resourceId <proxy-node-id> --name hk-01
```

完整命令列表运行 `node scripts/panelctl.js --help`。
