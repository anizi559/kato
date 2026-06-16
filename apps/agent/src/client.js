import { VERSION } from "../../../packages/shared/src/protocol.js";

export class BackendClient {
  constructor({ backendUrl, agentId, agentSecret }) {
    this.backendUrl = backendUrl.replace(/\/$/, "");
    this.agentId = agentId;
    this.agentSecret = agentSecret;
  }

  static async register({ backendUrl, bootstrapToken, role, name }) {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/agents/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bootstrapToken,
        agentVersion: VERSION,
        hostname: name,
        capabilities: {
          role,
          lastKnownGood: true,
          etag: true,
          liteMode: true
        }
      })
    });
    return parseJsonResponse(response);
  }

  async heartbeat(actualState) {
    const response = await fetch(`${this.backendUrl}/api/v1/agents/${this.agentId}/heartbeat`, {
      method: "POST",
      headers: this.authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ actualState })
    });
    return parseJsonResponse(response);
  }

  async desiredState(etag) {
    const headers = this.authHeaders();
    if (etag) {
      headers["if-none-match"] = etag;
    }
    const response = await fetch(`${this.backendUrl}/api/v1/agents/${this.agentId}/desired-state`, {
      headers
    });
    if (response.status === 304) {
      return { notModified: true, etag };
    }
    const body = await parseJsonResponse(response);
    return { body, etag: response.headers.get("etag") };
  }

  async reportConfigApplied(report) {
    const response = await fetch(`${this.backendUrl}/api/v1/agents/${this.agentId}/reports/config-applied`, {
      method: "POST",
      headers: this.authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(report)
    });
    return parseJsonResponse(response);
  }

  authHeaders(extra = {}) {
    return {
      authorization: `Bearer ${this.agentSecret}`,
      ...extra
    };
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = body.message || body.error || `HTTP ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status });
  }
  return body;
}
