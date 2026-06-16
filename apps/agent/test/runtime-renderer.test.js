import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { applyRuntimeConfig } from "../src/runtime-apply.js";
import { renderRuntimeBundle } from "../src/runtime-renderer.js";

test("proxy-node runtime renderer emits xray and hysteria2 configs", () => {
  const bundle = renderRuntimeBundle(proxyDesired());
  const xray = bundle.files.find((file) => file.component === "xray");
  const hysteria = bundle.files.find((file) => file.component === "hysteria2");

  assert.ok(xray);
  assert.ok(hysteria);
  const xrayConfig = JSON.parse(xray.content);
  assert.equal(xrayConfig.inbounds[0].protocol, "vless");
  assert.equal(xrayConfig.inbounds[0].settings.clients[0].id, "6b6fdf26-7f7d-42bf-85db-6a5556f81f18");
  assert.equal(xrayConfig.inbounds[0].streamSettings.security, "reality");

  assert.match(hysteria.content, /type: userpass/);
  assert.match(hysteria.content, /hy2-secret/);
  assert.doesNotMatch(hysteria.content, /6b6fdf26-7f7d-42bf-85db-6a5556f81f18/);
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
