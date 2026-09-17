# Maintenance signals

This project is intentionally small and often single-maintainer. External scorecards still look at **git history shape** (span, paired changes, release tags). We optimize for honest signal — not vanity metrics.

## What we do

- **Paired feature + test:** every user-facing `feat` / `fix` lands with the tests that pin it in the **same PR** (preferably the same focused commit). See [CONTRIBUTING — Feature + test pairing](../CONTRIBUTING.md#feature--test-pairing).
- **Small PRs:** prefer incremental, reviewable diffs over multi-feature squash blobs so history shows testable progress over time.
- **Release cadence:** cut annotated semver tags when a meaningful batch lands (`docs/releasing.md`). Do not invent empty releases.
- **No farming:** do not pad history with no-op commits, fake co-authors, or drive-by churn.

## What we do not do

- Manufacture multi-author diversity.
- Lower quality gates or skip tests to inflate commit counts.

The PR template checklist asks contributors to confirm pairing on feature/fix changes. Maintainers should reject PRs that ship behavior without tests when tests are reasonably expected.
