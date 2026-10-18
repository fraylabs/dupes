# Forms REST and import reference

All URLs are relative to the instance URL. Admin routes use `Authorization: Bearer $FORMS_API_KEY`; browser admin sessions use an HttpOnly, SameSite cookie scoped to the instance. Browser writes require the correct Origin. Private previews additionally require `X-Dupes-Preview-Token` (the CLI reads `DUPES_PREVIEW_TOKEN`); browser reviewers unlock `/_preview/login`. Keep this token separate from platform and instance keys.

## Administration

- `GET /api/session`, `POST /api/login {apiKey}`, `POST /api/logout`.
- `GET /api/forms`, `POST /api/forms <definition>`: list and create drafts.
- `GET /api/forms/:id`: draft, current publication, version and original import source (if any).
- `PUT /api/forms/:id <definition>`: save a draft; current responses/publication remain unchanged.
- `POST /api/forms/:id/publish`: validate and publish an immutable definition version.
- `POST /api/forms/:id/archive`: stop accepting responses without deleting history.
- `DELETE /api/forms/:id`: permanently remove the form, responses, versions and webhooks.
- `GET /api/forms/:id/responses?limit=100&offset=0`: private paginated responses; max page size 1000.
- `GET /api/forms/:id/responses.csv`: stream all responses present when the export starts, using stable keyset pagination. Columns cover question refs, hidden values and variables across published versions. Spreadsheet-formula prefixes are escaped.
- `POST /api/forms/import/typeform <retrieved-definition>`: validate and import as a draft. Repeat imports update the same source form's draft, never its live version or responses. No Typeform API key is sent to this endpoint.

## Definition and routing

A definition has `title`, `fields`, `hidden`, `variables`, `logic` and `thankyou_screens`. Fields have stable `ref`, `type`, `title`, `properties` and `validations`. Limits: 100 questions, 100 choices per choice field, 30 hidden fields, 1 MB request body. Supported types are short/long text, email, phone number, number, yes/no, date, website, multiple choice, dropdown, opinion scale, rating, legal and statement. Multiple-choice values are choice refs, or arrays of refs when multiple selection is enabled. Optional questions can receive null; statement continuation receives true.

Logic retains Typeform's field/hidden triggers, ordered actions, nested `and`/`or`/`not` conditions and field/hidden/variable/constant/choice operands. Supported actions are `jump`, `add`, `subtract`, `multiply`, `divide` and `set`. Conditions support always, answered/not_answered, equality, membership, text matching, numeric and date comparisons. Jumps target another field or a named/default thank-you screen. The first matching jump chooses the next path; calculations before it are retained. Routing and required answers are re-evaluated on the server. Unvisited answers aren't stored. Undefined calculations and cycles return errors.

Published versions are immutable. Submissions include their version, so a changed form requests a reload rather than silently applying a different definition. Draft edits don't change that version.

## Respondents and embeds

`GET /f/:id` serves the one-question-at-a-time form. `GET /f/:id/embed` permits embedding. Put the instance's `/embed.js` script on a site with `data-form="FORM_ID"`; optional `data-hidden='{"campaign":"spring"}'` passes hidden values. Only declared hidden keys are retained. They are untrusted respondent data, not secrets or identity claims.

- `GET /api/public/forms/:id`: current published definition and version; no draft, responses, keys or original import metadata.
- `POST /api/public/forms/:id/step {version,answers,hidden}`: validate the answered path and return the next question or ending.
- `POST /api/public/forms/:id/responses {version,submissionId,answers,hidden}`: persist a completed response. `submissionId` is a random UUID, stable across retries. Duplicate retries don't create another response or webhook job.

## Webhooks

`GET/POST /api/forms/:id/webhooks`, with POST `{url}`. Public HTTPS hostnames on port 443 only; credentials in URLs, literal IPs, local/internal names and redirects are refused. A signing secret is returned once at creation. Store it privately. `DELETE /api/forms/:id/webhooks/:hook` removes a destination and its pending deliveries.

Response and outbox jobs commit atomically. Deliveries use `X-Dupes-Delivery` and `Idempotency-Key` with a stable delivery UUID. `X-Dupes-Signature` is `sha256=` followed by base64 HMAC-SHA256 of the exact request bytes using the signing secret. Verify with a constant-time comparison and deduplicate `event_id`/delivery IDs before applying side effects. Payloads include `event_type: form_response`, form/version and response data.

Node pins validated public DNS addresses for HTTPS and sweeps pending jobs every 30 seconds. Workers use their public-internet fetch transport, background delivery on submissions and a scheduled sweeper. Don't attach private-network/VPC connectivity to this service. Failures retry with exponential backoff up to ten attempts. `GET /api/forms/:id/deliveries` exposes attempt/status metadata; `POST .../deliveries/:delivery/retry` resumes an unsent job. Delivery is at least once; a network failure can occur after a receiver accepted a request.

## Import from Typeform

Sources: [retrieve form](https://www.typeform.com/developers/create/reference/retrieve-form/), [Create API schema](https://www.typeform.com/developers/create/reference/create-form/), [logic jumps](https://www.typeform.com/developers/create/logic-jumps/), checked 19 October 2026. The local importer calls only `GET https://api.typeform.com/forms/{form_id}` with your own private token, retries a transient response once and never logs the token. Use your own Typeform API key. You're responsible for having the right to move your users' data.

Original definitions, references, logic, variables, hidden fields and endings are retained. The usable form is validated before any write; it doesn't silently discard logic. Unsupported cases currently include grouped/matrix/file-upload/payment/picture-choice questions, other-choice inputs, outcome/evaluation actions and external media/theme presentation. Import fails clearly for unsupported question/logic constructs; source media and brand styling aren't rendered. This imports definitions, not historical responses. Don't run a real migration until the supported paths have been checked in your running instance.

Typeform is a trademark of its owner. Dupes isn't affiliated with or endorsed by Typeform.
