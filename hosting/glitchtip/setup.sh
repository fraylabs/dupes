#!/bin/sh
# Sets GlitchTip up on a fresh Ubuntu server. Run as root from this folder:
#   sh setup.sh <host name> <from address> <admin address> <organisation> <project,project,...>
# The host name's DNS record must already point at this server (for the certificate).
# Logins, the DSNs and the agents' token are written once to credentials.json (root only).
set -eu
[ $# -eq 5 ] || { echo "usage: sh setup.sh <host name> <from address> <admin address> <organisation> <projects>"; exit 2; }
HOST_NAME=$1; FROM=$2; ADMIN=$3; ORG=$4; PROJECTS=$5
cd "$(dirname "$0")"
umask 077

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io docker-compose-v2
fi
if [ "$(swapon --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap -q /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

if [ ! -f .env ]; then
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "SECRET_KEY=$(openssl rand -hex 32)"
    echo "HOST_NAME=$HOST_NAME"
    echo "DEFAULT_FROM_EMAIL=$FROM"
  } > .env
fi

docker compose up -d
i=0
until docker compose exec -T web python -c "import urllib.request as u; u.urlopen('http://localhost:8000/_health/')" 2>/dev/null; do
  i=$((i+1)); [ "$i" -lt 120 ] || { echo "app did not become healthy"; exit 1; }
  sleep 2
done

docker compose exec -T -e ADMIN_EMAIL="$ADMIN" -e ORG_NAME="$ORG" -e PROJECTS="$PROJECTS" web \
  ./manage.py shell < bootstrap.py 2> bootstrap.log | sed -n 's/^RESULT //p' > credentials.new
[ -s credentials.new ] || { rm -f credentials.new; echo "first login was not made; see bootstrap.log"; exit 1; }
[ -f credentials.json ] || mv credentials.new credentials.json
rm -f credentials.new

cat > /etc/cron.d/glitchtip-backup <<EOT
15 18 * * * root sh $(pwd)/backup.sh >> /var/log/glitchtip-backup.log 2>&1
EOT
chmod 644 /etc/cron.d/glitchtip-backup

echo "up: https://$HOST_NAME  (credentials.json written, root only)"
