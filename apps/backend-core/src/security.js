import { createHash, generateKeyPairSync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function createSecret(prefix = "sec") {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function createUuid() {
  return randomUUID();
}

export function createHex(bytes = 8) {
  return randomBytes(bytes).toString("hex");
}

export function createX25519KeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("x25519");
  return {
    privateKey: rawX25519Key(privateKey.export({ format: "der", type: "pkcs8" })),
    publicKey: rawX25519Key(publicKey.export({ format: "der", type: "spki" }))
  };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createEtag(payload) {
  return `"${sha256(JSON.stringify(payload)).slice(0, 32)}"`;
}

function rawX25519Key(der) {
  return der.subarray(-32).toString("base64url");
}
