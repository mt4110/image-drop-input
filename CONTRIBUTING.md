# Contributing

Thanks for contributing to `image-drop-input`.

This project is intentionally small in scope:

- single-image first
- calm browser upload UI at the root entrypoint
- lower-level helpers under `/headless`
- no cloud SDK coupling

## Before you start

- use the issue forms for bug reports and feature requests
- use [SUPPORT.md](./SUPPORT.md) when you are not sure which path fits your question
- use GitHub Discussions first for broad ideas or usage questions
- open an issue first for larger concrete changes
- keep pull requests focused
- prefer the existing API and design language over new abstraction layers

Please follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) in issues, pull requests, and review.

## Local setup

```bash
npm ci
npm run verify
```

Useful commands:

```bash
npm run demo:vite
npm run demo:rsbuild
npm run publish:check
```

## Pull requests

Please make sure your PR:

- uses a short descriptive branch name and a neutral PR title
- explains the user-facing reason for the change
- keeps docs in sync when public behavior changes
- updates `CHANGELOG.md` when the release notes should mention the change
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
