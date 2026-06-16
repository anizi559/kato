# Phase 3 Scope

第三阶段当前完成标准：

- Agent 能把 Proxy Node desired-state 渲染成真实运行配置：
  - Xray VLESS + REALITY: `xray/config.json`
  - Hysteria2: `hysteria2/<inbound-id>.yaml`
- Agent 能把 Transit Relay desired-state 渲染成真实运行配置：
  - Realm: `realm/config.json`
- Agent 应用配置时使用临时目录写入，校验通过后再替换 runtime 目录。
- Agent 替换 runtime 目录前会备份旧配置。
- Agent 在线同步和离线 last known good 模式都走同一套运行配置渲染流程。
- 支持 `binaryValidation=true` 时对 Xray 配置执行 `xray run -test`。
- Agent 支持托管运行进程：
  - `once`: 同步 desired-state 并渲染运行配置。
  - `start`: 启动已渲染的 Xray/Hysteria2/Realm。
  - `stop`: 停止托管进程。
  - `restart`: 重启托管进程。
  - `status`: 查看托管进程、运行配置和端口状态。
  - `ports`: 只检查运行端口。
- 支持 `autoStart=true` 时在配置变更后自动重启运行进程。
- Backend Core 不可用时，Agent 会使用 last known good 配置继续渲染，并在 `autoStart=true` 时保持托管进程启动。
- Backend Core 默认生成有效形态的 REALITY X25519 key pair。
- 测试覆盖：
  - Xray 配置渲染。
  - Hysteria2 配置渲染。
  - Realm 配置渲染。
  - runtime manifest 写入。
  - 旧 runtime 备份。
  - Xray 二进制配置校验。
  - Hysteria2 短生命周期进程 smoke test。
  - Realm 短生命周期进程 smoke test 和 TCP 转发验证。
  - REALITY 默认 key 生成。

第三阶段暂不做：

- 真正启动、停止、重启 systemd 服务。
- Xray API 动态增删用户。
- Hysteria2 动态用户热更新。
- Realm 热重载。
- 防火墙端口管理。
- 用户真实流量采集。
- 生产级证书下发和续期。

Agent 配置新增字段：

```json
{
  "runtimeDir": "data/runtime",
  "backupDir": "data/backups",
  "processDir": "data/processes",
  "logDir": "data/logs",
  "binaryValidation": false,
  "autoStart": false,
  "binaries": {
    "xray": "xray",
    "hysteria": "hysteria",
    "realm": "tools/bin/realm"
  }
}
```

本地验证：

```bash
npm test
```

真实 Xray 配置校验在测试中会自动调用：

```bash
xray run -test -c <generated-config>
```

Agent 进程管理命令：

```bash
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js once
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js start
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js status
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js ports
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js restart
AGENT_CONFIG=configs/agent.local.json node apps/agent/src/main.js stop
```
