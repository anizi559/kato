# Kato 问题与解决方案记录

> 从开发、测试到线上运维过程中踩过的问题和最终方案。按时间与主题整理，供后续维护参考。

## 1. AnyTLS 多用户：单端口 vs 每用户端口

**问题**：早期实现给每个用户分配独立端口（20000+），节点、中转、订阅都按用户展开。用户一多，端口管理混乱；节点被 ban 换机时要迁移所有用户端口，流量特征也更明显。

**方案**：改为单端口多用户（v0.11 / v1.0.0）：

- sing-box AnyTLS 入站 `users` 数组挂载全部用户，一个端口服务所有人。
- 按用户限速用 `auth_user` + 每用户 `bandwidth-limiter`。
- 按用户统计用 V2Ray API `stats.users`。
- 中转规则固定端口，不再按用户展开。

## 2. 官方 sing-box-extended 没有按用户统计能力

**问题**：官方 Release 编译时未带 `with_v2ray_api` 标签，配置 `experimental.v2ray_api` 会直接报错 “v2ray api is not included in this build”。

**方案**：

- 在 Mac 上交叉编译 linux/amd64：`GOOS=linux GOARCH=amd64 go build -tags with_v2ray_api`（源码 tag `1.13.16-extended-2.6.0`）。
- `install.sh` 增加 `--singbox-url` / `KATO_SINGBOX_BINARY_URL` 支持，新节点可直接安装自定义二进制。
- 已编译二进制保留在本地 outputs 目录，后续装机可复用。

## 3. bandwidth-limiter `strategy: "users"` 限速失效

**问题**：实测把多个用户配置进同一个 `bandwidth-limiter`（`strategy: users`），配置 2MB/s 实际只有约 2.7KB/s。

**方案**：放弃 `strategy: users`，改为每个用户独立 outbound（`strategy: global`）+ `auth_user` 路由规则。实测：demo 限 8Mbps = 943KB/s，hk-demo 不限速 = 5.8MB/s，单端口下互不影响。

## 4. 节点每分钟重启

**问题**：desired-state 里包含用户 `usedTrafficBytes`，用户一有流量 ETag 就变化，Agent 每分钟拉取并重启 sing-box，影响所有在线用户。

**方案**：用户用量字段不再进入 desired-state；只有“跨过流量阈值”或管理操作（增删用户、改限速、改证书等）才 bump 配置版本。日常流量不再触发重启。

## 5. 用户流量重复计数

**问题**：节点和中转都按用户上报，用户用量被加了两遍。

**方案**：中转只做 nftables 聚合统计（不归属用户）；用户归属只在节点侧由 V2Ray API 完成。

## 6. 流量增量丢失

**问题**：Agent 先保存 lastTraffic 再上报，后端重启/上报失败会丢一段流量；nft 计数器被重置也会造成短暂增量异常。

**方案**：Agent 先上报成功、再保存计数快照；节点重启后自动重建 nft 计数规则。

## 7. 超量断流/限速需求

**问题**：需要“流量用完断开”或“流量用完限速 1Mbps”两种策略。

**方案**：权限组新增 `overQuotaPolicy`（disconnect / throttle）。disconnect 摘除用户，throttle 保留用户并下发 125000 B/s 限速。两者都已实测验证。

## 8. 订阅链接泄露

**问题**：订阅链接暴露后节点信息可能被泄漏。

**方案**：用户详情“刷新订阅令牌”同时轮换订阅 Token 和 AnyTLS 密码；旧链接立即 404，旧凭据在节点下一轮同步（≤60 秒）后失效。

## 9. 端口/线路被干扰

**问题**：8443 在中国移动网络下被干扰；部分中转端口超时；不同运营商对同一节点速度差异巨大。

**方案**：

- AnyTLS 统一 2053 端口；中转入口 18444/18446/18447。
- 随机二级域名 + 证书，被 ban 后只换 IP/域名不改端口体系。
- 全节点安装 BBRplus + fq 拥塞控制。
- 香港 CN2GIA、日本直连等多线路组合，实测后按运营商分流。

## 10. 面板白屏

**问题**：Vite 默认 `base: "/"` 生成绝对资源路径，面板部署在隐藏路径 `/admin-xxx/` 下，nginx 找不到 `/assets/...` 又兜底返回 index.html，浏览器把 HTML 当 JS 解析，页面空白。

**方案**：`vite.config.mjs` 设置 `base: "./"`，资源改为相对路径；同时验证 JS/CSS 的 Content-Type 正确。

## 11. 前端机部署文件传输中断

**问题**：Mac 直连前端机 scp 大文件经常中断（限速/断流），且 expect 脚本不传播退出码，导致旧包重复解压误删新文件。

**方案**：

- 中转分发：Mac → 后端机（稳定）→ 后端机临时 HTTP 服务 → 前端机 `curl` 拉取，并 sha256 校验。
- 部署脚本不再在解压前 `rm` 目标文件名，避免误删；旧哈希文件保留无害。

## 12. 权限组节点数虚高（幽灵 ID）

**问题**：删除中转入口后，权限组 `allowedAccessNodes` 仍残留该节点 ID；勾选界面只显示现存节点，但“节点数”按原始数组长度计算，出现“选了 4 个显示 5 个”。

**方案**：

- 后端删除节点/中转入口时同步清理权限组与用户的引用。
- `normalizeState` 加载时清理所有不存在的节点引用。
- 前端只统计“当前存在且去重”的节点 ID。

## 13. 用户流量归属匹配失败

**问题**：V2Ray API 统计初版用 inbound tag 当 userId 匹配不到用户，用量不累计。

**方案**：统计归属改为读取 inbound `users[0].name`（即 userId），与 V2Ray API 的 `user>>>userId>>>...` 对齐。

## 14. 运维文档类问题

- 新前端机 SSH 密码在文档中与下一行文字粘连，导致多复制一个字符（`4Ey58LSTndY6` 被读成 `...Y6a`）：解析文档表格时按段落提取，并确认 IP/密码对应关系。
- 旧前端机 SSH 长期超时，但已不在 DNS 解析路径，不影响线上；保留其构建副本备用。

## 15. 证书方案选择

**问题**：Cloudflare 证书 vs Let's Encrypt。

**方案**：使用 Let's Encrypt + Cloudflare DNS-01 验证：免费、90 天自动续期、不依赖 80 端口、支持泛域名场景；Cloudflare 证书在代理节点上不适用。
