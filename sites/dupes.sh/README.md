# dupes.sh private preview

Six pages: home, catalogue, vote, hosted waitlist, docs and waitlist privacy. Calm original styling, original Feedback proof screenshots, and credited community source links. `community-licences.json` records pinned MIT/Apache-2.0 licence files for ArtCraft and eight Crafting Apps; no community code or logos are bundled.

From the monorepo root after `npm ci`:

```sh
npx wrangler d1 migrations apply dupes-site-local --local --config sites/dupes.sh/wrangler.jsonc
npx wrangler dev --local --config sites/dupes.sh/wrangler.jsonc
```

This uses local D1 and a placeholder database ID. Do not deploy this configuration. Production resources and DNS require the owner's launch instruction and Infrastructure setup. All routes send `X-Robots-Tag: noindex, nofollow`; robots.txt disallows crawling.

The same Worker mounts the existing platform and a seeded real Feedback tenant at `/i/next-dupe/`; `/vote` embeds its widget. Eight proposed alternatives are seeded with zero synthetic votes. Signed-in browser votes/comments use the real Feedback database. The seed has no admin credential: before public launch, configure its owner/admin key privately and restrict provisioning to the intended platform accounts. No secret is stored in source.

`POST /api/waitlist` validates email and explicit consent, requires a same-origin Origin, limits request size, stores only email/time/consent version/removal-token hash in D1 and handles duplicates uniformly. A honeypot ignores obvious automated submissions. `DELETE /api/waitlist` requires the opaque removal token and deletes the signup; the browser stores its own token locally. It never exposes email lists. Email delivery, a verified email unsubscribe flow/contact and durable abuse limits must be prepared before public launch. There is no third-party form service or analytics.

`npm run prove:site` starts actual local Wrangler/workerd and D1, proves waitlist insert/deduplication/consent/origin/removal, votes on the actual seeded board and captures every page at desktop and mobile sizes. `bash scripts/boat-site-proof.sh` installs dependencies, checks types, runs that proof and captures output. Private proof data and generated screenshots live in `proof/`; the original product screenshots under `public/images` are intentional source assets.

Repository docs served at `/reference/` are snapshots of README/API/AGENTS. Refresh them when those documents change. The preview's CLI commands run from a checkout; no published npm package or source URL is claimed.
