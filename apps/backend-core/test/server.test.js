import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-backend-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: ADMIN_TOKEN
  };
  const app = await createBackendApp(config);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  return {
    ...app,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

test("backend health and version endpoints", async () => {
  const app = await startTestServer();
  try {
    const health = await fetch(`${app.url}/health`).then((res) => res.json());
    assert.equal(health.ok, true);
    assert.equal(health.component, "backend-core");

    const version = await fetch(`${app.url}/version`).then((res) => res.json());
    assert.equal(version.version, "0.3.0");
    assert.equal(version.schemaVersion, 2);
  } finally {
    await app.close();
  }
});

test("admin api supports configured browser cors preflight", async () => {
  const app = await startTestServer();
  try {
    const response = await fetch(`${app.url}/api/v1/admin/summary`, {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-admin-token"
      }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
    assert.match(response.headers.get("access-control-allow-headers"), /x-admin-token/);
  } finally {
    await app.close();
  }
});

test("bootstrap token registers an agent and desired state supports etag", async () => {
  const app = await startTestServer();
  try {
    const bootstrap = await createBootstrap(app, {
      role: "proxy-node",
      name: "hk-01"
    });
    assert.match(bootstrap.token, /^boot_/);

    const registration = await registerAgent(app, bootstrap.token, "hk-01");
    assert.match(registration.agentId, /^agent_/);
    assert.match(registration.agentSecret, /^agent_/);

    const desiredRes = await fetch(`${app.url}/api/v1/agents/${registration.agentId}/desired-state`, {
      headers: {
        authorization: `Bearer ${registration.agentSecret}`
      }
    });
    assert.equal(desiredRes.status, 200);
    assert.ok(desiredRes.headers.get("etag"));
    const desired = await desiredRes.json();
    assert.equal(desired.configVersion, 1);
    assert.equal(desired.desiredState.kind, "proxy-node");

    const cachedRes = await fetch(`${app.url}/api/v1/agents/${registration.agentId}/desired-state`, {
      headers: {
        authorization: `Bearer ${registration.agentSecret}`,
        "if-none-match": desiredRes.headers.get("etag")
      }
    });
    assert.equal(cachedRes.status, 304);
  } finally {
    await app.close();
  }
});

test("admin resources compile proxy and relay desired states", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "Starter",
      trafficLimitBytes: 1000,
      durationDays: 30,
      allowedProtocols: [PROTOCOLS.VLESS_REALITY]
    });
    const user = await adminPost(app, "users", {
      name: "alice",
      planId: plan.id
    });
    assert.match(user.credentials.vlessUuid, /^[0-9a-f-]+$/);

    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "hk-landing-01",
      publicHost: "hk.example.com",
      privateIp: "10.10.0.2",
      entryDomain: "hk.example.com",
      region: "HK",
      groups: ["premium"]
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "HK VLESS",
      protocol: PROTOCOLS.VLESS_REALITY,
      port: 443,
      config: {
        reality: {
          publicKey: "reality-public",
          privateKey: "reality-private",
          shortIds: ["abcd1234"],
          serverNames: ["www.apple.com"],
          dest: "www.apple.com:443"
        }
      }
    });
    assert.equal(inbound.protocol, PROTOCOLS.VLESS_REALITY);

    const directAccessNodes = await adminList(app, "access-nodes");
    assert.equal(directAccessNodes.length, 1);
    assert.equal(directAccessNodes[0].type, "direct");
    assert.equal(directAccessNodes[0].host, "hk.example.com");

    const relay = await adminPost(app, "transit-relays", {
      name: "hk-relay-01",
      publicHost: "relay.example.com",
      privateIp: "10.20.0.2",
      region: "HK"
    });
    const relayBundle = await adminPost(app, "access-nodes/relay", {
      name: "HK Relay Entry",
      inboundId: inbound.id,
      transitRelayId: relay.id,
      entryPort: 8443,
      transport: "tcp"
    });
    assert.equal(relayBundle.accessNode.type, "relay");
    assert.equal(relayBundle.relayRule.entry.port, 8443);
    assert.equal(relayBundle.relayRule.target.host, "10.10.0.2");
    assert.equal(relayBundle.relayRule.target.port, 443);

    const proxyAgent = await registerResourceAgent(app, "proxy-node", proxyNode.id, proxyNode.name);
    const relayAgent = await registerResourceAgent(app, "transit-relay", relay.id, relay.name);

    const proxyDesired = await getDesiredState(app, proxyAgent);
    assert.equal(proxyDesired.desiredState.proxyNode.id, proxyNode.id);
    assert.equal(proxyDesired.desiredState.inbounds.length, 1);
    assert.equal(proxyDesired.desiredState.inbounds[0].users.length, 1);
    assert.equal(proxyDesired.desiredState.inbounds[0].users[0].credential.uuid, user.credentials.vlessUuid);
    assert.equal(proxyDesired.desiredState.accessNodes.length, 2);

    const relayDesired = await getDesiredState(app, relayAgent);
    assert.equal(relayDesired.desiredState.relay.id, relay.id);
    assert.equal(relayDesired.desiredState.relayRules.length, 1);
    assert.equal(relayDesired.desiredState.relayRules[0].accessNodeId, relayBundle.accessNode.id);

    const disabledAccess = await adminPatch(app, `access-nodes/${relayBundle.accessNode.id}`, {
      enabled: false
    });
    assert.equal(disabledAccess.enabled, false);

    const disabledRule = await adminGet(app, `relay-rules/${relayBundle.relayRule.id}`);
    assert.equal(disabledRule.enabled, false);

    const relayDesiredAfterDisable = await getDesiredState(app, relayAgent);
    assert.equal(relayDesiredAfterDisable.desiredState.relayRules.length, 0);
  } finally {
    await app.close();
  }
});

test("admin api validates duplicate names and invalid relay inputs", async () => {
  const app = await startTestServer();
  try {
    await adminPost(app, "plans", {
      name: "Starter",
      allowedProtocols: [PROTOCOLS.VLESS_REALITY]
    });

    const duplicate = await requestJson(app, "/api/v1/admin/plans", {
      method: "POST",
      admin: true,
      body: {
        name: "Starter"
      }
    });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.message, /already exists/);

    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "hk-validation-01",
      publicHost: "hk-validation.example.com"
    });
    const invalidTransport = await requestJson(app, "/api/v1/admin/node-inbounds", {
      method: "POST",
      admin: true,
      body: {
        proxyNodeId: proxyNode.id,
        name: "Invalid Transport",
        protocol: PROTOCOLS.VLESS_REALITY,
        transport: "quic",
        port: 443
      }
    });
    assert.equal(invalidTransport.status, 400);
    assert.match(invalidTransport.body.message, /Unsupported transport/);

    const invalidPort = await requestJson(app, "/api/v1/admin/node-inbounds", {
      method: "POST",
      admin: true,
      body: {
        proxyNodeId: proxyNode.id,
        name: "Invalid Port",
        protocol: PROTOCOLS.VLESS_REALITY,
        port: 70000
      }
    });
    assert.equal(invalidPort.status, 400);
    assert.match(invalidPort.body.message, /Invalid node inbound port/);
  } finally {
    await app.close();
  }
});

test("admin crud lifecycle keeps relay access and relay rules in sync", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "Lifecycle Plan",
      allowedProtocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2]
    });
    const user = await adminPost(app, "users", {
      name: "lifecycle-user",
      planId: plan.id
    });
    const updatedUser = await adminPatch(app, `users/${user.id}`, {
      enabled: false,
      name: "lifecycle-user-paused"
    });
    assert.equal(updatedUser.enabled, false);
    assert.equal(updatedUser.name, "lifecycle-user-paused");

    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "hk-lifecycle-01",
      publicHost: "hk-lifecycle.example.com",
      privateIp: "10.30.0.2"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "HK Lifecycle VLESS",
      protocol: PROTOCOLS.VLESS_REALITY,
      port: 443
    });
    const relay = await adminPost(app, "transit-relays", {
      name: "relay-lifecycle-01",
      publicHost: "relay-lifecycle.example.com",
      privateIp: "10.40.0.2"
    });
    const relayBundle = await adminPost(app, "access-nodes/relay", {
      name: "HK Lifecycle Relay",
      relayRuleName: "relay-lifecycle-vless-8443",
      inboundId: inbound.id,
      transitRelayId: relay.id,
      entryPort: 8443,
      transport: "tcp"
    });

    let rules = await adminList(app, "relay-rules");
    assert.ok(rules.some((rule) => rule.id === relayBundle.relayRule.id));

    const deletedAccess = await adminDelete(app, `access-nodes/${relayBundle.accessNode.id}`);
    assert.equal(deletedAccess.ok, true);
    rules = await adminList(app, "relay-rules");
    assert.equal(rules.some((rule) => rule.id === relayBundle.relayRule.id), false);

    const deletedProxy = await adminDelete(app, `proxy-nodes/${proxyNode.id}`);
    assert.equal(deletedProxy.ok, true);
    const inbounds = await adminList(app, "node-inbounds");
    const accessNodes = await adminList(app, "access-nodes");
    assert.equal(inbounds.some((item) => item.proxyNodeId === proxyNode.id), false);
    assert.equal(accessNodes.some((item) => item.proxyNodeId === proxyNode.id), false);
  } finally {
    await app.close();
  }
});

test("hysteria2 inbound compiles independent user password", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "UDP Plan",
      allowedProtocols: [PROTOCOLS.HYSTERIA2],
      allowUdp: true
    });
    const user = await adminPost(app, "users", {
      name: "bob",
      planId: plan.id
    });
    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "jp-landing-01",
      publicHost: "jp.example.com",
      entryDomain: "jp.example.com"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "JP Hysteria2",
      protocol: PROTOCOLS.HYSTERIA2,
      port: 8443,
      config: {
        sni: "jp.example.com",
        obfsPassword: "obfs-secret",
        upMbps: 50,
        downMbps: 120
      }
    });
    assert.equal(inbound.transport, "udp");

    const agent = await registerResourceAgent(app, "proxy-node", proxyNode.id, proxyNode.name);
    const desired = await getDesiredState(app, agent);
    assert.equal(desired.desiredState.inbounds.length, 1);
    assert.equal(desired.desiredState.inbounds[0].protocol, PROTOCOLS.HYSTERIA2);
    assert.equal(desired.desiredState.inbounds[0].config.obfs.password, "obfs-secret");
    assert.equal(desired.desiredState.inbounds[0].users.length, 1);
    assert.equal(
      desired.desiredState.inbounds[0].users[0].credential.password,
      user.credentials.hysteria2Password
    );
    assert.notEqual(user.credentials.hysteria2Password, user.credentials.vlessUuid);
  } finally {
    await app.close();
  }
});

test("vless reality inbound creates valid-looking x25519 keys by default", async () => {
  const app = await startTestServer();
  try {
    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "us-landing-01",
      publicHost: "us.example.com"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "US VLESS",
      protocol: PROTOCOLS.VLESS_REALITY,
      port: 443
    });

    assert.match(inbound.config.reality.privateKey, /^[A-Za-z0-9_-]{43}$/);
    assert.match(inbound.config.reality.publicKey, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(inbound.config.reality.privateKey, inbound.config.reality.publicKey);
  } finally {
    await app.close();
  }
});

async function createBootstrap(app, body) {
  const result = await requestJson(app, "/api/v1/bootstrap-tokens", {
    method: "POST",
    admin: true,
    body
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function registerResourceAgent(app, role, resourceId, name) {
  const bootstrap = await createBootstrap(app, {
    role,
    resourceId,
    name
  });
  return registerAgent(app, bootstrap.token, name);
}

async function registerAgent(app, bootstrapToken, hostname) {
  const result = await requestJson(app, "/api/v1/agents/register", {
    method: "POST",
    body: {
      bootstrapToken,
      agentVersion: "0.3.0",
      hostname
    }
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function getDesiredState(app, agent) {
  const response = await fetch(`${app.url}/api/v1/agents/${agent.agentId}/desired-state`, {
    headers: {
      authorization: `Bearer ${agent.agentSecret}`
    }
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function adminList(app, collection) {
  const result = await requestJson(app, `/api/v1/admin/${collection}`, {
    admin: true
  });
  assert.equal(result.status, 200);
  return result.body.items;
}

async function adminGet(app, path) {
  const result = await requestJson(app, `/api/v1/admin/${path}`, {
    admin: true
  });
  assert.equal(result.status, 200);
  return result.body;
}

async function adminPost(app, path, body) {
  const result = await requestJson(app, `/api/v1/admin/${path}`, {
    method: "POST",
    admin: true,
    body
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function adminPatch(app, path, body) {
  const result = await requestJson(app, `/api/v1/admin/${path}`, {
    method: "PATCH",
    admin: true,
    body
  });
  assert.equal(result.status, 200);
  return result.body;
}

async function adminDelete(app, path) {
  const result = await requestJson(app, `/api/v1/admin/${path}`, {
    method: "DELETE",
    admin: true
  });
  assert.equal(result.status, 200);
  return result.body;
}

async function requestJson(app, path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.admin) {
    headers["x-admin-token"] = ADMIN_TOKEN;
  }
  if (options.body) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${app.url}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null
  };
}
