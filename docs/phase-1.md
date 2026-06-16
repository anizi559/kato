# Phase 1 Scope

第一阶段完成标准：

- 建立 GitHub-ready monorepo。
- Backend Core 提供最小 HTTP API。
- 支持 bootstrap token。
- 支持 Agent 注册。
- 支持 Agent 心跳。
- 支持 desired state 拉取。
- 支持 ETag / 条件拉取。
- 支持 Agent 配置应用回报。
- Agent 支持 last known good config。
- Agent 支持 Backend Core 离线时继续使用最后一次成功配置。
- 提供 `panelctl` 本地运维命令雏形。
- 提供安装脚本入口雏形。
- 提供测试。

第一阶段不做：

- PostgreSQL。
- Redis。
- 前端 UI。
- 订阅服务。
- 真实 Xray/Hysteria2/Realm 配置渲染。
- systemd unit 真正安装。

这些会在接口稳定后进入后续阶段。
