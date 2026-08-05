import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { VERSION } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-alerts-"));
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

test("alert sweep marks stale agents offline and creates alerts", async () => {
  const app = await startTestServer();
  try {
    const agent = await registerResourceAgent(app, "proxy-node", null, "node-alert");
    const heartbeat = await requestJson(app, `/api/v1/agents/${agent.agentId}/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        actualState: {}
      }
    });
    assert.equal(heartbeat.status, 200);

    const storedAgent = app.store.findAgent(agent.agentId);
    storedAgent.lastSeenAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const sweep = await app.store.sweepAlerts();
    assert.equal(sweep.changed, true);
    assert.ok(sweep.createdAlerts.some((alert) => alert.type === "agent.offline"));
    assert.equal(app.store.findAgent(agent.agentId).status, "offline");

    const list = await requestJson(app, "/api/v1/admin/alerts?status=open", { admin: true });
    assert.equal(list.status, 200);
    assert.ok(list.body.items.some((alert) => alert.type === "agent.offline" && alert.status === "open"));

    const alertId = list.body.items[0].id;
    const resolved = await requestJson(app, `/api/v1/admin/alerts/${alertId}`, {
      method: "PATCH",
      admin: true,
      body: { status: "resolved" }
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.status, "resolved");

    const heartbeatBack = await requestJson(app, `/api/v1/agents/${agent.agentId}/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        actualState: {}
      }
    });
    assert.equal(heartbeatBack.status, 200);
    assert.equal(app.store.findAgent(agent.agentId).status, "online");
  } finally {
    await app.close();
  }
});

test("audit logs and traffic summary endpoints return data", async () => {
  const app = await startTestServer();
  try {
    const user = await adminPost(app, "users", {
      name: "summary-user"
    });
    await adminPatch(app, `users/${user.id}`, {
      usedTrafficBytes: 12345,
      lastProxyUseAt: new Date().toISOString()
    });

    const audit = await requestJson(app, "/api/v1/admin/audit-logs", { admin: true });
    assert.equal(audit.status, 200);
    assert.ok(Array.isArray(audit.body.items));
    assert.ok(audit.body.items.some((item) => item.action === "users.created"));

    const traffic = await requestJson(app, "/api/v1/admin/traffic-summary", { admin: true });
    assert.equal(traffic.status, 200);
    assert.equal(traffic.body.totalBytes, 12345);
    assert.equal(traffic.body.users[0].name, "summary-user");
    assert.equal(traffic.body.users[0].usedTrafficBytes, 12345);
  } finally {
    await app.close();
  }
});

test("settings accept alert notification fields", async () => {
  const app = await startTestServer();
  try {
    const patch = await requestJson(app, "/api/v1/admin/settings", {
      method: "PATCH",
      admin: true,
      body: {
        agentOfflineSeconds: 90,
        alertWebhookUrl: "https://example.com/hook",
        telegramBotToken: "123:abc",
        telegramChatId: "-100123"
      }
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.agentOfflineSeconds, 90);
    assert.equal(patch.body.alertWebhookUrl, "https://example.com/hook");
    assert.equal(patch.body.telegramChatId, "-100123");
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
  const result = await requestJson(app, "/api/v1/agents/register", {
    method: "POST",
    body: {
      bootstrapToken: bootstrap.token,
      agentVersion: VERSION,
      hostname: name
    }
  });
  assert.equal(result.status, 201);
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
