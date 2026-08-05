# Subscription Edge

订阅入口服务器。对外提供 `GET /<前缀>/<订阅Token>`，将请求转发给 Backend Core 动态生成订阅内容。

当前能力（v0.5.0）：

- sing-box JSON 订阅。
- Clash Meta YAML 订阅。
- v2rayN / Shadowrocket 通用 URI + Base64 订阅。
- 按 User-Agent 自动选择格式，默认返回 URI+Base64。
- 透传 `Subscription-Userinfo`、`profile-update-interval`、`profile-title` 响应头。
- 未知路径统一返回空 404，不暴露后端地址和错误细节。

暂不实现：订阅缓存、限速、滥用检测（P1）。

配置：`/etc/kato/subscription-edge.json`（安装脚本自动生成），服务名 `kato-subscription-edge`。
