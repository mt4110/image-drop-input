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
