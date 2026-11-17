import { describe, expect, it } from 'vitest'
import feature, { requestId } from '.'
import { describeRequest } from '../../shared/common/config'

const flux = feature.models.find((m) => m.id === 'flux')!
const nova = feature.models.find((m) => m.id === 'nova-3')!
const ctx = (model = flux) => ({ model, mode: feature.modes[0], busy: false })

describe('tag-usage', () => {
  it('shows one tag, or the param repeated for two', () => {
    expect(describeRequest(flux, feature.params({ team: 'support', env: false }, ctx()))).toBe(
      '/v2/listen?model=flux-general-en&tag=team-support',
    )
    expect(describeRequest(nova, feature.params({ team: 'sales', env: true }, ctx(nova)))).toBe(
      '/v1/listen?model=nova-3&tag=team-sales&tag=env-demo',
    )
  })

  it('reads request_id from a Flux TurnInfo and a Nova-3 Results', () => {
    expect(requestId({ type: 'TurnInfo', request_id: 'a' })).toBe('a')
    expect(requestId({ type: 'Results', metadata: { request_id: 'b' } })).toBe('b')
    expect(requestId({ type: 'Results' })).toBeUndefined()
  })
})
