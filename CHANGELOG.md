# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Switch from MIT to a source-available license with an AI-training restriction
- Document optional provider API keys in `.env.example` and the README env table ([#8](https://github.com/ale94lko/llm-playground-os/issues/8))
- Raise Vitest coverage thresholds to 60% for lines, functions, and statements ([#9](https://github.com/ale94lko/llm-playground-os/issues/9))

### Added
- Vue page/component tests for the playground run path, metrics page, and `LatencyTimeline` ([#9](https://github.com/ale94lko/llm-playground-os/issues/9))
- ESLint (`@nuxt/eslint`) and `nuxt typecheck` gates on every push and pull request
- Dedicated CI workflow with `npm audit --audit-level=high`, lint, typecheck, and coverage
- Vitest coverage report (`npm run test:coverage`) with a 60% line/function/statement threshold
- Unit tests for `useProviderStore`, `usePromptStore`, `streamClient`, request validation, and structured logging
- `/api/health` and `/api/metrics` endpoints for Node/Docker deployments
- Structured JSON logger with secret redaction and a client error-tracking plugin
- Input validation for stream proxy and browser-direct requests
- Docker image, `docker-compose.yml`, and a Dev Container for one-command startup
- `.env.example` documenting `NUXT_APP_BASE_URL`, `NUXT_DEVTOOLS`, and optional provider API keys
- Dependabot weekly updates for npm and GitHub Actions
- Root `CONTRIBUTING.md`

### Security
- Code exporter now emits environment-variable placeholders (`process.env.*`, `os.environ[...]`, `$VAR`, `getenv(...)`) instead of interpolating API keys into snippets

### Changed
- `NUXT_DEVTOOLS=false` actually disables DevTools (previously only `0` was treated as off)
