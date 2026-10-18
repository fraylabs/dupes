# Prepared public release

Publication requires Brian's go. No command below has been used to publish this private repository.

`npm run release:prepare` bundles an allowlisted runtime source tree and produces the standalone `@dupes/cli` tarball plus SHA-256/source-commit manifest in ignored `release/`. The launcher is Apache-2.0; bundled apps remain AGPL-3.0-only. The npm package includes its runtime and dependencies so it doesn't need the monorepo or a GitHub download at startup. Generated runtime Docker builds select the app's Node entry point; persistent data lives outside the npx cache.

After explicit approval, with the approved public GitHub repository and npm scope already configured, publishing the prepared clean commit is one command:

```sh
DUPES_PUBLIC_GIT_REMOTE=git@github.com:APPROVED_OWNER/dupes.git npm run release:publish -- --approved-by-brian
```

The helper verifies the archive hash, clean source commit and GitHub login BrianLYS, then pushes through SSH and publishes the prepared npm archive. If either write fails, reconcile the GitHub/npm state before retrying. It never creates accounts/repositories or changes billing. Confirm the actual public npm command before switching website availability from “prepared” to “available”.

Before the public switch, replace private-preview copy, establish the public privacy/security contact and email opt-out, configure the real D1/Access/domain and dogfood owner/admin, and confirm source/branding rights. The repository layout already includes code licences, notices, product docs, fixtures and per-app AGENTS.md. Private data, environments, proof artifacts, generated runtime and release tarballs are ignored.
