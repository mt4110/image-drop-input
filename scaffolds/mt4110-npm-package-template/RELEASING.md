# Releasing a package repo

This release lane assumes a single npm package is published from the repository root.

The goal is to keep the release surface explicit:

- version bump
- release PR
- rehearsal run
- publish run

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

3. Update `CHANGELOG.md` with the release-facing notes.

4. Open a pull request with the `Release` template.
   Use a short release branch and a neutral title such as `release/0.2.0` and `release: 0.2.0`.
   If you create a GitHub release entry, keep that title plain too, for example `v0.2.0`.

5. After the release PR is merged to `main`, run the GitHub `Release` workflow:

   - first with `publish` turned off for a rehearsal
   - then with `publish` turned on for the real publish

## Auth mode

The scaffold keeps npm auth explicit with `NPM_TOKEN` for the bootstrap publish.

That is intentional: npm trusted publisher configuration currently requires the package to already exist on the npm registry.

After the first publish creates the package, move the repository to trusted publishing:

```bash
npm trust github <package-name> --repo mt4110/<repo-name> --file release.yml
```

This CLI path requires npm `11.10+`.
If you prefer the web flow, configure the trusted publisher in the npm package settings and follow https://docs.npmjs.com/trusted-publishers.

Then remove `NODE_AUTH_TOKEN` from `.github/workflows/release.yml` and keep the `id-token: write` permission.

## Commands

```bash
npm run release:prepare -- patch
npm run release:pr:check
npm run publish:check
```
