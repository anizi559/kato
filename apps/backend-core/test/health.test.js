import assert from "node:assert/strict";
import { createServer as createNetServer } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS, VERSION } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-health-"));
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

async function startTcpServer() {
  const server = createNetServer((socket) => {
    socket.on("error", () => {});
    socket.end("ok\n");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    port: address.port,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("health probes mark access nodes ok and failed with alerts", async () => {
  const app = await startTestServer();
  const tcp = await startTcpServer();
  try {
    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "probe-node",
      publicHost: "127.0.0.1"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "Probe AnyTLS",
      protocol: PROTOCOLS.ANYTLS,
      port: tcp.port
    });
    const user = await adminPost(app, "users", {
      name: "probe-user"
    });
    const first = await app.store.runHealthProbes();
    assert.equal(first.probed, 1);
    const healthy = app.store.getResource("node-inbounds", inbound.id);
    assert.equal(healthy.health.status, "ok");
    assert.ok(Number.isFinite(healthy.health.latencyMs));

    const beforeAlerts = app.store.listAlerts();
    assert.equal(beforeAlerts.some((alert) => alert.type === "probe.failed"), false);

    await tcp.close();
    const second = await app.store.runHealthProbes();
    assert.equal(second.changed, true);
    const failed = app.store.getResource("node-inbounds", inbound.id);
    assert.equal(failed.health.status, "failed");
    const alerts = app.store.listAlerts();
    assert.ok(alerts.some((alert) => alert.type === "probe.failed" && alert.resourceId === inbound.id));
  } finally {
    await tcp.close().catch(() => {});
    await app.close();
  }
});

test("health probes cover relay rules", async () => {
  const app = await startTestServer();
  const tcp = await startTcpServer();
  try {
    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "probe-relay-landing",
      publicHost: "127.0.0.1",
      privateIp: "127.0.0.1"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "Probe Relay AnyTLS",
      protocol: PROTOCOLS.ANYTLS,
      port: 443
    });
    const relay = await adminPost(app, "transit-relays", {
      name: "probe-relay",
      publicHost: "127.0.0.1"
    });
    const relayBundle = await adminPost(app, "access-nodes/relay", {
      name: "Probe Relay Entry",
      inboundId: inbound.id,
      transitRelayId: relay.id,
      entryPort: tcp.port,
      transport: "tcp"
    });
    const user = await adminPost(app, "users", {
      name: "probe-relay-user"
    });

    const result = await app.store.runHealthProbes();
    assert.ok(result.probed >= 2);
    const rule = app.store.getResource("relay-rules", relayBundle.relayRule.id);
    assert.equal(rule.health.status, "ok");
  } finally {
    await tcp.close().catch(() => {});
    await app.close();
  }
});

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

async function adminList(app, collection) {
  const result = await requestJson(app, `/api/v1/admin/${collection}`, {
    admin: true
  });
  assert.equal(result.status, 200);
  return result.body.items;
}

async function requestJson(app, path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };
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
    body: text ? JSON.parse(text) : null
  };
}
