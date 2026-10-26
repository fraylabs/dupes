# Feedback REST and MCP

Requests and responses are JSON. Admin endpoints require a browser admin session or `Authorization: Bearer <API key>`. Browser mutations require a matching Origin. API scripts use explicit Bearer authorization. Voter sessions use an HttpOnly SameSite cookie and are distinct from admin credentials. Public reads never expose email or private-board content.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database health |
| GET | `/api/session` | Current identity, admin state, status vocabulary |
| POST | `/api/login` | `{password}` → admin cookie |
| POST | `/api/logout` | Revoke browser session |
| POST | `/api/identify` | `{name,email?}` anonymous identity, or `{token}` signed SSO |
| GET | `/api/boards`, `/api/tags` | Visible boards and tags/categories |
| GET | `/api/posts` | Filter `board`, `status`, `q`; `sort=top|new`, `limit` ≤200, `offset` |
| GET | `/api/posts/:id` | Post, visible comments, tags, own vote state; merged posts return `mergedInto` |
| POST | `/api/posts` | `{boardId,title,details?}`; voter/admin identity required |
| POST / DELETE | `/api/posts/:id/vote` | Add or remove own vote; adding twice is idempotent |
| POST | `/api/posts/:id/comments` | `{body,private?}`; admin replies marked automatically |
| GET | `/api/roadmap` | Planned, in progress, complete groups |
| GET | `/api/changelog` | Published entries; admins also see drafts |
| POST | `/api/admin/boards` | `{name,description?,private?}` |
| PATCH | `/api/admin/boards/:id` | `{name,description?,private?,privateComments?}` |
| DELETE | `/api/admin/boards/:id` | Delete an empty board |
| POST | `/api/admin/tags` | `{boardId,name,kind?:tag|category}` |
| PATCH / DELETE | `/api/admin/tags/:id` | Rename `{name}` or delete |
| PATCH | `/api/admin/posts/:id` | `{title?,details?,status?,tagIds?}` |
| DELETE | `/api/admin/posts/:id` | Delete an unreferenced post |
| POST | `/api/admin/posts/:id/merge` | `{targetId}`; same board, deduplicated known voters |
| PATCH / DELETE | `/api/admin/comments/:id` | Edit `{body,private?}` or remove a comment |
| POST | `/api/admin/changelog` | `{title,body,type?:new|improved|fixed,postIds?:[],published?:true}` |
| PATCH | `/api/admin/changelog/:id` | `{title?,body?,type?,published?}`; publishing queues linked voters |
| DELETE | `/api/admin/changelog/:id` | Remove entry and queued notifications |
| GET | `/api/admin/users` | Admin-only user directory |
| POST | `/api/admin/users` | `{name,email?,externalId?}`; starts unverified |
| PATCH / DELETE | `/api/admin/users/:id` | Edit `{name,email?}` or remove identity and votes while anonymising authored content |
| GET / POST | `/api/admin/posts/:id/votes` | List voter details or add `{userId}` |
| DELETE | `/api/admin/posts/:id/votes/:userId` | Remove an attributed vote |
| GET / POST | `/api/admin/keys` | List metadata or create `{name}`; returned token shown once |
| DELETE | `/api/admin/keys/:id` | Revoke a key |
| GET | `/api/admin/import/canny` | Hosted Canny import progress, or `null` |
| POST | `/api/admin/import/canny` | Run one import step `{apiKey, restart?}`; repeat until `done` is true |

Status values: `open`, `under review`, `planned`, `in progress`, `complete`, `closed`. Duplicate posts retain an ID with a redirect target. Known duplicate voters count once; unattributed historical vote counts add because overlap cannot be determined.

MCP: POST `/mcp` with a Bearer API key and JSON-RPC 2.0; `initialize`, `ping`, `tools/list`, `tools/call`. Notifications receive 202. No SSE stream or server-side session is required. GET returns 405. [Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

Canny importer follows the [official API reference](https://developers.canny.io/api-reference). Requests POST JSON with `apiKey`. Boards are v1 (single list). Categories/tags/posts/entries are v1 with skip/limit and `hasMore`. Users/votes/comments use their currently documented v2 lists with cursor and `hasNextPage`; votes/comments use `items`, users use `users`. A v1-only importer would miss the current documented list API for those resources. Requests are paced below the free plan minute limit; a 429 or server failure is retried once. A second failure stops before database writes.

Hosted import (`POST /api/admin/import/canny` on a hosted instance, or the Import panel in admin) runs in steps so it fits Worker limits. Each call fetches one Canny page and saves it together with the import progress in one transaction; a failed step saves nothing, so call again to continue. Send the Canny API key with every call: it is used for that request only and never stored or logged. A 429 response carries `retryAfter` seconds while Canny rate-limits. A finished import refuses a second run (409) unless you send `restart: true`, which updates existing Canny items without duplicating them. Hosted import sends your Canny data to Dupes and stores it in your hosted workspace; the self-host CLI import keeps your key and data on your own server. Agents can drive the same REST loop with an admin API key.

Import preserves board/comment privacy; categories as category tags; user IDs and contact details; posts/statuses; per-user votes plus any missing aggregate count; admin comment flags; published and draft changelog entries with post links. Media URLs, reaction counts, changelog labels and external integrations are not migrated. Entry text uses `plaintextDetails` (markdown fallback), and is rendered as plain text to prevent importing executable HTML.

Canny is a trademark of its owner. Dupes isn't affiliated with or endorsed by Canny.
