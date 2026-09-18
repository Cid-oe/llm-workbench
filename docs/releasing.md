# Releasing

LLM Workbench follows [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/). Tags are `vMAJOR.MINOR.PATCH` (for example `v0.2.0`).

Widespread releases are **cryptographically signed** git tags. The signing private key MUST stay on maintainer machines (or a hardware token) — never on GitHub Pages, npm, or CI that publishes the static site.

## Cadence

- Cut a release when a meaningful batch of features/fixes has landed on `main` (prefer focused PRs; do not farm commits).
- Prefer **minor** bumps (`0.x.0`) for user-visible batches; **patch** for fixes-only; **major** only for breaking changes once the API/product surface warrants it.
- Keep shipping small PRs between cuts; the release is just the tagged snapshot + changelog section.

## Steps (maintainers)

1. Ensure `main` is green (`quality`, `test`, `fresh`, `docker-smoke`, and `dco` CI) and you are on an up-to-date local `main`.
2. Open a short release PR that:
   - Moves entries under `## [Unreleased]` into a new dated section `## [X.Y.Z] - YYYY-MM-DD`.
   - Leaves an empty `## [Unreleased]` heading for the next cycle.
   - Updates the compare/tag footer links at the bottom of `CHANGELOG.md`.
   - Bumps `"version"` in `package.json` to `X.Y.Z` (keep it aligned with the tag).
3. Merge the release PR to `main` (squash is fine).
4. From the merge commit on `main`, create a **signed annotated** tag and push it:

   ```bash
   git checkout main && git pull
   git tag -s vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   `git tag -s` uses your configured GPG or SSH signing key (`git config tag.gpgSign true` and `user.signingkey`). Upload the **public** key to [GitHub SSH/GPG keys](https://github.com/settings/keys) so the tag shows as Verified.

5. Publish a [GitHub Release](https://github.com/ale94lko/llm-workbench/releases/new) for that tag. Use the matching `CHANGELOG.md` section as the release notes body.

## Verify a release

Anyone can check a tag over HTTPS git:

```bash
git fetch --tags
git verify-tag vX.Y.Z
```

A good result prints a GPG/SSH signature Good signature (or GitHub-verified SSH). Compare the tag commit to the GitHub Release SHA.

Public keys: maintainer keys listed on GitHub ([ale94lko](https://github.com/ale94lko.keys), [leoflavio1989](https://github.com/leoflavio1989.keys)) and any GPG keys uploaded on those profiles. The private signing key is **not** stored in this repository or on GitHub Pages.

## Checklist

- [ ] Changelog section dated and linked
- [ ] `package.json` version matches the tag (without the `v` prefix)
- [ ] Signed annotated tag `vX.Y.Z` on `main` (`git verify-tag` succeeds)
- [ ] GitHub Release published with changelog notes

See also [CONTRIBUTING.md — Releases](../CONTRIBUTING.md#releases).
