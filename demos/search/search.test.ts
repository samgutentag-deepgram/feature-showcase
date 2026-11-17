import { beforeEach, describe, expect, it } from 'vitest'
import feature, { DEFAULT_TERMS, foundSnippets, gatherSearch, markSnippets, parseTerms, resetSearch } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models[0]
const ctx = { model, mode: feature.modes[0], busy: false }

// Shaped like the final Results messages Nova-3 sent on 2026-11-16.
const final = (start: number, search?: unknown) => ({ type: 'Results', is_final: true, start, channel: { alternatives: [{ transcript: 'x' }], search } })
const one = (query: string, confidence: number, snippet: string, at: number) => [{ query, hits: [{ confidence, start: at, end: at + 0.5, snippet }] }]

describe('search', () => {
  beforeEach(resetSearch)

  it('sends one search param per term, and none when empty', () => {
    expect(feature.params({ terms: DEFAULT_TERMS }, ctx)).toEqual({ search: ['Kallistrum', 'Trellisync'] })
    expect(feature.params({ terms: ' , ' }, ctx)).toEqual({})
    expect(describeRequest(model, feature.params({ terms: DEFAULT_TERMS }, ctx))).toContain('search=Kallistrum&search=Trellisync')
  })

  it('dedupes terms', () => {
    expect(parseTerms('a, A, b')).toEqual(['a', 'b'])
  })

  it('gathers hits across final results and starts over on a new stream', () => {
    gatherSearch(final(0, one('Kallistrum', 0.07, 'new product', 0.3)))
    const run1 = gatherSearch(final(1.2, one('Kallistrum', 0.96, 'colistrum', 1.2)))!
    expect(run1[0].hits.map((h) => h.snippet)).toEqual(['colistrum', 'new product'])
    expect(gatherSearch({ type: 'Results', is_final: false, start: 2 })).toBeUndefined()
    const run2 = gatherSearch(final(0, one('Kallistrum', 0.9, 'kallistrum', 0.4)))!
    expect(run2[0].hits).toHaveLength(1)
  })

  it('marks only confident snippets', () => {
    const found = [{ query: 'Kallistrum', hits: [{ confidence: 0.96, start: 1, end: 2, snippet: 'colistrum' }, { confidence: 0.1, start: 0, end: 1, snippet: 'new product' }] }]
    expect(foundSnippets(found)).toEqual(['colistrum'])
    expect(markSnippets('our new product colistrum ships', ['colistrum']).filter((p) => p.hit).map((p) => p.text)).toEqual(['colistrum'])
  })
})
