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

   This includes release workflow gate checks, the packed package face check, temporary tarball creation, README inclusion,
   package description, core keywords, metadata links, exact tarball count, and deny-list validation for files that must stay out of the published tarball.

   To isolate the tarball gate locally:

   ```bash
   ARTIFACT_DIR="$(mktemp -d)"
   trap 'rm -rf "$ARTIFACT_DIR"' EXIT

   npm pack --pack-destination "$ARTIFACT_DIR"
   node scripts/resolve-npm-tarball.mjs "$ARTIFACT_DIR" --expect-package-json package.json
   ```

3. Add release-facing notes to the release PR body.
   Update `CHANGELOG.md` in the same PR.

   Include a verification summary that can also be reused in the GitHub release notes:

   ```text
   Verification summary:
   - Local checks: npm run verify, npm run smoke:consumer, npm run publish:check
   - Release rehearsal: Release workflow passed with publish off and resolved exactly one tarball
   - Publish: npm-publish environment used npm Trusted Publishing / OIDC and published the explicit tarball path
   - Registry metadata: exact version, dist-tags.latest, repository.url, and engines.node matched package.json
   - Provenance: npm provenance was visible and pointed back to the expected workflow run
   ```

4. Open a pull request with the `Release` template.
   Use a short release branch and a neutral title such as `release/0.2.0` and `release: 0.2.0`.
   If you create a GitHub release entry, keep that title plain too, for example `v0.2.0`.

5. After the release PR is merged to `main`, run the GitHub `Release` workflow:

   - first with `publish` turned off for a rehearsal; this runs the verification job, confirms there is exactly one package tarball, and stores that checked tarball as a short-lived workflow artifact
   - then with `publish` turned on for the real publish; this enters the `npm-publish` environment, confirms the downloaded artifact still contains exactly one package tarball, and publishes that resolved tarball path with OIDC
   - after publish, the workflow reads npm registry metadata for the package version, `latest` dist-tag, repository URL, and Node engine floor
   - use the workflow summary as the source for the release verification summary

6. After publishing, complete the release follow-up checklist.

   Trusted publishing confirmation:

   - the npm Trusted Publisher UI shows `mt4110/image-drop-input`, workflow filename `release.yml`, and environment `npm-publish`
   - the rehearsal workflow run from `main` passed with `publish` off
   - the real publish run entered the `npm-publish` environment
   - the publish job used OIDC and did not depend on `NPM_TOKEN` or `NODE_AUTH_TOKEN`

   npm package face:

   - the expected version matches `package.json` on `main`
   - the README shown by npm starts with the English canonical face from `README.md`
   - the install snippet is `npm install image-drop-input react`
   - the homepage link opens the GitHub Pages demo
   - the repository link opens `mt4110/image-drop-input`
   - the bugs link opens the GitHub issue tracker
   - the docs link from the README opens successfully
   - provenance is visible for the published version
   - the provenance details point back to the expected GitHub workflow run

   Registry metadata commands:

   ```bash
   PACKAGE=image-drop-input
   VERSION="$(node -p 'require("./package.json").version')"

   npm view "$PACKAGE@$VERSION" version
   npm view "$PACKAGE" dist-tags.latest
   npm view "$PACKAGE@$VERSION" repository.url
   npm view "$PACKAGE@$VERSION" engines.node
   npm view "$PACKAGE@$VERSION" dist.integrity
   ```

   Provenance/signature CLI check from a fresh project:

   ```bash
   PACKAGE=image-drop-input
   VERSION="$(node -p 'require("./package.json").version')"
   VERIFY_DIR="$(mktemp -d)"
   trap 'rm -rf "$VERIFY_DIR"' EXIT

   cd "$VERIFY_DIR"
   npm init -y
   npm install "$PACKAGE@$VERSION"
   npm audit signatures
   ```

   Token and package settings hardening:

   - revoke the old npm automation token after the first successful trusted publish
   - remove any old publish token secret from GitHub Actions secrets or environment secrets
   - enable npm publishing access that requires two-factor authentication and disallows tokens
   - keep any future read-only install token separate from the publish path

   Usage signal collection:

   - add one self-authored usage report from a real integration
   - test one integration in another repo you own
   - ask one or two early users to open a usage report when appropriate
   - quote only reports that explicitly grant public quotation permission

For local verification, `npm audit signatures` can also be used from a project that installs the package version being checked.

The public release verification checklist lives in [docs/release-verification.md](./docs/release-verification.md). Keep it in sync with the workflow when release metadata checks change.

## Runtime support checks

The repo maintainer toolchain is Node 22.x with the npm version pinned by `packageManager`.
The release workflow uses Node `22.14.0` so trusted publishing always has the required Node floor.
The published package consumer floor is Node `>=18.18.0`.

Before publishing, keep both lanes green:

- maintainer verification: `npm run release:pr:check`
- packed consumer smoke, including the Vite UI fixture: `npm run smoke:consumer`

Do not change `engines.node` unless the packed tarball smoke fixtures support the new value.

## Commands

```bash
npm run release:prepare -- patch
npm run release:pr:check
npm run smoke:consumer
npm run publish:check
```
