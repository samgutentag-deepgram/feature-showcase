import { describe, expect, it } from 'vitest'
import feature, { DEFAULT_TERMS, MAX_TERMS, markTerms, parseTerms, phraseFor } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models.find((m) => m.id === 'nova-3')!
const ctx = { model, mode: feature.modes[0], busy: false }

describe('keyterm', () => {
  it('sends one repeated param per term, the form verified live', () => {
    const params = feature.params({ on: true, terms: DEFAULT_TERMS }, ctx)
    expect(describeRequest(model, params)).toBe(
      '/v1/listen?model=nova-3&smart_format=true&keyterm=Kallistrum&keyterm=Vexmoor&keyterm=Trellisync',
    )
  })

  it('sends no keyterm at all when off or empty', () => {
    expect(feature.params({ on: false, terms: DEFAULT_TERMS }, ctx)).toEqual({})
    expect(feature.params({ on: true, terms: ' , ,' }, ctx)).toEqual({})
  })

  it('encodes a multi-word term as one param', () => {
    expect(describeRequest(model, feature.params({ on: true, terms: 'Trellis Sync' }, ctx))).toBe(
      '/v1/listen?model=nova-3&smart_format=true&keyterm=Trellis+Sync',
    )
  })

  it('trims, dedupes, and caps what a visitor types', () => {
    expect(parseTerms(' Vexmoor ,vexmoor,  Trellis   Sync ')).toEqual(['Vexmoor', 'Trellis Sync'])
    expect(parseTerms(Array.from({ length: 40 }, (_, i) => `t${i}`).join(','))).toHaveLength(MAX_TERMS)
  })

  it('marks the terms Deepgram got right, and nothing else', () => {
    const parts = markTerms('Restart Kallistrum, then open Trello Sync.', ['Kallistrum', 'Trellisync'])
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Kallistrum'])
    expect(parts.map((p) => p.text).join('')).toBe('Restart Kallistrum, then open Trello Sync.')
  })

  it('suggests a phrase that says every typed term', () => {
    const terms = parseTerms('Kallistrum, Vexmoor, Trellisync, Quorvane')
    const phrase = phraseFor(terms)
    for (const t of terms) expect(phrase).toContain(t)
    expect(feature.phrases?.({ on: false, terms: DEFAULT_TERMS }, ctx)).toEqual([
      'Welcome to the Kallistrum onboarding. Today we will set up Vexmoor and connect it to your Trellisync dashboard.',
    ])
  })
})
