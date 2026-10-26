# Dupes

Self-hostable alternatives to paid tools. **Feedback** brings boards, votes, comments, roadmap and changelog. **Forms** brings one-question-at-a-time forms, branching, hidden fields, responses/CSV and signed webhooks. Both have REST, MCP, self-hosted SQLite and hosted D1 modes.

The prepared public install is one command (npm publication is pending):

```sh
npx @dupes/cli up feedback
```

For the current private checkout, use `node packages/cli/bin/dupe.mjs up feedback`. Release preparation and publication gates are documented in [RELEASING.md](RELEASING.md).

Open http://localhost:3000. The command uses Docker when its daemon is available; otherwise it prepares Node dependencies and starts the same app. Node 22+ is required for the CLI. `--node` explicitly selects Node. After `npm ci`, `npx dupe` is available as the workspace binary. No registry package or image has been published.

The packaged CLI stores Feedback data in `./feedback-data/`; the source checkout uses `./data`. Inside:  one SQLite database and the private `admin-password` file. Read the password locally and sign in at `/admin`; it is never logged. Alternatively set a private `ADMIN_PASSWORD` (12+ characters) on the first start. Subsequent starts retain the stored password hash. Keep the data directory private, and back it up with SQLite's backup API or while the service is stopped. Restore the complete directory before starting.

```sh
node packages/cli/bin/dupe.mjs list
node packages/cli/bin/dupe.mjs import canny --fixture fixtures/canny.json
node packages/cli/bin/dupe.mjs mcp feedback --client codex
```

For a real migration, set `CANNY_API_KEY` privately and run `dupe import canny`. `--key <key>` is also supported, but environment injection avoids shell history. Stop the service and back up its database before migrating real data. Importing the same snapshot again does not duplicate posts or votes. Once imported posts are merged locally, reimport is refused to avoid resurrecting their votes; use a fresh database or a pre-merge backup. It is a migration, not a continuous sync: records removed at Canny are not deleted locally. Unsupported statuses or unavailable endpoints fail without applying a partial import. Aggregate votes missing voter details remain as a count; they cannot be individually attributed or notified. Hosted workspaces import from the admin page (or `POST /api/admin/import/canny`, repeated until done); that sends your Canny data to Dupes, while the CLI import keeps it on your server.

Create an API key in Admin → Agent & API access. Configure `FEEDBACK_API_KEY` in the agent's private environment. `dupe mcp feedback --client claude|codex|cursor` prints client configuration using an environment reference, never the key. MCP uses authenticated Streamable HTTP at `/mcp`. See [REST API](dupes/feedback/API.md) and [agent setup](dupes/feedback/AGENTS.md).

Configuration: `DATA_DIR`, `PORT`, `HOST`, `PUBLIC_ORIGIN`, `SITE_NAME`, `ADMIN_PASSWORD`, `SSO_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`. Node binds to loopback by default; Docker exposes loopback by default. Set `HOST=0.0.0.0` for a deliberate network deployment and terminate HTTPS at a reverse proxy. Set `PUBLIC_ORIGIN` to the externally visible origin so browser writes pass origin validation. API keys have full admin access and can be revoked.

Anonymous visitors provide a name and optional contact email. Their identity belongs to their browser session, not to ownership of an email address. They cannot claim an imported user's votes by entering that user's email. Signed SSO uses an HS256 JWT with `aud: "feedback"`, `sub`, `name`, optional `email`, and a short `exp`. The server signing that token must verify the user's identity and email. Configure `SSO_SECRET` privately. Imported users' Canny `userID` is retained as the SSO subject. Admin rights are never taken from voter JWTs.

Optional email: configure your own Resend account with `RESEND_API_KEY` and verified `EMAIL_FROM`. Publishing a linked changelog queues one notification per identified voter. The worker sends only to SSO-verified addresses, every 30 seconds, with a provider idempotency key. Anonymous and imported contact emails stay unverified until signed SSO identifies them. No email is sent during import. Delivery credentials and a real delivery have not been exercised by the fixture proof.

Embed `<script src="https://your-feedback-host/widget.js" defer></script>` in a website to add the public feedback panel. The widget uses its own origin's browser session. Sites may require allowing the script and frame in their own CSP.

The core has no Node imports. SQLite and D1 run through Drizzle. Hosted instances share a D1 database with tenant-scoped reads and writes, composite keys and foreign keys. Private Workers previews require a separate preview gate; durable public abuse limits are still future work. Changelog content is safely rendered as plain text. Rich media, integrations, Canny analytics and email-based account recovery are outside this first release.

The existing Feedback proof scripts document earlier verification. Current feature checks use a running instance and synthetic data. Use `npm run check` during a normal build; never put credentials in logs.

## Forms

The prepared public command is `npx @dupes/cli up forms` (publication pending). From this checkout use `node packages/cli/bin/dupe.mjs up forms`. Data lives in `forms-data/` for the packaged CLI or `data/forms/` from source. Open `/admin` and use the private `admin-api-key` file, or configure `ADMIN_API_KEY` on first start.

Build questions, add branching rules, save a draft and explicitly publish. Published definitions are immutable versions; submissions, hidden values and calculations are validated on the server. Export all responses to CSV or connect a signed, retried webhook. Public form links and the embed script collect responses without an account. Keep personal data private and configure appropriate retention for your use.

`dupe import typeform --form FORM_ID` uses your private `TYPEFORM_API_KEY` to retrieve a definition, including supported nested logic, jumps and calculations. `--fixture fixtures/typeform.json` uses the included example. Imports stay in draft. Unsupported constructs fail before writing rather than dropping logic. This imports definitions, not response history or third-party presentation. See [Forms API](dupes/forms/API.md) and [Forms agent setup](dupes/forms/AGENTS.md).

`dupe mcp forms --client codex --url <instance-url>` uses `FORMS_API_KEY` and exposes five tools for listing, reading, editing, publishing and reading responses. Hosted provisioning accepts `app: "forms"` as well as `"feedback"`.

Typeform is a trademark of its owner. Dupes isn't affiliated with or endorsed by Typeform.

## Hosted platform (local development)

After `npm ci`, put a private `PLATFORM_API_KEYS` value (32+ characters; comma-separated keys represent separate owners) in `packages/platform/.dev.vars`. Keep it out of Git. Run:

```sh
npx wrangler d1 migrations apply dupes-platform-local --local --config packages/platform/wrangler.jsonc
npx wrangler dev --local --config packages/platform/wrangler.jsonc
```

The platform API uses a platform Bearer key. `POST /v1/instances` with `{ "app": "feedback", "name": "My workspace" }` returns `url`, `adminUrl`, `adminApiKey`, and `mcpEndpoint`. Save the returned key privately: it is returned only at creation. `GET /v1/instances`, `GET /v1/instances/:id`, and `DELETE /v1/instances/:id` operate only on that key's instances. Deletion permanently removes the instance's content and credentials. Usage includes requests and logical UTF-8 storage bytes, excluding shared indexes and page overhead.

Set `DUPES_PLATFORM_URL` and `DUPES_PLATFORM_API_KEY` privately, then run `dupe up feedback --hosted --name "My workspace"`. The CLI saves the result in a mode-0600 file in `data/`, prints URLs and the file path, and keeps keys out of stdout. Use the returned admin key to sign in or authenticate instance REST/MCP calls. `dupe mcp feedback --url <instance-url>` prints agent configuration. HTTPS is required except for local development. Private previews additionally require `DUPES_PREVIEW_TOKEN` in the CLI environment, or the `X-Dupes-Preview-Token` header for direct API calls; browsers unlock `/_preview/login`. The preview token does not replace the platform or instance key.

The earlier `prove:hosted` script documents local Wrangler/workerd verification. Current features are checked in a real running instance. Local configuration uses a placeholder D1 ID; it does not provision or deploy Cloudflare resources. Hosted email delivery is not configured; the optional Resend sender currently runs in self-hosted Node mode.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.

The original apps and platform are AGPL-3.0-only; the CLI is Apache-2.0. See LICENSE, packages/cli/LICENSE and TRADEMARKS.md. The website is in sites/dupes.sh.

## One hosted workspace

A platform key owns Feedback and Forms together. Use `dupe ls` to list its instances, and `dupe mcp workspace --client codex` to connect an agent once. The shared `/v1/mcp` provides app tools plus cross-app search, including private responses. Each call checks instance ownership; per-instance endpoints remain available. D1-issued keys support future self-serve signup without environment changes. See [workspace API and key storage](packages/platform/WORKSPACE.md).
