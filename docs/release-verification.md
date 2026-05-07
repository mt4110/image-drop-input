# Release verification

This project treats the packed package as the release artifact. Repository tests are necessary, but the tarball must also be verified as a consumer would install it.

## Local release checks

Run these before a release PR:

```bash
npm run verify
npm run smoke:consumer
npm run publish:check
```

What they cover:

| Check | Purpose |
| --- | --- |
| `npm run verify` | Typecheck, unit tests, example builds, package linting, and type resolution checks. |
| `npm run smoke:consumer` | Packs the package and installs it into root type, headless CJS, and Vite React UI consumer fixtures. |
| `npm run publish:check` | Verifies release workflow gates, then creates a temporary package tarball and checks package description, core keywords, included docs, exact tarball count, metadata links, and deny-listed files. |

To reproduce the release workflow tarball gate locally:

```bash
ARTIFACT_DIR="$(mktemp -d)"
trap 'rm -rf "$ARTIFACT_DIR"' EXIT

npm pack --pack-destination "$ARTIFACT_DIR"
node scripts/resolve-npm-tarball.mjs "$ARTIFACT_DIR" --expect-package-json package.json
```

## Package manifest invariants

Keep these stable unless a release intentionally changes them:

- React stays a peer dependency.
- `sideEffects` stays limited to CSS.
- `files` stays narrow: `dist`, README files, and public docs.
- The export map stays small: root, `/headless`, `/style.css`, and `package.json`.
- No cloud storage SDK is added to runtime dependencies.
- Consumer Node floor is documented and tested.
- Package version changes only as part of release work.

## Release workflow gates

`.github/workflows/release.yml` should keep these properties:

- release concurrency is enabled with `cancel-in-progress: false`
- publish waits for verify
- verify creates exactly one tarball
- publish downloads exactly one tarball
- `npm publish` uses the resolved tarball path explicitly
- normal publish path uses npm Trusted Publishing with OIDC, not a long-lived publish token
- post-publish verification checks exact package version, `dist-tags.latest`, `repository.url`, and `engines.node`

The workflow summary includes the resolved tarball path and registry checks so release notes can include a short verification summary.

## Release notes verification summary

Use this shape in release PRs and GitHub release notes:

```text
Verification summary:
- Local checks: npm run verify, npm run smoke:consumer, npm run publish:check
- Release rehearsal: Release workflow passed with publish off and resolved exactly one tarball
- Publish: npm-publish environment used npm Trusted Publishing / OIDC and published the explicit tarball path
- Registry metadata: exact version, dist-tags.latest, repository.url, and engines.node matched package.json
- Provenance: npm provenance was visible and pointed back to the expected workflow run
```

## Post-publish npm checks

After publish, confirm the registry face:

```bash
PACKAGE=image-drop-input
VERSION="$(node -p 'require("./package.json").version')"

npm view "$PACKAGE@$VERSION" version
npm view "$PACKAGE" dist-tags.latest
npm view "$PACKAGE@$VERSION" repository.url
npm view "$PACKAGE@$VERSION" engines.node
npm view "$PACKAGE@$VERSION" dist.integrity
```

For an assertion-style check:

```bash
PACKAGE=image-drop-input
VERSION="$(node -p 'require("./package.json").version')"
EXPECTED_REPOSITORY_URL="$(node -p 'require("./package.json").repository.url')"
EXPECTED_ENGINES_NODE="$(node -p 'require("./package.json").engines.node')"

test "$(npm view "$PACKAGE@$VERSION" version)" = "$VERSION"
test "$(npm view "$PACKAGE" dist-tags.latest)" = "$VERSION"
test "$(npm view "$PACKAGE@$VERSION" repository.url)" = "$EXPECTED_REPOSITORY_URL"
test "$(npm view "$PACKAGE@$VERSION" engines.node)" = "$EXPECTED_ENGINES_NODE"
npm view "$PACKAGE@$VERSION" dist.integrity
```

Manual checks:

- npm README starts with the canonical English README.
- install snippet is `npm install image-drop-input react`.
- homepage opens the GitHub Pages demo.
- repository and bugs links point to `mt4110/image-drop-input`.
- provenance is visible for the published version.
- provenance points back to the expected GitHub workflow run.
- GitHub Releases latest matches the npm `dist-tags.latest` version.
- GitHub release notes carry the same highlights as `CHANGELOG.md`.
- GitHub release notes include the release verification summary.

## GitHub release surface

The npm registry, `package.json`, git tag, `CHANGELOG.md`, and GitHub Releases page are all public release surfaces. Keep them aligned for each published version.

After publish, verify:

```bash
PACKAGE=image-drop-input
VERSION="$(node -p 'require("./package.json").version')"

test "$(npm view "$PACKAGE" dist-tags.latest)" = "$VERSION"
gh release view "v$VERSION" --repo mt4110/image-drop-input --json tagName,name,publishedAt,url
test "$(
  gh release list --repo mt4110/image-drop-input --limit 1 --json tagName,isLatest \
    --jq ".[0] | select(.tagName == \"v$VERSION\" and .isLatest == true) | .tagName"
)" = "v$VERSION"
gh release list --repo mt4110/image-drop-input --limit 5
```

The GitHub release for `v$VERSION` should be the latest release when npm `latest` points at the same version. If npm is already published but the GitHub release entry is missing, create or update the GitHub release without publishing a new npm version.

## Provenance verification

The npm package page should show provenance for the published version. The provenance details should link to the source commit and the release workflow run that published the tarball.

To verify downloaded registry signatures and provenance attestations from the CLI:

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

## Optional SBOM

When a downstream review asks for one, generate a local SBOM from the release checkout:

```bash
npm sbom > sbom.cdx.json
```

Do not commit generated SBOM files unless the release process explicitly adopts them. They add maintenance burden and can drift quickly.
