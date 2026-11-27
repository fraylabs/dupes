# GlitchTip, hosted

[GlitchTip](https://glitchtip.com) collects errors from apps and services. It is open source (MIT) and takes reports from the Sentry SDKs, so an app only needs a GlitchTip address (a DSN) to start reporting. It also ships a tool server (`/mcp`) that lets coding agents list and read errors.

This folder is everything needed to run it on one small Linux server. Nothing in the app is changed: it runs from the makers' own image.

| File | What it does |
| --- | --- |
| `compose.yml` | GlitchTip, Postgres and an HTTPS proxy. No Valkey; Postgres carries the queue. |
| `Caddyfile` | HTTPS with an automatic certificate. |
| `setup.sh` | Installs Docker, starts the app, makes the first login, projects and a read-only token for agents, and turns on a daily backup. |
| `bootstrap.py` | The first-login step, run inside the app's own shell. Running it again changes nothing. |
| `backup.sh` | One database dump a day, seven kept. |
| `check.sh` | Health check from anywhere. |
| `prove.sh` | Brings all of it up on one machine with made-up values, sends one error, reads it back through the API and the tool server, takes a backup and removes what it made. It uses its own project name and refuses to run where a `.env` exists. |

## Size

At rest the app and its database use about 260 MB of memory (`prove.sh` prints the figure; the proxy adds a little), so a 1 GB server holds it. The makers say one million events a month may need 30 GB of disk.

## Set up

Point a DNS record for the host name at the server, then on the server, as root:

```sh
git clone https://github.com/fraylabs/dupes && cd dupes/hosting/glitchtip
sh setup.sh faults.example.com reports@example.com scout@example.com example-org phone,desktop
sh check.sh faults.example.com
```

`credentials.json` (readable by root only) then holds the first login, each project's DSN and the agents' token. Move them to wherever you keep secrets and delete the file.

Sign-up is closed (`ENABLE_USER_REGISTRATION` is off). Outgoing mail is off until `EMAIL_URL` is set in `.env`.

## Agents

```sh
claude mcp add --transport http glitchtip https://faults.example.com/mcp --header "Authorization: Bearer <token>"
```

The token made by `setup.sh` can read organisations, projects, issues and events. It cannot change anything.

## Upgrade

```sh
docker compose pull && docker compose up -d
```

Database changes apply on start. Check the makers' blog before moving to a new major version.

GlitchTip is its makers' project. Dupes isn't affiliated with or endorsed by GlitchTip.
