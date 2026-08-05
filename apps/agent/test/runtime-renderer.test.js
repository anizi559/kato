import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { applyRuntimeConfig } from "../src/runtime-apply.js";
import { renderRuntimeBundle } from "../src/runtime-renderer.js";
import { renderSingboxConfig, validateRenderedBundle } from "../src/runtime-renderer.js";

test("proxy-node runtime renderer emits xray and hysteria2 configs", () => {
  const bundle = renderRuntimeBundle(proxyDesired());
  const xray = bundle.files.find((file) => file.component === "xray");
  const hysteria = bundle.files.find((file) => file.component === "hysteria2");
  const trafficStats = bundle.files.find((file) => file.component === "traffic-stats");

  assert.ok(xray);
  assert.ok(hysteria);
  assert.ok(trafficStats);
  const xrayConfig = JSON.parse(xray.content);
  assert.equal(xrayConfig.inbounds[0].protocol, "vless");
  assert.equal(xrayConfig.inbounds[0].settings.clients[0].id, "6b6fdf26-7f7d-42bf-85db-6a5556f81f18");
  assert.equal(xrayConfig.inbounds[0].streamSettings.security, "reality");
  assert.equal(xrayConfig.api.services[0], "StatsService");
  assert.deepEqual(xrayConfig.stats, {});
  assert.equal(xrayConfig.policy.levels[0].statsUserUplink, true);
  assert.equal(xrayConfig.policy.levels[0].statsUserDownlink, true);
  assert.equal(xrayConfig.policy.system.statsInboundUplink, true);
  assert.equal(xrayConfig.policy.system.statsInboundDownlink, true);

  assert.match(hysteria.content, /type: userpass/);
  assert.match(hysteria.content, /hy2-secret/);
  assert.match(hysteria.content, /trafficStats:/);
  assert.doesNotMatch(hysteria.content, /6b6fdf26-7f7d-42bf-85db-6a5556f81f18/);

  const trafficManifest = JSON.parse(trafficStats.content);
  assert.ok(trafficManifest.endpoints.some((endpoint) => endpoint.type === "xray"));
  assert.ok(trafficManifest.endpoints.some((endpoint) => endpoint.type === "hysteria2"));
});

test("transit-relay runtime renderer emits realm config", () => {
  const bundle = renderRuntimeBundle(relayDesired());
  const realm = bundle.files.find((file) => file.component === "realm");

  assert.ok(realm);
  const config = JSON.parse(realm.content);
  assert.equal(config.network.use_udp, false);
  assert.deepEqual(config.endpoints, [
    {
      listen: "0.0.0.0:8443",
      remote: "10.10.0.2:443",
      network: {
        no_tcp: false,
        use_udp: false
      }
    }
  ]);
});

test("anytls inbound renders sing-box config and passes validation", () => {
  const desired = {
    configVersion: 7,
    desiredState: {
      kind: "proxy-node",
      inbounds: [
        {
          id: "inbound_anytls",
          name: "SG AnyTLS",
          protocol: PROTOCOLS.ANYTLS,
          listen: "0.0.0.0",
          port: 443,
          config: {
            tls: {
              sni: "sg.example.com",
              certPath: "/etc/kato/certs/fullchain.pem",
              keyPath: "/etc/kato/certs/privkey.pem"
            }
          },
          users: [
            {
              userId: "user_1",
              credential: {
                type: "anytls",
                password: "anytls_secret"
              }
            }
          ]
        }
      ]
    }
  };
  const bundle = renderRuntimeBundle(desired);
  const singbox = bundle.files.find((file) => file.component === "sing-box");
  assert.ok(singbox);
  const config = JSON.parse(singbox.content);
  assert.equal(config.inbounds[0].type, "anytls");
  assert.equal(config.inbounds[0].listen_port, 443);
  assert.equal(config.inbounds[0].users[0].password, "anytls_secret");
  assert.equal(config.inbounds[0].tls.certificate_path, "/etc/kato/certs/fullchain.pem");
  assert.doesNotThrow(() => validateRenderedBundle(bundle));
  assert.equal(renderSingboxConfig(desired.desiredState.inbounds).outbounds[0].type, "direct");
});

test("runtime apply writes manifest and backs up existing runtime directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-runtime-"));
  const runtimeDir = join(dir, "runtime");
  const backupDir = join(dir, "backups");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, "old.txt"), "old");

  const result = await applyRuntimeConfig(
    {
      runtimeDir,
      backupDir
    },
    relayDesired()
  );

  assert.equal(result.files.includes("realm/config.json"), true);
  assert.ok(result.backupPath);
  assert.equal(await readFile(join(result.backupPath, "old.txt"), "utf8"), "old");
  const manifest = JSON.parse(await readFile(join(runtimeDir, "manifest.json"), "utf8"));
  assert.equal(manifest.kind, "transit-relay");
});

test("xray binary validation accepts rendered vless reality config", { skip: !hasCommand("xray") }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-xray-"));
  const result = await applyRuntimeConfig(
    {
      runtimeDir: join(dir, "runtime"),
      backupDir: join(dir, "backups"),
      binaryValidation: true,
      binaries: {
        xray: "xray"
      }
    },
    vlessOnlyDesired()
  );
  assert.equal(result.files.includes("xray/config.json"), true);
});

function proxyDesired() {
  return {
    agentId: "agent_proxy",
    configVersion: 3,
    desiredState: {
      kind: "proxy-node",
      proxyNode: { id: "proxy_1", name: "proxy-1" },
      accessNodes: [],
      runtime: { mode: "lite" },
      inbounds: [
        vlessInbound(),
        {
          id: "inbound_hy2",
          proxyNodeId: "proxy_1",
          name: "Hysteria2",
          protocol: PROTOCOLS.HYSTERIA2,
          listen: "0.0.0.0",
          port: 8443,
          transport: "udp",
          config: {
            tls: {
              certPath: "/tmp/test.crt",
              keyPath: "/tmp/test.key"
            },
            obfs: {
              enabled: true,
              password: "obfs-secret"
            },
            bandwidth: {
              upMbps: 50,
              downMbps: 100
            }
          },
          users: [
            {
              userId: "user_1",
              name: "alice",
              credential: {
                type: "hysteria2",
                password: "hy2-secret"
              }
            }
          ]
        }
      ]
    }
  };
}

function vlessOnlyDesired() {
  return {
    agentId: "agent_proxy",
    configVersion: 4,
    desiredState: {
      kind: "proxy-node",
      proxyNode: { id: "proxy_1", name: "proxy-1" },
      accessNodes: [],
      runtime: { mode: "lite" },
      inbounds: [vlessInbound()]
    }
  };
}

function vlessInbound() {
  return {
    id: "inbound_vless",
    proxyNodeId: "proxy_1",
    name: "VLESS",
    protocol: PROTOCOLS.VLESS_REALITY,
    listen: "127.0.0.1",
    port: 24443,
    transport: "tcp",
    config: {
      reality: {
        privateKey: "IN8l6r-Q8Pyzlb2qYEHM9_eTlIWKfLxY2w0LDgtX-Hw",
        publicKey: "JuA13R7Kq8SqflWnybkbzF5qJyF_eW4iIQm8rdt-4GA",
        shortIds: ["abcd1234"],
        serverNames: ["www.apple.com"],
        dest: "www.apple.com:443",
        spiderX: "/"
      }
    },
    users: [
      {
        userId: "user_1",
        name: "alice",
        credential: {
          type: "vless",
          uuid: "6b6fdf26-7f7d-42bf-85db-6a5556f81f18",
          flow: "xtls-rprx-vision"
        }
      }
    ]
  };
}

function relayDesired() {
  return {
    agentId: "agent_relay",
    configVersion: 5,
    desiredState: {
      kind: "transit-relay",
      relay: { id: "relay_1", name: "relay-1" },
      runtime: { mode: "lite" },
      relayRules: [
        {
          id: "rule_1",
          name: "rule-1",
          transport: "tcp",
          entry: {
            host: "0.0.0.0",
            port: 8443
          },
          target: {
            host: "10.10.0.2",
            port: 443
          }
        }
      ]
    }
  };
}

function hasCommand(command) {
  return spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore"
  }).status === 0;
}
