import { PROTOCOLS, nowIso } from "../../../packages/shared/src/protocol.js";

export function renderRuntimeBundle(desired, options = {}) {
  assertDesired(desired);
  const state = desired.desiredState;
  const files = [];
  const warnings = [];

  if (state.kind === "proxy-node") {
    renderProxyNodeRuntime(desired, files, warnings, options);
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

function renderProxyNodeRuntime(desired, files, warnings, options) {
  const state = desired.desiredState;
  const vlessInbounds = state.inbounds.filter((inbound) => inbound.protocol === PROTOCOLS.VLESS_REALITY);
  const hysteriaInbounds = state.inbounds.filter((inbound) => inbound.protocol === PROTOCOLS.HYSTERIA2);

  if (vlessInbounds.length) {
    files.push({
      component: "xray",
      path: "xray/config.json",
      format: "json",
      content: `${JSON.stringify(renderXrayConfig(vlessInbounds), null, 2)}\n`
    });
  }

  for (const inbound of hysteriaInbounds) {
    const rendered = renderHysteriaConfig(inbound, options);
    files.push({
      component: "hysteria2",
      path: `hysteria2/${safeName(inbound.id)}.yaml`,
      format: "yaml",
      content: rendered.content
    });
    warnings.push(...rendered.warnings);
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

export function renderXrayConfig(inbounds) {
  return {
    log: {
      loglevel: "warning"
    },
    inbounds: inbounds.map(renderXrayVlessInbound),
    outbounds: [
      {
        protocol: "freedom",
        tag: "direct"
      },
      {
        protocol: "blackhole",
        tag: "blocked"
      }
    ],
    routing: {
      domainStrategy: "AsIs",
      rules: []
    },
    policy: {
      levels: {
        0: {
          handshake: 4,
          connIdle: 300,
          uplinkOnly: 2,
          downlinkOnly: 5
        }
      }
    }
  };
}

function renderXrayVlessInbound(inbound) {
  const reality = inbound.config?.reality || {};
  return {
    tag: inbound.id,
    listen: inbound.listen || "0.0.0.0",
    port: inbound.port,
    protocol: "vless",
    settings: {
      decryption: "none",
      clients: inbound.users.map((user) => ({
        id: user.credential.uuid,
        flow: user.credential.flow || inbound.config?.flow || "xtls-rprx-vision",
        email: userEmail(user)
      }))
    },
    streamSettings: {
      network: "tcp",
      security: "reality",
      realitySettings: {
        show: false,
        dest: reality.dest || "www.microsoft.com:443",
        xver: Number(reality.xver || 0),
        serverNames: arrayOrDefault(reality.serverNames, ["www.microsoft.com"]),
        privateKey: reality.privateKey,
        shortIds: arrayOrDefault(reality.shortIds, [""]),
        spiderX: reality.spiderX || "/"
      }
    },
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls", "quic"]
    }
  };
}

export function renderHysteriaConfig(inbound, options = {}) {
  const warnings = [];
  const config = inbound.config || {};
  const tls = config.tls || {};
  const cert = tls.certPath || tls.cert || options.hysteria2?.certPath || null;
  const key = tls.keyPath || tls.key || options.hysteria2?.keyPath || null;
  if (!cert || !key) {
    warnings.push(`Hysteria2 inbound ${inbound.id} has no TLS cert/key path`);
  }

  const lines = [
    `listen: ${quoteYaml(`:${inbound.port}`)}`,
    "auth:",
    "  type: userpass",
    "  userpass:"
  ];

  if (!inbound.users.length) {
    lines.push("    __disabled__: __no_users__");
  } else {
    for (const user of inbound.users) {
      lines.push(`    ${quoteYaml(user.userId)}: ${quoteYaml(user.credential.password)}`);
    }
  }

  if (cert && key) {
    lines.push("tls:");
    lines.push(`  cert: ${quoteYaml(cert)}`);
    lines.push(`  key: ${quoteYaml(key)}`);
  }

  if (config.obfs?.enabled !== false) {
    lines.push("obfs:");
    lines.push("  type: salamander");
    lines.push("  salamander:");
    lines.push(`    password: ${quoteYaml(config.obfs?.password || "")}`);
  }

  const upMbps = config.bandwidth?.upMbps || 100;
  const downMbps = config.bandwidth?.downMbps || 100;
  lines.push("bandwidth:");
  lines.push(`  up: ${quoteYaml(`${upMbps} mbps`)}`);
  lines.push(`  down: ${quoteYaml(`${downMbps} mbps`)}`);

  return {
    content: `${lines.join("\n")}\n`,
    warnings
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
    if (file.component === "hysteria2") {
      validateHysteriaFile(file, errors);
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

function validateHysteriaFile(file, errors) {
  if (!file.content.includes("auth:") || !file.content.includes("userpass:")) {
    errors.push(`${file.path}: missing userpass auth block`);
  }
  if (!file.content.includes("listen:")) {
    errors.push(`${file.path}: missing listen`);
  }
}

function assertDesired(desired) {
  if (!desired || !desired.desiredState || !desired.configVersion) {
    throw new Error("Refusing to render invalid desired state");
  }
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function userEmail(user) {
  return `${user.userId}@kato.local`;
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}
