import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

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
  if (!previous) {
    return { counter, ports, reports: [], baseline: true };
  }
  const isRelay = config.role === "transit-relay";
  const inboundIds = isRelay ? [] : await readManagedInboundIds(config);
  const reports = [];
  for (const port of ports) {
    const key = String(port);
    const prev = previous[key] || { up: 0, down: 0 };
    const uploadBytes = Math.max(0, (counter[key]?.up || 0) - (prev.up || 0));
    const downloadBytes = Math.max(0, (counter[key]?.down || 0) - (prev.down || 0));
    if (uploadBytes === 0 && downloadBytes === 0) {
      continue;
    }
    reports.push({
      kind: isRelay ? "relay" : "node",
      inboundId: isRelay ? null : inboundIds[0] || null,
      entryPort: isRelay ? port : undefined,
      uploadBytes,
      downloadBytes
    });
  }
  return {
    counter,
    ports,
    reports
  };
}
