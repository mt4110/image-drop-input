# Meta Documents

This directory keeps repository planning notes that are useful to maintainers but are not part of the package's public face.

- `OSS_FOUNDATION_PLAN.md`: foundation notes for the repository and publishing posture.
- `ADOPTION_PROOF.md`: maintainer-side adoption proof, registry checks, and usage report drafts.
- `REPO_PLAN.md`: historical repository structure and packaging plan.
- `ROADMAP.md`: release-direction notes and future work.
- `design/`: future design notes that are useful to maintainers but not part of the package docs.

Current design notes:

- `design/P1-08-adoption-hardening.md`: v0.3 trust, maintainability, error-surface, and usage-proof plan.
- `design/P2-07-upload-error-model.md`: structured upload error model for localization, telemetry, and retry UI.

Published package contents are still controlled by `package.json.files`; this directory is intentionally excluded.
