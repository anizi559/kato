import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { basename, join } from "node:path";
import { nowIso } from "../../../packages/shared/src/protocol.js";

const DEFAULT_STOP_TIMEOUT_MS = 5000;

export async function startManagedRuntime(config, options = {}) {
  const components = await discoverRuntimeComponents(config);
  const started = [];

  await mkdir(processDir(config), { recursive: true });
  await mkdir(logDir(config), { recursive: true });

  for (const component of components) {
    if (options.components?.length && !options.components.includes(component.id)) {
      continue;
    }
    const existing = await readPidFile(config, component.id);
    if (existing && isPidAlive(existing.pid)) {
      started.push({ ...componentSummary(component), pid: existing.pid, status: "already-running" });
      continue;
    }
    await removePidFile(config, component.id);
    const result = await startComponent(config, component);
    started.push(result);
  }

  return {
    startedAt: nowIso(),
    components: started
  };
}

export async function stopManagedRuntime(config, options = {}) {
  const records = await listPidFiles(config);
  const stopped = [];
  for (const record of records) {
    if (options.components?.length && !options.components.includes(record.id)) {
      continue;
    }
    const result = await stopPid(record.pid, options.timeoutMs || DEFAULT_STOP_TIMEOUT_MS);
    await removePidFile(config, record.id);
    stopped.push({
      id: record.id,
      component: record.component,
      pid: record.pid,
      status: result
    });
  }
  return {
    stoppedAt: nowIso(),
    components: stopped
  };
}

export async function restartManagedRuntime(config, options = {}) {
  const stopped = await stopManagedRuntime(config, options);
  const started = await startManagedRuntime(config, options);
  return {
    restartedAt: nowIso(),
    stopped: stopped.components,
    started: started.components
  };
}

export async function inspectRuntime(config) {
  const components = await discoverRuntimeComponents(config);
  const pidRecords = await listPidFiles(config);
  const pidsById = new Map(pidRecords.map((record) => [record.id, record]));
  const ports = await checkRuntimePorts(config);

  return {
    inspectedAt: nowIso(),
    runtimeDir: runtimeDir(config),
    components: components.map((component) => {
      const pidRecord = pidsById.get(component.id);
      return {
        ...componentSummary(component),
        pid: pidRecord?.pid || null,
        running: pidRecord ? isPidAlive(pidRecord.pid) : false
      };
    }),
    ports
  };
}

export async function checkRuntimePorts(config) {
  const components = await discoverRuntimeComponents(config);
  const checks = [];
  for (const component of components) {
    for (const port of component.ports) {
      checks.push(await checkPort(component, port));
    }
  }
  return checks;
}

export async function discoverRuntimeComponents(config) {
  const dir = runtimeDir(config);
  const components = [];

  const xrayConfig = join(dir, "xray", "config.json");
  const xray = await readJsonIfExists(xrayConfig);
  if (xray) {
    components.push({
      id: "xray",
      component: "xray",
      configPath: xrayConfig,
      command: config.binaries?.xray || "xray",
      args: ["run", "-c", xrayConfig],
      ports: (xray.inbounds || []).map((inbound) => ({
        protocol: "tcp",
        host: inbound.listen || "0.0.0.0",
        port: inbound.port
      }))
    });
  }

  const hysteriaDir = join(dir, "hysteria2");
  for (const file of await listFilesIfExists(hysteriaDir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
      continue;
    }
    const configPath = join(hysteriaDir, file);
    const content = await readFile(configPath, "utf8");
    const listen = parseHysteriaListen(content);
    components.push({
      id: `hysteria2-${file.replace(/\.[^.]+$/, "")}`,
      component: "hysteria2",
      configPath,
      command: config.binaries?.hysteria || "hysteria",
      args: ["server", "-c", configPath, "--disable-update-check", "-l", "warn"],
      ports: listen
        ? [
            {
              protocol: "udp",
              host: listen.host,
              port: listen.port
            }
          ]
        : []
    });
  }

  const realmConfig = join(dir, "realm", "config.json");
  const realm = await readJsonIfExists(realmConfig);
  if (realm) {
    components.push({
      id: "realm",
      component: "realm",
      configPath: realmConfig,
      command: config.binaries?.realm || "tools/bin/realm",
      args: ["-c", realmConfig],
      ports: (realm.endpoints || []).flatMap((endpoint) => {
        const listen = parseHostPort(endpoint.listen);
        if (!listen) {
          return [];
        }
        const network = endpoint.network || realm.network || {};
        const ports = [];
        if (network.no_tcp !== true) {
          ports.push({ protocol: "tcp", host: listen.host, port: listen.port });
        }
        if (network.use_udp === true) {
          ports.push({ protocol: "udp", host: listen.host, port: listen.port });
        }
        return ports;
      })
    });
  }

  return components;
}

async function startComponent(config, component) {
  const stdoutPath = join(logDir(config), `${component.id}.out.log`);
  const stderrPath = join(logDir(config), `${component.id}.err.log`);
  const stdoutFd = openSync(stdoutPath, "a");
  const stderrFd = openSync(stderrPath, "a");
  let child;
  try {
    child = spawn(component.command, component.args, {
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
      env: {
        ...process.env,
        ...(config.processEnv || {})
      }
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }

  child.unref();

  const startup = await waitForProcessStartup(child, 500);
  if (startup.error) {
    throw new Error(`${component.id} failed to start: ${startup.error.message}`);
  }
  if (startup.exit) {
    throw new Error(
      `${component.id} exited immediately with ${formatExit(startup.exit)}; see ${stderrPath}`
    );
  }
  if (!child.pid || !isPidAlive(child.pid)) {
    throw new Error(`${component.id} did not stay running; see ${stderrPath}`);
  }

  const record = {
    ...componentSummary(component),
    pid: child.pid,
    startedAt: nowIso(),
    stdoutPath,
    stderrPath
  };
  await writePidFile(config, component.id, record);

  return {
    ...componentSummary(component),
    pid: child.pid,
    status: "started",
    stdoutPath,
    stderrPath
  };
}

async function stopPid(pid, timeoutMs) {
  if (!pid || !isPidAlive(pid)) {
    return "not-running";
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return "not-running";
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return "stopped";
    }
    await sleep(100);
  }
  if (isPidAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return "stopped";
    }
  }
  return "killed";
}

function waitForProcessStartup(child, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish({ ok: true }), timeoutMs);
    const onError = (error) => finish({ error });
    const onExit = (code, signal) => finish({ exit: { code, signal } });

    function finish(result) {
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      resolve(result);
    }

    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function formatExit(exit) {
  if (exit.signal) {
    return `signal ${exit.signal}`;
  }
  return `code ${exit.code}`;
}

async function checkPort(component, port) {
  if (port.protocol === "tcp") {
    const open = await checkTcp(port.host, port.port);
    return {
      component: component.component,
      id: component.id,
      protocol: "tcp",
      host: port.host,
      port: port.port,
      status: open ? "open" : "closed"
    };
  }

  const udpOpen = await checkUdpWithLsof(port.port);
  return {
    component: component.component,
    id: component.id,
    protocol: "udp",
    host: port.host,
    port: port.port,
    status: udpOpen === null ? "unknown" : udpOpen ? "open" : "closed"
  };
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: connectHost(host),
      port,
      timeout: 1000
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function checkUdpWithLsof(port) {
  const command = spawn("lsof", ["-nP", `-iUDP:${port}`], {
    stdio: ["ignore", "pipe", "ignore"]
  });
  let output = "";
  command.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  const status = await new Promise((resolve) => {
    command.once("error", () => resolve(null));
    command.once("close", (code) => resolve(code));
  });
  if (status === null) {
    return null;
  }
  return output.includes(`:${port}`);
}

async function listPidFiles(config) {
  const dir = processDir(config);
  const files = await listFilesIfExists(dir);
  const records = [];
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const record = await readJsonIfExists(join(dir, file));
    if (record) {
      records.push(record);
    }
  }
  return records;
}

async function readPidFile(config, id) {
  return readJsonIfExists(pidPath(config, id));
}

async function writePidFile(config, id, value) {
  await mkdir(processDir(config), { recursive: true });
  await writeFile(pidPath(config, id), `${JSON.stringify(value, null, 2)}\n`);
}

async function removePidFile(config, id) {
  await unlink(pidPath(config, id)).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listFilesIfExists(path) {
  try {
    return await readdir(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function parseHysteriaListen(content) {
  const match = content.match(/^listen:\s*["']?([^"'\n]+)["']?/m);
  if (!match) {
    return null;
  }
  const listen = match[1].trim();
  if (listen.startsWith(":")) {
    return { host: "0.0.0.0", port: Number(listen.slice(1)) };
  }
  return parseHostPort(listen);
}

function parseHostPort(value) {
  const text = String(value || "");
  const bracket = text.match(/^\[([^\]]+)]:(\d+)$/);
  if (bracket) {
    return { host: bracket[1], port: Number(bracket[2]) };
  }
  const index = text.lastIndexOf(":");
  if (index <= 0) {
    return null;
  }
  return {
    host: text.slice(0, index),
    port: Number(text.slice(index + 1))
  };
}

function runtimeDir(config) {
  return config.runtimeDir || "data/runtime";
}

function processDir(config) {
  return config.processDir || "data/processes";
}

function logDir(config) {
  return config.logDir || "data/logs";
}

function pidPath(config, id) {
  return join(processDir(config), `${id}.json`);
}

function componentSummary(component) {
  return {
    id: component.id,
    component: component.component,
    command: basename(component.command),
    configPath: component.configPath,
    ports: component.ports
  };
}

function connectHost(host) {
  if (!host || host === "0.0.0.0") {
    return "127.0.0.1";
  }
  if (host === "::" || host === "[::]") {
    return "::1";
  }
  return host;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function cleanManagedRuntimeState(config) {
  await rm(processDir(config), { recursive: true, force: true });
}
