# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Rename repository and product branding from `llm-playground-os` / LLM Playground OS to **`llm-workbench` / LLM Workbench** (avoids demo/template naming for buyers and Pages base path `/llm-workbench/`)

### Fixed
- Stop persisting the vault AES CryptoKey in `localStorage`; session-only key + cold-start unlock ([#21](https://github.com/ale94lko/llm-workbench/issues/21))
- Derive vault AES keys as extractable so session/persisted key storage can export them ([#20](https://github.com/ale94lko/llm-workbench/issues/20))

### Removed
- Unused direct dependency `class-variance-authority` ([#11](https://github.com/ale94lko/llm-workbench/issues/11))

### Added
- Discover local Ollama models via `/api/tags` with Refresh control and static fallback ([#23](https://github.com/ale94lko/llm-workbench/issues/23))
- Per-run temperature and max tokens controls on Compare, wired through providers and code export ([#22](https://github.com/ale94lko/llm-workbench/issues/22))
- Bulk CSV/JSON dataset runs on Compare with column→variable mapping, capped results table, and export ([#35](https://github.com/ale94lko/llm-workbench/issues/35))
- Git-friendly `.prompt` Markdown export/import with YAML frontmatter, prompt revision diffs, and secret stripping ([#36](https://github.com/ale94lko/llm-workbench/issues/36))
- Weekly `npm outdated` freshness workflow (non-failing summary + artifact) ([#11](https://github.com/ale94lko/llm-workbench/issues/11))
- Unit tests for Nitro `/api/stream`, `/api/health`, and `/api/metrics` handlers ([#19](https://github.com/ale94lko/llm-workbench/issues/19))
- Unit tests for `useSecurityStore` and crypto session persistence helpers ([#20](https://github.com/ale94lko/llm-workbench/issues/20))

## [0.1.0] - 2026-09-16

First tagged milestone after env onboarding docs, Vue coverage, typed stream errors, and contributor process.

### Changed
- Switch from MIT to a source-available license with an AI-training restriction
- Document optional provider API keys in `.env.example` and the README env table ([#8](https://github.com/ale94lko/llm-workbench/issues/8))
- Raise Vitest coverage thresholds to 60% for lines, functions, and statements ([#9](https://github.com/ale94lko/llm-workbench/issues/9))
- Stream client `onError` callbacks now receive typed `StreamError` values instead of raw strings ([#10](https://github.com/ale94lko/llm-workbench/issues/10))
- `NUXT_DEVTOOLS=false` actually disables DevTools (previously only `0` was treated as off)

### Added
- Conventional Commits requirement, feature+test pairing guidance, and commitlint on pull requests ([#12](https://github.com/ale94lko/llm-workbench/issues/12))
- Typed `StreamError` helper with log-safe serialization ([#10](https://github.com/ale94lko/llm-workbench/issues/10))
- Vue page/component tests for the playground run path, metrics page, and `LatencyTimeline` ([#9](https://github.com/ale94lko/llm-workbench/issues/9))
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
- Stream/client failures use typed `StreamError` with log-safe serialization; logger redaction documented in the README ([#10](https://github.com/ale94lko/llm-workbench/issues/10))

[Unreleased]: https://github.com/ale94lko/llm-workbench/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ale94lko/llm-workbench/releases/tag/v0.1.0
