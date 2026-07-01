#!/bin/bash
# Deploy sjgroup-system ke VPS
# Jalankan dari root folder project: bash deploy/deploy.sh

set -e
APP_DIR="/var/www/sjgroup"

echo "=== [1/5] Install dependencies frontend ==="
cd "$APP_DIR"
npm install

echo "=== [2/5] Build frontend ==="
npm run build
# Hasil build ada di dist/

echo "=== [3/5] Install dependencies backend ==="
cd "$APP_DIR/server"
npm install --omit=dev

echo "=== [4/5] Build backend ==="
npm run build
# Hasil build ada di server/dist/

echo "=== [5/5] Jalankan database migration & restart PM2 ==="
npx prisma generate
npx prisma db push

pm2 restart sjgroup-backend 2>/dev/null || pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo "✅ Deploy selesai!"
pm2 status
