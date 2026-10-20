# Source counts

One site migration, `0005_source_counts.sql`, adds `site_daily_visits` with primary key `(day,path,source)` and adds `source` to existing waitlist rows. Existing signups are marked `unknown`; attribution is not invented retroactively. Apply site migrations before deploying this source. No standalone-platform migration is needed: these are website-wide counts, not app content.

Successful HTML GETs increment one UTC daily aggregate. HEAD, assets, JSON APIs, errors, redirects, blank UAs, known bot/automation UAs and prefetch/prerender requests are excluded. No IP, raw UA, timestamped visitor event, cookie or visitor identifier is stored. Reloads count again: this measures page views, not unique people, verified humans or installs. UA filtering is a heuristic, not proof that a request is human.

Sources are `utm_source`, otherwise the referrer hostname, otherwise `direct`. Categories are lowercase, at most 80 characters, with letters, numbers, dots, underscores and hyphens; whitespace becomes hyphens. Invalid categories and IP literals are discarded. Query strings and referrer paths are not stored. App/instance/form/post identifiers are collapsed to route placeholders in counted paths. Each page view uses its request's source; internal navigation without a campaign parameter can therefore appear under the site's own hostname.

The site script saves only a landing-source category in tab session storage, preserving it on internal navigation for the waitlist submission. A new campaign or external entry resets the category. There is no visitor ID or source cookie. If session storage is unavailable, the current page's server-supplied category is used. The API normalizes the submitted category again before saving it. Duplicate email signups retain their first row/source; honeypots create no signup. Deleting the waitlist entry removes its email and source from signup reports. Anonymous daily view totals stay aggregated.

## Read stats

```http
GET /v1/stats?from=2026-10-20&to=2026-10-26
Authorization: Bearer <platform-key>
```

This site-only endpoint accepts the existing bootstrap or D1-issued platform keys. It returns global aggregate website metrics, never email addresses, per-visitor records or raw credentials. Instance API keys cannot authenticate it.

Response: `{from,to,timezone:'UTC',metric,visits:[{day,path,source,views}],signups:[{day,source,signups}],nextOffset}`. Default range is the last 30 UTC days. The inclusive range may span up to 366 days. `source` optionally filters one category; `limit` defaults to 200, maximum 1000; `offset` paginates both arrays. Continue while `nextOffset` is non-null and concatenate each array separately. Signups are **current waitlist entries by original signup day**, not an immutable all-time conversion counter.

Page counting fails open if the aggregate write is unavailable: the page still serves, and a generic error without visitor data is logged. Check D1 health if counts appear incomplete. Client-supplied UTM/source labels and referrers can be spoofed; these are directional tactic metrics, not billing or security evidence.

## Verify on the running site

Use a synthetic human-like UA to request `/?utm_source=test`, then read authenticated stats filtered to `source=test` and confirm today's `/` count increases. A bot-UA GET, HEAD and asset request with that label must not increase it. Verify a synthetic waitlist signup carries the landing category across internal navigation, repeat submission does not duplicate it, and removal clears the signup. Delete only the tagged test aggregate rows through Infrastructure, then verify no `source=test` rows remain. Do not reset real traffic or store credentials in evidence. No proof VM or fresh install is required.
