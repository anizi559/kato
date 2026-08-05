import { createSocket } from "node:dgram";
import { createConnection } from "node:net";

export async function probeEndpoint(host, port, { protocol = "tcp", timeoutMs = 3000 } = {}) {
  if (!host || !port) {
    return { status: "unknown", error: "missing host or port", latencyMs: null };
  }
  if (protocol === "udp") {
    return probeUdp(host, port, timeoutMs);
  }
  return probeTcp(host, port, timeoutMs);
}

function probeTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = createConnection({
      host,
      port,
      timeout: timeoutMs
    });
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve({
        ...result,
        latencyMs: Date.now() - startedAt
      });
    };
    socket.once("connect", () => finish({ status: "ok" }));
    socket.once("timeout", () => finish({ status: "failed", error: "timeout" }));
    socket.once("error", (error) => finish({ status: "failed", error: error.code || error.message }));
  });
}

function probeUdp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = createSocket("udp4");
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve({
        ...result,
        latencyMs: Date.now() - startedAt
      });
    };
    const timer = setTimeout(() => finish({ status: "unknown", error: "timeout" }), timeoutMs);
    socket.once("error", (error) => {
      finish({
        status: error.code === "ECONNREFUSED" ? "failed" : "unknown",
        error: error.code || error.message
      });
    });
    socket.connect(port, host, () => {
      socket.send(Buffer.from([0]), port, host, (error) => {
        if (error) {
          finish({ status: "unknown", error: error.code || error.message });
        }
      });
    });
  });
}
