# Releasing image-drop-input

`image-drop-input` is the package that ships today.
`web-image-prep` stays out of the release lane for now.

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

3. Update `CHANGELOG.md` with the release-facing notes.

4. Open a pull request with the `Release` template.
   Use a short release branch and a neutral title such as `release/0.2.0` and `release: 0.2.0`.
   If you create a GitHub release entry, keep that title plain too, for example `v0.2.0`.

5. After the release PR is merged to `main`, run the GitHub `Release` workflow:

   - first with `publish` turned off for a rehearsal
   - then with `publish` turned on for the real publish

## Commands

```bash
npm run release:prepare -- patch
npm run release:pr:check
npm run publish:check
```
