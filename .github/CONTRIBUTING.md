# Welcome to LLM Playground OS contributing guide

Thank you for investing your time in contributing to our project! Contributions are always **welcome and recommended**!

The canonical guide lives in the repository root: [CONTRIBUTING.md](../CONTRIBUTING.md).

Read our [Code of Conduct](https://github.com/ale94lko/llm-playground-os/blob/main/.github/CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## Getting started

1. Fork the repository.
2. Create a working branch.
3. Copy env defaults and install:

   ```bash
   cp .env.example .env
   npm install
   npm run lint
   npm run typecheck
   npm test
   ```

4. Keep changes small: one feature or fix per commit/PR, with tests that pin the new behavior.
5. Open a pull request and [link it to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue) if you are solving one.
