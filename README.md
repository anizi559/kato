# Kato Control Plane

自研代理管理系统 monorepo。

当前版本：`0.3.3`

已完成阶段：

- 第一阶段：Backend Core 最小 API、Agent 注册/心跳/desired-state、last known good config、项目骨架。
- 第二阶段：核心资源模型、管理 API、Proxy/Relay desired-state 编译、中转访问节点与 Relay Rule 联动。
- 第三阶段：Agent 运行配置渲染、Xray/Hysteria2/Realm 配置落盘、备份、离线重放、Xray 配置 test 校验、托管进程启动/停止/状态检查。

当前目录：

- `apps/backend-core`：核心控制面。
- `apps/agent`：Proxy Node / Transit Relay 共用轻量 Agent 骨架。
- `apps/frontend-edge`：前端入口占位。
- `apps/subscription-edge`：订阅入口占位。
- `packages/shared`：共享协议常量和工具。
- `configs`：示例配置。
- `docs`：协议和阶段说明。
- `scripts`：本地运维 CLI。

本地验证：

```bash
npm test
```

一键安装：

```bash
sudo ./install.sh
```

新手建议直接运行上面的命令，脚本会用中文向导一步一步询问：

- 要安装哪种服务器角色。
- 是否切换 apt 镜像源。
- 源码从默认仓库克隆，还是使用自定义仓库/本地源码目录。
- 后端监听端口、初始化管理员账号密码、前端配对 token、隐藏后台路径、节点 bootstrap token 等关键参数。

也可以直接指定角色，适合服务器重装后的首次部署或后续升级：

```bash
sudo ./install.sh --role backend-core
sudo ./install.sh --role admin-ui --backend-url http://<backend-ip>:8080 --frontend-token <front-token>
sudo ./install.sh --role proxy-node --backend-url http://<backend-ip>:8080 --bootstrap-token <boot-token>
sudo ./install.sh --role transit-relay --backend-url http://<backend-ip>:8080 --bootstrap-token <boot-token>
```

推荐安装顺序：

1. 先安装 `backend-core`。安装脚本会自动创建空数据库、引导创建管理员账号密码，并输出“前端配对 token”。
2. 再安装 `admin-ui`。根路径会是一个轻量工具站，管理后台会放在隐藏路径，例如 `/admin-06161230/`；脚本会把 `/api/` 反向代理到后端并自动附带前端配对 token。
3. 打开前端管理后台，用后端安装时创建的管理员账号密码登录。

安装器会自动补齐 Debian/Ubuntu 上的基础工具、Node.js 22、systemd 服务、配置目录和运行目录。网络不稳定时可以显式切换 apt 镜像：

```bash
sudo ./install.sh --role backend-core --apt-mirror tuna
```

主要安装路径：

- `/opt/kato/src`：应用源码。
- `/etc/kato`：服务配置和 token。
- `/var/lib/kato`：后端数据库、agent 状态和 runtime 配置。
- `/var/log/kato`：运行日志。

配置文件说明：

- `/etc/kato/backend-core.json`：面板后端配置，安装脚本会自动写入中文 `_说明` 字段。
- `/etc/kato/backend-core.env`：面板后端环境变量，里面包含维护 API 密钥，请勿泄露。
- `/etc/kato/frontend-pairing-token.txt`：后端生成的前端配对 token，用于前端服务器反向代理后端。
- `/etc/kato/agent.json`：节点 Agent 配置，安装脚本会自动写入中文 `_说明` 字段。
- `/etc/kato/agent.env`：节点 Agent 环境变量。
- `configs/*.example.json`：仓库里的示例配置，可复制后改成自己的本地配置。

测试环境工具安装：

```bash
scripts/setup-test-env.sh --mirror tuna --proxy http://127.0.0.1:7897
```

已覆盖的第三阶段本地工具：

- Xray
- Hysteria2
- sing-box
- gost
- Realm
- Go / Rust
- socat / iperf3
- shellcheck
- GitHub CLI

启动 Backend Core：

```bash
BACKEND_ADMIN_TOKEN=<admin-token> npm run dev:backend
```

启动 Admin UI：

```bash
npm run dev:admin
```

写入一套可重复执行的 demo 数据：

```bash
BACKEND_ADMIN_TOKEN=<admin-token> npm run seed:demo
```

前端连接后端：

1. 打开 `http://127.0.0.1:5173/`。
2. 进入“系统设置 / Backend API”。
3. 填写 `API Base URL`，默认 `http://127.0.0.1:8080`。
4. 填写启动后端时使用的 `BACKEND_ADMIN_TOKEN`，点击“保存并连接”。

如果前端和后端部署在不同域名，通过 `BACKEND_ADMIN_CORS_ORIGINS` 设置允许访问的前端源：

```bash
BACKEND_ADMIN_CORS_ORIGINS=https://panel.example.com BACKEND_ADMIN_TOKEN=<admin-token> npm run dev:backend
```

创建 bootstrap token：

```bash
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create-bootstrap-token --role proxy-node --resourceId <proxy-node-id> --name test-node
```

Agent 单次同步：

```bash
AGENT_CONFIG=configs/agent.local.json npm run dev:agent
```

Agent 托管进程命令：

```bash
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js start
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js status
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js ports
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js restart
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js stop
```

资源管理示例：

```bash
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js summary
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js list proxy-nodes
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create users --json '{"name":"alice"}'
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create-relay-access-node --json '{"inboundId":"...","transitRelayId":"...","entryPort":8443}'
```
