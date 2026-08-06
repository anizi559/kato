import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { isAccessNodeUsable, isUserActive } from "./desired-state.js";

export const SUBSCRIPTION_FORMATS = Object.freeze(["auto", "sing-box", "clash", "uri"]);

const DEFAULT_USER_AGENT_FORMAT = "uri";

export function resolveSubscriptionFormat(preferred = "auto", userAgent = "") {
  const requested = String(preferred || "auto").toLowerCase();
  if (SUBSCRIPTION_FORMATS.includes(requested) && requested !== "auto") {
    return requested;
  }
  return detectFormatFromUserAgent(userAgent);
}

export function generateSubscriptionContent(state, token, { format = "auto", userAgent = "" } = {}) {
  const user = state.users.find((item) => item.subscriptionToken === token);
  if (!user) {
    throw httpError("Subscription not found", 404);
  }
  if (!isUserActive(user, state)) {
    throw httpError("Subscription not found", 404);
  }

  const plan = state.plans.find((item) => item.id === user.planId);
  const settings = state.settings || {};
  const resolvedFormat = resolveSubscriptionFormat(format, userAgent);
  const nodes = buildSubscriptionNodes(user, plan, visibleSubscriptionEntries(state, user, plan), state);

  let content = "";
  let contentType = "text/plain; charset=utf-8";
  if (resolvedFormat === "sing-box") {
    content = `${JSON.stringify(buildSingboxPayload(nodes), null, 2)}\n`;
    contentType = "application/json; charset=utf-8";
  } else if (resolvedFormat === "clash") {
    content = buildClashPayload(nodes);
    contentType = "text/yaml; charset=utf-8";
  } else {
    content = Buffer.from(buildUris(nodes).join("\n"), "utf8").toString("base64");
  }

  return {
    ok: true,
    format: resolvedFormat,
    content,
    contentType,
    headers: {
      "x-kato-format": resolvedFormat,
      ...buildSubscriptionHeaders(user, plan, settings)
    }
  };
}

function visibleSubscriptionEntries(state, user, plan) {
  const entries = [];

  for (const inbound of state.nodeInbounds) {
    if (!isInboundUsable(inbound, state)) {
      continue;
    }
    const proxyNode = state.proxyNodes.find((item) => item.id === inbound.proxyNodeId);
    const host = inbound.entryHost || proxyNode?.entryDomain || proxyNode?.publicHost || proxyNode?.publicIp || "";
    if (!host) {
      continue;
    }
    entries.push({
      id: `inbound:${inbound.id}`,
      kind: "direct",
      name: inbound.name,
      host,
      port: inbound.port,
      transport: inbound.transport || "tcp",
      protocol: inbound.protocol,
      groups: inbound.groups || [],
      inbound,
      proxyNode,
      relay: null
    });
  }

  for (const accessNode of state.accessNodes) {
    if (!isAccessNodeUsable(accessNode, state)) {
      continue;
    }
    const inbound = state.nodeInbounds.find((item) => item.id === accessNode.inboundId);
    const proxyNode = state.proxyNodes.find((item) => item.id === accessNode.proxyNodeId);
    const relay = state.transitRelays.find((item) => item.id === accessNode.transitRelayId);
    entries.push({
      id: `access:${accessNode.id}`,
      kind: "relay",
      name: accessNode.name,
      host: accessNode.host,
      port: accessNode.port,
      transport: accessNode.transport || "tcp",
      protocol: accessNode.protocol,
      groups: accessNode.groups || [],
      inbound,
      proxyNode,
      relay
    });
  }

  return entries.filter((entry) => {
    const allowedNodes = nonEmpty(user.access.accessNodes, plan?.allowedAccessNodes);
    if (allowedNodes.length && !allowedNodes.includes(entry.id)) {
      return false;
    }
    const nodeGroups = nonEmpty(user.access.nodeGroups, plan?.allowedNodeGroups);
    if (nodeGroups.length && !intersects(entry.groups, nodeGroups)) {
      return false;
    }
    if (entry.kind === "relay") {
      const relayGroups = nonEmpty(user.access.relayGroups, plan?.allowedRelayGroups);
      if (relayGroups.length && !(entry.relay && intersects(entry.relay.groups, relayGroups))) {
        return false;
      }
    }
    return true;
  });
}

function isInboundUsable(inbound, state) {
  if (!inbound.enabled) {
    return false;
  }
  const proxyNode = state.proxyNodes.find((item) => item.id === inbound.proxyNodeId);
  return Boolean(proxyNode?.enabled);
}

function buildSubscriptionNodes(user, plan, entries, state) {
  return entries.map((entry) => {
    const { inbound, proxyNode, relay } = entry;
    const base = {
      name: entry.name,
      host: entry.host,
      port: entry.port,
      transport: entry.transport || "tcp",
      protocol: entry.protocol
    };
    const tls = inbound?.config?.tls || {};
    return {
      ...base,
      password: user.credentials.anytlsPassword,
      sni: tls.sni || proxyNode?.entryDomain || proxyNode?.publicHost || entry.host,
      insecure: tls.insecure === true,
      raw: { entry, inbound, proxyNode, relay }
    };
  });
}

export function buildUri(node) {
  const params = [
    `sni=${encodeURIComponent(node.sni)}`,
    `insecure=${node.insecure ? "1" : "0"}`
  ];
  return `anytls://${encodeURIComponent(node.password)}@${node.host}:${node.port}?${params.join("&")}#${encodeURIComponent(node.name)}`;
}

export function buildUris(nodes) {
  return nodes.map((node) => buildUri(node));
}

export function buildSingboxPayload(nodes) {
  return {
    log: {
      level: "warn"
    },
    outbounds: nodes.map((node) => {
      return {
        type: "anytls",
        tag: node.name,
        server: node.host,
        server_port: node.port,
        password: node.password,
        tls: {
          enabled: true,
          server_name: node.sni,
          insecure: node.insecure
        }
      };
    })
  };
}

export function buildClashPayload(nodes) {
  const proxies = nodes.map((node) => {
    return {
      name: node.name,
      type: "anytls",
      server: node.host,
      port: node.port,
      password: node.password,
      sni: node.sni,
      "skip-cert-verify": node.insecure
    };
  });

  return `${renderYaml({
    "mixed-port": 7890,
    "allow-lan": false,
    mode: "rule",
    "log-level": "warning",
    proxies,
    "proxy-groups": [
      {
        name: "PROXY",
        type: "select",
        proxies: nodes.map((node) => node.name)
      }
    ],
    rules: ["MATCH,PROXY"]
  })}\n`;
}

function renderYaml(value, indent = "") {
  if (Array.isArray(value)) {
    const lines = [];
    for (const item of value) {
      lines.push(...renderYamlListItem(item, indent));
    }
    return lines.join("\n");
  }
  if (isObject(value)) {
    return renderYamlObject(value, indent);
  }
  return `${indent}${yamlScalar(value)}`;
}

function renderYamlListItem(item, indent) {
  if (!isObject(item)) {
    return [`${indent}- ${yamlScalar(item)}`];
  }
  const entries = Object.entries(item).filter(([, value]) => value !== null && value !== undefined);
  if (!entries.length) {
    return [`${indent}- {}`];
  }
  const lines = [];
  const [firstKey, firstValue] = entries[0];
  lines.push(`${indent}- ${firstKey}:${yamlInline(firstValue, `${indent}  `)}`);
  for (const [key, value] of entries.slice(1)) {
    lines.push(`${indent}  ${key}:${yamlInline(value, `${indent}  `)}`);
  }
  return lines;
}

function renderYamlObject(object, indent) {
  const lines = [];
  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined) {
      continue;
    }
    lines.push(`${indent}${key}:${yamlInline(value, indent)}`);
  }
  return lines.join("\n");
}

function yamlInline(value, indent) {
  if (isObject(value)) {
    const rendered = renderYamlObject(value, `${indent}  `);
    return rendered ? `\n${rendered}` : " {}";
  }
  if (Array.isArray(value)) {
    const rendered = renderYaml(value, `${indent}  `);
    return rendered ? `\n${rendered}` : " []";
  }
  return ` ${yamlScalar(value)}`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function yamlScalar(value) {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return yamlString(value);
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function buildSubscriptionHeaders(user, plan, settings) {
  const headers = {};
  const interval = Number(settings.defaultSubscriptionIntervalSeconds) || 3600;
  headers["profile-update-interval"] = String(interval);
  headers["profile-title"] = String(settings.subscriptionTitle || settings.systemName || "Kato");

  if (settings.subscriptionUserinfo !== false) {
    const trafficLimitBytes = user.trafficLimitBytes ?? plan?.trafficLimitBytes ?? null;
    const parts = [`upload=0`, `download=${Math.max(0, Number(user.usedTrafficBytes) || 0)}`];
    if (trafficLimitBytes) {
      parts.push(`total=${trafficLimitBytes}`);
    }
    if (user.expiresAt) {
      const expires = Math.floor(new Date(user.expiresAt).getTime() / 1000);
      if (Number.isFinite(expires) && expires > 0) {
        parts.push(`expire=${expires}`);
      }
    }
    headers["subscription-userinfo"] = parts.join("; ");
  }

  return headers;
}

function detectFormatFromUserAgent(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("sing-box") || ua.includes("singbox")) {
    return "sing-box";
  }
  if (ua.includes("clash") || ua.includes("mihomo") || ua.includes("stash")) {
    return "clash";
  }
  return DEFAULT_USER_AGENT_FORMAT;
}

function nonEmpty(userValue, planValue) {
  if (Array.isArray(userValue) && userValue.length) {
    return userValue;
  }
  if (Array.isArray(planValue) && planValue.length) {
    return planValue;
  }
  return [];
}

function intersects(left, right) {
  return left.some((item) => right.includes(item));
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
