// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

const SECRET_KEY_RE = /^(?:api[_-]?key|(?:openai|anthropic|gemini|groq)[_-]?key|.*(?:secret|password|authorization|credential).*|(?:access|auth|bearer|refresh|id)[_-]?token)$/i

export function isSecretFrontmatterKey(key: string): boolean {
  return SECRET_KEY_RE.test(key.trim())
}
