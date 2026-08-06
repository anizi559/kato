import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { applyRuntimeConfig } from "../src/runtime-apply.js";
import { renderRuntimeBundle, renderSingboxConfig, validateRenderedBundle } from "../src/runtime-renderer.js";

test("proxy-node runtime renderer emits sing-box anytls config", () => {
  const bundle = renderRuntimeBundle(proxyDesired());
  const singbox = bundle.files.find((file) => file.component === "sing-box");

  assert.ok(singbox);
  const config = JSON.parse(singbox.content);
  assert.equal(config.inbounds[0].type, "anytls");
  assert.equal(config.inbounds[0].listen_port, 8443);
  assert.equal(config.inbounds[0].users[0].password, "anytls_secret");
  assert.equal(config.inbounds[0].tls.certificate_path, "/var/lib/kato/certs/anytls.example.com/fullchain.pem");
  assert.doesNotThrow(() => validateRenderedBundle(bundle));
  assert.equal(renderSingboxConfig(proxyDesired().desiredState.inbounds).outbounds[0].type, "direct");
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

test("runtime apply writes certificates from desired state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-cert-apply-"));
  const runtimeDir = join(dir, "runtime");
  const certPath = join(dir, "certs", "anytls.example.com", "fullchain.pem");
  const keyPath = join(dir, "certs", "anytls.example.com", "privkey.pem");
  const result = await applyRuntimeConfig(
    {
      runtimeDir,
      backupDir: join(dir, "backups")
    },
    {
      configVersion: 9,
      desiredState: {
        kind: "proxy-node",
        inbounds: [],
        certificates: [
          {
            domain: "anytls.example.com",
            certPath,
            keyPath,
            certPem: "CERT-CONTENT",
            keyPem: "KEY-CONTENT"
          }
        ]
      }
    }
  );
  assert.ok(result.files.length >= 0);
  assert.equal(await readFile(certPath, "utf8"), "CERT-CONTENT");
  assert.equal(await readFile(keyPath, "utf8"), "KEY-CONTENT");
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

function proxyDesired() {
  return {
    agentId: "agent_proxy",
    configVersion: 3,
    desiredState: {
      kind: "proxy-node",
      proxyNode: { id: "proxy_1", name: "proxy-1" },
      accessNodes: [],
      runtime: { mode: "lite" },
      inbounds: [anytlsInbound()]
    }
  };
}

function anytlsInbound() {
  return {
    id: "inbound_anytls",
    proxyNodeId: "proxy_1",
    name: "HK AnyTLS",
    protocol: PROTOCOLS.ANYTLS,
    listen: "0.0.0.0",
    port: 8443,
    transport: "tcp",
    config: {
      tls: {
        sni: "anytls.example.com",
        certPath: "/var/lib/kato/certs/anytls.example.com/fullchain.pem",
        keyPath: "/var/lib/kato/certs/anytls.example.com/privkey.pem"
      }
    },
    users: [
      {
        userId: "user_1",
        name: "alice",
        credential: {
          type: "anytls",
          password: "anytls_secret"
        }
      }
    ]
  };
}

function relayDesired() {
  return {
    agentId: "agent_relay",
    configVersion: 2,
    desiredState: {
      kind: "transit-relay",
      relay: { id: "relay_1", name: "relay-1" },
      runtime: { mode: "lite" },
      relayRules: [
        {
          id: "rule_1",
          entry: { host: "0.0.0.0", port: 8443 },
          target: { host: "10.10.0.2", port: 443 },
          transport: "tcp"
        }
      ]
    }
  };
}
