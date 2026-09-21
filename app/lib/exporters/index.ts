// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ExportLanguage, ExportOptions } from './types'
import { exportCurl } from './curl'
import { exportJavaScript } from './javascript'
import { exportLangchainPy, exportLangchainTs } from './langchain'
import { exportPhp } from './php'
import { exportPython } from './python'
import { exportSdkTypescript } from './sdkTypescript'
import { exportVercelAi } from './vercelAi'

export type { ExportLanguage, ExportOptions }
export { envVarName } from './shared'

export function exportCode(language: ExportLanguage, opts: ExportOptions): string {
  switch (language) {
    case 'javascript': return exportJavaScript(opts)
    case 'python': return exportPython(opts)
    case 'curl': return exportCurl(opts)
    case 'php': return exportPhp(opts)
    case 'sdk-typescript': return exportSdkTypescript(opts)
    case 'vercel-ai': return exportVercelAi(opts)
    case 'langchain-ts': return exportLangchainTs(opts)
    case 'langchain-py': return exportLangchainPy(opts)
  }
}
