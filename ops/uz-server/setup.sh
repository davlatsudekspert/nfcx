#!/usr/bin/env bash
# NFCSTORE — O'zbekistondagi ma'lumotlar serveri (MYCLOUD VPS, Ubuntu 24.04).
#
#   curl -fsSL https://nfcstore.uz/uz-setup.sh | sudo bash
#   QUIET=1 — oxirida kalitlarni ekranga chiqarmaydi (GitHub Actions uchun).
#
# Nima o'rnatadi (hammasi Docker ichida, /srv/nfcstore):
#   • sqld (libSQL)  — baza, SQLite bilan mos (Cloudflare D1 o'rniga)
#   • Garage         — S3 bilan mos rasm/video ombori (Cloudflare R2 o'rniga)
#   • Caddy          — HTTPS (Let's Encrypt) va baza uchun token tekshiruvi
#   • ufw            — faqat 22, 80, 443 ochiq
#   • har kecha 03:30 zaxira (/srv/nfcstore/backups, 14 kun saqlanadi)
#
# Qayta ishga tushirish xavfsiz: mavjud kalitlar va ma'lumotlar saqlanadi.
# Maxfiy kalitlar faqat /srv/nfcstore/secrets.env da (chmod 600) va oxirida
# BIR MARTA ekranga chiqadi — ularni GitHub Secrets'ga qo'yasiz.
set -euo pipefail

DB_HOST="${DB_HOST:-db.nfcstore.uz}"
S3_HOST="${S3_HOST:-s3.nfcstore.uz}"
BUCKET="${BUCKET:-nfcstore-uploads}"
ROOT=/srv/nfcstore
GARAGE_IMAGE="dxflrs/garage:v1.1.0"
SQLD_IMAGE="ghcr.io/tursodatabase/libsql-server:latest"

[ "$(id -u)" = 0 ] || { echo "root sifatida ishga tushiring (sudo)"; exit 1; }
exec > >(tee -a /root/nfcstore-setup.log) 2>&1
step() { echo; echo "==> $*"; }

step "1/7 Paketlar"
export DEBIAN_FRONTEND=noninteractive
# Yangi serverda Ubuntu fonda o'z yangilanishlarini o'rnatadi (unattended-upgrades)
# — apt band bo'ladi yoki yarim qolgan bo'ladi. Avval kutamiz, keyin tuzatamiz.
for i in $(seq 1 90); do
  pgrep -x apt-get >/dev/null || pgrep -x apt >/dev/null || pgrep -x dpkg >/dev/null \
    || pgrep -f unattended-upgr >/dev/null || break
  [ "$i" = 1 ] && echo "apt band — Ubuntu yangilanishlari tugashini kutyapman..."
  sleep 5
done
dpkg --configure -a
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 ufw sqlite3 curl jq openssl ca-certificates >/dev/null
systemctl enable --now docker >/dev/null

step "2/7 Papkalar va maxfiy kalitlar"
mkdir -p "$ROOT"/{sqld,garage/meta,garage/data,caddy/data,caddy/config,backups}
chmod 700 "$ROOT"
if [ ! -f "$ROOT/secrets.env" ]; then
  umask 077
  cat > "$ROOT/secrets.env" <<SECRETS
DB_TOKEN=$(openssl rand -hex 32)
GARAGE_RPC_SECRET=$(openssl rand -hex 32)
GARAGE_ADMIN_TOKEN=$(openssl rand -hex 32)
SECRETS
fi
chmod 600 "$ROOT/secrets.env"
# shellcheck disable=SC1091
. "$ROOT/secrets.env"

step "3/7 Sozlama fayllari"
cat > "$ROOT/garage/garage.toml" <<TOML
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "${GARAGE_RPC_SECRET}"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "${GARAGE_ADMIN_TOKEN}"
TOML
chmod 600 "$ROOT/garage/garage.toml"

cat > "$ROOT/Caddyfile" <<'CADDY'
{$DB_HOST} {
	@auth header Authorization "Bearer {$DB_TOKEN}"
	handle @auth {
		reverse_proxy sqld:8080
	}
	respond "unauthorized" 401
}

{$S3_HOST} {
	request_body {
		max_size 250MB
	}
	reverse_proxy garage:3900
}
CADDY

cat > "$ROOT/docker-compose.yml" <<COMPOSE
name: nfcstore
services:
  sqld:
    image: ${SQLD_IMAGE}
    restart: unless-stopped
    environment:
      SQLD_NODE: primary
    volumes:
      - ${ROOT}/sqld:/var/lib/sqld
  garage:
    image: ${GARAGE_IMAGE}
    restart: unless-stopped
    volumes:
      - ${ROOT}/garage/garage.toml:/etc/garage.toml:ro
      - ${ROOT}/garage/meta:/var/lib/garage/meta
      - ${ROOT}/garage/data:/var/lib/garage/data
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    environment:
      DB_HOST: ${DB_HOST}
      S3_HOST: ${S3_HOST}
      DB_TOKEN: \${DB_TOKEN}
    volumes:
      - ${ROOT}/Caddyfile:/etc/caddy/Caddyfile:ro
      - ${ROOT}/caddy/data:/data
      - ${ROOT}/caddy/config:/config
    depends_on: [sqld, garage]
COMPOSE

step "4/7 Firewall (22, 80, 443)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,8p'

step "5/7 Xizmatlarni ishga tushirish"
cd "$ROOT"
docker compose --env-file "$ROOT/secrets.env" pull -q
docker compose --env-file "$ROOT/secrets.env" up -d
sleep 8

step "6/7 Rasm/video ombori (Garage)"
G() { docker compose --env-file "$ROOT/secrets.env" exec -T garage /garage "$@"; }
for i in $(seq 1 20); do G status >/dev/null 2>&1 && break; sleep 3; done
NODE=$(G node id -q | cut -d@ -f1)
if ! G layout show 2>/dev/null | grep -q "${NODE:0:16}"; then
  G layout assign -z uz1 -c 30G "$NODE"
  G layout apply --version 1
fi
G bucket info "$BUCKET" >/dev/null 2>&1 || G bucket create "$BUCKET"
if [ ! -f "$ROOT/s3.env" ]; then
  OUT=$(G key create nfcstore-worker)
  KEY_ID=$(echo "$OUT" | awk -F': *' '/Key ID/{print $2; exit}')
  SECRET=$(echo "$OUT" | awk -F': *' '/Secret key/{print $2; exit}')
  [ -n "$KEY_ID" ] && [ -n "$SECRET" ] || { echo "Garage kalitini o'qib bo'lmadi:"; echo "$OUT" | sed 's/Secret key.*/Secret key: (yashirildi)/'; exit 1; }
  umask 077
  printf 'S3_KEY_ID=%s\nS3_SECRET=%s\n' "$KEY_ID" "$SECRET" > "$ROOT/s3.env"
  G bucket allow --read --write --owner "$BUCKET" --key nfcstore-worker
fi
chmod 600 "$ROOT/s3.env"
# shellcheck disable=SC1091
. "$ROOT/s3.env"

step "7/7 Har kecha zaxira (03:30, 14 kun)"
cat > /usr/local/bin/nfcstore-backup <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/nfcstore; D=$(date +%F); OUT="$ROOT/backups/$D"; mkdir -p "$OUT"
DB=$(find "$ROOT/sqld" -type f -name data -path '*dbs/default*' | head -1)
[ -n "$DB" ] && sqlite3 "$DB" ".backup '$OUT/db.sqlite'"
tar -C "$ROOT/garage" -czf "$OUT/garage.tgz" meta data
find "$ROOT/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
BACKUP
chmod 700 /usr/local/bin/nfcstore-backup
echo "30 3 * * * root /usr/local/bin/nfcstore-backup >> /var/log/nfcstore-backup.log 2>&1" > /etc/cron.d/nfcstore-backup

# Ichki tekshiruv (HTTPS'siz, konteynerlar tarmog'ida).
DBOK=$(docker compose --env-file "$ROOT/secrets.env" exec -T caddy wget -qO- \
  --header 'Content-Type: application/json' --post-data '{"statements":["select 1"]}' http://sqld:8080/ 2>/dev/null || true)
echo; echo "Baza ichki tekshiruvi: ${DBOK:-JAVOB YOQ}"

if [ "${QUIET:-0}" = 1 ]; then
  echo; echo "TAYYOR. Kalitlar faqat serverda: /srv/nfcstore/secrets.env, /srv/nfcstore/s3.env"
  exit 0
fi

cat <<DONE

================================================================
 TAYYOR. Quyidagi 6 qiymatni GitHub → Settings → Secrets and
 variables → Actions → "New repository secret" ga qo'ying.
 Ularni chatga, emailga yoki boshqa joyga YOZMANG.
----------------------------------------------------------------
 UZ_DB_URL        https://${DB_HOST}
 UZ_DB_TOKEN      ${DB_TOKEN}
 UZ_S3_ENDPOINT   https://${S3_HOST}
 UZ_S3_BUCKET     ${BUCKET}
 UZ_S3_KEY_ID     ${S3_KEY_ID}
 UZ_S3_SECRET     ${S3_SECRET}
================================================================
 Qayta ko'rish kerak bo'lsa: cat /srv/nfcstore/secrets.env /srv/nfcstore/s3.env
DONE
