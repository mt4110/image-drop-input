# Contributing

Thanks for contributing to `image-drop-input`.

This project is intentionally small in scope:

- single-image first
- calm browser upload UI at the root entrypoint
- lower-level helpers under `/headless`
- no cloud SDK coupling

## Before you start

- open an issue for bug reports and concrete feature requests
- use GitHub Discussions for broad ideas or usage questions if Discussions are enabled
- open an issue first for larger concrete changes
- keep pull requests focused
- prefer the existing API and design language over new abstraction layers

Please keep issues, pull requests, and review calm, respectful, and specific.

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
