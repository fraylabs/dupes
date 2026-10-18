# dupe

One command to run a self-hostable app:

```sh
npx @dupes/cli up feedback
```

The public command is prepared but is not available from npm until the first release is published. Node 22+ is required. The CLI uses Docker if available, with a Node fallback. Persistent data stays in the current folder's `feedback-data/` (or `DATA_DIR`), outside npm's temporary package cache.

Use `npx @dupes/cli up forms` for Forms, with its own `forms-data/` folder. `dupe list`, `dupe up feedback|forms --node`, `dupe import canny`, `dupe import typeform --form FORM_ID`, and `dupe mcp feedback|forms --client codex` are also available. Hosted setup uses private `DUPES_PLATFORM_URL` and `DUPES_PLATFORM_API_KEY` environment variables. Private Worker previews require `DUPES_PREVIEW_TOKEN`; it is sent as `X-Dupes-Preview-Token` and never printed. Legacy Access credentials are also accepted when a deployment uses Access. API keys belong in the private environment, not command history.

The launcher is Apache-2.0. Bundled application source in `runtime/` is AGPL-3.0-only with its own LICENSE and notices. Third-party dependencies retain their licences. No application credentials or generated user data ship in this package.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.

Typeform is a trademark of its owner. Dupes isn't affiliated with or endorsed by Typeform.
