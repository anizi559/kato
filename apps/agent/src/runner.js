import { nowIso, VERSION } from "../../../packages/shared/src/protocol.js";
import { BackendClient } from "./client.js";
import { readJsonFile, writeJsonFile } from "./config.js";
import { applyRuntimeConfig } from "./runtime-apply.js";
import { inspectRuntime, restartManagedRuntime, startManagedRuntime } from "./runtime-process.js";

export async function runOnce(config) {
  const state = (await readJsonFile(config.statePath, {})) || {};
  const credentials = await ensureRegistered(config, state);
  const client = new BackendClient({
    backendUrl: config.backendUrl,
    agentId: credentials.agentId,
    agentSecret: credentials.agentSecret
  });

  const actualState = await buildActualState(config, state);
  await safeCall(() => client.heartbeat(actualState), "heartbeat");

  const desiredResult = await client.desiredState(state.etag);
  if (desiredResult.notModified) {
    const processState = await ensureRuntimeStarted(config);
    return {
      changed: false,
      mode: "online",
      configVersion: state.configVersion,
      process: processState,
      message: "desired state not modified"
    };
  }

  const desired = desiredResult.body;
  const runtime = await applyDesiredState(config, desired);
  const nextState = {
    ...state,
    ...credentials,
    etag: desiredResult.etag,
    configVersion: desired.configVersion,
    lastSyncAt: nowIso(),
    lastKnownGoodAt: nowIso(),
    runtime
  };
  await writeJsonFile(config.statePath, nextState);
  await client.reportConfigApplied({
    configVersion: desired.configVersion,
    status: "applied",
    appliedAt: nextState.lastKnownGoodAt,
    runtime
  });

  return {
    changed: true,
    mode: "online",
    configVersion: desired.configVersion,
    message: "desired state applied"
  };
}

export async function runOffline(config, error) {
  const lastKnownGood = await readJsonFile(config.lastKnownGoodPath, null);
  if (!lastKnownGood) {
    throw new Error(`Backend unavailable and no last known good config exists: ${error.message}`);
  }
  const runtime = await applyRuntimeConfig(config, lastKnownGood, { offline: true });
  const processState = await ensureRuntimeStarted(config);
  await writeJsonFile(config.renderedConfigPath, {
    renderedAt: nowIso(),
    offline: true,
    desired: lastKnownGood,
    runtime,
    process: processState
  });
  return {
    changed: false,
    mode: "offline",
    configVersion: lastKnownGood.configVersion,
    runtime,
    process: processState,
    message: "using last known good config"
  };
}

async function ensureRegistered(config, state) {
  if (state.agentId && state.agentSecret) {
    return {
      agentId: state.agentId,
      agentSecret: state.agentSecret
    };
  }
  const registration = await BackendClient.register({
    backendUrl: config.backendUrl,
    bootstrapToken: config.bootstrapToken,
    role: config.role,
    name: config.name
  });
  const nextState = {
    ...state,
    agentId: registration.agentId,
    agentSecret: registration.agentSecret,
    role: registration.role,
    name: registration.name,
    registeredAt: nowIso()
  };
  await writeJsonFile(config.statePath, nextState);
  return {
    agentId: registration.agentId,
    agentSecret: registration.agentSecret
  };
}

async function applyDesiredState(config, desired) {
  if (!desired || !desired.desiredState || !desired.configVersion) {
    throw new Error("Refusing to apply invalid desired state");
  }
  const runtime = await applyRuntimeConfig(config, desired);
  const processState = await restartRuntimeIfEnabled(config);
  if (processState) {
    runtime.process = processState;
  }
  const rendered = {
    renderedAt: nowIso(),
    role: config.role,
    desired,
    runtime
  };
  await writeJsonFile(config.renderedConfigPath, rendered);
  await writeJsonFile(config.lastKnownGoodPath, desired);
  return runtime;
}

async function buildActualState(config, state) {
  const runtime = await inspectRuntimeSafely(config);
  return {
    role: config.role,
    name: config.name,
    agentVersion: VERSION,
    configVersion: state.configVersion || null,
    lastKnownGoodAt: state.lastKnownGoodAt || null,
    runtime
  };
}

async function restartRuntimeIfEnabled(config) {
  if (!config.autoStart) {
    return null;
  }
  return restartManagedRuntime(config);
}

async function ensureRuntimeStarted(config) {
  if (!config.autoStart) {
    return null;
  }
  return startManagedRuntime(config);
}

async function inspectRuntimeSafely(config) {
  try {
    return {
      mode: config.autoStart ? "managed" : "lite",
      ...(await inspectRuntime(config))
    };
  } catch (error) {
    return {
      mode: config.autoStart ? "managed" : "lite",
      error: error.message
    };
  }
}

async function safeCall(fn, name) {
  try {
    return await fn();
  } catch (error) {
    const wrapped = new Error(`${name} failed: ${error.message}`);
    if (error.statusCode) {
      wrapped.statusCode = error.statusCode;
    }
    throw wrapped;
  }
}
