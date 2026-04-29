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
- [ ] `npm run verify`
- [ ] `npm run publish:check`
- [ ] demo still looks right in the consumer you care about

## Publish Plan

- [ ] npm Trusted Publisher is configured for `mt4110/image-drop-input`, workflow filename `release.yml`, and environment `npm-publish`
- [ ] merge to `main`
- [ ] run the `Release` workflow from `main`
- [ ] leave `publish` off for rehearsal, then rerun with `publish` on
- [ ] confirm the publish job used the `npm-publish` environment
- [ ] confirm npm provenance is visible for the published version
- [ ] after the first trusted publish, revoke the old npm automation token
- [ ] after the first trusted publish, enable npm publishing access that requires 2FA and disallows tokens

## Notes

- breaking changes:
- follow-up work:
