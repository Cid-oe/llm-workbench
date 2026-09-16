# Developer notes

## Fresh clone verification

To prove the repo installs and tests on a clean tree (no dirty `node_modules`, no live providers required):

```bash
# Unix
./scripts/verify-fresh-clone.sh

# Windows PowerShell
./scripts/verify-fresh-clone.ps1

# Cross-platform (preferred)
npm run verify:fresh
```

The script runs, in order, and **exits non-zero** on the first failure:

1. `npm ci` — lockfile-faithful install
2. `npm run build` — production Nuxt build
3. `npm run test:coverage` — unit suite + coverage thresholds

### Offline unit tests (no Ollama / API keys)

The default Vitest suite (`npm test`, `npm run test:coverage`) uses **happy-dom** and **mocked `fetch`**. Specs such as `tests/toolCall.test.ts`, `tests/localDiscovery.test.ts`, and provider/stream tests do **not** require:

- a running Ollama or LM Studio process
- real OpenAI / Anthropic / Gemini / Groq API keys
- browser localStorage from a previous session (`tests/setup.ts` stubs storage)

Optional runtime features (Detect local LLMs, Compare against cloud providers, Playwright smoke against static Pages) need a browser and/or local servers; they are outside this fresh-clone gate.

Playwright smoke (`npm run test:e2e:smoke`) needs a prior `npm run generate` and Chromium; it is covered separately by `.github/workflows/smoke-e2e.yml` (non-blocking).
