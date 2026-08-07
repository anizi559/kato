import assert from "node:assert/strict";
import http2 from "node:http2";
import test from "node:test";
import {
  decodeQueryStatsResponse,
  encodeQueryStatsRequest,
  queryStats
} from "../src/v2ray-stats.js";

function varint(value) {
  const bytes = [];
  let v = BigInt(value);
  while (v > 0x7fn) {
    bytes.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
}

function bytesField(fieldNumber, value) {
  return Buffer.concat([varint((fieldNumber << 3) | 2), varint(value.length), value]);
}

function statMessage(name, value) {
  return Buffer.concat([
    bytesField(1, Buffer.from(name, "utf8")),
    varint((2 << 3) | 0),
    varint(value)
  ]);
}

function responseMessage(stats) {
  return Buffer.concat(stats.map((stat) => bytesField(1, statMessage(stat.name, stat.value))));
}

test("encodeQueryStatsRequest produces grpc body for patterns and reset", () => {
  const encoded = encodeQueryStatsRequest({ patterns: ["user>>>"], reset: true });
  // field 1 (repeated string) + field 3 (bool)
  const expected = Buffer.concat([
    varint((1 << 3) | 2),
    varint(7),
    Buffer.from("user>>>", "utf8"),
    varint((3 << 3) | 0),
    Buffer.from([1])
  ]);
  assert.deepEqual(encoded, expected);
});

test("decodeQueryStatsResponse parses user stats", () => {
  const payload = responseMessage([
    { name: "user>>>u1>>>traffic>>>uplink", value: 12345 },
    { name: "user>>>u1>>>traffic>>>downlink", value: 67890 },
    { name: "user>>>u2>>>traffic>>>downlink", value: 1 }
  ]);
  const stats = decodeQueryStatsResponse(payload);
  assert.deepEqual(stats, [
    { name: "user>>>u1>>>traffic>>>uplink", value: 12345 },
    { name: "user>>>u1>>>traffic>>>downlink", value: 67890 },
    { name: "user>>>u2>>>traffic>>>downlink", value: 1 }
  ]);
});

test("queryStats talks gRPC over h2c and returns stats", async () => {
  const server = http2.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  server.on("stream", (stream, headers) => {
    assert.equal(headers[":path"], "/v2ray.core.app.stats.command.StatsService/QueryStats");
    stream.on("data", () => {});
    stream.on("end", () => {
      stream.respond({
        ":status": 200,
        "content-type": "application/grpc"
      });
      const message = responseMessage([{ name: "user>>>u9>>>traffic>>>uplink", value: 42 }]);
      const frame = Buffer.alloc(5 + message.length);
      frame.writeUInt32BE(message.length, 1);
      message.copy(frame, 5);
      stream.write(frame);
      stream.end();
    });
  });

  try {
    const stats = await queryStats(`http://127.0.0.1:${address.port}`, {
      patterns: ["user>>>"],
      timeoutMs: 3000
    });
    assert.deepEqual(stats, [{ name: "user>>>u9>>>traffic>>>uplink", value: 42 }]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
