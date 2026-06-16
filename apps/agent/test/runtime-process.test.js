import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { PROTOCOLS } from "../../../packages/shared/src/protocol.js";
import { applyRuntimeConfig } from "../src/runtime-apply.js";
import {
  checkRuntimePorts,
  inspectRuntime,
  startManagedRuntime,
  stopManagedRuntime
} from "../src/runtime-process.js";

const execFileAsync = promisify(execFile);

test("managed runtime starts realm and forwards tcp traffic", { skip: !hasRealm() }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-realm-smoke-"));
  const targetPort = await getFreeTcpPort();
  const entryPort = await getFreeTcpPort();
  const echo = await startEchoServer(targetPort);
  const config = runtimeConfig(dir);

  try {
    await applyRuntimeConfig(config, relayDesired(entryPort, targetPort));
    const started = await startManagedRuntime(config);
    assert.equal(started.components[0].component, "realm");
    assert.equal(started.components[0].status, "started");

    await waitFor(async () => {
      const ports = await checkRuntimePorts(config);
      return ports.some((port) => port.component === "realm" && port.port === entryPort && port.status === "open");
    }, "realm tcp port to open");

    const response = await tcpRoundTrip(entryPort, "kato-ping");
    assert.equal(response, "kato-ping");

    const stopped = await stopManagedRuntime(config);
    assert.equal(stopped.components[0].component, "realm");
    const inspected = await inspectRuntime(config);
    assert.equal(inspected.components[0].running, false);
  } finally {
    await stopManagedRuntime(config).catch(() => {});
    await echo.close();
  }
});

test("managed runtime starts hysteria2 and exposes udp listener", { skip: !hasCommand("hysteria") }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-hysteria-smoke-"));
  const port = await getFreeTcpPort();
  const certPath = join(dir, "server.crt");
  const keyPath = join(dir, "server.key");
  const config = runtimeConfig(dir);

  await execFileAsync("hysteria", [
    "cert",
    "--host",
    "127.0.0.1",
    "--cert",
    certPath,
    "--key",
    keyPath,
    "--overwrite"
  ]);

  try {
    await applyRuntimeConfig(config, hysteriaDesired(port, certPath, keyPath));
    const started = await startManagedRuntime(config);
    assert.equal(started.components[0].component, "hysteria2");
    assert.equal(started.components[0].status, "started");

    const ports = await waitFor(async () => {
      const checks = await checkRuntimePorts(config);
      const check = checks.find((item) => item.component === "hysteria2" && item.port === port);
      return check && check.status !== "closed" ? checks : null;
    }, "hysteria2 udp listener to appear");
    const udp = ports.find((item) => item.component === "hysteria2" && item.port === port);
    assert.ok(["open", "unknown"].includes(udp.status));

    const inspected = await inspectRuntime(config);
    assert.equal(inspected.components[0].running, true);
  } finally {
    await stopManagedRuntime(config).catch(() => {});
  }
});

function runtimeConfig(dir) {
  return {
    runtimeDir: join(dir, "runtime"),
    backupDir: join(dir, "backups"),
    processDir: join(dir, "processes"),
    logDir: join(dir, "logs"),
    binaries: {
      hysteria: "hysteria",
      realm: resolve("tools/bin/realm")
    }
  };
}

function relayDesired(entryPort, targetPort) {
  return {
    agentId: "agent_relay",
    configVersion: 21,
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
            port: entryPort
          },
          target: {
            host: "127.0.0.1",
            port: targetPort
          }
        }
      ]
    }
  };
}

function hysteriaDesired(port, certPath, keyPath) {
  return {
    agentId: "agent_proxy",
    configVersion: 22,
    desiredState: {
      kind: "proxy-node",
      proxyNode: { id: "proxy_1", name: "proxy-1" },
      accessNodes: [],
      runtime: { mode: "lite" },
      inbounds: [
        {
          id: "inbound_hy2",
          proxyNodeId: "proxy_1",
          name: "Hysteria2",
          protocol: PROTOCOLS.HYSTERIA2,
          listen: "0.0.0.0",
          port,
          transport: "udp",
          config: {
            tls: {
              certPath,
              keyPath
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

function startEchoServer(port) {
  const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      socket.write(chunk);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve({
        close: () =>
          new Promise((closeResolve) => {
            server.close(closeResolve);
          })
      });
    });
  });
}

function tcpRoundTrip(port, payload) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
      timeout: 3000
    });
    const chunks = [];
    let settled = false;

    function finish(error, value) {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise(value);
      }
    }

    socket.once("connect", () => {
      socket.write(payload);
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      const response = Buffer.concat(chunks).toString("utf8");
      if (response.length >= payload.length) {
        finish(null, response);
      }
    });
    socket.once("timeout", () => finish(new Error("tcp round trip timed out")));
    socket.once("error", (error) => finish(error));
  });
}

function getFreeTcpPort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePromise(port));
    });
  });
}

async function waitFor(fn, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await fn();
    if (lastValue) {
      return lastValue;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function hasRealm() {
  return spawnSync(resolve("tools/bin/realm"), ["--version"], {
    stdio: "ignore"
  }).status === 0;
}

function hasCommand(command) {
  return spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore"
  }).status === 0;
}
