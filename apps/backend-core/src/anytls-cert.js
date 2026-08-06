import { randomBytes } from "node:crypto";
import { findZoneId, createDnsRecord } from "./cf-dns.js";
import { issueCertificate, readCertificate, renewCertificates } from "./certbot.js";

const CERT_ROOT = "/var/lib/kato/certs/anytls";
const WORK_ROOT = "/var/lib/kato/letsencrypt";

export function randomSubdomain() {
  return `${randomBytes(4).toString("hex")}-${randomBytes(2).toString("hex")}`;
}

export async function issueAnyTlsCert(store, { proxyNodeId, domain }) {
  const settings = store.getSettings();
  if (!settings.cloudflareApiToken) {
    throw httpError("请先在系统设置填写 Cloudflare API Token", 400);
  }
  if (!settings.acmeEmail) {
    throw httpError("请先在系统设置填写 ACME 邮箱", 400);
  }
  const proxyNode = store.state.proxyNodes.find((item) => item.id === proxyNodeId);
  if (!proxyNode) {
    throw httpError("代理服务器不存在", 404);
  }
  const ip = proxyNode.publicIp || proxyNode.publicHost;
  if (!ip) {
    throw httpError("代理服务器缺少公网 IP/主机", 400);
  }
  const baseDomain = String(domain || "").replace(/^\.+|\.+$/g, "");
  if (!/^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(baseDomain)) {
    throw httpError("证书基础域名格式不正确", 400);
  }

  const fullDomain = `${randomSubdomain()}.${baseDomain}`;
  const zoneId = await findZoneId(settings.cloudflareApiToken, baseDomain);
  await createDnsRecord(settings.cloudflareApiToken, zoneId, fullDomain, ip);

  const certName = `kato-anytls-${fullDomain}`;
  const issued = await issueCertificate({
    email: settings.acmeEmail,
    domain: fullDomain,
    apiToken: settings.cloudflareApiToken,
    workRoot: WORK_ROOT,
    certName
  });

  const certPath = `${CERT_ROOT}/${fullDomain}/fullchain.pem`;
  const keyPath = `${CERT_ROOT}/${fullDomain}/privkey.pem`;
  const record = await store.upsertAnyTlsCert({
    domain: fullDomain,
    certPath,
    keyPath,
    certPem: issued.certPem,
    keyPem: issued.keyPem,
    expiresAt: issued.expiresAt
  });
  return {
    domain: fullDomain,
    certPath,
    keyPath,
    expiresAt: record.expiresAt
  };
}

export async function renewAnyTlsCerts(store) {
  const settings = store.getSettings();
  if (!settings.cloudflareApiToken || !store.state.anytlsCerts.length) {
    return { ok: true, changed: 0 };
  }
  await renewCertificates({ workRoot: WORK_ROOT });
  let changed = 0;
  for (const cert of store.state.anytlsCerts) {
    const certName = `kato-anytls-${cert.domain}`;
    try {
      const current = await readCertificate(WORK_ROOT, certName);
      if (current.certPem !== cert.certPem) {
        await store.upsertAnyTlsCert({
          ...cert,
          certPem: current.certPem,
          keyPem: current.keyPem,
          expiresAt: current.expiresAt
        });
        changed += 1;
      }
    } catch {
      // 单个证书读取失败不影响其他证书
    }
  }
  return { ok: true, changed };
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
