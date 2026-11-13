import { describe, expect, it } from 'vitest'
import feature, { turns } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const flux = feature.models.find((m) => m.id === 'flux')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('turn-detection', () => {
  it('sends endpointing on Nova-3 and eot_threshold on Flux, the forms verified live', () => {
    const state = { endpointing: '300', eot: '0.9' }
    expect(describeRequest(nova, feature.params(state, ctx()))).toBe('/v1/listen?model=nova-3&endpointing=300')
    expect(describeRequest(flux, feature.params(state, ctx(flux)))).toBe('/v2/listen?model=flux-general-en&eot_threshold=0.9')
  })

  it('starts a new row after each word that ends a turn', () => {
    const w = (text: string, endsTurn = false) => ({ text, lang: '', endsTurn })
    const rows = turns([w('book'), w('a'), w('table', true), w('four'), w('people')])
    expect(rows.map((r) => [r.words.length, r.done])).toEqual([[3, true], [2, false]])
  })

  it('shows the last end of turn from either model', () => {
    const nova3 = { type: 'Results', speech_final: true, channel: { alternatives: [{ transcript: 'book a table for' }] } }
    expect(feature.echo?.(nova3, nova)).toEqual({ key: 'speech_final', value: 'true', transcript: 'book a table for' })
    expect(feature.echo?.({ type: 'TurnInfo', event: 'EndOfTurn', transcript: 'Done.' }, flux)).toMatchObject({ key: 'event' })
    expect(feature.echo?.({ type: 'TurnInfo', event: 'Update', transcript: 'Do' }, flux)).toBeUndefined()
  })
})
