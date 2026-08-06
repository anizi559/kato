import { createServer as createHttpServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { URL } from "node:url";

const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8090,
  nginxConfPath: "/etc/nginx/sites-available/kato-panel-frontend.conf",
  nginxEnabledPath: "/etc/nginx/sites-enabled/kato-panel-frontend.conf",
  siteRoot: "/var/www/kato-panel-frontend",
  backendUrl: "",
  frontendToken: "",
  adminPath: "",
  requestTimeoutMs: 10000
};

export function createFrontendLocalApp(config = DEFAULT_CONFIG) {
  const resolvedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    configPath: config.configPath || process.env.FRONTEND_LOCAL_CONFIG || "configs/frontend-local.json",
    adminPath: normalizePath(config.adminPath || ""),
    runner: config.runner || runCommand
  };
  validateConfig(resolvedConfig);

  async function handler(req, res) {
    try {
      await route(req, res, resolvedConfig);
    } catch (error) {
      jsonResponse(res, error.statusCode || 500, {
        error: error.statusCode === 500 ? "internal_error" : "request_error",
        message: error.message
      });
    }
  }

  return {
    server: createHttpServer(handler)
  };
}

async function route(req, res, config) {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    return res.end("ok\n");
  }

  if (req.method === "GET" && path === "/api/local/settings") {
    return jsonResponse(res, 200, {
      adminPath: config.adminPath,
      backendUrl: config.backendUrl
    });
  }

  if (req.method === "POST" && path === "/api/local/settings") {
    const body = await readJson(req);
    const newPath = normalizePath(body.adminPath || "");
    const error = validateAdminPath(newPath);
    if (error) {
      throw httpError(error, 400);
    }
    if (newPath === config.adminPath) {
      return jsonResponse(res, 200, { adminPath: config.adminPath, changed: false });
    }
    await requireAdminSession(config, body.adminSessionToken);
    await applyAdminPathChange(config, newPath);
    return jsonResponse(res, 200, { adminPath: newPath, changed: true });
  }

  throw httpError("Not found", 404);
}

async function requireAdminSession(config, sessionToken) {
  if (!config.backendUrl) {
    throw httpError("Backend URL not configured", 500);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(`${config.backendUrl.replace(/\/+$/, "")}/api/v1/auth/session`, {
      headers: {
        authorization: `Bearer ${sessionToken || ""}`,
        "x-frontend-token": config.frontendToken || ""
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw httpError("Admin session validation failed", 401);
    }
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw httpError(`Backend unavailable: ${error.message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function applyAdminPathChange(config, newPath) {
  const confPath = config.nginxConfPath;
  const oldPath = config.adminPath;
  const siteRoot = config.siteRoot;
  const oldDir = join(siteRoot, oldPath);
  const newDir = join(siteRoot, newPath);

  let originalConf = "";
  try {
    originalConf = await readFile(confPath, "utf8");
  } catch {
    throw httpError(`Nginx config not found: ${confPath}`, 500);
  }
  if (!originalConf.includes(`location = ${oldPath}`)) {
    throw httpError(`Current admin path ${oldPath} not found in nginx config`, 500);
  }

  const backupPath = `${confPath}.bak-kato-${Date.now()}`;
  const newConf = originalConf.split(oldPath).join(newPath);
  await writeFile(confPath, newConf);

  const renameResult = await renameDir(oldDir, newDir);
  if (!renameResult.ok) {
    await writeFile(confPath, originalConf);
    throw httpError(`Failed to rename admin directory: ${renameResult.error}`, 500);
  }

  const test = await config.runner("nginx", ["-t"]);
  if (!test.ok) {
    await renameDir(newDir, oldDir);
    await writeFile(confPath, originalConf);
    throw httpError(`Nginx config test failed: ${test.stderr}`, 500);
  }

  const reload = await config.runner("systemctl", ["reload", "nginx.service"]);
  if (!reload.ok) {
    await writeFile(confPath, originalConf);
    await config.runner("systemctl", ["reload", "nginx.service"]);
    await renameDir(newDir, oldDir);
    throw httpError(`Nginx reload failed: ${reload.stderr}`, 500);
  }

  config.adminPath = newPath;
  await writeConfig(config);
  await writeFile(backupPath, originalConf);
}

async function writeConfig(config) {
  const statePath = config.configPath;
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(config, null, 2)}\n`);
}

async function renameDir(from, to) {
  try {
    await rename(from, to);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ ok: false, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
  });
}

export function normalizePath(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return `/${text.replace(/^\/+|\/+$/g, "")}`;
}

export function validateAdminPath(value) {
  if (!value || value === "/") {
    return "管理后台路径不能为空或 /";
  }
  if (!/^\/[A-Za-z0-9._-]+$/.test(value)) {
    return "管理后台路径只能包含字母、数字、点、下划线和中横线";
  }
  return "";
}

function validateConfig(config) {
  if (!config.backendUrl) {
    throw new Error("Frontend local backendUrl must be configured");
  }
  if (!config.frontendToken) {
    throw new Error("Frontend local frontendToken must be configured");
  }
  const error = validateAdminPath(config.adminPath);
  if (error) {
    throw new Error(`Frontend local adminPath invalid: ${error}`);
  }
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

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.env.FRONTEND_LOCAL_CONFIG || "configs/frontend-local.json";
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.configPath = configPath;
  const { server } = createFrontendLocalApp(config);
  server.listen(config.port, config.host, () => {
    console.log(`frontend-local listening on http://${config.host}:${config.port}/`);
  });
}
