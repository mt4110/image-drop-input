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

## Current public materials

These rows are not all adoption evidence. The role column keeps evidence, verification, and intake materials separate.

| Material | Role | What it supports |
| --- | --- | --- |
| [Integration report](./integration-report.md) | Repo-maintained integration report | The single-image product form boundary is documented against shipped APIs. |
| [Next.js draft lifecycle demo](https://github.com/mt4110/image-drop-input-next-draft-demo) | Maintainer-owned external demo | The published npm package installs and builds outside this repository in a realistic App Router draft lifecycle shape. |
| Consumer smoke fixtures | Repo-maintained verification | The packed package resolves in root TypeScript, headless CommonJS, and Vite React UI consumer shapes. |
| [Usage report template](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml) | Evidence intake | Reports can capture relationship, category, package source, framework, storage pattern, friction, and evidence limits. |
| [External usage report request](https://github.com/mt4110/image-drop-input/issues/51) | Evidence intake | Public request for a non-maintainer report. The request itself is not third-party evidence. |

## Current third-party status

No public non-maintainer usage report is linked yet.

Current public evidence stops at the maintainer-owned external demo level until a report arrives from someone outside the maintainer workflow. Maintainer-created reports, owner-created issues, and maintainer-owned demo repositories can still be useful evidence, but they must not satisfy the third-party usage report gate.

This status is intentional. It keeps the evidence ladder useful without turning a request for feedback into an adoption claim.

## Maintainer-owned external demo

The separate demo repo is labeled as a maintainer-owned external demo because it is owned by the maintainer. It installs the published `image-drop-input` package from npm by version and demonstrates:

- Next.js App Router
- single-image product form
- draft upload mock backend
- commit endpoint
- discard endpoint
- `toPersistableImageValue()` for local-preview-only submit boundaries
- product submit endpoint that commits draft and saves fields together
- README that explains what the example proves and what it does not prove

Maintainer-owned external demo:

[`image-drop-input-next-draft-demo`](https://github.com/mt4110/image-drop-input-next-draft-demo)

That wording proves the package was installed outside this repository. It does not claim third-party adoption.

The external demo README includes:

- exact package version tested
- framework and React version
- package source, ideally `npm install image-drop-input@x.y.z`
- flow diagram for select, prepare, upload draft, commit, discard, and previous cleanup
- mock backend boundaries and the production responsibilities left to the app
- failure cases such as oversized output, failed draft upload, failed commit, discard failure, and expired draft
- a "what this proves" section
- a "what this does not prove" section

## Usage reports

Ask for usage reports when someone is using or evaluating the package in a product, internal tool, or external demo. Useful reports include:

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

## First external request

Use a request that asks for a concrete workflow and leaves room for critical feedback:

```txt
Could you try the product-safe replacement flow in a small form and open a usage report with what confused you?
Praise is optional. Friction is more useful.
```

Ask for a public usage report when the reporter is comfortable sharing one. Do not ask for stars, endorsements, or private praise as a substitute for integration context.

## After a third-party report arrives

Keep the update sequence evidence-led:

1. Confirm the reporter relationship is outside the maintainer workflow.
2. Confirm the report names the package version, package source, framework or bundler, React version when known, use case, upload pattern, friction, and evidence limits.
3. Link follow-up docs, tests, or issues that came from the report. Critical feedback is valid evidence when it changes the project.
4. Update this page with a new row under current public materials using the label `Third-party usage report`.
5. Update [claim ledger](./claim-ledger.md) only for the claim the report actually supports. A third-party evaluation can prove that a non-maintainer evaluated the package; it does not prove production use.
6. Update the README adoption evidence section with the same label and limitations. Do not describe the report as customer adoption, production maturity, or endorsement unless the report explicitly supports that.

If the report comes from a maintainer, contributor, or maintainer-owned repository, keep it below the third-party usage report level and say so.
