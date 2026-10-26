#!/usr/bin/env bash
set -euo pipefail
# Snapshot the working tree into a local Git repo, then verify a fresh clone of
# it without a remote, registry publication or host credentials.
source_dir="$PWD"
checkout="$source_dir/proof/fresh-checkout-$(date +%s)-$$"
mkdir -p "$source_dir/proof"
if [[ ! -d .git ]]; then
  git init -q
fi
git add .
if ! git diff --cached --quiet; then
  git -c user.name='Local verification' -c user.email='verification@example.test' -c commit.gpgsign=false commit -qm 'Verification source snapshot'
fi
git clone --quiet --no-hardlinks "$source_dir" "$checkout"
cd "$checkout"
# Prove that the public one-command start prepares an empty checkout itself.
DATA_DIR="$checkout/proof/bootstrap" PORT=3122 node packages/cli/bin/dupe.mjs up feedback --node > "$checkout/bootstrap.log" 2>&1 &
bootstrap_pid=$!
trap 'kill "$bootstrap_pid" 2>/dev/null || true' EXIT
for ((i=0; i<180; i++)); do
  if curl --fail --silent http://127.0.0.1:3122/health > /dev/null; then break; fi
  if ! kill -0 "$bootstrap_pid" 2>/dev/null; then cat "$checkout/bootstrap.log"; exit 1; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:3122/health
echo
kill "$bootstrap_pid"
wait "$bootstrap_pid" || true
trap - EXIT
npm run check
npm audit
npx playwright install --with-deps chromium
proof_exit=0
timeout 180 npm run prove || proof_exit=$?
for artifact in proof/result.json proof/*.png; do
  if [[ -f "$artifact" ]]; then cp "$artifact" "$source_dir/proof/"; fi
done
if [[ "$proof_exit" != 0 ]]; then exit "$proof_exit"; fi
hosted_exit=0
timeout 180 npm run prove:hosted || hosted_exit=$?
for artifact in proof/hosted-result.json proof/hosted-admin.png; do
  if [[ -f "$artifact" ]]; then cp "$artifact" "$source_dir/proof/"; fi
done
if [[ "$hosted_exit" != 0 ]]; then exit "$hosted_exit"; fi
if docker info >/dev/null 2>&1; then
  docker_name="dupes-proof-$$"
  docker build -t dupes-feedback:proof .
  mkdir -p proof/docker-data
  docker run -d --rm --name "$docker_name" --user "$(id -u):$(id -g)" -v "$PWD/proof/docker-data:/data" -p 127.0.0.1:3124:3000 dupes-feedback:proof >/dev/null
  trap 'docker stop "$docker_name" >/dev/null 2>&1 || true' EXIT
  for ((i=0; i<60; i++)); do
    if curl --fail --silent http://127.0.0.1:3124/health >/dev/null; then break; fi
    sleep 1
  done
  curl --fail --silent http://127.0.0.1:3124/health
  docker exec "$docker_name" node --import tsx dupes/feedback/src/import-cli.ts --fixture fixtures/canny.json
  curl --fail --silent http://127.0.0.1:3124/api/posts | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const posts=JSON.parse(s);if(!posts.some(p=>p.votes===128))process.exit(1)})'
  docker stop "$docker_name" >/dev/null
  trap - EXIT
  echo '{"ok":true,"mode":"Docker","health":true,"fixtureVotes":128}' > "$source_dir/proof/docker-result.json"
else
  echo '{"mode":"Node fallback","dockerAvailable":false}' > "$source_dir/proof/docker-result.json"
fi
echo 'Fresh clone, one-command start and full service proof completed.'
