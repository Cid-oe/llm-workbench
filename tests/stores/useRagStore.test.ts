// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { embedLocal } from '../../app/lib/rag/embed'
import { useRagStore } from '../../app/stores/useRagStore'

describe('useRagStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  it('ingests a text file and retrieves relevant chunks', async () => {
    const store = useRagStore()
    store.enabled = true
    store.chunkSize = 80
    store.chunkOverlap = 10
    store.topK = 2

    await store.addDocument(new File(
      ['Quantum computing uses superposition. Cooking pasta needs salt water.'],
      'notes.txt',
      { type: 'text/plain' },
    ))

    expect(store.documents).toHaveLength(1)
    expect(store.totalChunks).toBeGreaterThan(0)

    const hits = await store.retrieveForQuery('quantum superposition')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.chunk.text.toLowerCase()).toMatch(/quantum|superposition/)
  })

  it('prepares prompts with injected context', async () => {
    const store = useRagStore()
    store.enabled = true
    store.chunks = [{
      id: 'c1',
      documentId: 'd1',
      documentName: 'a.md',
      index: 0,
      text: 'Local embeddings never leave the browser.',
      embedding: embedLocal('Local embeddings never leave the browser.'),
    }]

    const prepared = await store.preparePrompts({
      systemPrompt: 'You are helpful.',
      userPrompt: 'Where do embeddings live?',
      variables: {},
      queryText: 'Where do embeddings live?',
    })
    expect(prepared.injectedVia).toBe('system')
    expect(prepared.systemPrompt).toContain('Local embeddings')
    expect(store.lastHits).toHaveLength(1)
  })

  it('removes documents and clears state', async () => {
    const store = useRagStore()
    await store.addDocument(new File(['hello world again'], 'a.txt', { type: 'text/plain' }))
    const id = store.documents[0]!.id
    store.removeDocument(id)
    expect(store.documents).toHaveLength(0)
    expect(store.chunks).toHaveLength(0)
    store.clearAll()
    expect(store.lastHits).toEqual([])
  })

  it('surfaces ingest limit errors and skips retrieve when disabled', async () => {
    const store = useRagStore()
    store.enabled = false
    expect(await store.retrieveForQuery('anything')).toEqual([])

    store.enabled = true
    for (let i = 0; i < 8; i++) {
      await store.addDocument(new File([`doc ${i} content here`], `d${i}.txt`, { type: 'text/plain' }))
    }
    await expect(store.addDocument(new File(['overflow'], 'x.txt', { type: 'text/plain' })))
      .rejects.toMatchObject({ message: 'rag.tooManyDocuments' })
    expect(store.error).toBe('rag.tooManyDocuments')
    store.clearError()
    expect(store.error).toBe('')
  })
})
