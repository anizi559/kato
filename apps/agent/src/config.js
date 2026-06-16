import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertRole } from "../../../packages/shared/src/protocol.js";

export async function readJsonFile(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

export async function loadAgentConfig(path = process.env.AGENT_CONFIG || "configs/agent.local.json") {
  const config = await readJsonFile(path);
  if (!config) {
    throw new Error(`Agent config not found: ${path}`);
  }
  assertRole(config.role);
  return {
    statePath: "data/agent-state.json",
    lastKnownGoodPath: "data/agent-last-known-good.json",
    renderedConfigPath: "data/agent-rendered-config.json",
    runtimeDir: "data/runtime",
    backupDir: "data/backups",
    processDir: "data/processes",
    logDir: "data/logs",
    binaryValidation: false,
    autoStart: false,
    binaries: {
      xray: "xray",
      hysteria: "hysteria",
      realm: "tools/bin/realm"
    },
    ...config
  };
}
