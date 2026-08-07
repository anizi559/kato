# Kato v1.0.0 架构与技术点

> 本文档描述 v1.0.0 当前系统的整体架构与关键技术决策。安装、使用与运维细节见项目 Wiki（本地保留，不上传仓库）。

## 1. 总体架构

Kato 是“控制面与数据面分离”的多用户 AnyTLS 代理管理面板：

```text
用户/管理员
  -> admin-ui 面板前端（工具站伪装 + 隐藏管理路径）
      -> backend-core 控制面（API + JSON 数据 + 策略）

用户客户端
  -> subscription-edge 订阅入口
      -> backend-core 动态生成订阅

用户代理流量
  -> transit-relay 中转服务器（可选，Realm 透明转发）
      -> proxy-node 代理节点（sing-box AnyTLS）
```

### 1.1 服务器角色

| 角色 | 运行组件 | 职责 |
| --- | --- | --- |
| backend-core | Node.js HTTP 服务 | 管理 API、Agent 注册/心跳/配置下发、订阅生成、告警/审计、证书签发 |
| admin-ui | Nginx + React 静态站点 | 管理后台隐藏路径、`/api/` 反向代理到后端 |
| subscription-edge | Nginx + Node.js 服务 | 对外分发订阅，缓存/限速/故障兜底 |
| proxy-node | Agent + sing-box | AnyTLS 单端口多用户入站，按用户限速与统计 |
| transit-relay | Agent + Realm | 固定端口 TCP 转发到代理节点，聚合流量统计 |

### 1.2 数据存储

- 后端全部业务数据在一个 JSON 文件：`/var/lib/kato/backend-core.json`。
- 写入串行化（saveQueue）+ 临时文件 rename 原子落盘。
- `normalizeState` 在加载时做兼容迁移与数据清理（含“幽灵节点引用”清理）。

## 2. 配置下发（desired-state）

- Agent 每 60 秒：注册/心跳 → 拉取 `desired-state`（ETag，304 不重传）→ 渲染 → 落盘 → 托管进程。
- 后端按角色编译期望状态：
  - proxy-node：代理节点信息 + 启用的 AnyTLS 入站（每入站一个端口 + 全部活跃用户）+ 证书。
  - transit-relay：中转服务器 + 固定端口转发规则。
- 后端断连时 Agent 使用 last-known-good 配置继续运行。
- 用户流量用量**不参与**配置 ETag，只有跨流量阈值或管理变更才触发配置版本更新，避免节点每分钟重启。

## 3. AnyTLS 单端口多用户

这是 v1.0.0 的核心技术点：

### 3.1 入站

每个协议入站只监听一个端口（线上 2053），`users` 数组挂载全部活跃用户：

```json
{
  "type": "anytls",
  "listen_port": 2053,
  "users": [
    { "name": "user_xxx", "password": "anytls_xxx" }
  ]
}
```

### 3.2 按用户限速

为每个有限速的用户生成独立 `bandwidth-limiter` outbound，路由规则用 `auth_user` 精确匹配：

```json
{
  "type": "bandwidth-limiter",
  "tag": "bw-user_xxx",
  "strategy": "global",
  "mode": "bidirectional",
  "speed": 1000000
}
```

```json
{
  "route": {
    "rules": [{ "auth_user": ["user_xxx"], "outbound": "bw-user_xxx" }],
    "final": "direct"
  }
}
```

> 实测结论：extended 版本的 `strategy: "users"` 单 outbound 方案存在严重的限速 bug（配置 2MB/s 实际只有 2KB/s），因此生产使用“每用户 outbound + auth_user 路由”方案，实测 8Mbps 限速为 943KB/s。

### 3.3 按用户流量统计

- 节点 sing-box 开启 `experimental.v2ray_api`（`127.0.0.1:19091`），`stats.users` 列出全部用户。
- Agent 使用自研最小 gRPC 客户端（`apps/agent/src/v2ray-stats.js`，无第三方依赖）查询：
  - `user>>><userId>>>traffic>>>uplink`
  - `user>>><userId>>>traffic>>>downlink`
- 该能力需要 sing-box 编译时带 `with_v2ray_api` 标签；官方 Release 默认不带，需自编译或用 `--singbox-url` 指定。

### 3.4 超额策略

权限组可配置：

- **断流**：用户跨过流量阈值后从节点配置与订阅中移除，下一轮同步后连接断开。
- **限速 1Mbps**：用户保留，节点为其下发 125000 B/s 限速，订阅继续可用。

后端在 `recordTrafficUsage` 中检测“跨过阈值”状态变化并 bump 配置版本。

## 4. 流量统计链路

- 代理节点：nftables 按入站端口统计节点总量（按入站维度），V2Ray API 按用户统计（用户归属）。
- 中转服务器：nftables 按 Realm 入口端口统计中转总量，**不归属到用户**，避免与节点上报重复计数。
- Agent 先上报成功再保存 lastTraffic 计数，避免后端重启丢增量。

## 5. 订阅体系

- 订阅入口只暴露 `GET /<前缀>/<订阅Token>`，无格式参数。
- 后端按 User-Agent 返回 sing-box JSON / Clash YAML / URI+Base64。
- 节点过滤：权限组/用户勾选节点（`inbound:` / `access:` ID）、节点分组、中转分组。
- 订阅入口：60 秒缓存、每 Token 限速、后端故障 300 秒兜底。
- 响应头：`Subscription-Userinfo`（已用/总额/到期）、`profile-update-interval`、`profile-title`。
- 用户“刷新订阅令牌”会同时轮换订阅 Token 与 AnyTLS 密码，节点下一轮同步后旧凭据失效。

## 6. 证书与域名

- Let's Encrypt + Cloudflare DNS-01，不依赖 80 端口。
- AnyTLS 节点支持“随机二级域名一键签发”：随机前缀 + 基础域名 → DNS 记录 → 证书。
- 证书内容随 desired-state 下发到节点，每 12 小时自动续期。
- 中转域名同样使用随机二级域名，Realm 透明转发、TLS 在目标节点终结。

## 7. 前端

- React 19 + Vite 6，生产构建 `base: "./"`（相对资源路径，适配隐藏管理路径部署）。
- 通用资源表驱动：`resourceConfigs` 定义列表/详情/表单/校验。
- 用户详情：完整订阅链接 + 本地生成二维码（`qrcode.react`），重置订阅令牌后自动更新。
- 权限组节点选择器：圆角矩形 Chip，flex 自动换行，整块点击选中变蓝。

## 8. 安装与升级

- `install.sh` 一键安装/升级五类角色，中文向导 + 全参数化。
- proxy-node 默认安装官方 sing-box-extended；v1.0.0 起需用 `--singbox-url` 指定带 `with_v2ray_api` 的二进制，否则按用户统计不可用。
- 升级前自动备份 `/etc/kato` 与 `/var/lib/kato` 到 `/var/backups/kato`。

## 9. 安全要点

- 后端 8080 不直接暴露公网，HTTPS 模式下只监听 127.0.0.1。
- 管理 Token / 前端配对 Token / Agent Secret 仅存哈希或 root 可读。
- 隐藏管理路径不用 `admin` / `panel` 等敏感词。
- 节点命名、订阅域名、工具站内容避免代理类敏感词。
