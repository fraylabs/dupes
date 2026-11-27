#!/bin/sh
# Proof on one machine with Docker and no server: bring the entry up with made-up
# values, make the first login, send one fault, read it back the way an agent does
# (API and the built-in tool server), take a backup, then remove what it made.
# Refuses to run where a .env exists.
set -u
cd "$(dirname "$0")"
[ ! -e .env ] || { echo "a .env is here: this looks like a live set-up, not running"; exit 2; }
# Its own project name, so it can never touch containers or data made by setup.sh.
export COMPOSE_PROJECT_NAME=glitchtip-prove
C="docker compose -f compose.yml -f compose.test.yml"
BASE=http://127.0.0.1:18000
fail() { echo "FAIL: $1"; $C logs --tail 30 web 2>&1 | cut -c1-240; $C down -v >/dev/null 2>&1; rm -rf .env backups prove.tmp; exit 1; }
mkdir -p prove.tmp
cat > .env <<EOT
POSTGRES_PASSWORD=$(openssl rand -hex 16)
SECRET_KEY=$(openssl rand -hex 32)
HOST_NAME=faults.example.com
DEFAULT_FROM_EMAIL=scout@example.com
EOT
$C config -q || fail "compose file"
docker run --rm -e HOST_NAME=faults.example.com -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || fail "Caddyfile"
echo "ok   compose file and Caddyfile are valid"

$C up -d postgres web >/dev/null 2>&1 || fail "up"
i=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' $BASE/_health/)" = 200 ]; do
  i=$((i+1)); [ "$i" -lt 120 ] || fail "health"
  sleep 2
done
echo "ok   healthy after about $((i*2))s"

$C exec -T -e ADMIN_EMAIL=scout@example.com -e ORG_NAME=example-org -e PROJECTS=phone,desktop web \
  ./manage.py shell < bootstrap.py 2> prove.tmp/bootstrap.err | sed -n 's/^RESULT //p' > prove.tmp/first.json
[ -s prove.tmp/first.json ] || { tail -15 prove.tmp/bootstrap.err | cut -c1-240; fail "first login"; }
$C exec -T -e ADMIN_EMAIL=scout@example.com -e ORG_NAME=example-org -e PROJECTS=phone,desktop web \
  ./manage.py shell < bootstrap.py 2>/dev/null | sed -n 's/^RESULT //p' > prove.tmp/second.json

python3 - "$BASE" <<'PY' || fail "fault round trip"
import json, sys, time, urllib.request, uuid
base = sys.argv[1]
first = json.load(open("prove.tmp/first.json"))
second = json.load(open("prove.tmp/second.json"))
assert first.get("adminPassword") and first.get("agentToken"), "first run must hand back a password and a token"
assert "adminPassword" not in second and "agentToken" not in second, "second run must not make new secrets"
assert first["projects"]["phone"]["dsn"].startswith("https://"), first["projects"]["phone"]["dsn"][:12]
print("ok   first login, two projects and a read-only token made once; second run makes nothing new")
token = first["agentToken"]
project = first["projects"]["phone"]

def call(path, body=None, headers=None, method=None):
    request = urllib.request.Request(base + path, data=body, headers=headers or {}, method=method)
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, response.headers, response.read().decode()

event = {
    "event_id": uuid.uuid4().hex,
    "timestamp": time.time(),
    "platform": "javascript",
    "level": "error",
    "exception": {"values": [{"type": "Error", "value": "prove: phone could not make its key",
        "stacktrace": {"frames": [{"filename": "app.js", "function": "makeKey", "lineno": 7, "in_app": True}]}}]},
}
status, _, _ = call("/api/%s/store/?sentry_key=%s" % (project["id"], project["publicKey"]),
    json.dumps(event).encode(), {"Content-Type": "application/json"})
assert status == 200, status
auth = {"Authorization": "Bearer " + token}
issues = []
for _ in range(30):
    _, _, text = call("/api/0/organizations/%s/issues/" % first["organization"], headers=auth)
    issues = json.loads(text)
    if issues:
        break
    time.sleep(2)
assert issues and "could not make its key" in issues[0]["title"], issues[:1]
print("ok   one fault sent and read back through the API: %s" % issues[0]["title"])

try:
    call("/api/0/organizations/%s/issues/" % first["organization"])
    raise AssertionError("issues readable without a token")
except urllib.error.HTTPError as error:
    assert error.code in (401, 403), error.code
print("ok   no token, no read")

mcp = dict(auth, **{"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
def rpc(payload, session=None):
    headers = dict(mcp)
    if session:
        headers["Mcp-Session-Id"] = session
    status, response_headers, text = call("/mcp", json.dumps(payload).encode(), headers)
    data = None
    for line in text.splitlines():
        line = line[5:].strip() if line.startswith("data:") else line.strip()
        if line.startswith("{"):
            data = json.loads(line)
    return response_headers.get("Mcp-Session-Id"), data
session, hello = rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
    "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "prove", "version": "1"}}})
assert hello and "result" in hello, hello
rpc({"jsonrpc": "2.0", "method": "notifications/initialized"}, session)
_, listing = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, session)
names = sorted(tool["name"] for tool in listing["result"]["tools"])
assert "list_issues" in names and "get_latest_event" in names, names
tool = next(t for t in listing["result"]["tools"] if t["name"] == "list_issues")
wanted = tool["inputSchema"].get("properties", {})
arguments = {}
for key in wanted:
    if key in ("organization_slug", "organization", "org_slug"):
        arguments[key] = first["organization"]
    if key in ("project_slug", "project"):
        arguments[key] = "phone"
_, found = rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
    "params": {"name": "list_issues", "arguments": arguments}}, session)
text = json.dumps(found)
assert "could not make its key" in text, (sorted(wanted), text[:400])
print("ok   the tool server lists %d tools and list_issues returns the fault" % len(names))
PY

sh backup.sh || fail "backup"
[ -s "backups/glitchtip-$(date -u +%F).dump" ] || fail "backup file"
echo "ok   backup written"
echo "memory at rest:"
docker stats --no-stream --format '  {{.Name}} {{.MemUsage}}' | grep glitchtip
$C down -v >/dev/null 2>&1
rm -rf .env backups prove.tmp
echo "PROVED"
