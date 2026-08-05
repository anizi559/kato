import assert from "node:assert/strict";
import test from "node:test";
import { parseHysteriaTrafficOutput, parseXrayStatsOutput } from "../src/traffic-stats.js";

test("parseXrayStatsOutput extracts user uplink and downlink", () => {
  const stdout = JSON.stringify({
    stat: [
      { name: "user>>>user_1@kato.local>>>traffic>>>uplink", value: 100 },
      { name: "user>>>user_1@kato.local>>>traffic>>>downlink", value: 250 },
      { name: "user>>>user_2@kato.local>>>traffic>>>downlink", value: 80 },
      { name: "inbound>>>tcp>>>traffic>>>downlink", value: 999 }
    ]
  });
  const rows = parseXrayStatsOutput(stdout);
  assert.deepEqual(rows, [
    { userId: "user_1", uploadBytes: 100, downloadBytes: 250 },
    { userId: "user_2", uploadBytes: 0, downloadBytes: 80 }
  ]);
});

test("parseHysteriaTrafficOutput maps tx/rx to upload/download", () => {
  const text = JSON.stringify({
    user_1: { tx: 120, rx: 340 },
    user_2: { tx: 10, rx: 0 }
  });
  assert.deepEqual(parseHysteriaTrafficOutput(text), [
    { userId: "user_1", uploadBytes: 120, downloadBytes: 340 },
    { userId: "user_2", uploadBytes: 10, downloadBytes: 0 }
  ]);
});

test("parsers tolerate invalid and empty payloads", () => {
  assert.deepEqual(parseXrayStatsOutput("not json"), []);
  assert.deepEqual(parseXrayStatsOutput(""), []);
  assert.deepEqual(parseHysteriaTrafficOutput(""), []);
  assert.deepEqual(parseHysteriaTrafficOutput("{}"), []);
});
