import { describe, expect, it } from 'vitest'
import feature, { FILLER } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('filler-words', () => {
  it('sends filler_words either way on Nova-3, the forms verified live', () => {
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&smart_format=true&filler_words=true')
    expect(describeRequest(nova, feature.params({ on: false }, ctx()))).toBe('/v1/listen?model=nova-3&smart_format=true&filler_words=false')
  })

  it('sends nothing for it on Flux, which refuses the param', () => {
    expect(describeRequest(flux, feature.params({ on: true }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en')
  })

  it('marks fillers and nothing else', () => {
    expect(['um,', 'uh', 'Uh,', 'umm', 'hmm', 'er'].every((w) => FILLER.test(w))).toBe(true)
    expect(['ummah', 'under', 'her', 'hum', 'Thursday'].some((w) => FILLER.test(w))).toBe(false)
  })
})
