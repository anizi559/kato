import { PROTOCOLS } from "../packages/shared/src/protocol.js";

const baseUrl = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080";
const adminToken = process.env.BACKEND_ADMIN_TOKEN;
const proxyIp = process.env.KATO_TEST_PROXY_IP || "45.39.198.222";
const relayIp = process.env.KATO_TEST_RELAY_IP || "91.110.212.20";
const hy2CertPath = process.env.KATO_TEST_HY2_CERT_PATH || "/etc/kato/certs/hy2-selfsigned.crt";
const hy2KeyPath = process.env.KATO_TEST_HY2_KEY_PATH || "/etc/kato/certs/hy2-selfsigned.key";

if (!adminToken) {
  throw new Error("BACKEND_ADMIN_TOKEN is required");
}

const headers = {
  "x-admin-token": adminToken,
  "content-type": "application/json"
};

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text}`);
  }
  return payload;
}

async function list(collection) {
  return (await request("GET", `/api/v1/admin/${collection}`)).items;
}

async function findByName(collection, name) {
  return (await list(collection)).find((item) => item.name === name) || null;
}

async function createOnce(collection, name, body) {
  return (await findByName(collection, name)) || request("POST", `/api/v1/admin/${collection}`, { name, ...body });
}

async function patch(collection, id, body) {
  return request("PATCH", `/api/v1/admin/${collection}/${id}`, body);
}

async function createRelayAccess({ name, inbound, relay, proxy, entryPort, transport }) {
  const existing = await findByName("access-nodes", name);
  if (existing) {
    return existing;
  }
  const result = await request("POST", "/api/v1/admin/access-nodes", {
    type: "relay",
    name,
    inboundId: inbound.id,
    transitRelayId: relay.id,
    entryPort,
    transport,
    targetHost: proxy.publicIp,
    targetPort: inbound.port,
    groups: ["hk-test"],
    tags: ["integration-test"]
  });
  return result.accessNode;
}

const plan = await createOnce("plans", "itest-plan-hk", {
  enabled: true,
  allowedProtocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2],
  allowUdp: true,
  trafficLimitBytes: 1099511627776,
  speedLimitMbps: 200,
  hysteria2: { upMbps: 100, downMbps: 100 },
  tags: ["integration-test"]
});

const user = await createOnce("users", "itest-user-hk", {
  planId: plan.id,
  enabled: true,
  access: { protocols: [PROTOCOLS.VLESS_REALITY, PROTOCOLS.HYSTERIA2] },
  tags: ["integration-test"]
});

const proxy = await createOnce("proxy-nodes", "itest-proxy-hk-01", {
  enabled: true,
  region: "HK",
  provider: "test",
  publicHost: proxyIp,
  publicIp: proxyIp,
  privateIp: proxyIp,
  groups: ["hk-test"],
  tags: ["integration-test"]
});

const relay = await createOnce("transit-relays", "itest-relay-hk-01", {
  enabled: true,
  engine: PROTOCOLS.REALM,
  region: "HK",
  provider: "test",
  publicHost: relayIp,
  publicIp: relayIp,
  privateIp: relayIp,
  groups: ["hk-test"],
  tags: ["integration-test"]
});

const vless = await createOnce("node-inbounds", "itest-vless-reality-443", {
  proxyNodeId: proxy.id,
  protocol: PROTOCOLS.VLESS_REALITY,
  listen: "0.0.0.0",
  port: 443,
  transport: "tcp",
  directAccessName: "itest-direct-vless-443",
  groups: ["hk-test"],
  tags: ["integration-test"],
  config: {
    reality: {
      serverNames: ["www.microsoft.com"],
      dest: "www.microsoft.com:443",
      spiderX: "/"
    }
  }
});

let hy2 = await createOnce("node-inbounds", "itest-hysteria2-443", {
  proxyNodeId: proxy.id,
  protocol: PROTOCOLS.HYSTERIA2,
  listen: "0.0.0.0",
  port: 443,
  transport: "udp",
  directAccessName: "itest-direct-hy2-443",
  groups: ["hk-test"],
  tags: ["integration-test"],
  config: {
    obfs: { enabled: true, password: "itest-hy2-obfs" },
    bandwidth: { upMbps: 100, downMbps: 100 }
  }
});

hy2 = await patch("node-inbounds", hy2.id, {
  config: {
    ...hy2.config,
    tls: {
      ...(hy2.config?.tls || {}),
      certPath: hy2CertPath,
      keyPath: hy2KeyPath
    },
    obfs: {
      ...(hy2.config?.obfs || {}),
      enabled: true,
      type: "salamander",
      password: "itest-hy2-obfs"
    }
  }
});

const relayVless = await createRelayAccess({
  name: "itest-relay-vless-1443",
  inbound: vless,
  relay,
  proxy,
  entryPort: 1443,
  transport: "tcp"
});

const relayHy2 = await createRelayAccess({
  name: "itest-relay-hy2-2443",
  inbound: hy2,
  relay,
  proxy,
  entryPort: 2443,
  transport: "udp"
});

const proxyToken = await request("POST", "/api/v1/bootstrap-tokens", {
  role: "proxy-node",
  name: proxy.name,
  resourceId: proxy.id,
  ttlSeconds: 86400
});

const relayToken = await request("POST", "/api/v1/bootstrap-tokens", {
  role: "transit-relay",
  name: relay.name,
  resourceId: relay.id,
  ttlSeconds: 86400
});

console.log(JSON.stringify({
  planId: plan.id,
  userId: user.id,
  proxyNodeId: proxy.id,
  transitRelayId: relay.id,
  vlessInboundId: vless.id,
  hy2InboundId: hy2.id,
  relayVlessAccessId: relayVless.id,
  relayHy2AccessId: relayHy2.id,
  proxyBootstrapToken: proxyToken.token,
  relayBootstrapToken: relayToken.token
}, null, 2));
