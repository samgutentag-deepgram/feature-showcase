import { describe, expect, it } from 'vitest'
import feature from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('numerals', () => {
  it('opens on Flux, which takes numerals too', () => {
    expect(feature.models[0]).toBe(flux)
  })

  it('sends numerals either way on both models, the forms verified live', () => {
    expect(describeRequest(flux, feature.params({ on: true }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en&numerals=true')
    expect(describeRequest(flux, feature.params({ on: false }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en&numerals=false')
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&numerals=true')
  })
})
