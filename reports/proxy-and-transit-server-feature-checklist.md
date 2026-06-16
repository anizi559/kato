# 自研代理系统 Proxy Node / Transit Relay 功能清单草案

记录日期：2026-06-15

## 0. 文档目的

这份清单用于确定“代理服务器 Proxy Node”和“中转服务器 Transit Relay”应该具备哪些功能。

参考基础：

- 总体架构：`面板前端服务器 + 面板后端服务器 + 订阅服务器 + 中转服务器 + 若干代理节点`
- Backend Core 不直接运行代理协议和中转程序
- Proxy Node 只运行代理协议、Node Agent、必要的本地运行组件
- Transit Relay 只运行中转程序、Relay Agent、必要的本地运行组件
- 所有节点和中转都通过 Agent 主动连接 Backend Core

优先级说明：

- `P0`：第一版必须做。
- `P1`：第一版之后优先做。
- `P2`：后续高级能力。
- `暂缓`：目前先不纳入。
- `不做`：不符合当前架构或风险较高。

## 1. 总体边界

### Proxy Node 应该做

- 运行 VLESS + REALITY。
- 运行 Hysteria2。
- 管理本机协议入站。
- 接收直连用户流量。
- 接收中转服务器转发过来的流量。
- 通过 Node Agent 主动连接 Backend Core。
- 拉取目标配置。
- 应用配置。
- 回滚配置。
- 上报状态。
- 上报流量。
- 上报健康检查结果。

### Transit Relay 应该做

- 运行 Realm。
- 第一版支持 TCP 转发。
- 第一版支持 UDP 转发。
- 管理本机转发规则。
- 接收用户入口流量。
- 转发到 Proxy Node 的协议入站。
- 通过 Relay Agent 主动连接 Backend Core。
- 拉取中转规则。
- 应用中转配置。
- 回滚中转配置。
- 上报状态。
- 上报流量。
- 上报健康检查结果。

### Proxy Node / Transit Relay 不应该做

- 不运行面板前端。
- 不运行 Backend Core。
- 不直接连接数据库。
- 不保存所有用户业务数据。
- 不暴露管理后台。
- 不开放 Web 管理端口。
- 不保存 Backend Core 的数据库密码。
- 不保存其他节点的私钥。
- 不主动 SSH 到其他服务器。
- 不接受浏览器直接管理。

## 2. 统一安装、版本与运维

Proxy Node 和 Transit Relay 的安装、版本管理、升级、回滚方式必须和 Backend Core、Frontend Edge 保持一致。

### P0

- [ ] 支持 GitHub release。
- [ ] 支持 Git tag 版本。
- [ ] 支持语义化版本号。
- [ ] 支持 `sudo ./install.sh --role proxy-node`。
- [ ] 支持 `sudo ./install.sh --role transit-relay`。
- [ ] 支持 `panelctl status`。
- [ ] 支持 `panelctl logs`。
- [ ] 支持 `panelctl doctor`。
- [ ] 支持 `panelctl restart`。
- [ ] 支持 `panelctl reload`。
- [ ] 支持 `panelctl upgrade`。
- [ ] 支持 `panelctl rollback`。
- [ ] 支持 `panelctl version`。
- [ ] 安装后显示当前角色。
- [ ] 安装后显示当前版本。
- [ ] 安装后显示 Backend Core 连接状态。
- [ ] 安装后显示本机公网 IP。
- [ ] 安装后显示本机监听端口。
- [ ] 升级前备份本机配置。
- [ ] 升级后执行健康检查。
- [ ] 升级失败自动回滚。

### P1

- [ ] 支持非交互式安装参数。
- [ ] 支持指定版本安装。
- [ ] 支持 stable / beta release channel。
- [ ] 支持 Agent 自升级。
- [ ] 支持分批升级。
- [ ] 支持升级日志上报 Backend Core。
- [ ] 支持导出诊断包。

### 1c1g 轻量运行模式

大多数 Proxy Node 和 Transit Relay 可能是 1c1g 小规格云服务器，因此数据面必须有轻量运行模式。

#### P0

- [ ] Proxy Node 支持 1c1g 轻量模式。
- [ ] Transit Relay 支持 1c1g 轻量模式。
- [ ] 1c1g 轻量模式优先使用 systemd + 静态二进制部署。
- [ ] 1c1g 轻量模式不强制使用 Docker Compose。
- [ ] 1c1g 轻量模式不安装数据库。
- [ ] 1c1g 轻量模式不安装 Redis。
- [ ] 1c1g 轻量模式不安装任务队列。
- [ ] 1c1g 轻量模式不运行 Web 管理界面。
- [ ] Agent 常驻内存目标尽量控制在 50MB 以内。
- [ ] Agent 空闲 CPU 占用应接近 0。
- [ ] 健康检查采用低频采样，避免持续压测本机。
- [ ] 流量统计采用增量采集，避免高频解析大日志。
- [ ] 日志默认轮转和限量保存。
- [ ] `panelctl doctor` 只在手动执行或 Backend Core 下发诊断任务时运行。
- [ ] 外部测速、三网探针、晚高峰测试默认不在 1c1g 节点本机执行。

#### P1

- [ ] 安装脚本根据内存和 CPU 自动推荐轻量模式。
- [ ] 支持 `sudo ./install.sh --role proxy-node --profile lite`。
- [ ] 支持 `sudo ./install.sh --role transit-relay --profile lite`。
- [ ] 支持资源水位告警。
- [ ] 支持 Agent 采样频率动态下调。
- [ ] 支持低内存时暂停非关键诊断任务。

## 3. Agent 通用能力

Node Agent 和 Relay Agent 可以共用大量底层能力，但角色不同、配置不同。

### soga 参考原则

soga 的节点端设计很适合参考：节点主动向面板拉取配置和用户，按间隔推送流量和状态，配置未变化时避免重复传输。

我们吸收这个方向，但不照搬 soga 的自研协议内核。第一版仍使用 Xray-core、Hysteria2/sing-box、Realm 等成熟运行组件。

### P0

- [ ] 读取本机角色：proxy-node 或 transit-relay。
- [ ] 使用 bootstrap token 注册 Backend Core。
- [ ] bootstrap token 一次性使用。
- [ ] 注册后换取正式 Agent 凭据。
- [ ] 正式 Agent 凭据本地安全保存。
- [ ] 支持 Agent 凭据轮换。
- [ ] 支持 Agent 凭据吊销后停止拉取配置。
- [ ] 主动向 Backend Core 心跳。
- [ ] 主动拉取 desired state。
- [ ] 支持节点配置和用户/规则数据分开拉取。
- [ ] 支持配置版本条件拉取。
- [ ] 支持 ETag / If-None-Match 或等价机制。
- [ ] 配置未变化时使用轻量响应，避免重复下发完整配置。
- [ ] 支持 Backend Core 下发 pull interval。
- [ ] 支持 Backend Core 下发 push interval。
- [ ] 支持 1c1g 轻量模式下自动使用较低轮询频率。
- [ ] 上报 actual state。
- [ ] 上报配置应用结果。
- [ ] 上报错误信息。
- [ ] 上报本机系统信息。
- [ ] 上报本机组件版本。
- [ ] 支持命令领取。
- [ ] 支持命令执行回执。
- [ ] 支持配置版本号。
- [ ] 支持配置签名校验。
- [ ] 支持配置应用锁，避免并发应用。
- [ ] 支持配置回滚。
- [ ] 支持本机日志摘要。
- [ ] 支持连接 Backend Core 失败后的本地运行。
- [ ] Backend Core 短暂离线时不影响现有代理流量。
- [ ] 支持 last known good config。
- [ ] Backend Core 不可用时继续使用最后一次成功应用的配置。
- [ ] Backend Core 不可用时禁止清空用户、入站、证书和中转规则。
- [ ] Backend Core 不可用时进入离线容灾模式。
- [ ] 离线容灾模式状态写入本地日志。
- [ ] Backend Core 恢复后自动重新同步配置和补报状态。

### P1

- [ ] 支持 mTLS。
- [ ] 支持 WireGuard 私网连接 Backend Core。
- [ ] 支持 Agent 操作幂等 key。
- [ ] 支持配置 dry-run。
- [ ] 支持诊断包上传。
- [ ] 支持长连接命令通道。
- [ ] 支持离线命令队列。
- [ ] 支持离线期间的流量增量缓存。
- [ ] 支持恢复连接后补报离线期间流量。
- [ ] 支持按节点动态调整 pull interval。
- [ ] 支持按节点动态调整 push interval。
- [ ] 支持多实例管理，类似 `soga@.service`。

### 不做

- [ ] Backend Core 直接 SSH 到节点执行命令。
- [ ] Agent 开公网 Web 管理后台。
- [ ] Agent 保存 Backend Core 管理员账号密码。
- [ ] 第一版自研完整代理协议内核。

## 4. Proxy Node 基础能力

### P0

- [ ] 安装 Node Agent。
- [ ] 安装 Xray-core。
- [ ] 安装 sing-box 或 Hysteria2 所需运行组件。
- [ ] 创建独立运行用户。
- [ ] 创建运行目录。
- [ ] 创建配置目录。
- [ ] 创建日志目录。
- [ ] 创建备份目录。
- [ ] 管理 systemd 服务或 Docker Compose 服务。
- [ ] 启动代理核心。
- [ ] 停止代理核心。
- [ ] 重启代理核心。
- [ ] 热重载代理核心，能支持时优先使用。
- [ ] 检查代理核心进程状态。
- [ ] 检查监听端口。
- [ ] 检查 TCP 入站端口。
- [ ] 检查 UDP 入站端口。
- [ ] 管理本机防火墙端口。
- [ ] 支持公网 IP 上报。
- [ ] 支持私网 IP 上报。
- [ ] 支持地区、ASN、服务商字段上报或本地记录。
- [ ] 支持 CPU、内存、磁盘、负载上报。
- [ ] 支持 uptime 上报。
- [ ] 支持 swap 状态上报。
- [ ] 支持网络接口流量统计。

### P1

- [ ] 支持 Xray-core 自动下载和版本锁定。
- [ ] 支持 sing-box 自动下载和版本锁定。
- [ ] 支持组件版本回滚。
- [ ] 支持本机端口冲突检测。
- [ ] 支持系统参数优化检查。
- [ ] 支持 UDP buffer 调优检查。
- [ ] 支持 BBR 开启状态检查。
- [ ] 支持时钟同步检查。
- [ ] 支持 DNS 解析检查。
- [ ] 支持多实例配置目录和服务名管理。

## 5. Proxy Node 协议入站模型

Proxy Node 上可以有多个 `Node Inbound`。

### P0

- [ ] 支持创建 VLESS + REALITY 入站。
- [ ] 支持创建 Hysteria2 入站。
- [ ] 支持启停单个协议入站。
- [ ] 支持删除单个协议入站。
- [ ] 支持入站配置版本。
- [ ] 支持入站配置回滚。
- [ ] 支持入站端口管理。
- [ ] 支持入站监听地址管理。
- [ ] 支持入站名称。
- [ ] 支持入站标签。
- [ ] 支持入站状态上报。
- [ ] 支持入站流量上报。
- [ ] 支持入站错误上报。
- [ ] 支持直连 Access Node 关联。
- [ ] 支持中转 Access Node 关联。
- [ ] 支持节点总限速字段接收。
- [ ] 支持用户限速字段接收。
- [ ] 支持用户设备/IP 数限制字段接收。
- [ ] 支持用户 TCP 连接限制字段接收。

### P1

- [ ] 支持同一节点多 VLESS + REALITY 入站。
- [ ] 支持同一节点多 Hysteria2 入站。
- [ ] 支持入站灰度发布。
- [ ] 支持只更新用户列表。
- [ ] 支持只更新协议参数。
- [ ] 支持节点总限速执行，运行核心或系统层支持时启用。
- [ ] 支持用户限速执行，运行核心或系统层支持时启用。
- [ ] 支持用户设备/IP 数限制执行。
- [ ] 支持用户 TCP 连接限制执行。

## 6. VLESS + REALITY 运行能力

### P0

- [ ] 运行 Xray VLESS + REALITY TCP。
- [ ] 支持 `xtls-rprx-vision` flow。
- [ ] 支持每节点独立 REALITY key pair。
- [ ] 本地保存 REALITY private key。
- [ ] 上报 REALITY public key。
- [ ] 支持 shortId。
- [ ] 支持 serverNames。
- [ ] 支持 dest。
- [ ] 支持 spiderX。
- [ ] 支持用户 VLESS UUID 列表。
- [ ] 支持用户启停。
- [ ] 支持用户增删。
- [ ] 支持配置校验。
- [ ] 支持 Xray 配置渲染。
- [ ] 支持 Xray 配置备份。
- [ ] 支持 Xray 配置回滚。
- [ ] 支持 Xray API 或 stats。
- [ ] 支持按用户采集流量。
- [ ] 支持 REALITY 入站握手测试。
- [ ] 支持 VLESS 入站端口监听测试。

### P1

- [ ] 支持 Xray API 动态增删用户。
- [ ] 支持 REALITY key 轮换。
- [ ] 支持 shortId 轮换。
- [ ] 支持 REALITY 目标站可用性测试。
- [ ] 支持 REALITY 目标站证书检查。
- [ ] 支持 REALITY 目标站 ASN 检查。
- [ ] 支持 gRPC REALITY。
- [ ] 支持 XHTTP REALITY。

### 暂缓

- [ ] 复杂 XHTTP 下载域名拆分。
- [ ] Hiddify 式多入口 HAProxy 分流。

## 7. Hysteria2 运行能力

### P0

- [ ] 运行 Hysteria2。
- [ ] 支持 UDP 入站。
- [ ] 支持 TLS 证书引用。
- [ ] 支持用户 password 列表。
- [ ] 支持用户启停。
- [ ] 支持用户增删。
- [ ] 支持 obfs。
- [ ] 支持独立 obfs password。
- [ ] 支持 up Mbps。
- [ ] 支持 down Mbps。
- [ ] 支持 Hysteria2 配置渲染。
- [ ] 支持 Hysteria2 配置备份。
- [ ] 支持 Hysteria2 配置回滚。
- [ ] 支持 UDP 端口监听检测。
- [ ] 支持 UDP 可用性检测。
- [ ] 支持 Hysteria2 握手检测。
- [ ] 支持 Hysteria2 日志解析或 stats 采集。
- [ ] 支持按用户采集流量，能做到时必须启用。

### P1

- [ ] 支持 masquerade 配置。
- [ ] 支持 obfs password 轮换。
- [ ] 支持按节点覆盖 up/down Mbps。
- [ ] 支持按套餐覆盖 up/down Mbps。
- [ ] 支持 Hysteria2 用户动态增删，运行核心支持时再启用。
- [ ] 支持 UDP buffer 调优。
- [ ] 支持 QUIC 参数调优。

### 关键原则

- 不使用用户 UUID 直接作为 Hysteria2 password。
- 不使用全局路径或面板路径作为 obfs password。
- Hysteria2 作为高速 UDP 协议，必须和 VLESS + REALITY 形成互补。

## 8. Proxy Node 证书、域名与端口

### P0

- [ ] 接收 Backend Core 下发的证书引用。
- [ ] 支持本地证书文件部署。
- [ ] 支持证书到期时间上报。
- [ ] 支持证书文件权限检查。
- [ ] 支持节点入口域名记录。
- [ ] 支持节点入口 IP 记录。
- [ ] 支持端口监听状态上报。
- [ ] 支持端口冲突检测。
- [ ] 支持防火墙开放 VLESS TCP 端口。
- [ ] 支持防火墙开放 Hysteria2 UDP 端口。

### P1

- [ ] 支持本机证书续期任务。
- [ ] 支持证书续期失败告警。
- [ ] 支持 DNS 解析检查。
- [ ] 支持域名解析到本机 IP 检查。
- [ ] 支持证书热更新。

## 9. Proxy Node 配置应用与回滚

### P0

- [ ] 拉取 desired state。
- [ ] 对比本地 actual state。
- [ ] 生成本地配置文件。
- [ ] 配置语法校验。
- [ ] 应用前备份当前配置。
- [ ] 应用配置。
- [ ] 重载或重启服务。
- [ ] 应用后健康检查。
- [ ] 应用结果上报。
- [ ] 应用失败自动回滚。
- [ ] 回滚结果上报。
- [ ] 保留最近若干版本配置。
- [ ] 持久化保存最后一次成功拉取的 desired state。
- [ ] 持久化保存最后一次成功渲染的协议配置。
- [ ] 标记最后一次成功配置为 last known good。
- [ ] Agent 启动时如果无法连接 Backend Core，使用 last known good 启动代理核心。
- [ ] Agent 拉取配置失败时继续运行当前已应用配置。
- [ ] Agent 拉取到空配置或异常配置时拒绝覆盖 last known good。
- [ ] Backend Core 离线时不主动删除用户。
- [ ] Backend Core 离线时不主动关闭入站。
- [ ] Backend Core 离线时不主动停用证书。
- [ ] Backend Core 恢复后先上报本地配置版本，再决定是否更新。

### 离线容灾原则

- 后端面板崩溃、网络中断、DNS 故障、mTLS 失效或 Backend Core 暂时不可达时，Proxy Node 必须继续提供代理服务。
- 离线期间使用最后一次成功应用的用户、协议、证书、端口和入站规则。
- 离线期间不执行来自 Backend Core 的新停用、删除、过期、超流量策略，因为这些策略无法被确认。
- 离线期间可以继续本地采集流量和错误日志，待 Backend Core 恢复后补报。
- 如果本机没有任何 last known good 配置，则只能保持未就绪状态，不能凭空生成代理配置。
- last known good 配置必须经过签名校验、语法校验和成功运行确认后才可被标记。

### P1

- [ ] 配置 diff 本地保存。
- [ ] 支持只更新 VLESS 用户。
- [ ] 支持只更新 Hysteria2 用户。
- [ ] 支持只更新证书。
- [ ] 支持只更新端口。
- [ ] 支持灰度配置。

## 10. Proxy Node 流量统计

### P0

- [ ] 节点总上传流量。
- [ ] 节点总下载流量。
- [ ] VLESS 入站流量。
- [ ] Hysteria2 入站流量。
- [ ] 用户维度流量。
- [ ] 增量流量计算。
- [ ] 增量去重。
- [ ] 流量上报 Backend Core。
- [ ] 流量采集失败上报。
- [ ] 流量计数器重启后的恢复策略。
- [ ] 在线 IP 采集。
- [ ] 在线 IP 上报 Backend Core。

### P1

- [ ] 按 Access Node 统计流量。
- [ ] 按 direct / relay 入口统计流量。
- [ ] 在线用户估算。
- [ ] 最近活跃用户上报。
- [ ] 异常流量检测。

## 10.1 Proxy Node 审计和白名单

soga 提供审计规则、审计白名单和审计事件上报能力。我们第一版不强制做复杂审计，但可以预留模型。

### P1

- [ ] 拉取审计规则。
- [ ] 拉取审计白名单。
- [ ] 本地白名单和 Backend Core 下发白名单合并。
- [ ] 审计事件本地记录。
- [ ] 审计事件上报 Backend Core。
- [ ] 审计命中去重。

### P2

- [ ] 按用户审计策略。
- [ ] 按套餐审计策略。
- [ ] 审计触发后自动限速或停用。

## 11. Proxy Node 健康检查

### P0

- [ ] Agent 在线状态。
- [ ] 系统资源状态。
- [ ] Xray 进程状态。
- [ ] Hysteria2 进程状态。
- [ ] TCP 端口监听状态。
- [ ] UDP 端口监听状态。
- [ ] VLESS + REALITY 本机握手检查。
- [ ] Hysteria2 本机握手检查。
- [ ] 证书状态检查。
- [ ] 配置版本一致性检查。
- [ ] 最近错误检查。

### P1

- [ ] 从外部探针检查 VLESS + REALITY。
- [ ] 从外部探针检查 Hysteria2。
- [ ] 三网延迟测试。
- [ ] 三网丢包测试。
- [ ] 晚高峰定时测试。
- [ ] 节点质量评分。
- [ ] 节点故障自动标记。

## 12. Proxy Node 安全

### P0

- [ ] 最小化开放端口。
- [ ] 不开放管理 Web。
- [ ] Agent 凭据文件权限限制。
- [ ] 协议私钥文件权限限制。
- [ ] 配置文件权限限制。
- [ ] 日志脱敏。
- [ ] 不在日志输出完整用户 secret。
- [ ] 不在日志输出完整 Agent token。
- [ ] 限制 Agent 只能访问 Backend Core。
- [ ] 支持服务以非 root 用户运行，必须 root 的操作通过受控方式完成。
- [ ] 安装脚本不保存明文 bootstrap token。

### P1

- [ ] 本机 fail2ban 或等价机制。
- [ ] 端口扫描检测。
- [ ] 异常连接数检测。
- [ ] Agent mTLS。
- [ ] 配置签名强校验。

## 13. Transit Relay 基础能力

### P0

- [ ] 安装 Relay Agent。
- [ ] 安装 Realm。
- [ ] 创建独立运行用户。
- [ ] 创建运行目录。
- [ ] 创建配置目录。
- [ ] 创建日志目录。
- [ ] 创建备份目录。
- [ ] 管理 systemd 服务或 Docker Compose 服务。
- [ ] 启动中转服务。
- [ ] 停止中转服务。
- [ ] 重启中转服务。
- [ ] 热重载中转服务，能支持时优先使用。
- [ ] 检查中转进程状态。
- [ ] 检查中转端口监听。
- [ ] 管理本机防火墙端口。
- [ ] 上报公网 IP。
- [ ] 上报私网 IP。
- [ ] 上报 CPU、内存、磁盘、负载。
- [ ] 上报网络接口流量。

### P1

- [ ] Realm 自动下载和版本锁定。
- [ ] Realm 版本回滚。
- [ ] 端口冲突检测。
- [ ] 系统参数优化检查。
- [ ] UDP buffer 调优检查。
- [ ] BBR 开启状态检查。
- [ ] 时钟同步检查。

## 14. Realm TCP / UDP 转发能力

### P0

- [ ] 支持 TCP 转发。
- [ ] 支持 UDP 转发。
- [ ] 支持一条规则一个入口端口。
- [ ] 支持入口监听地址。
- [ ] 支持入口端口。
- [ ] 支持目标 Proxy Node。
- [ ] 支持目标 Node Inbound。
- [ ] 支持目标地址。
- [ ] 支持目标端口。
- [ ] 支持规则启用 / 禁用。
- [ ] 支持规则名称。
- [ ] 支持规则标签。
- [ ] 支持规则配置版本。
- [ ] 支持规则应用状态。
- [ ] 支持规则错误状态。
- [ ] 支持规则和 Access Node 关联。
- [ ] 支持规则配置渲染。
- [ ] 支持规则配置校验。
- [ ] 支持规则配置备份。
- [ ] 支持规则配置回滚。

### P1

- [ ] 支持一条中转到多个目标节点。
- [ ] 支持多条规则批量应用。
- [ ] 支持规则模板。
- [ ] 支持入口端口自动分配。
- [ ] 支持 TCP keepalive 参数。
- [ ] 支持 UDP timeout 参数。
- [ ] 支持限速参数，Realm 支持时再启用。

## 15. Transit Relay 与 Access Node 联动

### P0

- [ ] Relay Agent 接收 Backend Core 下发的 Relay Rule。
- [ ] Relay Rule 必须关联 Access Node。
- [ ] Access Node 启用时启用对应 Relay Rule。
- [ ] Access Node 禁用时禁用对应 Relay Rule。
- [ ] Access Node 删除时默认删除对应 Relay Rule。
- [ ] Relay Rule 删除时上报关联 Access Node 异常。
- [ ] 目标 Node Inbound 端口变化时标记规则待更新。
- [ ] 目标 Proxy Node 禁用时标记规则不可用。
- [ ] Transit Relay 禁用时停用本机所有规则。
- [ ] Relay Rule 应用成功后回写 Backend Core。

### P1

- [ ] Access Node 与 Relay Rule 双向跳转信息上报。
- [ ] Relay Rule 影响范围上报。
- [ ] 批量启停某个落地节点的所有中转入口。
- [ ] 批量迁移某个落地节点的中转入口到另一台 Relay。

## 16. Transit Relay 配置应用与回滚

### P0

- [ ] 拉取 relay desired state。
- [ ] 对比 relay actual state。
- [ ] 生成 Realm 配置。
- [ ] 配置语法校验。
- [ ] 应用前备份当前配置。
- [ ] 应用配置。
- [ ] 重载或重启 Realm。
- [ ] 应用后检查端口监听。
- [ ] 应用结果上报。
- [ ] 应用失败自动回滚。
- [ ] 回滚结果上报。
- [ ] 保留最近若干版本配置。
- [ ] 持久化保存最后一次成功拉取的 relay desired state。
- [ ] 持久化保存最后一次成功渲染的 Realm 配置。
- [ ] 标记最后一次成功中转配置为 last known good。
- [ ] Relay Agent 启动时如果无法连接 Backend Core，使用 last known good 启动中转服务。
- [ ] Relay Agent 拉取配置失败时继续运行当前已应用配置。
- [ ] Relay Agent 拉取到空配置或异常配置时拒绝覆盖 last known good。
- [ ] Backend Core 离线时不主动删除转发规则。
- [ ] Backend Core 离线时不主动关闭入口端口。
- [ ] Backend Core 恢复后先上报本地配置版本，再决定是否更新。

### 离线容灾原则

- 后端面板崩溃、网络中断、DNS 故障、mTLS 失效或 Backend Core 暂时不可达时，Transit Relay 必须继续提供中转服务。
- 离线期间使用最后一次成功应用的中转规则、入口端口、目标节点和目标端口。
- 离线期间不执行来自 Backend Core 的新停用或删除策略，因为这些策略无法被确认。
- 离线期间可以继续本地采集中转流量和错误日志，待 Backend Core 恢复后补报。
- 如果本机没有任何 last known good 配置，则只能保持未就绪状态，不能凭空生成中转规则。
- last known good 配置必须经过签名校验、语法校验和成功运行确认后才可被标记。

### P1

- [ ] 支持只更新中转规则。
- [ ] 支持只更新 TCP 规则。
- [ ] 支持只更新 UDP 规则。
- [ ] 支持灰度发布。
- [ ] 支持配置 diff 本地保存。

## 17. Transit Relay 流量统计

### P0

- [ ] 中转服务器总上传流量。
- [ ] 中转服务器总下载流量。
- [ ] TCP 转发总流量。
- [ ] UDP 转发总流量。
- [ ] 按 Relay Rule 统计流量，能做到时必须启用。
- [ ] 增量流量计算。
- [ ] 增量去重。
- [ ] 流量上报 Backend Core。
- [ ] 流量采集失败上报。

### P1

- [ ] 按目标 Proxy Node 统计流量。
- [ ] 按 Access Node 统计流量。
- [ ] 按用户统计流量，能做到时再启用。
- [ ] 当前连接数统计。
- [ ] 连接峰值统计。
- [ ] 异常流量检测。

## 18. Transit Relay 健康检查

### P0

- [ ] Relay Agent 在线状态。
- [ ] 系统资源状态。
- [ ] Realm 进程状态。
- [ ] TCP 入口端口监听状态。
- [ ] UDP 入口端口监听状态。
- [ ] 到目标 Proxy Node 的 TCP 连通性。
- [ ] 到目标 Proxy Node 的 UDP 可用性。
- [ ] Relay Rule 配置版本一致性。
- [ ] 最近错误检查。
- [ ] 防火墙端口检查。

### P1

- [ ] 从外部探针检查中转 TCP 入口。
- [ ] 从外部探针检查中转 UDP 入口。
- [ ] 中转链路延迟测试。
- [ ] 中转链路丢包测试。
- [ ] 中转质量评分。
- [ ] 中转故障自动标记。
- [ ] 中转恢复自动标记。

## 19. Transit Relay 安全

### P0

- [ ] 最小化开放端口。
- [ ] 不开放管理 Web。
- [ ] Relay Agent 凭据文件权限限制。
- [ ] Realm 配置文件权限限制。
- [ ] 日志脱敏。
- [ ] 不在日志输出完整 Agent token。
- [ ] 限制 Relay Agent 只能访问 Backend Core。
- [ ] 支持服务以非 root 用户运行，必须 root 的操作通过受控方式完成。
- [ ] 安装脚本不保存明文 bootstrap token。

### P1

- [ ] 异常连接数检测。
- [ ] 端口扫描检测。
- [ ] Agent mTLS。
- [ ] 配置签名强校验。
- [ ] 可疑入口流量告警。

## 20. 日志与诊断

### P0

- [ ] Agent 日志。
- [ ] 协议核心日志。
- [ ] 中转程序日志。
- [ ] 配置应用日志。
- [ ] 健康检查日志。
- [ ] 升级日志。
- [ ] 错误日志摘要。
- [ ] `panelctl logs` 查看日志。
- [ ] `panelctl doctor` 执行诊断。
- [ ] 诊断结果上报 Backend Core。

### P1

- [ ] 导出诊断包。
- [ ] 日志自动轮转。
- [ ] 日志保留策略。
- [ ] 日志脱敏规则可配置。
- [ ] 最近 N 次配置应用记录。
- [ ] 最近 N 次服务重启记录。

## 20.1 性能预算和压力测试

soga 的公开测试强调大量用户、大量连接下的内存和 CPU 优化。我们的实现虽然不自研协议内核，但必须给 1c1g 节点设定资源预算。

### P0

- [ ] Agent 空闲 CPU 接近 0。
- [ ] Agent 常驻内存目标尽量低于 50MB。
- [ ] 1c1g 节点启动后保留足够内存给 Xray/Hysteria2/Realm。
- [ ] 配置拉取、流量上报、状态上报不能造成持续 CPU 压力。
- [ ] 日志默认限量保存，避免 1c1g 小磁盘被打满。

### P1

- [ ] VLESS + REALITY 多用户压测。
- [ ] Hysteria2 多用户压测。
- [ ] Realm TCP 转发压测。
- [ ] Realm UDP 转发压测。
- [ ] 多连接内存占用测试。
- [ ] 配置热更新内存波动测试。
- [ ] Agent 长时间运行泄漏测试。

## 21. 对 Backend Core 上报的数据

### Proxy Node P0 上报

- [ ] Agent ID。
- [ ] 节点 ID。
- [ ] 当前版本。
- [ ] 本机公网 IP。
- [ ] 本机私网 IP。
- [ ] 系统资源。
- [ ] uptime。
- [ ] swap 状态。
- [ ] Xray 版本。
- [ ] Hysteria2 / sing-box 版本。
- [ ] Xray 进程状态。
- [ ] Hysteria2 进程状态。
- [ ] 入站监听状态。
- [ ] 当前配置版本。
- [ ] 配置应用结果。
- [ ] 节点总流量。
- [ ] 用户流量。
- [ ] 在线 IP。
- [ ] 健康检查结果。
- [ ] 最近错误。

### Transit Relay P0 上报

- [ ] Agent ID。
- [ ] 中转 ID。
- [ ] 当前版本。
- [ ] 本机公网 IP。
- [ ] 本机私网 IP。
- [ ] 系统资源。
- [ ] uptime。
- [ ] swap 状态。
- [ ] Realm 版本。
- [ ] Realm 进程状态。
- [ ] 转发规则状态。
- [ ] 入口端口监听状态。
- [ ] 当前配置版本。
- [ ] 配置应用结果。
- [ ] 中转总流量。
- [ ] Relay Rule 流量，能做到时必须启用。
- [ ] 健康检查结果。
- [ ] 最近错误。

## 22. 第一版 P0 建议保留

### Proxy Node

- [ ] Node Agent。
- [ ] 一键安装。
- [ ] 一键升级。
- [ ] 一键回滚。
- [ ] Xray VLESS + REALITY TCP。
- [ ] Hysteria2 UDP。
- [ ] Hysteria2 obfs。
- [ ] 协议入站管理。
- [ ] 直连 Access Node 支持。
- [ ] 中转 Access Node 关联。
- [ ] 配置拉取。
- [ ] 配置版本条件拉取 / ETag。
- [ ] pull interval / push interval。
- [ ] 配置应用。
- [ ] 配置回滚。
- [ ] Backend Core 离线时继续使用 last known good config 提供服务。
- [ ] 流量上报。
- [ ] 用户流量统计。
- [ ] 在线 IP 上报。
- [ ] 进程状态上报。
- [ ] 端口状态上报。
- [ ] 资源状态上报。
- [ ] 基础健康检查。
- [ ] 1c1g 轻量资源预算。
- [ ] `panelctl` 运维命令。

### Transit Relay

- [ ] Relay Agent。
- [ ] 一键安装。
- [ ] 一键升级。
- [ ] 一键回滚。
- [ ] Realm。
- [ ] TCP 转发。
- [ ] UDP 转发。
- [ ] Relay Rule 管理。
- [ ] Access Node 关联。
- [ ] 配置拉取。
- [ ] 配置版本条件拉取 / ETag。
- [ ] pull interval / push interval。
- [ ] 配置应用。
- [ ] 配置回滚。
- [ ] Backend Core 离线时继续使用 last known good config 提供中转。
- [ ] 中转流量上报。
- [ ] 进程状态上报。
- [ ] 端口状态上报。
- [ ] 资源状态上报。
- [ ] 基础健康检查。
- [ ] 1c1g 轻量资源预算。
- [ ] `panelctl` 运维命令。

## 23. 第一版建议暂缓或不做

### 暂缓

- [ ] TUIC。
- [ ] Trojan。
- [ ] VMess。
- [ ] Shadowsocks2022。
- [ ] WireGuard。
- [ ] Naive。
- [ ] Mieru。
- [ ] DNSTT。
- [ ] 多级中转链。
- [ ] 自动按质量调度节点。
- [ ] 自动迁移用户。
- [ ] Kubernetes 部署。

### 不做

- [ ] 在节点上部署 Web 管理面板。
- [ ] Backend Core 直接 SSH 控制节点。
- [ ] 节点保存 Backend Core 数据库密码。
- [ ] 节点保存所有服务器的私钥。
- [ ] Hiddify 式面板、代理、中转混合在同一 443 入口。

## 24. 需要你筛选的问题

- Proxy Node 第一版是优先用 Docker Compose 运行 Xray/Hysteria2，还是优先用 systemd 裸机运行？
- Hysteria2 第一版是否用官方 Hysteria2，还是统一用 sing-box inbound？
- VLESS + REALITY 第一版是否只支持 Xray-core？
- Proxy Node 是否需要支持多个 VLESS + REALITY 入站？
- Proxy Node 是否需要支持多个 Hysteria2 入站？
- Proxy Node 是否需要本机申请证书，还是证书全部由 Backend Core/Edge 生成后下发？
- Relay 第一版是否只支持 Realm，gost/HAProxy/Nginx stream 放 P1？
- Realm UDP 转发是否要和 TCP 转发使用同一个 Access Node，还是 TCP/UDP 分开两个 Access Node？
- 中转服务器是否需要统计到用户级流量，还是第一版只统计到规则级/节点级？
- 节点健康检查是否需要第一版就接入外部探针？
- 是否需要兼容 soga-v1 风格的 WebAPI，方便未来接入或迁移？
- 审计规则、审计白名单、审计事件上报是否要进第一版？
- 用户限速、设备/IP 数限制、TCP 连接数限制是否要第一版强制执行？
- 是否需要像 soga 一样支持单机多实例？
- 资源压测是否作为 v0.1 发布前必测项？
