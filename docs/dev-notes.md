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

CI runs the same command on a **dedicated** `fresh` job in `.github/workflows/ci.yml` (clean runner — not nested after the `quality` job’s `npm ci`). A failure fails the workflow.

### Docker Compose boot

Production-like stack without live providers:

```bash
cp .env.example .env   # optional overrides; compose already sets NUXT_* / HOST / PORT
docker compose up --build
curl -fsS http://localhost:3000/api/health
```

Port **3000** must be free. Ollama is optional (`docker compose --profile ollama up --build`).

### Offline unit tests (no Ollama / API keys)

The default Vitest suite (`npm test`, `npm run test:coverage`) uses **happy-dom** and **mocked `fetch`**. Specs such as `tests/toolCall.test.ts`, `tests/localDiscovery.test.ts`, and provider/stream tests do **not** require:

- a running Ollama or LM Studio process
- real OpenAI / Anthropic / Gemini / Groq API keys
- browser localStorage from a previous session (`tests/setup.ts` stubs storage)

Optional runtime features (Detect local LLMs, Compare against cloud providers, Playwright smoke against static Pages) need a browser and/or local servers; they are outside this fresh-clone gate.

Playwright smoke (`npm run test:e2e:smoke`) needs a prior `npm run generate` and Chromium; it is covered separately by `.github/workflows/smoke-e2e.yml` (non-blocking).

## API input validation

Every **POST** (or other body-bearing) Nitro handler under `server/api/` must validate the body at the boundary before calling providers or mutating state.

Pattern used by `server/api/stream.post.ts`:

1. `const body = await readBody(event)`
2. Run a dedicated validator (for stream: `validateStreamRequest` in `app/lib/validateStreamRequest.ts`)
3. On failure: `throw createError({ statusCode: 400, message: parsed.error })` — structured client error, not an unhandled throw
4. Only then call upstream `fetch` / business logic

Coverage lives in:

- `tests/api/stream.test.ts` — malformed bodies → structured 400, no upstream fetch
- `tests/validateStreamRequest.test.ts` — validator edge cases
- `tests/server/stream.post.test.ts` — happy path + upstream error mapping

### GET-only routes (no body schema)

These handlers take **no request body** today; do not invent a body schema for them unless they gain write semantics:

- `server/api/health.get.ts` — liveness/uptime snapshot
- `server/api/metrics.get.ts` — runtime counters

If you add a new write endpoint, copy the stream validation pattern (or share a small schema helper) and add a paired unit test for the 400 path.
