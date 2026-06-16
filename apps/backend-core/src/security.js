import { createHash, generateKeyPairSync, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

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

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(String(password), salt, 32);
  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, salt, expected] = String(encoded || "").split(":");
  if (scheme !== "scrypt" || !salt || !expected) {
    return false;
  }
  const derived = await scrypt(String(password), salt, 32);
  return safeEqual(derived.toString("base64url"), expected);
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
