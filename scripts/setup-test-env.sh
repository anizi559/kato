#!/usr/bin/env bash
set -euo pipefail

mirror="tuna"
proxy=""
realm_version="v2.9.4"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mirror)
      mirror="$2"
      shift 2
      ;;
    --proxy)
      proxy="$2"
      shift 2
      ;;
    --realm-version)
      realm_version="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$mirror" in
  tuna)
    export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
    ;;
  ustc)
    export HOMEBREW_API_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles"
    ;;
  none)
    ;;
  *)
    echo "Unsupported mirror: $mirror" >&2
    exit 1
    ;;
esac

export HOMEBREW_NO_AUTO_UPDATE=1

brew install xray hysteria sing-box gost go rust socat shellcheck gh

arch_name="$(uname -m)"
os_name="$(uname -s)"
case "${os_name}-${arch_name}" in
  Darwin-arm64)
    realm_asset="realm-aarch64-apple-darwin.tar.gz"
    ;;
  Darwin-x86_64)
    realm_asset="realm-x86_64-apple-darwin.tar.gz"
    ;;
  Linux-aarch64|Linux-arm64)
    realm_asset="realm-aarch64-unknown-linux-musl.tar.gz"
    ;;
  Linux-x86_64)
    realm_asset="realm-x86_64-unknown-linux-musl.tar.gz"
    ;;
  *)
    echo "Unsupported Realm target: ${os_name}-${arch_name}" >&2
    exit 1
    ;;
esac

mkdir -p tools/downloads tools/bin
realm_url="https://github.com/zhboner/realm/releases/download/${realm_version}/${realm_asset}"
curl_args=(-L --fail --max-time 180 -o "tools/downloads/${realm_asset}" "$realm_url")
if [[ -n "$proxy" ]]; then
  curl_args=(-x "$proxy" "${curl_args[@]}")
fi

curl "${curl_args[@]}"
tar -xzf "tools/downloads/${realm_asset}" -C tools/bin
chmod +x tools/bin/realm

echo "Test environment tools installed."
echo "Realm: $(tools/bin/realm --version 2>&1 | head -n 1)"
