# 自研代理面板目标架构备忘

记录日期：2026-06-15

## 核心原则

新面板不采用 Hiddify Manager 那种“面板机同时也是代理节点机”的一体化架构，而采用控制面、订阅入口、中转入口、代理节点分离的架构。

最重要的原则：

- 面板后端 Core 不直接暴露给用户浏览器。
- 用户和管理员只访问可替换的前端入口。
- 订阅入口单独分离，因为订阅链接传播范围最大、最容易暴露。
- 中转服务器作为可管理的一等资源纳入面板。
- 节点服务器只跑代理协议和 Agent，不承载面板业务。
- 前端/订阅入口被 ban 时，可以低成本快速替换 IP 或整台服务器。

## 目标拓扑

```text
用户 / 管理员
  -> 面板前端服务器 Frontend Edge
      -> 私有链路 / mTLS / WireGuard
          -> 面板后端服务器 Backend Core
              -> 数据库 / Redis / 任务队列
              -> 节点管理 / 中转管理 / 订阅策略

用户客户端订阅请求
  -> 订阅服务器 Subscription Edge
      -> 私有链路 / mTLS / WireGuard
          -> Backend Core
              -> 动态生成订阅

用户代理流量
  -> 中转服务器 Transit Relay，可选
      -> 代理节点 Proxy Node

代理节点 / 中转服务器
  -> Node/Relay Agent 主动连接 Backend Core
      -> 拉取配置
      -> 上报状态
      -> 上报流量
      -> 接收重载 / 回滚 / 停启命令
```

## 服务器角色

### 1. 面板前端服务器 Frontend Edge

用途：

- 给管理员访问后台 UI。
- 给用户访问用户中心 UI。
- 承载静态前端资源。
- 反向代理 `/api/*` 到后端 Core。
- 可作为 BFF 层处理 session/cookie/csrf。

要求：

- 可以放在香港。
- 可以多台部署。
- 不保存核心数据。
- 不直接连接数据库。
- 不保存节点私钥。
- 只保存连接 Backend Core 所需的 Edge token 或 mTLS 证书。
- 被 ban 后可直接新建一台替换。

浏览器只允许访问 Frontend Edge，不允许直接访问 Backend Core。

#### 面板前端伪装与暴露面控制

Frontend Edge 的目标不是“绝对隐藏”，而是降低被主动扫描、误伤封禁、关键词识别、默认指纹识别的概率，并且在被 ban 后可以快速替换。

前端伪装原则：

- 根路径 `/` 不直接展示代理面板登录页。
- 根路径做成真实可用的轻量工具站，而不是纯静态博客或空白占位页。
- 页面内容不要出现 `proxy`、`vpn`、`xray`、`vless`、`hysteria`、`reality`、`marzban`、`hiddify` 等明显关键词。
- HTML title、meta、favicon、静态资源路径、API 路径、错误页都不要暴露面板身份。
- 不使用默认后台路径，例如 `/admin`、`/panel`、`/dashboard` 作为唯一入口。
- 真实登录入口可以使用独立子域名、租户路径、一次性邀请入口或只在登录前置校验通过后展示。
- 用户中心和管理员后台最好分开入口，管理员入口可以额外限制 IP、2FA/WebAuthn、设备指纹或一次性登录链接。
- 所有未知路径返回统一的正常 404/重定向，不暴露框架、版本、栈信息。
- 公网只开放 80/443，其他管理端口不开放。
- 80 端口只做跳转或普通静态响应，核心访问走 443。

根路径工具站建议：

- 大小写转换。
- 全角半角转换。
- 字符数 / 字节数统计。
- 时间戳转换。
- JSON 格式化。
- URL encode/decode。
- Base64 encode/decode。
- 简繁转换。
- 单位换算。
- 随机字符串生成。

工具站要求：

- 工具必须真的可用，避免做成一眼能看出的模板站。
- 工具功能尽量本地浏览器内完成，不依赖后端 Core。
- 公开工具站和登录后的面板控制台前端代码分包。
- 未登录用户加载的 JS bundle 中不出现代理、节点、订阅、协议等业务关键词。
- 不在根路径放登录按钮、用户中心入口、订阅入口或管理员入口。
- 不做测速、IP 检测、端口检测、网络诊断等容易和代理服务产生联想的工具。
- 可以保留普通访问日志和基础埋点，用于判断 Frontend Edge 是否被异常扫描或封禁。

#### 面板前端服务器本地设置后台

Frontend Edge 需要一个本地设置后台，但这个后台只管理前端服务器自身，不管理用户、套餐、节点、中转、订阅策略等核心业务。

本地设置后台定位：

- 用于初始化 Frontend Edge。
- 用于接入 Backend Core。
- 用于管理前端域名、证书、伪装工具站、BFF 转发和安全策略。
- 默认不向公网开放。
- 优先只允许 `127.0.0.1`、WireGuard 私网、固定管理员 IP 或一次性初始化链接访问。
- 初始化完成后可以关闭设置入口，后续通过 SSH tunnel、WireGuard 或后端 Core 下发配置维护。

本地设置后台功能：

- 初始化向导。
- 设置 Frontend Edge 名称、地区、服务商、标签。
- 填写 Backend Core 私网地址或内网域名。
- 填写一次性 bootstrap token 或 Edge API key。
- 用 bootstrap token 向 Backend Core 注册，并换取正式 Edge 凭据。
- 生成、上传或轮换 mTLS 客户端证书。
- 测试 Frontend Edge 到 Backend Core 的连通性。
- 显示 Backend Core API 版本兼容状态。
- 显示最近一次心跳、最近一次配置同步、最近一次错误。
- 支持解绑、重新注册、吊销当前 Edge 凭据。
- 支持导入 / 导出最小化 Edge 配置，不包含核心业务数据。

Backend Core 对接设置：

- Backend Core 地址。
- Edge ID。
- Edge secret / API key。
- mTLS 客户端证书。
- 请求超时时间。
- 重试策略。
- 健康检查路径。
- 配置同步间隔。
- API 访问 allowlist。
- 凭据轮换时间。

证书和域名设置：

- 管理前端域名。
- 管理管理员入口域名或路径。
- 管理用户中心入口域名或路径。
- 支持自定义上传证书。
- 支持 Let's Encrypt HTTP-01。
- 支持 Let's Encrypt DNS-01。
- 支持 Cloudflare API token 接入 DNS-01。
- 可选支持 Cloudflare Origin Certificate。
- 自动续期证书。
- 证书到期提醒。
- 证书签发测试。
- DNS 解析检查。
- Cloudflare DNS 记录创建 / 更新。
- Cloudflare 代理状态开关。
- Cloudflare API token 权限检查。

Cloudflare API 使用原则：

- 只使用受限 API token，不使用全局 API key。
- token 权限限定到指定 zone 和必要的 DNS/证书操作。
- 支持一次性使用 token 完成证书签发后不保存。
- 如果必须保存 token，需要本地加密保存，并支持随时删除和轮换。

伪装工具站设置：

- 选择工具站模板。
- 启用 / 禁用具体小工具。
- 设置站点名称、title、description、favicon。
- 设置主题色、语言、页脚、联系方式。
- 管理 robots.txt、sitemap、普通 404 页面。
- 预览公开首页。
- 检查公开 JS bundle 是否包含敏感业务关键词。
- 检查公开页面是否泄露面板路径、API 地址或后端信息。

BFF 和路由设置：

- 配置登录前置校验。
- 配置用户中心入口。
- 配置管理员后台入口。
- 配置 `/api/*` 或内部 API 前缀到 Backend Core 的反向代理。
- 配置 WebSocket / SSE 转发。
- 配置静态资源缓存。
- 配置未知路径处理。
- 配置维护模式。
- 支持灰度切换到新的 Backend Core。

安全设置：

- 本地设置后台访问白名单。
- 本地管理员密码或一次性登录令牌。
- 2FA / WebAuthn。
- CSRF 防护。
- Cookie 安全策略。
- 登录失败限制。
- 请求频率限制。
- 扫描路径拦截。
- 异常 User-Agent 记录。
- 管理员操作审计日志。
- 高风险操作二次确认。

运行状态与诊断：

- 前端服务版本。
- 系统负载、内存、磁盘。
- Nginx/Caddy/应用进程状态。
- 80/443 端口监听状态。
- 域名解析状态。
- TLS 证书状态。
- Backend Core 连通状态。
- 最近错误日志。
- 最近访问统计。
- 配置校验。
- 一键重载前端服务。
- 一键回滚上一版配置。

不建议在 Frontend Edge 本地设置后台中提供：

- 用户管理。
- 套餐管理。
- 节点管理。
- 中转管理。
- 订阅策略管理。
- 数据库配置。
- 节点私钥查看。
- 后端 Core 管理员账号管理。

前端安全原则：

- 浏览器只和 Frontend Edge 通信。
- 浏览器不能直接看到 Backend Core 的域名、IP、端口。
- `/api/*` 由 Frontend Edge 作为 BFF 反向代理到 Backend Core。
- Frontend Edge 到 Backend Core 使用 WireGuard、mTLS、固定 IP allowlist 或短期可轮换 Edge token。
- 前端不保存数据库密码、节点私钥、核心签名密钥。
- 用户登录态优先使用 HttpOnly Secure SameSite Cookie，不把长期 token 放在 localStorage。
- 管理员操作需要 CSRF 防护、审计日志、二次确认和高风险操作告警。
- 加入基础限速、登录失败惩罚、异常 UA/路径扫描检测。

可替换性原则：

- Frontend Edge 必须可以用镜像或脚本在新服务器上一键恢复。
- DNS TTL 保持较低，便于快速切换。
- 前端配置中只包含最小连接信息，例如 Backend Core 私网地址、Edge ID、证书或短期 token。
- 前端服务器被 ban 时，不影响 Backend Core、数据库、订阅服务器、中转服务器和代理节点。

不建议做法：

- 不建议把代理协议入口和面板前端混在同一台 Frontend Edge 上。
- 不建议让订阅链接和面板前端使用同一个域名。
- 不建议为了伪装引入复杂的 HAProxy 多协议共用 443，除非后续确实需要同机承载多种入口。
- 不建议用完全空白或明显模板化页面做伪装，这类页面反而容易形成固定指纹。

### 2. 面板后端服务器 Backend Core

用途：

- 管理员系统。
- 用户系统。
- 套餐、权限、流量、到期。
- 节点管理。
- 中转服务器管理。
- 订阅策略。
- 配置版本管理。
- Agent API。
- 审计日志。
- 任务队列。

要求：

- 不向公网普通用户暴露。
- 只允许 Frontend Edge、Subscription Edge、Node Agent、Relay Agent 访问。
- 访问方式优先使用 mTLS、WireGuard 私网或固定 IP allowlist。
- 数据库和 Redis 只允许 Backend Core 本机或私网访问。

### 3. 订阅服务器 Subscription Edge

用途：

- 专门承载用户订阅链接。
- 生成或代理订阅请求。
- 支持 sing-box、Clash Meta、v2rayN/Shadowrocket links。
- 输出 `Subscription-Userinfo` 响应头。
- 可按用户、套餐、客户端、地区、策略动态返回节点。

要求：

- 和面板前端分离。
- 可多台部署。
- 可快速替换 IP。
- 不直接连接数据库。
- 不暴露 Backend Core 地址。
- 可以缓存短时间订阅结果，但要能快速失效。

原因：

- 订阅链接最容易被传播、扫描、滥用或封禁。
- 把订阅入口单独拆出，可以降低面板后台和后端 Core 的暴露风险。

### 4. 中转服务器 Transit Relay

用途：

- 作为用户到节点之间的中转入口。
- 隐藏真实落地节点 IP。
- 优化特定运营商线路。
- 绕开直连节点被阻断的问题。
- 承担 Realm / gost / HAProxy / Nginx stream 等转发角色。

面板需要集成对中转服务器的监控和管理。

中转管理功能：

- 新增 / 删除 / 编辑中转服务器。
- 管理入口端口。
- 管理转发目标。
- 支持 TCP 转发。
- 支持 UDP 转发。
- 支持多条转发规则。
- 支持中转到多个落地节点。
- 支持从节点协议入站快速创建中转访问节点。
- 支持中转访问节点和中转转发规则双向关联。
- 支持启停规则。
- 支持配置版本。
- 支持配置下发。
- 支持配置回滚。
- 支持进程状态监控。
- 支持端口监听监控。
- 支持 TCP 连接测试。
- 支持 UDP 可用性测试。
- 支持中转链路延迟测试。
- 支持中转链路丢包测试。
- 支持带宽/流量统计。
- 支持故障告警。
- 支持一键摘除故障中转。

中转服务器 Agent：

- 主动连接 Backend Core。
- 拉取 relay 配置。
- 应用 Realm/gost/HAProxy 配置。
- 上报进程状态。
- 上报端口状态。
- 上报流量。
- 上报系统资源。
- 接收 reload/restart/rollback 命令。

### 5. 代理节点 Proxy Node

用途：

- 跑 VLESS + REALITY。
- 跑 Hysteria2。
- 后续可扩展 TUIC。
- 接收中转流量或用户直连流量。

要求：

- 节点通过 Agent 与 Backend Core 通信。
- 节点不需要暴露管理面板。
- 节点配置由 Backend Core 生成并下发。
- 节点上报流量、在线、错误、延迟、UDP 可用性。

#### 离线容灾和最后可用配置

Backend Core 是控制面，不应该成为代理服务的单点生命线。Proxy Node 和 Transit Relay 必须支持 last known good config。

要求：

- Proxy Node 必须持久化保存最后一次成功应用的代理配置。
- Transit Relay 必须持久化保存最后一次成功应用的中转配置。
- Backend Core 崩溃、网络中断、DNS 故障或 Agent 无法连接 Backend Core 时，Proxy Node 继续使用最后一次成功配置给用户提供代理服务。
- Backend Core 崩溃、网络中断、DNS 故障或 Relay Agent 无法连接 Backend Core 时，Transit Relay 继续使用最后一次成功配置提供中转服务。
- Backend Core 不可达时，不允许因为拉取失败、空响应或异常响应而清空用户、入站、证书或中转规则。
- Backend Core 不可达时，不执行新的停用、删除、过期、超流量策略，直到重新连接并确认新的配置版本。
- 离线期间继续本地采集流量、错误日志和健康状态。
- Backend Core 恢复后，Agent 先上报本地当前配置版本和离线期间状态，再拉取最新 desired state。
- last known good config 必须经过签名校验、语法校验和成功运行确认后才能被标记。

#### 节点、协议入站、访问节点和中转规则

为了让节点列表既能展示直连节点，也能展示中转后的节点，系统需要区分“真实资源”和“用户访问入口”。

资源定义：

- `Proxy Node`：真实落地代理服务器。
- `Node Inbound`：落地节点上的一个协议入站，例如 VLESS + REALITY TCP 或 Hysteria2 UDP。
- `Transit Relay`：真实中转服务器。
- `Relay Rule`：中转服务器上的一条转发规则。
- `Access Node`：用户在节点列表和订阅里看到的访问节点。

访问节点类型：

- `direct`：直连访问节点，用户直接连接落地节点。
- `relay`：中转访问节点，用户连接中转服务器，再由中转服务器转发到落地节点。

创建流程：

1. 管理员添加一个 VLESS + REALITY 或 Hysteria2 节点。
2. Backend Core 创建 `Proxy Node` 和 `Node Inbound`。
3. 系统自动创建一个 `direct Access Node`。
4. 管理员可以从该协议入站快速创建 `relay Access Node`。
5. 创建中转访问节点时选择中转服务器、入口端口、TCP/UDP、名称、标签、分组和可访问套餐。
6. 保存后，节点列表新增一个中转访问节点。
7. Backend Core 同步创建对应 `Relay Rule`。
8. 中转管理里的转发规则列表也能看到这条规则。
9. Relay Agent 拉取新规则并应用到 Realm/gost/HAProxy/Nginx stream。

订阅生成原则：

- 直连访问节点使用落地节点地址和端口。
- 中转访问节点使用中转服务器地址和入口端口。
- 协议参数仍来自原始 `Node Inbound`。
- 中转层只改变入口地址和端口，不改变用户身份凭据。
- 同一个落地节点可以同时存在一个直连访问节点和多个中转访问节点。

联动原则：

- 禁用落地节点时，默认禁用其所有访问节点。
- 禁用协议入站时，默认禁用关联访问节点。
- 禁用中转服务器时，默认禁用该中转服务器上的中转访问节点。
- 删除中转访问节点时，默认同步删除对应中转规则。
- 删除中转规则时，关联中转访问节点需要标记异常或同步删除。

## 管理边界

### 浏览器访问边界

允许：

```text
浏览器 -> Frontend Edge
浏览器 -> Subscription Edge
```

不允许：

```text
浏览器 -> Backend Core
浏览器 -> 数据库
浏览器 -> 节点 Agent
浏览器 -> 中转 Agent
```

### 服务间访问边界

```text
Frontend Edge -> Backend Core
Subscription Edge -> Backend Core
Node Agent -> Backend Core
Relay Agent -> Backend Core
Backend Core -> 数据库 / Redis / 队列
```

优先通信方式：

- mTLS
- WireGuard 私网
- 固定 IP allowlist
- 短期可轮换 token

## 后续面板必须支持的资源模型

### 用户资源

- 用户 UUID。
- 用户订阅 token。
- 用户启停。
- 流量上限。
- 到期时间。
- 套餐。
- 可访问节点组。
- 可访问中转组。

### 节点资源

- 节点名称。
- 节点地区。
- 节点服务商。
- 节点 ASN。
- 节点公网 IP。
- 节点协议能力。
- 节点状态。
- 节点分组。
- 节点标签。

### 中转资源

- 中转名称。
- 中转公网 IP。
- 中转地区。
- 中转服务商。
- 中转入口端口。
- 中转目标节点。
- 转发协议 TCP/UDP。
- 转发规则。
- 健康状态。
- 流量统计。

### 订阅资源

- 订阅入口服务器。
- 订阅域名。
- 订阅 token。
- 订阅格式。
- 订阅策略。
- 客户端 User-Agent 适配。
- 节点排序策略。
- 故障节点隐藏策略。

## 监控要求

必须监控：

- Frontend Edge 可访问性。
- Subscription Edge 可访问性。
- Backend Core 健康。
- 数据库健康。
- Redis 健康。
- Node Agent 在线状态。
- Relay Agent 在线状态。
- Xray 进程状态。
- Hysteria2 进程状态。
- Realm/gost/HAProxy 进程状态。
- TCP 端口监听。
- UDP 端口可用性。
- VLESS REALITY 握手。
- Hysteria2 握手。
- 中转链路延迟。
- 中转链路丢包。
- 用户流量统计。
- 节点总流量。
- 中转总流量。

## 第一版优先级

第一版必须实现：

- Frontend Edge 和 Backend Core 分离。
- Subscription Edge 和 Frontend Edge 分离。
- Backend Core 不暴露给浏览器。
- VLESS + REALITY 节点管理。
- Hysteria2 节点管理。
- Realm 中转管理。
- 用户订阅分发。
- 用户流量和到期权限。
- Node Agent。
- Relay Agent。
- 基础健康检查。
- 基础配置下发和回滚。
- GitHub 仓库发布。
- 版本号管理。
- 一键安装。
- 一键升级。
- 角色化部署。

暂时不做：

- 复杂 CDN/Worker 分流。
- Hiddify 式 HAProxy 多协议共用 443。
- DNSTT。
- Mieru。
- Naive。
- Telegram proxy。
- WireGuard。
- WARP。

## 当前架构决策

后续自研面板以如下架构为基准：

```text
面板前端服务器 + 面板后端服务器 + 订阅服务器 + 中转服务器 + 若干代理节点
```

其中：

- 前端服务器是可替换消耗层。
- 订阅服务器是可替换消耗层。
- 后端服务器是核心控制面，需要隐藏。
- 中转服务器是可管理、可监控、可下发配置的一等资源。
- 代理节点是数据面，只通过 Agent 接收配置和上报状态。

## 部署、发布与升级目标

代码写完并完成功能测试后，需要发布到 GitHub 仓库，并且支持版本化、一键安装、连接即用和后续升级。

Backend Core 的安装、版本管理、升级、回滚方式必须和 Frontend Edge 保持一致。所有角色都使用同一套 GitHub release、Git tag、安装脚本、`panelctl` 运维命令和版本兼容规则。

### GitHub 仓库目标

- 使用 GitHub 作为主代码仓库。
- 使用 Git tag 管理版本。
- 使用语义化版本号，例如 `v0.1.0`、`v0.2.0`、`v1.0.0`。
- 每个版本生成 release notes。
- 每个版本提供安装脚本和升级脚本。
- 每个版本包含数据库迁移记录。
- 每个版本包含兼容性说明，例如 Backend Core、Frontend Edge、Subscription Edge、Node Agent、Relay Agent 的最低兼容版本。

### 一键安装目标

安装方式需要尽量简单，目标是新服务器执行一条命令即可进入初始化向导。

推荐安装入口：

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
sudo ./install.sh
```

也可以后续提供：

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<version>/install.sh | sudo bash
```

但 `curl | bash` 方式需要额外做脚本签名、版本固定和安全提示，不能作为唯一安装方式。

### 角色化部署

安装脚本必须支持选择服务器角色：

- `backend-core`
- `frontend-edge`
- `subscription-edge`
- `proxy-node`
- `transit-relay`

示例：

```bash
sudo ./install.sh --role backend-core
sudo ./install.sh --role frontend-edge
sudo ./install.sh --role subscription-edge
sudo ./install.sh --role proxy-node
sudo ./install.sh --role transit-relay
```

不同角色安装不同组件：

- Backend Core 安装 API 服务、数据库、Redis、任务队列、管理后台、迁移工具、备份恢复工具。
- Frontend Edge 安装前端站点、工具站、BFF、证书管理、本地设置后台。
- Subscription Edge 安装订阅服务、缓存、订阅格式转换器。
- Proxy Node 安装 Node Agent、Xray-core、Hysteria2 或 sing-box。
- Transit Relay 安装 Relay Agent、Realm/gost/HAProxy/Nginx stream 中被启用的组件。

Backend Core 安装要求：

- 支持 `sudo ./install.sh --role backend-core`。
- 支持交互式初始化向导。
- 支持非交互式参数安装，便于后续自动化。
- 自动安装或拉起 PostgreSQL、Redis、任务队列等依赖。
- 自动执行数据库迁移。
- 自动创建第一个 super admin。
- 自动生成系统主密钥、API 签名密钥、bootstrap token 签发密钥。
- 自动生成 Backend Core 本机配置。
- 自动生成 Frontend Edge、Subscription Edge、Node Agent、Relay Agent 的接入命令。
- 安装完成后显示访问入口、版本号、服务状态和下一步接入说明。

### 初始化与连接即用

安装完成后进入初始化向导：

- Backend Core 初始化管理员账号。
- Backend Core 初始化数据库、Redis、系统密钥。
- Frontend Edge 使用 bootstrap token 注册到 Backend Core。
- Subscription Edge 使用 bootstrap token 注册到 Backend Core。
- Proxy Node 使用 bootstrap token 注册到 Backend Core。
- Transit Relay 使用 bootstrap token 注册到 Backend Core。
- 注册完成后 bootstrap token 失效，换取正式 Edge/Agent 凭据或 mTLS 证书。

目标体验：

- 新机器安装完成后，复制 Backend Core 生成的一次性接入命令。
- 在 Frontend Edge、Subscription Edge、Proxy Node、Transit Relay 上执行。
- 对应服务器自动注册、拉取配置、启动服务、上报健康状态。
- Backend Core 面板中可以看到新服务器在线。

### 升级目标

需要提供统一升级命令：

```bash
sudo panelctl upgrade
```

或：

```bash
sudo ./install.sh --upgrade
```

升级流程要求：

- 升级前自动备份配置。
- Backend Core 升级前自动备份数据库。
- Backend Core 升级前自动检查数据库 schema 版本。
- 检查当前版本和目标版本兼容性。
- 执行数据库迁移。
- 拉取新镜像或新二进制。
- 重启对应服务。
- 执行健康检查。
- 升级失败自动回滚到上一版本。
- 升级日志可在本地查看，也可上报 Backend Core。
- Backend Core 升级失败时必须回滚应用版本，并根据迁移策略处理数据库回滚或阻止破坏性迁移。

### 运维命令目标

最终需要提供统一 CLI：

```bash
panelctl status
panelctl logs
panelctl doctor
panelctl restart
panelctl reload
panelctl backup
panelctl restore
panelctl upgrade
panelctl rollback
panelctl version
```

各角色需要支持：

- 查看当前角色。
- 查看当前版本。
- 查看服务状态。
- 查看连接 Backend Core 状态；Backend Core 角色则显示数据库、Redis、任务队列状态。
- 查看最近错误。
- 执行健康检查。
- 导出诊断包。

Backend Core 额外需要支持：

- `panelctl init`
- `panelctl migrate`
- `panelctl backup-db`
- `panelctl restore-db`
- `panelctl create-bootstrap-token`
- `panelctl rotate-secrets`

### 部署形态

第一版按服务器角色选择部署形态：

- Backend Core 推荐使用 Docker Compose，降低数据库、Redis、任务队列等依赖的部署复杂度。
- Frontend Edge 和 Subscription Edge 可以使用 Docker Compose，也可以使用 systemd + 静态资源/二进制。
- Proxy Node 和 Transit Relay 必须支持 1c1g 轻量模式，优先使用 systemd + 静态二进制部署。
- Proxy Node 和 Transit Relay 的 1c1g 轻量模式不安装数据库、Redis、任务队列或 Web 管理界面。

后续可以扩展：

- 单二进制 Agent 部署。
- Kubernetes / Helm 部署。
- 多 Backend Core 高可用部署。

第一版优先级：

- 稳定。
- 可重复安装。
- 可升级。
- 可回滚。
- 易排错。

不追求第一版就支持复杂集群。

### 发布前测试要求

发布 GitHub release 前必须完成：

- Backend Core 安装测试。
- Frontend Edge 安装测试。
- Subscription Edge 安装测试。
- Proxy Node 安装测试。
- Transit Relay 安装测试。
- 新服务器注册测试。
- API 连通性测试。
- 证书签发测试。
- 配置下发测试。
- 服务重启测试。
- 升级测试。
- 回滚测试。
- 备份恢复测试。
- 卸载测试。
