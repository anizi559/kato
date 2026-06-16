# 自研代理面板后台线框与前端路由 v1

日期：2026-06-15

## 0. 文档目的

这份文档把 `backend-panel-ui-design-v1.md` 的功能设计拆成可开发的前端页面、路由、页面布局和数据依赖。

它不是最终视觉稿，也不是前端实现代码。它的目标是先回答三个问题：

- 后台管理界面第一版有哪些页面。
- 每个页面的核心区域、操作入口和状态信息放在哪里。
- 前端路由如何和当前 Backend Core API 对齐。

设计基调继续沿用运维控制台风格：信息密度高、层级清楚、状态明确、操作路径短。第一版不做营销页、产品介绍页、装饰性首页和大面积视觉插画。

## 1. 路由总览

### 1.1 公开路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 管理员登录 | 第一版可先用单管理员 token/session 登录 |
| `/logout` | 退出登录 | 清理本地登录状态后跳转登录页 |

说明：真正部署时，登录入口可以由 Frontend Edge 的隐藏后台路径转发到 Backend Admin 前端，不把 `/login` 直接作为公开宣传入口。

### 1.2 管理后台主路由

| 路由 | 页面 | P0/P1 | 对应导航 |
| --- | --- | --- | --- |
| `/app/overview` | 总览 | P0 | 总览 |
| `/app/users` | 用户列表 | P0 | 用户 |
| `/app/users/:id` | 用户详情 | P0 | 用户 |
| `/app/plans` | 套餐列表 | P0 | 套餐 |
| `/app/plans/:id` | 套餐详情 | P0 | 套餐 |
| `/app/access-nodes` | 访问节点列表 | P0 | 访问节点 |
| `/app/access-nodes/:id` | 访问节点详情 | P0 | 访问节点 |
| `/app/proxy-nodes` | 代理节点列表 | P0 | 代理节点 |
| `/app/proxy-nodes/:id` | 代理节点详情 | P0 | 代理节点 |
| `/app/inbounds` | 协议入站列表 | P0 | 协议入站 |
| `/app/inbounds/:id` | 协议入站详情 | P0 | 协议入站 |
| `/app/transit-relays` | 中转服务器列表 | P0 | 中转服务器 |
| `/app/transit-relays/:id` | 中转服务器详情 | P0 | 中转服务器 |
| `/app/relay-rules` | 转发规则列表 | P0 | 转发规则 |
| `/app/relay-rules/:id` | 转发规则详情 | P0 | 转发规则 |
| `/app/agents` | Agent 列表 | P0 | 系统 / Agent |
| `/app/agents/:id` | Agent 详情 | P0 | 系统 / Agent |
| `/app/config/releases` | 配置发布 | P0 | 配置发布 |
| `/app/config/releases/:id` | 发布详情 | P0 | 配置发布 |
| `/app/audit-logs` | 审计日志 | P0 | 系统 / 审计日志 |
| `/app/settings` | 系统设置 | P0 | 系统 / 设置 |

### 1.3 P1 路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/app/frontend-edges` | 前端入口服务器 | 只展示注册、在线状态、域名和版本，不做本地工具站设置 |
| `/app/subscription-edges` | 订阅服务器 | 订阅入口、域名、状态、版本 |
| `/app/subscription-policies` | 订阅策略 | 节点排序、协议过滤、套餐可见性 |
| `/app/monitoring/health` | 健康检查 | 节点、Agent、Backend 状态 |
| `/app/monitoring/traffic` | 流量统计 | 用户、节点、入口聚合 |
| `/app/alerts` | 告警 | 邮件告警、每日自检报告 |
| `/app/domains` | 域名与证书 | 域名、证书、到期状态 |
| `/app/backups` | 备份恢复 | 后端配置备份、下载和恢复 |

## 2. 全局 App Shell

### 2.1 页面骨架

所有 `/app/*` 页面共用同一套 App Shell：

```text
左侧主导航
顶部栏：当前环境、Backend 状态、待发布提示、管理员菜单
页面标题区：标题、说明、主操作按钮
内容区：表格 / 详情 / 表单 / 日志
底部状态：版本号、最后同步时间
```

### 2.2 左侧导航

一级导航：

- 总览
- 用户
- 套餐
- 访问节点
- 代理节点
- 协议入站
- 中转服务器
- 转发规则
- 配置发布
- 系统

系统下的二级入口：

- Agent
- 审计日志
- 设置
- P1：Frontend Edge
- P1：Subscription Edge
- P1：域名与证书
- P1：备份恢复

### 2.3 顶部状态栏

顶部栏固定展示：

- Backend Core 在线状态。
- 当前配置版本。
- 是否存在待发布变更。
- 最近一次配置发布结果。
- 当前管理员。

当存在待发布变更时，顶部显示紧凑提示条：

```text
存在待发布变更 | 当前版本 v12 | 最后修改 14:30 | 查看变更 | 发布配置
```

### 2.4 关键页面低保真布局

后台第一版优先复用四种页面骨架。

总览页骨架：

```text
[Sidebar] [TopStatusBar: Backend 在线 | 配置 v12 | 待发布 3 | 管理员]

总览                                                   [发布配置]
系统运行状态、节点状态和待处理事项

[全局状态条：Backend / Agent / 配置发布 / 待发布]

[用户] [代理节点] [访问节点] [中转服务器] [转发规则] [Agent]

[待处理事项列表]                      [最近配置应用结果]
- 2 个 Agent 离线                     - proxy-hk-01 已应用 v12
- 3 项变更待发布                      - relay-hk-01 等待应用

[资源健康表格]
资源              状态        最近心跳        操作
proxy-hk-01       在线        30 秒前          查看
relay-hk-01       在线        45 秒前          查看
```

资源列表页骨架：

```text
[Sidebar] [TopStatusBar]

访问节点                                               [新建] [创建中转入口]
用户订阅中最终可见的 direct / relay 节点

[搜索] [类型筛选] [协议筛选] [状态筛选] [订阅可见筛选]

名称        类型       协议        展示地址        落地节点        中转服务器      状态      操作
HK Direct   直连       VLESS       hk-a:443        proxy-hk-01     -              启用      查看
HK Relay    中转       VLESS       relay:8443      proxy-hk-01     relay-hk-01    启用      查看

[分页]
```

资源详情页骨架：

```text
[Sidebar] [TopStatusBar]

proxy-hk-01                                             [编辑] [新建入站] [创建中转入口]
香港落地节点 | Agent 在线 | 配置 v12 已应用

[概览] [协议入站] [访问节点] [Agent] [配置] [流量] [日志]

当前 tab 内容

[左侧主内容：表格 / 表单 / 配置预览]
[右侧摘要：状态、关联资源、最近事件]
```

右侧抽屉表单骨架：

```text
当前页面保持可见

                                   [Drawer]
                                   新建协议入站
                                   协议       [VLESS REALITY v]
                                   代理节点   [proxy-hk-01 v]
                                   端口       [443]
                                   REALITY 设置
                                   - serverName
                                   - dest
                                   - shortIds
                                   - fingerprint

                                   [预览]
                                   保存后会自动创建 direct Access Node

                                   [取消] [保存]
```

快速创建中转入口骨架：

```text
[Dialog / Drawer]
创建中转访问节点

步骤 1 选择协议入站
步骤 2 选择中转服务器
步骤 3 设置入口端口和 transport
步骤 4 预览资源联动

将创建：
- Access Node: HK Relay, entry relay-hk-01:8443
- Relay Rule: relay-hk-01:8443 -> proxy-hk-01:443 tcp

[取消] [创建并标记待发布]
```

## 3. 登录页

路由：`/login`

页面目标：

- 管理员进入后台。
- 第一版只服务单管理员，不做注册、找回密码、代理商入口。

页面区域：

- 管理员登录表单。
- Backend 地址或环境名称。
- 错误提示。
- 登录中状态。

表单字段：

- 管理员账号或 token 名称。
- 密码或管理 token。
- 记住本设备。

第一版行为：

- 登录成功进入 `/app/overview`。
- 登录失败提示“账号或密钥无效”。
- 多次失败可先只在前端做冷却提示，后续再接后端限制。

## 4. 总览页

路由：`/app/overview`

数据来源：

- `GET /api/v1/admin/summary`
- `GET /api/v1/admin/agents`

页面区域：

1. 全局状态条
   - Backend Core 状态。
   - 配置版本。
   - 最近配置发布时间。
   - 待发布变更数量。

2. 核心资源概览
   - 用户数量。
   - 套餐数量。
   - 代理节点数量。
   - 协议入站数量。
   - 访问节点数量。
   - 中转服务器数量。
   - 转发规则数量。

3. Agent 状态
   - 在线。
   - 离线。
   - 版本不一致。
   - 最近心跳时间。

4. 待处理事项
   - 有节点离线。
   - 有配置未发布。
   - 有 Agent 使用旧配置。
   - 有访问节点未绑定有效入站。

主要操作：

- 发布配置。
- 创建代理节点。
- 创建中转服务器。
- 查看 Agent。

## 5. 用户页面

### 5.1 用户列表

路由：`/app/users`

数据来源：

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`

表格列：

- 用户名。
- 状态。
- 所属套餐。
- 到期时间。
- 流量用量。
- 可用协议。
- 最近使用。
- 创建时间。
- 操作。

筛选：

- 状态。
- 套餐。
- 是否到期。
- 是否超流量。
- 协议权限。

主操作：

- 新建用户。
- 批量启用。
- 批量禁用。
- 导出。

行操作：

- 查看详情。
- 编辑。
- 重置 UUID/password。
- 禁用。

### 5.2 用户详情

路由：`/app/users/:id`

详情 tabs：

- 概览：状态、套餐、到期、流量。
- 凭据：VLESS UUID、Hysteria2 password、Trojan password 预留。
- 访问权限：可用套餐、协议、节点。
- 订阅：订阅链接、刷新、禁用订阅。
- 日志：变更记录和登录记录。

危险操作：

- 禁用用户。
- 删除用户。
- 重置全部凭据。

## 6. 套餐页面

### 6.1 套餐列表

路由：`/app/plans`

数据来源：

- `GET /api/v1/admin/plans`
- `POST /api/v1/admin/plans`

表格列：

- 套餐名称。
- 状态。
- 流量额度。
- 到期策略。
- 可用协议。
- 可用访问节点数量。
- 用户数量。
- 创建时间。

主操作：

- 新建套餐。
- 编辑排序。

### 6.2 套餐详情

路由：`/app/plans/:id`

详情 tabs：

- 基础信息。
- 协议权限。
- 节点权限。
- 用户列表。
- 变更记录。

关键字段：

- 是否启用。
- 流量额度。
- 默认有效期。
- 允许 VLESS REALITY。
- 允许 Hysteria2。
- 是否允许 UDP。
- 默认 Hysteria2 up/down Mbps。

## 7. 访问节点页面

访问节点是用户订阅里最终看到的节点。它可以是直连，也可以是经 Realm 中转的入口。

### 7.1 访问节点列表

路由：`/app/access-nodes`

数据来源：

- `GET /api/v1/admin/access-nodes`
- `POST /api/v1/admin/access-nodes`
- `POST /api/v1/admin/access-nodes/relay`

表格列：

- 名称。
- 类型：直连 / 中转。
- 协议：VLESS REALITY / Hysteria2。
- 展示地址。
- 展示端口。
- 落地代理节点。
- 协议入站。
- 中转服务器。
- 状态。
- 订阅可见。
- 操作。

筛选：

- 类型。
- 协议。
- 代理节点。
- 中转服务器。
- 状态。
- 订阅可见。

主操作：

- 新建直连访问节点。
- 从协议入站快速创建中转访问节点。
- 批量隐藏。
- 批量启用。

### 7.2 访问节点详情

路由：`/app/access-nodes/:id`

详情区域：

- 基础信息。
- 用户订阅展示信息。
- 关联协议入站。
- 关联代理节点。
- 关联中转服务器和转发规则。
- 套餐可见性。
- 最近配置发布状态。

直连访问节点字段：

- displayName。
- host。
- port。
- protocol。
- inboundId。
- subscriptionVisible。

中转访问节点字段：

- displayName。
- entryHost。
- entryPort。
- transitRelayId。
- relayRuleId。
- targetInboundId。
- transport：tcp / udp。

## 8. 代理节点页面

### 8.1 代理节点列表

路由：`/app/proxy-nodes`

数据来源：

- `GET /api/v1/admin/proxy-nodes`
- `POST /api/v1/admin/proxy-nodes`
- `GET /api/v1/admin/agents`

表格列：

- 名称。
- 公网地址。
- 区域。
- Agent 状态。
- Agent 版本。
- 协议入站数量。
- 访问节点数量。
- 配置版本。
- 最近心跳。
- 操作。

主操作：

- 新建代理节点。
- 生成 Agent 安装 token。
- 发布配置。

行操作：

- 查看详情。
- 编辑。
- 新建协议入站。
- 创建中转入口。
- 禁用。

### 8.2 代理节点详情

路由：`/app/proxy-nodes/:id`

建议 query tab：

- `/app/proxy-nodes/:id?tab=overview`
- `/app/proxy-nodes/:id?tab=inbounds`
- `/app/proxy-nodes/:id?tab=access-nodes`
- `/app/proxy-nodes/:id?tab=agent`
- `/app/proxy-nodes/:id?tab=config`
- `/app/proxy-nodes/:id?tab=traffic`
- `/app/proxy-nodes/:id?tab=logs`

概览 tab：

- 节点名称。
- 公网地址。
- 区域。
- 是否启用。
- Agent 在线状态。
- 当前配置版本。
- 最近配置应用结果。

协议入站 tab：

- 入站列表。
- 新建 VLESS REALITY 入站。
- 新建 Hysteria2 入站。
- 每个入站下展示直连访问节点数量和中转访问节点数量。

访问节点 tab：

- 当前代理节点下所有 direct / relay access nodes。
- 快速创建中转访问节点。
- 快速隐藏订阅。

Agent tab：

- Agent ID。
- 注册角色。
- 版本。
- capabilities。
- 最近心跳。
- 生成新的 bootstrap token。

配置 tab：

- desired-state 预览。
- 最近应用结果。
- Agent 上报的 runtime manifest。
- 重新发布配置。

## 9. 协议入站页面

### 9.1 协议入站列表

路由：`/app/inbounds`

数据来源：

- `GET /api/v1/admin/node-inbounds`
- `POST /api/v1/admin/node-inbounds`

表格列：

- 名称。
- 协议。
- 代理节点。
- 监听端口。
- 状态。
- 直连访问节点。
- 中转访问节点。
- 用户数量。
- 操作。

主操作：

- 新建协议入站。
- 批量启用。
- 批量禁用。

### 9.2 新建 / 编辑协议入站

页面形态：

- 第一版建议用右侧抽屉或详情页表单。
- 协议字段选择后切换表单内容。
- 保存后进入待发布状态。

共同字段：

- 名称。
- 代理节点。
- 协议。
- 监听地址。
- 监听端口。
- 是否启用。
- 备注。

VLESS REALITY 字段：

- UUID 策略。
- flow。
- serverName。
- dest。
- shortIds。
- privateKey / publicKey。
- spiderX。
- fingerprint。

Hysteria2 字段：

- password 策略。
- obfs 是否开启。
- obfs password。
- up Mbps。
- down Mbps。
- masquerade。
- 是否允许 UDP。

保存后的自动联动：

- 创建 Node Inbound 后自动创建 direct Access Node。
- 如果在创建流程里勾选“同时创建中转入口”，则调用快速创建中转访问节点流程。

## 10. 快速创建中转访问节点流程

入口：

- 访问节点列表。
- 代理节点详情的访问节点 tab。
- 协议入站详情页。
- 协议入站列表行操作。

数据来源：

- `GET /api/v1/admin/node-inbounds`
- `GET /api/v1/admin/transit-relays`
- `POST /api/v1/admin/access-nodes/relay`

流程步骤：

1. 选择目标协议入站。
2. 选择中转服务器。
3. 设置入口端口。
4. 选择 transport：tcp / udp。
5. 设置订阅展示名称。
6. 预览将创建的 Access Node 和 Relay Rule。
7. 确认创建。

创建结果：

- 新增一个 type 为 relay 的 Access Node。
- 自动新增并绑定一条 Relay Rule。
- Access Node 列表出现该中转节点。
- 中转服务器详情和转发规则列表同步展示该规则。
- 全局进入待发布状态。

确认页必须展示：

- 用户连接地址：中转服务器 host + entryPort。
- 转发目标：代理节点 host + 入站端口。
- 协议和 transport。
- 关联资源 ID。

## 11. 中转服务器页面

### 11.1 中转服务器列表

路由：`/app/transit-relays`

数据来源：

- `GET /api/v1/admin/transit-relays`
- `POST /api/v1/admin/transit-relays`
- `GET /api/v1/admin/agents`

表格列：

- 名称。
- 公网地址。
- 区域。
- Agent 状态。
- Realm 规则数量。
- 关联访问节点数量。
- 支持 TCP。
- 支持 UDP。
- 配置版本。
- 最近心跳。
- 操作。

主操作：

- 新建中转服务器。
- 生成 Agent 安装 token。
- 创建中转访问节点。

### 11.2 中转服务器详情

路由：`/app/transit-relays/:id`

建议 query tab：

- `/app/transit-relays/:id?tab=overview`
- `/app/transit-relays/:id?tab=rules`
- `/app/transit-relays/:id?tab=access-nodes`
- `/app/transit-relays/:id?tab=agent`
- `/app/transit-relays/:id?tab=config`
- `/app/transit-relays/:id?tab=traffic`
- `/app/transit-relays/:id?tab=logs`

规则 tab：

- 当前 Realm 转发规则列表。
- entryPort。
- targetHost。
- targetPort。
- transport。
- linked access node。
- enabled。

访问节点 tab：

- 该中转服务器对外提供的用户订阅节点。
- 快速隐藏 / 启用。
- 跳转关联代理节点和协议入站。

## 12. 转发规则页面

### 12.1 转发规则列表

路由：`/app/relay-rules`

数据来源：

- `GET /api/v1/admin/relay-rules`
- `POST /api/v1/admin/relay-rules`

表格列：

- 规则名称。
- 中转服务器。
- entryPort。
- targetHost。
- targetPort。
- transport。
- 关联 Access Node。
- 状态。
- 操作。

筛选：

- 中转服务器。
- transport。
- 状态。
- 是否有关联 Access Node。

### 12.2 转发规则详情

路由：`/app/relay-rules/:id`

详情区域：

- 规则基础信息。
- 中转服务器。
- 转发目标。
- transport。
- 关联 Access Node。
- 最近配置应用结果。

危险提示：

- 如果规则由 relay Access Node 自动创建，删除规则时必须提示会影响对应订阅节点。
- 第一版建议优先从 Access Node 禁用或删除，减少孤立规则。

## 13. Agent 页面

### 13.1 Agent 列表

路由：`/app/agents`

数据来源：

- `GET /api/v1/admin/agents`
- `POST /api/v1/bootstrap-tokens`

表格列：

- Agent ID。
- 名称。
- 角色。
- 绑定资源。
- 在线状态。
- Agent 版本。
- capabilities。
- 最近心跳。
- 最近配置版本。
- 操作。

主操作：

- 生成 Proxy Node 安装 token。
- 生成 Transit Relay 安装 token。
- P1：生成 Frontend Edge 安装 token。
- P1：生成 Subscription Edge 安装 token。

### 13.2 Agent 详情

路由：`/app/agents/:id`

详情 tabs：

- 概览。
- 绑定资源。
- capabilities。
- 心跳记录。
- 配置应用记录。
- 安装命令。

安装命令区域：

- 显示一键安装命令。
- 显示 token 过期时间。
- 复制按钮。
- token 只展示一次，刷新需重新生成。

## 14. 配置发布页面

### 14.1 发布列表

路由：`/app/config/releases`

当前后端已有 `configRevision` 和 Agent config-applied report。第一版 UI 可以先基于现有版本号展示，后续再扩展为完整发布记录表。

页面区域：

- 当前配置版本。
- 是否有待发布变更。
- 最近发布时间。
- 各 Agent 应用状态。
- 手动发布按钮。

发布前确认：

- 展示变更摘要。
- 展示受影响 Agent。
- 展示是否有离线 Agent。
- 管理员确认后发布。

### 14.2 发布详情

路由：`/app/config/releases/:id`

详情区域：

- 发布版本。
- 发布时间。
- 发布人。
- 变更资源。
- Agent 应用结果。
- 失败原因。
- desired-state 摘要。

第一版可先做只读详情，回滚按钮保留为 P1。

## 15. 审计日志页面

路由：`/app/audit-logs`

页面目标：

- 查看谁在什么时候改了什么。
- 支持定位误操作。
- 支持配置发布前后的问题排查。

表格列：

- 时间。
- 操作人。
- 操作类型。
- 资源类型。
- 资源名称。
- 变更摘要。
- 来源 IP。
- 结果。

筛选：

- 时间范围。
- 操作人。
- 资源类型。
- 操作类型。
- 成功 / 失败。

## 16. 系统设置页面

路由：`/app/settings`

第一版设置项：

- Backend Core 基础信息。
- 管理员账号。
- 管理 token 轮换。
- 默认配置发布策略：手动发布。
- Agent 兼容版本。
- 系统版本号。

P1 设置项：

- 邮件告警。
- 每日自检报告。
- 备份路径。
- 域名证书策略。
- Frontend Edge / Subscription Edge 接入策略。

## 17. 通用交互模式

### 17.1 表格页

表格页统一结构：

- 标题。
- 页面说明。
- 主操作按钮。
- 搜索框。
- 筛选器。
- 状态分组。
- 数据表格。
- 分页。

表格行操作统一放在右侧：

- 查看。
- 编辑。
- 启用 / 禁用。
- 更多菜单。

危险操作必须二次确认：

- 删除用户。
- 删除协议入站。
- 删除代理节点。
- 删除中转服务器。
- 删除转发规则。
- 重置用户凭据。

### 17.2 详情页

详情页统一结构：

- 顶部摘要。
- 状态标签。
- 主要操作。
- tabs。
- 右侧元信息或最近事件。

常用 tabs：

- 概览。
- 关联资源。
- 配置。
- 流量。
- 日志。

### 17.3 表单

表单统一规则：

- 必填字段明确标记。
- 协议差异字段按协议类型切换。
- 保存成功后提示“已保存，等待发布”。
- 保存不会自动发布运行配置。
- 涉及端口、host、协议的表单要有预览区。

### 17.4 配置预览

配置预览统一使用只读代码区域：

- JSON desired-state。
- Xray config 摘要。
- Hysteria2 yaml 摘要。
- Realm config 摘要。

第一版可以展示摘要和原始 JSON，后续再做 diff 可视化。

### 17.5 可复用资源页模板

P0 资源管理页统一使用同一套可复用骨架：

```text
[Sidebar / MobileNav] [TopStatusBar]

页面标题                                             [次要动作] [主要动作] [刷新]
一句话说明当前资源的管理范围

[搜索] [分组 segmented] [筛选 1] [筛选 2] [筛选 3] [高级筛选]

[分组资源表格]
名称 / 状态 / 关键字段 / 关联资源 / 版本 / 操作

[分页]

[右侧详情面板]
基本信息 / 关联资源 / 最近配置应用 / 快捷操作 / 配置预览
```

复用规则：

- 用户、套餐、访问节点、代理节点、协议入站、中转服务器、转发规则、Agent 页面都基于该模板开发。
- 桌面端保留表格 + 右侧详情面板，适合高频运维。
- 窄桌面或浏览器缩放时，详情面板移动到表格下方。
- 手机端表格转换为资源卡片，字段名通过卡片标签展示。
- 模板组件只关心布局、筛选、选中、分页和详情容器；每个资源页自己提供列定义、筛选项、动作和详情内容。

## 18. 页面到 API 映射

| 页面 | 读取 | 写入 |
| --- | --- | --- |
| 总览 | `GET /api/v1/admin/summary`, `GET /api/v1/admin/agents` | 无 |
| 用户 | `GET /api/v1/admin/users` | `POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id`, `DELETE /api/v1/admin/users/:id` |
| 套餐 | `GET /api/v1/admin/plans` | `POST /api/v1/admin/plans`, `PATCH /api/v1/admin/plans/:id`, `DELETE /api/v1/admin/plans/:id` |
| 访问节点 | `GET /api/v1/admin/access-nodes` | `POST /api/v1/admin/access-nodes`, `POST /api/v1/admin/access-nodes/relay`, `PATCH /api/v1/admin/access-nodes/:id`, `DELETE /api/v1/admin/access-nodes/:id` |
| 代理节点 | `GET /api/v1/admin/proxy-nodes` | `POST /api/v1/admin/proxy-nodes`, `PATCH /api/v1/admin/proxy-nodes/:id`, `DELETE /api/v1/admin/proxy-nodes/:id` |
| 协议入站 | `GET /api/v1/admin/node-inbounds` | `POST /api/v1/admin/node-inbounds`, `PATCH /api/v1/admin/node-inbounds/:id`, `DELETE /api/v1/admin/node-inbounds/:id` |
| 中转服务器 | `GET /api/v1/admin/transit-relays` | `POST /api/v1/admin/transit-relays`, `PATCH /api/v1/admin/transit-relays/:id`, `DELETE /api/v1/admin/transit-relays/:id` |
| 转发规则 | `GET /api/v1/admin/relay-rules` | `POST /api/v1/admin/relay-rules`, `PATCH /api/v1/admin/relay-rules/:id`, `DELETE /api/v1/admin/relay-rules/:id` |
| Agent | `GET /api/v1/admin/agents` | `POST /api/v1/bootstrap-tokens` |
| 配置发布 | `GET /api/v1/admin/summary`, `GET /api/v1/admin/agents` | P0 需要新增发布动作 API 或先以 config revision 状态展示 |
| 审计日志 | P0 需要新增 audit logs API | 无 |
| 设置 | P0 需要新增 settings API 或先本地静态配置展示 | P0 需要新增 settings API |

## 19. MVP 组件清单

第一版前端建议先做这些组件：

- AppShell。
- SidebarNav。
- TopStatusBar。
- PageHeader。
- DataTable。
- StatusBadge。
- ResourceLink。
- EmptyState。
- ConfirmDialog。
- DrawerForm。
- TabLayout。
- KeyValuePanel。
- ConfigPreview。
- CopyButton。
- PendingPublishBanner。
- AgentStatusIndicator。

这些组件先服务 P0 页面，不急着抽象成复杂设计系统。

## 20. 第一阶段前端实现建议

建议前端第一批实现顺序：

1. App Shell、登录页、总览页。
2. 用户、套餐、代理节点、中转服务器的基础 CRUD 表格。
3. 协议入站创建表单和自动 direct Access Node 展示。
4. 访问节点一级页面。
5. 快速创建中转访问节点流程。
6. 转发规则页面。
7. Agent 注册和 bootstrap token 生成。
8. 配置发布状态页。

这个顺序能最快验证最关键的闭环：

- 创建用户。
- 创建代理节点。
- 创建协议入站。
- 自动生成直连访问节点。
- 创建中转服务器。
- 快速生成中转访问节点和 Realm 转发规则。
- Agent 拉取配置。
- 管理员看到配置状态。
