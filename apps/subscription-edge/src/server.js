import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8081,
  backendUrl: "",
  agentStatePath: "/var/lib/kato/agent-state.json",
  pathPrefix: "go",
  requestTimeoutMs: 10000,
  cacheTtlSeconds: 60,
  staleIfErrorSeconds: 300,
  rateLimitPerMinute: 60,
  rateLimitBurst: 3
};

export async function loadConfig(path = process.env.SUBSCRIPTION_EDGE_CONFIG) {
  if (!path) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = await readFile(path, "utf8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function createSubscriptionEdgeApp(config = DEFAULT_CONFIG) {
  const resolvedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    pathPrefix: String(config.pathPrefix || "go").replace(/^\/+|\/+$/g, "")
  };
  validateConfig(resolvedConfig);

  const backendBase = resolvedConfig.backendUrl.replace(/\/+$/, "");
  const cache = new Map();
  const rateLimiters = new Map();

  async function handler(req, res) {
    try {
      await route(req, res, resolvedConfig, backendBase, cache, rateLimiters);
    } catch (error) {
      genericNotFound(res);
    }
  }

  return {
    server: createHttpServer(handler)
  };
}

async function route(req, res, config, backendBase, cache, rateLimiters) {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8"
    });
    return res.end("ok\n");
  }

  const prefix = `/${config.pathPrefix}/`;
  if (req.method === "GET" && path.startsWith(prefix)) {
    const token = path.slice(prefix.length).split("/")[0];
    if (!token) {
      return genericNotFound(res);
    }

    if (!allowRequest(rateLimiters, token, config)) {
      res.writeHead(429, {
        "content-type": "text/plain; charset=utf-8",
        "retry-after": "1"
      });
      return res.end();
    }

    const cached = readCache(cache, token, config);
    if (cached) {
      res.writeHead(200, {
        ...cached.headers,
        "x-kato-cache": "hit"
      });
      return res.end(cached.body);
    }

    const upstream = await fetchSubscription(backendBase, token, config, {
      userAgent: req.headers["user-agent"]
    });
    if (!upstream) {
      const stale = readStaleCache(cache, token, config);
      if (stale) {
        res.writeHead(200, {
          ...stale.headers,
          "x-kato-cache": "stale"
        });
        return res.end(stale.body);
      }
      return genericNotFound(res);
    }
    writeCache(cache, token, upstream, config);
    res.writeHead(200, {
      ...upstream.headers,
      "x-kato-cache": "miss"
    });
    return res.end(upstream.body);
  }

  return genericNotFound(res);
}

function allowRequest(rateLimiters, token, config) {
  const now = Date.now();
  const refillRate = Math.max(1, Number(config.rateLimitPerMinute) || 60) / 60 / 1000;
  const burst = Math.max(1, Number(config.rateLimitBurst) || 1);
  let bucket = rateLimiters.get(token);
  if (!bucket) {
    bucket = { tokens: burst, lastRefillAt: now };
    rateLimiters.set(token, bucket);
  }
  bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.lastRefillAt) * refillRate);
  bucket.lastRefillAt = now;
  if (bucket.tokens < 1) {
    return false;
  }
  bucket.tokens -= 1;
  return true;
}

function readCache(cache, token, config) {
  const entry = cache.get(token);
  if (!entry) {
    return null;
  }
  const ttlMs = Math.max(0, Number(config.cacheTtlSeconds) || 0) * 1000;
  if (ttlMs > 0 && Date.now() - entry.cachedAt < ttlMs) {
    return entry;
  }
  return null;
}

function readStaleCache(cache, token, config) {
  const entry = cache.get(token);
  if (!entry) {
    return null;
  }
  const staleMs = Math.max(0, Number(config.staleIfErrorSeconds) || 0) * 1000;
  if (staleMs > 0 && Date.now() - entry.cachedAt < staleMs) {
    return entry;
  }
  cache.delete(token);
  return null;
}

function writeCache(cache, token, upstream, config) {
  const entry = {
    body: upstream.body,
    headers: {
      "content-type": upstream.headers["content-type"] || "application/octet-stream",
      ...(upstream.headers["subscription-userinfo"] ? { "subscription-userinfo": upstream.headers["subscription-userinfo"] } : {}),
      ...(upstream.headers["profile-update-interval"] ? { "profile-update-interval": upstream.headers["profile-update-interval"] } : {}),
      ...(upstream.headers["profile-title"] ? { "profile-title": upstream.headers["profile-title"] } : {}),
      "cache-control": `max-age=${Math.max(0, Number(config.cacheTtlSeconds) || 0)}`,
      "x-kato-cache": "miss"
    },
    cachedAt: Date.now()
  };
  cache.set(token, entry);
  if (cache.size > 10000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

async function fetchSubscription(backendBase, token, config, { userAgent } = {}) {
  const agentState = await readAgentState(config.agentStatePath);
  if (!agentState?.agentId || !agentState?.agentSecret) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(`${backendBase}/api/v1/subscriptions/${encodeURIComponent(token)}`, {
      headers: {
        authorization: `Bearer ${agentState.agentSecret}`,
        ...(userAgent ? { "user-agent": userAgent } : {})
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    const body = await response.arrayBuffer();
    return {
      body: Buffer.from(body),
      headers: {
        "content-type": response.headers.get("content-type") || "application/octet-stream",
        ...copyHeader(response, "subscription-userinfo"),
        ...copyHeader(response, "profile-update-interval"),
        ...copyHeader(response, "profile-title"),
        "cache-control": "no-store"
      }
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readAgentState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function copyHeader(response, name) {
  const value = response.headers.get(name);
  return value ? { [name]: value } : {};
}

function genericNotFound(res) {
  res.writeHead(404, {
    "content-type": "text/plain; charset=utf-8"
  });
  res.end();
}

function validateConfig(config) {
  if (!config.backendUrl) {
    throw new Error("Subscription edge backendUrl must be configured");
  }
  if (!config.pathPrefix || !/^[a-zA-Z0-9_-]+$/.test(config.pathPrefix)) {
    throw new Error("Subscription edge pathPrefix must be letters, numbers, dash or underscore");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = await loadConfig();
  const { server } = createSubscriptionEdgeApp(config);
  server.listen(config.port, config.host, () => {
    console.log(`subscription-edge listening on http://${config.host}:${config.port}/`);
  });
}
