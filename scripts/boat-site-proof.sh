#!/usr/bin/env bash
set -euo pipefail
npm ci
npm run check
npm audit
npx playwright install --with-deps chromium
mkdir -p proof
proof_exit=0
timeout 300 npm run prove:site || proof_exit=$?
if [[ -d proof/site ]]; then tar -czf proof/site-artifacts.tar.gz -C proof site; fi
exit "$proof_exit"
