> Suggested title: `release: <version>`
> Keep the branch name, PR title, and any GitHub release title neutral and version-focused.
> Do not prefix them with tool or assistant names.

## Summary

- release version:
- dist-tag:
- scope:

## Highlights

- 

## Checks

- [ ] `package.json` and `package-lock.json` carry the intended version
- [ ] `CHANGELOG.md` includes the release-facing notes
- [ ] release-facing notes are included in the PR body
- [ ] `npm run release:pr:check`
- [ ] packed package contains the English canonical `README.md`, docs, license, dist files, and no local-only files
- [ ] demo still looks right in the consumer you care about

## Publish Readiness

- [ ] npm Trusted Publisher is configured for `mt4110/image-drop-input`, workflow filename `release.yml`, and environment `npm-publish`
- [ ] the release workflow uses OIDC for publish and does not depend on `NPM_TOKEN` or `NODE_AUTH_TOKEN`

## Publish Plan

- [ ] merge to `main`
- [ ] run the `Release` workflow from `main` with `publish` off and confirm the rehearsal passed
- [ ] confirm the rehearsal resolved exactly one package tarball artifact
- [ ] rerun the `Release` workflow from `main` with `publish` on
- [ ] confirm the publish run resolved exactly one package tarball before `npm publish`
- [ ] confirm the publish job used the `npm-publish` environment

## Post-publish Checks

- [ ] npm package page version matches `package.json` on `main`
- [ ] npm package page README starts with the English canonical `README.md`
- [ ] npm install snippet is `npm install image-drop-input react`
- [ ] npm homepage link opens the GitHub Pages demo
- [ ] npm repository link opens `mt4110/image-drop-input`
- [ ] npm bugs link opens the GitHub issue tracker
- [ ] docs link from the npm README opens successfully
- [ ] npm provenance is visible for the published version
- [ ] npm provenance details point back to the expected GitHub workflow run
- [ ] if this is the first trusted publish, the old npm automation token is revoked and removed from GitHub Actions secrets or environment secrets
- [ ] if this is the first trusted publish, npm publishing access requires 2FA and disallows tokens
- [ ] initial usage report follow-up is linked in Notes or explicitly queued

## Notes

- breaking changes:
- follow-up work:
