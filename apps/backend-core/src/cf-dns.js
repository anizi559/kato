export async function findZoneId(apiToken, domain) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, {
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json"
    }
  });
  const payload = await parseCloudflare(response);
  const zone = payload.result?.[0];
  if (!zone) {
    throw Object.assign(new Error(`Cloudflare zone not found: ${domain}`), { statusCode: 400 });
  }
  return zone.id;
}

export async function createDnsRecord(apiToken, zoneId, name, content, type = "A", proxied = false) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type,
      name,
      content,
      ttl: 120,
      proxied
    })
  });
  const payload = await parseCloudflare(response);
  return payload.result;
}

async function parseCloudflare(response) {
  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    // keep empty
  }
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || `Cloudflare HTTP ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status === 401 || response.status === 403 ? 401 : 400 });
  }
  return payload;
}
