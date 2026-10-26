# dupe

One command to run a self-hostable app:

```sh
npx @dupes/cli up feedback
```

Node 22+ is required. The CLI uses Docker if available, with a Node fallback. Persistent data stays in the current folder's `feedback-data/` (or `DATA_DIR`), outside npm's temporary package cache.

Use `npx @dupes/cli up forms` for Forms, with its own `forms-data/` folder. `dupe list`, `dupe up feedback|forms --node`, `dupe import canny`, `dupe import typeform --form FORM_ID`, and `dupe mcp feedback|forms --client codex` are also available. Hosted setup uses private `DUPES_PLATFORM_URL` and `DUPES_PLATFORM_API_KEY` environment variables. API keys belong in the private environment, not command history.

The launcher is Apache-2.0. Bundled application source in `runtime/` is AGPL-3.0-only with its own LICENSE and notices. Third-party dependencies retain their licences. No application credentials or generated user data ship in this package.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.

Typeform is a trademark of its owner. Dupes isn't affiliated with or endorsed by Typeform.

`dupe ls` lists hosted Feedback and Forms together using your platform environment. `dupe mcp workspace --client claude|codex|cursor` prints one agent configuration for all owned instances plus cross-app search. It references `DUPES_PLATFORM_API_KEY` privately; per-instance MCP configurations still work. See the platform workspace documentation for app-prefixed tool names and instance scoping.
