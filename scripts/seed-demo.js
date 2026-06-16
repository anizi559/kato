#!/usr/bin/env node
import { PROTOCOLS } from "../packages/shared/src/protocol.js";

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080";
const adminToken = process.env.BACKEND_ADMIN_TOKEN || "";
const command = process.argv[2] || "run";

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (!adminToken) {
  console.error("Missing BACKEND_ADMIN_TOKEN.");
  process.exit(1);
}

const created = [];
const reused = [];
const state = {
  agents: [],
  plans: [],
  users: [],
  "proxy-nodes": [],
  "node-inbounds": [],
  "transit-relays": [],
  "access-nodes": [],
  "relay-rules": []
};

try {
  await loadState();

  const basicPlan = await ensureResource("plans", "基础版", {
    name: "基础版",
    trafficLimitBytes: 100 * 1024 ** 3,
    durationDays: 30,
    allowedProtocols: [PROTOCOLS.VLESS_REALITY],
    allowUdp: false,
    speedLimitMbps: 50
  });

  const standardPlan = await ensureResource("plans", "标准版", {
    name: "标准版",
    trafficLimitBytes: 500 * 1024 ** 3,
    durationDays: 90,
    allowedProtocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2],
    allowUdp: true,
    speedLimitMbps: 200,
    hysteria2: { upMbps: 200, downMbps: 200 }
  });

  const proxyNode = await ensureResource("proxy-nodes", "proxy-hk-01", {
    name: "proxy-hk-01",
    publicHost: "hk-01.example.com",
    publicIp: "203.0.113.10",
    privateIp: "10.10.0.2",
    entryDomain: "hk-01.example.com",
    region: "Hong Kong",
    provider: "demo-cloud",
    groups: ["hk", "standard"],
    capabilities: ["xray", "hysteria2"]
  });

  const relay = await ensureResource("transit-relays", "relay-hk-01", {
    name: "relay-hk-01",
    publicHost: "relay-hk.example.com",
    publicIp: "203.0.113.20",
    privateIp: "10.20.0.2",
    region: "Hong Kong",
    provider: "demo-cloud",
    groups: ["hk", "relay"]
  });

  const vlessInbound = await ensureResource("node-inbounds", "HK VLESS REALITY 443", {
    name: "HK VLESS REALITY 443",
    proxyNodeId: proxyNode.id,
    protocol: PROTOCOLS.VLESS_REALITY,
    port: 443,
    config: {
      reality: {
        serverNames: ["www.microsoft.com"],
        dest: "www.microsoft.com:443",
        shortIds: ["abcd1234"]
      }
    }
  });

  await ensureResource("node-inbounds", "HK Hysteria2 8443", {
    name: "HK Hysteria2 8443",
    proxyNodeId: proxyNode.id,
    protocol: PROTOCOLS.HYSTERIA2,
    port: 8443,
    config: {
      sni: "hk-01.example.com",
      obfsPassword: "demo-hy2-obfs",
      upMbps: 200,
      downMbps: 200
    }
  });

  await ensureRelayAccessNode("HK Relay VLESS 8443", {
    name: "HK Relay VLESS 8443",
    relayRuleName: "relay-hk-vless-8443",
    inboundId: vlessInbound.id,
    transitRelayId: relay.id,
    entryPort: 8443,
    transport: "tcp"
  });

  await ensureResource("users", "demo-basic", {
    name: "demo-basic",
    email: "demo-basic@example.com",
    planId: basicPlan.id,
    access: { protocols: [PROTOCOLS.VLESS_REALITY] }
  });

  await ensureResource("users", "demo-standard", {
    name: "demo-standard",
    email: "demo-standard@example.com",
    planId: standardPlan.id,
    access: { protocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2] }
  });

  await ensureAgent("proxy-node", proxyNode.id, proxyNode.name, { xray: true, hysteria2: true });
  await ensureAgent("transit-relay", relay.id, relay.name, { realm: true });

  const summary = await adminGet("/api/v1/admin/summary");
  console.log(JSON.stringify({ ok: true, backendUrl, created, reused, summary }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

async function loadState() {
  const [agentsResult, plans, users, proxyNodes, inbounds, relays, accessNodes, relayRules] = await Promise.all([
    adminGet("/api/v1/admin/agents"),
    adminList("plans"),
    adminList("users"),
    adminList("proxy-nodes"),
    adminList("node-inbounds"),
    adminList("transit-relays"),
    adminList("access-nodes"),
    adminList("relay-rules")
  ]);
  state.agents = agentsResult.agents || [];
  state.plans = plans;
  state.users = users;
  state["proxy-nodes"] = proxyNodes;
  state["node-inbounds"] = inbounds;
  state["transit-relays"] = relays;
  state["access-nodes"] = accessNodes;
  state["relay-rules"] = relayRules;
}

async function ensureResource(collection, name, body) {
  const existing = state[collection].find((item) => item.name === name);
  if (existing) {
    reused.push(`${collection}:${name}`);
    return existing;
  }

  const createdRecord = await adminPost(`/api/v1/admin/${collection}`, body);
  state[collection].push(createdRecord);
  created.push(`${collection}:${name}`);
  if (collection === "node-inbounds") {
    state["access-nodes"] = await adminList("access-nodes");
  }
  return createdRecord;
}

async function ensureRelayAccessNode(name, body) {
  const existing = state["access-nodes"].find((item) => item.name === name);
  if (existing) {
    reused.push(`access-nodes:${name}`);
    return existing;
  }

  const bundle = await adminPost("/api/v1/admin/access-nodes/relay", body);
  state["access-nodes"].push(bundle.accessNode);
  state["relay-rules"].push(bundle.relayRule);
  created.push(`access-nodes:${name}`);
  created.push(`relay-rules:${bundle.relayRule.name}`);
  return bundle.accessNode;
}

async function ensureAgent(role, resourceId, name, capabilities) {
  const existing = state.agents.find((agent) => agent.role === role && agent.resourceId === resourceId);
  if (existing) {
    reused.push(`agents:${role}:${name}`);
    return existing;
  }

  const bootstrap = await adminPost("/api/v1/bootstrap-tokens", {
    role,
    resourceId,
    name,
    ttlSeconds: 900
  });
  const registration = await publicPost("/api/v1/agents/register", {
    bootstrapToken: bootstrap.token,
    agentVersion: "0.3.4",
    hostname: name,
    capabilities
  });
  await publicPost(`/api/v1/agents/${registration.agentId}/heartbeat`, {
    actualState: { demo: true, seededAt: new Date().toISOString() }
  }, {
    authorization: `Bearer ${registration.agentSecret}`
  });
  state.agents = (await adminGet("/api/v1/admin/agents")).agents || [];
  created.push(`agents:${role}:${name}`);
  return registration;
}

async function adminList(collection) {
  const result = await adminGet(`/api/v1/admin/${collection}`);
  return result.items || [];
}

async function adminGet(path) {
  return request(path, { admin: true });
}

async function adminPost(path, body) {
  return request(path, { method: "POST", admin: true, body });
}

async function publicPost(path, body, headers = {}) {
  return request(path, { method: "POST", body, headers });
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.admin) {
    headers["x-admin-token"] = adminToken;
  }
  if (options.body) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${backendUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${payload?.message || payload?.error || response.status}`);
  }
  return payload;
}

function printHelp() {
  console.log(`Seed demo resources into a running Backend Core.

Usage:
  BACKEND_ADMIN_TOKEN=<admin-token> node scripts/seed-demo.js

Environment:
  BACKEND_URL=http://127.0.0.1:8080
  BACKEND_ADMIN_TOKEN=<admin-token>

The script is idempotent by resource name and will reuse existing demo resources.
`);
}
