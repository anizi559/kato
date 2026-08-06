import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PROTOCOLS, nowIso } from "../../../packages/shared/src/protocol.js";
import { compileDesiredState } from "./desired-state.js";
import { createHex, createId, createSecret, createUuid, createX25519KeyPair, hashPassword, sha256, verifyPassword } from "./security.js";
import { probeEndpoint } from "./health.js";

const RESOURCE_SPECS = Object.freeze({
  plans: { stateKey: "plans", idPrefix: "plan", label: "plan" },
  users: { stateKey: "users", idPrefix: "user", label: "user" },
  "proxy-nodes": { stateKey: "proxyNodes", idPrefix: "proxy_node", label: "proxy node" },
  "node-inbounds": { stateKey: "nodeInbounds", idPrefix: "inbound", label: "node inbound" },
  "transit-relays": { stateKey: "transitRelays", idPrefix: "relay", label: "transit relay" },
  "access-nodes": { stateKey: "accessNodes", idPrefix: "access", label: "access node" },
  "relay-rules": { stateKey: "relayRules", idPrefix: "relay_rule", label: "relay rule" }
});

function emptyState() {
  const now = nowIso();
  return {
    schemaVersion: 2,
    createdAt: now,
    configRevision: 1,
    configUpdatedAt: now,
    settings: {
      systemName: "Kato Control Plane",
      timezone: "Asia/Shanghai",
      defaultLanguage: "zh-CN",
      defaultTrafficUnit: "GiB",
      defaultSubscriptionIntervalSeconds: 3600,
      subscriptionTitle: "",
      subscriptionUserinfo: true,
      subscriptionBaseUrl: "",
      subscriptionPathPrefix: "go",
      agentOfflineSeconds: 180,
      alertWebhookUrl: "",
      telegramBotToken: "",
      telegramChatId: "",
      healthProbeIntervalSeconds: 60,
      healthProbeTimeoutMs: 3000
    },
    adminUsers: [],
    adminSessions: [],
    frontendTokens: [],
    bootstrapTokens: [],
    agents: [],
    plans: [],
    users: [],
    proxyNodes: [],
    nodeInbounds: [],
    transitRelays: [],
    accessNodes: [],
    relayRules: [],
    auditLogs: [],
    alerts: []
  };
}

export class JsonStore {
  constructor(path) {
    this.path = path;
    this.state = emptyState();
    this.saveQueue = Promise.resolve();
  }

  async load() {
    try {
      const raw = await readFile(this.path, "utf8");
      this.state = normalizeState(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.save();
    }
  }

  async save() {
    const nextSave = this.saveQueue.then(() => this.writeState(), () => this.writeState());
    this.saveQueue = nextSave.catch(() => {});
    return nextSave;
  }

  async writeState() {
    await mkdir(dirname(this.path), { recursive: true });
    const suffix = `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
    const tmpPath = `${this.path}.${suffix}.tmp`;
    await writeFile(tmpPath, JSON.stringify(this.state, null, 2));
    await rename(tmpPath, this.path);
  }

  async createBootstrapToken({ role, name, ttlSeconds = 900, resourceId = null }) {
    this.validateBootstrapResource(role, resourceId);
    const token = createSecret("boot");
    const record = {
      id: createId("btid"),
      tokenHash: sha256(token),
      role,
      name,
      resourceId,
      usedAt: null,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };
    this.state.bootstrapTokens.push(record);
    await this.save();
    return { token, record: withoutHash(record) };
  }

  async ensureAdminUser({ username, password }) {
    const normalizedUsername = requiredName(username, "admin username");
    const existing = this.state.adminUsers.find((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase());
    const now = nowIso();
    if (existing) {
      if (password) {
        existing.passwordHash = await hashPassword(password);
        existing.updatedAt = now;
      }
      await this.save();
      return publicAdminUser(existing);
    }
    const user = {
      id: createId("admin"),
      username: normalizedUsername,
      passwordHash: await hashPassword(requiredName(password, "admin password")),
      role: "owner",
      enabled: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    };
    this.state.adminUsers.push(user);
    this.recordAudit("admin_user.created", user.id, { username: user.username });
    await this.save();
    return publicAdminUser(user);
  }

  async createFrontendToken({ name = "panel-frontend" } = {}) {
    const token = createSecret("front");
    const record = {
      id: createId("front"),
      name: requiredName(name, "frontend token name"),
      tokenHash: sha256(token),
      createdAt: nowIso(),
      lastUsedAt: null,
      revokedAt: null
    };
    this.state.frontendTokens.push(record);
    this.recordAudit("frontend_token.created", record.id, { name: record.name });
    await this.save();
    return { token, record: publicFrontendToken(record) };
  }

  frontendTokenRequired() {
    return this.state.frontendTokens.some((token) => !token.revokedAt);
  }

  async validateFrontendToken(token) {
    if (!this.frontendTokenRequired()) {
      return true;
    }
    const tokenHash = sha256(token || "");
    const record = this.state.frontendTokens.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (!record) {
      return false;
    }
    record.lastUsedAt = nowIso();
    await this.save();
    return true;
  }

  async loginAdmin({ username, password }) {
    const user = this.state.adminUsers.find((item) => item.username.toLowerCase() === String(username || "").trim().toLowerCase());
    if (!user || !user.enabled || !(await verifyPassword(password || "", user.passwordHash))) {
      throw httpError("Invalid username or password", 401);
    }
    const token = createSecret("sess");
    const session = {
      id: createId("sess"),
      userId: user.id,
      tokenHash: sha256(token),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      revokedAt: null
    };
    this.state.adminSessions.push(session);
    user.lastLoginAt = nowIso();
    await this.save();
    return { token, user: publicAdminUser(user), expiresAt: session.expiresAt };
  }

  async changeAdminPassword({ userId, currentPassword, newPassword, keepSessionId = null }) {
    const user = this.state.adminUsers.find((item) => item.id === userId);
    if (!user || !user.enabled) {
      throw httpError("Admin user not found", 404);
    }
    if (!(await verifyPassword(currentPassword || "", user.passwordHash))) {
      throw httpError("当前密码不正确", 401);
    }
    validateAdminPassword(newPassword);
    user.passwordHash = await hashPassword(newPassword);
    user.updatedAt = nowIso();
    revokeAdminSessions(this.state.adminSessions, user.id, keepSessionId);
    this.recordAudit("admin_user.password_changed", user.id, { username: user.username });
    await this.save();
    return publicAdminUser(user);
  }

  async resetAdminPassword({ username, newPassword }) {
    const user = this.state.adminUsers.find(
      (item) => item.username.toLowerCase() === String(username || "").trim().toLowerCase()
    );
    if (!user) {
      throw httpError("Admin user not found", 404);
    }
    validateAdminPassword(newPassword);
    user.passwordHash = await hashPassword(newPassword);
    user.updatedAt = nowIso();
    revokeAdminSessions(this.state.adminSessions, user.id, null);
    this.recordAudit("admin_user.password_reset", user.id, { username: user.username });
    await this.save();
    return publicAdminUser(user);
  }

  findAdminSession(token) {
    const tokenHash = sha256(token || "");
    const session = this.state.adminSessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }
    const user = this.state.adminUsers.find((item) => item.id === session.userId && item.enabled);
    return user ? { session, user: publicAdminUser(user) } : null;
  }

  async revokeAdminSession(token) {
    const tokenHash = sha256(token || "");
    const session = this.state.adminSessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (session) {
      session.revokedAt = nowIso();
      await this.save();
    }
    return { ok: true };
  }

  async consumeBootstrapToken(token) {
    const tokenHash = sha256(token);
    const record = this.state.bootstrapTokens.find((item) => item.tokenHash === tokenHash);
    if (!record) {
      throw httpError("Invalid bootstrap token", 401);
    }
    if (record.usedAt) {
      throw httpError("Bootstrap token already used", 409);
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw httpError("Bootstrap token expired", 401);
    }
    record.usedAt = nowIso();
    await this.save();
    return record;
  }

  async registerAgent({ role, name, version, hostname, capabilities, resourceId = null }) {
    const agentSecret = createSecret("agent");
    const agent = {
      id: createId("agent"),
      role,
      name,
      version,
      hostname,
      capabilities: capabilities ?? {},
      resourceId,
      secretHash: sha256(agentSecret),
      status: "registered",
      createdAt: nowIso(),
      lastSeenAt: null,
      lastError: null
    };
    this.state.agents.push(agent);
    this.linkAgentToManagedResource(agent, resourceId);
    await this.save();
    return { agent, agentSecret };
  }

  findAgent(agentId) {
    return this.state.agents.find((agent) => agent.id === agentId);
  }

  findAgentBySecret(secret) {
    const secretHash = sha256(secret || "");
    return this.state.agents.find((agent) => agent.secretHash === secretHash) || null;
  }

  findDesiredState(agentId) {
    const agent = this.findAgent(agentId);
    return agent ? compileDesiredState(agent, this.state) : null;
  }

  async updateHeartbeat(agentId, actualState) {
    const agent = this.findAgent(agentId);
    if (!agent) {
      throw httpError("Agent not found", 404);
    }
    const wasOffline = agent.status === "offline";
    agent.status = "online";
    agent.lastSeenAt = nowIso();
    agent.actualState = actualState ?? {};
    if (wasOffline) {
      this.resolveAlerts("agent", agent.id, "agent.offline");
    }
    await this.save();
    return agent;
  }

  async recordConfigApplied(agentId, report) {
    const agent = this.findAgent(agentId);
    if (!agent) {
      throw httpError("Agent not found", 404);
    }
    agent.lastConfigReport = {
      ...report,
      reportedAt: nowIso()
    };
    await this.save();
    return agent.lastConfigReport;
  }

  async recordTrafficUsage(agentId, { reports = [], reportedAt } = {}) {
    const agent = this.findAgent(agentId);
    if (!agent) {
      throw httpError("Agent not found", 404);
    }
    const now = nowIso();
    let addedBytes = 0;
    const userIds = [];
    for (const report of Array.isArray(reports) ? reports : []) {
      const user = this.state.users.find((item) => item.id === report?.userId);
      if (!user) {
        continue;
      }
      const plan = user.planId ? this.state.plans.find((item) => item.id === user.planId) : null;
      const uploadBytes = Math.max(0, Number(report?.uploadBytes) || 0);
      const downloadBytes = Math.max(0, Number(report?.downloadBytes) || 0);
      if (uploadBytes + downloadBytes <= 0) {
        continue;
      }
      if (shouldResetUsage(user, plan, now)) {
        user.usedTrafficBytes = 0;
        user.lastUsageResetAt = now;
      }
      user.usedTrafficBytes = (user.usedTrafficBytes || 0) + uploadBytes + downloadBytes;
      user.lastProxyUseAt = now;
      addedBytes += uploadBytes + downloadBytes;
      userIds.push(user.id);
    }
    agent.lastTrafficReport = {
      reports,
      reportedAt: reportedAt || now,
      receivedAt: now
    };
    await this.save();
    return { ok: true, addedBytes, userIds };
  }

  listAgents() {
    return this.state.agents.map(publicAgent);
  }

  listAlerts({ status = null } = {}) {
    const alerts = this.state.alerts
      .filter((alert) => !status || alert.status === status)
      .map(clone)
      .reverse();
    return alerts.slice(0, 500);
  }

  async resolveAlert(alertId) {
    const alert = this.state.alerts.find((item) => item.id === alertId);
    if (!alert) {
      throw httpError("Alert not found", 404);
    }
    if (alert.status !== "resolved") {
      alert.status = "resolved";
      alert.resolvedAt = nowIso();
      await this.save();
    }
    return clone(alert);
  }

  resolveAlerts(resourceType, resourceId, type = null) {
    let changed = false;
    for (const alert of this.state.alerts) {
      if (alert.status !== "open") {
        continue;
      }
      if (alert.resourceType !== resourceType || alert.resourceId !== resourceId) {
        continue;
      }
      if (type && alert.type !== type) {
        continue;
      }
      alert.status = "resolved";
      alert.resolvedAt = nowIso();
      changed = true;
    }
    return changed;
  }

  recordAlert({ type, severity = "warning", title, message, resourceType = null, resourceId = null }) {
    const open = this.state.alerts.find(
      (alert) => alert.status === "open" && alert.type === type && alert.resourceType === resourceType && alert.resourceId === resourceId
    );
    if (open) {
      return open;
    }
    const alert = {
      id: createId("alert"),
      type,
      severity,
      title,
      message,
      resourceType,
      resourceId,
      status: "open",
      createdAt: nowIso(),
      resolvedAt: null
    };
    this.state.alerts.push(alert);
    if (this.state.alerts.length > 2000) {
      this.state.alerts.splice(0, this.state.alerts.length - 2000);
    }
    return alert;
  }

  async sweepAlerts() {
    const now = nowIso();
    const nowMs = Date.now();
    const offlineMs = (Number(this.state.settings.agentOfflineSeconds) || 180) * 1000;
    let changed = false;
    const createdAlerts = [];

    for (const agent of this.state.agents) {
      const lastSeenMs = agent.lastSeenAt ? Date.parse(agent.lastSeenAt) : 0;
      if (agent.status === "online" && (!lastSeenMs || nowMs - lastSeenMs > offlineMs)) {
        agent.status = "offline";
        changed = true;
        const alert = this.recordAlert({
          type: "agent.offline",
          severity: "danger",
          title: `Agent 离线：${agent.name}`,
          message: `${agent.name}（${agent.role}）超过 ${Math.round(offlineMs / 1000)} 秒没有心跳`,
          resourceType: "agent",
          resourceId: agent.id
        });
        if (!createdAlerts.includes(alert)) {
          createdAlerts.push(alert);
        }
      }
      const runtimeError = agent.actualState?.runtime?.error;
      const configFailed = agent.lastConfigReport?.status && agent.lastConfigReport.status !== "applied";
      if (runtimeError || configFailed) {
        changed = true;
        const alert = this.recordAlert({
          type: "agent.error",
          severity: "warning",
          title: `Agent 运行异常：${agent.name}`,
          message: runtimeError || `配置应用失败：${agent.lastConfigReport.status}`,
          resourceType: "agent",
          resourceId: agent.id
        });
        if (!createdAlerts.includes(alert)) {
          createdAlerts.push(alert);
        }
      }
    }

    if (changed) {
      await this.save();
    }
    return { ok: true, changed, createdAlerts };
  }

  async runHealthProbes() {
    const timeoutMs = Number(this.state.settings.healthProbeTimeoutMs) || 3000;
    const targets = [];
    const now = nowIso();

    for (const accessNode of this.state.accessNodes) {
      if (!accessNode.enabled) {
        continue;
      }
      const host = accessNode.host;
      if (!host || host === "0.0.0.0" || host === "::") {
        continue;
      }
      targets.push({
        kind: "access-node",
        resource: accessNode,
        host,
        port: accessNode.port,
        protocol: accessNode.transport || (accessNode.protocol === PROTOCOLS.HYSTERIA2 ? "udp" : "tcp")
      });
    }

    for (const rule of this.state.relayRules) {
      if (!rule.enabled) {
        continue;
      }
      const relay = this.state.transitRelays.find((item) => item.id === rule.relayId);
      const host = relay?.publicHost || relay?.publicIp || rule.entry?.host;
      if (!host || host === "0.0.0.0" || host === "::") {
        continue;
      }
      targets.push({
        kind: "relay-rule",
        resource: rule,
        host,
        port: rule.entry?.port,
        protocol: rule.transport || "tcp"
      });
    }

    let dirty = false;
    const createdAlerts = [];
    for (const target of targets) {
      const probe = await probeEndpoint(target.host, target.port, {
        protocol: target.protocol,
        timeoutMs
      });
      const previous = target.resource.health?.status;
      target.resource.health = {
        ...probe,
        protocol: target.protocol,
        probedAt: now
      };
      target.resource.updatedAt = now;
      if (previous !== probe.status) {
        dirty = true;
      }

      if (probe.status === "failed") {
        const alert = this.recordAlert({
          type: "probe.failed",
          severity: target.protocol === "udp" ? "warning" : "danger",
          title: `${target.kind === "relay-rule" ? "转发规则" : "访问节点"}探测失败：${target.resource.name}`,
          message: `${target.host}:${target.port} 探测失败：${probe.error || "unreachable"}`,
          resourceType: target.kind,
          resourceId: target.resource.id
        });
        if (!createdAlerts.includes(alert)) {
          createdAlerts.push(alert);
        }
      } else if (this.resolveAlerts(target.kind, target.resource.id, "probe.failed")) {
        dirty = true;
      }
    }

    if (dirty) {
      await this.save();
    }
    return { ok: true, probed: targets.length, changed: dirty, createdAlerts };
  }

  listAuditLogs({ limit = 200 } = {}) {
    return this.state.auditLogs.slice(-Math.max(1, Math.min(limit, 500))).map(clone).reverse();
  }

  trafficSummary() {
    const users = this.state.users
      .map((user) => ({
        id: user.id,
        name: user.name,
        usedTrafficBytes: user.usedTrafficBytes || 0,
        trafficLimitBytes: user.trafficLimitBytes || null,
        lastProxyUseAt: user.lastProxyUseAt || null
      }))
      .sort((left, right) => right.usedTrafficBytes - left.usedTrafficBytes)
      .slice(0, 200);
    const totalBytes = users.reduce((sum, user) => sum + user.usedTrafficBytes, 0);
    return {
      totalBytes,
      userCount: users.length,
      users
    };
  }

  summary() {
    return {
      version: this.state.configRevision,
      configUpdatedAt: this.state.configUpdatedAt,
      counts: {
        agents: this.state.agents.length,
        plans: this.state.plans.length,
        users: this.state.users.length,
        proxyNodes: this.state.proxyNodes.length,
        nodeInbounds: this.state.nodeInbounds.length,
        transitRelays: this.state.transitRelays.length,
        accessNodes: this.state.accessNodes.length,
        relayRules: this.state.relayRules.length
      }
    };
  }

  listResources(collection) {
    const spec = resourceSpec(collection);
    return clone(this.state[spec.stateKey]);
  }

  getSettings() {
    return clone(this.state.settings);
  }

  async updateSettings(patch = {}) {
    const allowedKeys = new Set([
      "systemName",
      "timezone",
      "defaultLanguage",
      "defaultTrafficUnit",
      "defaultSubscriptionIntervalSeconds",
      "subscriptionTitle",
      "subscriptionUserinfo",
      "subscriptionBaseUrl",
      "subscriptionPathPrefix",
      "agentOfflineSeconds",
      "alertWebhookUrl",
      "telegramBotToken",
      "telegramChatId",
      "healthProbeIntervalSeconds",
      "healthProbeTimeoutMs"
    ]);
    for (const [key, value] of Object.entries(patch)) {
      if (!allowedKeys.has(key)) {
        throw httpError(`Unsupported setting: ${key}`, 400);
      }
      if (value !== undefined) {
        this.state.settings[key] = value;
      }
    }
    this.state.settings.defaultSubscriptionIntervalSeconds = clampInterval(
      this.state.settings.defaultSubscriptionIntervalSeconds
    );
    if (typeof this.state.settings.subscriptionUserinfo !== "boolean") {
      this.state.settings.subscriptionUserinfo = this.state.settings.subscriptionUserinfo !== false;
    }
    this.recordAudit("settings.updated", null, { keys: Object.keys(patch) });
    await this.save();
    return clone(this.state.settings);
  }

  async resetUserSubscriptionToken(userId) {
    const user = this.requireExisting("users", userId);
    user.subscriptionToken = createSecret("sub");
    user.updatedAt = nowIso();
    this.recordAudit("user.subscription_token_reset", user.id, { name: user.name });
    await this.save();
    return clone(user);
  }

  getResource(collection, id) {
    const spec = resourceSpec(collection);
    const record = this.state[spec.stateKey].find((item) => item.id === id);
    return record ? clone(record) : null;
  }

  async createResource(collection, input = {}) {
    const result = this.createResourceRecord(collection, input);
    this.touchConfig();
    this.recordAudit(`${collection}.created`, result.id || result.accessNode?.id, { collection });
    await this.save();
    return clone(result);
  }

  async updateResource(collection, id, patch = {}) {
    const record = this.requireResource(collection, id);
    const normalizedPatch = this.normalizeResourcePatch(collection, record, patch);
    applyPatch(record, normalizedPatch);
    record.updatedAt = nowIso();

    if (collection === "access-nodes") {
      this.syncRelayRuleFromAccessNode(record);
    }

    this.touchConfig();
    this.recordAudit(`${collection}.updated`, id, { collection });
    await this.save();
    return clone(record);
  }

  normalizeResourcePatch(collection, record, patch) {
    const normalized = { ...patch };

    if (Object.hasOwn(normalized, "name")) {
      normalized.name = requiredName(normalized.name, `${resourceSpec(collection).label} name`);
      this.assertNameAvailable(collection, normalized.name, record.id);
    }

    if (["node-inbounds", "access-nodes"].includes(collection) && Object.hasOwn(normalized, "port")) {
      normalized.port = requiredPort(normalized.port, `${resourceSpec(collection).label} port`);
    }

    if (["node-inbounds", "access-nodes", "relay-rules"].includes(collection) && Object.hasOwn(normalized, "transport")) {
      normalized.transport = normalizeTransport(normalized.transport, record.transport);
    }

    if (collection === "relay-rules") {
      if (normalized.entry?.port !== undefined) {
        normalized.entry = {
          ...record.entry,
          ...normalized.entry,
          port: requiredPort(normalized.entry.port, "relay rule entry port")
        };
      }
      if (normalized.target?.port !== undefined) {
        normalized.target = {
          ...record.target,
          ...normalized.target,
          port: requiredPort(normalized.target.port, "relay rule target port")
        };
      }
    }

    return normalized;
  }

  async deleteResource(collection, id, options = {}) {
    const record = this.requireResource(collection, id);
    this.deleteResourceRecord(collection, id, options);
    this.touchConfig();
    this.recordAudit(`${collection}.deleted`, id, { collection, name: record.name });
    await this.save();
    return { ok: true, deleted: clone(record) };
  }

  createResourceRecord(collection, input) {
    if (collection === "plans") {
      return this.createPlanRecord(input);
    }
    if (collection === "users") {
      return this.createUserRecord(input);
    }
    if (collection === "proxy-nodes") {
      return this.createProxyNodeRecord(input);
    }
    if (collection === "node-inbounds") {
      return this.createNodeInboundRecord(input);
    }
    if (collection === "transit-relays") {
      return this.createTransitRelayRecord(input);
    }
    if (collection === "access-nodes") {
      if (input.type === "relay") {
        return this.createRelayAccessNodeRecord(input);
      }
      return this.createDirectAccessNodeRecord(input);
    }
    if (collection === "relay-rules") {
      return this.createRelayRuleRecord(input);
    }
    throw httpError(`Unsupported resource collection: ${collection}`, 404);
  }

  createPlanRecord(input) {
    const name = requiredName(input.name || "Default Plan", "plan name");
    this.assertNameAvailable("plans", name);
    const record = withTimestamps({
      id: createId("plan"),
      name,
      enabled: input.enabled ?? true,
      trafficLimitBytes: input.trafficLimitBytes ?? null,
      durationDays: input.durationDays ?? null,
      allowedNodeGroups: asArray(input.allowedNodeGroups),
      allowedRelayGroups: asArray(input.allowedRelayGroups),
      allowedRegions: asArray(input.allowedRegions),
      defaultSubscriptionFormat: input.defaultSubscriptionFormat || "auto",
      nodeSortPolicy: input.nodeSortPolicy || "manual",
      resetPolicy: input.resetPolicy || "none",
      speedLimitMbps: input.speedLimitMbps ?? null,
      hysteria2: {
        upMbps: input.hysteria2?.upMbps ?? 100,
        downMbps: input.hysteria2?.downMbps ?? 100
      },
      allowUdp: input.allowUdp ?? true,
      tags: asArray(input.tags)
    });
    this.state.plans.push(record);
    return record;
  }

  createUserRecord(input) {
    const plan = input.planId ? this.requireExisting("plans", input.planId) : null;
    const name = requiredName(input.name || input.email || "New User", "user name");
    this.assertNameAvailable("users", name);
    const record = withTimestamps({
      id: createId("user"),
      name,
      email: input.email || null,
      remark: input.remark || "",
      enabled: input.enabled ?? true,
      tags: asArray(input.tags),
      groups: asArray(input.groups),
      planId: input.planId || null,
      subscriptionToken: input.subscriptionToken || createSecret("sub"),
      expiresAt: input.expiresAt || expiresFromPlan(plan),
      trafficLimitBytes: input.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null,
      usedTrafficBytes: input.usedTrafficBytes ?? 0,
      lastUsageResetAt: null,
      access: {
        nodeGroups: asArray(input.access?.nodeGroups),
        relayGroups: asArray(input.access?.relayGroups),
        protocols: asArray(input.access?.protocols),
        regions: asArray(input.access?.regions)
      },
      credentials: {
        vlessUuid: input.credentials?.vlessUuid || createUuid(),
        vlessFlow: input.credentials?.vlessFlow || "xtls-rprx-vision",
        hysteria2Password: input.credentials?.hysteria2Password || createSecret("hy2"),
        anytlsPassword: input.credentials?.anytlsPassword || createSecret("anytls")
      },
      limits: {
        deviceLimit: input.limits?.deviceLimit ?? null,
        ipLimit: input.limits?.ipLimit ?? null,
        rateMbps: input.limits?.rateMbps ?? plan?.speedLimitMbps ?? null,
        tcpConnectionLimit: input.limits?.tcpConnectionLimit ?? null
      },
      lastSubscriptionAccessAt: null,
      lastProxyUseAt: null,
      lastClient: null,
      lastSource: null
    });
    this.state.users.push(record);
    return record;
  }

  createProxyNodeRecord(input) {
    const name = requiredName(input.name || "Proxy Node", "proxy node name");
    this.assertNameAvailable("proxy-nodes", name);
    const record = withTimestamps({
      id: createId("proxy_node"),
      name,
      enabled: input.enabled ?? true,
      region: input.region || "",
      provider: input.provider || "",
      asn: input.asn || null,
      publicHost: input.publicHost || input.entryDomain || input.publicIp || "",
      publicIp: input.publicIp || "",
      privateIp: input.privateIp || "",
      entryDomain: input.entryDomain || "",
      tags: asArray(input.tags),
      groups: asArray(input.groups),
      capabilities: asArray(input.capabilities),
      agentId: input.agentId || null,
      notes: input.notes || ""
    });
    this.state.proxyNodes.push(record);
    return record;
  }

  createNodeInboundRecord(input) {
    const proxyNode = this.requireExisting("proxy-nodes", input.proxyNodeId);
    const protocol = normalizeInboundProtocol(input.protocol);
    const transport = normalizeTransport(input.transport, protocol === PROTOCOLS.HYSTERIA2 ? "udp" : "tcp");
    const name = requiredName(input.name || `${proxyNode.name} ${protocol}`, "node inbound name");
    this.assertNameAvailable("node-inbounds", name);
    const record = withTimestamps({
      id: createId("inbound"),
      proxyNodeId: proxyNode.id,
      name,
      enabled: input.enabled ?? true,
      protocol,
      listen: input.listen || "0.0.0.0",
      port: requiredPort(input.port, "node inbound port"),
      transport,
      tags: asArray(input.tags),
      groups: asArray(input.groups),
      config: defaultInboundConfig(protocol, input.config || {}, proxyNode)
    });
    this.state.nodeInbounds.push(record);
    if (input.createDirectAccessNode !== false) {
      this.createDirectAccessNodeRecord({
        name: input.directAccessName || record.name,
        inboundId: record.id,
        tags: record.tags,
        groups: record.groups
      });
    }
    return record;
  }

  createTransitRelayRecord(input) {
    const name = requiredName(input.name || "Transit Relay", "transit relay name");
    this.assertNameAvailable("transit-relays", name);
    const record = withTimestamps({
      id: createId("relay"),
      name,
      enabled: input.enabled ?? true,
      engine: input.engine || PROTOCOLS.REALM,
      region: input.region || "",
      provider: input.provider || "",
      asn: input.asn || null,
      publicHost: input.publicHost || input.publicIp || "",
      publicIp: input.publicIp || "",
      privateIp: input.privateIp || "",
      tags: asArray(input.tags),
      groups: asArray(input.groups),
      agentId: input.agentId || null,
      notes: input.notes || ""
    });
    this.state.transitRelays.push(record);
    return record;
  }

  createDirectAccessNodeRecord(input) {
    const inbound = this.requireExisting("node-inbounds", input.inboundId);
    const proxyNode = this.requireExisting("proxy-nodes", inbound.proxyNodeId);
    const name = requiredName(input.name || inbound.name, "access node name");
    this.assertNameAvailable("access-nodes", name);
    const record = withTimestamps({
      id: createId("access"),
      name,
      type: "direct",
      enabled: input.enabled ?? true,
      protocol: inbound.protocol,
      inboundId: inbound.id,
      proxyNodeId: proxyNode.id,
      transitRelayId: null,
      relayRuleId: null,
      host: input.host || proxyNode.entryDomain || proxyNode.publicHost || proxyNode.publicIp,
      port: input.port ?? inbound.port,
      transport: normalizeTransport(input.transport, inbound.transport),
      tags: asArray(input.tags),
      groups: asArray(input.groups)
    });
    this.state.accessNodes.push(record);
    return record;
  }

  createRelayAccessNodeRecord(input) {
    const inbound = this.requireExisting("node-inbounds", input.inboundId);
    const proxyNode = this.requireExisting("proxy-nodes", inbound.proxyNodeId);
    const relay = this.requireExisting("transit-relays", input.transitRelayId || input.relayId);
    const entryPort = requiredPort(input.entryPort ?? input.port, "relay entry port");
    const name = requiredName(input.name || `${relay.name} -> ${inbound.name}`, "access node name");
    this.assertNameAvailable("access-nodes", name);
    const accessNode = withTimestamps({
      id: createId("access"),
      name,
      type: "relay",
      enabled: input.enabled ?? true,
      protocol: inbound.protocol,
      inboundId: inbound.id,
      proxyNodeId: proxyNode.id,
      transitRelayId: relay.id,
      relayRuleId: null,
      host: input.entryHost || relay.publicHost || relay.publicIp,
      port: entryPort,
      transport: normalizeTransport(input.transport, inbound.transport),
      tags: asArray(input.tags),
      groups: asArray(input.groups)
    });
    this.state.accessNodes.push(accessNode);

    const relayRule = this.createRelayRuleRecord({
      name: input.relayRuleName || accessNode.name,
      enabled: accessNode.enabled,
      relayId: relay.id,
      accessNodeId: accessNode.id,
      inboundId: inbound.id,
      proxyNodeId: proxyNode.id,
      entry: {
        host: input.listen || "0.0.0.0",
        port: entryPort
      },
      target: {
        host: input.targetHost || proxyNode.privateIp || proxyNode.publicHost || proxyNode.publicIp,
        port: input.targetPort ?? inbound.port
      },
      transport: accessNode.transport,
      tags: accessNode.tags
    });
    accessNode.relayRuleId = relayRule.id;
    accessNode.updatedAt = nowIso();
    return { accessNode, relayRule };
  }

  createRelayRuleRecord(input) {
    const relay = this.requireExisting("transit-relays", input.relayId);
    const inbound = this.requireExisting("node-inbounds", input.inboundId);
    const proxyNode = this.requireExisting("proxy-nodes", input.proxyNodeId || inbound.proxyNodeId);
    const entry = input.entry || {};
    const target = input.target || {};
    const name = requiredName(input.name || `${relay.name} ${entry.port || ""}`, "relay rule name");
    this.assertNameAvailable("relay-rules", name);
    const record = withTimestamps({
      id: createId("relay_rule"),
      name,
      enabled: input.enabled ?? true,
      engine: input.engine || relay.engine || PROTOCOLS.REALM,
      relayId: relay.id,
      accessNodeId: input.accessNodeId || null,
      inboundId: inbound.id,
      proxyNodeId: proxyNode.id,
      entry: {
        host: entry.host || "0.0.0.0",
        port: requiredPort(entry.port, "relay rule entry port")
      },
      target: {
        host: target.host || proxyNode.privateIp || proxyNode.publicHost || proxyNode.publicIp,
        port: requiredPort(target.port ?? inbound.port, "relay rule target port")
      },
      transport: normalizeTransport(input.transport, inbound.transport),
      tags: asArray(input.tags)
    });
    this.state.relayRules.push(record);
    return record;
  }

  deleteResourceRecord(collection, id, options) {
    const spec = resourceSpec(collection);
    removeWhere(this.state[spec.stateKey], (item) => item.id === id);

    if (collection === "proxy-nodes") {
      const inboundIds = this.state.nodeInbounds.filter((item) => item.proxyNodeId === id).map((item) => item.id);
      removeWhere(this.state.nodeInbounds, (item) => item.proxyNodeId === id);
      removeWhere(this.state.accessNodes, (item) => item.proxyNodeId === id || inboundIds.includes(item.inboundId));
      removeWhere(this.state.relayRules, (item) => item.proxyNodeId === id || inboundIds.includes(item.inboundId));
    }

    if (collection === "node-inbounds") {
      const accessIds = this.state.accessNodes.filter((item) => item.inboundId === id).map((item) => item.id);
      removeWhere(this.state.accessNodes, (item) => item.inboundId === id);
      removeWhere(this.state.relayRules, (item) => item.inboundId === id || accessIds.includes(item.accessNodeId));
    }

    if (collection === "transit-relays") {
      const accessIds = this.state.accessNodes.filter((item) => item.transitRelayId === id).map((item) => item.id);
      removeWhere(this.state.accessNodes, (item) => item.transitRelayId === id);
      removeWhere(this.state.relayRules, (item) => item.relayId === id || accessIds.includes(item.accessNodeId));
    }

    if (collection === "access-nodes" && options.deleteRelayRule !== false) {
      removeWhere(this.state.relayRules, (item) => item.accessNodeId === id);
    }

    if (collection === "relay-rules") {
      const accessNode = this.state.accessNodes.find((item) => item.relayRuleId === id);
      if (accessNode) {
        accessNode.relayRuleId = null;
        accessNode.health = {
          status: "broken",
          reason: "linked relay rule deleted",
          updatedAt: nowIso()
        };
        accessNode.updatedAt = nowIso();
      }
    }
  }

  syncRelayRuleFromAccessNode(accessNode) {
    if (accessNode.type !== "relay" || !accessNode.relayRuleId) {
      return;
    }
    const rule = this.state.relayRules.find((item) => item.id === accessNode.relayRuleId);
    if (!rule) {
      return;
    }
    rule.enabled = accessNode.enabled;
    rule.entry.port = accessNode.port;
    rule.transport = accessNode.transport;
    rule.updatedAt = nowIso();
  }

  validateBootstrapResource(role, resourceId) {
    if (!resourceId) {
      return;
    }
    if (role === "proxy-node") {
      this.requireExisting("proxy-nodes", resourceId);
    }
    if (role === "transit-relay") {
      this.requireExisting("transit-relays", resourceId);
    }
  }

  linkAgentToManagedResource(agent, resourceId) {
    if (agent.role === "proxy-node") {
      const node =
        (resourceId && this.state.proxyNodes.find((item) => item.id === resourceId)) ||
        this.state.proxyNodes.find((item) => item.name === agent.name);
      if (node) {
        node.agentId = agent.id;
        node.updatedAt = nowIso();
      }
    }

    if (agent.role === "transit-relay") {
      const relay =
        (resourceId && this.state.transitRelays.find((item) => item.id === resourceId)) ||
        this.state.transitRelays.find((item) => item.name === agent.name);
      if (relay) {
        relay.agentId = agent.id;
        relay.updatedAt = nowIso();
      }
    }
  }

  requireResource(collection, id) {
    return this.requireExisting(collection, id);
  }

  requireExisting(collection, id) {
    const spec = resourceSpec(collection);
    const record = this.state[spec.stateKey].find((item) => item.id === id);
    if (!record) {
      throw httpError(`${spec.label} not found`, 404);
    }
    return record;
  }

  assertNameAvailable(collection, name, ignoreId = null) {
    const spec = resourceSpec(collection);
    const normalizedName = requiredName(name, `${spec.label} name`).toLowerCase();
    const duplicated = this.state[spec.stateKey].find((item) => item.id !== ignoreId && String(item.name || "").toLowerCase() === normalizedName);
    if (duplicated) {
      throw httpError(`${spec.label} name already exists`, 409);
    }
  }

  touchConfig() {
    this.state.configRevision = (this.state.configRevision || 1) + 1;
    this.state.configUpdatedAt = nowIso();
  }

  recordAudit(action, resourceId, details = {}) {
    this.state.auditLogs.push({
      id: createId("audit"),
      action,
      resourceId,
      details,
      createdAt: nowIso()
    });
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs.splice(0, this.state.auditLogs.length - 1000);
    }
  }
}

function normalizeState(rawState) {
  const base = emptyState();
  const state = { ...base, ...rawState };
  state.settings = { ...base.settings, ...(rawState.settings || {}) };
  for (const spec of Object.values(RESOURCE_SPECS)) {
    state[spec.stateKey] = Array.isArray(state[spec.stateKey]) ? state[spec.stateKey] : [];
  }
  for (const user of state.users) {
    if (user.lastUsageResetAt === undefined) {
      user.lastUsageResetAt = null;
    }
    if (!user.access) {
      user.access = { nodeGroups: [], relayGroups: [], protocols: [], regions: [] };
    }
    if (!Array.isArray(user.access.regions)) {
      user.access.regions = [];
    }
    if (!Array.isArray(user.access.protocols)) {
      user.access.protocols = [];
    }
  }
  state.bootstrapTokens = Array.isArray(state.bootstrapTokens) ? state.bootstrapTokens : [];
  state.adminUsers = Array.isArray(state.adminUsers) ? state.adminUsers : [];
  state.adminSessions = Array.isArray(state.adminSessions) ? state.adminSessions : [];
  state.frontendTokens = Array.isArray(state.frontendTokens) ? state.frontendTokens : [];
  state.agents = Array.isArray(state.agents) ? state.agents : [];
  state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  state.alerts = Array.isArray(state.alerts) ? state.alerts : [];
  state.configRevision = state.configRevision || 1;
  state.configUpdatedAt = state.configUpdatedAt || state.createdAt || nowIso();
  state.schemaVersion = 2;
  return state;
}

function resourceSpec(collection) {
  const spec = RESOURCE_SPECS[collection];
  if (!spec) {
    throw httpError(`Unsupported resource collection: ${collection}`, 404);
  }
  return spec;
}

function applyPatch(record, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (["id", "createdAt", "updatedAt", "secretHash"].includes(key)) {
      continue;
    }
    if (value !== undefined) {
      record[key] = value;
    }
  }
}

function defaultInboundConfig(protocol, input, proxyNode) {
  if (protocol === PROTOCOLS.VLESS_REALITY) {
    const keyPair = createX25519KeyPair();
    return {
      reality: {
        publicKey: input.reality?.publicKey || input.publicKey || keyPair.publicKey,
        privateKey: input.reality?.privateKey || input.privateKey || keyPair.privateKey,
        shortIds: asArray(input.reality?.shortIds || input.shortIds || [createHex(8)]),
        serverNames: asArray(input.reality?.serverNames || input.serverNames || ["www.microsoft.com"]),
        dest: input.reality?.dest || input.dest || "www.microsoft.com:443",
        spiderX: input.reality?.spiderX || input.spiderX || "/"
      },
      flow: input.flow || "xtls-rprx-vision",
      network: "tcp"
    };
  }

  if (protocol === PROTOCOLS.HYSTERIA2) {
    return {
      tls: {
        certRef: input.tls?.certRef || input.certRef || null,
        sni: input.tls?.sni || input.sni || proxyNode.entryDomain || proxyNode.publicHost || null
      },
      obfs: {
        enabled: input.obfs?.enabled ?? input.obfsEnabled ?? true,
        type: input.obfs?.type || "salamander",
        password: input.obfs?.password || input.obfsPassword || createSecret("hy2_obfs")
      },
      trafficStats: {
        enabled: input.trafficStats?.enabled ?? true,
        listen: input.trafficStats?.listen || null,
        secret: input.trafficStats?.secret || createSecret("tstats")
      },
      bandwidth: {
        upMbps: input.bandwidth?.upMbps ?? input.upMbps ?? 100,
        downMbps: input.bandwidth?.downMbps ?? input.downMbps ?? 100
      },
      alpn: asArray(input.alpn || ["h3"])
    };
  }

  if (protocol === PROTOCOLS.ANYTLS) {
    return {
      tls: {
        certPath: input.tls?.certPath || input.tls?.certificatePath || input.certPath || null,
        keyPath: input.tls?.keyPath || input.keyPath || null,
        sni: input.tls?.sni || input.sni || proxyNode.entryDomain || proxyNode.publicHost || null
      },
      network: "tcp"
    };
  }

  throw httpError(`Unsupported inbound protocol: ${protocol}`, 400);
}

function normalizeInboundProtocol(protocol) {
  if (![PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2, PROTOCOLS.ANYTLS].includes(protocol)) {
    throw httpError(`Unsupported inbound protocol: ${protocol}`, 400);
  }
  return protocol;
}

function normalizeTransport(value, fallback = "tcp") {
  const transport = String(value || fallback).toLowerCase();
  if (!["tcp", "udp"].includes(transport)) {
    throw httpError(`Unsupported transport: ${transport}`, 400);
  }
  return transport;
}

function requiredPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw httpError(`Invalid ${label}`, 400);
  }
  return port;
}

function requiredName(value, label) {
  const name = String(value || "").trim();
  if (!name) {
    throw httpError(`Missing ${label}`, 400);
  }
  return name;
}

function expiresFromPlan(plan) {
  if (!plan?.durationDays) {
    return null;
  }
  return new Date(Date.now() + Number(plan.durationDays) * 86400 * 1000).toISOString();
}

function clampInterval(value) {
  const interval = Number(value);
  if (!Number.isInteger(interval) || interval < 60) {
    return 3600;
  }
  return Math.min(interval, 7 * 86400);
}

function shouldResetUsage(user, plan, nowIso) {
  const policy = plan?.resetPolicy || "none";
  if (policy === "none") {
    return false;
  }
  if (!user.lastUsageResetAt) {
    return true;
  }
  const elapsedMs = Date.parse(nowIso) - Date.parse(user.lastUsageResetAt);
  if (policy === "daily") {
    return elapsedMs >= 24 * 3600 * 1000;
  }
  if (policy === "monthly") {
    return elapsedMs >= 30 * 24 * 3600 * 1000;
  }
  return false;
}

function validateAdminPassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    throw httpError("新密码长度不能少于 8 位", 400);
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw httpError("新密码必须同时包含字母和数字", 400);
  }
  if (/(.)\1{7,}/.test(password)) {
    throw httpError("新密码不能是重复字符", 400);
  }
}

function revokeAdminSessions(sessions, userId, keepSessionId) {
  const now = nowIso();
  for (const session of sessions) {
    if (session.userId !== userId || session.revokedAt) {
      continue;
    }
    if (keepSessionId && session.id === keepSessionId) {
      continue;
    }
    session.revokedAt = now;
  }
}

function withTimestamps(record) {
  const now = nowIso();
  return {
    ...record,
    createdAt: now,
    updatedAt: now
  };
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function removeWhere(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      items.splice(index, 1);
    }
  }
}

function publicAgent(agent) {
  const { secretHash, ...rest } = agent;
  return clone(rest);
}

function publicAdminUser(user) {
  const { passwordHash, ...rest } = user;
  return clone(rest);
}

function publicFrontendToken(token) {
  const { tokenHash, ...rest } = token;
  return clone(rest);
}

function withoutHash(record) {
  const { tokenHash, ...rest } = record;
  return clone(rest);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
