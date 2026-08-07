# Agent Protocol v1.0

## Roles

- `frontend-edge`
- `subscription-edge`
- `proxy-node`
- `transit-relay`

## Bootstrap

Backend Core 先生成一次性 bootstrap token。

```http
POST /api/v1/bootstrap-tokens
X-Admin-Token: <admin-token>
Content-Type: application/json
```

```json
{
  "role": "proxy-node",
  "name": "hk-01",
  "resourceId": "proxy_node_xxx",
  "ttlSeconds": 900
}
```

`resourceId` 可选，但 Proxy Node / Transit Relay 正式部署时建议填写。Agent 注册成功后，Backend Core 会把该 Agent 绑定到对应的 `Proxy Node` 或 `Transit Relay` 资源。

## Register

```http
POST /api/v1/agents/register
Content-Type: application/json
```

```json
{
  "bootstrapToken": "boot_xxx",
  "agentVersion": "1.0.0",
  "hostname": "hk-01",
  "capabilities": {
    "lastKnownGood": true,
    "etag": true,
    "liteMode": true
  }
}
```

返回：

```json
{
  "agentId": "agent_xxx",
  "agentSecret": "agent_xxx",
  "role": "proxy-node",
  "name": "hk-01",
  "backendVersion": "1.0.0"
}
```

## Heartbeat

```http
POST /api/v1/agents/:agentId/heartbeat
Authorization: Bearer <agent-secret>
Content-Type: application/json
```

## Desired State

```http
GET /api/v1/agents/:agentId/desired-state
Authorization: Bearer <agent-secret>
If-None-Match: "<etag>"
```

未变化时返回 `304`。

Proxy Node 返回的 `desiredState` 主要包含：

- `proxyNode`
- `inbounds`（每个 AnyTLS 入站一个端口 + 全部活跃用户）
- `accessNodes`
- `certificates`
- `runtime`

Transit Relay 返回的 `desiredState` 主要包含：

- `relay`
- `relayRules`（固定端口，不再按用户展开）
- `runtime`

## Runtime Apply

Agent 拉取到新的 desired-state 后，会渲染并落盘运行配置：

- Proxy Node:
  - `singbox/config.json`（AnyTLS 单端口多用户 + V2Ray API + bandwidth-limiter）
- Transit Relay:
  - `realm/config.json`

默认写入 `runtimeDir`，旧配置会备份到 `backupDir`。当 `binaryValidation=true` 时，Agent 会对 sing-box 配置执行：

```bash
sing-box check -c <runtime>/singbox/config.json
```

Agent 默认只渲染并落盘运行配置。设置 `autoStart=true` 后，配置变更会触发托管进程重启；Backend Core 不可用时，Agent 会使用最后一次成功拉取的 last known good 配置继续渲染，并尽量保持托管进程启动。

托管进程命令：

```bash
node apps/agent/src/main.js once
node apps/agent/src/main.js start
node apps/agent/src/main.js stop
node apps/agent/src/main.js restart
node apps/agent/src/main.js status
node apps/agent/src/main.js ports
```

本地测试已覆盖 sing-box / Realm 短生命周期启动和 Realm TCP 转发。

## Config Applied Report

```http
POST /api/v1/agents/:agentId/reports/config-applied
Authorization: Bearer <agent-secret>
Content-Type: application/json
```

```json
{
  "configVersion": 1,
  "status": "applied",
  "appliedAt": "2026-06-15T00:00:00.000Z"
}
```

## Traffic Report

```http
POST /api/v1/agents/:agentId/reports/traffic
Authorization: Bearer <agent-secret>
Content-Type: application/json
```

```json
{
  "reportedAt": "2026-08-07T12:00:00.000Z",
  "reports": [
    { "kind": "node", "inboundId": "inbound:inbound_xxx", "uploadBytes": 1024, "downloadBytes": 2048 },
    { "kind": "node", "userId": "user_xxx", "uploadBytes": 512, "downloadBytes": 1024 },
    { "kind": "relay", "entryPort": 18444, "uploadBytes": 1024, "downloadBytes": 2048 }
  ]
}
```

- 代理节点：`kind: node` 的 nftables 端口聚合上报（`inboundId`）+ V2Ray API 按用户上报（`userId`）。
- 中转服务器：`kind: relay` 按入口端口聚合上报（`entryPort`），不携带 `userId`，避免重复计数。
