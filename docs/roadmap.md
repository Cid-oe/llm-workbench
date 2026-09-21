# Roadmap

What this project intends to do (and not do) after **v1.0.0**. Updated with releases and major planning issues.

## Shipped in 1.0

- Local-first Compare with encrypted vault, parallel providers, metrics, history, and `.prompt` files
- MCP tools, in-browser RAG, LLM-as-a-Judge, and SDK / Vercel AI / LangChain export snippets
- OpenSSF-oriented CI: coverage floors, DCO, commitlint, Scorecard, offline unit proof

See [CHANGELOG.md](../CHANGELOG.md) for the full `1.0.0` notes.

## Do

- Keep the workbench local-first: API keys stay in the browser vault (AES-256-GCM), never in the git tree.
- Maintain OpenSSF Best Practices (Passing; pursue Silver/Gold criteria already mapped) and OpenSSF Scorecard health on `main`.
- Keep Vitest coverage at **≥ 90%** statements / **≥ 80%** branches (CI `test` / `fresh` jobs fail below the floor).
- Grow paired feature+test coverage for Compare, vault, exporters, MCP, RAG, and `/api/stream` validation.
- Keep Dependabot + `npm audit --audit-level=moderate` as the dependency-monitoring loop.
- Cut signed semver tags (`git tag -s`) when a meaningful batch lands; document verify steps in [releasing.md](releasing.md). Prefer **minor** bumps after `1.0.0` unless the change is breaking.
- Improve accessibility (keyboard, skip-link, contrast, screen-reader labels) and keep UI strings in the English i18n catalog so localization is possible.
- Support current LLM provider HTTPS APIs (OpenAI, Anthropic, Gemini, Groq) and local Ollama / LM Studio.
- Optional follow-ups (not committed dates): richer Transformers.js embeddings, website crawl ingest, LlamaIndex export target.

## Do not

- Become a hosted multi-tenant SaaS that stores customer API keys on a server.
- Proxy production GitHub Pages traffic through a third-party backend that sees keys.
- Drop CodeQL, commitlint, DCO, coverage gates, or required CI for convenience.
- Replace allowlist validation of `/api/stream` with denylist-only checks.
- Add a custom cryptographic protocol; stay on Web Crypto (AES-GCM / PBKDF2) with a versioned payload.

## Horizon notes

- Consumers run the SPA from GitHub Pages or Docker/`npm run build`. Breaking UI or vault-format changes will be called out in `CHANGELOG.md` and bump the **major** version.
- Silver / Gold Best Practices criteria are mapped in [openssf-silver.md](openssf-silver.md) and [openssf-gold.md](openssf-gold.md).
