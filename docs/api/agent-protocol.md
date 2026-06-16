# Agent Protocol v0.3

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
  "agentVersion": "0.3.2",
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
  "backendVersion": "0.3.2"
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
- `inbounds`
- `accessNodes`
- `runtime`

Transit Relay 返回的 `desiredState` 主要包含：

- `relay`
- `relayRules`
- `runtime`

## Runtime Apply

Agent 拉取到新的 desired-state 后，会渲染并落盘运行配置：

- Proxy Node:
  - `xray/config.json`
  - `hysteria2/<inbound-id>.yaml`
- Transit Relay:
  - `realm/config.json`

默认写入 `runtimeDir`，旧配置会备份到 `backupDir`。当 `binaryValidation=true` 时，Agent 会对 Xray 配置执行：

```bash
xray run -test -c <runtime>/xray/config.json
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

本地测试已覆盖 Hysteria2 短生命周期启动、Realm 短生命周期启动和 Realm TCP 转发。

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
