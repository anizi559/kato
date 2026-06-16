import { execFile } from "node:child_process";
import { cp, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { nowIso } from "../../../packages/shared/src/protocol.js";
import { renderRuntimeBundle, validateRenderedBundle } from "./runtime-renderer.js";

const execFileAsync = promisify(execFile);

export async function applyRuntimeConfig(config, desired, options = {}) {
  const bundle = renderRuntimeBundle(desired, config.runtime || {});
  validateRenderedBundle(bundle);

  const runtimeDir = config.runtimeDir || "data/runtime";
  const backupDir = config.backupDir || "data/backups";
  const tmpDir = `${runtimeDir}.tmp-${Date.now()}`;
  const backupPath = join(backupDir, `config-${desired.configVersion}-${timestampForPath()}`);

  await rm(tmpDir, { recursive: true, force: true });
  await writeBundle(tmpDir, bundle, desired, options);
  await validateRuntimeBinaries(config, tmpDir, bundle);

  await mkdir(dirname(runtimeDir), { recursive: true });
  await mkdir(backupDir, { recursive: true });

  let backedUp = false;
  try {
    if (await hasDirectoryEntries(runtimeDir)) {
      await cp(runtimeDir, backupPath, { recursive: true });
      backedUp = true;
    }
    await rm(runtimeDir, { recursive: true, force: true });
    await rename(tmpDir, runtimeDir);
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    if (backedUp) {
      await rm(runtimeDir, { recursive: true, force: true });
      await cp(backupPath, runtimeDir, { recursive: true });
    }
    throw error;
  }

  return {
    renderedAt: bundle.renderedAt,
    configVersion: desired.configVersion,
    runtimeDir,
    backupPath: backedUp ? backupPath : null,
    files: bundle.files.map((file) => file.path),
    warnings: bundle.warnings
  };
}

async function writeBundle(tmpDir, bundle, desired, options) {
  await mkdir(tmpDir, { recursive: true });
  for (const file of bundle.files) {
    const path = join(tmpDir, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content);
  }

  const manifest = {
    renderedAt: nowIso(),
    offline: Boolean(options.offline),
    configVersion: desired.configVersion,
    kind: desired.desiredState.kind,
    files: bundle.files.map((file) => ({
      component: file.component,
      path: file.path,
      format: file.format
    })),
    warnings: bundle.warnings
  };
  await writeFile(join(tmpDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function validateRuntimeBinaries(config, tmpDir, bundle) {
  if (!config.binaryValidation) {
    return;
  }

  const xrayConfig = bundle.files.find((file) => file.component === "xray");
  if (xrayConfig) {
    const xrayBinary = config.binaries?.xray || "xray";
    await execWithContext(xrayBinary, ["run", "-test", "-c", join(tmpDir, xrayConfig.path)], "xray config test");
  }
}

async function execWithContext(file, args, label) {
  try {
    await execFileAsync(file, args, {
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    const stdout = error.stdout ? String(error.stdout).trim() : "";
    const detail = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
  }
}

async function hasDirectoryEntries(path) {
  try {
    const entries = await readdir(path);
    return entries.length > 0;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function timestampForPath() {
  return nowIso().replace(/[:.]/g, "-");
}
