# Releasing

`npm run release:prepare` bundles an allowlisted runtime source tree and produces the standalone `@dupes/cli` tarball plus a SHA-256/source-commit manifest in ignored `release/`. The launcher is Apache-2.0; bundled apps remain AGPL-3.0-only. The npm package includes its runtime and dependencies so it doesn't need the monorepo or a GitHub download at startup. Generated runtime Docker builds select the app's Node entry point; persistent data lives outside the npx cache.

With the GitHub repository and npm scope already configured, publishing the prepared clean commit is one command:

```sh
DUPES_PUBLIC_GIT_REMOTE=git@github.com:OWNER/dupes.git npm run release:publish -- --confirm
```

The helper verifies the archive hash and clean source commit (and, if `DUPES_PUBLISH_GH_LOGIN` is set, the GitHub login), then pushes through SSH and publishes the prepared npm archive. If either write fails, reconcile the GitHub/npm state before retrying. It never creates accounts or repositories.

Private data, environments, proof artifacts, generated runtime and release tarballs are ignored by Git.
