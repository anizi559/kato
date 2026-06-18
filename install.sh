#!/usr/bin/env bash
set -euo pipefail

# Kato 一键安装脚本
# 适用系统：Debian / Ubuntu，且需要 systemd。
# 常用方式：
#   sudo ./install.sh
#   sudo ./install.sh --role backend-core --repo-url https://github.com/anizi559/kato.git
#   sudo ./install.sh --role admin-ui --repo-url https://github.com/anizi559/kato.git --backend-url http://后端IP:8080
#
# 提醒：命令参数保持英文是为了兼容脚本和自动化；所有说明、提示和生成配置都尽量使用中文。

APP_NAME="kato"
APP_VERSION="0.4.2"
DEFAULT_INSTALL_ROOT="/opt/kato"
DEFAULT_REPO_URL="https://github.com/anizi559/kato.git"
DEFAULT_NODE_VERSION="22.16.0"
DEFAULT_REALM_VERSION="v2.9.4"

role=""
action="${KATO_ACTION:-install}"
source_dir="${KATO_SOURCE_DIR:-}"
repo_url="${KATO_REPO_URL:-}"
install_root="${KATO_INSTALL_ROOT:-$DEFAULT_INSTALL_ROOT}"
node_version="${KATO_NODE_VERSION:-$DEFAULT_NODE_VERSION}"
realm_version="${KATO_REALM_VERSION:-$DEFAULT_REALM_VERSION}"
apt_mirror="${KATO_APT_MIRROR:-}"
skip_deps="false"
skip_source_sync="false"
skip_runtime_binaries="false"
force_runtime_binaries="false"
non_interactive="false"

listen_host="${KATO_LISTEN_HOST:-0.0.0.0}"
listen_port="${KATO_LISTEN_PORT:-8080}"
admin_ui_port="${KATO_ADMIN_UI_PORT:-80}"
listen_host_explicit="${KATO_LISTEN_HOST:+true}"
listen_port_explicit="${KATO_LISTEN_PORT:+true}"
admin_ui_port_explicit="${KATO_ADMIN_UI_PORT:+true}"
listen_host_explicit="${listen_host_explicit:-false}"
listen_port_explicit="${listen_port_explicit:-false}"
admin_ui_port_explicit="${admin_ui_port_explicit:-false}"
backend_url="${KATO_BACKEND_URL:-}"
admin_token="${BACKEND_ADMIN_TOKEN:-${KATO_ADMIN_TOKEN:-}}"
admin_cors_origins="${BACKEND_ADMIN_CORS_ORIGINS:-}"
admin_username="${KATO_ADMIN_USERNAME:-admin}"
admin_password="${KATO_ADMIN_PASSWORD:-}"
frontend_pairing_token="${KATO_FRONTEND_PAIRING_TOKEN:-}"
panel_admin_path="${KATO_PANEL_ADMIN_PATH:-}"
agent_name="${KATO_AGENT_NAME:-}"
bootstrap_token="${KATO_BOOTSTRAP_TOKEN:-}"
agent_auto_start="${KATO_AGENT_AUTO_START:-false}"
binary_validation="${KATO_BINARY_VALIDATION:-false}"
tls_mode="${KATO_TLS_MODE:-none}"
public_domain="${KATO_DOMAIN:-}"
acme_email="${KATO_ACME_EMAIL:-}"
cloudflare_api_token="${KATO_CLOUDFLARE_API_TOKEN:-}"
https_port="${KATO_HTTPS_PORT:-443}"
tls_explicit="${KATO_TLS_MODE:+true}"
domain_explicit="${KATO_DOMAIN:+true}"
https_port_explicit="${KATO_HTTPS_PORT:+true}"
tls_explicit="${tls_explicit:-false}"
domain_explicit="${domain_explicit:-false}"
https_port_explicit="${https_port_explicit:-false}"

usage() {
  cat <<USAGE
Kato 控制面板一键安装脚本 ${APP_VERSION}

用法：
  sudo ./install.sh --role <role> [options]
  sudo ./install.sh --upgrade --role <role> [options]

安装 / 升级：
  --action <install|upgrade>     install 表示安装或重装；upgrade 表示升级已有角色
  --upgrade                      等同于 --action upgrade，默认从 GitHub 升级到最新版本

安装角色：
  backend-core       面板后端 API、本地数据库、管理员账号初始化
  admin-ui           面板前端服务器：根路径工具站，隐藏路径进入管理后台
  subscription-edge  订阅入口服务器占位角色
  proxy-node         代理节点 Agent，并安装 Xray / Hysteria2
  transit-relay      中转服务器 Agent，并安装 Realm

通用参数：
  --role <role>                  要安装的角色。也可写 backend / frontend / proxy / relay
  --source-dir <path>            使用本机已有源码目录安装
  --repo-url <url>               当前目录没有源码时，从这个 Git 仓库拉取源码
  --install-root <path>          安装目录，默认：${DEFAULT_INSTALL_ROOT}
  --apt-mirror <none|tuna|ustc|aliyun>
                                  切换 apt 软件源；国内服务器建议 tuna 或 aliyun
  --skip-deps                    跳过系统依赖和 Node.js 安装
  --skip-source-sync             直接使用当前源码目录，不复制到安装目录
  --force-runtime-binaries       重新下载 Xray / Hysteria2 / Realm；升级模式默认开启
  --non-interactive              非交互模式；缺少必要参数时直接失败，不弹菜单

HTTPS / 证书参数（前端和后端均可使用）：
  --tls-mode <none|letsencrypt>  none 表示不配置 HTTPS；letsencrypt 使用 Cloudflare DNS 验证
  --domain <domain>              对外访问域名，例如 panel.example.com 或 api.example.com
  --acme-email <email>           Let's Encrypt 到期通知邮箱
  --cloudflare-api-token <token> Cloudflare DNS API Token，只保存到 root 可读配置文件
  --https-port <port>            HTTPS 监听端口，默认：443

后端参数：
  --listen-host <host>           后端监听地址，默认：0.0.0.0
  --listen-port <port>           后端监听端口，默认：8080
  --admin-token <token>          后端管理员密钥；不填会自动生成
  --admin-username <name>        初始化管理员账号，默认：admin
  --admin-password <password>    初始化管理员密码；不填会交互输入
  --admin-cors-origins <origins> 允许访问后端的前端地址，多个地址用英文逗号分隔

前端参数：
  --backend-url <url>            前端服务器反向代理连接的后端 API 地址
  --frontend-token <token>       后端安装完成输出的前端配对 token
  --admin-path <path>            管理后台隐藏入口路径；不填自动生成
  --admin-ui-port <port>         nginx 对外监听端口，默认：80

Agent / 节点参数：
  --backend-url <url>            后端 API 地址；安装节点角色时必须填写
  --bootstrap-token <token>      节点首次注册用的一次性 token
  --agent-name <name>            节点显示名称，便于在面板里识别
  --agent-auto-start <true|false>
                                  同步配置后是否自动启动代理运行进程
  --binary-validation <true|false>
                                  是否在应用配置前调用二进制做配置校验
  --skip-runtime-binaries        不安装 Xray / Hysteria2 / Realm 等运行程序

常用示例：
  sudo ./install.sh
  sudo ./install.sh --role backend-core --listen-port 8080
  sudo ./install.sh --role admin-ui --backend-url http://156.226.168.215:8080 --frontend-token front_xxx
  sudo ./install.sh --role proxy-node --backend-url http://panel:8080 --bootstrap-token boot_xxx
  sudo ./install.sh --upgrade --role admin-ui
USAGE
}

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

warn() {
  printf '[%s] 警告：%s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

can_prompt() {
  [[ "$non_interactive" != "true" && -t 0 ]]
}

prompt_line() {
  local var_name="$1"
  local question="$2"
  local default_value="${3:-}"
  local value

  if [[ -n "$default_value" ]]; then
    read -r -p "${question} [${default_value}]: " value
    value="${value:-$default_value}"
  else
    read -r -p "${question}: " value
  fi

  printf -v "$var_name" '%s' "$value"
}

prompt_required() {
  local var_name="$1"
  local question="$2"
  local default_value="${3:-}"
  local value=""

  while [[ -z "$value" ]]; do
    if [[ -n "$default_value" ]]; then
      read -r -p "${question} [${default_value}]: " value
      value="${value:-$default_value}"
    else
      read -r -p "${question}: " value
    fi
    [[ -n "$value" ]] || warn "这个值不能为空，请重新输入"
  done

  printf -v "$var_name" '%s' "$value"
}

prompt_secret_confirm() {
  local var_name="$1"
  local question="$2"
  local value confirm

  while true; do
    read -r -s -p "${question}: " value
    echo
    if [[ -z "$value" ]]; then
      warn "这个值不能为空，请重新输入"
      continue
    fi
    read -r -s -p "请再输入一次确认: " confirm
    echo
    if [[ "$value" == "$confirm" ]]; then
      printf -v "$var_name" '%s' "$value"
      return
    fi
    warn "两次输入不一致，请重新输入"
  done
}

prompt_secret() {
  local var_name="$1"
  local question="$2"
  local value
  read -r -s -p "${question}: " value
  echo
  printf -v "$var_name" '%s' "$value"
}

prompt_yes_no() {
  local var_name="$1"
  local question="$2"
  local default_value="${3:-false}"
  local default_label choice

  if [[ "$default_value" == "true" ]]; then
    default_label="Y/n"
  else
    default_label="y/N"
  fi

  while true; do
    read -r -p "${question} [${default_label}]: " choice
    choice="${choice:-$default_value}"
    case "${choice,,}" in
      y|yes|true|1)
        printf -v "$var_name" '%s' "true"
        return
        ;;
      n|no|false|0)
        printf -v "$var_name" '%s' "false"
        return
        ;;
      *)
        warn "请输入 y 或 n"
        ;;
    esac
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --action)
      action="${2:-}"
      shift 2
      ;;
    --upgrade)
      action="upgrade"
      shift
      ;;
    --install)
      action="install"
      shift
      ;;
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
      listen_host_explicit="true"
      shift 2
      ;;
    --listen-port)
      listen_port="${2:-}"
      listen_port_explicit="true"
      shift 2
      ;;
    --admin-token)
      admin_token="${2:-}"
      shift 2
      ;;
    --admin-username)
      admin_username="${2:-}"
      shift 2
      ;;
    --admin-password)
      admin_password="${2:-}"
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
      admin_ui_port_explicit="true"
      shift 2
      ;;
    --frontend-token|--frontend-pairing-token|--pairing-token)
      frontend_pairing_token="${2:-}"
      shift 2
      ;;
    --admin-path|--panel-admin-path)
      panel_admin_path="${2:-}"
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
    --tls-mode)
      tls_mode="${2:-}"
      tls_explicit="true"
      shift 2
      ;;
    --domain)
      public_domain="${2:-}"
      domain_explicit="true"
      shift 2
      ;;
    --acme-email)
      acme_email="${2:-}"
      shift 2
      ;;
    --cloudflare-api-token)
      cloudflare_api_token="${2:-}"
      shift 2
      ;;
    --https-port)
      https_port="${2:-}"
      https_port_explicit="true"
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
    --force-runtime-binaries)
      force_runtime_binaries="true"
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
      die "未知参数：$1"
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

normalize_action() {
  case "$1" in
    install|安装|reinstall)
      printf 'install'
      ;;
    upgrade|升级|update)
      printf 'upgrade'
      ;;
    *)
      return 1
      ;;
  esac
}

prompt_action() {
  can_prompt || return 0
  cat <<'MENU'
请选择要执行的操作：
  1) 安装 / 重装服务器角色
  2) 升级已有服务器角色（默认拉取 GitHub 最新版本）
MENU
  local choice
  read -r -p "请输入序号 [1]: " choice
  choice="${choice:-1}"
  case "$choice" in
    1) action="install" ;;
    2) action="upgrade" ;;
    *) die "不支持的操作序号：$choice" ;;
  esac
}

prompt_role() {
  if [[ "$non_interactive" == "true" || ! -t 0 ]]; then
    usage >&2
    die "缺少 --role 参数，请指定要安装或升级的角色"
  fi

  cat <<'MENU'
请选择服务器角色：
  1) backend-core       面板后端 API、数据库、管理员账号
  2) admin-ui           面板前端服务器（根路径工具站，隐藏路径进后台）
  3) subscription-edge  订阅入口服务器
  4) proxy-node         代理节点服务器
  5) transit-relay      中转服务器
MENU
  read -r -p "请输入序号： " choice
  case "$choice" in
    1) role="backend-core" ;;
    2) role="admin-ui" ;;
    3) role="subscription-edge" ;;
    4) role="proxy-node" ;;
    5) role="transit-relay" ;;
    *) die "不支持的角色序号：$choice" ;;
  esac
}

detect_installed_role() {
  local detected=""
  if [[ -f /etc/kato/agent.json ]]; then
    detected="$(sed -n 's/.*"role"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /etc/kato/agent.json | head -n 1)"
  fi
  if [[ -z "$detected" && -f /etc/kato/backend-core.env ]]; then
    detected="backend-core"
  fi
  if [[ -z "$detected" && -f /etc/nginx/sites-available/kato-panel-frontend.conf ]]; then
    detected="admin-ui"
  fi
  if [[ -n "$detected" ]]; then
    role="$detected"
    return 0
  fi
  return 1
}

if ! action="$(normalize_action "$action")"; then
  usage >&2
  die "不支持的操作类型：$action"
fi

if [[ -z "${KATO_ACTION:-}" && "$action" == "install" && -z "$role" ]]; then
  prompt_action
fi

if [[ -z "$role" ]]; then
  if [[ "$action" == "upgrade" ]] && detect_installed_role; then
    log "检测到当前服务器已安装角色：${role}"
  else
    prompt_role
  fi
fi

if ! role="$(normalize_role "$role")"; then
  usage >&2
  die "不支持的安装角色：$role"
fi

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "请用 root 权限运行，例如：sudo ./install.sh --role ${role}"
  fi
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || die "当前安装脚本只支持 Linux 服务器"
  [[ -d /run/systemd/system ]] || die "当前系统缺少 systemd，暂时无法安装"
}

load_os_release() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-}"
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
    log "正在更新 apt 软件包索引"
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
  log "正在安装系统依赖：${missing[*]}"
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
      die "不支持的 apt 镜像源：$apt_mirror，可选 none / tuna / ustc / aliyun"
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
    [[ -n "$OS_CODENAME" ]] || die "无法识别 Debian 版本代号，不能自动切换 apt 镜像源"
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
    [[ -n "$OS_CODENAME" ]] || die "无法识别 Ubuntu 版本代号，不能自动切换 apt 镜像源"
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
    die "自动切换 apt 镜像源只支持 Debian / Ubuntu，当前识别到：${OS_ID}"
  fi
  apt_updated="false"
  log "apt 镜像源已切换为：${apt_mirror}"
}

ensure_base_dependencies() {
  [[ "$skip_deps" != "true" ]] || return 0
  case "$OS_ID" in
    debian|ubuntu)
      install_packages ca-certificates curl git rsync tar xz-utils openssl lsof procps jq unzip libcap2-bin
      ;;
    *)
      die "不支持的 Linux 发行版：${OS_ID}。当前只支持 Debian / Ubuntu"
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
      die "不支持的 Node.js 架构：$(uname -m)"
      ;;
  esac
}

install_node() {
  local managed_node
  managed_node="$(node_bin)"
  if node_major_ok "$managed_node"; then
    log "使用 Kato 已安装的 Node.js：$("$managed_node" -v)"
    return
  fi

  if command_exists node && command_exists npm && node_major_ok "$(command -v node)"; then
    log "使用系统已有 Node.js：$(node -v)"
    mkdir -p "$install_root/node/bin"
    ln -sfn "$(command -v node)" "$install_root/node/bin/node"
    ln -sfn "$(command -v npm)" "$install_root/node/bin/npm"
    if command_exists npx; then
      ln -sfn "$(command -v npx)" "$install_root/node/bin/npx"
    fi
    return
  fi

  [[ "$skip_deps" != "true" ]] || die "需要 Node.js 22 或更高版本，但你使用了 --skip-deps，脚本无法自动安装"

  local arch asset url tmp
  arch="$(node_arch)"
  asset="node-v${node_version}-linux-${arch}"
  url="https://nodejs.org/dist/v${node_version}/${asset}.tar.xz"
  tmp="$(mktemp -d)"
  log "正在安装 Node.js v${node_version}（${arch}）"
  curl -fsSL --retry 3 --connect-timeout 20 -o "${tmp}/${asset}.tar.xz" "$url"
  mkdir -p "$install_root"
  rm -rf "${install_root:?}/${asset}"
  tar -xJf "${tmp}/${asset}.tar.xz" -C "$install_root"
  ln -sfn "${install_root}/${asset}" "${install_root}/node"
  ln -sfn "${install_root}/node/bin/node" /usr/local/bin/node
  ln -sfn "${install_root}/node/bin/npm" /usr/local/bin/npm
  ln -sfn "${install_root}/node/bin/npx" /usr/local/bin/npx
  rm -rf "$tmp"
  log "Node.js 安装完成：$("${install_root}/node/bin/node" -v)"
}

looks_like_source_tree() {
  local dir="$1"
  [[ -f "${dir}/package.json" && -d "${dir}/apps/backend-core" && -d "${dir}/packages/shared" ]]
}

source_tree_already_available() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  looks_like_source_tree "$PWD" || looks_like_source_tree "$script_dir" || looks_like_source_tree "$(target_source_dir)"
}

prompt_source_location() {
  [[ -z "$source_dir" && -z "$repo_url" ]] || return 0
  if [[ "$action" == "upgrade" ]]; then
    repo_url="$DEFAULT_REPO_URL"
    return 0
  fi
  source_tree_already_available && return 0
  can_prompt || return 0

  cat <<MENU

没有在当前目录找到 Kato 源码。
请选择源码来源：
  1) 从默认 GitHub 仓库克隆（推荐）：${DEFAULT_REPO_URL}
  2) 输入自定义 Git 仓库地址
  3) 输入本机已有源码目录
  4) 退出安装
MENU
  local choice
  read -r -p "请选择 [1]: " choice
  choice="${choice:-1}"
  case "$choice" in
    1)
      repo_url="$DEFAULT_REPO_URL"
      ;;
    2)
      prompt_required repo_url "请输入 Git 仓库地址"
      ;;
    3)
      prompt_required source_dir "请输入本机源码目录路径"
      ;;
    4)
      die "已取消安装"
      ;;
    *)
      die "不支持的源码来源选项：$choice"
      ;;
  esac
}

prepare_upgrade_defaults() {
  [[ "$action" == "upgrade" ]] || return 0
  [[ -n "$source_dir" || -n "$repo_url" ]] || repo_url="$DEFAULT_REPO_URL"
  force_runtime_binaries="true"
}

checkout_source_from_repo() {
  local target
  target="$(target_source_dir)"
  [[ -n "$repo_url" ]] || die "缺少 Git 仓库地址"
  if [[ -d "$target/.git" ]]; then
    log "正在从仓库升级源码：${repo_url}"
    git -C "$target" remote set-url origin "$repo_url" >/dev/null 2>&1 || true
    git -C "$target" fetch --depth 1 origin main
    git -C "$target" checkout -B main FETCH_HEAD
  else
    log "正在从仓库克隆最新源码：${repo_url}"
    rm -rf "$target"
    git clone --depth 1 "$repo_url" "$target"
  fi
  chmod +x "${target}/install.sh" 2>/dev/null || true
  source_dir="$target"
}

prompt_apt_mirror() {
  [[ -z "$apt_mirror" ]] || return 0
  can_prompt || return 0

  cat <<'MENU'

请选择 apt 软件源：
  1) 不切换，使用系统默认源
  2) 清华 tuna 镜像源（国内服务器推荐）
  3) 中科大 ustc 镜像源
  4) 阿里云 aliyun 镜像源
MENU
  local choice
  read -r -p "请选择 [2]: " choice
  choice="${choice:-2}"
  case "$choice" in
    1) apt_mirror="none" ;;
    2) apt_mirror="tuna" ;;
    3) apt_mirror="ustc" ;;
    4) apt_mirror="aliyun" ;;
    *) die "不支持的 apt 软件源选项：$choice" ;;
  esac
}

normalize_tls_mode() {
  case "${1,,}" in
    none|off|false|0)
      printf 'none'
      ;;
    letsencrypt|letsencrypt-cloudflare|cloudflare|on|true|1)
      printf 'letsencrypt'
      ;;
    *)
      return 1
      ;;
  esac
}

validate_domain() {
  local value="$1"
  [[ "$value" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]
}

prompt_tls_options() {
  local default_enabled="false"
  local enable_tls
  [[ "$tls_mode" == "letsencrypt" ]] && default_enabled="true"
  [[ "$role" == "admin-ui" && "$tls_explicit" != "true" ]] && default_enabled="true"

  prompt_yes_no enable_tls "是否通过 Cloudflare DNS API 自动申请并配置 HTTPS 证书" "$default_enabled"
  if [[ "$enable_tls" != "true" ]]; then
    tls_mode="none"
    if [[ "$role" == "backend-core" && "$listen_host" == "127.0.0.1" && "$listen_host_explicit" != "true" ]]; then
      prompt_line listen_host "关闭后端 HTTPS 后的监听地址" "0.0.0.0"
    fi
    return
  fi

  tls_mode="letsencrypt"
  while true; do
    prompt_required public_domain "请输入该服务器的访问域名" "$public_domain"
    if validate_domain "$public_domain"; then
      public_domain="${public_domain,,}"
      break
    fi
    warn "域名格式不正确，例如 panel.example.com"
    public_domain=""
  done
  prompt_required acme_email "请输入 Let's Encrypt 通知邮箱" "$acme_email"

  if [[ -z "$cloudflare_api_token" && ! -s /etc/kato/cloudflare.ini ]]; then
    prompt_secret cloudflare_api_token "请输入 Cloudflare DNS API Token（输入内容不会显示）"
    [[ -n "$cloudflare_api_token" ]] || die "启用 HTTPS 必须提供 Cloudflare API Token"
  elif [[ -s /etc/kato/cloudflare.ini && -z "$cloudflare_api_token" ]]; then
    log "将复用 /etc/kato/cloudflare.ini 中保存的 Cloudflare API Token。"
  fi

  if [[ "$role" == "backend-core" ]]; then
    listen_host="127.0.0.1"
    log "后端启用公网 HTTPS 后，Backend Core 将只监听 127.0.0.1，由 Nginx 对外提供 443。"
  fi
}

prompt_backend_options() {
  echo
  log "请填写面板后端参数。直接回车表示使用括号里的默认值。"
  prompt_line listen_host "后端监听地址；0.0.0.0 表示允许其他服务器访问" "$listen_host"
  prompt_line listen_port "后端监听端口" "$listen_port"
  prompt_required admin_username "初始化管理员账号" "$admin_username"
  if [[ -z "$admin_password" ]]; then
    prompt_secret_confirm admin_password "初始化管理员密码"
  else
    log "初始化管理员密码已通过参数或环境变量提供。"
  fi

  if [[ -z "$admin_token" ]]; then
    read -r -p "后端维护 API 密钥（直接回车自动生成；普通网页登录不用它）: " admin_token
  else
    log "后端维护 API 密钥已通过参数或环境变量提供，安装时会直接使用。"
  fi

  if [[ -z "$admin_cors_origins" ]]; then
    local set_cors="false"
    prompt_yes_no set_cors "是否手动填写允许访问后端的前端地址（CORS）" "false"
    if [[ "$set_cors" == "true" ]]; then
      prompt_required admin_cors_origins "请输入前端地址，多个地址用英文逗号分隔"
    fi
  fi
  prompt_tls_options
}

prompt_admin_ui_options() {
  echo
  log "请填写面板前端参数。"
  prompt_required backend_url "后端 API 地址，例如 http://后端IP:8080；也可以只填 后端IP:8080" "${backend_url:-http://127.0.0.1:${listen_port}}"
  if [[ -z "$frontend_pairing_token" ]]; then
    prompt_required frontend_pairing_token "后端安装完成输出的前端配对 token"
  else
    log "前端配对 token 已通过参数或环境变量提供。"
  fi
  if [[ -z "$panel_admin_path" ]]; then
    panel_admin_path="/admin-$(date '+%m%d%H%M%S')"
  fi
  prompt_line panel_admin_path "管理后台隐藏入口路径" "$panel_admin_path"
  prompt_line admin_ui_port "前端网页监听端口" "$admin_ui_port"
  prompt_tls_options
}

prompt_agent_options() {
  echo
  log "请填写节点 Agent 参数。"
  if [[ -z "$backend_url" ]]; then
    prompt_required backend_url "面板后端 API 地址，例如 http://1.2.3.4:8080；也可以只填 1.2.3.4:8080"
  else
    prompt_line backend_url "面板后端 API 地址" "$backend_url"
  fi

  if [[ -z "$bootstrap_token" ]]; then
    read -r -p "bootstrap token（首次注册必须；已注册节点可回车跳过）: " bootstrap_token
  else
    log "bootstrap token 已通过参数或环境变量提供。"
  fi

  prompt_line agent_name "节点显示名称" "${agent_name:-${role}-$(hostname -s 2>/dev/null || hostname)}"
  prompt_yes_no agent_auto_start "同步配置后是否自动启动代理运行进程" "$agent_auto_start"
  prompt_yes_no binary_validation "应用配置前是否执行二进制配置校验" "$binary_validation"
}

prompt_edge_options() {
  prompt_line admin_ui_port "入口网页监听端口" "$admin_ui_port"
}

collect_interactive_options() {
  can_prompt || return 0

  echo
  log "进入交互式${action}配置。命令行已传入的值会作为默认值。"
  prompt_source_location
  prompt_apt_mirror

  if [[ "$action" == "upgrade" ]]; then
    log "升级模式会优先读取当前服务器已有配置，默认升级到 GitHub 最新版本。"
    return 0
  fi

  case "$role" in
    backend-core)
      prompt_backend_options
      ;;
    admin-ui)
      prompt_admin_ui_options
      ;;
    frontend-edge|subscription-edge)
      prompt_edge_options
      prompt_agent_options
      ;;
    proxy-node|transit-relay)
      prompt_agent_options
      ;;
  esac
}

resolve_source_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -n "$source_dir" ]]; then
    source_dir="$(cd "$source_dir" && pwd)"
    looks_like_source_tree "$source_dir" || die "--source-dir 指向的目录不是有效的 Kato 源码目录：$source_dir"
    return
  fi

  if [[ "$action" == "upgrade" && -n "$repo_url" ]]; then
    checkout_source_from_repo
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

  prompt_source_location

  if [[ -n "$repo_url" ]]; then
    source_dir="$(target_source_dir)"
    if [[ -d "$source_dir/.git" ]]; then
      log "正在从仓库更新源码：${repo_url}"
      git -C "$source_dir" fetch --all --prune
      git -C "$source_dir" pull --ff-only
    else
      log "正在从仓库克隆源码：${repo_url}"
      rm -rf "$source_dir"
      git clone "$repo_url" "$source_dir"
    fi
    return
  fi

  die "找不到 Kato 源码。请在项目根目录运行，或传入 --source-dir，或传入 --repo-url。交互安装时建议选择默认仓库：${DEFAULT_REPO_URL}"
}

sync_source_tree() {
  local target
  target="$(target_source_dir)"
  mkdir -p "$install_root"

  if [[ "$skip_source_sync" == "true" || "$(cd "$source_dir" && pwd)" == "$(mkdir -p "$target" && cd "$target" && pwd)" ]]; then
    log "使用源码目录：$source_dir"
    return
  fi

  log "正在同步源码到安装目录：${target}"
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
    log "正在创建系统用户：kato"
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
  _说明: {
    用途: "Kato 面板后端配置文件，由安装脚本生成。",
    host: "后端监听地址。0.0.0.0 表示允许外部服务器访问。",
    port: "后端监听端口，前端和节点都要连接这个端口。",
    storePath: "后端本地数据库文件路径，请勿手动删除。",
    adminToken: "管理员 API 密钥，请妥善保存，不要发给普通用户。",
    adminCorsOrigins: "允许访问后端 API 的前端地址列表。前后端分离部署时需要包含前端地址。"
  },
  host: process.env.BACKEND_LISTEN_HOST,
  port: Number(process.env.BACKEND_LISTEN_PORT),
  storePath: process.env.BACKEND_STORE_PATH,
  adminToken: process.env.BACKEND_ADMIN_TOKEN_VALUE,
  adminCorsOrigins: process.env.BACKEND_CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
};
process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
NODE

  cat >"$env_path" <<EOF
# Kato 面板后端环境变量文件，由安装脚本生成。
# 修改后需要执行：systemctl restart kato-backend-core
NODE_ENV=production
# 后端 JSON 配置文件路径
BACKEND_CONFIG=${config_path}
# 管理员 API 密钥。请妥善保存，不要发给普通用户。
BACKEND_ADMIN_TOKEN=${admin_token}
# 允许访问后端 API 的前端地址，多个地址用英文逗号分隔。
BACKEND_ADMIN_CORS_ORIGINS=${admin_cors_origins}
EOF
  chown root:kato "$config_path" "$env_path"
  chmod 0640 "$config_path" "$env_path"
}

initialize_backend_store() {
  local token_path="/etc/kato/frontend-pairing-token.txt"

  [[ -n "$admin_username" ]] || die "缺少管理员账号"
  [[ -n "$admin_password" ]] || die "缺少管理员密码；交互安装会提示输入，非交互模式请传入 --admin-password"

  (cd "$source_dir" && BACKEND_STORE_PATH="/var/lib/kato/backend-core.json" \
    KATO_INIT_ADMIN_USERNAME="$admin_username" \
    KATO_INIT_ADMIN_PASSWORD="$admin_password" \
    "$install_root/node/bin/node" --input-type=module <<'NODE' >"$token_path"
import { JsonStore } from "./apps/backend-core/src/store.js";

const store = new JsonStore(process.env.BACKEND_STORE_PATH);
await store.load();
await store.ensureAdminUser({
  username: process.env.KATO_INIT_ADMIN_USERNAME,
  password: process.env.KATO_INIT_ADMIN_PASSWORD
});
const result = await store.createFrontendToken({ name: `panel-frontend-${new Date().toISOString()}` });
process.stdout.write(`${result.token}\n`);
NODE
)

  chown kato:kato /var/lib/kato/backend-core.json
  chmod 0640 /var/lib/kato/backend-core.json
  chown root:kato "$token_path"
  chmod 0640 "$token_path"
  frontend_pairing_token="$(cat "$token_path")"
}

write_systemd_service() {
  local name="$1"
  local content="$2"
  printf '%s\n' "$content" >"/etc/systemd/system/${name}.service"
  chmod 0644 "/etc/systemd/system/${name}.service"
}

write_backend_service() {
  write_systemd_service "kato-backend-core" "[Unit]
Description=Kato 面板后端服务
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
}

install_backend_core() {
  log "正在安装面板后端 backend-core"
  validate_tls_options
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    listen_host="127.0.0.1"
  fi
  write_backend_config
  initialize_backend_store
  write_backend_service

  systemctl daemon-reload
  systemctl enable --now kato-backend-core.service
  systemctl restart kato-backend-core.service
  wait_for_backend
  configure_backend_tls_proxy

  log "面板后端安装完成"
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    log "后端 API 地址：https://${public_domain}:${https_port}"
  else
    log "后端 API 地址：http://$(public_ipv4):${listen_port}"
  fi
  log "管理员账号：${admin_username}"
  log "后端维护 API 密钥保存位置：/etc/kato/backend-core.env"
  log "前端配对 token 保存位置：/etc/kato/frontend-pairing-token.txt"
  printf '\n========== 请复制给前端服务器安装使用 ==========\n'
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    printf '后端 API 地址: https://%s:%s\n' "${public_domain}" "${https_port}"
  else
    printf '后端 API 地址: http://%s:%s\n' "$(public_ipv4)" "${listen_port}"
  fi
  printf '前端配对 token: %s\n' "${frontend_pairing_token}"
  printf '==============================================\n\n'
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
  die "面板后端健康检查失败，请查看上方日志"
}

configure_backend_tls_proxy() {
  if [[ "$tls_mode" != "letsencrypt" ]]; then
    write_tls_state
    rm -f /etc/nginx/sites-enabled/kato-backend-core.conf
    if command_exists nginx && systemctl is-active --quiet nginx.service; then
      nginx -t
      systemctl reload nginx.service
    fi
    return 0
  fi

  install_nginx
  ensure_tls_certificate
  local cert_dir
  cert_dir="$(tls_cert_dir)"
  rm -f /etc/nginx/sites-enabled/default
  cat >/etc/nginx/sites-available/kato-backend-core.conf <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${public_domain};

    location = /health {
        proxy_pass http://127.0.0.1:${listen_port}/health;
    }

    location / {
        return 301 https://${public_domain}:${https_port}\$request_uri;
    }
}

server {
    listen ${https_port} ssl http2 default_server;
    listen [::]:${https_port} ssl http2 default_server;
    server_name ${public_domain};

    ssl_certificate ${cert_dir}/fullchain.pem;
    ssl_certificate_key ${cert_dir}/privkey.pem;
    ssl_session_cache shared:KATO_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;

    client_max_body_size 2m;
    proxy_connect_timeout 10s;
    proxy_read_timeout 90s;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://127.0.0.1:${listen_port};
    }
}
EOF
  ln -sfn /etc/nginx/sites-available/kato-backend-core.conf /etc/nginx/sites-enabled/kato-backend-core.conf
  nginx -t
  systemctl reload nginx.service
  curl -fsS --resolve "${public_domain}:${https_port}:127.0.0.1" "https://${public_domain}:${https_port}/health" >/dev/null
}

install_nginx() {
  [[ "$skip_deps" == "true" ]] || install_packages nginx
  systemctl enable --now nginx.service
}

tls_state_path() {
  printf '/etc/kato/tls.env'
}

cloudflare_credentials_path() {
  printf '/etc/kato/cloudflare.ini'
}

tls_cert_name() {
  printf 'kato-%s' "$role"
}

tls_cert_dir() {
  printf '/etc/letsencrypt/live/%s' "$(tls_cert_name)"
}

validate_tls_options() {
  if ! tls_mode="$(normalize_tls_mode "$tls_mode")"; then
    die "不支持的 HTTPS 模式：${tls_mode}，可选 none / letsencrypt"
  fi
  [[ "$tls_mode" == "letsencrypt" ]] || return 0
  [[ -n "$public_domain" ]] || die "启用 HTTPS 必须填写 --domain"
  validate_domain "$public_domain" || die "域名格式不正确：${public_domain}"
  [[ -n "$acme_email" ]] || die "启用 HTTPS 必须填写 --acme-email"
  [[ "$https_port" =~ ^[0-9]+$ && "$https_port" -ge 1 && "$https_port" -le 65535 ]] || die "HTTPS 端口必须是 1-65535 的整数"
  if [[ -z "$cloudflare_api_token" && ! -s "$(cloudflare_credentials_path)" ]]; then
    die "启用 HTTPS 必须填写 --cloudflare-api-token，或保留已有 /etc/kato/cloudflare.ini"
  fi
}

write_tls_state() {
  local state_path
  state_path="$(tls_state_path)"
  cat >"$state_path" <<EOF
# Kato HTTPS 配置，由安装脚本生成。Cloudflare Token 单独保存在 cloudflare.ini。
KATO_TLS_MODE=${tls_mode}
KATO_DOMAIN=${public_domain}
KATO_ACME_EMAIL=${acme_email}
KATO_HTTPS_PORT=${https_port}
KATO_TLS_CERT_NAME=$(tls_cert_name)
EOF
  chown root:kato "$state_path"
  chmod 0640 "$state_path"
}

install_tls_dependencies() {
  [[ "$skip_deps" == "true" ]] || install_packages certbot python3-certbot-dns-cloudflare
}

install_cloudflare_credentials() {
  local credentials_path
  credentials_path="$(cloudflare_credentials_path)"
  install -d -m 0750 -o root -g kato /etc/kato
  if [[ -n "$cloudflare_api_token" ]]; then
    cat >"$credentials_path" <<EOF
# Cloudflare API Token：仅需目标 Zone 的 Zone:Read 与 DNS:Edit 权限。
dns_cloudflare_api_token = ${cloudflare_api_token}
EOF
  fi
  [[ -s "$credentials_path" ]] || die "Cloudflare 凭据文件不存在：${credentials_path}"
  chown root:root "$credentials_path"
  chmod 0600 "$credentials_path"
}

install_certbot_reload_hook() {
  install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
  cat >/etc/letsencrypt/renewal-hooks/deploy/kato-reload-nginx <<'EOF'
#!/usr/bin/env bash
set -e
nginx -t
systemctl reload nginx.service
EOF
  chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/kato-reload-nginx
}

ensure_tls_certificate() {
  [[ "$tls_mode" == "letsencrypt" ]] || return 0
  validate_tls_options
  install_tls_dependencies
  install_cloudflare_credentials

  local cert_name cert_dir renew_option
  cert_name="$(tls_cert_name)"
  cert_dir="$(tls_cert_dir)"
  renew_option="--keep-until-expiring"
  if [[ -s "${cert_dir}/fullchain.pem" ]] && ! openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkhost "$public_domain" >/dev/null 2>&1; then
    renew_option="--force-renewal"
    log "检测到 HTTPS 域名发生变化，将为 ${public_domain} 重新签发证书。"
  fi
  log "正在检查或申请 Let's Encrypt 证书：${public_domain}"
  certbot certonly \
    --non-interactive \
    --agree-tos \
    --email "$acme_email" \
    --dns-cloudflare \
    --dns-cloudflare-credentials "$(cloudflare_credentials_path)" \
    --dns-cloudflare-propagation-seconds 30 \
    --cert-name "$cert_name" \
    "$renew_option" \
    -d "$public_domain"
  install_certbot_reload_hook
  systemctl enable --now certbot.timer >/dev/null 2>&1 || warn "未能启用 certbot.timer，请确认系统是否提供该定时器"
  write_tls_state
}

memory_total_mb() {
  awk '/MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || printf '0'
}

swap_total_mb() {
  awk '/SwapTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || printf '0'
}

normalize_backend_url() {
  local value="$1"
  value="${value%/}"
  [[ -n "$value" ]] || return 1
  case "$value" in
    http://*|https://*)
      printf '%s' "$value"
      ;;
    *)
      printf 'http://%s' "$value"
      ;;
  esac
}

ensure_frontend_build_memory() {
  local mem_mb swap_mb swap_path="/swapfile-kato" swap_size_mb=2048
  mem_mb="$(memory_total_mb)"
  swap_mb="$(swap_total_mb)"

  if [[ "$mem_mb" -ge 1800 || "$swap_mb" -ge 1024 ]]; then
    log "内存检查通过：RAM ${mem_mb}MB，Swap ${swap_mb}MB"
    return
  fi

  log "检测到前端服务器内存较小：RAM ${mem_mb}MB，Swap ${swap_mb}MB"
  log "正在创建 ${swap_size_mb}MB swap，避免前端构建时系统卡死或 SSH 断开"

  if [[ ! -f "$swap_path" ]]; then
    if command_exists fallocate; then
      fallocate -l "${swap_size_mb}M" "$swap_path" || dd if=/dev/zero of="$swap_path" bs=1M count="$swap_size_mb" status=progress
    else
      dd if=/dev/zero of="$swap_path" bs=1M count="$swap_size_mb" status=progress
    fi
    chmod 0600 "$swap_path"
    mkswap "$swap_path" >/dev/null
  fi

  if ! swapon --show=NAME | grep -qx "$swap_path"; then
    swapon "$swap_path"
  fi
  if ! grep -q "^${swap_path} " /etc/fstab; then
    printf '%s none swap sw 0 0\n' "$swap_path" >>/etc/fstab
  fi
  sysctl -w vm.swappiness=10 >/dev/null 2>&1 || true
  log "swap 已启用：$(swap_total_mb)MB"
}

normalize_panel_admin_path() {
  local value="$1"
  value="${value:-/admin-$(openssl rand -hex 4)}"
  value="/${value#/}"
  value="${value%/}"
  [[ "$value" != "/" ]] || die "管理后台入口路径不能是 /"
  [[ "$value" =~ ^/[A-Za-z0-9._-]+$ ]] || die "管理后台入口路径只能包含字母、数字、点、下划线和中横线，例如 /admin-a1b2c3d4"
  printf '%s' "$value"
}

write_tool_site() {
  local root_dir="$1"
  install -d -m 0755 -o root -g root "$root_dir"
  cat >"${root_dir}/index.html" <<'HTML'
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>文本工具</title>
  <style>
    :root { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #172033; background: #f7f9fc; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(860px, 100%); display: grid; gap: 18px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
    h1 { margin: 0 0 8px; font-size: 25px; letter-spacing: 0; }
    p { margin: 0; color: #66728a; }
    section { border: 1px solid #dfe6ef; border-radius: 6px; background: #fff; box-shadow: 0 12px 30px rgba(15,31,56,.08); overflow: hidden; }
    textarea { width: 100%; min-height: 260px; resize: vertical; border: 0; outline: 0; padding: 18px; color: #172033; font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px; border-top: 1px solid #dfe6ef; background: #f9fbfe; }
    button { height: 36px; padding: 0 14px; border: 1px solid #cfd8e6; border-radius: 5px; background: #fff; color: #25324a; font: inherit; cursor: pointer; }
    button.primary { color: #fff; border-color: #0b5feb; background: linear-gradient(180deg,#0d6bff,#0757d8); }
    footer { color: #8a96aa; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>文本大小写与数字转换</h1>
        <p>常用文本处理小工具，支持大小写、空格清理和数字提取。</p>
      </div>
    </header>
    <section>
      <textarea id="text" placeholder="在这里输入或粘贴文本..."></textarea>
      <div class="actions">
        <button class="primary" onclick="convert('upper')">转大写</button>
        <button onclick="convert('lower')">转小写</button>
        <button onclick="convert('trim')">清理多余空格</button>
        <button onclick="convert('number')">只保留数字</button>
        <button onclick="copyText()">复制结果</button>
      </div>
    </section>
    <footer>本工具在浏览器本地处理文本，不会上传内容。</footer>
  </main>
  <script>
    const box = document.getElementById("text");
    function convert(type) {
      if (type === "upper") box.value = box.value.toUpperCase();
      if (type === "lower") box.value = box.value.toLowerCase();
      if (type === "trim") box.value = box.value.replace(/\s+/g, " ").trim();
      if (type === "number") box.value = box.value.replace(/\D+/g, "");
    }
    async function copyText() {
      await navigator.clipboard.writeText(box.value);
    }
  </script>
</body>
</html>
HTML
}

install_admin_ui() {
  log "正在安装面板前端服务器 admin-ui"
  validate_tls_options
  install_nginx

  local app_dir="${source_dir}/apps/admin-ui"
  local site_root="/var/www/kato-panel-frontend"
  local normalized_admin_path admin_base backend_upstream
  [[ -d "$app_dir" ]] || die "找不到面板前端源码目录：$app_dir"
  if [[ -z "$backend_url" ]]; then
    die "缺少后端 API 地址，请传入 --backend-url 或在交互安装中填写"
  fi
  if [[ -z "$frontend_pairing_token" ]]; then
    die "缺少前端配对 token，请传入 --frontend-token；后端安装完成时会输出这个值"
  fi
  normalized_admin_path="$(normalize_panel_admin_path "$panel_admin_path")"
  panel_admin_path="$normalized_admin_path"
  admin_base="${panel_admin_path}/"
  backend_upstream="$(normalize_backend_url "$backend_url")"
  backend_url="$backend_upstream"

  ensure_frontend_build_memory

  log "正在安装前端 npm 依赖"
  (cd "$app_dir" && "$install_root/node/bin/npm" ci)

  log "正在构建面板前端"
  (cd "$app_dir" && VITE_ADMIN_API_BASE_URL="" VITE_ENABLE_DEMO="false" "$install_root/node/bin/npm" run build -- --base "$admin_base")

  rm -rf "$site_root"
  write_tool_site "$site_root"
  install -d -m 0755 -o root -g root "${site_root}${panel_admin_path}"
  rsync -a --delete "${app_dir}/dist/" "${site_root}${panel_admin_path}/"

  if [[ "$admin_ui_port" == "80" && -e /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi

  if [[ "$tls_mode" == "letsencrypt" ]]; then
    ensure_tls_certificate
    local cert_dir
    cert_dir="$(tls_cert_dir)"
    cat >/etc/nginx/sites-available/kato-panel-frontend.conf <<EOF
server {
    listen ${admin_ui_port} default_server;
    listen [::]:${admin_ui_port} default_server;
    server_name ${public_domain};

    location = /health {
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    location / {
        return 301 https://${public_domain}:${https_port}\$request_uri;
    }
}

server {
    listen ${https_port} ssl http2 default_server;
    listen [::]:${https_port} ssl http2 default_server;
    server_name ${public_domain};
    root ${site_root};
    index index.html;

    ssl_certificate ${cert_dir}/fullchain.pem;
    ssl_certificate_key ${cert_dir}/privkey.pem;
    ssl_session_cache shared:KATO_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location = /health {
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    location = ${panel_admin_path} {
        return 302 ${panel_admin_path}/;
    }

    location ^~ ${panel_admin_path}/ {
        try_files \$uri \$uri/ ${panel_admin_path}/index.html;
    }

    location /api/ {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Frontend-Token ${frontend_pairing_token};
        proxy_pass ${backend_upstream};
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  else
    write_tls_state
    cat >/etc/nginx/sites-available/kato-panel-frontend.conf <<EOF
server {
    listen ${admin_ui_port} default_server;
    listen [::]:${admin_ui_port} default_server;
    server_name _;
    root ${site_root};
    index index.html;

    location = /health {
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }

    location = ${panel_admin_path} {
        return 302 ${panel_admin_path}/;
    }

    location ^~ ${panel_admin_path}/ {
        try_files \$uri \$uri/ ${panel_admin_path}/index.html;
    }

    location /api/ {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Frontend-Token ${frontend_pairing_token};
        proxy_pass ${backend_upstream};
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  fi
  rm -f /etc/nginx/sites-enabled/kato-admin-ui.conf
  ln -sfn /etc/nginx/sites-available/kato-panel-frontend.conf /etc/nginx/sites-enabled/kato-panel-frontend.conf
  nginx -t
  systemctl reload nginx.service
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    curl -fsS --resolve "${public_domain}:${https_port}:127.0.0.1" "https://${public_domain}:${https_port}/health" >/dev/null
  else
    curl -fsS "http://127.0.0.1:${admin_ui_port}/health" >/dev/null
  fi
  log "面板前端服务器安装完成"
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    log "工具站入口：https://${public_domain}:${https_port}/"
    log "管理后台入口：https://${public_domain}:${https_port}${panel_admin_path}/"
  else
    log "工具站入口：http://$(public_ipv4):${admin_ui_port}/"
    log "管理后台入口：http://$(public_ipv4):${admin_ui_port}${panel_admin_path}/"
  fi
  log "后端 API 反向代理：/api/ -> ${backend_upstream}"
}

github_latest_tag() {
  local repo="$1"
  curl -fsSL --retry 3 "https://api.github.com/repos/${repo}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' \
    | head -n 1
}

install_xray() {
  if command_exists xray && [[ "$force_runtime_binaries" != "true" ]]; then
    log "Xray 已安装：$(xray version 2>/dev/null | head -n 1 || true)"
    return
  fi
  local arch asset version tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="Xray-linux-64.zip" ;;
    aarch64|arm64) asset="Xray-linux-arm64-v8a.zip" ;;
    *) die "不支持的 Xray 架构：$(uname -m)" ;;
  esac
  version="${KATO_XRAY_VERSION:-$(github_latest_tag XTLS/Xray-core)}"
  [[ -n "$version" ]] || die "无法获取最新 Xray 版本"
  tmp="$(mktemp -d)"
  log "正在安装 Xray ${version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/XTLS/Xray-core/releases/download/${version}/${asset}"
  unzip -q "${tmp}/${asset}" -d "$tmp/xray"
  install -m 0755 "${tmp}/xray/xray" /usr/local/bin/xray
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/xray || warn "给 xray 设置低端口权限失败；如果监听 80/443 失败，请手动检查 setcap"
}

install_hysteria() {
  if command_exists hysteria && [[ "$force_runtime_binaries" != "true" ]]; then
    log "Hysteria 已安装：$(hysteria version 2>/dev/null | head -n 1 || true)"
    return
  fi
  local arch asset version tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="hysteria-linux-amd64" ;;
    aarch64|arm64) asset="hysteria-linux-arm64" ;;
    *) die "不支持的 Hysteria 架构：$(uname -m)" ;;
  esac
  version="${KATO_HYSTERIA_VERSION:-$(github_latest_tag apernet/hysteria)}"
  [[ -n "$version" ]] || die "无法获取最新 Hysteria 版本"
  tmp="$(mktemp -d)"
  log "正在安装 Hysteria ${version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/apernet/hysteria/releases/download/${version}/${asset}"
  install -m 0755 "${tmp}/${asset}" /usr/local/bin/hysteria
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/hysteria || warn "给 hysteria 设置低端口权限失败；如果监听 80/443 失败，请手动检查 setcap"
}

install_realm() {
  if command_exists realm && [[ "$force_runtime_binaries" != "true" ]]; then
    log "Realm 已安装：$(realm --version 2>&1 | head -n 1 || true)"
    return
  fi
  local asset tmp
  case "$(uname -m)" in
    x86_64|amd64) asset="realm-x86_64-unknown-linux-musl.tar.gz" ;;
    aarch64|arm64) asset="realm-aarch64-unknown-linux-musl.tar.gz" ;;
    *) die "不支持的 Realm 架构：$(uname -m)" ;;
  esac
  tmp="$(mktemp -d)"
  log "正在安装 Realm ${realm_version}"
  curl -fsSL --retry 3 -o "${tmp}/${asset}" "https://github.com/zhboner/realm/releases/download/${realm_version}/${asset}"
  tar -xzf "${tmp}/${asset}" -C "$tmp"
  install -m 0755 "${tmp}/realm" /usr/local/bin/realm
  rm -rf "$tmp"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/realm || warn "给 realm 设置低端口权限失败；如果监听 80/443 失败，请手动检查 setcap"
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
  [[ -n "$backend_url" ]] || die "安装 ${role} 必须填写 --backend-url，例如：http://后端IP:8080"
  backend_url="$(normalize_backend_url "$backend_url")"
  if [[ -z "$agent_name" ]]; then
    agent_name="${role}-$(hostname -s 2>/dev/null || hostname)"
  fi
  if [[ -z "$bootstrap_token" ]]; then
    warn "没有填写 --bootstrap-token。只有已经注册过、且 /var/lib/kato/agent-state.json 存在的节点才能继续运行"
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
  _说明: {
    用途: "Kato 节点 Agent 配置文件，由安装脚本生成。",
    backendUrl: "面板后端 API 地址，节点会定时连接这个地址拉取最新配置。",
    role: "当前服务器角色，例如 proxy-node 代理节点，transit-relay 中转服务器。",
    name: "节点在面板里显示的名称。",
    bootstrapToken: "首次注册用的一次性 token。注册成功后会写入 statePath，之后可留空。",
    statePath: "节点注册状态文件，包含 agentId 和密钥，请勿泄露。",
    lastKnownGoodPath: "最后一次成功获取的配置。后端断联时，节点会用它继续运行。",
    runtimeDir: "渲染后的 Xray / Hysteria2 / Realm 配置目录。",
    backupDir: "历史配置备份目录。",
    logDir: "运行日志目录。",
    binaryValidation: "是否在应用配置前调用运行程序做配置校验。",
    autoStart: "同步配置后是否自动启动代理运行进程。"
  },
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
# Kato 节点 Agent 环境变量文件，由安装脚本生成。
# 修改后需要执行：systemctl restart kato-agent.timer
NODE_ENV=production
# Agent JSON 配置文件路径
AGENT_CONFIG=${config_path}
EOF
  chown root:kato "$config_path" "$env_path"
  chmod 0640 "$config_path" "$env_path"
}

install_agent_role() {
  log "正在安装节点 Agent，角色：${role}"
  install_runtime_binaries
  write_agent_config

  write_systemd_service "kato-agent" "[Unit]
Description=Kato 节点配置同步（${role}）
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
Description=每分钟运行 Kato 节点配置同步

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
      die "节点 Agent 首次同步失败，请查看上方日志"
    }
  else
    warn "没有 bootstrap token，也没有历史注册状态，已跳过首次同步"
  fi
  log "节点 Agent 安装完成，角色：${role}"
}

install_edge_placeholder() {
  local edge_name="$1"
  install_nginx
  install -d -m 0755 -o root -g root "/var/www/kato-${edge_name}"
  cat >"/var/www/kato-${edge_name}/index.html" <<EOF
<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${APP_NAME}</title></head>
<body><main style="font-family:system-ui,sans-serif;max-width:720px;margin:12vh auto;padding:24px;line-height:1.6"><h1>${APP_NAME}</h1><p>${edge_name} 正在运行。</p></main></body>
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

json_read() {
  local file="$1"
  local expr="$2"
  [[ -f "$file" ]] || return 0
  jq -r "${expr} // empty" "$file" 2>/dev/null || true
}

load_existing_tls_config() {
  local state_path
  state_path="$(tls_state_path)"
  [[ -f "$state_path" ]] || return 0
  if [[ "$tls_explicit" != "true" ]]; then
    tls_mode="$(awk -F= '/^KATO_TLS_MODE=/{print $2; exit}' "$state_path")"
  fi
  if [[ "$domain_explicit" != "true" ]]; then
    public_domain="$(awk -F= '/^KATO_DOMAIN=/{print $2; exit}' "$state_path")"
  fi
  acme_email="${acme_email:-$(awk -F= '/^KATO_ACME_EMAIL=/{print $2; exit}' "$state_path")}"
  if [[ "$https_port_explicit" != "true" ]]; then
    https_port="$(awk -F= '/^KATO_HTTPS_PORT=/{print $2; exit}' "$state_path")"
  fi
  tls_mode="${tls_mode:-none}"
  https_port="${https_port:-443}"
}

load_existing_backend_config() {
  local config_path="/etc/kato/backend-core.json"
  local env_path="/etc/kato/backend-core.env"
  if [[ -f "$config_path" ]]; then
    [[ "$listen_host_explicit" == "true" ]] || listen_host="$(json_read "$config_path" '.host')"
    [[ "$listen_port_explicit" == "true" ]] || listen_port="$(json_read "$config_path" '.port')"
    admin_token="${admin_token:-$(json_read "$config_path" '.adminToken')}"
    admin_cors_origins="${admin_cors_origins:-$(json_read "$config_path" '.adminCorsOrigins | join(",")')}"
  fi
  if [[ -f "$env_path" ]]; then
    admin_token="${admin_token:-$(awk -F= '/^BACKEND_ADMIN_TOKEN=/{print $2; exit}' "$env_path")}"
    admin_cors_origins="${admin_cors_origins:-$(awk -F= '/^BACKEND_ADMIN_CORS_ORIGINS=/{print $2; exit}' "$env_path")}"
  fi
  listen_host="${listen_host:-0.0.0.0}"
  listen_port="${listen_port:-8080}"
  load_existing_tls_config
}

load_existing_admin_ui_config() {
  local conf="/etc/nginx/sites-available/kato-panel-frontend.conf"
  local existing_port
  [[ -f "$conf" ]] || return 0
  backend_url="${backend_url:-$(awk '/proxy_pass /{gsub(";","",$2); print $2; exit}' "$conf")}"
  frontend_pairing_token="${frontend_pairing_token:-$(awk '/X-Frontend-Token/{gsub(";","",$3); print $3; exit}' "$conf")}"
  panel_admin_path="${panel_admin_path:-$(awk '$1=="location" && $2=="=" && $3!="/health"{print $3; exit}' "$conf")}"
  existing_port="$(awk '/listen / && /default_server/ && $2 !~ /^\[/{gsub(";","",$2); print $2; exit}' "$conf")"
  [[ "$admin_ui_port_explicit" == "true" || -z "$existing_port" ]] || admin_ui_port="$existing_port"
  admin_ui_port="${admin_ui_port:-80}"
  load_existing_tls_config
}

load_existing_agent_config() {
  local config_path="/etc/kato/agent.json"
  [[ -f "$config_path" ]] || return 0
  backend_url="${backend_url:-$(json_read "$config_path" '.backendUrl')}"
  agent_name="${agent_name:-$(json_read "$config_path" '.name')}"
  bootstrap_token="${bootstrap_token:-$(json_read "$config_path" '.bootstrapToken')}"
  agent_auto_start="${agent_auto_start:-$(json_read "$config_path" '.autoStart')}"
  binary_validation="${binary_validation:-$(json_read "$config_path" '.binaryValidation')}"
  role="${role:-$(json_read "$config_path" '.role')}"
}

create_upgrade_backup() {
  local backup_dir="/var/backups/kato"
  local backup_path
  backup_path="${backup_dir}/upgrade-${role}-$(date '+%Y%m%d%H%M%S').tar.gz"
  install -d -m 0700 -o root -g root "$backup_dir"
  tar -czf "$backup_path" --ignore-failed-read /etc/kato /var/lib/kato 2>/dev/null || true
  chown root:root "$backup_path"
  chmod 0600 "$backup_path"
  log "升级前备份已创建：${backup_path}"
}

upgrade_backend_core() {
  log "正在升级面板后端 backend-core"
  load_existing_backend_config
  if can_prompt; then
    prompt_tls_options
  fi
  create_upgrade_backup
  validate_tls_options
  if [[ "$tls_mode" == "letsencrypt" ]]; then
    listen_host="127.0.0.1"
  fi
  write_backend_config
  write_backend_service
  systemctl daemon-reload
  systemctl enable --now kato-backend-core.service
  systemctl restart kato-backend-core.service
  wait_for_backend
  configure_backend_tls_proxy
  log "面板后端升级完成，当前版本：${APP_VERSION}"
}

upgrade_admin_ui() {
  log "正在升级面板前端服务器 admin-ui"
  load_existing_admin_ui_config
  if can_prompt; then
    prompt_tls_options
  fi
  if [[ -z "$backend_url" ]]; then
    can_prompt || die "未读取到后端 API 地址，请传入 --backend-url"
    prompt_required backend_url "未读取到后端 API 地址，请输入，例如 http://后端IP:8080"
  fi
  if [[ -z "$frontend_pairing_token" ]]; then
    can_prompt || die "未读取到前端配对 token，请传入 --frontend-token"
    prompt_required frontend_pairing_token "未读取到前端配对 token，请输入"
  fi
  create_upgrade_backup
  install_admin_ui
  log "面板前端升级完成，当前版本：${APP_VERSION}"
}

upgrade_agent_role() {
  log "正在升级节点 Agent，角色：${role}"
  load_existing_agent_config
  if [[ -z "$backend_url" ]]; then
    can_prompt || die "未读取到后端 API 地址，请传入 --backend-url"
    prompt_required backend_url "未读取到后端 API 地址，请输入，例如 http://后端IP:8080"
  fi
  create_upgrade_backup
  case "$role" in
    frontend-edge|subscription-edge)
      install_edge_placeholder "$role"
      install_agent_role
      ;;
    proxy-node|transit-relay)
      install_agent_role
      ;;
    *)
      die "不支持的 Agent 升级角色：${role}"
      ;;
  esac
  log "节点 Agent 升级完成，当前版本：${APP_VERSION}"
}

run_install_action() {
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
      die "不支持的安装角色：${role}"
      ;;
  esac
}

run_upgrade_action() {
  case "$role" in
    backend-core)
      upgrade_backend_core
      ;;
    admin-ui)
      upgrade_admin_ui
      ;;
    frontend-edge|subscription-edge|proxy-node|transit-relay)
      upgrade_agent_role
      ;;
    *)
      die "不支持的升级角色：${role}"
      ;;
  esac
}

main() {
  require_root
  require_linux
  load_os_release
  collect_interactive_options
  prepare_upgrade_defaults
  configure_apt_mirror
  ensure_base_dependencies
  install_node
  resolve_source_dir
  sync_source_tree
  ensure_kato_user_and_dirs

  if [[ "$action" == "upgrade" ]]; then
    run_upgrade_action
  else
    run_install_action
  fi

  log "${action} 完成，服务器角色：${role}"
}

main "$@"
