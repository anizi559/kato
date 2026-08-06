import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackendApp } from "../src/server.js";

const ADMIN_TOKEN = "test-admin";

async function startTestServer() {
  const dir = await mkdtemp(join(tmpdir(), "kato-passwd-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    storePath: join(dir, "store.json"),
    adminToken: ADMIN_TOKEN
  };
  const app = await createBackendApp(config);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const address = app.server.address();
  await app.store.ensureAdminUser({ username: "admin", password: "oldpass123" });
  const pairing = await app.store.createFrontendToken({ name: "passwd-front" });
  return {
    ...app,
    url: `http://127.0.0.1:${address.port}`,
    frontendToken: pairing.token,
    close: () => new Promise((resolve) => app.server.close(resolve))
  };
}

test("admin can change own password and revokes other sessions", async () => {
  const app = await startTestServer();
  try {
    const sessionA = await login(app, "oldpass123");
    const sessionB = await login(app, "oldpass123");
    assert.notEqual(sessionA, sessionB);

    const wrongCurrent = await requestJson(app, "/api/v1/admin/me/password", {
      method: "POST",
      session: sessionA,
      body: { currentPassword: "wrongpass", newPassword: "newpass456" }
    });
    assert.equal(wrongCurrent.status, 401);

    const weak = await requestJson(app, "/api/v1/admin/me/password", {
      method: "POST",
      session: sessionA,
      body: { currentPassword: "oldpass123", newPassword: "short" }
    });
    assert.equal(weak.status, 400);

    const changed = await requestJson(app, "/api/v1/admin/me/password", {
      method: "POST",
      session: sessionA,
      body: { currentPassword: "oldpass123", newPassword: "newpass456" }
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.username, "admin");

    const oldLogin = await loginStatus(app, "oldpass123");
    assert.equal(oldLogin, 401);
    const newLogin = await loginStatus(app, "newpass456");
    assert.equal(newLogin, 200);

    const sessionBStillValid = await requestJson(app, "/api/v1/auth/session", {
      session: sessionB
    });
    assert.equal(sessionBStillValid.status, 401);

    const sessionAStillValid = await requestJson(app, "/api/v1/auth/session", {
      session: sessionA
    });
    assert.equal(sessionAStillValid.status, 200);
  } finally {
    await app.close();
  }
});

test("owner can reset admin password with admin token", async () => {
  const app = await startTestServer();
  try {
    const reset = await requestJson(app, "/api/v1/admin/admin-users/admin/password", {
      method: "PATCH",
      admin: true,
      body: { newPassword: "resetpass789" }
    });
    assert.equal(reset.status, 200);

    assert.equal(await loginStatus(app, "oldpass123"), 401);
    assert.equal(await loginStatus(app, "resetpass789"), 200);

    const missingAuth = await requestJson(app, "/api/v1/admin/admin-users/admin/password", {
      method: "PATCH",
      body: { newPassword: "another123" }
    });
    assert.equal(missingAuth.status, 401);
  } finally {
    await app.close();
  }
});

async function login(app, password) {
  const result = await requestJson(app, "/api/v1/auth/login", {
    method: "POST",
    frontend: true,
    body: { username: "admin", password }
  });
  assert.equal(result.status, 200);
  return result.body.token;
}

async function loginStatus(app, password) {
  const result = await requestJson(app, "/api/v1/auth/login", {
    method: "POST",
    frontend: true,
    body: { username: "admin", password }
  });
  return result.status;
}

async function requestJson(app, path, options = {}) {
  const headers = {};
  if (options.admin) {
    headers["x-admin-token"] = ADMIN_TOKEN;
  }
  if (options.frontend) {
    headers["x-frontend-token"] = app.frontendToken;
  }
  if (options.session) {
    headers["x-frontend-token"] = app.frontendToken;
    headers.authorization = `Bearer ${options.session}`;
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
