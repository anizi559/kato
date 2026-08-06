import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackendApp } from "../src/server.js";
import { randomSubdomain } from "../src/anytls-cert.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-cert-"));
  const app = await createBackendApp({
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: ADMIN_TOKEN
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  return {
    ...app,
    url: `http://127.0.0.1:${app.server.address().port}`,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

test("random subdomain has expected shape", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.match(randomSubdomain(), /^[0-9a-f]{8}-[0-9a-f]{4}$/);
  }
});

test("anytls cert issue validates settings, proxy and domain before network", async () => {
  const app = await startTestServer();
  try {
    const missingSettings = await requestJson(app, "/api/v1/admin/anytls-certs/issue", {
      method: "POST",
      admin: true,
      body: { proxyNodeId: "proxy_1", domain: "280427.xyz" }
    });
    assert.equal(missingSettings.status, 400);
    assert.match(missingSettings.body.message, /Cloudflare API Token/);

    await app.store.updateSettings({ cloudflareApiToken: "test-token", acmeEmail: "test@example.com" });

    const missingProxy = await requestJson(app, "/api/v1/admin/anytls-certs/issue", {
      method: "POST",
      admin: true,
      body: { proxyNodeId: "proxy_missing", domain: "280427.xyz" }
    });
    assert.equal(missingProxy.status, 404);

    const proxy = await requestJson(app, "/api/v1/admin/proxy-nodes", {
      method: "POST",
      admin: true,
      body: { name: "cert-node", publicIp: "1.2.3.4" }
    });
    assert.equal(proxy.status, 201);

    const badDomain = await requestJson(app, "/api/v1/admin/anytls-certs/issue", {
      method: "POST",
      admin: true,
      body: { proxyNodeId: proxy.body.id, domain: "not a domain" }
    });
    assert.equal(badDomain.status, 400);
    assert.match(badDomain.body.message, /域名格式不正确/);
  } finally {
    await app.close();
  }
});

async function requestJson(app, path, options = {}) {
  const headers = {};
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
