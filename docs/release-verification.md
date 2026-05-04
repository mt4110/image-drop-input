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
| `npm run publish:check` | Verifies the dry-run package manifest, included docs, tarball count, metadata links, and deny-listed files. |

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

Manual checks:

- npm README starts with the canonical English README.
- install snippet is `npm install image-drop-input react`.
- homepage opens the GitHub Pages demo.
- repository and bugs links point to `mt4110/image-drop-input`.
- provenance is visible for the published version.
- provenance points back to the expected GitHub workflow run.

## Optional SBOM

When a downstream review asks for one, generate a local SBOM from the release checkout:

```bash
npm sbom > sbom.cdx.json
```

Do not commit generated SBOM files unless the release process explicitly adopts them. They add maintenance burden and can drift quickly.
