import { describe, expect, it } from 'vitest'
import feature, { pieces } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models[0]
const ctx = { model: nova, mode: feature.modes[0], busy: false }
const results = (name: string, transcript: string) => ({
  ms: 0,
  name,
  msg: { type: 'Results', channel: { alternatives: [{ transcript }] } },
})

describe('utterance-end', () => {
  it('shows interim_results=true on the card, since the handshake is a 400 without it', () => {
    expect(describeRequest(nova, feature.params({ ms: '2500' }, ctx))).toBe(
      '/v1/listen?model=nova-3&interim_results=true&utterance_end_ms=2500',
    )
  })

  it('marks speech_final and UtteranceEnd in the order they arrived, skipping the empty close flush', () => {
    const out = pieces([
      results('Results speech_final', 'i want to book a table for'),
      { ms: 1, name: 'UtteranceEnd', msg: { type: 'UtteranceEnd', channel: [0, 1], last_word_end: 1.52 } },
      results('Results is_final', 'four people'),
      results('Results speech_final', 'tomorrow night'),
      { ms: 2, name: 'CloseStream', sent: true, msg: { type: 'CloseStream' } },
      results('Results speech_final', ''),
    ])
    expect(out).toEqual([
      { text: 'i want to book a table for' },
      { mark: 'speech_final' },
      { mark: 'UtteranceEnd', at: 1.52 },
      { text: 'four people' },
      { text: 'tomorrow night' },
      { mark: 'speech_final' },
    ])
  })

  it('shows only UtteranceEnd on the Response card', () => {
    const ue = { type: 'UtteranceEnd', channel: [0, 1], last_word_end: 4.43 }
    expect(feature.echo?.(ue, nova)).toBe(ue)
    expect(feature.echo?.({ type: 'Results', speech_final: true }, nova)).toBeUndefined()
  })
})
