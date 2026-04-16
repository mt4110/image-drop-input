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
- [ ] `CHANGELOG.md` is updated with release-facing notes
- [ ] `npm run verify`
- [ ] `npm run publish:check`
- [ ] consumer demo or fixture still looks right

## Publish Plan

- [ ] merge to `main`
- [ ] run the `Release` workflow from `main`
- [ ] leave `publish` off for rehearsal, then rerun with `publish` on

## Notes

- breaking changes:
- follow-up work:
