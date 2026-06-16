import {
  IconActivityHeartbeat,
  IconAdjustmentsHorizontal,
  IconBellRinging,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheck,
  IconCloudComputing,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconFileCode,
  IconGitBranch,
  IconHome2,
  IconLayoutSidebarLeftCollapse,
  IconLock,
  IconMenu2,
  IconNetwork,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconSelector,
  IconSettings,
  IconShieldLock,
  IconStack2,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  clearAdminSession,
  fetchAdminSession,
  getAdminApiSettings,
  hasAdminApiToken,
  loginAdmin,
  logoutAdmin,
  saveAdminApiSettings,
} from "./admin-api.js";

const navItems = [
  { id: "overview", label: "总览", icon: IconHome2 },
  { id: "users", label: "用户", icon: IconUsersGroup },
  { id: "plans", label: "套餐", icon: IconStack2 },
  { id: "access-nodes", label: "访问节点", icon: IconNetwork },
  { id: "proxy-nodes", label: "代理节点", icon: IconCloudComputing },
  { id: "inbounds", label: "协议入站", icon: IconRoute },
  { id: "transit-relays", label: "中转服务器", icon: IconGitBranch },
  { id: "relay-rules", label: "转发规则", icon: IconActivityHeartbeat },
  { id: "frontend-edges", label: "前端入口", icon: IconShieldLock },
  { id: "subscription-edges", label: "订阅入口", icon: IconNetwork },
  { id: "subscription-policies", label: "订阅策略", icon: IconAdjustmentsHorizontal },
  { id: "config", label: "配置发布", icon: IconFileCode },
  { id: "agents", label: "Agent", icon: IconCloudComputing },
  { id: "health", label: "健康检查", icon: IconActivityHeartbeat },
  { id: "alerts", label: "告警", icon: IconBellRinging },
  { id: "traffic", label: "流量统计", icon: IconSelector },
  { id: "domains", label: "域名证书", icon: IconExternalLink },
  { id: "audit-logs", label: "审计日志", icon: IconFileCode },
  { id: "backups", label: "备份恢复", icon: IconCopy },
  { id: "settings", label: "系统设置", icon: IconSettings },
];

const accessNodes = [
  {
    id: "access-hk-direct-tcp-443",
    summary: "VLESS REALITY · TCP 443",
    group: "Direct 节点",
    type: "Direct",
    protocol: "TCP",
    displayHost: "hk-01.example.com",
    port: "443",
    proxyNode: "proxy-hk-01",
    transitRelay: "-",
    visible: true,
    status: "运行中",
    configVersion: "v12",
    inbound: "inbound-vless-443",
    relayRule: "-",
    plans: ["基础版", "标准版", "企业版"],
    appliedAt: "2026-06-16 09:42:18",
    createdAt: "2026-05-12 09:22:41",
  },
  {
    id: "access-hk-direct-udp-443",
    summary: "Hysteria2 · UDP 443",
    group: "Direct 节点",
    type: "Direct",
    protocol: "UDP",
    displayHost: "hk-01.example.com",
    port: "443",
    proxyNode: "proxy-hk-01",
    transitRelay: "-",
    visible: true,
    status: "运行中",
    configVersion: "v12",
    inbound: "inbound-hy2-443",
    relayRule: "-",
    plans: ["标准版", "企业版"],
    appliedAt: "2026-06-16 09:42:18",
    createdAt: "2026-05-12 09:25:12",
  },
  {
    id: "access-sg-direct-quic-443",
    summary: "Hysteria2 · QUIC 443",
    group: "Direct 节点",
    type: "Direct",
    protocol: "QUIC",
    displayHost: "sg-01.example.com",
    port: "443",
    proxyNode: "proxy-sg-01",
    transitRelay: "-",
    visible: true,
    status: "运行中",
    configVersion: "v11",
    inbound: "inbound-hy2-443",
    relayRule: "-",
    plans: ["企业版"],
    appliedAt: "2026-06-15 18:12:20",
    createdAt: "2026-05-09 12:08:33",
  },
  {
    id: "access-hk-relay-01",
    summary: "VLESS REALITY · relay-hk-01:8443",
    group: "Relay 节点",
    type: "Relay",
    protocol: "TCP",
    displayHost: "relay-hk.example.com",
    port: "8443",
    proxyNode: "proxy-hk-01",
    transitRelay: "relay-hk-01",
    visible: true,
    status: "运行中",
    configVersion: "v12",
    inbound: "inbound-vless-443",
    relayRule: "relay-hk-tcp-8443",
    plans: ["基础版", "标准版", "企业版"],
    appliedAt: "2026-06-16 09:42:18",
    createdAt: "2026-05-18 10:15:31",
  },
  {
    id: "access-hk-relay-02",
    summary: "Hysteria2 · relay-hk-01:8443",
    group: "Relay 节点",
    type: "Relay",
    protocol: "UDP",
    displayHost: "relay-hk.example.com",
    port: "8443",
    proxyNode: "proxy-hk-01",
    transitRelay: "relay-hk-01",
    visible: true,
    status: "运行中",
    configVersion: "v12",
    inbound: "inbound-hy2-443",
    relayRule: "relay-hk-udp-8443",
    plans: ["标准版", "企业版"],
    appliedAt: "2026-06-16 09:40:33",
    createdAt: "2026-05-18 10:17:04",
  },
  {
    id: "access-sg-relay-01",
    summary: "VLESS REALITY · relay-sg-01:8443",
    group: "Relay 节点",
    type: "Relay",
    protocol: "TCP",
    displayHost: "relay-sg.example.com",
    port: "8443",
    proxyNode: "proxy-sg-01",
    transitRelay: "relay-sg-01",
    visible: true,
    status: "运行中",
    configVersion: "v11",
    inbound: "inbound-vless-443",
    relayRule: "relay-sg-tcp-8443",
    plans: ["企业版"],
    appliedAt: "2026-06-15 22:18:40",
    createdAt: "2026-05-10 16:44:22",
  },
  {
    id: "access-jp-relay-01",
    summary: "VLESS REALITY · relay-jp-01:8443",
    group: "Relay 节点",
    type: "Relay",
    protocol: "TCP",
    displayHost: "relay-jp.example.com",
    port: "8443",
    proxyNode: "proxy-jp-01",
    transitRelay: "relay-jp-01",
    visible: true,
    status: "待发布",
    configVersion: "v13",
    inbound: "inbound-vless-443",
    relayRule: "relay-jp-tcp-8443",
    plans: ["标准版"],
    appliedAt: "等待发布",
    createdAt: "2026-06-16 08:30:09",
  },
];

const users = [
  {
    id: "user-chen-001",
    summary: "标准版 · 到期 2026-08-18",
    group: "活跃用户",
    name: "chen-admin",
    status: "正常",
    plan: "标准版",
    expiresAt: "2026-08-18",
    trafficUsed: "182 / 500 GB",
    protocols: "VLESS, HY2",
    subscription: "启用",
    lastSeen: "3 分钟前",
    configVersion: "v12",
    uuid: "6cb1f7d2-9d6a-4f3a",
    hy2Password: "hy2_user_chen_001",
    nodes: "7 个访问节点",
    createdAt: "2026-04-01 11:08:22",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "user-liu-002",
    summary: "企业版 · 到期 2027-01-01",
    group: "活跃用户",
    name: "liu-team",
    status: "正常",
    plan: "企业版",
    expiresAt: "2027-01-01",
    trafficUsed: "864 / 2000 GB",
    protocols: "VLESS, HY2",
    subscription: "启用",
    lastSeen: "17 分钟前",
    configVersion: "v12",
    uuid: "8c02e4c6-2117-4bd7",
    hy2Password: "hy2_user_liu_002",
    nodes: "9 个访问节点",
    createdAt: "2026-03-12 16:44:10",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "user-wang-003",
    summary: "基础版 · 到期 2026-06-30",
    group: "活跃用户",
    name: "wang-basic",
    status: "正常",
    plan: "基础版",
    expiresAt: "2026-06-30",
    trafficUsed: "42 / 100 GB",
    protocols: "VLESS",
    subscription: "启用",
    lastSeen: "1 小时前",
    configVersion: "v11",
    uuid: "a3719f01-4f27-47aa",
    hy2Password: "未启用",
    nodes: "3 个访问节点",
    createdAt: "2026-05-04 09:21:18",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "user-zhao-004",
    summary: "标准版 · 暂停",
    group: "需处理",
    name: "zhao-paused",
    status: "已暂停",
    plan: "标准版",
    expiresAt: "2026-07-15",
    trafficUsed: "501 / 500 GB",
    protocols: "VLESS, HY2",
    subscription: "禁用",
    lastSeen: "2 天前",
    configVersion: "v12",
    uuid: "f931712c-a55b-47d8",
    hy2Password: "hy2_user_zhao_004",
    nodes: "0 个访问节点",
    createdAt: "2026-02-19 13:40:08",
    appliedAt: "2026-06-16 09:42:18",
  },
];

const plans = [
  {
    id: "plan-basic",
    summary: "100 GB · 30 天",
    group: "启用套餐",
    name: "基础版",
    status: "启用",
    trafficQuota: "100 GB",
    duration: "30 天",
    protocols: "VLESS",
    accessNodes: "3 个",
    userCount: "82",
    udp: "否",
    hy2Speed: "-",
    configVersion: "v12",
    createdAt: "2026-03-01 10:00:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "plan-standard",
    summary: "500 GB · 90 天",
    group: "启用套餐",
    name: "标准版",
    status: "启用",
    trafficQuota: "500 GB",
    duration: "90 天",
    protocols: "VLESS, HY2",
    accessNodes: "7 个",
    userCount: "216",
    udp: "是",
    hy2Speed: "200 / 200 Mbps",
    configVersion: "v12",
    createdAt: "2026-03-01 10:08:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "plan-enterprise",
    summary: "2000 GB · 365 天",
    group: "启用套餐",
    name: "企业版",
    status: "启用",
    trafficQuota: "2000 GB",
    duration: "365 天",
    protocols: "VLESS, HY2",
    accessNodes: "9 个",
    userCount: "48",
    udp: "是",
    hy2Speed: "500 / 500 Mbps",
    configVersion: "v12",
    createdAt: "2026-03-01 10:15:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "plan-legacy",
    summary: "旧套餐 · 不再售卖",
    group: "停用套餐",
    name: "旧版迁移",
    status: "停用",
    trafficQuota: "300 GB",
    duration: "60 天",
    protocols: "VLESS",
    accessNodes: "2 个",
    userCount: "12",
    udp: "否",
    hy2Speed: "-",
    configVersion: "v10",
    createdAt: "2026-01-10 15:11:00",
    appliedAt: "2026-05-20 18:21:00",
  },
];

const proxyNodes = [
  {
    id: "proxy-hk-01",
    summary: "香港 · 1c1g · 双协议",
    group: "香港",
    name: "proxy-hk-01",
    status: "在线",
    host: "45.91.22.18",
    region: "Hong Kong",
    agentVersion: "0.3.6",
    inbounds: "2",
    accessNodes: "4",
    configVersion: "v12",
    heartbeat: "23 秒前",
    createdAt: "2026-05-10 09:18:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "proxy-sg-01",
    summary: "新加坡 · HY2 主力",
    group: "新加坡",
    name: "proxy-sg-01",
    status: "在线",
    host: "103.77.12.90",
    region: "Singapore",
    agentVersion: "0.3.6",
    inbounds: "2",
    accessNodes: "2",
    configVersion: "v11",
    heartbeat: "41 秒前",
    createdAt: "2026-05-11 10:30:00",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "proxy-jp-01",
    summary: "日本 · 新增待发布",
    group: "日本",
    name: "proxy-jp-01",
    status: "待发布",
    host: "160.16.88.40",
    region: "Tokyo",
    agentVersion: "0.3.6",
    inbounds: "1",
    accessNodes: "1",
    configVersion: "v13",
    heartbeat: "1 分钟前",
    createdAt: "2026-06-16 08:22:00",
    appliedAt: "等待发布",
  },
  {
    id: "proxy-us-legacy",
    summary: "旧节点 · 已离线",
    group: "需处理",
    name: "proxy-us-legacy",
    status: "离线",
    host: "198.51.100.24",
    region: "Los Angeles",
    agentVersion: "0.2.4",
    inbounds: "1",
    accessNodes: "0",
    configVersion: "v9",
    heartbeat: "3 天前",
    createdAt: "2026-02-08 16:40:00",
    appliedAt: "2026-05-03 11:07:00",
  },
];

const inbounds = [
  {
    id: "inbound-vless-443",
    summary: "REALITY · dest cloudflare.com:443",
    group: "VLESS REALITY",
    name: "inbound-vless-443",
    status: "运行中",
    protocol: "VLESS REALITY",
    proxyNode: "proxy-hk-01",
    listen: "0.0.0.0",
    port: "443",
    directAccess: "1",
    relayAccess: "2",
    users: "358",
    flow: "xtls-rprx-vision",
    configVersion: "v12",
    createdAt: "2026-05-12 09:22:41",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "inbound-hy2-443",
    summary: "HY2 · masquerade enabled",
    group: "Hysteria2",
    name: "inbound-hy2-443",
    status: "运行中",
    protocol: "Hysteria2",
    proxyNode: "proxy-hk-01",
    listen: "0.0.0.0",
    port: "443",
    directAccess: "1",
    relayAccess: "1",
    users: "264",
    flow: "udp native",
    configVersion: "v12",
    createdAt: "2026-05-12 09:25:12",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "inbound-sg-hy2-443",
    summary: "HY2 · high bandwidth",
    group: "Hysteria2",
    name: "inbound-sg-hy2-443",
    status: "运行中",
    protocol: "Hysteria2",
    proxyNode: "proxy-sg-01",
    listen: "0.0.0.0",
    port: "443",
    directAccess: "1",
    relayAccess: "0",
    users: "48",
    flow: "udp native",
    configVersion: "v11",
    createdAt: "2026-05-09 12:08:33",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "inbound-jp-vless-443",
    summary: "REALITY · waiting publish",
    group: "VLESS REALITY",
    name: "inbound-jp-vless-443",
    status: "待发布",
    protocol: "VLESS REALITY",
    proxyNode: "proxy-jp-01",
    listen: "0.0.0.0",
    port: "443",
    directAccess: "0",
    relayAccess: "1",
    users: "0",
    flow: "xtls-rprx-vision",
    configVersion: "v13",
    createdAt: "2026-06-16 08:28:30",
    appliedAt: "等待发布",
  },
];

const transitRelays = [
  {
    id: "relay-hk-01",
    summary: "香港入口 · TCP/UDP",
    group: "香港",
    name: "relay-hk-01",
    status: "在线",
    host: "relay-hk.example.com",
    region: "Hong Kong",
    agentVersion: "0.3.6",
    rules: "2",
    accessNodes: "2",
    tcp: "支持",
    udp: "支持",
    configVersion: "v12",
    heartbeat: "18 秒前",
    createdAt: "2026-05-18 10:00:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "relay-sg-01",
    summary: "新加坡入口 · TCP",
    group: "新加坡",
    name: "relay-sg-01",
    status: "在线",
    host: "relay-sg.example.com",
    region: "Singapore",
    agentVersion: "0.3.6",
    rules: "1",
    accessNodes: "1",
    tcp: "支持",
    udp: "关闭",
    configVersion: "v11",
    heartbeat: "52 秒前",
    createdAt: "2026-05-10 16:30:00",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "relay-jp-01",
    summary: "日本入口 · 新增待发布",
    group: "日本",
    name: "relay-jp-01",
    status: "待发布",
    host: "relay-jp.example.com",
    region: "Tokyo",
    agentVersion: "0.3.6",
    rules: "1",
    accessNodes: "1",
    tcp: "支持",
    udp: "关闭",
    configVersion: "v13",
    heartbeat: "1 分钟前",
    createdAt: "2026-06-16 08:31:00",
    appliedAt: "等待发布",
  },
];

const relayRules = [
  {
    id: "relay-hk-tcp-8443",
    summary: "relay-hk-01:8443 -> proxy-hk-01:443",
    group: "TCP",
    name: "relay-hk-tcp-8443",
    status: "运行中",
    transitRelay: "relay-hk-01",
    entryPort: "8443",
    targetHost: "proxy-hk-01",
    targetPort: "443",
    transport: "TCP",
    accessNode: "access-hk-relay-01",
    configVersion: "v12",
    createdAt: "2026-05-18 10:15:31",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "relay-hk-udp-8443",
    summary: "relay-hk-01:8443 -> proxy-hk-01:443",
    group: "UDP",
    name: "relay-hk-udp-8443",
    status: "运行中",
    transitRelay: "relay-hk-01",
    entryPort: "8443",
    targetHost: "proxy-hk-01",
    targetPort: "443",
    transport: "UDP",
    accessNode: "access-hk-relay-02",
    configVersion: "v12",
    createdAt: "2026-05-18 10:17:04",
    appliedAt: "2026-06-16 09:40:33",
  },
  {
    id: "relay-sg-tcp-8443",
    summary: "relay-sg-01:8443 -> proxy-sg-01:443",
    group: "TCP",
    name: "relay-sg-tcp-8443",
    status: "运行中",
    transitRelay: "relay-sg-01",
    entryPort: "8443",
    targetHost: "proxy-sg-01",
    targetPort: "443",
    transport: "TCP",
    accessNode: "access-sg-relay-01",
    configVersion: "v11",
    createdAt: "2026-05-10 16:44:22",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "relay-jp-tcp-8443",
    summary: "relay-jp-01:8443 -> proxy-jp-01:443",
    group: "TCP",
    name: "relay-jp-tcp-8443",
    status: "待发布",
    transitRelay: "relay-jp-01",
    entryPort: "8443",
    targetHost: "proxy-jp-01",
    targetPort: "443",
    transport: "TCP",
    accessNode: "access-jp-relay-01",
    configVersion: "v13",
    createdAt: "2026-06-16 08:32:00",
    appliedAt: "等待发布",
  },
];

const frontendEdges = [
  {
    id: "fe-hk-01",
    summary: "后台入口 · 工具站伪装",
    group: "香港",
    name: "fe-hk-01",
    status: "在线",
    host: "tools.example.com",
    region: "Hong Kong",
    version: "0.3.6",
    certificate: "有效 · 84 天",
    backend: "backend-core-hk",
    camouflage: "大小写数字转换",
    heartbeat: "25 秒前",
    createdAt: "2026-06-01 12:00:00",
    appliedAt: "2026-06-16 09:31:00",
  },
  {
    id: "fe-hk-02",
    summary: "备用入口 · 同步待发布",
    group: "香港",
    name: "fe-hk-02",
    status: "待发布",
    host: "calc.example.com",
    region: "Hong Kong",
    version: "0.3.6",
    certificate: "待签发",
    backend: "backend-core-hk",
    camouflage: "进制转换",
    heartbeat: "1 分钟前",
    createdAt: "2026-06-16 08:50:00",
    appliedAt: "等待发布",
  },
];

const subscriptionEdges = [
  {
    id: "sub-hk-01",
    summary: "Clash / Sing-box / V2ray",
    group: "香港",
    name: "sub-hk-01",
    status: "在线",
    host: "sub.example.com",
    region: "Hong Kong",
    cacheTtl: "90 秒",
    rateLimit: "60 req/min",
    policies: "3 个",
    lastAccess: "12 秒前",
    createdAt: "2026-06-01 12:12:00",
    appliedAt: "2026-06-16 09:31:00",
  },
  {
    id: "sub-sg-01",
    summary: "备用订阅入口",
    group: "新加坡",
    name: "sub-sg-01",
    status: "降级",
    host: "sub-sg.example.com",
    region: "Singapore",
    cacheTtl: "120 秒",
    rateLimit: "30 req/min",
    policies: "2 个",
    lastAccess: "8 分钟前",
    createdAt: "2026-06-02 11:22:00",
    appliedAt: "2026-06-15 20:31:00",
  },
];

const subscriptionPolicies = [
  {
    id: "policy-standard",
    summary: "默认排序 · 过滤不可用节点",
    group: "启用策略",
    name: "标准订阅",
    status: "启用",
    format: "Clash, Sing-box",
    planScope: "基础版, 标准版",
    nodeSort: "区域优先",
    hiddenOffline: "是",
    userAgentRule: "通用",
    createdAt: "2026-06-01 12:30:00",
    appliedAt: "2026-06-16 09:31:00",
  },
  {
    id: "policy-enterprise",
    summary: "企业线路 · 包含 HY2",
    group: "启用策略",
    name: "企业订阅",
    status: "启用",
    format: "Clash, Sing-box, URI",
    planScope: "企业版",
    nodeSort: "质量评分",
    hiddenOffline: "是",
    userAgentRule: "高级客户端",
    createdAt: "2026-06-01 12:35:00",
    appliedAt: "2026-06-16 09:31:00",
  },
];

const agents = [
  {
    id: "agent-proxy-hk-01",
    summary: "proxy-node · proxy-hk-01",
    group: "Proxy Node",
    name: "agent-proxy-hk-01",
    status: "在线",
    role: "proxy-node",
    boundResource: "proxy-hk-01",
    version: "0.3.6",
    capabilities: "xray, hysteria2",
    heartbeat: "23 秒前",
    configVersion: "v12",
    lastApply: "成功",
    createdAt: "2026-05-10 09:30:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "agent-relay-hk-01",
    summary: "transit-relay · relay-hk-01",
    group: "Transit Relay",
    name: "agent-relay-hk-01",
    status: "在线",
    role: "transit-relay",
    boundResource: "relay-hk-01",
    version: "0.3.6",
    capabilities: "realm",
    heartbeat: "18 秒前",
    configVersion: "v12",
    lastApply: "成功",
    createdAt: "2026-05-18 10:03:00",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "agent-proxy-us-legacy",
    summary: "proxy-node · offline",
    group: "需处理",
    name: "agent-proxy-us-legacy",
    status: "离线",
    role: "proxy-node",
    boundResource: "proxy-us-legacy",
    version: "0.2.4",
    capabilities: "xray",
    heartbeat: "3 天前",
    configVersion: "v9",
    lastApply: "离线容灾",
    createdAt: "2026-02-08 16:45:00",
    appliedAt: "2026-05-03 11:07:00",
  },
];

const configReleases = [
  {
    id: "release-v13-draft",
    summary: "3 项变更 · 等待发布",
    group: "待发布",
    version: "v13",
    status: "待发布",
    changedResources: "proxy-jp-01, relay-jp-01, access-jp-relay-01",
    agents: "2 个受影响",
    publishedBy: "admin",
    publishedAt: "-",
    failedReason: "-",
    createdAt: "2026-06-16 09:55:00",
    appliedAt: "等待发布",
  },
  {
    id: "release-v12",
    summary: "访问节点与用户权限更新",
    group: "已发布",
    version: "v12",
    status: "已应用",
    changedResources: "users, access-nodes, relay-rules",
    agents: "5 / 5 已应用",
    publishedBy: "admin",
    publishedAt: "2026-06-16 09:42:18",
    failedReason: "-",
    createdAt: "2026-06-16 09:40:10",
    appliedAt: "2026-06-16 09:42:18",
  },
  {
    id: "release-v11",
    summary: "新增 SG 线路",
    group: "已发布",
    version: "v11",
    status: "已应用",
    changedResources: "proxy-sg-01, inbound-sg-hy2-443",
    agents: "4 / 4 已应用",
    publishedBy: "admin",
    publishedAt: "2026-06-15 22:18:40",
    failedReason: "-",
    createdAt: "2026-06-15 22:12:03",
    appliedAt: "2026-06-15 22:18:40",
  },
  {
    id: "release-v10",
    summary: "旧版本 · 1 个 Agent 超时",
    group: "异常",
    version: "v10",
    status: "部分失败",
    changedResources: "proxy-us-legacy",
    agents: "3 / 4 已应用",
    publishedBy: "admin",
    publishedAt: "2026-05-20 18:21:00",
    failedReason: "agent-proxy-us-legacy timeout",
    createdAt: "2026-05-20 18:12:03",
    appliedAt: "2026-05-20 18:21:00",
  },
];

const healthChecks = [
  {
    id: "health-backend-core",
    summary: "API / DB / config compiler",
    group: "控制面",
    name: "Backend Core",
    status: "正常",
    target: "backend-core-hk",
    latency: "12 ms",
    successRate: "100%",
    lastCheck: "10 秒前",
    nextCheck: "50 秒后",
    createdAt: "2026-06-01 12:00:00",
    appliedAt: "2026-06-16 10:01:10",
  },
  {
    id: "health-proxy-hk-01",
    summary: "xray / hysteria2 / agent",
    group: "代理节点",
    name: "proxy-hk-01",
    status: "正常",
    target: "45.91.22.18",
    latency: "31 ms",
    successRate: "99.98%",
    lastCheck: "18 秒前",
    nextCheck: "42 秒后",
    createdAt: "2026-05-10 09:18:00",
    appliedAt: "2026-06-16 10:01:00",
  },
  {
    id: "health-sub-sg-01",
    summary: "subscription edge degraded",
    group: "边缘入口",
    name: "sub-sg-01",
    status: "降级",
    target: "sub-sg.example.com",
    latency: "182 ms",
    successRate: "96.20%",
    lastCheck: "55 秒前",
    nextCheck: "5 秒后",
    createdAt: "2026-06-02 11:22:00",
    appliedAt: "2026-06-16 10:00:55",
  },
];

const alerts = [
  {
    id: "alert-20260616-001",
    summary: "有 3 项配置等待发布",
    group: "警告",
    name: "待发布配置",
    status: "待处理",
    severity: "warning",
    resourceType: "Config",
    resourceName: "release-v13-draft",
    openedAt: "2026-06-16 09:55:00",
    assignee: "admin",
    createdAt: "2026-06-16 09:55:00",
    appliedAt: "未处理",
  },
  {
    id: "alert-20260615-004",
    summary: "旧 Agent 超过 24 小时无心跳",
    group: "严重",
    name: "Agent 离线",
    status: "待处理",
    severity: "critical",
    resourceType: "Agent",
    resourceName: "agent-proxy-us-legacy",
    openedAt: "2026-06-15 18:04:00",
    assignee: "admin",
    createdAt: "2026-06-15 18:04:00",
    appliedAt: "未处理",
  },
  {
    id: "alert-20260614-002",
    summary: "sub-sg-01 成功率低于阈值",
    group: "警告",
    name: "订阅入口降级",
    status: "已确认",
    severity: "warning",
    resourceType: "Subscription Edge",
    resourceName: "sub-sg-01",
    openedAt: "2026-06-14 23:10:00",
    assignee: "admin",
    createdAt: "2026-06-14 23:10:00",
    appliedAt: "2026-06-15 09:20:00",
  },
];

const trafficStats = [
  {
    id: "traffic-today-users",
    summary: "用户维度 · 今日",
    group: "用户",
    name: "用户总流量",
    status: "正常",
    dimension: "User",
    inbound: "all",
    upload: "128 GB",
    download: "1.42 TB",
    peak: "213 Mbps",
    updatedAt: "1 分钟前",
    createdAt: "2026-06-16 00:00:00",
    appliedAt: "2026-06-16 10:02:00",
  },
  {
    id: "traffic-proxy-hk-01",
    summary: "proxy-hk-01 · 今日",
    group: "代理节点",
    name: "proxy-hk-01",
    status: "正常",
    dimension: "Proxy Node",
    inbound: "VLESS, HY2",
    upload: "44 GB",
    download: "612 GB",
    peak: "118 Mbps",
    updatedAt: "1 分钟前",
    createdAt: "2026-06-16 00:00:00",
    appliedAt: "2026-06-16 10:02:00",
  },
  {
    id: "traffic-relay-hk-01",
    summary: "relay-hk-01 · 今日",
    group: "中转服务器",
    name: "relay-hk-01",
    status: "正常",
    dimension: "Transit Relay",
    inbound: "TCP, UDP",
    upload: "38 GB",
    download: "544 GB",
    peak: "94 Mbps",
    updatedAt: "1 分钟前",
    createdAt: "2026-06-16 00:00:00",
    appliedAt: "2026-06-16 10:02:00",
  },
];

const domains = [
  {
    id: "domain-tools-example",
    summary: "Frontend Edge · Cloudflare DNS",
    group: "前端入口",
    name: "tools.example.com",
    status: "有效",
    owner: "fe-hk-01",
    provider: "Cloudflare",
    certificate: "Universal SSL",
    expiresAt: "2026-09-08",
    autoRenew: "启用",
    createdAt: "2026-06-01 12:00:00",
    appliedAt: "2026-06-16 09:31:00",
  },
  {
    id: "domain-sub-example",
    summary: "Subscription Edge · Cloudflare DNS",
    group: "订阅入口",
    name: "sub.example.com",
    status: "有效",
    owner: "sub-hk-01",
    provider: "Cloudflare",
    certificate: "Universal SSL",
    expiresAt: "2026-09-08",
    autoRenew: "启用",
    createdAt: "2026-06-01 12:12:00",
    appliedAt: "2026-06-16 09:31:00",
  },
  {
    id: "domain-calc-example",
    summary: "备用前端入口 · 待签发",
    group: "待处理",
    name: "calc.example.com",
    status: "待发布",
    owner: "fe-hk-02",
    provider: "Cloudflare",
    certificate: "待签发",
    expiresAt: "-",
    autoRenew: "启用",
    createdAt: "2026-06-16 08:50:00",
    appliedAt: "等待发布",
  },
];

const auditLogs = [
  {
    id: "audit-20260616-1001",
    summary: "创建 access-jp-relay-01",
    group: "今天",
    time: "2026-06-16 09:55:00",
    actor: "admin",
    action: "create",
    resourceType: "Access Node",
    resourceName: "access-jp-relay-01",
    sourceIp: "203.0.113.12",
    status: "成功",
    createdAt: "2026-06-16 09:55:00",
    appliedAt: "记录完成",
  },
  {
    id: "audit-20260616-0931",
    summary: "更新 Frontend Edge 证书设置",
    group: "今天",
    time: "2026-06-16 09:31:00",
    actor: "admin",
    action: "update",
    resourceType: "Frontend Edge",
    resourceName: "fe-hk-01",
    sourceIp: "203.0.113.12",
    status: "成功",
    createdAt: "2026-06-16 09:31:00",
    appliedAt: "记录完成",
  },
  {
    id: "audit-20260615-2201",
    summary: "发布配置 v11",
    group: "昨天",
    time: "2026-06-15 22:18:40",
    actor: "admin",
    action: "publish",
    resourceType: "Config",
    resourceName: "release-v11",
    sourceIp: "203.0.113.12",
    status: "成功",
    createdAt: "2026-06-15 22:18:40",
    appliedAt: "记录完成",
  },
  {
    id: "audit-20260615-1804",
    summary: "旧 Agent 心跳检查失败",
    group: "昨天",
    time: "2026-06-15 18:04:00",
    actor: "system",
    action: "health-check",
    resourceType: "Agent",
    resourceName: "agent-proxy-us-legacy",
    sourceIp: "127.0.0.1",
    status: "失败",
    createdAt: "2026-06-15 18:04:00",
    appliedAt: "记录完成",
  },
];

const backups = [
  {
    id: "backup-20260616-0300",
    summary: "自动备份 · 已校验",
    group: "自动备份",
    name: "backup-20260616-0300",
    status: "成功",
    scope: "database, desired-state, audit",
    size: "42 MB",
    storage: "/var/lib/kato/backups",
    checksum: "sha256 verified",
    finishedAt: "2026-06-16 03:00:42",
    createdAt: "2026-06-16 03:00:00",
    appliedAt: "2026-06-16 03:00:42",
  },
  {
    id: "backup-20260615-0300",
    summary: "自动备份 · 已校验",
    group: "自动备份",
    name: "backup-20260615-0300",
    status: "成功",
    scope: "database, desired-state, audit",
    size: "41 MB",
    storage: "/var/lib/kato/backups",
    checksum: "sha256 verified",
    finishedAt: "2026-06-15 03:00:39",
    createdAt: "2026-06-15 03:00:00",
    appliedAt: "2026-06-15 03:00:39",
  },
  {
    id: "backup-manual-001",
    summary: "手动备份 · 下载可用",
    group: "手动备份",
    name: "manual-before-v12",
    status: "成功",
    scope: "database, desired-state",
    size: "39 MB",
    storage: "local",
    checksum: "sha256 verified",
    finishedAt: "2026-06-15 21:50:00",
    createdAt: "2026-06-15 21:49:20",
    appliedAt: "2026-06-15 21:50:00",
  },
];

const columns = {
  users: [
    { key: "id", label: "用户名", primary: true, width: "190px", subKey: "summary" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "plan", label: "套餐", width: "76px" },
    { key: "expiresAt", label: "到期时间", width: "104px" },
    { key: "trafficUsed", label: "流量", width: "124px" },
    { key: "protocols", label: "协议", width: "104px" },
    { key: "subscription", label: "订阅", width: "72px" },
    { key: "lastSeen", label: "最近使用", width: "90px" },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  plans: [
    { key: "name", label: "套餐", primary: true, width: "154px", subKey: "summary" },
    { key: "status", label: "状态", width: "68px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "trafficQuota", label: "流量额度", width: "92px" },
    { key: "duration", label: "有效期", width: "76px" },
    { key: "protocols", label: "协议", width: "96px" },
    { key: "accessNodes", label: "节点数", width: "72px" },
    { key: "userCount", label: "用户", width: "62px" },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  access: [
    { key: "id", label: "名称", primary: true, width: "190px", subKey: "summary" },
    { key: "type", label: "类型", width: "56px" },
    { key: "protocol", label: "协议", width: "54px" },
    { key: "displayHost", label: "显示主机", width: "160px" },
    { key: "port", label: "端口", width: "54px" },
    { key: "proxyNode", label: "代理节点", width: "94px" },
    { key: "transitRelay", label: "中转", width: "80px" },
    { key: "visible", label: "可见", width: "48px", align: "center", render: () => <VisibleCheck /> },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  proxy: [
    { key: "name", label: "节点", primary: true, width: "160px", subKey: "summary" },
    { key: "host", label: "公网地址", width: "116px" },
    { key: "region", label: "区域", width: "90px" },
    { key: "status", label: "Agent", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "agentVersion", label: "版本", width: "68px" },
    { key: "inbounds", label: "入站", width: "54px" },
    { key: "accessNodes", label: "访问节点", width: "68px" },
    { key: "configVersion", label: "配置", width: "54px" },
    { key: "heartbeat", label: "心跳", width: "80px" },
  ],
  inbounds: [
    { key: "name", label: "入站", primary: true, width: "176px", subKey: "summary" },
    { key: "protocol", label: "协议", width: "112px" },
    { key: "proxyNode", label: "代理节点", width: "96px" },
    { key: "port", label: "端口", width: "54px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "directAccess", label: "直连", width: "54px" },
    { key: "relayAccess", label: "中转", width: "54px" },
    { key: "users", label: "用户", width: "58px" },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  relays: [
    { key: "name", label: "中转服务器", primary: true, width: "158px", subKey: "summary" },
    { key: "host", label: "公网地址", width: "150px" },
    { key: "region", label: "区域", width: "90px" },
    { key: "status", label: "Agent", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "rules", label: "规则", width: "54px" },
    { key: "accessNodes", label: "访问节点", width: "68px" },
    { key: "tcp", label: "TCP", width: "54px" },
    { key: "udp", label: "UDP", width: "54px" },
    { key: "heartbeat", label: "心跳", width: "80px" },
  ],
  rules: [
    { key: "name", label: "规则", primary: true, width: "166px", subKey: "summary" },
    { key: "transitRelay", label: "中转", width: "98px" },
    { key: "entryPort", label: "入口端口", width: "70px" },
    { key: "targetHost", label: "目标", width: "96px" },
    { key: "targetPort", label: "目标端口", width: "70px" },
    { key: "transport", label: "传输", width: "58px" },
    { key: "accessNode", label: "Access Node", width: "128px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
  ],
  edges: [
    { key: "name", label: "入口", primary: true, width: "150px", subKey: "summary" },
    { key: "host", label: "域名", width: "154px" },
    { key: "region", label: "区域", width: "90px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "version", label: "版本", width: "66px" },
    { key: "certificate", label: "证书", width: "110px" },
    { key: "backend", label: "后端", width: "112px" },
    { key: "heartbeat", label: "心跳", width: "80px" },
  ],
  subscriptionEdges: [
    { key: "name", label: "订阅入口", primary: true, width: "150px", subKey: "summary" },
    { key: "host", label: "域名", width: "154px" },
    { key: "region", label: "区域", width: "90px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "cacheTtl", label: "缓存", width: "76px" },
    { key: "rateLimit", label: "限速", width: "90px" },
    { key: "policies", label: "策略", width: "62px" },
    { key: "lastAccess", label: "最近访问", width: "90px" },
  ],
  policies: [
    { key: "name", label: "策略", primary: true, width: "150px", subKey: "summary" },
    { key: "status", label: "状态", width: "68px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "format", label: "格式", width: "144px" },
    { key: "planScope", label: "套餐范围", width: "130px" },
    { key: "nodeSort", label: "排序", width: "80px" },
    { key: "hiddenOffline", label: "隐藏离线", width: "72px" },
    { key: "userAgentRule", label: "客户端", width: "86px" },
  ],
  agents: [
    { key: "name", label: "Agent", primary: true, width: "170px", subKey: "summary" },
    { key: "role", label: "角色", width: "106px" },
    { key: "boundResource", label: "绑定资源", width: "118px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "version", label: "版本", width: "66px" },
    { key: "capabilities", label: "能力", width: "130px" },
    { key: "heartbeat", label: "心跳", width: "82px" },
    { key: "configVersion", label: "配置", width: "54px" },
  ],
  releases: [
    { key: "version", label: "版本", primary: true, width: "142px", subKey: "summary" },
    { key: "status", label: "状态", width: "76px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "changedResources", label: "变更资源", width: "220px" },
    { key: "agents", label: "Agent", width: "100px" },
    { key: "publishedBy", label: "发布人", width: "72px" },
    { key: "publishedAt", label: "发布时间", width: "136px" },
    { key: "failedReason", label: "失败原因", width: "120px" },
  ],
  health: [
    { key: "name", label: "检查项", primary: true, width: "160px", subKey: "summary" },
    { key: "target", label: "目标", width: "140px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "latency", label: "延迟", width: "72px" },
    { key: "successRate", label: "成功率", width: "76px" },
    { key: "lastCheck", label: "最近检查", width: "90px" },
    { key: "nextCheck", label: "下次检查", width: "90px" },
  ],
  alerts: [
    { key: "name", label: "告警", primary: true, width: "158px", subKey: "summary" },
    { key: "status", label: "状态", width: "76px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "severity", label: "级别", width: "76px" },
    { key: "resourceType", label: "资源类型", width: "118px" },
    { key: "resourceName", label: "资源名称", width: "150px" },
    { key: "openedAt", label: "触发时间", width: "136px" },
    { key: "assignee", label: "处理人", width: "72px" },
  ],
  traffic: [
    { key: "name", label: "统计项", primary: true, width: "154px", subKey: "summary" },
    { key: "dimension", label: "维度", width: "98px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "inbound", label: "入站", width: "100px" },
    { key: "upload", label: "上传", width: "74px" },
    { key: "download", label: "下载", width: "82px" },
    { key: "peak", label: "峰值", width: "82px" },
    { key: "updatedAt", label: "更新", width: "82px" },
  ],
  domains: [
    { key: "name", label: "域名", primary: true, width: "166px", subKey: "summary" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "owner", label: "所属入口", width: "112px" },
    { key: "provider", label: "DNS", width: "96px" },
    { key: "certificate", label: "证书", width: "112px" },
    { key: "expiresAt", label: "到期", width: "96px" },
    { key: "autoRenew", label: "自动续期", width: "76px" },
  ],
  audit: [
    { key: "id", label: "日志", primary: true, width: "166px", subKey: "summary" },
    { key: "time", label: "时间", width: "136px" },
    { key: "actor", label: "操作人", width: "70px" },
    { key: "action", label: "动作", width: "88px" },
    { key: "resourceType", label: "资源类型", width: "112px" },
    { key: "resourceName", label: "资源名称", width: "146px" },
    { key: "sourceIp", label: "来源 IP", width: "112px" },
    { key: "status", label: "结果", width: "70px", render: (row) => <StatePill>{row.status}</StatePill> },
  ],
  backups: [
    { key: "name", label: "备份", primary: true, width: "166px", subKey: "summary" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "scope", label: "范围", width: "190px" },
    { key: "size", label: "大小", width: "70px" },
    { key: "storage", label: "存储", width: "154px" },
    { key: "checksum", label: "校验", width: "118px" },
    { key: "finishedAt", label: "完成时间", width: "136px" },
  ],
};

const resourceConfigs = {
  users: {
    title: "用户",
    subtitle: "创建用户、控制到期 / 流量 / 凭据 / 订阅权限",
    data: users,
    columns: columns.users,
    tableLabel: "用户列表",
    primaryAction: "新建用户",
    secondaryAction: "批量导入",
    searchPlaceholder: "搜索用户名、套餐或协议...",
    searchKeys: ["id", "name", "plan", "protocols"],
    segments: [{ label: "All", value: "All" }, { label: "Active", value: "正常" }, { label: "处理", value: "已暂停" }],
    segmentKey: "status",
    filters: [
      { key: "plan", label: "套餐", options: ["全部", "基础版", "标准版", "企业版"] },
      { key: "status", label: "状态", options: ["全部", "正常", "已暂停"] },
      { key: "subscription", label: "订阅", options: ["全部", "启用", "禁用"] },
    ],
    detailRows: [
      ["用户 ID", "id"], ["套餐", "plan"], ["到期时间", "expiresAt"], ["流量用量", "trafficUsed"],
      ["协议权限", "protocols"], ["订阅状态", "subscription"], ["创建时间", "createdAt"],
    ],
    relationRows: [
      ["可见节点", "nodes"], ["订阅入口", () => "-"], ["配置版本", "configVersion"],
    ],
    metricRows: [["应用时间", "appliedAt"], ["最近使用", "lastSeen"], ["Hysteria2", "hy2Password"]],
    preview: (row) => `user: ${row.id}\nplan: ${row.plan}\nprotocols: ${row.protocols}\nsubscription: ${row.subscription}\nnodes: ${row.nodes}\ntraffic: ${row.trafficUsed}`,
  },
  plans: {
    title: "套餐",
    subtitle: "定义流量额度、有效期、协议权限和节点可见范围",
    data: plans,
    columns: columns.plans,
    tableLabel: "套餐列表",
    primaryAction: "新建套餐",
    secondaryAction: "编辑排序",
    searchPlaceholder: "搜索套餐名称、协议或额度...",
    searchKeys: ["id", "name", "trafficQuota", "protocols"],
    segments: [{ label: "All", value: "All" }, { label: "启用", value: "启用" }, { label: "停用", value: "停用" }],
    segmentKey: "status",
    filters: [
      { key: "protocols", label: "协议", options: ["全部", "VLESS", "VLESS, HY2"] },
      { key: "udp", label: "UDP", options: ["全部", "是", "否"] },
      { key: "status", label: "状态", options: ["全部", "启用", "停用"] },
    ],
    detailRows: [["套餐 ID", "id"], ["流量额度", "trafficQuota"], ["有效期", "duration"], ["协议", "protocols"], ["允许 UDP", "udp"], ["HY2 速率", "hy2Speed"]],
    relationRows: [["访问节点", "accessNodes"], ["用户数量", "userCount"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `plan: ${row.id}\ntraffic_quota: ${row.trafficQuota}\nduration: ${row.duration}\nprotocols: ${row.protocols}\naccess_nodes: ${row.accessNodes}\nusers: ${row.userCount}`,
  },
  "access-nodes": {
    title: "访问节点",
    subtitle: "用户订阅中最终可见的 direct / relay 节点",
    data: accessNodes,
    columns: columns.access,
    tableLabel: "访问节点列表",
    primaryAction: "创建中转入口",
    secondaryAction: "新建访问节点",
    primaryKind: "relay",
    searchPlaceholder: "搜索名称、显示主机或代理节点...",
    searchKeys: ["id", "displayHost", "proxyNode", "transitRelay", "inbound"],
    segments: [{ label: "All", value: "All" }, { label: "Direct", value: "Direct" }, { label: "Relay", value: "Relay" }],
    segmentKey: "type",
    filters: [
      { key: "protocol", label: "协议", options: ["全部", "TCP", "UDP", "QUIC"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "visible", label: "可见性", options: ["全部", "true"] },
    ],
    detailRows: [["类型", "type"], ["协议 / 传输", "protocol"], ["显示主机", "displayHost"], ["端口", "port"], ["创建时间", "createdAt"], ["配置版本", "configVersion"]],
    relationRows: [["入站", "inbound"], ["中转规则", "relayRule"], ["代理节点", "proxyNode"], ["中转服务器", "transitRelay"]],
    metricRows: [["套餐可见性", (row) => row.plans.join("、")], ["应用时间", "appliedAt"], ["订阅可见", () => "是"]],
    preview: (row) => `- name: ${row.id}\n  type: ${row.type.toLowerCase()}\n  listen: 0.0.0.0:${row.port}\n  transport: ${row.protocol.toLowerCase()}\n  inbound: ${row.inbound}\n  transit_relay: ${row.transitRelay}`,
  },
  "proxy-nodes": {
    title: "代理节点",
    subtitle: "管理真实落地代理服务器、协议运行时和 Node Agent 状态",
    data: proxyNodes,
    columns: columns.proxy,
    tableLabel: "代理节点列表",
    primaryAction: "新建代理节点",
    secondaryAction: "生成安装 Token",
    searchPlaceholder: "搜索节点、IP 或区域...",
    searchKeys: ["id", "name", "host", "region"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "待发布", value: "待发布" }, { label: "离线", value: "离线" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong", "Singapore", "Tokyo", "Los Angeles"] },
      { key: "status", label: "状态", options: ["全部", "在线", "待发布", "离线"] },
      { key: "agentVersion", label: "版本", options: ["全部", "0.3.6", "0.2.4"] },
    ],
    detailRows: [["公网地址", "host"], ["区域", "region"], ["Agent 版本", "agentVersion"], ["协议入站", "inbounds"], ["访问节点", "accessNodes"], ["最近心跳", "heartbeat"]],
    relationRows: [["配置版本", "configVersion"], ["绑定 Agent", (row) => `agent-${row.id}`], ["状态", "status"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `proxy_node: ${row.id}\nhost: ${row.host}\nregion: ${row.region}\nruntimes:\n  xray: enabled\n  hysteria2: enabled\nconfig_revision: ${row.configVersion}`,
  },
  inbounds: {
    title: "协议入站",
    subtitle: "管理 VLESS REALITY / Hysteria2 入站和自动 direct Access Node 联动",
    data: inbounds,
    columns: columns.inbounds,
    tableLabel: "协议入站列表",
    primaryAction: "新建协议入站",
    secondaryAction: "批量启用",
    searchPlaceholder: "搜索入站、协议或代理节点...",
    searchKeys: ["id", "name", "protocol", "proxyNode"],
    segments: [{ label: "All", value: "All" }, { label: "VLESS", value: "VLESS REALITY" }, { label: "HY2", value: "Hysteria2" }],
    segmentKey: "protocol",
    filters: [
      { key: "proxyNode", label: "代理节点", options: ["全部", "proxy-hk-01", "proxy-sg-01", "proxy-jp-01"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "port", label: "端口", options: ["全部", "443"] },
    ],
    detailRows: [["协议", "protocol"], ["代理节点", "proxyNode"], ["监听地址", "listen"], ["监听端口", "port"], ["状态", "status"], ["flow / 模式", "flow"]],
    relationRows: [["直连 Access", "directAccess"], ["中转 Access", "relayAccess"], ["用户数量", "users"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `inbound: ${row.id}\nprotocol: ${row.protocol}\nproxy_node: ${row.proxyNode}\nlisten: ${row.listen}:${row.port}\nflow: ${row.flow}\nauto_direct_access: true`,
  },
  "transit-relays": {
    title: "中转服务器",
    subtitle: "管理 Realm 中转服务器、转发能力和 Relay Agent 状态",
    data: transitRelays,
    columns: columns.relays,
    tableLabel: "中转服务器列表",
    primaryAction: "新建中转服务器",
    secondaryAction: "生成安装 Token",
    searchPlaceholder: "搜索中转、域名或区域...",
    searchKeys: ["id", "name", "host", "region"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "待发布", value: "待发布" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong", "Singapore", "Tokyo"] },
      { key: "tcp", label: "TCP", options: ["全部", "支持"] },
      { key: "udp", label: "UDP", options: ["全部", "支持", "关闭"] },
    ],
    detailRows: [["公网地址", "host"], ["区域", "region"], ["Agent 版本", "agentVersion"], ["Realm 规则", "rules"], ["访问节点", "accessNodes"], ["最近心跳", "heartbeat"]],
    relationRows: [["TCP", "tcp"], ["UDP", "udp"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `transit_relay: ${row.id}\nhost: ${row.host}\nrealm_rules: ${row.rules}\ntcp: ${row.tcp}\nudp: ${row.udp}\nconfig_revision: ${row.configVersion}`,
  },
  "relay-rules": {
    title: "转发规则",
    subtitle: "管理 Realm TCP/UDP 转发规则和 Access Node 联动关系",
    data: relayRules,
    columns: columns.rules,
    tableLabel: "转发规则列表",
    primaryAction: "新建转发规则",
    secondaryAction: "同步中转规则",
    searchPlaceholder: "搜索规则、中转或目标...",
    searchKeys: ["id", "name", "transitRelay", "targetHost", "accessNode"],
    segments: [{ label: "All", value: "All" }, { label: "TCP", value: "TCP" }, { label: "UDP", value: "UDP" }],
    segmentKey: "transport",
    filters: [
      { key: "transitRelay", label: "中转", options: ["全部", "relay-hk-01", "relay-sg-01", "relay-jp-01"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "transport", label: "传输", options: ["全部", "TCP", "UDP"] },
    ],
    detailRows: [["中转服务器", "transitRelay"], ["入口端口", "entryPort"], ["目标主机", "targetHost"], ["目标端口", "targetPort"], ["传输", "transport"], ["状态", "status"]],
    relationRows: [["Access Node", "accessNode"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `[[endpoints]]\nlisten = \"0.0.0.0:${row.entryPort}\"\nremote = \"${row.targetHost}:${row.targetPort}\"\ntransport = \"${row.transport.toLowerCase()}\"\naccess_node = \"${row.accessNode}\"`,
  },
  "frontend-edges": {
    title: "前端入口",
    subtitle: "管理面板前端入口、工具站伪装、证书和 Backend API 对接状态",
    data: frontendEdges,
    columns: columns.edges,
    tableLabel: "前端入口列表",
    primaryAction: "注册前端入口",
    secondaryAction: "签发证书",
    searchPlaceholder: "搜索入口、域名或伪装类型...",
    searchKeys: ["id", "name", "host", "camouflage"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "待发布", value: "待发布" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong"] },
      { key: "certificate", label: "证书", options: ["全部", "有效 · 84 天", "待签发"] },
      { key: "backend", label: "后端", options: ["全部", "backend-core-hk"] },
    ],
    detailRows: [["域名", "host"], ["区域", "region"], ["版本", "version"], ["证书", "certificate"], ["工具站", "camouflage"], ["后端", "backend"]],
    relationRows: [["Backend API", "backend"], ["最近心跳", "heartbeat"], ["状态", "status"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `frontend_edge: ${row.id}\nhost: ${row.host}\ncamouflage: ${row.camouflage}\nbackend: ${row.backend}\ncertificate: ${row.certificate}`,
  },
  "subscription-edges": {
    title: "订阅入口",
    subtitle: "管理公开订阅服务器、缓存、限速和用户订阅访问入口",
    data: subscriptionEdges,
    columns: columns.subscriptionEdges,
    tableLabel: "订阅入口列表",
    primaryAction: "注册订阅入口",
    secondaryAction: "刷新缓存",
    searchPlaceholder: "搜索订阅入口、域名或区域...",
    searchKeys: ["id", "name", "host", "region"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "降级", value: "降级" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong", "Singapore"] },
      { key: "cacheTtl", label: "缓存", options: ["全部", "90 秒", "120 秒"] },
      { key: "rateLimit", label: "限速", options: ["全部", "60 req/min", "30 req/min"] },
    ],
    detailRows: [["域名", "host"], ["区域", "region"], ["缓存 TTL", "cacheTtl"], ["限速", "rateLimit"], ["策略数量", "policies"], ["最近访问", "lastAccess"]],
    relationRows: [["状态", "status"], ["应用时间", "appliedAt"]],
    metricRows: [["创建时间", "createdAt"], ["最近访问", "lastAccess"]],
    preview: (row) => `subscription_edge: ${row.id}\nhost: ${row.host}\ncache_ttl: ${row.cacheTtl}\nrate_limit: ${row.rateLimit}\npolicies: ${row.policies}`,
  },
  "subscription-policies": {
    title: "订阅策略",
    subtitle: "管理订阅格式、节点排序、套餐可见性和客户端兼容策略",
    data: subscriptionPolicies,
    columns: columns.policies,
    tableLabel: "订阅策略列表",
    primaryAction: "新建订阅策略",
    secondaryAction: "调整优先级",
    searchPlaceholder: "搜索策略、格式或套餐范围...",
    searchKeys: ["id", "name", "format", "planScope"],
    segments: [{ label: "All", value: "All" }, { label: "启用", value: "启用" }],
    segmentKey: "status",
    filters: [
      { key: "format", label: "格式", options: ["全部", "Clash, Sing-box", "Clash, Sing-box, URI"] },
      { key: "nodeSort", label: "排序", options: ["全部", "区域优先", "质量评分"] },
      { key: "hiddenOffline", label: "离线", options: ["全部", "是"] },
    ],
    detailRows: [["格式", "format"], ["套餐范围", "planScope"], ["节点排序", "nodeSort"], ["隐藏离线", "hiddenOffline"], ["客户端规则", "userAgentRule"], ["状态", "status"]],
    relationRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    metricRows: [["策略 ID", "id"], ["配置状态", "status"]],
    preview: (row) => `subscription_policy: ${row.id}\nformats: ${row.format}\nplans: ${row.planScope}\nnode_sort: ${row.nodeSort}\nhide_offline: ${row.hiddenOffline}`,
  },
  config: {
    title: "配置发布",
    subtitle: "查看配置版本、待发布变更、Agent 应用状态和失败原因",
    data: configReleases,
    columns: columns.releases,
    tableLabel: "配置发布列表",
    primaryAction: "发布配置",
    secondaryAction: "查看变更",
    searchPlaceholder: "搜索版本、变更资源或失败原因...",
    searchKeys: ["id", "version", "changedResources", "failedReason"],
    segments: [{ label: "All", value: "All" }, { label: "待发布", value: "待发布" }, { label: "已应用", value: "已应用" }, { label: "异常", value: "部分失败" }],
    segmentKey: "status",
    filters: [
      { key: "status", label: "状态", options: ["全部", "待发布", "已应用", "部分失败"] },
      { key: "publishedBy", label: "发布人", options: ["全部", "admin"] },
      { key: "agents", label: "Agent", options: ["全部", "2 个受影响", "5 / 5 已应用", "4 / 4 已应用", "3 / 4 已应用"] },
    ],
    detailRows: [["版本", "version"], ["状态", "status"], ["变更资源", "changedResources"], ["Agent", "agents"], ["发布人", "publishedBy"], ["发布时间", "publishedAt"]],
    relationRows: [["失败原因", "failedReason"], ["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    metricRows: [["发布 ID", "id"], ["配置状态", "status"]],
    preview: (row) => `config_release: ${row.version}\nstatus: ${row.status}\nchanged_resources: ${row.changedResources}\nagents: ${row.agents}\nfailed_reason: ${row.failedReason}`,
  },
  agents: {
    title: "Agent",
    subtitle: "查看所有服务器 Agent 的注册、心跳、版本、能力和配置应用状态",
    data: agents,
    columns: columns.agents,
    tableLabel: "Agent 列表",
    primaryAction: "生成安装 Token",
    secondaryAction: "复制安装命令",
    searchPlaceholder: "搜索 Agent、角色或绑定资源...",
    searchKeys: ["id", "name", "role", "boundResource", "capabilities"],
    segments: [{ label: "All", value: "All" }, { label: "Proxy", value: "proxy-node" }, { label: "Relay", value: "transit-relay" }],
    segmentKey: "role",
    filters: [
      { key: "status", label: "状态", options: ["全部", "在线", "离线"] },
      { key: "version", label: "版本", options: ["全部", "0.3.6", "0.2.4"] },
      { key: "lastApply", label: "应用", options: ["全部", "成功", "离线容灾"] },
    ],
    detailRows: [["角色", "role"], ["绑定资源", "boundResource"], ["状态", "status"], ["版本", "version"], ["能力", "capabilities"], ["最近心跳", "heartbeat"]],
    relationRows: [["配置版本", "configVersion"], ["最近应用", "lastApply"], ["创建时间", "createdAt"]],
    metricRows: [["应用时间", "appliedAt"], ["安装 Token", () => "仅生成时展示"]],
    preview: (row) => `agent: ${row.id}\nrole: ${row.role}\nbound_resource: ${row.boundResource}\ncapabilities: ${row.capabilities}\nconfig_revision: ${row.configVersion}\nlast_apply: ${row.lastApply}`,
  },
  health: {
    title: "健康检查",
    subtitle: "聚合 Backend、节点、中转、边缘入口和订阅入口的可用性检查",
    data: healthChecks,
    columns: columns.health,
    tableLabel: "健康检查列表",
    primaryAction: "立即检查",
    secondaryAction: "调整阈值",
    searchPlaceholder: "搜索检查项、目标或状态...",
    searchKeys: ["id", "name", "target", "summary"],
    segments: [{ label: "All", value: "All" }, { label: "正常", value: "正常" }, { label: "降级", value: "降级" }],
    segmentKey: "status",
    filters: [
      { key: "group", label: "分组", options: ["全部", "控制面", "代理节点", "边缘入口"] },
      { key: "status", label: "状态", options: ["全部", "正常", "降级"] },
      { key: "successRate", label: "成功率", options: ["全部", "100%", "99.98%", "96.20%"] },
    ],
    detailRows: [["目标", "target"], ["状态", "status"], ["延迟", "latency"], ["成功率", "successRate"], ["最近检查", "lastCheck"], ["下次检查", "nextCheck"]],
    relationRows: [["分组", "group"], ["创建时间", "createdAt"], ["更新时间", "appliedAt"]],
    metricRows: [["检查 ID", "id"], ["摘要", "summary"]],
    preview: (row) => `health_check: ${row.id}\ntarget: ${row.target}\nstatus: ${row.status}\nlatency: ${row.latency}\nsuccess_rate: ${row.successRate}`,
  },
  alerts: {
    title: "告警",
    subtitle: "处理 Agent 离线、配置失败、证书过期、备份失败和入口降级",
    data: alerts,
    columns: columns.alerts,
    tableLabel: "告警列表",
    primaryAction: "确认告警",
    secondaryAction: "告警规则",
    searchPlaceholder: "搜索告警、资源或级别...",
    searchKeys: ["id", "name", "summary", "resourceName"],
    segments: [{ label: "All", value: "All" }, { label: "待处理", value: "待处理" }, { label: "已确认", value: "已确认" }],
    segmentKey: "status",
    filters: [
      { key: "severity", label: "级别", options: ["全部", "warning", "critical"] },
      { key: "resourceType", label: "资源", options: ["全部", "Config", "Agent", "Subscription Edge"] },
      { key: "assignee", label: "处理人", options: ["全部", "admin"] },
    ],
    detailRows: [["级别", "severity"], ["资源类型", "resourceType"], ["资源名称", "resourceName"], ["触发时间", "openedAt"], ["处理人", "assignee"], ["状态", "status"]],
    relationRows: [["告警 ID", "id"], ["创建时间", "createdAt"], ["处理时间", "appliedAt"]],
    metricRows: [["摘要", "summary"], ["分组", "group"]],
    preview: (row) => `alert: ${row.id}\nseverity: ${row.severity}\nresource: ${row.resourceType}/${row.resourceName}\nstatus: ${row.status}\nsummary: ${row.summary}`,
  },
  traffic: {
    title: "流量统计",
    subtitle: "按用户、代理节点、中转服务器和协议维度查看流量与峰值",
    data: trafficStats,
    columns: columns.traffic,
    tableLabel: "流量统计列表",
    primaryAction: "导出报表",
    secondaryAction: "刷新统计",
    searchPlaceholder: "搜索统计维度、节点或入站...",
    searchKeys: ["id", "name", "dimension", "inbound"],
    segments: [{ label: "All", value: "All" }, { label: "用户", value: "User" }, { label: "节点", value: "Proxy Node" }, { label: "中转", value: "Transit Relay" }],
    segmentKey: "dimension",
    filters: [
      { key: "status", label: "状态", options: ["全部", "正常"] },
      { key: "inbound", label: "入站", options: ["全部", "all", "VLESS, HY2", "TCP, UDP"] },
      { key: "peak", label: "峰值", options: ["全部", "213 Mbps", "118 Mbps", "94 Mbps"] },
    ],
    detailRows: [["维度", "dimension"], ["入站", "inbound"], ["上传", "upload"], ["下载", "download"], ["峰值", "peak"], ["更新时间", "updatedAt"]],
    relationRows: [["状态", "status"], ["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    metricRows: [["统计 ID", "id"], ["摘要", "summary"]],
    preview: (row) => `traffic_stat: ${row.id}\ndimension: ${row.dimension}\nupload: ${row.upload}\ndownload: ${row.download}\npeak: ${row.peak}\nupdated_at: ${row.updatedAt}`,
  },
  domains: {
    title: "域名证书",
    subtitle: "统一管理前端入口、订阅入口的域名、DNS Provider 和证书到期状态",
    data: domains,
    columns: columns.domains,
    tableLabel: "域名证书列表",
    primaryAction: "新增域名",
    secondaryAction: "签发证书",
    searchPlaceholder: "搜索域名、入口或证书...",
    searchKeys: ["id", "name", "owner", "provider", "certificate"],
    segments: [{ label: "All", value: "All" }, { label: "有效", value: "有效" }, { label: "待发布", value: "待发布" }],
    segmentKey: "status",
    filters: [
      { key: "provider", label: "DNS", options: ["全部", "Cloudflare"] },
      { key: "autoRenew", label: "续期", options: ["全部", "启用"] },
      { key: "certificate", label: "证书", options: ["全部", "Universal SSL", "待签发"] },
    ],
    detailRows: [["所属入口", "owner"], ["DNS Provider", "provider"], ["证书", "certificate"], ["到期时间", "expiresAt"], ["自动续期", "autoRenew"], ["状态", "status"]],
    relationRows: [["域名 ID", "id"], ["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    metricRows: [["域名", "name"], ["分组", "group"]],
    preview: (row) => `domain: ${row.name}\nowner: ${row.owner}\nprovider: ${row.provider}\ncertificate: ${row.certificate}\nexpires_at: ${row.expiresAt}\nauto_renew: ${row.autoRenew}`,
  },
  "audit-logs": {
    title: "审计日志",
    subtitle: "追踪管理员和系统任务的关键操作、资源变更和失败记录",
    data: auditLogs,
    columns: columns.audit,
    tableLabel: "审计日志列表",
    primaryAction: "导出日志",
    secondaryAction: "清空筛选",
    searchPlaceholder: "搜索操作人、资源、动作或来源 IP...",
    searchKeys: ["id", "actor", "action", "resourceType", "resourceName", "sourceIp"],
    segments: [{ label: "All", value: "All" }, { label: "成功", value: "成功" }, { label: "失败", value: "失败" }],
    segmentKey: "status",
    filters: [
      { key: "actor", label: "操作人", options: ["全部", "admin", "system"] },
      { key: "resourceType", label: "资源", options: ["全部", "Access Node", "Frontend Edge", "Config", "Agent"] },
      { key: "action", label: "动作", options: ["全部", "create", "update", "publish", "health-check"] },
    ],
    detailRows: [["时间", "time"], ["操作人", "actor"], ["动作", "action"], ["资源类型", "resourceType"], ["资源名称", "resourceName"], ["来源 IP", "sourceIp"]],
    relationRows: [["结果", "status"], ["日志 ID", "id"], ["记录状态", "appliedAt"]],
    metricRows: [["摘要", "summary"], ["分组", "group"]],
    preview: (row) => `audit_log: ${row.id}\ntime: ${row.time}\nactor: ${row.actor}\naction: ${row.action}\nresource: ${row.resourceType}/${row.resourceName}\nresult: ${row.status}`,
  },
  backups: {
    title: "备份恢复",
    subtitle: "管理数据库、desired-state、审计日志的自动备份、校验和恢复入口",
    data: backups,
    columns: columns.backups,
    tableLabel: "备份列表",
    primaryAction: "立即备份",
    secondaryAction: "恢复演练",
    searchPlaceholder: "搜索备份、范围、存储或校验状态...",
    searchKeys: ["id", "name", "scope", "storage", "checksum"],
    segments: [{ label: "All", value: "All" }, { label: "自动", value: "自动备份" }, { label: "手动", value: "手动备份" }],
    segmentKey: "group",
    filters: [
      { key: "status", label: "状态", options: ["全部", "成功"] },
      { key: "storage", label: "存储", options: ["全部", "/var/lib/kato/backups", "local"] },
      { key: "checksum", label: "校验", options: ["全部", "sha256 verified"] },
    ],
    detailRows: [["范围", "scope"], ["大小", "size"], ["存储", "storage"], ["校验", "checksum"], ["完成时间", "finishedAt"], ["状态", "status"]],
    relationRows: [["备份 ID", "id"], ["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    metricRows: [["名称", "name"], ["分组", "group"]],
    preview: (row) => `backup: ${row.id}\nscope: ${row.scope}\nsize: ${row.size}\nstorage: ${row.storage}\nchecksum: ${row.checksum}\nfinished_at: ${row.finishedAt}`,
  },
};

const demoModeEnabled = import.meta.env?.VITE_ENABLE_DEMO === "true";

const apiCollections = {
  users: "users",
  plans: "plans",
  "proxy-nodes": "proxy-nodes",
  inbounds: "node-inbounds",
  "transit-relays": "transit-relays",
  "access-nodes": "access-nodes",
  "relay-rules": "relay-rules",
};

const backendCollections = ["plans", "users", "proxy-nodes", "node-inbounds", "transit-relays", "access-nodes", "relay-rules"];
const writableSections = new Set(Object.keys(apiCollections));
const gib = 1024 ** 3;

function createInitialResourceData() {
  return Object.fromEntries(
    Object.entries(resourceConfigs).map(([sectionId, config]) => [sectionId, demoModeEnabled ? config.data : []]),
  );
}

function buildSummaryCards(resourceData = {}) {
  const agents = resourceData.agents || [];
  const offlineAgents = agents.filter((agent) => ["离线", "故障", "失败"].includes(agent.status)).length;
  const pendingAccessNodes = (resourceData["access-nodes"] || []).filter((node) => node.status === "待发布").length;
  return [
    { label: "用户", value: String((resourceData.users || []).length), meta: "当前数据库用户", tone: "success" },
    { label: "访问节点", value: String((resourceData["access-nodes"] || []).length), meta: `${pendingAccessNodes} 个待发布`, tone: pendingAccessNodes ? "warning" : "success" },
    { label: "代理节点", value: String((resourceData["proxy-nodes"] || []).length), meta: "由 Agent 接管配置", tone: "success" },
    { label: "中转服务器", value: String((resourceData["transit-relays"] || []).length), meta: "同步转发规则", tone: "success" },
    { label: "Agent", value: String(agents.length), meta: offlineAgents ? `${offlineAgents} 个异常` : "心跳正常", tone: offlineAgents ? "danger" : "success" },
    { label: "今日流量", value: "0 GB", meta: "统计模块待接入", tone: "warning" },
  ];
}

function buildOverviewTasks(resourceData = {}) {
  const tasks = [];
  const pendingAccessNodes = (resourceData["access-nodes"] || []).filter((node) => node.status === "待发布");
  const offlineAgents = (resourceData.agents || []).filter((agent) => ["离线", "故障", "失败"].includes(agent.status));
  const degradedSubscriptionEdges = (resourceData["subscription-edges"] || []).filter((edge) => ["降级", "故障"].includes(edge.status));
  if (pendingAccessNodes.length) {
    tasks.push({ tone: "warning", title: `${pendingAccessNodes.length} 个访问节点待发布`, meta: "请检查并发布最新配置" });
  }
  if (offlineAgents.length) {
    tasks.push({ tone: "danger", title: `${offlineAgents.length} 个 Agent 异常`, meta: "请检查节点连接状态" });
  }
  if (degradedSubscriptionEdges.length) {
    tasks.push({ tone: "warning", title: `${degradedSubscriptionEdges.length} 个订阅入口降级`, meta: "请检查订阅入口健康状态" });
  }
  return tasks;
}

function buildOverviewEvents(resourceData = {}) {
  return (resourceData.config || []).slice(0, 3).map((item) => ({
    version: item.version || item.name || "-",
    title: item.status || "未知状态",
    meta: item.publishedAt || item.appliedAt || item.createdAt || "-"
  }));
}

function buildOverviewHealthTiles(resourceData = {}) {
  return (resourceData.agents || []).map((agent) => ({
    name: agent.name || agent.id,
    status: agent.status || "未知",
    tone: getStatusTone(agent.status),
    meta: agent.heartbeat || agent.lastSeen || "-"
  }));
}

function uniqueRowValues(rows = [], key) {
  const values = rows
    .map((row) => row?.[key])
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map((value) => String(value));
  return [...new Set(values)];
}

function resolveRuntimeResourceConfig(config, rows = []) {
  const segments = config.segmentKey
    ? [{ label: "All", value: "All" }, ...uniqueRowValues(rows, config.segmentKey).map((value) => ({ label: value, value }))]
    : [{ label: "All", value: "All" }];
  const filters = (config.filters || []).map((filter) => ({
    ...filter,
    options: ["全部", ...uniqueRowValues(rows, filter.key)],
  }));
  return { ...config, segments, filters };
}

function resourceRecordId(row) {
  return row?.raw?.id || row?.resourceId || row?.id;
}

function optionRows(rows = []) {
  return rows.map((row) => ({
    label: row.name || row.id || row.summary || resourceRecordId(row),
    value: resourceRecordId(row),
  }));
}

function selectDefault(rows = []) {
  return resourceRecordId(rows[0]) || "";
}

function splitList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value, fallback = "-") {
  const list = Array.isArray(value) ? value : splitList(value);
  return list.length ? list.join(", ") : fallback;
}

function toNumber(value, fallback = null) {
  if (value === "" || value === undefined || value === null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function trafficBytesFromGiB(value) {
  const number = toNumber(value, null);
  return number === null ? null : Math.round(number * gib);
}

function formatBytes(value) {
  if (value === undefined || value === null) return "不限";
  const number = Number(value);
  if (!Number.isFinite(number)) return "不限";
  if (number >= 1024 ** 4) return `${trimNumber(number / 1024 ** 4)} TB`;
  if (number >= gib) return `${trimNumber(number / gib)} GB`;
  if (number >= 1024 ** 2) return `${trimNumber(number / 1024 ** 2)} MB`;
  return `${number} B`;
}

function trimNumber(value) {
  return Number(value.toFixed(1)).toString();
}

function isoText(value, fallback = "-") {
  if (!value) return fallback;
  return String(value).replace("T", " ").slice(0, 19);
}

function protocolLabel(protocol) {
  if (protocol === "vless-reality") return "VLESS";
  if (protocol === "hysteria2") return "HY2";
  if (protocol === "realm") return "Realm";
  return protocol || "-";
}

function protocolLongLabel(protocol) {
  if (protocol === "vless-reality") return "VLESS REALITY";
  if (protocol === "hysteria2") return "Hysteria2";
  return protocolLabel(protocol);
}

function protocolListLabel(protocols, fallback = "-") {
  return joinList(protocols.map(protocolLabel), fallback);
}

function enabledLabel(record, active = "运行中", inactive = "停用") {
  return record.enabled === false ? inactive : active;
}

function agentStatusLabel(agent) {
  if (!agent) return "未注册";
  if (agent.status === "online") return "在线";
  if (agent.status === "registered") return "已注册";
  return agent.status || "未知";
}

function agentHeartbeat(agent) {
  return agent?.lastSeenAt ? isoText(agent.lastSeenAt) : "未上报";
}

function indexById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function countBy(items = [], key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function adaptBackendResources({ collections, agents: rawAgents, summary }) {
  const plansRaw = collections.plans || [];
  const usersRaw = collections.users || [];
  const proxyRaw = collections["proxy-nodes"] || [];
  const inboundRaw = collections["node-inbounds"] || [];
  const relayRaw = collections["transit-relays"] || [];
  const accessRaw = collections["access-nodes"] || [];
  const ruleRaw = collections["relay-rules"] || [];
  const agentsRaw = rawAgents || [];

  const plansById = indexById(plansRaw);
  const proxyById = indexById(proxyRaw);
  const inboundById = indexById(inboundRaw);
  const relayById = indexById(relayRaw);
  const accessById = indexById(accessRaw);
  const rulesById = indexById(ruleRaw);
  const agentsById = indexById(agentsRaw);
  const inboundsByProxy = countBy(inboundRaw, "proxyNodeId");
  const accessByProxy = countBy(accessRaw, "proxyNodeId");
  const accessByInbound = countBy(accessRaw, "inboundId");
  const rulesByRelay = countBy(ruleRaw, "relayId");
  const accessByRelay = countBy(accessRaw, "transitRelayId");
  const rulesByInbound = countBy(ruleRaw, "inboundId");

  const context = {
    plansById,
    proxyById,
    inboundById,
    relayById,
    accessById,
    rulesById,
    agentsById,
    inboundsByProxy,
    accessByProxy,
    accessByInbound,
    rulesByRelay,
    accessByRelay,
    rulesByInbound,
    usersRaw,
    accessRaw,
    summary,
  };

  return {
    plans: plansRaw.map((plan) => adaptPlan(plan, context)),
    users: usersRaw.map((user) => adaptUser(user, context)),
    "proxy-nodes": proxyRaw.map((node) => adaptProxyNode(node, context)),
    inbounds: inboundRaw.map((inbound) => adaptInbound(inbound, context)),
    "transit-relays": relayRaw.map((relay) => adaptTransitRelay(relay, context)),
    "access-nodes": accessRaw.map((accessNode) => adaptAccessNode(accessNode, context)),
    "relay-rules": ruleRaw.map((rule) => adaptRelayRule(rule, context)),
    agents: agentsRaw.map((agent) => adaptAgent(agent, context)),
    config: adaptConfigReleases(summary, agentsRaw),
  };
}

function adaptPlan(plan, context) {
  const userCount = context.usersRaw.filter((user) => user.planId === plan.id).length;
  const protocols = protocolListLabel(plan.allowedProtocols || [], "继承默认");
  return {
    id: plan.name || plan.id,
    resourceId: plan.id,
    raw: plan,
    summary: `${formatBytes(plan.trafficLimitBytes)} · ${plan.durationDays || "不限"} 天`,
    group: plan.enabled === false ? "停用套餐" : "启用套餐",
    name: plan.name || plan.id,
    status: enabledLabel(plan, "启用", "停用"),
    trafficQuota: formatBytes(plan.trafficLimitBytes),
    duration: plan.durationDays ? `${plan.durationDays} 天` : "不限",
    protocols,
    accessNodes: `${context.accessRaw.length} 个`,
    userCount: String(userCount),
    udp: plan.allowUdp === false ? "否" : "是",
    hy2Speed: `${plan.hysteria2?.upMbps || 0} / ${plan.hysteria2?.downMbps || 0} Mbps`,
    configVersion: `v${context.summary?.version || 1}`,
    createdAt: isoText(plan.createdAt),
    appliedAt: isoText(plan.updatedAt || plan.createdAt),
  };
}

function adaptUser(user, context) {
  const plan = context.plansById.get(user.planId);
  const inheritedProtocols = plan?.allowedProtocols || [];
  const protocols = user.access?.protocols?.length ? user.access.protocols : inheritedProtocols;
  const total = user.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null;
  return {
    id: user.name || user.email || user.id,
    resourceId: user.id,
    raw: user,
    summary: `${plan?.name || "无套餐"} · 到期 ${isoText(user.expiresAt, "不限").slice(0, 10)}`,
    group: user.enabled === false ? "需处理" : "活跃用户",
    name: user.name || user.email || user.id,
    status: user.enabled === false ? "已暂停" : "正常",
    plan: plan?.name || "未绑定",
    expiresAt: isoText(user.expiresAt, "不限").slice(0, 10),
    trafficUsed: `${formatBytes(user.usedTrafficBytes || 0)} / ${formatBytes(total)}`,
    protocols: protocolListLabel(protocols, "继承套餐"),
    subscription: user.enabled === false ? "禁用" : "启用",
    lastSeen: user.lastProxyUseAt ? isoText(user.lastProxyUseAt) : "未使用",
    configVersion: `v${context.summary?.version || 1}`,
    uuid: user.credentials?.vlessUuid || "-",
    hy2Password: user.credentials?.hysteria2Password || "-",
    nodes: `${context.accessRaw.length} 个访问节点`,
    createdAt: isoText(user.createdAt),
    appliedAt: isoText(user.updatedAt || user.createdAt),
  };
}

function adaptProxyNode(node, context) {
  const agent = node.agentId ? context.agentsById.get(node.agentId) : null;
  return {
    id: node.name || node.id,
    resourceId: node.id,
    raw: node,
    summary: `${node.region || "未设置区域"} · ${joinList(node.capabilities || [], "待配置")}`,
    group: node.region || "未分组",
    name: node.name || node.id,
    status: node.enabled === false ? "离线" : agentStatusLabel(agent),
    host: node.publicHost || node.entryDomain || node.publicIp || "-",
    region: node.region || "-",
    agentVersion: agent?.version || "-",
    inbounds: String(context.inboundsByProxy[node.id] || 0),
    accessNodes: String(context.accessByProxy[node.id] || 0),
    configVersion: `v${context.summary?.version || 1}`,
    heartbeat: agentHeartbeat(agent),
    createdAt: isoText(node.createdAt),
    appliedAt: isoText(node.updatedAt || node.createdAt),
  };
}

function adaptInbound(inbound, context) {
  const proxyNode = context.proxyById.get(inbound.proxyNodeId);
  const directCount = context.accessRaw.filter((item) => item.inboundId === inbound.id && item.type === "direct").length;
  const relayCount = context.rulesByInbound[inbound.id] || 0;
  return {
    id: inbound.name || inbound.id,
    resourceId: inbound.id,
    raw: inbound,
    summary: inbound.protocol === "vless-reality"
      ? `REALITY · ${inbound.config?.reality?.dest || "auto dest"}`
      : `HY2 · ${inbound.config?.tls?.sni || proxyNode?.publicHost || "auto sni"}`,
    group: protocolLongLabel(inbound.protocol),
    name: inbound.name || inbound.id,
    status: enabledLabel(inbound),
    protocol: protocolLongLabel(inbound.protocol),
    proxyNode: proxyNode?.name || inbound.proxyNodeId,
    listen: inbound.listen || "0.0.0.0",
    port: String(inbound.port),
    directAccess: String(directCount),
    relayAccess: String(relayCount),
    users: String(context.usersRaw.length),
    flow: inbound.config?.flow || inbound.transport || "-",
    configVersion: `v${context.summary?.version || 1}`,
    createdAt: isoText(inbound.createdAt),
    appliedAt: isoText(inbound.updatedAt || inbound.createdAt),
  };
}

function adaptTransitRelay(relay, context) {
  const agent = relay.agentId ? context.agentsById.get(relay.agentId) : null;
  return {
    id: relay.name || relay.id,
    resourceId: relay.id,
    raw: relay,
    summary: `${relay.region || "未设置区域"}入口 · ${relay.engine || "realm"}`,
    group: relay.region || "未分组",
    name: relay.name || relay.id,
    status: relay.enabled === false ? "离线" : agentStatusLabel(agent),
    host: relay.publicHost || relay.publicIp || "-",
    region: relay.region || "-",
    agentVersion: agent?.version || "-",
    rules: String(context.rulesByRelay[relay.id] || 0),
    accessNodes: String(context.accessByRelay[relay.id] || 0),
    tcp: "支持",
    udp: "按规则",
    configVersion: `v${context.summary?.version || 1}`,
    heartbeat: agentHeartbeat(agent),
    createdAt: isoText(relay.createdAt),
    appliedAt: isoText(relay.updatedAt || relay.createdAt),
  };
}

function adaptAccessNode(accessNode, context) {
  const inbound = context.inboundById.get(accessNode.inboundId);
  const proxyNode = context.proxyById.get(accessNode.proxyNodeId);
  const relay = context.relayById.get(accessNode.transitRelayId);
  const rule = accessNode.relayRuleId ? context.rulesById.get(accessNode.relayRuleId) : null;
  return {
    id: accessNode.name || accessNode.id,
    resourceId: accessNode.id,
    raw: accessNode,
    summary: `${protocolLongLabel(accessNode.protocol)} · ${accessNode.host}:${accessNode.port}`,
    group: accessNode.type === "relay" ? "Relay 节点" : "Direct 节点",
    type: accessNode.type === "relay" ? "Relay" : "Direct",
    protocol: (accessNode.transport || inbound?.transport || "").toUpperCase() || protocolLabel(accessNode.protocol),
    displayHost: accessNode.host || "-",
    port: String(accessNode.port || "-"),
    proxyNode: proxyNode?.name || accessNode.proxyNodeId || "-",
    transitRelay: relay?.name || accessNode.transitRelayId || "-",
    visible: accessNode.enabled !== false,
    status: enabledLabel(accessNode),
    configVersion: `v${context.summary?.version || 1}`,
    inbound: inbound?.name || accessNode.inboundId || "-",
    relayRule: rule?.name || accessNode.relayRuleId || "-",
    plans: ["按套餐权限"],
    appliedAt: isoText(accessNode.updatedAt || accessNode.createdAt),
    createdAt: isoText(accessNode.createdAt),
  };
}

function adaptRelayRule(rule, context) {
  const relay = context.relayById.get(rule.relayId);
  const proxyNode = context.proxyById.get(rule.proxyNodeId);
  const accessNode = context.accessById.get(rule.accessNodeId);
  return {
    id: rule.name || rule.id,
    resourceId: rule.id,
    raw: rule,
    summary: `${relay?.name || rule.relayId}:${rule.entry?.port} -> ${proxyNode?.name || rule.proxyNodeId}:${rule.target?.port}`,
    group: (rule.transport || "tcp").toUpperCase(),
    name: rule.name || rule.id,
    status: enabledLabel(rule),
    transitRelay: relay?.name || rule.relayId,
    entryPort: String(rule.entry?.port || "-"),
    targetHost: rule.target?.host || proxyNode?.name || "-",
    targetPort: String(rule.target?.port || "-"),
    transport: (rule.transport || "-").toUpperCase(),
    accessNode: accessNode?.name || rule.accessNodeId || "-",
    configVersion: `v${context.summary?.version || 1}`,
    createdAt: isoText(rule.createdAt),
    appliedAt: isoText(rule.updatedAt || rule.createdAt),
  };
}

function adaptAgent(agent, context) {
  return {
    id: agent.name || agent.id,
    resourceId: agent.id,
    raw: agent,
    summary: `${agent.role} · ${agent.resourceId || agent.hostname || "unbound"}`,
    group: agent.role || "Agent",
    name: agent.name || agent.id,
    status: agentStatusLabel(agent),
    role: agent.role,
    boundResource: agent.resourceId || "-",
    version: agent.version || "-",
    capabilities: typeof agent.capabilities === "object" ? joinList(Object.keys(agent.capabilities)) : joinList(agent.capabilities),
    heartbeat: agentHeartbeat(agent),
    configVersion: `v${context.summary?.version || 1}`,
    lastApply: agent.lastConfigReport?.ok === false ? "失败" : "成功",
    createdAt: isoText(agent.createdAt),
    appliedAt: isoText(agent.lastConfigReport?.reportedAt || agent.lastSeenAt || agent.createdAt),
  };
}

function adaptConfigReleases(summary, rawAgents = []) {
  if (!summary) return demoModeEnabled ? configReleases : [];
  const onlineAgents = rawAgents.filter((agent) => agent.status === "online").length;
  return [
    {
      id: `release-v${summary.version}`,
      summary: "Backend Core 当前配置版本",
      group: "当前版本",
      version: `v${summary.version}`,
      status: "已应用",
      changedResources: Object.entries(summary.counts || {}).map(([key, value]) => `${key}:${value}`).join(", "),
      agents: `${onlineAgents} / ${rawAgents.length} 在线`,
      publishedBy: "system",
      publishedAt: isoText(summary.configUpdatedAt),
      failedReason: "-",
      createdAt: isoText(summary.configUpdatedAt),
      appliedAt: isoText(summary.configUpdatedAt),
    },
  ];
}

const resourceFormConfigs = {
  users: {
    label: "用户",
    fields: [
      { name: "name", label: "用户名", type: "text", defaultValue: "" },
      { name: "email", label: "邮箱", type: "text", defaultValue: "" },
      { name: "planId", label: "套餐", type: "select", options: (data) => optionRows(data.plans), defaultValue: (data) => selectDefault(data.plans) },
      { name: "expiresAt", label: "到期时间", type: "text", defaultValue: "" },
      { name: "trafficLimitGiB", label: "流量上限 GiB", type: "number", defaultValue: "" },
      { name: "enabled", label: "启用用户", type: "checkbox", defaultValue: true },
      { name: "protocols", label: "协议权限", type: "text", defaultValue: "vless-reality,hysteria2", hint: "逗号分隔，可留空继承套餐" },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      email: item.raw?.email || "",
      planId: item.raw?.planId || "",
      expiresAt: item.raw?.expiresAt || "",
      trafficLimitGiB: item.raw?.trafficLimitBytes ? trimNumber(item.raw.trafficLimitBytes / gib) : "",
      enabled: item.raw?.enabled !== false,
      protocols: joinList(item.raw?.access?.protocols || []),
    }),
    toApiInput: (values) => ({
      name: values.name,
      email: values.email || null,
      planId: values.planId || null,
      expiresAt: values.expiresAt || null,
      trafficLimitBytes: trafficBytesFromGiB(values.trafficLimitGiB),
      enabled: Boolean(values.enabled),
      access: { protocols: splitList(values.protocols) },
    }),
  },
  plans: {
    label: "套餐",
    fields: [
      { name: "name", label: "套餐名称", type: "text", defaultValue: "" },
      { name: "trafficLimitGiB", label: "流量额度 GiB", type: "number", defaultValue: 500 },
      { name: "durationDays", label: "有效期天数", type: "number", defaultValue: 90 },
      { name: "allowedProtocols", label: "允许协议", type: "text", defaultValue: "vless-reality,hysteria2" },
      { name: "allowUdp", label: "允许 UDP", type: "checkbox", defaultValue: true },
      { name: "speedLimitMbps", label: "限速 Mbps", type: "number", defaultValue: "" },
      { name: "enabled", label: "启用套餐", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      trafficLimitGiB: item.raw?.trafficLimitBytes ? trimNumber(item.raw.trafficLimitBytes / gib) : "",
      durationDays: item.raw?.durationDays || "",
      allowedProtocols: joinList(item.raw?.allowedProtocols || []),
      allowUdp: item.raw?.allowUdp !== false,
      speedLimitMbps: item.raw?.speedLimitMbps || "",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      enabled: Boolean(values.enabled),
      trafficLimitBytes: trafficBytesFromGiB(values.trafficLimitGiB),
      durationDays: toNumber(values.durationDays, null),
      allowedProtocols: splitList(values.allowedProtocols),
      allowUdp: Boolean(values.allowUdp),
      speedLimitMbps: toNumber(values.speedLimitMbps, null),
    }),
  },
  "proxy-nodes": {
    label: "代理节点",
    fields: [
      { name: "name", label: "节点名称", type: "text", defaultValue: "" },
      { name: "publicHost", label: "公网主机", type: "text", defaultValue: "" },
      { name: "publicIp", label: "公网 IP", type: "text", defaultValue: "" },
      { name: "privateIp", label: "内网 IP", type: "text", defaultValue: "" },
      { name: "entryDomain", label: "入口域名", type: "text", defaultValue: "" },
      { name: "region", label: "区域", type: "text", defaultValue: "" },
      { name: "provider", label: "云厂商", type: "text", defaultValue: "" },
      { name: "capabilities", label: "运行时能力", type: "text", defaultValue: "xray,hysteria2" },
      { name: "enabled", label: "启用节点", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      publicHost: item.raw?.publicHost || "",
      publicIp: item.raw?.publicIp || "",
      privateIp: item.raw?.privateIp || "",
      entryDomain: item.raw?.entryDomain || "",
      region: item.raw?.region || "",
      provider: item.raw?.provider || "",
      capabilities: joinList(item.raw?.capabilities || []),
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      publicHost: values.publicHost,
      publicIp: values.publicIp,
      privateIp: values.privateIp,
      entryDomain: values.entryDomain,
      region: values.region,
      provider: values.provider,
      capabilities: splitList(values.capabilities),
      enabled: Boolean(values.enabled),
    }),
  },
  inbounds: {
    label: "协议入站",
    fields: [
      { name: "name", label: "入站名称", type: "text", defaultValue: "" },
      { name: "proxyNodeId", label: "代理节点", type: "select", options: (data) => optionRows(data["proxy-nodes"]), defaultValue: (data) => selectDefault(data["proxy-nodes"]) },
      { name: "protocol", label: "协议", type: "select", defaultValue: "vless-reality", options: [{ label: "VLESS REALITY", value: "vless-reality" }, { label: "Hysteria2", value: "hysteria2" }] },
      { name: "port", label: "端口", type: "number", defaultValue: 443 },
      { name: "listen", label: "监听地址", type: "text", defaultValue: "0.0.0.0" },
      { name: "createDirectAccessNode", label: "同步创建 Direct 访问节点", type: "checkbox", defaultValue: true },
      { name: "dest", label: "REALITY Dest", type: "text", defaultValue: "www.microsoft.com:443" },
      { name: "sni", label: "HY2 SNI", type: "text", defaultValue: "" },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      proxyNodeId: item.raw?.proxyNodeId || "",
      protocol: item.raw?.protocol || "vless-reality",
      port: item.raw?.port || 443,
      listen: item.raw?.listen || "0.0.0.0",
      createDirectAccessNode: false,
      dest: item.raw?.config?.reality?.dest || "",
      sni: item.raw?.config?.tls?.sni || "",
    }),
    toApiInput: (values) => ({
      name: values.name,
      proxyNodeId: values.proxyNodeId,
      protocol: values.protocol,
      port: toNumber(values.port, 443),
      listen: values.listen || "0.0.0.0",
      createDirectAccessNode: Boolean(values.createDirectAccessNode),
      config: values.protocol === "hysteria2" ? { sni: values.sni } : { dest: values.dest },
    }),
  },
  "transit-relays": {
    label: "中转服务器",
    fields: [
      { name: "name", label: "中转名称", type: "text", defaultValue: "" },
      { name: "publicHost", label: "公网主机", type: "text", defaultValue: "" },
      { name: "publicIp", label: "公网 IP", type: "text", defaultValue: "" },
      { name: "privateIp", label: "内网 IP", type: "text", defaultValue: "" },
      { name: "region", label: "区域", type: "text", defaultValue: "" },
      { name: "provider", label: "云厂商", type: "text", defaultValue: "" },
      { name: "enabled", label: "启用中转", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      publicHost: item.raw?.publicHost || "",
      publicIp: item.raw?.publicIp || "",
      privateIp: item.raw?.privateIp || "",
      region: item.raw?.region || "",
      provider: item.raw?.provider || "",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      publicHost: values.publicHost,
      publicIp: values.publicIp,
      privateIp: values.privateIp,
      region: values.region,
      provider: values.provider,
      engine: "realm",
      enabled: Boolean(values.enabled),
    }),
  },
  "access-nodes": {
    label: "访问节点",
    fields: [
      { name: "name", label: "访问节点名称", type: "text", defaultValue: "" },
      { name: "inboundId", label: "协议入站", type: "select", options: (data) => optionRows(data.inbounds), defaultValue: (data) => selectDefault(data.inbounds) },
      { name: "host", label: "订阅展示主机", type: "text", defaultValue: "" },
      { name: "port", label: "展示端口", type: "number", defaultValue: "" },
      { name: "enabled", label: "订阅可见", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      inboundId: item.raw?.inboundId || "",
      host: item.raw?.host || "",
      port: item.raw?.port || "",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      inboundId: values.inboundId,
      host: values.host || undefined,
      port: toNumber(values.port, undefined),
      enabled: Boolean(values.enabled),
    }),
  },
  "relay-rules": {
    label: "转发规则",
    fields: [
      { name: "name", label: "规则名称", type: "text", defaultValue: "" },
      { name: "relayId", label: "中转服务器", type: "select", options: (data) => optionRows(data["transit-relays"]), defaultValue: (data) => selectDefault(data["transit-relays"]) },
      { name: "inboundId", label: "目标入站", type: "select", options: (data) => optionRows(data.inbounds), defaultValue: (data) => selectDefault(data.inbounds) },
      { name: "entryPort", label: "入口端口", type: "number", defaultValue: 8443 },
      { name: "targetHost", label: "目标主机", type: "text", defaultValue: "" },
      { name: "targetPort", label: "目标端口", type: "number", defaultValue: "" },
      { name: "transport", label: "传输", type: "select", defaultValue: "tcp", options: [{ label: "TCP", value: "tcp" }, { label: "UDP", value: "udp" }] },
      { name: "enabled", label: "启用规则", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      relayId: item.raw?.relayId || "",
      inboundId: item.raw?.inboundId || "",
      entryPort: item.raw?.entry?.port || "",
      targetHost: item.raw?.target?.host || "",
      targetPort: item.raw?.target?.port || "",
      transport: item.raw?.transport || "tcp",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      relayId: values.relayId,
      inboundId: values.inboundId,
      entry: { port: toNumber(values.entryPort, 8443) },
      target: { host: values.targetHost || undefined, port: toNumber(values.targetPort, undefined) },
      transport: values.transport || "tcp",
      enabled: Boolean(values.enabled),
    }),
  },
};

function makeLocalRow(sectionId, values, resourceData, item) {
  const now = new Date().toISOString();
  const rowId = item?.id || values.name || `local-${sectionId}-${Date.now()}`;
  const rawId = item?.raw?.id || `local_${sectionId.replaceAll("-", "_")}_${Date.now()}`;
  const raw = {
    ...(item?.raw || {}),
    ...resourceFormConfigs[sectionId].toApiInput(values),
    id: rawId,
    createdAt: item?.raw?.createdAt || now,
    updatedAt: now,
  };
  const version = item?.configVersion || "v-local";

  if (sectionId === "users") {
    const plan = resourceData.plans.find((row) => resourceRecordId(row) === values.planId);
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: `${plan?.name || "无套餐"} · 到期 ${values.expiresAt || "不限"}`,
      group: values.enabled ? "活跃用户" : "需处理",
      name: values.name,
      status: values.enabled ? "正常" : "已暂停",
      plan: plan?.name || "未绑定",
      expiresAt: values.expiresAt || "不限",
      trafficUsed: `0 B / ${formatBytes(raw.trafficLimitBytes)}`,
      protocols: protocolListLabel(splitList(values.protocols), "继承套餐"),
      subscription: values.enabled ? "启用" : "禁用",
      lastSeen: "未使用",
      configVersion: version,
      uuid: item?.uuid || "创建后生成",
      hy2Password: item?.hy2Password || "创建后生成",
      nodes: `${resourceData["access-nodes"].length} 个访问节点`,
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  if (sectionId === "plans") {
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: `${formatBytes(raw.trafficLimitBytes)} · ${values.durationDays || "不限"} 天`,
      group: values.enabled ? "启用套餐" : "停用套餐",
      name: values.name,
      status: values.enabled ? "启用" : "停用",
      trafficQuota: formatBytes(raw.trafficLimitBytes),
      duration: values.durationDays ? `${values.durationDays} 天` : "不限",
      protocols: protocolListLabel(splitList(values.allowedProtocols), "继承默认"),
      accessNodes: `${resourceData["access-nodes"].length} 个`,
      userCount: item?.userCount || "0",
      udp: values.allowUdp ? "是" : "否",
      hy2Speed: item?.hy2Speed || "100 / 100 Mbps",
      configVersion: version,
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  if (sectionId === "proxy-nodes") {
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: `${values.region || "未设置区域"} · ${joinList(splitList(values.capabilities), "待配置")}`,
      group: values.region || "未分组",
      name: values.name,
      status: values.enabled ? "未注册" : "离线",
      host: values.publicHost || values.entryDomain || values.publicIp || "-",
      region: values.region || "-",
      agentVersion: item?.agentVersion || "-",
      inbounds: item?.inbounds || "0",
      accessNodes: item?.accessNodes || "0",
      configVersion: version,
      heartbeat: "未上报",
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  if (sectionId === "inbounds") {
    const proxy = resourceData["proxy-nodes"].find((row) => resourceRecordId(row) === values.proxyNodeId);
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: values.protocol === "hysteria2" ? `HY2 · ${values.sni || "auto sni"}` : `REALITY · ${values.dest || "auto dest"}`,
      group: protocolLongLabel(values.protocol),
      name: values.name,
      status: "运行中",
      protocol: protocolLongLabel(values.protocol),
      proxyNode: proxy?.name || values.proxyNodeId,
      listen: values.listen || "0.0.0.0",
      port: String(values.port || 443),
      directAccess: values.createDirectAccessNode ? "1" : "0",
      relayAccess: item?.relayAccess || "0",
      users: String(resourceData.users.length),
      flow: values.protocol === "hysteria2" ? "udp native" : "xtls-rprx-vision",
      configVersion: version,
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  if (sectionId === "transit-relays") {
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: `${values.region || "未设置区域"}入口 · Realm`,
      group: values.region || "未分组",
      name: values.name,
      status: values.enabled ? "未注册" : "离线",
      host: values.publicHost || values.publicIp || "-",
      region: values.region || "-",
      agentVersion: item?.agentVersion || "-",
      rules: item?.rules || "0",
      accessNodes: item?.accessNodes || "0",
      tcp: "支持",
      udp: "按规则",
      configVersion: version,
      heartbeat: "未上报",
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  if (sectionId === "access-nodes") {
    const inbound = resourceData.inbounds.find((row) => resourceRecordId(row) === values.inboundId);
    return {
      ...(item || {}),
      id: values.name || rowId,
      resourceId: rawId,
      raw,
      summary: `${inbound?.protocol || "Inbound"} · ${values.host || inbound?.displayHost || "auto"}:${values.port || inbound?.port || 443}`,
      group: "Direct 节点",
      type: "Direct",
      protocol: inbound?.raw?.transport?.toUpperCase() || "TCP",
      displayHost: values.host || inbound?.displayHost || "-",
      port: String(values.port || inbound?.port || "-"),
      proxyNode: inbound?.proxyNode || "-",
      transitRelay: "-",
      visible: values.enabled,
      status: values.enabled ? "运行中" : "停用",
      configVersion: version,
      inbound: inbound?.name || values.inboundId,
      relayRule: "-",
      plans: ["按套餐权限"],
      createdAt: isoText(raw.createdAt),
      appliedAt: isoText(raw.updatedAt),
    };
  }

  const relay = resourceData["transit-relays"].find((row) => resourceRecordId(row) === values.relayId);
  const inbound = resourceData.inbounds.find((row) => resourceRecordId(row) === values.inboundId);
  return {
    ...(item || {}),
    id: values.name || rowId,
    resourceId: rawId,
    raw,
    summary: `${relay?.name || values.relayId}:${values.entryPort} -> ${inbound?.proxyNode || "proxy"}:${values.targetPort || inbound?.port || 443}`,
    group: (values.transport || "tcp").toUpperCase(),
    name: values.name,
    status: values.enabled ? "运行中" : "停用",
    transitRelay: relay?.name || values.relayId,
    entryPort: String(values.entryPort || 8443),
    targetHost: values.targetHost || inbound?.proxyNode || "-",
    targetPort: String(values.targetPort || inbound?.port || 443),
    transport: (values.transport || "tcp").toUpperCase(),
    accessNode: item?.accessNode || "-",
    configVersion: version,
    createdAt: isoText(raw.createdAt),
    appliedAt: isoText(raw.updatedAt),
  };
}

function makeLocalRelayBundle(values, resourceData) {
  const now = new Date().toISOString();
  const inbound = resourceData.inbounds.find((row) => resourceRecordId(row) === values.inboundId);
  const relay = resourceData["transit-relays"].find((row) => resourceRecordId(row) === values.transitRelayId);
  const accessId = `local_access_${Date.now()}`;
  const ruleId = `local_relay_rule_${Date.now()}`;
  const accessNode = {
    id: values.name || accessId,
    resourceId: accessId,
    raw: {
      id: accessId,
      name: values.name,
      type: "relay",
      enabled: true,
      inboundId: values.inboundId,
      proxyNodeId: inbound?.raw?.proxyNodeId || "",
      transitRelayId: values.transitRelayId,
      relayRuleId: ruleId,
      host: relay?.host || "",
      port: values.entryPort,
      transport: values.transport,
      createdAt: now,
      updatedAt: now,
    },
    summary: `${inbound?.protocol || "Inbound"} · ${relay?.name || "relay"}:${values.entryPort}`,
    group: "Relay 节点",
    type: "Relay",
    protocol: String(values.transport || "tcp").toUpperCase(),
    displayHost: relay?.host || "-",
    port: String(values.entryPort),
    proxyNode: inbound?.proxyNode || "-",
    transitRelay: relay?.name || values.transitRelayId,
    visible: true,
    status: "待发布",
    configVersion: "v-local",
    inbound: inbound?.name || values.inboundId,
    relayRule: ruleId,
    plans: ["按套餐权限"],
    createdAt: isoText(now),
    appliedAt: "等待发布",
  };
  const relayRule = {
    id: `${relay?.name || "relay"}-${values.transport}-${values.entryPort}`,
    resourceId: ruleId,
    raw: {
      id: ruleId,
      name: `${relay?.name || "relay"} ${values.entryPort}`,
      relayId: values.transitRelayId,
      inboundId: values.inboundId,
      accessNodeId: accessId,
      entry: { port: values.entryPort },
      target: { port: inbound?.port || 443 },
      transport: values.transport,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    summary: `${relay?.name || "relay"}:${values.entryPort} -> ${inbound?.proxyNode || "proxy"}:${inbound?.port || 443}`,
    group: String(values.transport || "tcp").toUpperCase(),
    name: `${relay?.name || "relay"} ${values.entryPort}`,
    status: "待发布",
    transitRelay: relay?.name || values.transitRelayId,
    entryPort: String(values.entryPort),
    targetHost: inbound?.proxyNode || "-",
    targetPort: String(inbound?.port || 443),
    transport: String(values.transport || "tcp").toUpperCase(),
    accessNode: accessNode.id,
    configVersion: "v-local",
    createdAt: isoText(now),
    appliedAt: "等待发布",
  };
  return { accessNode, relayRule };
}

function cleanLabel(label) {
  return label.replace(" (Plans)", "").replace(" (Inbounds)", "");
}

function getStatusTone(status = "") {
  if (["离线", "故障", "失败", "critical"].includes(status)) return "danger";
  if (["待发布", "降级", "已暂停", "部分失败", "待处理", "离线容灾", "warning", "已确认"].includes(status)) return "warning";
  return "success";
}

function getValue(row, descriptor) {
  if (typeof descriptor === "function") return descriptor(row);
  return row[descriptor] ?? descriptor ?? "-";
}

function IconButton({ label, children, variant = "ghost", onClick }) {
  return (
    <button className={`icon-button icon-button--${variant}`} type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function StatusDot({ tone = "success" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function StatePill({ children, tone }) {
  const resolvedTone = tone || getStatusTone(typeof children === "string" ? children : "");
  return (
    <span className="state-pill">
      <StatusDot tone={resolvedTone} />
      {children}
    </span>
  );
}

function VisibleCheck() {
  return (
    <span className="visible-check">
      <IconCircleCheck size={17} stroke={1.9} />
    </span>
  );
}

function EmptyPanel({ title, description, compact = false }) {
  return (
    <div className={compact ? "empty-panel empty-panel--compact" : "empty-panel"}>
      <IconFileCode size={24} stroke={1.8} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function LinkText({ children }) {
  return (
    <a className="resource-link" href="#resource">
      {children}
      <IconExternalLink size={14} stroke={1.9} />
    </a>
  );
}

function Sidebar({ activeSection, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <IconButton label="菜单">
          <IconMenu2 size={22} stroke={1.8} />
        </IconButton>
      </div>
      <nav className="sidebar__nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${item.id === activeSection ? "nav-item--active" : ""}`}
              type="button"
              aria-label={cleanLabel(item.label)}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={20} stroke={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button className="sidebar__collapse" type="button">
        <IconLayoutSidebarLeftCollapse size={20} stroke={1.75} />
        <span>收起</span>
      </button>
    </aside>
  );
}

function MobileNav({ activeSection, onSelect }) {
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={`mobile-nav__item ${item.id === activeSection ? "mobile-nav__item--active" : ""}`}
            type="button"
            aria-label={cleanLabel(item.label)}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <Icon size={17} stroke={1.8} />
            <span>{cleanLabel(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ onPublish, apiStatus, adminUser, onLogout }) {
  const tone = apiStatus?.mode === "connected" ? "success" : apiStatus?.mode === "error" ? "danger" : "warning";
  const label = apiStatus?.message || "等待连接";
  const configVersion = apiStatus?.summary?.version ? `Config v${apiStatus.summary.version}` : "Config v1";

  return (
    <header className="topbar">
      <div className="topbar__status">
        <span className="topbar__item"><StatusDot tone={tone} />{label}</span>
        <span className="topbar__divider" />
        <span className="topbar__item"><IconFileCode size={17} stroke={1.8} />{configVersion}</span>
        <span className="topbar__divider" />
        <span className="topbar__item"><StatusDot tone="success" />0 个待处理变更</span>
      </div>
      <div className="topbar__actions">
        <button className="button button--secondary" type="button">0 待发布</button>
        <button className="button button--primary" type="button" onClick={onPublish}>发布配置</button>
        <button className="admin-menu" type="button" onClick={onLogout}>
          <IconUser size={18} stroke={1.8} />
          {adminUser?.username || "Admin"}
          <IconChevronDown size={16} stroke={1.8} />
        </button>
      </div>
    </header>
  );
}

function ResourceToolbar({ query, setQuery, searchPlaceholder, segments, segment, setSegment, filters, advancedLabel = "高级筛选" }) {
  return (
    <section className="toolbar" aria-label="资源筛选">
      <label className="search-field">
        <IconSearch size={18} stroke={1.8} />
        <input value={query} placeholder={searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="segmented" role="tablist" aria-label="分组">
        {segments.map((item) => (
          <button
            className={segment === item.value ? "segmented__button segmented__button--active" : "segmented__button"}
            type="button"
            key={item.value}
            onClick={() => setSegment(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {filters.map((filter) => (
        <label className="select-field" key={filter.label}>
          {filter.label}：
          <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
            {filter.options.map((option) => <option key={option} value={option}>{option === "true" ? "可见" : option}</option>)}
          </select>
          <IconChevronDown size={15} stroke={1.9} />
        </label>
      ))}
      <IconButton label={advancedLabel} variant="outline">
        <IconAdjustmentsHorizontal size={19} stroke={1.8} />
      </IconButton>
    </section>
  );
}

function ResourceTable({ ariaLabel, rows, columns: tableColumns, selectedId, onSelect }) {
  const groupedRows = useMemo(() => {
    return rows.reduce((groups, row) => {
      if (!groups[row.group]) groups[row.group] = [];
      groups[row.group].push(row);
      return groups;
    }, {});
  }, [rows]);

  return (
    <section className="table-card" aria-label={ariaLabel}>
      <table className="resource-table">
        <colgroup>
          <col className="resource-table__select-col" />
          {tableColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}
          <col className="resource-table__action-col" />
        </colgroup>
        <thead>
          <tr>
            <th className="checkbox-cell"><input type="checkbox" aria-label="选择全部" /></th>
            {tableColumns.map((column) => (
              <th className={column.align === "center" ? "center-cell" : ""} key={column.key}>
                {column.primary ? <span className="sortable">{column.label} <IconSelector size={13} stroke={1.8} /></span> : column.label}
              </th>
            ))}
            <th className="actions-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedRows).map(([group, groupRows]) => (
            <Fragment key={group}>
              <tr className="group-row">
                <td />
                <td colSpan={tableColumns.length + 1}>{group} <span>({groupRows.length})</span></td>
              </tr>
              {groupRows.map((row) => (
                <tr className={row.id === selectedId ? "data-row data-row--selected" : "data-row"} key={row.id} onClick={() => onSelect(row.id)}>
                  <td className="checkbox-cell">
                    <input checked={row.id === selectedId} type="checkbox" aria-label={`选择 ${row.id}`} readOnly />
                  </td>
                  {tableColumns.map((column) => (
                    <td className={column.align === "center" ? "center-cell" : ""} data-label={column.label} key={column.key}>
                      {column.primary ? (
                        <button className="name-button" type="button">
                          <span>{row[column.key]}</span>
                          <small>{row[column.subKey]}</small>
                        </button>
                      ) : column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                  <td className="actions-cell">
                    <IconButton label="更多操作">
                      <IconDotsVertical size={18} stroke={1.9} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function InspectorShell({ title, status, onClose, children }) {
  return (
    <aside className="inspector">
      <div className="inspector__header">
        <div className="inspector__title-row">
          <h2>{title}</h2>
          <span className="state-pill state-pill--compact"><StatusDot tone={getStatusTone(status)} />{status}</span>
        </div>
        <IconButton label="关闭详情" onClick={onClose}>
          <IconX size={21} stroke={1.8} />
        </IconButton>
      </div>
      {children}
    </aside>
  );
}

function KeyValueSection({ title, rows, compact = false }) {
  return (
    <div className="inspector__section">
      <h3>{title}</h3>
      <dl className={compact ? "meta-list meta-list--compact" : "meta-list"}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.success ? "success-text" : ""}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GenericInspector({ item, config, onClose, onEdit, onDelete, canWrite }) {
  if (!item) return null;

  const detailRows = (config.detailRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const relationRows = (config.relationRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const metricRows = (config.metricRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const title = item.name || item.version || item.id;
  const status = item.status || "正常";

  return (
    <InspectorShell title={title} status={status} onClose={onClose}>
      <KeyValueSection title="基本信息" rows={detailRows} />

      <div className="inspector__section">
        <h3>关联资源</h3>
        <dl className="link-list">
          {relationRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{String(row.value).startsWith("-") ? row.value : <LinkText>{row.value}</LinkText>}</dd>
            </div>
          ))}
        </dl>
      </div>

      <KeyValueSection compact title="运行摘要" rows={metricRows} />
      <QuickActions canWrite={canWrite} onEdit={onEdit} onDelete={onDelete} />
      <ConfigPreview title="配置预览" note="节选" content={config.preview ? config.preview(item) : JSON.stringify(item, null, 2)} />
    </InspectorShell>
  );
}

function QuickActions({ canWrite, onEdit, onDelete }) {
  return (
    <div className="inspector__section">
      <h3>快捷操作</h3>
      <div className="quick-actions">
        <button className="button button--secondary" type="button" disabled={!canWrite} onClick={onEdit}><IconShieldLock size={16} stroke={1.9} />编辑</button>
        <button className="button button--secondary" type="button"><IconCopy size={16} stroke={1.9} />复制</button>
        <button className="button button--secondary" type="button"><IconLock size={16} stroke={1.9} />禁用</button>
        <button className="button button--danger" type="button" disabled={!canWrite} onClick={onDelete}><IconTrash size={16} stroke={1.9} />删除</button>
      </div>
    </div>
  );
}

function ConfigPreview({ title, note, content }) {
  return (
    <div className="inspector__section inspector__section--last">
      <h3>{title} <span>{note}</span></h3>
      <pre className="code-preview"><button aria-label="复制配置" type="button"><IconCopy size={16} stroke={1.9} /></button>{content}</pre>
    </div>
  );
}

function Pagination({ total }) {
  return (
    <footer className="pagination">
      <span>共 {total} 条</span>
      <select aria-label="每页条数" defaultValue="10">
        <option>10 条/页</option>
        <option>20 条/页</option>
      </select>
      <div className="pagination__controls">
        <IconButton label="首页" variant="outline"><IconChevronsLeft size={16} stroke={1.8} /></IconButton>
        <IconButton label="上一页" variant="outline"><IconChevronLeft size={16} stroke={1.8} /></IconButton>
        <button className="page-button page-button--active" type="button">1</button>
        <IconButton label="下一页" variant="outline"><IconChevronRight size={16} stroke={1.8} /></IconButton>
        <IconButton label="末页" variant="outline"><IconChevronsRight size={16} stroke={1.8} /></IconButton>
      </div>
      <label className="page-jump">前往 <input defaultValue="1" /> 页</label>
    </footer>
  );
}

function ResourcePage({ config, state, rows, totalRows, selectedItem, canWrite, onSelect, onPrimary, onSecondary, onRefresh, onCloseInspector, onEditSelected, onDeleteSelected }) {
  const PrimaryIcon = config.primaryIcon || IconPlus;
  const SecondaryIcon = config.secondaryIcon || IconPlus;
  const hasRows = rows.length > 0;
  const isEmptyCollection = totalRows === 0;

  return (
    <div className="content-grid">
      <section className="main-pane">
        <div className="page-header">
          <div>
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
          <div className="page-header__actions">
            <button className="button button--secondary button--blue" type="button" onClick={onSecondary}>
              <SecondaryIcon size={17} stroke={1.9} />
              {config.secondaryAction}
            </button>
            <button className="button button--primary" type="button" onClick={onPrimary}>
              <PrimaryIcon size={17} stroke={1.9} />
              {config.primaryAction}
            </button>
            <IconButton label="刷新" variant="outline" onClick={onRefresh}>
              <IconRefresh size={19} stroke={1.8} />
            </IconButton>
          </div>
        </div>
        <ResourceToolbar
          query={state.query}
          setQuery={state.setQuery}
          searchPlaceholder={config.searchPlaceholder}
          segments={config.segments}
          segment={state.segment}
          setSegment={state.setSegment}
          filters={state.filters}
        />
        {hasRows ? (
          <>
            <ResourceTable ariaLabel={config.tableLabel} rows={rows} columns={config.columns} selectedId={selectedItem?.id} onSelect={onSelect} />
            <Pagination total={rows.length} />
          </>
        ) : (
          <EmptyPanel
            title={isEmptyCollection ? `暂无${config.title}` : "没有匹配结果"}
            description={isEmptyCollection ? "当前还没有任何记录，点击右上角按钮创建第一条。" : "请调整搜索关键词或筛选条件后重试。"}
          />
        )}
      </section>
      {selectedItem ? (
        <GenericInspector
          item={selectedItem}
          config={config}
          canWrite={canWrite}
          onEdit={() => onEditSelected(selectedItem)}
          onDelete={() => onDeleteSelected(selectedItem)}
          onClose={onCloseInspector}
        />
      ) : (
        <aside className="inspector inspector--empty">
          <EmptyPanel compact title="暂无详情" description="选择一条记录后，这里会显示资源详情。" />
        </aside>
      )}
    </div>
  );
}

function ResourceRoute({ sectionId, config, rows: dataRows, showToast, setDrawerOpen, onCreate, onEdit, onDelete, onReload }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("All");
  const [filterValues, setFilterValues] = useState(() => {
    return (config.filters || []).reduce((values, filter) => ({ ...values, [filter.key]: "全部" }), {});
  });
  const rows = dataRows || [];
  const runtimeConfig = useMemo(() => resolveRuntimeResourceConfig(config, rows), [config, rows]);
  const canWrite = writableSections.has(sectionId);
  const [selectedId, setSelectedId] = useState(rows[0]?.id || "");

  useEffect(() => {
    if (!rows.find((row) => row.id === selectedId)) {
      setSelectedId(rows[0]?.id || "");
    }
  }, [rows, selectedId]);

  useEffect(() => {
    if (!runtimeConfig.segments.some((item) => item.value === segment)) {
      setSegment("All");
    }
  }, [runtimeConfig.segments, segment]);

  const toolbarFilters = (runtimeConfig.filters || []).map((filter) => ({
    ...filter,
    value: filterValues[filter.key] || "全部",
    onChange: (value) => setFilterValues((current) => ({ ...current, [filter.key]: value })),
  }));

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const searchText = (runtimeConfig.searchKeys || ["id", "name", "summary"])
        .map((key) => String(row[key] ?? ""))
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || searchText.includes(query.toLowerCase());
      const matchesSegment = segment === "All" || (runtimeConfig.segmentKey ? String(row[runtimeConfig.segmentKey]) === segment : true);
      const matchesFilters = (runtimeConfig.filters || []).every((filter) => {
        const value = filterValues[filter.key] || "全部";
        if (value === "全部") return true;
        return String(row[filter.key]) === value;
      });
      return matchesSearch && matchesSegment && matchesFilters;
    });
  }, [runtimeConfig, rows, query, segment, filterValues]);

  const selectedItem = filteredRows.find((item) => item.id === selectedId) || filteredRows[0];

  return (
    <ResourcePage
      config={runtimeConfig}
      state={{ query, setQuery, segment, setSegment, filters: toolbarFilters }}
      rows={filteredRows}
      totalRows={rows.length}
      selectedItem={selectedItem}
      canWrite={canWrite}
      onSelect={setSelectedId}
      onPrimary={() => {
        if (config.primaryKind === "relay") {
          setDrawerOpen(true);
          return;
        }
        if (canWrite) {
          onCreate(sectionId);
          return;
        }
        showToast(`${config.primaryAction}入口已准备`);
      }}
      onSecondary={() => {
        if (sectionId === "access-nodes" && canWrite) {
          onCreate(sectionId);
          return;
        }
        showToast(`${config.secondaryAction}入口已准备`);
      }}
      onRefresh={onReload}
      onCloseInspector={() => showToast("详情面板在桌面版保持固定")}
      onEditSelected={(item) => item && onEdit(sectionId, item)}
      onDeleteSelected={(item) => item && onDelete(sectionId, item)}
    />
  );
}

function OverviewPage({ showToast, setActiveSection, resourceData, apiStatus }) {
  const summaryCards = buildSummaryCards(resourceData);
  const tasks = buildOverviewTasks(resourceData);
  const events = buildOverviewEvents(resourceData);
  const healthTiles = buildOverviewHealthTiles(resourceData);
  const configVersion = apiStatus?.summary?.version ? `v${apiStatus.summary.version}` : "v1";
  const updatedAt = apiStatus?.summary?.configUpdatedAt ? isoText(apiStatus.summary.configUpdatedAt) : "-";
  return (
    <div className="overview-shell">
      <section className="main-pane main-pane--wide">
        <div className="page-header">
          <div>
            <h1>总览</h1>
            <p>查看控制面、节点、中转、订阅入口、告警和配置发布状态</p>
          </div>
          <div className="page-header__actions">
            <button className="button button--secondary button--blue" type="button" onClick={() => setActiveSection("agents")}><IconCloudComputing size={17} stroke={1.9} />查看 Agent</button>
            <button className="button button--primary" type="button" onClick={() => showToast("配置发布任务已创建")}><IconFileCode size={17} stroke={1.9} />发布配置</button>
          </div>
        </div>

        <div className="status-strip">
          <div><StatusDot tone={apiStatus?.mode === "connected" ? "success" : "warning"} /><span>Backend Core</span><strong>{apiStatus?.mode === "connected" ? "Online" : "Connecting"}</strong></div>
          <div><StatusDot /><span>配置版本</span><strong>{configVersion}</strong></div>
          <div><StatusDot /><span>最近更新</span><strong>{updatedAt}</strong></div>
          <div><StatusDot tone="warning" /><span>待处理</span><strong>0 项变更</strong></div>
        </div>

        <div className="metric-grid">
          {summaryCards.map((card) => (
            <button className="metric-card" key={card.label} type="button">
              <span><StatusDot tone={card.tone} />{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </button>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel__header">
              <h2>待处理事项</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("alerts")}>查看告警 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="task-list">
              {tasks.length ? tasks.map((task) => (
                <button type="button" key={task.title}>
                  <StatusDot tone={task.tone} />
                  <strong>{task.title}</strong>
                  <span>{task.meta}</span>
                </button>
              )) : (
                <EmptyPanel compact title="暂无待处理事项" description="创建资源或 Agent 上报异常后，这里会显示待处理内容。" />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>最近配置应用</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("config")}>发布记录 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="event-list">
              {events.length ? events.map((event) => (
                <div key={`${event.version}-${event.meta}`}>
                  <span>{event.version}</span>
                  <strong>{event.title}</strong>
                  <small>{event.meta}</small>
                </div>
              )) : (
                <EmptyPanel compact title="暂无配置应用记录" description="发布配置后，这里会显示最近应用结果。" />
              )}
            </div>
          </section>
        </div>

        <section className="panel panel--full">
          <div className="panel__header">
            <h2>资源健康</h2>
            <button className="subtle-link" type="button" onClick={() => setActiveSection("health")}>健康检查 <IconExternalLink size={14} stroke={1.9} /></button>
          </div>
          <div className="resource-health-grid">
            {healthTiles.length ? healthTiles.map((tile) => (
              <button className="health-tile" type="button" key={tile.name}>
                <StatusDot tone={tile.tone} />
                <strong>{tile.name}</strong>
                <span>{tile.status} · {tile.meta}</span>
              </button>
            )) : (
              <EmptyPanel compact title="暂无健康数据" description="Agent 接入并完成心跳后，这里会显示资源健康状态。" />
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function SettingsPage({ showToast, apiStatus, onSaveApiSettings }) {
  const [apiSettings, setApiSettings] = useState(() => getAdminApiSettings());

  function updateApiSetting(key, value) {
    setApiSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="settings-shell">
      <section className="main-pane main-pane--wide">
        <div className="page-header">
          <div>
            <h1>系统设置</h1>
            <p>管理 Backend Core 基础信息、发布策略和 Agent 兼容版本</p>
          </div>
          <div className="page-header__actions">
            <button className="button button--secondary button--blue" type="button" onClick={() => showToast("设置变更已重置")}><IconRefresh size={17} stroke={1.9} />重置</button>
            <button className="button button--primary" type="button" onClick={() => showToast("系统设置已保存，等待发布")}><IconCircleCheck size={17} stroke={1.9} />保存设置</button>
          </div>
        </div>

        <div className="settings-grid">
          <section className="setting-panel setting-panel--wide">
            <h2>Backend API</h2>
            <label><span>API Base URL</span><input placeholder="留空表示当前前端服务器 /api 反向代理" value={apiSettings.baseUrl} onChange={(event) => updateApiSetting("baseUrl", event.target.value)} /></label>
            <div className="api-status-card">
              <StatusDot tone={apiStatus?.mode === "connected" ? "success" : apiStatus?.mode === "error" ? "danger" : "warning"} />
              <span>{apiStatus?.message || "未连接 Backend Core"}</span>
            </div>
            <button className="button button--primary" type="button" onClick={() => onSaveApiSettings(apiSettings)}><IconCircleCheck size={16} stroke={1.9} />保存并连接</button>
          </section>

          <section className="setting-panel">
            <h2>Backend Core</h2>
            <label><span>系统名称</span><input defaultValue="Kato Control Plane" /></label>
            <label><span>环境</span><select defaultValue="production"><option value="production">production</option><option value="staging">staging</option></select></label>
            <label><span>时区</span><select defaultValue="Asia/Shanghai"><option>Asia/Shanghai</option><option>UTC</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>管理员</h2>
            <label><span>管理员账号</span><input defaultValue="admin" /></label>
            <label><span>Session 有效期</span><select defaultValue="12h"><option>12h</option><option>24h</option><option>7d</option></select></label>
            <button className="button button--secondary" type="button" onClick={() => showToast("管理 Token 轮换流程已准备")}><IconShieldLock size={16} stroke={1.9} />轮换管理 Token</button>
          </section>

          <section className="setting-panel">
            <h2>配置发布</h2>
            <label><span>发布策略</span><select defaultValue="manual"><option value="manual">手动发布</option><option value="auto">保存后自动发布</option></select></label>
            <label><span>离线 Agent 策略</span><select defaultValue="keep-last-good"><option value="keep-last-good">保留 last known good</option><option value="block">阻止发布</option></select></label>
            <label><span>配置回滚保留</span><select defaultValue="30"><option>30 versions</option><option>60 versions</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>Agent 兼容</h2>
            <label><span>最低版本</span><input defaultValue="0.3.7" /></label>
            <label><span>心跳超时</span><select defaultValue="180s"><option>180s</option><option>300s</option></select></label>
            <label><span>运行时校验</span><select defaultValue="strict"><option value="strict">strict</option><option value="warn">warn only</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>告警与报告</h2>
            <label><span>Email 告警</span><select defaultValue="disabled"><option value="disabled">暂不启用</option><option value="enabled">启用</option></select></label>
            <label><span>每日自检</span><select defaultValue="09:00"><option>09:00</option><option>18:00</option></select></label>
            <label><span>严重告警</span><select defaultValue="instant"><option value="instant">立即通知</option><option value="digest">进入摘要</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>备份</h2>
            <label><span>备份路径</span><input defaultValue="/var/lib/kato/backups" /></label>
            <label><span>自动备份</span><select defaultValue="03:00"><option>03:00</option><option>04:00</option></select></label>
            <label><span>保留周期</span><select defaultValue="30d"><option>30d</option><option>90d</option></select></label>
          </section>
        </div>
      </section>
    </div>
  );
}

function resolveFieldOptions(field, resourceData) {
  const options = typeof field.options === "function" ? field.options(resourceData) : field.options;
  return options || [];
}

function resolveFieldDefault(field, resourceData) {
  if (typeof field.defaultValue === "function") return field.defaultValue(resourceData);
  if (field.type === "checkbox") return Boolean(field.defaultValue);
  return field.defaultValue ?? "";
}

function createInitialFormValues(formConfig, resourceData, item) {
  const fromItem = item && formConfig.fromItem ? formConfig.fromItem(item) : {};
  return formConfig.fields.reduce((values, field) => ({
    ...values,
    [field.name]: fromItem[field.name] ?? resolveFieldDefault(field, resourceData),
  }), {});
}

const requiredFormFields = {
  users: ["name"],
  plans: ["name"],
  "proxy-nodes": ["name"],
  inbounds: ["name", "proxyNodeId", "protocol", "port"],
  "transit-relays": ["name"],
  "access-nodes": ["name", "inboundId"],
  "relay-rules": ["name", "relayId", "inboundId", "entryPort", "transport"],
};

const supportedFormProtocols = new Set(["vless-reality", "hysteria2"]);
const supportedFormTransports = new Set(["tcp", "udp"]);

function validateResourceForm(sectionId, values, resourceData, item) {
  const formConfig = resourceFormConfigs[sectionId];
  const fieldsByName = new Map((formConfig?.fields || []).map((field) => [field.name, field]));
  const requiredFields = requiredFormFields[sectionId] || ["name"];

  for (const fieldName of requiredFields) {
    if (isBlank(values[fieldName])) {
      return `${fieldsByName.get(fieldName)?.label || fieldName}不能为空`;
    }
  }

  const duplicate = (resourceData[sectionId] || []).find((row) => {
    const sameName = String(row.name || row.id || "").toLowerCase() === String(values.name || "").trim().toLowerCase();
    return sameName && resourceRecordId(row) !== resourceRecordId(item);
  });
  if (values.name && duplicate) {
    return `${formConfig.label}名称已存在`;
  }

  if (["port", "entryPort", "targetPort"].some((fieldName) => values[fieldName] !== undefined)) {
    const portError = validatePortFields(values, fieldsByName);
    if (portError) return portError;
  }

  if (values.durationDays && toNumber(values.durationDays, -1) <= 0) {
    return "有效期天数必须大于 0";
  }
  if (values.trafficLimitGiB && toNumber(values.trafficLimitGiB, -1) < 0) {
    return "流量额度不能小于 0";
  }
  if (values.speedLimitMbps && toNumber(values.speedLimitMbps, -1) < 0) {
    return "限速不能小于 0";
  }
  if (values.expiresAt && Number.isNaN(Date.parse(values.expiresAt))) {
    return "到期时间格式不正确";
  }

  const protocolValue = values.protocol ? [values.protocol] : splitList(values.allowedProtocols || values.protocols);
  const invalidProtocol = protocolValue.find((protocol) => protocol && !supportedFormProtocols.has(protocol));
  if (invalidProtocol) {
    return `不支持的协议：${invalidProtocol}`;
  }

  if (values.transport && !supportedFormTransports.has(values.transport)) {
    return `不支持的传输方式：${values.transport}`;
  }

  if (sectionId === "proxy-nodes" && isBlank(values.publicHost) && isBlank(values.publicIp) && isBlank(values.entryDomain)) {
    return "公网主机、公网 IP 或入口域名至少填写一个";
  }
  if (sectionId === "transit-relays" && isBlank(values.publicHost) && isBlank(values.publicIp)) {
    return "中转服务器需要公网主机或公网 IP";
  }
  if (sectionId === "inbounds" && !(resourceData["proxy-nodes"] || []).length) {
    return "请先创建代理节点";
  }
  if (sectionId === "access-nodes" && !(resourceData.inbounds || []).length) {
    return "请先创建协议入站";
  }
  if (sectionId === "relay-rules") {
    if (!(resourceData["transit-relays"] || []).length) return "请先创建中转服务器";
    if (!(resourceData.inbounds || []).length) return "请先创建协议入站";
  }

  return "";
}

function validateRelayForm(values, resourceData) {
  if (isBlank(values.inboundId)) return "目标协议入站不能为空";
  if (isBlank(values.transitRelayId)) return "中转服务器不能为空";
  const portError = validateSinglePort(values.entryPort, "入口端口", { required: true });
  if (portError) return portError;
  if (!supportedFormTransports.has(values.transport)) return `不支持的传输方式：${values.transport}`;
  if (!(resourceData.inbounds || []).some((row) => resourceRecordId(row) === values.inboundId)) return "目标协议入站不存在";
  if (!(resourceData["transit-relays"] || []).some((row) => resourceRecordId(row) === values.transitRelayId)) return "中转服务器不存在";
  return "";
}

function validatePortFields(values, fieldsByName) {
  for (const fieldName of ["port", "entryPort", "targetPort"]) {
    if (values[fieldName] === undefined) continue;
    const required = fieldName !== "targetPort";
    const error = validateSinglePort(values[fieldName], fieldsByName.get(fieldName)?.label || fieldName, { required });
    if (error) return error;
  }
  return "";
}

function validateSinglePort(value, label, { required = false } = {}) {
  if (isBlank(value)) {
    return required ? `${label}不能为空` : "";
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `${label}必须是 1-65535 的整数`;
  }
  return "";
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function ResourceEditorDrawer({ open, sectionId, item, resourceData, onClose, onSubmit }) {
  const formConfig = sectionId ? resourceFormConfigs[sectionId] : null;
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && formConfig) {
      setValues(createInitialFormValues(formConfig, resourceData, item));
      setError("");
      setSubmitting(false);
    }
  }, [open, formConfig, resourceData, item]);

  if (!open || !formConfig) return null;

  function updateValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateResourceForm(sectionId, values, resourceData, item);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(sectionId, values, item);
    } catch (submitError) {
      setError(submitError.message || "提交失败");
      setSubmitting(false);
    }
  }

  const title = item ? `编辑${formConfig.label}` : `新建${formConfig.label}`;
  const modeText = hasAdminApiToken() ? "将提交到 Backend Core" : demoModeEnabled ? "演示模式，将保存在本地演示数据" : "请先登录 Backend Core";

  return (
    <div className="drawer-scrim" role="presentation" onMouseDown={onClose}>
      <aside className="relay-drawer" role="dialog" aria-modal="true" aria-labelledby="resource-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relay-drawer__header">
          <div>
            <p className="eyebrow">{item ? "编辑资源" : "创建资源"}</p>
            <h2 id="resource-editor-title">{title}</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}><IconX size={21} stroke={1.8} /></IconButton>
        </div>
        <form className="drawer-form" onSubmit={handleSubmit}>
          <p className="drawer-note">{modeText}</p>
          {formConfig.fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select value={values[field.name] ?? ""} onChange={(event) => updateValue(field.name, event.target.value)}>
                  {resolveFieldOptions(field, resourceData).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <span className="checkbox-line">
                  <input checked={Boolean(values[field.name])} type="checkbox" onChange={(event) => updateValue(field.name, event.target.checked)} />
                  <small>{Boolean(values[field.name]) ? "已启用" : "已关闭"}</small>
                </span>
              ) : field.type === "textarea" ? (
                <textarea value={values[field.name] ?? ""} onChange={(event) => updateValue(field.name, event.target.value)} />
              ) : (
                <input
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.name] ?? ""}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                />
              )}
              {field.hint ? <small className="field-hint">{field.hint}</small> : null}
            </label>
          ))}
          {error ? <div className="drawer-error">{error}</div> : null}
          <div className="relay-drawer__footer relay-drawer__footer--inside">
            <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
            <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? "提交中" : "保存"}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function CreateRelayDrawer({ open, onClose, resourceData, onSubmit }) {
  const [values, setValues] = useState({
    inboundId: "",
    transitRelayId: "",
    entryPort: 8443,
    transport: "tcp",
    name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues({
      inboundId: selectDefault(resourceData.inbounds),
      transitRelayId: selectDefault(resourceData["transit-relays"]),
      entryPort: 8443,
      transport: "tcp",
      name: "",
    });
    setError("");
    setSubmitting(false);
  }, [open, resourceData]);

  if (!open) return null;

  const inboundOptions = optionRows(resourceData.inbounds);
  const relayOptions = optionRows(resourceData["transit-relays"]);
  const inbound = resourceData.inbounds.find((row) => resourceRecordId(row) === values.inboundId);
  const relay = resourceData["transit-relays"].find((row) => resourceRecordId(row) === values.transitRelayId);

  function updateValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit() {
    const validationError = validateRelayForm(values, resourceData);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        name: values.name,
        inboundId: values.inboundId,
        transitRelayId: values.transitRelayId,
        entryPort: toNumber(values.entryPort, 8443),
        transport: values.transport,
      });
    } catch (submitError) {
      setError(submitError.message || "创建失败");
      setSubmitting(false);
    }
  }

  return (
    <div className="drawer-scrim" role="presentation" onMouseDown={onClose}>
      <aside className="relay-drawer" role="dialog" aria-modal="true" aria-labelledby="relay-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relay-drawer__header">
          <div>
            <p className="eyebrow">快速联动</p>
            <h2 id="relay-drawer-title">创建中转访问节点</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}><IconX size={21} stroke={1.8} /></IconButton>
        </div>
        <div className="stepper">
          {["入站", "中转", "端口", "预览"].map((step, index) => (
            <span className={index === 3 ? "stepper__item stepper__item--active" : "stepper__item"} key={step}>
              <b>{index + 1}</b>{step}
            </span>
          ))}
        </div>
        <div className="drawer-form">
          <label><span>目标协议入站</span><select value={values.inboundId} onChange={(event) => updateValue("inboundId", event.target.value)}>{inboundOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>中转服务器</span><select value={values.transitRelayId} onChange={(event) => updateValue("transitRelayId", event.target.value)}>{relayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className="form-grid">
            <label><span>入口端口</span><input value={values.entryPort} inputMode="numeric" onChange={(event) => updateValue("entryPort", event.target.value)} /></label>
            <label><span>Transport</span><div className="segmented segmented--full">
              {["tcp", "udp"].map((transport) => (
                <button className={values.transport === transport ? "segmented__button segmented__button--active" : "segmented__button"} type="button" key={transport} onClick={() => updateValue("transport", transport)}>{transport.toUpperCase()}</button>
              ))}
            </div></label>
          </div>
          <label><span>订阅展示名称</span><input value={values.name} onChange={(event) => updateValue("name", event.target.value)} /></label>
        </div>
        <div className="drawer-preview">
          <h3>将创建</h3>
          <div><span>Access Node</span><strong>{relay?.name || "relay"}:{values.entryPort} {"->"} {inbound?.proxyNode || "proxy-node"}</strong></div>
          <div><span>Relay Rule</span><strong>{relay?.name || "relay"}:{values.entryPort} {"->"} {inbound?.proxyNode || "proxy-node"}:{inbound?.port || 443} {values.transport}</strong></div>
        </div>
        {error ? <div className="drawer-error drawer-error--spaced">{error}</div> : null}
        <div className="relay-drawer__footer">
          <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
          <button className="button button--primary" type="button" disabled={submitting} onClick={handleSubmit}>{submitting ? "创建中" : "创建并标记待发布"}</button>
        </div>
      </aside>
    </div>
  );
}

function LoginPage({ apiStatus, onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin({ username, password });
    } catch (loginError) {
      setError(loginError.message || "登录失败");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-panel__brand">
          <IconShieldLock size={28} stroke={1.8} />
          <div>
            <p className="eyebrow">Kato Control Plane</p>
            <h1>管理员登录</h1>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>管理员账号</span>
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>管理员密码</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <div className="drawer-error">{error}</div> : null}
          <button className="button button--primary" type="submit" disabled={submitting}>
            <IconLock size={16} stroke={1.9} />{submitting ? "登录中" : "登录"}
          </button>
        </form>
        <div className="api-status-card">
          <StatusDot tone={apiStatus?.mode === "error" ? "danger" : "warning"} />
          <span>{apiStatus?.message || "等待连接 Backend Core"}</span>
        </div>
      </section>
    </main>
  );
}

function AppContent({ activeSection, setActiveSection, showToast, setDrawerOpen, resourceData, apiStatus, onSaveApiSettings, onCreate, onEdit, onDelete, onReload }) {
  if (activeSection === "overview") {
    return <OverviewPage showToast={showToast} setActiveSection={setActiveSection} resourceData={resourceData} apiStatus={apiStatus} />;
  }

  if (activeSection === "settings") {
    return <SettingsPage showToast={showToast} apiStatus={apiStatus} onSaveApiSettings={onSaveApiSettings} />;
  }

  const config = resourceConfigs[activeSection];
  if (!config) {
    return <OverviewPage showToast={showToast} setActiveSection={setActiveSection} resourceData={resourceData} apiStatus={apiStatus} />;
  }

  return (
    <ResourceRoute
      key={activeSection}
      sectionId={activeSection}
      config={config}
      rows={resourceData[activeSection]}
      showToast={showToast}
      setDrawerOpen={setDrawerOpen}
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onReload={onReload}
    />
  );
}

export function App() {
  const [activeSection, setActiveSection] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorState, setEditorState] = useState({ open: false, sectionId: null, item: null });
  const [resourceData, setResourceData] = useState(() => createInitialResourceData());
  const [apiStatus, setApiStatus] = useState(() => ({
    mode: hasAdminApiToken() ? "loading" : demoModeEnabled ? "demo" : "login",
    message: hasAdminApiToken() ? "正在连接 Backend Core" : demoModeEnabled ? "演示模式" : "请登录管理员账号",
  }));
  const [adminUser, setAdminUser] = useState(null);
  const [authReady, setAuthReady] = useState(demoModeEnabled);
  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function loadBackendData({ silent = false } = {}) {
    if (!hasAdminApiToken()) {
      if (demoModeEnabled) {
        setApiStatus({ mode: "demo", message: "演示模式" });
        if (!silent) showToast("当前为本地演示模式");
        return;
      }
      setApiStatus({ mode: "login", message: "请登录管理员账号" });
      setAuthReady(false);
      return;
    }

    setApiStatus({ mode: "loading", message: "正在连接 Backend Core" });
    try {
      const [summary, agentResult, ...collectionResults] = await Promise.all([
        adminGet("/api/v1/admin/summary"),
        adminGet("/api/v1/admin/agents"),
        ...backendCollections.map((collection) => adminGet(`/api/v1/admin/${collection}`)),
      ]);
      const collections = backendCollections.reduce((result, collection, index) => ({
        ...result,
        [collection]: collectionResults[index]?.items || [],
      }), {});
      const adapted = adaptBackendResources({
        collections,
        agents: agentResult.agents || [],
        summary,
      });
      setResourceData((current) => ({ ...current, ...adapted }));
      setApiStatus({
        mode: "connected",
        message: `Backend Connected · v${summary.version} · ${summary.counts?.users || 0} 用户`,
        summary,
      });
      if (!silent) showToast("已连接 Backend Core，数据已刷新");
    } catch (error) {
      setApiStatus({ mode: "error", message: `Backend Error · ${error.message}` });
      if (error.message.includes("session") || error.message.includes("Invalid admin session")) {
        clearAdminSession();
        setAdminUser(null);
        setAuthReady(false);
      }
      if (!silent) showToast(`Backend 连接失败：${error.message}`);
    }
  }

  useEffect(() => {
    async function bootstrapAuth() {
      if (demoModeEnabled && !hasAdminApiToken()) {
        setAuthReady(true);
        await loadBackendData({ silent: true });
        return;
      }
      if (!hasAdminApiToken()) {
        setAuthReady(false);
        setApiStatus({ mode: "login", message: "请登录管理员账号" });
        return;
      }
      try {
        setApiStatus({ mode: "loading", message: "正在校验登录状态" });
        const session = await fetchAdminSession();
        setAdminUser(session.user);
        setAuthReady(true);
        await loadBackendData({ silent: true });
      } catch {
        clearAdminSession();
        setAdminUser(null);
        setAuthReady(false);
        setApiStatus({ mode: "login", message: "登录状态已过期，请重新登录" });
      }
    }
    bootstrapAuth();
  }, []);

  async function handleLogin(credentials) {
    setApiStatus({ mode: "loading", message: "正在登录 Backend Core" });
    const session = await loginAdmin(credentials);
    setAdminUser(session.user);
    setAuthReady(true);
    await loadBackendData({ silent: true });
    showToast("登录成功");
  }

  async function handleLogout() {
    await logoutAdmin();
    setAdminUser(null);
    setAuthReady(false);
    setApiStatus({ mode: "login", message: "已退出登录" });
  }

  function openCreateEditor(sectionId) {
    setEditorState({ open: true, sectionId, item: null });
  }

  function openEditEditor(sectionId, item) {
    setEditorState({ open: true, sectionId, item });
  }

  function closeEditor() {
    setEditorState({ open: false, sectionId: null, item: null });
  }

  async function handleEditorSubmit(sectionId, values, item) {
    const collection = apiCollections[sectionId];
    const formConfig = resourceFormConfigs[sectionId];

    if (hasAdminApiToken() && collection) {
      const body = formConfig.toApiInput(values);
      if (item?.raw?.id) {
        await adminPatch(`/api/v1/admin/${collection}/${item.raw.id}`, body);
        showToast(`${formConfig.label}已更新`);
      } else {
        await adminPost(`/api/v1/admin/${collection}`, body);
        showToast(`${formConfig.label}已创建`);
      }
      closeEditor();
      await loadBackendData({ silent: true });
      return;
    }

    if (!demoModeEnabled) {
      throw new Error("请先登录 Backend Core");
    }

    const nextRow = makeLocalRow(sectionId, values, resourceData, item);
    setResourceData((current) => ({
      ...current,
      [sectionId]: item
        ? current[sectionId].map((row) => (row.id === item.id ? nextRow : row))
        : [nextRow, ...current[sectionId]],
    }));
    closeEditor();
    showToast(`${formConfig.label}已保存在本地演示数据`);
  }

  async function handleDeleteResource(sectionId, item) {
    if (!item) return;
    const collection = apiCollections[sectionId];
    const label = resourceFormConfigs[sectionId]?.label || resourceConfigs[sectionId]?.title || "资源";
    const confirmed = window.confirm(`确认删除 ${item.name || item.id}？`);
    if (!confirmed) return;

    if (hasAdminApiToken() && collection && item.raw?.id) {
      await adminDelete(`/api/v1/admin/${collection}/${item.raw.id}`);
      showToast(`${label}已删除`);
      await loadBackendData({ silent: true });
      return;
    }

    if (!demoModeEnabled) {
      showToast("请先登录 Backend Core");
      return;
    }

    setResourceData((current) => ({
      ...current,
      [sectionId]: current[sectionId].filter((row) => row.id !== item.id),
    }));
    showToast(`${label}已从本地演示数据删除`);
  }

  async function handleCreateRelay(values) {
    if (hasAdminApiToken()) {
      await adminPost("/api/v1/admin/access-nodes/relay", values);
      setDrawerOpen(false);
      showToast("中转访问节点已创建");
      await loadBackendData({ silent: true });
      return;
    }

    if (!demoModeEnabled) {
      throw new Error("请先登录 Backend Core");
    }

    const { accessNode, relayRule } = makeLocalRelayBundle(values, resourceData);
    setResourceData((current) => ({
      ...current,
      "access-nodes": [accessNode, ...current["access-nodes"]],
      "relay-rules": [relayRule, ...current["relay-rules"]],
    }));
    setDrawerOpen(false);
    showToast("中转访问节点已保存在本地演示数据");
  }

  function handleSaveApiSettings(settings) {
    saveAdminApiSettings(settings);
    if (hasAdminApiToken()) {
      loadBackendData();
    } else {
      setApiStatus({ mode: "login", message: "连接设置已保存，请登录管理员账号" });
    }
  }

  if (!authReady && !demoModeEnabled) {
    return <LoginPage apiStatus={apiStatus} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <Sidebar activeSection={activeSection} onSelect={setActiveSection} />
      <section className="workspace">
        <TopBar apiStatus={apiStatus} adminUser={adminUser} onLogout={handleLogout} onPublish={() => showToast("配置发布任务已创建")} />
        <MobileNav activeSection={activeSection} onSelect={setActiveSection} />
        <AppContent
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          showToast={showToast}
          setDrawerOpen={setDrawerOpen}
          resourceData={resourceData}
          apiStatus={apiStatus}
          onSaveApiSettings={handleSaveApiSettings}
          onCreate={openCreateEditor}
          onEdit={openEditEditor}
          onDelete={handleDeleteResource}
          onReload={() => loadBackendData()}
        />
      </section>
      <CreateRelayDrawer open={drawerOpen} resourceData={resourceData} onClose={() => setDrawerOpen(false)} onSubmit={handleCreateRelay} />
      <ResourceEditorDrawer
        open={editorState.open}
        sectionId={editorState.sectionId}
        item={editorState.item}
        resourceData={resourceData}
        onClose={closeEditor}
        onSubmit={handleEditorSubmit}
      />
      {toast ? (
        <div className="toast" role="status">
          <IconBellRinging size={17} stroke={1.9} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
