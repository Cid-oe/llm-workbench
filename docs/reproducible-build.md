# Reproducible builds

OpenSSF Gold (`build_reproducible`) asks that the project have a documented way to recreate a release from source. llm-workbench is a TypeScript/Vue SPA: we do **not** ship native binaries. The artifacts that matter are:

- `package-lock.json` (exact npm graph)
- a git tag on `main` (`vX.Y.Z`)
- the static site produced by `npm run generate` (and, for Docker, the image built from `Dockerfile`)

Vite/Nuxt hashes in filenames are content-addressed. Bit-for-bit identity of every hashed chunk across machines is **not** claimed (timestamps and toolchain patch versions can still differ). Repeatable **inputs** and a **passing CI rebuild** are the contract.

## Rebuild from a tagged commit

```bash
git clone https://github.com/ale94lko/llm-workbench.git
cd llm-workbench
git checkout v0.2.0   # or another signed tag
git verify-tag v0.2.0
npm ci
npm run generate
```

`npm ci` installs from the committed lockfile (no floating ranges). `npm run generate` is the same command GitHub Pages uses.

Docker (production-like Node server, not Pages):

```bash
cp .env.example .env
docker compose up --build
```

## What CI repeats

The `fresh` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) checks out a clean runner and runs `npm run verify:fresh` (`npm ci` → build → `npm run test:coverage`). A failed rebuild fails the workflow and blocks merge / Pages deploy.

See also [CONTRIBUTING.md](../CONTRIBUTING.md) (Fresh clone verification) and [docs/releasing.md](releasing.md).
