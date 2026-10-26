# Demo and self-serve hosted entry

`/demo` is a reserved Feedback tenant (`demo`) with original fictional sample requests, comments, vote totals, roadmap and releases. No operator credential or reset endpoint is exposed. Posting, voting and commenting automatically establish a temporary browser voter, without email or account signup. The banner marks all data public and temporary. `/i/demo/*` uses the same limits and app; it is not a bypass.

The existing minute cron resets only the demo at the first invocation of each UTC day. A day/token claim and every seed/delete run in one D1 batch; concurrent callers cannot double-seed. A request can also initialize/reset the demo if cron has not yet done so. All demo identities and credentials are reset too. Other tenants are untouched. Expired abuse counters are removed by cron.

`/signup` accepts email, a honeypot and a landing source. Email is unverified contact information: there is no mail delivery, email login or email recovery. Reusing an email creates an independent workspace, never access to its previous workspace. The response shows a new platform key once; only its SHA-256 hash is stored. The browser masks it, keeps it only in document memory, and clears it on leaving. Save it before opening an app. No signup key is put in browser storage, a URL or analytics. The separate instance admin key is masked and shown once too.

A workspace may have one instance, across Feedback and Forms. The count-and-insert and conditional seed/credential writes share an atomic D1 batch, including concurrent browser and CLI requests. A losing call returns 409 and makes no orphan credentials. Existing instances are preserved. Delete an existing instance before replacing it. Both `POST /v1/instances` and `dupe up feedback --hosted` use this policy.

## Deployment

Apply only **site `0006_public_entry.sql`**, after existing 0001–0005, to the existing combined site Worker database. Do not also apply `packages/platform/migrations/0004_public_entry.sql`; that is the alternative for a standalone platform Worker. New tables are `public_rate_limits`, `workspace_signups`, and `demo_state`. Existing data is unchanged.

Generate one random secret of at least 32 characters privately, store it in your secret manager, and configure the same Worker secret binding `ABUSE_SECRET`. Reuse it on subsequent deployments. Never put it in tracked config, arguments or logs. Existing DB/ASSETS/PLATFORM_API_KEYS/PUBLIC_ORIGIN/routes/minute cron remain. Demo and signup protection fails closed with 503 without the secret or Cloudflare's connecting-address header. Do not add Access, mail, billing changes or a second Worker.

Limits use HMAC-SHA256 bucket labels derived from a Cloudflare-supplied connecting address (and separately signup email), action and fixed window. Raw addresses are not stored; the normal workspace contact email is private signup metadata. No X-Forwarded-For is trusted. Demo reads: 300/minute; demo writes: 30/hour; signup attempts: 5/hour/network and 2/day/email. Counters expire within a day. Demo requests are capped at 32 KiB; a daily content ceiling additionally limits public demo growth. These abuse counters are separate from identifier-free aggregate analytics.

`GET /v1/stats` now accepts only an operator bootstrap key from PLATFORM_API_KEYS. Public workspace keys have no access to global metrics. It adds `hostedSignups`, separate from existing waitlist `signups`, grouped by creation day and source. Deleting synthetic signup metadata removes its contribution.

## Check on the live service

Verify demo posts/votes/comments without a signup, roadmap/changelog and the daily-reset banner. Check demo seed state and UTC day through private database readback; do not force an early reset of visitor data. Verify signup creates a private key once, browser Feedback creation works, and concurrent Feedback/Forms creates produce one 201 and one 409. Confirm honeypot, Origin and rate rejections, issued-key workspace ownership and operator-only metrics. Use synthetic contact data, then delete synthetic instances and only their workspace/signup rows, demo content/identities and tagged visit aggregates. Preserve samples, real users, unrelated counters and production keys.
