import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackendApp } from "../../backend-core/src/server.js";
import { createFrontendLocalApp, normalizePath, validateAdminPath } from "../src/server.js";

async function startBackend() {
  const dir = await mkdtemp(join(tmpdir(), "kato-fl-backend-"));
  const app = await createBackendApp({
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: "fl-admin-token"
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  await app.store.ensureAdminUser({ username: "admin", password: "fl-secret" });
  const pairing = await app.store.createFrontendToken({ name: "fl-front" });
  const session = await app.store.loginAdmin({ username: "admin", password: "fl-secret" });
  return {
    url: `http://127.0.0.1:${address.port}`,
    frontendToken: pairing.token,
    sessionToken: session.token,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

async function startLocalApp(backend, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "kato-fl-"));
  const siteRoot = join(dir, "www");
  const oldDir = join(siteRoot, "admin-0806");
  await mkdir(oldDir, { recursive: true });
  await writeFile(join(oldDir, "index.html"), "<html>spa</html>");
  const confPath = join(dir, "kato-panel-frontend.conf");
  await writeFile(
    confPath,
    `server {
  location = /admin-0806 { return 302 /admin-0806/; }
  location ^~ /admin-0806/ { try_files $uri $uri/ /admin-0806/index.html; }
}
`
  );
  const configPath = join(dir, "frontend-local.json");
  const app = createFrontendLocalApp({
    host: "127.0.0.1",
    port: 0,
    nginxConfPath: confPath,
    siteRoot,
    backendUrl: backend.url,
    frontendToken: backend.frontendToken,
    adminPath: "/admin-0806",
    configPath,
    runner: options.runner
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    confPath,
    configPath,
    siteRoot,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

test("admin path helpers validate and normalize", () => {
  assert.equal(normalizePath("admin-1/"), "/admin-1");
  assert.equal(normalizePath("/admin-2"), "/admin-2");
  assert.equal(normalizePath(""), "");
  assert.equal(validateAdminPath("/admin-3"), "");
  assert.equal(validateAdminPath("admin-4"), "管理后台路径只能包含字母、数字、点、下划线和中横线");
  assert.equal(validateAdminPath("/admin bad"), "管理后台路径只能包含字母、数字、点、下划线和中横线");
  assert.equal(validateAdminPath("/"), "管理后台路径不能为空或 /");
});

test("frontend local settings requires admin session and changes admin path", async () => {
  const backend = await startBackend();
  const runner = (command) => {
    if (command === "nginx" || command === "systemctl") {
      return Promise.resolve({ ok: true, stdout: "", stderr: "" });
    }
    return Promise.resolve({ ok: false, stdout: "", stderr: "unknown" });
  };
  const local = await startLocalApp(backend, { runner });
  try {
    const settings = await fetch(`${local.url}/api/local/settings`);
    assert.equal(settings.status, 200);
    assert.deepEqual(await settings.json(), {
      adminPath: "/admin-0806",
      backendUrl: backend.url
    });

    const rejected = await fetch(`${local.url}/api/local/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminPath: "/admin-new", adminSessionToken: "sess_wrong" })
    });
    assert.equal(rejected.status, 401);

    const invalid = await fetch(`${local.url}/api/local/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminPath: "/bad path", adminSessionToken: backend.sessionToken })
    });
    assert.equal(invalid.status, 400);

    const changed = await fetch(`${local.url}/api/local/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminPath: "/admin-new", adminSessionToken: backend.sessionToken })
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(await changed.json(), { adminPath: "/admin-new", changed: true });

    const conf = await readFile(local.confPath, "utf8");
    assert.ok(conf.includes("location = /admin-new"));
    assert.ok(conf.includes("/admin-new/index.html"));
    assert.ok(!conf.includes("/admin-0806"));

    const moved = await readFile(join(local.siteRoot, "admin-new", "index.html"), "utf8");
    assert.equal(moved, "<html>spa</html>");

    const state = JSON.parse(await readFile(local.configPath, "utf8"));
    assert.equal(state.adminPath, "/admin-new");
  } finally {
    await local.close();
    await backend.close();
  }
});

test("frontend local rolls back when nginx test fails", async () => {
  const backend = await startBackend();
  const runner = (command, args) => {
    if (command === "nginx" && args[0] === "-t") {
      return Promise.resolve({ ok: false, stdout: "", stderr: "bad config" });
    }
    return Promise.resolve({ ok: true, stdout: "", stderr: "" });
  };
  const local = await startLocalApp(backend, { runner });
  try {
    const response = await fetch(`${local.url}/api/local/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminPath: "/admin-new", adminSessionToken: backend.sessionToken })
    });
    assert.equal(response.status, 500);
    const conf = await readFile(local.confPath, "utf8");
    assert.ok(conf.includes("/admin-0806"));
    assert.ok(!conf.includes("/admin-new"));
    await assert.rejects(() => readFile(join(local.siteRoot, "admin-new", "index.html")));
  } finally {
    await local.close();
    await backend.close();
  }
});
