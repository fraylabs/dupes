#!/bin/sh
# One database dump a day, seven kept. Run from cron by setup.sh.
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p backups
docker compose exec -T postgres pg_dump -U postgres -Fc postgres > "backups/glitchtip-$(date -u +%F).dump.part"
mv "backups/glitchtip-$(date -u +%F).dump.part" "backups/glitchtip-$(date -u +%F).dump"
ls -1 backups/glitchtip-*.dump | sort | head -n -7 | while read -r old; do rm "$old"; done
