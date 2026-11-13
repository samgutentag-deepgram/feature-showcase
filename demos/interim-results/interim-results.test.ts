import { describe, expect, it } from 'vitest'
import feature from '.'
import { describeRequest, requestParams } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('interim-results', () => {
  it('sends exactly the setting shown, which the shell does not override', () => {
    const off = feature.params({ on: false }, ctx())
    expect(describeRequest(nova, off)).toBe('/v1/listen?model=nova-3&interim_results=false')
    expect(requestParams(nova, off)).toMatchObject({ interim_results: 'false' })
  })

  it('sends nothing for it on Flux, which refuses the param', () => {
    expect(describeRequest(flux, feature.params({ on: true }, ctx(flux)))).toBe('/v2/listen?model=flux-general-en')
    expect(requestParams(flux, feature.params({ on: true }, ctx(flux)))).not.toHaveProperty('interim_results')
  })

  it('shows whether the last message was final', () => {
    const msg = { type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'i am going' }] } }
    expect(feature.echo?.(msg, nova)).toEqual({ key: 'is_final', value: 'false', transcript: 'i am going' })
    expect(feature.echo?.({ type: 'TurnInfo', event: 'Update', transcript: 'I am' }, flux)).toEqual({
      key: 'event',
      value: '"Update"',
      transcript: 'I am',
    })
  })
})
