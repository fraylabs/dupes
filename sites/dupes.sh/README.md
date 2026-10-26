# dupes.sh

The dupes.sh website: home, catalogue, vote, hosted signup, demo, docs, blog and privacy pages. `community-licences.json` records pinned MIT/Apache-2.0 licence files for ArtCraft, eight Crafting Apps and Macro; no community code or logos are bundled.

From the monorepo root after `npm ci`:

```sh
npx wrangler d1 migrations apply dupes-site-local --local --config sites/dupes.sh/wrangler.jsonc
npx wrangler dev --local --config sites/dupes.sh/wrangler.jsonc
```

This uses local D1 and a placeholder database ID. To deploy your own copy, see [DEPLOY.md](DEPLOY.md).

The same Worker mounts the hosted platform and a seeded Feedback tenant at `/i/next-dupe/`; `/vote` embeds its widget. The seed has no admin credential: configure its owner/admin key privately. No secret is stored in source.

`POST /api/waitlist` validates email and explicit consent, requires a same-origin Origin, limits request size, stores only email/time/consent version/removal-token hash in D1 and handles duplicates uniformly. A honeypot ignores obvious automated submissions. `DELETE /api/waitlist` requires the opaque removal token and deletes the signup; the browser stores its own token locally. It never exposes email lists. There is no third-party form service or analytics; see [SOURCE_COUNTS.md](SOURCE_COUNTS.md) for the identifier-free page counts.

`npm run prove:site` starts local Wrangler/workerd and D1, checks waitlist insert/deduplication/consent/origin/removal, votes on the seeded board and captures every page at desktop and mobile sizes. `bash scripts/site-proof.sh` installs dependencies, checks types, runs that proof and captures output. Proof data and generated screenshots live in ignored `proof/`; the product screenshots under `public/images` are source assets.

Repository docs served at `/reference/` are snapshots of README/API/AGENTS. Refresh them when those documents change.
