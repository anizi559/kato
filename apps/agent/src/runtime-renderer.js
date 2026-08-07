import { PROTOCOLS, nowIso } from "../../../packages/shared/src/protocol.js";

export function renderRuntimeBundle(desired, options = {}) {
  assertDesired(desired);
  const state = desired.desiredState;
  const files = [];
  const warnings = [];

  if (state.kind === "proxy-node") {
    renderProxyNodeRuntime(desired, files, warnings);
  } else if (state.kind === "transit-relay") {
    renderTransitRelayRuntime(desired, files, warnings);
  } else {
    warnings.push(`No runtime renderer for role kind: ${state.kind}`);
  }

  return {
    renderedAt: nowIso(),
    configVersion: desired.configVersion,
    kind: state.kind,
    files,
    warnings
  };
}

function renderProxyNodeRuntime(desired, files, warnings) {
  const state = desired.desiredState;
  const anytlsInbounds = state.inbounds.filter((inbound) => inbound.protocol === PROTOCOLS.ANYTLS);
  if (anytlsInbounds.length) {
    files.push({
      component: "sing-box",
      path: "singbox/config.json",
      format: "json",
      content: `${JSON.stringify(renderSingboxConfig(anytlsInbounds), null, 2)}\n`
    });
  } else {
    warnings.push("Proxy node has no anytls inbounds");
  }
}

function renderTransitRelayRuntime(desired, files, warnings) {
  const state = desired.desiredState;
  if (!state.relayRules.length) {
    warnings.push("Transit relay has no active relay rules");
    return;
  }
  files.push({
    component: "realm",
    path: "realm/config.json",
    format: "json",
    content: `${JSON.stringify(renderRealmConfig(state.relayRules), null, 2)}\n`
  });
}

export function renderSingboxConfig(inbounds) {
  const usersById = new Map();
  for (const inbound of inbounds) {
    for (const user of inbound.users || []) {
      usersById.set(user.userId, user);
    }
  }
  const limitedUsers = [...usersById.values()].filter(
    (user) => Number(user.limits?.rateMbps) > 0
  );
  const outbounds = [{ type: "direct", tag: "direct" }];
  const routeRules = [];
  for (const user of limitedUsers) {
    const tag = `bw-${user.userId}`;
    outbounds.push({
      type: "bandwidth-limiter",
      tag,
      strategy: "global",
      mode: "bidirectional",
      speed: Math.round(Number(user.limits.rateMbps) * 125000),
      route: {
        rules: [],
        final: "direct"
      }
    });
    routeRules.push({
      auth_user: [user.userId],
      outbound: tag
    });
  }
  return {
    log: {
      level: "warn"
    },
    inbounds: inbounds.map((inbound) => {
      const tls = inbound.config?.tls || {};
      return {
        type: "anytls",
        tag: inbound.id,
        listen: inbound.listen || "0.0.0.0",
        listen_port: inbound.port,
        users: inbound.users.map((user) => ({
          name: user.userId,
          password: user.credential.password
        })),
        tls: {
          enabled: true,
          server_name: tls.sni || "localhost",
          certificate_path: tls.certPath || "",
          key_path: tls.keyPath || ""
        }
      };
    }),
    outbounds,
    ...(routeRules.length
      ? {
          route: {
            rules: routeRules,
            final: "direct"
          }
        }
      : {}),
    experimental: {
      clash_api: {
        external_controller: "127.0.0.1:19090",
        secret: "kato-local-stats"
      },
      v2ray_api: {
        listen: "127.0.0.1:19091",
        stats: {
          enabled: true,
          users: [...usersById.keys()]
        }
      }
    }
  };
}

export function renderRealmConfig(relayRules) {
  return {
    log: {
      level: "warn",
      output: "stdout"
    },
    network: {
      no_tcp: relayRules.every((rule) => rule.transport === "udp"),
      use_udp: relayRules.some((rule) => rule.transport === "udp")
    },
    endpoints: relayRules.map((rule) => ({
      listen: `${rule.entry.host}:${rule.entry.port}`,
      remote: `${rule.target.host}:${rule.target.port}`,
      network: {
        no_tcp: rule.transport === "udp",
        use_udp: rule.transport === "udp"
      }
    }))
  };
}

export function validateRenderedBundle(bundle) {
  const errors = [];
  for (const file of bundle.files) {
    if (file.format === "json") {
      validateJsonFile(file, errors);
    }
    if (file.component === "realm") {
      validateRealmFile(file, errors);
    }
    if (file.component === "sing-box") {
      validateSingboxFile(file, errors);
    }
  }
  if (errors.length) {
    throw new Error(`Rendered runtime config validation failed: ${errors.join("; ")}`);
  }
}

function validateJsonFile(file, errors) {
  try {
    JSON.parse(file.content);
  } catch (error) {
    errors.push(`${file.path}: invalid JSON: ${error.message}`);
  }
}

function validateRealmFile(file, errors) {
  let parsed;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return;
  }
  if (!Array.isArray(parsed.endpoints)) {
    errors.push(`${file.path}: endpoints must be an array`);
    return;
  }
  for (const endpoint of parsed.endpoints) {
    if (!endpoint.listen || !endpoint.remote) {
      errors.push(`${file.path}: every endpoint needs listen and remote`);
    }
  }
}

function validateSingboxFile(file, errors) {
  let parsed;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return;
  }
  if (!Array.isArray(parsed.inbounds) || !parsed.inbounds.length) {
    errors.push(`${file.path}: missing anytls inbounds`);
    return;
  }
  for (const inbound of parsed.inbounds) {
    if (inbound.type !== "anytls") {
      errors.push(`${file.path}: inbound type must be anytls`);
    }
    if (!Array.isArray(inbound.users) || !inbound.users.length) {
      errors.push(`${file.path}: anytls inbound has no users`);
    }
  }
}

function assertDesired(desired) {
  if (!desired || !desired.desiredState || !desired.configVersion) {
    throw new Error("Refusing to render invalid desired state");
  }
}
