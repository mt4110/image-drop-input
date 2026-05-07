# Security Policy

## Supported Versions

Security fixes target the latest minor release line.
If a fix lands before the next package release, it is prepared on `main` and shipped in the next release.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.
Use GitHub private vulnerability reporting for this repository when it is available.
If private reporting is not available, contact the maintainer privately before sharing exploit details in public.

Include the affected package version, a minimal reproduction, impact, and any known workarounds.
Reports that avoid public proof-of-concept exploit details are much easier to handle safely.

## Publishing and Supply Chain

Releases are published from `.github/workflows/release.yml` on GitHub-hosted runners using npm Trusted Publishing.
The publish job uses GitHub OIDC with `id-token: write` and does not require a long-lived npm publish token.

For public publishes from this public repository, npm provenance is generated automatically by trusted publishing.
After the first successful trusted publish, the npm package should be configured to require two-factor authentication and disallow token publishing, and any old automation publish token should be revoked.

## Product Security Boundaries

The package keeps storage credentials and provider SDKs out of the client bundle.
Signed upload URLs must be created by the consuming application backend.
The package also does not infer a public URL from a signed upload URL; callers must provide a `publicUrl` or storage object key explicitly.

Temporary `blob:` preview URLs are UI state only and should not be persisted as saved product data.

## Threat Model Notes

The public product threat model is maintained in [docs/security.md](./docs/security.md).
In short, the package helps with browser-side image intake, prepared bytes, explicit uploads, draft lifecycle state, and persistable payload guards. It does not make storage, product records, or server authorization safe by itself.

Consuming applications should protect:

- signed upload URLs: keep them short-lived, scoped, and unlogged
- draft tokens: treat them as secrets for commit/discard only
- object keys: generate and authorize them on the server
- draft ownership: bind drafts to user, tenant, purpose, and expiry
- product records: load the current authoritative previous image before cleanup
- cleanup jobs: make previous cleanup and draft discard idempotent
- server validation: re-check MIME type, byte size, dimensions, purpose, ownership, and object existence

Client-side discard is best effort. Browser close, network failure, and unmount can interrupt cleanup. Server-side TTL cleanup is required for abandoned drafts.

Use [docs/telemetry-and-privacy.md](./docs/telemetry-and-privacy.md) for privacy-safe logging patterns. Do not log signed upload URLs, draft tokens, raw storage headers, local `blob:` URLs, file contents, or EXIF metadata.
