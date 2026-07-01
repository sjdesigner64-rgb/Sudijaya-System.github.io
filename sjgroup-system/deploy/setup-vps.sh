#!/bin/bash
# Setup VPS Hostinger untuk sjgroup-system
# Jalankan sebagai root: bash setup-vps.sh

set -e

echo "=== [1/7] Update sistem ==="
apt update && apt upgrade -y

echo "=== [2/7] Install Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== [3/7] Install MySQL ==="
apt install -y mysql-server
systemctl enable mysql && systemctl start mysql

echo "=== [4/7] Install Nginx ==="
apt install -y nginx
systemctl enable nginx && systemctl start nginx

echo "=== [5/7] Install PM2 ==="
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo "=== [6/7] Konfigurasi Firewall (UFW) ==="
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh        # port 22 — jangan sampai terkunci
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw --force enable
ufw status

echo "=== [7/7] Install Fail2ban (blok brute force SSH) ==="
apt install -y fail2ban
systemctl enable fail2ban && systemctl start fail2ban

echo ""
echo "=== Setup MySQL: buat database & user ==="
echo "Jalankan perintah ini di MySQL:"
echo ""
echo "  mysql -u root"
echo "  CREATE DATABASE sjgroup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  CREATE USER 'sjgroup_user'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT';"
echo "  GRANT ALL PRIVILEGES ON sjgroup.* TO 'sjgroup_user'@'localhost';"
echo "  FLUSH PRIVILEGES; EXIT;"
echo ""
echo "✅ Setup selesai! Lanjutkan dengan upload kode dan konfigurasi .env"
