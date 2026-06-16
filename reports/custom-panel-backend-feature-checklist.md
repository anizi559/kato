# 自研代理面板 Backend Core 功能清单草案

记录日期：2026-06-15

## 0. 文档目的

这份清单用于确定自研代理面板的“面板后端服务器 Backend Core”应该具备哪些功能。

参考来源：

- 已确定的新架构：`面板前端服务器 + 面板后端服务器 + 订阅服务器 + 中转服务器 + 若干代理节点`
- Hiddify Manager / HiddifyPanel 的代码级模块分析
- 当前目标：多用户、订阅分发、VLESS + REALITY、Hysteria2、Realm 中转、节点监控、角色化部署、一键安装和升级

本清单不是最终需求，而是给后续筛选用的功能池。

优先级说明：

- `P0`：第一版必须做。
- `P1`：第一版可以不完整，但建议尽快做。
- `P2`：高级功能，后续版本做。
- `暂缓`：参考 Hiddify 有这个能力，但不建议第一阶段做。
- `不做`：不符合当前架构或风险较高，默认不纳入。

## 1. Backend Core 的边界

Backend Core 是整个系统的核心控制面，负责数据、权限、策略、配置生成、Agent 管理、流量统计、任务调度和审计。

Backend Core 不应该承担：

- 不直接给普通用户浏览器访问。
- 不直接承载公开订阅入口。
- 不直接承载代理协议入口。
- 不直接跑 Xray、Hysteria2、Realm 等数据面进程。
- 不直接暴露数据库、Redis、任务队列。
- 不把代理节点、中转服务器、前端服务器混在同一台机器上管理。

Backend Core 只允许这些角色访问：

- Frontend Edge。
- Subscription Edge。
- Node Agent。
- Relay Agent。
- 管理员通过 Frontend Edge 间接访问。

## 2. 系统初始化与全局设置

### P0

- [ ] 初始化 Backend Core。
- [ ] 初始化数据库。
- [ ] 初始化 Redis。
- [ ] 初始化任务队列。
- [ ] 创建第一个 super admin。
- [ ] 生成系统主密钥。
- [ ] 生成 API 签名密钥。
- [ ] 生成 bootstrap token 签发密钥。
- [ ] 设置系统名称。
- [ ] 设置系统时区。
- [ ] 设置默认语言。
- [ ] 设置默认流量单位。
- [ ] 设置默认订阅更新间隔。
- [ ] 设置 Backend Core 私网访问地址。
- [ ] 设置 Backend Core 对 Edge/Agent 暴露的 API 地址。
- [ ] 检查数据库迁移状态。
- [ ] 显示当前版本号。
- [ ] 显示组件兼容版本矩阵。

### P1

- [ ] 支持系统维护模式。
- [ ] 支持全局只读模式。
- [ ] 支持多环境配置：dev、staging、production。
- [ ] 支持系统公告。
- [ ] 支持用户中心品牌信息。
- [ ] 支持帮助链接、支持链接。

### Hiddify 参考

Hiddify 有初始化向导、管理员语言/国家、管理员密码、域名初始化等能力。我们保留“初始化向导”的思想，但不把域名、代理入口和本机 HAProxy 绑定在 Backend Core 上。

## 3. 管理员认证与权限

### P0

- [ ] 管理员登录。
- [ ] 管理员退出。
- [ ] 密码哈希，建议 Argon2id 或 bcrypt。
- [ ] super admin 角色。
- [ ] 管理员启停。
- [ ] 管理员密码修改。
- [ ] 管理员密码重置。
- [ ] 登录失败限制。
- [ ] 管理员 session 管理。
- [ ] 管理员 API token 管理。
- [ ] 管理员操作审计日志。

### P1

- [ ] admin 角色。
- [ ] operator 角色。
- [ ] readonly 角色。
- [ ] 自定义 RBAC 权限。
- [ ] 2FA。
- [ ] WebAuthn。
- [ ] 登录 IP allowlist。
- [ ] 登录设备管理。
- [ ] 管理员邀请链接。
- [ ] 管理员登录通知。

### P2

- [ ] 多级管理员。
- [ ] 代理商/agent 角色。
- [ ] 管理员最大用户数限制。
- [ ] 管理员最大活跃用户数限制。
- [ ] 管理员可见节点范围限制。
- [ ] 管理员可见中转范围限制。
- [ ] 管理员可见用户组限制。
- [ ] 管理员删除后的用户归属转移。

### Hiddify 参考

Hiddify 支持 super admin、admin、agent、子管理员、最大用户数、最大活跃用户数。我们可以保留这个方向，但第一版建议先做 super admin + 基础 RBAC，避免一开始把权限模型做得过重。

## 4. 用户管理

### P0

- [ ] 用户创建。
- [ ] 用户编辑。
- [ ] 用户删除。
- [ ] 用户启用 / 禁用。
- [ ] 用户备注。
- [ ] 用户标签。
- [ ] 用户分组。
- [ ] 用户 UUID。
- [ ] 用户订阅 token。
- [ ] 用户到期时间。
- [ ] 用户流量上限。
- [ ] 用户已用流量。
- [ ] 用户剩余流量。
- [ ] 用户流量重置。
- [ ] 用户套餐绑定。
- [ ] 用户可访问节点组。
- [ ] 用户可访问中转组。
- [ ] 用户可访问协议。
- [ ] 用户订阅链接生成。
- [ ] 用户订阅 token 重置。
- [ ] 用户配置预览。
- [ ] 用户当前状态：正常、停用、过期、超流量。
- [ ] 用户批量创建。
- [ ] 用户批量启停。
- [ ] 用户批量改套餐。
- [ ] 用户批量重置流量。
- [ ] 用户批量延期。
- [ ] 用户导入。
- [ ] 用户导出。
- [ ] 用户最近订阅访问时间。
- [ ] 用户最近代理使用时间。
- [ ] 用户在线状态。
- [ ] 用户最近使用节点。
- [ ] 用户最近使用客户端。
- [ ] 用户最近来源 IP / ASN / 国家。
- [ ] 用户设备数限制。
- [ ] 用户同时在线 IP 限制。
- [ ] 用户速率限制。
- [ ] 用户客户端限制。
- [ ] 用户地区限制。
- [ ] 用户订阅访问频率限制。

### P1
- [ ] 用户协议级凭据分离。
- [ ] 单用户凭据轮换。
- [ ] 单用户所有协议凭据一键轮换。

### P2


- [ ] 用户异常使用检测。
- [ ] 用户自助重置订阅 token。
- [ ] 用户自助查看流量。
- [ ] 用户自助续费接口预留。

### 关键设计决策

- 不建议像 Hiddify 那样把用户 UUID 同时作为订阅 token、VLESS UUID、Hysteria2 password、SSH/WireGuard 凭据。
- 建议拆分：
  - 用户内部 ID。
  - 订阅 token。
  - VLESS UUID。
  - Hysteria2 password。
  - 后续其他协议独立 secret。
- 这样订阅泄露后可以只轮换订阅 token 或指定协议凭据。

## 5. 套餐、权限与策略

### P0

- [ ] 套餐创建。
- [ ] 套餐编辑。
- [ ] 套餐删除。
- [ ] 套餐启用 / 禁用。
- [ ] 套餐名称。
- [ ] 套餐流量上限。
- [ ] 套餐有效期。
- [ ] 套餐可访问节点组。
- [ ] 套餐可访问中转组。
- [ ] 套餐可访问协议。
- [ ] 套餐默认订阅格式。
- [ ] 套餐默认节点排序策略。
- [ ] 套餐流量周期重置：不重置、每日、每周、每月。
- [ ] 套餐限速策略。
- [ ] 套餐 Hysteria2 上下行 Mbps 默认值。
- [ ] 套餐是否允许 UDP 协议。


### P1


- [ ] 套餐是否允许直连节点。
- [ ] 套餐是否必须走中转。
- [ ] 套餐是否允许高风险节点。
- [ ] 套餐客户端兼容策略。

### P2

- [ ] 价格字段预留。
- [ ] 订单字段预留。
- [ ] 优惠码字段预留。
- [ ] 支付系统接口预留。
- [ ] 套餐自动续期接口预留。

### Hiddify 参考

Hiddify 用户模型里有流量、套餐天数、开始日期、剩余天数、重置流量等能力。我们应保留这些能力，但把“套餐模板”独立成一等资源，便于后续商业化或多管理员分配。

## 6. Frontend Edge 管理

### P0

- [ ] Frontend Edge 创建。
- [ ] Frontend Edge 删除。
- [ ] Frontend Edge 启用 / 禁用。
- [ ] Frontend Edge 名称。
- [ ] Frontend Edge 地区。
- [ ] Frontend Edge 服务商。
- [ ] Frontend Edge 公网 IP。
- [ ] Frontend Edge 私网地址。
- [ ] Frontend Edge 标签。
- [ ] 生成 Frontend Edge bootstrap token。
- [ ] Frontend Edge 注册审核。
- [ ] Frontend Edge 正式凭据签发。
- [ ] Frontend Edge 凭据吊销。
- [ ] Frontend Edge 心跳。
- [ ] Frontend Edge 版本上报。
- [ ] Frontend Edge 健康状态。
- [ ] Frontend Edge 到 Backend Core 连通状态。
- [ ] Frontend Edge 配置下发。
- [ ] Frontend Edge 配置版本。
- [ ] Frontend Edge 配置回滚。
- [ ] Frontend Edge 域名列表。
- [ ] Frontend Edge 证书状态。
- [ ] Frontend Edge 工具站配置。
- [ ] Frontend Edge BFF 路由配置。
- [ ] Frontend Edge 管理员入口配置。
- [ ] Frontend Edge 用户中心入口配置。

### P1


- [ ] Frontend Edge 公开页面敏感词扫描结果。
- [ ] Frontend Edge JS bundle 敏感词扫描结果。
- [ ] Frontend Edge 异常访问统计。
- [ ] Frontend Edge 扫描路径统计。
- [ ] Frontend Edge 一键维护模式。

### P2

- [ ] 多 Frontend Edge 负载均衡。
- [ ] Frontend Edge 灰度发布。
- [ ] Frontend Edge 自动替换流程。
- [ ] Frontend Edge DNS 自动切换。
- [ ] Frontend Edge 可用性探针。

## 7. Subscription Edge 管理

### P0

- [ ] Subscription Edge 创建。
- [ ] Subscription Edge 删除。
- [ ] Subscription Edge 启用 / 禁用。
- [ ] Subscription Edge 名称。
- [ ] Subscription Edge 地区。
- [ ] Subscription Edge 服务商。
- [ ] Subscription Edge 公网 IP。
- [ ] Subscription Edge 私网地址。
- [ ] Subscription Edge 标签。
- [ ] 生成 Subscription Edge bootstrap token。
- [ ] Subscription Edge 注册审核。
- [ ] Subscription Edge 正式凭据签发。
- [ ] Subscription Edge 凭据吊销。
- [ ] Subscription Edge 心跳。
- [ ] Subscription Edge 版本上报。
- [ ] Subscription Edge 健康状态。
- [ ] Subscription Edge 到 Backend Core 连通状态。
- [ ] Subscription Edge 配置下发。
- [ ] Subscription Edge 配置版本。
- [ ] Subscription Edge 配置回滚。
- [ ] Subscription Edge 域名管理。
- [ ] Subscription Edge 证书状态。
- [ ] Subscription Edge 缓存 TTL。
- [ ] Subscription Edge 缓存清理。
- [ ] Subscription Edge 请求限速。
- [ ] Subscription Edge 异常 token 访问统计。
- [ ] Subscription Edge User-Agent 统计。
- [ ] Subscription Edge 客户端格式命中统计。
- [ ] Subscription Edge 订阅访问日志摘要。

### P1


### P2

- [ ] 多 Subscription Edge 调度。
- [ ] Subscription Edge 自动故障切换。
- [ ] 用户订阅按地区分配 Subscription Edge。
- [ ] 订阅入口轮换。

## 8. Proxy Node 管理

### P0

- [ ] 节点创建。
- [ ] 节点编辑。
- [ ] 节点删除。
- [ ] 节点启用 / 禁用。
- [ ] 节点名称。
- [ ] 节点地区。
- [ ] 节点服务商。
- [ ] 节点 ASN。
- [ ] 节点公网 IP。
- [ ] 节点私网 IP。
- [ ] 节点标签。
- [ ] 节点分组。
- [ ] 节点协议能力。
- [ ] 节点入口域名。
- [ ] 节点入口端口。
- [ ] 节点 Agent 注册。
- [ ] 节点 Agent token 签发。
- [ ] 节点 Agent 凭据吊销。
- [ ] 节点 Agent 心跳。
- [ ] 节点 Agent 版本上报。
- [ ] 节点系统资源上报。
- [ ] 节点进程状态上报。
- [ ] 节点端口监听状态上报。
- [ ] 节点配置下发。
- [ ] 节点配置版本。
- [ ] 节点配置回滚。
- [ ] 节点健康状态。
- [ ] 节点协议入站管理。
- [ ] 节点协议入站与用户访问节点关联。
- [ ] 直连访问节点生成。
- [ ] 从现有协议入站快速创建中转访问节点。
- [ ] 中转访问节点在节点列表中展示。
- [ ] 中转访问节点关联对应中转转发规则。
- [ ] 中转访问节点启停时同步启停对应转发规则。
- [ ] 中转访问节点删除时可选择同步删除对应转发规则。

### P1

- [ ] 节点安装命令生成。
- [ ] 节点一键重载。
- [ ] 节点一键重启代理核心。
- [ ] 节点一键诊断。
- [ ] 节点日志摘要。
- [ ] 节点负载统计。
- [ ] 节点带宽统计。
- [ ] 节点在线用户统计。
- [ ] 节点总流量统计。
- [ ] 节点按用户流量统计。
- [ ] 节点晚高峰标记。
- [ ] 节点成本字段。
- [ ] 节点到期时间。
- [ ] 节点续费提醒。

### P2

- [ ] 节点自动摘除。
- [ ] 节点自动恢复。
- [ ] 节点自动权重调整。
- [ ] 节点自动迁移用户。
- [ ] 节点配置灰度发布。
- [ ] 节点 A/B 测试。

### Hiddify 参考

Hiddify 的 parent/child 模式可以参考“多节点同步”的方向，但不建议照搬。我们应该使用明确的 Node Agent 模型：Agent 主动连接 Backend Core，拉取配置，上报状态，执行命令并回传结果。

### 节点关联设计

为避免和 Hiddify 的 parent/child 混淆，第一版不使用“父节点/子节点”作为数据库模型名称，而使用下面的资源关系：

- `Proxy Node`：真实落地代理服务器，例如一台运行 VLESS + REALITY 或 Hysteria2 的节点机。
- `Node Inbound`：落地节点上的一个协议入站，例如某台节点上的 VLESS + REALITY TCP 入站、Hysteria2 UDP 入站。
- `Transit Relay`：真实中转服务器，例如 Realm/gost/HAProxy/Nginx stream 所在服务器。
- `Relay Rule`：中转服务器上的一条转发规则，例如 `relay_ip:443 -> proxy_node_ip:443`。
- `Access Node`：用户在节点列表和订阅里看到的“可访问节点”，可以是直连，也可以是中转。

`Access Node` 类型：

- `direct`：直连访问节点，直接使用落地节点的公网域名/IP 和端口。
- `relay`：中转访问节点，使用中转服务器的公网域名/IP 和入口端口，实际转发到某个落地节点入站。

典型流程：

1. 管理员添加一个 VLESS + REALITY 节点。
2. Backend Core 创建 `Proxy Node` 和对应 `Node Inbound`。
3. 系统自动创建一个 `direct Access Node`，用户可以直连该节点。
4. 管理员点击“添加中转访问节点”。
5. 管理员选择已有的中转服务器、入口端口、TCP/UDP、显示名称、标签、分组、套餐权限。
6. Backend Core 自动创建一个 `relay Access Node`。
7. Backend Core 同步创建一条 `Relay Rule`。
8. `relay Access Node` 出现在节点列表中。
9. 同一条 `Relay Rule` 也出现在中转管理的转发规则列表中。
10. 配置发布后，Relay Agent 拉取并应用 Realm/gost/HAProxy 配置。

订阅生成规则：

- 直连访问节点使用落地节点地址和端口。
- 中转访问节点使用中转服务器地址和入口端口。
- VLESS + REALITY 的 UUID、public key、shortId、serverName 等协议参数来自原始 `Node Inbound`。
- Hysteria2 的 password、obfs、sni、alpn 等协议参数来自原始 `Node Inbound`。
- 中转层只改变用户连接的入口地址和端口，不改变用户身份凭据。
- 如果同一个落地节点同时有直连和多个中转入口，订阅里可以显示为多个不同的 `Access Node`。

联动规则：

- 禁用落地节点时，默认禁用其所有直连和中转访问节点。
- 禁用协议入站时，默认禁用关联的所有访问节点。
- 禁用中转服务器时，默认禁用该中转服务器上的所有中转访问节点。
- 修改落地节点入站端口时，关联的中转规则需要进入“待重新发布”状态。
- 修改中转访问节点入口端口时，关联的中转规则需要进入“待重新发布”状态。
- 删除中转访问节点时，可以选择保留或删除对应中转规则；默认删除。
- 删除中转规则时，关联的中转访问节点应标记为异常或一并删除。

## 9. 协议配置管理

Backend Core 不直接运行协议核心，但要生成协议配置、客户端订阅、健康检查任务和 Agent 目标状态。

### 9.1 VLESS + REALITY

#### P0

- [ ] VLESS + REALITY 协议模板。
- [ ] 每节点独立 REALITY key pair。
- [ ] REALITY private key 安全存储。
- [ ] REALITY public key 展示。
- [ ] REALITY shortId 生成。
- [ ] REALITY shortId 轮换。
- [ ] REALITY serverNames 管理。
- [ ] REALITY dest 管理。
- [ ] REALITY spiderX 管理。
- [ ] VLESS UUID 来自用户协议凭据。
- [ ] VLESS flow 管理，默认 `xtls-rprx-vision`。
- [ ] TCP 传输。
- [ ] 节点端口管理。
- [ ] Xray server config 生成。
- [ ] sing-box server config 生成可选。
- [ ] VLESS 分享链接生成。
- [ ] sing-box outbound 生成。
- [ ] Clash Meta 配置生成。

#### P1

- [ ] REALITY 目标站兼容性检查。
- [ ] REALITY 目标站证书检查。
- [ ] REALITY 目标站 ASN 提醒。
- [ ] REALITY key 轮换计划。
- [ ] REALITY 握手健康检查。
- [ ] gRPC REALITY。
- [ ] XHTTP REALITY。

#### 暂缓

- [ ] 复杂下载域名拆分。
- [ ] 高级 XHTTP 多路径策略。

### 9.2 Hysteria2

#### P0

- [ ] Hysteria2 协议模板。
- [ ] Hysteria2 节点端口管理。
- [ ] Hysteria2 TLS 证书引用。
- [ ] Hysteria2 用户 password 来自用户协议凭据。
- [ ] Hysteria2 obfs 开关。
- [ ] Hysteria2 obfs password 独立生成。
- [ ] Hysteria2 up Mbps。
- [ ] Hysteria2 down Mbps。
- [ ] Hysteria2 server config 生成。
- [ ] Hysteria2 客户端链接生成。
- [ ] sing-box outbound 生成。
- [ ] Clash Meta 配置生成。
- [ ] Hysteria2 UDP 可用性检查。

#### P1

- [ ] Hysteria2 masquerade 配置。
- [ ] Hysteria2 按节点覆盖 up/down Mbps。
- [ ] Hysteria2 按套餐覆盖 up/down Mbps。
- [ ] Hysteria2 obfs password 轮换。
- [ ] Hysteria2 连通性健康检查。
- [ ] Hysteria2 用户动态增删策略。

#### 关键设计决策

- 不建议使用用户 UUID 直接作为 Hysteria2 password。
- 不建议使用全局 proxy_path 作为 Hysteria2 obfs password。
- Hysteria2 依赖 UDP/QUIC，必须允许用户套餐同时配 VLESS + REALITY 作为 TCP fallback。

### 9.3 其他协议

#### P1

- [ ] TUIC 预留协议模型。

#### 暂缓

- [ ] Trojan。
- [ ] VMess。
- [ ] Shadowsocks2022。
- [ ] SSH。
- [ ] WireGuard。
- [ ] Naive。
- [ ] Mieru。
- [ ] DNSTT。

#### 不做

- [ ] SSR。
- [ ] Telegram proxy。
- [ ] WARP 出站作为第一版核心能力。

## 10. Transit Relay / 中转管理

### P0

- [ ] 中转服务器创建。
- [ ] 中转服务器编辑。
- [ ] 中转服务器删除。
- [ ] 中转服务器启用 / 禁用。
- [ ] 中转服务器名称。
- [ ] 中转服务器地区。
- [ ] 中转服务器服务商。
- [ ] 中转服务器 ASN。
- [ ] 中转服务器公网 IP。
- [ ] 中转服务器私网 IP。
- [ ] 中转服务器标签。
- [ ] 中转服务器分组。
- [ ] Relay Agent 注册。
- [ ] Relay Agent token 签发。
- [ ] Relay Agent 凭据吊销。
- [ ] Relay Agent 心跳。
- [ ] Relay Agent 版本上报。
- [ ] Realm 支持。
- [ ] TCP 转发规则。
- [ ] UDP 转发规则。
- [ ] 中转入口端口。
- [ ] 中转目标节点。
- [ ] 中转目标端口。
- [ ] 中转目标协议入站。
- [ ] 中转规则关联访问节点。
- [ ] 转发规则启停。
- [ ] 转发规则配置版本。
- [ ] 转发规则下发。
- [ ] 转发规则回滚。
- [ ] 中转进程状态。
- [ ] 中转端口监听状态。
- [ ] 中转总流量统计。

### P1

- [ ] gost 支持。
- [ ] HAProxy TCP stream 支持。
- [ ] Nginx stream 支持。
- [ ] 一条中转到多个目标节点。
- [ ] 多条转发规则批量管理。
- [ ] 中转规则模板。
- [ ] 中转链路 TCP 测试。
- [ ] 中转链路 UDP 测试。
- [ ] 中转链路延迟测试。
- [ ] 中转链路丢包测试。
- [ ] 中转带宽统计。
- [ ] 中转连接数统计。
- [ ] 中转按目标节点统计流量。
- [ ] 中转按用户统计流量，能做到时再启用。

### P2

- [ ] 中转自动摘除。
- [ ] 中转自动恢复。
- [ ] 中转链路自动切换。
- [ ] 中转权重调度。
- [ ] 多级中转链。

## 11. 域名、证书与 DNS 管理

### P0

- [ ] 域名资源表。
- [ ] 域名归属角色：frontend、subscription、node、relay、reality-target。
- [ ] 域名启用 / 禁用。
- [ ] 域名标签。
- [ ] 域名解析状态记录。
- [ ] 证书资源表。
- [ ] 证书到期时间。
- [ ] 证书引用关系。
- [ ] 节点证书下发引用。
- [ ] Subscription Edge 证书状态记录。
- [ ] Frontend Edge 证书状态记录。

### P1

- [ ] Cloudflare zone 管理。
- [ ] Cloudflare API token 管理。
- [ ] 受限 Cloudflare API token 权限检查。
- [ ] DNS 记录创建。
- [ ] DNS 记录更新。
- [ ] DNS 记录删除。
- [ ] Let's Encrypt DNS-01 任务管理。
- [ ] Let's Encrypt HTTP-01 任务管理。
- [ ] 证书自动续期。
- [ ] 证书续期失败告警。
- [ ] 证书下发到 Edge/Node。
- [ ] 域名解析到目标 IP 检查。

### P2

- [ ] 多 DNS 服务商。
- [ ] Cloudflare 代理状态管理。
- [ ] Cloudflare Origin Certificate 管理。
- [ ] 域名健康评分。

### Hiddify 参考

Hiddify 的 Domain 模型很强，但它把 direct、CDN、relay、fake、sub-link、REALITY 等全部放在同一个面板节点体系里。我们可以保留“域名作为资源”的思想，但要按角色拆分，避免域名模型驱动出大量隐式协议组合。

## 12. 订阅策略与订阅生成

Backend Core 负责订阅策略和订阅内容生成逻辑，Subscription Edge 负责公开承载、缓存、限速和转发。

### P0

- [ ] 单用户订阅 token。
- [ ] 订阅 token 重置。
- [ ] 订阅 token 启停。
- [ ] 订阅过期处理。
- [ ] 按用户套餐过滤节点。
- [ ] 按用户可访问节点组过滤。
- [ ] 按用户可访问中转组过滤。
- [ ] 按用户可访问协议过滤。
- [ ] 隐藏停用节点。
- [ ] 隐藏故障节点，可配置。
- [ ] sing-box JSON 生成。
- [ ] Clash Meta YAML 生成。
- [ ] v2rayN links 生成。
- [ ] Shadowrocket links 生成。
- [ ] 通用 URI links 生成。
- [ ] Base64 links 生成。
- [ ] `Subscription-Userinfo` 响应头数据。
- [ ] `profile-update-interval` 响应头数据。
- [ ] `profile-title` 响应头数据。

### P1

- [ ] User-Agent 识别策略。
- [ ] 自动返回最佳订阅格式。
- [ ] 客户端兼容性规则。
- [ ] 老 Clash 自动过滤 Hysteria2。
- [ ] 节点排序策略。
- [ ] 节点命名模板。
- [ ] 节点地区 emoji 开关。
- [ ] 中转节点展示策略。
- [ ] 直连节点展示策略。
- [ ] 同一落地节点多中转入口展示策略。
- [ ] 订阅缓存策略。
- [ ] 订阅缓存主动失效。
- [ ] 订阅访问日志摘要。
- [ ] 订阅滥用检测。

### P2

- [ ] 用户自定义订阅排序。
- [ ] 用户自定义显示地区。
- [ ] 按客户端输出不同节点集合。
- [ ] 按网络质量动态输出节点。
- [ ] 外部订阅合并。

### 风险控制

- 外部订阅合并类似 Hiddify additional configs，功能强但风险也高，建议后续只给 super admin，并做内容校验。

## 13. 配置生成、下发与回滚

### P0

- [ ] Desired State 模型。
- [ ] 配置版本号。
- [ ] 配置生成任务。
- [ ] 配置 diff。
- [ ] 配置校验。
- [ ] Xray 配置生成。
- [ ] Hysteria2 配置生成。
- [ ] sing-box 配置生成。
- [ ] Realm 配置生成。
- [ ] Agent 拉取配置。
- [ ] Agent 应用配置回执。
- [ ] Agent 应用失败回执。
- [ ] 配置发布记录。
- [ ] 配置回滚。
- [ ] 配置锁，避免并发发布冲突。

### P1

- [ ] 配置模板管理。
- [ ] 配置 dry-run。
- [ ] 灰度发布。
- [ ] 分批发布。
- [ ] 只更新用户。
- [ ] 只更新协议。
- [ ] 只更新中转规则。
- [ ] 发布前健康检查。
- [ ] 发布后健康检查。
- [ ] 自动回滚策略。

### P2

- [ ] 可视化配置 diff。
- [ ] 配置审批流。
- [ ] 配置变更风险评分。

### Hiddify 参考

Hiddify 支持 apply configs、apply users、reinstall 等脚本式流程。我们保留“配置版本化”和“只应用用户”的能力，但不让 Web 后端直接 sudo 执行系统脚本，所有执行动作通过 Agent 完成。

## 14. Agent API

### P0

- [ ] Bootstrap token 生成。
- [ ] Bootstrap token 一次性使用。
- [ ] Agent 注册。
- [ ] Agent 正式凭据签发。
- [ ] Agent 凭据吊销。
- [ ] Agent 心跳 API。
- [ ] Agent 拉取目标状态 API。
- [ ] Agent 上报实际状态 API。
- [ ] Agent 上报配置应用结果 API。
- [ ] Agent 上报进程状态 API。
- [ ] Agent 上报端口状态 API。
- [ ] Agent 上报系统资源 API。
- [ ] Agent 上报流量 API。
- [ ] Agent 上报错误 API。
- [ ] Agent 命令领取 API。
- [ ] Agent 命令回执 API。
- [ ] Agent 版本兼容检查。

### P1

- [ ] mTLS Agent 认证。
- [ ] Agent 日志摘要上报。
- [ ] Agent 诊断包上传。
- [ ] Agent 自升级任务。
- [ ] Agent 配置文件校验结果上报。
- [ ] Agent 本机组件版本上报：Xray、sing-box、Hysteria2、Realm、gost。
- [ ] Agent 操作幂等 key。

### P2

- [ ] Agent 长连接通道。
- [ ] Agent WebSocket/SSE command stream。
- [ ] Agent 离线命令队列。
- [ ] Agent 多通道容灾。

## 15. 流量统计与额度扣减

### P0

- [ ] 用户累计流量。
- [ ] 用户上传流量。
- [ ] 用户下载流量。
- [ ] 节点总流量。
- [ ] 中转总流量。
- [ ] 协议维度流量。
- [ ] 每日流量统计。
- [ ] 每小时流量统计。
- [ ] Xray stats 采集。
- [ ] Hysteria2 / sing-box stats 或日志采集。
- [ ] Agent 增量流量上报。
- [ ] 流量增量去重。
- [ ] 用户超流量自动停用。
- [ ] 用户到期自动停用。
- [ ] 用户恢复后自动重新下发配置。

### P1

- [ ] 分节点用户流量。
- [ ] 分中转用户流量。
- [ ] 在线用户估算。
- [ ] 用户最近活跃时间。
- [ ] 用户流量异常检测。
- [ ] 节点流量异常检测。
- [ ] 流量统计修正工具。
- [ ] 手动更新用户流量。
- [ ] 手动扣减 / 增加流量。
- [ ] 流量账单导出。

### P2

- [ ] 95 计费统计。
- [ ] 成本核算。
- [ ] 毛利统计。
- [ ] 服务商账单导入。

## 16. 健康检查、测速与监控

### P0

- [ ] Backend Core 健康检查。
- [ ] 数据库健康检查。
- [ ] Redis 健康检查。
- [ ] Frontend Edge 心跳。
- [ ] Subscription Edge 心跳。
- [ ] Node Agent 心跳。
- [ ] Relay Agent 心跳。
- [ ] Xray 进程状态。
- [ ] Hysteria2 进程状态。
- [ ] Realm 进程状态。
- [ ] TCP 端口监听检查。
- [ ] UDP 端口可用性检查。
- [ ] VLESS + REALITY 握手检查。
- [ ] Hysteria2 握手检查。
- [ ] 中转 TCP 链路检查。
- [ ] 中转 UDP 链路检查。

### P1

- [ ] 节点延迟测试。
- [ ] 节点丢包测试。
- [ ] 中转链路延迟测试。
- [ ] 中转链路丢包测试。
- [ ] 晚高峰定时测试。
- [ ] 多探针测试。
- [ ] 按运营商测试。
- [ ] 节点质量评分。
- [ ] 中转质量评分。
- [ ] 故障自动标记。
- [ ] 故障恢复自动标记。

### P2

- [ ] 自动摘除故障节点。
- [ ] 自动摘除故障中转。
- [ ] 根据质量自动调整订阅排序。
- [ ] 根据地区/运营商动态推荐节点。
- [ ] 新服务器线路评估报告。

## 17. 告警与通知

### P0

- [ ] 后端严重错误告警。
- [ ] Agent 离线告警。
- [ ] 节点故障告警。
- [ ] 中转故障告警。
- [ ] 证书即将过期告警。
- [ ] 配置下发失败告警。
- [ ] 数据库备份失败告警。

### P1

- [ ] Telegram Bot 通知。
- [ ] Email 通知。
- [ ] Webhook 通知。
- [ ] Slack/Discord 通知预留。
- [ ] 用户到期提醒。
- [ ] 用户流量即将用尽提醒。
- [ ] 节点到期提醒。
- [ ] 服务商续费提醒。

### 说明

这里的 Telegram 只作为通知渠道，不做 Telegram proxy。

## 18. 审计日志与操作记录

### P0

- [ ] 管理员登录日志。
- [ ] 管理员登出日志。
- [ ] 登录失败日志。
- [ ] 用户创建/修改/删除日志。
- [ ] 套餐修改日志。
- [ ] 节点修改日志。
- [ ] 中转修改日志。
- [ ] 订阅策略修改日志。
- [ ] 配置发布日志。
- [ ] 配置回滚日志。
- [ ] Agent 注册日志。
- [ ] Agent 凭据吊销日志。
- [ ] API key 创建/删除日志。
- [ ] 敏感信息查看日志。

### P1

- [ ] 审计日志搜索。
- [ ] 审计日志导出。
- [ ] 审计日志保留策略。
- [ ] 高风险操作二次确认。
- [ ] 高风险操作通知。
- [ ] 操作前后 diff 记录。

## 19. 备份、恢复与迁移

### P0

- [ ] 数据库备份。
- [ ] 配置备份。
- [ ] 密钥备份提示。
- [ ] 手动备份。
- [ ] 定时备份。
- [ ] 备份文件校验。
- [ ] 备份列表。
- [ ] 本地恢复。
- [ ] 恢复前二次确认。

### P1

- [ ] 远程对象存储备份。
- [ ] 加密备份。
- [ ] 备份恢复演练。
- [ ] 按模块恢复：用户、节点、中转、订阅策略、系统设置。
- [ ] Marzban 用户导入。
- [ ] X-UI 用户导入。
- [ ] Hiddify 用户导入。
- [ ] Realm 规则导入。

### P2

- [ ] 自动灾备切换。
- [ ] 多 Backend Core 高可用数据同步。

## 20. 安全与密钥管理

### P0

- [ ] 密码哈希。
- [ ] API key 哈希存储。
- [ ] token 只显示一次。
- [ ] secret 加密存储。
- [ ] 系统主密钥管理。
- [ ] mTLS 证书管理。
- [ ] bootstrap token 过期时间。
- [ ] bootstrap token 使用次数限制。
- [ ] Agent 凭据轮换。
- [ ] Edge 凭据轮换。
- [ ] 管理 API 限速。
- [ ] Agent API 限速。
- [ ] Edge API 限速。
- [ ] IP allowlist。
- [ ] 请求签名。
- [ ] 重放攻击防护。

### P1

- [ ] 敏感字段脱敏显示。
- [ ] secret 查看二次确认。
- [ ] secret 查看审计。
- [ ] Cloudflare token 加密存储。
- [ ] Cloudflare token 权限检查。
- [ ] 数据库字段级加密。
- [ ] 管理员 2FA 强制策略。

### 不做

- [ ] Web 后端直接 sudo 执行系统命令。
- [ ] Web 后端直接 SSH 到节点执行脚本。
- [ ] 把 root 密码、SSH 私钥长期存储在 Backend Core。

## 21. API 模块

### P0

- [ ] Admin API。
- [ ] User API，经 Frontend Edge 调用。
- [ ] Frontend Edge API。
- [ ] Subscription Edge API。
- [ ] Node Agent API。
- [ ] Relay Agent API。
- [ ] Health API。
- [ ] OpenAPI 文档。
- [ ] API 版本号。
- [ ] API 兼容策略。
- [ ] API 错误码规范。
- [ ] API 分页规范。
- [ ] API filter/sort/search 规范。

### P1

- [ ] Service Account API。
- [ ] Webhook API。
- [ ] Prometheus metrics API。
- [ ] API 调用审计。
- [ ] API 调用速率统计。

### Hiddify 参考

Hiddify 有 Admin API、User API、Parent API、Child API、Panel API。我们不照搬 parent/child，而是拆成 Edge API 和 Agent API，边界更清楚。

## 22. 任务队列与定时任务

### P0

- [ ] 配置生成任务。
- [ ] 配置发布任务。
- [ ] Agent 心跳过期检查。
- [ ] 流量采集任务。
- [ ] 用户到期检查任务。
- [ ] 用户超流量检查任务。
- [ ] 健康检查任务。
- [ ] 备份任务。
- [ ] 告警任务。

### P1

- [ ] 证书续期任务。
- [ ] DNS 检查任务。
- [ ] 晚高峰测速任务。
- [ ] 节点质量评分任务。
- [ ] 日报任务。
- [ ] 清理历史日志任务。
- [ ] 清理过期 token 任务。

### P2

- [ ] 任务优先级。
- [ ] 任务重试策略可配置。
- [ ] 任务依赖 DAG。
- [ ] 任务执行可视化。

## 23. Dashboard 与统计接口

### P0

- [ ] 系统总览。
- [ ] 用户数量。
- [ ] 活跃用户数量。
- [ ] 过期用户数量。
- [ ] 超流量用户数量。
- [ ] 节点数量。
- [ ] 在线节点数量。
- [ ] 故障节点数量。
- [ ] 中转数量。
- [ ] 在线中转数量。
- [ ] 故障中转数量。
- [ ] 今日总流量。
- [ ] 本月总流量。
- [ ] 最近告警。
- [ ] 最近配置发布。

### P1

- [ ] 节点排行。
- [ ] 中转排行。
- [ ] 用户流量排行。
- [ ] 协议占比。
- [ ] 地区占比。
- [ ] 服务商占比。
- [ ] 订阅客户端占比。
- [ ] 可用性趋势。
- [ ] 延迟趋势。
- [ ] 丢包趋势。

## 24. 版本、升级与发布管理

### P0

- [ ] Backend Core 使用同一套 GitHub release / Git tag / 语义化版本号。
- [ ] Backend Core 支持 `sudo ./install.sh --role backend-core`。
- [ ] Backend Core 支持 `panelctl` 统一运维命令。
- [ ] Backend Core 当前版本。
- [ ] 数据库 schema 版本。
- [ ] Frontend Edge 兼容版本。
- [ ] Subscription Edge 兼容版本。
- [ ] Node Agent 兼容版本。
- [ ] Relay Agent 兼容版本。
- [ ] 组件兼容版本矩阵。
- [ ] Backend Core 初始化向导。
- [ ] Backend Core 非交互式安装参数。
- [ ] Backend Core 依赖安装：PostgreSQL、Redis、任务队列。
- [ ] Backend Core 系统密钥初始化。
- [ ] Backend Core super admin 初始化。
- [ ] 数据库迁移。
- [ ] 升级前备份。
- [ ] Backend Core 升级前数据库备份。
- [ ] Backend Core 升级前 schema 检查。
- [ ] 升级后健康检查。
- [ ] 升级失败回滚。
- [ ] Backend Core 应用版本回滚。
- [ ] Backend Core 数据库迁移回滚或破坏性迁移阻止。
- [ ] 安装命令生成。
- [ ] 接入命令生成。
- [ ] Backend Core 生成 Frontend Edge 接入命令。
- [ ] Backend Core 生成 Subscription Edge 接入命令。
- [ ] Backend Core 生成 Node Agent 接入命令。
- [ ] Backend Core 生成 Relay Agent 接入命令。
- [ ] `panelctl init`。
- [ ] `panelctl migrate`。
- [ ] `panelctl backup-db`。
- [ ] `panelctl restore-db`。
- [ ] `panelctl create-bootstrap-token`。
- [ ] `panelctl rotate-secrets`。

### P1

- [ ] Release channel：stable、beta。
- [ ] 远程版本检查。
- [ ] 一键升级所有 Agent。
- [ ] 分批升级 Agent。
- [ ] 升级窗口设置。
- [ ] 升级日志上报。

## 25. 建议的数据模型

第一版建议至少包含以下核心表或等价模型：

- [ ] `admin_users`
- [ ] `admin_roles`
- [ ] `admin_sessions`
- [ ] `api_keys`
- [ ] `users`
- [ ] `user_credentials`
- [ ] `user_groups`
- [ ] `plans`
- [ ] `plan_permissions`
- [ ] `usage_records`
- [ ] `daily_usage`
- [ ] `frontend_edges`
- [ ] `subscription_edges`
- [ ] `proxy_nodes`
- [ ] `node_inbounds`
- [ ] `access_nodes`
- [ ] `transit_relays`
- [ ] `relay_rules`
- [ ] `node_groups`
- [ ] `relay_groups`
- [ ] `domains`
- [ ] `certificates`
- [ ] `protocol_profiles`
- [ ] `subscription_policies`
- [ ] `subscription_tokens`
- [ ] `config_versions`
- [ ] `deployments`
- [ ] `agent_credentials`
- [ ] `agent_heartbeats`
- [ ] `health_checks`
- [ ] `metrics`
- [ ] `alerts`
- [ ] `audit_logs`
- [ ] `backup_records`
- [ ] `tasks`
- [ ] `system_settings`

## 26. 第一版 MVP 建议保留

如果要尽快进入开发，第一版后端我建议只锁定这些：

- [ ] super admin 登录。
- [ ] 密码哈希。
- [ ] 基础 RBAC。
- [ ] 用户 CRUD。
- [ ] 用户订阅 token。
- [ ] 用户协议凭据分离。
- [ ] 流量上限。
- [ ] 到期时间。
- [ ] 套餐。
- [ ] 节点 CRUD。
- [ ] 节点分组。
- [ ] VLESS + REALITY。
- [ ] Hysteria2。
- [ ] Realm 中转。
- [ ] Frontend Edge 注册与心跳。
- [ ] Subscription Edge 注册与心跳。
- [ ] Node Agent 注册与心跳。
- [ ] Relay Agent 注册与心跳。
- [ ] sing-box 订阅。
- [ ] Clash Meta 订阅。
- [ ] v2rayN / Shadowrocket links。
- [ ] `Subscription-Userinfo`。
- [ ] 配置版本。
- [ ] 配置下发。
- [ ] 配置回滚。
- [ ] Xray 流量统计。
- [ ] Hysteria2 流量统计。
- [ ] 节点健康检查。
- [ ] 中转健康检查。
- [ ] 审计日志。
- [ ] 数据库备份。
- [ ] 一键安装 / 升级所需的版本接口。

## 27. 建议第一版暂时砍掉

- [ ] DNSTT。
- [ ] Mieru。
- [ ] Naive。
- [ ] Telegram proxy。
- [ ] WARP。
- [ ] WireGuard。
- [ ] SSR。
- [ ] Hiddify 式 HAProxy 多协议共用 443。
- [ ] 复杂 CDN / Worker 分流。
- [ ] XHTTP 下载域名拆分。
- [ ] 多级代理商。
- [ ] 支付系统。
- [ ] 自动按网络质量动态订阅。
- [ ] 多 Backend Core 高可用。
- [ ] Kubernetes 部署。

## 28. 需要你筛选的问题

后续你可以按下面几个方向删改：

- 第一版是否只做 super admin，还是要直接做多管理员？
单管理员

- 第一版是否需要 agent/代理商角色？  
不需要代理商角色

- 套餐是否需要价格、订单、支付字段？
不需要，这个面板只是为了更好的管理

- 用户协议凭据是否必须全部分离？
在保证安全的前提下，越简单越好

- Hysteria2 是否第一版必须支持 obfs？
是

- 节点是否允许用户直连，还是必须全部走中转？
允许用户直连接，假如中转服务器被ban，用户还能直连节点使用

- Realm 是否第一版只做 TCP，UDP 放二期？
udp也要做

- Cloudflare API token 是由 Backend Core 统一管，还是各 Edge 本地管？
各edge本地管

- 是否需要从 Marzban/X-UI/Hiddify 导入用户？
不需要

- 是否要第一版就做 Telegram/Email/Webhook 告警？
要做email告警、每日服务自检报告，用gmail邮箱来发送
