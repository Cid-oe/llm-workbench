import { exportCode as exportCodeImpl, envVarName, type ExportLanguage, type ExportOptions } from '~/lib/exporters'

export type { ExportLanguage, ExportOptions }
export { envVarName }

export function useCodeExporter() {
  return { exportCode: exportCodeImpl }
}
