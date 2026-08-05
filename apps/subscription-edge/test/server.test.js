import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSubscriptionEdgeApp } from "../src/server.js";

async function startFakeBackend() {
  let captured = null;
  let requestCount = 0;
  const server = createHttpServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/v1/subscriptions/")) {
      requestCount += 1;
      const ua = String(req.headers["user-agent"] || "").toLowerCase();
      let contentType = "text/plain; charset=utf-8";
      let format = "uri";
      if (ua.includes("sing-box") || ua.includes("singbox")) {
        contentType = "application/json; charset=utf-8";
        format = "sing-box";
      } else if (ua.includes("clash") || ua.includes("mihomo") || ua.includes("stash")) {
        contentType = "text/yaml; charset=utf-8";
        format = "clash";
      }
      captured = {
        url: req.url,
        authorization: req.headers.authorization,
        userAgent: req.headers["user-agent"],
        format
      };
      res.writeHead(200, {
        "content-type": contentType,
        "x-kato-format": format,
        "subscription-userinfo": "download=123; total=456",
        "profile-update-interval": "3600",
        "profile-title": "Kato"
      });
      return res.end(format === "uri" ? "dXJpLWNvbnRlbnQ=" : `{"version":1,"format":"${format}"}`);
    }
    res.writeHead(500);
    res.end("boom");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    captured: () => captured,
    requestCount: () => requestCount,
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
    requestTimeoutMs: 3000,
    ...options
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
    assert.deepEqual(await response.json(), { version: 1, format: "sing-box" });

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

test("subscription edge serves cached responses within ttl", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, { cacheTtlSeconds: 60 });
  try {
    const first = await fetch(`${edge.url}/go/sub_cached`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-kato-cache"), "miss");
    assert.equal(backend.requestCount(), 1);

    const second = await fetch(`${edge.url}/go/sub_cached`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-kato-cache"), "hit");
    assert.equal(backend.requestCount(), 1);
    assert.match(second.headers.get("cache-control"), /max-age=60/);
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge expires cache after ttl", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, { cacheTtlSeconds: 1, staleIfErrorSeconds: 0 });
  try {
    await fetch(`${edge.url}/go/sub_expire`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await fetch(`${edge.url}/go/sub_expire`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-kato-cache"), "miss");
    assert.equal(backend.requestCount(), 2);
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge rate limits per token", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, {
    rateLimitPerMinute: 1,
    rateLimitBurst: 1,
    cacheTtlSeconds: 0
  });
  try {
    const first = await fetch(`${edge.url}/go/sub_limited`);
    assert.equal(first.status, 200);
    const second = await fetch(`${edge.url}/go/sub_limited`);
    assert.equal(second.status, 429);
    const otherToken = await fetch(`${edge.url}/go/sub_other`);
    assert.equal(otherToken.status, 200);
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge caches per format so different clients get correct content", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, { cacheTtlSeconds: 60 });
  try {
    const singbox = await fetch(`${edge.url}/go/sub_formats`, {
      headers: { "user-agent": "sing-box/1.13.0" }
    });
    assert.equal(singbox.status, 200);
    assert.match(singbox.headers.get("content-type"), /application\/json/);
    assert.equal(backend.requestCount(), 1);

    const singboxAgain = await fetch(`${edge.url}/go/sub_formats`, {
      headers: { "user-agent": "sing-box/1.13.0" }
    });
    assert.equal(singboxAgain.headers.get("x-kato-cache"), "hit");
    assert.equal(backend.requestCount(), 1);

    const clash = await fetch(`${edge.url}/go/sub_formats`, {
      headers: { "user-agent": "ClashMeta/1.18.0" }
    });
    assert.equal(clash.status, 200);
    assert.match(clash.headers.get("content-type"), /text\/yaml/);
    assert.equal(backend.requestCount(), 2);
    assert.equal(clash.headers.get("x-kato-cache"), "miss");
    assert.deepEqual(await clash.json(), { version: 1, format: "clash" });
  } finally {
    await edge.close();
    await backend.close();
  }
});

test("subscription edge serves stale cache when backend is down", async () => {
  const backend = await startFakeBackend();
  const edge = await startEdge(backend, {
    cacheTtlSeconds: 1,
    staleIfErrorSeconds: 300
  });
  try {
    await fetch(`${edge.url}/go/sub_stale`);
    await backend.close();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const stale = await fetch(`${edge.url}/go/sub_stale`);
    assert.equal(stale.status, 200);
    assert.equal(stale.headers.get("x-kato-cache"), "stale");
    assert.equal(await stale.text(), "dXJpLWNvbnRlbnQ=");
  } finally {
    await edge.close();
  }
});
