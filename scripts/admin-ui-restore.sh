#!/usr/bin/env bash
#
# Kato 面板前端服务器备份还原 / 迁移恢复
# 在新服务器（已用 install.sh --role admin-ui 完成基础安装）上以 root 执行：
#   sudo ./scripts/admin-ui-restore.sh /var/backups/kato-admin-ui-backup-<时间>.tar.gz
#
# 也支持原服务器回滚：先跑 admin-ui-backup.sh 得到当前备份，再还原这个备份。
#
set -euo pipefail

TARBALL="${1:-}"
if [[ -z "${TARBALL}" || ! -f "${TARBALL}" ]]; then
  echo "用法: sudo $0 <备份包.tar.gz>" >&2
  exit 1
fi

if [[ "$(id -u)" != "0" ]]; then
  echo "请用 root 运行：sudo $0 ${TARBALL}" >&2
  exit 1
fi

# 前置检查：新服务器必须已有 install.sh 装好的基础环境
for need in \
  /opt/kato/node/bin/node \
  /etc/systemd/system/kato-frontend-local.service \
  /var/www/kato-panel-frontend; do
  if [[ ! -e "${need}" ]]; then
    echo "缺少前置安装：${need}" >&2
    echo "请先在新服务器上安装面板前端：sudo ./install.sh --role admin-ui --backend-url <后端地址> --frontend-token <前端Token>" >&2
    exit 1
  fi
done

echo "==> 校验备份包"
if [[ -f "${TARBALL}.sha256" ]]; then
  (cd "$(dirname "${TARBALL}")" && sha256sum -c "$(basename "${TARBALL}").sha256")
else
  echo "    未找到 .sha256 校验文件，跳过校验"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "==> 解压备份包"
tar xzf "${TARBALL}" -C "${TMP}"
ROOT="$(find "${TMP}" -maxdepth 1 -type d -name 'kato-admin-ui-backup-*' | head -1)"
if [[ -z "${ROOT}" ]]; then
  echo "备份包结构不正确：未找到 kato-admin-ui-backup-* 目录" >&2
  exit 1
fi

echo "==> 恢复配置到 /etc/kato"
install -m 0600 -o root -g root "${ROOT}/frontend-local.json" /etc/kato/frontend-local.json
for file in frontend-local.env tls.env cloudflare.ini; do
  if [[ -f "${ROOT}/${file}" ]]; then
    install -m 0600 -o root -g root "${ROOT}/${file}" "/etc/kato/${file}"
  fi
done

echo "==> 恢复 Nginx 站点配置"
install -m 0644 -o root -g root \
  "${ROOT}/kato-panel-frontend.conf" \
  /etc/nginx/sites-available/kato-panel-frontend.conf
ln -sfn /etc/nginx/sites-available/kato-panel-frontend.conf \
  /etc/nginx/sites-enabled/kato-panel-frontend.conf

echo "==> 恢复 Let's Encrypt 证书与续期账号"
if [[ -d "${ROOT}/letsencrypt" ]]; then
  rm -rf /etc/letsencrypt
  cp -a "${ROOT}/letsencrypt" /etc/letsencrypt
fi

echo "==> 恢复面板静态文件"
if [[ -d "${ROOT}/www-kato-panel-frontend" ]]; then
  rm -rf /var/www/kato-panel-frontend
  cp -a "${ROOT}/www-kato-panel-frontend" /var/www/kato-panel-frontend
fi

echo "==> 校验 Nginx 配置并重启服务"
nginx -t
systemctl daemon-reload
systemctl restart kato-frontend-local nginx

echo ""
echo "恢复完成。请确认："
echo "1. DNS：kaonion.xyz 等域名已解析到本机 IP。"
echo "2. 本机 443 端口已在云防火墙放行。"
echo "3. 验证：curl -k https://<域名>/health 应返回 ok；打开 <域名><后台路径>/ 应能登录。"
echo "4. 后台路径与配置版本：cat /etc/kato/frontend-local.json | jq .adminPath"
