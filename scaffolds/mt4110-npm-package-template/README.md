# mt4110/npm-package-template

This directory is the local seed for the future `mt4110/npm-package-template` repository.

When that repository is created, copy the contents of this directory to the repository root and then layer in the package-specific source tree and metadata.

## Purpose

This seed carries the repo-local release lane for a single-package npm repository.

It keeps the flow explicit:

- version bump
- release PR
- workflow dispatch
- publish
- neutral naming for branches, PRs, and release titles

It intentionally does not freeze the package layout, bundler choice, or test runner yet.

## Included here

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/PULL_REQUEST_TEMPLATE/release.md`
- `scripts/prepare-release.mjs`
- `CHANGELOG.md`
- `LICENSE`
- `RELEASING.md`
- `.gitignore`

## Assumptions

The receiving repository should provide:

- `npm ci`
- `npm run verify`
- `npm run release:pr:check`
- `npm run publish:check`

The package itself should publish from the repository root.

The bundled workflows are intentionally self-skipping inside `mt4110/npm-package-template` itself.
They start running once the files are copied into another repository.

## npm publish auth

Keep `NPM_TOKEN` as the bootstrap path for a brand-new package repository.
Current npm trusted publisher configuration requires the package to already exist on the npm registry, so a brand-new package cannot start there cleanly.

After the first successful publish creates the package, move that repository to trusted publishing:

```bash
npm trust github <package-name> --repo mt4110/<repo-name> --file release.yml
```

Then remove `NODE_AUTH_TOKEN` from `.github/workflows/release.yml` in the package repository and keep `id-token: write`.
Keep branch names short and keep PR and release titles plain, for example `release/0.2.0`, `release: 0.2.0`, and `v0.2.0`.

## Still Manual

These settings stay outside the template:

- branch protection
- Actions permissions
- Discussions
- Dependabot
- npm trusted publisher registration

If the repo stays on token-based npm publish for a while, keep `NPM_TOKEN` wired to the `Release` workflow.
If the repo moves to trusted publishing after the first publish, remove `NODE_AUTH_TOKEN` from the publish step and keep `id-token: write`.
