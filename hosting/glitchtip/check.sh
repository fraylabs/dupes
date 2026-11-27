#!/bin/sh
# Health check from anywhere: sh check.sh <host name>
set -eu
curl -fsS -o /dev/null -w "health %{http_code}\n" "https://$1/_health/"
