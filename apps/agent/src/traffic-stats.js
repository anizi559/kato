import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const USER_EMAIL_SUFFIX = "@kato.local";
const XRAY_PATTERN = /^user>>>(.+)>>>traffic>>>(uplink|downlink)$/;

export async function collectTrafficStats(config) {
  const statsPath = join(config.runtimeDir || "data/runtime", "traffic-stats.json");
  let endpoints = [];
  try {
    const manifest = JSON.parse(await readFile(statsPath, "utf8"));
    endpoints = Array.isArray(manifest?.endpoints) ? manifest.endpoints : [];
  } catch {
    return { ok: false, reports: [], error: "traffic-stats manifest not found" };
  }

  const users = new Map();
  for (const endpoint of endpoints) {
    try {
      if (endpoint?.type === "xray") {
        const stdout = await runJsonCommand(
          config.binaries?.xray || "xray",
          ["api", "statsquery", `--server=${endpoint.apiAddress}`, "-pattern", "user>>>", "-reset"],
          10000
        );
        mergeRows(users, parseXrayStatsOutput(stdout));
      } else if (endpoint?.type === "hysteria2") {
        const text = await fetchHysteriaTraffic(endpoint);
        mergeRows(users, parseHysteriaTrafficOutput(text));
      }
    } catch {
      // 单个统计端点失败不影响其他端点
    }
  }

  const reports = [...users.values()].map((row) => ({
    userId: row.userId,
    uploadBytes: row.uploadBytes,
    downloadBytes: row.downloadBytes
  }));
  return { ok: true, reports };
}

export function parseXrayStatsOutput(stdout) {
  const results = [];
  let payload = null;
  try {
    payload = JSON.parse(String(stdout || ""));
  } catch {
    return results;
  }
  const stats = Array.isArray(payload?.stat) ? payload.stat : [];
  for (const entry of stats) {
    const match = XRAY_PATTERN.exec(String(entry?.name || ""));
    if (!match) {
      continue;
    }
    const userId = match[1].replace(USER_EMAIL_SUFFIX, "");
    const value = Math.max(0, Number(entry?.value) || 0);
    const direction = match[2];
    let row = results.find((item) => item.userId === userId);
    if (!row) {
      row = { userId, uploadBytes: 0, downloadBytes: 0 };
      results.push(row);
    }
    if (direction === "uplink") {
      row.uploadBytes += value;
    } else {
      row.downloadBytes += value;
    }
  }
  return results;
}

export function parseHysteriaTrafficOutput(text) {
  const results = [];
  let payload = null;
  try {
    payload = JSON.parse(String(text || ""));
  } catch {
    return results;
  }
  for (const [userId, entry] of Object.entries(payload || {})) {
    results.push({
      userId,
      uploadBytes: Math.max(0, Number(entry?.tx) || 0),
      downloadBytes: Math.max(0, Number(entry?.rx) || 0)
    });
  }
  return results;
}

async function fetchHysteriaTraffic(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${endpoint.url}/traffic?clear=1`, {
      headers: endpoint.secret ? { authorization: endpoint.secret } : {},
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`hysteria traffic stats HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function runJsonCommand(binary, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${binary} ${args[0]} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `${binary} exit code ${code}`));
      }
    });
  });
}

function mergeRows(users, rows) {
  for (const row of rows) {
    const current = users.get(row.userId) || {
      userId: row.userId,
      uploadBytes: 0,
      downloadBytes: 0
    };
    current.uploadBytes += row.uploadBytes;
    current.downloadBytes += row.downloadBytes;
    users.set(row.userId, current);
  }
}
