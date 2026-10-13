# Dupes

Self-hostable alternatives to paid tools. The first is **Feedback**: boards, votes, comments, roadmap and changelog, with REST and MCP built in.

From a checkout, run one command:

```sh
node packages/cli/bin/dupe.mjs up feedback
```

Open http://localhost:3000. The command uses Docker when its daemon is available; otherwise it prepares Node dependencies and starts the same app. Node 22+ is required for the CLI. `--node` explicitly selects Node. After `npm ci`, `npx dupe` is available as the workspace binary. No registry package or image has been published.

Data lives in `./data`: one SQLite database and the private `admin-password` file. Read the password locally and sign in at `/admin`; it is never logged. Alternatively set a private `ADMIN_PASSWORD` (12+ characters) on the first start. Subsequent starts retain the stored password hash. Keep the data directory private, and back it up with SQLite's backup API or while the service is stopped. Restore the complete directory before starting.

```sh
node packages/cli/bin/dupe.mjs list
node packages/cli/bin/dupe.mjs import canny --fixture fixtures/canny.json
node packages/cli/bin/dupe.mjs mcp feedback --client codex
```

For a real migration, set `CANNY_API_KEY` privately and run `dupe import canny`. `--key <key>` is also supported, but environment injection avoids shell history. Stop the service and back up its database before migrating real data. Importing the same snapshot again does not duplicate posts or votes. Once imported posts are merged locally, reimport is refused to avoid resurrecting their votes; use a fresh database or a pre-merge backup. It is a migration, not a continuous sync: records removed at Canny are not deleted locally. Unsupported statuses or unavailable endpoints fail without applying a partial import. Aggregate votes missing voter details remain as a count; they cannot be individually attributed or notified.

Create an API key in Admin → Agent & API access. Configure `FEEDBACK_API_KEY` in the agent's private environment. `dupe mcp feedback --client claude|codex|cursor` prints client configuration using an environment reference, never the key. MCP uses authenticated Streamable HTTP at `/mcp`. See [REST API](dupes/feedback/API.md) and [agent setup](dupes/feedback/AGENTS.md).

Configuration: `DATA_DIR`, `PORT`, `HOST`, `PUBLIC_ORIGIN`, `SITE_NAME`, `ADMIN_PASSWORD`, `SSO_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`. Node binds to loopback by default; Docker exposes loopback by default. Set `HOST=0.0.0.0` for a deliberate network deployment and terminate HTTPS at a reverse proxy. Set `PUBLIC_ORIGIN` to the externally visible origin so browser writes pass origin validation. API keys have full admin access and can be revoked.

Anonymous visitors provide a name and optional contact email. Their identity belongs to their browser session, not to ownership of an email address. They cannot claim an imported user's votes by entering that user's email. Signed SSO uses an HS256 JWT with `aud: "feedback"`, `sub`, `name`, optional `email`, and a short `exp`. The server signing that token must verify the user's identity and email. Configure `SSO_SECRET` privately. Imported users' Canny `userID` is retained as the SSO subject. Admin rights are never taken from voter JWTs.

Optional email: configure your own Resend account with `RESEND_API_KEY` and verified `EMAIL_FROM`. Publishing a linked changelog queues one notification per identified voter. The worker sends only to SSO-verified addresses, every 30 seconds, with a provider idempotency key. Anonymous and imported contact emails stay unverified until signed SSO identifies them. No email is sent during import. Delivery credentials and a real delivery have not been exercised by the fixture proof.

Embed `<script src="https://your-feedback-host/widget.js" defer></script>` in a website to add the public feedback panel. The widget uses its own origin's browser session. Sites may require allowing the script and frame in their own CSP.

The core has no Node imports. SQLite runs through Drizzle; `d1-storage.ts` supplies the future D1 adapter, but Workers deployment, durable rate limits and hosted multitenancy are not shipped. Changelog content is safely rendered as plain text. Rich media, integrations, Canny analytics and email-based account recovery are outside this first release.

Verification runs on a fresh checkout on Linux: `npm run check`, then `npm run prove`. The proof starts the real CLI and service, imports the fixture twice, checks voting, privacy, SSO, merging and every MCP tool, and captures public and admin UI screenshots. It uses disposable data and never logs credentials.
