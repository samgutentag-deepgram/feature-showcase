import { describe, expect, it } from 'vitest'
import feature, { recordedQuery, requestId } from '.'
import { describeRequest } from '../../shared/common/config'

const flux = feature.models.find((m) => m.id === 'flux')!
const nova = feature.models.find((m) => m.id === 'nova-3')!
const ctx = (model = flux) => ({ model, mode: feature.modes[0], busy: false })

describe('redact-usage', () => {
  it('sends the keyterms and redact_usage either way', () => {
    expect(describeRequest(flux, feature.params({ on: true }, ctx()))).toBe(
      '/v2/listen?model=flux-general-en&keyterm=Jane+Doe&keyterm=Acme&redact_usage=true',
    )
    expect(describeRequest(nova, feature.params({ on: false }, ctx(nova)))).toBe(
      '/v1/listen?model=nova-3&keyterm=Jane+Doe&keyterm=Acme&redact_usage=false',
    )
  })

  it('describes the usage record path as the Management API returned it', () => {
    expect(recordedQuery(true)).toBe('keyterm=%5BREDACTED%5D&keyterm=%5BREDACTED%5D&redact_usage=%5BREDACTED%5D')
    expect(recordedQuery(false)).toBe('keyterm=Jane+Doe&keyterm=Acme&redact_usage=false')
  })

  it('reads request_id from a Flux TurnInfo and a Nova-3 Results', () => {
    expect(requestId({ type: 'TurnInfo', request_id: 'a' })).toBe('a')
    expect(requestId({ type: 'Results', metadata: { request_id: 'b' } })).toBe('b')
    expect(requestId({ type: 'Results' })).toBeUndefined()
  })
})
