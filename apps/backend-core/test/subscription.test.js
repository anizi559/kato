import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS, VERSION } from "../../../packages/shared/src/protocol.js";
import { createBackendApp } from "../src/server.js";
import { buildUris } from "../src/subscription.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-sub-"));
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

async function seedSubscriptions(app) {
  const plan = await adminPost(app, "plans", {
    name: "Pro",
    trafficLimitBytes: 10 * 1024 ** 3,
    durationDays: 30,
    allowedNodeGroups: ["default"]
  });
  const user = await adminPost(app, "users", {
    name: "alice",
    planId: plan.id
  });
  const proxyNode = await adminPost(app, "proxy-nodes", {
    name: "hk-01",
    publicHost: "hk.example.com",
    entryDomain: "hk.example.com",
    privateIp: "10.0.0.2",
    region: "HK",
    groups: ["default"]
  });
  const inbound = await adminPost(app, "node-inbounds", {
    proxyNodeId: proxyNode.id,
    name: "HK AnyTLS",
    protocol: PROTOCOLS.ANYTLS,
    port: 2053,
    groups: ["default"],
    config: {
      tls: {
        sni: "hk.example.com",
        certPath: "/var/lib/kato/certs/anytls/hk.example.com/fullchain.pem",
        keyPath: "/var/lib/kato/certs/anytls/hk.example.com/privkey.pem",
        insecure: false
      }
    }
  });
  const bootstrap = await createBootstrap(app, { role: "subscription-edge", name: "sub-edge-01" });
  const agent = await registerAgent(app, bootstrap.token, "sub-edge-01");
  return { plan, user, proxyNode, inbound, agent };
}

test("subscription endpoint returns sing-box json with visible nodes and userinfo headers", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);
    const response = await fetchSubscription(app, agent, user.subscriptionToken, {
      userAgent: "sing-box/1.13.0"
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.match(response.headers.get("subscription-userinfo"), /download=0/);
    assert.match(response.headers.get("subscription-userinfo"), /total=10737418240/);
    assert.ok(response.headers.get("profile-update-interval"));

    const payload = await response.json();
    assert.equal(payload.version, undefined);
    assert.equal(payload.outbounds.length, 1);
    const outbound = payload.outbounds[0];
    assert.equal(outbound.type, "anytls");
    assert.equal(outbound.server, "hk.example.com");
    assert.equal(outbound.server_port, 2053);
    assert.equal(outbound.password, user.credentials.anytlsPassword);
    assert.equal(outbound.tls.server_name, "hk.example.com");
    assert.equal(outbound.tls.insecure, false);
  } finally {
    await app.close();
  }
});

test("subscription filters nodes by checked entries, groups and enabled state", async () => {
  const app = await startTestServer();
  try {
    const { user, agent, inbound } = await seedSubscriptions(app);

    const jpProxy = await adminPost(app, "proxy-nodes", {
      name: "jp-01",
      publicHost: "jp.example.com",
      entryDomain: "jp.example.com",
      region: "JP",
      groups: ["default"]
    });
    const jpInbound = await adminPost(app, "node-inbounds", {
      proxyNodeId: jpProxy.id,
      name: "JP AnyTLS",
      protocol: PROTOCOLS.ANYTLS,
      port: 2053,
      groups: ["default"],
      config: {
        tls: {
          sni: "jp.example.com",
          certPath: "/var/lib/kato/certs/anytls/jp.example.com/fullchain.pem",
          keyPath: "/var/lib/kato/certs/anytls/jp.example.com/privkey.pem"
        }
      }
    });

    const hkOnlyPlan = await adminPost(app, "plans", {
      name: "HK Only",
      allowedAccessNodes: [`inbound:${inbound.id}`]
    });
    const hkUser = await adminPost(app, "users", {
      name: "hk-user",
      planId: hkOnlyPlan.id
    });
    const hkText = Buffer.from(
      await (await fetchSubscription(app, agent, hkUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.match(hkText, /hk\.example\.com/m);
    assert.doesNotMatch(hkText, /jp\.example\.com/m);

    const jpOverrideUser = await adminPost(app, "users", {
      name: "jp-override",
      planId: hkOnlyPlan.id,
      access: { accessNodes: [`inbound:${jpInbound.id}`] }
    });
    const jpText = Buffer.from(
      await (await fetchSubscription(app, agent, jpOverrideUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.match(jpText, /jp\.example\.com/m);
    assert.doesNotMatch(jpText, /hk\.example\.com/m);

    const wrongGroupUser = await adminPost(app, "users", {
      name: "dave",
      planId: hkOnlyPlan.id,
      access: { nodeGroups: ["free"] }
    });
    const wrongGroupText = Buffer.from(
      await (await fetchSubscription(app, agent, wrongGroupUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.equal(wrongGroupText.trim(), "");

    await adminPatch(app, `node-inbounds/${inbound.id}`, { enabled: false });
    const disabledText = Buffer.from(
      await (await fetchSubscription(app, agent, user.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.doesNotMatch(disabledText, /hk\.example\.com:2053/m);
  } finally {
    await app.close();
  }
});

test("subscription format follows user agent and defaults to base64 uri", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);

    const clashResponse = await fetchSubscription(app, agent, user.subscriptionToken, {
      userAgent: "ClashMeta/1.18.0"
    });
    assert.match(clashResponse.headers.get("content-type"), /text\/yaml/);
    const clashYaml = await clashResponse.text();
    assert.match(clashYaml, /type: "anytls"/);
    assert.match(clashYaml, /MATCH,PROXY/);

    const defaultResponse = await fetchSubscription(app, agent, user.subscriptionToken, {
      userAgent: "v2rayNG/1.9.0"
    });
    assert.match(defaultResponse.headers.get("content-type"), /text\/plain/);
    const decoded = Buffer.from(await defaultResponse.text(), "base64").toString("utf8");
    assert.match(decoded, /^anytls:\/\//m);
  } finally {
    await app.close();
  }
});

test("subscription uri builder produces valid anytls link", () => {
  const uris = buildUris([
    {
      name: "HK AnyTLS",
      host: "hk.example.com",
      port: 2053,
      transport: "tcp",
      protocol: PROTOCOLS.ANYTLS,
      password: "p@ss word",
      sni: "hk.example.com",
      insecure: false
    }
  ]);
  assert.equal(uris.length, 1);
  assert.match(uris[0], /^anytls:\/\/p%40ss%20word@hk\.example\.com:2053\?/);
  assert.match(uris[0], /sni=hk\.example\.com/);
  assert.match(uris[0], /insecure=0/);
});

test("subscription endpoint rejects invalid credentials, roles and tokens", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);

    const missingAuth = await fetch(`${app.url}/api/v1/subscriptions/${user.subscriptionToken}`);
    assert.equal(missingAuth.status, 401);

    const wrongRoleBootstrap = await createBootstrap(app, {
      role: "proxy-node",
      name: "bad-agent"
    });
    const wrongRole = await registerAgent(app, wrongRoleBootstrap.token, "bad-agent");
    const wrongRoleResponse = await fetchSubscription(app, wrongRole, user.subscriptionToken);
    assert.equal(wrongRoleResponse.status, 403);

    const invalidToken = await fetchSubscription(app, agent, "sub_does-not-exist");
    assert.equal(invalidToken.status, 404);

    const suspendedUser = await adminPatch(app, `users/${user.id}`, { enabled: false });
    assert.equal(suspendedUser.enabled, false);
    const suspendedResponse = await fetchSubscription(app, agent, user.subscriptionToken);
    assert.equal(suspendedResponse.status, 404);
  } finally {
    await app.close();
  }
});

test("admin can rotate subscription token and credentials, and update settings", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);
    const oldToken = user.subscriptionToken;
    const oldPassword = user.credentials.anytlsPassword;

    const resetResponse = await requestJson(app, `/api/v1/admin/users/${user.id}/subscription-token`, {
      method: "POST",
      admin: true
    });
    assert.equal(resetResponse.status, 200);
    const newToken = resetResponse.body.user.subscriptionToken;
    assert.match(newToken, /^sub_/);
    assert.notEqual(newToken, oldToken);
    assert.notEqual(resetResponse.body.user.credentials.anytlsPassword, oldPassword);

    const newSubscription = await fetchSubscription(app, agent, newToken);
    const newBody = Buffer.from(await newSubscription.text(), "base64").toString("utf8");
    assert.doesNotMatch(newBody, new RegExp(oldPassword));

    const settingsPatch = await requestJson(app, "/api/v1/admin/settings", {
      method: "PATCH",
      admin: true,
      body: {
        subscriptionUserinfo: false,
        subscriptionTitle: "Kato",
        subscriptionBaseUrl: "https://357602.xyz",
        defaultSubscriptionIntervalSeconds: 7200
      }
    });
    assert.equal(settingsPatch.status, 200);
    assert.equal(settingsPatch.body.subscriptionUserinfo, false);
    assert.equal(settingsPatch.body.subscriptionBaseUrl, "https://357602.xyz");

    const noHeadersResponse = await fetchSubscription(app, agent, newToken);
    assert.equal(noHeadersResponse.headers.get("subscription-userinfo"), null);
    assert.equal(noHeadersResponse.headers.get("profile-title"), "Kato");
    assert.equal(noHeadersResponse.headers.get("profile-update-interval"), "7200");
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

async function registerAgent(app, bootstrapToken, hostname) {
  const result = await requestJson(app, "/api/v1/agents/register", {
    method: "POST",
    body: {
      bootstrapToken,
      agentVersion: VERSION,
      hostname
    }
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function fetchSubscription(app, agent, token, options = {}) {
  return fetch(`${app.url}/api/v1/subscriptions/${encodeURIComponent(token)}`, {
    headers: {
      authorization: `Bearer ${agent.agentSecret}`,
      ...(options.userAgent ? { "user-agent": options.userAgent } : {})
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
