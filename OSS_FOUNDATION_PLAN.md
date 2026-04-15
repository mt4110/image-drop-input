# OSS Foundation Plan

This document captures the next layer above `image-drop-input` itself:

1. a public `.github` repository for shared community defaults
2. an npm release template repository for new package repos

The goal is not to make everything automatic.
The goal is to keep the shared pieces calm, durable, and easy to reuse.

## Current Status

As of 2026-04-16:

- `mt4110/.github` is live at `github.com/mt4110/.github`.
- The live repo intentionally does not include `.github/profile/README.md` because `mt4110` is a user account, not an organization.
- The next extraction target is `mt4110/npm-package-template`, seeded from `scaffolds/mt4110-npm-package-template/` in this repo.

## Design Boundary

Three lanes should stay separate:

| lane | owns | examples |
| --- | --- | --- |
| shared community defaults | human-facing repo defaults | `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SUPPORT.md` |
| repo-local release lane | files that ship with a package repo | workflows, release scripts, `RELEASING.md` |
| GitHub and npm settings | per-repo operational controls | Dependabot, branch protection, trusted publishing, Discussions |

That last lane stays manual and repo-specific.
It should not be hidden inside a template repo and should not be confused with plain `git` config.

## Recommendation

Keep the split to these two public repos:

- `mt4110/.github` (already live)
- `mt4110/npm-package-template` (next)

Use `gh`, not `gr`, as the baseline CLI.
It is already present, standard enough, and can create repos from templates and run workflows.

## Repo A: `mt4110/.github`

### Purpose

This repo is now the quiet shared home for default community health files.

It should answer:

- how to collaborate
- how to ask for help
- what behavior is expected
- what security path to use

It should not try to encode release automation or package-specific API policy.

### What belongs here

Keep the shared files generic enough that they still read naturally in a different repo.

Current live contents:

```txt
mt4110/.github/
├─ CODE_OF_CONDUCT.md
├─ CONTRIBUTING.md
├─ README.md
├─ SECURITY.md
├─ SUPPORT.md
└─ pull_request_template.md
```

For `mt4110`, stop there.
Because this is a user-owned `.github` repository, `.github/profile/README.md` does not apply here.
That file only becomes relevant for organization-owned `.github` repos.

### What should stay out

Do not move these here by default:

- package-specific issue forms
- package-specific `RELEASING.md`
- workflows
- `dependabot.yml`
- branch protection policy
- npm publish settings

Those are either repo-local or settings-level concerns.

### How this should interact with package repos

The `.github` repo is the fallback.

Each package repo can still keep a local override when its wording needs to be sharper.

For example:

- `image-drop-input` should keep its current bug and feature request forms locally
- `image-drop-input` may keep its local `SUPPORT.md` if the package-specific guidance is more useful than the shared default
- a future tiny utility repo can rely on the shared defaults with fewer local files

### Quality bar

The shared wording should be:

- short enough to skim
- specific enough to be actionable
- neutral enough to travel across repos

If a sentence depends on React, npm publish rules, or the upload-domain language of this repo, it does not belong in the shared default.

## Repo B: `mt4110/npm-package-template`

### Purpose

This repo is the starter for a new npm package repository.

It should provide a release lane that already feels settled:

- CI
- release PR rhythm
- publish workflow
- docs for maintainers

The template repo should carry files.
The GitHub and npm settings still stay manual.

### What belongs here

The seed should come from the release lane already working in `image-drop-input`.
The first local cut now lives under `scaffolds/mt4110-npm-package-template/`.

Recommended core contents:

```txt
npm-package-template/
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml
│  │  └─ release.yml
│  └─ PULL_REQUEST_TEMPLATE/
│     └─ release.md
├─ scripts/
│  └─ prepare-release.mjs
├─ CHANGELOG.md
├─ LICENSE
├─ README.md
├─ RELEASING.md
└─ .gitignore
```

Optional additions once a second package confirms the same shape:

- `package.json`
- `tsconfig.json`
- `cspell.json`
- `.npmignore` only when really needed
- `tsdown.config.ts` or another build config if you want one default toolchain

### What should stay out

Avoid putting these inside the template at first:

- self-driving release scripts that assume one fixed package layout
- monorepo-specific versioning logic
- cloud publish targets besides npm
- heavy bot choreography

The first template should be boring in a good way.

### Release philosophy

For a single-package repo, prefer:

- a manual release PR
- a manual workflow dispatch for publish
- npm provenance
- `NPM_TOKEN` for the bootstrap publish of a brand-new package
- trusted publishing once the package exists and the repo is registered
- neutral artifact naming for branches, PRs, and release titles

Until trusted publishing is enabled, keeping an `NPM_TOKEN` secret in the workflow is an acceptable bridge.
That explicit release surface should also stay plain: short topic branches and descriptive titles without tool-name prefixes.

That keeps the release surface explicit.

### Seed from the current repo

These files are good extraction candidates from `image-drop-input`:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/PULL_REQUEST_TEMPLATE/release.md`
- `RELEASING.md`
- `scripts/prepare-release.mjs`
- `CHANGELOG.md`

These should remain local to `image-drop-input`:

- issue forms under `.github/ISSUE_TEMPLATE/`
- package README product copy
- package-specific examples
- release notes that speak in this package's voice

## Template Repo vs Reusable Workflow

Do not start with both.
Start with the template repo first.

### Start with a template repo when

- there are only one or two package repos
- the shared value is mostly in files and repo shape
- the workflow will still vary a little from repo to repo

### Introduce a reusable workflow when

- three or more repos share the same release lane
- the publish inputs are stable
- changing one central workflow is clearly cheaper than touching each repo

### Future reusable workflow shape

If a reusable workflow is added later, keep its interface small:

```txt
workflow_call inputs:
- node-version
- verify-command
- publish-command
- dist-tag
```

Keep everything else inside the caller repo.

That prevents the shared workflow from turning into a hidden framework.

## Settings Checklist That Stays Manual

These are not template-repo responsibilities.
They should be applied per repository in GitHub and npm:

- Dependabot enablement and update schedule
- branch protection
- auto-merge policy
- Actions permissions
- Discussions enablement
- npm trusted publisher registration
- security alerts and dependency graph settings

This is the right place for maintainer judgment.

## CLI Baseline

Prefer `gh`.

Useful commands once the repos exist:

```bash
gh repo create npm-package-template --public
gh repo create my-new-package --public --template mt4110/npm-package-template
gh workflow run Release --repo mt4110/my-new-package
```

No extra wrapper is necessary yet.
Add a wrapper script only after the same command flow has been repeated enough times to prove its shape.

## Rollout Order

1. Keep `image-drop-input` as the proving ground.
2. Keep `mt4110/.github` small and generic now that it is live.
3. Create `mt4110/npm-package-template` from the current release lane scaffold.
4. Configure GitHub and npm settings by hand for each new repo.
5. Introduce a reusable workflow only after the second or third package confirms the same release shape.

## Short Version

- `.github` is for shared human defaults.
- `npm-package-template` is for repo-local release files.
- GitHub settings and Dependabot stay manual.
- `gh` is enough.
- Reusable workflows come later, not first.
