import { describe, expect, it } from 'vitest'
import feature, { STARRED } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('profanity-filter', () => {
  it('sends profanity_filter on both models, the forms verified live', () => {
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&smart_format=true&profanity_filter=true')
    expect(describeRequest(flux, feature.params({ on: true }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en&profanity_filter=true')
    expect(describeRequest(flux, feature.params({ on: false }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en&profanity_filter=false')
  })

  it('marks starred words only', () => {
    expect(['****', '****.', '***,'].every((w) => STARRED.test(w))).toBe(true)
    expect(['*', 'damn', 'a*b'].some((w) => STARRED.test(w))).toBe(false)
  })
})
