# Adoption evidence

Download counts are noisy. A smaller number of concrete integration signals is more useful than a vague download spike.

This project values evidence that helps answer:

- Which product workflow used the package?
- Which framework, bundler, and React version were involved?
- Was it local-preview-only, prepared upload, or draft lifecycle?
- What was easy?
- What was confusing?
- Which docs or tests would have reduced adoption risk?

Evidence should stay modest. A maintainer-owned demo can be useful without being called third-party adoption.

## Evidence ladder

| Level | Evidence | What it can prove | What it does not prove |
| --- | --- | --- | --- |
| 0 | Repo-maintained examples and recipes | Public APIs can be composed into supported flows. | Independent adoption or real app fit. |
| 1 | Repo-maintained integration report | A documented product-form boundary is traceable to shipped APIs and verification checks. | Customer endorsement, benchmark quality, or storage-provider integration. |
| 2 | Maintainer-owned external demo repo | The published npm package works outside this repository in a realistic app shape. | Third-party adoption or production use. |
| 3 | Third-party usage report | Someone outside the maintainer workflow evaluated or used the package and reported context. | Production maturity unless the report says so. |
| 4 | Production-adjacent case study | A real app or internal tool describes workflow, storage pattern, blockers, and version used. | Universal fit, security review, compliance readiness, or long-term support guarantees. |
| 5 | Downstream issue or PR from real integration | A real integration found a docs gap, compatibility edge, or product need. | Broad adoption by itself. |

Repo-maintained examples are useful, but they are not third-party adoption. Keep that distinction explicit in issue titles, release notes, README links, and project boards.

## Evidence labels

Use these labels consistently:

| Label | Use it for |
| --- | --- |
| Repo-maintained example | Examples, recipes, fixtures, and demos inside this repository. |
| Repo-maintained integration report | A report written and maintained with this repository's docs and checks. |
| Maintainer-owned external demo | A separate public repo owned by a maintainer that installs the published npm package. |
| Third-party usage report | A report from someone outside the maintainer workflow. |
| Production-adjacent case study | A real app, admin tool, or product workflow with enough context to describe risk and fit. |

Do not relabel maintainer-owned work as third-party evidence. If the same person maintains both repositories, say so.

## Current evidence

| Evidence | Label | What it supports |
| --- | --- | --- |
| [Integration report](./integration-report.md) | Repo-maintained integration report | The single-image product form boundary is documented against shipped APIs. |
| Consumer smoke fixtures | Repo-maintained verification | The packed package resolves in root TypeScript, headless CommonJS, and Vite React UI consumer shapes. |
| [Usage report template](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml) | Evidence intake template | Reports can capture relationship, category, package source, framework, storage pattern, friction, and evidence limits. |

## External integration repo target

The first separate repo should be labeled as a maintainer-owned external demo unless ownership changes. It should install `image-drop-input` from npm by version and demonstrate:

- Next.js App Router
- product profile form
- draft upload mock backend
- commit endpoint
- discard endpoint
- `toPersistableImageValue()` for local-preview-only submit boundaries
- product submit endpoint that commits draft and saves fields together
- README that explains what the example proves and what it does not prove

Suggested repository name and eventual link shape:

```txt
image-drop-input-next-draft-demo
https://github.com/mt4110/image-drop-input-next-draft-demo
```

When the repo exists, link it with wording like:

```md
Maintainer-owned external demo: [Next.js draft lifecycle demo](https://github.com/mt4110/image-drop-input-next-draft-demo)
```

That wording proves the package was installed outside this repository. It does not claim third-party adoption.

The external demo README should include:

- exact package version tested
- framework and React version
- package source, ideally `npm install image-drop-input@x.y.z`
- flow diagram for select, prepare, upload draft, commit, discard, and previous cleanup
- mock backend boundaries and the production responsibilities left to the app
- failure cases such as oversized output, failed draft upload, failed commit, discard failure, and expired draft
- a "what this proves" section
- a "what this does not prove" section

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

Reports should also say whether the package came from the published npm registry, a packed tarball, or a local workspace link. Published npm installs are stronger external evidence than local links.

Good reports are allowed to include friction. "This was confusing" is more useful than vague praise because it points to docs, compatibility, or API boundaries that need work.
