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
    allowedProtocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2],
    allowedNodeGroups: ["premium"],
    allowUdp: true,
    hysteria2: {
      upMbps: 60,
      downMbps: 200
    }
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
    groups: ["premium"]
  });
  const vlessInbound = await adminPost(app, "node-inbounds", {
    proxyNodeId: proxyNode.id,
    name: "HK VLESS",
    protocol: PROTOCOLS.VLESS_REALITY,
    port: 443,
    groups: ["premium"],
    config: {
      reality: {
        publicKey: "reality-public-key",
        privateKey: "reality-private-key",
        shortIds: ["abcd1234"],
        serverNames: ["www.apple.com"],
        dest: "www.apple.com:443",
        spiderX: "/"
      }
    }
  });
  const hy2Inbound = await adminPost(app, "node-inbounds", {
    proxyNodeId: proxyNode.id,
    name: "HK Hysteria2",
    protocol: PROTOCOLS.HYSTERIA2,
    port: 8443,
    groups: ["premium"],
    config: {
      sni: "hk.example.com",
      obfsPassword: "obfs-secret",
      upMbps: 50,
      downMbps: 120
    }
  });
  const bootstrap = await createBootstrap(app, { role: "subscription-edge", name: "sub-edge-01" });
  const agent = await registerAgent(app, bootstrap.token, "sub-edge-01");
  return { plan, user, proxyNode, vlessInbound, hy2Inbound, agent };
}

async function fetchSubscription(app, agent, token, options = {}) {
  return fetch(`${app.url}/api/v1/subscriptions/${encodeURIComponent(token)}`, {
    headers: {
      authorization: `Bearer ${agent.agentSecret}`,
      ...(options.userAgent ? { "user-agent": options.userAgent } : {})
    }
  });
}

test("subscription endpoint returns sing-box json with visible nodes and userinfo headers", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);
    const response = await fetchSubscription(app, agent, user.subscriptionToken, {
      userAgent: "sing-box/1.12.0"
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.match(response.headers.get("subscription-userinfo"), /download=0/);
    assert.match(response.headers.get("subscription-userinfo"), /total=10737418240/);
    assert.ok(response.headers.get("profile-update-interval"));

    const payload = await response.json();
    assert.equal(payload.version, undefined);
    assert.equal(payload.outbounds.length, 2);
    const vless = payload.outbounds.find((outbound) => outbound.type === "vless");
    const hy2 = payload.outbounds.find((outbound) => outbound.type === "hysteria2");
    assert.equal(vless.server, "hk.example.com");
    assert.equal(vless.server_port, 443);
    assert.equal(vless.uuid, user.credentials.vlessUuid);
    assert.equal(vless.tls.reality.public_key, "reality-public-key");
    assert.equal(vless.tls.reality.short_id, "abcd1234");
    assert.equal(hy2.server_port, 8443);
    assert.equal(hy2.password, user.credentials.hysteria2Password);
    assert.equal(hy2.obfs.password, "obfs-secret");
    assert.equal(hy2.up_mbps, 60);
    assert.equal(hy2.down_mbps, 200);
  } finally {
    await app.close();
  }
});

test("subscription supports all protocols and filters by regions, groups and enabled state", async () => {
  const app = await startTestServer();
  try {
    const { user, agent, vlessInbound, hy2Inbound } = await seedSubscriptions(app);

    const jpProxy = await adminPost(app, "proxy-nodes", {
      name: "jp-01",
      publicHost: "jp.example.com",
      entryDomain: "jp.example.com",
      region: "JP",
      groups: ["default"]
    });
    await adminPost(app, "node-inbounds", {
      proxyNodeId: jpProxy.id,
      name: "JP VLESS",
      protocol: PROTOCOLS.VLESS_REALITY,
      port: 8443,
      groups: ["default"]
    });

    // 权限组不再限制协议：即使 plan 只写了 vless，hysteria2 节点也会下发
    const protocolIgnored = await adminPost(app, "plans", {
      name: "Protocol Ignored",
      allowedProtocols: [PROTOCOLS.VLESS_REALITY]
    });
    const protocolIgnoredUser = await adminPost(app, "users", {
      name: "carol",
      planId: protocolIgnored.id
    });
    const protocolIgnoredText = Buffer.from(
      await (await fetchSubscription(app, agent, protocolIgnoredUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.match(protocolIgnoredText, /^vless:\/\//m);
    assert.match(protocolIgnoredText, /^hysteria2:\/\//m);

    // 节点勾选：HK Only 只勾选香港的两个节点
    const accessNodes = await adminList(app, "access-nodes");
    const hkVlessAccess = accessNodes.find((item) => item.inboundId === vlessInbound.id);
    const hkHy2Access = accessNodes.find((item) => item.inboundId === hy2Inbound.id);
    const jpAccess = accessNodes.find((item) => item.host === "jp.example.com");
    const hkOnlyPlan = await adminPost(app, "plans", {
      name: "HK Only",
      allowedAccessNodes: [hkVlessAccess.id, hkHy2Access.id]
    });
    const hkOnlyUser = await adminPost(app, "users", {
      name: "hk-user",
      planId: hkOnlyPlan.id
    });
    const hkOnlyText = Buffer.from(
      await (await fetchSubscription(app, agent, hkOnlyUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.match(hkOnlyText, /hk\.example\.com/m);
    assert.doesNotMatch(hkOnlyText, /jp\.example\.com/m);

    // 用户级节点覆盖：plan 未限制，用户只勾选 JP 节点
    const jpOverrideUser = await adminPost(app, "users", {
      name: "jp-override",
      planId: protocolIgnored.id,
      access: { accessNodes: [jpAccess.id] }
    });
    const jpOverrideText = Buffer.from(
      await (await fetchSubscription(app, agent, jpOverrideUser.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.match(jpOverrideText, /jp\.example\.com/m);
    assert.doesNotMatch(jpOverrideText, /hk\.example\.com/m);

    // 分组过滤仍然生效
    const wrongGroupUser = await adminPost(app, "users", {
      name: "dave",
      planId: hkOnlyPlan.id,
      access: { nodeGroups: ["free"] }
    });
    const wrongGroupResponse = await fetchSubscription(app, agent, wrongGroupUser.subscriptionToken);
    assert.equal(wrongGroupResponse.status, 200);
    const wrongGroupText = Buffer.from(await wrongGroupResponse.text(), "base64").toString("utf8");
    assert.equal(wrongGroupText.trim(), "");

    // 停用节点仍然隐藏
    await adminPatch(app, `access-nodes/${hkVlessAccess.id}`, { enabled: false });
    const disabledText = Buffer.from(
      await (await fetchSubscription(app, agent, user.subscriptionToken)).text(),
      "base64"
    ).toString("utf8");
    assert.doesNotMatch(disabledText, /hk\.example\.com:443/m);
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
    assert.equal(clashResponse.status, 200);
    assert.match(clashResponse.headers.get("content-type"), /text\/yaml/);
    const clashYaml = await clashResponse.text();
    assert.match(clashYaml, /type: "vless"/);
    assert.match(clashYaml, /type: "hysteria2"/);
    assert.match(clashYaml, /MATCH,PROXY/);

    const defaultResponse = await fetchSubscription(app, agent, user.subscriptionToken, {
      userAgent: "v2rayNG/1.9.0"
    });
    assert.equal(defaultResponse.status, 200);
    assert.match(defaultResponse.headers.get("content-type"), /text\/plain/);
    const decoded = Buffer.from(await defaultResponse.text(), "base64").toString("utf8");
    assert.match(decoded, /^vless:\/\//m);
    assert.match(decoded, /^hysteria2:\/\//m);
  } finally {
    await app.close();
  }
});

test("subscription uri builders produce valid vless and hysteria2 links", () => {
  const uris = buildUris([
    {
      name: "HK VLESS",
      host: "hk.example.com",
      port: 443,
      transport: "tcp",
      protocol: PROTOCOLS.VLESS_REALITY,
      uuid: "11111111-2222-3333-4444-555555555555",
      flow: "xtls-rprx-vision",
      sni: "www.apple.com",
      publicKey: "pub-key",
      shortId: "abcd1234",
      spiderX: "/",
      fingerprint: "chrome"
    },
    {
      name: "HK HY2",
      host: "hk.example.com",
      port: 8443,
      transport: "udp",
      protocol: PROTOCOLS.HYSTERIA2,
      password: "p@ss word",
      sni: "hk.example.com",
      obfsEnabled: true,
      obfsType: "salamander",
      obfsPassword: "obfs-secret",
      upMbps: 50,
      downMbps: 120,
      insecure: false
    }
  ]);
  assert.equal(uris.length, 2);
  assert.match(uris[0], /^vless:\/\/11111111-2222-3333-4444-555555555555@hk\.example\.com:443\?/);
  assert.match(uris[0], /security=reality/);
  assert.match(uris[0], /pbk=pub-key/);
  assert.match(uris[1], /^hysteria2:\/\/p%40ss%20word@hk\.example\.com:8443\?/);
  assert.match(uris[1], /obfs-password=obfs-secret/);
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

test("admin can reset subscription token and update settings", async () => {
  const app = await startTestServer();
  try {
    const { user, agent } = await seedSubscriptions(app);
    const oldToken = user.subscriptionToken;

    const resetResponse = await requestJson(app, `/api/v1/admin/users/${user.id}/subscription-token`, {
      method: "POST",
      admin: true
    });
    assert.equal(resetResponse.status, 200);
    const newToken = resetResponse.body.user.subscriptionToken;
    assert.match(newToken, /^sub_/);
    assert.notEqual(newToken, oldToken);

    const oldTokenResponse = await fetchSubscription(app, agent, oldToken);
    assert.equal(oldTokenResponse.status, 404);
    const newTokenResponse = await fetchSubscription(app, agent, newToken);
    assert.equal(newTokenResponse.status, 200);

    const settingsPatch = await requestJson(app, "/api/v1/admin/settings", {
      method: "PATCH",
      admin: true,
      body: {
        subscriptionUserinfo: false,
        subscriptionTitle: "Kato",
        subscriptionBaseUrl: "https://katotool.com",
        defaultSubscriptionIntervalSeconds: 7200
      }
    });
    assert.equal(settingsPatch.status, 200);
    assert.equal(settingsPatch.body.subscriptionUserinfo, false);
    assert.equal(settingsPatch.body.subscriptionBaseUrl, "https://katotool.com");

    const noHeadersResponse = await fetchSubscription(app, agent, newToken);
    assert.equal(noHeadersResponse.headers.get("subscription-userinfo"), null);
    assert.equal(noHeadersResponse.headers.get("profile-title"), "Kato");
    assert.equal(noHeadersResponse.headers.get("profile-update-interval"), "7200");

    const settings = await requestJson(app, "/api/v1/admin/settings", { admin: true });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.subscriptionPathPrefix, "go");
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

async function adminList(app, collection) {
  const result = await requestJson(app, `/api/v1/admin/${collection}`, {
    admin: true
  });
  assert.equal(result.status, 200);
  return result.body.items;
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
