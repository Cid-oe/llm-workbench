# OpenSSF Best Practices — Gold evidence

Project entry: [https://www.bestpractices.dev/projects/14694](https://www.bestpractices.dev/projects/14694)

Silver is **100%**. Fill Gold fields from [the Gold criteria list](https://www.bestpractices.dev/en/criteria/2) with the answers below.

| Criterion | Status | Justification / URL |
| --- | --- | --- |
| achieve_silver | Met | Silver badge on 2026-09-18. Evidence: [openssf-silver.md](openssf-silver.md) |
| bus_factor | Met | [GOVERNANCE.md#bus-factor](https://github.com/ale94lko/llm-workbench/blob/main/GOVERNANCE.md#bus-factor) — two CODEOWNERS maintainers |
| contributors_unassociated | Met | [GOVERNANCE.md#independent-maintainers](https://github.com/ale94lko/llm-workbench/blob/main/GOVERNANCE.md#independent-maintainers) — [@ale94lko](https://github.com/ale94lko) and [@leoflavio1989](https://github.com/leoflavio1989) are independent people (separate GitHub accounts; no shared employer) |
| copyright_per_file | Met | `Copyright (c) YYYY` plus SPDX in each source file. Checker: [scripts/check-license-headers.mjs](https://github.com/ale94lko/llm-workbench/blob/main/scripts/check-license-headers.mjs) |
| license_per_file | Met | `SPDX-License-Identifier: MIT` in each source file. Same checker; project license [LICENSE](https://github.com/ale94lko/llm-workbench/blob/main/LICENSE) |
| repo_distributed | Met | GitHub is the canonical distributed git repo: https://github.com/ale94lko/llm-workbench |
| small_tasks | Met | Issues labeled `good first issue` (e.g. [#93](https://github.com/ale94lko/llm-workbench/issues/93), [#96](https://github.com/ale94lko/llm-workbench/issues/96), [#97](https://github.com/ale94lko/llm-workbench/issues/97)). Policy: [CONTRIBUTING.md#small-tasks](https://github.com/ale94lko/llm-workbench/blob/main/CONTRIBUTING.md#small-tasks) |
| require_2FA | Met | GitHub requires 2FA to contribute on github.com. Project MUST: [GOVERNANCE.md#two-factor-authentication-2fa](https://github.com/ale94lko/llm-workbench/blob/main/GOVERNANCE.md#two-factor-authentication-2fa) |
| secure_2FA | Met | Same section: TOTP and/or passkeys / security keys; SMS-only is not accepted for maintainers |
| code_review_standards | Met | [CONTRIBUTING.md#code-review-standards](https://github.com/ale94lko/llm-workbench/blob/main/CONTRIBUTING.md#code-review-standards) |
| two_person_review | Met | PRs to `main` require at least one approving review from a CODEOWNER other than the author. [CONTRIBUTING.md#two-person-review](https://github.com/ale94lko/llm-workbench/blob/main/CONTRIBUTING.md#two-person-review) |
| build_reproducible | Met | [docs/reproducible-build.md](https://github.com/ale94lko/llm-workbench/blob/main/docs/reproducible-build.md) — `npm ci` from the lockfile + tagged commit; CI `fresh` repeats install → build → coverage |
| test_invocation | Met | `npm test` / `npm run test:coverage` documented in README and CONTRIBUTING |
| test_continuous_integration | Met | GitHub Actions `test` job on every PR and push to `main` |
| test_statement_coverage90 | Met | Vitest v8 thresholds: statements ≥ 90% (`vitest.config.ts`). CI fails below the floor |
| test_branch_coverage80 | Met | Same file: branches ≥ 80% |
| crypto_used_network | Met | Cloud providers over HTTPS; optional Ollama is loopback HTTP |
| crypto_tls12 | Met | Browser/Node TLS 1.2+; no custom TLS stack |
| hardened_site | Met | HTTPS GitHub + GitHub Pages; CSP / `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` in `nuxt.config.ts` (`app.head` meta + Nitro `routeRules`) |
| security_review | Met | Dated review: [docs/security-review-2026-09.md](https://github.com/ale94lko/llm-workbench/blob/main/docs/security-review-2026-09.md) |
| hardening | Met | [docs/hardening.md](https://github.com/ale94lko/llm-workbench/blob/main/docs/hardening.md) |
| dynamic_analysis | Met | Vitest (happy-dom) plus Playwright smoke against generated static output. Memory-unsafe languages are N/A (TypeScript/Vue only) |
| dynamic_analysis_enable_assertions | Met | Production TypeScript has no `assert()` to enable; Vitest `expect` assertions run on every CI `test` job. Vue/Node are memory-safe |

Badge form: https://www.bestpractices.dev/en/projects/14694/gold/edit
