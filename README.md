# Kato v1.0.0

自研代理管理系统 monorepo：控制面与数据面分离，多用户 **AnyTLS 单端口** + Realm 中转。

> 版本：**v1.0.0**（第一个大版本）

## 特性

- 五类服务器角色一键安装/升级：backend-core、admin-ui、subscription-edge、proxy-node、transit-relay。
- **AnyTLS 单端口多用户**：每个入站一个端口服务所有用户，不再按用户分配端口。
- 按用户限速：`auth_user` + bandwidth-limiter，单端口下互不影响。
- 按用户流量统计：sing-box V2Ray API（需 `with_v2ray_api` 编译标签）。
- 超额策略：权限组可配置“断流”或“限速 1Mbps”。
- 订阅体系：sing-box / Clash / URI 自动识别，缓存/限速/故障兜底，订阅链接+二维码，一键重置令牌。
- 主动健康探测、告警、审计、今日流量监测。
- Let's Encrypt + Cloudflare DNS-01 自动证书，AnyTLS 随机二级域名一键签发。

## 目录结构

```text
apps/
├── backend-core/       # 面板后端控制面（Node HTTP + JSON 存储）
├── admin-ui/           # 管理前端（React + Vite，隐藏路径部署）
├── agent/              # 节点 Agent（proxy-node / transit-relay / 订阅入口共用）
├── subscription-edge/  # 订阅入口服务
├── frontend-local/     # 前端本地管理服务（隐藏路径迁移等）
└── frontend-edge/      # 前端入口占位
packages/shared/        # 共享协议常量与工具
configs/                # 示例配置
docs/                   # 架构、问题与解决方案、API 协议
scripts/                # 运维 CLI（panelctl、前端备份迁移）
install.sh              # 一键安装/升级脚本
```

## 文档

- [架构与技术点](docs/architecture.md)
- [问题与解决方案](docs/problems-and-solutions.md)
- [一键脚本使用说明](docs/scripts-usage.md)
- [Agent 协议](docs/api/agent-protocol.md)
- [OpenAPI 概览](docs/api/openapi.yaml)
- 完整安装/使用/运维 Wiki 本地保留（不随仓库上传）。

## 本地开发

```bash
npm install
npm test                 # 全量测试
npm run dev:backend      # 启动后端
npm run dev:admin        # 启动前端开发服务器
```

构建前端生产包：

```bash
npm run build:admin
```

## 一键安装

```bash
sudo ./install.sh
```

新手直接运行，脚本会用中文向导询问角色和参数。也可以指定角色：

```bash
sudo ./install.sh --role backend-core
sudo ./install.sh --role admin-ui --backend-url http://<backend-ip>:8080 --frontend-token <front-token>
sudo ./install.sh --role proxy-node --backend-url http://<backend-ip>:8080 --bootstrap-token <boot-token>
sudo ./install.sh --role transit-relay --backend-url http://<backend-ip>:8080 --bootstrap-token <boot-token>
sudo ./install.sh --role subscription-edge --backend-url http://<backend-ip>:8080 --bootstrap-token <boot-token>
```

推荐安装顺序：`backend-core` → `admin-ui` → `subscription-edge` → `proxy-node` → `transit-relay`。

### proxy-node 重要说明（v1.0.0）

按用户流量统计依赖带 `with_v2ray_api` 的 sing-box 编译版本，官方 Release 默认不带。安装代理节点时用：

```bash
sudo KATO_SINGBOX_BINARY_URL="https://你的下载地址/sing-box-extended-...-with-v2ray-api" \
  ./install.sh --role proxy-node \
  --backend-url http://<backend-ip>:8080 \
  --bootstrap-token <boot-token>
```

或使用等价参数 `--singbox-url <url>`。

### HTTPS / 证书

```bash
sudo ./install.sh --role admin-ui \
  --backend-url https://api.example.com \
  --frontend-token <front-token> \
  --tls-mode letsencrypt \
  --domain panel.example.com \
  --acme-email admin@example.com \
  --cloudflare-api-token <cloudflare-token>
```

证书使用 Cloudflare DNS-01 验证（不依赖 80 端口），Certbot 自动续期并重载 Nginx。

### 低配服务器

- 脚本在 RAM 不足且 swap 不足时自动创建 `/swapfile-kato`。
- 远程安装建议先 `tmux new -s kato-install` 再运行，SSH 断开后可 `tmux attach -t kato-install` 回到现场。

## 主要路径

- `/opt/kato/src`：应用源码。
- `/etc/kato`：服务配置和 token。
- `/var/lib/kato`：后端数据库、Agent 状态、runtime 配置。
- `/var/log/kato`：运行日志。
- `/var/backups/kato`：升级前自动备份。

## 运维 CLI

```bash
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js summary
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js list proxy-nodes
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create-bootstrap-token --role proxy-node --resourceId <proxy-node-id> --name hk-01
```

前端面板备份/迁移/还原：

```bash
scripts/admin-ui-backup.sh
scripts/admin-ui-restore.sh
```

## 测试

```bash
npm test
```

覆盖：后端资源 CRUD、desired-state 编译、订阅生成、健康探测、流量上报、单端口多用户渲染、V2Ray API gRPC 客户端、Agent 注册/离线重放等。

## License

见 [LICENSE](LICENSE)。
