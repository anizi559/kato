export const VERSION = "0.3.1";

export const AGENT_ROLES = Object.freeze([
  "frontend-edge",
  "subscription-edge",
  "proxy-node",
  "transit-relay"
]);

export const PROTOCOLS = Object.freeze({
  VLESS_REALITY: "vless-reality",
  HYSTERIA2: "hysteria2",
  REALM: "realm"
});

export const DEFAULT_INTERVALS = Object.freeze({
  pullSeconds: 60,
  pushSeconds: 60,
  heartbeatSeconds: 30
});

export function assertRole(role) {
  if (!AGENT_ROLES.includes(role)) {
    throw new Error(`Unsupported agent role: ${role}`);
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function jsonResponse(res, statusCode, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...headers
  });
  res.end(payload);
}

export function notFound(res) {
  jsonResponse(res, 404, { error: "not_found" });
}

export function methodNotAllowed(res) {
  jsonResponse(res, 405, { error: "method_not_allowed" });
}
