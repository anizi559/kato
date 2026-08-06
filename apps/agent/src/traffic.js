import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CLASH_CONTROLLER = "http://127.0.0.1:19090";
const CLASH_SECRET = "kato-local-stats";

export async function readSingboxTraffic(config) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2600);
  let last = null;
  try {
    const response = await fetch(`${CLASH_CONTROLLER}/traffic`, {
      headers: { authorization: `Bearer ${CLASH_SECRET}` },
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      return null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const matches = buffer.matchAll(/\{"up":(\d+),"down":(\d+)\}/g);
      for (const match of matches) {
        last = { up: Number(match[1]), down: Number(match[2]) };
      }
      if (last) {
        buffer = buffer.slice(-128);
      }
    }
    return last;
  } catch {
    return last;
  } finally {
    clearTimeout(timer);
  }
}

export async function readManagedInboundIds(config) {
  try {
    const raw = await readFile(
      join(config.runtimeDir || "data/runtime", "singbox", "config.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return (parsed.inbounds || []).map((inbound) => inbound.tag).filter(Boolean);
  } catch {
    return [];
  }
}

export async function collectTrafficReport(config, state) {
  const counter = await readSingboxTraffic(config);
  if (!counter) {
    return null;
  }
  const previous = state?.lastTraffic || null;
  if (!previous) {
    return { counter, reports: [], baseline: true };
  }
  const uploadBytes = Math.max(0, counter.up - previous.up);
  const downloadBytes = Math.max(0, counter.down - previous.down);
  if (uploadBytes === 0 && downloadBytes === 0) {
    return { counter, reports: [], noChange: true };
  }
  const inboundIds = await readManagedInboundIds(config);
  return {
    counter,
    reports: [
      {
        kind: "node",
        inboundId: inboundIds[0] || null,
        uploadBytes,
        downloadBytes
      }
    ]
  };
}
