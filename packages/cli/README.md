# dupe

One command to run a self-hostable app:

```sh
npx @dupes/cli up feedback
```

The public command is prepared but is not available from npm until the first release is published. Node 22+ is required. The CLI uses Docker if available, with a Node fallback. Persistent data stays in the current folder's `feedback-data/` (or `DATA_DIR`), outside npm's temporary package cache.

`dupe list`, `dupe up feedback --node`, `dupe import canny`, and `dupe mcp feedback --client codex` are also available. Hosted setup uses private `DUPES_PLATFORM_URL` and `DUPES_PLATFORM_API_KEY` environment variables. Access-protected previews additionally support `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`; these are never printed. API keys belong in the private environment, not command history.

The launcher is Apache-2.0. Bundled application source in `runtime/` is AGPL-3.0-only with its own LICENSE and notices. Third-party dependencies retain their licences. No application credentials or generated user data ship in this package.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.
