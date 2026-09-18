# Releasing

LLM Workbench follows [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/). Tags are `vMAJOR.MINOR.PATCH` (for example `v0.2.0`).

## Cadence

- Cut a release when a meaningful batch of features/fixes has landed on `main` (prefer focused PRs; do not farm commits).
- Prefer **minor** bumps (`0.x.0`) for user-visible batches; **patch** for fixes-only; **major** only for breaking changes once the API/product surface warrants it.
- Keep shipping small PRs between cuts; the release is just the tagged snapshot + changelog section.

## Steps (maintainers)

1. Ensure `main` is green (`quality`, `test`, `fresh`, and `docker-smoke` CI) and you are on an up-to-date local `main`.
2. Open a short release PR that:
   - Moves entries under `## [Unreleased]` into a new dated section `## [X.Y.Z] - YYYY-MM-DD`.
   - Leaves an empty `## [Unreleased]` heading for the next cycle.
   - Updates the compare/tag footer links at the bottom of `CHANGELOG.md`.
   - Bumps `"version"` in `package.json` to `X.Y.Z` (keep it aligned with the tag).
3. Merge the release PR to `main` (squash is fine).
4. From the merge commit on `main`, create an **annotated** tag and push it:

   ```bash
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. Publish a [GitHub Release](https://github.com/ale94lko/llm-workbench/releases/new) for that tag. Use the matching `CHANGELOG.md` section as the release notes body.

## Checklist

- [ ] Changelog section dated and linked
- [ ] `package.json` version matches the tag (without the `v` prefix)
- [ ] Annotated tag `vX.Y.Z` on `main`
- [ ] GitHub Release published with changelog notes

See also [CONTRIBUTING.md — Releases](../CONTRIBUTING.md#releases).
