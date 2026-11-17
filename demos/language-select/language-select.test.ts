import { describe, expect, it } from 'vitest'
import feature, { verdict } from '.'
import { describeRequest } from '../../shared/common/config'
import { LANGUAGES, PHRASES, SORTED } from './languages'

const model = feature.models[0]
const ctx = { model, mode: feature.modes[0], busy: false }

describe('language-select', () => {
  it('sends the one language picked, the form verified live', () => {
    expect(describeRequest(model, feature.params({ spoken: 'en', language: 'es' }, ctx))).toBe(
      '/v1/listen?model=nova-3&smart_format=true&language=es',
    )
  })

  it('is Nova-3 only, since /v2/listen rejects language', () => {
    expect(feature.models.map((m) => m.endpoint)).toEqual(['v1'])
    expect(model.note).toMatch(/^Nova-3 only\. Flux does not support language yet/)
  })

  it('has a line to read in every language the picker offers', () => {
    expect([...SORTED].sort()).toEqual([...LANGUAGES].sort())
    for (const l of LANGUAGES) {
      expect(PHRASES[l]).toBeTruthy()
      expect(feature.phrases?.({ spoken: l, language: 'en' }, ctx)).toEqual([PHRASES[l]])
    }
  })

  it('covers every language sent in its variants', () => {
    expect(new Set(feature.variants?.map((v) => v.language))).toEqual(new Set(LANGUAGES))
  })

  it('says why a wrong pick came back empty', () => {
    expect(verdict({ spoken: 'es', language: 'en' }, false)).toMatch(/listened for English only, so the Spanish speech was dropped/)
    expect(verdict({ spoken: 'en', language: 'es' }, true)).toMatch(/as Spanish words/)
    expect(verdict({ spoken: 'fr', language: 'fr' }, true)).toMatch(/a match/)
  })
})
