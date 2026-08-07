import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { queryStats } from "./v2ray-stats.js";

const execFileAsync = promisify(execFile);
const NFT_TABLE = "kato_traffic";

export async function ensureTrafficCounters(config) {
  const ports = await readManagedPorts(config);
  await ensureNftChain("input");
  await ensureNftChain("output");
  for (const port of ports) {
    await ensureNftRule("input", `tcp dport ${port} counter`);
    await ensureNftRule("output", `tcp sport ${port} counter`);
  }
  return ports;
}

async function readManagedPorts(config) {
  if (config.role === "transit-relay") {
    return readRealmPorts(config);
  }
  return readManagedInboundPorts(config);
}

async function ensureNftChain(chain) {
  try {
    await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, chain]);
  } catch {
    try {
      await execFileAsync("nft", ["add", "table", "inet", NFT_TABLE]);
    } catch {
      // 表已存在
    }
    await execFileAsync("nft", [
      "add",
      "chain",
      "inet",
      NFT_TABLE,
      chain,
      `{ type filter hook ${chain} priority 0; }`
    ]);
  }
}

async function ensureNftRule(chain, rule) {
  const { stdout } = await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, chain]);
  if (stdout.includes(rule)) {
    return;
  }
  await execFileAsync("nft", ["add", "rule", "inet", NFT_TABLE, chain, rule]);
}

export async function readManagedInboundPorts(config) {
  try {
    const raw = await readFile(
      join(config.runtimeDir || "data/runtime", "singbox", "config.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return (parsed.inbounds || [])
      .map((inbound) => inbound.listen_port || inbound.port)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function readManagedInboundPortTags(config) {
  try {
    const raw = await readFile(
      join(config.runtimeDir || "data/runtime", "singbox", "config.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return (parsed.inbounds || [])
      .map((inbound) => ({
        port: Number(inbound.listen_port || inbound.port),
        tag: inbound.tag || null
      }))
      .filter((item) => item.port);
  } catch {
    return [];
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

export async function readRealmPorts(config) {
  try {
    const raw = await readFile(
      join(config.runtimeDir || "data/runtime", "realm", "config.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return (parsed.endpoints || [])
      .map((endpoint) => {
        const match = String(endpoint.listen || "").match(/:(\d+)$/);
        return match ? Number(match[1]) : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readV2rayApiAddress(config) {
  try {
    const raw = await readFile(
      join(config.runtimeDir || "data/runtime", "singbox", "config.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return parsed.experimental?.v2ray_api?.listen || null;
  } catch {
    return null;
  }
}

function parseNftCounterByPort(stdout) {
  const byPort = new Map();
  for (const line of stdout.split("\n")) {
    const match = line.match(/(?:dport|sport) (\d+) counter packets \d+ bytes (\d+)/);
    if (match) {
      const port = Number(match[1]);
      const bytes = Number(match[2]) || 0;
      byPort.set(port, (byPort.get(port) || 0) + bytes);
    }
  }
  return byPort;
}

export async function readTrafficCounters() {
  const input = await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, "input"]);
  const output = await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, "output"]);
  const upByPort = parseNftCounterByPort(input.stdout);
  const downByPort = parseNftCounterByPort(output.stdout);
  const ports = new Set([...upByPort.keys(), ...downByPort.keys()]);
  const counter = {};
  for (const port of ports) {
    counter[String(port)] = {
      up: upByPort.get(port) || 0,
      down: downByPort.get(port) || 0
    };
  }
  return counter;
}

function parseUserStats(stats) {
  const users = new Map();
  for (const stat of stats) {
    const match = String(stat.name || "").match(/^user>>>(.+?)>>>traffic>>>(uplink|downlink)$/);
    if (!match) {
      continue;
    }
    const userId = match[1];
    const direction = match[2];
    const row = users.get(userId) || { up: 0, down: 0 };
    if (direction === "uplink") {
      row.up = Number(stat.value) || 0;
    } else {
      row.down = Number(stat.value) || 0;
    }
    users.set(userId, row);
  }
  return Object.fromEntries(users);
}

async function collectUserTraffic(config, previous) {
  const address = await readV2rayApiAddress(config);
  if (!address) {
    return { counter: null, reports: [] };
  }
  let stats;
  try {
    stats = await queryStats(`http://${address}`, {
      patterns: ["user>>>"],
      timeoutMs: 2500
    });
  } catch {
    return { counter: null, reports: [] };
  }
  const counter = parseUserStats(stats);
  const prev = previous || null;
  if (!prev) {
    return { counter, reports: [] };
  }
  const reports = [];
  for (const [userId, row] of Object.entries(counter)) {
    const before = prev[userId] || { up: 0, down: 0 };
    const uploadBytes = Math.max(0, (row.up || 0) - (before.up || 0));
    const downloadBytes = Math.max(0, (row.down || 0) - (before.down || 0));
    if (uploadBytes === 0 && downloadBytes === 0) {
      continue;
    }
    reports.push({
      kind: "node",
      userId,
      uploadBytes,
      downloadBytes
    });
  }
  return { counter, reports };
}

export async function collectTrafficReport(config, state) {
  let ports = [];
  try {
    ports = await ensureTrafficCounters(config);
  } catch {
    // 无 nft 或缺少权限时静默降级，不影响节点配置同步
    return null;
  }
  if (!ports.length) {
    return null;
  }
  let counter;
  try {
    counter = await readTrafficCounters();
  } catch {
    return null;
  }

  const previous = state?.lastTraffic || null;
  const prevNft = previous?.nft || null;
  const prevUsers = previous?.users || null;
  const isRelay = config.role === "transit-relay";
  const reports = [];
  const portTags = isRelay ? [] : await readManagedInboundPortTags(config);

  for (const port of ports) {
    const key = String(port);
    const prev = prevNft?.[key] || { up: 0, down: 0 };
    const uploadBytes = Math.max(0, (counter[key]?.up || 0) - (prev.up || 0));
    const downloadBytes = Math.max(0, (counter[key]?.down || 0) - (prev.down || 0));
    if (uploadBytes === 0 && downloadBytes === 0) {
      continue;
    }
    const portInfo = portTags.find((item) => item.port === port) || {};
    reports.push({
      kind: isRelay ? "relay" : "node",
      inboundId: isRelay ? null : portInfo.tag || null,
      entryPort: isRelay ? port : undefined,
      uploadBytes,
      downloadBytes
    });
  }

  let userCounter = null;
  if (!isRelay) {
    const userResult = await collectUserTraffic(config, prevUsers);
    userCounter = userResult.counter;
    reports.push(...userResult.reports);
  }

  if (!prevNft && !prevUsers) {
    return {
      counter: { nft: counter, users: userCounter },
      ports,
      reports: [],
      baseline: true
    };
  }
  return {
    counter: { nft: counter, users: userCounter },
    ports,
    reports
  };
}
