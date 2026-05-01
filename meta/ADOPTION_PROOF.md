# Adoption Proof Log

This file tracks adoption-hardening evidence that is useful to maintainers but should stay out of the published package face.

## 2026-05-01 local packed-consumer proof

The packed tarball was verified with:

```bash
npm run smoke:consumer
```

Coverage:

- root TypeScript consumer imports `ImageDropInput`, `ImageUploadError`, `isImageUploadError`, and public types from `image-drop-input`
- headless CommonJS consumer requires `image-drop-input/headless`
- headless CommonJS consumer verifies uploader exports plus `ImageUploadError` and `isImageUploadError`

This is not a public usage report, but it is an external-consumer-style check against the package tarball rather than source imports.

## 2026-05-01 registry and account check

Checked locally:

- `gh auth status` is authenticated as `mt4110`
- `npm whoami` returns `mt4110`
- `npm view image-drop-input@0.2.0 dist --json` returns an integrity hash, registry signature, and npm provenance attestation URL for `0.2.0`

Remaining release-trust checks require the npm package settings UI and the next GitHub Actions publish run:

- npm Trusted Publisher is configured for `mt4110/image-drop-input`
- workflow filename is `release.yml`
- environment is `npm-publish`
- the publish job uses OIDC without `NPM_TOKEN` or `NODE_AUTH_TOKEN`
- any old automation publish token is revoked after the trusted publish succeeds

## Usage report draft

Use this as the first self-authored usage report after confirming a real app or external integration.

Title:

```txt
usage: packed consumer smoke with root types and headless CJS
```

Fields:

```txt
Use case: Other
Framework or bundler: packed tarball consumer fixtures, TypeScript, CommonJS
Integration mode: Evaluating
Upload pattern: Not sure yet

What worked well:
The package tarball can be consumed from the root entry for React/types and from the headless CommonJS subpath. Structured upload errors are available from both root and headless entrypoints, so product code can narrow upload failures without parsing messages.

Pain points, missing docs, or adoption blockers:
This is still a maintainer-owned consumer proof, not an independent product report. The next stronger signal should come from a Next.js App Router or React Hook Form/Zod integration outside this repository.

Company or project name:

Website URL:

Public quotation permission:
Do not check unless a real external project name or URL is provided and quotation is appropriate.
```
