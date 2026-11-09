#!/usr/bin/env bash
# Mac / Linux: jalankan dengan  bash Jalankan.sh
cd "$(dirname "$0")/backend" || exit 1
command -v node >/dev/null || { echo "Node.js belum terpasang (https://nodejs.org)"; exit 1; }
[ -d node_modules ] || npm install
echo "Buka http://localhost:3000"
node src/server.js
