# Contributing to LLM Playground OS

Thanks for helping improve this project. Please also read the [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/ale94lko/llm-playground-os.git
cd llm-playground-os
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

1. Search [existing issues](https://github.com/ale94lko/llm-playground-os/issues) before opening a new one. Use an [issue form](https://github.com/ale94lko/llm-playground-os/issues/new/choose) when creating one.
2. Fork the repository and create a focused branch.
3. Add or update tests for the behavior you change (same PR as the source change).
4. Use Conventional Commit messages (`feat:`, `fix:`, `test:`, …).
5. Open a pull request and [link it to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue).
6. Enable [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.

## Releases

This project uses [Semantic Versioning](https://semver.org/). Notable changes live in [`CHANGELOG.md`](CHANGELOG.md). Maintainers cut annotated tags (`v0.1.0`, …) from `main` and publish matching GitHub Releases from the changelog section.

## Security reports

Please do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
