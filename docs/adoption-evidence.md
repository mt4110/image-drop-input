# Adoption evidence

Download counts are noisy. A smaller number of concrete integration signals is more useful than a vague download spike.

This project values evidence that helps maintainers answer:

- Which product workflow used the package?
- Which framework, bundler, and React version were involved?
- Was it local-preview-only, prepared upload, or draft lifecycle?
- What was easy?
- What was confusing?
- Which docs or tests would have reduced adoption risk?

## Evidence ladder

| Level | Evidence | What it proves |
| --- | --- | --- |
| 0 | Repo-maintained examples and recipes | Public APIs can be composed into supported flows. |
| 1 | Separate maintainer-owned integration repo | The published npm package works outside this repository. |
| 2 | Third-party usage report | Someone outside the maintainer workflow evaluated or adopted it. |
| 3 | Production-adjacent case study | A real app describes the workflow, storage pattern, blockers, and version used. |

Repo-maintained examples are useful, but they are not third-party adoption. Keep that distinction explicit.

## Current evidence

- [Integration report](./integration-report.md): repo-maintained report for the single-image product form boundary.
- Consumer smoke fixtures: packed-package root types, headless CommonJS, and Vite React UI build.
- Public usage report template: collects use case, framework, integration mode, upload pattern, and blockers.

## External integration repo target

The first separate repo should install `image-drop-input` from npm by version and demonstrate:

- Next.js App Router
- product profile form
- draft upload mock backend
- commit endpoint
- discard endpoint
- `toPersistableImageValue()` for local-preview-only submit boundaries
- product submit endpoint that commits draft and saves fields together
- README that explains what the example proves and what it does not prove

Suggested repository name:

```txt
image-drop-input-next-draft-demo
```

If the repo is maintainer-owned, label it that way. Do not call it third-party evidence.

## Usage reports

Ask for usage reports when someone is using or evaluating the package in a real product. Useful reports include:

- package version
- framework or bundler
- React version
- use case
- upload pattern
- whether draft lifecycle was used
- storage contract shape
- what docs were missing or unclear

Public quotation is opt-in. Company, project name, and URL should stay optional.
