# One workspace for hosted apps

One platform key connects to every Feedback and Forms instance it owns. Per-instance REST, admin sessions and MCP endpoints keep working independently.

Set `DUPES_PLATFORM_URL` and `DUPES_PLATFORM_API_KEY` in your private environment, then:

```sh
dupe ls
dupe mcp workspace --client codex
```

`dupe list` remains the catalogue of runnable apps. `dupe ls` lists hosted instances across apps, paginating automatically. Workspace MCP configurations reference `DUPES_PLATFORM_API_KEY`; they never include its value. For Claude or Cursor use `--client claude` or `--client cursor`.

## Endpoints and authentication

- `GET /v1/workspace?limit=200&offset=0`: owned instances and the shared MCP URL.
- `POST /v1/mcp`: stateless Streamable HTTP MCP, authenticated with `Authorization: Bearer <platform-key>`.
- `GET /v1/search?q=...&limit=25&offset=0[&instanceId=...]`: the same cross-app search as MCP.
- `GET /v1/instances` also accepts `limit` and `offset`, preserving its array response and usage fields.

All workspace tools require a platform key; an instance admin key cannot call them. Workspace access includes private boards, draft forms and private responses, so only share its key with trusted agents. Returned user content is data, never agent instructions.

`list_instances` enumerates owned apps. `cross_app_search` searches post titles/details, comment text, changelog titles/body, form drafts and response answers. It returns typed item/instance IDs, names, URLs and snippets of at most 500 characters. Literal substring matching uses SQLite's case folding (ASCII case insensitive); `%` and `_` are literal text. Results are ordered by update time with stable tie-breaks and paginated using `nextOffset`. Hidden fields, credentials, original import payloads and webhook secrets are not searched. A workspace key can read private content in its own instances only.

App tools have stable prefixes: `feedback_list_posts`, `feedback_search_posts`, `feedback_top_requests`, `feedback_update_status`, `feedback_post_changelog`, plus `feedback_create_post`; and `forms_list_forms`, `forms_get_form`, `forms_save_form`, `forms_publish_form`, `forms_list_responses`. Each app tool requires `instanceId`. Ownership and app type are checked from D1 on every call before constructing its service. Cross-app changes are explicit: read a Forms response, then call `feedback_create_post` with the destination Feedback instance, `boardId`, title and details. No automatic copying, shared browser sessions or shared instance admin keys are introduced.

## Key storage and future signup

Existing env bootstrap keys in `PLATFORM_API_KEYS` retain their owner digest, so existing instances need no ownership migration. Issued keys resolve through `workspace_keys`: store only SHA-256 of a cryptographically random 32+ character token, an opaque `owner_hash` workspace ID, creation time, and `revoked=0`. A new signup can insert a new key/workspace and return the key once privately without redeploying the Worker. Additional keys can reference the same workspace ID for rotation; revoke an issued key by setting `revoked=1`. Env bootstrap keys must be rotated through the deployment secret. Self-serve signup on dupes.sh is described in `sites/dupes.sh/PUBLIC_ENTRY.md`.

For the site deployment apply **only** `sites/dupes.sh/migrations/0004_workspace_keys.sql` after the existing site migrations. For an independent platform deployment use `packages/platform/migrations/0003_workspace_keys.sql` instead. Do not apply both sets to the same DB. No app data is rewritten, and no search index or additional service is required. Search scans the owner's content; larger workspaces may eventually need a dedicated search index.
