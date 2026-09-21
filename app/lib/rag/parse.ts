// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { RAG_MAX_FILE_BYTES } from '~/lib/rag/types'
import { RagError } from '~/lib/rag/chunk'

const TEXT_EXT = /\.(txt|md|markdown|mdx)$/i
const PDF_EXT = /\.pdf$/i

export function detectDocumentKind(filename: string, mime = ''): 'text' | 'pdf' | 'unsupported' {
  const lowerMime = mime.toLowerCase()
  if (PDF_EXT.test(filename) || lowerMime === 'application/pdf') return 'pdf'
  if (
    TEXT_EXT.test(filename)
    || lowerMime.startsWith('text/')
    || lowerMime === 'application/markdown'
  ) {
    return 'text'
  }
  return 'unsupported'
}

export async function readDocumentText(file: File): Promise<string> {
  if (file.size <= 0) throw new RagError('rag.emptyFile')
  if (file.size > RAG_MAX_FILE_BYTES) throw new RagError('rag.fileTooLarge')

  const kind = detectDocumentKind(file.name, file.type)
  if (kind === 'unsupported') throw new RagError('rag.unsupportedType')

  if (kind === 'text') {
    const text = await file.text()
    if (!text.trim()) throw new RagError('rag.emptyFile')
    return text
  }

  const buffer = await file.arrayBuffer()
  const text = extractPdfText(buffer)
  if (!text.trim()) throw new RagError('rag.pdfNoText')
  return text
}

/**
 * Best-effort PDF text extraction without pdf.js (keeps Pages/offline lean).
 * Reads literal strings from content streams; encrypted/image-only PDFs fail clearly.
 */
export function extractPdfText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i]!)
  }

  if (raw.includes('/Encrypt')) {
    throw new RagError('rag.pdfEncrypted')
  }

  const parts: string[] = []
  const parenRe = /\((?:\\.|[^\\)])*\)/g
  let match: RegExpExecArray | null
  while ((match = parenRe.exec(raw)) !== null) {
    const token = match[0]
    const after = raw.slice(match.index + token.length, match.index + token.length + 12)
    if (!/Tj|TJ|'|"/.test(after) && parts.length > 200) continue
    const decoded = decodePdfLiteral(token.slice(1, -1))
    if (decoded.trim()) parts.push(decoded)
  }

  const hexRe = /<([0-9A-Fa-f\s]+)>[\s]*Tj/g
  while ((match = hexRe.exec(raw)) !== null) {
    const hex = match[1]!.replace(/\s+/g, '')
    if (hex.length % 2 !== 0) continue
    let out = ''
    for (let i = 0; i < hex.length; i += 2) {
      out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
    }
    if (out.trim()) parts.push(out)
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function decodePdfLiteral(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(Number.parseInt(oct, 8)))
}
