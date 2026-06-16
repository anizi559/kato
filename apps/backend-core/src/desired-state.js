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
  if (agent.role === "proxy-node") {
    return buildProxyNodeState(agent, state);
  }
  if (agent.role === "transit-relay") {
    return buildTransitRelayState(agent, state);
  }
  return {
    kind: agent.role,
    runtime: defaultRuntime()
  };
}

function buildProxyNodeState(agent, state) {
  const proxyNode = state.proxyNodes.find((node) => node.agentId === agent.id);
  const inbounds =
    proxyNode && proxyNode.enabled
      ? state.nodeInbounds
          .filter((inbound) => inbound.proxyNodeId === proxyNode.id && inbound.enabled)
          .map((inbound) => renderInbound(inbound, state))
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
  return {
    id: inbound.id,
    proxyNodeId: inbound.proxyNodeId,
    name: inbound.name,
    protocol: inbound.protocol,
    listen: inbound.listen,
    port: inbound.port,
    transport: inbound.transport,
    tags: inbound.tags,
    groups: inbound.groups,
    config: inbound.config,
    users: activeUsersForProtocol(inbound.protocol, state)
  };
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
  const common = {
    userId: user.id,
    name: user.name,
    planId: user.planId || null,
    trafficLimitBytes,
    usedTrafficBytes: user.usedTrafficBytes,
    expiresAt: user.expiresAt,
    limits: user.limits
  };

  if (protocol === PROTOCOLS.VLESS_REALITY) {
    return {
      ...common,
      credential: {
        type: "vless",
        uuid: user.credentials.vlessUuid,
        flow: user.credentials.vlessFlow || "xtls-rprx-vision"
      }
    };
  }

  if (protocol === PROTOCOLS.HYSTERIA2) {
    return {
      ...common,
      credential: {
        type: "hysteria2",
        password: user.credentials.hysteria2Password
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

function isUserActive(user, state) {
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
  if (trafficLimitBytes && user.usedTrafficBytes >= trafficLimitBytes) {
    return false;
  }
  return true;
}

function userCanUseProtocol(user, protocol, state) {
  const userProtocols = user.access?.protocols || [];
  if (userProtocols.length) {
    return userProtocols.includes(protocol);
  }
  const plan = state.plans.find((item) => item.id === user.planId);
  const planProtocols = plan?.allowedProtocols || [];
  if (planProtocols.length) {
    return planProtocols.includes(protocol);
  }
  return true;
}

function isAccessNodeUsable(accessNode, state) {
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
