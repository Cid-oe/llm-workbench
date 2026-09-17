import type { ExportLanguage, ExportOptions } from './types'
import { exportCurl } from './curl'
import { exportJavaScript } from './javascript'
import { exportPhp } from './php'
import { exportPython } from './python'

export type { ExportLanguage, ExportOptions }
export { envVarName } from './shared'

export function exportCode(language: ExportLanguage, opts: ExportOptions): string {
  switch (language) {
    case 'javascript': return exportJavaScript(opts)
    case 'python': return exportPython(opts)
    case 'curl': return exportCurl(opts)
    case 'php': return exportPhp(opts)
  }
}
