import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { assertRole, jsonResponse, methodNotAllowed, notFound, VERSION } from "../../../packages/shared/src/protocol.js";
import { createEtag, safeEqual, sha256 } from "./security.js";
import { JsonStore } from "./store.js";

const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8080,
  storePath: "data/backend-core.json",
  adminToken: process.env.BACKEND_ADMIN_TOKEN || "",
  adminCorsOrigins: parseCorsOrigins(process.env.BACKEND_ADMIN_CORS_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173")
};

export async function loadConfig(path = process.env.BACKEND_CONFIG) {
  if (!path) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = await readFile(path, "utf8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export async function createBackendApp(config = DEFAULT_CONFIG) {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  validateConfig(resolvedConfig);
  const store = new JsonStore(resolvedConfig.storePath);
  await store.load();

  async function handler(req, res) {
    try {
      await route(req, res, store, resolvedConfig);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      jsonResponse(res, statusCode, {
        error: statusCode === 500 ? "internal_error" : "request_error",
        message: error.message
      });
    }
  }

  return {
    store,
    server: createHttpServer(handler)
  };
}

function validateConfig(config) {
  if (!config.adminToken || config.adminToken === "change-me") {
    throw new Error("Backend admin token must be configured with BACKEND_ADMIN_TOKEN or backend-core config");
  }
}

function parseCorsOrigins(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCorsHeaders(req, res, config) {
  const origin = req.headers.origin;
  if (!origin) return;

  const allowedOrigins = parseCorsOrigins(config.adminCorsOrigins);
  if (!allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
    return;
  }

  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-admin-token,x-frontend-token,authorization,if-none-match");
  res.setHeader("access-control-expose-headers", "etag");
}

async function route(req, res, store, config) {
  applyCorsHeaders(req, res, config);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    return jsonResponse(res, 200, { ok: true, component: "backend-core", version: VERSION });
  }

  if (req.method === "GET" && path === "/version") {
    return jsonResponse(res, 200, {
      version: VERSION,
      schemaVersion: store.state.schemaVersion,
      compatibleRoles: ["frontend-edge", "subscription-edge", "proxy-node", "transit-relay"]
    });
  }

  if (path === "/api/v1/auth/login") {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    await requireFrontend(req, store);
    const body = await readJson(req);
    const session = await store.loginAdmin({
      username: body.username,
      password: body.password
    });
    return jsonResponse(res, 200, session);
  }

  if (path === "/api/v1/auth/session") {
    if (req.method !== "GET") {
      return methodNotAllowed(res);
    }
    await requireFrontend(req, store);
    const admin = requireAdminSession(req, store);
    return jsonResponse(res, 200, { user: admin.user, expiresAt: admin.session.expiresAt });
  }

  if (path === "/api/v1/auth/logout") {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    await requireFrontend(req, store);
    await store.revokeAdminSession(bearerToken(req));
    return jsonResponse(res, 200, { ok: true });
  }

  if (path === "/api/v1/bootstrap-tokens") {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    await requireAdmin(req, config, store);
    const body = await readJson(req);
    assertRole(body.role);
    const result = await store.createBootstrapToken({
      role: body.role,
      name: body.name || body.role,
      ttlSeconds: body.ttlSeconds || 900,
      resourceId: body.resourceId || null
    });
    return jsonResponse(res, 201, result);
  }

  if (path === "/api/v1/admin" || path.startsWith("/api/v1/admin/")) {
    await requireAdmin(req, config, store);
    return routeAdmin(req, res, store, path, url);
  }

  if (path === "/api/v1/agents/register") {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    const body = await readJson(req);
    const bootstrap = await store.consumeBootstrapToken(body.bootstrapToken);
    const { agent, agentSecret } = await store.registerAgent({
      role: bootstrap.role,
      name: bootstrap.name,
      version: body.agentVersion || "unknown",
      hostname: body.hostname || "unknown",
      capabilities: body.capabilities,
      resourceId: bootstrap.resourceId || null
    });
    return jsonResponse(res, 201, {
      agentId: agent.id,
      agentSecret,
      role: agent.role,
      name: agent.name,
      backendVersion: VERSION
    });
  }

  const heartbeatMatch = path.match(/^\/api\/v1\/agents\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch) {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    const agent = requireAgent(req, store, heartbeatMatch[1]);
    const body = await readJson(req);
    await store.updateHeartbeat(agent.id, body.actualState);
    return jsonResponse(res, 200, { ok: true, commands: [] });
  }

  const desiredMatch = path.match(/^\/api\/v1\/agents\/([^/]+)\/desired-state$/);
  if (desiredMatch) {
    if (req.method !== "GET") {
      return methodNotAllowed(res);
    }
    const agent = requireAgent(req, store, desiredMatch[1]);
    const desired = store.findDesiredState(agent.id);
    if (!desired) {
      return jsonResponse(res, 404, { error: "desired_state_not_found" });
    }
    const etag = createEtag(desired);
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { etag });
      return res.end();
    }
    return jsonResponse(res, 200, desired, { etag });
  }

  const reportMatch = path.match(/^\/api\/v1\/agents\/([^/]+)\/reports\/config-applied$/);
  if (reportMatch) {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    const agent = requireAgent(req, store, reportMatch[1]);
    const body = await readJson(req);
    const report = await store.recordConfigApplied(agent.id, body);
    return jsonResponse(res, 200, { ok: true, report });
  }

  return notFound(res);
}

async function routeAdmin(req, res, store, path, url) {
  const segments = path
    .slice("/api/v1/admin".length)
    .split("/")
    .filter(Boolean);

  if (!segments.length || segments[0] === "summary") {
    if (req.method !== "GET") {
      return methodNotAllowed(res);
    }
    return jsonResponse(res, 200, store.summary());
  }

  if (segments[0] === "agents") {
    if (req.method !== "GET") {
      return methodNotAllowed(res);
    }
    return jsonResponse(res, 200, { agents: store.listAgents() });
  }

  if (segments[0] === "access-nodes" && segments[1] === "relay") {
    if (req.method !== "POST") {
      return methodNotAllowed(res);
    }
    const body = await readJson(req);
    const result = await store.createResource("access-nodes", {
      ...body,
      type: "relay"
    });
    return jsonResponse(res, 201, result);
  }

  const collection = segments[0];
  if (segments.length === 1) {
    if (req.method === "GET") {
      return jsonResponse(res, 200, { items: store.listResources(collection) });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const record = await store.createResource(collection, body);
      return jsonResponse(res, 201, record);
    }
    return methodNotAllowed(res);
  }

  if (segments.length === 2) {
    const id = segments[1];
    if (req.method === "GET") {
      const record = store.getResource(collection, id);
      if (!record) {
        return notFound(res);
      }
      return jsonResponse(res, 200, record);
    }
    if (req.method === "PATCH") {
      const body = await readJson(req);
      const record = await store.updateResource(collection, id, body);
      return jsonResponse(res, 200, record);
    }
    if (req.method === "DELETE") {
      const result = await store.deleteResource(collection, id, {
        deleteRelayRule: url.searchParams.get("deleteRelayRule") !== "false"
      });
      return jsonResponse(res, 200, result);
    }
    return methodNotAllowed(res);
  }

  return notFound(res);
}

async function requireAdmin(req, config, store) {
  const token = req.headers["x-admin-token"];
  if (token && safeEqual(token, config.adminToken)) {
    return { source: "admin-token" };
  }
  await requireFrontend(req, store);
  const admin = requireAdminSession(req, store);
  return { source: "admin-session", ...admin };
}

async function requireFrontend(req, store) {
  const token = req.headers["x-frontend-token"];
  if (!(await store.validateFrontendToken(token))) {
    throw Object.assign(new Error("Invalid frontend token"), { statusCode: 401 });
  }
}

function requireAdminSession(req, store) {
  const session = store.findAdminSession(bearerToken(req));
  if (!session) {
    throw Object.assign(new Error("Invalid admin session"), { statusCode: 401 });
  }
  return session;
}

function requireAgent(req, store, agentId) {
  const agent = store.findAgent(agentId);
  if (!agent) {
    throw Object.assign(new Error("Agent not found"), { statusCode: 404 });
  }
  const token = bearerToken(req);
  if (!token || !safeEqual(sha256(token), agent.secretHash)) {
    throw Object.assign(new Error("Invalid agent token"), { statusCode: 401 });
  }
  return agent;
}

function bearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = await loadConfig();
  const { server } = await createBackendApp(config);
  server.listen(config.port, config.host, () => {
    console.log(`backend-core listening on http://${config.host}:${config.port}`);
  });
}
