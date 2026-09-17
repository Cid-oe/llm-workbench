# Contributing to LLM Workbench

Thanks for helping improve this project. Please also read the [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/ale94lko/llm-workbench.git
cd llm-workbench
cp .env.example .env
npm install
npm run dev
```

Or start the production-like stack with Docker:

```bash
cp .env.example .env
docker compose up --build
curl -fsS http://localhost:3000/api/health
```

The app is then available at [http://localhost:3000](http://localhost:3000).

### Fresh clone verification

To validate a clean checkout (lockfile install → build → coverage) without relying on a dirty workspace:

```bash
npm run verify:fresh
```

Wrappers: `scripts/verify-fresh-clone.sh` (Unix) and `scripts/verify-fresh-clone.ps1` (Windows). See [docs/dev-notes.md](docs/dev-notes.md).

**Unit tests do not need live providers or Ollama.** The default Vitest suite uses happy-dom and mocked `fetch` (no API keys, no local LLM server).

## Quality checks

Run these before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
```

Coverage report:

```bash
npm run test:coverage
```

CI runs lint, typecheck, tests with coverage, `npm audit --audit-level=high`, and **commitlint** on every pull request.

### CI vs GitHub Pages deploy

- **`CI`** (`.github/workflows/ci.yml`) is the quality gate on pull requests and pushes to `main`: `quality` (audit, lint, typecheck, coverage) plus a dedicated `fresh` job (`npm run verify:fresh` on a clean runner).
- **`Deploy to GitHub Pages`** (`.github/workflows/deploy-pages.yml`) does **not** re-run that gate on push to `main`. It starts via `workflow_run` after a successful **CI** run that was a **push to `main`**, checks out that exact commit, then only generates and publishes the static site.
- Failed CI on `main` blocks deploy. Manual `workflow_dispatch` on the deploy workflow still runs the full quality steps before `npm run generate`, so a broken site cannot be published that way either.
- Vitest uses `pool: 'threads'` with `isolate: false` to cut happy-dom startup cost; `tests/setup.ts` resets storage per test. Prefer not to rely on order-dependent global state.
- Coverage thresholds enforce lines/functions/statements (≥70%) and branches (≥55%) via `vitest.config.ts` (`perFile: false`). Unmet thresholds make `npm run test:coverage` exit non-zero, so the CI `quality` / `fresh` jobs fail. Do not lower thresholds just to pass.

### Smoke E2E (static Pages output)

Optional browser smoke against the static site (does **not** block PR merge):

```bash
npm run generate
npx playwright install chromium   # first time only
npm run test:e2e:smoke
```

- Workflow: `.github/workflows/smoke-e2e.yml` (nightly + `workflow_dispatch` + path-filtered PRs) uses `continue-on-error: true`.
- Covers Compare home, Settings vault copy, and History empty state on `.output/public`.
- Provider / local LLM hosts are aborted in the browser so the smoke never makes live model calls.

## Commit style (Conventional Commits)

All commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(optional-scope): <short summary>

[optional body]
```

Allowed types:

| Type | Use when |
| :--- | :--- |
| `feat` | A new user-facing capability |
| `fix` | A bug fix |
| `test` | Adding or updating tests only |
| `docs` | Documentation-only changes |
| `chore` | Maintenance (deps, tooling, misc) |
| `ci` | CI/CD workflow changes |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `build` | Build system or packaging changes |
| `style` | Formatting with no code behavior change |

Examples:

- `feat: add typed StreamError for stream failures`
- `fix(stream): handle missing response body`
- `test: cover LatencyTimeline comparison bars`
- `docs: document conventional commits in CONTRIBUTING`
- `ci: add commitlint on pull requests`

### Feature + test pairing

- Ship each **feature** or **fix** with the **tests that pin it** in the same PR (and preferably the same focused commit). Example: `app/lib/*.ts` with `tests/*.test.ts`.
- Prefer small, reviewable PRs. Do **not** mix bulk formatting, unrelated refactors, and features in one change.
- If a change is docs- or CI-only, a `docs:` / `ci:` commit without new product tests is fine.
- **Sustained history:** keep this pairing over weeks and months so the repo shows incremental, testable maintenance — not a one-sprint burst. Do **not** farm artificial commits or fake co-authors. See [`docs/maintenance.md`](docs/maintenance.md).

Pull request commits are checked by the `commitlint` CI job (Dependabot PRs are exempt).

## Merge requirements

Merges into `main` go through a pull request. Do not push directly to `main`.

### Required status checks

These CI jobs from [`.github/workflows/ci.yml`](.github/workflows/ci.yml) must be green before merge:

| Check | What it enforces |
| :--- | :--- |
| `quality` | `npm audit --audit-level=high`, lint, typecheck, and `npm run test:coverage` |
| `fresh` | Clean-runner `npm run verify:fresh` (`npm ci` → build → coverage); fails the workflow on error |
| `commitlint` | Conventional Commits on PR commits (Dependabot PRs are exempt; see [Commit style](#commit-style-conventional-commits)) |

Also follow [Feature + test pairing](#feature--test-pairing): ship behavior changes with the tests that pin them in the same PR.

### Optional / non-blocking

- **`smoke`** (`.github/workflows/smoke-e2e.yml`) — Playwright smoke against static `generate` output. Uses `continue-on-error: true` and must **not** be a required status check until it is promoted.
- **Dependency freshness** — weekly `npm outdated` summary; never blocks merge.

### Maintainer: branch protection on `main`

Branch protection is configured in GitHub **Settings → Branches** (not fully expressible in-repo). Maintainers should keep:

- [ ] Require a pull request before merging
- [ ] Require status checks to pass before merging: `quality`, `fresh`, `commitlint`
- [ ] Do **not** require `smoke` (optional / `continue-on-error`)
- [ ] Prefer squash merges so `main` history stays linear and changelog-friendly

Settings UI: [Branch protection rules](https://github.com/ale94lko/llm-workbench/settings/branches).

## Workflow

1. Search [existing issues](https://github.com/ale94lko/llm-workbench/issues) before opening a new one. Use an [issue form](https://github.com/ale94lko/llm-workbench/issues/new/choose) when creating one.
2. Fork the repository and create a focused branch.
3. Add or update tests for the behavior you change (same PR as the source change).
4. Use Conventional Commit messages (`feat:`, `fix:`, `test:`, …).
5. Open a pull request and [link it to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue).
6. Enable [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.

## Releases

This project uses [Semantic Versioning](https://semver.org/). Notable changes live in [`CHANGELOG.md`](CHANGELOG.md).

**Cadence:** cut a tag when a meaningful batch has landed on `main` (for example `v0.2.0`, `v0.3.0`, …). Prefer small focused PRs between cuts; do not farm artificial commits for history.

**Process (summary):**

1. Move `[Unreleased]` entries into a dated `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md`; leave an empty `[Unreleased]`.
2. Bump `"version"` in `package.json` to `X.Y.Z`.
3. Merge that release PR to `main`, then create an annotated tag `vX.Y.Z` and push it.
4. Publish a GitHub Release whose notes are the matching changelog section.

Full maintainer steps and checklist: [`docs/releasing.md`](docs/releasing.md).

## Dependencies

- Reproducible installs rely on the committed `package-lock.json` (`npm ci`). Do not hand-pin transitive packages.
- Dependabot opens weekly grouped PRs for npm and GitHub Actions.
- A weekly **Dependency freshness** workflow runs `npm outdated --long`, writes the result to the job summary, and uploads an artifact. It uses `continue-on-error: true` so outdated packages never fail the build.
- Direct packages that look unused to static scanners but are required:
  - `@pinia/nuxt` and `pinia-plugin-persistedstate` — loaded as Nuxt modules in `nuxt.config.ts`
  - `vue-router` — Nuxt peer / runtime router (not imported directly in app code)
  - `@emnapi/core` and `@emnapi/runtime` — direct pins so Linux `npm ci` can resolve Tailwind Oxide / WASI optional natives in the lockfile (do not remove without verifying CI on ubuntu-latest)
## Security reports

Please do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
