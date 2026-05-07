# Supply-chain security

This project keeps supply-chain checks focused on package trust without adding runtime dependencies or storage-provider SDKs.

## Enabled checks

| Check | Where | Purpose |
| --- | --- | --- |
| Dependency review | `.github/workflows/security.yml` pull requests | Flags dependency changes with known advisories before merge. |
| CodeQL JavaScript/TypeScript analysis | GitHub default setup in repository settings | Scans source for code-level security issues without committing a second advanced CodeQL workflow. |
| Release workflow gate verification | `scripts/verify-release-workflow.mjs` | Keeps npm Trusted Publishing, artifact resolution, and metadata verification in place. |
| Pack manifest verification | `scripts/verify-pack-manifest.mjs` | Confirms the tarball excludes local-only files and includes only the intended public package surface. |

These checks do not prove production security, storage safety, malware scanning, CDN invalidation, or compliance readiness. Those remain app/server responsibilities.

Do not add an advanced `github/codeql-action` workflow while GitHub default setup is enabled for this repository. GitHub rejects duplicate CodeQL analysis uploads from advanced configuration and default setup for the same language, so the repository should use one CodeQL configuration source at a time.

## OpenSSF Scorecard evaluation

OpenSSF Scorecard is useful when its result is monitored and acted on. It is not enabled as a required workflow yet because this repository already has focused release, dependency, and static-analysis checks, and a new scheduled scorecard should have an owner and triage policy before it becomes a public signal.

If Scorecard is added later, document:

- where the result is published
- who triages findings
- which score changes block releases
- which findings are accepted as project policy

## Runtime dependency rule

Security tooling may add dev dependencies, GitHub workflow checks, or repository-level checks. It must not add runtime dependencies to the browser package unless a release explicitly justifies the change.

The package still must not include:

- provider SDK credentials
- cloud storage SDKs in runtime dependencies
- generated SBOM files without a maintenance policy
- local `.private_docs/`, tests, workflow files, or artifacts in the npm tarball
