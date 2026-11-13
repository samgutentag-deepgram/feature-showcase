import { describe, expect, it } from 'vitest'
import feature from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('measurements', () => {
  it('offers Nova-3 only, since Flux does not support it', () => {
    expect(feature.models.map((m) => m.id)).toEqual(['nova-3'])
  })

  it('sends measurements either way on Nova-3, the forms verified live', () => {
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&measurements=true')
    expect(describeRequest(nova, feature.params({ on: false }, ctx()))).toBe('/v1/listen?model=nova-3&measurements=false')
  })

})
