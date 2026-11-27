# Faults REST reference

## Sending events

`POST /api/<project number>/store/` on the platform origin, with the project's key as `?sentry_key=<key>` or in an `X-Sentry-Auth: Sentry sentry_key=<key>` header. The body is one JSON error event in the Sentry event format, which small reporters can post directly. Any origin may post. The envelope format that current official SDKs send is not accepted.

Kept from each event: `event_id`, `timestamp`, `level`, `platform`, `release`, `environment`, up to 30 `tags`, and either the last entry of `exception.values` (`type`, `value` and up to 60 stack frames with `filename`, `function`, `lineno`, `colno`, `in_app`) or a plain `message`. Every field is cut to a fixed length. Everything else, including `user`, `request`, `extra`, `contexts` and breadcrumbs, is dropped before storage.

Responses: `200 {id}` when stored, `400` for a body with no exception or message, `401` for an unknown project or key, `413` above 200 KB, `429` with `Retry-After` above the limits.

## Grouping and limits

Events with the same error type and the same nearest eight named stack frames (file and function, not line numbers) are one fault. Without a stack, the type and the message with digits and long identifiers blanked are used. A fault keeps its count, first and last time seen, first and last release, and the latest sample only: there is no per-event history. A repeat of a resolved fault reopens it.

Limits: 60 events a minute per project, 1000 distinct faults per project, 50 projects per workspace. A fault not seen for 90 days is deleted.

## Administration

All URLs below are relative to the instance URL. Routes use `Authorization: Bearer $FAULTS_API_KEY`; the page uses an HttpOnly, SameSite cookie scoped to the instance, and browser writes require the correct Origin.

- `GET /api/session`, `POST /api/login {apiKey}`, `POST /api/logout`.
- `GET /api/projects`: projects with open fault counts and DSNs. `POST /api/projects {name}`: create one.
- `GET /api/faults?status=open|resolved|all&project=<number>&limit=50&offset=0`: faults, most recently seen first; max page size 200.
- `GET /api/faults/:id`: one fault with its latest sample.
- `POST /api/faults/:id/resolve`, `POST /api/faults/:id/reopen`.
- `DELETE /api/faults/:id`: remove a fault and its count for good, for example junk. A project at its limit takes new faults again once old ones are deleted or expire.
- `POST /mcp`: stateless Streamable HTTP MCP with the same operations.

Not included: alerts, source maps, native crash reports, per-event history, teams.

Sentry is a trademark of its owner. Dupes isn't affiliated with or endorsed by Sentry.
