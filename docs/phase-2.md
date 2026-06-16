# Phase 2 Scope

第二阶段完成标准：

- Backend Core 支持核心资源模型：
  - `Plan`
  - `User`
  - `Proxy Node`
  - `Node Inbound`
  - `Transit Relay`
  - `Access Node`
  - `Relay Rule`
- 管理 API 支持资源创建、查询、修改、删除。
- 创建 `Node Inbound` 时默认自动创建直连 `Access Node`。
- 创建中转 `Access Node` 时自动创建并绑定 `Relay Rule`。
- 禁用中转 `Access Node` 时同步禁用对应 `Relay Rule`。
- bootstrap token 支持绑定 `Proxy Node` 或 `Transit Relay` 资源。
- Agent 注册后会自动绑定到对应资源。
- Proxy Node desired-state 从资源模型编译生成：
  - 落地节点信息。
  - 协议入站。
  - 可用用户凭据。
  - 直连和中转访问节点。
- Transit Relay desired-state 从资源模型编译生成：
  - 中转服务器信息。
  - 可用 Relay Rule。
- desired-state 继续支持 ETag / `If-None-Match`。
- 保留第一阶段 last known good config 离线兜底。
- `panelctl` 支持基础资源管理命令。
- 测试覆盖资源联动和 desired-state 编译。

第二阶段不做：

- 前端 UI。
- 公开订阅服务。
- PostgreSQL / Redis 迁移。
- 真实 Xray / Hysteria2 / Realm 配置落盘和进程管理。
- 用户流量真实采集。
- 管理员登录 session / RBAC UI。
- systemd 真正安装、升级、回滚。

核心联动流程：

1. 管理员创建 `Proxy Node`。
2. 管理员为该落地节点创建 `Node Inbound`。
3. Backend Core 自动创建直连 `Access Node`。
4. 管理员创建 `Transit Relay`。
5. 管理员从已有 `Node Inbound` 创建中转 `Access Node`。
6. Backend Core 自动创建并绑定 `Relay Rule`。
7. Proxy Node Agent 拉取到入站、用户和访问节点。
8. Transit Relay Agent 拉取到中转规则。

管理 API 资源路径：

- `GET /api/v1/admin/summary`
- `GET /api/v1/admin/agents`
- `GET|POST /api/v1/admin/plans`
- `GET|POST /api/v1/admin/users`
- `GET|POST /api/v1/admin/proxy-nodes`
- `GET|POST /api/v1/admin/node-inbounds`
- `GET|POST /api/v1/admin/transit-relays`
- `GET|POST /api/v1/admin/access-nodes`
- `POST /api/v1/admin/access-nodes/relay`
- `GET|POST /api/v1/admin/relay-rules`
- `GET|PATCH|DELETE /api/v1/admin/{collection}/{id}`

CLI 示例：

```bash
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js summary
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js list users
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create proxy-nodes --json '{"name":"hk-01","publicHost":"hk.example.com"}'
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create node-inbounds --json '{"proxyNodeId":"...","protocol":"vless-reality","port":443}'
BACKEND_ADMIN_TOKEN=<admin-token> node scripts/panelctl.js create-relay-access-node --json '{"inboundId":"...","transitRelayId":"...","entryPort":8443}'
```
