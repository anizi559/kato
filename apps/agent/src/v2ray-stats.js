import http2 from "node:http2";

// sing-box-extended 编译时需要带上 with_v2ray_api 标签。
// 本模块通过最小 gRPC 客户端读取 V2Ray API 的按用户流量计数，
// 计数名称格式：user>>><userId>>>traffic>>>uplink|downlink

const QUERY_PATH = "/v2ray.core.app.stats.command.StatsService/QueryStats";

function encodeVarint(value) {
  const bytes = [];
  let v = BigInt(value);
  while (v > 0x7fn) {
    bytes.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
}

function encodeBytes(fieldNumber, value) {
  const tag = (fieldNumber << 3) | 2;
  return Buffer.concat([encodeVarint(tag), encodeVarint(value.length), value]);
}

function encodeBool(fieldNumber, value) {
  const tag = (fieldNumber << 3) | 0;
  return Buffer.concat([encodeVarint(tag), Buffer.from([value ? 1 : 0])]);
}

export function encodeQueryStatsRequest({ patterns = [], regexp = false, reset = false } = {}) {
  const parts = [];
  for (const pattern of patterns) {
    parts.push(encodeBytes(1, Buffer.from(pattern, "utf8")));
  }
  if (regexp) {
    parts.push(encodeBool(2, true));
  }
  if (reset) {
    parts.push(encodeBool(3, true));
  }
  return Buffer.concat(parts);
}

function decodeVarint(buffer, offset) {
  let result = 0n;
  let shift = 0n;
  let index = offset;
  while (index < buffer.length) {
    const byte = buffer[index];
    result |= BigInt(byte & 0x7f) << shift;
    index += 1;
    if ((byte & 0x80) === 0) {
      return { value: result, next: index };
    }
    shift += 7n;
  }
  throw new Error("invalid varint");
}

function decodeStat(buffer) {
  let offset = 0;
  let name = "";
  let value = 0n;
  while (offset < buffer.length) {
    const { value: tag, next } = decodeVarint(buffer, offset);
    offset = next;
    const field = Number(tag >> 3n);
    const wire = Number(tag & 0x7n);
    if (field === 1 && wire === 2) {
      const { value: len, next: next2 } = decodeVarint(buffer, offset);
      name = buffer.subarray(next2, next2 + Number(len)).toString("utf8");
      offset = next2 + Number(len);
    } else if (field === 2 && wire === 0) {
      const decoded = decodeVarint(buffer, offset);
      value = decoded.value;
      offset = decoded.next;
    } else {
      throw new Error(`unsupported stat field ${field} wire ${wire}`);
    }
  }
  return { name, value: Number(value) };
}

export function decodeQueryStatsResponse(buffer) {
  let offset = 0;
  const stats = [];
  while (offset < buffer.length) {
    const { value: tag, next } = decodeVarint(buffer, offset);
    offset = next;
    const field = Number(tag >> 3n);
    const wire = Number(tag & 0x7n);
    if (field === 1 && wire === 2) {
      const { value: len, next: next2 } = decodeVarint(buffer, offset);
      stats.push(decodeStat(buffer.subarray(next2, next2 + Number(len))));
      offset = next2 + Number(len);
    } else {
      throw new Error(`unsupported response field ${field} wire ${wire}`);
    }
  }
  return stats;
}

function grpcFrame(message) {
  const header = Buffer.alloc(5);
  header.writeUInt32BE(message.length, 1);
  return Buffer.concat([header, message]);
}

function createFrameParser(onMessage) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 5) {
      const length = buffer.readUInt32BE(1);
      if (buffer.length < 5 + length) {
        break;
      }
      onMessage(buffer.subarray(5, 5 + length));
      buffer = buffer.subarray(5 + length);
    }
  };
}

export async function queryStats(
  url,
  { patterns = [], regexp = false, reset = false, timeoutMs = 3000 } = {}
) {
  const session = http2.connect(url);
  const stats = [];
  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        session.destroy();
        reject(new Error("v2ray stats query timeout"));
      }
    }, timeoutMs);
    const fail = (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    };
    const finish = (grpcStatus, grpcMessage) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (String(grpcStatus || "0") !== "0") {
        reject(new Error(`grpc status ${grpcStatus} ${grpcMessage || ""}`));
        return;
      }
      session.close();
      resolve(stats);
    };
    const req = session.request({
      ":method": "POST",
      ":path": QUERY_PATH,
      "content-type": "application/grpc",
      te: "trailers"
    });
    const parseFrame = createFrameParser((message) => {
      stats.push(...decodeQueryStatsResponse(message));
    });
    req.on("response", (headers) => {
      if (headers[":status"] !== 200) {
        fail(new Error(`grpc http status ${headers[":status"]}`));
      }
    });
    req.on("data", (chunk) => {
      try {
        parseFrame(chunk);
      } catch (error) {
        fail(error);
      }
    });
    req.on("trailers", (headers) => {
      finish(headers["grpc-status"], headers["grpc-message"]);
    });
    req.on("end", () => {
      finish("0", "");
    });
    req.on("error", fail);
    req.end(grpcFrame(encodeQueryStatsRequest({ patterns, regexp, reset })));
  });
}
