import { X509Certificate } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function issueCertificate({ email, domain, apiToken, workRoot, certName }) {
  await mkdir(workRoot, { recursive: true });
  const credentialsPath = join(workRoot, "cloudflare.ini");
  await writeFile(credentialsPath, `dns_cloudflare_api_token = ${apiToken}\n`, { mode: 0o600 });
  const name = certName || `kato-anytls-${domain.replace(/[^A-Za-z0-9.-]/g, "-")}`;
  const args = [
    "certonly",
    "--non-interactive",
    "--agree-tos",
    "--email", email,
    "--dns-cloudflare",
    "--dns-cloudflare-credentials", credentialsPath,
    "--dns-cloudflare-propagation-seconds", "30",
    "--config-dir", join(workRoot, "config"),
    "--work-dir", join(workRoot, "work"),
    "--logs-dir", join(workRoot, "logs"),
    "--cert-name", name,
    "--keep-until-expiring",
    "-d", domain
  ];
  const result = await runCommand("certbot", args);
  if (!result.ok) {
    throw Object.assign(new Error(`Let's Encrypt 签发失败：${result.stderr || result.stdout}`), { statusCode: 500 });
  }
  return readCertificate(workRoot, name);
}

export async function renewCertificates({ workRoot }) {
  const args = [
    "renew",
    "--quiet",
    "--config-dir", join(workRoot, "config"),
    "--work-dir", join(workRoot, "work"),
    "--logs-dir", join(workRoot, "logs")
  ];
  const result = await runCommand("certbot", args);
  return { ok: result.ok, output: result.stderr || result.stdout };
}

export async function readCertificate(workRoot, certName) {
  const liveDir = join(workRoot, "config", "live", certName);
  const certPem = await readFile(join(liveDir, "fullchain.pem"), "utf8");
  const keyPem = await readFile(join(liveDir, "privkey.pem"), "utf8");
  const cert = new X509Certificate(certPem);
  return {
    certPem,
    keyPem,
    expiresAt: cert.validTo
  };
}

export function certLivePath(workRoot, certName) {
  return join(workRoot, "config", "live", certName);
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ ok: false, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
  });
}
