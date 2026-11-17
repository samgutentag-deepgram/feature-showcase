import { describe, expect, it } from 'vitest'
import feature, { DEFAULT_TERMS, MAX_TERMS, MAX_WEIGHT, parseKeywords } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models[0]
const ctx = { model, mode: feature.modes[0], busy: false }

describe('keywords-legacy', () => {
  it('sends one repeated term:weight param per term on nova-2', () => {
    const params = feature.params({ on: true, terms: DEFAULT_TERMS, boost: 2 }, ctx)
    expect(describeRequest(model, params)).toBe(
      '/v1/listen?model=nova-2&smart_format=true&keywords=Kallistrum%3A2&keywords=Vexmoor%3A2&keywords=Trellisync%3A2',
    )
  })

  it('sends no keywords at all when off or empty', () => {
    expect(feature.params({ on: false, terms: DEFAULT_TERMS, boost: 2 }, ctx)).toEqual({})
    expect(feature.params({ on: true, terms: ' , ,', boost: 2 }, ctx)).toEqual({})
  })

  it('keeps a typed weight, clamps it, and gives bare terms the picked boost', () => {
    expect(parseKeywords('Vexmoor:3, Kallistrum, um:1.5, big:99', 5)).toEqual([
      { term: 'Vexmoor', weight: 3 },
      { term: 'Kallistrum', weight: 5 },
      { term: 'um', weight: 1.5 },
      { term: 'big', weight: MAX_WEIGHT },
    ])
  })

  it('trims, dedupes, and caps what a visitor types', () => {
    expect(parseKeywords(' Vexmoor ,vexmoor:4,  Trellis   Sync ', 1).map((k) => k.term)).toEqual(['Vexmoor', 'Trellis Sync'])
    expect(parseKeywords(Array.from({ length: 40 }, (_, i) => `t${i}`).join(','), 1)).toHaveLength(MAX_TERMS)
  })

  it('offers Nova-2 alone and points to keyterm', () => {
    expect(feature.models.map((m) => m.params.model)).toEqual(['nova-2'])
    expect(model.note).toMatch(/^Nova-2 only\. Nova-3 and Flux use keyterm/)
  })
})
