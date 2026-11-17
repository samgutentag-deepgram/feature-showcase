import { describe, expect, it } from 'vitest'
import feature from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('punctuate', () => {
  it('sends punctuate either way on Nova-3, and never smart_format', () => {
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&punctuate=true')
    expect(describeRequest(nova, feature.params({ on: false }, ctx()))).toBe('/v1/listen?model=nova-3&punctuate=false')
  })

  it('sends nothing for it on Flux, which refuses the param', () => {
    expect(describeRequest(flux, feature.params({ on: true }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en')
  })
})
