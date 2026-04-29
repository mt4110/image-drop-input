# Releasing image-drop-input

`image-drop-input` is the package that ships today.
`web-image-prep` stays out of the release lane for now.

## Release trust model

The release workflow publishes with npm Trusted Publishing from GitHub Actions.
The publish job uses OIDC through `id-token: write`; it does not use `NPM_TOKEN` or `NODE_AUTH_TOKEN`.

Trusted publishing currently requires npm CLI `11.5.1` or newer and Node `22.14.0` or newer.
This repository pins npm through `packageManager` and pins the release workflow to Node `22.14.0`.

When a public package is published from this public repository through trusted publishing, npm generates provenance automatically.
Do not add `--provenance` to the publish command unless npm changes that guidance.

## One-time npm trusted publisher setup

Before the first tokenless publish, configure the package on npmjs.com:

1. Open the package settings for `image-drop-input`.
2. Open **Trusted Publisher**.
3. Choose **GitHub Actions**.
4. Set **Organization or user** to `mt4110`.
5. Set **Repository** to `image-drop-input`.
6. Set **Workflow filename** to `release.yml`.
7. Set **Environment name** to `npm-publish`.
8. Save the trusted publisher configuration.
9. Run the GitHub `Release` workflow from `main` with `publish` off as a rehearsal.
10. Run the workflow again with `publish` on and confirm the publish succeeds.
11. After a successful trusted publish, open package settings -> **Publishing access** and enable **Require two-factor authentication and disallow tokens**.
12. Revoke the old automation publish token.

Important details:

- The npm workflow field is the filename only: `release.yml`, not `.github/workflows/release.yml`.
- The trusted publisher fields are case-sensitive.
- The npm environment field must match the GitHub Actions job environment: `npm-publish`.
- The workflow must run on GitHub-hosted runners; self-hosted runners are not supported for this release path.
- Publishing from a fork can fail if `package.json` `repository.url` does not exactly match the repository configured on npm.
- Trusted publishing only covers `npm publish`. If this repo later adds private npm dependencies, installs may need a separate read-only token.

## Why not Changesets yet

Changesets is a strong fit when the package being versioned lives under the workspace graph.
In this repository, the package we publish lives at the repository root.

That matters: the official Changesets project still tracks root-workspace support as an open gap, so forcing it in here would add ceremony without giving us a clean release flow.

Use these sources for context:

- https://github.com/changesets/action
- https://github.com/changesets/changesets/issues/1137

## Release PR flow

1. Bump the version:

   ```bash
   npm run release:prepare -- patch
   ```

   You can swap `patch` for `minor`, `major`, or an explicit version like `0.2.0`.

2. Run the release checks:

   ```bash
   npm run release:pr:check
   ```

3. Add release-facing notes to the release PR body.
   Update `CHANGELOG.md` in the same PR.

4. Open a pull request with the `Release` template.
   Use a short release branch and a neutral title such as `release/0.2.0` and `release: 0.2.0`.
   If you create a GitHub release entry, keep that title plain too, for example `v0.2.0`.

5. After the release PR is merged to `main`, run the GitHub `Release` workflow:

   - first with `publish` turned off for a rehearsal; this runs the verification job only
   - then with `publish` turned on for the real publish; this enters the `npm-publish` environment and publishes with OIDC

6. After publishing, check the npm package page:

   - the expected version is live
   - provenance is visible for the published version
   - the provenance details point back to the expected GitHub workflow run

For local verification, `npm audit signatures` can also be used from a project that installs the package version being checked.

## Runtime support checks

The repo maintainer toolchain is Node 22.x with the npm version pinned by `packageManager`.
The release workflow uses Node `22.14.0` so trusted publishing always has the required Node floor.
The published package consumer floor is Node `>=18.18.0`.

Before publishing, keep both lanes green:

- maintainer verification: `npm run release:pr:check`
- packed consumer smoke: `npm run smoke:consumer`

Do not change `engines.node` unless the packed tarball smoke fixtures support the new value.

## Commands

```bash
npm run release:prepare -- patch
npm run release:pr:check
npm run smoke:consumer
npm run publish:check
```
