import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS, VERSION } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-anytls-"));
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

test("anytls inbound compiles desired state and subscription formats", async () => {
  const app = await startTestServer();
  try {
    const plan = await adminPost(app, "plans", {
      name: "AnyTLS Plan",
      allowedProtocols: [PROTOCOLS.ANYTLS]
    });
    const user = await adminPost(app, "users", {
      name: "anytls-user",
      planId: plan.id
    });
    assert.match(user.credentials.anytlsPassword, /^anytls_/);
    assert.notEqual(user.credentials.anytlsPassword, user.credentials.vlessUuid);

    const proxyNode = await adminPost(app, "proxy-nodes", {
      name: "sg-anytls-01",
      publicHost: "sg.example.com",
      entryDomain: "sg.example.com"
    });
    const inbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: proxyNode.id,
      name: "SG AnyTLS",
      protocol: PROTOCOLS.ANYTLS,
      port: 443,
      config: {
        tls: {
          sni: "sg.example.com",
          certPath: "/etc/kato/certs/fullchain.pem",
          keyPath: "/etc/kato/certs/privkey.pem",
          insecure: true
        }
      }
    });
    assert.equal(inbound.transport, "tcp");
    assert.equal(inbound.config.tls.sni, "sg.example.com");

    const agent = await registerResourceAgent(app, "proxy-node", proxyNode.id, proxyNode.name);
    const desired = await getDesiredState(app, agent);
    assert.equal(desired.desiredState.inbounds.length, 1);
    assert.equal(desired.desiredState.inbounds[0].protocol, PROTOCOLS.ANYTLS);
    assert.equal(desired.desiredState.inbounds[0].users[0].credential.password, user.credentials.anytlsPassword);
    assert.equal(desired.desiredState.accessNodes.length, 0);

    const subAgent = await registerResourceAgent(app, "subscription-edge", null, "sub-anytls");
    const singbox = await fetchSubscription(app, subAgent, user.subscriptionToken, "sing-box/1.13.0");
    assert.equal(singbox.status, 200);
    const singboxPayload = await singbox.json();
    const anytlsOutbound = singboxPayload.outbounds.find((outbound) => outbound.type === "anytls");
    assert.ok(anytlsOutbound);
    assert.equal(anytlsOutbound.server, "sg.example.com");
    assert.equal(anytlsOutbound.server_port, 443);
    assert.equal(anytlsOutbound.password, user.credentials.anytlsPassword);
    assert.equal(anytlsOutbound.tls.server_name, "sg.example.com");
    assert.equal(anytlsOutbound.tls.insecure, true);

    const uri = await fetchSubscription(app, subAgent, user.subscriptionToken, "v2rayNG/1.9.0");
    const decoded = Buffer.from(await uri.text(), "base64").toString("utf8");
    assert.match(decoded, /^anytls:\/\//m);
    assert.match(decoded, /sni=sg\.example\.com/);
    assert.match(decoded, /insecure=1/);

    const clash = await fetchSubscription(app, subAgent, user.subscriptionToken, "ClashMeta/1.18.0");
    const clashYaml = await clash.text();
    assert.match(clashYaml, /type: "anytls"/);
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

async function getDesiredState(app, agent) {
  const response = await fetch(`${app.url}/api/v1/agents/${agent.agentId}/desired-state`, {
    headers: {
      authorization: `Bearer ${agent.agentSecret}`
    }
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function fetchSubscription(app, agent, token, userAgent) {
  return fetch(`${app.url}/api/v1/subscriptions/${encodeURIComponent(token)}`, {
    headers: {
      authorization: `Bearer ${agent.agentSecret}`,
      "user-agent": userAgent
    }
  });
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
