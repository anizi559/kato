#!/usr/bin/env bash
set -euo pipefail

APP_NAME="kato"
APP_VERSION="0.3.0"
DEFAULT_INSTALL_ROOT="/opt/kato"
DEFAULT_NODE_VERSION="22.16.0"
DEFAULT_REALM_VERSION="v2.9.4"

role=""
source_dir="${KATO_SOURCE_DIR:-}"
repo_url="${KATO_REPO_URL:-}"
install_root="${KATO_INSTALL_ROOT:-$DEFAULT_INSTALL_ROOT}"
node_version="${KATO_NODE_VERSION:-$DEFAULT_NODE_VERSION}"
realm_version="${KATO_REALM_VERSION:-$DEFAULT_REALM_VERSION}"
apt_mirror="${KATO_APT_MIRROR:-}"
skip_deps="false"
skip_source_sync="false"
skip_runtime_binaries="false"
non_interactive="false"

listen_host="${KATO_LISTEN_HOST:-0.0.0.0}"
listen_port="${KATO_LISTEN_PORT:-8080}"
admin_ui_port="${KATO_ADMIN_UI_PORT:-80}"
backend_url="${KATO_BACKEND_URL:-}"
admin_token="${BACKEND_ADMIN_TOKEN:-${KATO_ADMIN_TOKEN:-}}"
admin_cors_origins="${BACKEND_ADMIN_CORS_ORIGINS:-}"
agent_name="${KATO_AGENT_NAME:-}"
bootstrap_token="${KATO_BOOTSTRAP_TOKEN:-}"
agent_auto_start="${KATO_AGENT_AUTO_START:-false}"
binary_validation="${KATO_BINARY_VALIDATION:-false}"

usage() {
  cat <<USAGE
Kato Control Plane installer ${APP_VERSION}

Usage:
  sudo ./install.sh --role <role> [options]

Roles:
  backend-core       Panel backend API and database store
  admin-ui           Panel frontend UI served by nginx
  frontend-edge      Frontend edge agent placeholder
  subscription-edge  Subscription edge agent placeholder
  proxy-node         Proxy-node agent plus Xray/Hysteria2 runtime binaries
  transit-relay      Transit-relay agent plus Realm runtime binary

Common options:
  --role <role>                  Role to install. Aliases: backend, frontend, proxy, relay
  --source-dir <path>            Source tree to install from
  --repo-url <url>               Clone source when no local source tree is available
  --install-root <path>          Install root, default: ${DEFAULT_INSTALL_ROOT}
  --apt-mirror <none|tuna|ustc|aliyun>
  --skip-deps                    Do not install OS packages or Node.js
  --skip-source-sync             Use current source location directly
  --non-interactive              Fail instead of prompting

Backend options:
  --listen-host <host>           Backend listen host, default: 0.0.0.0
  --listen-port <port>           Backend listen port, default: 8080
  --admin-token <token>          Backend admin token. Generated when omitted
  --admin-cors-origins <origins> Comma-separated allowed frontend origins

Admin UI options:
  --backend-url <url>            API base URL embedded into the frontend build
  --admin-ui-port <port>         nginx listen port, default: 80

Agent options:
  --backend-url <url>            Backend API URL, required for agent roles
  --bootstrap-token <token>      One-time bootstrap token, required for first agent registration
  --agent-name <name>            Agent display name
  --agent-auto-start <true|false>
  --binary-validation <true|false>
  --skip-runtime-binaries        Do not install Xray/Hysteria2/Realm

Examples:
  sudo ./install.sh --role backend-core --listen-port 8080
  sudo ./install.sh --role admin-ui --backend-url http://156.226.168.215:8080
  sudo ./install.sh --role proxy-node --backend-url http://panel:8080 --bootstrap-token boot_xxx
USAGE
}

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

warn() {
  printf '[%s] WARN: %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role)
      role="${2:-}"
      shift 2
      ;;
    --source-dir)
      source_dir="${2:-}"
      shift 2
      ;;
    --repo-url)
      repo_url="${2:-}"
      shift 2
      ;;
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --node-version)
      node_version="${2:-}"
      shift 2
      ;;
    --realm-version)
      realm_version="${2:-}"
      shift 2
      ;;
    --apt-mirror)
      apt_mirror="${2:-}"
      shift 2
      ;;
    --listen-host)
      listen_host="${2:-}"
      shift 2
      ;;
    --listen-port)
      listen_port="${2:-}"
      shift 2
      ;;
    --admin-token)
      admin_token="${2:-}"
      shift 2
      ;;
    --admin-cors-origins)
      admin_cors_origins="${2:-}"
      shift 2
      ;;
    --backend-url)
      backend_url="${2:-}"
      shift 2
      ;;
    --admin-ui-port)
      admin_ui_port="${2:-}"
      shift 2
      ;;
    --bootstrap-token)
      bootstrap_token="${2:-}"
      shift 2
      ;;
    --agent-name)
      agent_name="${2:-}"
      shift 2
      ;;
    --agent-auto-start)
      agent_auto_start="${2:-}"
      shift 2
      ;;
    --binary-validation)
      binary_validation="${2:-}"
      shift 2
      ;;
    --skip-deps)
      skip_deps="true"
      shift
      ;;
    --skip-source-sync)
      skip_source_sync="true"
      shift
      ;;
    --skip-runtime-binaries)
      skip_runtime_binaries="true"
      shift
      ;;
    --non-interactive)
      non_interactive="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

normalize_role() {
  case "$1" in
    backend|panel-backend|backend-core)
      printf 'backend-core'
      ;;
    frontend|panel-frontend|admin|admin-ui)
      printf 'admin-ui'
      ;;
    frontend-edge)
      printf 'frontend-edge'
      ;;
    subscription|subscription-edge)
      printf 'subscription-edge'
      ;;
    proxy|proxy-node)
      printf 'proxy-node'
      ;;
    relay|transit|transit-relay)
      printf 'transit-relay'
      ;;
    *)
      return 1
      ;;
  esac
}

prompt_role() {
  if [[ "$non_interactive" == "true" || ! -t 0 ]]; then
    usage >&2
    die "Missing --role"
  fi

  cat <<'MENU'
Select install role:
  1) backend-core       Panel backend API
  2) admin-ui           Panel frontend UI
  3) frontend-edge      Frontend edge agent
  4) subscription-edge  Subscription edge agent
  5) proxy-node         Proxy-node agent
  6) transit-relay      Transit-relay agent
MENU
  read -r -p "Role number: " choice
  case "$choice" in
    1) role="backend-core" ;;
    2) role="admin-ui" ;;
    3) role="frontend-edge" ;;
    4) role="subscription-edge" ;;
    5) role="proxy-node" ;;
    6) role="transit-relay" ;;
    *) die "Unsupported role selection: $choice" ;;
  esac
}

if [[ -z "$role" ]]; then
  prompt_role
fi

if ! role="$(normalize_role "$role")"; then
  usage >&2
  die "Unsupported role: $role"
fi

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Please run as root, for example: sudo ./install.sh --role ${role}"
  fi
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || die "This installer currently supports Linux servers only"
  [[ -d /run/systemd/system ]] || die "systemd is required"
}

load_os_release() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-}"
  OS_VERSION_ID="${VERSION_ID:-}"
  OS_CODENAME="${VERSION_CODENAME:-}"
}

is_agent_role() {
  case "$role" in
    frontend-edge|subscription-edge|proxy-node|transit-relay)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

node_bin() {
  printf '%s/node/bin/node' "$install_root"
}

npm_bin() {
  printf '%s/node/bin/npm' "$install_root"
}

target_source_dir() {
  printf '%s/src' "$install_root"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

apt_updated="false"

apt_update_once() {
  if [[ "$apt_updated" == "false" ]]; then
    log "Updating apt package index"
    DEBIAN_FRONTEND=noninteractive apt-get update
    apt_updated="true"
  fi
}

install_packages() {
  local missing=()
  for pkg in "$@"; do
    if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
      missing+=("$pkg")
    fi
  done
  if [[ "${#missing[@]}" -eq 0 ]]; then
    return
  fi
  apt_update_once
  log "Installing packages: ${missing[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
}

configure_apt_mirror() {
  [[ -n "$apt_mirror" && "$apt_mirror" != "none" ]] || return 0
  case "$apt_mirror" in
    tuna)
      debian_uri="https://mirrors.tuna.tsinghua.edu.cn/debian"
      debian_security_uri="https://mirrors.tuna.tsinghua.edu.cn/debian-security"
      ubuntu_uri="https://mirrors.tuna.tsinghua.edu.cn/ubuntu"
      ;;
    ustc)
      debian_uri="https://mirrors.ustc.edu.cn/debian"
      debian_security_uri="https://mirrors.ustc.edu.cn/debian-security"
      ubuntu_uri="https://mirrors.ustc.edu.cn/ubuntu"
      ;;
    aliyun)
      debian_uri="https://mirrors.aliyun.com/debian"
      debian_security_uri="https://mirrors.aliyun.com/debian-security"
      ubuntu_uri="https://mirrors.aliyun.com/ubuntu"
      ;;
    *)
      die "Unsupported apt mirror: $apt_mirror"
      ;;
  esac

  local stamp
  stamp="$(date '+%Y%m%d%H%M%S')"
  mkdir -p /etc/apt/sources.list.d
  if [[ -f /etc/apt/sources.list ]]; then
    cp -a /etc/apt/sources.list "/etc/apt/sources.list.kato-bak-${stamp}"
    mv /etc/apt/sources.list "/etc/apt/sources.list.kato-disabled-${stamp}"
  fi
  if [[ -d /etc/apt/sources.list.d ]]; then
    find /etc/apt/sources.list.d -maxdepth 1 -type f \( -name '*.list' -o -name '*.sources' \) \
      -exec cp -a {} "{}.kato-bak-${stamp}" \;
    find /etc/apt/sources.list.d -maxdepth 1 -type f \( -name '*.list' -o -name '*.sources' \) \
      ! -name 'kato-*.sources' -exec mv {} "{}.kato-disabled-${stamp}" \;
  fi

  if [[ "$OS_ID" == "debian" ]]; then
    [[ -n "$OS_CODENAME" ]] || die "Cannot detect Debian codename for apt mirror"
    cat >/etc/apt/sources.list.d/kato-debian.sources <<EOF
Types: deb
URIs: ${debian_uri}
Suites: ${OS_CODENAME} ${OS_CODENAME}-updates
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: ${debian_security_uri}
Suites: ${OS_CODENAME}-security
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
EOF
  elif [[ "$OS_ID" == "ubuntu" ]]; then
    [[ -n "$OS_CODENAME" ]] || die "Cannot detect Ubuntu codename for apt mirror"
    cat >/etc/apt/sources.list.d/kato-ubuntu.sources <<EOF
Types: deb
URIs: ${ubuntu_uri}
Suites: ${OS_CODENAME} ${OS_CODENAME}-updates ${OS_CODENAME}-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: ${ubuntu_uri}
Suites: ${OS_CODENAME}-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
  else
    die "Apt mirror rewrite supports Debian/Ubuntu only, detected: ${OS_ID}"
  fi
  apt_updated="false"
  log "Apt mirror configured: ${apt_mirror}"
}

ensure_base_dependencies() {
  [[ "$skip_deps" != "true" ]] || return 0
  case "$OS_ID" in
    debian|ubuntu)
      install_packages ca-certificates curl git rsync tar xz-utils openssl lsof procps jq unzip libcap2-bin
      ;;
    *)
      die "Unsupported Linux distribution: ${OS_ID}. Debian/Ubuntu are currently supported."
      ;;
  esac
}

node_major_ok() {
  local candidate="$1"
  [[ -x "$candidate" ]] || return 1
  local major
  major="$("$candidate" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
  [[ "$major" =~ ^[0-9]+$ && "$major" -ge 22 ]]
}

node_arch() {
  case "$(uname -m)" in
    x86_64|amd64)
      printf 'x64'
      ;;
    aarch64|arm64)
      printf 'arm64'
      ;;
    *)
      die "Unsupported Node.js architecture: $(uname -m)"
      ;;
  esac
}

install_node() {
  local managed_node
  managed_node="$(node_bin)"
  if node_major_ok "$managed_node"; then
    log "Using managed Node.js: $("$managed_node" -v)"
    return
  fi

  if command_exists node && command_exists npm && node_major_ok "$(command -v node)"; then
    log "Using system Node.js: $(node -v)"
    mkdir -p "$install_root/node/bin"
    ln -sfn "$(command -v node)" "$install_root/node/bin/node"
    ln -sfn "$(command -v npm)" "$install_root/node/bin/npm"
    if command_exists npx; then
      ln -sfn "$(command -v npx)" "$install_root/node/bin/npx"
    fi
    return
  fi

  [[ "$skip_deps" != "true" ]] || die "Node.js >= 22 is required and --skip-deps was provided"

  local arch asset url tmp
  arch="$(node_arch)"
  asset="node-v${node_version}-linux-${arch}"
  url="https://nodejs.org/dist/v${node_version}/${asset}.tar.xz"
  tmp="$(mktemp -d)"
  log "Installing Node.js v${node_version} (${arch})"
  curl -fsSL --retry 3 --connect-timeout 20 -o "${tmp}/${asset}.tar.xz" "$url"
  mkdir -p "$install_root"
  rm -rf "${install_root}/${asset}"
  tar -xJf "${tmp}/${asset}.tar.xz" -C "$install_root"
  ln -sfn "${install_root}/${asset}" "${install_root}/node"
  ln -sfn "${install_root}/node/bin/node" /usr/local/bin/node
  ln -sfn "${install_root}/node/bin/npm" /usr/local/bin/npm
  ln -sfn "${install_root}/node/bin/npx" /usr/local/bin/npx
  rm -rf "$tmp"
  log "Node.js installed: $("${install_root}/node/bin/node" -v)"
}

looks_like_source_tree() {
  local dir="$1"
  [[ -f "${dir}/package.json" && -d "${dir}/apps/backend-core" && -d "${dir}/packages/shared" ]]
}

resolve_source_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -n "$source_dir" ]]; then
    source_dir="$(cd "$source_dir" && pwd)"
    looks_like_source_tree "$source_dir" || die "Invalid --source-dir: $source_dir"
    return
  fi

  if looks_like_source_tree "$PWD"; then
    source_dir="$(pwd)"
    return
  fi

  if looks_like_source_tree "$script_dir"; then
    source_dir="$script_dir"
    return
  fi

  if looks_like_source_tree "$(target_source_dir)"; then
    source_dir="$(target_source_dir)"
    return
  fi

  if [[ -n "$repo_url" ]]; then
    source_dir="$(target_source_dir)"
    if [[ -d "$source_dir/.git" ]]; then
      log "Updating source from ${repo_url}"
      git -C "$source_dir" fetch --all --prune
      git -C "$source_dir" pull --ff-only
    else
      log "Cloning source from ${repo_url}"
      rm -rf "$source_dir"
      git clone "$repo_url" "$source_dir"
    fi
    return
  fi

  die "Cannot locate source tree. Run from the project root, pass --source-dir, or pass --repo-url."
}

sync_source_tree() {
  local target
  target="$(target_source_dir)"
  mkdir -p "$install_root"

  if [[ "$skip_source_sync" == "true" || "$(cd "$source_dir" && pwd)" == "$(mkdir -p "$target" && cd "$target" && pwd)" ]]; then
    log "Using source tree: $source_dir"
    return
  fi

  log "Syncing source tree to ${target}"
  mkdir -p "$target"
  rsync -a --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'apps/admin-ui/node_modules' \
    --exclude 'apps/admin-ui/dist' \
    --exclude 'data' \
    --exclude 'tools/downloads' \
    "${source_dir}/" "${target}/"
  chmod +x "${target}/install.sh" || true
  source_dir="$target"
}

ensure_kato_user_and_dirs() {
  if ! id -u kato >/dev/null 2>&1; then
    log "Creating system user: kato"
    useradd --system --home /var/lib/kato --shell /usr/sbin/nologin kato
  fi
  install -d -m 0755 -o root -g root "$install_root"
  install -d -m 0750 -o root -g kato /etc/kato
  install -d -m 0750 -o kato -g kato /var/lib/kato
  install -d -m 0750 -o kato -g kato /var/log/kato
}

public_ipv4() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

write_backend_config() {
  local config_path="/etc/kato/backend-core.json"
  local env_path="/etc/kato/backend-core.env"
  local public_ip origins

  if [[ -z "$admin_token" && -f "$env_path" ]]; then
    admin_token="$(awk -F= '/^BACKEND_ADMIN_TOKEN=/{print $2; exit}' "$env_path" | sed 's/^"//; s/"$//' || true)"
  fi
  if [[ -z "$admin_token" ]]; then
    admin_token="$(openssl rand -hex 32)"
  fi

  public_ip="$(public_ipv4)"
  if [[ -z "$admin_cors_origins" ]]; then
    origins="http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1,http://localhost"
    if [[ -n "$public_ip" ]]; then
      origins="${origins},http://${public_ip},http://${public_ip}:5173,http://${public_ip}:${admin_ui_port}"
    fi
    admin_cors_origins="$origins"
  fi

  BACKEND_LISTEN_HOST="$listen_host" \
  BACKEND_LISTEN_PORT="$listen_port" \
  BACKEND_STORE_PATH="/var/lib/kato/backend-core.json" \
  BACKEND_ADMIN_TOKEN_VALUE="$admin_token" \
  BACKEND_CORS_ORIGINS="$admin_cors_origins" \
  "$install_root/node/bin/node" <<'NODE' >"$config_path"
const config = {
  host: process.env.BACKEND_LISTEN_HOST,
  port: Number(process.env.BACKEND_LISTEN_PORT),
  storePath: process.env.BACKEND_STORE_PATH,
  adminToken: process.env.BACKEND_ADMIN_TOKEN_VALUE,
  adminCorsOrigins: process.env.BACKEND_CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
};
process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
NODE

  cat >"$env_path" <<EOF
NODE_ENV=production
BACKEND_CONFIG=${config_path}
BACKEND_ADMIN_TOKEN=${admin_token}
BACKEND_ADMIN_CORS_ORIGINS=${admin_cors_origins}
EOF
  chown root:kato "$config_path" "$env_path"
  chmod 0640 "$config_path" "$env_path"
}

write_systemd_service() {
  local name="$1"
  local content="$2"
  printf '%s\n' "$content" >"/etc/systemd/system/${name}.service"
  chmod 0644 "/etc/systemd/system/${name}.service"
}

install_backend_core() {
  log "Installing backend-core"
  write_backend_config

  write_systemd_service "kato-backend-core" "[Unit]
Description=Kato backend core
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=kato
Group=kato
WorkingDirectory=${source_dir}
EnvironmentFile=/etc/kato/backend-core.env
ExecStart=${install_root}/node/bin/node apps/backend-core/src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/var/lib/kato /var/log/kato

[Install]
WantedBy=multi-user.target"

  systemctl daemon-reload
  systemctl enable --now kato-backend-core.service
  systemctl restart kato-backend-core.service
  wait_for_backend

  log "backend-core installed"
  log "API URL: http://$(public_ipv4):${listen_port}"
  log "Admin token saved at /etc/kato/backend-core.env"
}

wait_for_backend() {
  local url="http://127.0.0.1:${listen_port}/health"
  local summary_url="http://127.0.0.1:${listen_port}/api/v1/admin/summary"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      curl -fsS -H "x-admin-token: ${admin_token}" "$summary_url" >/dev/null
      return
    fi
    sleep 1
  done
  journalctl -u kato-backend-core.service -n 80 --no-pager >&2 || true
  die "backend-core health check failed"
}

install_nginx() {
  [[ "$skip_deps" == "true" ]] || install_packages nginx
  systemctl enable --now nginx.service
}

install_admin_ui() {
  log "Installing admin-ui"
  install_nginx

  local app_dir="${source_dir}/apps/admin-ui"
  [[ -d "$app_dir" ]] || die "admin-ui source not found: $app_dir"
  if [[ -z "$backend_url" ]]; then
    backend_url="http://127.0.0.1:${listen_port}"
  fi

  log "Installing frontend npm dependencies"
  (cd "$app_dir" && "$install_root/node/bin/npm" ci)

  log "Building admin-ui"
  (cd "$app_dir" && VITE_ADMIN_API_BASE_URL="$backend_url" "$install_root/node/bin/npm" run build)

  install -d -m 0755 -o root -g root /var/www/kato-admin-ui
  rsync -a --delete "${app_dir}/dist/" /var/www/kato-admin-ui/

  if [[ "$admin_ui_port" == "80" && -e /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi

  cat >/etc/nginx/sites-available/kato-admin-ui.conf <<EOF
server {
    listen ${admin_ui_port} default_server;
    listen [::]:${admin_ui_port} default_server;
    server_name _;
    root /var/www/kato-admin-ui;
    index index.html;

    location = /health {
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  ln -sfn /etc/nginx/sites-available/kato-admin-ui.conf /etc/nginx/sites-enabled/kato-admin-ui.conf
  nginx -t
  systemctl reload nginx.service
  curl -fsS "http://127.0.0.1:${admin_ui_port}/health" >/dev/null
  log "admin-ui installed: http://$(public_ipv4):${admin_ui_port}"
}

github_latest_tag() {
  local repo="$1"
  curl -fsSL --retry 3 "https://api.github.com/repos/${repo}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' \
    | head -n 1
}

install_xray() {
  if command_exists xray; then
    log "Xray already installed: $(xray version 2>/dev/null | head -n 1 || true)"
    return
  fi
  local arch asset version tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="Xray-linux-64.zip" ;;
    aarch64|arm64) asset="Xray-linux-arm64-v8a.zip" ;;
    *) die "Unsupported Xray architecture: $(uname -m)" ;;
  esac
  version="${KATO_XRAY_VERSION:-$(github_latest_tag XTLS/Xray-core)}"
  [[ -n "$version" ]] || die "Cannot resolve latest Xray version"
  tmp="$(mktemp -d)"
  log "Installing Xray ${version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/XTLS/Xray-core/releases/download/${version}/${asset}"
  unzip -q "${tmp}/${asset}" -d "$tmp/xray"
  install -m 0755 "${tmp}/xray/xray" /usr/local/bin/xray
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/xray || warn "setcap failed for xray"
}

install_hysteria() {
  if command_exists hysteria; then
    log "Hysteria already installed: $(hysteria version 2>/dev/null | head -n 1 || true)"
    return
  fi
  local arch asset version tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="hysteria-linux-amd64" ;;
    aarch64|arm64) asset="hysteria-linux-arm64" ;;
    *) die "Unsupported Hysteria architecture: $(uname -m)" ;;
  esac
  version="${KATO_HYSTERIA_VERSION:-$(github_latest_tag apernet/hysteria)}"
  [[ -n "$version" ]] || die "Cannot resolve latest Hysteria version"
  tmp="$(mktemp -d)"
  log "Installing Hysteria ${version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/apernet/hysteria/releases/download/${version}/${asset}"
  install -m 0755 "${tmp}/${asset}" /usr/local/bin/hysteria
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/hysteria || warn "setcap failed for hysteria"
}

install_realm() {
  if command_exists realm; then
    log "Realm already installed: $(realm --version 2>&1 | head -n 1 || true)"
    return
  fi
  local asset tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="realm-x86_64-unknown-linux-musl.tar.gz" ;;
    aarch64|arm64) asset="realm-aarch64-unknown-linux-musl.tar.gz" ;;
    *) die "Unsupported Realm architecture: $(uname -m)" ;;
  esac
  tmp="$(mktemp -d)"
  log "Installing Realm ${realm_version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/zhboner/realm/releases/download/${realm_version}/${asset}"
  tar -xzf "${tmp}/${asset}" -C "$tmp"
  install -m 0755 "${tmp}/realm" /usr/local/bin/realm
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/realm || warn "setcap failed for realm"
}

install_runtime_binaries() {
  [[ "$skip_runtime_binaries" != "true" ]] || return 0
  case "$role" in
    proxy-node)
      install_xray
      install_hysteria
      ;;
    transit-relay)
      install_realm
      ;;
  esac
}

write_agent_config() {
  [[ -n "$backend_url" ]] || die "--backend-url is required for ${role}"
  if [[ -z "$agent_name" ]]; then
    agent_name="${role}-$(hostname -s 2>/dev/null || hostname)"
  fi
  if [[ -z "$bootstrap_token" ]]; then
    warn "--bootstrap-token not provided. Existing registered agents can still run if /var/lib/kato/agent-state.json exists."
  fi

  local config_path="/etc/kato/agent.json"
  local env_path="/etc/kato/agent.env"
  AGENT_BACKEND_URL="$backend_url" \
  AGENT_ROLE="$role" \
  AGENT_NAME="$agent_name" \
  AGENT_BOOTSTRAP_TOKEN="$bootstrap_token" \
  AGENT_AUTO_START="$agent_auto_start" \
  AGENT_BINARY_VALIDATION="$binary_validation" \
  "$install_root/node/bin/node" <<'NODE' >"$config_path"
const bool = (value) => String(value).toLowerCase() === "true";
const config = {
  backendUrl: process.env.AGENT_BACKEND_URL,
  role: process.env.AGENT_ROLE,
  name: process.env.AGENT_NAME,
  bootstrapToken: process.env.AGENT_BOOTSTRAP_TOKEN,
  statePath: "/var/lib/kato/agent-state.json",
  lastKnownGoodPath: "/var/lib/kato/agent-last-known-good.json",
  renderedConfigPath: "/var/lib/kato/agent-rendered-config.json",
  runtimeDir: "/var/lib/kato/runtime",
  backupDir: "/var/lib/kato/backups",
  processDir: "/var/lib/kato/processes",
  logDir: "/var/log/kato/runtime",
  binaryValidation: bool(process.env.AGENT_BINARY_VALIDATION),
  autoStart: bool(process.env.AGENT_AUTO_START),
  binaries: {
    xray: "/usr/local/bin/xray",
    hysteria: "/usr/local/bin/hysteria",
    realm: "/usr/local/bin/realm"
  }
};
process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
NODE

  cat >"$env_path" <<EOF
NODE_ENV=production
AGENT_CONFIG=${config_path}
EOF
  chown root:kato "$config_path" "$env_path"
  chmod 0640 "$config_path" "$env_path"
}

install_agent_role() {
  log "Installing agent role: ${role}"
  install_runtime_binaries
  write_agent_config

  write_systemd_service "kato-agent" "[Unit]
Description=Kato agent sync (${role})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=kato
Group=kato
WorkingDirectory=${source_dir}
EnvironmentFile=/etc/kato/agent.env
ExecStart=${install_root}/node/bin/node apps/agent/src/main.js once
KillMode=process
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/var/lib/kato /var/log/kato
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target"

  cat >/etc/systemd/system/kato-agent.timer <<'EOF'
[Unit]
Description=Run Kato agent sync every minute

[Timer]
OnBootSec=20s
OnUnitActiveSec=60s
AccuracySec=5s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now kato-agent.timer
  if [[ -n "$bootstrap_token" || -f /var/lib/kato/agent-state.json ]]; then
    systemctl start kato-agent.service || {
      journalctl -u kato-agent.service -n 80 --no-pager >&2 || true
      die "agent first sync failed"
    }
  else
    warn "Skipping first sync because no bootstrap token/state exists"
  fi
  log "agent installed: ${role}"
}

install_edge_placeholder() {
  local edge_name="$1"
  install_nginx
  install -d -m 0755 -o root -g root "/var/www/kato-${edge_name}"
  cat >"/var/www/kato-${edge_name}/index.html" <<EOF
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${APP_NAME}</title></head>
<body><main style="font-family:system-ui,sans-serif;max-width:720px;margin:12vh auto;padding:24px;line-height:1.6"><h1>${APP_NAME}</h1><p>${edge_name} is running.</p></main></body>
</html>
EOF
  if [[ "$admin_ui_port" == "80" && -e /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  cat >"/etc/nginx/sites-available/kato-${edge_name}.conf" <<EOF
server {
    listen ${admin_ui_port} default_server;
    listen [::]:${admin_ui_port} default_server;
    server_name _;
    root /var/www/kato-${edge_name};
    index index.html;

    location = /health {
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  ln -sfn "/etc/nginx/sites-available/kato-${edge_name}.conf" "/etc/nginx/sites-enabled/kato-${edge_name}.conf"
  nginx -t
  systemctl reload nginx.service
  curl -fsS "http://127.0.0.1:${admin_ui_port}/health" >/dev/null
}

main() {
  require_root
  require_linux
  load_os_release
  configure_apt_mirror
  ensure_base_dependencies
  install_node
  resolve_source_dir
  sync_source_tree
  ensure_kato_user_and_dirs

  case "$role" in
    backend-core)
      install_backend_core
      ;;
    admin-ui)
      install_admin_ui
      ;;
    frontend-edge)
      install_edge_placeholder "frontend-edge"
      install_agent_role
      ;;
    subscription-edge)
      install_edge_placeholder "subscription-edge"
      install_agent_role
      ;;
    proxy-node|transit-relay)
      install_agent_role
      ;;
    *)
      die "Unsupported role: ${role}"
      ;;
  esac

  log "Install finished for role: ${role}"
}

main "$@"
