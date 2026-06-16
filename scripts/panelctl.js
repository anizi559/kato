#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8080";
const DEFAULT_ADMIN_TOKEN = process.env.BACKEND_ADMIN_TOKEN || "";

const command = process.argv[2] || "help";
const args = parseArgs(process.argv.slice(3));
const positionals = args._ || [];

try {
  if (command === "health") {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/health`);
    console.log(await response.text());
  } else if (command === "version") {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/version`);
    console.log(await response.text());
  } else if (command === "summary") {
    console.log(await adminRequest("/api/v1/admin/summary"));
  } else if (command === "create-bootstrap-token") {
    const role = args.role;
    if (!role) {
      throw new Error("Missing --role");
    }
    const adminToken = getAdminToken(args);
    const response = await fetch(`${DEFAULT_BACKEND_URL}/api/v1/bootstrap-tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken
      },
      body: JSON.stringify({
        role,
        name: args.name || role,
        ttlSeconds: Number(args.ttlSeconds || 900),
        resourceId: args.resourceId || args["resource-id"] || null
      })
    });
    console.log(await response.text());
  } else if (command === "agents") {
    console.log(await adminRequest("/api/v1/admin/agents"));
  } else if (command === "list") {
    const collection = positionals[0] || args.collection;
    if (!collection) {
      throw new Error("Missing collection");
    }
    console.log(await adminRequest(`/api/v1/admin/${collection}`));
  } else if (command === "get") {
    const collection = positionals[0] || args.collection;
    const id = positionals[1] || args.id;
    if (!collection || !id) {
      throw new Error("Usage: panelctl get <collection> <id>");
    }
    console.log(await adminRequest(`/api/v1/admin/${collection}/${id}`));
  } else if (command === "create") {
    const collection = positionals[0] || args.collection;
    if (!collection) {
      throw new Error("Usage: panelctl create <collection> --json '{...}'");
    }
    console.log(
      await adminRequest(`/api/v1/admin/${collection}`, {
        method: "POST",
        body: await readJsonArg(args)
      })
    );
  } else if (command === "patch") {
    const collection = positionals[0] || args.collection;
    const id = positionals[1] || args.id;
    if (!collection || !id) {
      throw new Error("Usage: panelctl patch <collection> <id> --json '{...}'");
    }
    console.log(
      await adminRequest(`/api/v1/admin/${collection}/${id}`, {
        method: "PATCH",
        body: await readJsonArg(args)
      })
    );
  } else if (command === "delete") {
    const collection = positionals[0] || args.collection;
    const id = positionals[1] || args.id;
    if (!collection || !id) {
      throw new Error("Usage: panelctl delete <collection> <id>");
    }
    console.log(
      await adminRequest(`/api/v1/admin/${collection}/${id}`, {
        method: "DELETE"
      })
    );
  } else if (command === "create-relay-access-node") {
    console.log(
      await adminRequest("/api/v1/admin/access-nodes/relay", {
        method: "POST",
        body: await readJsonArg(args)
      })
    );
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function getAdminToken(args) {
  const token = args.adminToken || args["admin-token"] || DEFAULT_ADMIN_TOKEN;
  if (!token) {
    throw new Error("Missing admin token. Use --adminToken or BACKEND_ADMIN_TOKEN.");
  }
  return token;
}

async function adminRequest(path, options = {}) {
  const headers = {
    "x-admin-token": getAdminToken(args),
    ...(options.headers || {})
  };
  if (options.body) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${DEFAULT_BACKEND_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return response.text();
}

async function readJsonArg(values) {
  if (values.json) {
    return JSON.parse(values.json);
  }
  if (values.file) {
    return JSON.parse(await readFile(values.file, "utf8"));
  }
  throw new Error("Missing --json or --file");
}

function parseArgs(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) {
      result._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function printHelp() {
  console.log(`panelctl commands

Usage:
  node scripts/panelctl.js health
  node scripts/panelctl.js version
  node scripts/panelctl.js summary
  node scripts/panelctl.js agents
  node scripts/panelctl.js list users
  node scripts/panelctl.js get proxy-nodes <id>
  node scripts/panelctl.js create users --json '{"name":"alice"}'
  node scripts/panelctl.js patch access-nodes <id> --json '{"enabled":false}'
  node scripts/panelctl.js delete access-nodes <id>
  node scripts/panelctl.js create-relay-access-node --json '{"inboundId":"...","transitRelayId":"...","entryPort":8443}'
  node scripts/panelctl.js create-bootstrap-token --role proxy-node --resourceId <proxy-node-id> --name hk-01

Environment:
  BACKEND_URL=http://127.0.0.1:8080
  BACKEND_ADMIN_TOKEN=<admin-token>
`);
}
