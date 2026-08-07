import { DEFAULT_INTERVALS, PROTOCOLS } from "../../../packages/shared/src/protocol.js";

export function compileDesiredState(agent, state) {
  const configVersion = state.configRevision || 1;
  const updatedAt = state.configUpdatedAt || state.createdAt;

  return {
    agentId: agent.id,
    configVersion,
    updatedAt,
    desiredState: buildRoleState(agent, state)
  };
}

function buildRoleState(agent, state) {
  const certificates = state.anytlsCerts.map((cert) => ({
    domain: cert.domain,
    certPath: cert.certPath,
    keyPath: cert.keyPath,
    certPem: cert.certPem,
    keyPem: cert.keyPem
  }));
  if (agent.role === "proxy-node") {
    return {
      ...buildProxyNodeState(agent, state),
      certificates
    };
  }
  if (agent.role === "transit-relay") {
    return {
      ...buildTransitRelayState(agent, state),
      certificates
    };
  }
  return {
    kind: agent.role,
    runtime: defaultRuntime(),
    certificates
  };
}

function buildProxyNodeState(agent, state) {
  const proxyNode = state.proxyNodes.find((node) => node.agentId === agent.id);
  const inbounds =
    proxyNode && proxyNode.enabled
      ? state.nodeInbounds
          .filter((inbound) => inbound.proxyNodeId === proxyNode.id && inbound.enabled)
          .flatMap((inbound) => renderInbound(inbound, state))
      : [];
  const accessNodes =
    proxyNode && proxyNode.enabled
      ? state.accessNodes
          .filter((accessNode) => accessNode.proxyNodeId === proxyNode.id && isAccessNodeUsable(accessNode, state))
          .map((accessNode) => renderAccessNode(accessNode))
      : [];

  return {
    kind: "proxy-node",
    proxyNode: proxyNode ? renderProxyNode(proxyNode) : null,
    inbounds,
    accessNodes,
    runtime: defaultRuntime()
  };
}

function buildTransitRelayState(agent, state) {
  const relay = state.transitRelays.find((item) => item.agentId === agent.id);
  const relayRules =
    relay && relay.enabled
      ? state.relayRules
          .filter((rule) => rule.relayId === relay.id && isRelayRuleUsable(rule, state))
          .map((rule) => renderRelayRule(rule))
      : [];

  return {
    kind: "transit-relay",
    relay: relay ? renderTransitRelay(relay) : null,
    relayRules,
    runtime: defaultRuntime()
  };
}

function renderInbound(inbound, state) {
  const activeUsers = activeUsersForProtocol(inbound.protocol, state);
  if (!activeUsers.length) {
    return [];
  }
  return [{
    id: `inbound:${inbound.id}`,
    proxyNodeId: inbound.proxyNodeId,
    name: inbound.name,
    protocol: inbound.protocol,
    listen: inbound.listen,
    port: inbound.port,
    transport: inbound.transport,
    tags: inbound.tags,
    groups: inbound.groups,
    config: inbound.config,
    users: activeUsers
  }];
}

function renderAccessNode(accessNode) {
  return {
    id: accessNode.id,
    name: accessNode.name,
    type: accessNode.type,
    protocol: accessNode.protocol,
    inboundId: accessNode.inboundId,
    proxyNodeId: accessNode.proxyNodeId,
    transitRelayId: accessNode.transitRelayId || null,
    relayRuleId: accessNode.relayRuleId || null,
    host: accessNode.host,
    port: accessNode.port,
    transport: accessNode.transport,
    tags: accessNode.tags,
    groups: accessNode.groups
  };
}

function renderRelayRule(rule) {
  return {
    id: rule.id,
    name: rule.name,
    engine: rule.engine,
    accessNodeId: rule.accessNodeId,
    inboundId: rule.inboundId,
    proxyNodeId: rule.proxyNodeId,
    entry: rule.entry,
    target: rule.target,
    transport: rule.transport,
    tags: rule.tags
  };
}

function renderProxyNode(node) {
  return {
    id: node.id,
    name: node.name,
    region: node.region,
    provider: node.provider,
    publicHost: node.publicHost,
    publicIp: node.publicIp,
    privateIp: node.privateIp,
    entryDomain: node.entryDomain,
    tags: node.tags,
    groups: node.groups
  };
}

function renderTransitRelay(relay) {
  return {
    id: relay.id,
    name: relay.name,
    engine: relay.engine,
    region: relay.region,
    provider: relay.provider,
    publicHost: relay.publicHost,
    publicIp: relay.publicIp,
    privateIp: relay.privateIp,
    tags: relay.tags,
    groups: relay.groups
  };
}

function activeUsersForProtocol(protocol, state) {
  return state.users
    .filter((user) => isUserActive(user, state))
    .filter((user) => userCanUseProtocol(user, protocol, state))
    .map((user) => renderProtocolUser(user, protocol, state));
}

function renderProtocolUser(user, protocol, state) {
  const plan = state.plans.find((item) => item.id === user.planId);
  const trafficLimitBytes = user.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null;
  const overQuota = Boolean(trafficLimitBytes && Number(user.usedTrafficBytes || 0) >= Number(trafficLimitBytes));
  const overQuotaPolicy = plan?.overQuotaPolicy || "disconnect";
  let effectiveRateMbps = user.limits?.rateMbps ?? null;
  if (overQuota && overQuotaPolicy === "throttle") {
    // 超额后自动限速 1Mbps，保留用户连接
    effectiveRateMbps = 1;
  }
  const common = {
    userId: user.id,
    name: user.name,
    planId: user.planId || null,
    trafficLimitBytes,
    expiresAt: user.expiresAt,
    overQuota,
    limits: {
      ...(user.limits || {}),
      rateMbps: effectiveRateMbps
    }
  };

  if (protocol === PROTOCOLS.ANYTLS) {
    return {
      ...common,
      credential: {
        type: "anytls",
        password: user.credentials.anytlsPassword
      }
    };
  }

  return {
    ...common,
    credential: {
      type: protocol
    }
  };
}

export function isUserActive(user, state) {
  if (!user.enabled) {
    return false;
  }
  if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
    return false;
  }
  const plan = state.plans.find((item) => item.id === user.planId);
  if (user.planId && (!plan || !plan.enabled)) {
    return false;
  }
  const trafficLimitBytes = user.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null;
  if (trafficLimitBytes && Number(user.usedTrafficBytes || 0) >= Number(trafficLimitBytes)) {
    // 超额策略为“限速 1Mbps”时保留节点访问，否则断流
    if ((plan?.overQuotaPolicy || "disconnect") === "throttle") {
      return true;
    }
    return false;
  }
  return true;
}

export function userCanUseProtocol(user, protocol, state) {
  // 权限组不再区分协议：所有权限组支持所有协议
  return true;
}

export function isAccessNodeUsable(accessNode, state) {
  if (!accessNode.enabled) {
    return false;
  }
  const inbound = state.nodeInbounds.find((item) => item.id === accessNode.inboundId);
  const proxyNode = state.proxyNodes.find((item) => item.id === accessNode.proxyNodeId);
  if (!inbound?.enabled || !proxyNode?.enabled) {
    return false;
  }
  if (accessNode.type !== "relay") {
    return true;
  }
  const relay = state.transitRelays.find((item) => item.id === accessNode.transitRelayId);
  const rule = state.relayRules.find((item) => item.id === accessNode.relayRuleId);
  return Boolean(relay?.enabled && rule?.enabled);
}

function isRelayRuleUsable(rule, state) {
  if (!rule.enabled) {
    return false;
  }
  const accessNode = state.accessNodes.find((item) => item.id === rule.accessNodeId);
  return Boolean(accessNode && isAccessNodeUsable(accessNode, state));
}

function defaultRuntime() {
  return {
    mode: "lite",
    pullSeconds: DEFAULT_INTERVALS.pullSeconds,
    pushSeconds: DEFAULT_INTERVALS.pushSeconds
  };
}
