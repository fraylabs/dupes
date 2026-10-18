# Private preview deployment

Deploy one site Worker and one shared D1 database. Do not deploy a second platform Worker: the site already forwards `/v1/*` and `/i/*` to the platform in process. The `next-dupe` Feedback tenant, waitlist, other Feedback tenants and Forms tenants all use the same `DB` binding. `ASSETS` serves this site's `public/` directory, with `run_worker_first: true` so the private gate runs before every asset request.

Infrastructure owns Cloudflare resource changes. Reconcile existing Worker/database/migration state before writing. Reuse the isolated preview database already created; do not create a replacement database or enable Access/Zero Trust. Email is skipped. A workers.dev URL is sufficient for the first private preview; custom-domain/DNS work is a separate infrastructure step.

## Deployment configuration

Create a private deployment config beside `wrangler.jsonc` so relative paths resolve to the same source, assets and migrations. Keep the tracked local config's placeholder database ID unchanged. In the private config:

- Keep `main: "src/worker.ts"`, compatibility date `2026-10-13`, and the existing `ASSETS` settings.
- Keep `compatibility_flags: ["global_fetch_strictly_public"]`. Outbound webhook fetches must use public routing, including destinations hosted on Workers in the same zone/account. Without this flag, same-zone fetch bypasses Worker routing and can return 404 before the receiver runs. See the [official fetch documentation](https://developers.cloudflare.com/workers/runtime-apis/fetch/) and [compatibility flag reference](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).
- Set the intended private preview Worker name.
- Replace only the `DB` entry's database name and database ID with the reconciled real preview database. Keep `binding: "DB"` and `migrations_dir: "migrations"`.
- Set `PUBLIC_ORIGIN` to the exact HTTPS preview origin, with no trailing slash. It controls links and browser Origin checks.
- The Forms integration needs `triggers.crons: ["* * * * *"]` for durable webhook retries. The gate-only commit does not need a cron trigger.
- Configure secret bindings `PREVIEW_TOKEN` and `PLATFORM_API_KEYS` privately. Do not put values in config, arguments, source or logs. `PREVIEW_TOKEN` must be at least 32 random characters; use a value no longer than 200 characters. Each platform key must also be at least 32 characters. Comma-separated platform keys represent distinct owners.
- Optional `SSO_SECRET` is needed only if signed Feedback SSO is used. Do not configure mail credentials for this preview.

Use the existing `/fray-operations/dupes/preview/` vault prefix for the preview token, platform key and Feedback admin key. The Worker secret is named `PLATFORM_API_KEYS` (plural); a vault item may be named `PLATFORM_API_KEY` (singular). These credentials have different purposes and must be distinct.

## Migration sequence

Apply only unapplied migrations, in order, using the private config and the real remote D1 database:

1. `0001_platform.sql`: instance registry plus shared Feedback tenant tables.
2. `0002_site.sql`: waitlist, `next-dupe` Feedback instance, candidate board and eight candidate posts. It deliberately creates no admin credential.
3. `0003_forms.sql`: Forms tables and indexes. Apply this before deploying Forms-capable source. It is additive and does not modify Feedback data.

The full Forms site migration set replaces the need to run `packages/platform/migrations` separately. Those are for a standalone platform deployment; applying both sets would duplicate the platform migration. Track applied migration names with Wrangler/D1 migration state; never replay site seed SQL blindly.

Build/typecheck in the normal deployment workflow. Do not create proof runs or fresh-install VMs. Upload/deploy the pinned source with assets and bindings, configure secrets before enabling the preview, then verify the actual service. A missing preview secret fails closed with 503.

## Feedback admin bootstrap

New ordinary Feedback instances need no database bootstrap. Authenticated `POST /v1/instances` with `{"app":"feedback","name":"Private workspace"}` atomically provisions an instance and its initial admin API key. Save the returned key privately. At `<instance-url>/admin`, enter that key in the password field; hosted login exchanges it for a scoped admin cookie. Direct REST/MCP uses `Authorization: Bearer <instance-admin-key>`. `ADMIN_PASSWORD` is a self-hosted Node bootstrap setting and is not a hosted Worker secret.

The preseeded `/i/next-dupe` dogfood instance needs a one-time explicit claim:

1. Inspect its `owner_hash` and its `hosted_credentials` rows. If already claimed or an API credential exists, reconcile/reuse the existing vault credential. Do not rotate or add a second bootstrap key on a retry.
2. Generate the Feedback admin key privately and store it in the agreed vault item before writing D1. Compute lowercase hexadecimal SHA-256 hashes of both this key and the chosen platform owner key, using UTF-8 bytes. No password salt/PBKDF is involved for API keys.
3. In a D1 atomic batch, conditionally replace `instances.owner_hash='unclaimed-dogfood'` for `id='next-dupe'` with the platform key hash, and insert one `hosted_credentials` row for that tenant with a random UUID `id`, a descriptive `name`, the admin key hash, `kind='api'`, and null `user_id`/`expires`. Guard the insert on the expected owner hash and absence of an existing API credential. Bind values as query parameters; never interpolate secrets into SQL.
4. Read back only owner-hash agreement and credential counts, then check login and a private admin API request. Do not return raw keys or credential hashes in chat/logs. If a write result is uncertain, inspect state before retrying.

Forms provisioning uses the same platform endpoint with `app: "forms"`. Its admin sign-in accepts the returned API key at `/admin`; no extra Worker secret or seed is required.

## Gate and app verification

An unauthenticated API/health/asset request returns 401. Browser GETs accepting HTML redirect to `/_preview/login`. That login page is intentionally reachable without a token; wrong token returns 401, missing/wrong Origin returns 403, and a valid form submission returns 303 with an eight-hour HttpOnly, Secure, SameSite=Strict signed cookie.

API clients send `X-Dupes-Preview-Token`; this gate token never replaces platform or instance Bearer authentication. The CLI reads it from `DUPES_PREVIEW_TOKEN`. Browser reviewers enter it into the private login form. Verify both header and browser-cookie flows on the running preview, then check public board pages, admin login, waitlist and separate platform provisioning. Use only synthetic data for Forms branches, responses, CSV, embeds and webhooks. Never log returned provisioning keys.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.
