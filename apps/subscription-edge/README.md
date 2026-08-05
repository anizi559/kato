# Subscription Edge

订阅入口服务器。对外提供 `GET /<前缀>/<订阅Token>`，将请求转发给 Backend Core 动态生成订阅内容。

当前能力（v0.6.0）：

- sing-box JSON 订阅。
- Clash Meta YAML 订阅。
- v2rayN / Shadowrocket 通用 URI + Base64 订阅。
- 按 User-Agent 自动选择格式，默认返回 URI+Base64。
- 透传 `Subscription-Userinfo`、`profile-update-interval`、`profile-title` 响应头。
- 内存缓存（默认 60 秒）、后端故障时用旧缓存兜底（默认 300 秒）。
- 每个订阅 Token 限速（默认 60 次/分钟，突发 3 次）。
- 未知路径统一返回空 404，不暴露后端地址和错误细节。

配置：`/etc/kato/subscription-edge.json`（安装脚本自动生成），服务名 `kato-subscription-edge`。
