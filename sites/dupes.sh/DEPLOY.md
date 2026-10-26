# Deploying dupes.sh

Deploy one site Worker and one D1 database. Do not deploy a second platform Worker: the site forwards `/v1/*` and `/i/*` to the platform in process. The `next-dupe` and `demo` Feedback tenants, the waitlist, other Feedback tenants and Forms tenants all use the same `DB` binding. `ASSETS` serves this site's `public/` directory with `run_worker_first: true`.

## Deployment configuration

Create a private deployment config beside `wrangler.jsonc` so relative paths resolve to the same source, assets and migrations. Keep the tracked local config's placeholder database ID unchanged. In the private config:

- Keep `main: "src/worker.ts"`, compatibility date `2026-10-13`, the `ASSETS` settings and `triggers.crons: ["* * * * *"]` (webhook retries, demo reset, counter expiry).
- Set your Worker name, and replace only the `DB` entry's database name and ID with your real D1 database. Keep `binding: "DB"` and `migrations_dir: "migrations"`.
- Set `PUBLIC_ORIGIN` to the exact HTTPS origin, with no trailing slash. It controls links and browser Origin checks.
- Same-zone Worker webhook destinations need explicit routing: add a service binding `WEBHOOK_RECEIVER` and set `WEBHOOK_RECEIVER_ORIGIN` to that Worker's exact HTTPS origin. Only that origin uses the binding; other destinations use normal fetch. See the [fetch documentation](https://developers.cloudflare.com/workers/runtime-apis/fetch/).
- Configure secrets `PLATFORM_API_KEYS` (comma-separated, 32+ characters each; each key is a separate owner) and `ABUSE_SECRET` (32+ random characters) with `wrangler secret put`. Never put values in config, arguments, source or logs. Optional `SSO_SECRET` is needed only for signed Feedback SSO.

## Migrations

Apply only unapplied site migrations, in order (`0001_platform.sql` to `0007_powered_by.sql`), with Wrangler's D1 migration state. The site set replaces `packages/platform/migrations`, which is for a standalone platform Worker; never apply both to one database, and never replay seed SQL by hand.

## Feedback admin bootstrap

New Feedback instances need no database bootstrap. Authenticated `POST /v1/instances` with `{"app":"feedback","name":"My workspace"}` atomically provisions an instance and its initial admin API key; save it privately. At `<instance-url>/admin`, enter that key in the password field. Direct REST/MCP uses `Authorization: Bearer <instance-admin-key>`. Forms works the same way with `app: "forms"`.

The preseeded `/i/next-dupe` instance needs a one-time claim:

1. Inspect its `owner_hash` and its `hosted_credentials` rows. If it is already claimed or an API credential exists, reuse the existing credential.
2. Generate the Feedback admin key privately and store it before writing D1. Compute lowercase hexadecimal SHA-256 hashes of this key and of the platform owner key (UTF-8 bytes, no salt).
3. In one D1 batch, conditionally replace `instances.owner_hash='unclaimed-dogfood'` for `id='next-dupe'` with the platform key hash, and insert one `hosted_credentials` row for that tenant with a random UUID `id`, a descriptive `name`, the admin key hash, `kind='api'`, and null `user_id`/`expires`. Guard the insert on the expected owner hash and on no existing API credential. Bind values as query parameters; never interpolate secrets into SQL.
4. Read back only owner-hash agreement and credential counts, then check login and an admin API request. Never log raw keys or hashes.

Public demo, signup and abuse limits are described in [PUBLIC_ENTRY.md](PUBLIC_ENTRY.md); workspace keys and shared MCP in `packages/platform/WORKSPACE.md`.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.
