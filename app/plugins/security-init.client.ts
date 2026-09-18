// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export default defineNuxtPlugin(async () => {
  const provider = useProviderStore()
  const security = useSecurityStore()

  provider.migrateLegacyStorage()
  provider.migrateDeprecatedModels()
  await security.bootstrapKeys()
})
