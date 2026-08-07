import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonStore } from "../src/store.js";
import { createBackendApp } from "../src/server.js";
import { VERSION } from "../../../packages/shared/src/protocol.js";

test("normalizeState migrates direct access nodes into inbounds and permission ids", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-migrate-"));
  const path = join(dir, "store.json");
  const now = new Date().toISOString();
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 2,
      createdAt: now,
      configRevision: 1,
      configUpdatedAt: now,
      settings: {},
      proxyNodes: [
        { id: "proxy_1", name: "hk-01", enabled: true, publicHost: "hk.example.com", region: "HK", groups: [], tags: [], capabilities: [] }
      ],
      nodeInbounds: [
        { id: "inbound_1", proxyNodeId: "proxy_1", name: "HK VLESS", enabled: true, protocol: "vless-reality", listen: "0.0.0.0", port: 443, transport: "tcp", groups: ["premium"], config: {}, tags: [] }
      ],
      accessNodes: [
        { id: "access_direct", name: "HK Direct", type: "direct", enabled: true, protocol: "vless-reality", inboundId: "inbound_1", proxyNodeId: "proxy_1", host: "entry.example.com", port: 443, groups: ["premium"], tags: [] },
        { id: "access_relay", name: "HK Relay", type: "relay", enabled: true, protocol: "vless-reality", inboundId: "inbound_1", proxyNodeId: "proxy_1", transitRelayId: "relay_1", host: "relay.example.com", port: 18443, groups: [], tags: [] }
      ],
      transitRelays: [{ id: "relay_1", name: "relay-hk", enabled: true, publicHost: "relay.example.com", groups: [], tags: [] }],
      plans: [{ id: "plan_1", name: "HK Only", enabled: true, allowedAccessNodes: ["access_direct", "access_relay"], allowedNodeGroups: [], allowedRelayGroups: [], tags: [] }],
      users: [
        {
          id: "user_1",
          name: "alice",
          enabled: true,
          planId: "plan_1",
          subscriptionToken: "sub_x",
          access: { nodeGroups: [], relayGroups: [], protocols: [], accessNodes: ["access_direct"] },
          credentials: { vlessUuid: "u", hysteria2Password: "h", anytlsPassword: "a" }
        }
      ]
    })
  );

  const store = new JsonStore(path);
  await store.load();
  const state = store.state;

  assert.equal(state.accessNodes.length, 1);
  assert.equal(state.accessNodes[0].id, "access_relay");
  const inbound = state.nodeInbounds.find((item) => item.id === "inbound_1");
  assert.equal(inbound.entryHost, "entry.example.com");
  const plan = state.plans.find((item) => item.id === "plan_1");
  assert.deepEqual(plan.allowedAccessNodes, ["inbound:inbound_1", "access:access_relay"]);
  const user = state.users.find((item) => item.id === "user_1");
  assert.deepEqual(user.access.accessNodes, ["inbound:inbound_1"]);
  assert.equal(state.schemaVersion, 3);
});

test("normalizeState prunes stale node references from plans and users", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-prune-"));
  const path = join(dir, "store.json");
  const now = new Date().toISOString();
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 3,
      createdAt: now,
      configRevision: 1,
      configUpdatedAt: now,
      settings: {},
      proxyNodes: [],
      nodeInbounds: [
        { id: "inbound_1", proxyNodeId: "proxy_1", name: "HK", enabled: true, protocol: "anytls", listen: "0.0.0.0", port: 2053, transport: "tcp", groups: [], config: {}, tags: [] }
      ],
      accessNodes: [
        { id: "access_1", name: "HK Relay", type: "relay", enabled: true, protocol: "anytls", inboundId: "inbound_1", proxyNodeId: "proxy_1", transitRelayId: "relay_1", host: "relay.example.com", port: 18444, groups: [], tags: [] }
      ],
      plans: [
        {
          id: "plan_1",
          name: "Pro",
          enabled: true,
          allowedAccessNodes: ["inbound:inbound_1", "access:access_1", "access:access_deleted", "inbound:inbound_deleted"],
          tags: []
        }
      ],
      users: [
        {
          id: "user_1",
          name: "alice",
          enabled: true,
          planId: "plan_1",
          subscriptionToken: "sub_x",
          access: { nodeGroups: [], relayGroups: [], protocols: [], accessNodes: ["access:access_1", "access:access_deleted"] },
          credentials: { anytlsPassword: "a" }
        }
      ]
    })
  );

  const store = new JsonStore(path);
  await store.load();
  const plan = store.state.plans.find((item) => item.id === "plan_1");
  assert.deepEqual(plan.allowedAccessNodes, ["inbound:inbound_1", "access:access_1"]);
  const user = store.state.users.find((item) => item.id === "user_1");
  assert.deepEqual(user.access.accessNodes, ["access:access_1"]);
});

test("frontend and subscription edge resources support crud and agent linking", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-edges-"));
  const app = await createBackendApp({
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: "edge-admin"
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const front = await requestJson(app, base, "/api/v1/admin/frontend-edges", {
      method: "POST",
      admin: true,
      body: { name: "panel-01", publicHost: "panel.example.com", region: "HK", tlsEnabled: true }
    });
    assert.equal(front.status, 201);
    assert.equal(front.body.publicHost, "panel.example.com");

    const sub = await requestJson(app, base, "/api/v1/admin/subscription-edges", {
      method: "POST",
      admin: true,
      body: { name: "sub-01", publicHost: "sub.example.com", pathPrefix: "go" }
    });
    assert.equal(sub.status, 201);
    assert.equal(sub.body.pathPrefix, "go");

    const frontAgent = await registerAgent(app, base, "frontend-edge", front.body.id, "panel-01");
    const subAgent = await registerAgent(app, base, "subscription-edge", sub.body.id, "sub-01");
    assert.ok(frontAgent.agentId);
    assert.ok(subAgent.agentId);

    const updatedFront = await requestJson(app, base, `/api/v1/admin/frontend-edges/${front.body.id}`, { admin: true });
    assert.equal(updatedFront.body.agentId, frontAgent.agentId);
    const updatedSub = await requestJson(app, base, `/api/v1/admin/subscription-edges/${sub.body.id}`, { admin: true });
    assert.equal(updatedSub.body.agentId, subAgent.agentId);

    const list = await requestJson(app, base, "/api/v1/admin/subscription-edges", { admin: true });
    assert.equal(list.body.items.length, 1);

    const deleted = await requestJson(app, base, `/api/v1/admin/frontend-edges/${front.body.id}`, {
      method: "DELETE",
      admin: true
    });
    assert.equal(deleted.status, 200);
  } finally {
    await app.server.close();
  }
});

async function registerAgent(app, base, role, resourceId, name) {
  const bootstrap = await requestJson(app, base, "/api/v1/bootstrap-tokens", {
    method: "POST",
    admin: true,
    body: { role, name, resourceId }
  });
  assert.equal(bootstrap.status, 201);
  const result = await requestJson(app, base, "/api/v1/agents/register", {
    method: "POST",
    body: { bootstrapToken: bootstrap.body.token, agentVersion: VERSION, hostname: name }
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function requestJson(app, base, path, options = {}) {
  const headers = {};
  if (options.admin) {
    headers["x-admin-token"] = "edge-admin";
  }
  if (options.body) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}
