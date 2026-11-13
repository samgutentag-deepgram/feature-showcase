import { describe, expect, it } from 'vitest'
import feature, { DEFAULT_PAIRS, replaceParams } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('replace', () => {
  it('offers Nova-3 only, since Flux does not support it', () => {
    expect(feature.models.map((m) => m.id)).toEqual(['nova-3'])
  })

  it('sends one repeated, URL-encoded param per pair, the exact form verified live', () => {
    expect(describeRequest(nova, feature.params({ on: true, pairs: DEFAULT_PAIRS }, ctx()))).toBe(
      '/v1/listen?model=nova-3&smart_format=true&replace=Acme%3AACME+Corp&replace=Monday%3AMon',
    )
  })

  it('sends nothing when off', () => {
    expect(feature.params({ on: false, pairs: DEFAULT_PAIRS }, ctx())).toEqual({})
  })

  it('drops colons and empty pairs, which would break the param', () => {
    expect(replaceParams([{ find: 'a:b', to: 'c' }, { find: '', to: 'x' }, { find: 'y', to: ' ' }])).toEqual(['ab:c'])
  })

  it('suggests a phrase that says the words being replaced', () => {
    const [line] = feature.phrases?.({ on: false, pairs: DEFAULT_PAIRS }, ctx()) ?? []
    expect(line).toMatch(/Acme/)
    expect(line).toMatch(/Monday/)
  })
})
