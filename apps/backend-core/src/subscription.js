import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { isAccessNodeUsable, isUserActive, userCanUseProtocol } from "./desired-state.js";

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
  const nodes = buildSubscriptionNodes(user, plan, visibleAccessNodes(state, user, plan), state);

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

function visibleAccessNodes(state, user, plan) {
  return state.accessNodes.filter((accessNode) => {
    if (!isAccessNodeUsable(accessNode, state)) {
      return false;
    }
    if (accessNode.protocol === PROTOCOLS.HYSTERIA2 && plan && plan.allowUdp === false) {
      return false;
    }
    if (!userCanUseProtocol(user, accessNode.protocol, state)) {
      return false;
    }

    const nodeGroups = nonEmpty(user.access.nodeGroups, plan?.allowedNodeGroups);
    if (nodeGroups.length && !intersects(accessNode.groups, nodeGroups)) {
      return false;
    }

    if (accessNode.type === "relay") {
      const relay = state.transitRelays.find((item) => item.id === accessNode.transitRelayId);
      const relayGroups = nonEmpty(user.access.relayGroups, plan?.allowedRelayGroups);
      if (relayGroups.length && !(relay && intersects(relay.groups, relayGroups))) {
        return false;
      }
    }

    return true;
  });
}

function buildSubscriptionNodes(user, plan, accessNodes, state) {
  const planHy2 = plan?.hysteria2 || {};
  return accessNodes.map((accessNode) => {
    const inbound = state.nodeInbounds.find((item) => item.id === accessNode.inboundId);
    const proxyNode = state.proxyNodes.find((item) => item.id === accessNode.proxyNodeId);
    const relay = accessNode.type === "relay" ? state.transitRelays.find((item) => item.id === accessNode.transitRelayId) : null;
    const base = {
      name: accessNode.name,
      host: accessNode.host,
      port: accessNode.port,
      transport: accessNode.transport || "tcp",
      protocol: accessNode.protocol
    };

    if (accessNode.protocol === PROTOCOLS.VLESS_REALITY) {
      const reality = inbound?.config?.reality || {};
      return {
        ...base,
        uuid: user.credentials.vlessUuid,
        flow: user.credentials.vlessFlow || inbound?.config?.flow || "xtls-rprx-vision",
        sni: first(reality.serverNames, "www.microsoft.com"),
        publicKey: reality.publicKey || "",
        shortId: first(reality.shortIds, ""),
        spiderX: reality.spiderX || "/",
        fingerprint: "chrome"
      };
    }

    if (accessNode.protocol === PROTOCOLS.HYSTERIA2) {
      const tls = inbound?.config?.tls || {};
      const obfs = inbound?.config?.obfs || {};
      const bandwidth = inbound?.config?.bandwidth || {};
      return {
        ...base,
        password: user.credentials.hysteria2Password,
        sni: tls.sni || proxyNode?.entryDomain || proxyNode?.publicHost || accessNode.host,
        obfsEnabled: obfs.enabled !== false,
        obfsType: obfs.type || "salamander",
        obfsPassword: obfs.password || "",
        upMbps: planHy2.upMbps ?? bandwidth.upMbps ?? 100,
        downMbps: planHy2.downMbps ?? bandwidth.downMbps ?? 100,
        insecure: false
      };
    }

    if (accessNode.protocol === PROTOCOLS.ANYTLS) {
      const tls = inbound?.config?.tls || {};
      return {
        ...base,
        password: user.credentials.anytlsPassword,
        sni: tls.sni || proxyNode?.entryDomain || proxyNode?.publicHost || accessNode.host,
        insecure: false
      };
    }

    return { ...base, raw: { accessNode, inbound, proxyNode, relay } };
  });
}

export function buildUri(node) {
  if (node.protocol === PROTOCOLS.VLESS_REALITY) {
    const params = [
      "encryption=none",
      `flow=${encodeURIComponent(node.flow)}`,
      "security=reality",
      `sni=${encodeURIComponent(node.sni)}`,
      `fp=${encodeURIComponent(node.fingerprint)}`,
      `pbk=${encodeURIComponent(node.publicKey)}`,
      `sid=${encodeURIComponent(node.shortId)}`,
      `spx=${encodeURIComponent(node.spiderX)}`,
      "type=tcp"
    ];
    return `vless://${node.uuid}@${node.host}:${node.port}?${params.join("&")}#${encodeURIComponent(node.name)}`;
  }

  if (node.protocol === PROTOCOLS.HYSTERIA2) {
    const params = [
      `sni=${encodeURIComponent(node.sni)}`,
      `insecure=${node.insecure ? "1" : "0"}`
    ];
    if (node.obfsEnabled) {
      params.push(`obfs=${encodeURIComponent(node.obfsType)}`);
      params.push(`obfs-password=${encodeURIComponent(node.obfsPassword)}`);
    }
    params.push(`up=${node.upMbps}`);
    params.push(`down=${node.downMbps}`);
    return `hysteria2://${encodeURIComponent(node.password)}@${node.host}:${node.port}?${params.join("&")}#${encodeURIComponent(node.name)}`;
  }

  if (node.protocol === PROTOCOLS.ANYTLS) {
    const params = [
      `sni=${encodeURIComponent(node.sni)}`,
      `insecure=${node.insecure ? "1" : "0"}`
    ];
    return `anytls://${encodeURIComponent(node.password)}@${node.host}:${node.port}?${params.join("&")}#${encodeURIComponent(node.name)}`;
  }

  throw httpError(`Unsupported subscription protocol: ${node.protocol}`, 400);
}

export function buildUris(nodes) {
  return nodes.map((node) => buildUri(node));
}

export function buildSingboxPayload(nodes) {
  return {
    version: 1,
    log: {
      level: "warn"
    },
    outbounds: nodes.map((node) => {
      if (node.protocol === PROTOCOLS.VLESS_REALITY) {
        return {
          type: "vless",
          tag: node.name,
          server: node.host,
          server_port: node.port,
          uuid: node.uuid,
          flow: node.flow,
          packet_encoding: "xudp",
          tls: {
            enabled: true,
            server_name: node.sni,
            utls: {
              enabled: true,
              fingerprint: node.fingerprint
            },
            reality: {
              enabled: true,
              public_key: node.publicKey,
              short_id: node.shortId
            }
          }
        };
      }

      if (node.protocol === PROTOCOLS.HYSTERIA2) {
        return {
          type: "hysteria2",
          tag: node.name,
          server: node.host,
          server_port: node.port,
          up_mbps: node.upMbps,
          down_mbps: node.downMbps,
          password: node.password,
          obfs: node.obfsEnabled
            ? {
                type: node.obfsType,
                password: node.obfsPassword
              }
            : null,
          tls: {
            enabled: true,
            server_name: node.sni,
            insecure: node.insecure
          }
        };
      }

      if (node.protocol === PROTOCOLS.ANYTLS) {
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
      }

      throw httpError(`Unsupported subscription protocol: ${node.protocol}`, 400);
    })
  };
}

export function buildClashPayload(nodes) {
  const proxies = nodes.map((node) => {
    if (node.protocol === PROTOCOLS.VLESS_REALITY) {
      return {
        name: node.name,
        type: "vless",
        server: node.host,
        port: node.port,
        uuid: node.uuid,
        network: "tcp",
        tls: true,
        udp: true,
        flow: node.flow,
        servername: node.sni,
        "client-fingerprint": node.fingerprint,
        "reality-opts": {
          "public-key": node.publicKey,
          "short-id": node.shortId
        }
      };
    }

    if (node.protocol === PROTOCOLS.HYSTERIA2) {
      return {
        name: node.name,
        type: "hysteria2",
        server: node.host,
        port: node.port,
        password: node.password,
        up: node.upMbps,
        down: node.downMbps,
        sni: node.sni,
        "skip-cert-verify": node.insecure,
        ...(node.obfsEnabled
          ? {
              obfs: node.obfsType,
              "obfs-password": node.obfsPassword
            }
          : {})
      };
    }

    if (node.protocol === PROTOCOLS.ANYTLS) {
      return {
        name: node.name,
        type: "anytls",
        server: node.host,
        port: node.port,
        password: node.password,
        sni: node.sni,
        "skip-cert-verify": node.insecure
      };
    }

    throw httpError(`Unsupported subscription protocol: ${node.protocol}`, 400);
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

function first(values, fallback) {
  return Array.isArray(values) && values.length ? values[0] : fallback;
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
