import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { VERSION } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-traffic-"));
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

test("agent traffic reports accumulate user usage", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "Metered",
      trafficLimitBytes: 1000,
      resetPolicy: "none"
    });
    const user = await adminPost(app, "users", {
      name: "metered-user",
      planId: plan.id
    });
    const agent = await registerResourceAgent(app, "proxy-node", null, "node-metered");

    const first = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        reports: [
          { userId: user.id, uploadBytes: 100, downloadBytes: 250 }
        ]
      }
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.addedBytes, 350);

    const second = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        reports: [
          { userId: user.id, uploadBytes: 50, downloadBytes: 0 }
        ]
      }
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.addedBytes, 50);

    const updated = await adminGet(app, `users/${user.id}`);
    assert.equal(updated.usedTrafficBytes, 400);
    assert.ok(updated.lastProxyUseAt);
  } finally {
    await app.close();
  }
});

test("traffic reports respect plan reset policy", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "Daily Reset",
      trafficLimitBytes: 5000,
      resetPolicy: "daily"
    });
    const user = await adminPost(app, "users", {
      name: "reset-user",
      planId: plan.id
    });
    const agent = await registerResourceAgent(app, "proxy-node", null, "node-reset");

    await reportTraffic(app, agent, user.id, 200, 100);
    const afterFirst = await adminGet(app, `users/${user.id}`);
    assert.equal(afterFirst.usedTrafficBytes, 300);
    assert.ok(afterFirst.lastUsageResetAt);

    await adminPatch(app, `users/${user.id}`, {
      lastUsageResetAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString()
    });
    await reportTraffic(app, agent, user.id, 60, 40);
    const afterReset = await adminGet(app, `users/${user.id}`);
    assert.equal(afterReset.usedTrafficBytes, 100);
  } finally {
    await app.close();
  }
});

test("traffic report requires agent auth and ignores unknown users", async () => {
  const app = await startTestServer();
  try {
    const user = await adminPost(app, "users", {
      name: "auth-user"
    });
    const agent = await registerResourceAgent(app, "proxy-node", null, "node-auth");

    const missingAuth = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
      method: "POST",
      body: {
        reports: [{ userId: user.id, uploadBytes: 1, downloadBytes: 1 }]
      }
    });
    assert.equal(missingAuth.status, 401);

    const result = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        reports: [
          { userId: user.id, uploadBytes: 10, downloadBytes: 20 },
          { userId: "user_missing", uploadBytes: 100, downloadBytes: 100 }
        ]
      }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.addedBytes, 230);
    assert.deepEqual(result.body.userIds, [user.id]);

    const summary = await adminGet(app, "traffic-summary");
    assert.equal(summary.today.totalBytes, 230);
    assert.equal(summary.today.uploadBytes, 110);
    assert.equal(summary.today.downloadBytes, 120);
  } finally {
    await app.close();
  }
});

test("node-level traffic reports accumulate today by inbound", async () => {
  const app = await startTestServer();
  try {
    const node = await adminPost(app, "proxy-nodes", {
      name: "hk-node",
      publicIp: "203.0.113.1"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      name: "香港",
      proxyNodeId: node.id,
      protocol: "anytls",
      port: 2053
    });
    const agent = await registerResourceAgent(app, "proxy-node", node.id, "node-hk");

    const result = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agent.agentSecret}`
      },
      body: {
        reports: [
          { kind: "node", inboundId: inbound.id, uploadBytes: 150, downloadBytes: 850 }
        ]
      }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.addedBytes, 1000);

    const summary = await adminGet(app, "traffic-summary");
    assert.equal(summary.today.totalBytes, 1000);
    assert.equal(summary.today.activeInbounds, 1);
    assert.equal(summary.today.byInbound.length, 1);
    assert.equal(summary.today.byInbound[0].inboundId, inbound.id);
    assert.equal(summary.today.byInbound[0].totalBytes, 1000);
  } finally {
    await app.close();
  }
});

async function reportTraffic(app, agent, userId, uploadBytes, downloadBytes) {
  const result = await requestJson(app, `/api/v1/agents/${agent.agentId}/reports/traffic`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${agent.agentSecret}`
    },
    body: {
      reports: [{ userId, uploadBytes, downloadBytes }]
    }
  });
  assert.equal(result.status, 200);
  return result.body;
}

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
