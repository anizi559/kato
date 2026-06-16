# soga 项目参考分析

记录日期：2026-06-15

参考对象：

- GitHub 仓库：https://github.com/vaxilu/soga
- 文档首页：https://soga.yougotme.cc/master.md
- WebAPI 文档：https://soga.yougotme.cc/doc/soga-v1-webapi-kai-fa-wen-dang.md
- 内存测试：https://soga.yougotme.cc/test/memory-test.md
- VMess 测试：https://soga.yougotme.cc/test/vmess-test.md

本次分析基于 GitHub 仓库当前 `master` 快照：

- commit：`a56914535cb4ba30679bea4d25f155a5703d7873`
- commit date：2026-05-23
- 最新 release：`2.15.1`
- release 发布时间：2026-05-29

## 1. soga 对我们的参考价值

soga 是一个典型的轻量节点端程序，核心目标是：

- 对接面板。
- 从面板拉取节点配置。
- 从面板拉取用户列表。
- 本地运行代理协议。
- 上报流量。
- 上报在线 IP。
- 上报节点状态。
- 通过 systemd 管理服务。
- 通过命令行工具完成安装、更新、卸载、日志、配置修改。

这和我们自研系统里的 `Proxy Node + Node Agent` 很接近。

## 2. 值得借鉴的设计

### 2.1 轻量 systemd 部署

soga 的安装脚本采用轻量部署方式：

- 程序目录：`/usr/local/soga/`
- 配置目录：`/etc/soga/`
- 管理命令：`/usr/bin/soga`
- systemd 服务：`soga.service`
- 多实例服务：`soga@.service`

这个模式非常适合 1c1g 小服务器。

对我们的启发：

- Proxy Node 和 Transit Relay 第一版应优先支持 `systemd + 静态二进制`。
- 不应该强制 Docker Compose。
- 不应该在节点上安装数据库、Redis 或 Web 管理面板。
- 需要有统一 CLI，例如 `panelctl`。

### 2.2 一键安装和版本更新

soga 安装脚本做了：

- 检测 root。
- 检测系统发行版。
- 检测 CPU 架构。
- 下载对应架构 release 包。
- 安装 systemd unit。
- 设置开机自启。
- 安装管理命令。
- 支持指定版本安装。

对我们的启发：

- `install.sh --role proxy-node` 和 `install.sh --role transit-relay` 必须自动识别架构。
- 应支持指定版本安装。
- 应支持安装后自动注册 Backend Core。
- 应显示当前版本、服务状态和日志查看命令。

### 2.3 WebAPI 拉取模型

soga 的 `soga-v1` webapi 思路很清楚：

- 节点端主动请求面板。
- 请求头带 API key、节点 ID、节点类型。
- 节点端拉取节点配置。
- 节点端拉取用户列表。
- 节点端提交用户流量。
- 节点端提交在线 IP。
- 节点端提交审计日志。
- 节点端提交节点状态。

对我们的启发：

- Agent API 应该保持节点主动拉取，不让 Backend Core 主动 SSH 到节点。
- API 应明确区分 `node_id`、`node_type`、`agent_id`、`config_version`。
- 节点配置和用户列表可以分开拉取。
- 流量、状态、日志、在线信息可以分批上报。

### 2.4 ETag / If-None-Match

soga webapi 支持 `IF-NONE-MATCH` 请求头，面板返回 ETag 后，节点下次 GET 可以带上该值，减少重复传输。

对我们的启发：

- Proxy Node / Transit Relay 拉取 desired state 时应支持 ETag 或等价版本号机制。
- 如果配置未变化，Backend Core 返回 `304` 或轻量响应。
- 这对 1c1g 节点和低带宽服务器很友好。

### 2.5 pull_interval / push_interval

soga 的节点配置里有：

- `pull_interval`：节点拉取配置/用户的间隔。
- `push_interval`：节点推送流量/状态的间隔。

对我们的启发：

- Agent 不应该高频轮询。
- Backend Core 应能按节点下发采样间隔。
- 1c1g 轻量节点默认应使用低频采样。
- 故障诊断时再临时提高采样频率。

### 2.6 限速和连接限制

soga 的用户信息支持：

- 用户限速。
- 用户 IP 数限制。
- 用户 TCP 连接限制。

节点配置支持：

- 节点总限速。

对我们的启发：

- 后端可以保留这些策略字段。
- Proxy Node 应至少能接收并上报这些策略。
- 第一版是否强制执行，要看 Xray/Hysteria2/sing-box/系统层能力。
- 如果核心不支持精细限制，不应为了限速引入过重的数据面程序。

### 2.7 审计规则和白名单

soga webapi 支持：

- 拉取审计规则。
- 拉取审计白名单。
- 提交用户审计触发记录。

对我们的启发：

- 第一版可以不做复杂审计。
- 但数据模型可以预留 `audit_rules`、`audit_whitelist`、`audit_events`。
- 白名单可以用于避免误杀内部测试或管理地址。

### 2.8 状态上报

soga 状态接口会上报：

- CPU。
- 内存。
- swap。
- 磁盘。
- uptime。

对我们的启发：

- 我们的 Agent 状态上报不需要一开始很复杂。
- P0 做 CPU、内存、磁盘、负载、uptime、服务状态即可。
- 更多连接、链路、协议细节放 P1。

### 2.9 内存优化目标

soga 文档强调内存和 CPU 优化，并给出大量用户、大量连接下的内存测试。

对我们的启发：

- 我们虽然不自研协议内核，但必须给 Agent 设定资源预算。
- 1c1g 节点不能把健康检查、测速、日志解析都放本机高频执行。
- 需要做资源压力测试，至少覆盖：
  - 多用户配置。
  - 多连接。
  - VLESS + REALITY。
  - Hysteria2。
  - Realm TCP/UDP 转发。

## 3. 不建议照搬的部分

### 3.1 不建议第一版自研协议内核

soga 的特点之一是自研协议实现，不依赖 Xray/V2Ray core。

我们不建议第一版这么做，原因：

- 协议实现复杂。
- 安全风险高。
- REALITY、Hysteria2、QUIC、统计、兼容性维护成本都很高。
- 自研内核需要长期跟进客户端生态。

我们的第一版更适合：

- VLESS + REALITY 用 Xray-core。
- Hysteria2 用官方 Hysteria2 或 sing-box。
- 中转用 Realm。
- Agent 负责配置生成、运行管理和上报。

### 3.2 不建议照搬大量历史协议

soga 支持 VMess、Trojan、SS、SSR、VLESS、Hysteria、AnyTLS、Mieru 等。

我们的第一版只保留：

- VLESS + REALITY。
- Hysteria2。
- Realm TCP/UDP 中转。

其他协议暂缓。

### 3.3 不建议把授权绑定作为架构核心

soga 文档提到商业授权码和 webapi URL 绑定。

我们的系统是自研自用管理系统，第一版不需要商业授权系统。

## 4. 建议加入我们清单的功能

### Proxy Node / Transit Relay P0

- ETag / 配置版本条件拉取。
- pull interval。
- push interval。
- 节点状态上报。
- 配置未变化时轻量响应。
- last known good config。
- 本地 systemd 管理。
- 轻量 CLI。
- 日志查看。
- 指定版本安装。
- 架构自动识别。

### Proxy Node P0 或 P1

- 用户流量上报。
- 在线 IP 上报。
- 用户限速字段接收。
- 用户 IP 数限制字段接收。
- 用户 TCP 连接限制字段接收。
- 节点总限速字段接收。
- 能力支持时执行限速和连接限制。

### P1

- 审计规则。
- 审计白名单。
- 审计事件上报。
- 多实例管理。
- 资源压力测试。
- 低内存模式自动降级。

## 5. 对我们架构的结论

soga 最值得借鉴的是“轻量节点端 + 面板 webapi + systemd 管理 + 定时拉取/推送 + 资源优化”。

我们不应照搬它的协议内核路线，而应吸收它的数据面工程经验：

- 节点要轻。
- 节点要能离线继续跑。
- 节点要主动拉配置。
- 节点要少传输。
- 节点要能本地诊断。
- 节点不跑面板。
- 节点不依赖数据库。
- 节点通过 CLI 和 systemd 管理。
