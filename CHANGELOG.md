# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Switch from MIT to a source-available license with an AI-training restriction

### Added
- ESLint (`@nuxt/eslint`) and `nuxt typecheck` gates on every push and pull request
- Dedicated CI workflow with `npm audit --audit-level=high`, lint, typecheck, and coverage
- Vitest coverage report (`npm run test:coverage`) with a 50% line/function/statement threshold
- Unit tests for `useProviderStore`, `streamClient`, request validation, and structured logging
- `/api/health` and `/api/metrics` endpoints for Node/Docker deployments
- Structured JSON logger with secret redaction and a client error-tracking plugin
- Input validation for stream proxy and browser-direct requests
- Docker image, `docker-compose.yml`, and a Dev Container for one-command startup
- `.env.example` documenting `NUXT_APP_BASE_URL` and `NUXT_DEVTOOLS`
- Dependabot weekly updates for npm and GitHub Actions
- Root `CONTRIBUTING.md`

### Security
- Code exporter now emits environment-variable placeholders (`process.env.*`, `os.environ[...]`, `$VAR`, `getenv(...)`) instead of interpolating API keys into snippets

### Changed
- `NUXT_DEVTOOLS=false` actually disables DevTools (previously only `0` was treated as off)
