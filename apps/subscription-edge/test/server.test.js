import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSubscriptionEdgeApp } from "../src/server.js";

async function startFakeBackend() {
  let captured = null;
  const server = createHttpServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/v1/subscriptions/")) {
      captured = {
        url: req.url,
        authorization: req.headers.authorization,
        userAgent: req.headers["user-agent"]
      };
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "subscription-userinfo": "download=123; total=456",
        "profile-update-interval": "3600",
        "profile-title": "Kato"
      });
      return res.end('{"version":1}');
    }
    res.writeHead(500);
    res.end("boom");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    captured: () => captured,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function startEdge(backend, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "kato-edge-"));
  const statePath = join(dir, "agent-state.json");
  await writeFile(
    statePath,
    JSON.stringify({
      agentId: "agent_test",
      agentSecret: "agent_secret"
    })
  );
  const app = createSubscriptionEdgeApp({
    host: "127.0.0.1",
    port: 0,
    backendUrl: backend.url,
    agentStatePath: statePath,
    pathPrefix: options.pathPrefix || "go",
    requestTimeoutMs: 3000
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

test("subscription edge forwards subscription requests with agent auth", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend);
  try {
    const health = await fetch(`${edge.url}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok\n");

    const response = await fetch(`${edge.url}/go/sub_abc123`, {
      headers: {
        "user-agent": "sing-box/1.12.0"
      }
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(response.headers.get("subscription-userinfo"), "download=123; total=456");
    assert.equal(response.headers.get("profile-title"), "Kato");
    assert.deepEqual(await response.json(), { version: 1 });

    const captured = backend.captured();
    assert.equal(captured.url, "/api/v1/subscriptions/sub_abc123");
    assert.equal(captured.authorization, "Bearer agent_secret");
    assert.equal(captured.userAgent, "sing-box/1.12.0");
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge keeps unknown paths and upstream failures generic", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, { pathPrefix: "u" });
  try {
    const unknown = await fetch(`${edge.url}/sub_abc123`);
    assert.equal(unknown.status, 404);
    assert.equal(await unknown.text(), "");

    const wrongPrefix = await fetch(`${edge.url}/go/sub_abc123`);
    assert.equal(wrongPrefix.status, 404);

    const brokenBackend = await startFakeBackend();
    await brokenBackend.close();
    const brokenEdge = await startEdge(brokenBackend);
    try {
      const failed = await fetch(`${brokenEdge.url}/go/sub_abc123`);
      assert.equal(failed.status, 404);
      assert.equal(await failed.text(), "");
    } finally {
      await brokenEdge.close();
    }
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge rejects config without backend or bad prefix", () => {
  assert.throws(() => createSubscriptionEdgeApp({}), /backendUrl/);
  assert.doesNotThrow(() => createSubscriptionEdgeApp({ backendUrl: "http://x" }));
  assert.throws(
    () => createSubscriptionEdgeApp({ backendUrl: "http://x", pathPrefix: "bad path" }),
    /pathPrefix/
  );
});
