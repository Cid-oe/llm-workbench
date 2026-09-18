## Security

I take the security of my software products and services seriously, which
includes all source code repositories managed through GitHub.

If you believe you have found a security vulnerability in any repository, please
report it to me as described below.

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them privately using one of:

1. [GitHub Security Advisories](https://github.com/ale94lko/llm-workbench/security/advisories/new) (preferred), or
2. Email [ale94lko@gmail.com](mailto:ale94lko@gmail.com) over TLS (HTTPS mail providers).

Please include the requested information listed below (as much as you can
provide) to help me better understand the nature and scope of the possible
issue:

* Type of issue (e.g. cross-site scripting, secret leakage, broken vault crypto, etc.)
* Full paths of source file(s) related to the manifestation of the issue
* The location of the affected source code (tag/branch/commit or direct URL)
* Any special configuration required to reproduce the issue
* Step-by-step instructions to reproduce the issue
* Proof-of-concept or exploit code (if possible)
* Impact of the issue, including how an attacker might exploit the issue

This information will help me triage your report more quickly.

## Preferred Languages

We prefer all communications to be in English or Spanish.

## Policy

We follow the principle of [Coordinated Vulnerability Disclosure](https://www.iso.org/standard/72311.html).

## Vulnerability response process

1. Acknowledge private reports within **14 days** (usually sooner).
2. Triage severity and reproduce when possible.
3. Develop and test a fix on a private branch when needed.
4. Release a patched signed tag and document the issue in `CHANGELOG.md` / a GitHub Security Advisory without unnecessary delay.
5. Credit reporters who want recognition (see below).

There is no separate security team beyond the [maintainers](GOVERNANCE.md#roles-and-responsibilities).

## Credit

For vulnerabilities resolved in the last 12 months, we credit reporter(s) in the GitHub Security Advisory and/or `CHANGELOG.md`, unless they request anonymity. If none were resolved in that window, there is nothing to credit yet.

## Security requirements

What users can and cannot expect is the [assurance case](docs/assurance-case.md) (threat model, trust boundaries, secure design principles, and common-weakness mitigations). Architecture is in [docs/architecture.md](docs/architecture.md). Hardening mechanisms are listed in [docs/hardening.md](docs/hardening.md).

In short:

* **Can expect:** local-first encrypted vault for API keys; allowlist validation of stream inputs; HTTPS to cloud providers with platform TLS certificate verification; no secrets in git or code exporters.
* **Cannot expect:** protection of an unlocked browser profile; confidentiality of prompts against the LLM provider you chose; a server-side key vault on GitHub Pages.

## Vault model (client-side)

llm-workbench encrypts provider API keys in the browser with AES-256-GCM. The derived CryptoKey is stored only for the current tab session (`sessionStorage`) and is never persisted to `localStorage`. A cold start leaves the encrypted vault on disk until the user unlocks with their master password.

The ciphertext payload is versioned (`v: 1` today: AES-256-GCM + PBKDF2-SHA-256 in `app/lib/crypto.ts`). A future version can switch KDF or AEAD without a flag day on this repository's source layout.

Changing the master password (Settings → Change master password) re-derives the AES key, clears the prior session key via `clearSessionCryptoKey`, writes the new session key, and re-wraps the encrypted API-key payload. Locking the vault remains UI-only and does not clear session keys. See the README Security section for user-facing details.
