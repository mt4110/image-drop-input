# Contributing

Thanks for contributing to `image-drop-input`.

This project is intentionally small in scope:

- single-image first
- calm browser upload UI at the root entrypoint
- lower-level helpers under `/headless`
- no cloud SDK coupling
- durable product image state over generic upload breadth

## Before you start

- use the bug report form for reproducible defects
- use the feature request form for concrete product workflow improvements
- use the usage report form to share real integration signals
- do not open a public issue for suspected security vulnerabilities
- open an issue first for larger concrete changes
- keep pull requests focused
- prefer the existing API and design language over new abstraction layers

Please keep issues, pull requests, and review calm, respectful, and specific.

## Issues and usage reports

[Bug reports](https://github.com/mt4110/image-drop-input/issues/new?template=bug-report.yml) should include package, React, framework or bundler, Node, browser, upload pattern, expected behavior, actual behavior, and a minimal reproduction when possible.

[Feature requests](https://github.com/mt4110/image-drop-input/issues/new?template=feature-request.yml) should start from the product workflow: what the image field needs to do, what is hard today, and the smallest behavior change that would help.

[Usage reports](https://github.com/mt4110/image-drop-input/issues/new?template=usage-report.yml) are welcome when you are using or evaluating the package in a real product. They are product signal intake, not testimonial collection. Useful signals include use case, framework or bundler, local-preview-only versus upload integration, upload pattern, missing docs, and adoption blockers.

Public quotation from a usage report is opt-in. Company name, project name, and website URL are optional.

For suspected security vulnerabilities, do not open a public issue. Follow [SECURITY.md](./SECURITY.md) and share exploit details privately.

## Local setup

```bash
npm ci
npm run verify
```

Useful commands:

```bash
npm run dev --workspace examples/vite
npm run dev --workspace examples/rsbuild
npm run build:examples
npm run publish:check
```

## Pull requests

Please make sure your PR:

- uses a short descriptive branch name and a neutral PR title
- explains the user-facing reason for the change
- keeps docs in sync when public behavior changes
- includes release-facing notes in the PR body when the change should be mentioned later
- passes `npm run verify`

For release work, use the `Release` pull request template and the steps in `RELEASING.md`.
For normal work, use the default pull request template.
Avoid tool or assistant name prefixes in branch names, PR titles, and release titles.

## Design expectations

This repo values software that feels quiet and durable in everyday use.

- favor predictable behavior over cleverness
- keep the public API small
- make upload flows explicit
- avoid features that blur the line between local preview and persisted upload state

## Scope decisions

Before accepting a feature, answer the same checklist used by the issue template:

1. Does it protect durable product image state?
2. Does it improve submit-boundary safety?
3. Does it improve byte-policy verification?
4. Does it improve draft, commit, discard, or cleanup correctness?
5. Does it improve explicit upload boundaries without storage lock-in?
6. Does it improve adoption trust without expanding scope?

A yes should be concrete and tied to the requested behavior. If the answer is no, reject or redirect the request. Multi-file queues, resumable upload orchestration, remote sources, storage provider SDK wrappers, built-in image editing, and storage-as-a-service behavior are out of scope.

See [docs/maintenance-governance.md](./docs/maintenance-governance.md) for response templates, suggested labels, and semver policy.

## Semver

Public contracts include exported subpaths, component props, hook options and return types, render props, message and customization keys, `ImageUploadValue`, persistable value helpers, upload adapter contracts, validation and budget helpers, and documented error codes or fields used for narrowing.

Patch releases may include bug fixes, docs fixes, CI hardening, and internal refactors that preserve public behavior.

Minor releases may add helpers, recipes, optional public types, optional props that preserve current defaults, or new non-breaking error codes.

Major releases are required for breaking public type changes, persistable guard behavior changes, lifecycle phase changes that affect user code, removed exports, renamed exports, changed defaults that alter existing app outcomes, or new required peer, browser, framework, or runtime requirements.
