const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const BASE_URL_KEY = "kato.adminApiBaseUrl";
const TOKEN_KEY = "kato.adminToken";

export function getAdminApiSettings() {
  if (typeof window === "undefined") {
    return {
      baseUrl: DEFAULT_BASE_URL,
      token: "",
    };
  }

  const env = import.meta.env || {};
  const storedBaseUrl = window.localStorage.getItem(BASE_URL_KEY);
  const storedToken = window.localStorage.getItem(TOKEN_KEY);
  return {
    baseUrl: env.VITE_ADMIN_API_BASE_URL || storedBaseUrl || DEFAULT_BASE_URL,
    token: env.VITE_ADMIN_TOKEN || storedToken || "",
  };
}

export function saveAdminApiSettings({ baseUrl, token }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BASE_URL_KEY, baseUrl || DEFAULT_BASE_URL);
  window.localStorage.setItem(TOKEN_KEY, token || "");
}

export function hasAdminApiToken() {
  return Boolean(getAdminApiSettings().token);
}

export async function adminGet(path) {
  return adminRequest(path);
}

export async function adminPost(path, body) {
  return adminRequest(path, { method: "POST", body });
}

export async function adminPatch(path, body) {
  return adminRequest(path, { method: "PATCH", body });
}

export async function adminDelete(path) {
  return adminRequest(path, { method: "DELETE" });
}

async function adminRequest(path, options = {}) {
  const { baseUrl, token } = getAdminApiSettings();
  if (!token) {
    throw new Error("ADMIN_API_TOKEN_MISSING");
  }

  const headers = {
    "x-admin-token": token,
    ...(options.headers || {}),
  };
  if (options.body) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}
