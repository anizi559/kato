#!/usr/bin/env bash
#
# Kato 面板前端服务器一键备份
# 在旧/当前前端面板服务器上以 root 执行：
#   sudo ./scripts/admin-ui-backup.sh
# 备份包输出到 /var/backups/kato-admin-ui-backup-<时间>.tar.gz（含 sha256 校验文件）。
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="kato-admin-ui-backup-${STAMP}"
DEST="${BACKUP_DIR}/${NAME}"
TARBALL="${BACKUP_DIR}/${NAME}.tar.gz"

if [[ "$(id -u)" != "0" ]]; then
  echo "请用 root 运行：sudo $0" >&2
  exit 1
fi

mkdir -p "${DEST}"

echo "==> 备份 Kato 前端面板配置"
for file in frontend-local.json frontend-local.env tls.env cloudflare.ini; do
  if [[ -f "/etc/kato/${file}" ]]; then
    cp -a "/etc/kato/${file}" "${DEST}/"
    echo "    /etc/kato/${file}"
  else
    echo "    跳过（不存在）：/etc/kato/${file}"
  fi
done

echo "==> 备份 Nginx 站点配置"
if [[ -f /etc/nginx/sites-available/kato-panel-frontend.conf ]]; then
  cp -a /etc/nginx/sites-available/kato-panel-frontend.conf "${DEST}/"
fi

echo "==> 备份 Let's Encrypt 证书与续期账号"
if [[ -d /etc/letsencrypt ]]; then
  cp -a /etc/letsencrypt "${DEST}/letsencrypt"
fi

echo "==> 备份面板静态文件（工具站 + 管理后台 dist）"
if [[ -d /var/www/kato-panel-frontend ]]; then
  cp -a /var/www/kato-panel-frontend "${DEST}/www-kato-panel-frontend"
fi

cat > "${DEST}/restore-info.txt" <<EOF
Kato 前端面板备份
备份时间: $(date '+%Y-%m-%d %H:%M:%S %Z')
服务器: $(hostname) ($(hostname -I 2>/dev/null | awk '{print $1}'))
恢复方式: sudo ./scripts/admin-ui-restore.sh ${TARBALL}

恢复前置条件:
1. 新服务器已通过 install.sh --role admin-ui 完成基础安装（nginx、node、frontend-local 服务、目录）。
2. 新服务器 DNS 已指向新机器（或至少能访问 443）。

关键配置（已包含在备份内）:
- /etc/kato/frontend-local.json  本地管理服务（后台路径、后端地址、前端配对 Token）
- /etc/kato/tls.env              域名 / TLS 模式
- /etc/kato/cloudflare.ini       Cloudflare DNS Token（签发证书用）
- /etc/nginx/sites-available/kato-panel-frontend.conf
- /etc/letsencrypt               证书 + 续期账号
- /var/www/kato-panel-frontend   工具站 + 管理后台
EOF

echo "==> 打包"
tar czf "${TARBALL}" -C "${BACKUP_DIR}" "${NAME}"
sha256sum "${TARBALL}" > "${TARBALL}.sha256"
rm -rf "${DEST}"

echo ""
echo "备份完成：${TARBALL}"
echo "校验文件：${TARBALL}.sha256"
ls -lh "${TARBALL}" "${TARBALL}.sha256"
