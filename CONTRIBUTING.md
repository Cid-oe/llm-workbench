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

CI runs lint, typecheck, tests with coverage, and `npm audit --audit-level=high` on every push and pull request.

## Commit style

- Keep each feature or fix in its own small commit (or PR), including the tests that pin the new behavior.
- Do not mix formatting, refactors, and features in a single commit.
- Prefer shipping tests together with the code they cover.

## Workflow

1. Search [existing issues](https://github.com/ale94lko/llm-playground-os/issues) before opening a new one. Use an [issue form](https://github.com/ale94lko/llm-playground-os/issues/new/choose) when creating one.
2. Fork the repository and create a focused branch.
3. Add or update tests for the behavior you change.
4. Open a pull request and [link it to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue).
5. Enable [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.

## Security reports

Please do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
