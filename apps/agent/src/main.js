import { loadAgentConfig } from "./config.js";
import {
  checkRuntimePorts,
  inspectRuntime,
  restartManagedRuntime,
  startManagedRuntime,
  stopManagedRuntime
} from "./runtime-process.js";
import { runOffline, runOnce } from "./runner.js";

async function main() {
  const command = process.argv[2] || "once";
  const config = await loadAgentConfig();

  try {
    if (command === "once") {
      const result = await runOnce(config);
      printJson(result);
      return;
    }

    if (command === "start") {
      printJson(await startManagedRuntime(config));
      return;
    }

    if (command === "stop") {
      printJson(await stopManagedRuntime(config));
      return;
    }

    if (command === "restart") {
      printJson(await restartManagedRuntime(config));
      return;
    }

    if (command === "status") {
      printJson(await inspectRuntime(config));
      return;
    }

    if (command === "ports") {
      printJson({
        checkedAt: new Date().toISOString(),
        ports: await checkRuntimePorts(config)
      });
      return;
    }

    throw new Error(`Unsupported agent command: ${command}`);
  } catch (error) {
    if (command !== "once" || !isOfflineEligible(error)) {
      throw error;
    }
    const result = await runOffline(config, error);
    printJson(result);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function isOfflineEligible(error) {
  if (!error.statusCode) {
    return true;
  }
  return error.statusCode >= 500;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
