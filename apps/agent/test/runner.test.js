import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackendApp } from "../../backend-core/src/server.js";
import { writeJsonFile } from "../src/config.js";
import { runOffline, runOnce } from "../src/runner.js";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-agent-backend-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: "test-admin"
  };
  const app = await createBackendApp(config);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  return {
    ...app,
    dir,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

async function createBootstrap(url) {
  const response = await fetch(`${url}/api/v1/bootstrap-tokens`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": "test-admin"
    },
    body: JSON.stringify({
      role: "proxy-node",
      name: "agent-test"
    })
  });
  const body = await response.json();
  return body.token;
}

test("agent registers, applies desired state, then uses etag on next run", async () => {
  const app = await startTestServer();
  try {
    const agentDir = await mkdtemp(join(tmpdir(), "kato-agent-"));
    const config = {
      backendUrl: app.url,
      role: "proxy-node",
      name: "agent-test",
      bootstrapToken: await createBootstrap(app.url),
      statePath: join(agentDir, "state.json"),
      lastKnownGoodPath: join(agentDir, "lkg.json"),
      renderedConfigPath: join(agentDir, "rendered.json")
    };

    const first = await runOnce(config);
    assert.equal(first.changed, true);
    assert.equal(first.mode, "online");
    assert.equal(first.configVersion, 1);

    const second = await runOnce(config);
    assert.equal(second.changed, false);
    assert.equal(second.mode, "online");

    const rendered = JSON.parse(await readFile(config.renderedConfigPath, "utf8"));
    assert.equal(rendered.desired.configVersion, 1);
  } finally {
    await app.close();
  }
});

test("agent offline mode uses last known good config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kato-agent-offline-"));
  const config = {
    backendUrl: "http://127.0.0.1:9",
    role: "proxy-node",
    name: "offline-test",
    bootstrapToken: "unused",
    statePath: join(dir, "state.json"),
    lastKnownGoodPath: join(dir, "lkg.json"),
    renderedConfigPath: join(dir, "rendered.json")
  };
  await writeJsonFile(config.lastKnownGoodPath, {
    configVersion: 7,
    desiredState: { kind: "proxy-node", inbounds: [] }
  });

  const result = await runOffline(config, new Error("connection refused"));
  assert.equal(result.mode, "offline");
  assert.equal(result.configVersion, 7);
});

test("agent preserves control-plane auth errors instead of treating them as offline", async () => {
  const app = await startTestServer();
  try {
    const agentDir = await mkdtemp(join(tmpdir(), "kato-agent-auth-error-"));
    const config = {
      backendUrl: app.url,
      role: "proxy-node",
      name: "auth-error-test",
      bootstrapToken: "unused",
      statePath: join(agentDir, "state.json"),
      lastKnownGoodPath: join(agentDir, "lkg.json"),
      renderedConfigPath: join(agentDir, "rendered.json")
    };
    await writeJsonFile(config.statePath, {
      agentId: "agent_missing",
      agentSecret: "wrong"
    });
    await writeJsonFile(config.lastKnownGoodPath, {
      configVersion: 7,
      desiredState: { kind: "proxy-node", inbounds: [] }
    });

    await assert.rejects(
      () => runOnce(config),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.match(error.message, /heartbeat failed/);
        return true;
      }
    );
  } finally {
    await app.close();
  }
});
