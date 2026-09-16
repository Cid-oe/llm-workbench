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
docker compose up --build
```

The app is then available at [http://localhost:3000](http://localhost:3000).

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

- **`CI`** (`.github/workflows/ci.yml`) is the single quality gate on pull requests and on pushes to `main` (audit, lint, typecheck, coverage).
- **`Deploy to GitHub Pages`** (`.github/workflows/deploy-pages.yml`) does **not** re-run that gate on push to `main`. It starts via `workflow_run` after a successful **CI** run that was a **push to `main`**, checks out that exact commit, then only generates and publishes the static site.
- Failed CI on `main` blocks deploy. Manual `workflow_dispatch` on the deploy workflow still runs the full quality steps before `npm run generate`, so a broken site cannot be published that way either.
- Vitest uses `pool: 'threads'` with `isolate: false` to cut happy-dom startup cost; `tests/setup.ts` resets storage per test. Prefer not to rely on order-dependent global state.
- Coverage thresholds enforce lines/functions/statements (≥60%) and branches (≥50%).

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

- Ship each **feature** or **fix** with the **tests that pin it** in the same PR (and preferably the same focused commit).
- Prefer small, reviewable PRs. Do **not** mix bulk formatting, unrelated refactors, and features in one change.
- If a change is docs- or CI-only, a `docs:` / `ci:` commit without new product tests is fine.

Pull request commits are checked by the `commitlint` CI job (Dependabot PRs are exempt).

## Workflow

1. Search [existing issues](https://github.com/ale94lko/llm-workbench/issues) before opening a new one. Use an [issue form](https://github.com/ale94lko/llm-workbench/issues/new/choose) when creating one.
2. Fork the repository and create a focused branch.
3. Add or update tests for the behavior you change (same PR as the source change).
4. Use Conventional Commit messages (`feat:`, `fix:`, `test:`, …).
5. Open a pull request and [link it to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue).
6. Enable [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.

## Releases

This project uses [Semantic Versioning](https://semver.org/). Notable changes live in [`CHANGELOG.md`](CHANGELOG.md). Maintainers cut annotated tags (`v0.1.0`, …) from `main` and publish matching GitHub Releases from the changelog section.

## Dependencies

- Reproducible installs rely on the committed `package-lock.json` (`npm ci`). Do not hand-pin transitive packages.
- Dependabot opens weekly grouped PRs for npm and GitHub Actions.
- A weekly **Dependency freshness** workflow runs `npm outdated --long`, writes the result to the job summary, and uploads an artifact. It uses `continue-on-error: true` so outdated packages never fail the build.
- Direct packages that look unused to static scanners but are required:
  - `@pinia/nuxt` and `pinia-plugin-persistedstate` — loaded as Nuxt modules in `nuxt.config.ts`
  - `vue-router` — Nuxt peer / runtime router (not imported directly in app code)
  - `@emnapi/core` and `@emnapi/runtime` — required so `npm ci` can resolve Tailwind Oxide / WASI optional deps in the lockfile
## Security reports

Please do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
