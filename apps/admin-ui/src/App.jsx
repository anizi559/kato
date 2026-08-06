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
  getAdminSessionToken,
  hasAdminApiToken,
  loginAdmin,
  logoutAdmin,
  saveAdminApiSettings,
} from "./admin-api.js";

const navItems = [
  { id: "overview", label: "总览", icon: IconHome2 },
  { id: "users", label: "用户", icon: IconUsersGroup },
  { id: "plans", label: "权限组", icon: IconStack2 },
  { id: "access-nodes", label: "访问节点", icon: IconNetwork },
  { id: "servers", label: "服务器管理", icon: IconCloudComputing },
  { id: "monitor", label: "监控日志", icon: IconBellRinging },
  { id: "settings", label: "系统设置", icon: IconSettings },
];

const accessNodes = [];
const users = [];
const plans = [];
const proxyNodes = [];
const inbounds = [];
const transitRelays = [];
const relayRules = [];
const frontendEdges = [];
const subscriptionEdges = [];
const subscriptionPolicies = [];
const agents = [];
const configReleases = [];
const healthChecks = [];
const alerts = [];
const trafficStats = [];
const domains = [];
const auditLogs = [];
const backups = [];

const columns = {
  users: [
    { key: "id", label: "用户名", primary: true, width: "190px", subKey: "summary" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "plan", label: "权限组", width: "76px" },
    { key: "expiresAt", label: "到期时间", width: "104px" },
    { key: "trafficUsed", label: "流量", width: "124px" },
    { key: "protocols", label: "协议", width: "104px" },
    { key: "subscription", label: "订阅", width: "72px" },
    { key: "lastSeen", label: "最近使用", width: "90px" },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  plans: [
    { key: "name", label: "权限组", primary: true, width: "154px", subKey: "summary" },
    { key: "status", label: "状态", width: "68px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "trafficQuota", label: "流量额度", width: "92px" },
    { key: "duration", label: "有效期", width: "76px" },
    { key: "visibleNodes", label: "可见节点", width: "90px" },
    { key: "accessNodes", label: "节点数", width: "72px" },
    { key: "userCount", label: "用户", width: "62px" },
    { key: "configVersion", label: "版本", width: "52px" },
  ],
  access: [
    { key: "id", label: "名称", primary: true, width: "190px", subKey: "summary" },
    { key: "type", label: "类型", width: "56px" },
    { key: "protocol", label: "协议", width: "54px" },
    { key: "displayHost", label: "显示主机", width: "160px" },
    { key: "region", label: "区域", width: "70px" },
    { key: "port", label: "端口", width: "54px" },
    { key: "proxyNode", label: "代理服务器", width: "94px" },
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
    { key: "name", label: "节点", primary: true, width: "176px", subKey: "summary" },
    { key: "protocol", label: "协议", width: "112px" },
    { key: "proxyNode", label: "代理服务器", width: "96px" },
    { key: "displayHost", label: "直连地址", width: "150px" },
    { key: "port", label: "端口", width: "54px" },
    { key: "status", label: "状态", width: "72px", render: (row) => <StatePill>{row.status}</StatePill> },
    { key: "relayAccess", label: "中转入口", width: "68px" },
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
    { key: "name", label: "订阅服务器", primary: true, width: "150px", subKey: "summary" },
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
    { key: "planScope", label: "权限组范围", width: "130px" },
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
    searchPlaceholder: "搜索用户名、权限组或协议...",
    searchKeys: ["id", "name", "plan", "protocols"],
    segments: [{ label: "All", value: "All" }, { label: "Active", value: "正常" }, { label: "处理", value: "已暂停" }],
    segmentKey: "status",
    filters: [
      { key: "plan", label: "权限组", options: ["全部"] },
      { key: "status", label: "状态", options: ["全部", "正常", "已暂停"] },
      { key: "subscription", label: "订阅", options: ["全部", "启用", "禁用"] },
    ],
    detailRows: [
      ["用户 ID", "id"], ["权限组", "plan"], ["到期时间", "expiresAt"], ["流量用量", "trafficUsed"],
      ["可见节点", "visibleNodes"], ["订阅状态", "subscription"], ["创建时间", "createdAt"],
    ],
    relationRows: [
      ["可见节点", "nodes"], ["订阅服务", () => "-"], ["配置版本", "configVersion"],
    ],
    metricRows: [["应用时间", "appliedAt"], ["最近使用", "lastSeen"], ["Hysteria2", "hy2Password"], ["AnyTLS", "anytlsPassword"]],
    subscriptionLink: true,
    preview: (row) => `user: ${row.id}\nplan: ${row.plan}\nprotocols: ${row.protocols}\nsubscription: ${row.subscription}\nnodes: ${row.nodes}\ntraffic: ${row.trafficUsed}`,
  },
  plans: {
    title: "权限组",
    subtitle: "定义流量额度、有效期、协议权限和节点可见范围",
    data: plans,
    columns: columns.plans,
    tableLabel: "权限组列表",
    primaryAction: "新建权限组",
    secondaryAction: "编辑排序",
    searchPlaceholder: "搜索权限组名称或额度...",
    searchKeys: ["id", "name", "trafficQuota"],
    segments: [{ label: "All", value: "All" }, { label: "启用", value: "启用" }, { label: "停用", value: "停用" }],
    segmentKey: "status",
    filters: [
      { key: "status", label: "状态", options: ["全部", "启用", "停用"] },
    ],
    detailRows: [["权限组 ID", "id"], ["流量额度", "trafficQuota"], ["有效期", "duration"], ["可见节点", "visibleNodes"], ["HY2 速率", "hy2Speed"]],
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
    searchPlaceholder: "搜索名称、显示主机或代理服务器...",
    searchKeys: ["id", "displayHost", "proxyNode", "transitRelay", "inbound"],
    segments: [{ label: "All", value: "All" }, { label: "Direct", value: "Direct" }, { label: "Relay", value: "Relay" }],
    segmentKey: "type",
    filters: [
      { key: "protocol", label: "协议", options: ["全部", "TCP", "UDP", "QUIC"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "visible", label: "可见性", options: ["全部", "true"] },
    ],
    detailRows: [["类型", "type"], ["协议 / 传输", "protocol"], ["显示主机", "displayHost"], ["端口", "port"], ["探测结果", (row) => `${row.raw?.health?.status || "未探测"}${row.raw?.health?.latencyMs != null ? ` · ${row.raw.health.latencyMs}ms` : ""}`], ["探测时间", (row) => isoText(row.raw?.health?.probedAt)], ["创建时间", "createdAt"], ["配置版本", "configVersion"]],
    relationRows: [["入站", "inbound"], ["中转规则", "relayRule"], ["代理服务器", "proxyNode"], ["中转服务器", "transitRelay"]],
    metricRows: [["权限组可见性", (row) => row.plans.join("、")], ["应用时间", "appliedAt"], ["订阅可见", () => "是"]],
    preview: (row) => `- name: ${row.id}\n  type: ${row.type.toLowerCase()}\n  listen: 0.0.0.0:${row.port}\n  transport: ${row.protocol.toLowerCase()}\n  inbound: ${row.inbound}\n  transit_relay: ${row.transitRelay}`,
  },
  "proxy-nodes": {
    title: "代理服务器",
    subtitle: "管理真实落地代理服务器、协议运行时和服务器 Agent 状态",
    data: proxyNodes,
    columns: columns.proxy,
    tableLabel: "代理服务器列表",
    primaryAction: "新建代理服务器",
    secondaryAction: "生成安装 Token",
    searchPlaceholder: "搜索服务器、IP 或区域...",
    searchKeys: ["id", "name", "host", "region"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "待发布", value: "待发布" }, { label: "离线", value: "离线" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong", "Singapore", "Tokyo", "Los Angeles"] },
      { key: "status", label: "状态", options: ["全部", "在线", "待发布", "离线"] },
      { key: "agentVersion", label: "版本", options: ["全部"] },
    ],
    detailRows: [["公网地址", "host"], ["区域", "region"], ["Agent 版本", "agentVersion"], ["协议入站", "inbounds"], ["访问节点", "accessNodes"], ["最近心跳", "heartbeat"]],
    relationRows: [["配置版本", "configVersion"], ["绑定 Agent", (row) => `agent-${row.id}`], ["状态", "status"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `proxy_node: ${row.id}\nhost: ${row.host}\nregion: ${row.region}\nruntimes:\n  xray: enabled\n  hysteria2: enabled\nconfig_revision: ${row.configVersion}`,
  },
  inbounds: {
    title: "节点",
    subtitle: "添加节点：选择代理服务器、协议和配置，保存后自动下发到节点服务器",
    data: inbounds,
    columns: columns.inbounds,
    tableLabel: "节点列表",
    primaryAction: "添加节点",
    secondaryAction: "批量启用",
    searchPlaceholder: "搜索节点名称、协议或代理服务器...",
    searchKeys: ["id", "name", "protocol", "proxyNode"],
    segments: [{ label: "All", value: "All" }, { label: "VLESS", value: "VLESS REALITY" }, { label: "HY2", value: "Hysteria2" }],
    segmentKey: "protocol",
    filters: [
      { key: "proxyNode", label: "代理服务器", options: ["全部"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "port", label: "端口", options: ["全部", "443"] },
    ],
    detailRows: [["协议", "protocol"], ["代理服务器", "proxyNode"], ["直连地址", "displayHost"], ["监听端口", "port"], ["状态", "status"], ["flow / 模式", "flow"]],
    relationRows: [["中转入口", "relayAccess"], ["用户数量", "users"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `node: ${row.id}\nprotocol: ${row.protocol}\nproxy_node: ${row.proxyNode}\ndirect: ${row.displayHost}:${row.port}\nrelay_entries: ${row.relayAccess}\nflow: ${row.flow}`,
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
      { key: "transitRelay", label: "中转", options: ["全部"] },
      { key: "status", label: "状态", options: ["全部", "运行中", "待发布"] },
      { key: "transport", label: "传输", options: ["全部", "TCP", "UDP"] },
    ],
    detailRows: [["中转服务器", "transitRelay"], ["入口端口", "entryPort"], ["目标主机", "targetHost"], ["目标端口", "targetPort"], ["传输", "transport"], ["探测结果", (row) => `${row.raw?.health?.status || "未探测"}${row.raw?.health?.latencyMs != null ? ` · ${row.raw.health.latencyMs}ms` : ""}`], ["状态", "status"]],
    relationRows: [["Access Node", "accessNode"], ["配置版本", "configVersion"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `[[endpoints]]\nlisten = \"0.0.0.0:${row.entryPort}\"\nremote = \"${row.targetHost}:${row.targetPort}\"\ntransport = \"${row.transport.toLowerCase()}\"\naccess_node = \"${row.accessNode}\"`,
  },
  "frontend-edges": {
    title: "前端服务器",
    subtitle: "管理面板前端服务器、工具站伪装、证书和 Backend API 对接状态",
    data: frontendEdges,
    columns: columns.edges,
    tableLabel: "前端服务器列表",
    primaryAction: "注册前端服务器",
    secondaryAction: "签发证书",
    searchPlaceholder: "搜索入口、域名或伪装类型...",
    searchKeys: ["id", "name", "host", "camouflage"],
    segments: [{ label: "All", value: "All" }, { label: "在线", value: "在线" }, { label: "待发布", value: "待发布" }],
    segmentKey: "status",
    filters: [
      { key: "region", label: "区域", options: ["全部", "Hong Kong"] },
      { key: "certificate", label: "证书", options: ["全部", "有效 · 84 天", "待签发"] },
      { key: "backend", label: "后端", options: ["全部"] },
    ],
    detailRows: [["域名", "host"], ["区域", "region"], ["版本", "version"], ["证书", "certificate"], ["工具站", "camouflage"], ["后端", "backend"]],
    relationRows: [["Backend API", "backend"], ["最近心跳", "heartbeat"], ["状态", "status"]],
    metricRows: [["创建时间", "createdAt"], ["应用时间", "appliedAt"]],
    preview: (row) => `frontend_edge: ${row.id}\nhost: ${row.host}\ncamouflage: ${row.camouflage}\nbackend: ${row.backend}\ncertificate: ${row.certificate}`,
  },
  "subscription-edges": {
    title: "订阅服务器",
    subtitle: "管理公开订阅服务器、缓存、限速和用户订阅访问入口",
    data: subscriptionEdges,
    columns: columns.subscriptionEdges,
    tableLabel: "订阅服务器列表",
    primaryAction: "注册订阅服务器",
    secondaryAction: "刷新缓存",
    searchPlaceholder: "搜索订阅服务器、域名或区域...",
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
    subtitle: "管理订阅格式、节点排序、权限组可见性和客户端兼容策略",
    data: subscriptionPolicies,
    columns: columns.policies,
    tableLabel: "订阅策略列表",
    primaryAction: "新建订阅策略",
    secondaryAction: "调整优先级",
    searchPlaceholder: "搜索策略、格式或权限组范围...",
    searchKeys: ["id", "name", "format", "planScope"],
    segments: [{ label: "All", value: "All" }, { label: "启用", value: "启用" }],
    segmentKey: "status",
    filters: [
      { key: "format", label: "格式", options: ["全部", "Clash, Sing-box", "Clash, Sing-box, URI"] },
      { key: "nodeSort", label: "排序", options: ["全部", "区域优先", "质量评分"] },
      { key: "hiddenOffline", label: "离线", options: ["全部", "是"] },
    ],
    detailRows: [["格式", "format"], ["权限组范围", "planScope"], ["节点排序", "nodeSort"], ["隐藏离线", "hiddenOffline"], ["客户端规则", "userAgentRule"], ["状态", "status"]],
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
    title: "服务器 Agent",
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
      { key: "version", label: "版本", options: ["全部"] },
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
  "frontend-edges": "frontend-edges",
  "subscription-edges": "subscription-edges",
};

const backendCollections = ["plans", "users", "proxy-nodes", "node-inbounds", "transit-relays", "access-nodes", "relay-rules", "frontend-edges", "subscription-edges"];
const writableSections = new Set(Object.keys(apiCollections));
const bootstrapRoleBySection = {
  "proxy-nodes": "proxy-node",
  "transit-relays": "transit-relay",
  "frontend-edges": "frontend-edge",
  "subscription-edges": "subscription-edge",
};
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
    { label: "访问节点", value: String((resourceData["access-nodes"] || []).length), meta: `${pendingAccessNodes} 个待应用`, tone: pendingAccessNodes ? "warning" : "success" },
    { label: "代理服务器", value: String((resourceData["proxy-nodes"] || []).length), meta: "由服务器管理接管", tone: "success" },
    { label: "中转服务器", value: String((resourceData["transit-relays"] || []).length), meta: "管理转发链路", tone: "success" },
    { label: "服务器 Agent", value: String(agents.length), meta: offlineAgents ? `${offlineAgents} 个异常` : "心跳正常", tone: offlineAgents ? "danger" : "success" },
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

function hasManagedRows(resourceData = {}) {
  return [
    "users",
    "plans",
    "proxy-nodes",
    "inbounds",
    "transit-relays",
    "access-nodes",
    "relay-rules",
    "agents",
  ].some((sectionId) => (resourceData[sectionId] || []).length > 0);
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

function adaptBackendResources({ collections, agents: rawAgents, summary, alerts = [], auditLogs = [], trafficSummary = null }) {
  const plansRaw = collections.plans || [];
  const usersRaw = collections.users || [];
  const proxyRaw = collections["proxy-nodes"] || [];
  const inboundRaw = collections["node-inbounds"] || [];
  const relayRaw = collections["transit-relays"] || [];
  const accessRaw = collections["access-nodes"] || [];
  const ruleRaw = collections["relay-rules"] || [];
  const frontendRaw = collections["frontend-edges"] || [];
  const subscriptionRaw = collections["subscription-edges"] || [];
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
    "frontend-edges": frontendRaw.map((edge) => adaptFrontendEdge(edge, context)),
    "subscription-edges": subscriptionRaw.map((edge) => adaptSubscriptionEdge(edge, context)),
    agents: agentsRaw.map((agent) => adaptAgent(agent, context)),
    alerts: alerts.map((alert) => adaptAlert(alert)),
    "audit-logs": auditLogs.map((entry) => adaptAuditLog(entry)),
    traffic: (trafficSummary?.users || []).map((user) => adaptTrafficRow(user)),
    config: adaptConfigReleases(summary, agentsRaw),
  };
}

function adaptFrontendEdge(edge, context) {
  const agent = edge.agentId ? context.agentsById.get(edge.agentId) : null;
  return {
    id: edge.name || edge.id,
    resourceId: edge.id,
    raw: edge,
    name: edge.name || edge.id,
    host: edge.publicHost || edge.domain || "-",
    region: edge.region || "-",
    status: agent ? (agent.status === "online" ? "在线" : "离线") : edge.enabled === false ? "停用" : "未注册",
    version: agent?.version || "-",
    certificate: edge.tlsEnabled ? "HTTPS" : "HTTP",
    camouflage: "工具站",
    backend: "-",
    heartbeat: agent?.lastSeenAt ? isoText(agent.lastSeenAt) : "-",
    port: String(edge.port || 80),
    createdAt: isoText(edge.createdAt),
    appliedAt: isoText(edge.updatedAt || edge.createdAt),
  };
}

function adaptSubscriptionEdge(edge, context) {
  const agent = edge.agentId ? context.agentsById.get(edge.agentId) : null;
  return {
    id: edge.name || edge.id,
    resourceId: edge.id,
    raw: edge,
    name: edge.name || edge.id,
    host: edge.publicHost || edge.domain || "-",
    region: edge.region || "-",
    status: agent ? (agent.status === "online" ? "在线" : "离线") : edge.enabled === false ? "停用" : "未注册",
    cacheTtl: "60s",
    rateLimit: "60/min",
    policies: "-",
    pathPrefix: edge.pathPrefix || "go",
    certificate: edge.tlsEnabled ? "HTTPS" : "HTTP",
    lastAccess: agent?.lastSeenAt ? isoText(agent.lastSeenAt) : "-",
    createdAt: isoText(edge.createdAt),
    appliedAt: isoText(edge.updatedAt || edge.createdAt),
  };
}

function adaptAlert(alert) {
  return {
    id: alert.id,
    resourceId: alert.id,
    raw: alert,
    name: alert.title || alert.type,
    status: alert.status === "resolved" ? "已解决" : "未处理",
    severity: alert.severity || "warning",
    resourceType: alert.resourceType || "-",
    resourceName: alert.resourceId || "-",
    openedAt: isoText(alert.createdAt),
    message: alert.message || "",
  };
}

function adaptAuditLog(entry) {
  return {
    id: entry.id,
    resourceId: entry.id,
    raw: entry,
    name: entry.action,
    time: isoText(entry.createdAt),
    actor: "admin",
    action: entry.action,
    resourceType: entry.resourceId ? "resource" : "-",
    resourceName: entry.resourceId || "-",
    sourceIp: "-",
    status: "成功",
    details: entry.details || {},
  };
}

function adaptTrafficRow(user) {
  return {
    id: user.id,
    resourceId: user.id,
    raw: user,
    name: user.name,
    dimension: "用户",
    inbound: "-",
    upload: "-",
    download: formatBytes(user.usedTrafficBytes || 0),
    quota: user.trafficLimitBytes ? formatBytes(user.trafficLimitBytes) : "不限",
    updatedAt: isoText(user.lastProxyUseAt, "未使用"),
    status: "正常",
  };
}

function adaptPlan(plan, context) {
  const userCount = context.usersRaw.filter((user) => user.planId === plan.id).length;
  return {
    id: plan.name || plan.id,
    resourceId: plan.id,
    raw: plan,
    summary: `${formatBytes(plan.trafficLimitBytes)} · ${plan.durationDays || "不限"} 天`,
    group: plan.enabled === false ? "停用权限组" : "启用权限组",
    name: plan.name || plan.id,
    status: enabledLabel(plan, "启用", "停用"),
    trafficQuota: formatBytes(plan.trafficLimitBytes),
    duration: plan.durationDays ? `${plan.durationDays} 天` : "不限",
    visibleNodes: plan.allowedAccessNodes?.length ? `${plan.allowedAccessNodes.length} 个` : "全部",
    accessNodes: `${context.accessRaw.length} 个`,
    userCount: String(userCount),
    hy2Speed: `${plan.hysteria2?.upMbps || 0} / ${plan.hysteria2?.downMbps || 0} Mbps`,
    configVersion: `v${context.summary?.version || 1}`,
    createdAt: isoText(plan.createdAt),
    appliedAt: isoText(plan.updatedAt || plan.createdAt),
  };
}

function adaptUser(user, context) {
  const plan = context.plansById.get(user.planId);
  const total = user.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null;
  return {
    id: user.name || user.email || user.id,
    resourceId: user.id,
    raw: user,
    summary: `${plan?.name || "无权限组"} · 到期 ${isoText(user.expiresAt, "不限").slice(0, 10)}`,
    group: user.enabled === false ? "需处理" : "活跃用户",
    name: user.name || user.email || user.id,
    status: user.enabled === false ? "已暂停" : "正常",
    plan: plan?.name || "未绑定",
    expiresAt: isoText(user.expiresAt, "不限").slice(0, 10),
    trafficUsed: `${formatBytes(user.usedTrafficBytes || 0)} / ${formatBytes(total)}`,
    visibleNodes: plan?.allowedAccessNodes?.length ? `${plan.allowedAccessNodes.length} 个` : "全部",
    protocols: "全部",
    subscription: user.enabled === false ? "禁用" : "启用",
    lastSeen: user.lastProxyUseAt ? isoText(user.lastProxyUseAt) : "未使用",
    configVersion: `v${context.summary?.version || 1}`,
    uuid: user.credentials?.vlessUuid || "-",
    hy2Password: user.credentials?.hysteria2Password || "-",
    anytlsPassword: user.credentials?.anytlsPassword || "-",
    subscriptionToken: user.subscriptionToken || "",
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
  const relayCount = context.rulesByInbound[inbound.id] || 0;
  const host = inbound.entryHost || proxyNode?.entryDomain || proxyNode?.publicHost || proxyNode?.publicIp || "-";
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
    displayHost: host,
    port: String(inbound.port),
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
    region: proxyNode?.region || "-",
    port: String(accessNode.port || "-"),
    proxyNode: proxyNode?.name || accessNode.proxyNodeId || "-",
    transitRelay: relay?.name || accessNode.transitRelayId || "-",
    visible: accessNode.enabled !== false,
    status: accessNode.health?.status === "failed" ? "故障" : accessNode.health?.status === "ok" ? "正常" : enabledLabel(accessNode),
    health: accessNode.health?.status || "未探测",
    configVersion: `v${context.summary?.version || 1}`,
    inbound: inbound?.name || accessNode.inboundId || "-",
    relayRule: rule?.name || accessNode.relayRuleId || "-",
    plans: ["按权限组"],
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
    status: rule.health?.status === "failed" ? "故障" : rule.health?.status === "ok" ? "正常" : enabledLabel(rule),
    health: rule.health?.status || "未探测",
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
  const hasManagedResource = Object.values(summary.counts || {}).some((value) => Number(value) > 0) || rawAgents.length > 0;
  if (!hasManagedResource) return [];
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
      { name: "planId", label: "权限组", type: "select", options: (data) => optionRows(data.plans), defaultValue: (data) => selectDefault(data.plans) },
      { name: "expiresAt", label: "到期时间", type: "text", defaultValue: "" },
      { name: "trafficLimitGiB", label: "流量上限 GiB", type: "number", defaultValue: "" },
      { name: "enabled", label: "启用用户", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      email: item.raw?.email || "",
      planId: item.raw?.planId || "",
      expiresAt: item.raw?.expiresAt || "",
      trafficLimitGiB: item.raw?.trafficLimitBytes ? trimNumber(item.raw.trafficLimitBytes / gib) : "",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      email: values.email || null,
      planId: values.planId || null,
      expiresAt: values.expiresAt || null,
      trafficLimitBytes: trafficBytesFromGiB(values.trafficLimitGiB),
      enabled: Boolean(values.enabled),
      access: { protocols: [] },
    }),
  },
  plans: {
    label: "权限组",
    fields: [
      { name: "name", label: "权限组名称", type: "text", defaultValue: "" },
      { name: "trafficLimitGiB", label: "流量额度 GiB", type: "number", defaultValue: 500 },
      { name: "durationDays", label: "有效期天数", type: "number", defaultValue: 90 },
      { name: "allowedAccessNodes", label: "可见节点（勾选）", type: "nodes", options: (data) => [
        ...(data.inbounds || []).map((node) => ({ label: `${node.name} · ${node.displayHost || "-"}:${node.port}`, value: `inbound:${node.resourceId}` })),
        ...(data["access-nodes"] || []).map((node) => ({ label: `${node.name} · ${node.displayHost || "-"}:${node.port}（中转）`, value: `access:${node.resourceId}` })),
      ], hint: "不勾选任何节点 = 该权限组可见全部节点" },
      { name: "speedLimitMbps", label: "限速 Mbps", type: "number", defaultValue: "" },
      { name: "enabled", label: "启用权限组", type: "checkbox", defaultValue: true },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      trafficLimitGiB: item.raw?.trafficLimitBytes ? trimNumber(item.raw.trafficLimitBytes / gib) : "",
      durationDays: item.raw?.durationDays || "",
      allowedAccessNodes: item.raw?.allowedAccessNodes || [],
      speedLimitMbps: item.raw?.speedLimitMbps || "",
      enabled: item.raw?.enabled !== false,
    }),
    toApiInput: (values) => ({
      name: values.name,
      enabled: Boolean(values.enabled),
      trafficLimitBytes: trafficBytesFromGiB(values.trafficLimitGiB),
      durationDays: toNumber(values.durationDays, null),
      allowedAccessNodes: values.allowedAccessNodes || [],
      speedLimitMbps: toNumber(values.speedLimitMbps, null),
    }),
  },
  "proxy-nodes": {
    label: "代理服务器",
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
    label: "节点",
    fields: [
      { name: "name", label: "节点名称", type: "text", defaultValue: "" },
      { name: "proxyNodeId", label: "代理服务器", type: "select", options: (data) => optionRows(data["proxy-nodes"]), defaultValue: (data) => selectDefault(data["proxy-nodes"]) },
      { name: "protocol", label: "协议", type: "select", defaultValue: "vless-reality", options: [{ label: "VLESS REALITY", value: "vless-reality" }, { label: "Hysteria2", value: "hysteria2" }, { label: "AnyTLS", value: "anytls" }] },
      { name: "port", label: "端口", type: "number", defaultValue: 443 },
      { name: "listen", label: "监听地址", type: "text", defaultValue: "0.0.0.0" },
      { name: "entryHost", label: "直连地址（公网主机/域名，留空用代理服务器）", type: "text", defaultValue: "" },
      { name: "dest", label: "REALITY Dest", type: "text", defaultValue: "www.microsoft.com:443" },
      { name: "serverNames", label: "REALITY SNI（逗号分隔）", type: "text", defaultValue: "www.apple.com" },
      { name: "sni", label: "HY2 SNI", type: "text", defaultValue: "" },
      { name: "anytlsSni", label: "AnyTLS SNI", type: "text", defaultValue: "" },
      { name: "certPath", label: "AnyTLS 证书路径", type: "text", defaultValue: "" },
      { name: "keyPath", label: "AnyTLS 私钥路径", type: "text", defaultValue: "" },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      proxyNodeId: item.raw?.proxyNodeId || "",
      protocol: item.raw?.protocol || "vless-reality",
      port: item.raw?.port || 443,
      listen: item.raw?.listen || "0.0.0.0",
      entryHost: item.raw?.entryHost || "",
      dest: item.raw?.config?.reality?.dest || "",
      serverNames: item.raw?.config?.reality?.serverNames?.join(", ") || "www.apple.com",
      sni: item.raw?.config?.tls?.sni || "",
      anytlsSni: item.raw?.config?.tls?.sni || "",
      certPath: item.raw?.config?.tls?.certPath || "",
      keyPath: item.raw?.config?.tls?.keyPath || "",
    }),
    toApiInput: (values, item) => ({
      name: values.name,
      proxyNodeId: values.proxyNodeId,
      protocol: values.protocol,
      port: toNumber(values.port, 443),
      listen: values.listen || "0.0.0.0",
      entryHost: values.entryHost || null,
      config: (() => {
        if (values.protocol === "hysteria2") {
          return { sni: values.sni };
        }
        if (values.protocol === "anytls") {
          return { tls: { sni: values.anytlsSni, certPath: values.certPath, keyPath: values.keyPath } };
        }
        const existingReality = item?.raw?.config?.reality || {};
        const names = splitList(values.serverNames);
        return {
          reality: {
            ...existingReality,
            dest: values.dest,
            serverNames: names.length ? names : existingReality.serverNames || ["www.apple.com"]
          }
        };
      })(),
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
  "frontend-edges": {
    label: "前端服务器",
    fields: [
      { name: "name", label: "名称", type: "text", defaultValue: "" },
      { name: "publicHost", label: "公网主机/域名", type: "text", defaultValue: "" },
      { name: "publicIp", label: "公网 IP", type: "text", defaultValue: "" },
      { name: "region", label: "区域", type: "text", defaultValue: "" },
      { name: "provider", label: "云厂商", type: "text", defaultValue: "" },
      { name: "port", label: "端口", type: "number", defaultValue: 80 },
      { name: "tlsEnabled", label: "已启用 HTTPS", type: "checkbox", defaultValue: false },
      { name: "enabled", label: "启用", type: "checkbox", defaultValue: true },
      { name: "notes", label: "备注", type: "text", defaultValue: "" },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      publicHost: item.raw?.publicHost || "",
      publicIp: item.raw?.publicIp || "",
      region: item.raw?.region || "",
      provider: item.raw?.provider || "",
      port: item.raw?.port || 80,
      tlsEnabled: item.raw?.tlsEnabled === true,
      enabled: item.raw?.enabled !== false,
      notes: item.raw?.notes || "",
    }),
    toApiInput: (values) => ({
      name: values.name,
      publicHost: values.publicHost,
      publicIp: values.publicIp,
      domain: values.publicHost,
      region: values.region,
      provider: values.provider,
      port: toNumber(values.port, 80),
      tlsEnabled: Boolean(values.tlsEnabled),
      enabled: Boolean(values.enabled),
      notes: values.notes,
    }),
  },
  "subscription-edges": {
    label: "订阅服务器",
    fields: [
      { name: "name", label: "名称", type: "text", defaultValue: "" },
      { name: "publicHost", label: "公网主机/域名", type: "text", defaultValue: "" },
      { name: "publicIp", label: "公网 IP", type: "text", defaultValue: "" },
      { name: "region", label: "区域", type: "text", defaultValue: "" },
      { name: "provider", label: "云厂商", type: "text", defaultValue: "" },
      { name: "port", label: "端口", type: "number", defaultValue: 80 },
      { name: "pathPrefix", label: "订阅路径前缀", type: "text", defaultValue: "go" },
      { name: "tlsEnabled", label: "已启用 HTTPS", type: "checkbox", defaultValue: false },
      { name: "enabled", label: "启用", type: "checkbox", defaultValue: true },
      { name: "notes", label: "备注", type: "text", defaultValue: "" },
    ],
    fromItem: (item) => ({
      name: item.raw?.name || item.name || "",
      publicHost: item.raw?.publicHost || "",
      publicIp: item.raw?.publicIp || "",
      region: item.raw?.region || "",
      provider: item.raw?.provider || "",
      port: item.raw?.port || 80,
      pathPrefix: item.raw?.pathPrefix || "go",
      tlsEnabled: item.raw?.tlsEnabled === true,
      enabled: item.raw?.enabled !== false,
      notes: item.raw?.notes || "",
    }),
    toApiInput: (values) => ({
      name: values.name,
      publicHost: values.publicHost,
      publicIp: values.publicIp,
      domain: values.publicHost,
      region: values.region,
      provider: values.provider,
      port: toNumber(values.port, 80),
      pathPrefix: values.pathPrefix || "go",
      tlsEnabled: Boolean(values.tlsEnabled),
      enabled: Boolean(values.enabled),
      notes: values.notes,
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
      summary: `${plan?.name || "无权限组"} · 到期 ${values.expiresAt || "不限"}`,
      group: values.enabled ? "活跃用户" : "需处理",
      name: values.name,
      status: values.enabled ? "正常" : "已暂停",
      plan: plan?.name || "未绑定",
      expiresAt: values.expiresAt || "不限",
      trafficUsed: `0 B / ${formatBytes(raw.trafficLimitBytes)}`,
      protocols: protocolListLabel(splitList(values.protocols), "继承权限组"),
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
      group: values.enabled ? "启用权限组" : "停用权限组",
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
      plans: ["按权限组"],
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
    plans: ["按权限组"],
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

function TopBar({ onRefresh, apiStatus, adminUser, onLogout }) {
  const tone = apiStatus?.mode === "connected" ? "success" : apiStatus?.mode === "error" ? "danger" : "warning";
  const label = apiStatus?.message || "等待连接";
  const configVersion = apiStatus?.summary?.version ? `数据版本 v${apiStatus.summary.version}` : "数据版本 v1";

  return (
    <header className="topbar">
      <div className="topbar__status">
        <span className="topbar__item"><StatusDot tone={tone} />{label}</span>
        <span className="topbar__divider" />
        <span className="topbar__item"><IconFileCode size={17} stroke={1.8} />{configVersion}</span>
        <span className="topbar__divider" />
        <span className="topbar__item"><StatusDot tone="success" />监控正常</span>
      </div>
      <div className="topbar__actions">
        <button className="button button--secondary" type="button">{apiStatus?.mode === "demo" ? "演示预览" : "生产模式"}</button>
        <button className="button button--primary" type="button" onClick={onRefresh}><IconRefresh size={16} stroke={1.9} />刷新数据</button>
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

function GenericInspector({ item, config, onClose, onEdit, onDelete, canWrite, onResetSubscription, backendSettings }) {
  if (!item) return null;

  const detailRows = (config.detailRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const relationRows = (config.relationRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const metricRows = (config.metricRows || []).map(([label, value]) => ({ label, value: getValue(item, value) }));
  const title = item.name || item.version || item.id;
  const status = item.status || "正常";
  const baseUrl = String(backendSettings?.subscriptionBaseUrl || "").replace(/\/+$/, "");
  const pathPrefix = String(backendSettings?.subscriptionPathPrefix || "go").replace(/^\/+|\/+$/g, "");
  const subscriptionToken = item.raw?.subscriptionToken || item.subscriptionToken || "";
  const subscriptionLink = baseUrl && subscriptionToken ? `${baseUrl}/${pathPrefix}/${subscriptionToken}` : "";

  return (
    <InspectorShell title={title} status={status} onClose={onClose}>
      {config.subscriptionLink ? (
        <div className="inspector__section">
          <h3>订阅链接</h3>
          <p className="drawer-note">把这个链接发给用户，客户端会自动更新节点配置。链接不含任何格式参数。</p>
          {subscriptionLink ? (
            <label>
              <span>完整订阅链接</span>
              <pre className="token-box"><button aria-label="复制订阅链接" type="button" onClick={() => copyToClipboard(subscriptionLink, "订阅链接")}><IconCopy size={16} stroke={1.9} /></button>{subscriptionLink}</pre>
            </label>
          ) : (
            <p className="drawer-note">请先在“系统设置 → 订阅默认策略”里填写订阅入口地址。</p>
          )}
          <label>
            <span>订阅 Token</span>
            <pre className="token-box"><button aria-label="复制订阅 Token" type="button" onClick={() => copyToClipboard(subscriptionToken, "订阅 Token")}><IconCopy size={16} stroke={1.9} /></button>{subscriptionToken || "-"}</pre>
          </label>
          <div className="quick-actions">
            <button className="button button--secondary" type="button" disabled={!canWrite} onClick={() => onResetSubscription && onResetSubscription(item)}><IconRefresh size={16} stroke={1.9} />重置订阅 Token</button>
          </div>
        </div>
      ) : null}
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

function ResourcePage({ config, state, rows, totalRows, selectedItem, canWrite, onSelect, onPrimary, onSecondary, onRefresh, onCloseInspector, onEditSelected, onDeleteSelected, onResetSubscription, backendSettings }) {
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
          onResetSubscription={onResetSubscription}
          backendSettings={backendSettings}
        />
      ) : (
        <aside className="inspector inspector--empty">
          <EmptyPanel compact title="暂无详情" description="选择一条记录后，这里会显示资源详情。" />
        </aside>
      )}
    </div>
  );
}

function ResourceRoute({ sectionId, config, rows: dataRows, showToast, setDrawerOpen, onCreate, onEdit, onDelete, onReload, onGenerateBootstrap, onResetSubscription, backendSettings }) {
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
        if (bootstrapRoleBySection[sectionId]) {
          onGenerateBootstrap(sectionId, selectedItem);
          return;
        }
        showToast(`${config.secondaryAction}入口已准备`);
      }}
      onRefresh={onReload}
      onCloseInspector={() => showToast("详情面板在桌面版保持固定")}
      onEditSelected={(item) => item && onEdit(sectionId, item)}
      onDeleteSelected={(item) => item && onDelete(sectionId, item)}
      onResetSubscription={onResetSubscription}
      backendSettings={backendSettings}
    />
  );
}

function WorkspaceTabs({ items, activeId, onChange }) {
  return (
    <div className="workspace-tabs" role="tablist">
      {items.map((item) => {
        const TabIcon = item.icon;
        return (
          <button
            className={activeId === item.id ? "workspace-tab workspace-tab--active" : "workspace-tab"}
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
          >
            <TabIcon size={17} stroke={1.9} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ResourceWorkspacePage({ title, subtitle, tabs, initialTab, resourceData, showToast, setDrawerOpen, onCreate, onEdit, onDelete, onReload, onGenerateBootstrap, onResetSubscription, backendSettings }) {
  const [activeTab, setActiveTab] = useState(initialTab || tabs[0]?.id);
  const tab = tabs.find((item) => item.id === activeTab) || tabs[0];
  const sectionId = tab?.sectionId;
  const config = resourceConfigs[sectionId];

  if (!config) return null;

  return (
    <div className="workspace-shell">
      <section className="main-pane main-pane--wide">
        <div className="page-header page-header--compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <WorkspaceTabs items={tabs} activeId={tab.id} onChange={setActiveTab} />
      </section>
      <ResourceRoute
        key={sectionId}
        sectionId={sectionId}
        config={config}
        rows={resourceData[sectionId]}
        showToast={showToast}
        setDrawerOpen={setDrawerOpen}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
        onReload={onReload}
        onGenerateBootstrap={onGenerateBootstrap}
        onResetSubscription={onResetSubscription}
        backendSettings={backendSettings}
      />
    </div>
  );
}

function AccessWorkspacePage(props) {
  return (
    <ResourceWorkspacePage
      {...props}
      title="访问节点"
      subtitle="节点即协议入站：添加节点后自动成为直连入口；中转入口需单独创建并自动生成转发规则"
      initialTab="inbounds"
      tabs={[
        { id: "inbounds", label: "节点", icon: IconNetwork, sectionId: "inbounds" },
        { id: "access", label: "中转入口", icon: IconRoute, sectionId: "access-nodes" },
        { id: "relay-rules", label: "转发规则", icon: IconGitBranch, sectionId: "relay-rules" },
      ]}
    />
  );
}

function ServerManagementPage(props) {
  return (
    <ResourceWorkspacePage
      {...props}
      title="服务器管理"
      subtitle="按角色管理前端服务器、代理服务器、订阅服务器、中转服务器和 Agent 状态"
      initialTab="agents"
      tabs={[
        { id: "agents", label: "全部 Agent", icon: IconCloudComputing, sectionId: "agents" },
        { id: "frontend", label: "前端服务器", icon: IconShieldLock, sectionId: "frontend-edges" },
        { id: "proxy", label: "代理服务器", icon: IconNetwork, sectionId: "proxy-nodes" },
        { id: "subscription", label: "订阅服务器", icon: IconRoute, sectionId: "subscription-edges" },
        { id: "relay", label: "中转服务器", icon: IconGitBranch, sectionId: "transit-relays" },
        { id: "health", label: "健康检查", icon: IconActivityHeartbeat, sectionId: "health" },
      ]}
    />
  );
}

function MonitorLogPage(props) {
  return (
    <ResourceWorkspacePage
      {...props}
      title="监控日志"
      subtitle="集中查看告警、流量统计和审计日志，后续可接入通知与报表"
      initialTab="alerts"
      tabs={[
        { id: "alerts", label: "告警事件", icon: IconBellRinging, sectionId: "alerts" },
        { id: "traffic", label: "流量统计", icon: IconSelector, sectionId: "traffic" },
        { id: "audit", label: "审计日志", icon: IconFileCode, sectionId: "audit-logs" },
      ]}
    />
  );
}

function OverviewPage({ showToast, setActiveSection, resourceData, apiStatus }) {
  const summaryCards = buildSummaryCards(resourceData);
  const configVersion = apiStatus?.summary?.version ? `v${apiStatus.summary.version}` : "v1";
  const updatedAt = hasManagedRows(resourceData) && apiStatus?.summary?.configUpdatedAt ? isoText(apiStatus.summary.configUpdatedAt) : "暂无";
  const serverCounts = [
    { label: "前端", value: (resourceData["frontend-edges"] || []).length },
    { label: "代理", value: (resourceData["proxy-nodes"] || []).length },
    { label: "订阅", value: (resourceData["subscription-edges"] || []).length },
    { label: "中转", value: (resourceData["transit-relays"] || []).length },
  ];
  const accessCounts = [
    { label: "访问入口", value: (resourceData["access-nodes"] || []).length },
    { label: "协议入站", value: (resourceData.inbounds || []).length },
    { label: "中转链路", value: (resourceData["relay-rules"] || []).length },
  ];
  const alertCount = (resourceData.alerts || []).length;
  const auditCount = (resourceData["audit-logs"] || []).length;
  const trafficCount = (resourceData.traffic || []).length;
  return (
    <div className="overview-shell">
      <section className="main-pane main-pane--wide">
        <div className="page-header">
          <div>
            <h1>总览</h1>
            <p>查看控制面、服务器角色、访问链路、用户权限和监控状态</p>
          </div>
          <div className="page-header__actions">
            <button className="button button--secondary button--blue" type="button" onClick={() => setActiveSection("servers")}><IconCloudComputing size={17} stroke={1.9} />服务器管理</button>
            <button className="button button--primary" type="button" onClick={() => setActiveSection("access-nodes")}><IconNetwork size={17} stroke={1.9} />访问节点</button>
          </div>
        </div>

        <div className="status-strip">
          <div><StatusDot tone={apiStatus?.mode === "connected" ? "success" : "warning"} /><span>Backend Core</span><strong>{apiStatus?.mode === "connected" ? "Online" : "Connecting"}</strong></div>
          <div><StatusDot /><span>配置版本</span><strong>{configVersion}</strong></div>
          <div><StatusDot /><span>最近更新</span><strong>{updatedAt}</strong></div>
          <div><StatusDot tone={alertCount ? "warning" : "success"} /><span>监控事件</span><strong>{alertCount} 条告警</strong></div>
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

        <div className="overview-insight-grid">
          <section className="panel">
            <div className="panel__header">
              <h2>服务器角色分布</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("servers")}>服务器管理 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="insight-bars">
              {serverCounts.map((item) => (
                <button type="button" key={item.label} onClick={() => setActiveSection("servers")}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <i style={{ width: `${Math.max(6, Math.min(100, item.value * 18))}%` }} />
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>访问链路</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("access-nodes")}>访问节点 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="insight-stack">
              {accessCounts.map((item) => (
                <button type="button" key={item.label} onClick={() => setActiveSection("access-nodes")}>
                  <StatusDot tone={item.value ? "success" : "warning"} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>用户与权限</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("plans")}>权限组 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="insight-kpis">
              <button type="button" onClick={() => setActiveSection("users")}><span>用户</span><strong>{(resourceData.users || []).length}</strong></button>
              <button type="button" onClick={() => setActiveSection("plans")}><span>权限组</span><strong>{(resourceData.plans || []).length}</strong></button>
              <button type="button" onClick={() => setActiveSection("access-nodes")}><span>可见入口</span><strong>{(resourceData["access-nodes"] || []).length}</strong></button>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>监控摘要</h2>
              <button className="subtle-link" type="button" onClick={() => setActiveSection("monitor")}>监控日志 <IconExternalLink size={14} stroke={1.9} /></button>
            </div>
            <div className="insight-stack">
              <button type="button" onClick={() => setActiveSection("monitor")}>
                <StatusDot tone={alertCount ? "warning" : "success"} />
                <span>告警事件</span>
                <strong>{alertCount}</strong>
              </button>
              <button type="button" onClick={() => setActiveSection("monitor")}>
                <StatusDot />
                <span>流量记录</span>
                <strong>{trafficCount}</strong>
              </button>
              <button type="button" onClick={() => setActiveSection("monitor")}>
                <StatusDot />
                <span>审计日志</span>
                <strong>{auditCount}</strong>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ showToast, apiStatus, onSaveApiSettings, backendSettings, onSaveBackendSettings }) {
  const [apiSettings, setApiSettings] = useState(() => getAdminApiSettings());
  const [frontendLocal, setFrontendLocal] = useState({ adminPath: "", loaded: false });
  const [frontendPathInput, setFrontendPathInput] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [resetForm, setResetForm] = useState({ username: "", password: "" });
  const [subscriptionSettings, setSubscriptionSettings] = useState({
    subscriptionBaseUrl: "",
    subscriptionPathPrefix: "go",
    nodeBackendUrl: "",
    subscriptionTitle: "",
    defaultSubscriptionIntervalSeconds: 3600,
    subscriptionUserinfo: true,
    agentOfflineSeconds: 180,
    alertWebhookUrl: "",
    telegramBotToken: "",
    telegramChatId: "",
    healthProbeIntervalSeconds: 60,
    healthProbeTimeoutMs: 3000,
  });

  useEffect(() => {
    if (backendSettings) {
      setSubscriptionSettings({
        subscriptionBaseUrl: backendSettings.subscriptionBaseUrl || "",
        subscriptionPathPrefix: backendSettings.subscriptionPathPrefix || "go",
        nodeBackendUrl: backendSettings.nodeBackendUrl || "",
        subscriptionTitle: backendSettings.subscriptionTitle || "",
        defaultSubscriptionIntervalSeconds: Number(backendSettings.defaultSubscriptionIntervalSeconds) || 3600,
        subscriptionUserinfo: backendSettings.subscriptionUserinfo !== false,
        agentOfflineSeconds: Number(backendSettings.agentOfflineSeconds) || 180,
        alertWebhookUrl: backendSettings.alertWebhookUrl || "",
        telegramBotToken: backendSettings.telegramBotToken || "",
        telegramChatId: backendSettings.telegramChatId || "",
        healthProbeIntervalSeconds: Number(backendSettings.healthProbeIntervalSeconds) || 60,
        healthProbeTimeoutMs: Number(backendSettings.healthProbeTimeoutMs) || 3000,
      });
    }
  }, [backendSettings]);

  useEffect(() => {
    fetch("/_kato/api/local/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.adminPath) {
          setFrontendLocal({ adminPath: data.adminPath, loaded: true });
          setFrontendPathInput(data.adminPath);
        }
      })
      .catch(() => {});
  }, []);

  function updateApiSetting(key, value) {
    setApiSettings((current) => ({ ...current, [key]: value }));
  }

  function updateSubscriptionSetting(key, value) {
    setSubscriptionSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveFrontendPath() {
    const next = frontendPathInput.trim();
    if (!next || next === "/") {
      showToast("请输入新的管理后台路径");
      return;
    }
    try {
      const response = await fetch("/_kato/api/local/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adminPath: next,
          adminSessionToken: getAdminSessionToken()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        showToast(`修改失败：${payload.message || `HTTP ${response.status}`}`);
        return;
      }
      showToast("管理后台路径已修改，正在跳转...");
      window.setTimeout(() => {
        window.location.href = `${payload.adminPath}/`;
      }, 800);
    } catch (error) {
      showToast(`修改失败：${error.message}`);
    }
  }

  async function saveAdminPassword() {
    if (!passwordForm.current || !passwordForm.next) {
      showToast("请填写当前密码和新密码");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      showToast("两次输入的新密码不一致");
      return;
    }
    try {
      await adminPost("/api/v1/admin/me/password", {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next
      });
      showToast("密码已修改");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      showToast(`修改失败：${error.message}`);
    }
  }

  async function resetAdminPassword() {
    if (!resetForm.username || !resetForm.password) {
      showToast("请填写目标账号和新密码");
      return;
    }
    if (!window.confirm(`确认重置 ${resetForm.username} 的密码？该账号所有会话将立即失效。`)) {
      return;
    }
    try {
      await adminPatch(`/api/v1/admin/admin-users/${encodeURIComponent(resetForm.username)}/password`, {
        newPassword: resetForm.password
      });
      showToast("密码已重置");
      setResetForm({ username: "", password: "" });
    } catch (error) {
      showToast(`重置失败：${error.message}`);
    }
  }

  return (
    <div className="settings-shell">
      <section className="main-pane main-pane--wide">
        <div className="page-header">
          <div>
            <h1>系统设置</h1>
            <p>管理 Backend Core、管理员安全、订阅兼容、证书、备份和升级策略</p>
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
            <h2>前端入口设置</h2>
            <label><span>当前管理后台路径</span><input value={frontendLocal.adminPath || (frontendLocal.loaded ? "" : "未获取（本地服务不可用）")} disabled /></label>
            <label><span>新管理后台路径</span><input placeholder="例如 /admin-a1b2c3d4" value={frontendPathInput} onChange={(event) => setFrontendPathInput(event.target.value)} /></label>
            <p className="drawer-note">修改后当前页面会自动跳转到新路径，旧路径立即失效。路径只能包含字母、数字、点、下划线和中横线，不要用 admin、panel 这类常见词。</p>
            <button className="button button--primary" type="button" onClick={saveFrontendPath}><IconShieldLock size={16} stroke={1.9} />保存并跳转</button>
          </section>

          <section className="setting-panel">
            <h2>管理员</h2>
            <label><span>管理员账号</span><input value="admin" disabled /></label>
            <label><span>当前密码</span><input type="password" value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></label>
            <label><span>新密码</span><input type="password" placeholder="至少 8 位，包含字母和数字" value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></label>
            <label><span>确认新密码</span><input type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))} /></label>
            <button className="button button--primary" type="button" onClick={saveAdminPassword}><IconShieldLock size={16} stroke={1.9} />修改密码</button>
            <div className="setting-divider" />
            <h3>重置管理员密码（忘记密码时）</h3>
            <label><span>目标账号</span><input value={resetForm.username} onChange={(event) => setResetForm((current) => ({ ...current, username: event.target.value }))} /></label>
            <label><span>新密码</span><input type="password" value={resetForm.password} onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))} /></label>
            <button className="button button--secondary" type="button" onClick={resetAdminPassword}><IconLock size={16} stroke={1.9} />用管理 Token 重置</button>
          </section>

          <section className="setting-panel">
            <h2>订阅默认策略</h2>
            <label><span>订阅入口地址</span><input placeholder="例如 https://katotool.com" value={subscriptionSettings.subscriptionBaseUrl} onChange={(event) => updateSubscriptionSetting("subscriptionBaseUrl", event.target.value)} /></label>
            <label><span>节点安装后端地址</span><input placeholder="例如 http://45.192.205.73:8080；留空用当前面板地址" value={subscriptionSettings.nodeBackendUrl} onChange={(event) => updateSubscriptionSetting("nodeBackendUrl", event.target.value)} /></label>
            <label><span>订阅路径前缀</span><input placeholder="go" value={subscriptionSettings.subscriptionPathPrefix} onChange={(event) => updateSubscriptionSetting("subscriptionPathPrefix", event.target.value)} /></label>
            <label><span>订阅标题</span><input placeholder="留空使用系统名称" value={subscriptionSettings.subscriptionTitle} onChange={(event) => updateSubscriptionSetting("subscriptionTitle", event.target.value)} /></label>
            <label><span>更新间隔（秒）</span><input type="number" min="60" value={subscriptionSettings.defaultSubscriptionIntervalSeconds} onChange={(event) => updateSubscriptionSetting("defaultSubscriptionIntervalSeconds", Number(event.target.value))} /></label>
            <label><span>流量信息响应头</span><select value={subscriptionSettings.subscriptionUserinfo ? "enabled" : "disabled"} onChange={(event) => updateSubscriptionSetting("subscriptionUserinfo", event.target.value === "enabled")}><option value="enabled">启用（客户端显示剩余流量/到期）</option><option value="disabled">关闭（更隐蔽）</option></select></label>
            <button className="button button--primary" type="button" onClick={() => onSaveBackendSettings && onSaveBackendSettings(subscriptionSettings)}><IconCircleCheck size={16} stroke={1.9} />保存订阅设置</button>
          </section>

          <section className="setting-panel">
            <h2>服务器 Agent</h2>
            <label><span>最低版本</span><input defaultValue="0.4.0" /></label>
            <label><span>心跳超时</span><select defaultValue="180s"><option>180s</option><option>300s</option></select></label>
            <label><span>运行时校验</span><select defaultValue="strict"><option value="strict">strict</option><option value="warn">warn only</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>告警与报告</h2>
            <label><span>离线判定（秒）</span><input type="number" min="30" value={subscriptionSettings.agentOfflineSeconds} onChange={(event) => updateSubscriptionSetting("agentOfflineSeconds", Number(event.target.value))} /></label>
            <label><span>通用 Webhook URL</span><input placeholder="https://example.com/hook（POST JSON）" value={subscriptionSettings.alertWebhookUrl} onChange={(event) => updateSubscriptionSetting("alertWebhookUrl", event.target.value)} /></label>
            <label><span>Telegram Bot Token</span><input placeholder="123456:ABC-DEF" value={subscriptionSettings.telegramBotToken} onChange={(event) => updateSubscriptionSetting("telegramBotToken", event.target.value)} /></label>
            <label><span>Telegram Chat ID</span><input placeholder="-100123456789" value={subscriptionSettings.telegramChatId} onChange={(event) => updateSubscriptionSetting("telegramChatId", event.target.value)} /></label>
            <label><span>健康探测间隔（秒）</span><input type="number" min="15" value={subscriptionSettings.healthProbeIntervalSeconds} onChange={(event) => updateSubscriptionSetting("healthProbeIntervalSeconds", Number(event.target.value))} /></label>
            <label><span>健康探测超时（毫秒）</span><input type="number" min="500" value={subscriptionSettings.healthProbeTimeoutMs} onChange={(event) => updateSubscriptionSetting("healthProbeTimeoutMs", Number(event.target.value))} /></label>
            <button className="button button--primary" type="button" onClick={() => onSaveBackendSettings && onSaveBackendSettings(subscriptionSettings)}><IconCircleCheck size={16} stroke={1.9} />保存告警设置</button>
          </section>

          <section className="setting-panel">
            <h2>域名证书</h2>
            <label><span>DNS Provider</span><select defaultValue="cloudflare"><option value="cloudflare">Cloudflare</option><option value="manual">手动管理</option></select></label>
            <label><span>证书续期</span><select defaultValue="auto"><option value="auto">自动续期</option><option value="manual">手动续期</option></select></label>
            <label><span>提前提醒</span><select defaultValue="14d"><option>14d</option><option>30d</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>备份恢复</h2>
            <label><span>备份路径</span><input defaultValue="/var/lib/kato/backups" /></label>
            <label><span>自动备份</span><select defaultValue="03:00"><option>03:00</option><option>04:00</option></select></label>
            <label><span>保留周期</span><select defaultValue="30d"><option>30d</option><option>90d</option></select></label>
          </section>

          <section className="setting-panel">
            <h2>版本升级</h2>
            <label><span>默认升级源</span><input defaultValue="https://github.com/anizi559/kato.git" /></label>
            <label><span>默认策略</span><select defaultValue="latest"><option value="latest">升级到最新版本</option><option value="current">保留当前版本</option></select></label>
            <label><span>升级前备份</span><select defaultValue="enabled"><option value="enabled">启用</option><option value="disabled">关闭</option></select></label>
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
  if (field.type === "nodes") return [];
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

const supportedFormProtocols = new Set(["vless-reality", "hysteria2", "anytls"]);
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
    return "请先创建代理服务器";
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

function shellQuote(value) {
  const text = String(value ?? "");
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt(`请复制${label}`, text);
  }
}

function roleInstallCommand({ role, backendUrl, token, name }) {
  const parts = [
    "sudo ./install.sh",
    "--role",
    role,
    "--backend-url",
    shellQuote(backendUrl || "http://后端IP:8080"),
    "--bootstrap-token",
    shellQuote(token),
  ];
  if (name) {
    parts.push("--agent-name", shellQuote(name));
  }
  return parts.join(" ");
}

function BootstrapTokenDialog({ result, onClose, showToast }) {
  if (!result) return null;

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制`);
    } catch {
      window.prompt(`请复制${label}`, text);
    }
  }

  return (
    <div className="drawer-scrim" role="presentation" onMouseDown={onClose}>
      <aside className="relay-drawer token-dialog" role="dialog" aria-modal="true" aria-labelledby="bootstrap-token-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relay-drawer__header">
          <div>
            <p className="eyebrow">一次性注册令牌</p>
            <h2 id="bootstrap-token-title">Bootstrap Token 已生成</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}><IconX size={21} stroke={1.8} /></IconButton>
        </div>
        <div className="token-dialog__body">
          <p className="drawer-note">新服务器首次安装时需要粘贴这个 token。它只能使用一次，过期时间为 {result.expiresAt}。</p>
          <label>
            <span>Bootstrap Token</span>
            <pre className="token-box"><button aria-label="复制 token" type="button" onClick={() => copyText(result.token, "token")}><IconCopy size={16} stroke={1.9} /></button>{result.token}</pre>
          </label>
          <label>
            <span>一键安装命令</span>
            <pre className="token-box token-box--command"><button aria-label="复制安装命令" type="button" onClick={() => copyText(result.command, "安装命令")}><IconCopy size={16} stroke={1.9} /></button>{result.command}</pre>
          </label>
          <div className="drawer-preview">
            <h3>使用说明</h3>
            <div><span>角色</span><strong>{result.role}</strong></div>
            <div><span>绑定资源</span><strong>{result.resourceName || "未绑定资源"}</strong></div>
            <div><span>后端地址</span><strong>{result.backendUrl}</strong></div>
          </div>
        </div>
        <div className="relay-drawer__footer">
          <button className="button button--secondary" type="button" onClick={() => copyText(result.token, "token")}>复制 Token</button>
          <button className="button button--primary" type="button" onClick={() => copyText(result.command, "安装命令")}>复制安装命令</button>
        </div>
      </aside>
    </div>
  );
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
              ) : field.type === "nodes" ? (
                <span className="node-picker">
                  {resolveFieldOptions(field, resourceData).map((option) => {
                    const checked = (values[field.name] || []).includes(option.value);
                    return (
                      <label className="node-picker__item" key={option.value}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const current = values[field.name] || [];
                            const next = event.target.checked
                              ? [...current, option.value]
                              : current.filter((value) => value !== option.value);
                            updateValue(field.name, next);
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                  {resolveFieldOptions(field, resourceData).length === 0 ? (
                    <small className="field-hint">还没有访问节点，请先创建节点入站</small>
                  ) : null}
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

function AppContent({ activeSection, setActiveSection, showToast, setDrawerOpen, resourceData, apiStatus, onSaveApiSettings, onCreate, onEdit, onDelete, onReload, onGenerateBootstrap, onResetSubscription, backendSettings, onSaveBackendSettings }) {
  if (activeSection === "overview") {
    return <OverviewPage showToast={showToast} setActiveSection={setActiveSection} resourceData={resourceData} apiStatus={apiStatus} />;
  }

  if (activeSection === "settings") {
    return <SettingsPage showToast={showToast} apiStatus={apiStatus} onSaveApiSettings={onSaveApiSettings} backendSettings={backendSettings} onSaveBackendSettings={onSaveBackendSettings} />;
  }

  if (activeSection === "access-nodes") {
    return (
      <AccessWorkspacePage
        resourceData={resourceData}
        showToast={showToast}
        setDrawerOpen={setDrawerOpen}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
        onReload={onReload}
        onGenerateBootstrap={onGenerateBootstrap}
        onResetSubscription={onResetSubscription}
        backendSettings={backendSettings}
      />
    );
  }

  if (activeSection === "servers") {
    return (
      <ServerManagementPage
        resourceData={resourceData}
        showToast={showToast}
        setDrawerOpen={setDrawerOpen}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
        onReload={onReload}
        onGenerateBootstrap={onGenerateBootstrap}
        onResetSubscription={onResetSubscription}
        backendSettings={backendSettings}
      />
    );
  }

  if (activeSection === "monitor") {
    return (
      <MonitorLogPage
        resourceData={resourceData}
        showToast={showToast}
        setDrawerOpen={setDrawerOpen}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
        onReload={onReload}
        onGenerateBootstrap={onGenerateBootstrap}
        onResetSubscription={onResetSubscription}
        backendSettings={backendSettings}
      />
    );
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
      onGenerateBootstrap={onGenerateBootstrap}
      onResetSubscription={onResetSubscription}
      backendSettings={backendSettings}
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
  const [bootstrapResult, setBootstrapResult] = useState(null);
  const [backendSettings, setBackendSettings] = useState(null);

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
      const [summary, agentResult, settingsResult, alertResult, auditResult, trafficResult, ...collectionResults] = await Promise.all([
        adminGet("/api/v1/admin/summary"),
        adminGet("/api/v1/admin/agents"),
        adminGet("/api/v1/admin/settings"),
        adminGet("/api/v1/admin/alerts"),
        adminGet("/api/v1/admin/audit-logs"),
        adminGet("/api/v1/admin/traffic-summary"),
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
        alerts: alertResult.items || [],
        auditLogs: auditResult.items || [],
        trafficSummary: trafficResult,
      });
      setResourceData((current) => ({ ...current, ...adapted }));
      setBackendSettings(settingsResult);
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
      const body = formConfig.toApiInput(values, item);
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

  async function handleGenerateBootstrap(sectionId, item) {
    const role = bootstrapRoleBySection[sectionId];
    if (!role) return;

    if (!hasAdminApiToken()) {
      showToast("请先登录 Backend Core");
      return;
    }

    const resourceId = ["proxy-node", "transit-relay"].includes(role) ? item?.resourceId || item?.raw?.id || null : null;
    const name = item?.name || item?.id || `${role}-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`;
    const body = {
      role,
      name,
      ttlSeconds: 3600,
      ...(resourceId ? { resourceId } : {}),
    };
    try {
      const result = await adminPost("/api/v1/bootstrap-tokens", body);
      const baseUrl = backendSettings?.nodeBackendUrl || getAdminApiSettings().baseUrl || window.location.origin;
      const command = roleInstallCommand({
        role,
        backendUrl: baseUrl,
        token: result.token,
        name,
      });
      setBootstrapResult({
        token: result.token,
        role,
        command,
        backendUrl: baseUrl,
        resourceName: item?.name || item?.id || "",
        expiresAt: isoText(result.record?.expiresAt),
      });
      showToast("Bootstrap Token 已生成");
    } catch (error) {
      showToast(`生成 Token 失败：${error.message}`);
    }
  }

  function handleSaveApiSettings(settings) {
    saveAdminApiSettings(settings);
    if (hasAdminApiToken()) {
      loadBackendData();
    } else {
      setApiStatus({ mode: "login", message: "连接设置已保存，请登录管理员账号" });
    }
  }

  async function handleResetSubscription(item) {
    const id = item?.raw?.id;
    if (!id) {
      showToast("请先登录 Backend Core");
      return;
    }
    const confirmed = window.confirm(`确认重置用户 ${item.name || item.id} 的订阅 Token？旧链接将立即失效。`);
    if (!confirmed) return;
    try {
      await adminPost(`/api/v1/admin/users/${id}/subscription-token`);
      showToast("订阅 Token 已重置，旧链接已失效");
      await loadBackendData({ silent: true });
    } catch (error) {
      showToast(`重置订阅 Token 失败：${error.message}`);
    }
  }

  async function handleSaveBackendSettings(patch) {
    try {
      await adminPatch("/api/v1/admin/settings", patch);
      showToast("系统设置已保存");
      await loadBackendData({ silent: true });
    } catch (error) {
      showToast(`保存设置失败：${error.message}`);
    }
  }

  if (!authReady && !demoModeEnabled) {
    return <LoginPage apiStatus={apiStatus} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <Sidebar activeSection={activeSection} onSelect={setActiveSection} />
      <section className="workspace">
        <TopBar apiStatus={apiStatus} adminUser={adminUser} onLogout={handleLogout} onRefresh={loadBackendData} />
        <MobileNav activeSection={activeSection} onSelect={setActiveSection} />
        <AppContent
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          showToast={showToast}
          setDrawerOpen={setDrawerOpen}
          resourceData={resourceData}
          apiStatus={apiStatus}
          onSaveApiSettings={handleSaveApiSettings}
          onSaveBackendSettings={handleSaveBackendSettings}
          onResetSubscription={handleResetSubscription}
          backendSettings={backendSettings}
          onCreate={openCreateEditor}
          onEdit={openEditEditor}
          onDelete={handleDeleteResource}
          onReload={() => loadBackendData()}
          onGenerateBootstrap={handleGenerateBootstrap}
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
      <BootstrapTokenDialog result={bootstrapResult} onClose={() => setBootstrapResult(null)} showToast={showToast} />
      {toast ? (
        <div className="toast" role="status">
          <IconBellRinging size={17} stroke={1.9} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
