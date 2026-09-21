// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import {
  RagError,
  chunkText,
  cosineSimilarity,
  detectDocumentKind,
  embedLocal,
  embedText,
  extractPdfText,
  formatRetrievedContext,
  injectRagContext,
  normalizeChunkOptions,
  rankChunks,
  readDocumentText,
  type RagChunk,
} from '../app/lib/rag'

describe('rag chunking', () => {
  it('splits text with overlap and normalizes options', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, { chunkSize: 40, chunkOverlap: 8 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(c => c.length <= 20 || c.includes(' '))).toBe(true)
    expect(normalizeChunkOptions({ chunkSize: 10, chunkOverlap: 99 })).toEqual({
      chunkSize: 64,
      chunkOverlap: 63,
    })
    expect(normalizeChunkOptions({ chunkSize: 200, chunkOverlap: 40 })).toEqual({
      chunkSize: 200,
      chunkOverlap: 40,
    })
    expect(chunkText('   ')).toEqual([])
  })
})

describe('rag parse', () => {
  it('detects text and pdf kinds', () => {
    expect(detectDocumentKind('notes.md')).toBe('text')
    expect(detectDocumentKind('a.pdf', 'application/pdf')).toBe('pdf')
    expect(detectDocumentKind('bin.exe')).toBe('unsupported')
  })

  it('reads text files and rejects oversized / empty ones', async () => {
    const ok = new File(['Hello RAG'], 'doc.txt', { type: 'text/plain' })
    expect(await readDocumentText(ok)).toContain('Hello RAG')

    await expect(readDocumentText(new File([''], 'empty.txt'))).rejects.toBeInstanceOf(RagError)
    const big = new File([new Uint8Array(600 * 1024)], 'big.txt', { type: 'text/plain' })
    await expect(readDocumentText(big)).rejects.toMatchObject({ message: 'rag.fileTooLarge' })
    await expect(readDocumentText(new File(['x'], 'x.bin'))).rejects.toMatchObject({
      message: 'rag.unsupportedType',
    })
  })

  it('extracts literal PDF strings and rejects encrypted payloads', () => {
    const pdf = '%PDF-1.4\nBT /F1 12 Tf (Hello PDF) Tj ET\n'
    const bytes = new TextEncoder().encode(pdf)
    expect(extractPdfText(bytes.buffer)).toContain('Hello PDF')

    const encrypted = new TextEncoder().encode('%PDF-1.4 /Encrypt (secret) Tj')
    expect(() => extractPdfText(encrypted.buffer)).toThrow(/pdfEncrypted/)
  })
})

describe('rag embeddings and ranking', () => {
  it('embeds locally and ranks similar chunks higher', () => {
    const query = embedLocal('quantum computing basics')
    const chunks: RagChunk[] = [
      {
        id: '1',
        documentId: 'd',
        documentName: 'a.md',
        index: 0,
        text: 'Quantum computing uses qubits',
        embedding: embedLocal('Quantum computing uses qubits'),
      },
      {
        id: '2',
        documentId: 'd',
        documentName: 'a.md',
        index: 1,
        text: 'Pasta recipes with tomato',
        embedding: embedLocal('Pasta recipes with tomato'),
      },
    ]
    const hits = rankChunks(query, chunks, 2)
    expect(hits[0]?.chunk.id).toBe('1')
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score)
    expect(cosineSimilarity(query, query)).toBeCloseTo(1)
  })

  it('calls Ollama embeddings through an injected fetch', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      embedding: [0.1, 0.2, 0.3, 0.4],
    }), { status: 200 }))
    const vec = await embedText('hi', 'ollama', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'nomic-embed-text',
    })
    expect(fetchImpl).toHaveBeenCalled()
    expect(vec).toHaveLength(4)
    expect(Math.hypot(...vec)).toBeCloseTo(1)

    const failFetch = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(embedText('x', 'ollama', {
      fetchImpl: failFetch as unknown as typeof fetch,
    })).rejects.toMatchObject({ message: 'rag.ollamaUnreachable' })

    const badBody = vi.fn(async () => new Response(JSON.stringify({ embedding: 'nope' }), { status: 200 }))
    await expect(embedText('x', 'ollama', {
      fetchImpl: badBody as unknown as typeof fetch,
    })).rejects.toMatchObject({ message: 'rag.ollamaEmbedFailed' })

    const httpFail = vi.fn(async () => new Response('err', { status: 500 }))
    await expect(embedText('x', 'ollama', {
      fetchImpl: httpFail as unknown as typeof fetch,
    })).rejects.toMatchObject({ message: 'rag.ollamaEmbedFailed' })
  })
})

describe('rag prompt injection', () => {
  it('fills {{rag_context}} or appends a system section', () => {
    const hits = [{
      score: 0.9,
      chunk: {
        id: 'c1',
        documentId: 'd1',
        documentName: 'guide.md',
        index: 0,
        text: 'Use vault keys only in the browser.',
        embedding: [],
      },
    }]

    const viaVar = injectRagContext({
      systemPrompt: 'Context:\n{{rag_context}}',
      userPrompt: 'Explain vault',
      variables: {},
      hits,
    })
    expect(viaVar.injectedVia).toBe('variable')
    expect(viaVar.variables.rag_context).toContain('guide.md')
    expect(formatRetrievedContext(hits)).toContain('[1]')

    const viaSystem = injectRagContext({
      systemPrompt: 'You are helpful.',
      userPrompt: 'Explain vault',
      variables: { topic: 'vault' },
      hits,
    })
    expect(viaSystem.injectedVia).toBe('system')
    expect(viaSystem.systemPrompt).toContain('## Retrieved context')
    expect(viaSystem.systemPrompt).toContain('Use vault keys')

    const none = injectRagContext({
      systemPrompt: 'x',
      userPrompt: 'y',
      variables: {},
      hits: [],
    })
    expect(none.injectedVia).toBe('none')
  })
})
