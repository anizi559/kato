import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const NFT_TABLE = "kato_traffic";

export async function ensureTrafficCounters(config) {
  const ports = await readManagedInboundPorts(config);
  await ensureNftChain("input");
  await ensureNftChain("output");
  for (const port of ports) {
    await ensureNftRule("input", `tcp dport ${port} counter`);
    await ensureNftRule("output", `tcp sport ${port} counter`);
  }
  return ports;
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

function parseNftCounter(stdout) {
  let bytes = 0;
  for (const line of stdout.split("\n")) {
    const match = line.match(/counter packets \d+ bytes (\d+)/);
    if (match) {
      bytes += Number(match[1]) || 0;
    }
  }
  return bytes;
}

export async function readTrafficCounters() {
  const input = await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, "input"]);
  const output = await execFileAsync("nft", ["list", "chain", "inet", NFT_TABLE, "output"]);
  const up = parseNftCounter(input.stdout);
  const down = parseNftCounter(output.stdout);
  return { up, down };
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
  const uploadBytes = Math.max(0, counter.up - (previous.up || 0));
  const downloadBytes = Math.max(0, counter.down - (previous.down || 0));
  if (uploadBytes === 0 && downloadBytes === 0) {
    return { counter, ports, reports: [], noChange: true };
  }
  const inboundIds = await readManagedInboundIds(config);
  return {
    counter,
    ports,
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
