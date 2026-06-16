const DEFAULT_BASE_URL = "";
const BASE_URL_KEY = "kato.adminApiBaseUrl";
const SESSION_TOKEN_KEY = "kato.adminSessionToken";

export function getAdminApiSettings() {
  if (typeof window === "undefined") {
    return {
      baseUrl: DEFAULT_BASE_URL,
      token: "",
    };
  }

  const env = import.meta.env || {};
  const storedBaseUrl = window.localStorage.getItem(BASE_URL_KEY);
  return {
    baseUrl: env.VITE_ADMIN_API_BASE_URL || storedBaseUrl || DEFAULT_BASE_URL,
  };
}

export function saveAdminApiSettings({ baseUrl }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BASE_URL_KEY, baseUrl || DEFAULT_BASE_URL);
}

export function hasAdminApiToken() {
  return Boolean(getAdminSessionToken());
}

export function getAdminSessionToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function loginAdmin({ username, password }) {
  const payload = await publicRequest("/api/v1/auth/login", {
    method: "POST",
    body: { username, password },
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_TOKEN_KEY, payload.token);
  }
  return payload;
}

export async function fetchAdminSession() {
  return adminRequest("/api/v1/auth/session");
}

export async function logoutAdmin() {
  try {
    await adminRequest("/api/v1/auth/logout", { method: "POST" });
  } finally {
    clearAdminSession();
  }
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
  const token = getAdminSessionToken();
  if (!token) {
    throw new Error("ADMIN_SESSION_MISSING");
  }

  const headers = {
    authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  return fetchJson(path, options, headers);
}

async function publicRequest(path, options = {}) {
  return fetchJson(path, options);
}

async function fetchJson(path, options = {}, headers = {}) {
  const { baseUrl } = getAdminApiSettings();
  const requestHeaders = {
    ...headers,
    ...(options.headers || {}),
  };
  if (options.body) {
    requestHeaders["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: requestHeaders,
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
